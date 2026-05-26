import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.auth.rbac_config import ROLE_EMPLOYEE, ROLE_SALON_MANAGER, invite_list_roles_visible
from app.services.invite_service import InviteService
from tests.conftest import make_user


class TestInviteListRolesVisible:
    def test_super_admin_sees_all_roles(self):
        assert invite_list_roles_visible("super_admin") is None

    def test_salon_owner_sees_manager_and_staff(self):
        assert invite_list_roles_visible("salon_owner") == frozenset(
            {ROLE_SALON_MANAGER, ROLE_EMPLOYEE}
        )

    def test_manager_sees_staff_only(self):
        assert invite_list_roles_visible(ROLE_SALON_MANAGER) == frozenset({ROLE_EMPLOYEE})

    def test_employee_sees_none(self):
        assert invite_list_roles_visible("employee") == frozenset()


@pytest.mark.asyncio
class TestListInvitesScope:
    async def test_manager_scoped_to_tenant_inviter_and_staff(self):
        actor = make_user(ROLE_SALON_MANAGER, tenant_id="tenant-abc", user_id="mgr-1")
        service = InviteService()

        mock_find = MagicMock()
        mock_find.sort.return_value.to_list = AsyncMock(return_value=[])

        with patch("app.services.invite_service.Invite.find", return_value=mock_find) as find_mock:
            await service.list_invites(actor)

        find_mock.assert_called_once_with(
            {
                "role": {"$in": [ROLE_EMPLOYEE]},
                "salon_id": "tenant-abc",
                "invited_by": "mgr-1",
            }
        )

    async def test_employee_gets_empty_list(self):
        actor = make_user("employee")
        service = InviteService()
        result = await service.list_invites(actor)
        assert result == []
