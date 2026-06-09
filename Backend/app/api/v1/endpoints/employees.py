from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.schemas.employee import (
    EmployeeListItem,
    EmployeeResetPassword,
    SalonEmployeeGroup,
    EmployeeStatusUpdate,
    EmployeeUpdate,
)
from app.services.employee_service import EmployeeService
from app.utils.api_response import error_response, success_response

router = APIRouter()
employee_service = EmployeeService()
logger = logging.getLogger(__name__)


@router.get("")
async def list_employees(
    tenant_id: Optional[str] = Query(default=None, description="Salon tenant id (super_admin)"),
    role: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None, description="ACTIVE or INACTIVE"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(require_module(Module.EMPLOYEES)),
):
    try:
        items = await employee_service.list_employees(
            current_user,
            tenant_id=tenant_id,
            role=role,
            search=search,
            status=status,
            page=page,
            limit=limit,
        )
    except Exception:
        logger.exception("Failed to fetch employees list; returning empty list")
        items = []
    return success_response(
        "Employees fetched successfully",
        data=[item.model_dump(mode="json") for item in (items or []) if item],
    )


@router.get("/by-salon")
async def list_employees_by_salon(
    tenant_id: Optional[str] = Query(default=None, description="Salon tenant id (super_admin)"),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None, description="ACTIVE or INACTIVE"),
    current_user: User = Depends(require_module(Module.EMPLOYEES)),
):
    """
    Returns employees grouped by salon/branch.
    Each group contains `managers` (salon_manager role) and `staff` (employee role).
    """
    try:
        groups = await employee_service.list_employees_by_salon(
            current_user,
            tenant_id=tenant_id,
            search=search,
            status=status,
        )
    except Exception:
        logger.exception("Failed to fetch employees by salon; returning empty list")
        groups = []
    return success_response(
        "Employees by salon fetched successfully",
        data=[g.model_dump(mode="json") for g in (groups or []) if g],
    )




@router.get("/{user_id}")
async def get_employee(
    user_id: str,
    current_user: User = Depends(require_module(Module.EMPLOYEES)),
):
    item = await employee_service.get_employee(current_user, user_id)
    return success_response("Employee retrieved successfully", data=item.model_dump(mode="json"))


@router.patch("/{user_id}")
async def update_employee(
    user_id: str,
    payload: EmployeeUpdate,
    current_user: User = Depends(require_module(Module.EMPLOYEES)),
):
    item = await employee_service.update_employee(current_user, user_id, payload)
    return success_response("Employee updated successfully", data=item.model_dump(mode="json"))


@router.patch("/{user_id}/status")
async def update_employee_status(
    user_id: str,
    payload: EmployeeStatusUpdate,
    current_user: User = Depends(require_module(Module.EMPLOYEES)),
):
    item = await employee_service.set_employee_status(
        current_user, user_id, payload.is_active
    )
    return success_response(
        "Employee status updated successfully", data=item.model_dump(mode="json")
    )


@router.post("/{user_id}/reset-password")
async def reset_employee_password(
    user_id: str,
    payload: EmployeeResetPassword,
    current_user: User = Depends(require_module(Module.EMPLOYEES)),
):
    if payload.password != payload.confirm_password:
        return error_response(
            "Passwords do not match",
            errors={"confirm_password": ["Passwords do not match"]},
            status_code=400,
        )
    data = await employee_service.reset_password(
        current_user,
        user_id,
        payload.password,
        payload.confirm_password,
    )
    return success_response("Password reset successfully", data=data)
