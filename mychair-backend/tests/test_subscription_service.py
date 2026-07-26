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

    @pytest.mark.asyncio
    async def test_activate_expired_auto_renews(self):
        service = SubscriptionService()
        past_end = now_utc() - timedelta(days=3)
        sub = MagicMock()
        sub.id = "sub-1"
        sub.tenant_id = "tenant-1"
        sub.salon_id = "salon-1"
        sub.plan_name = "BASIC"
        sub.status = "EXPIRED"
        sub.amount = 0
        sub.currency = "INR"
        sub.start_date = past_end - timedelta(days=30)
        sub.end_date = past_end
        sub.total_days = 30
        sub.billing_history = []
        sub.save = AsyncMock()

        service.get_subscription_by_id = AsyncMock(return_value=sub)
        service._settings_service.get_default_subscription_days = AsyncMock(return_value=30)
        service.sync_tenant_subscription_fields = AsyncMock()
        service._create_subscription_change_notification = AsyncMock()

        with patch("app.services.subscription_service.Tenant.get", new=AsyncMock(return_value=None)):
            data, errors = await service.update_subscription(
                "sub-1",
                {"status": "ACTIVE"},
                updated_by="admin-1",
            )

        assert errors is None
        assert data is not None
        assert sub.status == "ACTIVE"
        assert service._date_only(sub.end_date) >= now_utc().date()
        assert sub.total_days == 60
        sub.save.assert_awaited_once()


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
