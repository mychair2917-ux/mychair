import logging
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import PermissionChecker
from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.schemas.leave import LeaveApplyRequest, LeaveRejectRequest
from app.services.leave import LeaveService
from app.services.notifications import notification_service
from app.utils.api_response import success_response

router = APIRouter()
leave_service = LeaveService()
logger = logging.getLogger(__name__)


@router.post("/apply")
async def apply_leave(
    payload: LeaveApplyRequest,
    current_user: User = Depends(PermissionChecker("leave.create")),
):
    item = await leave_service.apply_leave(
        current_user, payload.leave_date, payload.leave_reason
    )
    recipients = await notification_service._tenant_users_for_roles(
        current_user.tenant_id,
        item.salon_id,
        ["salon_owner", "salon_admin", "salon_manager"],
    )
    await notification_service.create_event_notifications(
        tenant_id=current_user.tenant_id,
        salon_id=item.salon_id,
        recipients=recipients,
        title="Leave request submitted",
        body=f"{item.employee_name} submitted a leave request for {item.leave_date}.",
        category="LEAVE",
        notification_type="LEAVE_REQUEST_SUBMITTED",
        priority="HIGH",
        source_event="LEAVE_REQUEST_SUBMITTED",
        metadata={"leave_id": item.id, "employee_id": item.employee_id},
    )
    return success_response(
        "Leave request submitted successfully",
        data=item.model_dump(mode="json"),
    )


@router.get("/pending")
async def list_pending_leave(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("leave.approve")),
):
    data = await leave_service.list_pending(
        current_user,
        page=page,
        limit=limit,
        search=search,
        salon_id=salon_id,
    )
    return success_response(
        "Pending leave requests fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.get("")
async def list_leave_requests(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    employee_id: Optional[str] = Query(default=None),
    salon_id: Optional[str] = Query(default=None),
    scope: str = Query(default="my", description="my | team | salon | all"),
    history_only: bool = Query(default=False),
    current_user: User = Depends(require_module(Module.LEAVE)),
):
    data = await leave_service.list_leave_requests(
        current_user,
        page=page,
        limit=limit,
        search=search,
        status=status,
        date_from=date_from,
        date_to=date_to,
        employee_id=employee_id,
        salon_id=salon_id,
        scope=scope,
        history_only=history_only,
    )
    return success_response(
        "Leave requests fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.patch("/{leave_id}/approve")
async def approve_leave(
    leave_id: str,
    current_user: User = Depends(PermissionChecker("leave.approve")),
):
    item = await leave_service.approve_leave(current_user, leave_id)
    requester = await User.find_one({"_id": PydanticObjectId(item.employee_id), "is_deleted": False})
    if requester:
        await notification_service.create_event_notifications(
            tenant_id=current_user.tenant_id,
            salon_id=item.salon_id,
            recipients=[requester],
            title="Leave approved",
            body=f"Your leave request for {item.leave_date} was approved.",
            category="LEAVE",
            notification_type="LEAVE_APPROVED",
            priority="HIGH",
            source_event="LEAVE_APPROVED",
            metadata={"leave_id": item.id},
        )
    return success_response(
        "Leave request approved successfully",
        data=item.model_dump(mode="json"),
    )


@router.patch("/{leave_id}/reject")
async def reject_leave(
    leave_id: str,
    payload: LeaveRejectRequest,
    current_user: User = Depends(PermissionChecker("leave.approve")),
):
    item = await leave_service.reject_leave(
        current_user, leave_id, payload.rejection_reason
    )
    requester = await User.find_one({"_id": PydanticObjectId(item.employee_id), "is_deleted": False})
    if requester:
        await notification_service.create_event_notifications(
            tenant_id=current_user.tenant_id,
            salon_id=item.salon_id,
            recipients=[requester],
            title="Leave rejected",
            body=f"Your leave request for {item.leave_date} was rejected.",
            category="LEAVE",
            notification_type="LEAVE_REJECTED",
            priority="HIGH",
            source_event="LEAVE_REJECTED",
            metadata={"leave_id": item.id},
        )
    return success_response(
        "Leave request rejected successfully",
        data=item.model_dump(mode="json"),
    )
