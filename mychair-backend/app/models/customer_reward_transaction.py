from typing import Optional
from pydantic import Field
from app.models.base import BaseTenantDocument


class CustomerRewardTransaction(BaseTenantDocument):
    """
    Immutable ledger entry recording every reward-points event for a customer.
    type: EARNED (from invoice) | REDEEMED (future) | ADJUSTED (manual correction)
    """
    customer_id: str = Field(..., index=True)
    invoice_id: Optional[str] = Field(default=None, index=True)
    bill_amount: float = Field(default=0.0, ge=0)
    points: int = Field(..., description="Points earned (positive) or redeemed (negative)")
    type: str = Field(default="EARNED")  # EARNED | REDEEMED | ADJUSTED

    class Settings:
        name = "customer_reward_transactions"
        indexes = ["tenant_id", "customer_id", "invoice_id", "is_deleted"]
