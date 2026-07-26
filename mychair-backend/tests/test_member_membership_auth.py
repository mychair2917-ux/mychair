"""Authorization helpers for client membership changes."""
from app.api.v1.endpoints.customers import _can_manage_membership
from tests.conftest import make_user


def test_super_admin_can_manage_membership():
    assert _can_manage_membership(make_user("super_admin")) is True


def test_salon_owner_can_manage_membership():
    assert _can_manage_membership(make_user("salon_owner")) is True


def test_salon_admin_cannot_manage_membership():
    assert _can_manage_membership(make_user("salon_admin")) is False


def test_manager_cannot_manage_membership():
    assert _can_manage_membership(make_user("salon_manager")) is False


def test_employee_cannot_manage_membership():
    assert _can_manage_membership(make_user("employee")) is False
