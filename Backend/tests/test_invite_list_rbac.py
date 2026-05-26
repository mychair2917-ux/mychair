import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.auth.invitation_rbac import (
    ROLE_EMPLOYEE,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    viewable_invite_roles,
)
from app.services.invite_service import InviteService
from tests.conftest import make_user


class TestViewableInviteRoles:
    def test_super_admin_sees_all_roles(self):
        assert viewable_invite_roles("super_admin") is None

    def test_salon_owner_sees_all_roles_in_salon(self):
        assert viewable_invite_roles(ROLE_SALON_OWNER) is None

    def test_manager_sees_staff_only(self):
        assert viewable_invite_roles(ROLE_SALON_MANAGER) == frozenset({ROLE_EMPLOYEE})

    def test_employee_sees_none(self):
        assert viewable_invite_roles(ROLE_EMPLOYEE) == frozenset()


@pytest.mark.asyncio
class TestListInvitesScope:
    async def test_manager_scoped_to_tenant_and_staff(self):
        actor = make_user(ROLE_SALON_MANAGER, tenant_id="tenant-abc")
        service = InviteService()

        mock_find = MagicMock()
        mock_find.sort.return_value.to_list = AsyncMock(return_value=[])

        with patch("app.services.invite_service.Invite.find", return_value=mock_find) as find_mock:
            await service.list_invites(actor)

        find_mock.assert_called_once_with(
            {
                "role": {"$in": [ROLE_EMPLOYEE]},
                "salon_id": "tenant-abc",
            }
        )

    async def test_employee_gets_empty_list(self):
        actor = make_user(ROLE_EMPLOYEE)
        service = InviteService()
        result = await service.list_invites(actor)
        assert result == []
