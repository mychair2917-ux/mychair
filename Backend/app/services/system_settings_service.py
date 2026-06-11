from typing import Optional, Tuple

from app.models.system_settings import SystemSettings
from app.constants.subscription_options import DEFAULT_SUBSCRIPTION_DAYS
from app.utils.timezone import now_utc


class SystemSettingsService:
    GLOBAL_KEY = "global"

    async def get_or_create(self) -> SystemSettings:
        settings = await SystemSettings.find_one(SystemSettings.key == self.GLOBAL_KEY)
        if settings:
            return settings
        settings = SystemSettings(
            key=self.GLOBAL_KEY,
            default_subscription_days=DEFAULT_SUBSCRIPTION_DAYS,
        )
        await settings.insert()
        return settings

    async def get_default_subscription_days(self) -> int:
        settings = await self.get_or_create()
        return settings.default_subscription_days

    async def update_default_subscription_days(
        self,
        days: int,
        updated_by: Optional[str] = None,
    ) -> Tuple[Optional[dict], Optional[str]]:
        if days < 1:
            return None, "Default subscription days must be at least 1"
        settings = await self.get_or_create()
        settings.default_subscription_days = days
        settings.updated_at = now_utc()
        settings.updated_by = updated_by
        await settings.save()
        return {
            "default_subscription_days": settings.default_subscription_days,
            "updated_at": settings.updated_at.isoformat(),
        }, None
