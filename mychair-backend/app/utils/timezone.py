from datetime import datetime, timedelta, timezone
from typing import Optional, Union
from zoneinfo import ZoneInfo

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")


def now_utc() -> datetime:
    """Returns current datetime in UTC, aware."""
    return datetime.now(timezone.utc)


def now_ist() -> datetime:
    """Returns current datetime in Asia/Kolkata, aware."""
    return now_utc().astimezone(KOLKATA_TZ)


def make_aware(dt: datetime) -> datetime:
    """Converts a naive datetime to aware UTC datetime."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_ist(dt: datetime) -> datetime:
    """Converts any datetime (naive or aware) to aware Asia/Kolkata datetime."""
    return make_aware(dt).astimezone(KOLKATA_TZ)


def today_ist_str() -> str:
    """Returns today's date in Asia/Kolkata in YYYY-MM-DD format."""
    return now_ist().strftime("%Y-%m-%d")


def yesterday_ist_str() -> str:
    """Returns yesterday's date in Asia/Kolkata in YYYY-MM-DD format."""
    return (now_ist() - timedelta(days=1)).strftime("%Y-%m-%d")


def combine_ist_datetime(date_str: str, time_str: str) -> datetime:
    """
    Combines YYYY-MM-DD and HH:MM into an aware Asia/Kolkata datetime.
    Supports HH:MM or HH:MM:SS.
    """
    date_parts = [int(p) for p in date_str.split("-")]
    time_parts = [int(p) for p in time_str.split(":")]
    return datetime(
        year=date_parts[0],
        month=date_parts[1],
        day=date_parts[2],
        hour=time_parts[0],
        minute=time_parts[1],
        second=time_parts[2] if len(time_parts) > 2 else 0,
        microsecond=0,
        tzinfo=KOLKATA_TZ,
    )


def to_utc_iso(dt: datetime) -> str:
    """Returns ISO format UTC representation of the datetime."""
    return make_aware(dt).isoformat()
