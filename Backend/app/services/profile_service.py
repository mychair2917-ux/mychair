import base64
import binascii
import imghdr
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import UploadFile

from app.auth.rbac_config import ROLE_SALON_ADMIN, ROLE_SALON_OWNER, ROLE_SUPER_ADMIN, normalize_role
from app.core.config import settings
from app.core.exceptions import PermissionDeniedException
from app.core.security import get_password_hash, verify_password
from app.models.salon import Salon
from app.models.tenant import Tenant
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.profile import ChangePasswordRequest, ProfileResponse, ProfileUpdateRequest
from app.services.permission_service import PermissionService


ALLOWED_IMAGE_TYPES = {"jpeg", "png"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024


class ProfileService:
    def __init__(self) -> None:
        self.repo = UserRepository()
        self.avatar_dir = (
            Path(__file__).resolve().parents[2] / "uploads" / "avatars"
        )
        self.avatar_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _full_name(user: User) -> str:
        parts = [user.first_name or "", user.last_name or ""]
        name = " ".join(part for part in parts if part).strip()
        return name or user.username or user.email

    @staticmethod
    def _can_edit_professional_fields(user: User) -> bool:
        return normalize_role(user.role) in {
            ROLE_SUPER_ADMIN,
            ROLE_SALON_OWNER,
            ROLE_SALON_ADMIN,
        }

    async def _resolve_salon_name(self, user: User) -> Optional[str]:
        if user.salon_name:
            return user.salon_name
        if user.tenant_id:
            tenant = await Tenant.get(user.tenant_id)
            if tenant:
                return tenant.name
        return None

    async def _resolve_branch_name(self, user: User) -> Optional[str]:
        if user.branch_name:
            return user.branch_name
        if user.branch_id:
            salon = await Salon.get(user.branch_id)
            if salon:
                return salon.name
        return None

    async def to_profile_response(self, user: User) -> ProfileResponse:
        salon_name = await self._resolve_salon_name(user)
        branch_name = await self._resolve_branch_name(user)
        permissions = await PermissionService().get_merged_permissions(user)
        return ProfileResponse(
            id=str(user.id),
            tenant_id=user.tenant_id,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=self._full_name(user),
            email=user.email,
            phone=user.phone,
            alternate_phone=user.alternate_phone,
            gender=user.gender,
            dob=user.dob,
            avatar=user.avatar,
            address=user.address,
            city=user.city,
            state=user.state,
            country=user.country,
            pincode=user.pincode,
            role=user.role,
            department=user.department,
            designation=user.designation,
            shift=user.shift,
            branch_id=user.branch_id,
            branch_name=branch_name,
            salon_name=salon_name,
            joining_date=user.joining_date,
            employee_id=user.employee_id,
            employee_code=user.employee_code,
            last_login=user.last_login,
            status=user.status,
            is_active=user.is_active,
            updated_by=user.updated_by,
            created_at=user.created_at,
            updated_at=user.updated_at,
            can_edit_professional_info=self._can_edit_professional_fields(user),
            can_change_password=True,
            can_manage_avatar=True,
            permissions=permissions,
        )

    async def get_profile(self, current_user: User) -> ProfileResponse:
        return await self.to_profile_response(current_user)

    async def update_profile(
        self, current_user: User, payload: ProfileUpdateRequest
    ) -> ProfileResponse:
        update_data: Dict[str, Any] = payload.model_dump(exclude_unset=True)
        if not update_data:
            return await self.to_profile_response(current_user)

        if "email" in update_data:
            normalized_email = str(update_data["email"]).lower()
            current_email = str(current_user.email or "").lower()
            if normalized_email != current_email:
                if normalize_role(current_user.role) == ROLE_SUPER_ADMIN:
                    existing = await self.repo.get_by_email_global_excluding_user(
                        normalized_email, str(current_user.id)
                    )
                else:
                    existing = await self.repo.get_by_email_excluding_user(
                        normalized_email,
                        str(current_user.id),
                        tenant_id=current_user.tenant_id,
                    )
                if existing:
                    raise PermissionDeniedException(detail="Email is already registered")
            update_data["email"] = normalized_email

        professional_fields = {
            "department",
            "designation",
            "shift",
            "branch_id",
            "branch_name",
            "employee_code",
            "joining_date",
            "status",
            "is_active",
        }
        if not self._can_edit_professional_fields(current_user):
            for field in professional_fields:
                update_data.pop(field, None)

        update_data["updated_by"] = str(current_user.id)
        for field, value in update_data.items():
            setattr(current_user, field, value)
        await current_user.save()
        return await self.to_profile_response(current_user)

    async def change_password(
        self, current_user: User, payload: ChangePasswordRequest
    ) -> None:
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise PermissionDeniedException(detail="Current password is incorrect")
        current_user.hashed_password = get_password_hash(payload.new_password)
        current_user.refresh_token_version += 1
        current_user.updated_by = str(current_user.id)
        await current_user.save()

    async def upload_avatar(self, current_user: User, file: UploadFile) -> ProfileResponse:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise PermissionDeniedException(detail="Only PNG and JPEG images are allowed")
        content = await file.read()
        stored_path = self._write_avatar_bytes(current_user, content)
        self._delete_avatar_file(current_user.avatar)
        current_user.avatar = stored_path
        current_user.updated_by = str(current_user.id)
        await current_user.save()
        return await self.to_profile_response(current_user)

    async def remove_avatar(self, current_user: User) -> ProfileResponse:
        self._delete_avatar_file(current_user.avatar)
        current_user.avatar = None
        current_user.updated_by = str(current_user.id)
        await current_user.save()
        return await self.to_profile_response(current_user)

    def _write_avatar_bytes(self, current_user: User, content: bytes) -> str:
        if not content:
            raise PermissionDeniedException(detail="Avatar image is required")
        if len(content) > MAX_AVATAR_SIZE_BYTES:
            raise PermissionDeniedException(detail="Avatar image must be 2MB or smaller")
        image_type = imghdr.what(None, h=content)
        if image_type not in ALLOWED_IMAGE_TYPES:
            raise PermissionDeniedException(detail="Unsupported image format")
        extension = "jpg" if image_type == "jpeg" else image_type
        file_name = f"{current_user.id}-{uuid.uuid4().hex}.{extension}"
        file_path = self.avatar_dir / file_name
        with open(file_path, "wb") as output:
            output.write(content)
        public_base = settings.API_V1_STR.rstrip("/")
        return f"{public_base}/profile/avatar-files/{file_name}"

    def _delete_avatar_file(self, avatar_path: Optional[str]) -> None:
        if not avatar_path:
            return
        file_name = avatar_path.rsplit("/", 1)[-1]
        if not file_name:
            return
        file_path = self.avatar_dir / file_name
        try:
            if file_path.exists():
                file_path.unlink()
        except OSError:
            pass

