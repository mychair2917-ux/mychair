from fastapi import Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt

from app.core.config import settings
from app.core.exceptions import AuthException
from app.models.salon_owner import SalonOwner

security_scheme = HTTPBearer(auto_error=False)


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

    if payload.get("role") != "salon_owner":
        raise AuthException("Unauthorized. Salon owner access required.")

    return payload


async def get_current_salon_owner(
    claims: dict = Depends(get_current_salon_owner_claims),
) -> SalonOwner:
    owner_id = claims.get("sub")
    if not owner_id:
        raise AuthException("Token payload is missing owner ID")

    owner = await SalonOwner.get(owner_id)
    if not owner:
        raise AuthException("Salon owner associated with this token does not exist")

    if not owner.is_active:
        raise AuthException("Salon owner account is inactive")

    return owner
