"""Week-off day helpers for attendance."""

from datetime import datetime, timedelta
from typing import List, Set

VALID_WEEK_DAYS = frozenset(
    {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
)

DAY_INDEX_TO_NAME = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


def normalize_week_days(days: List[str]) -> List[str]:
    """Return sorted unique valid lowercase day names."""
    normalized: Set[str] = set()
    for day in days or []:
        cleaned = str(day).strip().lower()
        if cleaned in VALID_WEEK_DAYS:
            normalized.add(cleaned)
    order = list(VALID_WEEK_DAYS)
    return sorted(normalized, key=lambda d: order.index(d))


def day_name_for_date(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return DAY_INDEX_TO_NAME[dt.weekday()]


def is_week_off_day(weekly_off: List[str], date_str: str) -> bool:
    if not weekly_off:
        return False
    off_days = {d.strip().lower() for d in weekly_off}
    return day_name_for_date(date_str) in off_days


def iter_dates_in_range(date_from: str, date_to: str) -> List[str]:
    start = datetime.strptime(date_from, "%Y-%m-%d")
    end = datetime.strptime(date_to, "%Y-%m-%d")
    if end < start:
        return []
    dates: List[str] = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates


def week_off_dates_in_range(
    weekly_off: List[str], date_from: str, date_to: str
) -> List[str]:
    if not weekly_off:
        return []
    return [
        date_str
        for date_str in iter_dates_in_range(date_from, date_to)
        if is_week_off_day(weekly_off, date_str)
    ]
