"""
Centralized Client Membership calculation, date management, and status utilities.
Source of truth for membership status, expiration, dynamic validity checks, and renewal rules.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any
from app.models.customer import Customer
from app.utils.timezone import now_utc

STATUS_ACTIVE = "ACTIVE"
STATUS_EXPIRED = "EXPIRED"
STATUS_NON_MEMBER = "NON_MEMBER"
DEFAULT_MEMBERSHIP_TYPE = "Standard Membership"
EXPIRING_SOON_DAYS = 30


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize naive or aware datetime to UTC-aware datetime."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def calculate_membership_dates(
    start_date: Optional[datetime] = None,
    years: int = 1,
) -> Tuple[datetime, datetime]:
    """
    Calculates membership start and end dates.
    Default duration is 1 year (12 months):
    new_start_date = start date
    new_end_date = start date + years - 1 day (at 23:59:59 UTC)
    """
    start = _to_utc(start_date or now_utc())
    
    # Calculate end date (+years, -1 day)
    try:
        target_year_date = start.replace(year=start.year + years)
    except ValueError:
        # Handle leap year Feb 29 -> Feb 28
        target_year_date = start.replace(year=start.year + years, day=28)
        
    end = target_year_date - timedelta(days=1)
    end = end.replace(hour=23, minute=59, second=59, microsecond=999999)
    return start, end


def get_effective_membership_status(customer: Customer, current_time: Optional[datetime] = None) -> str:
    """
    Determines current membership status dynamically from membership end date.
    Returns: ACTIVE, EXPIRED, or NON_MEMBER.
    """
    now = _to_utc(current_time or now_utc())
    
    if customer.membership_end_date is not None:
        end_dt = _to_utc(customer.membership_end_date)
        if end_dt and now <= end_dt:
            return STATUS_ACTIVE
        return STATUS_EXPIRED
    
    # Legacy fallback: if is_member flag was true but no end date was set
    if getattr(customer, "is_member", False):
        return STATUS_ACTIVE
        
    return STATUS_NON_MEMBER


def is_membership_active(customer: Customer, current_time: Optional[datetime] = None) -> bool:
    """True if customer has an active membership that has not passed its end date."""
    return get_effective_membership_status(customer, current_time) == STATUS_ACTIVE


def calculate_renewal_dates(
    customer: Customer,
    years: int = 1,
    current_time: Optional[datetime] = None,
) -> Tuple[datetime, datetime]:
    """
    Calculates start and end dates for a membership renewal.
    
    Renewal Rule (Section 8):
    - If current membership is still ACTIVE:
      new_start_date = current membership expiry date + 1 day
      new_end_date = new_start_date + 1 year - 1 day
      (Preserves remaining active period without overwriting!)
    - If current membership is EXPIRED or NON_MEMBER:
      new_start_date = current date
      new_end_date = current date + 1 year - 1 day
    """
    now = _to_utc(current_time or now_utc())
    
    if is_membership_active(customer, now) and customer.membership_end_date is not None:
        curr_end = _to_utc(customer.membership_end_date)
        # Start next day 00:00:00
        new_start = (curr_end + timedelta(seconds=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        _, new_end = calculate_membership_dates(new_start, years)
        return new_start, new_end
    
    return calculate_membership_dates(now, years)


def serialize_membership_info(customer: Customer, current_time: Optional[datetime] = None) -> Dict[str, Any]:
    """Serializes customer membership status and metadata for API responses."""
    now = _to_utc(current_time or now_utc())
    status = get_effective_membership_status(customer, now)
    is_active = status == STATUS_ACTIVE
    
    is_expiring_soon = False
    days_until_expiry = None

    start_date = customer.membership_start_date
    end_date = customer.membership_end_date

    # Fallback for legacy/manually created members missing explicit dates
    if is_active and end_date is None:
        base_start = customer.created_at or customer.membership_created_at or now
        s_dt, e_dt = calculate_membership_dates(base_start, years=1)
        start_date = s_dt
        end_date = e_dt
    
    if is_active and end_date is not None:
        end_dt = _to_utc(end_date)
        if end_dt:
            diff = (end_dt - now).total_seconds()
            days_until_expiry = max(0, int(diff // 86400))
            is_expiring_soon = 0 <= days_until_expiry <= EXPIRING_SOON_DAYS

    return {
        "is_member": is_active,
        "membership_status": status,
        "membership_start_date": start_date.isoformat() if start_date else None,
        "membership_end_date": end_date.isoformat() if end_date else None,
        "membership_type": customer.membership_type or (DEFAULT_MEMBERSHIP_TYPE if is_active or status == STATUS_EXPIRED else None),
        "membership_created_by": customer.membership_created_by,
        "membership_created_at": customer.membership_created_at.isoformat() if customer.membership_created_at else None,
        "membership_updated_at": customer.membership_updated_at.isoformat() if customer.membership_updated_at else None,
        "is_expiring_soon": is_expiring_soon,
        "days_until_expiry": days_until_expiry,
    }
