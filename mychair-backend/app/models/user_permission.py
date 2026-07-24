"""Custom permission overrides stored per tenant (role templates and user overrides)."""

from typing import Dict, Optional

from pydantic import Field

from app.models.base import BaseTenantDocument


class PermissionRecord(BaseTenantDocument):
    """
    Single collection for permission configuration.

    Role template document: tenant_id + role set, user_id absent.
    User override document: tenant_id + user_id set, role absent.
    """

    user_id: Optional[str] = Field(default=None, index=True)
    role: Optional[str] = Field(default=None, index=True)
    permissions: Dict[str, bool] = Field(default_factory=dict)

    class Settings:
        name = "permissions"
        indexes = [
            [("tenant_id", 1), ("user_id", 1)],
            [("tenant_id", 1), ("role", 1)],
            "is_deleted",
        ]
