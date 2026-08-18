from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

class WhatsAppProvider(ABC):
    """
    Abstract WhatsApp Provider Interface.
    Decouples business logic from specific WhatsApp API providers (e.g. Meta Cloud API directly).
    """

    @abstractmethod
    async def send_template_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[list] = None,
    ) -> Dict[str, Any]:
        """Send a WhatsApp template message."""
        pass

    @abstractmethod
    async def send_text_message(
        self,
        phone_number_id: str,
        access_token: str,
        to_phone: str,
        message_body: str,
    ) -> Dict[str, Any]:
        """Send a free-form WhatsApp text message (within 24h customer window)."""
        pass

    @abstractmethod
    def parse_webhook_payload(self, payload: Dict[str, Any]) -> list:
        """Parse incoming webhook event payload into standard status/message items."""
        pass

    @abstractmethod
    def format_human_error(self, status_code: int, response_body: Dict[str, Any]) -> str:
        """Translate provider raw API error responses into clean human-readable text."""
        pass
