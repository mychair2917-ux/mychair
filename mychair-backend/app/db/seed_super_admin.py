import asyncio
import hashlib
import logging
import os
import sys

# Add the parent directory to sys.path so 'app' can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.db.connection import init_db
from app.models.user import User

logger = logging.getLogger(__name__)


async def ensure_super_admin() -> None:
    """Create or update the platform super_admin with hashed SHA-256 password."""
    email = settings.SYSTEM_ADMIN_EMAIL.strip().lower()
    raw_password = settings.SYSTEM_ADMIN_PASSWORD

    if not email or not raw_password:
        logger.warning("SYSTEM_ADMIN_EMAIL/PASSWORD not set; skipping super admin seed")
        return

    # Pre-hash raw password to SHA-256 hex if it's not already a 64-character hex hash
    if len(raw_password) == 64 and all(c in "0123456789abcdefABCDEF" for c in raw_password):
        sha256_password = raw_password
    else:
        sha256_password = hashlib.sha256(raw_password.encode("utf-8")).hexdigest()

    existing_admin = await User.find_one(
        User.email == email,
        User.role == "super_admin",
        User.is_deleted == False,
    )
    if existing_admin:
        if not verify_password(sha256_password, existing_admin.hashed_password):
            logger.info("Updating existing super admin password hash for: %s", email)
            existing_admin.hashed_password = get_password_hash(sha256_password)
            await existing_admin.save()
        else:
            logger.info("Super admin already exists and password hash is up to date: %s", email)
        return

    super_admin = User(
        email=email,
        hashed_password=get_password_hash(sha256_password),
        role="super_admin",
        status="ACTIVE",
        is_active=True,
        first_name="Super",
        last_name="Admin",
    )
    await super_admin.insert()
    logger.info("Created super admin user: %s", email)


async def seed() -> None:
    await init_db()
    await ensure_super_admin()


if __name__ == "__main__":
    from app.core.logging_config import setup_logging

    setup_logging()
    asyncio.run(seed())
