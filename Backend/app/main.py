from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.connection import init_db
from app.db.redis import redis_client
from app.middleware.tenant import TenantMiddleware
from app.api.v1.router import api_router
from app.core.exceptions import SalonERPException
import logging

# Production logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Asynchronous Startup and Shutdown lifecycles hooks.
    Registers databases and cache pools safely.
    """
    logger.info("Initializing database connections...")
    await init_db()
    
    logger.info("Initializing Redis clients...")
    redis_client.init_redis()
    
    yield
    
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

# 3. Global custom exceptions mapping handler
@app.exception_handler(SalonERPException)
async def salon_erp_exception_handler(request: Request, exc: SalonERPException) -> JSONResponse:
    """Standardizes error response payloads across the entire API."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.__class__.__name__,
            "message": exc.detail
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
