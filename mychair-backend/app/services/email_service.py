import logging
import re
from typing import Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("email_service")

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_recipient(to_email: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Validate preferred/recipient email before calling Resend."""
    if to_email is None or not str(to_email).strip():
        return None, "Preferred email is required"
    cleaned = str(to_email).strip()
    if not _EMAIL_PATTERN.match(cleaned):
        return None, "Preferred email is invalid"
    return cleaned, None


def _parse_resend_error(response: httpx.Response) -> str:
    try:
        body = response.json()
        message = body.get("message") or body.get("error") or response.text
    except Exception:
        message = response.text or "Unknown Resend API error"

    if response.status_code == 403 and "testing emails" in message.lower():
        return (
            "Resend rejected the recipient. Verify your domain at resend.com/domains "
            "and ensure RESEND_FROM_EMAIL uses that domain."
        )
    if response.status_code == 401:
        return "Invalid Resend API key. Check RESEND_API_KEY in your environment."
    return f"Email delivery failed: {message}"


def _require_resend_config() -> Optional[str]:
    if not settings.RESEND_API_KEY:
        return "RESEND_API_KEY is not configured on the server."
    if not (settings.RESEND_FROM_EMAIL or "").strip():
        return "RESEND_FROM_EMAIL is not configured on the server."
    if not (settings.RESEND_FROM_NAME or "").strip():
        return "RESEND_FROM_NAME is not configured on the server."
    return None


async def send_email(
    *,
    to_email: str,
    subject: str,
    html: str,
    reply_to: Optional[str] = None,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Reusable Resend sender for invitations, OTP, password reset,
    appointment confirmation, invoices, welcome emails, etc.
    Returns (success, error_message, provider_message_id).
    """
    config_error = _require_resend_config()
    if config_error:
        return False, config_error, None

    recipient, validation_error = _validate_recipient(to_email)
    if validation_error:
        return False, validation_error, None

    from_header = settings.resend_from
    reply = (reply_to or settings.RESEND_FROM_EMAIL).strip()

    payload = {
        "from": from_header,
        "to": [recipient],
        "subject": subject,
        "html": html,
        "reply_to": reply,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if response.status_code in (200, 201):
                message_id = None
                try:
                    message_id = response.json().get("id")
                except Exception:
                    message_id = None
                logger.info(
                    "Email sent via Resend from=%s to=%s subject=%s id=%s",
                    from_header,
                    recipient,
                    subject,
                    message_id,
                )
                return True, None, message_id
            error_msg = _parse_resend_error(response)
            logger.error(
                "Resend API error: status=%s body=%s payload_to=%s from=%s",
                response.status_code,
                response.text,
                recipient,
                from_header,
            )
            return False, error_msg, None
    except Exception as exc:
        logger.exception("Failed to send email via Resend to %s: %s", recipient, exc)
        return False, f"Email service unavailable: {exc}", None


async def _send_templated_email(
    *,
    to_email: str,
    subject: str,
    html: str,
) -> Tuple[bool, Optional[str]]:
    """Wrapper that returns the historical (success, error) pair for invitation helpers."""
    success, error, _message_id = await send_email(
        to_email=to_email,
        subject=subject,
        html=html,
    )
    return success, error


def _build_invitation_email_html(
    *,
    recipient_name: str,
    salon_name: str,
    username: str,
    invitation_link: str,
    intended_recipient: str,
    inviter_name: str,
    expiry_hours: int,
) -> str:
    greeting_name = recipient_name.strip() or "there"
    inviter_line = ""
    if inviter_name.strip():
        inviter_line = f"""
                    <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Invited By</p>
                    <p style="margin:0 0 16px;color:#1a1a2e;font-size:16px;font-weight:600;">{inviter_name.strip()}</p>"""

    support_email = settings.RESEND_FROM_EMAIL.strip()
    hour_word = "hour" if expiry_hours == 1 else "hours"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MyChair Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#d4a853;font-size:28px;font-weight:700;letter-spacing:1px;">MyChair</h1>
              <p style="margin:8px 0 0;color:#a0a0b0;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Salon ERP Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;font-weight:600;">You're Invited!</h2>
              <p style="margin:0 0 16px;color:#4a4a5a;font-size:15px;line-height:1.6;">
                Hi {greeting_name}, welcome to <strong>MyChair</strong>. You have been invited to manage your salon on our platform.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#f8f8fa;border-radius:8px;border:1px solid #e8e8ec;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Salon Name</p>
                    <p style="margin:0 0 16px;color:#1a1a2e;font-size:16px;font-weight:600;">{salon_name}</p>
                    {inviter_line}
                    <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Username</p>
                    <p style="margin:0 0 16px;color:#1a1a2e;font-size:16px;font-weight:600;">{username}</p>
                    <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Invited Email</p>
                    <p style="margin:0;color:#1a1a2e;font-size:16px;font-weight:600;">{intended_recipient}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 28px;color:#4a4a5a;font-size:15px;line-height:1.6;">
                Click the button below to accept your invitation and set up your account password.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:8px;background:linear-gradient(135deg,#d4a853,#b8923f);">
                    <a href="{invitation_link}" target="_blank"
                       style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;color:#8a8a9a;font-size:13px;line-height:1.5;">
                This invitation link expires in {expiry_hours} {hour_word}. If you did not expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background:#f8f8fa;border-top:1px solid #e8e8ec;text-align:center;">
              <p style="margin:0;color:#8a8a9a;font-size:12px;">
                &copy; MyChair Salon ERP &mdash; Need help? Contact {support_email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def send_team_invitation_email(
    to_email: str,
    invitee_name: str,
    role_label: str,
    salon_name: str,
    invitation_link: str,
    inviter_name: str = "",
    expiry_hours: Optional[int] = None,
) -> Tuple[bool, Optional[str]]:
    """Send staff/manager invitation email via Resend API."""
    hours = expiry_hours if expiry_hours is not None else settings.INVITATION_TOKEN_EXPIRE_HOURS
    hour_word = "hour" if hours == 1 else "hours"
    inviter_bit = f" by {inviter_name.strip()}" if inviter_name.strip() else ""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;">
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#1a1a2e;">You're invited to join {salon_name}</h2>
          <p style="color:#4a4a5a;">Hi {invitee_name or 'there'}, you have been invited as <strong>{role_label}</strong> on MyChair{inviter_bit}.</p>
          <p style="margin:24px 0;"><a href="{invitation_link}" style="display:inline-block;padding:14px 36px;background:#d4a853;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Accept Invitation</a></p>
          <p style="color:#8a8a9a;font-size:13px;">This link expires in {hours} {hour_word}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    return await _send_templated_email(
        to_email=to_email,
        subject=f"MyChair — Invitation to join {salon_name} as {role_label}",
        html=html_content,
    )


def _format_expiry_date(expiry_date) -> str:
    from app.utils.timezone import make_aware

    dt = make_aware(expiry_date)
    return dt.strftime("%d/%m/%Y")


def _build_subscription_expiry_email_html(
    salon_name: str,
    plan_label: str,
    expiry_date_display: str,
    days_remaining: int,
    intended_recipient: str,
) -> str:
    day_word = "day" if days_remaining == 1 else "days"
    support_email = settings.RESEND_FROM_EMAIL.strip()

    return f"""<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#d4a853;font-size:26px;font-weight:700;">MyChair</h1>
            <p style="margin:8px 0 0;color:#a0a0b0;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Subscription Reminder</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;">Your subscription is expiring soon</h2>
            <p style="margin:0 0 20px;color:#4a4a5a;font-size:15px;line-height:1.6;">
              This is a reminder that your MyChair salon subscription will expire in
              <strong>{days_remaining} {day_word}</strong>.
            </p>
            <table role="presentation" width="100%" style="margin:20px 0;background:#f8f8fa;border-radius:8px;border:1px solid #e8e8ec;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Salon Name</p>
                <p style="margin:0 0 16px;color:#1a1a2e;font-size:16px;font-weight:600;">{salon_name}</p>
                <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Current Plan</p>
                <p style="margin:0 0 16px;color:#1a1a2e;font-size:16px;font-weight:600;">{plan_label}</p>
                <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Expiry Date</p>
                <p style="margin:0 0 16px;color:#1a1a2e;font-size:16px;font-weight:600;">{expiry_date_display}</p>
                <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Account Email</p>
                <p style="margin:0 0 16px;color:#1a1a2e;font-size:16px;font-weight:600;">{intended_recipient}</p>
                <p style="margin:0 0 8px;color:#6a6a7a;font-size:13px;">Days Remaining</p>
                <p style="margin:0;color:#b45309;font-size:16px;font-weight:600;">{days_remaining} {day_word}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;color:#4a4a5a;font-size:15px;line-height:1.6;">
              To continue uninterrupted access, please contact your MyChair administrator to renew your subscription.
            </p>
            <p style="margin:0;color:#8a8a9a;font-size:13px;">
              Need help? Reply to this email or contact {support_email}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;background:#f8f8fa;border-top:1px solid #e8e8ec;text-align:center;">
            <p style="margin:0;color:#8a8a9a;font-size:12px;">&copy; MyChair Salon ERP</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_subscription_expiry_email(
    to_email: str,
    salon_name: str,
    plan_label: str,
    expiry_date,
    days_remaining: int,
) -> Tuple[bool, Optional[str]]:
    """Send subscription expiry reminder email."""
    html_content = _build_subscription_expiry_email_html(
        salon_name=salon_name,
        plan_label=plan_label,
        expiry_date_display=_format_expiry_date(expiry_date),
        days_remaining=days_remaining,
        intended_recipient=to_email,
    )
    day_word = "day" if days_remaining == 1 else "days"
    return await _send_templated_email(
        to_email=to_email,
        subject=f"MyChair — Subscription expires in {days_remaining} {day_word} ({salon_name})",
        html=html_content,
    )


async def send_invitation_email(
    to_email: str,
    salon_name: str,
    username: str,
    invitation_link: str,
    recipient_name: str = "",
    inviter_name: str = "",
    expiry_hours: Optional[int] = None,
) -> Tuple[bool, Optional[str]]:
    """Send salon owner invitation email via Resend API. Returns (success, error_message)."""
    hours = expiry_hours if expiry_hours is not None else settings.INVITATION_TOKEN_EXPIRE_HOURS
    html_content = _build_invitation_email_html(
        recipient_name=recipient_name,
        salon_name=salon_name,
        username=username,
        invitation_link=invitation_link,
        intended_recipient=to_email,
        inviter_name=inviter_name,
        expiry_hours=hours,
    )

    return await _send_templated_email(
        to_email=to_email,
        subject=f"MyChair — Invitation to manage {salon_name}",
        html=html_content,
    )
