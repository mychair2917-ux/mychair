from app.auth.invitation_rbac import (
    ROLE_EMPLOYEE,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    uses_direct_password_provisioning,
)


class TestDirectInviteProvision:
    def test_salon_owner_inviting_staff_uses_direct_setup(self):
        assert uses_direct_password_provisioning(ROLE_SALON_OWNER, ROLE_EMPLOYEE)
        assert uses_direct_password_provisioning(ROLE_SALON_OWNER, ROLE_SALON_MANAGER)

    def test_super_admin_still_uses_email_flow(self):
        assert not uses_direct_password_provisioning("super_admin", ROLE_EMPLOYEE)

    def test_salon_owner_invite_not_direct(self):
        assert not uses_direct_password_provisioning("super_admin", ROLE_SALON_OWNER)
