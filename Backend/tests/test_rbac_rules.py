import pytest
from app.auth.rbac import can_create_role, can_manage_user
from app.core.exceptions import PermissionDeniedException
from app.auth.rbac import assert_valid_role


class TestCanCreateRole:
    def test_super_admin_can_create_salon_admin(self):
        assert can_create_role("super_admin", "salon_admin") is True

    def test_salon_admin_cannot_create_super_admin(self):
        assert can_create_role("salon_admin", "super_admin") is False

    def test_salon_admin_can_create_manager_and_employee(self):
        assert can_create_role("salon_admin", "salon_manager") is True
        assert can_create_role("salon_admin", "employee") is True

    def test_salon_manager_can_only_create_employee(self):
        assert can_create_role("salon_manager", "employee") is True
        assert can_create_role("salon_manager", "salon_manager") is False

    def test_employee_cannot_create_anyone(self):
        assert can_create_role("employee", "employee") is False
        assert can_create_role("employee", "salon_admin") is False


class TestCanManageUser:
    def test_employee_cannot_list(self):
        assert can_manage_user("employee", "employee", "list") is False

    def test_salon_admin_can_delete_lower_roles_only(self):
        assert can_manage_user("salon_admin", "employee", "delete") is True


class TestAssertValidRole:
    def test_invalid_role_raises(self):
        with pytest.raises(PermissionDeniedException):
            assert_valid_role("owner")
