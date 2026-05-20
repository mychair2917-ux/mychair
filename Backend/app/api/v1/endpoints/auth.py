from fastapi import APIRouter, Depends, HTTPException, status
from app.core.exceptions import AuthException
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.core import tenant_context
from pydantic import BaseModel, EmailStr

router = APIRouter()

class BootstrapTenantRequest(BaseModel):
    tenant_name: str
    tenant_slug: str
    owner_first_name: str
    owner_last_name: str
    owner_email: EmailStr
    owner_password: str

@router.post("/bootstrap", response_model=TokenResponse)
async def bootstrap_tenant(payload: BootstrapTenantRequest) -> dict:
    """
    SaaS Bootstrapping API.
    Registers a brand new Salon Tenant along with its primary owner profile.
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
        hashed_password=hashed_pwd,
        first_name=payload.owner_first_name,
        last_name=payload.owner_last_name,
        role="owner",
        is_active=True
    )
    await user.insert()
    
    user_id_str = str(user.id)
    
    # 4. Generate Session tokens
    access_token = create_access_token(subject=user_id_str, tenant_id=tenant_id_str, role="owner")
    refresh_token = create_refresh_token(subject=user_id_str, tenant_id=tenant_id_str, role="owner")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": "owner",
        "tenant_id": tenant_id_str
    }


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> dict:
    """
    User Sign-in API.
    Validates user credentials and issues session-scoped JWT tokens.
    """
    user = await User.find_one(User.email == payload.email, User.is_deleted == False)
    if not user:
        raise AuthException("Invalid email or password")
        
    if not verify_password(payload.password, user.hashed_password):
        raise AuthException("Invalid email or password")
        
    if not user.is_active:
        raise AuthException("User account is suspended")
        
    tenant_id_str = user.tenant_id
    user_id_str = str(user.id)
    
    access_token = create_access_token(subject=user_id_str, tenant_id=tenant_id_str, role=user.role)
    refresh_token = create_refresh_token(subject=user_id_str, tenant_id=tenant_id_str, role=user.role)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": user.role,
        "tenant_id": tenant_id_str
    }
