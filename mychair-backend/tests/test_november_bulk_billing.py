"""
Tests specifically for the November 2026 Bulk Billing Upload fix and regression prevention.

Covers:
1. Exact November 2026 workbook (media_1795258090673_1b57f2c7.xlsx).
2. PyMongo/Beanie BSON encoding of BulkBillingBatch.
3. Starlette JSONResponse serialization of endpoint output.
4. Sheet scoring & ignoring of catalog/reference sheets (preventing 'Missing required columns in SERVICE template').
5. Dynamic header detection on row 2 or row 3.
6. Alternate column header aliases ('amount', 'total amount', 'staff', 'stylist').
7. Date parsing for ISO strings with times/timezones and date objects.
8. Safe error handling: HTTP 422 for validation errors, reserving 500 for internal errors.
9. End-to-end API validation and execution.
"""
from __future__ import annotations

import io
import json
import os
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock

import bson
import pytest
from beanie import PydanticObjectId
from fastapi import UploadFile
from fastapi.responses import JSONResponse
from openpyxl import Workbook

from app.api.v1.endpoints.bulk_billing import validate_bulk_billing, confirm_bulk_billing
from app.models.bulk_billing import BulkBillingBatch, BulkBillingRowRecord
from app.models.billing import Invoice
from app.models.customer import Customer
from app.models.product import Product
from app.models.salon import Salon
from app.models.salon_product import SalonProduct
from app.models.salon_service import SalonService
from app.models.service import Service
from app.models.user import User
from app.services.bulk_billing_import import (
    bulk_import_billing_service,
    _HEADER_ALIASES,
    _norm_header,
    _sanitize_for_storage,
)

NOVEMBER_WORKBOOK_PATH = "/Users/ma-56/.gemini/antigravity/brain/84a4c4cb-9860-4401-ae00-57a187938c32/.user_uploaded/media_1795258090673_1b57f2c7.xlsx"


@pytest.fixture
def boho_salon_mock_context(monkeypatch):
    """Mocks salon, staff, and services corresponding to Boho Salon from November workbook."""
    salon_id = "64b000000000000000000001"
    salon = MagicMock(spec=Salon)
    salon.id = PydanticObjectId(salon_id)
    salon.name = "Boho Salon"
    salon.tenant_id = "tenant-boho-01"
    salon.timezone = "Asia/Kolkata"

    staff_data = [
        ("Aashu", "Sen", "6968", "9999996968", "64b000000000000000000011"),
        ("Anjali", "Chavhan", "8596", "9999998596", "64b000000000000000000012"),
        ("Goutami", "", "3629", "9999993629", "64b000000000000000000013"),
        ("Imran", "", "7443", "9999997443", "64b000000000000000000014"),
        ("Om", "Songire", "0918", "9999990918", "64b000000000000000000015"),
        ("Sagar", "Sen", "1991", "9999991991", "64b000000000000000000016"),
        ("Sushant", "Girotra", "5235", "9999995235", "64b000000000000000000017"),
    ]
    staff_users = []
    for fn, ln, code, ph, uid in staff_data:
        u = MagicMock(spec=User)
        u.id = PydanticObjectId(uid)
        u.first_name = fn
        u.last_name = ln
        u.employee_code = code
        u.phone = ph
        u.role = "employee"
        staff_users.append(u)

    # Services
    common_services = [
        "Hair Cut", "cut", "hair cut", "paudar wax", "combo", "theading", "threading",
        "Acne Facial", "Acrylic Nails", "Facial", "Clean Up", "Shave"
    ]
    salon_services = []
    for idx, s_name in enumerate(common_services):
        ss = MagicMock(spec=SalonService)
        ss.id = PydanticObjectId(f"64b0000000000000000010{idx:02d}")
        ss.custom_service_name = s_name
        ss.name = s_name
        ss.service_id = None
        salon_services.append(ss)

    async def mock_resolve_salon(sid, tid=None):
        return salon

    user_find_mock = MagicMock()
    user_find_mock.to_list = AsyncMock(return_value=staff_users)
    monkeypatch.setattr(User, "find", MagicMock(return_value=user_find_mock))

    salon_svc_mock = MagicMock()
    salon_svc_mock.to_list = AsyncMock(return_value=salon_services)
    monkeypatch.setattr(SalonService, "find", MagicMock(return_value=salon_svc_mock))

    svc_find_mock = MagicMock()
    svc_find_mock.to_list = AsyncMock(return_value=[])
    monkeypatch.setattr(Service, "find", MagicMock(return_value=svc_find_mock))

    salon_prod_mock = MagicMock()
    salon_prod_mock.to_list = AsyncMock(return_value=[])
    monkeypatch.setattr(SalonProduct, "find", MagicMock(return_value=salon_prod_mock))

    prod_find_mock = MagicMock()
    prod_find_mock.to_list = AsyncMock(return_value=[])
    monkeypatch.setattr(Product, "find", MagicMock(return_value=prod_find_mock))

    inv_find_mock = MagicMock()
    inv_find_mock.to_list = AsyncMock(return_value=[])
    monkeypatch.setattr(Invoice, "find", MagicMock(return_value=inv_find_mock))

    monkeypatch.setattr(Customer, "get_settings", MagicMock())
    monkeypatch.setattr(Customer, "find_one", AsyncMock(return_value=None))
    monkeypatch.setattr("app.services.bulk_billing_import.find_client_by_phone", AsyncMock(return_value=None))

    monkeypatch.setattr(bulk_import_billing_service, "resolve_salon", mock_resolve_salon)
    monkeypatch.setattr(BulkBillingBatch, "get_settings", MagicMock())
    monkeypatch.setattr(BulkBillingBatch, "insert", AsyncMock())
    monkeypatch.setattr(BulkBillingBatch, "save", AsyncMock())

    return {
        "salon": salon,
        "staff": staff_users,
        "services": salon_services,
    }


# =============================================================================
# 1. ACTUAL NOVEMBER 2026 WORKBOOK VALIDATION & SERIALIZATION
# =============================================================================

@pytest.mark.asyncio
async def test_november_workbook_end_to_end_validation(boho_salon_mock_context):
    """
    Validates that the actual November 2026 bulk billing workbook parses,
    validates all rows, encodes to BSON without errors, and serializes to JSON.
    """
    assert os.path.exists(NOVEMBER_WORKBOOK_PATH), f"Workbook not found at {NOVEMBER_WORKBOOK_PATH}"

    with open(NOVEMBER_WORKBOOK_PATH, "rb") as f:
        file_bytes = f.read()

    batch = await bulk_import_billing_service.validate_import(
        salon_id="64b000000000000000000001",
        service_content=file_bytes,
        service_filename="MyChair_November_2026_Bulk_Upload_UPDATED.xlsx",
        deduct_inventory=False,
    )

    assert batch is not None
    assert batch.total_rows == 303
    assert batch.status == "VALIDATED"
    assert batch.import_type == "SERVICE"
    assert batch.deduct_inventory is False

    # 1. BSON Encoding Test (MongoDB persistence compatibility)
    doc = batch.model_dump()
    try:
        encoded = bson.BSON.encode(doc)
        assert len(encoded) > 0
    except Exception as exc:
        pytest.fail(f"BSON encoding failed on BulkBillingBatch document: {type(exc).__name__}: {exc}")

    # 2. JSONResponse Rendering Test (FastAPI / Starlette compatibility)
    row_dump = [r.model_dump(mode="json") for r in batch.row_records]
    try:
        response_payload = {
            "success": True,
            "message": "Bulk billing validation completed successfully",
            "data": {
                "batch_id": batch.batch_id,
                "status": batch.status,
                "total_rows": batch.total_rows,
                "row_records": row_dump,
            },
        }
        json_resp = JSONResponse(content=response_payload)
        rendered_bytes = json_resp.body
        assert len(rendered_bytes) > 0
    except Exception as exc:
        pytest.fail(f"JSONResponse serialization failed: {type(exc).__name__}: {exc}")


# =============================================================================
# 2. MULTIPLE WORKSHEET HANDLING & SHEET SCORING
# =============================================================================

def test_sheet_selection_with_catalog_and_guide_sheets():
    """
    Ensures that when a workbook contains a catalog sheet ('Services'),
    a guide sheet ('How to Fill'), and the actual data sheet ('Billing Data'),
    the billing data sheet is strictly selected and the catalog sheet is ignored.
    """
    wb = Workbook()
    
    # Sheet 1: Guide
    ws_guide = wb.active
    ws_guide.title = "How to Fill"
    ws_guide.append(["Guide Title", "Instructions"])
    ws_guide.append(["Step 1", "Fill data"])

    # Sheet 2: Catalog sheet that previously triggered false positive
    ws_cat = wb.create_sheet(title="Services")
    ws_cat.append(["Service Name", "Category", "Price", "Duration"])
    ws_cat.append(["Hair Cut", "Hair", 300, 30])
    ws_cat.append(["Facial", "Skin", 500, 45])

    # Sheet 3: Actual billing sheet
    ws_bills = wb.create_sheet(title="Billing Data")
    ws_bills.append(["Bill Date", "Client Name", "Mobile Number", "Service Name", "Staff Name", "Service Amount", "Payment Method", "Payment Status"])
    ws_bills.append(["2026-11-01", "Rahul", "9876543210", "Hair Cut", "Amit", 450, "CASH", "PAID"])

    buf = io.BytesIO()
    wb.save(buf)
    content = buf.getvalue()

    h_map, rows = bulk_import_billing_service._parse_excel_bytes(content, "SERVICE")
    assert "bill_date" in h_map
    assert "staff_identifier" in h_map
    assert "unit_price" in h_map
    assert len(rows) == 1
    assert rows[0][1][1] == "Rahul"


def test_sheet_selection_when_billing_sheet_renamed():
    """
    Ensures sheet scoring selects a custom-named billing sheet
    (e.g., 'November Bills') instead of guide sheets or catalog sheets.
    """
    wb = Workbook()
    ws_guide = wb.active
    ws_guide.title = "Instructions"
    ws_guide.append(["Do not use this sheet"])

    ws_cat = wb.create_sheet(title="Salon Services")
    ws_cat.append(["Service Name", "Price"])
    ws_cat.append(["Haircut", 200])

    ws_bills = wb.create_sheet(title="November Bills")
    ws_bills.append(["Bill Date", "Client Name", "Mobile", "Service Name", "Staff Name", "Service Amount", "Payment Method", "Payment Status"])
    ws_bills.append(["2026-11-05", "Anita", "9876543211", "Facial", "Priya", 600, "UPI", "PAID"])

    buf = io.BytesIO()
    wb.save(buf)
    content = buf.getvalue()

    h_map, rows = bulk_import_billing_service._parse_excel_bytes(content, "SERVICE")
    assert "item_name" in h_map
    assert len(rows) == 1
    assert rows[0][1][1] == "Anita"


# =============================================================================
# 3. HEADER ROW ON ROW 2 OR ROW 3 (TITLE BANNER COMPATIBILITY)
# =============================================================================

def test_header_detection_below_title_banner():
    """
    Verifies that when Row 1 is a title banner or notes,
    and the column headers are on Row 2 or Row 3, parsing locates the headers.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Billing Data"
    # Row 1: Banner title
    ws.append(["MyChair Salon - November 2026 Billing Records (DO NOT EDIT BANNER)"])
    # Row 2: Actual headers
    ws.append(["Bill Date", "Client Name", "Mobile Number", "Service Name", "Staff Name", "Service Amount", "Payment Method", "Payment Status"])
    # Row 3: Data row
    ws.append(["2026-11-01", "Karan", "9876543212", "Hair Cut", "Amit", 350, "CASH", "PAID"])

    buf = io.BytesIO()
    wb.save(buf)
    content = buf.getvalue()

    h_map, rows = bulk_import_billing_service._parse_excel_bytes(content, "SERVICE")
    assert h_map["client_name"] == 1
    assert h_map["unit_price"] == 5
    assert len(rows) == 1
    assert rows[0][0] == 3  # Excel row 3
    assert rows[0][1][1] == "Karan"


# =============================================================================
# 4. FLEXIBLE COLUMN ALIASES
# =============================================================================

def test_alternate_billing_headers():
    """
    Verifies that alternative column aliases such as 'Amount', 'Total Amount',
    'Stylist', and 'Contact No' are correctly mapped.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Billing Data"
    ws.append(["Date", "Customer", "Contact No", "Particulars", "Stylist", "Total Amount", "Mode of Payment", "Status"])
    ws.append(["2026-11-02", "Deepak", "9876543213", "Hair Cut", "Amit", 400, "UPI", "PAID"])

    buf = io.BytesIO()
    wb.save(buf)
    content = buf.getvalue()

    h_map, rows = bulk_import_billing_service._parse_excel_bytes(content, "SERVICE")
    assert h_map["bill_date"] == 0
    assert h_map["client_name"] == 1
    assert h_map["client_phone"] == 2
    assert h_map["item_name"] == 3
    assert h_map["staff_identifier"] == 4
    assert h_map["unit_price"] == 5
    assert h_map["payment_method"] == 6
    assert h_map["payment_status"] == 7
    assert len(rows) == 1


# =============================================================================
# 5. DATE PARSING ROBUSTNESS
# =============================================================================

class TestDateParsingRobustness:
    def test_iso_datetime_string(self):
        dt, err = bulk_import_billing_service._parse_row_date("2026-11-01 00:00:00", None, "UTC")
        assert err is None
        assert dt == datetime(2026, 11, 1, 0, 0, tzinfo=timezone.utc)

    def test_iso_t_string_with_z(self):
        dt, err = bulk_import_billing_service._parse_row_date("2026-11-01T14:30:00Z", None, "UTC")
        assert err is None
        assert dt.year == 2026
        assert dt.hour == 14
        assert dt.minute == 30

    def test_date_object(self):
        d = date(2026, 11, 1)
        dt, err = bulk_import_billing_service._parse_row_date(d, None, "UTC")
        assert err is None
        assert dt == datetime(2026, 11, 1, 0, 0, tzinfo=timezone.utc)

    def test_excel_serial_number(self):
        # 46327 corresponds to ~2026-11-01 in Excel 1900 date system
        dt, err = bulk_import_billing_service._parse_row_date(46327, None, "UTC")
        assert err is None
        assert dt.year == 2026
        assert dt.month == 11

    def test_unambiguous_day_greater_than_12(self):
        dt, err = bulk_import_billing_service._parse_row_date("25/11/2026", None, "UTC")
        assert err is None
        assert dt == datetime(2026, 11, 25, 0, 0, tzinfo=timezone.utc)

    def test_ambiguous_slash_date_rejected(self):
        dt, err = bulk_import_billing_service._parse_row_date("05/11/2026", None, "UTC")
        assert dt is None
        assert err is not None
        assert "YYYY-MM-DD" in err


# =============================================================================
# 6. SAFE STORAGE & CELL VALUE SANITIZATION
# =============================================================================

def test_cell_sanitization_removes_date_objects():
    """
    Verifies that raw cell values stored in raw_data are converted to primitives.
    """
    row_vals = [
        date(2026, 11, 1),
        datetime(2026, 11, 1, 10, 30),
        "Client",
        450.0,
        None,
    ]
    sanitized = [_sanitize_for_storage(v) for v in row_vals]
    assert sanitized[0] == "2026-11-01"
    assert sanitized[1] == "2026-11-01T10:30:00"
    assert sanitized[2] == "Client"
    assert sanitized[3] == 450.0
    assert sanitized[4] is None

    # Verify JSON compatibility
    dumped = json.dumps(sanitized)
    assert "2026-11-01" in dumped


# =============================================================================
# 7. IN-PLACE PREVIEW ROW EDITING AND REVALIDATION
# =============================================================================

@pytest.mark.asyncio
async def test_row_editing_revalidation_with_stored_iso_dates(boho_salon_mock_context):
    """
    Tests that editing a row record in a batch revalidates cleanly when
    r.bill_date is already an ISO string.
    """
    batch = BulkBillingBatch(
        batch_id="BATCH-TEST-REVAL",
        salon_id="64b000000000000000000001",
        tenant_id="tenant-boho-01",
        filenames=["test.xlsx"],
        import_type="SERVICE",
        status="VALIDATED",
        total_rows=1,
        total_bills=1,
        valid_bills=1,
        row_records=[
            BulkBillingRowRecord(
                file_type="SERVICE",
                excel_row=2,
                original_bill_reference="AUTO-ROW-S-2",
                client_name="Rahul",
                client_phone="9820731587",
                item_name="Hair Cut",
                item_type="SERVICE",
                staff_identifier="Sagar Sen – 1991",
                unit_price=450.0,
                bill_date="2026-11-01T00:00:00+00:00",
                payment_status="PAID",
                payment_method="CARD",
                paid_amount=450.0,
                status="VALID",
            )
        ],
    )

    # Revalidate batch
    await bulk_import_billing_service._revalidate_batch(batch, "64b000000000000000000001")
    assert batch.row_records[0].status == "VALID"
    assert batch.valid_bills == 1
    assert batch.invalid_bills == 0


# =============================================================================
# 8. ERROR HANDLING & HTTP STATUS CODES
# =============================================================================

def test_missing_required_columns_error_message():
    """
    Verifies that when required columns are missing from the template,
    a clear ValueError is raised listing the exact missing column names.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Billing Data"
    # Lacks staff_identifier and unit_price
    ws.append(["Bill Date", "Client Name", "Mobile Number", "Service Name"])
    ws.append(["2026-11-01", "Rahul", "9820731587", "Hair Cut"])

    buf = io.BytesIO()
    wb.save(buf)

    with pytest.raises(ValueError) as excinfo:
        bulk_import_billing_service._parse_excel_bytes(buf.getvalue(), "SERVICE")

    err_str = str(excinfo.value)
    assert "Missing required columns in SERVICE template" in err_str
    assert "staff_identifier" in err_str
    assert "unit_price" in err_str


@pytest.mark.asyncio
async def test_api_endpoint_validate_returns_200_for_november_workbook(boho_salon_mock_context):
    """
    Verifies that calling the FastAPI validate_bulk_billing endpoint directly
    with the November 2026 file returns HTTP 200 and a valid JSONResponse.
    """
    from fastapi import UploadFile
    from starlette.datastructures import Headers

    with open(NOVEMBER_WORKBOOK_PATH, "rb") as f:
        file_bytes = f.read()

    upload_file = UploadFile(
        file=io.BytesIO(file_bytes),
        size=len(file_bytes),
        filename="MyChair_November_2026_Bulk_Upload_UPDATED.xlsx",
        headers=Headers({"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
    )

    dummy_user = MagicMock(spec=User)
    dummy_user.id = PydanticObjectId("64b000000000000000000011")

    response = await validate_bulk_billing(
        salon_id="64b000000000000000000001",
        service_file=upload_file,
        product_file=None,
        staff_mappings=None,
        deduct_inventory=False,
        current_user=dummy_user,
    )

    assert response.status_code == 200
    assert response.body is not None
    body_data = json.loads(response.body.decode("utf-8"))
    assert body_data["success"] is True
    assert body_data["data"]["total_rows"] == 303
    assert body_data["data"]["import_type"] == "SERVICE"


@pytest.mark.asyncio
async def test_api_endpoint_validate_returns_422_on_invalid_file(boho_salon_mock_context):
    """
    Verifies that calling the endpoint with missing columns raises HTTPException 422,
    NOT HTTP 500 Internal Server Error.
    """
    from fastapi import HTTPException

    wb = Workbook()
    ws = wb.active
    ws.title = "Billing Data"
    ws.append(["Bill Date", "Client Name"])
    buf = io.BytesIO()
    wb.save(buf)
    file_bytes = buf.getvalue()

    upload_file = UploadFile(
        file=io.BytesIO(file_bytes),
        size=len(file_bytes),
        filename="invalid.xlsx",
    )

    dummy_user = MagicMock(spec=User)
    dummy_user.id = PydanticObjectId("64b000000000000000000011")

    with pytest.raises(HTTPException) as excinfo:
        await validate_bulk_billing(
            salon_id="64b000000000000000000001",
            service_file=upload_file,
            product_file=None,
            staff_mappings=None,
            deduct_inventory=False,
            current_user=dummy_user,
        )

    assert excinfo.value.status_code == 422
    assert "Missing required columns in SERVICE template" in excinfo.value.detail

