from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from app.core.config import settings
from app.db.connection import init_db
from app.db.redis import redis_client
from app.middleware.tenant import TenantMiddleware
from app.api.v1.router import api_router
from app.core.exceptions import SalonERPException
from app.services.salon_product import SalonProductService
from app.services.salon_service import SalonServiceService
from app.services.system_settings_service import SystemSettingsService
from app.services.subscription_service import SubscriptionService
from app.services.subscription_expiry_service import run_subscription_reminder_loop
import logging

# Production logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")
salon_service_service = SalonServiceService()
salon_product_service = SalonProductService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Asynchronous Startup and Shutdown lifecycles hooks.
    Registers databases and cache pools safely.
    """
    logger.info("Initializing database connections...")
    await init_db()
    await salon_service_service.seed_master_services()
    await salon_product_service.seed_master_products()
    await SystemSettingsService().get_or_create()
    await SubscriptionService().ensure_salon_link_for_legacy_records()

    logger.info("Initializing Redis clients...")
    redis_client.init_redis()

    reminder_task = asyncio.create_task(run_subscription_reminder_loop())

    yield

    reminder_task.cancel()
    try:
        await reminder_task
    except asyncio.CancelledError:
        pass
    
    logger.info("Closing persistent database/cache links...")
    await redis_client.close_redis()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    version="1.0.0"
)

# 1. CORS Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Multi-Tenant context parsing middleware
app.add_middleware(TenantMiddleware)

# Public generated assets, including invoice PDFs shared over WhatsApp.
Path(settings.PUBLIC_ASSET_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.PUBLIC_ASSET_DIR), name="static")

# 3. Global custom exceptions mapping handler
@app.exception_handler(SalonERPException)
async def salon_erp_exception_handler(request: Request, exc: SalonERPException) -> JSONResponse:
    """Standardizes error response payloads across the entire API."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            "data": None,
            "errors": None,
        }
    )

# 4. Router injection
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root() -> dict:
    """Root health verification landing."""
    return {
        "app": settings.PROJECT_NAME,
        "status": "healthy",
        "documentation": "/docs"
    }
