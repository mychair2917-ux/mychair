from pydantic import Field

from app.models.base import BaseTenantDocument


class SalonService(BaseTenantDocument):
    salon_id: str = Field(..., index=True)
    service_id: str | None = Field(default=None, index=True)
    custom_service_name: str | None = Field(default=None, max_length=150)
    price: float = Field(..., gt=0)
    status: str = Field(default="ACTIVE", max_length=20)

    class Settings:
        name = "salon_services"
        indexes = [
            [("tenant_id", 1), ("salon_id", 1), ("service_id", 1)],
            [("tenant_id", 1), ("salon_id", 1), ("custom_service_name", 1)],
            "is_deleted",
        ]
