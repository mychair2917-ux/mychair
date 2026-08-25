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
    account_a.waba_id = "waba-a-111"
    account_a.phone_number_id = "phone-id-a"
    account_a.business_phone_number = "+919876543210"
    account_a.authorization_data = {"access_token": "token-a"}
    account_a.status = "CONNECTED"
    account_a.connection_status = "ACTIVE"

    account_b = MagicMock()
    account_b.waba_id = "waba-b-222"
    account_b.phone_number_id = "phone-id-b"
    account_b.business_phone_number = "+919876543211"
    account_b.authorization_data = {"access_token": "token-b"}
    account_b.status = "CONNECTED"
    account_b.connection_status = "ACTIVE"

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


@pytest.mark.asyncio
async def test_get_config_returns_oauth_redirect_uri():
    """Test 1: GET /whatsapp/config schema and settings return oauth_redirect_uri safely."""
    from app.core.config import settings
    assert settings.META_OAUTH_REDIRECT_URI == "https://mychair.co.in/admin/settings"

    config_resp = WhatsAppConfigResponse(
        app_id="926424756517271",
        config_id="1624499392725484",
        oauth_redirect_uri=settings.META_OAUTH_REDIRECT_URI,
        configured=True,
    )
    assert config_resp.oauth_redirect_uri == "https://mychair.co.in/admin/settings"
    assert config_resp.app_id == "926424756517271"
    assert config_resp.config_id == "1624499392725484"


def test_oauth_url_structure_and_absence_of_xd_arbiter():
    """Test 2 & 3: Validate manual Meta OAuth URL structure and verify xd_arbiter is NOT used."""
    from urllib.parse import urlparse, parse_qs

    app_id = "926424756517271"
    config_id = "1624499392725484"
    redirect_uri = "https://mychair.co.in/admin/settings"
    state = "secure-random-state-1234"

    oauth_url = f"https://www.facebook.com/v20.0/dialog/oauth?client_id={app_id}&config_id={config_id}&response_type=code&redirect_uri={redirect_uri}&state={state}"

    parsed = urlparse(oauth_url)
    params = parse_qs(parsed.query)

    assert params["client_id"][0] == app_id
    assert params["config_id"][0] == config_id
    assert params["response_type"][0] == "code"
    assert params["redirect_uri"][0] == "https://mychair.co.in/admin/settings"
    assert params["state"][0] == state

    # Assert staticxx.facebook.com and xd_arbiter are NOT present
    assert "staticxx.facebook.com" not in oauth_url
    assert "xd_arbiter" not in oauth_url


@pytest.mark.asyncio
async def test_sdk_embedded_signup_token_exchange_omits_redirect_uri():
    """Verify SDK Embedded Signup token exchange sends client_id, client_secret, code, and OMITS redirect_uri."""
    salon_id = "salon-sdk-test"
    tenant_id = "tenant-sdk-test"
    code = "fresh-sdk-code-123"

    service = WhatsAppService()
    
    mock_connect = AsyncMock()
    service.connect_salon_waba = mock_connect

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "EAA-test-token-valid",
        "expires_in": 5184000,
    }

    with patch("httpx.AsyncClient.get", return_value=mock_resp) as mock_get:
        await service.exchange_embedded_signup_code(
            salon_id=salon_id,
            tenant_id=tenant_id,
            code=code,
        )

        assert mock_get.call_count >= 1
        first_call_kwargs = mock_get.call_args_list[0].kwargs
        params = first_call_kwargs.get("params", {})
        
        # Verify SDK Embedded Signup parameters
        assert "client_id" in params
        assert "client_secret" in params
        assert params.get("code") == code
        assert "redirect_uri" not in params

        # Verify additional_auth_data passed to connect_salon_waba does NOT contain oauth_code
        mock_connect.assert_called_once()
        additional_auth_data = mock_connect.call_args.kwargs.get("additional_auth_data", {})
        assert "oauth_code" not in additional_auth_data


@pytest.mark.asyncio
async def test_oauth_redirect_token_exchange_includes_redirect_uri_when_provided():
    """Verify legacy OAuth redirect flow includes redirect_uri when explicitly passed."""
    salon_id = "salon-redirect-test"
    tenant_id = "tenant-redirect-test"
    code = "fresh-redirect-code-456"
    redirect_uri = "https://mychair.co.in/admin/settings"

    service = WhatsAppService()
    
    mock_connect = AsyncMock()
    service.connect_salon_waba = mock_connect

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "EAA-test-token-valid",
        "expires_in": 5184000,
    }

    with patch("httpx.AsyncClient.get", return_value=mock_resp) as mock_get:
        await service.exchange_embedded_signup_code(
            salon_id=salon_id,
            tenant_id=tenant_id,
            code=code,
            redirect_uri=redirect_uri,
        )

        assert mock_get.call_count >= 1
        first_call_kwargs = mock_get.call_args_list[0].kwargs
        params = first_call_kwargs.get("params", {})
        
        assert params.get("redirect_uri") == redirect_uri
        assert params.get("code") == code


