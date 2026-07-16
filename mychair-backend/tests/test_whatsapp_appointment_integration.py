import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.whatsapp import WhatsAppService
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.billing import Invoice
from app.models.bill import Bill
from beanie import PydanticObjectId

@pytest.mark.asyncio
async def test_send_on_appointment_submit_sends_hello_world_template():
    # Arrange
    service = WhatsAppService()
    
    # Mock appointment
    appointment = MagicMock(spec=Appointment)
    appointment.id = PydanticObjectId("507f1f77bcf86cd799439011")
    appointment.tenant_id = "tenant-123"
    appointment.salon_id = "salon-456"
    appointment.customer_id = "507f1f77bcf86cd799439012"
    
    # Mock customer
    customer = MagicMock(spec=Customer)
    customer.phone = "919285258269"

    # Mock settings
    with patch("app.services.whatsapp.settings") as mock_settings:
        mock_settings.WHATSAPP_PHONE_NUMBER_ID = "12345"
        mock_settings.whatsapp_bearer_token = "token-abc"
        mock_settings.WHATSAPP_APPOINTMENT_TEMPLATE = "hello_world"
        mock_settings.WHATSAPP_TEST_RECIPIENT_PHONE = "919285258269"
        mock_settings.WHATSAPP_TEMPLATE_MODE = "test"

        # Mock database queries
        async def mock_get_appointment(appointment_id):
            return appointment

        service._get_appointment = AsyncMock(side_effect=mock_get_appointment)

        # Mock find_one calls for models
        mock_customer_find_one = AsyncMock(return_value=customer)
        mock_invoice_find_one = AsyncMock(return_value=None)
        mock_bill_find_one = AsyncMock(return_value=None)

        # Mock Meta API response
        api_response = {
            "status_code": 200,
            "body": {
                "messaging_product": "whatsapp",
                "contacts": [{"input": "919285258269", "wa_id": "919285258269"}],
                "messages": [{"id": "wamid.HBgLOTE5Mjg1MjU4MjY5FQIAERgSRDM2QTMwNjc1QjhBOUFBMzM5AA=="}]
            }
        }
        mock_post_to_meta = AsyncMock(return_value=api_response)
        service._post_to_meta = mock_post_to_meta

        # Mock WhatsAppMessageLog class
        with patch("app.services.whatsapp.WhatsAppMessageLog") as mock_log_class:
            mock_log_instance = MagicMock()
            mock_log_class.return_value = mock_log_instance
            mock_log_instance.insert = AsyncMock()
            mock_log_instance.save = AsyncMock()

            # Mock query find on WhatsAppMessageLog to return no existing log
            mock_find_query = MagicMock()
            mock_find_query.sort.return_value.first_or_none = AsyncMock(return_value=None)
            mock_log_class.find.return_value = mock_find_query

            with patch.object(Customer, "find_one", mock_customer_find_one), \
                 patch.object(Invoice, "find_one", mock_invoice_find_one), \
                 patch.object(Bill, "find_one", mock_bill_find_one):

                # Act
                await service.send_on_appointment_submit(str(appointment.id))

                # Assert
                # Verify the Meta API call payload
                mock_post_to_meta.assert_called_once()
                payload = mock_post_to_meta.call_args[0][0]
                assert payload["messaging_product"] == "whatsapp"
                assert payload["to"] == "919285258269"
                assert payload["type"] == "template"
                assert payload["template"]["name"] == "hello_world"
                assert payload["template"]["language"]["code"] == "en_US"

                # Check logging creation
                mock_log_class.assert_called_once_with(
                    tenant_id="tenant-123",
                    salon_id="salon-456",
                    appointment_id=str(appointment.id),
                    invoice_id=None,
                    bill_id=None,
                    customer_id=appointment.customer_id,
                    phone_number="919285258269",
                    original_customer_phone="919285258269",
                    test_override_used=True,
                    message_status="pending",
                    invoice_url=None,
                    reward_points=0
                )
                
                # Check that insert was triggered
                mock_log_instance.insert.assert_called_once()
                
                # Check that final message state and wamid got updated and saved
                assert mock_log_instance.message_status == "sent"
                assert mock_log_instance.delivery_status == "sent"
                assert mock_log_instance.wamid == "wamid.HBgLOTE5Mjg1MjU4MjY5FQIAERgSRDM2QTMwNjc1QjhBOUFBMzM5AA=="
                assert mock_log_instance.api_response == api_response
                mock_log_instance.save.assert_called_once()
