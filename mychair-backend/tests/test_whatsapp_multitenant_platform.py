import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.whatsapp import WhatsAppService, whatsapp_service, normalize_phone_number
from app.services.whatsapp.meta_provider import MetaCloudApiProvider


@pytest.mark.asyncio
async def test_normalize_phone_number():
    assert normalize_phone_number("+91 98765 43210") == "919876543210"
    assert normalize_phone_number("09876543210") == "919876543210"
    assert normalize_phone_number("9876543210") == "919876543210"


@pytest.mark.asyncio
async def test_multi_tenant_account_resolution():
    salon_a_id = "salon-a-123"
    salon_b_id = "salon-b-456"

    mock_account_a = MagicMock()
    mock_account_a.status = "CONNECTED"
    mock_account_a.phone_number_id = "phone-id-a-111"
    mock_account_a.authorization_data = {"access_token": "EAA-token-salon-a"}

    mock_account_b = MagicMock()
    mock_account_b.status = "CONNECTED"
    mock_account_b.phone_number_id = "phone-id-b-222"
    mock_account_b.authorization_data = {"access_token": "EAA-token-salon-b"}

    async def mock_get_salon_account(s_id):
        if s_id == salon_a_id:
            return mock_account_a
        if s_id == salon_b_id:
            return mock_account_b
        return None

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(side_effect=mock_get_salon_account)

    phone_id_a, token_a, _ = await service._resolve_credentials(salon_a_id)
    phone_id_b, token_b, _ = await service._resolve_credentials(salon_b_id)

    assert phone_id_a == "phone-id-a-111"
    assert token_a == "EAA-token-salon-a"

    assert phone_id_b == "phone-id-b-222"
    assert token_b == "EAA-token-salon-b"


@pytest.mark.asyncio
async def test_friendly_error_formatting():
    provider = MetaCloudApiProvider()

    # Error code 131026 (Customer unavailable on WhatsApp)
    err1 = provider.format_human_error(400, {"error": {"code": 131026, "message": "Recipient not on WhatsApp"}})
    assert "unavailable on WhatsApp" in err1

    # Error code 131047 (24h customer window expired)
    err2 = provider.format_human_error(400, {"error": {"code": 131047, "message": "Window expired"}})
    assert "template message must be used" in err2

    # Error code 190 (Expired authorization)
    err3 = provider.format_human_error(401, {"error": {"code": 190, "message": "Invalid token"}})
    assert "authorization has expired" in err3


@pytest.mark.asyncio
async def test_webhook_status_parsing():
    provider = MetaCloudApiProvider()

    webhook_payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "statuses": [
                                {
                                    "id": "wamid.test.webhook.789",
                                    "status": "delivered",
                                    "recipient_id": "919876543210",
                                    "timestamp": "1700000000",
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }

    parsed = provider.parse_webhook_payload(webhook_payload)
    assert len(parsed) == 1
    assert parsed[0]["event_type"] == "status"
    assert parsed[0]["wamid"] == "wamid.test.webhook.789"
    assert parsed[0]["status"] == "delivered"
