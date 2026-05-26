from beanie import PydanticObjectId
from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt

from app.api.dependencies.auth import get_current_user, get_current_user_claims
from app.auth.invitation_rbac import ROLE_SALON_OWNER, assert_can_invite
from app.core.config import settings
from app.core.exceptions import AuthException
from app.models.user import User

security_scheme = HTTPBearer(auto_error=False)
InviteActor = User


async def _user_from_claims(claims: dict) -> User:
    user_id = claims.get("sub")
    tenant_id = claims.get("tenant_id")
    if not user_id:
        raise AuthException("Token payload is missing user ID")

    try:
        obj_id = PydanticObjectId(user_id)
    except Exception:
        raise AuthException("Invalid user ID in token")

    if tenant_id == "system" or claims.get("role") == "super_admin":
        user = await User.find_one({"_id": obj_id, "is_deleted": False})
    elif tenant_id:
        user = await User.find_one(
            {"_id": obj_id, "tenant_id": tenant_id, "is_deleted": False}
        )
    else:
        user = await User.find_one({"_id": obj_id, "is_deleted": False})

    if not user:
        raise AuthException("User associated with this token does not exist")
    if not user.is_active and user.role != ROLE_SALON_OWNER:
        raise AuthException("User account is inactive or suspended")
    return user


async def get_invite_actor(
    claims: dict = Depends(get_current_user_claims),
) -> InviteActor:
    """JWT user with permission to send invitations."""
    user = await _user_from_claims(claims)
    if user.role == ROLE_SALON_OWNER:
        if user.status != "ACTIVE" or not user.is_active:
            raise AuthException("Salon owner account is inactive")
    assert_can_invite(user.role)
    return user
