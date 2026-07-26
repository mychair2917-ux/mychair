"""
Shared phone-number normalisation for customer (client) contact uniqueness.

Used by single-create flows and bulk import so formatting variants
(+91 / 91 / leading 0 / spaces) compare as the same number.
"""
from __future__ import annotations

import re
from typing import Any, List, Optional, Tuple

PHONE_MISSING = "missing"
PHONE_INVALID = "invalid"


def normalize_mobile(raw: Any) -> Tuple[Optional[str], Optional[str]]:
    """
    Strip spaces/dashes/brackets and optional +91 / 91 / leading 0.
    Returns (normalized_digits, error_code) where error_code is
    PHONE_MISSING, PHONE_INVALID, or None on success.
    """
    if raw is None:
        return None, PHONE_MISSING
    text = str(raw).strip()
    if not text:
        return None, PHONE_MISSING

    # Excel may give floats like 9876543210.0
    if isinstance(raw, float) and raw == int(raw):
        text = str(int(raw))
    elif re.fullmatch(r"\d+\.0+", text):
        text = text.split(".", 1)[0]

    cleaned = re.sub(r"[\s\-\(\)\.]", "", text)
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    if cleaned.startswith("91") and len(cleaned) > 10:
        cleaned = cleaned[2:]
    if cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]

    if not cleaned.isdigit():
        return None, PHONE_INVALID
    if len(cleaned) < 10 or len(cleaned) > 15:
        return None, PHONE_INVALID
    return cleaned, None


def phone_lookup_variants(normalized: str) -> List[str]:
    """Common stored formats that should match a normalised mobile."""
    variants = {normalized}
    if len(normalized) == 10:
        variants.update(
            {
                f"91{normalized}",
                f"+91{normalized}",
                f"0{normalized}",
                f"+91-{normalized}",
                f"+91 {normalized}",
            }
        )
    return list(variants)
