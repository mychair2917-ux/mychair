import hashlib
import hmac
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.config import settings
from app.services.whatsapp import WhatsAppService

logger = logging.getLogger("whatsapp.webhook")
router = APIRouter()
whatsapp_service = WhatsAppService()


@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
):
    """Meta webhook verification handshake."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        return int(hub_challenge or 0)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook verification failed")


@router.post("/whatsapp")
async def receive_whatsapp_webhook(request: Request):
    """Receive message status callbacks (sent, delivered, read, failed)."""
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if settings.WHATSAPP_APP_SECRET and not _verify_signature(body, signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook signature")

    payload: Dict[str, Any] = await request.json()
    updated = await whatsapp_service.process_status_webhook(payload)
    logger.info("WhatsApp webhook processed, updated_logs=%s", updated)
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
