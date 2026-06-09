from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class MasterServiceItem(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime
    updated_at: datetime


class SalonServiceCreate(BaseModel):
    service_id: str | None = None
    custom_service_name: str | None = Field(default=None, max_length=150)
    price: float = Field(..., gt=0)

    @model_validator(mode="after")
    def validate_service_source(self) -> "SalonServiceCreate":
        has_service_id = bool(self.service_id)
        has_custom_name = bool((self.custom_service_name or "").strip())
        if has_service_id == has_custom_name:
            raise ValueError(
                "Provide either service_id or custom_service_name, but not both"
            )
        if self.custom_service_name is not None:
            self.custom_service_name = self.custom_service_name.strip()
        return self


class SalonServiceUpdate(BaseModel):
    service_id: str | None = None
    custom_service_name: str | None = Field(default=None, max_length=150)
    price: float = Field(..., gt=0)
    status: str = Field(default="ACTIVE", max_length=20)

    @model_validator(mode="after")
    def validate_service_source(self) -> "SalonServiceUpdate":
        has_service_id = bool(self.service_id)
        has_custom_name = bool((self.custom_service_name or "").strip())
        if has_service_id == has_custom_name:
            raise ValueError(
                "Provide either service_id or custom_service_name, but not both"
            )
        if self.custom_service_name is not None:
            self.custom_service_name = self.custom_service_name.strip()
        self.status = self.status.strip().upper()
        return self


class SalonServiceListItem(BaseModel):
    id: str
    salon_id: str
    service_id: str | None = None
    custom_service_name: str | None = None
    service_name: str
    price: float
    status: str
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
