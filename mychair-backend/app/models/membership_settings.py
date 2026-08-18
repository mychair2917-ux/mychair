"""
Membership Settings model.
Stores salon-level configuration for default membership duration.
Allowed managers: Super Admin, Salon Owner, Salon Manager.
Default configuration for existing/new salons: 1 Year (1, "Years").
"""
from pydantic import Field
from app.models.base import BaseTenantDocument


class MembershipSettings(BaseTenantDocument):
    """
    Salon-level membership settings.
    Each salon (tenant) maintains its own membership configuration.
    """
    default_duration_number: int = Field(default=1, ge=1)
    default_duration_unit: str = Field(default="Years")  # "Days", "Months", "Years"
    default_membership_duration: str = Field(default="1 Year")

    class Settings:
        name = "membership_settings"
        indexes = ["tenant_id", "is_deleted"]
