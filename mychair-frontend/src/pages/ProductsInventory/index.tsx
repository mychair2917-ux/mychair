import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Download,
  Layers3,
  PackagePlus,
  TrendingDown,
} from 'lucide-react';
import { useParams } from 'react-router-dom';

import '../../utils/echarts-init';
import {
  Button,
  CommonDropdown,
  CommonTable,
  FormField,
  Input,
  showToast,
} from '../../components/common';
import { isSuperAdmin } from '../../config/rbac';
import { useDebouncedSearch } from '../../hooks';
import { useAppSelector } from '../../redux/hooks';
import {
  useGetBrandsQuery,
  useGetMasterProductsQuery,
} from '../../redux/slices/salonProducts/salonProductsApi';
import {
  useCreateInventoryPurchaseMutation,
  useCreateInventoryUseMutation,
  useGetInventoryOverviewQuery,
  useGetInventoryReportsQuery,
  useGetInventoryStocksQuery,
} from '../../redux/slices/inventory/inventoryApi';
import type { InventoryStockItem } from '../../redux/slices/inventory/Types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/currency';
import { formatDateDMY } from '../../utils/utilities';

type InventoryTab = 'overview' | 'stocks' | 'purchase' | 'usage' | 'reports';

const tabs: Array<{ key: InventoryTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'stocks', label: 'Stock Management' },
  { key: 'purchase', label: 'Purchase Entry' },
  { key: 'usage', label: 'Usage & Deduction' },
  { key: 'reports', label: 'Reports' },
];

const categories = ['General', 'Shampoo', 'Wax', 'Color', 'Conditioner', 'Treatment', 'Retail'];

const emptyPurchase = {
  productName: '',
  productId: undefined as string | undefined,
  brandName: '',
  brandId: undefined as string | undefined,
  buyingPrice: '',
  quantity: '',
  category: 'General',
  minThreshold: '5',
  notes: '',
};

const emptyUsage = {
  inventoryId: '',
  quantity: '',
  type: 'USAGE' as 'USAGE' | 'SALE',
  referenceId: '',
  notes: '',
};

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: string;
  sub?: string;
}> = ({ label, value, icon: Icon, tone, sub }) => (
  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', tone)}>
      <Icon className="h-5 w-5" />
    </div>
    <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
    <h3 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</h3>
    {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
  </div>
);

const ProductsInventory: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const salonId = orgId ?? (isSuperAdmin(user?.role) ? selectedSalonId : storedOrgId) ?? undefined;

  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [purchaseDraft, setPurchaseDraft] = useState(emptyPurchase);
  const [usageDraft, setUsageDraft] = useState(emptyUsage);
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const debouncedSearch = useDebouncedSearch(search, 300);

  const skip = !salonId;
  const { data: overviewData, isLoading: isLoadingOverview } = useGetInventoryOverviewQuery(
    { salon_id: salonId || '' },
    { skip }
  );
  const { data: stocksData, isLoading: isLoadingStocks } = useGetInventoryStocksQuery(
    {
      salon_id: salonId || '',
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
      brand: brandFilter || undefined,
    },
    { skip }
  );
  const { data: reportsData, isLoading: isLoadingReports } = useGetInventoryReportsQuery(
    {
      salon_id: salonId || '',
      start_date: reportStart || undefined,
      end_date: reportEnd || undefined,
      category: categoryFilter || undefined,
      brand: brandFilter || undefined,
    },
    { skip }
  );
  const { data: productsData, isLoading: isLoadingProducts } = useGetMasterProductsQuery();
  const { data: brandsData, isLoading: isLoadingBrands } = useGetBrandsQuery(
    salonId ? { salon_id: salonId } : undefined,
    { skip }
  );

  const [createPurchase, { isLoading: isCreatingPurchase }] = useCreateInventoryPurchaseMutation();
  const [createUse, { isLoading: isCreatingUse }] = useCreateInventoryUseMutation();

  const overview = overviewData?.data;
  const stocks = stocksData?.data ?? [];
  const reports = reportsData?.data;
  const productOptions = useMemo(
    () =>
      (productsData?.data ?? []).map((product) => ({
        value: product.id,
        label: product.name,
      })),
    [productsData]
  );
  const brandOptions = useMemo(
    () =>
      (brandsData?.data ?? []).map((brand) => ({
        value: brand.id,
        label: brand.name,
      })),
    [brandsData]
  );
  const stockOptions = useMemo(
    () =>
      stocks.map((stock) => ({
        value: stock.id,
        label: `${stock.display_name} - ${stock.stock_quantity} in stock`,
      })),
    [stocks]
  );

  const usageTrendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 24, right: 18, top: 24, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category',
        data: overview?.usage_trend.map((item) => formatDateDMY(item.date, item.date)) ?? [],
        axisLabel: { color: '#6B7280', fontSize: 11 },
      },
      yAxis: { type: 'value', axisLabel: { color: '#6B7280' } },
      series: [
        {
          name: 'Usage',
          type: 'line',
          smooth: true,
          data: overview?.usage_trend.map((item) => item.quantity) ?? [],
          areaStyle: { color: 'rgba(197,160,89,0.12)' },
          lineStyle: { color: 'var(--color-brand-gold)' },
          itemStyle: { color: 'var(--color-brand-gold)' },
        },
      ],
    }),
    [overview]
  );

  const updatePurchaseProduct = (value: string) => {
    const matched = productOptions.find((option) => option.value === value);
    setPurchaseDraft((current) => ({
      ...current,
      productName: matched?.label ?? value,
      productId: matched?.value,
    }));
  };

  const updatePurchaseBrand = (value: string) => {
    const matched = brandOptions.find((option) => option.value === value);
    setPurchaseDraft((current) => ({
      ...current,
      brandName: matched?.label ?? value,
      brandId: matched?.value,
    }));
  };

  const handlePurchase = async () => {
    if (!salonId) return;
    const productName = purchaseDraft.productName.trim();
    const brandName = purchaseDraft.brandName.trim();
    const quantity = Number(purchaseDraft.quantity);
    const buyingPrice = Number(purchaseDraft.buyingPrice);
    const minThreshold = Number(purchaseDraft.minThreshold || 0);
    if (!productName || !quantity || quantity <= 0 || Number.isNaN(quantity)) {
      showToast('warning', 'Select a product and enter a valid quantity');
      return;
    }
    if (Number.isNaN(buyingPrice) || buyingPrice < 0) {
      showToast('warning', 'Enter a valid buying price');
      return;
    }

    try {
      const response = await createPurchase({
        salon_id: salonId,
        body: {
          ...(purchaseDraft.productId
            ? { product_id: purchaseDraft.productId }
            : { custom_product_name: productName }),
          ...(brandName
            ? purchaseDraft.brandId
              ? { brand_id: purchaseDraft.brandId }
              : { custom_brand_name: brandName }
            : {}),
          buying_price: buyingPrice,
          quantity,
          category: purchaseDraft.category,
          min_threshold: Number.isNaN(minThreshold) ? 0 : minThreshold,
          notes: purchaseDraft.notes.trim() || undefined,
        },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Inventory purchase recorded');
        setPurchaseDraft(emptyPurchase);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to record purchase'));
    }
  };

  const handleUse = async () => {
    if (!salonId) return;
    const quantity = Number(usageDraft.quantity);
    if (!usageDraft.inventoryId || !quantity || quantity <= 0 || Number.isNaN(quantity)) {
      showToast('warning', 'Select stock item and enter a valid quantity');
      return;
    }
    try {
      const response = await createUse({
        salon_id: salonId,
        body: {
          inventory_id: usageDraft.inventoryId,
          quantity,
          type: usageDraft.type,
          reference_id: usageDraft.referenceId.trim() || undefined,
          notes: usageDraft.notes.trim() || undefined,
        },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Inventory deduction recorded');
        setUsageDraft(emptyUsage);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to record usage'));
    }
  };

  const exportReports = () => {
    const rows = reports?.transactions ?? [];
    const csv = [
      ['Date', 'Type', 'Product ID', 'Brand ID', 'Quantity', 'Price', 'Reference', 'Notes'],
      ...rows.map((row) => [
        formatDateDMY(row.created_at, ''),
        row.type,
        row.product_id ?? '',
        row.brand_id ?? '',
        row.quantity,
        row.price ?? '',
        row.reference_id ?? '',
        row.notes ?? '',
      ]),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-reports.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: InventoryStockItem['status']) => (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        status === 'OK' && 'bg-emerald-50 text-emerald-700',
        status === 'LOW' && 'bg-amber-50 text-amber-700',
        status === 'CRITICAL' && 'bg-red-50 text-red-700'
      )}
    >
      {status}
    </span>
  );

  if (!salonId && isSuperAdmin(user?.role)) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Select a salon from the header to manage products and inventory.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
            <Layers3 className="h-3.5 w-3.5" />
            Salon Management
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
            Products & Inventory
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track stock, purchases, usage deductions, and inventory reports for this salon.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
          {isLoadingStocks
            ? 'Refreshing inventory data...'
            : `${stocks.length} products tracked`}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition',
              activeTab === tab.key
                ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Total Products"
              value={overview?.total_products ?? 0}
              icon={Boxes}
              tone="bg-amber-50 text-amber-700"
            />
            <MetricCard
              label="Low Stock Alerts"
              value={overview?.low_stock_alerts ?? 0}
              icon={AlertTriangle}
              tone="bg-orange-50 text-orange-700"
            />
            <MetricCard
              label="Critical Items"
              value={overview?.critical_alerts ?? 0}
              icon={TrendingDown}
              tone="bg-red-50 text-red-700"
            />
            <MetricCard
              label="Categories"
              value={overview?.category_breakdown.length ?? 0}
              icon={BarChart3}
              tone="bg-emerald-50 text-emerald-700"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Usage trend</h2>
              <ReactECharts option={usageTrendOption} style={{ height: 260 }} showLoading={isLoadingOverview} />
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Low stock warnings</h2>
              <div className="mt-4 space-y-3">
                {(overview?.warnings ?? []).length ? (
                  overview?.warnings.map((warning) => (
                    <div key={warning.inventory_id} className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
                      <p className="font-semibold">{warning.product_name}</p>
                      <p>{warning.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">No low stock alerts.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Category breakdown</h2>
              <div className="mt-3 space-y-2 text-sm">
                {(overview?.category_breakdown ?? []).map((item) => (
                  <div key={item.category} className="flex justify-between">
                    <span>{item.category}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Brand distribution</h2>
              <div className="mt-3 space-y-2 text-sm">
                {(overview?.brand_distribution ?? []).map((item) => (
                  <div key={item.brand} className="flex justify-between">
                    <span>{item.brand}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stocks' && (
        <CommonTable
          data={stocks}
          rowKey="id"
          loading={isLoadingStocks}
          title="Stock management"
          subtitle="Track salon-wise stock by product and brand combination."
          enableGlobalSearch={false}
          filters={
            <div className="grid w-full gap-3 md:grid-cols-3">
              <Input
                placeholder="Search product, brand, category"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Input
                placeholder="Filter category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              />
              <CommonDropdown
                options={brandOptions}
                value={
                  brandOptions.find((option) => option.label === brandFilter)?.value ?? brandFilter
                }
                onChange={(value) => {
                  const matched = brandOptions.find((option) => option.value === String(value));
                  setBrandFilter(matched?.label ?? String(value));
                }}
                placeholder="Filter by brand"
                searchable
                loading={isLoadingBrands}
              />
            </div>
          }
          columns={[
            { key: 'display_name', header: 'Product Name', accessor: 'display_name', sortable: true },
            { key: 'category', header: 'Category', accessor: 'category', sortable: true },
            { key: 'stock_quantity', header: 'Current Stock', accessor: 'stock_quantity', sortable: true },
            { key: 'min_threshold', header: 'Minimum Threshold', accessor: 'min_threshold', sortable: true },
            { key: 'status', header: 'Status', render: (row) => statusBadge(row.status), sortable: true },
            {
              key: 'last_updated',
              header: 'Last Updated',
              render: (row) => formatDateDMY(row.last_updated, '-'),
              sortable: true,
            },
          ]}
          actions={[
            {
              type: 'custom',
              label: 'Mark as Used',
              onClick: (row) => {
                setUsageDraft((current) => ({ ...current, inventoryId: row.id, type: 'USAGE' }));
                setActiveTab('usage');
              },
            },
            {
              type: 'custom',
              label: 'Update Stock',
              onClick: (row) => {
                setPurchaseDraft((current) => ({
                  ...current,
                  productName: row.product_name,
                  productId: row.product_id,
                  brandName: row.brand_name ?? '',
                  brandId: row.brand_id ?? undefined,
                  buyingPrice: String(row.buying_price),
                  category: row.category,
                  minThreshold: String(row.min_threshold),
                }));
                setActiveTab('purchase');
              },
            },
            {
              type: 'custom',
              label: 'Adjust Quantity',
              onClick: (row) => {
                setUsageDraft((current) => ({ ...current, inventoryId: row.id, type: 'USAGE' }));
                setActiveTab('usage');
              },
            },
          ]}
          emptyTitle="No inventory products yet"
          emptyDescription="Use Purchase Entry to create products, brands, and stock records."
        />
      )}

      {activeTab === 'purchase' && (
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Purchase entry</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add stock purchases. New products or brands are created inline when no match exists.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField label="Product" name="purchaseProduct" required>
              <CommonDropdown
                options={productOptions}
                value={purchaseDraft.productId}
                onChange={(value) => updatePurchaseProduct(String(value))}
                placeholder="Search product"
                loading={isLoadingProducts}
              />
              <Input
                className="mt-2"
                placeholder="Or type new product"
                value={purchaseDraft.productName}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({
                    ...current,
                    productName: event.target.value,
                    productId: undefined,
                  }))
                }
              />
            </FormField>
            <FormField label="Brand" name="purchaseBrand">
              <div className="space-y-2">
                <CommonDropdown
                  options={brandOptions}
                  value={purchaseDraft.brandId}
                  onChange={(value) => updatePurchaseBrand(String(value))}
                  placeholder="Search brand"
                  searchable
                  loading={isLoadingBrands}
                />
                <Input
                  placeholder="Or type new brand"
                  value={purchaseDraft.brandName}
                  onChange={(event) =>
                    setPurchaseDraft((current) => ({
                      ...current,
                      brandName: event.target.value,
                      brandId: undefined,
                    }))
                  }
                />
                {purchaseDraft.brandName.trim() &&
                  !brandOptions.some(
                    (option) =>
                      option.label.trim().toLowerCase() ===
                      purchaseDraft.brandName.trim().toLowerCase()
                  ) && (
                    <p className="text-xs text-[var(--color-brand-gold-dark)]">
                      Create new brand: "{purchaseDraft.brandName.trim()}"
                    </p>
                  )}
              </div>
            </FormField>
            <FormField label="Buying Price" name="buyingPrice" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={purchaseDraft.buyingPrice}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({ ...current, buyingPrice: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Quantity" name="quantity" required>
              <Input
                type="number"
                min="1"
                value={purchaseDraft.quantity}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Category" name="category" required>
              <CommonDropdown
                options={categories.map((category) => ({ value: category, label: category }))}
                value={purchaseDraft.category}
                onChange={(value) =>
                  setPurchaseDraft((current) => ({ ...current, category: String(value) }))
                }
                searchable={false}
                clearable={false}
              />
            </FormField>
            <FormField label="Minimum Threshold" name="minThreshold">
              <Input
                type="number"
                min="0"
                value={purchaseDraft.minThreshold}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({ ...current, minThreshold: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Notes" name="notes">
              <Input
                value={purchaseDraft.notes}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </FormField>
          </div>
          {purchaseDraft.productName.trim() && (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Preview:{' '}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {purchaseDraft.productName.trim()}
                {purchaseDraft.brandName.trim() ? ` (${purchaseDraft.brandName.trim()})` : ''} -{' '}
                {formatCurrency(Number(purchaseDraft.buyingPrice || 0))}
              </span>
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <Button icon={<PackagePlus className="h-4 w-4" />} onClick={handlePurchase} isLoading={isCreatingPurchase}>
              Record Purchase
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Usage & deduction</h2>
            <div className="mt-5 space-y-4">
              <FormField label="Product" name="usageProduct" required>
                <CommonDropdown
                  options={stockOptions}
                  value={usageDraft.inventoryId}
                  onChange={(value) =>
                    setUsageDraft((current) => ({ ...current, inventoryId: String(value) }))
                  }
                  placeholder="Select stock item"
                />
              </FormField>
              <FormField label="Deduction Type" name="usageType" required>
                <CommonDropdown
                  options={[
                    { value: 'USAGE', label: 'Product used in service' },
                    { value: 'SALE', label: 'Product sold' },
                  ]}
                  value={usageDraft.type}
                  onChange={(value) =>
                    setUsageDraft((current) => ({ ...current, type: String(value) as 'USAGE' | 'SALE' }))
                  }
                  searchable={false}
                  clearable={false}
                />
              </FormField>
              <FormField label="Quantity" name="usageQuantity" required>
                <Input
                  type="number"
                  min="1"
                  value={usageDraft.quantity}
                  onChange={(event) =>
                    setUsageDraft((current) => ({ ...current, quantity: event.target.value }))
                  }
                />
              </FormField>
              <FormField label="Appointment / customer reference" name="referenceId">
                <Input
                  value={usageDraft.referenceId}
                  onChange={(event) =>
                    setUsageDraft((current) => ({ ...current, referenceId: event.target.value }))
                  }
                />
              </FormField>
              <FormField label="Notes" name="usageNotes">
                <Input
                  value={usageDraft.notes}
                  onChange={(event) =>
                    setUsageDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </FormField>
              <Button fullWidth onClick={handleUse} isLoading={isCreatingUse}>
                Mark as Used
              </Button>
            </div>
          </div>

          <CommonTable
            data={reports?.transactions ?? []}
            rowKey="id"
            loading={isLoadingReports}
            title="Deduction logs"
            subtitle="Includes manual usage, product sale, and linked appointment/customer references."
            enableGlobalSearch
            columns={[
              { key: 'type', header: 'Type', accessor: 'type' },
              { key: 'quantity', header: 'Quantity', accessor: 'quantity' },
              { key: 'reference_id', header: 'Reference', render: (row) => row.reference_id || '-' },
              { key: 'notes', header: 'Notes', render: (row) => row.notes || '-' },
              { key: 'created_at', header: 'Date', render: (row) => formatDateDMY(row.created_at, '-') },
            ]}
          />
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} />
              <Input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} />
              <Input placeholder="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} />
              <CommonDropdown
                options={brandOptions}
                value={
                  brandOptions.find((option) => option.label === brandFilter)?.value ?? brandFilter
                }
                onChange={(value) => {
                  const matched = brandOptions.find((option) => option.value === String(value));
                  setBrandFilter(matched?.label ?? String(value));
                }}
                placeholder="Filter by brand"
                searchable
                loading={isLoadingBrands}
              />
              <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportReports}>
                Export
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Total purchase cost"
              value={formatCurrency(reports?.total_purchase_cost ?? 0)}
              icon={PackagePlus}
              tone="bg-amber-50 text-amber-700"
            />
            <MetricCard
              label="Usage cost summary"
              value={formatCurrency(reports?.usage_cost_summary ?? 0)}
              icon={TrendingDown}
              tone="bg-red-50 text-red-700"
            />
            <MetricCard
              label="Profit impact estimation"
              value={formatCurrency(reports?.profit_impact_estimation ?? 0)}
              icon={BarChart3}
              tone="bg-emerald-50 text-emerald-700"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Category-wise consumption</h2>
              <div className="mt-3 space-y-2 text-sm">
                {(reports?.category_consumption ?? []).map((item) => (
                  <div key={item.category} className="flex justify-between">
                    <span>{item.category}</span>
                    <span className="font-semibold">{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Brand-wise spending</h2>
              <div className="mt-3 space-y-2 text-sm">
                {(reports?.brand_spending ?? []).map((item) => (
                  <div key={item.brand} className="flex justify-between">
                    <span>{item.brand}</span>
                    <span className="font-semibold">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ProductsInventory;
