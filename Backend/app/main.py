import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import Settings, settings
from app.core.exceptions import SalonERPException
from app.db.connection import close_db, init_db, ping_db
from app.db.seed_super_admin import ensure_super_admin
from app.db.redis import redis_client
from app.middleware.tenant import TenantMiddleware
from app.services.salon_product import SalonProductService
from app.services.salon_service import SalonServiceService
from app.services.subscription_expiry_service import run_subscription_reminder_loop
from app.services.subscription_service import SubscriptionService
from app.services.system_settings_service import SystemSettingsService

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
    logger.info("Backend starting...")
    logger.info("Environment: %s", settings.ENV)
    logger.info("JWT fingerprint: %s", Settings.secret_fingerprint(settings.SECRET_KEY))
    logger.info("Refresh fingerprint: %s", Settings.secret_fingerprint(settings.REFRESH_SECRET_KEY))

    logger.info("Connecting to MongoDB...")
    await init_db()
    await ensure_super_admin()

    await salon_service_service.seed_master_services()
    await salon_product_service.seed_master_products()
    await SystemSettingsService().get_or_create()
    await SubscriptionService().ensure_salon_link_for_legacy_records()

    logger.info("Connecting to Redis...")
    await redis_client.init_redis()

    reminder_task = asyncio.create_task(run_subscription_reminder_loop())
    listen_port = os.environ.get("PORT", str(settings.PORT))
    logger.info("Backend ready on port %s", listen_port)

    yield

    reminder_task.cancel()
    try:
        await reminder_task
    except asyncio.CancelledError:
        pass

    logger.info("Closing persistent database/cache links...")
    await redis_client.close_redis()
    await close_db()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TenantMiddleware)

Path(settings.PUBLIC_ASSET_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.PUBLIC_ASSET_DIR), name="static")


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
        },
    )


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health() -> dict:
    """Lightweight liveness probe — process is up (used by Render)."""
    return {"status": "ok"}


@app.get("/health/deep")
async def health_deep() -> JSONResponse:
    """
    Deep readiness probe — verifies MongoDB and Redis connectivity.
    Returns 503 when any dependency is unreachable.
    """
    mongo_ok = await ping_db()
    redis_ok = await redis_client.ping_redis()
    all_ok = mongo_ok and redis_ok

    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={
            "status": "ok" if all_ok else "degraded",
            "checks": {
                "mongodb": "ok" if mongo_ok else "fail",
                "redis": "ok" if redis_ok else "fail",
            },
        },
    )


@app.get("/")
async def root() -> dict:
    """Root landing with service metadata."""
    return {
        "app": settings.PROJECT_NAME,
        "status": "healthy",
        "documentation": "/docs",
    }
