from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status

from app.api.dependencies.auth import PermissionChecker, get_current_user
from app.models.user import User
from app.schemas.notifications import (
    CampaignCreateRequest,
    NotificationCreateRequest,
    PreferenceUpdateRequest,
    TemplateCreateRequest,
    TemplateUpdateRequest,
)
from app.services.notifications import notification_service
from app.utils.api_response import success_response

router = APIRouter()


@router.get("")
async def list_notifications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    notification_type: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    unread_only: bool = Query(default=False),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    data = await notification_service.list_notifications(
        current_user,
        page=page,
        limit=limit,
        notification_type=notification_type,
        category=category,
        unread_only=unread_only,
        date_from=date_from,
        date_to=date_to,
        salon_id=salon_id,
    )
    return success_response("Notifications fetched successfully", data=data)


@router.get("/unread-count")
async def unread_count(
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    count = await notification_service.unread_count(current_user, salon_id)
    return success_response("Unread count fetched successfully", data={"unread_count": count})


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreateRequest,
    current_user: User = Depends(PermissionChecker("notifications.send")),
):
    items = await notification_service.create_notification(current_user, payload.model_dump())
    return success_response(
        "Notification sent successfully",
        data=[item.model_dump(mode="json") for item in items],
        status_code=201,
    )


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    item = await notification_service.mark_read(current_user, notification_id)
    return success_response("Notification marked as read", data=item.model_dump(mode="json"))


@router.patch("/mark-all-read")
async def mark_all_read(
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    updated = await notification_service.mark_all_read(current_user, salon_id)
    return success_response("Notifications marked as read", data={"updated": updated})


@router.get("/preferences")
async def get_preferences(
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    pref = await notification_service.get_or_create_preferences(current_user)
    return success_response("Notification preferences fetched successfully", data=pref.model_dump(mode="json") | {"id": str(pref.id)})


@router.put("/preferences")
async def update_preferences(
    payload: PreferenceUpdateRequest,
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    pref = await notification_service.update_preferences(
        current_user,
        payload.model_dump(exclude_unset=True),
    )
    return success_response("Notification preferences updated successfully", data=pref.model_dump(mode="json") | {"id": str(pref.id)})


@router.get("/templates")
async def list_templates(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    template_type: Optional[str] = Query(default=None),
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    data = await notification_service.list_templates(current_user, page, limit, template_type, salon_id)
    return success_response("Templates fetched successfully", data=data)


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreateRequest,
    current_user: User = Depends(PermissionChecker("notifications.templates.manage")),
):
    item = await notification_service.create_template(current_user, payload.model_dump())
    return success_response("Template created successfully", data=item.model_dump(mode="json") | {"id": str(item.id)}, status_code=201)


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    payload: TemplateUpdateRequest,
    current_user: User = Depends(PermissionChecker("notifications.templates.manage")),
):
    item = await notification_service.update_template(
        current_user,
        template_id,
        payload.model_dump(exclude_unset=True),
    )
    return success_response("Template updated successfully", data=item.model_dump(mode="json") | {"id": str(item.id)})


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: User = Depends(PermissionChecker("notifications.templates.manage")),
):
    await notification_service.delete_template(current_user, template_id)
    return success_response("Template deleted successfully", data={"id": template_id})


@router.post("/templates/{template_id}/clone", status_code=status.HTTP_201_CREATED)
async def clone_template(
    template_id: str,
    current_user: User = Depends(PermissionChecker("notifications.templates.manage")),
):
    item = await notification_service.clone_template(current_user, template_id)
    return success_response("Template cloned successfully", data=item.model_dump(mode="json") | {"id": str(item.id)}, status_code=201)


@router.get("/templates/{template_id}/preview")
async def preview_template(
    template_id: str,
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    data = await notification_service.preview_template(current_user, template_id)
    return success_response("Template preview generated successfully", data=data)


@router.get("/campaigns")
async def list_campaigns(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("notifications.campaigns")),
):
    data = await notification_service.list_campaigns(current_user, page, limit, salon_id)
    return success_response("Campaigns fetched successfully", data=data)


@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(PermissionChecker("notifications.campaigns")),
):
    item = await notification_service.create_campaign(current_user, payload.model_dump())
    if payload.send_now:
        background_tasks.add_task(notification_service.send_campaign, current_user, str(item.id))
    return success_response("Campaign created successfully", data=item.model_dump(mode="json") | {"id": str(item.id)}, status_code=201)


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(PermissionChecker("notifications.campaigns")),
):
    item = await notification_service.mark_campaign_sending(current_user, campaign_id)
    background_tasks.add_task(notification_service.send_campaign, current_user, campaign_id)
    return success_response("Campaign send started successfully", data=item.model_dump(mode="json") | {"id": str(item.id)})


@router.get("/logs")
async def list_logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    campaign_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("notifications.logs.view")),
):
    data = await notification_service.list_logs(current_user, page, limit, campaign_id)
    return success_response("Delivery logs fetched successfully", data=data)


@router.get("/business-alerts")
async def list_business_alerts(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("notifications.view")),
):
    data = await notification_service.list_business_alerts(current_user, page, limit, salon_id)
    return success_response("Business alerts fetched successfully", data=data)


@router.get("/subscription-notifications")
async def list_subscription_notifications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    data = await notification_service.list_subscription_notifications(current_user, page, limit, salon_id)
    return success_response("Subscription notifications fetched successfully", data=data)
