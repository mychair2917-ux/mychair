from fastapi import Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt

from app.core.config import settings
from app.core.exceptions import AuthException
from app.models.user import User

security_scheme = HTTPBearer(auto_error=False)

SALON_OWNER_ROLE = "salon_owner"


async def get_current_salon_owner_claims(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> dict:
    if not credentials:
        raise AuthException("Authentication credentials are required")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise AuthException("Token signature has expired")
    except jwt.JWTError:
        raise AuthException("Could not validate credentials")

    if payload.get("role") != SALON_OWNER_ROLE:
        raise AuthException("Unauthorized. Salon owner access required.")

    return payload


async def get_current_salon_owner(
    claims: dict = Depends(get_current_salon_owner_claims),
) -> User:
    owner_id = claims.get("sub")
    if not owner_id:
        raise AuthException("Token payload is missing owner ID")

    user = await User.get(owner_id)
    if not user or user.is_deleted:
        raise AuthException("Salon owner associated with this token does not exist")

    if user.role != SALON_OWNER_ROLE:
        raise AuthException("Unauthorized. Salon owner access required.")

    if not user.is_active or user.status != "ACTIVE":
        raise AuthException("Salon owner account is inactive")

    return user
