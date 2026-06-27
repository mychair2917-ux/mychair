import asyncio
import logging
import os
import sys

# Add the parent directory to sys.path so 'app' can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.connection import init_db
from app.models.user import User

logger = logging.getLogger(__name__)


async def ensure_super_admin() -> None:
    """Create the platform super_admin if it does not already exist."""
    email = settings.SYSTEM_ADMIN_EMAIL.strip().lower()
    password = settings.SYSTEM_ADMIN_PASSWORD

    if not email or not password:
        logger.warning("SYSTEM_ADMIN_EMAIL/PASSWORD not set; skipping super admin seed")
        return

    existing_admin = await User.find_one(
        User.email == email,
        User.role == "super_admin",
        User.is_deleted == False,
    )
    if existing_admin:
        logger.info("Super admin already exists: %s", email)
        return

    super_admin = User(
        email=email,
        hashed_password=get_password_hash(password),
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
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
