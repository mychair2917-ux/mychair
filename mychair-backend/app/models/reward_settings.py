from pydantic import Field
from app.models.base import BaseTenantDocument


class RewardSettings(BaseTenantDocument):
    """
    Global reward programme configuration for a salon tenant.
    One active document per tenant; created on first access if absent.
    """
    is_enabled: bool = Field(default=True)
    default_points: int = Field(default=10, ge=0)

    class Settings:
        name = "reward_settings"
        indexes = ["tenant_id", "is_deleted"]


class RewardSegment(BaseTenantDocument):
    """
    Bill-amount threshold rule that maps a minimum spend to a points award.
    Only the highest matching segment is applied per invoice.
    """
    min_bill_amount: float = Field(..., ge=0)
    reward_points: int = Field(..., ge=0)

    class Settings:
        name = "reward_segments"
        indexes = ["tenant_id", "is_deleted", "min_bill_amount"]
