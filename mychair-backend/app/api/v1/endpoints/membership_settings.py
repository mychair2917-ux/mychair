"""
Salon Membership Duration Settings endpoints.
Allowed roles: Super Admin, Salon Owner, Salon Manager.
Configures default membership duration for salon client onboarding.
"""
from typing import Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.api.dependencies.auth import PermissionChecker
from app.auth.rbac_config import (
    ROLE_SUPER_ADMIN,
    ROLE_SALON_OWNER,
    ROLE_SALON_ADMIN,
    ROLE_SALON_MANAGER,
    normalize_role,
)
from app.core import tenant_context
from app.core.exceptions import PermissionDeniedException
from app.models.user import User
from app.services.customer_membership import get_salon_membership_settings
from app.utils.api_response import success_response, error_response

router = APIRouter()


def _effective_tenant(current_user: User) -> Optional[str]:
    if current_user.role == "super_admin":
        return tenant_context.get_tenant_id()
    return str(current_user.tenant_id or "").strip() or None


def _can_manage_membership_settings(current_user: User) -> bool:
    normalized = normalize_role(current_user.role)
    return normalized in {
        ROLE_SUPER_ADMIN,
        ROLE_SALON_OWNER,
        ROLE_SALON_ADMIN,
        ROLE_SALON_MANAGER,
    }


PREDEFINED_DURATION_OPTIONS = [
    {"label": "1 Month", "number": 1, "unit": "Months"},
    {"label": "3 Months", "number": 3, "unit": "Months"},
    {"label": "6 Months", "number": 6, "unit": "Months"},
    {"label": "1 Year", "number": 1, "unit": "Years"},
    {"label": "2 Years", "number": 2, "unit": "Years"},
    {"label": "Custom", "is_custom": True},
]


class MembershipSettingsUpdate(BaseModel):
    default_membership_duration: Optional[str] = Field(default=None)
    default_duration_number: Optional[int] = Field(default=None, ge=1)
    default_duration_unit: Optional[str] = Field(default=None)


def _format_settings_dict(settings) -> dict:
    return {
        "id": str(settings.id),
        "default_membership_duration": settings.default_membership_duration,
        "default_duration_number": settings.default_duration_number,
        "default_duration_unit": settings.default_duration_unit,
        "options": PREDEFINED_DURATION_OPTIONS,
    }


@router.get("")
@router.get("/")
async def get_membership_settings(
    current_user: User = Depends(PermissionChecker("customer_analytics.view")),
):
    if not _can_manage_membership_settings(current_user):
        raise PermissionDeniedException(
            detail="Only Super Admin, Salon Owner, or Salon Manager can view/manage membership settings."
        )

    tenant_id = _effective_tenant(current_user)
    if not tenant_id:
        return error_response("Tenant context required.", status_code=400)

    settings = await get_salon_membership_settings(tenant_id)
    return success_response(
        "Membership settings retrieved successfully",
        data=_format_settings_dict(settings),
    )


@router.put("")
@router.put("/")
async def update_membership_settings(
    payload: MembershipSettingsUpdate,
    current_user: User = Depends(PermissionChecker("customer_analytics.edit")),
):
    if not _can_manage_membership_settings(current_user):
        raise PermissionDeniedException(
            detail="Only Super Admin, Salon Owner, or Salon Manager can modify membership duration settings."
        )

    tenant_id = _effective_tenant(current_user)
    if not tenant_id:
        return error_response("Tenant context required.", status_code=400)

    settings = await get_salon_membership_settings(tenant_id)

    num = payload.default_duration_number
    unit = payload.default_duration_unit
    dur_label = payload.default_membership_duration

    # If predefined label is passed, parse number and unit automatically if not explicitly given
    if dur_label:
        for opt in PREDEFINED_DURATION_OPTIONS:
            if opt.get("label", "").lower() == dur_label.strip().lower() and not opt.get("is_custom"):
                if num is None:
                    num = opt["number"]
                if unit is None:
                    unit = opt["unit"]
                break

    if num is not None:
        if num < 1:
            return error_response(
                "Membership duration number must be a positive integer greater than 0.",
                errors={"default_duration_number": ["Must be greater than 0"]},
                status_code=422,
            )
        settings.default_duration_number = num

    if unit is not None:
        norm_unit = unit.strip().capitalize()
        if not norm_unit.endswith("s"):
            norm_unit += "s"
        if norm_unit not in {"Days", "Months", "Years"}:
            return error_response(
                "Membership duration unit must be Days, Months, or Years.",
                errors={"default_duration_unit": ["Must be Days, Months, or Years"]},
                status_code=422,
            )
        settings.default_duration_unit = norm_unit

    if dur_label:
        settings.default_membership_duration = dur_label
    else:
        unit_str = settings.default_duration_unit
        if settings.default_duration_number == 1 and unit_str.endswith("s"):
            unit_str = unit_str[:-1]
        settings.default_membership_duration = f"{settings.default_duration_number} {unit_str}"

    await settings.save()
    return success_response(
        "Membership settings updated successfully",
        data=_format_settings_dict(settings),
    )
