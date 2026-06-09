from fastapi import APIRouter, Depends, HTTPException, status
from app.api.dependencies.auth import get_current_user
from app.core.exceptions import AuthException
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.schemas.invitation import SalonOwnerLoginRequest, TeamLoginRequest
from app.services.auth_login_service import AuthLoginService
from app.services.salon_owner_auth_service import SalonOwnerAuthService
from app.services.team_auth_service import TeamAuthService
from app.utils.api_response import success_response, error_response
from app.core import tenant_context
from pydantic import BaseModel, EmailStr
from app.utils.timezone import now_utc

router = APIRouter()
auth_login_service = AuthLoginService()
salon_owner_auth_service = SalonOwnerAuthService()
team_auth_service = TeamAuthService()

class BootstrapTenantRequest(BaseModel):
    tenant_name: str
    tenant_slug: str
    owner_first_name: str
    owner_last_name: str
    owner_email: EmailStr
    owner_phone: str
    owner_password: str

@router.post("/bootstrap", response_model=TokenResponse)
async def bootstrap_tenant(payload: BootstrapTenantRequest) -> dict:
    """
    SaaS Bootstrapping API.
    Registers a brand new Salon Tenant along with its primary salon_admin user.
    """
    # 1. Check if slug or email exists
    existing_tenant = await Tenant.find_one(Tenant.slug == payload.tenant_slug)
    if existing_tenant:
        raise HTTPException(status_code=400, detail="Tenant slug is already taken.")
        
    existing_user = await User.find_one(User.email == payload.owner_email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    # 2. Create Tenant document
    tenant = Tenant(
        name=payload.tenant_name,
        slug=payload.tenant_slug,
        owner_email=payload.owner_email,
        subscription_tier="PREMIUM",
        subscription_status="ACTIVE"
    )
    await tenant.insert()
    
    tenant_id_str = str(tenant.id)
    
    # 3. Create Owner credentials (isolated to newly created tenant)
    # Temporarily bind context for BaseTenantDocument hooks
    tenant_context.set_tenant_id(tenant_id_str)
    
    hashed_pwd = get_password_hash(payload.owner_password)
    user = User(
        email=payload.owner_email,
        phone=payload.owner_phone,
        hashed_password=hashed_pwd,
        first_name=payload.owner_first_name,
        last_name=payload.owner_last_name,
        role="salon_admin",
        is_active=True,
    )
    await user.insert()
    
    user_id_str = str(user.id)
    
    # 4. Generate Session tokens
    access_token = create_access_token(
        subject=user_id_str, tenant_id=tenant_id_str, role="salon_admin"
    )
    refresh_token = create_refresh_token(
        subject=user_id_str, tenant_id=tenant_id_str, role="salon_admin"
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": "salon_admin",
        "tenant_id": tenant_id_str,
    }


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> dict:
    """
    Email sign-in for super_admin, salon_owner, salon_admin, and email-based team users.
    Manager/staff provisioned with phone only should use POST /auth/team/login.
    """
    data, error_message = await auth_login_service.login(
        email=str(payload.email),
        password=payload.password,
    )
    if error_message:
        raise AuthException(error_message)
    return data


@router.post("/team/login")
async def team_login(payload: TeamLoginRequest):
    """Salon manager or staff sign-in with phone and password set by their salon."""
    data, error_message = await team_auth_service.login(
        phone=payload.phone,
        password=payload.password,
    )
    if error_message:
        return error_response(error_message, status_code=401)
    return success_response("Login successful", data=data)


@router.post("/salon-owner/login")
async def salon_owner_login(payload: SalonOwnerLoginRequest):
    """Salon owner sign-in after invitation acceptance."""
    data, error_message = await salon_owner_auth_service.login(
        email=payload.email,
        password=payload.password,
    )
    if error_message:
        return error_response(error_message, status_code=401)
    return success_response("Login successful", data=data)


class LogoutRequest(BaseModel):
    refresh_token: str = ""


@router.post("/logout")
async def logout(
    payload: LogoutRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Logs out the current user by incrementing refresh_token_version,
    which invalidates all existing refresh tokens for this account.
    The client must also clear its local auth storage after calling this.
    """
    current_user.refresh_token_version = (current_user.refresh_token_version or 0) + 1
    current_user.last_login = now_utc()
    await current_user.save()
    return success_response("Logged out successfully")
