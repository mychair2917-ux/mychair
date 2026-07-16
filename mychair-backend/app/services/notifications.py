import logging
import re
from datetime import datetime
from math import ceil
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
from beanie import PydanticObjectId

from app.auth.rbac_config import (
    ROLE_EMPLOYEE,
    ROLE_SALON_ADMIN,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    ROLE_SUPER_ADMIN,
    normalize_role,
)
from app.core import tenant_context
from app.core.config import settings
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.audit import AuditLog
from app.models.customer import Customer
from app.models.notification import Notification
from app.models.notification_communication import (
    BusinessAlert,
    CommunicationCampaign,
    CommunicationLog,
    CommunicationRecipient,
    NotificationPreference,
    NotificationTemplate,
    SubscriptionNotification,
    default_preference_channels,
)
from app.models.user import User
from app.schemas.notifications import NotificationOut
from app.services.email_service import _parse_resend_error, _resolve_recipient
from app.services.websocket import manager
from app.utils.timezone import now_utc

logger = logging.getLogger("notifications")

STAFF_ROLES = {ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER, ROLE_EMPLOYEE}
MANAGE_ROLES = {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN}
CAMPAIGN_ROLES = {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER}
LOG_ROLES = CAMPAIGN_ROLES


def _normalize_phone(phone: Optional[str]) -> str:
    digits = re.sub(r"\D+", "", phone or "")
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def _pages(total: int, limit: int) -> int:
    return max(1, ceil(total / limit)) if total else 1


def _user_display_name(user: User) -> str:
    return " ".join(part for part in [user.first_name, user.last_name] if part).strip() or user.email


class NotificationService:
    async def list_notifications(
        self,
        current_user: User,
        *,
        page: int,
        limit: int,
        notification_type: Optional[str],
        category: Optional[str],
        unread_only: bool,
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        salon_id: Optional[str],
    ) -> Dict[str, Any]:
        query = await self._notification_scope_query(current_user, salon_id)
        if notification_type:
            query["notification_type"] = notification_type.upper()
        if category:
            query["category"] = category.upper()
        if unread_only:
            query["is_read"] = False
        if date_from or date_to:
            created_range: Dict[str, datetime] = {}
            if date_from:
                created_range["$gte"] = date_from
            if date_to:
                created_range["$lte"] = date_to
            query["created_at"] = created_range

        total = await Notification.find(query).count()
        unread_query = dict(query)
        unread_query.pop("notification_type", None)
        unread_query.pop("category", None)
        unread_query.pop("created_at", None)
        unread_query["is_read"] = False
        unread_count = await Notification.find(unread_query).count()
        items = (
            await Notification.find(query)
            .sort("-created_at")
            .skip((page - 1) * limit)
            .limit(limit)
            .to_list()
        )
        return {
            "items": [self._notification_out(item).model_dump(mode="json") for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": _pages(total, limit),
            "unread_count": unread_count,
        }

    async def unread_count(self, current_user: User, salon_id: Optional[str]) -> int:
        query = await self._notification_scope_query(current_user, salon_id)
        query["is_read"] = False
        return await Notification.find(query).count()

    async def mark_read(self, current_user: User, notification_id: str) -> NotificationOut:
        notification = await self._get_scoped_notification(current_user, notification_id)
        notification.is_read = True
        notification.read_at = now_utc()
        await notification.save()
        await self._broadcast_badge(current_user, notification.salon_id)
        return self._notification_out(notification)

    async def mark_all_read(self, current_user: User, salon_id: Optional[str]) -> int:
        query = await self._notification_scope_query(current_user, salon_id)
        query["is_read"] = False
        items = await Notification.find(query).to_list()
        now = now_utc()
        for item in items:
            item.is_read = True
            item.read_at = now
            await item.save()
        await self._broadcast_badge(current_user, salon_id)
        return len(items)

    async def get_or_create_preferences(self, current_user: User) -> NotificationPreference:
        pref = await NotificationPreference.find_one(
            {
                "user_id": str(current_user.id),
                "tenant_id": current_user.tenant_id,
                "is_deleted": False,
            }
        )
        if pref:
            merged_categories = self._merge_preference_categories(pref.categories)
            if merged_categories != pref.categories:
                pref.categories = merged_categories
                await pref.save()
            return pref
        pref = NotificationPreference(
            tenant_id=current_user.tenant_id,
            user_id=str(current_user.id),
            categories=default_preference_channels(),
        )
        await pref.insert()
        return pref

    async def update_preferences(
        self,
        current_user: User,
        updates: Dict[str, Any],
    ) -> NotificationPreference:
        pref = await self.get_or_create_preferences(current_user)
        before = pref.model_dump(mode="json")
        for key in (
            "email_enabled",
            "whatsapp_enabled",
            "sound_enabled",
            "browser_notification_enabled",
            "popup_toast_enabled",
        ):
            if updates.get(key) is not None:
                setattr(pref, key, updates[key])
        if updates.get("categories") is not None:
            pref.categories = self._merge_preference_categories(updates["categories"])
        await pref.save()
        await self._audit(
            current_user,
            "UPDATE",
            "NotificationPreference",
            str(pref.id),
            before,
            pref.model_dump(mode="json"),
        )
        return pref

    async def create_notification(
        self,
        current_user: User,
        payload: Dict[str, Any],
    ) -> List[NotificationOut]:
        normalized = normalize_role(current_user.role)
        if normalized not in CAMPAIGN_ROLES:
            raise PermissionDeniedException("You cannot send notifications")
        recipients = await self._resolve_user_recipients(
            current_user,
            payload.get("recipient_ids") or [],
            payload.get("role_targets") or [],
            payload.get("salon_id"),
        )
        created = await self.create_event_notifications(
            tenant_id=self._effective_tenant_id(current_user, payload.get("salon_id")),
            salon_id=payload.get("salon_id"),
            recipients=recipients,
            title=payload["title"],
            body=payload["body"],
            category=payload.get("category", "GENERAL"),
            notification_type=payload.get("notification_type", "GENERAL"),
            priority=payload.get("priority", "NORMAL"),
            source_event="MANUAL",
            metadata={"created_by": str(current_user.id)},
        )
        await self._audit(current_user, "CREATE", "Notification", None, None, payload)
        return [self._notification_out(item) for item in created]

    async def create_event_notifications(
        self,
        *,
        tenant_id: Optional[str],
        salon_id: Optional[str],
        recipients: Iterable[User],
        title: str,
        body: str,
        category: str,
        notification_type: str,
        priority: str = "NORMAL",
        source_event: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Notification]:
        created: List[Notification] = []
        for user in recipients:
            preference = await self.get_or_create_preferences(user)
            cat_pref = preference.categories.get(category.upper(), {})
            if cat_pref and not cat_pref.get("in_app", True):
                continue
            item = Notification(
                tenant_id=tenant_id or user.tenant_id,
                salon_id=salon_id or user.tenant_id,
                recipient_type="USER",
                recipient_id=str(user.id),
                recipient_address=user.email,
                channel="IN_APP",
                title=title,
                subject=title,
                body=body,
                category=category.upper(),
                notification_type=notification_type.upper(),
                priority=priority.upper(),
                source_event=source_event,
                status="SENT",
                sent_at=now_utc(),
                metadata=metadata or {},
            )
            await item.insert()
            created.append(item)
            await self._broadcast_notification(item, preference)
        return created

    async def list_templates(
        self,
        current_user: User,
        page: int,
        limit: int,
        template_type: Optional[str],
        salon_id: Optional[str],
    ) -> Dict[str, Any]:
        query = await self._template_scope_query(current_user, salon_id)
        if template_type:
            query["template_type"] = template_type.upper()
        return await self._paginate(NotificationTemplate, query, page, limit)

    async def create_template(self, current_user: User, payload: Dict[str, Any]) -> NotificationTemplate:
        self._assert_can_manage_templates(current_user)
        template = NotificationTemplate(
            tenant_id=self._effective_tenant_id(current_user, payload.get("salon_id")),
            salon_id=payload.get("salon_id") or self._tenant_salon_id(current_user),
            name=payload["name"],
            template_type=payload["template_type"].upper(),
            channel=payload.get("channel", "EMAIL").upper(),
            subject=payload.get("subject"),
            body=payload["body"],
            variables=payload.get("variables") or [],
            is_system=normalize_role(current_user.role) == ROLE_SUPER_ADMIN and not payload.get("salon_id"),
        )
        await template.insert()
        await self._audit(current_user, "CREATE", "NotificationTemplate", str(template.id), None, template.model_dump(mode="json"))
        return template

    async def update_template(
        self,
        current_user: User,
        template_id: str,
        payload: Dict[str, Any],
    ) -> NotificationTemplate:
        self._assert_can_manage_templates(current_user)
        template = await self._get_scoped_template(current_user, template_id)
        before = template.model_dump(mode="json")
        for key in ("name", "subject", "body", "status"):
            if payload.get(key) is not None:
                setattr(template, key, payload[key])
        if payload.get("template_type") is not None:
            template.template_type = payload["template_type"].upper()
        if payload.get("channel") is not None:
            template.channel = payload["channel"].upper()
        if payload.get("variables") is not None:
            template.variables = payload["variables"]
        await template.save()
        await self._audit(current_user, "UPDATE", "NotificationTemplate", str(template.id), before, template.model_dump(mode="json"))
        return template

    async def delete_template(self, current_user: User, template_id: str) -> None:
        self._assert_can_manage_templates(current_user)
        template = await self._get_scoped_template(current_user, template_id)
        before = template.model_dump(mode="json")
        template.is_deleted = True
        template.deleted_at = now_utc()
        await template.save()
        await self._audit(current_user, "DELETE", "NotificationTemplate", str(template.id), before, None)

    async def clone_template(self, current_user: User, template_id: str) -> NotificationTemplate:
        source = await self._get_scoped_template(current_user, template_id)
        clone = NotificationTemplate(
            tenant_id=source.tenant_id,
            salon_id=source.salon_id,
            name=f"{source.name} Copy",
            template_type=source.template_type,
            channel=source.channel,
            subject=source.subject,
            body=source.body,
            variables=source.variables,
            status="DRAFT",
            cloned_from_template_id=str(source.id),
        )
        await clone.insert()
        await self._audit(current_user, "CLONE", "NotificationTemplate", str(clone.id), None, clone.model_dump(mode="json"))
        return clone

    async def preview_template(self, current_user: User, template_id: str) -> Dict[str, Any]:
        template = await self._get_scoped_template(current_user, template_id)
        variables = {
            "customer_name": "Aisha Mehta",
            "staff_name": "Riya Sharma",
            "salon_name": current_user.salon_name or "MyChair Salon",
            "appointment_date": "15/06/2026",
            "membership_name": "Gold Membership",
            "amount": "1500",
        }
        subject = self._render_template(template.subject or "", variables)
        body = self._render_template(template.body, variables)
        return {"subject": subject, "body": body, "variables": variables}

    async def create_campaign(self, current_user: User, payload: Dict[str, Any]) -> CommunicationCampaign:
        if normalize_role(current_user.role) not in CAMPAIGN_ROLES:
            raise PermissionDeniedException("You cannot create communication campaigns")
        salon_id = payload.get("salon_id") or self._tenant_salon_id(current_user)
        campaign = CommunicationCampaign(
            tenant_id=self._effective_tenant_id(current_user, salon_id),
            salon_id=salon_id,
            name=payload["name"],
            communication_type=payload["communication_type"].upper(),
            audience=payload["audience"].upper(),
            selected_customer_ids=payload.get("selected_customer_ids") or [],
            subject=payload.get("subject"),
            body=payload["body"],
            scheduled_for=payload.get("scheduled_for"),
            status=(
                "SENDING"
                if payload.get("send_now", True)
                else "SCHEDULED"
                if payload.get("scheduled_for")
                else "DRAFT"
            ),
        )
        await campaign.insert()
        await self._audit(current_user, "CREATE", "CommunicationCampaign", str(campaign.id), None, campaign.model_dump(mode="json"))
        return campaign

    async def send_campaign(self, current_user: User, campaign_id: str) -> CommunicationCampaign:
        campaign = await self._get_scoped_campaign(current_user, campaign_id)
        campaign.status = "SENDING"
        await campaign.save()
        await self._ensure_campaign_jobs(current_user, campaign)
        await self._refresh_campaign_totals(campaign)

        pending_logs = await CommunicationLog.find(
            {
                "campaign_id": str(campaign.id),
                "status": "PENDING",
                "is_deleted": False,
            }
        ).to_list()
        for log in pending_logs:
            await self._dispatch_campaign_log(campaign, log)
            if log.recipient_id:
                await self._refresh_recipient_status(log.recipient_id)
            await self._refresh_campaign_totals(campaign)

        await self._refresh_campaign_totals(campaign, completed=True)
        await self._audit(current_user, "SEND", "CommunicationCampaign", str(campaign.id), None, campaign.model_dump(mode="json"))
        return campaign

    async def mark_campaign_sending(self, current_user: User, campaign_id: str) -> CommunicationCampaign:
        campaign = await self._get_scoped_campaign(current_user, campaign_id)
        campaign.status = "SENDING"
        await campaign.save()
        return campaign

    async def list_campaigns(self, current_user: User, page: int, limit: int, salon_id: Optional[str]) -> Dict[str, Any]:
        query = await self._tenant_scope_query(current_user, salon_id)
        return await self._paginate(CommunicationCampaign, query, page, limit)

    async def send_due_scheduled_campaigns(self) -> int:
        due_campaigns = await CommunicationCampaign.find(
            {
                "status": "SCHEDULED",
                "scheduled_for": {"$lte": now_utc()},
                "is_deleted": False,
            }
        ).to_list()
        sent_count = 0
        for campaign in due_campaigns:
            sender = await self._campaign_sender(campaign)
            if not sender:
                campaign.status = "FAILED"
                campaign.totals = {
                    **campaign.totals,
                    "failed": campaign.totals.get("total_jobs", 0),
                }
                await campaign.save()
                logger.error("Scheduled campaign %s has no valid sender user", str(campaign.id))
                continue
            await self.send_campaign(sender, str(campaign.id))
            sent_count += 1
        return sent_count

    async def list_logs(self, current_user: User, page: int, limit: int, campaign_id: Optional[str]) -> Dict[str, Any]:
        if normalize_role(current_user.role) not in LOG_ROLES:
            raise PermissionDeniedException("You cannot view delivery logs")
        query = await self._tenant_scope_query(current_user, None)
        if campaign_id:
            query["campaign_id"] = campaign_id
        return await self._paginate(CommunicationLog, query, page, limit)

    async def list_business_alerts(self, current_user: User, page: int, limit: int, salon_id: Optional[str]) -> Dict[str, Any]:
        query = await self._tenant_scope_query(current_user, salon_id)
        return await self._paginate(BusinessAlert, query, page, limit)

    async def list_subscription_notifications(self, current_user: User, page: int, limit: int, salon_id: Optional[str]) -> Dict[str, Any]:
        if normalize_role(current_user.role) not in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN}:
            raise PermissionDeniedException("You cannot view subscription notifications")
        query = await self._tenant_scope_query(current_user, salon_id)
        return await self._paginate(SubscriptionNotification, query, page, limit)

    async def create_business_alert(
        self,
        *,
        tenant_id: Optional[str],
        salon_id: Optional[str],
        alert_type: str,
        category: str,
        title: str,
        message: str,
        priority: str = "NORMAL",
        source_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> BusinessAlert:
        if source_id:
            existing = await BusinessAlert.find_one(
                {
                    "tenant_id": tenant_id,
                    "salon_id": salon_id,
                    "alert_type": alert_type.upper(),
                    "source_id": source_id,
                    "status": "OPEN",
                    "is_deleted": False,
                }
            )
            if existing:
                return existing
        alert = BusinessAlert(
            tenant_id=tenant_id,
            salon_id=salon_id,
            alert_type=alert_type.upper(),
            category=category.upper(),
            priority=priority.upper(),
            title=title,
            message=message,
            source_id=source_id,
            metadata=metadata or {},
        )
        await alert.insert()
        recipients = await self._tenant_users_for_roles(tenant_id, salon_id, [ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER])
        await self.create_event_notifications(
            tenant_id=tenant_id,
            salon_id=salon_id,
            recipients=recipients,
            title=title,
            body=message,
            category=category,
            notification_type="BUSINESS_ALERT",
            priority=priority,
            source_event=alert_type,
            metadata={"business_alert_id": str(alert.id), **(metadata or {})},
        )
        return alert

    async def create_subscription_notification(
        self,
        *,
        tenant_id: Optional[str],
        salon_id: Optional[str],
        event_type: str,
        title: str,
        message: str,
        subscription_id: Optional[str] = None,
    ) -> SubscriptionNotification:
        item = SubscriptionNotification(
            tenant_id=tenant_id,
            salon_id=salon_id,
            subscription_id=subscription_id,
            event_type=event_type.upper(),
            title=title,
            message=message,
            priority="HIGH",
        )
        await item.insert()
        recipients = await self._tenant_users_for_roles(tenant_id, salon_id, [ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN])
        await self.create_event_notifications(
            tenant_id=tenant_id,
            salon_id=salon_id,
            recipients=recipients,
            title=title,
            body=message,
            category="SUBSCRIPTION",
            notification_type="SUBSCRIPTION",
            priority="HIGH",
            source_event=event_type,
            metadata={"subscription_notification_id": str(item.id)},
        )
        return item

    async def _ensure_campaign_jobs(self, current_user: User, campaign: CommunicationCampaign) -> None:
        customers = await self._campaign_customers(campaign)
        channels = self._campaign_channels(campaign)
        preference = await self.get_or_create_preferences(current_user)
        for customer in customers:
            recipient = await CommunicationRecipient.find_one(
                {
                    "campaign_id": str(campaign.id),
                    "customer_id": str(customer.id),
                    "is_deleted": False,
                }
            )
            if not recipient:
                recipient = CommunicationRecipient(
                    tenant_id=campaign.tenant_id,
                    campaign_id=str(campaign.id),
                    customer_id=str(customer.id),
                    customer_name=customer.full_name,
                    email=customer.email,
                    phone=customer.phone,
                )
                await recipient.insert()

            for channel in channels:
                existing_log = await CommunicationLog.find_one(
                    {
                        "campaign_id": str(campaign.id),
                        "recipient_id": str(recipient.id),
                        "channel": channel,
                        "is_deleted": False,
                    }
                )
                if existing_log:
                    continue
                address = (recipient.email or "") if channel == "EMAIL" else _normalize_phone(recipient.phone)
                failure_reason = self._campaign_channel_blocker(preference, channel) or self._validate_campaign_address(channel, address)
                log = CommunicationLog(
                    tenant_id=campaign.tenant_id,
                    campaign_id=str(campaign.id),
                    recipient_id=str(recipient.id),
                    customer_id=recipient.customer_id,
                    channel=channel,
                    recipient_address=address,
                    status="FAILED" if failure_reason else "PENDING",
                    provider="resend" if channel == "EMAIL" else "whatsapp",
                    error_message=failure_reason,
                    failed_at=now_utc() if failure_reason else None,
                    payload={"subject": campaign.subject, "body": campaign.body},
                )
                await log.insert()

            await self._refresh_recipient_status(str(recipient.id))

    async def _dispatch_campaign_log(self, campaign: CommunicationCampaign, log: CommunicationLog) -> None:
        address = log.recipient_address
        logger.info(
            "Sending campaign %s via %s to %s",
            str(campaign.id),
            log.channel,
            address or "<missing-address>",
        )
        if log.channel == "EMAIL":
            success, error, provider_message_id = await self._send_email(address, campaign.subject or campaign.name, campaign.body)
        elif log.channel == "WHATSAPP":
            success, error, provider_message_id = await self._send_whatsapp(address, campaign.body)
        else:
            success, error, provider_message_id = False, f"Unsupported channel {log.channel}", None
        if success:
            log.status = "SENT"
            log.provider_message_id = provider_message_id
            log.error_message = None
            log.sent_at = now_utc()
            await log.save()
            return
        log.status = "FAILED"
        log.error_message = error
        log.failed_at = now_utc()
        await log.save()
        logger.error(
            "Campaign %s %s delivery failed for %s: %s",
            str(campaign.id),
            log.channel,
            address or "<missing-address>",
            error,
        )

    async def _refresh_recipient_status(self, recipient_id: str) -> None:
        recipient = await CommunicationRecipient.get(PydanticObjectId(recipient_id))
        if not recipient:
            return
        logs = await CommunicationLog.find(
            {"recipient_id": recipient_id, "is_deleted": False}
        ).to_list()
        if not logs:
            recipient.status = "PENDING"
        elif any(log.status == "PENDING" for log in logs):
            recipient.status = "PENDING"
        elif any(log.status in {"SENT", "DELIVERED"} for log in logs) and any(log.status == "FAILED" for log in logs):
            recipient.status = "PARTIALLY_SENT"
        elif all(log.status == "FAILED" for log in logs):
            recipient.status = "FAILED"
        else:
            recipient.status = "SENT"
        await recipient.save()

    async def _refresh_campaign_totals(self, campaign: CommunicationCampaign, completed: bool = False) -> None:
        logs = await CommunicationLog.find(
            {"campaign_id": str(campaign.id), "is_deleted": False}
        ).to_list()
        total_recipients = await CommunicationRecipient.find(
            {"campaign_id": str(campaign.id), "is_deleted": False}
        ).count()
        sent_or_delivered = sum(1 for log in logs if log.status in {"SENT", "DELIVERED"})
        failed = sum(1 for log in logs if log.status == "FAILED")
        pending = sum(1 for log in logs if log.status == "PENDING")
        delivered = sum(1 for log in logs if log.status == "DELIVERED") or sent_or_delivered
        campaign.totals = {
            "total_recipients": total_recipients,
            "total_jobs": len(logs),
            "pending": pending,
            "sent": sent_or_delivered,
            "delivered": delivered,
            "failed": failed,
        }
        if not logs:
            campaign.status = "FAILED" if completed else "SENDING"
        elif pending:
            campaign.status = "SENDING"
        elif failed == len(logs):
            campaign.status = "FAILED"
        elif failed:
            campaign.status = "PARTIALLY_SENT"
        else:
            campaign.status = "SENT"
        if completed and not pending:
            campaign.sent_at = now_utc()
        await campaign.save()

    def _campaign_channels(self, campaign: CommunicationCampaign) -> List[str]:
        return ["EMAIL", "WHATSAPP"] if campaign.communication_type == "BOTH" else [campaign.communication_type]

    def _campaign_channel_blocker(self, preference: NotificationPreference, channel: str) -> Optional[str]:
        if channel == "EMAIL" and not preference.email_enabled:
            return "Email notifications are disabled in notification settings."
        if channel == "WHATSAPP" and not preference.whatsapp_enabled:
            return "WhatsApp notifications are disabled in notification settings."
        return None

    def _validate_campaign_address(self, channel: str, address: str) -> Optional[str]:
        if not address:
            return f"{channel} recipient address is missing"
        if channel == "EMAIL" and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", address):
            return f"Invalid email address: {address}"
        if channel == "WHATSAPP" and not re.match(r"^\d{10,15}$", address):
            return f"Invalid WhatsApp phone number: {address}"
        return None

    def _merge_preference_categories(self, categories: Optional[Dict[str, Dict[str, bool]]]) -> Dict[str, Dict[str, bool]]:
        merged = default_preference_channels()
        for category, channels in (categories or {}).items():
            normalized_category = category.upper()
            existing = merged.get(normalized_category, {"in_app": True, "sound": True, "email": True, "whatsapp": True})
            merged[normalized_category] = {
                **existing,
                **{key: bool(value) for key, value in channels.items()},
            }
        return merged

    async def _send_channel(self, campaign: CommunicationCampaign, recipient: CommunicationRecipient, channel: str) -> str:
        address = (recipient.email or "") if channel == "EMAIL" else _normalize_phone(recipient.phone)
        log = CommunicationLog(
            tenant_id=campaign.tenant_id,
            campaign_id=str(campaign.id),
            recipient_id=str(recipient.id),
            customer_id=recipient.customer_id,
            channel=channel,
            recipient_address=address,
            status="PENDING",
            provider="resend" if channel == "EMAIL" else "whatsapp",
            payload={"subject": campaign.subject, "body": campaign.body},
        )
        await log.insert()
        if not address:
            log.status = "FAILED"
            log.error_message = f"{channel} recipient address is missing"
            log.failed_at = now_utc()
            await log.save()
            return "failed"
        if channel == "EMAIL":
            success, error, provider_message_id = await self._send_email(address, campaign.subject or campaign.name, campaign.body)
        elif channel == "WHATSAPP":
            success, error, provider_message_id = await self._send_whatsapp(address, campaign.body)
        else:
            success, error, provider_message_id = False, f"Unsupported channel {channel}", None
        if success:
            log.status = "SENT"
            log.provider_message_id = provider_message_id
            log.sent_at = now_utc()
            await log.save()
            return "sent"
        log.status = "FAILED"
        log.error_message = error
        log.failed_at = now_utc()
        await log.save()
        return "failed"

    async def _send_email(self, to_email: str, subject: str, body: str) -> Tuple[bool, Optional[str], Optional[str]]:
        if not settings.RESEND_API_KEY:
            return False, "RESEND_API_KEY is not configured on the server.", None
        actual_to, _ = _resolve_recipient(to_email)
        payload = {
            "from": settings.EMAIL_FROM,
            "to": [actual_to],
            "subject": subject,
            "html": body.replace("\n", "<br />"),
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if response.status_code in (200, 201):
                    response_data = response.json()
                    return True, None, response_data.get("id")
                return False, _parse_resend_error(response), None
        except Exception as exc:
            return False, f"Email service unavailable: {exc}", None

    async def _send_whatsapp(self, phone: str, body: str) -> Tuple[bool, Optional[str], Optional[str]]:
        # Provider layer is intentionally isolated here. Free-form outbound text may require an active
        # WhatsApp customer service window, so unconfigured environments produce auditable failures.
        if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.whatsapp_bearer_token:
            return False, "WhatsApp Cloud API is not configured.", None
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": body},
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"https://graph.facebook.com/v20.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
                    headers={
                        "Authorization": f"Bearer {settings.whatsapp_bearer_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if 200 <= response.status_code < 300:
                    response_data = response.json()
                    messages = response_data.get("messages") or []
                    provider_message_id = messages[0].get("id") if messages else None
                    return True, None, provider_message_id
                return False, response.text, None
        except Exception as exc:
            return False, f"WhatsApp service unavailable: {exc}", None

    async def _notification_scope_query(self, current_user: User, salon_id: Optional[str]) -> Dict[str, Any]:
        normalized = normalize_role(current_user.role)
        query: Dict[str, Any] = {"is_deleted": False}
        if normalized == ROLE_SUPER_ADMIN:
            selected = salon_id or tenant_context.get_tenant_id()
            if selected and selected != "system":
                query["tenant_id"] = selected
            return query
        query["tenant_id"] = current_user.tenant_id
        if normalized == ROLE_EMPLOYEE:
            query["recipient_id"] = str(current_user.id)
        return query

    async def _tenant_scope_query(self, current_user: User, salon_id: Optional[str]) -> Dict[str, Any]:
        normalized = normalize_role(current_user.role)
        query: Dict[str, Any] = {"is_deleted": False}
        if normalized == ROLE_SUPER_ADMIN:
            selected = salon_id or tenant_context.get_tenant_id()
            if selected and selected != "system":
                query["tenant_id"] = selected
            return query
        query["tenant_id"] = current_user.tenant_id
        return query

    async def _template_scope_query(self, current_user: User, salon_id: Optional[str]) -> Dict[str, Any]:
        query = await self._tenant_scope_query(current_user, salon_id)
        normalized = normalize_role(current_user.role)
        if normalized == ROLE_SALON_MANAGER:
            query["status"] = "APPROVED"
        return query

    async def _get_scoped_notification(self, current_user: User, notification_id: str) -> Notification:
        query = await self._notification_scope_query(current_user, None)
        query["_id"] = PydanticObjectId(notification_id)
        item = await Notification.find_one(query)
        if not item:
            raise ResourceNotFoundException("Notification not found")
        return item

    async def _get_scoped_template(self, current_user: User, template_id: str) -> NotificationTemplate:
        query = await self._template_scope_query(current_user, None)
        query["_id"] = PydanticObjectId(template_id)
        item = await NotificationTemplate.find_one(query)
        if not item:
            raise ResourceNotFoundException("Template not found")
        return item

    async def _get_scoped_campaign(self, current_user: User, campaign_id: str) -> CommunicationCampaign:
        query = await self._tenant_scope_query(current_user, None)
        query["_id"] = PydanticObjectId(campaign_id)
        item = await CommunicationCampaign.find_one(query)
        if not item:
            raise ResourceNotFoundException("Campaign not found")
        return item

    def _assert_can_manage_templates(self, current_user: User) -> None:
        if normalize_role(current_user.role) not in MANAGE_ROLES:
            raise PermissionDeniedException("You cannot manage notification templates")

    async def _resolve_user_recipients(
        self,
        current_user: User,
        recipient_ids: List[str],
        role_targets: List[str],
        salon_id: Optional[str],
    ) -> List[User]:
        query: Dict[str, Any] = {"is_deleted": False, "is_active": True}
        tenant_id = self._effective_tenant_id(current_user, salon_id)
        if tenant_id:
            query["tenant_id"] = tenant_id
        if recipient_ids:
            query["_id"] = {"$in": [PydanticObjectId(item) for item in recipient_ids]}
        elif role_targets:
            query["role"] = {"$in": [normalize_role(role) or role for role in role_targets]}
        else:
            query["role"] = {"$in": list(STAFF_ROLES)}
        return await User.find(query).to_list()

    async def _tenant_users_for_roles(
        self,
        tenant_id: Optional[str],
        salon_id: Optional[str],
        roles: List[str],
    ) -> List[User]:
        query: Dict[str, Any] = {"is_deleted": False, "is_active": True}
        normalized_roles = [normalize_role(role) or role for role in roles]
        if ROLE_SUPER_ADMIN in normalized_roles:
            query["$or"] = [
                {"role": {"$in": [role for role in normalized_roles if role != ROLE_SUPER_ADMIN]}, "tenant_id": tenant_id or salon_id},
                {"role": ROLE_SUPER_ADMIN},
            ]
        else:
            query["role"] = {"$in": normalized_roles}
            if tenant_id or salon_id:
                query["tenant_id"] = tenant_id or salon_id
        return await User.find(query).to_list()

    async def _campaign_customers(self, campaign: CommunicationCampaign) -> List[Customer]:
        query: Dict[str, Any] = {"is_deleted": False, "tenant_id": campaign.tenant_id}
        if campaign.audience == "SELECTED_CUSTOMERS":
            query["_id"] = {"$in": [PydanticObjectId(item) for item in campaign.selected_customer_ids]}
        elif campaign.audience == "ACTIVE_CUSTOMERS":
            query["total_visits"] = {"$gt": 0}
        elif campaign.audience == "VIP_CUSTOMERS":
            query["$or"] = [{"metadata.vip": True}, {"total_spent": {"$gte": 25000}}]
        elif campaign.audience == "MEMBERSHIP_CUSTOMERS":
            query["metadata.membership_name"] = {"$exists": True, "$ne": None}
        return await Customer.find(query).to_list()

    async def _campaign_sender(self, campaign: CommunicationCampaign) -> Optional[User]:
        if campaign.created_by:
            try:
                sender = await User.get(PydanticObjectId(campaign.created_by))
                if sender and not sender.is_deleted:
                    return sender
            except Exception:
                logger.exception("Could not resolve campaign creator %s", campaign.created_by)
        return await User.find_one(
            {
                "tenant_id": campaign.tenant_id,
                "role": {"$in": list(CAMPAIGN_ROLES)},
                "is_active": True,
                "is_deleted": False,
            }
        )

    async def _paginate(self, document_model, query: Dict[str, Any], page: int, limit: int) -> Dict[str, Any]:
        total = await document_model.find(query).count()
        items = (
            await document_model.find(query)
            .sort("-created_at")
            .skip((page - 1) * limit)
            .limit(limit)
            .to_list()
        )
        return {
            "items": [item.model_dump(mode="json") | {"id": str(item.id)} for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": _pages(total, limit),
        }

    async def _broadcast_notification(self, notification: Notification, preference: NotificationPreference) -> None:
        tenant_id = notification.tenant_id or "system"
        salon_id = notification.salon_id or notification.tenant_id or "system"
        await manager.broadcast_to_user(
            tenant_id=tenant_id,
            salon_id=salon_id,
            user_id=notification.recipient_id,
            message={
                "event": "NOTIFICATION_CREATED",
                "notification": self._notification_out(notification).model_dump(mode="json"),
                "preferences": {
                    "sound_enabled": preference.sound_enabled,
                    "browser_notification_enabled": preference.browser_notification_enabled,
                    "popup_toast_enabled": preference.popup_toast_enabled,
                    "category": preference.categories.get(notification.category, {}),
                },
            },
        )

    async def _broadcast_badge(self, current_user: User, salon_id: Optional[str]) -> None:
        tenant_id = self._effective_tenant_id(current_user, salon_id) or "system"
        resolved_salon_id = salon_id or current_user.tenant_id or "system"
        await manager.broadcast_to_user(
            tenant_id=tenant_id,
            salon_id=resolved_salon_id,
            user_id=str(current_user.id),
            message={
                "event": "NOTIFICATION_BADGE_UPDATED",
                "unread_count": await self.unread_count(current_user, salon_id),
            },
        )

    def _notification_out(self, item: Notification) -> NotificationOut:
        return NotificationOut(
            id=str(item.id),
            title=item.title or item.subject or "Notification",
            body=item.body,
            notification_type=item.notification_type,
            category=item.category,
            priority=item.priority,
            source_event=item.source_event,
            salon_id=item.salon_id,
            is_read=item.is_read,
            read_at=item.read_at,
            created_at=item.created_at,
            metadata=item.metadata,
        )

    def _effective_tenant_id(self, current_user: User, salon_id: Optional[str]) -> Optional[str]:
        if normalize_role(current_user.role) == ROLE_SUPER_ADMIN:
            selected = salon_id or tenant_context.get_tenant_id()
            return None if selected == "system" else selected
        return current_user.tenant_id

    def _tenant_salon_id(self, current_user: User) -> Optional[str]:
        return None if normalize_role(current_user.role) == ROLE_SUPER_ADMIN else current_user.tenant_id

    def _render_template(self, template: str, variables: Dict[str, str]) -> str:
        rendered = template
        for key, value in variables.items():
            rendered = rendered.replace("{{" + key + "}}", value)
        return rendered

    async def _audit(
        self,
        current_user: User,
        action: str,
        entity_name: str,
        entity_id: Optional[str],
        before: Optional[Dict[str, Any]],
        after: Optional[Dict[str, Any]],
    ) -> None:
        await AuditLog(
            tenant_id=current_user.tenant_id or "system",
            user_id=str(current_user.id),
            action=action,
            entity_name=entity_name,
            entity_id=entity_id,
            before_state=before,
            after_state=after,
        ).insert()


notification_service = NotificationService()
