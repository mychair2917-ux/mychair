from fastapi import Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from app.core.config import settings
from app.core.exceptions import AuthException, PermissionDeniedException
from app.models.user import User
from app.auth.permissions import verify_role_has_permission
from app.core import tenant_context

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user_claims(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> dict:
    """
    Decodes the JWT Bearer token and returns raw claims payload.
    Automatically verifies signatures and exp claims.
    """
    if not credentials:
        raise AuthException("Authentication credentials are required")
        
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthException("Token signature has expired")
    except jwt.JWTError:
        raise AuthException("Could not validate credentials")

async def get_current_user(claims: dict = Depends(get_current_user_claims)) -> User:
    """
    Retrieves the User object from the database associated with the active token claims.
    Injects context bindings.
    """
    user_id = claims.get("sub")
    tenant_id = claims.get("tenant_id")
    
    if not user_id:
        raise AuthException("Token payload is missing user ID")
        
    # Enforce active context just in case dependencies run out of middleware order
    tenant_context.set_tenant_id(tenant_id)
    tenant_context.set_user_id(user_id)
    
    user = await User.find_one(User.id == user_id, User.tenant_id == tenant_id, User.is_deleted == False)
    if not user:
        raise AuthException("User associated with this token does not exist")
        
    if not user.is_active:
        raise AuthException("User account is inactive or suspended")
        
    return user

class PermissionChecker:
    """
    FastAPI dependency factory class enforcing granular permissions.
    Usage: current_user: User = Depends(PermissionChecker("inventory.edit"))
    """
    def __init__(self, required_permission: str) -> None:
        self.required_permission = required_permission

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        verify_role_has_permission(current_user.role, self.required_permission)
        return current_user
