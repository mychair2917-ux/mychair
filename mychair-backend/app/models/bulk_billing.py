from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import Field, BaseModel
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc


class BulkBillingRowRecord(BaseModel):
    """Stores row-level parsing, validation, and execution outcome."""
    file_type: str = "SERVICE"  # "SERVICE" or "PRODUCT"
    excel_row: int
    original_bill_reference: str
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    item_name: Optional[str] = None
    item_type: str = "SERVICE"  # "SERVICE" or "PRODUCT"
    staff_identifier: Optional[str] = None
    resolved_staff_id: Optional[str] = None
    resolved_staff_name: Optional[str] = None
    quantity: int = 1
    unit_price: float = 0.0
    discount: float = 0.0
    tax_rate: float = 0.0
    line_total: float = 0.0
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    paid_amount: Optional[float] = None
    bill_date: Optional[str] = None
    bill_group: Optional[str] = None
    client_id_status: Optional[str] = None  # "EXISTING", "NEW_WITH_PHONE", "WILL_GENERATE"
    notes: Optional[str] = None
    status: str = "VALID"  # "VALID", "FAILED", "DUPLICATE", "COMMITTED"
    error_category: Optional[str] = None
    error_message: Optional[str] = None
    action_required: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class BulkBillingBatch(BaseTenantDocument):
    """
    Represents an audit-trailed bulk billing upload batch.
    Tracks file metadata, row-level validation results, ambiguous staff mappings,
    inventory policies, and final execution metrics.
    """
    batch_id: str = Field(..., index=True)
    salon_id: str = Field(..., index=True)
    uploaded_by: Optional[str] = Field(default=None, index=True)
    filenames: List[str] = Field(default_factory=list)
    import_type: str = "COMBINED"  # "SERVICE", "PRODUCT", "COMBINED"
    deduct_inventory: bool = False
    status: str = "PENDING"  # "PENDING", "VALIDATED", "IMPORTING", "COMPLETED", "PARTIAL", "FAILED"

    total_rows: int = 0
    total_bills: int = 0
    valid_bills: int = 0
    invalid_bills: int = 0
    duplicate_bills: int = 0
    successful_bills: int = 0
    failed_bills: int = 0
    total_valid_amount: float = 0.0
    total_committed_amount: float = 0.0
    client_ids_generated_count: int = 0
    customers_created_count: int = 0

    row_records: List[BulkBillingRowRecord] = Field(default_factory=list)
    ambiguous_staff: List[Dict[str, Any]] = Field(default_factory=list)
    generated_client_ids: List[Dict[str, Any]] = Field(default_factory=list)

    imported_at: Optional[datetime] = None

    class Settings:
        name = "bulk_billing_batches"
        indexes = [
            "tenant_id",
            "salon_id",
            "batch_id",
            "status",
            "created_at",
            "is_deleted",
        ]
