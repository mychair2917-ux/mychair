import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Download,
  Layers3,
  PackagePlus,
  Sliders,
  TrendingDown,
  Upload,
  FileText,
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
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '../../components/common';
import { isSuperAdmin } from '../../config/rbac';
import { useDebouncedSearch } from '../../hooks';
import { useAppSelector } from '../../redux/hooks';
import {
  useGetBrandsQuery,
  useGetSalonProductsQuery,
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
  { key: 'usage', label: 'Usage & Sales' },
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
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);
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
  const { data: productsData, isLoading: isLoadingProducts } = useGetSalonProductsQuery(
    { salon_id: salonId || '' },
    { skip: !salonId }
  );
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
        label: product.brand_name ? `${product.product_name} (${product.brand_name})` : product.product_name,
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
    const matched = (productsData?.data ?? []).find((p) => p.id === value);
    setPurchaseDraft((current) => ({
      ...current,
      productName: matched?.product_name ?? value,
      productId: matched?.product_id || undefined,
      brandName: matched?.brand_name ?? '',
      brandId: matched?.brand_id || undefined,
      buyingPrice: matched?.price ? String(matched.price) : current.buyingPrice,
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
      let finalNotes = purchaseDraft.notes.trim();
      if (billFile) {
        finalNotes = finalNotes
          ? `${finalNotes} (Attached Bill: ${billFile.name})`
          : `Attached Bill: ${billFile.name}`;
      }

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
          notes: finalNotes || undefined,
        },
      }).unwrap();
      if (response.success) {
        showToast(
          'success',
          billFile
            ? `Inventory purchase recorded and bill "${billFile.name}" submitted successfully!`
            : response.message || 'Inventory purchase recorded'
        );
        setPurchaseDraft(emptyPurchase);
        setBillFile(null);
        setIsAddStockModalOpen(false);
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
        showToast('success', response.message || 'Inventory transaction recorded');
        setUsageDraft(emptyUsage);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to record usage'));
    }
  };

  const exportReports = () => {
    const rows = reports?.transactions ?? [];
    const csv = [
      ['Date', 'Type', 'Product ID', 'Brand ID', 'Quantity', 'Price', 'Reference', 'Notes', 'Stock Before', 'Stock After', 'Sold Out of Stock'],
      ...rows.map((row) => [
        formatDateDMY(row.created_at, ''),
        row.type,
        row.product_id ?? '',
        row.brand_id ?? '',
        row.quantity,
        row.price ?? '',
        row.reference_id ?? '',
        row.notes ?? '',
        row.stock_before ?? '',
        row.stock_after ?? '',
        row.sold_while_out_of_stock ? 'Yes' : 'No',
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

  const statusBadge = (row: InventoryStockItem) => {
    const isOos = row.stock_quantity <= 0;
    return (
      <span
        className={cn(
          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
          isOos && 'bg-red-100 text-red-800 border border-red-200',
          !isOos && row.status === 'OK' && 'bg-emerald-50 text-emerald-700',
          !isOos && row.status === 'LOW' && 'bg-amber-50 text-amber-700',
          !isOos && row.status === 'CRITICAL' && 'bg-red-50 text-red-700'
        )}
      >
        {isOos ? 'OUT OF STOCK' : row.status}
      </span>
    );
  };

  if (!salonId && isSuperAdmin(user?.role)) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Select a salon from the header to manage products and inventory.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
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
            Track stock, purchases, usage & sales, and inventory reports for this salon.
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
          subtitle="Track salon stock by product and brand combination."
          enableGlobalSearch={false}
          filters={
            <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center">
              <div className="grid flex-1 gap-3 md:grid-cols-3">
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
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setPurchaseDraft(emptyPurchase);
                  setBillFile(null);
                  setIsAddStockModalOpen(true);
                }}
                icon={<PackagePlus className="h-4 w-4" />}
              >
                Add Stock
              </Button>
            </div>
          }
          columns={[
            { key: 'display_name', header: 'Product Name', accessor: 'display_name', sortable: true },
            { key: 'category', header: 'Category', accessor: 'category', sortable: true },
            { key: 'stock_quantity', header: 'Current Stock', accessor: 'stock_quantity', sortable: true },
            { key: 'buying_price', header: 'Buying Price', render: (row) => formatCurrency(row.buying_price), sortable: true },
            { key: 'selling_price', header: 'Selling Price', render: (row) => formatCurrency(row.selling_price), sortable: true },
            { key: 'min_threshold', header: 'Low Stock Alert Level', accessor: 'min_threshold', sortable: true },
            { key: 'status', header: 'Status', render: (row) => statusBadge(row), sortable: true },
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
              icon: <ClipboardCheck className="h-4 w-4" />,
              onClick: (row) => {
                setUsageDraft((current) => ({ ...current, inventoryId: row.id, type: 'USAGE' }));
                setActiveTab('usage');
              },
            },
            {
              type: 'custom',
              label: 'Update Stock',
              icon: <PackagePlus className="h-4 w-4" />,
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
                setBillFile(null);
                setIsAddStockModalOpen(true);
              },
            },
            {
              type: 'custom',
              label: 'Adjust Quantity',
              icon: <Sliders className="h-4 w-4" />,
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
            <FormField label="Low Stock Alert Level" name="minThreshold">
              <Input
                type="number"
                min="0"
                value={purchaseDraft.minThreshold}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({ ...current, minThreshold: event.target.value }))
                }
                placeholder="e.g. 5"
              />
              <span className="text-[11px] text-gray-500 mt-0.5">
                Alerts you when stock falls below this quantity.
              </span>
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
            <h2 className="text-lg font-semibold text-gray-900">Usage & Sales</h2>
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
              <FormField label="Type" name="usageType" required>
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
                  placeholder="Enter quantity"
                />
              </FormField>
              <FormField label="Appointment / customer reference" name="referenceId">
                <Input
                  value={usageDraft.referenceId}
                  onChange={(event) =>
                    setUsageDraft((current) => ({ ...current, referenceId: event.target.value }))
                  }
                  placeholder="Optional reference ID"
                />
              </FormField>
              <FormField label="Notes" name="usageNotes">
                <Input
                  value={usageDraft.notes}
                  onChange={(event) =>
                    setUsageDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Optional additional notes"
                />
              </FormField>
              <Button fullWidth onClick={handleUse} isLoading={isCreatingUse}>
                {usageDraft.type === 'SALE' ? 'Record Sale' : 'Record Usage'}
              </Button>
            </div>
          </div>

          <CommonTable
            data={reports?.transactions ?? []}
            rowKey="id"
            loading={isLoadingReports}
            title="Usage & Sales History"
            subtitle="Includes manual usage, product sale, and linked appointment/customer references."
            enableGlobalSearch
            columns={[
              { key: 'created_at', header: 'Date', render: (row) => formatDateDMY(row.created_at, '-') },
              {
                key: 'product_name',
                header: 'Product Name',
                render: (row) => (
                  <span className="font-medium text-gray-900">
                    {row.product_name || '-'}
                    {row.brand_name ? (
                      <span className="ml-1 text-xs text-gray-500 font-normal">
                        ({row.brand_name})
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (row) => (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      row.type === 'SALE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {row.type === 'SALE' ? 'Sale' : 'Usage'}
                  </span>
                ),
              },
              { key: 'quantity', header: 'Quantity', accessor: 'quantity' },
              {
                key: 'stock_movement',
                header: 'Stock Movement',
                render: (row) =>
                  row.stock_before !== null && row.stock_before !== undefined &&
                  row.stock_after !== null && row.stock_after !== undefined
                    ? `${row.stock_before} → ${row.stock_after}`
                    : '-',
              },
              {
                key: 'sold_while_out_of_stock',
                header: 'Sold OOS?',
                render: (row) =>
                  row.sold_while_out_of_stock ? (
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      Yes
                    </span>
                  ) : (
                    'No'
                  ),
              },
              { key: 'notes', header: 'Notes', render: (row) => row.notes || '-' },
            ]}
          />
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
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

      {/* Add Stock Modal */}
      <Modal open={isAddStockModalOpen} onClose={() => {
        setIsAddStockModalOpen(false);
        setBillFile(null);
      }}>
        <ModalHeader>Purchase Entry & Add Stock</ModalHeader>
        <ModalBody>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Fill in the purchase details for the salon product. Only configured products are available.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Product" name="purchaseProduct" required>
                <CommonDropdown
                  options={productOptions}
                  value={purchaseDraft.productId}
                  onChange={(value) => updatePurchaseProduct(String(value))}
                  placeholder="Select product"
                  loading={isLoadingProducts}
                />
                <Input
                  className="mt-2"
                  placeholder="Or type new product name"
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
                    placeholder="Select brand"
                    searchable
                    loading={isLoadingBrands}
                  />
                  <Input
                    placeholder="Or type new brand name"
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

              <FormField label="Low Stock Alert Level" name="minThreshold">
                <Input
                  type="number"
                  min="0"
                  value={purchaseDraft.minThreshold}
                  onChange={(event) =>
                    setPurchaseDraft((current) => ({ ...current, minThreshold: event.target.value }))
                  }
                  placeholder="e.g. 5"
                />
                <span className="text-[11px] text-gray-500 mt-0.5 block">
                  Alerts you when stock falls below this quantity.
                </span>
              </FormField>
            </div>

            <FormField label="Notes" name="notes">
              <Input
                value={purchaseDraft.notes}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional notes about this purchase..."
              />
            </FormField>

            <FormField label="Submit Purchasing Bill (Receipt/Invoice)" name="billFile">
              <div className="mt-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-4 transition hover:border-[var(--color-brand-gold)] bg-gray-50/50">
                <input
                  type="file"
                  id="bill-file-upload"
                  className="sr-only"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBillFile(file);
                    }
                  }}
                />
                <label
                  htmlFor="bill-file-upload"
                  className="flex flex-col items-center justify-center cursor-pointer text-center text-sm w-full h-full"
                >
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <span className="font-medium text-[var(--color-brand-gold-dark)] hover:underline">
                    Click to upload
                  </span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 5MB</span>
                </label>
                {billFile && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-white border border-gray-200 p-2 text-xs font-medium text-gray-700 w-full justify-between shadow-sm">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-[var(--color-brand-gold-dark)] flex-shrink-0" />
                      <span className="truncate">{billFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBillFile(null)}
                      className="text-red-500 hover:text-red-700 ml-1 font-semibold flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </FormField>

            {purchaseDraft.productName.trim() && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Preview:{' '}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {purchaseDraft.productName.trim()}
                  {purchaseDraft.brandName.trim() ? ` (${purchaseDraft.brandName.trim()})` : ''} -{' '}
                  {formatCurrency(Number(purchaseDraft.buyingPrice || 0))}
                </span>
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsAddStockModalOpen(false);
                setBillFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              icon={<PackagePlus className="h-4 w-4" />}
              onClick={handlePurchase}
              isLoading={isCreatingPurchase}
            >
              Record Purchase
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      </div>
    </div>
  );
};

export default ProductsInventory;
