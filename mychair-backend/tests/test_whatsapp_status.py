import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.api.v1.endpoints.whatsapp import _verify_salon_access, _sanitize_account_dict, get_whatsapp_status
from app.models.user import User
from app.models.salon_whatsapp_account import SalonWhatsAppAccount
from app.auth.rbac_config import ROLE_SUPER_ADMIN, ROLE_SALON_OWNER


@pytest.mark.asyncio
async def test_verify_salon_access_super_admin():
    user = MagicMock(spec=User)
    user.role = ROLE_SUPER_ADMIN
    user.tenant_id = "tenant-123"
    # Should not raise exception even if salon_id is different
    _verify_salon_access(user, "salon-456")


@pytest.mark.asyncio
async def test_verify_salon_access_matching_tenant():
    user = MagicMock(spec=User)
    user.role = ROLE_SALON_OWNER
    user.tenant_id = "salon-123"
    # Removing salon_id attribute to simulate actual User model
    del user.salon_id
    
    # Should not raise exception when tenant_id matches salon_id
    _verify_salon_access(user, "salon-123")


@pytest.mark.asyncio
async def test_verify_salon_access_wrong_salon_403():
    user = MagicMock(spec=User)
    user.role = ROLE_SALON_OWNER
    user.tenant_id = "salon-123"
    del user.salon_id

    with pytest.raises(HTTPException) as exc_info:
        _verify_salon_access(user, "salon-999")
    
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_sanitize_account_dict_connected():
    acc = MagicMock(spec=SalonWhatsAppAccount)
    acc.id = "60f7b1b3b3f3b3f3b3f3b3f3"
    acc.salon_id = "salon-123"
    acc.status = "CONNECTED"
    acc.connection_status = "ACTIVE"
    acc.waba_id = "waba-001"
    acc.phone_number_id = "phone-001"
    acc.business_phone_number = "+919876543210"
    acc.display_name = "My Salon"
    acc.connected_at = None
    acc.disconnected_at = None
    acc.features = {"billing_enabled": True}
    acc.templates = {"bill_receipt": "hello_world"}

    result = _sanitize_account_dict(acc, "salon-123")
    assert result["connected"] is True
    assert result["status"] == "CONNECTED"
    assert result["business_phone_number"] == "+919876543210"
    assert result["display_name"] == "My Salon"
    assert result["connection_status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_sanitize_account_dict_unconnected():
    result = _sanitize_account_dict(None, "salon-456")
    assert result["connected"] is False
    assert result["status"] == "DISCONNECTED"
    assert result["business_phone_number"] is None
    assert result["display_name"] is None
    assert result["connection_status"] == "ACTIVE"
