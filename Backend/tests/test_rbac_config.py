from app.auth.rbac_config import (
    Module,
    ROLE_EMPLOYEE,
    ROLE_SALON_MANAGER,
    can_access_module,
    invite_list_roles_visible,
    invite_list_scoped_to_inviter,
    normalize_role,
)


class TestRbacConfig:
    def test_normalize_legacy_roles(self):
        assert normalize_role("admin") == "salon_admin"
        assert normalize_role("standard") == "employee"

    def test_super_admin_has_all_modules(self):
        assert can_access_module("super_admin", Module.SUBSCRIPTION_MANAGEMENT)

    def test_salon_owner_no_subscription(self):
        assert not can_access_module("salon_owner", Module.SUBSCRIPTION_MANAGEMENT)
        assert can_access_module("salon_owner", Module.SALON_MANAGEMENT)

    def test_salon_manager_limited_modules(self):
        assert can_access_module("salon_manager", Module.INVITE)
        assert can_access_module("salon_manager", Module.PRODUCTS_INVENTORY)
        assert not can_access_module("salon_manager", Module.USER_MANAGEMENT)

    def test_employee_dashboard_only(self):
        assert can_access_module("employee", Module.DASHBOARD)
        assert not can_access_module("employee", Module.INVITE)

    def test_invite_list_visibility(self):
        assert invite_list_roles_visible("super_admin") is None
        assert invite_list_roles_visible("salon_admin") == frozenset(
            {ROLE_SALON_MANAGER, ROLE_EMPLOYEE}
        )
        assert invite_list_roles_visible(ROLE_SALON_MANAGER) == frozenset({ROLE_EMPLOYEE})
        assert invite_list_roles_visible("employee") == frozenset()

    def test_invite_list_scoped_to_inviter(self):
        assert not invite_list_scoped_to_inviter("super_admin")
        assert invite_list_scoped_to_inviter("salon_owner")
        assert invite_list_scoped_to_inviter("salon_manager")
