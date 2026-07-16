import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.auth_login_service import AuthLoginService


@pytest.mark.asyncio
async def test_login_rejects_unknown_email():
    from app.models.user import User
    service = AuthLoginService()
    with patch.object(User, "find", create=True) as mock_find:
        mock_query = MagicMock()
        mock_query.to_list = AsyncMock(return_value=[])
        mock_find.return_value = mock_query

        data, error = await service.login("missing@example.com", "password")
        assert data is None
        assert error == "Invalid email or password"


@pytest.mark.asyncio
async def test_login_rejects_inactive_tenant_user():
    from app.models.user import User
    service = AuthLoginService()
    user = MagicMock()
    user.email = "owner@salon.com"
    user.role = "salon_owner"
    user.is_active = False
    user.status = "INACTIVE"
    user.hashed_password = "hash"
    user.tenant_id = "tenant1"
    user.id = "uid"

    with patch.object(User, "find", create=True) as mock_find, patch(
        "app.services.auth_login_service.verify_password", return_value=True
    ):
        mock_query = MagicMock()
        mock_query.to_list = AsyncMock(return_value=[user])
        mock_find.return_value = mock_query

        data, error = await service.login("owner@salon.com", "password")
        assert data is None
        assert "not active" in (error or "").lower()
