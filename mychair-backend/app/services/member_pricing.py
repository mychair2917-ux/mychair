"""
Centralized member vs normal service pricing.

Membership pricing is a catalog price type, not a discount.
Historical appointments always keep snapshotted applied prices.
"""
from __future__ import annotations

from typing import Optional, Tuple

PRICING_TYPE_NORMAL = "NORMAL"
PRICING_TYPE_MEMBER = "MEMBER"
PRICING_TYPE_MANUAL = "MANUAL"

_PRICE_EPSILON = 0.005


def _has_member_price(member_price: Optional[float]) -> bool:
    """True when a real member price is configured (not None / missing)."""
    return member_price is not None


def resolve_catalog_service_price(
    *,
    is_member: bool,
    normal_price: float,
    member_price: Optional[float],
) -> Tuple[float, str]:
    """
    Resolve the catalog price for a client + service.

    Member + configured member_price → member price
    Otherwise → normal price (never treat missing member price as 0)
    """
    if bool(is_member) and _has_member_price(member_price):
        return float(member_price), PRICING_TYPE_MEMBER
    return float(normal_price), PRICING_TYPE_NORMAL


def resolve_applied_service_price(
    *,
    is_member: bool,
    normal_price: float,
    member_price: Optional[float],
    submitted_price: Optional[float] = None,
) -> Tuple[float, str]:
    """
    Resolve the price to snapshot on an appointment line.

    - Default / catalog match → membership-correct catalog price
    - Submitted price matching the *other* catalog price → still enforce catalog
      (prevents non-members from selecting member price via the API)
    - Any other submitted amount → treated as a manual override (existing POS behavior)
    """
    catalog_price, pricing_type = resolve_catalog_service_price(
        is_member=is_member,
        normal_price=normal_price,
        member_price=member_price,
    )

    if submitted_price is None:
        return catalog_price, pricing_type

    submitted = float(submitted_price)
    if abs(submitted - catalog_price) < _PRICE_EPSILON:
        return catalog_price, pricing_type

    catalog_candidates = {float(normal_price)}
    if _has_member_price(member_price):
        catalog_candidates.add(float(member_price))

    if any(abs(submitted - candidate) < _PRICE_EPSILON for candidate in catalog_candidates):
        return catalog_price, pricing_type

    return submitted, PRICING_TYPE_MANUAL
