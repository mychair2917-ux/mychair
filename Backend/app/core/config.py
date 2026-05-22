from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Salon ERP SaaS"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = Field(default="SUPER_SECRET_SECURITY_KEY_FOR_SALON_ERP_CHANGEME_IN_PRODUCTION")
    REFRESH_SECRET_KEY: str = Field(default="SUPER_SECRET_REFRESH_SECURITY_KEY_CHANGEME_IN_PRODUCTION")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    
    # Database
    MONGODB_URI: str = Field(default="mongodb://mongodb:27017")
    MONGODB_DB_NAME: str = Field(default="Mychair")
    
    # Redis
    REDIS_URI: str = Field(default="redis://redis:6379/0")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # System Admin Credentials (for bootstrapping)
    SYSTEM_ADMIN_EMAIL: str = "admin@salonerp.com"
    SYSTEM_ADMIN_PASSWORD: str = "Admin@123456"

    # Email (Resend)
    RESEND_API_KEY: str = Field(default="")
    FRONTEND_URL: str = Field(default="http://localhost:8082")
    EMAIL_FROM: str = Field(default="MyChair <onboarding@resend.dev>")
    # Resend test mode only delivers to this verified inbox (see resend.com/domains for production)
    RESEND_TEST_EMAIL: str = Field(default="my.chair2917@gmail.com")

    # Invitation
    INVITATION_TOKEN_EXPIRE_HOURS: int = 72

settings = Settings()
