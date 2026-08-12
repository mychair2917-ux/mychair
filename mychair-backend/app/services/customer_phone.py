"""
Shared customer (client) phone uniqueness helpers.

All client-creation paths (Quick Add, Customer Analytics create/update,
bulk import) should go through these helpers so duplicate detection and
messaging stay consistent and tenant-scoped.
"""
from __future__ import annotations

import random
import re
import string
from typing import Dict, Iterable, List, Optional, Set

from beanie import PydanticObjectId

from app.models.customer import Customer
from app.utils.phone import normalize_mobile, phone_lookup_variants

BATCH_SIZE = 500


def _generate_candidate_id() -> str:
    chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"CL-{chars}"


async def generate_client_reference_id(tenant_id: Optional[str] = None) -> str:
    """
    Generate a unique, readable alphanumeric client reference ID (format: CL-XXXXXX).
    Checks the database to guarantee uniqueness for the tenant.
    """
    for _ in range(20):
        candidate = _generate_candidate_id()
        query: dict = {"phone": candidate, "is_deleted": False}
        if tenant_id:
            query["tenant_id"] = tenant_id
        existing = await Customer.find_one(query)
        if not existing:
            return candidate
    raise RuntimeError("Failed to generate a unique client ID after 20 attempts")



def customer_display_name(customer: Customer) -> str:
    name = (getattr(customer, "full_name", None) or "").strip()
    if name:
        return name
    first = (customer.first_name or "").strip()
    last = (customer.last_name or "").strip()
    combined = f"{first} {last}".strip()
    return combined or "Unknown"


def duplicate_phone_message(client_name: str) -> str:
    name = (client_name or "").strip() or "Unknown"
    return f"This phone number is already registered to an existing client: {name}."


def duplicate_phone_in_upload_message(phone: str) -> str:
    return (
        f"Phone number {phone} is duplicated in the upload. "
        "First occurrence was imported."
    )


def duplicate_phone_exists_message(phone: str, client_name: str) -> str:
    name = (client_name or "").strip() or "Unknown"
    return f"Phone number {phone} already exists for client {name}."


async def find_client_by_phone(
    phone: str,
    tenant_id: Optional[str],
    *,
    exclude_id: Optional[PydanticObjectId] = None,
) -> Optional[Customer]:
    """
    Find an active client in the tenant with the same normalised phone.
    Does not modify existing records; matches common formatting variants.
    """
    normalized, err = normalize_mobile(phone)
    if err or not normalized:
        # Fall back to stripped raw for edge cases that passed schema min-length
        # but are not fully normalisable — still prevent exact duplicates.
        stripped = (phone or "").strip()
        if not stripped:
            return None
        query: dict = {"phone": stripped, "is_deleted": False}
        if tenant_id:
            query["tenant_id"] = tenant_id
        if exclude_id is not None:
            query["_id"] = {"$ne": exclude_id}
        return await Customer.find_one(query)

    variants = phone_lookup_variants(normalized)
    query = {"phone": {"$in": variants}, "is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}

    existing = await Customer.find_one(query)
    if existing:
        return existing

    # Catch stored values with spaces/dashes that variants miss
    regex_query: dict = {
        "phone": {"$regex": re.escape(normalized)},
        "is_deleted": False,
    }
    if tenant_id:
        regex_query["tenant_id"] = tenant_id
    if exclude_id is not None:
        regex_query["_id"] = {"$ne": exclude_id}

    candidates = await Customer.find(regex_query).limit(25).to_list()
    for doc in candidates:
        stored_norm, stored_err = normalize_mobile(doc.phone)
        if not stored_err and stored_norm == normalized:
            return doc
    return None


async def map_existing_clients_by_phone(
    tenant_id: Optional[str],
    phones: Iterable[str],
) -> Dict[str, Customer]:
    """
    Map normalised phone → existing active Customer for the given tenant.
    Used by bulk import to skip rows that collide with DB clients.
    """
    wanted: Set[str] = {p for p in phones if p}
    if not wanted:
        return {}

    variants: List[str] = []
    for phone in wanted:
        variants.extend(phone_lookup_variants(phone))
    # de-dupe while preserving order-ish
    variant_list = list(dict.fromkeys(variants))

    found: Dict[str, Customer] = {}

    def _consider(doc: Customer) -> None:
        stored_norm, stored_err = normalize_mobile(doc.phone)
        if stored_err or not stored_norm or stored_norm not in wanted:
            return
        if stored_norm not in found:
            found[stored_norm] = doc

    for i in range(0, len(variant_list), BATCH_SIZE):
        chunk = variant_list[i : i + BATCH_SIZE]
        query: dict = {"phone": {"$in": chunk}, "is_deleted": False}
        if tenant_id:
            query["tenant_id"] = tenant_id
        docs = await Customer.find(query).to_list()
        for doc in docs:
            _consider(doc)

    still_missing = wanted - found.keys()
    if still_missing:
        # OR-regex for remaining normalised digits (handles spaced DB values)
        pattern = "|".join(re.escape(p) for p in still_missing)
        regex_query: dict = {
            "phone": {"$regex": pattern},
            "is_deleted": False,
        }
        if tenant_id:
            regex_query["tenant_id"] = tenant_id
        docs = await Customer.find(regex_query).to_list()
        for doc in docs:
            _consider(doc)

    return found
