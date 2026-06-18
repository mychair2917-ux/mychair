from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.constants.subscription_options import (
    PLAN_AMOUNTS,
    SUBSCRIPTION_PLANS,
    SUBSCRIPTION_STATUSES,
    VALID_SUBSCRIPTION_PLAN_VALUES,
    normalize_plan_name,
    plan_label,
)
from app.models.salon import Salon
from app.models.subscription import BillingHistoryEntry, Subscription
from app.models.tenant import Tenant
from app.models.user import User
from app.services.notifications import notification_service
from app.services.system_settings_service import SystemSettingsService
from app.utils.timezone import make_aware, now_utc


class SubscriptionService:
    def __init__(self) -> None:
        self._settings_service = SystemSettingsService()

    @staticmethod
    def _date_only(dt: datetime) -> datetime.date:
        return make_aware(dt).date()

    def is_subscription_valid(self, subscription: Optional[Subscription]) -> bool:
        if not subscription:
            return False
        if subscription.status == "SUSPENDED":
            return False
        if subscription.status == "EXPIRED":
            return False
        today = now_utc().date()
        end = self._date_only(subscription.end_date)
        if today > end:
            return False
        return subscription.status == "ACTIVE"

    async def get_active_for_tenant(self, tenant_id: str) -> Optional[Subscription]:
        subscriptions = (
            await Subscription.find(Subscription.tenant_id == tenant_id)
            .sort("-created_at")
            .to_list()
        )
        for sub in subscriptions:
            if sub.status == "SUSPENDED":
                return sub
            if self.is_subscription_valid(sub):
                return sub
        return subscriptions[0] if subscriptions else None

    async def check_subscription_for_user(self, user: User) -> Tuple[bool, Optional[str]]:
        if user.role == "super_admin":
            return True, None
        if not user.tenant_id:
            return False, "SUBSCRIPTION_EXPIRED"
        subscription = await self.get_active_for_tenant(user.tenant_id)
        if not subscription:
            return False, "SUBSCRIPTION_EXPIRED"
        if not self.is_subscription_valid(subscription):
            return False, "SUBSCRIPTION_EXPIRED"
        return True, None

    async def sync_tenant_subscription_fields(
        self,
        tenant_id: str,
        subscription: Subscription,
    ) -> None:
        tenant = await Tenant.get(tenant_id)
        if not tenant:
            return
        tenant.subscription_plan = normalize_plan_name(subscription.plan_name)
        tenant.subscription_tier = tenant.subscription_plan
        tenant.subscription_status = subscription.status
        tenant.updated_at = now_utc()
        await tenant.save()

        owner = await User.find_one(
            User.tenant_id == tenant_id,
            User.role == "salon_owner",
            User.is_deleted == False,
        )
        if owner:
            owner.subscription_plan = tenant.subscription_plan
            await owner.save()

    async def create_for_salon(
        self,
        tenant_id: str,
        salon_id: str,
        plan_name: str,
        created_by: Optional[str] = None,
    ) -> Subscription:
        normalized_plan = normalize_plan_name(plan_name)
        if normalized_plan not in VALID_SUBSCRIPTION_PLAN_VALUES:
            raise ValueError("Invalid subscription plan")

        default_days = await self._settings_service.get_default_subscription_days()
        start = now_utc()
        end = start + timedelta(days=default_days)
        amount = PLAN_AMOUNTS.get(normalized_plan, 0.0)

        subscription = Subscription(
            tenant_id=tenant_id,
            salon_id=salon_id,
            plan_name=normalized_plan,
            status="ACTIVE",
            amount=amount,
            start_date=start,
            end_date=end,
            total_days=default_days,
            created_by=created_by,
            updated_by=created_by,
            billing_history=[
                BillingHistoryEntry(
                    date=start,
                    action="CREATED",
                    plan_name=normalized_plan,
                    amount=amount,
                    notes=f"Initial subscription for {default_days} days",
                )
            ],
        )
        await subscription.insert()
        await self.sync_tenant_subscription_fields(tenant_id, subscription)
        return subscription

    def _compute_days_remaining(self, end_date: datetime) -> int:
        delta = (self._date_only(end_date) - now_utc().date()).days
        return max(delta, 0)

    def _serialize_subscription(
        self,
        subscription: Subscription,
        salon_name: str = "",
        owner_email: str = "",
    ) -> dict:
        days_remaining = self._compute_days_remaining(subscription.end_date)
        effective_status = subscription.status
        if effective_status == "ACTIVE" and days_remaining == 0 and now_utc().date() > self._date_only(subscription.end_date):
            effective_status = "EXPIRED"
        elif effective_status == "ACTIVE" and now_utc().date() > self._date_only(subscription.end_date):
            effective_status = "EXPIRED"

        return {
            "id": str(subscription.id),
            "tenant_id": subscription.tenant_id,
            "salon_id": subscription.salon_id,
            "salon_name": salon_name,
            "owner_email": owner_email,
            "plan_name": subscription.plan_name,
            "plan_label": plan_label(subscription.plan_name),
            "status": effective_status,
            "amount": subscription.amount,
            "currency": subscription.currency,
            "start_date": subscription.start_date.isoformat(),
            "end_date": subscription.end_date.isoformat(),
            "total_days": subscription.total_days,
            "days_remaining": days_remaining if effective_status == "ACTIVE" else 0,
            "created_at": subscription.created_at.isoformat(),
            "updated_at": subscription.updated_at.isoformat(),
        }

    async def get_dashboard_stats(self) -> dict:
        all_subs = await Subscription.find_all().to_list()
        active = expired = suspended = upcoming = 0
        for sub in all_subs:
            if sub.status == "SUSPENDED":
                suspended += 1
                continue
            days_left = self._compute_days_remaining(sub.end_date)
            if self.is_subscription_valid(sub):
                active += 1
                if 0 < days_left <= 7:
                    upcoming += 1
            else:
                expired += 1
        default_days = await self._settings_service.get_default_subscription_days()
        return {
            "total_active": active,
            "total_expired": expired,
            "total_suspended": suspended,
            "upcoming_expirations": upcoming,
            "default_subscription_days": default_days,
        }

    async def list_subscriptions(
        self,
        search: Optional[str] = None,
        status: Optional[str] = None,
        plan_name: Optional[str] = None,
    ) -> List[dict]:
        subscriptions = await Subscription.find_all().sort("-created_at").to_list()
        tenant_map: dict[str, Tenant] = {}
        tenant_ids = {sub.tenant_id for sub in subscriptions}
        for tenant_id in tenant_ids:
            tenant = await Tenant.get(tenant_id)
            if tenant:
                tenant_map[tenant_id] = tenant

        results: List[dict] = []
        query = (search or "").strip().lower()
        status_filter = status.strip().upper() if status else None
        plan_filter = normalize_plan_name(plan_name) if plan_name else None

        for sub in subscriptions:
            tenant = tenant_map.get(sub.tenant_id)
            salon_name = tenant.name if tenant else ""
            owner_email = tenant.owner_email if tenant else ""
            serialized = self._serialize_subscription(sub, salon_name, owner_email)

            if status_filter and serialized["status"] != status_filter:
                continue
            if plan_filter and serialized["plan_name"] != plan_filter:
                continue
            if query:
                haystack = f"{salon_name} {owner_email} {serialized['plan_label']}".lower()
                if query not in haystack:
                    continue
            results.append(serialized)
        return results

    async def get_subscription_by_id(self, subscription_id: str) -> Optional[Subscription]:
        return await Subscription.get(subscription_id)

    async def update_subscription(
        self,
        subscription_id: str,
        payload: Dict[str, Any],
        updated_by: Optional[str] = None,
    ) -> Tuple[Optional[dict], Optional[dict]]:
        subscription = await self.get_subscription_by_id(subscription_id)
        if not subscription:
            return None, {"subscription": ["Subscription not found"]}

        previous_plan = subscription.plan_name
        previous_status = subscription.status
        previous_amount = PLAN_AMOUNTS.get(previous_plan, subscription.amount)
        field_errors: dict = {}
        notes_parts: List[str] = []

        if "plan_name" in payload and payload["plan_name"] is not None:
            plan = normalize_plan_name(payload["plan_name"])
            if plan not in VALID_SUBSCRIPTION_PLAN_VALUES:
                field_errors["plan_name"] = ["Invalid subscription plan"]
            else:
                if plan != subscription.plan_name:
                    notes_parts.append(f"Plan changed to {plan_label(plan)}")
                subscription.plan_name = plan
                subscription.amount = PLAN_AMOUNTS.get(plan, subscription.amount)

        if "status" in payload and payload["status"] is not None:
            status = payload["status"].strip().upper()
            if status not in SUBSCRIPTION_STATUSES:
                field_errors["status"] = ["Status must be ACTIVE, EXPIRED, or SUSPENDED"]
            else:
                if status != subscription.status:
                    notes_parts.append(f"Status changed to {status}")
                subscription.status = status

        if "start_date" in payload and payload["start_date"] is not None:
            try:
                start = make_aware(datetime.fromisoformat(payload["start_date"].replace("Z", "+00:00")))
                subscription.start_date = start
                notes_parts.append("Start date updated")
            except (TypeError, ValueError):
                field_errors["start_date"] = ["Invalid start date"]

        if "end_date" in payload and payload["end_date"] is not None:
            try:
                end = make_aware(datetime.fromisoformat(payload["end_date"].replace("Z", "+00:00")))
                subscription.end_date = end
                notes_parts.append("End date updated")
            except (TypeError, ValueError):
                field_errors["end_date"] = ["Invalid end date"]

        if "extend_days" in payload and payload["extend_days"] is not None:
            try:
                extend_days = int(payload["extend_days"])
                if extend_days < 1:
                    field_errors["extend_days"] = ["Extension must be at least 1 day"]
                else:
                    subscription.end_date = make_aware(subscription.end_date) + timedelta(days=extend_days)
                    subscription.total_days += extend_days
                    notes_parts.append(f"Extended by {extend_days} days")
            except (TypeError, ValueError):
                field_errors["extend_days"] = ["Invalid extension days"]

        if field_errors:
            return None, field_errors

        if subscription.start_date and subscription.end_date:
            if self._date_only(subscription.end_date) < self._date_only(subscription.start_date):
                return None, {"end_date": ["End date cannot be before start date"]}

        if subscription.status != "SUSPENDED":
            if now_utc().date() <= self._date_only(subscription.end_date):
                subscription.status = "ACTIVE"
            elif subscription.status != "EXPIRED":
                subscription.status = "EXPIRED"

        subscription.updated_at = now_utc()
        subscription.updated_by = updated_by

        if notes_parts:
            subscription.billing_history.append(
                BillingHistoryEntry(
                    date=now_utc(),
                    action="UPDATED",
                    plan_name=subscription.plan_name,
                    amount=subscription.amount,
                    notes="; ".join(notes_parts),
                )
            )

        await subscription.save()
        await self.sync_tenant_subscription_fields(subscription.tenant_id, subscription)
        await self._create_subscription_change_notification(
            subscription,
            previous_plan=previous_plan,
            previous_status=previous_status,
            previous_amount=previous_amount,
        )

        tenant = await Tenant.get(subscription.tenant_id)
        salon_name = tenant.name if tenant else ""
        owner_email = tenant.owner_email if tenant else ""
        return self._serialize_subscription(subscription, salon_name, owner_email), None

    async def _create_subscription_change_notification(
        self,
        subscription: Subscription,
        *,
        previous_plan: str,
        previous_status: str,
        previous_amount: float,
    ) -> None:
        current_amount = PLAN_AMOUNTS.get(subscription.plan_name, subscription.amount)
        if subscription.plan_name != previous_plan:
            event_type = "PLAN_UPGRADED" if current_amount > previous_amount else "PLAN_DOWNGRADED"
            await notification_service.create_subscription_notification(
                tenant_id=subscription.tenant_id,
                salon_id=subscription.salon_id or subscription.tenant_id,
                subscription_id=str(subscription.id),
                event_type=event_type,
                title="Plan upgraded" if event_type == "PLAN_UPGRADED" else "Plan downgraded",
                message=f"Subscription plan changed from {plan_label(previous_plan)} to {plan_label(subscription.plan_name)}.",
            )
        if subscription.status != previous_status:
            if subscription.status == "EXPIRED":
                await notification_service.create_subscription_notification(
                    tenant_id=subscription.tenant_id,
                    salon_id=subscription.salon_id or subscription.tenant_id,
                    subscription_id=str(subscription.id),
                    event_type="SUBSCRIPTION_EXPIRED",
                    title="Subscription expired",
                    message="The salon subscription has expired.",
                )
            elif subscription.status == "ACTIVE" and previous_status in {"EXPIRED", "SUSPENDED"}:
                await notification_service.create_subscription_notification(
                    tenant_id=subscription.tenant_id,
                    salon_id=subscription.salon_id or subscription.tenant_id,
                    subscription_id=str(subscription.id),
                    event_type="PAYMENT_SUCCESS",
                    title="Payment successful",
                    message="Subscription access is active again.",
                )

    async def get_owner_subscription_view(self, tenant_id: str) -> Optional[dict]:
        subscription = await self.get_active_for_tenant(tenant_id)
        if not subscription:
            return None
        tenant = await Tenant.get(tenant_id)
        salon_name = tenant.name if tenant else ""
        owner_email = tenant.owner_email if tenant else ""
        billing_history = [
            {
                "date": entry.date.isoformat(),
                "action": entry.action,
                "plan_name": entry.plan_name,
                "plan_label": plan_label(entry.plan_name),
                "amount": entry.amount,
                "notes": entry.notes,
            }
            for entry in subscription.billing_history
        ]
        data = self._serialize_subscription(subscription, salon_name, owner_email)
        data["available_plans"] = SUBSCRIPTION_PLANS
        data["billing_history"] = list(reversed(billing_history))
        data["is_expired"] = not self.is_subscription_valid(subscription)
        return data

    async def get_subscription_status(self, tenant_id: str) -> dict:
        subscription = await self.get_active_for_tenant(tenant_id)
        if not subscription:
            return {
                "status": "EXPIRED",
                "is_valid": False,
                "days_remaining": 0,
                "show_reminder_banner": False,
                "reminder_message": None,
            }
        days_remaining = self._compute_days_remaining(subscription.end_date)
        is_valid = self.is_subscription_valid(subscription)
        show_banner = is_valid and 0 < days_remaining <= 7
        reminder_message = None
        if show_banner:
            day_word = "day" if days_remaining == 1 else "days"
            reminder_message = f"Your subscription will expire in {days_remaining} {day_word}."
        return {
            "status": subscription.status if is_valid else "EXPIRED",
            "plan_name": subscription.plan_name,
            "plan_label": plan_label(subscription.plan_name),
            "end_date": subscription.end_date.isoformat(),
            "days_remaining": days_remaining if is_valid else 0,
            "is_valid": is_valid,
            "show_reminder_banner": show_banner,
            "reminder_message": reminder_message,
        }

    async def ensure_salon_link_for_legacy_records(self) -> None:
        """Backfill salon_id on subscriptions created before this module."""
        all_subs = await Subscription.find_all().to_list()
        for sub in all_subs:
            if getattr(sub, "salon_id", None) and sub.salon_id != sub.tenant_id:
                sub.plan_name = normalize_plan_name(sub.plan_name)
                continue
            if sub.salon_id and sub.salon_id != "" and sub.total_days:
                sub.plan_name = normalize_plan_name(sub.plan_name)
                continue
            salon = await Salon.find_one(Salon.tenant_id == sub.tenant_id)
            if salon:
                sub.salon_id = str(salon.id)
            else:
                sub.salon_id = sub.tenant_id
            if not sub.total_days:
                sub.total_days = max(
                    (self._date_only(sub.end_date) - self._date_only(sub.start_date)).days,
                    1,
                )
            if not sub.billing_history:
                sub.billing_history = [
                    BillingHistoryEntry(
                        date=sub.start_date,
                        action="CREATED",
                        plan_name=normalize_plan_name(sub.plan_name),
                        amount=sub.amount,
                        notes="Migrated subscription record",
                    )
                ]
            sub.plan_name = normalize_plan_name(sub.plan_name)
            await sub.save()
