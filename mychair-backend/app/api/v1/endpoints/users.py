from typing import List
from fastapi import APIRouter, Depends, status
from app.api.dependencies.auth import get_current_user
from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.services.user_service import UserService

router = APIRouter()
user_service = UserService()


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        phone=user.phone,
        role=user.role,
        permissions=user.permissions,
        is_active=user.is_active,
        first_name=user.first_name,
        last_name=user.last_name,
        employee_id=user.employee_id,
        tenant_id=user.tenant_id,
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_module(Module.USER_MANAGEMENT)),
) -> UserResponse:
    user = await user_service.create_user(payload, current_user)
    return _user_response(user)


@router.get("/", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_module(Module.USER_MANAGEMENT)),
) -> List[UserResponse]:
    users = await user_service.list_users(current_user)
    return [_user_response(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_module(Module.USER_MANAGEMENT)),
) -> UserResponse:
    user = await user_service.get_user(user_id, current_user)
    return _user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user: User = Depends(require_module(Module.USER_MANAGEMENT)),
) -> UserResponse:
    user = await user_service.update_user(user_id, payload, current_user)
    return _user_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_module(Module.USER_MANAGEMENT)),
) -> dict:
    await user_service.delete_user(user_id, current_user)
    return {"message": "User soft-deleted"}
