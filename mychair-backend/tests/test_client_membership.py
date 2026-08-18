from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from app.services.customer_membership import (
    calculate_membership_dates,
    calculate_renewal_dates,
    get_effective_membership_status,
    is_membership_active,
    serialize_membership_info,
    STATUS_ACTIVE,
    STATUS_EXPIRED,
    STATUS_NON_MEMBER,
)
from app.api.v1.endpoints.customers import _can_manage_membership


def test_calculate_membership_dates_default_one_year():
    start = datetime(2026, 8, 18, 10, 0, 0, tzinfo=timezone.utc)
    s_date, e_date = calculate_membership_dates(start_date=start, years=1)
    
    assert s_date.year == 2026
    assert s_date.month == 8
    assert s_date.day == 18
    
    assert e_date.year == 2027
    assert e_date.month == 8
    assert e_date.day == 17
    assert e_date.hour == 23
    assert e_date.minute == 59
    assert e_date.second == 59


def test_get_effective_membership_status_active():
    now = datetime(2026, 8, 18, 12, 0, 0, tzinfo=timezone.utc)
    cust = SimpleNamespace(
        first_name="Jane",
        last_name="Doe",
        is_member=True,
        membership_status="ACTIVE",
        membership_start_date=datetime(2026, 8, 18, 0, 0, 0, tzinfo=timezone.utc),
        membership_end_date=datetime(2027, 8, 17, 23, 59, 59, tzinfo=timezone.utc),
    )
    
    assert get_effective_membership_status(cust, current_time=now) == STATUS_ACTIVE
    assert is_membership_active(cust, current_time=now) is True


def test_get_effective_membership_status_expired():
    now = datetime(2027, 8, 19, 12, 0, 0, tzinfo=timezone.utc)
    cust = SimpleNamespace(
        first_name="Jane",
        last_name="Doe",
        is_member=True,
        membership_status="ACTIVE",
        membership_start_date=datetime(2026, 8, 18, 0, 0, 0, tzinfo=timezone.utc),
        membership_end_date=datetime(2027, 8, 17, 23, 59, 59, tzinfo=timezone.utc),
    )
    
    # Expiry passes automatically without manual database updates
    assert get_effective_membership_status(cust, current_time=now) == STATUS_EXPIRED
    assert is_membership_active(cust, current_time=now) is False


def test_get_effective_membership_status_non_member():
    now = datetime(2026, 8, 18, 12, 0, 0, tzinfo=timezone.utc)
    cust = SimpleNamespace(
        first_name="John",
        last_name="Doe",
        is_member=False,
        membership_status="NON_MEMBER",
        membership_end_date=None,
    )
    
    assert get_effective_membership_status(cust, current_time=now) == STATUS_NON_MEMBER
    assert is_membership_active(cust, current_time=now) is False


def test_calculate_renewal_dates_preserves_active_duration():
    now = datetime(2026, 8, 18, 12, 0, 0, tzinfo=timezone.utc)
    cust = SimpleNamespace(
        first_name="Jane",
        last_name="Doe",
        is_member=True,
        membership_status="ACTIVE",
        membership_start_date=datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
        membership_end_date=datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc),
    )
    
    # Renewing while still active should extend from end date + 1 day
    r_start, r_end = calculate_renewal_dates(cust, years=1, current_time=now)
    assert r_start.year == 2027
    assert r_start.month == 1
    assert r_start.day == 1
    
    assert r_end.year == 2027
    assert r_end.month == 12
    assert r_end.day == 31


def test_calculate_renewal_dates_when_expired_starts_now():
    now = datetime(2027, 8, 18, 12, 0, 0, tzinfo=timezone.utc)
    cust = SimpleNamespace(
        first_name="Jane",
        last_name="Doe",
        is_member=True,
        membership_status="ACTIVE",
        membership_start_date=datetime(2025, 8, 18, 0, 0, 0, tzinfo=timezone.utc),
        membership_end_date=datetime(2026, 8, 17, 23, 59, 59, tzinfo=timezone.utc),
    )
    
    # Membership expired yesterday -> renewal starts today
    r_start, r_end = calculate_renewal_dates(cust, years=1, current_time=now)
    assert r_start.year == 2027
    assert r_start.month == 8
    assert r_start.day == 18
    
    assert r_end.year == 2028
    assert r_end.month == 8
    assert r_end.day == 17


def test_can_manage_membership_roles():
    owner = SimpleNamespace(role="salon_owner")
    manager = SimpleNamespace(role="salon_manager")
    admin = SimpleNamespace(role="salon_admin")
    super_admin = SimpleNamespace(role="super_admin")
    staff = SimpleNamespace(role="stylist")
    receptionist = SimpleNamespace(role="receptionist")
    
    assert _can_manage_membership(owner) is True
    assert _can_manage_membership(manager) is True
    assert _can_manage_membership(admin) is True
    assert _can_manage_membership(super_admin) is True
    assert _can_manage_membership(staff) is False
    assert _can_manage_membership(receptionist) is False


def test_serialize_membership_info_expiring_soon():
    now = datetime(2026, 8, 18, 12, 0, 0, tzinfo=timezone.utc)
    cust = SimpleNamespace(
        first_name="Jane",
        last_name="Doe",
        is_member=True,
        membership_status="ACTIVE",
        membership_start_date=datetime(2025, 9, 1, 0, 0, 0, tzinfo=timezone.utc),
        membership_end_date=datetime(2026, 8, 31, 23, 59, 59, tzinfo=timezone.utc),
        membership_type="Standard Membership",
        membership_created_by="user123",
        membership_created_at=datetime(2025, 9, 1, 0, 0, 0, tzinfo=timezone.utc),
        membership_updated_at=datetime(2025, 9, 1, 0, 0, 0, tzinfo=timezone.utc),
    )
    
    info = serialize_membership_info(cust, current_time=now)
    assert info["is_member"] is True
    assert info["membership_status"] == "ACTIVE"
    assert info["is_expiring_soon"] is True
    assert info["days_until_expiry"] <= 30
