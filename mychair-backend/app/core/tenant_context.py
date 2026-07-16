from contextvars import ContextVar
from typing import Optional

# ContextVars to store the current tenant and user inside async task contexts
_current_tenant_id: ContextVar[Optional[str]] = ContextVar("current_tenant_id", default=None)
_current_user_id: ContextVar[Optional[str]] = ContextVar("current_user_id", default=None)

def set_tenant_id(tenant_id: Optional[str]) -> None:
    _current_tenant_id.set(tenant_id)

def get_tenant_id() -> Optional[str]:
    return _current_tenant_id.get()

def set_user_id(user_id: Optional[str]) -> None:
    _current_user_id.set(user_id)

def get_user_id() -> Optional[str]:
    return _current_user_id.get()

def clear_context() -> None:
    _current_tenant_id.set(None)
    _current_user_id.set(None)
