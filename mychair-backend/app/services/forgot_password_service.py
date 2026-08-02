import hashlib
import logging
import re
import secrets
from datetime import timedelta
from typing import Dict, Any, Tuple, Optional

from app.core.config import settings
from app.core.exceptions import SalonERPException
from app.core.rate_limit import check_forgot_password_rate_limit
from app.core.security import get_password_hash
from app.models.user import User
from app.services.email_service import send_password_reset_email
from app.utils.timezone import now_utc, make_aware

logger = logging.getLogger("forgot_password_service")


class ForgotPasswordService:

    async def request_password_reset(self, email: str, client_ip: str) -> Dict[str, Any]:
        """
        Generates a 64-char cryptographically secure reset token, saves its SHA256 hash
        and 15-minute expiry in the User model, and sends a password reset email.
        Always returns a generic success message to prevent user enumeration.
        """
        normalized_email = email.strip().lower()

        # Enforce rate limiting per email and per IP
        await check_forgot_password_rate_limit(normalized_email, client_ip)

        # Case-insensitive user lookup by email across all user roles
        regex_pattern = f"^{re.escape(normalized_email)}$"
        user = await User.find_one({"email": {"$regex": regex_pattern, "$options": "i"}})

        if not user or not user.is_active:
            # Generic response to avoid revealing user existence
            logger.info("Password reset requested for non-existent or inactive email (identity masked)")
            return {
                "success": True,
                "message": "If an account exists, a password reset link has been sent.",
            }

        # Generate 64-character token using crypto random bytes
        raw_token = secrets.token_hex(32)
        # Store SHA256 hashed token only
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = now_utc() + timedelta(minutes=15)

        user.resetPasswordTokenHash = token_hash
        user.resetPasswordExpiresAt = expires_at
        await user.save()

        logger.info("Password reset requested for user_id=%s", str(user.id))

        frontend_base = settings.FRONTEND_URL.rstrip("/")
        reset_link = f"{frontend_base}/reset-password?token={raw_token}"

        user_name = user.first_name or user.username or ""
        await send_password_reset_email(
            to_email=user.email,
            reset_link=reset_link,
            recipient_name=user_name,
        )

        return {
            "success": True,
            "message": "If an account exists, a password reset link has been sent.",
        }

    async def validate_reset_token(self, raw_token: str) -> Dict[str, bool]:
        """
        Hashes incoming raw token and verifies whether a matching unexpired token exists.
        Returns {"valid": True} or {"valid": False}.
        """
        if not raw_token or not raw_token.strip():
            logger.warning("Invalid token attempt: empty token provided")
            return {"valid": False}

        clean_token = raw_token.strip().strip('"').strip("'")
        token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
        user = await User.find_one({"resetPasswordTokenHash": token_hash})

        if not user:
            logger.warning("Invalid token attempt: no matching user token hash found")
            return {"valid": False}

        if not user.resetPasswordExpiresAt:
            logger.warning("Invalid token attempt: missing resetPasswordExpiresAt for user_id=%s", str(user.id))
            return {"valid": False}

        expires_at = make_aware(user.resetPasswordExpiresAt)
        current_time = now_utc()

        if expires_at <= current_time:
            logger.warning("Expired token attempt for user_id=%s (expires_at=%s, current=%s)", str(user.id), expires_at, current_time)
            return {"valid": False}

        return {"valid": True}

    async def reset_password(
        self, raw_token: str, password: str, confirm_password: str
    ) -> Dict[str, Any]:
        """
        Verifies token, updates user password, clears token and expiry,
        updates passwordChangedAt, and invalidates all existing sessions.
        """
        if not raw_token or not raw_token.strip():
            logger.warning("Invalid token attempt during password reset: empty token")
            raise SalonERPException(
                status_code=400,
                detail="This reset link is invalid or expired.",
            )

        clean_token = raw_token.strip().strip('"').strip("'")
        token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
        user = await User.find_one({"resetPasswordTokenHash": token_hash})

        if not user:
            logger.warning("Invalid token attempt during password reset")
            raise SalonERPException(
                status_code=400,
                detail="This reset link is invalid or expired.",
            )

        if not user.resetPasswordExpiresAt:
            raise SalonERPException(
                status_code=400,
                detail="This reset link is invalid or expired.",
            )

        expires_at = make_aware(user.resetPasswordExpiresAt)
        current_time = now_utc()

        if expires_at <= current_time:
            logger.warning("Expired token attempt during password reset for user_id=%s", str(user.id))
            raise SalonERPException(
                status_code=400,
                detail="This reset link is invalid or expired.",
            )

        # Hash new password using existing authentication hashing
        user.hashed_password = get_password_hash(password)
        # Clear token fields (single-use)
        user.resetPasswordTokenHash = None
        user.resetPasswordExpiresAt = None
        # Record password change timestamp
        user.passwordChangedAt = current_time
        # Invalidate active sessions by incrementing refresh_token_version
        user.refresh_token_version = (user.refresh_token_version or 0) + 1

        await user.save()

        logger.info("Password reset completed successfully for user_id=%s", str(user.id))

        return {
            "success": True,
            "message": "Password updated successfully.",
        }
