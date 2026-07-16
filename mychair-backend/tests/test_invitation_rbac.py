import pytest

from app.auth.invitation_rbac import (
    ROLE_EMPLOYEE,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    assert_can_invite_role,
    can_invite,
    can_invite_role,
)
from app.core.exceptions import PermissionDeniedException


class TestInvitationRbac:
    def test_super_admin_can_invite_all(self):
        assert can_invite_role("super_admin", ROLE_SALON_OWNER)
        assert can_invite_role("super_admin", ROLE_SALON_MANAGER)
        assert can_invite_role("super_admin", ROLE_EMPLOYEE)

    def test_salon_owner_can_invite_manager_and_staff(self):
        assert can_invite_role(ROLE_SALON_OWNER, ROLE_SALON_MANAGER)
        assert can_invite_role(ROLE_SALON_OWNER, ROLE_EMPLOYEE)
        assert not can_invite_role(ROLE_SALON_OWNER, ROLE_SALON_OWNER)

    def test_manager_can_only_invite_staff(self):
        assert can_invite_role(ROLE_SALON_MANAGER, ROLE_EMPLOYEE)
        assert not can_invite_role(ROLE_SALON_MANAGER, ROLE_SALON_MANAGER)

    def test_employee_cannot_invite(self):
        assert not can_invite("employee")
        with pytest.raises(PermissionDeniedException):
            assert_can_invite_role("employee", ROLE_EMPLOYEE)
