import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.leave import LeaveService
from tests.conftest import make_user


@pytest.mark.asyncio
async def test_list_pending_for_salon_owner_does_not_filter_by_their_own_id():
    actor = make_user("salon_owner", user_id="owner_123", tenant_id="tenant_abc")
    service = LeaveService()
    
    # Mock repositories
    service.repo = MagicMock()
    service.repo.list_paginated = AsyncMock(return_value=([], 0))
    service.attendance_repo = MagicMock()

    # Call list_pending
    await service.list_pending(actor)

    # Verify list_paginated was called
    service.repo.list_paginated.assert_called_once()
    
    # Check that the filter has tenant_id but DOES NOT filter by employee_id/owner_123
    called_args, called_kwargs = service.repo.list_paginated.call_args
    filters = called_args[0]
    
    assert filters["tenant_id"] == "tenant_abc"
    assert filters["status"] == "PENDING"
    assert "employee_id" not in filters


@pytest.mark.asyncio
async def test_list_pending_for_super_admin_does_not_filter_by_their_own_id():
    actor = make_user("super_admin", user_id="admin_123", tenant_id="system")
    service = LeaveService()
    
    # Mock repositories
    service.repo = MagicMock()
    service.repo.list_paginated = AsyncMock(return_value=([], 0))
    service.attendance_repo = MagicMock()

    # Call list_pending with a specific salon_id
    await service.list_pending(actor, salon_id="tenant_xyz")

    # Verify list_paginated was called
    service.repo.list_paginated.assert_called_once()
    
    # Check that the filter has tenant_id but DOES NOT filter by employee_id/admin_123
    called_args, called_kwargs = service.repo.list_paginated.call_args
    filters = called_args[0]
    
    assert filters["tenant_id"] == "tenant_xyz"
    assert filters["status"] == "PENDING"
    assert "employee_id" not in filters
