from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse

from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.constants.expense_options import EXPENSE_CATEGORIES, PAYMENT_MODES
from app.core.exceptions import ResourceNotFoundException
from app.models.user import User
from app.schemas.expense import ExpenseCreateRequest, ExpenseUpdateRequest
from app.services.expense import ExpenseService
from app.utils.api_response import success_response

router = APIRouter()
expense_service = ExpenseService()


@router.get("/categories")
async def get_expense_categories(
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    return success_response(
        "Expense categories fetched successfully",
        data=EXPENSE_CATEGORIES,
    )


@router.get("/payment-modes")
async def get_payment_modes(
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    return success_response(
        "Payment modes fetched successfully",
        data=PAYMENT_MODES,
    )


@router.get("")
async def list_expenses(
    salon_id: str = Query(..., description="Salon branch ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="expense_date"),
    sort_order: str = Query(default="desc", description="asc or desc"),
    category: Optional[str] = Query(default=None),
    payment_mode: Optional[str] = Query(default=None),
    branch_id: Optional[str] = Query(default=None),
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    data = await expense_service.list_expenses(
        current_user,
        salon_id=salon_id,
        page=page,
        limit=limit,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        category=category,
        payment_mode=payment_mode,
        branch_id=branch_id,
    )
    return success_response(
        "Expenses fetched successfully",
        data=data.model_dump(mode="json"),
    )


@router.get("/receipt-files/{file_name}")
async def get_receipt_file(file_name: str):
    file_path = ExpenseService.receipt_file_path(file_name)
    if not file_path.exists() or not file_path.is_file():
        raise ResourceNotFoundException(detail="Receipt file not found")
    media_type = ExpenseService.receipt_media_type(file_name)
    return FileResponse(Path(file_path), media_type=media_type)


@router.get("/{expense_id}")
async def get_expense(
    expense_id: str,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    item = await expense_service.get_expense(current_user, expense_id)
    return success_response(
        "Expense fetched successfully",
        data=item.model_dump(mode="json"),
    )


@router.post("")
async def create_expense(
    payload: ExpenseCreateRequest,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    item = await expense_service.create_expense(current_user, payload)
    return success_response(
        "Expense created successfully",
        data=item.model_dump(mode="json"),
    )


@router.put("/{expense_id}")
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdateRequest,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    item = await expense_service.update_expense(current_user, expense_id, payload)
    return success_response(
        "Expense updated successfully",
        data=item.model_dump(mode="json"),
    )


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: str,
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    await expense_service.delete_expense(current_user, expense_id)
    return success_response("Expense deleted successfully", data={"deleted": True})


@router.post("/{expense_id}/receipt")
async def upload_expense_receipt(
    expense_id: str,
    receipt: UploadFile = File(...),
    current_user: User = Depends(require_module(Module.BILLING_FINANCE)),
):
    item = await expense_service.upload_receipt(current_user, expense_id, receipt)
    return success_response(
        "Receipt uploaded successfully",
        data=item.model_dump(mode="json"),
    )
