import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.api.dependencies.auth import get_current_user
from app.api.dependencies.rbac import get_merged_permissions
from app.auth.module_permission_registry import default_permissions_for_role
from tests.conftest import make_user


@pytest.mark.asyncio
async def test_salon_admin_cannot_create_super_admin():
    salon_admin = make_user("salon_admin")
    app.dependency_overrides[get_current_user] = lambda: salon_admin
    app.dependency_overrides[get_merged_permissions] = lambda: default_permissions_for_role("salon_admin")
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            with patch(
                "app.repositories.user_repository.UserRepository.get_by_email",
                new_callable=AsyncMock,
                return_value=None,
            ):
                response = await client.post(
                    "/api/v1/users/",
                    json={
                        "email": "newsa@example.com",
                        "password": "securepass1",
                        "phone": "1234567890",
                        "role": "super_admin",
                    },
                    headers={"Authorization": "Bearer fake"},
                )
        assert response.status_code == 403
        assert "cannot create" in response.json()["message"].lower()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_employee_cannot_create_user():
    employee = make_user("employee", user_id="507f1f77bcf86cd799439013")
    app.dependency_overrides[get_current_user] = lambda: employee
    app.dependency_overrides[get_merged_permissions] = lambda: default_permissions_for_role("employee")
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/api/v1/users/",
                json={
                    "email": "foo@example.com",
                    "password": "securepass1",
                    "phone": "1234567890",
                    "role": "employee",
                },
                headers={"Authorization": "Bearer fake"},
            )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
