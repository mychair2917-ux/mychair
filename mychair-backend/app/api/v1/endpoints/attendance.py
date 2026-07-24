import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import PermissionChecker
from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.schemas.attendance import (
    BranchLocationUpdate,
    CheckInRequest,
    CheckOutRequest,
    ManualAttendanceUpdate,
)
from app.services.attendance import AttendanceService
from app.utils.api_response import success_response

router = APIRouter()
attendance_service = AttendanceService()
logger = logging.getLogger(__name__)


@router.get("/today-status")
async def get_today_status(
    current_user: User = Depends(require_module(Module.ATTENDANCE)),
):
    data = await attendance_service.get_today_status(current_user)
    return success_response(
        "Today's attendance status fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.post("/check-in")
async def check_in(
    payload: CheckInRequest,
    current_user: User = Depends(PermissionChecker("attendance.create")),
):
    item = await attendance_service.check_in(
        current_user, payload.latitude, payload.longitude
    )
    return success_response(
        "Checked in successfully",
        data=item.model_dump(mode="json"),
    )


@router.post("/check-out")
async def check_out(
    payload: CheckOutRequest,
    current_user: User = Depends(PermissionChecker("attendance.create")),
):
    try:
        item = await attendance_service.check_out(
            current_user, payload.latitude, payload.longitude
        )
        return success_response(
            "Checked out successfully",
            data=item.model_dump(mode="json"),
        )
    except Exception as exc:
        logger.exception("Checkout endpoint error for user %s", current_user.id)
        raise exc


@router.get("/summary")
async def get_attendance_summary(
    employee_id: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    branch_id: Optional[str] = Query(default=None),
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_module(Module.ATTENDANCE)),
):
    data = await attendance_service.get_attendance_summary(
        current_user,
        employee_id=employee_id,
        date_from=date_from,
        date_to=date_to,
        branch_id=branch_id,
        salon_id=salon_id,
    )
    return success_response(
        "Attendance summary fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.get("/my")
async def list_my_attendance(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    employee_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_module(Module.ATTENDANCE)),
):
    data = await attendance_service.list_my_attendance(
        current_user,
        page=page,
        limit=limit,
        search=search,
        date_from=date_from,
        date_to=date_to,
        employee_id=employee_id,
    )
    return success_response(
        "Attendance records fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.get("/branch")
async def list_branch_attendance(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    branch_id: Optional[str] = Query(default=None),
    employee_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("attendance.view")),
):
    data = await attendance_service.list_branch_attendance(
        current_user,
        page=page,
        limit=limit,
        search=search,
        date_from=date_from,
        date_to=date_to,
        branch_id=branch_id,
        employee_id=employee_id,
    )
    return success_response(
        "Branch attendance records fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.get("/all")
async def list_all_attendance(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    salon_id: Optional[str] = Query(default=None),
    employee_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("attendance.view")),
):
    data = await attendance_service.list_all_attendance(
        current_user,
        page=page,
        limit=limit,
        search=search,
        date_from=date_from,
        date_to=date_to,
        salon_id=salon_id,
        employee_id=employee_id,
    )
    return success_response(
        "All attendance records fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.patch("/manual-update")
async def manual_update_attendance(
    payload: ManualAttendanceUpdate,
    current_user: User = Depends(PermissionChecker("attendance.manage")),
):
    item = await attendance_service.manual_update(current_user, payload)
    return success_response(
        "Attendance updated successfully",
        data=item.model_dump(mode="json"),
    )


@router.get("/branch-location")
async def get_branch_location(
    current_user: User = Depends(require_module(Module.ATTENDANCE)),
):
    data = await attendance_service.get_branch_location(current_user)
    return success_response(
        "Branch location fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.patch("/branch-location")
async def update_branch_location(
    payload: BranchLocationUpdate,
    current_user: User = Depends(PermissionChecker("salon.manage")),
):
    data = await attendance_service.update_branch_location(current_user, payload)
    return success_response(
        "Branch location updated successfully",
        data=data.model_dump(mode="json"),
    )
