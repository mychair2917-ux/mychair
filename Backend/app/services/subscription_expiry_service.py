import asyncio
import logging
from app.constants.subscription_options import EXPIRY_REMINDER_DAYS
from app.models.subscription import Subscription
from app.models.subscription_email_log import SubscriptionEmailLog
from app.models.tenant import Tenant
from app.constants.subscription_options import plan_label
from app.services.email_service import send_subscription_expiry_email
from app.services.subscription_service import SubscriptionService
from app.utils.timezone import now_utc

logger = logging.getLogger("subscription_expiry")


class SubscriptionExpiryService:
    def __init__(self) -> None:
        self._subscription_service = SubscriptionService()

    async def send_pending_reminders(self) -> int:
        sent_count = 0
        subscriptions = await Subscription.find(
            Subscription.status == "ACTIVE",
        ).to_list()

        for subscription in subscriptions:
            if not self._subscription_service.is_subscription_valid(subscription):
                continue

            days_remaining = self._subscription_service._compute_days_remaining(subscription.end_date)
            if days_remaining not in EXPIRY_REMINDER_DAYS:
                continue

            existing = await SubscriptionEmailLog.find_one(
                SubscriptionEmailLog.subscription_id == str(subscription.id),
                SubscriptionEmailLog.days_before_expiry == days_remaining,
            )
            if existing:
                continue

            tenant = await Tenant.get(subscription.tenant_id)
            if not tenant or not tenant.owner_email:
                continue

            success, _ = await send_subscription_expiry_email(
                to_email=tenant.owner_email,
                salon_name=tenant.name,
                plan_label=plan_label(subscription.plan_name),
                expiry_date=subscription.end_date,
                days_remaining=days_remaining,
            )
            if success:
                await SubscriptionEmailLog(
                    subscription_id=str(subscription.id),
                    tenant_id=subscription.tenant_id,
                    days_before_expiry=days_remaining,
                ).insert()
                sent_count += 1
                logger.info(
                    "Sent subscription expiry reminder (%s days) to tenant %s",
                    days_remaining,
                    subscription.tenant_id,
                )
        return sent_count


async def run_subscription_reminder_loop() -> None:
    service = SubscriptionExpiryService()
    while True:
        try:
            await service.send_pending_reminders()
        except Exception as exc:
            logger.error("Subscription reminder loop error: %s", exc)
        await asyncio.sleep(3600)
