"""
Bulk Billing Upload API Endpoints.

Provides endpoints for downloading templates, validating Excel uploads,
confirming batch imports, viewing batch history, and exporting failed records.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import PermissionChecker
from app.core import tenant_context
from app.models.bulk_billing import BulkBillingBatch
from app.models.salon import Salon
from app.models.user import User
from app.services.bulk_billing_import import bulk_import_billing_service
from app.utils.api_response import success_response
from beanie import PydanticObjectId

router = APIRouter()


class ConfirmBulkImportRequest(BaseModel):
    batch_id: str
    salon_id: str
    staff_mappings: Optional[Dict[str, str]] = Field(default_factory=dict)
    deduct_inventory: bool = False


class EditBulkRowRequest(BaseModel):
    salon_id: str
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    item_name: Optional[str] = None
    staff_identifier: Optional[str] = None
    unit_price: Optional[float] = None
    quantity: Optional[int] = None
    discount: Optional[float] = None
    tax_rate: Optional[float] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    paid_amount: Optional[float] = None
    bill_date: Optional[str] = None
    bill_group: Optional[str] = None
    notes: Optional[str] = None


# =============================================================================
# 1. DOWNLOAD TEMPLATES
# =============================================================================

@router.get("/bulk-upload/templates/service")
async def download_service_template(
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Downloads the official MyChair Service Billing Excel template (.xlsx) with dynamic salon catalog."""
    active_tenant = tenant_context.get_tenant_id()
    tenant_to_use = active_tenant if active_tenant != "system" else None

    if salon_id:
        salon = await bulk_import_billing_service.resolve_salon(salon_id, tenant_to_use)
        if not salon:
            raise HTTPException(status_code=404, detail="Salon not found.")
        if active_tenant and active_tenant != "system" and salon.tenant_id != active_tenant:
            raise HTTPException(status_code=403, detail="Unauthorized access to salon.")
        tenant_to_use = salon.tenant_id

    xlsx_bytes = await bulk_import_billing_service.build_service_billing_template(
        salon_id=salon_id,
        tenant_id=tenant_to_use,
    )
    filename = "MyChair_Service_Billing_Template.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bulk-upload/templates/product")
async def download_product_template(
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Downloads the official MyChair Product Billing Excel template (.xlsx) with dynamic salon catalog."""
    active_tenant = tenant_context.get_tenant_id()
    tenant_to_use = active_tenant if active_tenant != "system" else None

    if salon_id:
        salon = await bulk_import_billing_service.resolve_salon(salon_id, tenant_to_use)
        if not salon:
            raise HTTPException(status_code=404, detail="Salon not found.")
        if active_tenant and active_tenant != "system" and salon.tenant_id != active_tenant:
            raise HTTPException(status_code=403, detail="Unauthorized access to salon.")
        tenant_to_use = salon.tenant_id

    xlsx_bytes = await bulk_import_billing_service.build_product_billing_template(
        salon_id=salon_id,
        tenant_id=tenant_to_use,
    )
    filename = "MyChair_Product_Billing_Template.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================================
# 2. VALIDATE FILES (DRY RUN)
# =============================================================================

@router.post("/bulk-upload/validate")
async def validate_bulk_billing(
    salon_id: str = Form(...),
    service_file: Optional[UploadFile] = File(default=None),
    product_file: Optional[UploadFile] = File(default=None),
    staff_mappings: Optional[str] = Form(default=None),
    deduct_inventory: bool = Form(default=False),
    current_user: User = Depends(PermissionChecker("billing.create")),
):
    """
    Validates uploaded service and/or product Excel billing files in dry-run mode.
    Does NOT write records to billing collections.
    Returns structured preview and row-level validation results.
    """
    if not service_file and not product_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload at least one billing Excel file (Service or Product).",
        )

    # Tenant verification
    active_tenant = tenant_context.get_tenant_id()
    tenant_to_check = active_tenant if active_tenant != "system" else None
    salon = await bulk_import_billing_service.resolve_salon(salon_id, tenant_to_check)
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    if active_tenant and active_tenant != "system" and salon.tenant_id != active_tenant:
        raise HTTPException(status_code=403, detail="Unauthorized access to salon.")

    # Parse staff mappings if passed as JSON string
    parsed_staff_mappings: Dict[str, str] = {}
    if staff_mappings and staff_mappings.strip():
        try:
            parsed_staff_mappings = json.loads(staff_mappings)
        except Exception:
            parsed_staff_mappings = {}

    service_content = None
    service_filename = None
    if service_file:
        service_content = await service_file.read()
        service_filename = service_file.filename

    product_content = None
    product_filename = None
    if product_file:
        product_content = await product_file.read()
        product_filename = product_file.filename

    try:
        batch = await bulk_import_billing_service.validate_import(
            salon_id=salon_id,
            service_content=service_content,
            product_content=product_content,
            service_filename=service_filename,
            product_filename=product_filename,
            user_staff_mappings=parsed_staff_mappings,
            deduct_inventory=deduct_inventory,
            tenant_id=active_tenant or salon.tenant_id,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Validation failed: {str(exc)}")

    return success_response(
        "Bulk billing validation completed successfully",
        data={
            "batch_id": batch.batch_id,
            "status": batch.status,
            "import_type": batch.import_type,
            "filenames": batch.filenames,
            "deduct_inventory": batch.deduct_inventory,
            "total_rows": batch.total_rows,
            "total_bills": batch.total_bills,
            "valid_bills": batch.valid_bills,
            "invalid_bills": batch.invalid_bills,
            "duplicate_bills": batch.duplicate_bills,
            "total_valid_amount": batch.total_valid_amount,
            "client_ids_generated_count": batch.client_ids_generated_count,
            "customers_created_count": batch.customers_created_count,
            "ambiguous_staff": batch.ambiguous_staff,
            "row_records": [r.model_dump() for r in batch.row_records],
        },
    )


# =============================================================================
# 3. CONFIRM IMPORT EXECUTION
# =============================================================================

@router.post("/bulk-upload/confirm")
async def confirm_bulk_billing(
    payload: ConfirmBulkImportRequest,
    current_user: User = Depends(PermissionChecker("billing.create")),
):
    """
    Executes transaction-safe persistence of all valid bills in the validated batch.
    Applies true historical dates, respects live inventory policy, and logs all outcomes.
    """
    active_tenant = tenant_context.get_tenant_id()
    tenant_to_check = active_tenant if active_tenant != "system" else None
    salon = await bulk_import_billing_service.resolve_salon(payload.salon_id, tenant_to_check)
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    if active_tenant and active_tenant != "system" and salon.tenant_id != active_tenant:
        raise HTTPException(status_code=403, detail="Unauthorized access to salon.")

    try:
        updated_batch = await bulk_import_billing_service.execute_import(
            batch_id=payload.batch_id,
            salon_id=payload.salon_id,
            user_id=str(current_user.id),
            staff_mappings=payload.staff_mappings,
            deduct_inventory=payload.deduct_inventory,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Import execution failed: {str(exc)}")

    return success_response(
        f"Bulk billing import completed with status {updated_batch.status}",
        data={
            "batch_id": updated_batch.batch_id,
            "status": updated_batch.status,
            "successful_bills": updated_batch.successful_bills,
            "failed_bills": updated_batch.failed_bills,
            "duplicate_bills": updated_batch.duplicate_bills,
            "total_committed_amount": updated_batch.total_committed_amount,
            "client_ids_generated_count": updated_batch.client_ids_generated_count,
            "customers_created_count": updated_batch.customers_created_count,
            "generated_client_ids": updated_batch.generated_client_ids,
            "imported_at": updated_batch.imported_at.isoformat() if updated_batch.imported_at else None,
            "row_records": [r.model_dump() for r in updated_batch.row_records],
        },
    )


# =============================================================================
# 4. BATCH HISTORY & DETAILS
# =============================================================================

@router.get("/bulk-upload/batches")
async def list_bulk_batches(
    salon_id: str = Query(..., description="Salon ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Lists past bulk upload batches for a salon, latest first."""
    query: Dict[str, Any] = {
        "$or": [{"salon_id": salon_id}, {"tenant_id": salon_id}],
        "is_deleted": False,
    }
    active_tenant = tenant_context.get_tenant_id()
    if active_tenant and active_tenant != "system":
        query["tenant_id"] = active_tenant

    total = await BulkBillingBatch.find(query).count()
    skip = (page - 1) * limit
    batches = await BulkBillingBatch.find(query).sort("-created_at").skip(skip).limit(limit).to_list()

    items = [
        {
            "id": str(b.id),
            "batch_id": b.batch_id,
            "filenames": b.filenames,
            "import_type": b.import_type,
            "status": b.status,
            "total_bills": b.total_bills,
            "successful_bills": b.successful_bills,
            "failed_bills": b.failed_bills,
            "duplicate_bills": b.duplicate_bills,
            "total_valid_amount": b.total_valid_amount,
            "total_committed_amount": b.total_committed_amount,
            "deduct_inventory": b.deduct_inventory,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "imported_at": b.imported_at.isoformat() if b.imported_at else None,
        }
        for b in batches
    ]

    return success_response(
        "Bulk upload batches retrieved successfully",
        data={
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if total > 0 else 1,
        },
    )


@router.get("/bulk-upload/batches/{batch_id}")
async def get_bulk_batch_detail(
    batch_id: str,
    salon_id: str = Query(...),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Retrieves full details of a specific bulk billing upload batch."""
    batch = await BulkBillingBatch.find_one({
        "batch_id": batch_id,
        "$or": [{"salon_id": salon_id}, {"tenant_id": salon_id}],
        "is_deleted": False,
    })
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    return success_response(
        "Batch details retrieved successfully",
        data={
            "id": str(batch.id),
            "batch_id": batch.batch_id,
            "salon_id": batch.salon_id,
            "filenames": batch.filenames,
            "import_type": batch.import_type,
            "status": batch.status,
            "deduct_inventory": batch.deduct_inventory,
            "total_rows": batch.total_rows,
            "total_bills": batch.total_bills,
            "valid_bills": batch.valid_bills,
            "invalid_bills": batch.invalid_bills,
            "duplicate_bills": batch.duplicate_bills,
            "successful_bills": batch.successful_bills,
            "failed_bills": batch.failed_bills,
            "total_valid_amount": batch.total_valid_amount,
            "total_committed_amount": batch.total_committed_amount,
            "client_ids_generated_count": batch.client_ids_generated_count,
            "customers_created_count": batch.customers_created_count,
            "generated_client_ids": batch.generated_client_ids,
            "ambiguous_staff": batch.ambiguous_staff,
            "row_records": [r.model_dump() for r in batch.row_records],
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
            "imported_at": batch.imported_at.isoformat() if batch.imported_at else None,
        },
    )


# =============================================================================
# 5. EXPORT FAILED RECORDS & AUDIT SUMMARY & CLIENT IDS
# =============================================================================

@router.get("/bulk-upload/batches/{batch_id}/failed-records")
async def download_failed_records(
    batch_id: str,
    salon_id: str = Query(...),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Generates and downloads an Excel file containing all failed and duplicate billing rows."""
    batch = await BulkBillingBatch.find_one({
        "batch_id": batch_id,
        "$or": [{"salon_id": salon_id}, {"tenant_id": salon_id}],
        "is_deleted": False,
    })
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    xlsx_bytes = bulk_import_billing_service.build_failed_records_xlsx(batch)
    filename = f"MyChair_Failed_Billing_Records_{batch.batch_id}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bulk-upload/batches/{batch_id}/summary")
async def download_batch_summary(
    batch_id: str,
    salon_id: str = Query(...),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Generates and downloads an Excel audit summary of the bulk import batch."""
    batch = await BulkBillingBatch.find_one({
        "batch_id": batch_id,
        "$or": [{"salon_id": salon_id}, {"tenant_id": salon_id}],
        "is_deleted": False,
    })
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    xlsx_bytes = bulk_import_billing_service.build_import_summary_xlsx(batch)
    filename = f"MyChair_Import_Summary_{batch.batch_id}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bulk-upload/batches/{batch_id}/generated-client-ids")
async def download_generated_client_ids(
    batch_id: str,
    salon_id: str = Query(...),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Generates and downloads an Excel report of all customers and generated Client IDs in the imported batch."""
    batch = await BulkBillingBatch.find_one({
        "batch_id": batch_id,
        "$or": [{"salon_id": salon_id}, {"tenant_id": salon_id}],
        "is_deleted": False,
    })
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    xlsx_bytes = bulk_import_billing_service.build_generated_client_ids_xlsx(batch)
    filename = f"MyChair_Generated_Client_IDs_{batch.batch_id}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================================
# 6. IN-PLACE PREVIEW ROW EDITING
# =============================================================================

@router.put("/bulk-upload/batches/{batch_id}/rows/{excel_row}")
async def edit_bulk_billing_row(
    batch_id: str,
    excel_row: int,
    payload: EditBulkRowRequest,
    current_user: User = Depends(PermissionChecker("billing.create")),
):
    """
    Edits a specific row in the preview table of a validated batch.
    Revalidates the batch rows and updates preview counts and totals in-place.
    """
    active_tenant = tenant_context.get_tenant_id()
    tenant_to_check = active_tenant if active_tenant != "system" else None
    salon = await bulk_import_billing_service.resolve_salon(payload.salon_id, tenant_to_check)
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    if active_tenant and active_tenant != "system" and salon.tenant_id != active_tenant:
        raise HTTPException(status_code=403, detail="Unauthorized access to salon.")

    try:
        updated_batch = await bulk_import_billing_service.edit_row_record(
            batch_id=batch_id,
            salon_id=payload.salon_id,
            excel_row=excel_row,
            update_data=payload.model_dump(exclude_unset=True),
            tenant_id=active_tenant or salon.tenant_id,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Row edit failed: {str(exc)}")

    return success_response(
        f"Row {excel_row} updated and batch revalidated successfully",
        data={
            "batch_id": updated_batch.batch_id,
            "status": updated_batch.status,
            "total_rows": updated_batch.total_rows,
            "total_bills": updated_batch.total_bills,
            "valid_bills": updated_batch.valid_bills,
            "invalid_bills": updated_batch.invalid_bills,
            "duplicate_bills": updated_batch.duplicate_bills,
            "total_valid_amount": updated_batch.total_valid_amount,
            "client_ids_generated_count": updated_batch.client_ids_generated_count,
            "customers_created_count": updated_batch.customers_created_count,
            "ambiguous_staff": updated_batch.ambiguous_staff,
            "row_records": [r.model_dump() for r in updated_batch.row_records],
        },
    )
