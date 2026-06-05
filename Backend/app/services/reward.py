"""
RewardService — award points to a customer after a finalized invoice.

Flow:
  1. Fetch (or create) RewardSettings for the tenant.
  2. If rewards disabled → skip.
  3. Load all RewardSegment rows for the tenant, sorted desc by min_bill_amount.
  4. Walk segments to find the *highest* one whose min_bill_amount <= bill_amount.
  5. Fall back to default_points when no segment matches.
  6. Persist a CustomerRewardTransaction and increment customer.reward_points.
  7. Also update customer.total_visits, total_spent, last_visit_at from the invoice.
"""

import logging
from typing import Optional
from app.models.customer import Customer
from app.models.reward_settings import RewardSettings, RewardSegment
from app.models.customer_reward_transaction import CustomerRewardTransaction
from app.utils.timezone import now_utc
from beanie import PydanticObjectId

logger = logging.getLogger("reward")


class RewardService:

    async def _get_or_create_settings(self, tenant_id: str) -> RewardSettings:
        """Return the tenant's RewardSettings row, creating a default one if absent."""
        settings = await RewardSettings.find_one(
            {"tenant_id": tenant_id, "is_deleted": False}
        )
        if not settings:
            settings = RewardSettings(tenant_id=tenant_id)
            await settings.insert()
        return settings

    async def award_points_for_invoice(
        self,
        customer_id: str,
        invoice_id: str,
        bill_amount: float,
        tenant_id: str,
    ) -> Optional[int]:
        """
        Award reward points for a completed invoice.
        Returns the points awarded, or None if rewards are disabled / customer not found.
        """
        try:
            settings = await self._get_or_create_settings(tenant_id)
            if not settings.is_enabled:
                return None

            # Resolve matching segment (highest threshold that doesn't exceed bill)
            segments = await RewardSegment.find(
                {"tenant_id": tenant_id, "is_deleted": False}
            ).sort("-min_bill_amount").to_list()

            points_to_award = settings.default_points
            for seg in segments:
                if bill_amount >= seg.min_bill_amount:
                    points_to_award = seg.reward_points
                    break  # first match is highest-value because list is sorted desc

            if points_to_award <= 0:
                return 0

            # Fetch customer
            try:
                cust_oid = PydanticObjectId(customer_id)
            except Exception:
                logger.warning("Invalid customer_id %s for reward", customer_id)
                return None

            customer = await Customer.find_one(
                {"_id": cust_oid, "tenant_id": tenant_id, "is_deleted": False}
            )
            if not customer:
                logger.warning("Customer %s not found for tenant %s", customer_id, tenant_id)
                return None

            # Persist reward transaction
            txn = CustomerRewardTransaction(
                customer_id=customer_id,
                invoice_id=invoice_id,
                bill_amount=bill_amount,
                points=points_to_award,
                type="EARNED",
                tenant_id=tenant_id,
            )
            await txn.insert()

            # Update customer aggregates
            customer.reward_points = (customer.reward_points or 0) + points_to_award
            customer.total_visits = (customer.total_visits or 0) + 1
            customer.total_spent = (customer.total_spent or 0.0) + bill_amount
            customer.last_visit_at = now_utc()
            await customer.save()

            return points_to_award

        except Exception as exc:
            logger.error("RewardService.award_points_for_invoice failed: %s", exc)
            return None

    async def update_customer_visit_stats(
        self,
        customer_id: str,
        bill_amount: float,
        tenant_id: str,
    ) -> None:
        """
        Update visit stats without awarding reward points (used as fallback when
        reward settings fetch itself fails, so at minimum stats are captured).
        """
        try:
            cust_oid = PydanticObjectId(customer_id)
            customer = await Customer.find_one(
                {"_id": cust_oid, "tenant_id": tenant_id, "is_deleted": False}
            )
            if customer:
                customer.total_visits = (customer.total_visits or 0) + 1
                customer.total_spent = (customer.total_spent or 0.0) + bill_amount
                customer.last_visit_at = now_utc()
                await customer.save()
        except Exception as exc:
            logger.error("RewardService.update_customer_visit_stats failed: %s", exc)
