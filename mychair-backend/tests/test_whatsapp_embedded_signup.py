import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.whatsapp import WhatsAppEmbeddedSignupPayload, WhatsAppConfigResponse
from app.services.whatsapp import WhatsAppService, whatsapp_service
from app.models.salon_whatsapp_account import SalonWhatsAppAccount


@pytest.mark.asyncio
async def test_embedded_signup_exchange_success():
    salon_id = "salon-test-123"
    tenant_id = "tenant-test-999"
    code = "mock-meta-auth-code-777"
    waba_id = "109823471092837"
    phone_number_id = "102938475610293"

    mock_account = MagicMock(spec=SalonWhatsAppAccount)
    mock_account.salon_id = salon_id
    mock_account.tenant_id = tenant_id
    mock_account.waba_id = waba_id
    mock_account.phone_number_id = phone_number_id
    mock_account.business_phone_number = "+919876543210"
    mock_account.display_name = "Style Lounge"
    mock_account.status = "CONNECTED"
    mock_account.connection_status = "ACTIVE"
    mock_account.authorization_data = {"access_token": "EAA-test-long-lived-token"}

    service = WhatsAppService()
    service.connect_salon_waba = AsyncMock(return_value=mock_account)

    result = await service.exchange_embedded_signup_code(
        salon_id=salon_id,
        tenant_id=tenant_id,
        code=code,
        waba_id=waba_id,
        phone_number_id=phone_number_id,
        direct_access_token="EAA-test-long-lived-token",
    )

    assert result.salon_id == salon_id
    assert result.waba_id == waba_id
    assert result.phone_number_id == phone_number_id
    assert result.status == "CONNECTED"
    assert result.authorization_data.get("access_token") == "EAA-test-long-lived-token"
    service.connect_salon_waba.assert_called_once()


@pytest.mark.asyncio
async def test_multi_salon_isolation_verification():
    """Ensure Salon A and Salon B credentials are completely isolated."""
    salon_a = "salon-a"
    salon_b = "salon-b"

    account_a = MagicMock()
    account_a.phone_number_id = "phone-id-a"
    account_a.authorization_data = {"access_token": "token-a"}
    account_a.status = "CONNECTED"

    account_b = MagicMock()
    account_b.phone_number_id = "phone-id-b"
    account_b.authorization_data = {"access_token": "token-b"}
    account_b.status = "CONNECTED"

    async def mock_get_account(s_id):
        if s_id == salon_a:
            return account_a
        if s_id == salon_b:
            return account_b
        return None

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(side_effect=mock_get_account)

    phone_a, token_a, _ = await service._resolve_credentials(salon_a)
    phone_b, token_b, _ = await service._resolve_credentials(salon_b)

    assert phone_a == "phone-id-a"
    assert token_a == "token-a"
    assert phone_b == "phone-id-b"
    assert token_b == "token-b"
    assert token_a != token_b
