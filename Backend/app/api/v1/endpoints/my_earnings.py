from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies.auth import get_current_user
from app.models.user import User
from app.services.my_earnings import MyEarningsService
from app.utils.api_response import success_response

router = APIRouter()
my_earnings_service = MyEarningsService()



async def _resolve_target_user(current_user: User, employee_id: Optional[str]) -> User:
    if not employee_id:
        return current_user
    from app.models.user import User as UserModel
    from beanie import PydanticObjectId
    from app.auth.rbac_config import (
        ROLE_SUPER_ADMIN,
        ROLE_SALON_OWNER,
        ROLE_SALON_ADMIN,
        ROLE_SALON_MANAGER,
        normalize_role,
    )
    try:
        target_user = await UserModel.get(PydanticObjectId(employee_id))
    except Exception:
        target_user = None
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found")

    actor_role = normalize_role(current_user.role)
    is_authorized = False
    if actor_role == ROLE_SUPER_ADMIN:
        is_authorized = True
    elif actor_role in (ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER):
        if target_user.tenant_id == current_user.tenant_id:
            is_authorized = True
    elif str(target_user.id) == str(current_user.id):
        is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to view this employee's earnings")
    return target_user


@router.get("/summary")
async def get_my_earnings_summary(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=3000),
    period: Optional[str] = Query(default="monthly"),
    start_date: Optional[str] = Query(default=None, alias="startDate"),
    end_date: Optional[str] = Query(default=None, alias="endDate"),
    employee_id: Optional[str] = Query(default=None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
):
    target_user = await _resolve_target_user(current_user, employee_id)
    data = await my_earnings_service.get_summary(
        target_user,
        month=month,
        year=year,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    return success_response("My earnings summary fetched successfully", data=data.model_dump(mode="json"))


@router.get("/daily")
async def list_my_daily_earnings(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=3000),
    period: Optional[str] = Query(default="monthly"),
    start_date: Optional[str] = Query(default=None, alias="startDate"),
    end_date: Optional[str] = Query(default=None, alias="endDate"),
    employee_id: Optional[str] = Query(default=None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
):
    target_user = await _resolve_target_user(current_user, employee_id)
    rows = await my_earnings_service.list_daily_earnings(
        target_user,
        month=month,
        year=year,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    return success_response(
        "My daily earnings fetched successfully",
        data=[row.model_dump(mode="json") for row in rows],
    )


@router.get("/wallet")
async def get_my_wallet(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=3000),
    period: Optional[str] = Query(default="monthly"),
    start_date: Optional[str] = Query(default=None, alias="startDate"),
    end_date: Optional[str] = Query(default=None, alias="endDate"),
    employee_id: Optional[str] = Query(default=None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
):
    target_user = await _resolve_target_user(current_user, employee_id)
    data = await my_earnings_service.get_wallet(
        target_user,
        month=month,
        year=year,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    return success_response("My incentive wallet fetched successfully", data=data.model_dump(mode="json"))


@router.get("/salary-history")
async def list_my_salary_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=100),
    employee_id: Optional[str] = Query(default=None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
):
    target_user = await _resolve_target_user(current_user, employee_id)
    data = await my_earnings_service.list_salary_history(target_user, page=page, limit=limit)
    return success_response("My salary history fetched successfully", data=data.model_dump(mode="json"))


@router.get("/salary-history/{payroll_id}/slip")
async def get_my_salary_slip(
    payroll_id: str,
    employee_id: Optional[str] = Query(default=None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
):
    target_user = await _resolve_target_user(current_user, employee_id)
    try:
        data = await my_earnings_service.get_salary_slip(target_user, payroll_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response("My salary slip fetched successfully", data=data)


@router.get("/breakdown")
async def get_my_incentive_breakdown(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=3000),
    period: Optional[str] = Query(default="monthly"),
    start_date: Optional[str] = Query(default=None, alias="startDate"),
    end_date: Optional[str] = Query(default=None, alias="endDate"),
    employee_id: Optional[str] = Query(default=None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
):
    target_user = await _resolve_target_user(current_user, employee_id)
    data = await my_earnings_service.get_incentive_breakdown(
        target_user,
        month=month,
        year=year,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    return success_response(
        "My incentive breakdown fetched successfully", data=data.model_dump(mode="json")
    )


@router.get("/activity")
async def list_my_recent_activity(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=3000),
    period: Optional[str] = Query(default="monthly"),
    start_date: Optional[str] = Query(default=None, alias="startDate"),
    end_date: Optional[str] = Query(default=None, alias="endDate"),
    limit: int = Query(default=12, ge=1, le=50),
    employee_id: Optional[str] = Query(default=None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
):
    target_user = await _resolve_target_user(current_user, employee_id)
    rows = await my_earnings_service.list_recent_activity(
        target_user,
        month=month,
        year=year,
        period=period,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )
    return success_response(
        "My recent earnings activity fetched successfully",
        data=[row.model_dump(mode="json") for row in rows],
    )
