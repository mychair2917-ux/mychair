from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.auth_refresh_service import AuthRefreshService
from app.services.subscription_service import SubscriptionService
from app.utils.timezone import now_utc


class TestSubscriptionService:
    def test_is_subscription_valid_active(self):
        service = SubscriptionService()
        sub = MagicMock()
        sub.status = "ACTIVE"
        sub.end_date = now_utc() + timedelta(days=5)
        assert service.is_subscription_valid(sub) is True

    def test_is_subscription_valid_expired_by_date(self):
        service = SubscriptionService()
        sub = MagicMock()
        sub.status = "ACTIVE"
        sub.end_date = now_utc() - timedelta(days=1)
        assert service.is_subscription_valid(sub) is False

    def test_is_subscription_valid_suspended(self):
        service = SubscriptionService()
        sub = MagicMock()
        sub.status = "SUSPENDED"
        sub.end_date = now_utc() + timedelta(days=5)
        assert service.is_subscription_valid(sub) is False


class TestAuthRefreshService:
    @pytest.mark.asyncio
    async def test_refresh_returns_subscription_expired(self):
        service = AuthRefreshService()
        user = MagicMock()
        user.id = "user-1"
        user.is_deleted = False
        user.refresh_token_version = 0
        user.role = "salon_owner"
        user.is_active = True
        user.status = "ACTIVE"
        user.tenant_id = "tenant-1"

        with patch("app.services.auth_refresh_service.jwt.decode", return_value={
            "sub": "user-1",
            "token_version": 0,
            "tenant_id": "tenant-1",
            "role": "salon_owner",
        }):
            with patch("app.services.auth_refresh_service.User.get", new=AsyncMock(return_value=user)):
                with patch.object(
                    service._subscription_service,
                    "check_subscription_for_user",
                    new=AsyncMock(return_value=(False, "SUBSCRIPTION_EXPIRED")),
                ):
                    data, error = await service.refresh("fake-token")
                    assert data is None
                    assert error == "SUBSCRIPTION_EXPIRED"
