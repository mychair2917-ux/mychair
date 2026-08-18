import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.whatsapp import WhatsAppService
from app.services.whatsapp.meta_provider import MetaCloudApiProvider


@pytest.mark.asyncio
async def test_send_template_message_sends_hello_world_template():
    service = WhatsAppService()

    # Mock provider response
    api_response = {
        "success": True,
        "status_code": 200,
        "wamid": "wamid.HBgLOTE5Mjg1MjU4MjY5FQIAERgSRDM2QTMwNjc1QjhBOUFBMzM5AA==",
        "error_message": None,
        "response_body": {
            "messaging_product": "whatsapp",
            "contacts": [{"input": "919285258269", "wa_id": "919285258269"}],
            "messages": [{"id": "wamid.HBgLOTE5Mjg1MjU4MjY5FQIAERgSRDM2QTMwNjc1QjhBOUFBMzM5AA=="}],
        },
    }

    with patch.object(MetaCloudApiProvider, "send_template_message", new_callable=AsyncMock) as mock_provider_send:
        mock_provider_send.return_value = api_response

        with patch("app.services.whatsapp.service.WhatsAppMessageLog") as mock_log_class:
            mock_log_instance = MagicMock()
            mock_log_class.return_value = mock_log_instance
            mock_log_instance.insert = AsyncMock()
            mock_log_instance.save = AsyncMock()

            # Mock deduplication find check
            mock_find_query = MagicMock()
            mock_find_query.sort.return_value.first_or_none = AsyncMock(return_value=None)
            mock_log_class.find_one = AsyncMock(return_value=None)

            # Mock customer opt-in check
            with patch.object(service, "check_customer_opt_in", AsyncMock(return_value=True)):
                with patch.object(service, "_resolve_credentials", AsyncMock(return_value=("12345", "token-abc", None))):

                    log = await service.send_template_message(
                        salon_id="salon-456",
                        customer_id="cust-123",
                        recipient_phone="919285258269",
                        message_type="APPOINTMENT_CONFIRMATION",
                        template_name="hello_world",
                        reference_type="APPOINTMENT",
                        reference_id="appt-789",
                    )

                    mock_provider_send.assert_called_once()
                    mock_log_instance.insert.assert_called_once()
                    assert mock_log_instance.status == "SENT"
                    assert mock_log_instance.wamid == "wamid.HBgLOTE5Mjg1MjU4MjY5FQIAERgSRDM2QTMwNjc1QjhBOUFBMzM5AA=="
