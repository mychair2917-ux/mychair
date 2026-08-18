"""
Derive Appointment List representation rows from appointment line items.

Services and products are expanded independently (never Cartesian-combined):

- Service rows: group by Service By staff. Quantity is null ("-").
- Product rows: group by (product_id + Sold By staff). Quantity is SUM of matching qtys.

The underlying appointment/bill identity is never duplicated in storage.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


UNASSIGNED_STAFF_KEY = "__unassigned__"
ROW_KIND_SERVICE = "service"
ROW_KIND_PRODUCT = "product"


def _normalize_quantity(raw: Any) -> int:
    try:
        qty = int(raw) if raw is not None else 1
    except (TypeError, ValueError):
        qty = 1
    return qty if qty > 0 else 1


def _staff_key(staff_id: Optional[str], fallback_staff_id: Optional[str] = None) -> str:
    cleaned = (staff_id or "").strip()
    if cleaned:
        return cleaned
    fallback = (fallback_staff_id or "").strip()
    if fallback:
        return fallback
    return UNASSIGNED_STAFF_KEY


def _unique_names(names: Iterable[Optional[str]]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for name in names:
        cleaned = (name or "").strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        ordered.append(cleaned)
    return ordered


def _product_identity(product: Dict[str, Any]) -> str:
    """Stable product identity for grouping — prefer IDs over display name."""
    for key in ("product_id", "salon_product_id"):
        value = str(product.get(key) or "").strip()
        if value:
            return value
    return (product.get("name") or "").strip() or "__unknown_product__"


def format_product_display_name(name: str, quantity: Any = 1) -> str:
    """Product column shows the name once; quantity lives in its own column."""
    return (name or "").strip() or "Product"


def _service_identity(service: Dict[str, Any]) -> str:
    """Stable service identity for display dedupe — prefer IDs over name."""
    for key in ("service_id", "salon_service_id"):
        value = str(service.get(key) or "").strip()
        if value:
            return value
    return (service.get("name") or "").strip() or "__unknown_service__"


def _unique_services(services: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Keep each distinct service once (by service_id) for list display.
    Same service performed multiple times by the same staff → one name.
    """
    seen = set()
    ordered: List[Dict[str, Any]] = []
    for service in services:
        key = _service_identity(service)
        if key in seen:
            continue
        seen.add(key)
        ordered.append(service)
    return ordered


def group_services_by_staff(
    services: Sequence[Dict[str, Any]],
    fallback_staff_id: Optional[str] = None,
) -> List[Tuple[str, List[Dict[str, Any]]]]:
    """Group service lines by Service By staff_id (first-seen order)."""
    order: List[str] = []
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    for service in services:
        key = _staff_key(service.get("staff_id"), fallback_staff_id)
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(service)
    return [(key, buckets[key]) for key in order]


def group_products_by_identity_and_staff(
    products: Sequence[Dict[str, Any]],
    fallback_staff_id: Optional[str] = None,
) -> List[Tuple[str, str, Dict[str, Any], int]]:
    """
    Group product lines by (product_id, sold_by staff_id).

    Returns ordered tuples:
      (product_key, staff_key, representative_product, summed_quantity)
    """
    order: List[Tuple[str, str]] = []
    buckets: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for product in products:
        product_key = _product_identity(product)
        staff_key = _staff_key(product.get("staff_id"), fallback_staff_id)
        group_key = (product_key, staff_key)
        qty = _normalize_quantity(product.get("quantity"))

        if group_key not in buckets:
            buckets[group_key] = {
                "product": dict(product),
                "quantity": qty,
            }
            order.append(group_key)
        else:
            buckets[group_key]["quantity"] += qty
            # Prefer a non-empty snapshotted staff_name if later lines have one.
            existing = buckets[group_key]["product"]
            if not (existing.get("staff_name") or "").strip() and (product.get("staff_name") or "").strip():
                existing["staff_name"] = product.get("staff_name")

    result: List[Tuple[str, str, Dict[str, Any], int]] = []
    for product_key, staff_key in order:
        bucket = buckets[(product_key, staff_key)]
        result.append((product_key, staff_key, bucket["product"], int(bucket["quantity"])))
    return result


def _base_row(
    item: Dict[str, Any],
    *,
    bill_reference: str,
    row_id: str,
    row_kind: str,
) -> Dict[str, Any]:
    row = dict(item)
    row["bill_reference"] = bill_reference
    row["row_id"] = row_id
    row["row_kind"] = row_kind
    row["services"] = []
    row["products"] = []
    row["service_by"] = None
    row["sold_by"] = None
    row["quantity"] = None
    return row


def expand_appointment_item_to_list_rows(
    item: Dict[str, Any],
    *,
    bill_reference: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Expand one appointment into service rows + product rows.

    Service rows: Product="-", Quantity="-", Sold By="-"
    Product rows: Service="-", Service By="-", Quantity=summed qty
    """
    services = list(item.get("services") or [])
    products = list(item.get("products") or [])
    fallback_staff_id = item.get("staff_id")
    appointment_id = str(item.get("id") or "")
    reference = (bill_reference or item.get("bill_reference") or "").strip()
    if not reference:
        reference = appointment_id[-8:].upper() if appointment_id else ""

    rows: List[Dict[str, Any]] = []

    # --- Service-only rows (group by Service By staff) ---
    for staff_key, staff_services in group_services_by_staff(
        services, fallback_staff_id=fallback_staff_id
    ):
        service_by_names = _unique_names(s.get("staff_name") for s in staff_services)
        group_staff_name = None
        if staff_services:
            group_staff_name = (staff_services[0].get("staff_name") or "").strip() or None
        if not group_staff_name and staff_key == _staff_key(None, fallback_staff_id):
            group_staff_name = item.get("staff_name")

        row = _base_row(
            item,
            bill_reference=reference,
            row_id=f"{appointment_id}:service:{staff_key}",
            row_kind=ROW_KIND_SERVICE,
        )
        row["services"] = _unique_services(staff_services)
        row["service_by"] = ", ".join(service_by_names) if service_by_names else (
            group_staff_name if group_staff_name else None
        )
        row["quantity"] = None
        if staff_key != UNASSIGNED_STAFF_KEY:
            row["staff_id"] = staff_key
        row["staff_name"] = group_staff_name or row.get("service_by")
        rows.append(row)

    # --- Product-only rows (group by product_id + Sold By staff) ---
    for product_key, staff_key, product, summed_qty in group_products_by_identity_and_staff(
        products, fallback_staff_id=fallback_staff_id
    ):
        sold_by_name = (product.get("staff_name") or "").strip() or None
        if not sold_by_name and staff_key == _staff_key(None, fallback_staff_id):
            sold_by_name = item.get("staff_name")

        product_name = (product.get("name") or "").strip() or "Product"
        aggregated = {
            **product,
            "name": product_name,
            "quantity": summed_qty,
            "display_name": product_name,
        }

        row = _base_row(
            item,
            bill_reference=reference,
            row_id=f"{appointment_id}:product:{product_key}:{staff_key}",
            row_kind=ROW_KIND_PRODUCT,
        )
        row["products"] = [aggregated]
        row["sold_by"] = sold_by_name
        row["quantity"] = summed_qty
        if staff_key != UNASSIGNED_STAFF_KEY:
            row["staff_id"] = staff_key
        row["staff_name"] = sold_by_name
        rows.append(row)

    # Appointments with no line items still yield one empty service-style row for compat.
    if not rows:
        row = _base_row(
            item,
            bill_reference=reference,
            row_id=f"{appointment_id}:empty",
            row_kind=ROW_KIND_SERVICE,
        )
        row["staff_id"] = item.get("staff_id")
        row["staff_name"] = item.get("staff_name")
        rows.append(row)

    return rows


def expand_appointment_items_to_list_rows(
    items: Sequence[Dict[str, Any]],
    bill_reference_by_appointment_id: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    refs = bill_reference_by_appointment_id or {}
    expanded: List[Dict[str, Any]] = []
    for item in items:
        appointment_id = str(item.get("id") or "")
        expanded.extend(
            expand_appointment_item_to_list_rows(
                item,
                bill_reference=refs.get(appointment_id),
            )
        )
    return expanded


def row_matches_search(row: Dict[str, Any], term: str) -> bool:
    needle = (term or "").strip().lower()
    if not needle:
        return True

    haystacks = [
        row.get("customer_name"),
        row.get("customer_phone"),
        row.get("id"),
        row.get("bill_reference"),
        row.get("service_by"),
        row.get("sold_by"),
        row.get("staff_name"),
        row.get("row_kind"),
    ]
    for value in haystacks:
        if value is not None and needle in str(value).lower():
            return True

    digits_needle = re.sub(r"\D", "", needle)
    if len(digits_needle) >= 4:
        cust_phone = str(row.get("customer_phone") or "")
        cust_phone_digits = re.sub(r"\D", "", cust_phone)
        if cust_phone_digits and digits_needle in cust_phone_digits:
            return True

    if row.get("quantity") is not None and needle in str(row.get("quantity")):
        return True

    for service in row.get("services") or []:
        if needle in str(service.get("name") or "").lower():
            return True
    for product in row.get("products") or []:
        if needle in str(product.get("name") or "").lower():
            return True
        if needle in str(product.get("display_name") or "").lower():
            return True
    return False
