import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.user_service import UserService
from app.schemas.user import UserCreate
from app.core.exceptions import PermissionDeniedException
from tests.conftest import make_user


@pytest.mark.asyncio
async def test_salon_admin_cannot_create_super_admin():
    actor = make_user("salon_admin")
    service = UserService()
    service.repo = MagicMock()
    service.repo.get_by_email = AsyncMock(return_value=None)
    service.repo.create_user = AsyncMock()

    payload = UserCreate(
        email="x@example.com",
        phone="111",
        password="password12",
        role="super_admin",
    )

    with pytest.raises(PermissionDeniedException):
        await service.create_user(payload, actor)


@pytest.mark.asyncio
async def test_employee_cannot_create_user():
    actor = make_user("employee")
    service = UserService()
    payload = UserCreate(
        email="x@example.com",
        phone="111",
        password="password12",
        role="employee",
    )

    with pytest.raises(PermissionDeniedException):
        await service.create_user(payload, actor)
