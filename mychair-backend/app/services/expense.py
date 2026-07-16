import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from beanie import PydanticObjectId
from fastapi import UploadFile

from app.auth.rbac_config import ROLE_SUPER_ADMIN, normalize_role
from app.constants.expense_options import CATEGORY_LABELS, PAYMENT_MODE_LABELS
from app.core import tenant_context
from app.core.config import settings
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.expense import Expense
from app.models.user import User
from app.repositories.expense import ExpenseRepository
from app.schemas.expense import (
    ExpenseCreateRequest,
    ExpenseItem,
    ExpenseUpdateRequest,
    PaginatedExpenseData,
)
from app.utils.image_type import detect_image_type
from app.utils.timezone import now_utc

ALLOWED_RECEIPT_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
}
ALLOWED_IMAGE_TYPES = {"jpeg", "png"}
MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024


class ExpenseService:
    def __init__(self) -> None:
        self.repo = ExpenseRepository()
        self.receipt_dir = (
            Path(__file__).resolve().parents[2] / "uploads" / "receipts"
        )
        self.receipt_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_salon_id(self, actor: User, salon_id: Optional[str] = None) -> str:
        resolved = (salon_id or tenant_context.get_tenant_id() or actor.tenant_id or "").strip()
        if not resolved:
            raise PermissionDeniedException(detail="No salon associated with your account")
        return resolved

    @staticmethod
    def _full_name(user: User) -> str:
        parts = [user.first_name or "", user.last_name or ""]
        name = " ".join(part for part in parts if part).strip()
        return name or user.email

    async def _get_expense_in_scope(self, actor: User, expense_id: str) -> Expense:
        try:
            obj_id = PydanticObjectId(expense_id)
        except Exception as exc:
            raise ResourceNotFoundException("Expense not found") from exc

        salon_id = self._resolve_salon_id(actor)
        query: Dict[str, Any] = {"_id": obj_id, "is_deleted": False}
        effective_tenant = tenant_context.get_tenant_id()
        if effective_tenant:
            query["tenant_id"] = effective_tenant

        expense = await Expense.find_one(query)
        if not expense:
            raise ResourceNotFoundException("Expense not found")
        if normalize_role(actor.role) != ROLE_SUPER_ADMIN and expense.salon_id != salon_id:
            raise PermissionDeniedException(detail="Cross-tenant access denied")
        return expense

    async def _generate_expense_no(self, salon_id: str) -> str:
        count = await self.repo.count_for_salon(salon_id)
        short_id = salon_id[-4:].upper() if len(salon_id) >= 4 else salon_id.upper()
        return f"EXP-{short_id}-{count + 1:04d}"

    def _to_item(self, expense: Expense) -> ExpenseItem:
        return ExpenseItem(
            id=str(expense.id),
            expense_no=expense.expense_no,
            salon_id=expense.salon_id,
            branch_id=expense.branch_id,
            category=expense.category,
            category_label=CATEGORY_LABELS.get(expense.category, expense.category),
            amount=expense.amount,
            payment_mode=expense.payment_mode,
            payment_mode_label=PAYMENT_MODE_LABELS.get(
                expense.payment_mode, expense.payment_mode
            ),
            expense_date=expense.expense_date,
            vendor_name=expense.vendor_name,
            description=expense.description,
            receipt_url=expense.receipt_url,
            created_by=expense.created_by,
            created_by_name=expense.created_by_name,
            created_at=expense.created_at,
            updated_at=expense.updated_at,
        )

    async def list_expenses(
        self,
        actor: User,
        salon_id: str,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        sort_by: str = "expense_date",
        sort_order: str = "desc",
        category: Optional[str] = None,
        payment_mode: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> PaginatedExpenseData:
        effective_salon_id = self._resolve_salon_id(actor, salon_id)
        filters: Dict[str, Any] = {"salon_id": effective_salon_id}
        if branch_id:
            filters["branch_id"] = branch_id
        if category:
            filters["category"] = category.strip().lower().replace(" ", "_")
        if payment_mode:
            filters["payment_mode"] = payment_mode.strip().lower().replace(" ", "_")

        items, total = await self.repo.list_expenses(
            filters=filters,
            page=page,
            limit=limit,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        pages = max(1, (total + limit - 1) // limit) if total > 0 else 1
        return PaginatedExpenseData(
            items=[self._to_item(item) for item in items],
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def get_expense(self, actor: User, expense_id: str) -> ExpenseItem:
        expense = await self._get_expense_in_scope(actor, expense_id)
        return self._to_item(expense)

    async def create_expense(
        self, actor: User, payload: ExpenseCreateRequest
    ) -> ExpenseItem:
        salon_id = self._resolve_salon_id(actor, payload.salon_id)
        expense_no = await self._generate_expense_no(salon_id)
        expense = Expense(
            expense_no=expense_no,
            salon_id=salon_id,
            branch_id=payload.branch_id or salon_id,
            category=payload.category,
            amount=payload.amount,
            payment_mode=payload.payment_mode,
            expense_date=payload.expense_date,
            vendor_name=payload.vendor_name,
            description=payload.description,
            created_by_name=self._full_name(actor),
        )
        await expense.insert()
        return self._to_item(expense)

    async def update_expense(
        self, actor: User, expense_id: str, payload: ExpenseUpdateRequest
    ) -> ExpenseItem:
        expense = await self._get_expense_in_scope(actor, expense_id)
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return self._to_item(expense)
        for field, value in update_data.items():
            setattr(expense, field, value)
        expense.updated_by = str(actor.id)
        await expense.save()
        return self._to_item(expense)

    async def delete_expense(self, actor: User, expense_id: str) -> None:
        expense = await self._get_expense_in_scope(actor, expense_id)
        expense.is_deleted = True
        expense.deleted_at = now_utc()
        expense.updated_by = str(actor.id)
        await expense.save()

    async def upload_receipt(
        self, actor: User, expense_id: str, file: UploadFile
    ) -> ExpenseItem:
        expense = await self._get_expense_in_scope(actor, expense_id)
        if file.content_type not in ALLOWED_RECEIPT_MIME_TYPES:
            raise PermissionDeniedException(
                detail="Only PNG, JPEG images and PDF files are allowed"
            )
        content = await file.read()
        stored_path = self._write_receipt_bytes(expense, content, file.content_type)
        self._delete_receipt_file(expense.receipt_url)
        expense.receipt_url = stored_path
        expense.updated_by = str(actor.id)
        await expense.save()
        return self._to_item(expense)

    def _write_receipt_bytes(
        self, expense: Expense, content: bytes, content_type: Optional[str]
    ) -> str:
        if not content:
            raise PermissionDeniedException(detail="Receipt file is required")
        if len(content) > MAX_RECEIPT_SIZE_BYTES:
            raise PermissionDeniedException(detail="Receipt file must be 5MB or smaller")

        extension = "pdf"
        if content_type and content_type.startswith("image/"):
            image_type = detect_image_type(content)
            if image_type not in ALLOWED_IMAGE_TYPES:
                raise PermissionDeniedException(detail="Unsupported image format")
            extension = "jpg" if image_type == "jpeg" else image_type
        elif content_type != "application/pdf":
            raise PermissionDeniedException(detail="Unsupported file format")

        file_name = f"{expense.id}-{uuid.uuid4().hex}.{extension}"
        file_path = self.receipt_dir / file_name
        with open(file_path, "wb") as output:
            output.write(content)
        public_base = settings.API_V1_STR.rstrip("/")
        return f"{public_base}/expenses/receipt-files/{file_name}"

    def _delete_receipt_file(self, receipt_path: Optional[str]) -> None:
        if not receipt_path:
            return
        file_name = receipt_path.rsplit("/", 1)[-1]
        if not file_name:
            return
        file_path = self.receipt_dir / file_name
        try:
            if file_path.exists():
                file_path.unlink()
        except OSError:
            pass

    @staticmethod
    def receipt_file_path(file_name: str) -> Path:
        service = ExpenseService()
        return service.receipt_dir / file_name

    @staticmethod
    def receipt_media_type(file_name: str) -> str:
        suffix = Path(file_name).suffix.lower()
        if suffix == ".pdf":
            return "application/pdf"
        if suffix == ".png":
            return "image/png"
        return "image/jpeg"
