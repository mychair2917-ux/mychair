#!/usr/bin/env python3
"""
Inspect customer phone duplicates per tenant and optionally create a
partial unique index on (tenant_id, phone) for active clients.

Uniqueness is **per tenant** (salon), not global — matching the product model.

This script does NOT delete, merge, or rewrite existing client records.
If exact-string duplicates already exist for a tenant, the unique index is
skipped and those groups are reported so they can be cleaned up manually.

Usage (from mychair-backend, with app env loaded):
  python -m scripts.inspect_customer_phone_duplicates
  python -m scripts.inspect_customer_phone_duplicates --create-index
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

INDEX_NAME = "uniq_tenant_phone_active"


async def _find_exact_duplicates() -> Dict[str, List[Tuple[str, List[dict]]]]:
    """
    Returns tenant_id -> list of (phone, [{id, name}, ...]) for phones with
    more than one active customer sharing the exact same stored phone string.
    """
    from app.models.customer import Customer

    cursor = Customer.find({"is_deleted": False})
    buckets: Dict[Tuple[str, str], List[dict]] = defaultdict(list)

    async for doc in cursor:
        tenant = str(doc.tenant_id or "")
        phone = (doc.phone or "").strip()
        if not phone:
            continue
        buckets[(tenant, phone)].append(
            {
                "id": str(doc.id),
                "name": f"{doc.first_name or ''} {doc.last_name or ''}".strip(),
            }
        )

    by_tenant: Dict[str, List[Tuple[str, List[dict]]]] = defaultdict(list)
    for (tenant, phone), clients in buckets.items():
        if len(clients) > 1:
            by_tenant[tenant].append((phone, clients))
    return by_tenant


async def _create_unique_index_if_safe(duplicates: Dict[str, Any]) -> None:
    from pymongo import ASCENDING
    from pymongo.errors import DuplicateKeyError, OperationFailure

    from app.models.customer import Customer

    if duplicates:
        total_groups = sum(len(groups) for groups in duplicates.values())
        print(
            f"Skipping unique index: found {total_groups} exact duplicate phone "
            "group(s) across tenants. Resolve manually, then re-run with --create-index."
        )
        return

    collection = Customer.get_motor_collection()
    try:
        await collection.create_index(
            [("tenant_id", ASCENDING), ("phone", ASCENDING)],
            name=INDEX_NAME,
            unique=True,
            partialFilterExpression={"is_deleted": False},
        )
        print(f"Created partial unique index '{INDEX_NAME}' on (tenant_id, phone) where is_deleted=false.")
    except DuplicateKeyError:
        print("Unique index creation failed: duplicate keys still present.")
    except OperationFailure as exc:
        # Index may already exist with same options
        if getattr(exc, "code", None) == 85 or "already exists" in str(exc).lower():
            print(f"Index '{INDEX_NAME}' already exists (or equivalent).")
        else:
            raise


async def run(create_index: bool) -> None:
    from app.db.connection import init_db

    await init_db()
    duplicates = await _find_exact_duplicates()

    if not duplicates:
        print("No exact-string duplicate phones found among active clients.")
    else:
        print("Existing exact-string duplicate phones (active clients only):")
        for tenant, groups in sorted(duplicates.items()):
            print(f"  tenant={tenant or '(none)'}:")
            for phone, clients in groups:
                names = ", ".join(f"{c['name']} ({c['id']})" for c in clients)
                print(f"    phone={phone}: {names}")
        print(
            "\nExisting records were left unchanged. New creates are still blocked "
            "by application-level validation."
        )

    if create_index:
        await _create_unique_index_if_safe(duplicates)
    else:
        print("\nRe-run with --create-index to add the DB unique constraint when safe.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--create-index",
        action="store_true",
        help="Create partial unique index when no exact duplicates exist.",
    )
    args = parser.parse_args()
    asyncio.run(run(create_index=args.create_index))
