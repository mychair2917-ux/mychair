import pytest
from unittest.mock import AsyncMock, MagicMock
from app.models.user import User


def make_user(
    role: str,
    user_id: str = "507f1f77bcf86cd799439011",
    tenant_id: str = "507f1f77bcf86cd799439012",
    email: str = "actor@example.com",
) -> User:
    user = MagicMock(spec=User)
    user.id = user_id
    user.role = role
    user.tenant_id = tenant_id
    user.email = email
    user.phone = "9999999999"
    user.permissions = []
    user.is_active = True
    user.first_name = "Test"
    user.last_name = "User"
    user.employee_id = None
    user.hashed_password = "hashed"
    return user
