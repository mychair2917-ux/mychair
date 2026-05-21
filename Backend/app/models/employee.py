from typing import List, Optional
from pydantic import Field, EmailStr
from app.models.base import BaseTenantDocument


class Employee(BaseTenantDocument):
    """Staff member record linked to a salon branch within a tenant."""
    salon_id: str = Field(..., index=True)
    employee_code: str = Field(...)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    phone: str = Field(...)
    email: Optional[EmailStr] = Field(default=None)
    designation: str = Field(...)
    department: str = Field(...)
    salary_type: str = Field(default="fixed")
    salary_amount: float = Field(default=0.0)
    commission_percentage: float = Field(default=0.0)
    skills: List[str] = Field(default_factory=list)
    weekly_off: List[str] = Field(default_factory=list)
    is_active: bool = Field(default=True)

    class Settings:
        name = "employees"
        indexes = [
            [("tenant_id", 1), ("salon_id", 1), ("employee_code", 1)],
            "is_deleted",
        ]
