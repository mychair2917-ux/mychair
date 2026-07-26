#!/usr/bin/env python3
"""
Backfill client membership + salon service member pricing fields.

MongoDB / Beanie has no SQL migration runner. New Document fields use defaults:
  Customer.is_member      → False
  SalonService.member_price → None

This script explicitly sets those defaults on existing documents for clarity
and index/query consistency. Safe to re-run (idempotent).

Usage (from mychair-backend, with app env loaded):
  python -m scripts.migrate_member_pricing
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow running as `python scripts/migrate_member_pricing.py`
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


async def run() -> None:
    from app.db.connection import init_db
    from app.models.customer import Customer
    from app.models.salon_service import SalonService

    await init_db()

    customers_updated = await Customer.get_motor_collection().update_many(
        {"is_member": {"$exists": False}},
        {"$set": {"is_member": False}},
    )
    services_updated = await SalonService.get_motor_collection().update_many(
        {"member_price": {"$exists": False}},
        {"$set": {"member_price": None}},
    )

    print(
        "Member pricing backfill complete:",
        f"customers.is_member set on {customers_updated.modified_count} docs,",
        f"salon_services.member_price set on {services_updated.modified_count} docs.",
    )


if __name__ == "__main__":
    asyncio.run(run())
