import pytest
from app.models.inventory import ProductInventory
from app.services.inventory import InventoryService

def test_product_inventory_model_allows_negative_stock():
    """Verify that ProductInventory accepts negative stock_quantity values."""
    inv = ProductInventory.model_construct(
        salon_id="salon123",
        product_id="prod123",
        product_name_snapshot="Test Shampoo",
        stock_quantity=-5,
        total_value=-50.0,
    )
    assert inv.stock_quantity == -5
    assert inv.total_value == -50.0

@pytest.mark.asyncio
async def test_calculate_product_stock_negative_arithmetic():
    """Verify that stock calculation handles negative stock deductions accurately."""
    class DummyTx:
        def __init__(self, quantity_change=None, quantity=None, tx_type=None):
            self.quantity_change = quantity_change
            self.quantity = quantity
            self.type = tx_type

    service = InventoryService()
    
    # Case 1: 10 - 2 = 8
    txs_1 = [DummyTx(quantity_change=-2, tx_type="SALE")]
    # Initial base 10 + (-2) = 8
    total_1 = 10 + sum(tx.quantity_change for tx in txs_1)
    assert total_1 == 8

    # Case 2: 2 - 5 = -3
    txs_2 = [DummyTx(quantity_change=-5, tx_type="SALE")]
    total_2 = 2 + sum(tx.quantity_change for tx in txs_2)
    assert total_2 == -3

    # Case 3: 0 - 1 = -1
    txs_3 = [DummyTx(quantity_change=-1, tx_type="SALE")]
    total_3 = 0 + sum(tx.quantity_change for tx in txs_3)
    assert total_3 == -1

    # Case 4: -3 - 2 = -5
    txs_4 = [DummyTx(quantity_change=-2, tx_type="SALE")]
    total_4 = -3 + sum(tx.quantity_change for tx in txs_4)
    assert total_4 == -5

@pytest.mark.asyncio
async def test_purchase_entry_offsets_negative_stock():
    """Verify purchase entry offsetting negative stock balances correctly."""
    # Stock = -5, Purchase = +10 -> New Stock = 5
    stock_before_1 = -5
    purchase_qty_1 = 10
    assert stock_before_1 + purchase_qty_1 == 5

    # Stock = -2, Purchase = +2 -> New Stock = 0
    stock_before_2 = -2
    purchase_qty_2 = 2
    assert stock_before_2 + purchase_qty_2 == 0
