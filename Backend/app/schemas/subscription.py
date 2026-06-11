from typing import Optional

from pydantic import BaseModel, Field

from app.constants.subscription_options import (
    SUBSCRIPTION_STATUSES,
    VALID_SUBSCRIPTION_PLAN_VALUES,
    normalize_plan_name,
)


class UpdateSubscriptionRequest(BaseModel):
    plan_name: Optional[str] = Field(default=None, max_length=50)
    status: Optional[str] = Field(default=None, max_length=20)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    extend_days: Optional[int] = Field(default=None, ge=1)



class UpdateDefaultDaysRequest(BaseModel):
    default_subscription_days: int = Field(..., ge=1, le=3650)


class SubscriptionListQuery(BaseModel):
    search: Optional[str] = None
    status: Optional[str] = None
    plan_name: Optional[str] = None
