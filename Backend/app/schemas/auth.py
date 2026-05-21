from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    tenant_id: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    tenant_id: Optional[str] = None
    role: Optional[str] = None


class TokenData(BaseModel):
    """Decoded JWT claims used by services."""
    user_id: str
    tenant_id: str
    role: str
    exp: Optional[int] = None

    @classmethod
    def from_jwt_claims(cls, claims: dict) -> "TokenData":
        return cls(
            user_id=claims.get("sub", ""),
            tenant_id=claims.get("tenant_id", ""),
            role=claims.get("role", ""),
            exp=claims.get("exp"),
        )
