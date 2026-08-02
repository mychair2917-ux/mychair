import hashlib
import secrets
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.core.exceptions import SalonERPException
from app.models.user import User
from app.schemas.auth import ResetPasswordFormRequest
from app.services.forgot_password_service import ForgotPasswordService
from app.utils.timezone import now_utc
from pydantic import ValidationError


@pytest.mark.asyncio
async def test_forgot_password_email_not_found_returns_generic_success():
    service = ForgotPasswordService()

    with patch.object(User, "find_one", new_callable=AsyncMock) as mock_find_one, \
         patch("app.services.forgot_password_service.check_forgot_password_rate_limit", new_callable=AsyncMock):
        mock_find_one.return_value = None

        result = await service.request_password_reset(
            email="nonexistent@example.com",
            client_ip="127.0.0.1",
        )

        assert result["success"] is True
        assert result["message"] == "If an account exists, a password reset link has been sent."
        mock_find_one.assert_called_once()


@pytest.mark.asyncio
async def test_forgot_password_existing_user_generates_token_and_sends_email():
    service = ForgotPasswordService()

    mock_user = MagicMock(spec=User)
    mock_user.id = "507f1f77bcf86cd799439011"
    mock_user.email = "testuser@salon.com"
    mock_user.is_active = True
    mock_user.first_name = "John"
    mock_user.save = AsyncMock()

    with patch.object(User, "find_one", new_callable=AsyncMock) as mock_find_one, \
         patch("app.services.forgot_password_service.check_forgot_password_rate_limit", new_callable=AsyncMock), \
         patch("app.services.forgot_password_service.send_password_reset_email", new_callable=AsyncMock) as mock_send_email:

        mock_find_one.return_value = mock_user

        result = await service.request_password_reset(
            email="testuser@salon.com",
            client_ip="127.0.0.1",
        )

        assert result["success"] is True
        assert result["message"] == "If an account exists, a password reset link has been sent."

        # Verify user token hash & expiry saved
        assert mock_user.resetPasswordTokenHash is not None
        assert len(mock_user.resetPasswordTokenHash) == 64  # SHA256 hex string
        assert mock_user.resetPasswordExpiresAt is not None
        assert mock_user.resetPasswordExpiresAt > now_utc()
        mock_user.save.assert_called_once()

        # Verify email sent with reset link containing token
        mock_send_email.assert_called_once()
        call_kwargs = mock_send_email.call_args.kwargs
        assert call_kwargs["to_email"] == "testuser@salon.com"
        assert "/reset-password?token=" in call_kwargs["reset_link"]


@pytest.mark.asyncio
async def test_validate_reset_token_success_and_failures():
    service = ForgotPasswordService()

    raw_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    mock_user = MagicMock(spec=User)
    mock_user.id = "507f1f77bcf86cd799439011"
    mock_user.resetPasswordTokenHash = token_hash
    mock_user.resetPasswordExpiresAt = now_utc() + timedelta(minutes=15)

    with patch.object(User, "find_one", new_callable=AsyncMock) as mock_find_one:
        # 1. Valid token
        mock_find_one.return_value = mock_user
        res_valid = await service.validate_reset_token(raw_token)
        assert res_valid == {"valid": True}

        # 2. Invalid token
        mock_find_one.return_value = None
        res_invalid = await service.validate_reset_token("invalid_token")
        assert res_invalid == {"valid": False}

        # 3. Expired token
        mock_user.resetPasswordExpiresAt = now_utc() - timedelta(minutes=1)
        mock_find_one.return_value = mock_user
        res_expired = await service.validate_reset_token(raw_token)
        assert res_expired == {"valid": False}

        # 4. Empty token
        res_empty = await service.validate_reset_token("")
        assert res_empty == {"valid": False}


@pytest.mark.asyncio
async def test_reset_password_success_clears_token_and_invalidates_sessions():
    service = ForgotPasswordService()

    raw_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    mock_user = MagicMock(spec=User)
    mock_user.id = "507f1f77bcf86cd799439011"
    mock_user.resetPasswordTokenHash = token_hash
    mock_user.resetPasswordExpiresAt = now_utc() + timedelta(minutes=10)
    mock_user.refresh_token_version = 2
    mock_user.save = AsyncMock()

    with patch.object(User, "find_one", new_callable=AsyncMock) as mock_find_one, \
         patch("app.services.forgot_password_service.get_password_hash", return_value="new_hashed_pwd"):

        mock_find_one.return_value = mock_user

        result = await service.reset_password(
            raw_token=raw_token,
            password="NewPassword123!",
            confirm_password="NewPassword123!",
        )

        assert result["success"] is True
        assert result["message"] == "Password updated successfully."

        # Token single-use check: token hash and expiry must be cleared
        assert mock_user.resetPasswordTokenHash is None
        assert mock_user.resetPasswordExpiresAt is None
        # Password hash updated
        assert mock_user.hashed_password == "new_hashed_pwd"
        # Session invalidation check
        assert mock_user.refresh_token_version == 3
        # Timestamp check
        assert mock_user.passwordChangedAt is not None

        mock_user.save.assert_called_once()


@pytest.mark.asyncio
async def test_reset_password_token_reuse_fails():
    service = ForgotPasswordService()

    raw_token = secrets.token_hex(32)

    # After initial reset, token hash in DB is cleared (None)
    with patch.object(User, "find_one", new_callable=AsyncMock) as mock_find_one:
        mock_find_one.return_value = None

        with pytest.raises(SalonERPException) as exc_info:
            await service.reset_password(
                raw_token=raw_token,
                password="NewPassword123!",
                confirm_password="NewPassword123!",
            )

        assert exc_info.value.status_code == 400
        assert "invalid or expired" in exc_info.value.detail.lower()


def test_password_validation_schema():
    # Valid password hash (e.g. 64 char hex string or min 8 chars)
    valid_req = ResetPasswordFormRequest(
        token="token123",
        password="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        confirmPassword="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )
    assert valid_req.password == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    # Less than 8 chars
    with pytest.raises(ValidationError):
        ResetPasswordFormRequest(
            token="token123",
            password="Pass1!",
            confirmPassword="Pass1!",
        )

    # Password mismatch
    with pytest.raises(ValidationError):
        ResetPasswordFormRequest(
            token="token123",
            password="ValidPassword123!",
            confirmPassword="DifferentPassword123!",
        )
