from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.rbac import require_module
from app.api.dependencies.super_admin import require_super_admin
from app.auth.rbac_config import Module, ROLE_SALON_OWNER
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.user import User
from app.schemas.subscription import UpdateDefaultDaysRequest, UpdateSubscriptionRequest
from app.services.subscription_service import SubscriptionService
from app.services.system_settings_service import SystemSettingsService
from app.utils.api_response import error_response, success_response

router = APIRouter()
subscription_service = SubscriptionService()
system_settings_service = SystemSettingsService()


@router.get("/dashboard")
async def subscription_dashboard(
    current_user: User = Depends(require_super_admin),
):
    stats = await subscription_service.get_dashboard_stats()
    return success_response("Subscription dashboard loaded", data=stats)


@router.get("")
async def list_subscriptions(
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    plan_name: Optional[str] = Query(default=None),
    current_user: User = Depends(require_super_admin),
):
    data = await subscription_service.list_subscriptions(
        search=search,
        status=status,
        plan_name=plan_name,
    )
    return success_response("Subscriptions loaded", data=data)


@router.get("/settings/default-days")
async def get_default_subscription_days(
    current_user: User = Depends(require_super_admin),
):
    days = await system_settings_service.get_default_subscription_days()
    return success_response("Default subscription days loaded", data={"default_subscription_days": days})


@router.put("/settings/default-days")
async def update_default_subscription_days(
    payload: UpdateDefaultDaysRequest,
    current_user: User = Depends(require_super_admin),
):
    data, error = await system_settings_service.update_default_subscription_days(
        payload.default_subscription_days,
        updated_by=str(current_user.id),
    )
    if error:
        return error_response(error, status_code=400)
    return success_response("Default subscription days updated", data=data)


@router.get("/plans")
async def list_plans(
    current_user: User = Depends(require_module(Module.SUBSCRIPTION_MANAGEMENT)),
):
    from app.constants.subscription_options import SUBSCRIPTION_PLANS

    return success_response("Plans loaded", data=SUBSCRIPTION_PLANS)


@router.get("/me")
async def get_my_subscription(
    current_user: User = Depends(require_module(Module.SUBSCRIPTION_MANAGEMENT)),
):
    if current_user.role == ROLE_SALON_OWNER:
        if not current_user.tenant_id:
            raise ResourceNotFoundException("Salon subscription not found")
        data = await subscription_service.get_owner_subscription_view(current_user.tenant_id)
        if not data:
            raise ResourceNotFoundException("Salon subscription not found")
        return success_response("Subscription loaded", data=data)
    raise PermissionDeniedException("Only salon owners can view this subscription page")


@router.get("/me/status")
async def get_my_subscription_status(
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "super_admin":
        return success_response(
            "Subscription status loaded",
            data={
                "status": "ACTIVE",
                "is_valid": True,
                "days_remaining": None,
                "show_reminder_banner": False,
                "reminder_message": None,
            },
        )
    if not current_user.tenant_id:
        return success_response(
            "Subscription status loaded",
            data={
                "status": "EXPIRED",
                "is_valid": False,
                "days_remaining": 0,
                "show_reminder_banner": False,
                "reminder_message": None,
            },
        )
    data = await subscription_service.get_subscription_status(current_user.tenant_id)
    return success_response("Subscription status loaded", data=data)


@router.put("/{subscription_id}")
async def update_subscription(
    subscription_id: str,
    payload: UpdateSubscriptionRequest,
    current_user: User = Depends(require_super_admin),
):
    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("plan_name"):
        from app.constants.subscription_options import normalize_plan_name

        update_data["plan_name"] = normalize_plan_name(update_data["plan_name"])
    if update_data.get("status"):
        update_data["status"] = str(update_data["status"]).strip().upper()

    data, errors = await subscription_service.update_subscription(
        subscription_id,
        update_data,
        updated_by=str(current_user.id),
    )
    if errors:
        return error_response("Validation failed", errors=errors, status_code=400)
    return success_response("Subscription updated", data=data)
