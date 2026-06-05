"""
Customer Analytics — overview dashboard endpoint.
Aggregates customer KPIs and trend data for the Analytics Overview tab.
"""
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends

from app.api.dependencies.auth import PermissionChecker
from app.core import tenant_context
from app.models.customer import Customer
from app.models.customer_reward_transaction import CustomerRewardTransaction
from app.models.user import User
from app.utils.api_response import success_response
from app.utils.timezone import now_utc

router = APIRouter()


def _effective_tenant(current_user: User) -> Optional[str]:
    if current_user.role == "super_admin":
        return tenant_context.get_tenant_id()
    return str(current_user.tenant_id or "").strip() or None


@router.get("/overview")
async def get_analytics_overview(
    current_user: User = Depends(PermissionChecker("customer_analytics.view")),
):
    tenant_id = _effective_tenant(current_user)
    base_query: dict = {"is_deleted": False}
    if tenant_id:
        base_query["tenant_id"] = tenant_id

    now = now_utc()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    active_cutoff = now - timedelta(days=90)

    # Core KPIs
    all_customers = await Customer.find(base_query).to_list()
    total_customers = len(all_customers)

    active_customers = sum(
        1
        for c in all_customers
        if c.last_visit_at and c.last_visit_at >= active_cutoff
    )
    new_customers = sum(
        1 for c in all_customers if c.created_at and c.created_at >= month_start
    )
    repeat_customers = sum(1 for c in all_customers if (c.total_visits or 0) > 1)

    # Reward points issued (all time, only EARNED type)
    txn_query: dict = {"type": "EARNED", "is_deleted": False}
    if tenant_id:
        txn_query["tenant_id"] = tenant_id
    all_txns = await CustomerRewardTransaction.find(txn_query).to_list()
    total_reward_points_issued = sum(t.points for t in all_txns)

    # Top reward customer
    top_reward_customer = None
    top = max(all_customers, key=lambda c: c.reward_points or 0, default=None)
    if top and (top.reward_points or 0) > 0:
        top_reward_customer = {
            "id": str(top.id),
            "name": top.full_name.strip(),
            "points": top.reward_points or 0,
        }

    # Monthly new customers — last 6 months
    monthly_new_customers = []
    for i in range(5, -1, -1):
        # Compute start and end of each month going back i months
        target = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_offset = (target.month - 1 - i) % 12 + 1
        year_offset = target.year + ((target.month - 1 - i) // 12)
        m_start = target.replace(year=year_offset, month=month_offset, day=1)
        if month_offset == 12:
            m_end = m_start.replace(year=year_offset + 1, month=1, day=1)
        else:
            m_end = m_start.replace(month=month_offset + 1)
        count = sum(
            1
            for c in all_customers
            if c.created_at and m_start <= c.created_at < m_end
        )
        monthly_new_customers.append({
            "month": m_start.strftime("%b %Y"),
            "count": count,
        })

    # Reward points trend — last 6 months
    reward_points_trend = []
    for i in range(5, -1, -1):
        target = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_offset = (target.month - 1 - i) % 12 + 1
        year_offset = target.year + ((target.month - 1 - i) // 12)
        m_start = target.replace(year=year_offset, month=month_offset, day=1)
        if month_offset == 12:
            m_end = m_start.replace(year=year_offset + 1, month=1, day=1)
        else:
            m_end = m_start.replace(month=month_offset + 1)
        pts = sum(
            t.points
            for t in all_txns
            if t.created_at and m_start <= t.created_at < m_end
        )
        reward_points_trend.append({
            "month": m_start.strftime("%b %Y"),
            "points": pts,
        })

    return success_response(
        "Analytics overview retrieved successfully",
        data={
            "total_customers": total_customers,
            "active_customers": active_customers,
            "new_customers": new_customers,
            "repeat_customers": repeat_customers,
            "total_reward_points_issued": total_reward_points_issued,
            "top_reward_customer": top_reward_customer,
            "monthly_new_customers": monthly_new_customers,
            "reward_points_trend": reward_points_trend,
        },
    )
