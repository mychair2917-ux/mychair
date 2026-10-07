"""
Production test suite for Billing + History fixes:
1. Real-time entered service price as final price (Bug 1)
2. Edit bill persistence, line item integrity, and history refresh data (Bug 2)
3. Manager role edit authorization & unauthorized role protection (Bug 3)
4. Manager edit tracking notification & audit with Manager-only visibility (Bug 4)
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.auth.rbac_config import (
    ROLE_SUPER_ADMIN,
    ROLE_SALON_OWNER,
    ROLE_SALON_ADMIN,
    ROLE_SALON_MANAGER,
    ROLE_EMPLOYEE,
)
from app.core.exceptions import PermissionDeniedException
from app.api.v1.endpoints.appointments import (
    _can_edit_appointment,
    update_frontdesk_booking,
)
from app.services.member_pricing import (
    PRICING_TYPE_MANUAL,
    PRICING_TYPE_MEMBER,
    PRICING_TYPE_NORMAL,
    resolve_applied_service_price,
    resolve_catalog_service_price,
)
from app.services.appointment_list_rows import (
    expand_appointment_item_to_list_rows,
)
from app.services.notifications import notification_service
from app.schemas.appointment import FrontDeskAppointmentCreate, AppointmentServiceCreate, AppointmentProductCreate


def test_bug1_entered_service_price_is_final_authoritative_price():
    """
    Scenario A:
    Service default price = 250
    User entered price = 200
    Assert final price = 200, pricing_type = MANUAL
    """
    # Non-member with manual price override
    final_price, p_type = resolve_applied_service_price(
        is_member=False,
        normal_price=250.0,
        member_price=220.0,
        submitted_price=200.0,
    )
    assert final_price == 200.0
    assert p_type == PRICING_TYPE_MANUAL

    # Member with manual price override
    m_final_price, m_p_type = resolve_applied_service_price(
        is_member=True,
        normal_price=250.0,
        member_price=220.0,
        submitted_price=200.0,
    )
    assert m_final_price == 200.0
    assert m_p_type == PRICING_TYPE_MANUAL

    # No override entered: default price is used
    def_price, def_type = resolve_applied_service_price(
        is_member=False,
        normal_price=250.0,
        member_price=220.0,
        submitted_price=None,
    )
    assert def_price == 250.0
    assert def_type == PRICING_TYPE_NORMAL


def test_bug2_appointment_list_rows_preserve_all_services_and_products():
    """
    Bug 2: When an appointment with multiple staff or products is expanded for history table,
    each row must preserve `all_services` and `all_products` so Edit Bill has the full data.
    """
    svc1 = {"service_id": "s1", "name": "Haircut", "price": 200.0, "staff_id": "staff-1", "staff_name": "Alice"}
    svc2 = {"service_id": "s2", "name": "Shave", "price": 100.0, "staff_id": "staff-2", "staff_name": "Bob"}
    prod1 = {"product_id": "p1", "name": "Wax", "price": 150.0, "quantity": 1, "staff_id": "staff-1", "staff_name": "Alice"}

    raw_item = {
        "id": "appt-12345678",
        "salon_id": "salon-1",
        "customer_id": "cust-1",
        "customer_name": "Rahul",
        "total_price": 450.0,
        "services": [svc1, svc2],
        "products": [prod1],
    }

    rows = expand_appointment_item_to_list_rows(raw_item, bill_reference="BILL-1234")
    assert len(rows) >= 2  # Split by staff/service/product

    for r in rows:
        assert "all_services" in r
        assert "all_products" in r
        assert len(r["all_services"]) == 2
        assert len(r["all_products"]) == 1
        assert r["all_services"][0]["price"] == 200.0
        assert r["all_services"][1]["price"] == 100.0
        assert r["all_products"][0]["price"] == 150.0


def test_bug3_can_edit_appointment_allows_manager_and_admin():
    """
    Bug 3: Both Frontend and Backend must authorize Manager (and Admin/Owner/Super Admin)
    to edit bills, while rejecting unauthorized roles (like Employee).
    """
    super_admin = MagicMock(role=ROLE_SUPER_ADMIN)
    owner = MagicMock(role=ROLE_SALON_OWNER)
    admin = MagicMock(role=ROLE_SALON_ADMIN)
    manager = MagicMock(role=ROLE_SALON_MANAGER)
    employee = MagicMock(role=ROLE_EMPLOYEE)

    assert _can_edit_appointment(super_admin) is True
    assert _can_edit_appointment(owner) is True
    assert _can_edit_appointment(admin) is True
    assert _can_edit_appointment(manager) is True
    assert _can_edit_appointment(employee) is False


@pytest.mark.asyncio
async def test_bug3_unauthorized_role_rejected_with_permission_denied():
    """
    Scenario E: Test that unauthorized roles (e.g. Employee) cannot bypass
    authorization by directly calling the update API.
    """
    employee = MagicMock(role=ROLE_EMPLOYEE)
    payload = MagicMock(spec=FrontDeskAppointmentCreate)

    with pytest.raises(PermissionDeniedException) as exc_info:
        await update_frontdesk_booking(
            id="some-id",
            payload=payload,
            current_user=employee,
        )
    assert "restricted" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_bug4_manager_edit_generates_audit_and_notification():
    """
    Scenario C: Manager edits bill.
    Verifies:
    - Update successful
    - AuditLog created with changed fields
    - Notification created targeting ROLE_SALON_MANAGER only
    """
    appt_id = str(ObjectId())
    manager_user = MagicMock()
    manager_user.id = ObjectId()
    manager_user.role = ROLE_SALON_MANAGER
    manager_user.tenant_id = "tenant-1"
    manager_user.email = "manager@example.com"
    manager_user.first_name = "Salon"
    manager_user.last_name = "Manager"

    existing_appt = MagicMock()
    existing_appt.id = ObjectId(appt_id)
    existing_appt.total_price = 250.0
    existing_appt.payment_status = "PAID"
    existing_appt.payment_type = "CASH"
    existing_appt.notes = "Original notes"
    existing_svc = MagicMock()
    existing_svc.model_dump.return_value = {
        "service_id": "svc-1",
        "name": "Haircut",
        "price": 250.0,
    }
    existing_appt.services = [existing_svc]
    existing_appt.products = []

    updated_appt = MagicMock()
    updated_appt.id = ObjectId(appt_id)
    updated_appt.salon_id = "salon-1"
    updated_appt.customer_id = str(ObjectId())
    updated_appt.total_price = 200.0
    updated_appt.payment_status = "PAID"
    updated_appt.payment_type = "CASH"
    updated_appt.notes = "Original notes"
    updated_svc = MagicMock()
    updated_svc.model_dump.return_value = {
        "service_id": "svc-1",
        "name": "Haircut",
        "price": 200.0,
    }
    updated_appt.services = [updated_svc]
    updated_appt.products = []

    payload = FrontDeskAppointmentCreate(
        salon_id="salon-1",
        customer_id=str(ObjectId()),
        start_datetime=datetime.now(),
        services=[AppointmentServiceCreate(service_id="svc-1", staff_id=str(ObjectId()), price=200.0)],
        products=[],
        payment_type="CASH",
        payment_status="PAID",
        total_amount=200.0,
        notes="Original notes",
    )

    with patch("app.api.v1.endpoints.appointments.appointment_repo.get", new=AsyncMock(return_value=existing_appt)), \
         patch("app.api.v1.endpoints.appointments.appointment_service.update_frontdesk_appointment", new=AsyncMock(return_value=updated_appt)), \
         patch("app.api.v1.endpoints.appointments.AuditLog") as MockAuditLog, \
         patch("app.api.v1.endpoints.appointments.notification_service.create_event_notifications", new=AsyncMock()) as mock_notif, \
         patch("app.api.v1.endpoints.appointments.notification_service._tenant_users_for_roles", new=AsyncMock(return_value=[manager_user])), \
         patch("app.api.v1.endpoints.appointments.Invoice.find_one", new=AsyncMock(return_value=MagicMock(invoice_number="BILL-1234"))), \
         patch("app.api.v1.endpoints.appointments.Customer.find_one", new=AsyncMock(return_value=MagicMock(full_name="Rahul"))), \
         patch("app.api.v1.endpoints.appointments._appointment_response", new=AsyncMock(return_value={"id": appt_id})):

        MockAuditLog.return_value.insert = AsyncMock()

        res = await update_frontdesk_booking(
            id=appt_id,
            payload=payload,
            current_user=manager_user,
        )

        assert res.status_code == 200
        import json
        body = json.loads(res.body.decode())
        assert body["success"] is True
        # Verify AuditLog was constructed and inserted
        assert MockAuditLog.called
        assert MockAuditLog.return_value.insert.called

        # Verify notification was sent with role_targets=[ROLE_SALON_MANAGER]
        assert mock_notif.called
        call_kwargs = mock_notif.call_args.kwargs
        assert call_kwargs["role_targets"] == [ROLE_SALON_MANAGER]
        assert call_kwargs["category"] == "BILLING"
        assert call_kwargs["notification_type"] == "BILL_EDITED"
        assert "BILL-1234" in call_kwargs["title"]
        assert "Rahul" in call_kwargs["body"]
        assert "250" in call_kwargs["body"]
        assert "200" in call_kwargs["body"]


@pytest.mark.asyncio
async def test_bug4_notification_visibility_rule_manager_only():
    """
    Bug 4: Notification visibility rule.
    The bill-edit notification generated by a Manager must be visible to the Manager role only.
    Must NOT be exposed to customers, staff, owner, admin, or other non-manager roles.
    """
    manager = MagicMock(role=ROLE_SALON_MANAGER, tenant_id="tenant-1", id=ObjectId())
    owner = MagicMock(role=ROLE_SALON_OWNER, tenant_id="tenant-1", id=ObjectId())
    admin = MagicMock(role=ROLE_SALON_ADMIN, tenant_id="tenant-1", id=ObjectId())
    employee = MagicMock(role=ROLE_EMPLOYEE, tenant_id="tenant-1", id=ObjectId())

    mgr_query = await notification_service._notification_scope_query(manager, "salon-1")
    owner_query = await notification_service._notification_scope_query(owner, "salon-1")
    admin_query = await notification_service._notification_scope_query(admin, "salon-1")
    emp_query = await notification_service._notification_scope_query(employee, "salon-1")

    # Manager query allows role_targets containing salon_manager
    assert "$or" in mgr_query
    mgr_target_in = next(c["role_targets"]["$in"] for c in mgr_query["$or"] if "$in" in c.get("role_targets", {}))
    assert ROLE_SALON_MANAGER in mgr_target_in

    # Owner query does NOT include salon_manager
    owner_target_in = next(c["role_targets"]["$in"] for c in owner_query["$or"] if "$in" in c.get("role_targets", {}))
    assert ROLE_SALON_MANAGER not in owner_target_in
    assert ROLE_SALON_OWNER in owner_target_in

    # Admin query does NOT include salon_manager
    admin_target_in = next(c["role_targets"]["$in"] for c in admin_query["$or"] if "$in" in c.get("role_targets", {}))
    assert ROLE_SALON_MANAGER not in admin_target_in

    # Employee query does NOT include salon_manager
    emp_target_in = next(c["role_targets"]["$in"] for c in emp_query["$or"] if "$in" in c.get("role_targets", {}))
    assert ROLE_SALON_MANAGER not in emp_target_in


@pytest.mark.asyncio
async def test_invoice_and_bill_services_preserve_manual_price_as_final():
    """
    End-to-end validation of Invoice and Bill line-item and aggregate calculations
    when a manual service price (e.g. ₹200 overridden from default ₹250) is used upon edit.
    """
    from app.services.billing import BillingService
    from app.services.bill import BillService
    from app.models.billing import Invoice
    from app.models.bill import Bill

    billing_svc = BillingService()
    bill_svc = BillService()

    services_payload = [{
        "service_id": "svc-1",
        "name": "Haircut",
        "price": 200.0,
        "unit_price": 200.0,
        "discount": 0.0,
        "tax_rate": 0.0,
        "staff_id": "staff-1",
        "staff_name": "Bob",
    }]

    mock_existing_invoice = MagicMock(spec=Invoice)
    mock_existing_invoice.id = "inv-1"
    mock_existing_invoice.invoice_number = "INV-1001"
    mock_existing_invoice.save = AsyncMock()

    with patch("app.models.billing.Invoice.find_one", new=AsyncMock(return_value=mock_existing_invoice)), \
         patch.object(billing_svc, "_dispatch_billing_whatsapp", new=AsyncMock()):

        updated_invoice = await billing_svc.update_invoice_from_appointment(
            appointment_id="appt-1",
            salon_id="salon-1",
            salon_name="My Salon",
            salon_phone="9999999999",
            salon_address="123 Main St",
            customer_id="cust-1",
            customer_name="Rahul",
            customer_phone="9876543210",
            services=services_payload,
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=200.0,
            paid_amount=200.0,
        )

        assert updated_invoice.subtotal == 200.0
        assert updated_invoice.total_amount == 200.0
        assert updated_invoice.discount_amount == 0.0
        assert len(updated_invoice.items) == 1
        assert updated_invoice.items[0].unit_price == 200.0
        assert updated_invoice.items[0].discount == 0.0

    mock_existing_bill = MagicMock(spec=Bill)
    mock_existing_bill.id = "bill-1"
    mock_existing_bill.bill_number = "BILL-1001"
    mock_existing_bill.save = AsyncMock()

    with patch("app.models.bill.Bill.find_one", new=AsyncMock(return_value=mock_existing_bill)):
        updated_bill = await bill_svc.update_bill_from_appointment(
            appointment_id="appt-1",
            salon_id="salon-1",
            salon_name="My Salon",
            salon_phone="9999999999",
            salon_address="123 Main St",
            customer_id="cust-1",
            customer_name="Rahul",
            customer_phone="9876543210",
            services=services_payload,
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=200.0,
            paid_amount=200.0,
        )

        assert updated_bill.subtotal == 200.0
        assert updated_bill.total_amount == 200.0
        assert updated_bill.discount_amount == 0.0
        assert len(updated_bill.items) == 1
        assert updated_bill.items[0].unit_price == 200.0
        assert updated_bill.items[0].discount == 0.0
        assert updated_bill.items[0].line_total == 200.0

