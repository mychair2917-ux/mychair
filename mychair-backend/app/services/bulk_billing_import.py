"""
Bulk Billing Import Service.

Handles downloadable Excel templates (.xlsx), safe parsing, client & staff resolution,
bill grouping across service and product files, price/tax calculations, duplicate detection,
safe atomic persistence with historical timestamps, live inventory protection,
and row-level failure reporting with Excel export.
"""
from __future__ import annotations

import io
import logging
import re
from datetime import datetime, timezone, time
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple
from zoneinfo import ZoneInfo

from beanie import PydanticObjectId
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from app.models.appointment import Appointment, ProductSnapshot, ServiceSnapshot
from app.models.bill import Bill, BillItem
from app.models.billing import Invoice, InvoiceItem, Payment, PaymentHistoryEntry, build_payment_history_note
from app.models.bulk_billing import BulkBillingBatch, BulkBillingRowRecord
from app.models.customer import Customer
from app.models.product import Product
from app.models.salon import Salon
from app.models.salon_product import SalonProduct
from app.models.salon_service import SalonService
from app.models.service import Service
from app.models.tenant import Tenant
from app.models.user import User
from app.services.bill import BillService
from app.services.billing import BillingService
from app.services.customer_phone import (
    find_client_by_phone,
    generate_client_reference_id,
)
from app.services.inventory import InventoryService
from app.utils.phone import normalize_mobile
from app.utils.timezone import now_utc
from app.utils.title_case import to_title_case
from app.utils.user_name import user_display_name

logger = logging.getLogger("bulk_billing_import")

MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB
MAX_ROWS = 10_000

# Error Categories
ERR_MISSING_REQUIRED = "MISSING_REQUIRED_FIELD"
ERR_INVALID_DATE = "INVALID_DATE"
ERR_CUSTOMER_MAPPING = "CUSTOMER_MAPPING_ERROR"
ERR_STAFF_NOT_FOUND = "STAFF_NOT_FOUND"
ERR_AMBIGUOUS_STAFF = "AMBIGUOUS_STAFF"
ERR_SERVICE_NOT_FOUND = "SERVICE_NOT_FOUND"
ERR_PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND"
ERR_INVALID_QUANTITY = "INVALID_QUANTITY"
ERR_INVALID_PRICE = "INVALID_PRICE"
ERR_AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
ERR_INVALID_PAYMENT = "INVALID_PAYMENT"
ERR_DUPLICATE_BILL = "DUPLICATE_BILL"
ERR_CONFLICTING_BILL = "CONFLICTING_BILL_DATA"
ERR_DATABASE_FAILURE = "DATABASE_SAVE_FAILURE"

# Standard Template Column Headers (Simplified for normal salon owners)
SERVICE_HEADERS = [
    "Bill Date",
    "Client Name",
    "Mobile Number",
    "Service Name",
    "Staff Name",
    "Service Amount",
    "Payment Method",
    "Payment Status",
    "Paid Amount",
    "Bill Group",
    "Discount",
    "Notes",
]

PRODUCT_HEADERS = [
    "Bill Date",
    "Client Name",
    "Mobile Number",
    "Product Name",
    "Quantity",
    "Selling Price",
    "Sold By Staff",
    "Payment Method",
    "Payment Status",
    "Paid Amount",
    "Bill Group",
    "Discount",
    "Notes",
]

# Aliases for flexible header matching
_HEADER_ALIASES = {
    # Reference & Bill Group
    "bill group": "bill_group",
    "bill_group": "bill_group",
    "group": "bill_group",
    "original bill reference": "original_bill_reference",
    "original_bill_reference": "original_bill_reference",
    "bill reference": "original_bill_reference",
    "bill no": "original_bill_reference",
    "bill number": "original_bill_reference",
    "invoice number": "original_bill_reference",
    "invoice no": "original_bill_reference",
    "reference": "original_bill_reference",
    # Date & Time
    "bill date": "bill_date",
    "date": "bill_date",
    "invoice date": "bill_date",
    "bill time": "bill_time",
    "time": "bill_time",
    # Client
    "client name": "client_name",
    "customer name": "client_name",
    "customer": "client_name",
    "client": "client_name",
    "name": "client_name",
    "mobile number": "client_phone",
    "client mobile / id": "client_phone",
    "client mobile": "client_phone",
    "customer mobile": "client_phone",
    "phone": "client_phone",
    "mobile": "client_phone",
    "customer id": "client_phone",
    "client id": "client_phone",
    # Item - Service
    "service name": "item_name",
    "service": "item_name",
    "service id": "item_id",
    # Item - Product
    "product name": "item_name",
    "product": "item_name",
    "product id": "item_id",
    "brand": "brand",
    "brand name": "brand",
    # Quantity & Price
    "quantity": "quantity",
    "qty": "quantity",
    "service amount": "unit_price",
    "service price": "unit_price",
    "selling price": "unit_price",
    "price": "unit_price",
    "unit price": "unit_price",
    "discount": "discount",
    "discount amount": "discount",
    "tax rate": "tax_rate",
    "tax rate (%)": "tax_rate",
    "tax": "tax_rate",
    # Staff
    "staff name": "staff_identifier",
    "staff identifier": "staff_identifier",
    "staff": "staff_identifier",
    "sold by staff": "staff_identifier",
    "sold by": "staff_identifier",
    "stylist": "staff_identifier",
    "employee": "staff_identifier",
    # Payment
    "payment status": "payment_status",
    "status": "payment_status",
    "payment method": "payment_method",
    "payment mode": "payment_method",
    "method": "payment_method",
    "paid amount": "paid_amount",
    "amount paid": "paid_amount",
    "notes": "notes",
    "note": "notes",
}


def _norm_header(h: Any) -> str:
    if h is None:
        return ""
    clean = re.sub(r"[_\-\s]+", " ", str(h).strip()).lower()
    return clean


def _apply_excel_header_styles(ws, headers: Sequence[str], primary_color: str = "1E293B"):
    header_fill = PatternFill(start_color=primary_color, end_color=primary_color, fill_type="solid")
    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )
    for idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[1].height = 28


def _apply_simple_headers(ws, headers: Sequence[str]):
    _apply_excel_header_styles(ws, headers, primary_color="1E293B")


def _auto_fit_columns(ws, max_widths: Optional[Dict[str, int]] = None):
    """Adjusts column widths based on content."""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = cell.value
            if val is not None:
                max_len = max(max_len, len(str(val)))
        width = max(max_len + 4, 12)
        if max_widths and col_letter in max_widths:
            width = min(width, max_widths[col_letter])
        ws.column_dimensions[col_letter].width = min(width, 40)


# Color Palette & Layout Tokens (MyChair Luxury Minimal Branding)
COLOR_GOLD = "B8860B"
COLOR_DARK_SLATE = "1E293B"
COLOR_REQUIRED_FILL = "FEF08A"  # Soft yellow for required columns
COLOR_REQUIRED_TEXT = "713F12"  # Dark amber text
COLOR_OPTIONAL_FILL = "E0F2FE"  # Soft light blue for optional columns
COLOR_OPTIONAL_TEXT = "0369A1"  # Dark sky text
COLOR_REF_HEADER_FILL = "F1F5F9"  # Soft slate for catalog references
COLOR_REF_HEADER_TEXT = "334155"  # Dark slate text
COLOR_BORDER = "E2E8F0"
COLOR_ZEBRA = "F8FAFC"
COLOR_WHITE = "FFFFFF"
COLOR_WARN_FILL = "FEF2F2"
COLOR_WARN_TEXT = "991B1B"
TEMPLATE_BLANK_ROWS = 500

SERVICE_REQUIRED_COLUMNS: Set[str] = {
    "Bill Date",
    "Client Name",
    "Service Name",
    "Staff Name",
    "Service Amount",
    "Payment Status",
    "Payment Method",
}

PRODUCT_REQUIRED_COLUMNS: Set[str] = {
    "Bill Date",
    "Client Name",
    "Product Name",
    "Quantity",
    "Selling Price",
    "Sold By Staff",
    "Payment Status",
    "Payment Method",
}

SERVICE_COLUMN_WIDTHS: Dict[str, int] = {
    "A": 15,  # Bill Date
    "B": 22,  # Client Name
    "C": 18,  # Mobile Number
    "D": 28,  # Service Name
    "E": 26,  # Staff Name
    "F": 16,  # Service Amount
    "G": 18,  # Payment Method
    "H": 18,  # Payment Status
    "I": 16,  # Paid Amount
    "J": 14,  # Bill Group
    "K": 14,  # Discount
    "L": 30,  # Notes
}

PRODUCT_COLUMN_WIDTHS: Dict[str, int] = {
    "A": 15,  # Bill Date
    "B": 22,  # Client Name
    "C": 18,  # Mobile Number
    "D": 28,  # Product Name
    "E": 12,  # Quantity
    "F": 16,  # Selling Price
    "G": 26,  # Sold By Staff
    "H": 18,  # Payment Method
    "I": 18,  # Payment Status
    "J": 16,  # Paid Amount
    "K": 14,  # Bill Group
    "L": 14,  # Discount
    "M": 30,  # Notes
}


def _apply_billing_table_headers(ws, headers: List[str], required_set: Set[str], start_row: int = 1):
    """Styles header row with Yellow for required and Light Blue for optional columns."""
    thin_border = Border(
        left=Side(style="thin", color=COLOR_BORDER),
        right=Side(style="thin", color=COLOR_BORDER),
        top=Side(style="thin", color=COLOR_BORDER),
        bottom=Side(style="medium", color=COLOR_GOLD),
    )
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=start_row, column=col_idx, value=h)
        is_req = h in required_set
        bg_color = COLOR_REQUIRED_FILL if is_req else COLOR_OPTIONAL_FILL
        fg_color = COLOR_REQUIRED_TEXT if is_req else COLOR_OPTIONAL_TEXT
        cell.fill = PatternFill(start_color=bg_color, end_color=bg_color, fill_type="solid")
        cell.font = Font(name="Arial", size=10, bold=True, color=fg_color)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[start_row].height = 30


def _format_blank_data_rows(ws, headers: List[str], num_rows: int = TEMPLATE_BLANK_ROWS, start_row: int = 2):
    """Pre-formats ready-to-fill rows with number formats, borders, alignments, and zebra shading."""
    thin_border = Border(
        left=Side(style="thin", color="F1F5F9"),
        right=Side(style="thin", color="F1F5F9"),
        top=Side(style="thin", color="F1F5F9"),
        bottom=Side(style="thin", color="F1F5F9"),
    )
    white_fill = PatternFill(start_color=COLOR_WHITE, end_color=COLOR_WHITE, fill_type="solid")
    zebra_fill = PatternFill(start_color=COLOR_ZEBRA, end_color=COLOR_ZEBRA, fill_type="solid")
    regular_font = Font(name="Arial", size=10, color="1E293B")

    col_formats: Dict[int, str] = {}
    col_alignments: Dict[int, Alignment] = {}
    for idx, h in enumerate(headers, start=1):
        norm = h.lower()
        if "date" in norm:
            col_formats[idx] = "yyyy-mm-dd"
            col_alignments[idx] = Alignment(horizontal="center", vertical="center")
        elif "time" in norm:
            col_formats[idx] = "@"
            col_alignments[idx] = Alignment(horizontal="center", vertical="center")
        elif "quantity" in norm:
            col_formats[idx] = "#,##0"
            col_alignments[idx] = Alignment(horizontal="right", vertical="center")
        elif "price" in norm or "discount" in norm or "paid amount" in norm:
            col_formats[idx] = "#,##0.00"
            col_alignments[idx] = Alignment(horizontal="right", vertical="center")
        elif "tax" in norm:
            col_formats[idx] = "0.00"
            col_alignments[idx] = Alignment(horizontal="right", vertical="center")
        elif "status" in norm or "method" in norm:
            col_formats[idx] = "@"
            col_alignments[idx] = Alignment(horizontal="center", vertical="center")
        else:
            col_formats[idx] = "@"
            col_alignments[idx] = Alignment(horizontal="left", vertical="center")

    for r_idx in range(start_row, start_row + num_rows):
        ws.row_dimensions[r_idx].height = 20
        row_fill = white_fill if (r_idx % 2 == 0) else zebra_fill
        for c_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font = regular_font
            cell.fill = row_fill
            cell.border = thin_border
            cell.number_format = col_formats[c_idx]
            cell.alignment = col_alignments[c_idx]


def _set_fixed_column_widths(ws, width_dict: Dict[str, int]):
    """Applies clean, readable column widths."""
    for col_letter, width in width_dict.items():
        ws.column_dimensions[col_letter].width = width


def _extract_staff_parts(ident: str) -> Tuple[str, Optional[str]]:
    """
    Given a staff label like 'Amit Sharma – EMP001' or 'Amit Sharma (EMP001)' or 'Amit Sharma',
    returns (name_prefix, code_or_phone_suffix).
    """
    s = ident.strip()
    m = re.search(r"^(.+?)\s*\(([^)]+)\)$", s)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    parts = re.split(r"\s*[\u2013\u2014-]\s*", s, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return s, None


def _populate_how_to_fill_sheet(
    ws_info,
    template_type: str,
    salon_name: str,
    catalog_items: List[str],
    staff_items: List[str],
):
    """Populates Sheet 1: How to Fill with instructions, color legend, and salon reference lists."""
    ws_info.views.sheetView[0].showGridLines = True

    item_title = "Service" if template_type == "SERVICE" else "Product"
    ws_info["A1"] = f"MyChair – {item_title} Billing Import Guide ({salon_name})"
    ws_info["A1"].font = Font(name="Arial", size=13, bold=True, color="FFFFFF")
    ws_info["A1"].fill = PatternFill(start_color=COLOR_DARK_SLATE, end_color=COLOR_DARK_SLATE, fill_type="solid")
    ws_info["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws_info.merge_cells("A1:G1")
    ws_info.row_dimensions[1].height = 36

    sec_font = Font(name="Arial", size=10, bold=True, color=COLOR_DARK_SLATE)
    bold_sub = Font(name="Arial", size=9, bold=True, color="1E293B")
    body_font = Font(name="Arial", size=9, color="334155")
    cell_border = Border(
        left=Side(style="thin", color=COLOR_BORDER),
        right=Side(style="thin", color=COLOR_BORDER),
        top=Side(style="thin", color=COLOR_BORDER),
        bottom=Side(style="thin", color=COLOR_BORDER),
    )

    ws_info["A3"] = "COLUMN COLOR LEGEND"
    ws_info["A3"].font = sec_font
    ws_info.row_dimensions[3].height = 20

    c_y = ws_info["A4"]
    c_y.value = "YELLOW HEADER"
    c_y.fill = PatternFill(start_color=COLOR_REQUIRED_FILL, end_color=COLOR_REQUIRED_FILL, fill_type="solid")
    c_y.font = Font(name="Arial", size=9, bold=True, color=COLOR_REQUIRED_TEXT)
    c_y.alignment = Alignment(horizontal="center", vertical="center")
    c_y.border = cell_border
    ws_info["B4"] = "REQUIRED: Must be completed for every bill item."
    ws_info["B4"].font = body_font

    c_b = ws_info["A5"]
    c_b.value = "LIGHT BLUE HEADER"
    c_b.fill = PatternFill(start_color=COLOR_OPTIONAL_FILL, end_color=COLOR_OPTIONAL_FILL, fill_type="solid")
    c_b.font = Font(name="Arial", size=9, bold=True, color=COLOR_OPTIONAL_TEXT)
    c_b.alignment = Alignment(horizontal="center", vertical="center")
    c_b.border = cell_border
    ws_info["B5"] = "OPTIONAL: Fill if applicable, or leave blank."
    ws_info["B5"].font = body_font

    c_g = ws_info["A6"]
    c_g.value = "GREY COLUMNS"
    c_g.fill = PatternFill(start_color=COLOR_REF_HEADER_FILL, end_color=COLOR_REF_HEADER_FILL, fill_type="solid")
    c_g.font = Font(name="Arial", size=9, bold=True, color=COLOR_REF_HEADER_TEXT)
    c_g.alignment = Alignment(horizontal="center", vertical="center")
    c_g.border = cell_border
    ws_info["B6"] = "INFORMATION: Active salon services, staff, and payment dropdown lists shown on the right."
    ws_info["B6"].font = body_font

    ws_info["A8"] = "EASY 5-STEP DATA ENTRY PROCESS"
    ws_info["A8"].font = sec_font
    ws_info.row_dimensions[8].height = 20

    steps = [
        ("STEP 1", "Open the 'Billing Data' sheet (click the tab at the bottom)."),
        ("STEP 2", f"Enter one {item_title.lower()} per row. For bills with multiple items, use the same bill reference."),
        ("STEP 3", f"Select staff, {item_title.lower()}, and payment details from the dropdown menus."),
        ("STEP 4", "Save the Excel file on your computer (File > Save)."),
        ("STEP 5", f"Upload the saved file to MyChair in Billing > Bulk Upload."),
    ]
    for idx, (st_label, st_desc) in enumerate(steps, start=9):
        cell_lbl = ws_info[f"A{idx}"]
        cell_lbl.value = st_label
        cell_lbl.font = bold_sub
        cell_lbl.alignment = Alignment(horizontal="center", vertical="center")
        cell_lbl.fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        cell_lbl.border = cell_border

        cell_dsc = ws_info[f"B{idx}"]
        cell_dsc.value = st_desc
        cell_dsc.font = body_font
        ws_info.row_dimensions[idx].height = 20

    ws_info["A15"] = "IMPORTANT BILLING RULES (PLEASE READ)"
    ws_info["A15"].font = sec_font
    ws_info.row_dimensions[15].height = 20

    rules = [
        ("Automatic Bill Numbers", "You do NOT need to enter bill numbers! MyChair automatically generates official Bill and Invoice numbers upon import."),
        ("Bill Date", "Enter date in YYYY-MM-DD format (e.g. 2026-09-01)."),
        ("Client Mobile Number", "Optional. If left blank, MyChair automatically creates a unique Client ID (CL-XXXXXX). If entered, MyChair searches for an existing customer."),
        ("Bill Group", "Optional. Use the same group number or text (e.g. 1, 2) on multiple rows to combine them into one bill. If left blank, each row is imported as its own separate bill."),
        ("Staff Assignment", f"Select the employee who performed or sold the {item_title.lower()}. Each item can be assigned to a different staff member."),
        ("Payment Details", "Select Payment Status (PAID, PARTIALLY_PAID, PENDING) and Payment Method (CASH, UPI, CARD, SPLIT). For grouped bills, payment details must match."),
        ("Amounts & Currency", "Enter numbers only (e.g. 300, not ₹300). Do not type the ₹ symbol."),
        ("Discount", "Enter discount amount in ₹ (e.g. 50 means ₹50 off), NOT percentage."),
        ("Clean Sheet", "Do not modify, rename, or delete any column headings in the 'Billing Data' sheet."),
    ]
    if template_type == "PRODUCT":
        rules.insert(5, ("Selling Price", "Enter unit price per single product item (not total price). Total is calculated automatically as Quantity × Selling Price."))

    for idx, (r_title, r_desc) in enumerate(rules, start=16):
        cell_t = ws_info[f"A{idx}"]
        cell_t.value = r_title
        cell_t.font = bold_sub
        cell_t.alignment = Alignment(horizontal="left", vertical="center")
        cell_t.border = cell_border

        cell_d = ws_info[f"B{idx}"]
        cell_d.value = r_desc
        cell_d.font = body_font
        ws_info.row_dimensions[idx].height = 22

    # Reference tables
    ref_header_fill = PatternFill(start_color=COLOR_REF_HEADER_FILL, end_color=COLOR_REF_HEADER_FILL, fill_type="solid")
    ref_header_font = Font(name="Arial", size=10, bold=True, color=COLOR_REF_HEADER_TEXT)
    ref_item_font = Font(name="Arial", size=9, color="1E293B")

    catalog_header_title = f"Your Salon Services ({len(catalog_items)})" if template_type == "SERVICE" else f"Your Salon Products ({len(catalog_items)})"
    ws_info["D3"] = catalog_header_title
    ws_info["D3"].fill = ref_header_fill
    ws_info["D3"].font = ref_header_font
    ws_info["D3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_info["D3"].border = cell_border

    ws_info["E3"] = f"Your Salon Staff ({len(staff_items)})"
    ws_info["E3"].fill = ref_header_fill
    ws_info["E3"].font = ref_header_font
    ws_info["E3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_info["E3"].border = cell_border

    ws_info["F3"] = "Payment Status"
    ws_info["F3"].fill = ref_header_fill
    ws_info["F3"].font = ref_header_font
    ws_info["F3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_info["F3"].border = cell_border

    ws_info["G3"] = "Payment Method"
    ws_info["G3"].fill = ref_header_fill
    ws_info["G3"].font = ref_header_font
    ws_info["G3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_info["G3"].border = cell_border

    for r_i, itm in enumerate(catalog_items, start=4):
        c = ws_info[f"D{r_i}"]
        c.value = itm
        c.font = ref_item_font
        c.border = cell_border

    for r_i, st in enumerate(staff_items, start=4):
        c = ws_info[f"E{r_i}"]
        c.value = st
        c.font = ref_item_font
        c.border = cell_border

    for r_i, pst in enumerate(["PAID", "PARTIALLY_PAID", "PENDING"], start=4):
        c = ws_info[f"F{r_i}"]
        c.value = pst
        c.font = ref_item_font
        c.border = cell_border

    for r_i, pm in enumerate(["CASH", "UPI", "CARD", "SPLIT"], start=4):
        c = ws_info[f"G{r_i}"]
        c.value = pm
        c.font = ref_item_font
        c.border = cell_border

    ws_info.column_dimensions["A"].width = 24
    ws_info.column_dimensions["B"].width = 80
    ws_info.column_dimensions["C"].width = 4
    ws_info.column_dimensions["D"].width = 30
    ws_info.column_dimensions["E"].width = 28
    ws_info.column_dimensions["F"].width = 18
    ws_info.column_dimensions["G"].width = 18


def _populate_billing_data_sheet(
    ws_data,
    template_type: str,
    headers: List[str],
    required_set: Set[str],
    width_dict: Dict[str, int],
    catalog_items: List[str],
    staff_items: List[str],
):
    """Populates Sheet 2: Billing Data with headers, 500 formatted blank rows, and data validations."""
    ws_data.views.sheetView[0].showGridLines = True
    last_col_letter = get_column_letter(len(headers))

    _apply_billing_table_headers(ws_data, headers, required_set, start_row=1)
    ws_data.freeze_panes = "A2"
    ws_data.auto_filter.ref = f"A1:{last_col_letter}1"

    _format_blank_data_rows(ws_data, headers, num_rows=TEMPLATE_BLANK_ROWS, start_row=2)
    _set_fixed_column_widths(ws_data, width_dict)

    # Add Dropdown Validations
    if catalog_items:
        dv_cat = DataValidation(
            type="list",
            formula1=f"='How to Fill'!$D$4:$D${len(catalog_items) + 3}",
            allow_blank=True,
        )
        ws_data.add_data_validation(dv_cat)
        dv_cat.add(f"D2:D{TEMPLATE_BLANK_ROWS + 1}")

    staff_col = "E" if template_type == "SERVICE" else "G"
    if staff_items:
        dv_staff = DataValidation(
            type="list",
            formula1=f"='How to Fill'!$E$4:$E${len(staff_items) + 3}",
            allow_blank=True,
        )
        ws_data.add_data_validation(dv_staff)
        dv_staff.add(f"{staff_col}2:{staff_col}{TEMPLATE_BLANK_ROWS + 1}")

    method_col = "G" if template_type == "SERVICE" else "H"
    dv_method = DataValidation(
        type="list",
        formula1='"CASH,UPI,CARD,SPLIT"',
        allow_blank=True,
    )
    ws_data.add_data_validation(dv_method)
    dv_method.add(f"{method_col}2:{method_col}{TEMPLATE_BLANK_ROWS + 1}")

    status_col = "H" if template_type == "SERVICE" else "I"
    dv_status = DataValidation(
        type="list",
        formula1='"PAID,PARTIALLY_PAID,PENDING"',
        allow_blank=True,
    )
    ws_data.add_data_validation(dv_status)
    dv_status.add(f"{status_col}2:{status_col}{TEMPLATE_BLANK_ROWS + 1}")


def _populate_example_sheet(
    ws_ex,
    template_type: str,
    headers: List[str],
    required_set: Set[str],
    width_dict: Dict[str, int],
):
    """Populates Sheet 3: Example with realistic sample bills marked for reference only."""
    ws_ex.views.sheetView[0].showGridLines = True
    last_col_letter = get_column_letter(len(headers))

    banner_cell = ws_ex["A1"]
    banner_cell.value = "FOR REFERENCE ONLY – DO NOT UPLOAD THESE EXAMPLE ROWS. ENTER YOUR DATA IN THE 'BILLING DATA' SHEET."
    banner_cell.fill = PatternFill(start_color=COLOR_WARN_FILL, end_color=COLOR_WARN_FILL, fill_type="solid")
    banner_cell.font = Font(name="Arial", size=10, bold=True, color=COLOR_WARN_TEXT)
    banner_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws_ex.merge_cells(f"A1:{last_col_letter}1")
    ws_ex.row_dimensions[1].height = 30

    _apply_billing_table_headers(ws_ex, headers, required_set, start_row=2)

    if template_type == "SERVICE":
        example_rows = [
            [
                "2026-09-01", "Rahul", "9876543210", "Haircut", "Amit",
                300.0, "CASH", "PAID", 300.0, "1", 0.0, "Haircut service",
            ],
            [
                "2026-09-01", "Rahul", "9876543210", "Facial", "Neha",
                700.0, "CASH", "PAID", 700.0, "1", 0.0, "Facial service",
            ],
            [
                "2026-09-01", "Priya", "", "Facial", "Neha",
                800.0, "UPI", "PAID", 800.0, "", 0.0, "Client without mobile",
            ],
            [
                "2026-09-02", "Rohit", "9876543211", "Hair Spa", "Amit",
                1200.0, "CARD", "PAID", 1200.0, "", 100.0, "Single service bill",
            ],
        ]
    else:
        example_rows = [
            [
                "2026-09-01", "Rahul", "9876543210", "Shampoo", 2,
                350.0, "Amit", "CASH", "PAID", 700.0, "1", 0.0, "Retail shampoo",
            ],
            [
                "2026-09-01", "Rahul", "9876543210", "Hair Wax", 1,
                250.0, "Neha", "CASH", "PAID", 250.0, "1", 0.0, "Styling wax",
            ],
            [
                "2026-09-01", "Priya", "", "Conditioner", 1,
                400.0, "Neha", "UPI", "PAID", 400.0, "", 0.0, "Client without mobile",
            ],
            [
                "2026-09-02", "Rohit", "9876543211", "Hair Serum", 1,
                600.0, "Amit", "CARD", "PAID", 600.0, "", 50.0, "Single product bill",
            ],
        ]

    ex_border = Border(
        left=Side(style="thin", color=COLOR_BORDER),
        right=Side(style="thin", color=COLOR_BORDER),
        top=Side(style="thin", color=COLOR_BORDER),
        bottom=Side(style="thin", color=COLOR_BORDER),
    )
    ex_font = Font(name="Arial", size=10, italic=True, color="334155")
    for r_offset, r_vals in enumerate(example_rows, start=3):
        ws_ex.row_dimensions[r_offset].height = 20
        for c_idx, val in enumerate(r_vals, start=1):
            cell = ws_ex.cell(row=r_offset, column=c_idx, value=val)
            cell.font = ex_font
            cell.border = ex_border
            if isinstance(val, float):
                cell.number_format = "#,##0.00"
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif isinstance(val, int):
                cell.number_format = "#,##0"
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif "–" in str(val) or ("-" in str(val) and len(str(val)) == 10):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    _set_fixed_column_widths(ws_ex, width_dict)


class TenantSalonProxy:
    """
    Duck-typed proxy representing a Salon when a tenant operates directly
    without a separate branch document in the salons collection.
    """
    def __init__(self, tenant: Any, override_id: Optional[str] = None):
        self.id = PydanticObjectId(override_id) if (override_id and PydanticObjectId.is_valid(override_id)) else tenant.id
        self.name = tenant.name or "MyChair Salon"
        self.tenant_id = str(tenant.id)
        self.timezone = getattr(tenant, "timezone", "Asia/Kolkata") or "Asia/Kolkata"
        self.phone = ""

    def __repr__(self) -> str:
        return f"<TenantSalonProxy id={self.id} name={self.name} tenant_id={self.tenant_id}>"


class BulkImportBillingService:
    def __init__(self) -> None:
        self.bill_service = BillService()
        self.billing_service = BillingService()
        self.inventory_service = InventoryService()

    async def resolve_salon(
        self, salon_id: Optional[str], tenant_id: Optional[str] = None
    ) -> Optional[Any]:
        """
        Resolves a Salon branch document or Tenant root entity.
        Supports lookup by Salon._id, Salon.tenant_id, or Tenant._id.
        """
        if not salon_id and not tenant_id:
            return None

        # 1. Try finding by Salon._id
        if salon_id and PydanticObjectId.is_valid(salon_id):
            try:
                salon = await Salon.find_one({"_id": PydanticObjectId(salon_id), "is_deleted": False})
                if salon:
                    return salon
            except Exception:
                pass

        # 2. Try finding by Salon.tenant_id
        eff_tenant = tenant_id or salon_id
        if eff_tenant:
            try:
                salon = await Salon.find_one({"tenant_id": eff_tenant, "is_deleted": False})
                if salon:
                    return salon
            except Exception:
                pass

        # 3. Try finding by Tenant._id
        candidate_ids = [cid for cid in [salon_id, tenant_id] if cid and PydanticObjectId.is_valid(cid)]
        for cid in candidate_ids:
            try:
                tenant = await Tenant.find_one({"_id": PydanticObjectId(cid), "is_deleted": False})
                if tenant:
                    return TenantSalonProxy(tenant, override_id=salon_id or str(tenant.id))
            except Exception:
                pass

        return None

    # =========================================================================
    # 1. EXCEL TEMPLATE GENERATORS
    # =========================================================================

    async def build_service_billing_template(
        self,
        salon_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> bytes:
        """Generates the downloadable Service Billing Excel template (.xlsx) with 3 sheets."""
        wb = Workbook()
        salon_name = "MyChair Salon"
        services_list: List[str] = []
        staff_list: List[str] = []

        if salon_id or tenant_id:
            try:
                salon = await self.resolve_salon(salon_id, tenant_id)
                if salon:
                    salon_name = salon.name or "MyChair Salon"
                    eff_tenant = tenant_id or salon.tenant_id

                    salon_services = await SalonService.find({
                        "$or": [{"salon_id": str(salon.id)}, {"salon_id": salon_id}, {"tenant_id": eff_tenant}],
                        "is_deleted": False,
                    }).to_list()
                    master_services = await Service.find({
                        "$or": [{"tenant_id": eff_tenant}, {"tenant_id": None}],
                        "is_deleted": False,
                    }).to_list()

                    master_svc_by_id = {str(ms.id): ms for ms in master_services}
                    seen_svc = set()
                    for ss in salon_services:
                        s_name = (getattr(ss, "custom_service_name", None) or getattr(ss, "name", None) or "").strip()
                        if not s_name and getattr(ss, "service_id", None) and str(ss.service_id) in master_svc_by_id:
                            s_name = (getattr(master_svc_by_id[str(ss.service_id)], "name", "") or "").strip()
                        if s_name and s_name.lower() not in seen_svc:
                            services_list.append(s_name)
                            seen_svc.add(s_name.lower())
                    for ms in master_services:
                        s_name = (ms.name or "").strip()
                        if s_name and s_name.lower() not in seen_svc:
                            services_list.append(s_name)
                            seen_svc.add(s_name.lower())

                    staff_query: Dict[str, Any] = {
                        "tenant_id": eff_tenant,
                        "is_deleted": False,
                        "role": {"$in": ["salon_owner", "salon_admin", "salon_manager", "employee"]},
                    }
                    all_staff = await User.find(staff_query).to_list()
                    seen_staff = set()
                    for u in all_staff:
                        disp = user_display_name(u).strip()
                        code = (u.employee_code or u.employee_id or "").strip()
                        phone = (u.phone or "").strip()
                        if code:
                            label = f"{disp} – {code}"
                        elif phone:
                            label = f"{disp} – {phone[-4:]}"
                        else:
                            label = disp
                        if label and label.lower() not in seen_staff:
                            staff_list.append(label)
                            seen_staff.add(label.lower())
            except Exception as exc:
                logger.warning("Catalog lookup for service template failed: %s", exc)

        services_list.sort()
        staff_list.sort()

        # Sheet 1: How to Fill
        ws_info = wb.active
        ws_info.title = "How to Fill"
        _populate_how_to_fill_sheet(ws_info, "SERVICE", salon_name, services_list, staff_list)

        # Sheet 2: Billing Data (The main entry sheet)
        ws_data = wb.create_sheet(title="Billing Data")
        _populate_billing_data_sheet(
            ws_data,
            "SERVICE",
            SERVICE_HEADERS,
            SERVICE_REQUIRED_COLUMNS,
            SERVICE_COLUMN_WIDTHS,
            services_list,
            staff_list,
        )

        # Sheet 3: Example
        ws_ex = wb.create_sheet(title="Example")
        _populate_example_sheet(
            ws_ex,
            "SERVICE",
            SERVICE_HEADERS,
            SERVICE_REQUIRED_COLUMNS,
            SERVICE_COLUMN_WIDTHS,
        )

        # Active tab defaults to Billing Data
        wb.active = ws_data

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    async def build_product_billing_template(
        self,
        salon_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> bytes:
        """Generates the downloadable Product Billing Excel template (.xlsx) with 3 sheets."""
        wb = Workbook()
        salon_name = "MyChair Salon"
        products_list: List[str] = []
        staff_list: List[str] = []

        if salon_id or tenant_id:
            try:
                salon = await self.resolve_salon(salon_id, tenant_id)
                if salon:
                    salon_name = salon.name or "MyChair Salon"
                    eff_tenant = tenant_id or salon.tenant_id

                    salon_products = await SalonProduct.find({
                        "$or": [{"salon_id": str(salon.id)}, {"salon_id": salon_id}, {"tenant_id": eff_tenant}],
                        "is_deleted": False,
                    }).to_list()
                    master_products = await Product.find({
                        "$or": [{"tenant_id": eff_tenant}, {"tenant_id": None}],
                        "is_deleted": False,
                    }).to_list()
                    master_prod_by_id = {str(mp.id): mp for mp in master_products}
                    seen_prod = set()
                    for sp in salon_products:
                        p_name = (getattr(sp, "custom_product_name", None) or getattr(sp, "name", None) or "").strip()
                        if not p_name and getattr(sp, "product_id", None) and str(sp.product_id) in master_prod_by_id:
                            p_name = (getattr(master_prod_by_id[str(sp.product_id)], "name", "") or "").strip()
                        if p_name and p_name.lower() not in seen_prod:
                            products_list.append(p_name)
                            seen_prod.add(p_name.lower())
                    for mp in master_products:
                        p_name = (getattr(mp, "name", "") or "").strip()
                        if p_name and p_name.lower() not in seen_prod:
                            products_list.append(p_name)
                            seen_prod.add(p_name.lower())

                    staff_query: Dict[str, Any] = {
                        "tenant_id": eff_tenant,
                        "is_deleted": False,
                        "role": {"$in": ["salon_owner", "salon_admin", "salon_manager", "employee"]},
                    }
                    all_staff = await User.find(staff_query).to_list()
                    seen_staff = set()
                    for u in all_staff:
                        disp = user_display_name(u).strip()
                        code = (u.employee_code or u.employee_id or "").strip()
                        phone = (u.phone or "").strip()
                        if code:
                            label = f"{disp} – {code}"
                        elif phone:
                            label = f"{disp} – {phone[-4:]}"
                        else:
                            label = disp
                        if label and label.lower() not in seen_staff:
                            staff_list.append(label)
                            seen_staff.add(label.lower())
            except Exception as exc:
                logger.warning("Catalog lookup for product template failed: %s", exc)

        products_list.sort()
        staff_list.sort()

        # Sheet 1: How to Fill
        ws_info = wb.active
        ws_info.title = "How to Fill"
        _populate_how_to_fill_sheet(ws_info, "PRODUCT", salon_name, products_list, staff_list)

        # Sheet 2: Billing Data (The main entry sheet)
        ws_data = wb.create_sheet(title="Billing Data")
        _populate_billing_data_sheet(
            ws_data,
            "PRODUCT",
            PRODUCT_HEADERS,
            PRODUCT_REQUIRED_COLUMNS,
            PRODUCT_COLUMN_WIDTHS,
            products_list,
            staff_list,
        )

        # Sheet 3: Example
        ws_ex = wb.create_sheet(title="Example")
        _populate_example_sheet(
            ws_ex,
            "PRODUCT",
            PRODUCT_HEADERS,
            PRODUCT_REQUIRED_COLUMNS,
            PRODUCT_COLUMN_WIDTHS,
        )

        # Active tab defaults to Billing Data
        wb.active = ws_data

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    # =========================================================================
    # 2. FILE PARSER & PRE-VALIDATOR
    # =========================================================================

    def _parse_excel_bytes(self, content: bytes, file_type: str) -> Tuple[Dict[str, int], List[Tuple[int, List[Any]]]]:
        """
        Safely parses Excel workbook in read-only and data-only mode.
        Specifically reads the 'Billing Data' sheet, ignoring guide and example sheets.
        Returns header mapping and list of (1-indexed row number, row values).
        """
        if not content:
            raise ValueError("Uploaded file is empty.")
        if len(content) > MAX_FILE_BYTES:
            raise ValueError(f"File size exceeds limit of {MAX_FILE_BYTES // (1024*1024)} MB.")
        if content[:2] != b"PK":
            raise ValueError("Invalid file format. Uploaded file is not a valid Excel (.xlsx) workbook.")

        try:
            wb = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
        except Exception as exc:
            raise ValueError(f"Unable to read Excel workbook: {str(exc)}") from exc

        # Strictly locate data worksheet (prioritize 'Billing Data')
        data_sheet = None
        for name in wb.sheetnames:
            clean = name.strip().lower()
            if clean == "billing data":
                data_sheet = wb[name]
                break

        # Fallback for older templates (excluding instructions, guide, and example sheets)
        if data_sheet is None:
            for name in wb.sheetnames:
                clean = name.strip().lower()
                if any(ign in clean for ign in ("how to fill", "instruction", "guide", "example", "sample")):
                    continue
                if file_type == "SERVICE" and "service" in clean:
                    data_sheet = wb[name]
                    break
                elif file_type == "PRODUCT" and "product" in clean:
                    data_sheet = wb[name]
                    break
                elif clean in ("billing", "data", "sheet1"):
                    data_sheet = wb[name]
                    break

        if data_sheet is None:
            for name in wb.sheetnames:
                clean = name.strip().lower()
                if not any(ign in clean for ign in ("how to fill", "instruction", "guide", "example", "sample")):
                    data_sheet = wb[name]
                    break

        if data_sheet is None:
            raise ValueError(f"Could not find 'Billing Data' sheet in uploaded {file_type} Excel file.")

        rows_iter = data_sheet.iter_rows(values_only=True)
        try:
            header_row = next(rows_iter)
        except StopIteration:
            raise ValueError("Excel worksheet is empty.")

        header_map: Dict[str, int] = {}
        for idx, col in enumerate(header_row):
            if col is not None:
                alias = _HEADER_ALIASES.get(_norm_header(col))
                if alias and alias not in header_map:
                    header_map[alias] = idx

        # Verify required headers
        required_aliases = [
            "bill_date",
            "client_name",
            "item_name",
            "staff_identifier",
            "unit_price",
        ]
        if file_type == "PRODUCT":
            required_aliases.append("quantity")

        missing = [req for req in required_aliases if req not in header_map]
        if missing:
            raise ValueError(f"Missing required columns in {file_type} template: {', '.join(missing)}")

        parsed_rows: List[Tuple[int, List[Any]]] = []
        excel_row_num = 1
        for row in rows_iter:
            excel_row_num += 1
            # Safely skip empty and blank formatted template rows
            if not row or all(v is None or str(v).strip() == "" for v in row):
                continue
            # Skip example rows if user left them in
            first_val = str(row[0] or "")
            if "[example" in first_val.lower() or ("example" in str(row).lower() and "delete" in str(row).lower()):
                continue

            parsed_rows.append((excel_row_num, list(row)))
            if len(parsed_rows) > MAX_ROWS:
                raise ValueError(f"File exceeds maximum allowed rows ({MAX_ROWS:,}).")

        return header_map, parsed_rows

    def _parse_row_date(self, raw_date: Any, raw_time: Any, salon_tz: str) -> Tuple[Optional[datetime], Optional[str]]:
        """
        Parses date and time into a timezone-aware UTC datetime.
        Enforces unambiguous date parsing.
        """
        if raw_date is None or str(raw_date).strip() == "":
            return None, "Bill Date is required."

        tz = ZoneInfo(salon_tz) if salon_tz else timezone.utc
        parsed_d: Optional[datetime] = None

        if isinstance(raw_date, datetime):
            parsed_d = raw_date
        elif hasattr(raw_date, "year") and hasattr(raw_date, "month") and hasattr(raw_date, "day") and not isinstance(raw_date, str):
            parsed_d = datetime(int(raw_date.year), int(raw_date.month), int(raw_date.day))
        else:
            text = str(raw_date).strip()
            # 1. Unambiguous ISO formats
            for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
                try:
                    parsed_d = datetime.strptime(text, fmt)
                    break
                except ValueError:
                    pass

            # 2. Unambiguous Indian DD/MM/YYYY or DD-MM-YYYY when day > 12
            if not parsed_d:
                sep = "/" if "/" in text else ("-" if "-" in text else None)
                if sep:
                    parts = text.split(sep)
                    if len(parts) == 3:
                        p0, p1, p2 = parts[0].strip(), parts[1].strip(), parts[2].strip()
                        if p0.isdigit() and p1.isdigit() and len(p2) == 4 and p2.isdigit():
                            d_val, m_val, y_val = int(p0), int(p1), int(p2)
                            if 13 <= d_val <= 31 and 1 <= m_val <= 12:
                                try:
                                    parsed_d = datetime(y_val, m_val, d_val)
                                except ValueError:
                                    pass

            if not parsed_d:
                if "/" in text or "-" in text:
                    return None, f"Ambiguous or unsupported date '{text}'. Please use format YYYY-MM-DD (e.g., 2026-09-01)."
                return None, f"Invalid date '{text}'. Expected format YYYY-MM-DD."

        # Parse optional time - preserve date-only start of day if omitted
        parsed_t = time(0, 0)
        if raw_time is not None and str(raw_time).strip() != "":
            parsed_time_found = False
            if isinstance(raw_time, time):
                parsed_t = raw_time
                parsed_time_found = True
            elif isinstance(raw_time, datetime):
                parsed_t = raw_time.time()
                parsed_time_found = True
            else:
                t_str = str(raw_time).strip()
                for t_fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M%p"):
                    try:
                        parsed_t = datetime.strptime(t_str, t_fmt).time()
                        parsed_time_found = True
                        break
                    except ValueError:
                        pass
            if not parsed_time_found:
                return None, f"Invalid time format '{raw_time}'. Expected format HH:MM (e.g., 14:30)."

        local_dt = datetime.combine(parsed_d.date(), parsed_t).replace(tzinfo=tz)
        utc_dt = local_dt.astimezone(timezone.utc)
        return utc_dt, None

    # =========================================================================
    # 3. VALIDATION PIPELINE (DRY RUN)
    # =========================================================================

    async def validate_import(
        self,
        salon_id: str,
        service_content: Optional[bytes] = None,
        product_content: Optional[bytes] = None,
        service_filename: Optional[str] = None,
        product_filename: Optional[str] = None,
        user_staff_mappings: Optional[Dict[str, str]] = None,
        deduct_inventory: bool = False,
        tenant_id: Optional[str] = None,
    ) -> BulkBillingBatch:
        """
        Executes a dry-run validation of uploaded Excel files without committing writes to billing collections.
        Groups service and product rows by Original Bill Reference.
        Returns a populated BulkBillingBatch instance with complete preview metrics.
        """
        salon = await self.resolve_salon(salon_id, tenant_id)
        if not salon:
            raise ValueError(f"Salon ID '{salon_id}' does not exist.")

        effective_tenant = tenant_id or salon.tenant_id
        salon_tz = getattr(salon, "timezone", "UTC") or "UTC"

        # Preload catalog & staff cache for fast batch lookup
        staff_query: Dict[str, Any] = {
            "tenant_id": effective_tenant,
            "is_deleted": False,
            "role": {"$in": ["salon_owner", "salon_admin", "salon_manager", "employee"]},
        }
        all_staff = await User.find(staff_query).to_list()

        # Build staff indexes: by id, by employee_code, by phone, by name, by label
        staff_by_id: Dict[str, User] = {str(u.id): u for u in all_staff}
        staff_by_code: Dict[str, User] = {}
        staff_by_phone: Dict[str, User] = {}
        staff_by_name: Dict[str, List[User]] = {}
        staff_by_label: Dict[str, User] = {}

        for u in all_staff:
            disp = user_display_name(u).strip()
            disp_lower = disp.lower()
            code = (u.employee_code or u.employee_id or "").strip()
            phone = (u.phone or "").strip()

            if code:
                staff_by_code[code.lower()] = u
            if phone:
                np, _ = normalize_mobile(phone)
                if np:
                    staff_by_phone[np] = u

            staff_by_name.setdefault(disp_lower, []).append(u)
            if u.first_name:
                fn = u.first_name.strip().lower()
                if fn != disp_lower:
                    staff_by_name.setdefault(fn, []).append(u)

            if code:
                staff_by_label[f"{disp} – {code}".lower()] = u
                staff_by_label[f"{disp} - {code}".lower()] = u
                staff_by_label[f"{disp} ({code})".lower()] = u
            elif u.phone:
                staff_by_label[f"{disp} – {u.phone[-4:]}".lower()] = u
                staff_by_label[f"{disp} - {u.phone[-4:]}".lower()] = u
                staff_by_label[f"{disp} ({u.phone[-4:]})".lower()] = u
            staff_by_label[disp_lower] = u

        # Preload services
        eff_tenant = effective_tenant
        salon_services = await SalonService.find({
            "$or": [{"salon_id": str(salon.id)}, {"salon_id": salon_id}, {"tenant_id": eff_tenant}],
            "is_deleted": False,
        }).to_list()
        master_services = await Service.find({
            "$or": [{"tenant_id": eff_tenant}, {"tenant_id": None}],
            "is_deleted": False,
        }).to_list()
        master_svc_by_id = {str(ms.id): ms for ms in master_services}
        svc_name_map: Dict[str, Any] = {}
        svc_id_map: Dict[str, Any] = {}
        for ss in salon_services:
            svc_id_map[str(ss.id)] = ss
            s_name = (getattr(ss, "custom_service_name", None) or getattr(ss, "name", None) or "").strip()
            if not s_name and getattr(ss, "service_id", None) and str(ss.service_id) in master_svc_by_id:
                s_name = (getattr(master_svc_by_id[str(ss.service_id)], "name", "") or "").strip()
            if s_name:
                svc_name_map[s_name.lower()] = ss
        for ms in master_services:
            svc_id_map[str(ms.id)] = ms
            if ms.name and ms.name.strip().lower() not in svc_name_map:
                svc_name_map[ms.name.strip().lower()] = ms

        # Preload retail products
        salon_products = await SalonProduct.find({
            "$or": [{"salon_id": str(salon.id)}, {"salon_id": salon_id}, {"tenant_id": eff_tenant}],
            "is_deleted": False,
            "product_type": "SELLING",
        }).to_list()
        master_products = await Product.find({
            "$or": [{"tenant_id": eff_tenant}, {"tenant_id": None}],
            "is_deleted": False,
        }).to_list()
        master_prod_by_id = {str(mp.id): mp for mp in master_products}
        prod_name_map: Dict[str, Any] = {}
        prod_id_map: Dict[str, Any] = {}
        for sp in salon_products:
            prod_id_map[str(sp.id)] = sp
            p_name = (getattr(sp, "custom_product_name", None) or getattr(sp, "name", None) or "").strip()
            if not p_name and getattr(sp, "product_id", None) and str(sp.product_id) in master_prod_by_id:
                p_name = (getattr(master_prod_by_id[str(sp.product_id)], "name", "") or "").strip()
            if p_name:
                prod_name_map[p_name.lower()] = sp
        for mp in master_products:
            prod_id_map[str(mp.id)] = mp
            if mp.name and mp.name.strip().lower() not in prod_name_map:
                prod_name_map[mp.name.strip().lower()] = mp

        # Collect rows from both files
        service_rows: List[Tuple[int, List[Any], Dict[str, int]]] = []
        product_rows: List[Tuple[int, List[Any], Dict[str, int]]] = []

        if service_content:
            svc_map, svc_r = self._parse_excel_bytes(service_content, "SERVICE")
            service_rows = [(r_num, r_vals, svc_map) for r_num, r_vals in svc_r]

        if product_content:
            prod_map, prod_r = self._parse_excel_bytes(product_content, "PRODUCT")
            product_rows = [(r_num, r_vals, prod_map) for r_num, r_vals in prod_r]

        if not service_rows and not product_rows:
            raise ValueError("No valid billing data rows found in uploaded files.")

        # Batch check existing duplicate bills in DB
        def get_val(r_vals: List[Any], h_map: Dict[str, int], key: str, default: Any = None) -> Any:
            idx = h_map.get(key)
            if idx is not None and idx < len(r_vals):
                val = r_vals[idx]
                return val if val is not None else default
            return default

        all_refs: Set[str] = set()
        for _, r_vals, h_map in service_rows + product_rows:
            raw_ref = str(get_val(r_vals, h_map, "original_bill_reference") or "").strip()
            raw_grp = str(get_val(r_vals, h_map, "bill_group") or "").strip()
            if raw_grp:
                all_refs.add(f"GROUP-{raw_grp}")
            elif raw_ref:
                all_refs.add(raw_ref)

        existing_invoices = await Invoice.find({
            "$or": [{"salon_id": str(salon.id)}, {"salon_id": salon_id}, {"tenant_id": effective_tenant}],
            "original_bill_reference": {"$in": list(all_refs)},
            "is_deleted": False,
        }).to_list()
        existing_ref_map = {inv.original_bill_reference: inv.invoice_number for inv in existing_invoices if inv.original_bill_reference}

        # Bill group dictionary: ref -> dict of bill info and rows
        bill_groups: Dict[str, Dict[str, Any]] = {}
        row_records: List[BulkBillingRowRecord] = []
        ambiguous_staff_map: Dict[str, List[Dict[str, str]]] = {}
        user_staff_mappings = user_staff_mappings or {}

        # Process Service Rows
        for r_num, r_vals, h_map in service_rows:
            raw_ref = str(get_val(r_vals, h_map, "original_bill_reference") or "").strip()
            raw_grp = str(get_val(r_vals, h_map, "bill_group") or "").strip()
            if raw_grp:
                ref = f"GROUP-{raw_grp}"
                bg_val = raw_grp
            elif raw_ref:
                ref = raw_ref
                bg_val = raw_ref
            else:
                ref = f"AUTO-ROW-S-{r_num}"
                bg_val = None

            date_raw = get_val(r_vals, h_map, "bill_date")
            time_raw = get_val(r_vals, h_map, "bill_time")
            client_name = to_title_case(str(get_val(r_vals, h_map, "client_name") or "").strip())
            client_phone_raw = get_val(r_vals, h_map, "client_phone")
            service_name = str(get_val(r_vals, h_map, "item_name") or "").strip()
            staff_ident = str(get_val(r_vals, h_map, "staff_identifier") or "").strip()
            unit_price_raw = get_val(r_vals, h_map, "unit_price")
            discount_raw = get_val(r_vals, h_map, "discount", 0.0)
            tax_rate_raw = get_val(r_vals, h_map, "tax_rate", 0.0)

            status_val = get_val(r_vals, h_map, "payment_status")
            status_raw = str(status_val).strip().upper() if status_val is not None and str(status_val).strip() != "" else None
            method_val = get_val(r_vals, h_map, "payment_method")
            method_raw = str(method_val).strip().upper() if method_val is not None and str(method_val).strip() != "" else None
            paid_amount_raw = get_val(r_vals, h_map, "paid_amount")
            notes = str(get_val(r_vals, h_map, "notes", "") or "").strip()

            row_rec = BulkBillingRowRecord(
                file_type="SERVICE",
                excel_row=r_num,
                original_bill_reference=ref,
                bill_group=bg_val,
                client_name=client_name,
                item_name=service_name,
                item_type="SERVICE",
                staff_identifier=staff_ident,
                quantity=1,
                raw_data={"row": r_vals},
            )

            # Validations
            err_cat = None
            err_msg = None
            action_req = None

            if not client_name:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Client Name is missing."
                action_req = "Enter customer name."
            elif not service_name:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Service name is missing."
                action_req = "Enter service performed."
            elif not staff_ident:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Staff Identifier is missing."
                action_req = "Assign performing stylist or employee."

            # Date parsing
            utc_dt = None
            if not err_cat:
                utc_dt, date_err = self._parse_row_date(date_raw, time_raw, salon_tz)
                if date_err:
                    err_cat = ERR_INVALID_DATE
                    err_msg = date_err
                    action_req = "Correct date format to YYYY-MM-DD."

            # Price & numeric parsing
            unit_price = 0.0
            discount = 0.0
            tax_rate = 0.0
            if not err_cat:
                try:
                    unit_price = float(unit_price_raw or 0.0)
                    if unit_price < 0:
                        raise ValueError("Price must be >= 0")
                except Exception:
                    err_cat = ERR_INVALID_PRICE
                    err_msg = f"Invalid service price '{unit_price_raw}'."
                    action_req = "Enter a valid numeric price."

            if not err_cat:
                try:
                    discount = max(0.0, float(discount_raw or 0.0))
                    tax_rate = max(0.0, float(tax_rate_raw or 0.0))
                except Exception:
                    discount = 0.0
                    tax_rate = 0.0

            # Catalog resolution
            matched_svc = None
            if not err_cat:
                svc_clean = service_name.lower()
                matched_svc = svc_name_map.get(svc_clean) or svc_id_map.get(service_name)
                if not matched_svc:
                    err_cat = ERR_SERVICE_NOT_FOUND
                    err_msg = f"Service '{service_name}' not found in salon catalog."
                    action_req = f"Add '{service_name}' to Salon Services catalog or verify spelling."

            # Staff resolution
            resolved_staff: Optional[User] = None
            if not err_cat:
                name_prefix, suffix_code = _extract_staff_parts(staff_ident)

                user_mapped_id = user_staff_mappings.get(staff_ident)
                if user_mapped_id and user_mapped_id in staff_by_id:
                    resolved_staff = staff_by_id[user_mapped_id]
                elif suffix_code and suffix_code.lower() in staff_by_code:
                    resolved_staff = staff_by_code[suffix_code.lower()]
                elif suffix_code:
                    norm_suf, _ = normalize_mobile(suffix_code)
                    if norm_suf and norm_suf in staff_by_phone:
                        resolved_staff = staff_by_phone[norm_suf]

                if not resolved_staff:
                    if staff_ident in staff_by_id:
                        resolved_staff = staff_by_id[staff_ident]
                    elif staff_ident.lower() in staff_by_code:
                        resolved_staff = staff_by_code[staff_ident.lower()]
                    else:
                        norm_sp, _ = normalize_mobile(staff_ident)
                        if norm_sp and norm_sp in staff_by_phone:
                            resolved_staff = staff_by_phone[norm_sp]

                if not resolved_staff and staff_ident.lower() in staff_by_label:
                    cand_list = staff_by_name.get(name_prefix.lower(), [])
                    if len(cand_list) <= 1:
                        resolved_staff = staff_by_label[staff_ident.lower()]

                if not resolved_staff:
                    lookup_name = (name_prefix or staff_ident).strip().lower()
                    cand_list = staff_by_name.get(lookup_name, [])
                    if len(cand_list) == 1:
                        resolved_staff = cand_list[0]
                    elif len(cand_list) > 1:
                        err_cat = ERR_AMBIGUOUS_STAFF
                        err_msg = f"Multiple staff members match '{staff_ident}'. Please select the correct employee."
                        action_req = "Select correct employee from the mapping dropdown."
                        ambiguous_staff_map[staff_ident] = [
                            {"id": str(u.id), "name": f"{user_display_name(u)} ({u.employee_code or u.role})"}
                            for u in cand_list
                        ]
                    else:
                        err_cat = ERR_STAFF_NOT_FOUND
                        err_msg = f"Staff '{staff_ident}' not found in this salon."
                        action_req = "Verify employee name, employee code, or active status."

            # Duplicate check
            if not err_cat and not ref.startswith("AUTO-ROW-") and ref in existing_ref_map:
                err_cat = ERR_DUPLICATE_BILL
                err_msg = f"Bill reference '{ref}' already exists in salon billing history (Invoice: {existing_ref_map[ref]})."
                action_req = "Skip or verify this bill was not imported previously."

            # Phone validation and Client ID status
            client_phone_clean = str(client_phone_raw or "").strip() if client_phone_raw is not None else ""
            norm_phone = None
            client_id_status = None
            if client_phone_clean:
                if client_phone_clean.upper().startswith("CL-"):
                    existing_cust = await Customer.find_one({
                        "phone": client_phone_clean.upper(),
                        "tenant_id": effective_tenant,
                        "is_deleted": False,
                    })
                    if existing_cust:
                        client_id_status = "EXISTING"
                        norm_phone = client_phone_clean.upper()
                    else:
                        client_id_status = "NOT_FOUND"
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = f"Client ID '{client_phone_clean}' not found in salon records."
                        action_req = "Verify Client ID or leave mobile blank to create a new client."
                else:
                    norm_p, phone_err = normalize_mobile(client_phone_clean)
                    if phone_err:
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = f"Invalid mobile number '{client_phone_clean}': {phone_err}."
                        action_req = "Enter a valid 10-digit Indian mobile number or leave blank."
                    else:
                        norm_phone = norm_p
                        existing_cust = await find_client_by_phone(norm_p, effective_tenant)
                        client_id_status = "EXISTING" if existing_cust else "NEW_WITH_PHONE"
            else:
                client_id_status = "WILL_GENERATE"

            row_rec.client_phone = norm_phone or (client_phone_clean if client_phone_clean else None)
            row_rec.client_id_status = client_id_status

            # Payment validation & multi-row consistency
            if not err_cat:
                if ref in bill_groups:
                    grp_exist = bill_groups[ref]
                    if status_raw:
                        if status_raw not in ("PAID", "PARTIALLY_PAID", "PENDING"):
                            err_cat = ERR_INVALID_PAYMENT
                            err_msg = f"Invalid payment status '{status_raw}'. Allowed: PAID, PARTIALLY_PAID, PENDING."
                            action_req = "Select a valid payment status from the dropdown."
                        elif grp_exist.get("payment_status") and status_raw != grp_exist["payment_status"]:
                            err_cat = ERR_CONFLICTING_BILL
                            err_msg = f"Conflicting payment status in bill '{ref}' ('{grp_exist['payment_status']}' vs '{status_raw}')."
                            action_req = "Ensure payment status matches across all rows of the same bill."
                    else:
                        status_raw = grp_exist.get("payment_status")

                    if not err_cat:
                        if method_raw:
                            if method_raw not in ("CASH", "UPI", "CARD", "SPLIT"):
                                err_cat = ERR_INVALID_PAYMENT
                                err_msg = f"Invalid payment method '{method_raw}'. Allowed: CASH, UPI, CARD, SPLIT."
                                action_req = "Select a valid payment method from the dropdown."
                            elif grp_exist.get("payment_method") and method_raw != grp_exist["payment_method"]:
                                err_cat = ERR_CONFLICTING_BILL
                                err_msg = f"Conflicting payment method in bill '{ref}' ('{grp_exist['payment_method']}' vs '{method_raw}')."
                                action_req = "Ensure payment method matches across all rows of the same bill."
                        else:
                            method_raw = grp_exist.get("payment_method")

                    if not err_cat and utc_dt and grp_exist.get("bill_date"):
                        if utc_dt.date() != grp_exist["bill_date"].date():
                            err_cat = ERR_CONFLICTING_BILL
                            err_msg = f"Conflicting bill date in bill '{ref}'. All rows for the same bill must share the same date."
                            action_req = "Ensure all rows for the same bill have the same date."
                else:
                    if not status_raw:
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = "Payment Status is required."
                        action_req = "Select Payment Status (PAID, PARTIALLY_PAID, or PENDING)."
                    elif status_raw not in ("PAID", "PARTIALLY_PAID", "PENDING"):
                        err_cat = ERR_INVALID_PAYMENT
                        err_msg = f"Invalid payment status '{status_raw}'. Allowed: PAID, PARTIALLY_PAID, PENDING."
                        action_req = "Select a valid payment status from the dropdown."

                    if not err_cat:
                        if not method_raw:
                            err_cat = ERR_MISSING_REQUIRED
                            err_msg = "Payment Method is required."
                            action_req = "Select Payment Method (CASH, UPI, CARD, or SPLIT)."
                        elif method_raw not in ("CASH", "UPI", "CARD", "SPLIT"):
                            err_cat = ERR_INVALID_PAYMENT
                            err_msg = f"Invalid payment method '{method_raw}'. Allowed: CASH, UPI, CARD, SPLIT."
                            action_req = "Select a valid payment method from the dropdown."

            # Paid amount validation
            if not err_cat and status_raw == "PARTIALLY_PAID":
                if paid_amount_raw is None or str(paid_amount_raw).strip() == "":
                    err_cat = ERR_INVALID_PAYMENT
                    err_msg = "Paid Amount is required when Payment Status is PARTIALLY_PAID."
                    action_req = "Enter the amount paid so far."
                else:
                    try:
                        p_val = float(paid_amount_raw)
                        if p_val <= 0:
                            err_cat = ERR_INVALID_PAYMENT
                            err_msg = "Paid Amount must be greater than zero for PARTIALLY_PAID status."
                            action_req = "Enter the actual positive amount paid."
                    except ValueError:
                        err_cat = ERR_INVALID_PAYMENT
                        err_msg = f"Invalid Paid Amount '{paid_amount_raw}'."
                        action_req = "Enter a valid numeric amount."

            line_subtotal = max(0.0, unit_price - discount)
            line_tax = round(line_subtotal * (tax_rate / 100.0), 2)
            line_total = round(line_subtotal + line_tax, 2)

            row_rec.unit_price = unit_price
            row_rec.discount = discount
            row_rec.tax_rate = tax_rate
            row_rec.line_total = line_total
            row_rec.bill_date = utc_dt.isoformat() if utc_dt else None
            row_rec.payment_status = status_raw
            row_rec.payment_method = method_raw
            row_rec.paid_amount = float(paid_amount_raw) if (paid_amount_raw is not None and str(paid_amount_raw).strip() != "") else None
            row_rec.notes = notes

            if resolved_staff:
                row_rec.resolved_staff_id = str(resolved_staff.id)
                row_rec.resolved_staff_name = user_display_name(resolved_staff)

            if err_cat:
                row_rec.status = "DUPLICATE" if err_cat == ERR_DUPLICATE_BILL else "FAILED"
                row_rec.error_category = err_cat
                row_rec.error_message = err_msg
                row_rec.action_required = action_req

            row_records.append(row_rec)

            # Grouping
            grp = bill_groups.setdefault(ref, {
                "ref": ref,
                "bill_group": bg_val,
                "client_name": client_name,
                "client_phone": norm_phone,
                "client_id_status": client_id_status,
                "bill_date": utc_dt,
                "payment_status": status_raw,
                "payment_method": method_raw,
                "paid_amount": float(paid_amount_raw) if (paid_amount_raw is not None and str(paid_amount_raw).strip() != "") else None,
                "service_items": [],
                "product_items": [],
                "row_records": [],
                "has_error": False,
                "is_duplicate": False,
            })
            grp["row_records"].append(row_rec)
            if err_cat:
                grp["has_error"] = True
                if err_cat == ERR_DUPLICATE_BILL:
                    grp["is_duplicate"] = True

            # Sync phone across group if one row has it
            if not grp.get("client_phone") and norm_phone:
                grp["client_phone"] = norm_phone
                grp["client_id_status"] = client_id_status

            # Check client consistency
            if grp["client_name"] and client_name and grp["client_name"].lower() != client_name.lower():
                row_rec.status = "FAILED"
                row_rec.error_category = ERR_CONFLICTING_BILL
                row_rec.error_message = f"Conflicting client name in bill {ref} ('{grp['client_name']}' vs '{client_name}')."
                row_rec.action_required = "Ensure client name is consistent across rows of the same bill."
                grp["has_error"] = True

            grp["service_items"].append({
                "service": matched_svc,
                "name": service_name,
                "staff": resolved_staff,
                "unit_price": unit_price,
                "discount": discount,
                "tax_rate": tax_rate,
                "line_total": line_total,
            })

        # Process Product Rows
        for r_num, r_vals, h_map in product_rows:
            raw_ref = str(get_val(r_vals, h_map, "original_bill_reference") or "").strip()
            raw_grp = str(get_val(r_vals, h_map, "bill_group") or "").strip()
            if raw_grp:
                ref = f"GROUP-{raw_grp}"
                bg_val = raw_grp
            elif raw_ref:
                ref = raw_ref
                bg_val = raw_ref
            else:
                ref = f"AUTO-ROW-P-{r_num}"
                bg_val = None

            date_raw = get_val(r_vals, h_map, "bill_date")
            time_raw = get_val(r_vals, h_map, "bill_time")
            client_name = to_title_case(str(get_val(r_vals, h_map, "client_name") or "").strip())
            client_phone_raw = get_val(r_vals, h_map, "client_phone")
            product_name = str(get_val(r_vals, h_map, "item_name") or "").strip()
            qty_raw = get_val(r_vals, h_map, "quantity", 1)
            staff_ident = str(get_val(r_vals, h_map, "staff_identifier") or "").strip()
            unit_price_raw = get_val(r_vals, h_map, "unit_price")
            discount_raw = get_val(r_vals, h_map, "discount", 0.0)
            tax_rate_raw = get_val(r_vals, h_map, "tax_rate", 0.0)

            status_val = get_val(r_vals, h_map, "payment_status")
            status_raw = str(status_val).strip().upper() if status_val is not None and str(status_val).strip() != "" else None
            method_val = get_val(r_vals, h_map, "payment_method")
            method_raw = str(method_val).strip().upper() if method_val is not None and str(method_val).strip() != "" else None
            paid_amount_raw = get_val(r_vals, h_map, "paid_amount")
            notes = str(get_val(r_vals, h_map, "notes", "") or "").strip()

            row_rec = BulkBillingRowRecord(
                file_type="PRODUCT",
                excel_row=r_num,
                original_bill_reference=ref,
                bill_group=bg_val,
                client_name=client_name,
                item_name=product_name,
                item_type="PRODUCT",
                staff_identifier=staff_ident,
                raw_data={"row": r_vals},
            )

            err_cat = None
            err_msg = None
            action_req = None

            if not client_name:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Client Name is missing."
                action_req = "Enter customer name."
            elif not product_name:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Product name is missing."
                action_req = "Enter retail product sold."
            elif not staff_ident:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Selling staff (Sold By) is missing."
                action_req = "Assign selling employee."

            utc_dt = None
            if not err_cat:
                utc_dt, date_err = self._parse_row_date(date_raw, time_raw, salon_tz)
                if date_err:
                    err_cat = ERR_INVALID_DATE
                    err_msg = date_err
                    action_req = "Correct date format to YYYY-MM-DD."

            # Parse quantity
            quantity = 1
            if not err_cat:
                try:
                    quantity = int(qty_raw or 1)
                    if quantity < 1:
                        raise ValueError("Quantity must be >= 1")
                except Exception:
                    err_cat = ERR_INVALID_QUANTITY
                    err_msg = f"Invalid product quantity '{qty_raw}'."
                    action_req = "Enter an integer quantity >= 1."

            unit_price = 0.0
            discount = 0.0
            tax_rate = 0.0
            if not err_cat:
                try:
                    unit_price = float(unit_price_raw or 0.0)
                    if unit_price < 0:
                        raise ValueError("Price must be >= 0")
                except Exception:
                    err_cat = ERR_INVALID_PRICE
                    err_msg = f"Invalid product selling price '{unit_price_raw}'."
                    action_req = "Enter a valid numeric price."

            if not err_cat:
                try:
                    discount = max(0.0, float(discount_raw or 0.0))
                    tax_rate = max(0.0, float(tax_rate_raw or 0.0))
                except Exception:
                    discount = 0.0
                    tax_rate = 0.0

            # Catalog resolution
            matched_prod = None
            if not err_cat:
                prod_clean = product_name.lower()
                matched_prod = prod_name_map.get(prod_clean) or prod_id_map.get(product_name)
                if not matched_prod:
                    err_cat = ERR_PRODUCT_NOT_FOUND
                    err_msg = f"Product '{product_name}' not found in retail catalog."
                    action_req = f"Add '{product_name}' to Salon Products catalog or verify spelling."

            # Staff resolution
            resolved_staff: Optional[User] = None
            if not err_cat:
                name_prefix, suffix_code = _extract_staff_parts(staff_ident)

                user_mapped_id = user_staff_mappings.get(staff_ident)
                if user_mapped_id and user_mapped_id in staff_by_id:
                    resolved_staff = staff_by_id[user_mapped_id]
                elif suffix_code and suffix_code.lower() in staff_by_code:
                    resolved_staff = staff_by_code[suffix_code.lower()]
                elif suffix_code:
                    norm_suf, _ = normalize_mobile(suffix_code)
                    if norm_suf and norm_suf in staff_by_phone:
                        resolved_staff = staff_by_phone[norm_suf]

                if not resolved_staff:
                    if staff_ident in staff_by_id:
                        resolved_staff = staff_by_id[staff_ident]
                    elif staff_ident.lower() in staff_by_code:
                        resolved_staff = staff_by_code[staff_ident.lower()]
                    else:
                        norm_sp, _ = normalize_mobile(staff_ident)
                        if norm_sp and norm_sp in staff_by_phone:
                            resolved_staff = staff_by_phone[norm_sp]

                if not resolved_staff and staff_ident.lower() in staff_by_label:
                    cand_list = staff_by_name.get(name_prefix.lower(), [])
                    if len(cand_list) <= 1:
                        resolved_staff = staff_by_label[staff_ident.lower()]

                if not resolved_staff:
                    lookup_name = (name_prefix or staff_ident).strip().lower()
                    cand_list = staff_by_name.get(lookup_name, [])
                    if len(cand_list) == 1:
                        resolved_staff = cand_list[0]
                    elif len(cand_list) > 1:
                        err_cat = ERR_AMBIGUOUS_STAFF
                        err_msg = f"Multiple staff members match '{staff_ident}'. Please select the correct employee."
                        action_req = "Select correct employee from the mapping dropdown."
                        ambiguous_staff_map[staff_ident] = [
                            {"id": str(u.id), "name": f"{user_display_name(u)} ({u.employee_code or u.role})"}
                            for u in cand_list
                        ]
                    else:
                        err_cat = ERR_STAFF_NOT_FOUND
                        err_msg = f"Staff '{staff_ident}' not found in this salon."
                        action_req = "Verify employee name, employee code, or active status."

            if not err_cat and not ref.startswith("AUTO-ROW-") and ref in existing_ref_map:
                err_cat = ERR_DUPLICATE_BILL
                err_msg = f"Bill reference '{ref}' already exists in salon billing history (Invoice: {existing_ref_map[ref]})."
                action_req = "Skip or verify this bill was not imported previously."

            # Phone validation and Client ID status
            client_phone_clean = str(client_phone_raw or "").strip() if client_phone_raw is not None else ""
            norm_phone = None
            client_id_status = None
            if client_phone_clean:
                if client_phone_clean.upper().startswith("CL-"):
                    existing_cust = await Customer.find_one({
                        "phone": client_phone_clean.upper(),
                        "tenant_id": effective_tenant,
                        "is_deleted": False,
                    })
                    if existing_cust:
                        client_id_status = "EXISTING"
                        norm_phone = client_phone_clean.upper()
                    else:
                        client_id_status = "NOT_FOUND"
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = f"Client ID '{client_phone_clean}' not found in salon records."
                        action_req = "Verify Client ID or leave mobile blank to create a new client."
                else:
                    norm_p, phone_err = normalize_mobile(client_phone_clean)
                    if phone_err:
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = f"Invalid mobile number '{client_phone_clean}': {phone_err}."
                        action_req = "Enter a valid 10-digit Indian mobile number or leave blank."
                    else:
                        norm_phone = norm_p
                        existing_cust = await find_client_by_phone(norm_p, effective_tenant)
                        client_id_status = "EXISTING" if existing_cust else "NEW_WITH_PHONE"
            else:
                client_id_status = "WILL_GENERATE"

            row_rec.client_phone = norm_phone or (client_phone_clean if client_phone_clean else None)
            row_rec.client_id_status = client_id_status

            # Payment validation & multi-row consistency
            if not err_cat:
                if ref in bill_groups:
                    grp_exist = bill_groups[ref]
                    if status_raw:
                        if status_raw not in ("PAID", "PARTIALLY_PAID", "PENDING"):
                            err_cat = ERR_INVALID_PAYMENT
                            err_msg = f"Invalid payment status '{status_raw}'. Allowed: PAID, PARTIALLY_PAID, PENDING."
                            action_req = "Select a valid payment status from the dropdown."
                        elif grp_exist.get("payment_status") and status_raw != grp_exist["payment_status"]:
                            err_cat = ERR_CONFLICTING_BILL
                            err_msg = f"Conflicting payment status in bill '{ref}' ('{grp_exist['payment_status']}' vs '{status_raw}')."
                            action_req = "Ensure payment status matches across all rows of the same bill."
                    else:
                        status_raw = grp_exist.get("payment_status")

                    if not err_cat:
                        if method_raw:
                            if method_raw not in ("CASH", "UPI", "CARD", "SPLIT"):
                                err_cat = ERR_INVALID_PAYMENT
                                err_msg = f"Invalid payment method '{method_raw}'. Allowed: CASH, UPI, CARD, SPLIT."
                                action_req = "Select a valid payment method from the dropdown."
                            elif grp_exist.get("payment_method") and method_raw != grp_exist["payment_method"]:
                                err_cat = ERR_CONFLICTING_BILL
                                err_msg = f"Conflicting payment method in bill '{ref}' ('{grp_exist['payment_method']}' vs '{method_raw}')."
                                action_req = "Ensure payment method matches across all rows of the same bill."
                        else:
                            method_raw = grp_exist.get("payment_method")

                    if not err_cat and utc_dt and grp_exist.get("bill_date"):
                        if utc_dt.date() != grp_exist["bill_date"].date():
                            err_cat = ERR_CONFLICTING_BILL
                            err_msg = f"Conflicting bill date in bill '{ref}'. All rows for the same bill must share the same date."
                            action_req = "Ensure all rows for the same bill have the same date."
                else:
                    if not status_raw:
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = "Payment Status is required."
                        action_req = "Select Payment Status (PAID, PARTIALLY_PAID, or PENDING)."
                    elif status_raw not in ("PAID", "PARTIALLY_PAID", "PENDING"):
                        err_cat = ERR_INVALID_PAYMENT
                        err_msg = f"Invalid payment status '{status_raw}'. Allowed: PAID, PARTIALLY_PAID, PENDING."
                        action_req = "Select a valid payment status from the dropdown."

                    if not err_cat:
                        if not method_raw:
                            err_cat = ERR_MISSING_REQUIRED
                            err_msg = "Payment Method is required."
                            action_req = "Select Payment Method (CASH, UPI, CARD, or SPLIT)."
                        elif method_raw not in ("CASH", "UPI", "CARD", "SPLIT"):
                            err_cat = ERR_INVALID_PAYMENT
                            err_msg = f"Invalid payment method '{method_raw}'. Allowed: CASH, UPI, CARD, SPLIT."
                            action_req = "Select a valid payment method from the dropdown."

            # Paid amount validation
            if not err_cat and status_raw == "PARTIALLY_PAID":
                if paid_amount_raw is None or str(paid_amount_raw).strip() == "":
                    err_cat = ERR_INVALID_PAYMENT
                    err_msg = "Paid Amount is required when Payment Status is PARTIALLY_PAID."
                    action_req = "Enter the amount paid so far."
                else:
                    try:
                        p_val = float(paid_amount_raw)
                        if p_val <= 0:
                            err_cat = ERR_INVALID_PAYMENT
                            err_msg = "Paid Amount must be greater than zero for PARTIALLY_PAID status."
                            action_req = "Enter the actual positive amount paid."
                    except ValueError:
                        err_cat = ERR_INVALID_PAYMENT
                        err_msg = f"Invalid Paid Amount '{paid_amount_raw}'."
                        action_req = "Enter a valid numeric amount."

            line_subtotal = max(0.0, (unit_price * quantity) - discount)
            line_tax = round(line_subtotal * (tax_rate / 100.0), 2)
            line_total = round(line_subtotal + line_tax, 2)

            row_rec.quantity = quantity
            row_rec.unit_price = unit_price
            row_rec.discount = discount
            row_rec.tax_rate = tax_rate
            row_rec.line_total = line_total
            row_rec.bill_date = utc_dt.isoformat() if utc_dt else None
            row_rec.payment_status = status_raw
            row_rec.payment_method = method_raw
            row_rec.paid_amount = float(paid_amount_raw) if (paid_amount_raw is not None and str(paid_amount_raw).strip() != "") else None
            row_rec.notes = notes

            if resolved_staff:
                row_rec.resolved_staff_id = str(resolved_staff.id)
                row_rec.resolved_staff_name = user_display_name(resolved_staff)

            if err_cat:
                row_rec.status = "DUPLICATE" if err_cat == ERR_DUPLICATE_BILL else "FAILED"
                row_rec.error_category = err_cat
                row_rec.error_message = err_msg
                row_rec.action_required = action_req

            row_records.append(row_rec)

            grp = bill_groups.setdefault(ref, {
                "ref": ref,
                "bill_group": bg_val,
                "client_name": client_name,
                "client_phone": norm_phone,
                "client_id_status": client_id_status,
                "bill_date": utc_dt,
                "payment_status": status_raw,
                "payment_method": method_raw,
                "paid_amount": float(paid_amount_raw) if (paid_amount_raw is not None and str(paid_amount_raw).strip() != "") else None,
                "service_items": [],
                "product_items": [],
                "row_records": [],
                "has_error": False,
                "is_duplicate": False,
            })
            grp["row_records"].append(row_rec)
            if err_cat:
                grp["has_error"] = True
                if err_cat == ERR_DUPLICATE_BILL:
                    grp["is_duplicate"] = True

            # Sync phone across group if one row has it
            if not grp.get("client_phone") and norm_phone:
                grp["client_phone"] = norm_phone
                grp["client_id_status"] = client_id_status

            if grp["client_name"] and client_name and grp["client_name"].lower() != client_name.lower():
                row_rec.status = "FAILED"
                row_rec.error_category = ERR_CONFLICTING_BILL
                row_rec.error_message = f"Conflicting client name in bill {ref} ('{grp['client_name']}' vs '{client_name}')."
                row_rec.action_required = "Ensure client name is consistent across rows of the same bill."
                grp["has_error"] = True

            grp["product_items"].append({
                "product": matched_prod,
                "name": product_name,
                "quantity": quantity,
                "staff": resolved_staff,
                "unit_price": unit_price,
                "discount": discount,
                "tax_rate": tax_rate,
                "line_total": line_total,
            })

        # Reconcile Bill Groups
        total_unique_bills = len(bill_groups)
        valid_bills = 0
        invalid_bills = 0
        duplicate_bills = 0
        total_valid_amount = 0.0

        for ref, grp in bill_groups.items():
            # If one row in the bill failed, mark all rows in that bill as FAILED
            if grp["has_error"]:
                if grp["is_duplicate"]:
                    duplicate_bills += 1
                else:
                    invalid_bills += 1
                for r in grp["row_records"]:
                    if r.status == "VALID":
                        r.status = "FAILED"
                        r.error_category = ERR_CONFLICTING_BILL
                        r.error_message = f"Bill {ref} contains another row with validation errors."
                        r.action_required = "Correct all rows for this bill reference."
                continue

            # Calculate complete bill totals
            subtotal = 0.0
            discount_total = 0.0
            tax_total = 0.0
            for item in grp["service_items"]:
                subtotal += item["unit_price"]
                discount_total += item["discount"]
                tax_total += round((item["unit_price"] - item["discount"]) * (item["tax_rate"] / 100.0), 2)
            for item in grp["product_items"]:
                subtotal += item["unit_price"] * item["quantity"]
                discount_total += item["discount"]
                tax_total += round(((item["unit_price"] * item["quantity"]) - item["discount"]) * (item["tax_rate"] / 100.0), 2)

            computed_total = round((subtotal - discount_total) + tax_total, 2)
            pay_status = grp["payment_status"]
            paid_amount = grp["paid_amount"]

            # Payment validation
            if pay_status == "PARTIALLY_PAID":
                if paid_amount is None or paid_amount <= 0:
                    grp["has_error"] = True
                    invalid_bills += 1
                    for r in grp["row_records"]:
                        r.status = "FAILED"
                        r.error_category = ERR_INVALID_PAYMENT
                        r.error_message = "Payment status is PARTIALLY_PAID but Paid Amount is missing or zero."
                        r.action_required = "Provide actual paid amount."
                    continue
                elif paid_amount >= computed_total:
                    pay_status = "PAID"
                    grp["payment_status"] = "PAID"

            valid_bills += 1
            total_valid_amount += computed_total

        # Build Batch Record
        batch_id = f"BATCH-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{salon_id[-4:].upper()}"
        filenames = []
        if service_filename:
            filenames.append(service_filename)
        if product_filename:
            filenames.append(product_filename)

        import_type = "COMBINED" if (service_content and product_content) else ("SERVICE" if service_content else "PRODUCT")

        client_ids_to_generate = sum(
            1 for grp in bill_groups.values()
            if not grp["has_error"] and not grp.get("client_phone")
        )
        customers_to_create = sum(
            1 for grp in bill_groups.values()
            if not grp["has_error"] and (
                not grp.get("client_phone") or grp.get("client_id_status") == "NEW_WITH_PHONE"
            )
        )

        batch = BulkBillingBatch(
            batch_id=batch_id,
            salon_id=salon_id,
            tenant_id=effective_tenant,
            filenames=filenames,
            import_type=import_type,
            deduct_inventory=deduct_inventory,
            status="VALIDATED",
            total_rows=len(row_records),
            total_bills=total_unique_bills,
            valid_bills=valid_bills,
            invalid_bills=invalid_bills,
            duplicate_bills=duplicate_bills,
            total_valid_amount=round(total_valid_amount, 2),
            client_ids_generated_count=client_ids_to_generate,
            customers_created_count=customers_to_create,
            row_records=row_records,
            ambiguous_staff=[
                {"excel_name": k, "options": v}
                for k, v in ambiguous_staff_map.items()
            ],
        )
        await batch.insert()
        return batch

    # =========================================================================
    # 4. SAFE EXECUTION ENGINE (TRANSACTION-SAFE COMMITS)
    # =========================================================================

    async def execute_import(
        self,
        batch_id: str,
        salon_id: str,
        user_id: Optional[str] = None,
        staff_mappings: Optional[Dict[str, str]] = None,
        deduct_inventory: bool = False,
    ) -> BulkBillingBatch:
        """
        Safely executes persistence for valid bills in the validated batch.
        Guarantees:
        - Atomic persistence per bill (Appointment + Invoice + Bill + Payment).
        - Safe rollback/cleanup on per-bill failure so no orphaned records exist.
        - Historical timestamps applied directly to MongoDB without Beanie hook overrides.
        - Zero customer WhatsApp messages or live reward point side effects.
        - Optional inventory deduction only if explicitly enabled.
        """
        batch = await BulkBillingBatch.find_one({
            "batch_id": batch_id,
            "$or": [{"salon_id": salon_id}, {"tenant_id": salon_id}],
            "is_deleted": False,
        })
        if not batch:
            raise ValueError(f"Bulk billing batch '{batch_id}' not found.")
        if batch.status in ("COMPLETED", "IMPORTING"):
            raise ValueError(f"Bulk billing batch '{batch_id}' has already been executed or is currently processing.")

        salon = await self.resolve_salon(salon_id, batch.tenant_id)
        if not salon:
            raise ValueError(f"Salon '{salon_id}' not found.")

        effective_tenant = batch.tenant_id or salon.tenant_id
        batch.status = "IMPORTING"
        batch.deduct_inventory = deduct_inventory
        batch.uploaded_by = user_id
        await batch.save()

        # Group valid rows from batch
        staff_mappings = staff_mappings or {}
        bills_to_import: Dict[str, Dict[str, Any]] = {}

        # Re-resolve all staff for fast access
        all_staff = await User.find({
            "tenant_id": effective_tenant,
            "is_deleted": False,
        }).to_list()
        staff_by_id: Dict[str, User] = {str(u.id): u for u in all_staff}

        for r in batch.row_records:
            if r.status != "VALID":
                continue
            # Apply staff mapping if user provided one during preview
            if r.staff_identifier and r.staff_identifier in staff_mappings:
                mapped_id = staff_mappings[r.staff_identifier]
                if mapped_id in staff_by_id:
                    r.resolved_staff_id = mapped_id
                    r.resolved_staff_name = user_display_name(staff_by_id[mapped_id])

            grp = bills_to_import.setdefault(r.original_bill_reference, {
                "ref": r.original_bill_reference,
                "client_name": r.client_name,
                "client_phone": r.client_phone,
                "bill_date": datetime.fromisoformat(r.bill_date) if r.bill_date else now_utc(),
                "payment_status": r.payment_status or "PAID",
                "payment_method": r.payment_method or "CASH",
                "paid_amount": r.paid_amount,
                "notes": r.notes,
                "rows": [],
            })
            grp["rows"].append(r)

        successful_bills = 0
        failed_bills = 0
        total_committed_amount = 0.0

        for ref, grp in bills_to_import.items():
            created_invoice = None
            created_bill = None
            created_appointment = None
            created_payment = None

            try:
                # 1. Resolve or create Customer
                client_name = grp["client_name"] or "Valued Customer"
                raw_phone = grp["client_phone"]
                norm_phone = None
                if raw_phone:
                    norm_p, _ = normalize_mobile(raw_phone)
                    norm_phone = norm_p

                customer = None
                is_new_customer = False
                generated_cl_id = None

                if norm_phone:
                    customer = await find_client_by_phone(norm_phone, effective_tenant)
                elif raw_phone and str(raw_phone).startswith("CL-"):
                    customer = await Customer.find_one({"phone": raw_phone.strip(), "tenant_id": effective_tenant, "is_deleted": False})

                if not customer:
                    # Create customer
                    name_parts = client_name.split(" ", 1)
                    first_name = name_parts[0]
                    last_name = name_parts[1] if len(name_parts) > 1 else ""
                    if not norm_phone:
                        generated_cl_id = await generate_client_reference_id(effective_tenant)
                        assigned_phone = generated_cl_id
                    else:
                        assigned_phone = norm_phone

                    customer = Customer(
                        tenant_id=effective_tenant,
                        first_name=first_name,
                        last_name=last_name,
                        full_name=client_name,
                        phone=assigned_phone,
                    )
                    await customer.insert()
                    is_new_customer = True

                # 2. Build items and calculate totals
                invoice_items: List[InvoiceItem] = []
                bill_items: List[BillItem] = []
                service_snapshots: List[ServiceSnapshot] = []
                product_snapshots: List[ProductSnapshot] = []

                subtotal = 0.0
                discount_amount = 0.0
                tax_amount = 0.0

                for r in grp["rows"]:
                    item_type = r.item_type
                    unit_p = r.unit_price
                    qty = r.quantity
                    disc = r.discount
                    tax_r = r.tax_rate
                    staff_id = r.resolved_staff_id
                    staff_name = r.resolved_staff_name

                    line_sub = max(0.0, (unit_p * qty) - disc)
                    line_tax = round(line_sub * (tax_r / 100.0), 2)
                    line_tot = round(line_sub + line_tax, 2)

                    subtotal += unit_p * qty
                    discount_amount += disc
                    tax_amount += line_tax

                    if item_type == "SERVICE":
                        invoice_items.append(InvoiceItem(
                            item_type="SERVICE",
                            item_id=r.item_name or "Service",
                            name=r.item_name or "Service",
                            quantity=1,
                            unit_price=unit_p,
                            tax_rate=tax_r,
                            discount=disc,
                            staff_id=staff_id,
                            staff_name=staff_name,
                        ))
                        bill_items.append(BillItem(
                            item_type="SERVICE",
                            item_id=r.item_name or "Service",
                            name=r.item_name or "Service",
                            quantity=1,
                            unit_price=unit_p,
                            discount=disc,
                            tax_rate=tax_r,
                            tax_amount=line_tax,
                            staff_id=staff_id,
                            staff_name=staff_name,
                            line_total=line_tot,
                        ))
                        service_snapshots.append(ServiceSnapshot(
                            service_id=r.item_name or "Service",
                            name=r.item_name or "Service",
                            price=unit_p,
                            unit_price=unit_p,
                            discount=disc,
                            duration_minutes=30,
                            tax_rate=tax_r,
                            staff_id=staff_id,
                            staff_name=staff_name,
                        ))
                    else:
                        invoice_items.append(InvoiceItem(
                            item_type="PRODUCT",
                            item_id=r.item_name or "Product",
                            name=r.item_name or "Product",
                            quantity=qty,
                            unit_price=unit_p,
                            tax_rate=tax_r,
                            discount=disc,
                            staff_id=staff_id,
                            staff_name=staff_name,
                        ))
                        bill_items.append(BillItem(
                            item_type="PRODUCT",
                            item_id=r.item_name or "Product",
                            name=r.item_name or "Product",
                            quantity=qty,
                            unit_price=unit_p,
                            discount=disc,
                            tax_rate=tax_r,
                            tax_amount=line_tax,
                            staff_id=staff_id,
                            staff_name=staff_name,
                            line_total=line_tot,
                        ))
                        product_snapshots.append(ProductSnapshot(
                            product_id=r.item_name or "Product",
                            name=r.item_name or "Product",
                            price=unit_p,
                            tax_rate=tax_r,
                            quantity=qty,
                            staff_id=staff_id,
                            staff_name=staff_name,
                        ))

                computed_total = round((subtotal - discount_amount) + tax_amount, 2)
                pay_status = grp["payment_status"]
                pay_method = grp["payment_method"]

                if pay_status == "PAID":
                    effective_paid = computed_total
                    remaining = 0.0
                elif pay_status == "PENDING":
                    effective_paid = 0.0
                    remaining = computed_total
                else:  # PARTIALLY_PAID
                    effective_paid = min(float(grp["paid_amount"] or 0.0), computed_total)
                    remaining = round(computed_total - effective_paid, 2)

                bill_dt: datetime = grp["bill_date"]
                hist_date_str = bill_dt.strftime("%Y-%m-%d")

                # 3. Create Appointment
                created_appointment = Appointment(
                    salon_id=salon_id,
                    customer_id=str(customer.id),
                    customer_name=customer.full_name or client_name,
                    customer_phone=customer.phone,
                    appointment_date=hist_date_str,
                    start_datetime=bill_dt,
                    end_datetime=bill_dt,
                    services=service_snapshots,
                    products=product_snapshots,
                    total_price=computed_total,
                    status="COMPLETED",
                    booking_source="BULK_IMPORT",
                    payment_type=pay_method,
                    payment_status=pay_status,
                    paid_amount=effective_paid,
                    notes=f"Bulk imported bill: {ref}",
                )
                await created_appointment.insert()

                # 4. Create Invoice
                inv_num = await self.billing_service._generate_invoice_number(salon_id)
                created_invoice = Invoice(
                    salon_id=salon_id,
                    salon_name=salon.name,
                    salon_phone=salon.phone,
                    customer_id=str(customer.id),
                    customer_name=customer.full_name or client_name,
                    customer_phone=customer.phone,
                    appointment_id=str(created_appointment.id),
                    invoice_number=inv_num,
                    original_bill_reference=ref,
                    import_batch_id=batch_id,
                    status="FINALIZED",
                    payment_status=pay_status,
                    payment_method=pay_method,
                    notes=grp["notes"] or f"Bulk imported bill: {ref}",
                    items=invoice_items,
                    subtotal=round(subtotal, 2),
                    tax_amount=round(tax_amount, 2),
                    discount_amount=round(discount_amount, 2),
                    total_amount=computed_total,
                    paid_amount=round(effective_paid, 2),
                    remaining_amount=round(remaining, 2),
                    finalized_at=bill_dt,
                )
                await created_invoice.insert()

                # 5. Create Bill
                bill_num = await self.bill_service._generate_bill_number(salon_id)
                hist_note = build_payment_history_note("PENDING", pay_status, 1, effective_paid, remaining)
                hist_entry = PaymentHistoryEntry(
                    installment_number=1,
                    amount=round(effective_paid, 2),
                    payment_method=pay_method,
                    status_before="PENDING",
                    status_after=pay_status,
                    paid_amount_after=round(effective_paid, 2),
                    remaining_amount_after=round(remaining, 2),
                    note=hist_note,
                    paid_at=bill_dt,
                )
                created_bill = Bill(
                    salon_id=salon_id,
                    appointment_id=str(created_appointment.id),
                    salon_name=salon.name,
                    salon_phone=salon.phone,
                    customer_id=str(customer.id),
                    customer_name=customer.full_name or client_name,
                    customer_phone=customer.phone,
                    bill_number=bill_num,
                    original_bill_reference=ref,
                    import_batch_id=batch_id,
                    category="APPOINTMENT",
                    items=bill_items,
                    subtotal=round(subtotal, 2),
                    tax_amount=round(tax_amount, 2),
                    discount_amount=round(discount_amount, 2),
                    total_amount=computed_total,
                    paid_amount=round(effective_paid, 2),
                    remaining_amount=round(remaining, 2),
                    payment_status=pay_status,
                    payment_method=pay_method,
                    payment_history=[hist_entry],
                    bill_date=bill_dt,
                )
                await created_bill.insert()

                # 6. Create Payment Record (if paid > 0)
                if effective_paid > 0:
                    created_payment = Payment(
                        invoice_id=str(created_invoice.id),
                        salon_id=salon_id,
                        amount=round(effective_paid, 2),
                        payment_method=pay_method,
                        status="SUCCESSFUL",
                        note=hist_note,
                        installment_number=1,
                        status_after=pay_status,
                        paid_amount_after=round(effective_paid, 2),
                        remaining_amount_after=round(remaining, 2),
                        payment_date=bill_dt,
                    )
                    await created_payment.insert()

                # 7. Inventory safety: Deduct only if explicitly confirmed
                if deduct_inventory:
                    for r in grp["rows"]:
                        if r.item_type == "PRODUCT":
                            try:
                                await self.inventory_service.deduct_sold_product(
                                    salon_id=salon_id,
                                    product_id=r.item_name or "",
                                    brand_id=None,
                                    quantity=r.quantity,
                                    reference_id=str(created_invoice.id),
                                )
                            except Exception as inv_err:
                                logger.warning("Bulk import inventory deduction skipped for item %s: %s", r.item_name, inv_err)

                # 8. Historical Timestamp Preservation via direct motor operations
                # (Guarantees Beanie before_insert hook does not overwrite historical dates)
                inv_col = Invoice.get_motor_collection()
                await inv_col.update_one(
                    {"_id": created_invoice.id},
                    {"$set": {"created_at": bill_dt, "finalized_at": bill_dt}},
                )

                bill_col = Bill.get_motor_collection()
                await bill_col.update_one(
                    {"_id": created_bill.id},
                    {"$set": {"created_at": bill_dt, "bill_date": bill_dt}},
                )

                appt_col = Appointment.get_motor_collection()
                await appt_col.update_one(
                    {"_id": created_appointment.id},
                    {"$set": {"created_at": bill_dt}},
                )

                if created_payment:
                    pay_col = Payment.get_motor_collection()
                    await pay_col.update_one(
                        {"_id": created_payment.id},
                        {"$set": {"created_at": bill_dt, "payment_date": bill_dt}},
                    )

                # 9. Update customer aggregate visit count/spend safely
                cust_col = Customer.get_motor_collection()
                cust_update: Dict[str, Any] = {
                    "$inc": {"total_visits": 1, "total_spent": computed_total}
                }
                if not customer.last_visit_at or bill_dt > customer.last_visit_at:
                    cust_update["$set"] = {"last_visit_at": bill_dt}
                await cust_col.update_one({"_id": customer.id}, cust_update)

                actual_client_id = generated_cl_id or (customer.phone if str(customer.phone).startswith("CL-") else getattr(customer, "client_id", customer.phone))

                # Mark rows as committed and record generated client id info
                for r in grp["rows"]:
                    r.status = "COMMITTED"
                    r.error_category = None
                    r.error_message = None
                    if generated_cl_id:
                        r.client_id_status = "GENERATED"
                        r.client_phone = generated_cl_id
                    elif is_new_customer:
                        r.client_id_status = "CREATED"
                    else:
                        r.client_id_status = "EXISTING"

                    batch.generated_client_ids.append({
                        "excel_row": r.excel_row,
                        "bill_group": r.bill_group or "",
                        "original_ref": r.original_bill_reference,
                        "customer_name": customer.full_name or client_name,
                        "mobile": raw_phone if (raw_phone and not str(raw_phone).startswith("CL-")) else "",
                        "client_id": actual_client_id,
                        "bill_number": bill_num,
                        "invoice_number": inv_num,
                        "customer_status": "GENERATED_CLIENT_ID" if generated_cl_id else ("NEW_CUSTOMER" if is_new_customer else "EXISTING_CUSTOMER"),
                    })

                if generated_cl_id:
                    batch.client_ids_generated_count += 1
                if is_new_customer:
                    batch.customers_created_count += 1

                successful_bills += 1
                total_committed_amount += computed_total

            except Exception as bill_exc:
                logger.error("Failed to commit bulk billing bill %s: %s", ref, bill_exc, exc_info=True)
                failed_bills += 1
                # Roll back / cleanup any partially created documents for this specific bill
                if created_payment:
                    try:
                        await Payment.get_motor_collection().delete_one({"_id": created_payment.id})
                    except Exception:
                        pass
                if created_bill:
                    try:
                        await Bill.get_motor_collection().delete_one({"_id": created_bill.id})
                    except Exception:
                        pass
                if created_invoice:
                    try:
                        await Invoice.get_motor_collection().delete_one({"_id": created_invoice.id})
                    except Exception:
                        pass
                if created_appointment:
                    try:
                        await Appointment.get_motor_collection().delete_one({"_id": created_appointment.id})
                    except Exception:
                        pass

                for r in grp["rows"]:
                    r.status = "FAILED"
                    r.error_category = ERR_DATABASE_FAILURE
                    r.error_message = f"Database save failure: {str(bill_exc)}"
                    r.action_required = "Retry importing this bill."

        # Update final batch status
        batch.successful_bills = successful_bills
        batch.failed_bills = failed_bills + batch.invalid_bills + batch.duplicate_bills
        batch.total_committed_amount = round(total_committed_amount, 2)
        batch.imported_at = now_utc()

        if successful_bills > 0 and batch.failed_bills == 0:
            batch.status = "COMPLETED"
        elif successful_bills > 0 and batch.failed_bills > 0:
            batch.status = "PARTIAL"
        else:
            batch.status = "FAILED"

        await batch.save()
        return batch

    # =========================================================================
    # 5. FAILED RECORDS & SUMMARY EXPORT
    # =========================================================================

    def build_failed_records_xlsx(self, batch: BulkBillingBatch) -> bytes:
        """
        Generates an Excel workbook containing all unsuccessful and duplicate rows.
        Includes original input data + Error Category, Detailed Error, Required Correction.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "Failed Billing Records"
        ws.views.sheetView[0].showGridLines = True

        headers = [
            "Excel Row",
            "File Type",
            "Original Bill Reference",
            "Client Name",
            "Item",
            "Staff Identifier",
            "Price",
            "Status",
            "Error Category",
            "Error Message",
            "Action Required",
            "Import Batch Reference",
        ]
        _apply_excel_header_styles(ws, headers, primary_color="DC2626")

        for r in batch.row_records:
            if r.status in ("FAILED", "DUPLICATE"):
                ws.append([
                    r.excel_row,
                    r.file_type,
                    r.original_bill_reference,
                    r.client_name,
                    r.item_name,
                    r.staff_identifier,
                    r.unit_price,
                    r.status,
                    r.error_category or "VALIDATION_ERROR",
                    r.error_message or "Validation failed",
                    r.action_required or "Correct data in Excel and retry",
                    batch.batch_id,
                ])

        # Style rows
        for row in ws.iter_rows(min_row=2, max_col=len(headers)):
            ws.row_dimensions[row[0].row].height = 20
            for cell in row:
                cell.font = Font(name="Arial", size=10, color="334155")
                cell.alignment = Alignment(vertical="center")

        _auto_fit_columns(ws)
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def build_import_summary_xlsx(self, batch: BulkBillingBatch) -> bytes:
        """
        Generates an Excel summary report of the entire batch import outcome.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "Import Summary"
        ws.views.sheetView[0].showGridLines = True

        headers = [
            "Batch ID",
            "Status",
            "Filenames",
            "Import Type",
            "Total Rows",
            "Total Bills",
            "Successful Bills",
            "Failed Bills",
            "Duplicate Bills",
            "Committed Revenue",
            "Import Date (UTC)",
        ]
        _apply_excel_header_styles(ws, headers, primary_color="1E293B")

        ws.append([
            batch.batch_id,
            batch.status,
            ", ".join(batch.filenames),
            batch.import_type,
            batch.total_rows,
            batch.total_bills,
            batch.successful_bills,
            batch.failed_bills,
            batch.duplicate_bills,
            batch.total_committed_amount,
            batch.imported_at.isoformat() if batch.imported_at else "-",
        ])

        _auto_fit_columns(ws)
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def build_generated_client_ids_xlsx(self, batch: BulkBillingBatch) -> bytes:
        """
        Generates an Excel report of all customers and Client IDs in the imported batch.
        Includes Excel Row, Bill Group, Customer Name, Mobile Number, Client ID, Bill Number, Invoice Number, Status.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "Generated Client IDs"
        ws.views.sheetView[0].showGridLines = True

        headers = [
            "Excel Row",
            "Bill Group",
            "Customer Name",
            "Mobile Number",
            "Client ID",
            "Bill Number",
            "Invoice Number",
            "Customer Status",
        ]
        _apply_excel_header_styles(ws, headers, primary_color="0284C7")

        for item in batch.generated_client_ids:
            ws.append([
                item.get("excel_row"),
                item.get("bill_group") or "-",
                item.get("customer_name"),
                item.get("mobile") or "N/A (Generated ID)",
                item.get("client_id"),
                item.get("bill_number"),
                item.get("invoice_number"),
                item.get("customer_status"),
            ])

        for row in ws.iter_rows(min_row=2, max_col=len(headers)):
            ws.row_dimensions[row[0].row].height = 20
            for cell in row:
                cell.font = Font(name="Arial", size=10, color="334155")
                cell.alignment = Alignment(vertical="center")

        _auto_fit_columns(ws)
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    async def _revalidate_batch(self, batch: BulkBillingBatch, salon_id: str, tenant_id: Optional[str] = None):
        """
        Internal helper to re-validate all row records of a batch in-place.
        Updates validation status, error messages, and batch aggregate statistics.
        """
        salon = await self.resolve_salon(salon_id, tenant_id or batch.tenant_id)
        effective_tenant = tenant_id or (salon.tenant_id if salon else batch.tenant_id)
        salon_tz = getattr(salon, "timezone", "UTC") or "UTC" if salon else "UTC"

        all_staff = await User.find({
            "tenant_id": effective_tenant,
            "is_deleted": False,
            "role": {"$in": ["salon_owner", "salon_admin", "salon_manager", "employee"]},
        }).to_list()
        staff_by_id = {str(u.id): u for u in all_staff}
        staff_by_code = {(u.employee_code or u.employee_id or "").strip().lower(): u for u in all_staff if (u.employee_code or u.employee_id)}
        staff_by_phone = {}
        for u in all_staff:
            if u.phone:
                np, _ = normalize_mobile(u.phone)
                if np:
                    staff_by_phone[np] = u
        staff_by_name = {}
        staff_by_label = {}
        for u in all_staff:
            disp = user_display_name(u).strip()
            code = (u.employee_code or u.employee_id or "").strip()
            phone = (u.phone or "").strip()
            staff_by_name.setdefault(disp.lower(), []).append(u)
            if code:
                staff_by_label[f"{disp} – {code}".lower()] = u
                staff_by_label[f"{disp} - {code}".lower()] = u
                staff_by_label[f"{disp} ({code})".lower()] = u
            elif phone:
                staff_by_label[f"{disp} – {phone[-4:]}".lower()] = u
                staff_by_label[f"{disp} - {phone[-4:]}".lower()] = u
                staff_by_label[f"{disp} ({phone[-4:]})".lower()] = u
            staff_by_label[disp.lower()] = u

        eff_tenant = effective_tenant
        salon_services = await SalonService.find({
            "$or": [{"salon_id": str(salon.id) if salon else salon_id}, {"salon_id": salon_id}, {"tenant_id": eff_tenant}],
            "is_deleted": False,
        }).to_list()
        master_services = await Service.find({
            "$or": [{"tenant_id": eff_tenant}, {"tenant_id": None}],
            "is_deleted": False,
        }).to_list()
        master_svc_by_id = {str(ms.id): ms for ms in master_services}
        svc_name_map = {}
        svc_id_map = {}
        for ss in salon_services:
            svc_id_map[str(ss.id)] = ss
            s_name = (getattr(ss, "custom_service_name", None) or getattr(ss, "name", None) or "").strip()
            if not s_name and getattr(ss, "service_id", None) and str(ss.service_id) in master_svc_by_id:
                s_name = (getattr(master_svc_by_id[str(ss.service_id)], "name", "") or "").strip()
            if s_name:
                svc_name_map[s_name.lower()] = ss
        for ms in master_services:
            svc_id_map[str(ms.id)] = ms
            if ms.name and ms.name.strip().lower() not in svc_name_map:
                svc_name_map[ms.name.strip().lower()] = ms

        salon_products = await SalonProduct.find({
            "$or": [{"salon_id": str(salon.id) if salon else salon_id}, {"salon_id": salon_id}, {"tenant_id": eff_tenant}],
            "is_deleted": False,
            "product_type": "SELLING",
        }).to_list()
        master_products = await Product.find({
            "$or": [{"tenant_id": eff_tenant}, {"tenant_id": None}],
            "is_deleted": False,
        }).to_list()
        master_prod_by_id = {str(mp.id): mp for mp in master_products}
        prod_name_map = {}
        prod_id_map = {}
        for sp in salon_products:
            prod_id_map[str(sp.id)] = sp
            p_name = (getattr(sp, "custom_product_name", None) or getattr(sp, "name", None) or "").strip()
            if not p_name and getattr(sp, "product_id", None) and str(sp.product_id) in master_prod_by_id:
                p_name = (getattr(master_prod_by_id[str(sp.product_id)], "name", "") or "").strip()
            if p_name:
                prod_name_map[p_name.lower()] = sp
        for mp in master_products:
            prod_id_map[str(mp.id)] = mp
            if mp.name and mp.name.strip().lower() not in prod_name_map:
                prod_name_map[mp.name.strip().lower()] = mp

        existing_invoices = await Invoice.find({
            "$or": [{"salon_id": str(salon.id) if salon else salon_id}, {"salon_id": salon_id}, {"tenant_id": eff_tenant}],
            "is_deleted": False,
        }).to_list()
        existing_ref_map = {inv.original_bill_reference: inv.invoice_number for inv in existing_invoices if inv.original_bill_reference}

        bill_groups: Dict[str, Dict[str, Any]] = {}
        for r in batch.row_records:
            ref = (f"GROUP-{r.bill_group}" if r.bill_group else r.original_bill_reference) or f"AUTO-ROW-{r.excel_row}"
            r.original_bill_reference = ref
            err_cat = None
            err_msg = None
            action_req = None

            if not r.client_name:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Client Name is missing."
                action_req = "Enter customer name."
            elif not r.item_name:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = f"{r.item_type.capitalize()} name is missing."
                action_req = f"Enter {r.item_type.lower()}."
            elif not r.staff_identifier:
                err_cat = ERR_MISSING_REQUIRED
                err_msg = "Staff Identifier is missing."
                action_req = "Assign performing stylist or employee."

            # Phone & Client ID status
            client_phone_clean = (r.client_phone or "").strip()
            norm_phone = None
            client_id_status = None
            if client_phone_clean:
                if client_phone_clean.upper().startswith("CL-"):
                    existing_cust = await Customer.find_one({"phone": client_phone_clean.upper(), "tenant_id": effective_tenant, "is_deleted": False})
                    if existing_cust:
                        client_id_status = "EXISTING"
                        norm_phone = client_phone_clean.upper()
                    else:
                        client_id_status = "NOT_FOUND"
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = f"Client ID '{client_phone_clean}' not found in salon records."
                        action_req = "Verify Client ID or leave mobile blank."
                else:
                    norm_p, phone_err = normalize_mobile(client_phone_clean)
                    if phone_err:
                        err_cat = ERR_MISSING_REQUIRED
                        err_msg = f"Invalid mobile number '{client_phone_clean}': {phone_err}."
                        action_req = "Enter a valid 10-digit mobile number or leave blank."
                    else:
                        norm_phone = norm_p
                        existing_cust = await find_client_by_phone(norm_p, effective_tenant)
                        client_id_status = "EXISTING" if existing_cust else "NEW_WITH_PHONE"
            else:
                client_id_status = "WILL_GENERATE"

            r.client_id_status = client_id_status
            r.client_phone = norm_phone or (client_phone_clean if client_phone_clean else None)

            # Date
            utc_dt = None
            if not err_cat and r.bill_date:
                utc_dt, date_err = self._parse_row_date(r.bill_date, None, salon_tz)
                if date_err:
                    err_cat = ERR_INVALID_DATE
                    err_msg = date_err
                    action_req = "Correct date format to YYYY-MM-DD."

            # Catalog
            if not err_cat:
                if r.item_type == "SERVICE":
                    matched_svc = svc_name_map.get((r.item_name or "").strip().lower()) or svc_id_map.get(r.item_name)
                    if not matched_svc:
                        err_cat = ERR_SERVICE_NOT_FOUND
                        err_msg = f"Service '{r.item_name}' not found in salon catalog."
                        action_req = "Verify service name in catalog."
                else:
                    matched_prod = prod_name_map.get((r.item_name or "").strip().lower()) or prod_id_map.get(r.item_name)
                    if not matched_prod:
                        err_cat = ERR_PRODUCT_NOT_FOUND
                        err_msg = f"Product '{r.item_name}' not found in retail catalog."
                        action_req = "Verify product name in catalog."

            # Staff
            resolved_staff = None
            if not err_cat and r.staff_identifier:
                s_ident = r.staff_identifier.strip()
                name_prefix, suffix_code = _extract_staff_parts(s_ident)
                if r.resolved_staff_id and r.resolved_staff_id in staff_by_id:
                    resolved_staff = staff_by_id[r.resolved_staff_id]
                elif suffix_code and suffix_code.lower() in staff_by_code:
                    resolved_staff = staff_by_code[suffix_code.lower()]
                elif s_ident in staff_by_id:
                    resolved_staff = staff_by_id[s_ident]
                elif s_ident.lower() in staff_by_code:
                    resolved_staff = staff_by_code[s_ident.lower()]
                elif s_ident.lower() in staff_by_label:
                    resolved_staff = staff_by_label[s_ident.lower()]
                else:
                    cand = staff_by_name.get((name_prefix or s_ident).lower(), [])
                    if len(cand) == 1:
                        resolved_staff = cand[0]
                    elif len(cand) > 1:
                        err_cat = ERR_AMBIGUOUS_STAFF
                        err_msg = f"Multiple staff members match '{s_ident}'."
                        action_req = "Select correct employee."
                    else:
                        err_cat = ERR_STAFF_NOT_FOUND
                        err_msg = f"Staff '{s_ident}' not found."
                        action_req = "Verify staff name."

            if resolved_staff:
                r.resolved_staff_id = str(resolved_staff.id)
                r.resolved_staff_name = user_display_name(resolved_staff)

            # Duplicate check
            if not err_cat and not ref.startswith("AUTO-ROW-") and ref in existing_ref_map:
                err_cat = ERR_DUPLICATE_BILL
                err_msg = f"Bill reference '{ref}' already exists in salon billing history."
                action_req = "Skip or verify duplicate."

            # Line calculation
            unit_p = max(0.0, float(r.unit_price or 0.0))
            qty = max(1, int(r.quantity or 1))
            disc = max(0.0, float(r.discount or 0.0))
            tax_r = max(0.0, float(r.tax_rate or 0.0))
            line_sub = max(0.0, (unit_p * qty) - disc)
            line_tax = round(line_sub * (tax_r / 100.0), 2)
            r.line_total = round(line_sub + line_tax, 2)

            if err_cat:
                r.status = "DUPLICATE" if err_cat == ERR_DUPLICATE_BILL else "FAILED"
                r.error_category = err_cat
                r.error_message = err_msg
                r.action_required = action_req
            else:
                r.status = "VALID"
                r.error_category = None
                r.error_message = None
                r.action_required = None

            # Add to group
            grp = bill_groups.setdefault(ref, {
                "ref": ref,
                "bill_group": r.bill_group,
                "client_name": r.client_name,
                "client_phone": norm_phone,
                "client_id_status": client_id_status,
                "bill_date": utc_dt,
                "payment_status": r.payment_status,
                "payment_method": r.payment_method,
                "paid_amount": r.paid_amount,
                "rows": [],
                "has_error": False,
                "is_duplicate": False,
                "total": 0.0,
            })
            grp["rows"].append(r)
            grp["total"] += r.line_total
            if err_cat:
                grp["has_error"] = True
                if err_cat == ERR_DUPLICATE_BILL:
                    grp["is_duplicate"] = True

        valid_bills = 0
        invalid_bills = 0
        duplicate_bills = 0
        total_valid_amount = 0.0
        for ref, grp in bill_groups.items():
            if grp["has_error"]:
                if grp["is_duplicate"]:
                    duplicate_bills += 1
                else:
                    invalid_bills += 1
                for r in grp["rows"]:
                    if r.status == "VALID":
                        r.status = "FAILED"
                        r.error_category = ERR_CONFLICTING_BILL
                        r.error_message = f"Bill {ref} contains another row with validation errors."
            else:
                valid_bills += 1
                total_valid_amount += grp["total"]

        batch.total_rows = len(batch.row_records)
        batch.total_bills = len(bill_groups)
        batch.valid_bills = valid_bills
        batch.invalid_bills = invalid_bills
        batch.duplicate_bills = duplicate_bills
        batch.total_valid_amount = round(total_valid_amount, 2)
        batch.client_ids_generated_count = sum(1 for g in bill_groups.values() if not g["has_error"] and not g.get("client_phone"))
        batch.customers_created_count = sum(1 for g in bill_groups.values() if not g["has_error"] and (not g.get("client_phone") or g.get("client_id_status") == "NEW_WITH_PHONE"))

    async def edit_row_record(
        self,
        batch_id: str,
        salon_id: str,
        excel_row: int,
        update_data: Dict[str, Any],
        tenant_id: Optional[str] = None,
    ) -> BulkBillingBatch:
        """
        Edits a specific row in a validated batch during preview.
        Updates user-modified fields, records corrections in raw_data,
        and re-runs validation across batch rows to update counts and totals.
        """
        batch = await BulkBillingBatch.find_one({
            "batch_id": batch_id,
            "$or": [{"salon_id": salon_id}, {"tenant_id": salon_id}],
            "is_deleted": False,
        })
        if not batch:
            raise ValueError(f"Batch '{batch_id}' not found.")
        if batch.status != "VALIDATED":
            raise ValueError(f"Cannot edit batch in '{batch.status}' status. Only VALIDATED batches can be edited.")

        target_row = None
        for r in batch.row_records:
            if r.excel_row == excel_row:
                target_row = r
                break
        if not target_row:
            raise ValueError(f"Row {excel_row} not found in batch {batch_id}.")

        field_map = {
            "client_name": str,
            "client_phone": str,
            "item_name": str,
            "staff_identifier": str,
            "unit_price": float,
            "quantity": int,
            "discount": float,
            "tax_rate": float,
            "payment_status": str,
            "payment_method": str,
            "paid_amount": float,
            "bill_date": str,
            "bill_group": str,
            "notes": str,
        }

        corrections: Dict[str, Any] = {}
        for k, v in update_data.items():
            if k in field_map and v is not None:
                try:
                    casted = field_map[k](v)
                    setattr(target_row, k, casted)
                    corrections[k] = casted
                except (ValueError, TypeError):
                    pass

        if "raw_data" not in target_row.__dict__ or target_row.raw_data is None:
            target_row.raw_data = {}
        target_row.raw_data["edited"] = True
        target_row.raw_data.setdefault("corrections", []).append({
            "timestamp": now_utc().isoformat(),
            "changes": corrections,
        })

        await self._revalidate_batch(batch, salon_id, tenant_id or batch.tenant_id)
        await batch.save()
        return batch


bulk_import_billing_service = BulkImportBillingService()
