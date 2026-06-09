from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class PermissionRegistryItem(BaseModel):
    key: str
    label: str
    group: Optional[str] = None
    children: Optional[List[dict]] = None


class RolePermissionsResponse(BaseModel):
    role: str
    defaults: Dict[str, bool]
    overrides: Dict[str, bool] = Field(default_factory=dict)
    effective: Dict[str, bool]


class UserPermissionsResponse(BaseModel):
    user_id: str
    role: str
    defaults: Dict[str, bool]
    overrides: Dict[str, bool] = Field(default_factory=dict)
    effective: Dict[str, bool]


class UpdatePermissionsRequest(BaseModel):
    permissions: Dict[str, bool]


class FinalPermissionsResponse(BaseModel):
    role: str
    permissions: Dict[str, bool]
