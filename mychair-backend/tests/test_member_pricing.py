"""Unit tests for member vs normal service pricing resolution."""
from app.services.member_pricing import (
    PRICING_TYPE_MANUAL,
    PRICING_TYPE_MEMBER,
    PRICING_TYPE_NORMAL,
    resolve_applied_service_price,
    resolve_catalog_service_price,
)


def test_non_member_always_gets_normal_price():
    price, pricing_type = resolve_catalog_service_price(
        is_member=False, normal_price=30.0, member_price=25.0
    )
    assert price == 30.0
    assert pricing_type == PRICING_TYPE_NORMAL


def test_member_gets_member_price_when_configured():
    price, pricing_type = resolve_catalog_service_price(
        is_member=True, normal_price=30.0, member_price=25.0
    )
    assert price == 25.0
    assert pricing_type == PRICING_TYPE_MEMBER


def test_member_falls_back_to_normal_when_member_price_missing():
    price, pricing_type = resolve_catalog_service_price(
        is_member=True, normal_price=50.0, member_price=None
    )
    assert price == 50.0
    assert pricing_type == PRICING_TYPE_NORMAL


def test_member_price_zero_is_valid_configured_price():
    price, pricing_type = resolve_catalog_service_price(
        is_member=True, normal_price=30.0, member_price=0.0
    )
    assert price == 0.0
    assert pricing_type == PRICING_TYPE_MEMBER


def test_non_member_cannot_select_member_catalog_price_via_submit():
    price, pricing_type = resolve_applied_service_price(
        is_member=False,
        normal_price=30.0,
        member_price=25.0,
        submitted_price=25.0,
    )
    assert price == 30.0
    assert pricing_type == PRICING_TYPE_NORMAL


def test_member_cannot_accidentally_keep_normal_catalog_price():
    price, pricing_type = resolve_applied_service_price(
        is_member=True,
        normal_price=30.0,
        member_price=25.0,
        submitted_price=30.0,
    )
    assert price == 25.0
    assert pricing_type == PRICING_TYPE_MEMBER


def test_manual_override_preserved_when_not_a_catalog_price():
    price, pricing_type = resolve_applied_service_price(
        is_member=True,
        normal_price=30.0,
        member_price=25.0,
        submitted_price=22.5,
    )
    assert price == 22.5
    assert pricing_type == PRICING_TYPE_MANUAL


def test_mixed_services_independent_resolution():
    haircut, haircut_type = resolve_catalog_service_price(
        is_member=True, normal_price=30.0, member_price=25.0
    )
    spa, spa_type = resolve_catalog_service_price(
        is_member=True, normal_price=50.0, member_price=None
    )
    assert (haircut, haircut_type) == (25.0, PRICING_TYPE_MEMBER)
    assert (spa, spa_type) == (50.0, PRICING_TYPE_NORMAL)
