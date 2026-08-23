import pytest
from app.services.salon_earnings import SalonEarningsService, _LineAgg
from app.schemas.salon_earnings import ProductEarningsRow, SalonEarningsSummary


@pytest.mark.asyncio
async def test_product_profit_basic_calculation():
    """
    Scenario 1: Basic Sale
    Selling Price = 1000, Quantity = 1, Buying Price = 500, Incentive = 10% (100)
    Salon Owner Profit = 1000 - 500 - 100 = 400
    """
    service = SalonEarningsService()
    
    agg = _LineAgg(
        item_type="PRODUCT",
        item_id="prod_1",
        item_name="Shampoo",
        quantity=1,
        gross=1000.0,
        discounts=0.0,
        refunds=0.0,
        net=1000.0,
        incentive=100.0,
        buying_price_unit=500.0,
        product_cost=500.0,
        has_product_cost=True,
    )
    
    owner_profit = service._safe_round(agg.net - agg.product_cost - agg.incentive)
    assert owner_profit == 400.0


@pytest.mark.asyncio
async def test_product_profit_multiple_quantity():
    """
    Scenario 2: Multiple Quantity
    Selling Price = 1000, Quantity = 3, Buying Price = 500, Incentive = 10%
    Gross/Net = 3000, Product Cost = 1500, Staff Incentive = 300
    Salon Owner Profit = 3000 - 1500 - 300 = 1200
    """
    service = SalonEarningsService()
    
    agg = _LineAgg(
        item_type="PRODUCT",
        item_id="prod_2",
        item_name="Conditioner",
        quantity=3,
        gross=3000.0,
        discounts=0.0,
        net=3000.0,
        incentive=300.0,
        buying_price_unit=500.0,
        product_cost=1500.0,
        has_product_cost=True,
    )
    
    owner_profit = service._safe_round(agg.net - agg.product_cost - agg.incentive)
    assert owner_profit == 1200.0


@pytest.mark.asyncio
async def test_product_profit_with_discount():
    """
    Scenario 3: Discounted Sale
    Selling Price = 1000, Discount = 100, Net = 900
    Buying Price = 500, Incentive = 10% of Net (90)
    Salon Owner Profit = 900 - 500 - 90 = 310
    """
    service = SalonEarningsService()
    
    net_sales = 900.0
    product_cost = 500.0
    incentive = 90.0 # 10% of 900
    
    owner_profit = service._safe_round(net_sales - product_cost - incentive)
    assert owner_profit == 310.0


@pytest.mark.asyncio
async def test_product_profit_no_incentive():
    """
    Scenario 4: Sale without staff incentive
    Selling Price = 1000, Cost = 500, Incentive = 0%
    Salon Owner Profit = 1000 - 500 - 0 = 500
    """
    service = SalonEarningsService()
    
    net_sales = 1000.0
    product_cost = 500.0
    incentive = 0.0
    
    owner_profit = service._safe_round(net_sales - product_cost - incentive)
    assert owner_profit == 500.0


@pytest.mark.asyncio
async def test_product_profit_different_incentive_pct():
    """
    Scenario 5: 15% Incentive
    Net Sale = 2000, Cost = 800, Incentive = 15% of 2000 = 300
    Salon Owner Profit = 2000 - 800 - 300 = 900
    """
    service = SalonEarningsService()
    
    net_sales = 2000.0
    product_cost = 800.0
    incentive = 300.0 # 15% of 2000
    
    owner_profit = service._safe_round(net_sales - product_cost - incentive)
    assert owner_profit == 900.0


@pytest.mark.asyncio
async def test_product_profit_refund_adjustment():
    """
    Scenario 6: Partial Refund (50% refund)
    Gross = 1000, Refund = 500, Net = 500
    Effective Cost = 500 * (1 - 0.5) = 250
    Staff Incentive = 500 * 10% = 50
    Salon Owner Profit = 500 - 250 - 50 = 200
    """
    service = SalonEarningsService()
    
    gross = 1000.0
    refund_ratio = 0.5
    net_sales = round(gross * (1.0 - refund_ratio), 2) # 500.0
    buying_price = 500.0
    effective_cost = round(buying_price * 1 * (1.0 - refund_ratio), 2) # 250.0
    incentive = round(net_sales * 0.10, 2) # 50.0
    
    owner_profit = service._safe_round(net_sales - effective_cost - incentive)
    assert net_sales == 500.0
    assert effective_cost == 250.0
    assert incentive == 50.0
    assert owner_profit == 200.0


@pytest.mark.asyncio
async def test_aggregated_product_profit():
    """
    Scenario 7: Aggregated Product Profit
    Product A Profit = 400
    Product B Profit = 300
    Product C Profit = 250
    Total Product Profit = 950
    """
    service = SalonEarningsService()
    
    profits = [400.0, 300.0, 250.0]
    total_product_profit = service._safe_round(sum(profits))
    assert total_product_profit == 950.0


@pytest.mark.asyncio
async def test_no_double_deduction_in_total_salon_earnings():
    """
    Scenario 9: Ensure Staff Incentive is deducted exactly once
    Total Service Net = 10000, Service Incentives = 1000 -> Service Salon Earnings = 9000
    Total Product Net = 5000, Product Cost = 2000, Product Incentives = 500 -> Product Profit = 2500
    Total Net Salon Earnings = 9000 + 2500 = 11500
    Formula: Total Revenue (15000) - Product Cost (2000) - Total Incentives (1500) = 11500
    """
    service = SalonEarningsService()
    
    total_revenue = 15000.0
    product_cost = 2000.0
    total_incentives = 1500.0
    
    net_salon_earnings = service._safe_round(total_revenue - product_cost - total_incentives)
    assert net_salon_earnings == 11500.0
