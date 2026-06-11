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

    # Public URLs / generated assets
    BACKEND_PUBLIC_URL: str = Field(default="http://localhost:8000")
    PUBLIC_ASSET_DIR: str = Field(default="public")

    # WhatsApp Cloud API
    WHATSAPP_API_VERSION: str = Field(default="v20.0")
    WHATSAPP_PHONE_NUMBER_ID: str = Field(default="")
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = Field(default="")
    WHATSAPP_TOKEN: str = Field(default="")
    WHATSAPP_ACCESS_TOKEN: str = Field(default="")
    WHATSAPP_TEST_RECIPIENT_PHONE: str = Field(default="")
    WHATSAPP_APPOINTMENT_TEMPLATE: str = Field(
        default="hello_world",
        description="Meta-approved template for outbound appointment notifications",
    )
    WHATSAPP_TEMPLATE_MODE: str = Field(
        default="test",
        description="WhatsApp template mode (e.g. test or production)",
    )
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = Field(default="mychair_whatsapp_verify")
    WHATSAPP_APP_SECRET: str = Field(default="")
    WHATSAPP_REVIEW_URL: str = Field(
        default="https://www.google.com/search?sca_esv=bcc915fd4b92abab&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOcJ5ezV20X7EEAKKAJz3tcNdv-Se-KF8Myz0yr_Zuj33T-BFluyiEgtq19z95gfAfUkYs7xUhtWNRWDN-k2bpl8NYOY4alNUvwo_zo5qFcJFbp8lzw%3D%3D&q=BOHO+UNISEX+SALON+Reviews&sa=X&ved=2ahUKEwi96I-6ofqUAxXnxjgGHaYfPL0Q0bkNegQILxAF&biw=1850&bih=966&dpr=1"
    )

    @property
    def whatsapp_bearer_token(self) -> str:
        return self.WHATSAPP_TOKEN or self.WHATSAPP_ACCESS_TOKEN

settings = Settings()
