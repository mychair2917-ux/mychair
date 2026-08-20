import hashlib
import hmac
import logging
from typing import Any, Dict, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from beanie import PydanticObjectId

from app.api.dependencies.auth import PermissionChecker, get_current_user
from app.auth.rbac_config import ROLE_SUPER_ADMIN, ROLE_SALON_OWNER
from app.core.config import settings
from app.models.user import User
from app.models.salon import Salon
from app.models.salon_whatsapp_account import SalonWhatsAppAccount
from app.models.whatsapp_message import WhatsAppMessageLog
from app.schemas.whatsapp import (
    WhatsAppAccountResponse,
    WhatsAppConfigResponse,
    WhatsAppEmbeddedSignupPayload,
    WhatsAppConnectPayload,
    WhatsAppSettingsUpdatePayload,
    WhatsAppTestMessagePayload,
    WhatsAppMessageLogResponse,
)

from app.services.whatsapp import whatsapp_service
from app.utils.api_response import success_response
from app.utils.timezone import now_utc

logger = logging.getLogger("whatsapp.api")
router = APIRouter()


def _sanitize_account_dict(acc: Optional[SalonWhatsAppAccount], salon_id: str) -> Dict[str, Any]:
    """Formats safe salon WhatsApp account representation for the frontend (NEVER exposes secrets)."""
    default_features = {
        "billing_enabled": True,
        "appointment_confirmations_enabled": True,
        "appointment_reminders_enabled": True,
        "birthday_messages_enabled": True,
        "marketing_enabled": True,
    }
    default_templates = {
        "bill_receipt": "hello_world",
        "appointment_confirmation": "hello_world",
        "appointment_reminder": "hello_world",
        "birthday_wish": "hello_world",
    }

    if not acc:
        return {
            "salon_id": salon_id,
            "connected": False,
            "status": "DISCONNECTED",
            "connection_status": "ACTIVE",
            "waba_id": None,
            "phone_number_id": None,
            "business_phone_number": None,
            "display_name": None,
            "connected_at": None,
            "features": default_features,
            "templates": default_templates,
        }

    return {
        "id": str(acc.id) if getattr(acc, "id", None) else None,
        "salon_id": acc.salon_id or salon_id,
        "connected": acc.status == "CONNECTED",
        "status": acc.status or "DISCONNECTED",
        "connection_status": acc.connection_status or "ACTIVE",
        "waba_id": acc.waba_id,
        "phone_number_id": acc.phone_number_id,
        "business_phone_number": acc.business_phone_number,
        "display_name": acc.display_name,
        "connected_at": acc.connected_at.isoformat() if acc.connected_at else None,
        "disconnected_at": acc.disconnected_at.isoformat() if acc.disconnected_at else None,
        "features": acc.features if acc.features is not None else default_features,
        "templates": acc.templates if acc.templates is not None else default_templates,
    }


def _verify_salon_access(user: User, salon_id: str) -> None:
    """Enforces multi-tenant security rule: user must belong to salon_id unless super admin."""
    if not salon_id or not isinstance(salon_id, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid salon_id parameter.",
        )
    if user.role == ROLE_SUPER_ADMIN:
        return

    user_salon_id = getattr(user, "salon_id", None) or getattr(user, "tenant_id", None)
    if not user_salon_id or user_salon_id != salon_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only access your own salon's WhatsApp configuration.",
        )


@router.get("/config")
async def get_whatsapp_config(
    current_user: User = Depends(get_current_user),
):
    """
    Returns public Meta App ID and Embedded Signup Configuration ID
    required for initializing Meta Facebook JS SDK on the frontend.
    """
    app_id = settings.META_APP_ID or settings.WHATSAPP_PHONE_NUMBER_ID
    config_id = settings.META_EMBEDDED_SIGNUP_CONFIG_ID

    return success_response(
        "WhatsApp configuration retrieved",
        data={
            "app_id": app_id if app_id else None,
            "config_id": config_id if config_id else None,
            "configured": bool(app_id and config_id),
        },
    )


@router.get("/status")
async def get_whatsapp_status(
    salon_id: str = Query(..., description="Salon ID"),
    current_user: User = Depends(get_current_user),
):
    """Returns safe connection status and feature toggles for the salon's WhatsApp integration."""
    _verify_salon_access(current_user, salon_id)

    try:
        account = await whatsapp_service.get_salon_account(salon_id)
        account_found = account is not None
        stored_status = account.status if account else "DISCONNECTED"
        stored_conn_status = account.connection_status if account else "ACTIVE"

        logger.info(
            "WhatsApp status request: salon_id=%s tenant_id=%s role=%s account_found=%s status=%s connection_status=%s",
            salon_id,
            getattr(current_user, "tenant_id", "none"),
            getattr(current_user, "role", "unknown"),
            account_found,
            stored_status,
            stored_conn_status,
        )

        data = _sanitize_account_dict(account, salon_id)
        return success_response("WhatsApp status retrieved successfully", data=data)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Unhandled exception in WhatsApp status check for salon_id=%s tenant_id=%s role=%s exc_class=%s",
            salon_id,
            getattr(current_user, "tenant_id", "none"),
            getattr(current_user, "role", "unknown"),
            exc.__class__.__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve WhatsApp status due to an internal server error.",
        )


@router.post("/embedded-signup/exchange")
async def exchange_embedded_signup(
    payload: WhatsAppEmbeddedSignupPayload,
    current_user: User = Depends(get_current_user),
):
    """
    Onboarding exchange endpoint for Meta Embedded Signup.
    Exchanges Meta authorization code for system access token, queries Meta Graph API,
    validates WABA & phone number, checks for mobile app coexistence, and securely
    stores credentials associated with both tenant_id AND salon_id.
    """
    _verify_salon_access(current_user, payload.salon_id)

    try:
        account = await whatsapp_service.exchange_embedded_signup_code(
            salon_id=payload.salon_id,
            tenant_id=current_user.tenant_id or "default",
            code=payload.code,
            waba_id=payload.waba_id,
            phone_number_id=payload.phone_number_id,
            direct_access_token=payload.access_token,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Error in embedded signup exchange for salon %s: %s", payload.salon_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete Meta Embedded Signup onboarding: {str(exc)}",
        )

    data = _sanitize_account_dict(account, payload.salon_id)
    return success_response("Meta WhatsApp onboarding completed successfully", data=data)



@router.post("/connect")
async def connect_whatsapp(
    payload: WhatsAppConnectPayload,
    current_user: User = Depends(get_current_user),
):
    """
    Connects or updates salon's WhatsApp Business Account credentials
    obtained from Meta Embedded Signup flow.
    """
    _verify_salon_access(current_user, payload.salon_id)

    # Perform connection and securely store token server-side
    account = await whatsapp_service.connect_salon_waba(
        salon_id=payload.salon_id,
        tenant_id=current_user.tenant_id or "default",
        waba_id=payload.waba_id,
        phone_number_id=payload.phone_number_id,
        business_phone_number=payload.business_phone_number,
        display_name=payload.display_name or "Salon WhatsApp",
        access_token=payload.access_token,
        connection_status=payload.connection_status or "ACTIVE",
    )

    data = _sanitize_account_dict(account, payload.salon_id)
    return success_response("WhatsApp connected successfully", data=data)


@router.post("/disconnect")
async def disconnect_whatsapp(
    salon_id: str = Query(..., description="Salon ID"),
    current_user: User = Depends(get_current_user),
):
    """Disconnects salon WhatsApp Business Account."""
    _verify_salon_access(current_user, salon_id)
    account = await whatsapp_service.disconnect_salon_waba(salon_id)
    data = _sanitize_account_dict(account, salon_id)
    return success_response("WhatsApp disconnected successfully", data=data)


@router.patch("/settings")
async def update_whatsapp_settings(
    payload: WhatsAppSettingsUpdatePayload,
    current_user: User = Depends(get_current_user),
):
    """Updates feature toggles and template mappings for a salon's WhatsApp integration."""
    _verify_salon_access(current_user, payload.salon_id)
    account = await whatsapp_service.get_or_create_salon_account(payload.salon_id, current_user.tenant_id)

    if payload.features is not None:
        updated_features = account.features or {}
        updated_features.update(payload.features)
        account.features = updated_features

    if payload.templates is not None:
        updated_templates = account.templates or {}
        updated_templates.update(payload.templates)
        account.templates = updated_templates

    await account.save()
    data = _sanitize_account_dict(account, payload.salon_id)
    return success_response("WhatsApp settings updated successfully", data=data)


@router.post("/test")
async def send_test_whatsapp_message(
    payload: WhatsAppTestMessagePayload,
    current_user: User = Depends(get_current_user),
):
    """Sends a test WhatsApp message using the salon's WABA to verify configuration."""
    _verify_salon_access(current_user, payload.salon_id)

    log = await whatsapp_service.send_test_message(
        salon_id=payload.salon_id,
        test_phone=payload.recipient_phone,
    )

    return success_response(
        "Test message dispatch completed",
        data={
            "id": str(log.id),
            "status": log.status,
            "delivery_status": log.delivery_status,
            "phone_number": log.phone_number,
            "wamid": log.wamid,
            "error_message": log.error_message,
        },
    )


@router.get("/messages")
async def list_whatsapp_messages(
    salon_id: str = Query(..., description="Salon ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    message_type: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    """Retrieves paginated audit log of WhatsApp messages for the salon."""
    _verify_salon_access(current_user, salon_id)

    query: Dict[str, Any] = {"salon_id": salon_id, "is_deleted": False}
    if status_filter:
        query["status"] = status_filter.upper()
    if message_type:
        query["message_type"] = message_type.upper()

    total = await WhatsAppMessageLog.find(query).count()
    skip = (page - 1) * limit
    logs = await WhatsAppMessageLog.find(query).sort("-created_at").skip(skip).limit(limit).to_list()

    items = [
        {
            "id": str(l.id),
            "salon_id": l.salon_id,
            "customer_id": l.customer_id,
            "phone_number": l.phone_number,
            "message_type": l.message_type,
            "status": l.status,
            "delivery_status": l.delivery_status,
            "template_name": l.template_name,
            "wamid": l.wamid,
            "reference_type": l.reference_type,
            "reference_id": l.reference_id,
            "error_message": l.error_message,
            "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            "delivered_at": l.delivered_at.isoformat() if l.delivered_at else None,
            "read_at": l.read_at.isoformat() if l.read_at else None,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]

    pages = max(1, (total + limit - 1) // limit) if total > 0 else 1
    return success_response(
        "WhatsApp message logs retrieved successfully",
        data={"items": items, "total": total, "page": page, "limit": limit, "pages": pages},
    )


@router.get("/admin/salons")
async def get_admin_salons_whatsapp(
    current_user: User = Depends(PermissionChecker("whatsapp.admin")),
):
    """(Super Admin only) Overview of WhatsApp connection status across all salons."""
    salons = await Salon.find({"is_deleted": False}).to_list()
    accounts = await SalonWhatsAppAccount.find({"is_deleted": False}).to_list()

    account_map = {acc.salon_id: acc for acc in accounts}

    items = []
    for s in salons:
        s_id = str(s.id)
        acc = account_map.get(s_id)

        # Retrieve last message timestamp
        last_log = await WhatsAppMessageLog.find({"salon_id": s_id, "is_deleted": False}).sort("-created_at").first_or_none()

        items.append({
            "salon_id": s_id,
            "salon_name": s.name,
            "status": acc.status if acc else "DISCONNECTED",
            "connection_status": acc.connection_status if acc else "ACTIVE",
            "phone_number": acc.business_phone_number if acc else s.phone,
            "display_name": acc.display_name if acc else None,
            "last_message_at": last_log.created_at.isoformat() if last_log and last_log.created_at else None,
            "connected_at": acc.connected_at.isoformat() if acc and acc.connected_at else None,
        })

    return success_response("Admin WhatsApp salon overview retrieved", data=items)


# Public Meta Webhook Endpoints
@router.get("/webhook")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
):
    """Meta webhook verification handshake endpoint."""
    expected_token = settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN or "mychair_whatsapp_verify"
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        return int(hub_challenge or 0)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook verification failed")


@router.post("/webhook")
async def receive_whatsapp_webhook(request: Request):
    """Receive message status callbacks (sent, delivered, read, failed) & incoming messages."""
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if settings.WHATSAPP_APP_SECRET and not _verify_signature(body, signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook signature")

    payload: Dict[str, Any] = await request.json()
    updated = await whatsapp_service.process_webhook_payload(payload)
    logger.info("WhatsApp webhook processed successfully, updated_count=%s", updated)
    return {"success": True, "updated": updated}


def _verify_signature(body: bytes, signature: str) -> bool:
    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
