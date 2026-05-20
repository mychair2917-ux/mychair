from datetime import datetime
from typing import Optional
from beanie import Document, before_event, Insert, Replace, SaveChanges
from pydantic import Field
from app.utils.timezone import now_utc
from app.core import tenant_context

class BaseTenantDocument(Document):
    """
    Base Document for all multi-tenant and soft-deletable collections in the system.
    Supports auto-auditing, soft-deleting, and automated tenant context tagging.
    """
    tenant_id: str = Field(default=None, index=True)
    is_deleted: bool = Field(default=False)
    
    # Audit fields
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = Field(default=None)
    updated_by: Optional[str] = Field(default=None)

    @before_event(Insert)
    def before_insert(self) -> None:
        """Executed before inserting a document."""
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
        self.updated_at = now_utc()
        self.updated_by = tenant_context.get_user_id()
        
        # Ensure tenant isolation is preserved on update
        if not self.tenant_id:
            active_tenant = tenant_context.get_tenant_id()
            if active_tenant:
                self.tenant_id = active_tenant
