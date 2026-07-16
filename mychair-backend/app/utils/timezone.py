from datetime import datetime, timezone
from typing import Union

def now_utc() -> datetime:
    """Returns current datetime in UTC, aware."""
    return datetime.now(timezone.utc)

def make_aware(dt: datetime) -> datetime:
    """Converts a naive datetime to aware UTC datetime."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def to_utc_iso(dt: datetime) -> str:
    """Returns ISO format UTC representation of the datetime."""
    return make_aware(dt).isoformat()
