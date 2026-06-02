from typing import Optional

from pydantic import Field

from app.models.base import BaseTenantDocument


class Product(BaseTenantDocument):
    """
    Sellable product catalog item.
    Global products keep tenant_id=None, while salon-created manual products are tenant-scoped.
    """

    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(default=None)
    price: float = Field(..., ge=0.0)
    tax_rate: float = Field(default=0.0, ge=0.0)
    is_active: bool = Field(default=True)

    class Settings:
        name = "products"
        indexes = [
            "tenant_id",
            "name",
            "is_deleted",
        ]
