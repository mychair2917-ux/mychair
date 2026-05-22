from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class CreateInvitationRequest(BaseModel):
    salon_name: str = Field(..., min_length=2, max_length=150)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    address: str = Field(default="", max_length=500)


class CreatePasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class SalonOwnerLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class InvitationValidationData(BaseModel):
    salon_name: str
    email: str
    username: str
    expires_at: str
    is_valid: bool


class SalonOwnerProfileData(BaseModel):
    salon_name: str
    slug: str
    email: str
    username: str
    address: str
