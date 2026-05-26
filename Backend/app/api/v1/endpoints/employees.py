from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.schemas.employee import (
    EmployeeListItem,
    EmployeeResetPassword,
    EmployeeStatusUpdate,
    EmployeeUpdate,
)
from app.services.employee_service import EmployeeService
from app.utils.api_response import error_response, success_response

router = APIRouter()
employee_service = EmployeeService()


@router.get("")
async def list_employees(
    tenant_id: Optional[str] = Query(default=None, description="Salon tenant id (super_admin)"),
    role: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None, description="ACTIVE or INACTIVE"),
    current_user: User = Depends(require_module(Module.EMPLOYEES)),
):
    items = await employee_service.list_employees(
        current_user,
        tenant_id=tenant_id,
        role=role,
        search=search,
        status=status,
    )
    return success_response(
        "Employees retrieved successfully",
        data=[item.model_dump(mode="json") for item in items],
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
