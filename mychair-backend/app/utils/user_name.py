"""Shared user display-name helpers.

Display names must be human names — never an email address or email local-part.
"""
from __future__ import annotations

from typing import Any


from app.utils.title_case import to_title_case


def _attr(obj: Any, key: str) -> str:
    if obj is None:
        return ""
    if isinstance(obj, dict):
        value = obj.get(key)
    else:
        value = getattr(obj, key, None)
    return str(value).strip() if value is not None else ""


def _looks_like_email(value: str) -> bool:
    return "@" in value


def user_display_name(user: Any, *, fallback: str = "Unknown") -> str:
    """
    Resolve a person's display name from first/last name, then username.

    Never returns an email address or email local-part.
    Never returns the account role field.
    Formats returned display name in Title Case.
    """
    first = _attr(user, "first_name")
    last = _attr(user, "last_name")
    name = f"{first} {last}".strip()
    if name and not _looks_like_email(name):
        return to_title_case(name) or fallback

    for key in ("full_name", "name"):
        value = _attr(user, key)
        if value and not _looks_like_email(value):
            return to_title_case(value) or fallback

    username = _attr(user, "username")
    email = _attr(user, "email").lower()
    email_local = email.split("@", 1)[0] if "@" in email else ""
    if (
        username
        and not _looks_like_email(username)
        and username.lower() != email_local
    ):
        return to_title_case(username.replace("_", " ").strip()) or fallback

    return fallback

