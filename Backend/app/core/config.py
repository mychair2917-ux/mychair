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
    MONGODB_URI: str = Field(default="mongodb://localhost:27017")
    MONGODB_DB_NAME: str = Field(default="salon_erp_prod")
    
    # Redis
    REDIS_URI: str = Field(default="redis://localhost:6379/0")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # System Admin Credentials (for bootstrapping)
    SYSTEM_ADMIN_EMAIL: str = "admin@salonerp.com"
    SYSTEM_ADMIN_PASSWORD: str = "Admin@123456"

settings = Settings()
