import logging
from typing import Any, Dict, List, Optional, Set

from app.constants.feature_catalog import (
    ALL_FEATURE_KEYS,
    FEATURE_CATALOG,
    INITIAL_PLAN_FEATURES,
    PLAN_DISPLAY_NAMES,
)
from app.constants.subscription_options import PLAN_AMOUNTS, normalize_plan_name
from app.models.audit import AuditLog
from app.models.plan_config import PlanConfig
from app.models.subscription import Subscription
from app.services.subscription_service import SubscriptionService
from app.utils.timezone import now_utc

logger = logging.getLogger(__name__)


class PlanService:
    def __init__(self) -> None:
        self._subscription_service = SubscriptionService()

    async def seed_default_plans(self) -> None:
        """Seed initial plan configs if missing in database."""
        for plan_key, default_features in INITIAL_PLAN_FEATURES.items():
            existing = await PlanConfig.find_one(PlanConfig.plan_key == plan_key)
            if not existing:
                display_name = PLAN_DISPLAY_NAMES.get(plan_key, plan_key.title())
                price = PLAN_AMOUNTS.get(plan_key, 0.0)
                config = PlanConfig(
                    plan_key=plan_key,
                    display_name=display_name,
                    status="ACTIVE",
                    price=price,
                    currency="USD",
                    features=default_features,
                )
                await config.insert()
                logger.info(f"Seeded plan configuration for '{plan_key}' ({display_name})")

    async def list_plans_with_features(self) -> List[Dict[str, Any]]:
        """List all subscription plans with enabled features and subscriber stats."""
        await self.seed_default_plans()
        configs = await PlanConfig.find_all().to_list()
        all_subs = await Subscription.find_all().to_list()

        subscriber_counts: Dict[str, int] = {}
        for sub in all_subs:
            normalized = normalize_plan_name(sub.plan_name)
            if sub.status == "ACTIVE":
                subscriber_counts[normalized] = subscriber_counts.get(normalized, 0) + 1

        result: List[Dict[str, Any]] = []
        for config in configs:
            sub_count = subscriber_counts.get(config.plan_key, 0)
            result.append(
                {
                    "id": str(config.id),
                    "plan_key": config.plan_key,
                    "display_name": config.display_name,
                    "status": config.status,
                    "price": config.price,
                    "currency": config.currency,
                    "features": config.features,
                    "enabled_feature_count": len(config.features),
                    "total_catalog_features": len(ALL_FEATURE_KEYS),
                    "active_subscribers": sub_count,
                    "created_at": config.created_at.isoformat(),
                    "updated_at": config.updated_at.isoformat(),
                }
            )
        # Order logically: FREE_TRIAL, BASIC, PROFESSIONAL, ENTERPRISE
        order = ["FREE_TRIAL", "BASIC", "PROFESSIONAL", "ENTERPRISE"]
        result.sort(key=lambda x: order.index(x["plan_key"]) if x["plan_key"] in order else 99)
        return result

    async def get_plan_by_key(self, plan_key: str) -> Optional[PlanConfig]:
        normalized = normalize_plan_name(plan_key)
        config = await PlanConfig.find_one(PlanConfig.plan_key == normalized)
        if not config:
            await self.seed_default_plans()
            config = await PlanConfig.find_one(PlanConfig.plan_key == normalized)
        return config

    async def update_plan_features(
        self,
        plan_key: str,
        feature_keys: List[str],
        updated_by: Optional[str] = None,
    ) -> PlanConfig:
        normalized = normalize_plan_name(plan_key)
        config = await self.get_plan_by_key(normalized)
        if not config:
            raise ValueError(f"Plan '{plan_key}' not found")

        # Sanitize feature keys against feature catalog
        valid_features = [f for f in feature_keys if f in ALL_FEATURE_KEYS]
        old_features = list(config.features)

        config.features = valid_features
        config.updated_at = now_utc()
        config.updated_by = updated_by
        await config.save()

        # Write to AuditLog
        try:
            audit = AuditLog(
                tenant_id="system",
                user_id=updated_by,
                action="UPDATE_PLAN_FEATURES",
                entity_name="PlanConfig",
                entity_id=str(config.id),
                before_state={"plan_key": normalized, "features": old_features},
                after_state={"plan_key": normalized, "features": valid_features},
            )
            await audit.insert()
        except Exception as e:
            logger.warning(f"Failed to record audit log for plan update: {e}")

        return config

    async def get_enabled_features_for_tenant(self, tenant_id: str) -> List[str]:
        """Dynamically resolve enabled feature keys for a given tenant based on their active subscription."""
        if not tenant_id or tenant_id == "system":
            return ALL_FEATURE_KEYS

        sub = await self._subscription_service.get_active_for_tenant(tenant_id)
        if not sub or not self._subscription_service.is_subscription_valid(sub):
            return []

        plan_key = normalize_plan_name(sub.plan_name)
        config = await PlanConfig.find_one(PlanConfig.plan_key == plan_key)
        if config:
            return config.features

        # Fallback to initial defaults if DB config not present yet
        return INITIAL_PLAN_FEATURES.get(plan_key, [])

    async def is_feature_enabled_for_tenant(self, tenant_id: str, feature_key: str) -> bool:
        if not tenant_id or tenant_id == "system":
            return True
        features = await self.get_enabled_features_for_tenant(tenant_id)
        return feature_key in features
