from datetime import datetime

from pydantic import BaseModel


class BrandItem(BaseModel):
    id: str
    name: str
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime
