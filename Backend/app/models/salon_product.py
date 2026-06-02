from pydantic import Field

from app.models.base import BaseTenantDocument


class SalonProduct(BaseTenantDocument):
    product_id: str | None = Field(default=None, index=True)
    salon_id: str = Field(..., index=True)
    custom_product_name: str | None = Field(default=None, max_length=150)
    price: float = Field(..., ge=0.0)
    status: str = Field(default="ACTIVE", max_length=20)

    class Settings:
        name = "salon_products"
        indexes = [
            [("tenant_id", 1), ("salon_id", 1), ("product_id", 1)],
            [("tenant_id", 1), ("salon_id", 1), ("custom_product_name", 1)],
            "is_deleted",
        ]
