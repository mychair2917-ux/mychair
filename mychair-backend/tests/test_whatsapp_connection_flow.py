import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.salon_whatsapp_account import SalonWhatsAppAccount
from app.services.whatsapp import WhatsAppService, is_real_value
from app.services.whatsapp.meta_provider import MetaCloudApiProvider


@pytest.mark.asyncio
async def test_1_oauth_authorized_but_no_phone():
    """Test 1: OAuth authorized but no phone number -> connected=false."""
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.salon_id = "salon-oauth-only"
    account.waba_id = "109823471092837"
    account.phone_number_id = None
    account.business_phone_number = None
    account.status = "AUTHORIZED"
    account.connection_status = "AUTHORIZED"

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account)

    is_conn = await service.is_salon_connected("salon-oauth-only")
    assert is_conn is False


@pytest.mark.asyncio
async def test_2_pending_phone_id_not_connected():
    """Test 2: pending_phone_id -> connected=false."""
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.salon_id = "salon-pending-phone"
    account.waba_id = "109823471092837"
    account.phone_number_id = "pending_phone_id"
    account.business_phone_number = "+919876543210"
    account.status = "CONNECTED"
    account.connection_status = "ACTIVE"

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account)

    is_conn = await service.is_salon_connected("salon-pending-phone")
    assert is_conn is False


@pytest.mark.asyncio
async def test_3_pending_meta_setup_not_connected():
    """Test 3: Pending Meta Setup -> connected=false."""
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.salon_id = "salon-pending-meta"
    account.waba_id = "109823471092837"
    account.phone_number_id = "102938475610293"
    account.business_phone_number = "Pending Meta Setup"
    account.status = "CONNECTED"
    account.connection_status = "ACTIVE"

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account)

    is_conn = await service.is_salon_connected("salon-pending-meta")
    assert is_conn is False


@pytest.mark.asyncio
async def test_4_real_waba_and_phone_id_and_number_connected():
    """Test 4: Real WABA + real Phone Number ID + real phone -> connected=true."""
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.salon_id = "salon-connected-real"
    account.waba_id = "109823471092837"
    account.phone_number_id = "102938475610293"
    account.business_phone_number = "+919876543210"
    account.status = "CONNECTED"
    account.connection_status = "ACTIVE"

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account)

    is_conn = await service.is_salon_connected("salon-connected-real")
    assert is_conn is True


@pytest.mark.asyncio
async def test_5_multiple_wabas_does_not_silently_select_first():
    """Test 5: Multiple WABAs -> do not silently select first one, require selection."""
    service = WhatsAppService()

    mock_waba_resp = MagicMock()
    mock_waba_resp.status_code = 200
    mock_waba_resp.json.return_value = {
        "data": [
            {"id": "waba-001", "name": "WABA One"},
            {"id": "waba-002", "name": "WABA Two"},
        ]
    }

    mock_account = MagicMock(spec=SalonWhatsAppAccount)
    mock_account.status = "PHONE_SELECTION_REQUIRED"
    mock_account.connection_status = "PHONE_SELECTION_REQUIRED"
    service.connect_salon_waba = AsyncMock(return_value=mock_account)

    with patch("httpx.AsyncClient.get", return_value=mock_waba_resp):
        res = await service.exchange_embedded_signup_code(
            salon_id="salon-multi-waba",
            tenant_id="tenant-multi-waba",
            direct_access_token="EAA-test-token",
        )
        assert res.status == "PHONE_SELECTION_REQUIRED"
        assert res.connection_status == "PHONE_SELECTION_REQUIRED"


@pytest.mark.asyncio
async def test_6_multiple_phone_numbers_no_silent_selection():
    """Test 6: Multiple phone numbers with no known selection -> require selection."""
    service = WhatsAppService()

    mock_phone_resp = MagicMock()
    mock_phone_resp.status_code = 200
    mock_phone_resp.json.return_value = {
        "data": [
            {"id": "phone-111", "display_phone_number": "+919876543210"},
            {"id": "phone-222", "display_phone_number": "+919876543211"},
        ]
    }

    mock_account = MagicMock(spec=SalonWhatsAppAccount)
    mock_account.status = "PHONE_SELECTION_REQUIRED"
    mock_account.connection_status = "PHONE_SELECTION_REQUIRED"
    service.connect_salon_waba = AsyncMock(return_value=mock_account)

    with patch("httpx.AsyncClient.get", return_value=mock_phone_resp):
        res = await service.exchange_embedded_signup_code(
            salon_id="salon-multi-phone",
            tenant_id="tenant-multi-phone",
            waba_id="waba-001",
            direct_access_token="EAA-test-token",
        )
        assert res.status == "PHONE_SELECTION_REQUIRED"


@pytest.mark.asyncio
async def test_7_verification_required_connected_false():
    """Test 7: Verification required -> connected=false."""
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.salon_id = "salon-unverified"
    account.waba_id = "109823471092837"
    account.phone_number_id = "102938475610293"
    account.business_phone_number = "+919876543210"
    account.status = "VERIFICATION_REQUIRED"
    account.connection_status = "VERIFICATION_REQUIRED"

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account)

    is_conn = await service.is_salon_connected("salon-unverified")
    assert is_conn is False


@pytest.mark.asyncio
async def test_8_coexistence_required_connected_false():
    """Test 8: Coexistence required -> connected=false."""
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.salon_id = "salon-coexistence"
    account.waba_id = "109823471092837"
    account.phone_number_id = "102938475610293"
    account.business_phone_number = "+919876543210"
    account.status = "COEXISTENCE_REQUIRED"
    account.connection_status = "COEXISTENCE_REQUIRED"

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account)

    is_conn = await service.is_salon_connected("salon-coexistence")
    assert is_conn is False


@pytest.mark.asyncio
async def test_9_unconnected_production_salon_no_global_credentials_fallback():
    """Test 9: Unconnected production salon -> global credentials are NOT used."""
    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    phone_id, token, _ = await service._resolve_credentials("unconnected-salon-999")
    assert phone_id is None
    assert token is None


@pytest.mark.asyncio
async def test_10_connected_salon_a_uses_salon_a_credentials():
    """Test 10: Connected Salon A -> Salon A phone_number_id used."""
    account_a = MagicMock(spec=SalonWhatsAppAccount)
    account_a.status = "CONNECTED"
    account_a.connection_status = "ACTIVE"
    account_a.waba_id = "waba-a"
    account_a.phone_number_id = "phone-a-111"
    account_a.business_phone_number = "+919999911111"
    account_a.authorization_data = {"access_token": "token-salon-a"}

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account_a)

    phone_id, token, _ = await service._resolve_credentials("salon-a")
    assert phone_id == "phone-a-111"
    assert token == "token-salon-a"


@pytest.mark.asyncio
async def test_11_connected_salon_b_uses_salon_b_credentials():
    """Test 11: Connected Salon B -> Salon B phone_number_id used."""
    account_b = MagicMock(spec=SalonWhatsAppAccount)
    account_b.status = "CONNECTED"
    account_b.connection_status = "ACTIVE"
    account_b.waba_id = "waba-b"
    account_b.phone_number_id = "phone-b-222"
    account_b.business_phone_number = "+919999922222"
    account_b.authorization_data = {"access_token": "token-salon-b"}

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account_b)

    phone_id, token, _ = await service._resolve_credentials("salon-b")
    assert phone_id == "phone-b-222"
    assert token == "token-salon-b"


@pytest.mark.asyncio
async def test_12_salon_a_never_sends_via_salon_b_credentials():
    """Test 12: Salon A can never send through Salon B credentials."""
    account_a = MagicMock(spec=SalonWhatsAppAccount)
    account_a.status = "CONNECTED"
    account_a.connection_status = "ACTIVE"
    account_a.waba_id = "waba-a"
    account_a.phone_number_id = "phone-a-111"
    account_a.business_phone_number = "+919999911111"
    account_a.authorization_data = {"access_token": "token-salon-a"}

    account_b = MagicMock(spec=SalonWhatsAppAccount)
    account_b.status = "CONNECTED"
    account_b.connection_status = "ACTIVE"
    account_b.waba_id = "waba-b"
    account_b.phone_number_id = "phone-b-222"
    account_b.business_phone_number = "+919999922222"
    account_b.authorization_data = {"access_token": "token-salon-b"}

    async def mock_get(s_id):
        return account_a if s_id == "salon-a" else account_b

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(side_effect=mock_get)

    phone_a, token_a, _ = await service._resolve_credentials("salon-a")
    phone_b, token_b, _ = await service._resolve_credentials("salon-b")

    assert phone_a != phone_b
    assert token_a != token_b
    assert phone_a == "phone-a-111"
    assert phone_b == "phone-b-222"


@pytest.mark.asyncio
async def test_13_test_message_uses_salon_phone():
    """Test 13: Test message comes from configured salon phone."""
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.status = "CONNECTED"
    account.connection_status = "ACTIVE"
    account.waba_id = "waba-test"
    account.phone_number_id = "phone-test-999"
    account.business_phone_number = "+919876543210"
    account.authorization_data = {"access_token": "token-test-xyz"}
    account.templates = {"bill_receipt": "hello_world"}

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=account)

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_provider_send:
        mock_provider_send.return_value = {
            "success": True,
            "status_code": 200,
            "wamid": "wamid.test12345",
            "error_message": None,
        }
        with patch("app.services.whatsapp.service.WhatsAppMessageLog") as mock_log_cls:
            mock_log = MagicMock()
            mock_log_cls.return_value = mock_log
            mock_log.insert = AsyncMock()
            mock_log.save = AsyncMock()

            mock_find_query = MagicMock()
            mock_find_query.sort.return_value.first_or_none = AsyncMock(return_value=None)
            mock_log_cls.find_one = AsyncMock(return_value=None)

            await service.send_test_message("salon-test-13", "+919876543210")

            mock_provider_send.assert_called_once()
            call_kwargs = mock_provider_send.call_args.kwargs
            assert call_kwargs.get("phone_number_id") == "phone-test-999"
            assert call_kwargs.get("access_token") == "token-test-xyz"
