from typing import Any, Dict, List, Optional, Tuple

from app.models.attendance import Attendance
from app.repositories.base import BaseRepository


class AttendanceRepository(BaseRepository[Attendance]):
    def __init__(self) -> None:
        super().__init__(Attendance)

    async def get_by_employee_and_date(
        self, tenant_id: str, staff_id: str, attendance_date: str
    ) -> Optional[Attendance]:
        return await Attendance.find_one(
            {
                "tenant_id": tenant_id,
                "staff_id": staff_id,
                "date": attendance_date,
                "is_deleted": False,
            }
        )

    async def get_open_session_for_employee(
        self, tenant_id: str, staff_id: str
    ) -> Optional[Attendance]:
        """Find the most recent open attendance session (clock_in set, clock_out not set)."""
        return (
            await Attendance.find(
                {
                    "tenant_id": tenant_id,
                    "staff_id": staff_id,
                    "clock_in": {"$ne": None},
                    "clock_out": None,
                    "is_deleted": False,
                }
            )
            .sort("-clock_in")
            .first_or_none()
        )

    async def list_paginated(
        self,
        filters: Dict[str, Any],
        page: int,
        limit: int,
        sort_field: str = "date",
        sort_order: str = "desc",
    ) -> Tuple[List[Attendance], int]:
        query = Attendance.find({**filters, "is_deleted": False})
        total = await Attendance.find({**filters, "is_deleted": False}).count()
        direction = "-" if sort_order.lower() == "desc" else "+"
        items = (
            await query.sort(f"{direction}{sort_field}")
            .skip((page - 1) * limit)
            .limit(limit)
            .to_list()
        )
        return items, total
