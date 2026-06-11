import asyncio
from app.db.connection import init_db
from app.models.appointment import Appointment
from app.repositories.appointment import AppointmentRepository

async def main():
    await init_db()
    repo = AppointmentRepository()
    
    # 1. Fetch raw documents
    db_appts = await Appointment.find({"salon_id": "6a14a33393e166f058cc6eda"}).sort("-created_at").limit(5).to_list()
    print("=== RAW DB LATEST APPOINTMENTS ===")
    for a in db_appts:
        print(f"ID: {a.id}, CreatedAt: {a.created_at}, Start: {a.start_datetime}, Status: {a.status}, Deleted: {a.is_deleted}, Tenant: {a.tenant_id}")

    # 2. Fetch using list_paginated
    items, total = await repo.list_paginated(
        salon_id="6a14a33393e166f058cc6eda",
        page=1,
        limit=10,
        sort_by="start_datetime",
        sort_order="desc"
    )
    print("\n=== REPO LIST_PAGINATED (SORT BY start_datetime DESC) ===")
    print(f"Total count: {total}")
    for a in items:
        print(f"ID: {a.id}, CreatedAt: {a.created_at}, Start: {a.start_datetime}, Status: {a.status}")

    # 3. Fetch sorted by created_at desc
    items_created, total_created = await repo.list_paginated(
        salon_id="6a14a33393e166f058cc6eda",
        page=1,
        limit=10,
        sort_by="created_at",
        sort_order="desc"
    )
    print("\n=== REPO LIST_PAGINATED (SORT BY created_at DESC) ===")
    print(f"Total count: {total_created}")
    for a in items_created:
        print(f"ID: {a.id}, CreatedAt: {a.created_at}, Start: {a.start_datetime}, Status: {a.status}")

if __name__ == "__main__":
    asyncio.run(main())
