from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Any, Dict, Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    tenant_id: str
    id: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    avatar: Optional[str] = None
    employee_id: Optional[str] = None
    employee_code: Optional[str] = None
    branch_name: Optional[str] = None
    branch_id: Optional[str] = None
    salon_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    shift: Optional[str] = None
    status: Optional[str] = None
    joining_date: Optional[str] = None
    last_login: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None


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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    success: bool = True
    message: str = "If an account exists, a password reset link has been sent."


class ValidateResetTokenResponse(BaseModel):
    valid: bool


class ResetPasswordFormRequest(BaseModel):
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    confirmPassword: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v

    @model_validator(mode="after")
    def validate_passwords_match(self) -> "ResetPasswordFormRequest":
        if self.password != self.confirmPassword:
            raise ValueError("Passwords do not match.")
        return self


class ResetPasswordFormResponse(BaseModel):
    success: bool = True
    message: str = "Password updated successfully."

