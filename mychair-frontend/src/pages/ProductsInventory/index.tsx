import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Download,
  Layers3,
  PackagePlus,
  Sliders,
  TrendingDown,
  Upload,
  FileText,
  ShoppingBag,
  Scissors,
  Plus,
  Minus,
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
type ProductTypeFilter = 'SELLING' | 'SERVICE';

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
  sellingPrice: '',
  quantity: '1',
  category: 'General',
  productType: 'SELLING' as ProductTypeFilter,
  minThreshold: '5',
  notes: '',
};

const emptyUsage = {
  inventoryId: '',
  quantity: '1',
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
  const [productType, setProductType] = useState<ProductTypeFilter>('SELLING');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [purchaseDraft, setPurchaseDraft] = useState({
    ...emptyPurchase,
    productType: 'SELLING' as ProductTypeFilter,
  });
  const [usageDraft, setUsageDraft] = useState(emptyUsage);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryStockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustMode, setAdjustMode] = useState<'ADD' | 'DEDUCT'>('DEDUCT');
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
      product_type: productType,
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
      product_type: productType,
    },
    { skip }
  );
  const { data: productsData, isLoading: isLoadingProducts } = useGetSalonProductsQuery(
    { salon_id: salonId || '', product_type: productType },
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
        label: `${stock.display_name} (${stock.stock_quantity} in stock)`,
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
      productType: (matched?.product_type as ProductTypeFilter) || current.productType,
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

  const showSellingPrice = purchaseDraft.productType === 'SELLING' && !purchaseDraft.productId;

  const handleQuickDeduct = async (stockItem: InventoryStockItem, qty = 1) => {
    if (!salonId) return;
    try {
      const response = await createUse({
        salon_id: salonId,
        body: {
          inventory_id: stockItem.id,
          quantity: qty,
          type: stockItem.product_type === 'SELLING' ? 'SALE' : 'USAGE',
        },
      }).unwrap();
      if (response.success) {
        showToast('success', `Deducted ${qty} unit(s) of "${stockItem.display_name}" (-${qty})`);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to deduct stock'));
    }
  };

  const handleQuickAdd = async (stockItem: InventoryStockItem, qty = 1) => {
    if (!salonId) return;
    try {
      const response = await createPurchase({
        salon_id: salonId,
        body: {
          product_id: stockItem.product_id,
          buying_price: stockItem.buying_price,
          quantity: qty,
          category: stockItem.category,
          product_type: stockItem.product_type,
          min_threshold: stockItem.min_threshold,
        },
      }).unwrap();
      if (response.success) {
        showToast('success', `Added ${qty} unit(s) to "${stockItem.display_name}" (+${qty})`);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to add stock'));
    }
  };

  const handleAdjustSubmit = async () => {
    if (!adjustItem || adjustQty <= 0) return;
    if (adjustMode === 'ADD') {
      await handleQuickAdd(adjustItem, adjustQty);
    } else {
      await handleQuickDeduct(adjustItem, adjustQty);
    }
    setAdjustItem(null);
    setAdjustQty(1);
  };

  const handlePurchase = async () => {
    if (!salonId) return;
    const productName = purchaseDraft.productName.trim();
    const brandName = purchaseDraft.brandName.trim();
    const quantity = Number(purchaseDraft.quantity);
    const buyingPrice = Number(purchaseDraft.buyingPrice);
    const sellingPrice = Number(purchaseDraft.sellingPrice);
    const minThreshold = Number(purchaseDraft.minThreshold || 0);
    const isNewProduct = !purchaseDraft.productId && Boolean(productName);
    const isSellingType = purchaseDraft.productType === 'SELLING';

    if (!productName || !quantity || quantity <= 0 || Number.isNaN(quantity)) {
      showToast('warning', 'Select a product and enter a valid quantity');
      return;
    }
    if (!purchaseDraft.buyingPrice.toString().trim() || Number.isNaN(buyingPrice) || buyingPrice < 0) {
      showToast('warning', 'Please enter a valid Buying Price');
      return;
    }
    if (isSellingType && isNewProduct) {
      if (!purchaseDraft.sellingPrice.toString().trim() || Number.isNaN(sellingPrice) || sellingPrice <= 0) {
        showToast('warning', 'Please enter a valid Selling Price for the new selling product');
        return;
      }
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
          ...(isSellingType && isNewProduct && !Number.isNaN(sellingPrice)
            ? { selling_price: sellingPrice }
            : {}),
          quantity,
          category: purchaseDraft.category,
          product_type: purchaseDraft.productType,
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
        setPurchaseDraft({ ...emptyPurchase, productType });
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
    link.download = `inventory-reports-${productType.toLowerCase()}.csv`;
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

  const productTypeBadge = (type?: string) => {
    const isSelling = (type || 'SELLING').toUpperCase() === 'SELLING';
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border',
          isSelling
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
        )}
      >
        {isSelling ? <ShoppingBag className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
        {isSelling ? 'Selling Product' : 'Service Product'}
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
            : `${stocks.length} ${productType === 'SELLING' ? 'Selling' : 'Service'} products tracked`}
        </div>
      </div>

      {/* Product Type Categorization Bar (Selling vs Service) */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setProductType('SELLING');
              setPurchaseDraft((current) => ({ ...current, productType: 'SELLING' }));
            }}
            className={cn(
              'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition',
              productType === 'SELLING'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            Selling Products
          </button>
          <button
            type="button"
            onClick={() => {
              setProductType('SERVICE');
              setPurchaseDraft((current) => ({ ...current, productType: 'SERVICE' }));
            }}
            className={cn(
              'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition',
              productType === 'SERVICE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Scissors className="h-4 w-4" />
            Service Products
          </button>
        </div>
        <p className="text-xs text-gray-500 px-3 hidden md:block">
          Currently displaying:{' '}
          <span className="font-semibold text-gray-800">
            {productType === 'SELLING'
              ? 'Selling Products (Retail Products)'
              : 'Service Products (Internal In-Salon Use)'}
          </span>
        </p>
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
          title={`${productType === 'SELLING' ? 'Selling Products' : 'Service Products'} Stock`}
          subtitle={`Track ${productType === 'SELLING' ? 'retail selling products' : 'in-salon service products'} by brand and category. Use + and - for quick quantity adjustments.`}
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
                  setPurchaseDraft({ ...emptyPurchase, productType });
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
            { key: 'product_type', header: 'Type', render: (row) => productTypeBadge(row.product_type), sortable: true },
            { key: 'category', header: 'Category', accessor: 'category', sortable: true },
            {
              key: 'stock_quantity',
              header: 'Current Stock (+ / -)',
              render: (row) => (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={row.stock_quantity <= 0 || isCreatingUse}
                    onClick={() => handleQuickDeduct(row, 1)}
                    title="Quick Deduct 1 unit"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span
                    className={cn(
                      'tabular-nums font-bold min-w-[2.5rem] text-center px-1 text-sm',
                      row.stock_quantity <= 0
                        ? 'rounded-md bg-red-100 px-2 py-0.5 text-xs text-red-800 border border-red-200 font-semibold'
                        : 'text-gray-900'
                    )}
                  >
                    {row.stock_quantity}
                  </span>
                  <button
                    type="button"
                    disabled={isCreatingPurchase}
                    onClick={() => handleQuickAdd(row, 1)}
                    title="Quick Add 1 unit"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ),
              sortable: true,
            },
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
              label: 'Deduct (-1)',
              icon: <Minus className="h-4 w-4" />,
              onClick: (row) => handleQuickDeduct(row, 1),
            },
            {
              type: 'custom',
              label: 'Add Stock (+1)',
              icon: <Plus className="h-4 w-4" />,
              onClick: (row) => handleQuickAdd(row, 1),
            },
            {
              type: 'custom',
              label: 'Adjust Stock (+ / -)',
              icon: <Sliders className="h-4 w-4" />,
              onClick: (row) => {
                setAdjustItem(row);
                setAdjustQty(1);
                setAdjustMode('DEDUCT');
              },
            },
          ]}
          emptyTitle={`No ${productType === 'SELLING' ? 'selling' : 'service'} products found`}
          emptyDescription="Use Purchase Entry to create products, brands, and stock records."
        />
      )}

      {activeTab === 'purchase' && (
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Purchase entry</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add stock purchases. Specify whether product is for selling to customers or in-salon service use.
          </p>

          <div className="mt-5 space-y-4">
            {/* Row 1: Product Type & Category */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Product Type" name="productType" required>
                <CommonDropdown
                  options={[
                    { value: 'SELLING', label: 'Selling Product' },
                    { value: 'SERVICE', label: 'Service Product' },
                  ]}
                  value={purchaseDraft.productType}
                  onChange={(value) =>
                    setPurchaseDraft((current) => ({
                      ...current,
                      productType: String(value) as ProductTypeFilter,
                    }))
                  }
                  searchable={false}
                  clearable={false}
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
            </div>

            {/* Row 2: Product & Brand */}
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            {/* Row 3: Buying Price, Selling Price (if new selling product), Quantity & Low Stock Alert Level */}
            <div className={cn('grid gap-4', showSellingPrice ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3')}>
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

              {showSellingPrice && (
                <FormField label="Selling Price" name="sellingPrice" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 25.00"
                    value={purchaseDraft.sellingPrice}
                    onChange={(event) =>
                      setPurchaseDraft((current) => ({ ...current, sellingPrice: event.target.value }))
                    }
                  />
                </FormField>
              )}

              <FormField label="Quantity" name="quantity" required>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseDraft((current) => ({
                        ...current,
                        quantity: String(Math.max(1, (Number(current.quantity) || 1) - 1)),
                      }))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold transition flex-shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    type="number"
                    min="1"
                    className="text-center font-bold"
                    value={purchaseDraft.quantity}
                    onChange={(event) =>
                      setPurchaseDraft((current) => ({ ...current, quantity: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseDraft((current) => ({
                        ...current,
                        quantity: String((Number(current.quantity) || 0) + 1),
                      }))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold transition flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
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
                  Alerts when stock falls below level.
                </span>
              </FormField>
            </div>

            {/* Row 4: Notes */}
            <FormField label="Notes" name="notes">
              <Input
                value={purchaseDraft.notes}
                onChange={(event) =>
                  setPurchaseDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional notes about this purchase..."
              />
            </FormField>
          </div>
          {purchaseDraft.productName.trim() && (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Preview:{' '}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {purchaseDraft.productName.trim()}
                {purchaseDraft.brandName.trim() ? ` (${purchaseDraft.brandName.trim()})` : ''} -{' '}
                {formatCurrency(Number(purchaseDraft.buyingPrice || 0))}{' '}
                <span className="text-xs font-medium text-gray-500">
                  ({purchaseDraft.productType === 'SELLING' ? 'Selling Product' : 'Service Product'})
                </span>
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
            <p className="mt-1 text-xs text-gray-500">
              Quickly record product deduction (-) or stock addition (+).
            </p>
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
                    { value: 'USAGE', label: 'Product used in service (-)' },
                    { value: 'SALE', label: 'Product sold (-)' },
                  ]}
                  value={usageDraft.type}
                  onChange={(value) =>
                    setUsageDraft((current) => ({ ...current, type: String(value) as 'USAGE' | 'SALE' }))
                  }
                  searchable={false}
                  clearable={false}
                />
              </FormField>
              
              <FormField label="Quantity (+ / -)" name="usageQuantity" required>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setUsageDraft((current) => ({
                          ...current,
                          quantity: String(Math.max(1, (Number(current.quantity) || 1) - 1)),
                        }))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-bold transition flex-shrink-0"
                      title="Decrease by 1"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <Input
                      type="number"
                      min="1"
                      className="text-center text-lg font-bold"
                      value={usageDraft.quantity}
                      onChange={(event) =>
                        setUsageDraft((current) => ({ ...current, quantity: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setUsageDraft((current) => ({
                          ...current,
                          quantity: String((Number(current.quantity) || 0) + 1),
                        }))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold transition flex-shrink-0"
                      title="Increase by 1"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Preset Quick Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-xs text-gray-500 mr-1">Quick Qty:</span>
                    {[1, 2, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setUsageDraft((current) => ({ ...current, quantity: String(num) }))}
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
                          Number(usageDraft.quantity) === num
                            ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
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
              
              <div className="pt-2">
                <Button fullWidth onClick={handleUse} isLoading={isCreatingUse}>
                  {usageDraft.type === 'SALE' ? 'Record Sale (-)' : 'Record Usage (-)'}
                </Button>
              </div>
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

      {/* Quick Quantity Adjust Modal (+ / -) */}
      <Modal open={!!adjustItem} onClose={() => setAdjustItem(null)}>
        <ModalHeader>Adjust Stock Quantity: {adjustItem?.display_name}</ModalHeader>
        <ModalBody>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-4 border border-gray-200">
              <div>
                <p className="text-xs text-gray-500">Current Stock</p>
                <p className="text-xl font-bold text-gray-900">{adjustItem?.stock_quantity}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Product Type</p>
                {productTypeBadge(adjustItem?.product_type)}
              </div>
            </div>

            <FormField label="Adjustment Direction" name="adjustDirection" required>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustMode('DEDUCT')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition',
                    adjustMode === 'DEDUCT'
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Minus className="h-4 w-4 text-red-600" />
                  Deduct / Use (-)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('ADD')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition',
                    adjustMode === 'ADD'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Add Stock (+)
                </button>
              </div>
            </FormField>

            <FormField label="Quantity to Adjust" name="adjustQty" required>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustQty((q) => Math.max(1, q - 1))}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold transition text-lg flex-shrink-0"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <Input
                  type="number"
                  min="1"
                  className="text-center text-xl font-bold h-12"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <button
                  type="button"
                  onClick={() => setAdjustQty((q) => q + 1)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold transition text-lg flex-shrink-0"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </FormField>

            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50 text-xs text-gray-600 flex justify-between items-center">
              <span>New Projected Stock:</span>
              <span className="font-bold text-sm text-gray-900">
                {adjustMode === 'ADD'
                  ? (adjustItem?.stock_quantity ?? 0) + adjustQty
                  : (adjustItem?.stock_quantity ?? 0) - adjustQty}
              </span>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setAdjustItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustSubmit}
              isLoading={isCreatingPurchase || isCreatingUse}
              variant={adjustMode === 'ADD' ? 'primary' : 'secondary'}
            >
              {adjustMode === 'ADD' ? `Add +${adjustQty} Stock` : `Deduct -${adjustQty} Units`}
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Add Stock Modal */}
      <Modal open={isAddStockModalOpen} onClose={() => {
        setIsAddStockModalOpen(false);
        setBillFile(null);
      }}>
        <ModalHeader>Purchase Entry & Add Stock</ModalHeader>
        <ModalBody>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Fill in the purchase details for the salon product. Specify whether this product is for retail selling or in-salon service.
            </p>

            {/* Row 1: Product Type & Category */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Product Type" name="modalProductType" required>
                <CommonDropdown
                  options={[
                    { value: 'SELLING', label: 'Selling Product' },
                    { value: 'SERVICE', label: 'Service Product' },
                  ]}
                  value={purchaseDraft.productType}
                  onChange={(value) =>
                    setPurchaseDraft((current) => ({
                      ...current,
                      productType: String(value) as ProductTypeFilter,
                    }))
                  }
                  searchable={false}
                  clearable={false}
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
            </div>

            {/* Row 2: Product & Brand */}
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
            </div>

            {/* Row 3: Buying Price, Selling Price (if new selling product), Quantity & Low Stock Alert Level */}
            <div className={cn('grid gap-4', showSellingPrice ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3')}>
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

              {showSellingPrice && (
                <FormField label="Selling Price" name="sellingPrice" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 25.00"
                    value={purchaseDraft.sellingPrice}
                    onChange={(event) =>
                      setPurchaseDraft((current) => ({ ...current, sellingPrice: event.target.value }))
                    }
                  />
                </FormField>
              )}

              <FormField label="Quantity" name="quantity" required>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseDraft((current) => ({
                        ...current,
                        quantity: String(Math.max(1, (Number(current.quantity) || 1) - 1)),
                      }))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold transition flex-shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <Input
                    type="number"
                    min="1"
                    className="text-center font-bold"
                    value={purchaseDraft.quantity}
                    onChange={(event) =>
                      setPurchaseDraft((current) => ({ ...current, quantity: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseDraft((current) => ({
                        ...current,
                        quantity: String((Number(current.quantity) || 0) + 1),
                      }))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold transition flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
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
                  Alerts when stock falls below level.
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
                  {formatCurrency(Number(purchaseDraft.buyingPrice || 0))}{' '}
                  <span className="text-xs font-medium text-gray-500">
                    ({purchaseDraft.productType === 'SELLING' ? 'Selling Product' : 'Service Product'})
                  </span>
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
