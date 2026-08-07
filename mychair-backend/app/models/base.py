from datetime import datetime
from typing import Optional, Any
from beanie import Document, before_event, Insert, Replace, SaveChanges
from pydantic import Field, model_validator
from app.utils.timezone import now_utc
from app.core import tenant_context
from app.utils.title_case import PROPER_NAME_FIELDS, EXCLUDED_FIELDS, to_title_case


class BaseTenantDocument(Document):
    """
    Base Document for all multi-tenant and soft-deletable collections in the system.
    Supports auto-auditing, soft-deleting, automated tenant context tagging,
    and application-wide Title Case formatting for proper names.
    """
    tenant_id: Optional[str] = Field(default=None, index=True)
    is_deleted: bool = Field(default=False)
    deleted_at: Optional[datetime] = Field(default=None)

    # Audit fields
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = Field(default=None)
    updated_by: Optional[str] = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def title_case_input_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key, val in data.items():
                if key in PROPER_NAME_FIELDS and key not in EXCLUDED_FIELDS and isinstance(val, str):
                    data[key] = to_title_case(val)
        return data

    def _apply_title_case_formatting(self) -> None:
        for field in PROPER_NAME_FIELDS:
            if field not in EXCLUDED_FIELDS and hasattr(self, field):
                val = getattr(self, field)
                if isinstance(val, str) and val:
                    setattr(self, field, to_title_case(val))

    @before_event(Insert)
    def before_insert(self) -> None:
        """Executed before inserting a document."""
        self._apply_title_case_formatting()
        current_time = now_utc()
        self.created_at = current_time
        self.updated_at = current_time
        
        # Tag tenant_id if not explicitly provided
        if not self.tenant_id:
            active_tenant = tenant_context.get_tenant_id()
            if active_tenant:
                self.tenant_id = active_tenant
        
        # Tag creator user_id
        if not self.created_by:
            self.created_by = tenant_context.get_user_id()
        self.updated_by = tenant_context.get_user_id()

    @before_event(Replace, SaveChanges)
    def before_update(self) -> None:
        """Executed before modifying/replacing a document."""
        self._apply_title_case_formatting()
        self.updated_at = now_utc()
        self.updated_by = tenant_context.get_user_id()
        
        # Ensure tenant isolation is preserved on update
        if not self.tenant_id:
            active_tenant = tenant_context.get_tenant_id()
            if active_tenant:
                self.tenant_id = active_tenant
