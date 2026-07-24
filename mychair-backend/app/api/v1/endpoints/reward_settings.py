"""
Reward Settings & Segments endpoints.
Salon owners can configure the global reward toggle, default points,
and bill-amount threshold segments.
"""
from typing import Optional
from fastapi import APIRouter, Depends, status
from beanie import PydanticObjectId
from pydantic import BaseModel, Field

from app.api.dependencies.auth import PermissionChecker
from app.core import tenant_context
from app.core.exceptions import ResourceNotFoundException
from app.models.reward_settings import RewardSettings, RewardSegment
from app.models.user import User
from app.utils.api_response import success_response, error_response
from app.utils.timezone import now_utc

router = APIRouter()


def _effective_tenant(current_user: User) -> Optional[str]:
    if current_user.role == "super_admin":
        return tenant_context.get_tenant_id()
    return str(current_user.tenant_id or "").strip() or None


async def _get_or_create_settings(tenant_id: str) -> RewardSettings:
    settings = await RewardSettings.find_one(
        {"tenant_id": tenant_id, "is_deleted": False}
    )
    if not settings:
        settings = RewardSettings(tenant_id=tenant_id)
        await settings.insert()
    return settings


def _settings_dict(s: RewardSettings) -> dict:
    return {
        "id": str(s.id),
        "is_enabled": s.is_enabled,
        "default_points": s.default_points,
    }


def _segment_dict(seg: RewardSegment) -> dict:
    return {
        "id": str(seg.id),
        "min_bill_amount": seg.min_bill_amount,
        "reward_points": seg.reward_points,
        "created_at": seg.created_at.isoformat() if seg.created_at else None,
    }


# ─────────────────────────── schemas ─────────────────────────────────────────

class RewardSettingsUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    default_points: Optional[int] = Field(default=None, ge=0)


class SegmentCreate(BaseModel):
    min_bill_amount: float = Field(..., ge=0)
    reward_points: int = Field(..., ge=0)


class SegmentUpdate(BaseModel):
    min_bill_amount: Optional[float] = Field(default=None, ge=0)
    reward_points: Optional[int] = Field(default=None, ge=0)


# ─────────────────────────── endpoints ───────────────────────────────────────

@router.get("")
async def get_reward_settings(
    current_user: User = Depends(PermissionChecker("customer_analytics.view")),
):
    tenant_id = _effective_tenant(current_user)
    if not tenant_id:
        return error_response("Tenant context required.", status_code=400)

    settings = await _get_or_create_settings(tenant_id)

    # Fetch segments sorted ascending by min_bill_amount
    segments = (
        await RewardSegment.find({"tenant_id": tenant_id, "is_deleted": False})
        .sort("min_bill_amount")
        .to_list()
    )

    return success_response(
        "Reward settings retrieved successfully",
        data={
            **_settings_dict(settings),
            "segments": [_segment_dict(seg) for seg in segments],
        },
    )


@router.put("")
async def update_reward_settings(
    payload: RewardSettingsUpdate,
    current_user: User = Depends(PermissionChecker("customer_analytics.edit")),
):
    tenant_id = _effective_tenant(current_user)
    if not tenant_id:
        return error_response("Tenant context required.", status_code=400)

    settings = await _get_or_create_settings(tenant_id)
    if payload.is_enabled is not None:
        settings.is_enabled = payload.is_enabled
    if payload.default_points is not None:
        settings.default_points = payload.default_points
    await settings.save()

    return success_response(
        "Reward settings updated successfully", data=_settings_dict(settings)
    )


@router.post("/segments", status_code=status.HTTP_201_CREATED)
async def create_segment(
    payload: SegmentCreate,
    current_user: User = Depends(PermissionChecker("customer_analytics.edit")),
):
    tenant_id = _effective_tenant(current_user)
    if not tenant_id:
        return error_response("Tenant context required.", status_code=400)

    # Duplicate min_bill_amount check
    dup = await RewardSegment.find_one(
        {
            "tenant_id": tenant_id,
            "min_bill_amount": payload.min_bill_amount,
            "is_deleted": False,
        }
    )
    if dup:
        return error_response(
            f"A segment for ₹{payload.min_bill_amount} already exists.",
            errors={"min_bill_amount": ["Duplicate bill amount"]},
            status_code=409,
        )

    seg = RewardSegment(
        tenant_id=tenant_id,
        min_bill_amount=payload.min_bill_amount,
        reward_points=payload.reward_points,
    )
    await seg.insert()
    return success_response(
        "Segment created successfully", data=_segment_dict(seg), status_code=201
    )


@router.put("/segments/{segment_id}")
async def update_segment(
    segment_id: str,
    payload: SegmentUpdate,
    current_user: User = Depends(PermissionChecker("customer_analytics.edit")),
):
    tenant_id = _effective_tenant(current_user)
    try:
        seg_oid = PydanticObjectId(segment_id)
    except Exception as exc:
        raise ResourceNotFoundException("Segment not found") from exc

    query: dict = {"_id": seg_oid, "is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id
    seg = await RewardSegment.find_one(query)
    if not seg:
        raise ResourceNotFoundException("Segment not found")

    if payload.min_bill_amount is not None:
        # Duplicate check (exclude self)
        dup = await RewardSegment.find_one(
            {
                "tenant_id": tenant_id,
                "min_bill_amount": payload.min_bill_amount,
                "is_deleted": False,
                "_id": {"$ne": seg_oid},
            }
        )
        if dup:
            return error_response(
                f"A segment for ₹{payload.min_bill_amount} already exists.",
                errors={"min_bill_amount": ["Duplicate bill amount"]},
                status_code=409,
            )
        seg.min_bill_amount = payload.min_bill_amount
    if payload.reward_points is not None:
        seg.reward_points = payload.reward_points

    await seg.save()
    return success_response("Segment updated successfully", data=_segment_dict(seg))


@router.delete("/segments/{segment_id}")
async def delete_segment(
    segment_id: str,
    current_user: User = Depends(PermissionChecker("customer_analytics.edit")),
):
    tenant_id = _effective_tenant(current_user)
    try:
        seg_oid = PydanticObjectId(segment_id)
    except Exception as exc:
        raise ResourceNotFoundException("Segment not found") from exc

    query: dict = {"_id": seg_oid, "is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id
    seg = await RewardSegment.find_one(query)
    if not seg:
        raise ResourceNotFoundException("Segment not found")

    seg.is_deleted = True
    seg.deleted_at = now_utc()
    await seg.save()
    return success_response("Segment deleted successfully")
