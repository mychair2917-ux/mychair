import hashlib
import json
import logging
from typing import List

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("config")

_DEFAULT_SECRET = "SUPER_SECRET_SECURITY_KEY_FOR_SALON_ERP_CHANGEME_IN_PRODUCTION"
_DEFAULT_REFRESH_SECRET = "SUPER_SECRET_REFRESH_SECURITY_KEY_CHANGEME_IN_PRODUCTION"

# UAT / local defaults only — production values must come from environment variables.
_UAT_CORS_ORIGINS = [
    "http://localhost:5173",
]
_UAT_FRONTEND_URL = "http://localhost:5173"
_UAT_BACKEND_PUBLIC_URL = "http://localhost:8000"
_UAT_MONGO_URI = "mongodb://localhost:27017"
_UAT_REDIS_URI = "redis://localhost:6379/0"


class Settings(BaseSettings):
    """
    Centralized configuration loaded entirely from environment variables.

    Supported environments (ENVIRONMENT or legacy ENV):
      - uat          → local infrastructure defaults when vars are unset
      - production   → all critical values required from the environment
      - development  → treated the same as uat (backward compatible)
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Salon ERP SaaS"
    API_V1_STR: str = "/api/v1"

    # Runtime — ENVIRONMENT is preferred; ENV remains a supported alias.
    ENV: str = Field(
        default="uat",
        validation_alias=AliasChoices("ENVIRONMENT", "ENV"),
    )
    PORT: int = Field(default=8000)

    # Security (JWT_SECRET is an alias for SECRET_KEY)
    SECRET_KEY: str = Field(
        default=_DEFAULT_SECRET,
        validation_alias=AliasChoices("JWT_SECRET", "SECRET_KEY"),
    )
    REFRESH_SECRET_KEY: str = Field(default=_DEFAULT_REFRESH_SECRET)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Database (MONGO_URL is the preferred name; MONGODB_URI kept for backward compatibility)
    MONGODB_URI: str = Field(
        default="",
        validation_alias=AliasChoices("MONGO_URL", "MONGODB_URI"),
    )
    MONGODB_DB_NAME: str = Field(default="Mychair")

    # Redis (REDIS_URL is the preferred name; REDIS_URI kept for backward compatibility)
    REDIS_URI: str = Field(
        default="",
        validation_alias=AliasChoices("REDIS_URL", "REDIS_URI"),
    )

    # CORS — never use wildcard when credentials are enabled
    BACKEND_CORS_ORIGINS: List[str] = Field(default_factory=list)

    # System Admin Credentials (for bootstrapping)
    SYSTEM_ADMIN_EMAIL: str = "admin@salonerp.com"
    SYSTEM_ADMIN_PASSWORD: str = "Admin@123456"

    # Email (Resend) — sender built as `{RESEND_FROM_NAME} <{RESEND_FROM_EMAIL}>`
    RESEND_API_KEY: str = Field(default="")
    FRONTEND_URL: str = Field(default="")
    EMAIL_FROM: str = Field(default="MyChair <onboarding@resend.dev>")
    RESEND_TEST_EMAIL: str = Field(default="")

    # Invitation
    INVITATION_TOKEN_EXPIRE_HOURS: int = 72

    # Public URLs / generated assets
    BACKEND_PUBLIC_URL: str = Field(default="")
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
    WHATSAPP_REVIEW_URL: str = Field(default="")

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> List[str]:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value  # type: ignore[return-value]

    @staticmethod
    def _is_local_uri(uri: str) -> bool:
        lowered = uri.lower()
        return "localhost" in lowered or "127.0.0.1" in lowered

    @staticmethod
    def _normalize_environment(raw: str) -> str:
        value = (raw or "uat").strip().lower()
        if value in {"development", "dev", "local"}:
            return "uat"
        if value in {"prod", "production"}:
            return "production"
        if value == "uat":
            return "uat"
        return value

    @model_validator(mode="after")
    def apply_environment_defaults(self) -> "Settings":
        normalized = self._normalize_environment(self.ENV)
        # Keep ENV attribute aligned with the two supported environments.
        self.ENV = normalized
        is_production = normalized == "production"

        if not self.MONGODB_URI:
            if is_production:
                raise ValueError("MONGO_URL (or MONGODB_URI) is required when ENVIRONMENT=production")
            self.MONGODB_URI = _UAT_MONGO_URI

        if not self.REDIS_URI:
            if is_production:
                raise ValueError("REDIS_URL (or REDIS_URI) is required when ENVIRONMENT=production")
            self.REDIS_URI = _UAT_REDIS_URI

        frontend_origin = self.FRONTEND_URL.rstrip("/")
        if frontend_origin and frontend_origin not in self.BACKEND_CORS_ORIGINS:
            self.BACKEND_CORS_ORIGINS = [*self.BACKEND_CORS_ORIGINS, frontend_origin]

        if is_production:
            if self.SECRET_KEY == _DEFAULT_SECRET:
                raise ValueError("JWT_SECRET (or SECRET_KEY) must be set when ENV=production")
            if self.REFRESH_SECRET_KEY == _DEFAULT_REFRESH_SECRET:
                raise ValueError("REFRESH_SECRET_KEY must be set when ENV=production")
            if "*" in self.BACKEND_CORS_ORIGINS:
                raise ValueError("Wildcard CORS origins are not allowed when ENV=production")
            if self._is_local_uri(self.MONGODB_URI):
                raise ValueError("Local MongoDB URIs are not allowed when ENV=production")
            if self._is_local_uri(self.REDIS_URI):
                raise ValueError("Local Redis URIs are not allowed when ENV=production")
            if not self.BACKEND_PUBLIC_URL.strip():
                logger.warning(
                    "BACKEND_PUBLIC_URL is not set in production; "
                    "generated asset links (e.g. invoice PDFs) may be broken."
                )
            else:
                self.BACKEND_PUBLIC_URL = _UAT_BACKEND_PUBLIC_URL

        if is_production:
            if self.SECRET_KEY == _DEFAULT_SECRET:
                raise ValueError("JWT_SECRET (or SECRET_KEY) must be set when ENVIRONMENT=production")
            if self.REFRESH_SECRET_KEY == _DEFAULT_REFRESH_SECRET:
                raise ValueError("REFRESH_SECRET_KEY must be set when ENVIRONMENT=production")
            if "*" in self.BACKEND_CORS_ORIGINS:
                raise ValueError("Wildcard CORS origins are not allowed when ENVIRONMENT=production")
            if self._is_local_uri(self.MONGODB_URI):
                raise ValueError("Local MongoDB URIs are not allowed when ENVIRONMENT=production")
            if self._is_local_uri(self.REDIS_URI):
                raise ValueError("Local Redis URIs are not allowed when ENVIRONMENT=production")

        return self

    @property
    def is_production(self) -> bool:
        return self._normalize_environment(self.ENV) == "production"

    @property
    def is_uat(self) -> bool:
        return self._normalize_environment(self.ENV) == "uat"

    @property
    def resend_from(self) -> str:
        """Resend `from` header: Display Name <email@domain>."""
        name = (self.RESEND_FROM_NAME or "").strip()
        email = (self.RESEND_FROM_EMAIL or "").strip()
        if name and email:
            return f"{name} <{email}>"
        return email or name

    @property
    def whatsapp_bearer_token(self) -> str:
        return self.WHATSAPP_TOKEN or self.WHATSAPP_ACCESS_TOKEN

    @staticmethod
    def mask_uri(uri: str) -> str:
        """Redact credentials from connection strings for safe logging."""
        if "@" not in uri:
            return uri
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            _creds, host = rest.rsplit("@", 1)
            return f"{scheme}://***@{host}"
        return uri

    @staticmethod
    def secret_fingerprint(secret: str) -> str:
        """
        Non-reversible 12-char fingerprint for verifying shared secrets
        across API and worker without logging the raw value.
        """
        return hashlib.sha256(secret.encode()).hexdigest()[:12]


settings = Settings()
