import logging
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.services.whatsapp.base_provider import WhatsAppProvider

logger = logging.getLogger("whatsapp.meta")

# Friendly mappings for common Meta Cloud API error codes
META_ERROR_MAP: Dict[int, str] = {
    131026: "WhatsApp message could not be delivered because the customer's number is unavailable on WhatsApp.",
    131047: "Re-engagement message window expired. A Meta-approved template message must be used to contact this customer.",
    131051: "Unsupported message type or format.",
    131052: "Media download failed. Please check asset media attachment.",
    132000: "Template does not exist in the specified language or WABA. Please verify template configuration.",
    132001: "Template parameter mismatch. The variables provided do not match the approved template structure.",
    133010: "Phone number is not registered or eligible for WhatsApp Business API.",
    190: "WhatsApp access authorization has expired. Please reconnect your salon WhatsApp in Settings.",
    100: "Invalid parameter or missing required fields in Meta Graph API payload.",
    2655122: "This WhatsApp number is already connected to another WhatsApp account. Please complete the Meta connection flow to migrate/connect it to MYCHAIR.",
}

def mask_phone_number(phone: Optional[str]) -> str:
    """Masks a phone number for safe logging to prevent PII leaks."""
    if not phone:
        return ""
    p = str(phone).strip()
    if not p:
        return ""
    n = len(p)
    if n <= 6:
        return "*" * n

    prefix_len = 5 if p.startswith("+") else 4
    suffix_len = 2

    if n <= (prefix_len + suffix_len):
        return "*" * n

    masked_len = n - prefix_len - suffix_len
    return f"{p[:prefix_len]}{'*' * masked_len}{p[-suffix_len:]}"


class MetaCloudApiProvider(WhatsAppProvider):
    """
    Direct Meta WhatsApp Cloud API Provider.
    Calls Meta Graph API endpoint directly with salon WABA credentials.
    """

    def __init__(self, api_version: Optional[str] = None):
        self.api_version = api_version or settings.WHATSAPP_API_VERSION or "v20.0"

    def _graph_messages_url(self, phone_number_id: str) -> str:
        return f"https://graph.facebook.com/{self.api_version}/{phone_number_id}/messages"

    def format_human_error(self, status_code: int, response_body: Dict[str, Any]) -> str:
        """Translates Meta Graph API raw errors into clear, human-friendly messages."""
        if not isinstance(response_body, dict):
            return f"Meta WhatsApp service error (HTTP {status_code})."

        error = response_body.get("error") if isinstance(response_body, dict) else None
        if not isinstance(error, dict):
            return f"Meta WhatsApp service error (HTTP {status_code})."

        code = error.get("code")
        error_subcode = error.get("error_subcode")
        
        # Check subcode first, then code
        if error_subcode in META_ERROR_MAP:
            return META_ERROR_MAP[error_subcode]
        if code in META_ERROR_MAP:
            return META_ERROR_MAP[code]

        # Extract message if available
        msg = error.get("message") or error.get("error_user_msg")
        if msg:
            return f"WhatsApp notification failed: {msg}"
            
        return f"WhatsApp service encountered a temporary error. (Error Code: {code or status_code})"

    async def send_template_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        template_name: str,
        language_code: Optional[str] = None,
        components: Optional[List[Dict[str, Any]]] = None,
        document_header: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Sends a Meta-approved template message via WhatsApp Cloud API."""
        url = self._graph_messages_url(phone_number_id)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        # Resolve effective language code without forcing en_US default
        effective_language = (
            language_code
            or getattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", None)
            or "en"
        ).strip()

        # If document_header is provided, ensure a document header component is injected
        final_components = list(components) if components is not None else []
        if document_header:
            doc_comp = {
                "type": "header",
                "parameters": [
                    {
                        "type": "document",
                        "document": document_header,
                    }
                ],
            }
            if not any(c.get("type") == "header" for c in final_components):
                final_components.insert(0, doc_comp)

        template_payload: Dict[str, Any] = {
            "name": template_name,
            "language": {"code": effective_language},
        }
        if final_components and template_name != "hello_world":
            template_payload["components"] = final_components

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "template",
            "template": template_payload,
        }

        masked_to = mask_phone_number(to_phone)
        actual_lang = template_payload["language"]["code"]
        logger.info(
            "[Meta Cloud API] Outbound template send\n"
            "to=%s\n"
            "template=%s\n"
            "language=%s\n"
            "phone_id=%s",
            masked_to,
            template_name,
            actual_lang,
            phone_number_id,
        )
        
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            logger.exception("HTTP network error communicating with Meta Cloud API: %s", exc)
            return {
                "success": False,
                "status_code": 503,
                "wamid": None,
                "error_message": "Network error connecting to Meta WhatsApp Cloud API.",
                "response_body": {"error": str(exc)},
            }

        try:
            import inspect
            body = response.json()
            if inspect.isawaitable(body):
                body = await body
        except (ValueError, TypeError):
            body = {"raw": getattr(response, "text", "")}

        status_code = response.status_code
        wamid = None

        if 200 <= status_code < 300:
            messages = body.get("messages", [])
            if isinstance(messages, list) and len(messages) > 0 and isinstance(messages[0], dict):
                wamid = messages[0].get("id")
            return {
                "success": True,
                "status_code": status_code,
                "wamid": wamid,
                "error_message": None,
                "response_body": body,
            }

        human_error = self.format_human_error(status_code, body)
        logger.error("[Meta Cloud API] Error HTTP %s: %s body=%s", status_code, human_error, body)

        return {
            "success": False,
            "status_code": status_code,
            "wamid": None,
            "error_message": human_error,
            "response_body": body,
        }

    async def send_text_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        message_body: str,
    ) -> Dict[str, Any]:
        """Sends a text message via Meta WhatsApp Cloud API."""
        url = self._graph_messages_url(phone_number_id)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "text",
            "text": {"preview_url": False, "body": message_body},
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            return {
                "success": False,
                "status_code": 503,
                "wamid": None,
                "error_message": "Network error connecting to Meta WhatsApp API.",
                "response_body": {"error": str(exc)},
            }

        try:
            body = response.json()
        except ValueError:
            body = {"raw": response.text}

        status_code = response.status_code
        wamid = None

        if 200 <= status_code < 300:
            messages = body.get("messages", [])
            if isinstance(messages, list) and len(messages) > 0 and isinstance(messages[0], dict):
                wamid = messages[0].get("id")
            return {
                "success": True,
                "status_code": status_code,
                "wamid": wamid,
                "error_message": None,
                "response_body": body,
            }

        human_error = self.format_human_error(status_code, body)
        return {
            "success": False,
            "status_code": status_code,
            "wamid": None,
            "error_message": human_error,
            "response_body": body,
        }

    def parse_webhook_payload(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parses Meta Webhook JSON structure into standard items."""
        parsed_items = []
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                
                # Process status updates (sent, delivered, read, failed)
                for status_item in value.get("statuses", []):
                    parsed_items.append({
                        "event_type": "status",
                        "wamid": status_item.get("id"),
                        "status": status_item.get("status"),
                        "recipient_id": status_item.get("recipient_id"),
                        "timestamp": status_item.get("timestamp"),
                        "errors": status_item.get("errors"),
                        "raw": status_item,
                    })

                # Process incoming messages
                for msg_item in value.get("messages", []):
                    parsed_items.append({
                        "event_type": "incoming_message",
                        "wamid": msg_item.get("id"),
                        "from_phone": msg_item.get("from"),
                        "timestamp": msg_item.get("timestamp"),
                        "type": msg_item.get("type"),
                        "text": msg_item.get("text", {}).get("body") if msg_item.get("type") == "text" else None,
                        "raw": msg_item,
                    })

        return parsed_items
