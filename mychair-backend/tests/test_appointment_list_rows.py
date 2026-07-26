"""Unit tests for Appointment List row expansion (service + product grouping)."""

from app.services.appointment_list_rows import (
    expand_appointment_item_to_list_rows,
    format_product_display_name,
    group_products_by_identity_and_staff,
    group_services_by_staff,
)


def _appt(**overrides):
    base = {
        "id": "aaaaaaaaaaaaaaaaaaaaaaaa",
        "salon_id": "salon1",
        "customer_id": "cust1",
        "customer_name": "Client",
        "customer_phone": "9999999999",
        "staff_id": "A",
        "staff_name": "Alice",
        "start_datetime": "2026-07-26T10:00:00+00:00",
        "end_datetime": "2026-07-26T11:00:00+00:00",
        "total_price": 100,
        "status": "COMPLETED",
        "notes": None,
        "booking_source": "WALK_IN",
        "payment_type": "CASH",
        "payment_status": "PAID",
        "paid_amount": 100,
        "services": [],
        "products": [],
    }
    base.update(overrides)
    return base


def test_format_product_display_name_is_name_only():
    assert format_product_display_name("Shampoo", 1) == "Shampoo"
    assert format_product_display_name("Shampoo", 3) == "Shampoo"


def test_case1_same_product_same_staff_sums_quantity():
    item = _appt(
        products=[
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 1
    assert rows[0]["row_kind"] == "product"
    assert rows[0]["quantity"] == 2
    assert rows[0]["sold_by"] == "Alice"
    assert rows[0]["service_by"] is None
    assert rows[0]["services"] == []
    assert [p["name"] for p in rows[0]["products"]] == ["Shampoo"]
    assert rows[0]["products"][0]["quantity"] == 2


def test_case2_same_product_different_staff_separate_rows():
    item = _appt(
        products=[
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "B", "staff_name": "Bob"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 2
    assert {r["bill_reference"] for r in rows} == {"BILL-001"}
    assert rows[0]["sold_by"] == "Alice" and rows[0]["quantity"] == 1
    assert rows[1]["sold_by"] == "Bob" and rows[1]["quantity"] == 1


def test_case3_different_products_same_staff_separate_rows():
    item = _appt(
        products=[
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 2, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p2", "name": "Oil", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 2
    assert rows[0]["products"][0]["name"] == "Shampoo" and rows[0]["quantity"] == 2
    assert rows[1]["products"][0]["name"] == "Oil" and rows[1]["quantity"] == 1
    assert all(r["sold_by"] == "Alice" for r in rows)
    assert all(r["service_by"] is None for r in rows)


def test_case4_same_product_same_staff_multiple_quantities_sum():
    item = _appt(
        products=[
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 2, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 3, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 1
    assert rows[0]["quantity"] == 5


def test_case5_service_only_row():
    item = _appt(
        services=[
            {"service_id": "1", "name": "Haircut", "price": 10, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 1
    assert rows[0]["row_kind"] == "service"
    assert [s["name"] for s in rows[0]["services"]] == ["Haircut"]
    assert rows[0]["products"] == []
    assert rows[0]["quantity"] is None
    assert rows[0]["service_by"] == "Alice"
    assert rows[0]["sold_by"] is None


def test_case6_product_only_row():
    item = _appt(
        products=[
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 2, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 1
    assert rows[0]["services"] == []
    assert rows[0]["products"][0]["name"] == "Shampoo"
    assert rows[0]["quantity"] == 2
    assert rows[0]["service_by"] is None
    assert rows[0]["sold_by"] == "Alice"


def test_case7_mixed_bill_no_cartesian():
    item = _appt(
        services=[
            {"service_id": "1", "name": "Haircut", "price": 10, "staff_id": "A", "staff_name": "Alice"},
            {"service_id": "2", "name": "Facial", "price": 10, "staff_id": "B", "staff_name": "Bob"},
        ],
        products=[
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p2", "name": "Oil", "price": 10, "quantity": 1, "staff_id": "B", "staff_name": "Bob"},
        ],
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    # 2 service rows + 2 product rows
    assert len(rows) == 4
    assert {r["bill_reference"] for r in rows} == {"BILL-001"}

    service_rows = [r for r in rows if r["row_kind"] == "service"]
    product_rows = [r for r in rows if r["row_kind"] == "product"]
    assert len(service_rows) == 2
    assert len(product_rows) == 2

    assert all(r["products"] == [] and r["quantity"] is None and r["sold_by"] is None for r in service_rows)
    assert all(r["services"] == [] and r["service_by"] is None and r["quantity"] is not None for r in product_rows)

    # No false Haircut+Oil / Facial+Shampoo combinations
    for r in rows:
        assert not (r["services"] and r["products"])


def test_complete_product_scenario_bill_1001():
    item = _appt(
        products=[
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 2, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p2", "name": "Oil", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p2", "name": "Oil", "price": 10, "quantity": 1, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": "B", "staff_name": "Bob"},
            {"product_id": "p2", "name": "Oil", "price": 10, "quantity": 2, "staff_id": "B", "staff_name": "Bob"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-1001")
    assert len(rows) == 4
    assert all(r["bill_reference"] == "BILL-1001" for r in rows)

    by_key = {(r["products"][0]["name"], r["sold_by"]): r["quantity"] for r in rows}
    assert by_key[("Shampoo", "Alice")] == 4
    assert by_key[("Oil", "Alice")] == 2
    assert by_key[("Shampoo", "Bob")] == 1
    assert by_key[("Oil", "Bob")] == 2


def test_services_same_staff_one_row():
    item = _appt(
        services=[
            {"service_id": "1", "name": "Haircut", "price": 10, "staff_id": "A", "staff_name": "Alice"},
            {"service_id": "2", "name": "Hair Wash", "price": 10, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 1
    assert [s["name"] for s in rows[0]["services"]] == ["Haircut", "Hair Wash"]
    assert rows[0]["quantity"] is None
    assert rows[0]["sold_by"] is None


def test_same_service_same_staff_writes_name_once():
    item = _appt(
        services=[
            {"service_id": "1", "name": "Haircut", "price": 10, "staff_id": "A", "staff_name": "Alice"},
            {"service_id": "1", "name": "Haircut", "price": 10, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 1
    assert [s["name"] for s in rows[0]["services"]] == ["Haircut"]
    assert rows[0]["service_by"] == "Alice"


def test_services_different_staff_two_rows():
    item = _appt(
        services=[
            {"service_id": "1", "name": "Haircut", "price": 10, "staff_id": "A", "staff_name": "Alice"},
            {"service_id": "2", "name": "Hair Wash", "price": 10, "staff_id": "B", "staff_name": "Bob"},
        ]
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 2
    assert rows[0]["service_by"] == "Alice"
    assert rows[1]["service_by"] == "Bob"


def test_missing_quantity_defaults_to_one_when_summing():
    groups = group_products_by_identity_and_staff(
        [
            {"product_id": "p1", "name": "Shampoo", "price": 10, "staff_id": "A", "staff_name": "Alice"},
            {"product_id": "p1", "name": "Shampoo", "price": 10, "staff_id": "A", "staff_name": "Alice"},
        ]
    )
    assert len(groups) == 1
    assert groups[0][3] == 2


def test_historical_missing_line_staff_falls_back():
    item = _appt(
        staff_id="A",
        staff_name="Alice",
        services=[{"service_id": "1", "name": "Haircut", "price": 10, "staff_id": None, "staff_name": None}],
        products=[{"product_id": "p1", "name": "Shampoo", "price": 10, "quantity": 1, "staff_id": None, "staff_name": None}],
    )
    rows = expand_appointment_item_to_list_rows(item, bill_reference="BILL-001")
    assert len(rows) == 2
    service_row = next(r for r in rows if r["row_kind"] == "service")
    product_row = next(r for r in rows if r["row_kind"] == "product")
    assert service_row["staff_id"] == "A"
    assert product_row["staff_id"] == "A"
    assert product_row["quantity"] == 1


def test_group_services_helper_order():
    groups = group_services_by_staff(
        [
            {"service_id": "1", "name": "Haircut", "staff_id": "B", "staff_name": "Bob"},
            {"service_id": "2", "name": "Wash", "staff_id": "A", "staff_name": "Alice"},
            {"service_id": "3", "name": "Style", "staff_id": "B", "staff_name": "Bob"},
        ]
    )
    assert [key for key, _ in groups] == ["B", "A"]
    assert len(groups[0][1]) == 2
