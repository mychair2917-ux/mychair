from pydantic import Field

from app.models.base import BaseTenantDocument


class Brand(BaseTenantDocument):
    """Reusable product brand catalog, with global and tenant-scoped entries."""

    name: str = Field(..., max_length=100, index=True)
    is_active: bool = Field(default=True)

    class Settings:
        name = "brands"
        indexes = [
            "tenant_id",
            "name",
            "is_active",
            "is_deleted",
        ]
