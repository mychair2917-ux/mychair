from typing import Any, Dict, List, Optional, Tuple

from app.models.leave_request import LeaveRequest
from app.repositories.base import BaseRepository


class LeaveRepository(BaseRepository[LeaveRequest]):
    def __init__(self) -> None:
        super().__init__(LeaveRequest)

    async def get_by_employee_and_date(
        self, tenant_id: str, employee_id: str, leave_date: str
    ) -> Optional[LeaveRequest]:
        return await LeaveRequest.find_one(
            {
                "tenant_id": tenant_id,
                "employee_id": employee_id,
                "leave_date": leave_date,
                "is_deleted": False,
                "status": {"$ne": "REJECTED"},
            }
        )

    async def list_paginated(
        self,
        filters: Dict[str, Any],
        page: int = 1,
        limit: int = 20,
        sort: Optional[List[str]] = None,
    ) -> Tuple[List[LeaveRequest], int]:
        query = {**filters, "is_deleted": False}
        total = await LeaveRequest.find(query).count()
        cursor = LeaveRequest.find(query)
        if sort:
            for field in sort:
                cursor = cursor.sort(field)
        skip = (page - 1) * limit
        items = await cursor.skip(skip).limit(limit).to_list()
        return items, total
