from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from jose import jwt
from app.core import tenant_context
from app.core.config import settings

class TenantMiddleware(BaseHTTPMiddleware):
    """
    HTTP Middleware that runs on every request.
    Extracts the JWT authorization token, decodes tenant claims, and binds them to
    thread-safe ContextVars for automatic database-level repository tenant isolation.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        authorization: str = request.headers.get("Authorization", "")
        
        # Default states
        tenant_id = None
        user_id = None
        
        # Also allow tenant identification via custom header (for non-authenticated lookups if needed)
        custom_tenant = request.headers.get("X-Tenant-ID")
        if custom_tenant:
            tenant_id = custom_tenant

        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
            try:
                # Decode the JWT claim
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                user_id = payload.get("sub")
                token_tenant_id = payload.get("tenant_id")
                if token_tenant_id == "system" and custom_tenant:
                    tenant_id = custom_tenant.strip() or token_tenant_id
                else:
                    tenant_id = token_tenant_id
            except jwt.JWTError:
                # We do not raise an HTTP exception here as some routes are public.
                # Route dependencies will enforce authorization where required.
                pass
                
        # Set thread-safe context
        token_tenant = tenant_context._current_tenant_id.set(tenant_id)
        token_user = tenant_context._current_user_id.set(user_id)
        
        try:
            response = await call_next(request)
            return response
        finally:
            # Clear context post-execution to prevent memory leaks or context contamination
            tenant_context._current_tenant_id.reset(token_tenant)
            tenant_context._current_user_id.reset(token_user)
