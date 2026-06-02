from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class MasterProductItem(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime
    updated_at: datetime


class SalonProductCreate(BaseModel):
    product_id: str | None = None
    custom_product_name: str | None = Field(default=None, max_length=150)
    price: float = Field(..., ge=0)

    @model_validator(mode="after")
    def validate_product_source(self) -> "SalonProductCreate":
        has_product_id = bool((self.product_id or "").strip())
        has_custom_name = bool((self.custom_product_name or "").strip())
        if has_product_id == has_custom_name:
            raise ValueError(
                "Provide either product_id or custom_product_name, but not both"
            )
        if self.product_id is not None:
            self.product_id = self.product_id.strip() or None
        if self.custom_product_name is not None:
            self.custom_product_name = self.custom_product_name.strip()
        return self


class SalonProductUpdate(BaseModel):
    product_id: str | None = None
    custom_product_name: str | None = Field(default=None, max_length=150)
    price: float = Field(..., ge=0)
    status: str = Field(default="ACTIVE", max_length=20)

    @model_validator(mode="after")
    def validate_product_source(self) -> "SalonProductUpdate":
        has_product_id = bool((self.product_id or "").strip())
        has_custom_name = bool((self.custom_product_name or "").strip())
        if has_product_id == has_custom_name:
            raise ValueError(
                "Provide either product_id or custom_product_name, but not both"
            )
        if self.product_id is not None:
            self.product_id = self.product_id.strip() or None
        if self.custom_product_name is not None:
            self.custom_product_name = self.custom_product_name.strip()
        self.status = self.status.strip().upper()
        return self


class SalonProductListItem(BaseModel):
    id: str
    salon_id: str
    product_id: str | None = None
    custom_product_name: str | None = None
    product_name: str
    price: float
    status: str
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
