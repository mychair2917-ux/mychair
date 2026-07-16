import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.constants.payroll_options import SALARY_TYPES
from app.models.user import User
from app.schemas.payroll import (
    GeneratePayrollRequest,
    SalaryStructureUpdate,
)
from app.services.payroll import PayrollService
from app.utils.api_response import success_response

router = APIRouter()
payroll_service = PayrollService()
logger = logging.getLogger(__name__)


@router.get("/salary-types")
async def get_salary_types(
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    """Lookup values for salary type dropdowns."""
    return success_response("Salary types fetched successfully", data=SALARY_TYPES)


# --------------------------------------------------------------------------- #
# Tab 1 — Salary Structure
# --------------------------------------------------------------------------- #
@router.get("/salary-structure")
async def list_salary_structure(
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    items = await payroll_service.list_salary_structure(current_user)
    return success_response(
        "Salary structure fetched successfully",
        data=[item.model_dump(mode="json") for item in items],
    )


@router.patch("/salary-structure/{employee_id}")
async def update_salary_structure(
    employee_id: str,
    payload: SalaryStructureUpdate,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    item = await payroll_service.update_salary_structure(
        current_user, employee_id, payload
    )
    return success_response(
        "Salary structure updated successfully", data=item.model_dump(mode="json")
    )


# --------------------------------------------------------------------------- #
# Tab 3 — Salary History (declared before /{payroll_id} dynamic routes)
# --------------------------------------------------------------------------- #
@router.get("/history")
async def list_salary_history(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=3000),
    employee_id: Optional[str] = Query(default=None),
    payment_status: Optional[str] = Query(default=None, description="PENDING or PAID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="year"),
    sort_order: str = Query(default="desc", description="asc or desc"),
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    data = await payroll_service.list_history(
        current_user,
        month=month,
        year=year,
        employee_id=employee_id,
        payment_status=payment_status,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return success_response("Salary history fetched successfully", data=data)


@router.get("/history/{employee_id}")
async def list_salary_history_by_employee(
    employee_id: str,
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=3000),
    payment_status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="year"),
    sort_order: str = Query(default="desc"),
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    data = await payroll_service.list_history(
        current_user,
        month=month,
        year=year,
        employee_id=employee_id,
        payment_status=payment_status,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return success_response("Salary history fetched successfully", data=data)


# --------------------------------------------------------------------------- #
# Tab 2 — Monthly Salary
# --------------------------------------------------------------------------- #
@router.post("/generate")
async def generate_payroll(
    payload: GeneratePayrollRequest,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    items = await payroll_service.generate_payroll(
        current_user, payload.month, payload.year
    )
    return success_response(
        "Payroll generated successfully",
        data=[item.model_dump(mode="json") for item in items],
        status_code=201,
    )


@router.get("")
async def list_monthly_payroll(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=3000),
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    items = await payroll_service.list_payroll(current_user, month, year)
    return success_response(
        "Payroll fetched successfully",
        data=[item.model_dump(mode="json") for item in items],
    )


@router.patch("/{payroll_id}/pay")
async def mark_payroll_paid(
    payroll_id: str,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    item = await payroll_service.mark_paid(current_user, payroll_id)
    return success_response(
        "Payroll marked as paid", data=item.model_dump(mode="json")
    )


@router.get("/{payroll_id}/slip")
async def get_salary_slip(
    payroll_id: str,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    data = await payroll_service.get_salary_slip(current_user, payroll_id)
    return success_response("Salary slip fetched successfully", data=data)


@router.get("/{payroll_id}")
async def get_payroll_breakdown(
    payroll_id: str,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    breakdown = await payroll_service.get_breakdown(current_user, payroll_id)
    return success_response(
        "Payroll breakdown fetched successfully",
        data=breakdown.model_dump(mode="json"),
    )
