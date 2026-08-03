import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Layers3, Package, Pencil, Plus, Scissors, Sparkles, Tag, Trash2, Warehouse, Upload } from 'lucide-react';

import {
  Button,
  CommonDropdown,
  CommonModal,
  CommonTable,
  FormField,
  Input,
} from '../../../components/common';
import { showToast } from '../../../components/common/Toast/toastService';
import { isSuperAdmin } from '../../../config/rbac';
import { useDebouncedSearch } from '../../../hooks';
import { useAppSelector } from '../../../redux/hooks';
import {
  useCreateSalonProductMutation,
  useDeleteSalonProductMutation,
  useGetBrandsQuery,
  useGetMasterProductsQuery,
  useGetSalonProductsQuery,
  useUpdateSalonProductMutation,
  useBulkDeleteSalonProductsMutation,
} from '../../../redux/slices/salonProducts/salonProductsApi';
import { SalonProductItem } from '../../../redux/slices/salonProducts/Types';
import {
  useCreateSalonServiceMutation,
  useDeleteSalonServiceMutation,
  useGetMasterServicesQuery,
  useGetSalonServicesQuery,
  useUpdateSalonServiceMutation,
  useBulkDeleteSalonServicesMutation,
} from '../../../redux/slices/salonServices/salonServicesApi';
import { SalonServiceItem } from '../../../redux/slices/salonServices/Types';
import { getApiErrorMessage } from '../../../utils/apiErrors';
import { formatCurrency } from '../../../utils/currency';
import { formatDateDMY } from '../../../utils/utilities';
import ExcelImportModal from './ExcelImportModal';

type ManageSalonTab = 'services' | 'products' | 'assets';

type ServiceDraft = {
  serviceName: string;
  serviceId?: string;
  price: string;
  memberPrice: string;
};

type ProductDraft = {
  productName: string;
  productId?: string;
  brandName: string;
  brandId?: string;
  price: string;
};

const PAGE_SIZE = 10;

const emptyDraft: ServiceDraft = {
  serviceName: '',
  serviceId: undefined,
  price: '',
  memberPrice: '',
};

const emptyProductDraft: ProductDraft = {
  productName: '',
  productId: undefined,
  brandName: '',
  brandId: undefined,
  price: '',
};

const tabConfig: Array<{
  key: ManageSalonTab;
  label: string;
  icon: React.ElementType;
}> = [
  { key: 'services', label: 'Services', icon: Scissors },
  { key: 'products', label: 'Products', icon: Package },
  // { key: 'assets', label: 'Assets', icon: Warehouse },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const Services: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const salonId = orgId ?? (isSuperAdmin(user?.role) ? selectedSalonId : storedOrgId) ?? undefined;

  const [activeTab, setActiveTab] = useState<ManageSalonTab>('services');
  const [draft, setDraft] = useState<ServiceDraft>(emptyDraft);
  const [editingService, setEditingService] = useState<SalonServiceItem | null>(null);
  const [editDraft, setEditDraft] = useState<{
    serviceName: string;
    serviceId?: string;
    price: string;
    memberPrice: string;
    status: string;
  }>({
    serviceName: '',
    serviceId: undefined,
    price: '',
    memberPrice: '',
    status: 'ACTIVE',
  });
  const [deletingService, setDeletingService] = useState<SalonServiceItem | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const [editingProduct, setEditingProduct] = useState<SalonProductItem | null>(null);
  const [editProductDraft, setEditProductDraft] = useState<{
    productName: string;
    productId?: string;
    brandName: string;
    brandId?: string;
    price: string;
    status: string;
  }>({
    productName: '',
    productId: undefined,
    brandName: '',
    brandId: undefined,
    price: '',
    status: 'ACTIVE',
  });
  const [deletingProduct, setDeletingProduct] = useState<SalonProductItem | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<React.Key[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<React.Key[]>([]);
  const [isBulkDeletingServicesModalOpen, setIsBulkDeletingServicesModalOpen] = useState(false);
  const [isBulkDeletingProductsModalOpen, setIsBulkDeletingProductsModalOpen] = useState(false);

  const debouncedSearch = useDebouncedSearch(search, 300);

  const { data: masterServicesData, isLoading: isLoadingMasterServices } =
    useGetMasterServicesQuery();
  const {
    data: salonServicesData,
    isLoading: isLoadingSalonServices,
    isFetching: isFetchingSalonServices,
  } = useGetSalonServicesQuery(salonId ? { salon_id: salonId } : undefined, {
    skip: !salonId,
  });
  const { data: masterProductsData, isLoading: isLoadingMasterProducts } =
    useGetMasterProductsQuery();
  const shouldLoadBrands = Boolean(salonId) && activeTab === 'products';
  const { data: brandsData, isLoading: isLoadingBrands } = useGetBrandsQuery(
    salonId ? { salon_id: salonId } : undefined,
    { skip: !shouldLoadBrands }
  );
  const {
    data: salonProductsData,
    isLoading: isLoadingSalonProducts,
    isFetching: isFetchingSalonProducts,
  } = useGetSalonProductsQuery(salonId ? { salon_id: salonId } : undefined, {
    skip: !salonId,
  });

  const [createSalonService, { isLoading: isCreating }] = useCreateSalonServiceMutation();
  const [updateSalonService, { isLoading: isUpdating }] = useUpdateSalonServiceMutation();
  const [deleteSalonService, { isLoading: isDeleting }] = useDeleteSalonServiceMutation();
  const [createSalonProduct, { isLoading: isCreatingProduct }] = useCreateSalonProductMutation();
  const [updateSalonProduct, { isLoading: isUpdatingProduct }] = useUpdateSalonProductMutation();
  const [deleteSalonProduct, { isLoading: isDeletingProduct }] = useDeleteSalonProductMutation();
  const [bulkDeleteSalonServices, { isLoading: isBulkDeletingServices }] = useBulkDeleteSalonServicesMutation();
  const [bulkDeleteSalonProducts, { isLoading: isBulkDeletingProducts }] = useBulkDeleteSalonProductsMutation();

  const masterServices = masterServicesData?.data ?? [];
  const salonServices = salonServicesData?.data ?? [];
  const masterProducts = masterProductsData?.data ?? [];
  const brands = brandsData?.data ?? [];
  const salonProducts = salonProductsData?.data ?? [];

  const serviceOptions = useMemo(
    () =>
      masterServices.map((service) => ({
        value: service.id,
        label: service.name,
      })),
    [masterServices]
  );
  const productOptions = useMemo(
    () =>
      masterProducts.map((product) => ({
        value: product.id,
        label: product.name,
      })),
    [masterProducts]
  );
  const brandOptions = useMemo(
    () =>
      brands.map((brand) => ({
        value: brand.id,
        label: brand.name,
      })),
    [brands]
  );

  const filteredServices = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return salonServices;
    return salonServices.filter((service) => {
      const haystack = [
        service.service_name,
        service.custom_service_name ?? '',
        service.status,
        service.price,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [debouncedSearch, salonServices]);
  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const brandTerm = brandFilter.trim().toLowerCase();
    return salonProducts.filter((product) => {
      const haystack = [
        product.product_name,
        product.brand_name ?? '',
        product.custom_product_name ?? '',
        product.custom_brand_name ?? '',
        product.status,
        product.price,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const productBrand = (product.brand_name || product.custom_brand_name || '').trim().toLowerCase();
      const matchesBrand =
        !brandTerm || productBrand === brandTerm || productBrand.includes(brandTerm);
      return matchesSearch && matchesBrand;
    });
  }, [brandFilter, debouncedSearch, salonProducts]);

  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredServices.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredServices]);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredProducts]);

  const currentItems = activeTab === 'services' ? filteredServices : filteredProducts;
  const totalPages = Math.max(1, Math.ceil(currentItems.length / PAGE_SIZE));

  const duplicateExists = useMemo(() => {
    const normalized = draft.serviceName.trim().toLowerCase();
    if (!normalized) return false;
    return salonServices.some((item) => item.service_name.trim().toLowerCase() === normalized);
  }, [draft.serviceName, salonServices]);
  const duplicateProductExists = useMemo(() => {
    const normalized = productDraft.productName.trim().toLowerCase();
    const normalizedBrand = productDraft.brandName.trim().toLowerCase();
    if (!normalized) return false;
    return salonProducts.some((item) => {
      const productName = (item.base_product_name || item.product_name).trim().toLowerCase();
      const brandName = (item.brand_name || '').trim().toLowerCase();
      return productName === normalized && brandName === normalizedBrand;
    });
  }, [productDraft.brandName, productDraft.productName, salonProducts]);

  const updateDraftFromSelection = (value: string) => {
    const matched = serviceOptions.find((option) => option.value === value);
    if (matched) {
      setDraft((current) => ({
        ...current,
        serviceName: matched.label,
        serviceId: matched.value,
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      serviceName: value,
      serviceId: undefined,
    }));
  };

  const resetDraft = () => {
    setDraft(emptyDraft);
  };
  const resetProductDraft = () => {
    setProductDraft(emptyProductDraft);
  };

  const handleAddService = async () => {
    const serviceName = draft.serviceName.trim();
    const price = Number(draft.price);
    const memberPriceRaw = draft.memberPrice.trim();
    const memberPrice = memberPriceRaw === '' ? null : Number(memberPriceRaw);

    if (!serviceName) {
      showToast('warning', 'Select or create a service before adding');
      return;
    }
    if (!draft.price || Number.isNaN(price) || price <= 0) {
      showToast('warning', 'Enter a valid price before adding');
      return;
    }
    if (memberPriceRaw !== '' && (Number.isNaN(memberPrice) || (memberPrice as number) < 0)) {
      showToast('warning', 'Enter a valid member price or leave it blank');
      return;
    }
    if (duplicateExists) {
      showToast('warning', 'This service already exists for the selected salon');
      return;
    }

    const matchedService = serviceOptions.find(
      (option) => option.label.trim().toLowerCase() === serviceName.toLowerCase()
    );

    try {
      const response = await createSalonService({
        salon_id: salonId,
        body: matchedService
          ? {
              service_id: matchedService.value,
              price,
              member_price: memberPrice,
            }
          : {
              custom_service_name: serviceName,
              price,
              member_price: memberPrice,
            },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Salon service added successfully');
        resetDraft();
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to add salon service'));
    }
  };

  const handleOpenEdit = (service: SalonServiceItem) => {
    setEditingService(service);
    setEditDraft({
      serviceName: service.service_name,
      serviceId: service.service_id ?? undefined,
      price: String(service.price),
      memberPrice:
        service.member_price === null || service.member_price === undefined
          ? ''
          : String(service.member_price),
      status: service.status,
    });
  };
  const updateProductDraftFromSelection = (value: string) => {
    const matched = productOptions.find((option) => option.value === value);
    if (matched) {
      setProductDraft((current) => ({
        ...current,
        productName: matched.label,
        productId: matched.value,
      }));
      return;
    }
    setProductDraft((current) => ({
      ...current,
      productName: value,
      productId: undefined,
    }));
  };
  const updateProductBrandDraftFromSelection = (value: string) => {
    const matched = brandOptions.find((option) => option.value === value);
    if (matched) {
      setProductDraft((current) => ({
        ...current,
        brandName: matched.label,
        brandId: matched.value,
      }));
      return;
    }
    setProductDraft((current) => ({
      ...current,
      brandName: value,
      brandId: undefined,
    }));
  };
  const handleAddProduct = async () => {
    const productName = productDraft.productName.trim();
    const brandName = productDraft.brandName.trim();
    const price = Number(productDraft.price);

    if (!productName) {
      showToast('warning', 'Select or create a product before adding');
      return;
    }
    if (!brandName) {
      showToast('warning', 'Select or enter a brand before adding');
      return;
    }
    if (!productDraft.price || Number.isNaN(price) || price < 0) {
      showToast('warning', 'Enter a valid price before adding');
      return;
    }
    if (duplicateProductExists) {
      showToast('warning', 'This product already exists for the selected salon');
      return;
    }

    const matchedProduct = productOptions.find(
      (option) => option.label.trim().toLowerCase() === productName.toLowerCase()
    );
    const matchedBrand = brandOptions.find(
      (option) => option.label.trim().toLowerCase() === brandName.toLowerCase()
    );

    try {
      const body = {
        ...(matchedProduct ? { product_id: matchedProduct.value } : { custom_product_name: productName }),
        ...(brandName
          ? matchedBrand
            ? { brand_id: matchedBrand.value }
            : { custom_brand_name: brandName }
          : {}),
        price,
      };
      const response = await createSalonProduct({
        salon_id: salonId,
        body,
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Salon product added successfully');
        resetProductDraft();
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to add salon product'));
    }
  };
  const handleOpenProductEdit = (product: SalonProductItem) => {
    setEditingProduct(product);
    setEditProductDraft({
      productName: product.base_product_name || product.product_name,
      productId: product.product_id ?? undefined,
      brandName: product.brand_name ?? '',
      brandId: product.brand_id ?? undefined,
      price: String(product.price),
      status: product.status,
    });
  };
  const updateEditProductFromSelection = (value: string) => {
    const matched = productOptions.find((option) => option.value === value);
    if (matched) {
      setEditProductDraft((current) => ({
        ...current,
        productName: matched.label,
        productId: matched.value,
      }));
      return;
    }
    setEditProductDraft((current) => ({
      ...current,
      productName: value,
      productId: undefined,
    }));
  };
  const updateEditProductBrandFromSelection = (value: string) => {
    const matched = brandOptions.find((option) => option.value === value);
    if (matched) {
      setEditProductDraft((current) => ({
        ...current,
        brandName: matched.label,
        brandId: matched.value,
      }));
      return;
    }
    setEditProductDraft((current) => ({
      ...current,
      brandName: value,
      brandId: undefined,
    }));
  };
  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    const productName = editProductDraft.productName.trim();
    const brandName = editProductDraft.brandName.trim();
    const price = Number(editProductDraft.price);

    if (!productName) {
      showToast('warning', 'Select or create a product before saving');
      return;
    }
    if (!brandName) {
      showToast('warning', 'Select or enter a brand before saving');
      return;
    }
    if (!editProductDraft.price || Number.isNaN(price) || price < 0) {
      showToast('warning', 'Enter a valid price before saving');
      return;
    }

    const duplicate = salonProducts.some(
      (item) => {
        if (item.id === editingProduct.id) return false;
        const itemProductName = (item.base_product_name || item.product_name).trim().toLowerCase();
        const itemBrandName = (item.brand_name || '').trim().toLowerCase();
        return (
          itemProductName === productName.toLowerCase() &&
          itemBrandName === brandName.toLowerCase()
        );
      }
    );
    if (duplicate) {
      showToast('warning', 'This product already exists for the selected salon');
      return;
    }

    const matchedProduct = productOptions.find(
      (option) => option.label.trim().toLowerCase() === productName.toLowerCase()
    );
    const matchedBrand = brandOptions.find(
      (option) => option.label.trim().toLowerCase() === brandName.toLowerCase()
    );

    try {
      const body = {
        ...(matchedProduct ? { product_id: matchedProduct.value } : { custom_product_name: productName }),
        ...(brandName
          ? matchedBrand
            ? { brand_id: matchedBrand.value }
            : { custom_brand_name: brandName }
          : {}),
        price,
        status: editProductDraft.status,
      };
      const response = await updateSalonProduct({
        id: editingProduct.id,
        salon_id: salonId,
        body,
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Salon product updated successfully');
        setEditingProduct(null);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to update salon product'));
    }
  };
  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      const response = await deleteSalonProduct({
        id: deletingProduct.id,
        salon_id: salonId,
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Salon product deleted successfully');
        setDeletingProduct(null);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete salon product'));
    }
  };

  const updateEditFromSelection = (value: string) => {
    const matched = serviceOptions.find((option) => option.value === value);
    if (matched) {
      setEditDraft((current) => ({
        ...current,
        serviceName: matched.label,
        serviceId: matched.value,
      }));
      return;
    }
    setEditDraft((current) => ({
      ...current,
      serviceName: value,
      serviceId: undefined,
    }));
  };

  const handleUpdateService = async () => {
    if (!editingService) return;

    const serviceName = editDraft.serviceName.trim();
    const price = Number(editDraft.price);
    const memberPriceRaw = editDraft.memberPrice.trim();
    const memberPrice = memberPriceRaw === '' ? null : Number(memberPriceRaw);

    if (!serviceName) {
      showToast('warning', 'Select or create a service before saving');
      return;
    }
    if (!editDraft.price || Number.isNaN(price) || price <= 0) {
      showToast('warning', 'Enter a valid price before saving');
      return;
    }
    if (memberPriceRaw !== '' && (Number.isNaN(memberPrice) || (memberPrice as number) < 0)) {
      showToast('warning', 'Enter a valid member price or leave it blank');
      return;
    }

    const duplicate = salonServices.some(
      (item) =>
        item.id !== editingService.id &&
        item.service_name.trim().toLowerCase() === serviceName.toLowerCase()
    );
    if (duplicate) {
      showToast('warning', 'This service already exists for the selected salon');
      return;
    }

    const matchedService = serviceOptions.find(
      (option) => option.label.trim().toLowerCase() === serviceName.toLowerCase()
    );

    try {
      const response = await updateSalonService({
        id: editingService.id,
        salon_id: salonId,
        body: matchedService
          ? {
              service_id: matchedService.value,
              price,
              member_price: memberPrice,
              status: editDraft.status,
            }
          : {
              custom_service_name: serviceName,
              price,
              member_price: memberPrice,
              status: editDraft.status,
            },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Salon service updated successfully');
        setEditingService(null);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to update salon service'));
    }
  };

  const handleDeleteService = async () => {
    if (!deletingService) return;
    try {
      const response = await deleteSalonService({
        id: deletingService.id,
        salon_id: salonId,
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Salon service deleted successfully');
        setDeletingService(null);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete salon service'));
    }
  };

  const handleBulkDeleteServices = async () => {
    if (!selectedServiceIds.length) return;
    try {
      const response = await bulkDeleteSalonServices({
        salon_id: salonId,
        body: { ids: selectedServiceIds.map(String) },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Selected services deleted successfully');
        setSelectedServiceIds([]);
        setIsBulkDeletingServicesModalOpen(false);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete services'));
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (!selectedProductIds.length) return;
    try {
      const response = await bulkDeleteSalonProducts({
        salon_id: salonId,
        body: { ids: selectedProductIds.map(String) },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Selected products deleted successfully');
        setSelectedProductIds([]);
        setIsBulkDeletingProductsModalOpen(false);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to delete products'));
    }
  };

  const handleExcelImport = async (data: { serviceName: string; price: number; memberPrice?: number }[]) => {
    setIsImporting(true);
    let successCount = 0;
    let skippedCount = 0;
    try {
      for (const item of data) {
        const matchedService = serviceOptions.find(
          (option) => option.label.trim().toLowerCase() === item.serviceName.toLowerCase()
        );
        const duplicate = salonServices.some(
          (s) => s.service_name.trim().toLowerCase() === item.serviceName.toLowerCase()
        );
        if (duplicate) {
          skippedCount++;
          continue; // Skip duplicates
        }

        await createSalonService({
          salon_id: salonId,
          body: matchedService
            ? {
                service_id: matchedService.value,
                price: item.price,
                member_price: item.memberPrice ?? null,
              }
            : {
                custom_service_name: item.serviceName,
                price: item.price,
                member_price: item.memberPrice ?? null,
              },
        }).unwrap();
        successCount++;
      }
      if (successCount > 0) {
        showToast('success', `Successfully imported ${successCount} services.` + (skippedCount > 0 ? ` Skipped ${skippedCount} duplicate(s).` : ''));
      } else if (skippedCount > 0) {
        showToast('warning', `No new services imported. All ${skippedCount} were duplicates.`);
      } else {
        showToast('info', 'No services were imported.');
      }
      setIsImportModalOpen(false);
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to import services.'));
    } finally {
      setIsImporting(false);
    }
  };

  if (!salonId && isSuperAdmin(user?.role)) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Select a salon from the header to manage salon services and products.
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
            Manage Salon
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure salon services now, with products and assets ready for the next phase.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
          {activeTab === 'services'
            ? isFetchingSalonServices
              ? 'Refreshing salon data...'
              : `${salonServices.length} services configured`
            : isFetchingSalonProducts
              ? 'Refreshing salon data...'
              : `${salonProducts.length} products configured`}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'assets' ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Warehouse className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Assets tab coming soon</h2>
          <p className="mt-2 text-sm text-gray-500">
            The full services flow is ready. Products and assets can now be added on this same page
            without changing the layout.
          </p>
        </div>
      ) : activeTab === 'services' ? (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 via-white to-amber-50/30 px-6 py-5 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand-gold)]/10 text-[var(--color-brand-gold-dark)] shadow-xs">
                    <Scissors className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">Add Salon Service</h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Select a predefined service or type a custom one, then configure pricing.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Catalog Active
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="ml-2 !py-1.5 text-xs font-semibold"
                    leftIcon={<Upload className="h-3.5 w-3.5" />}
                    onClick={() => setIsImportModalOpen(true)}
                  >
                    Import via Excel
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-6">
              {duplicateExists && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs font-medium text-amber-800 shadow-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>This service name already exists in your salon's catalog. Please choose another or edit the existing service.</span>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:p-5 transition-colors focus-within:border-[var(--color-brand-gold)]/50 focus-within:bg-white">
                  <FormField label="Service Name" name="serviceName" required>
                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Option 1: Choose Predefined</span>
                        <CommonDropdown
                          options={serviceOptions}
                          value={draft.serviceId}
                          onChange={(value) => updateDraftFromSelection(String(value))}
                          placeholder="Search and select a predefined service"
                          searchable
                          loading={isLoadingMasterServices}
                        />
                      </div>

                      <div className="relative flex items-center py-1">
                        <div className="grow border-t border-gray-200"></div>
                        <span className="mx-2 shrink text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 rounded">OR</span>
                        <div className="grow border-t border-gray-200"></div>
                      </div>

                      <div>
                        <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Option 2: Create Custom</span>
                        <Input
                          id="serviceName"
                          placeholder="Type custom service name"
                          value={draft.serviceName}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              serviceName: event.target.value,
                              serviceId: undefined,
                            }))
                          }
                        />
                      </div>

                      {draft.serviceName.trim() &&
                        !serviceOptions.some(
                          (option) =>
                            option.label.trim().toLowerCase() === draft.serviceName.trim().toLowerCase()
                        ) && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-brand-gold)]/30 bg-[var(--color-brand-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            Creating new service: "{draft.serviceName.trim()}"
                          </div>
                        )}
                    </div>
                  </FormField>
                </div>

                <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:p-5 transition-colors focus-within:border-[var(--color-brand-gold)]/50 focus-within:bg-white space-y-4">
                  <div>
                    <span className="mb-2 block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Pricing Options</span>
                    <div className="space-y-4">
                      <FormField label="Normal Price" name="price" required>
                        <Input
                          id="price"
                          type="number"
                          min="1"
                          step="0.01"
                          placeholder="0.00"
                          value={draft.price}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              price: event.target.value,
                            }))
                          }
                        />
                      </FormField>

                      <FormField label="Member Price" name="memberPrice">
                        <Input
                          id="memberPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Optional discounted price"
                          value={draft.memberPrice}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              memberPrice: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3 flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50/70 p-4 sm:p-5 shadow-xs">
                  <div className="space-y-3">
                    <span className="block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Service Summary</span>
                    <div className="rounded-xl border border-gray-200/60 bg-white p-3.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-[var(--color-brand-gold-dark)] shrink-0" />
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {draft.serviceName.trim() || 'Select or enter service'}
                        </span>
                      </div>
                      <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-xs">
                        <span className="text-gray-500">Normal Price:</span>
                        <span className="font-bold text-gray-900">
                          {draft.price ? formatCurrency(Number(draft.price)) : '—'}
                        </span>
                      </div>
                      {draft.memberPrice && (
                        <div className="flex items-center justify-between text-xs text-amber-700 bg-amber-50/80 px-2 py-1 rounded-md">
                          <span className="font-medium">Member Price:</span>
                          <span className="font-bold">{formatCurrency(Number(draft.memberPrice))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button
                      type="button"
                      fullWidth
                      icon={<Plus className="h-4 w-4" />}
                      onClick={handleAddService}
                      isLoading={isCreating}
                      disabled={isCreating || duplicateExists}
                    >
                      Add Service
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CommonTable
            data={paginatedServices}
            rowKey="id"
            selectable
            selectedRowKeys={selectedServiceIds}
            onSelectionChange={(keys) => setSelectedServiceIds(keys)}
            loading={isLoadingSalonServices}
            title="Salon services"
            subtitle="Selected services for this salon with pricing and status."
            enableGlobalSearch={false}
            filters={
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-full sm:w-80">
                  <Input
                    placeholder="Search services..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                {selectedServiceIds.length > 0 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="!py-1.5 text-xs font-semibold shrink-0"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setIsBulkDeletingServicesModalOpen(true)}
                  >
                    Delete Selected ({selectedServiceIds.length})
                  </Button>
                )}
              </div>
            }
            columns={[
              {
                key: 'service_name',
                header: 'Service Name',
                accessor: 'service_name',
                sortable: true,
                render: (row) => row.service_name || '-',
              },
              {
                key: 'price',
                header: 'Normal Price',
                accessor: (row) => formatCurrency(row.price),
                sortable: true,
                render: (row) => formatCurrency(row.price),
              },
              {
                key: 'member_price',
                header: 'Member Price',
                accessor: (row) =>
                  row.member_price === null || row.member_price === undefined
                    ? ''
                    : formatCurrency(row.member_price),
                sortable: true,
                render: (row) =>
                  row.member_price === null || row.member_price === undefined
                    ? '—'
                    : formatCurrency(row.member_price),
              },
              {
                key: 'created_at',
                header: 'Created Date',
                accessor: 'created_at',
                sortable: true,
                render: (row) => formatDateDMY(row.created_at, '-'),
              },
              {
                key: 'status',
                header: 'Status',
                accessor: 'status',
                sortable: true,
                type: 'status',
                render: (row) => row.status || '-',
              },
            ]}
            actions={[
              {
                type: 'edit',
                label: 'Edit',
                icon: <Pencil className="h-4 w-4" />,
                onClick: handleOpenEdit,
              },
              {
                type: 'delete',
                label: 'Delete',
                icon: <Trash2 className="h-4 w-4" />,
                onClick: (row) => setDeletingService(row),
              },
            ]}
            pagination
            manualPagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            totalItems={filteredServices.length}
            onPageChange={setCurrentPage}
            emptyTitle="No salon services yet"
            emptyDescription="Add a predefined or custom service to start building this salon's catalog."
          />
          {filteredServices.length > PAGE_SIZE && (
            <div className="flex justify-end text-xs text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 via-white to-amber-50/30 px-6 py-5 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand-gold)]/10 text-[var(--color-brand-gold-dark)] shadow-xs">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">Add Salon Product</h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Select or type product and brand details, then specify retail pricing for this salon.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Catalog Active
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-6">
              {duplicateProductExists && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs font-medium text-amber-800 shadow-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>This product already exists for the selected salon. Please choose another or edit the existing product.</span>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:p-5 transition-colors focus-within:border-[var(--color-brand-gold)]/50 focus-within:bg-white">
                  <FormField label="Product" name="productName" required>
                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Option 1: Predefined Product</span>
                        <CommonDropdown
                          options={productOptions}
                          value={productDraft.productId}
                          onChange={(value) => updateProductDraftFromSelection(String(value))}
                          placeholder="Search and select predefined product"
                          searchable
                          loading={isLoadingMasterProducts}
                        />
                      </div>

                      <div className="relative flex items-center py-1">
                        <div className="grow border-t border-gray-200"></div>
                        <span className="mx-2 shrink text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 rounded">OR</span>
                        <div className="grow border-t border-gray-200"></div>
                      </div>

                      <div>
                        <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Option 2: Custom Product</span>
                        <Input
                          id="productName"
                          placeholder="Type custom product name"
                          value={productDraft.productName}
                          onChange={(event) =>
                            setProductDraft((current) => ({
                              ...current,
                              productName: event.target.value,
                              productId: undefined,
                            }))
                          }
                        />
                      </div>

                      {productDraft.productName.trim() &&
                        !productOptions.some(
                          (option) =>
                            option.label.trim().toLowerCase() ===
                            productDraft.productName.trim().toLowerCase()
                        ) && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-brand-gold)]/30 bg-[var(--color-brand-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            Creating new product: "{productDraft.productName.trim()}"
                          </div>
                        )}
                    </div>
                  </FormField>
                </div>

                <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:p-5 transition-colors focus-within:border-[var(--color-brand-gold)]/50 focus-within:bg-white">
                  <FormField label="Brand" name="brandName" required>
                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Option 1: Select Brand</span>
                        <CommonDropdown
                          options={brandOptions}
                          value={productDraft.brandId}
                          onChange={(value) => updateProductBrandDraftFromSelection(String(value))}
                          placeholder="Search and select brand"
                          searchable
                          loading={isLoadingBrands}
                        />
                      </div>

                      <div className="relative flex items-center py-1">
                        <div className="grow border-t border-gray-200"></div>
                        <span className="mx-2 shrink text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 rounded">OR</span>
                        <div className="grow border-t border-gray-200"></div>
                      </div>

                      <div>
                        <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Option 2: Custom Brand</span>
                        <Input
                          id="brandName"
                          placeholder="Type custom brand name"
                          value={productDraft.brandName}
                          onChange={(event) =>
                            setProductDraft((current) => ({
                              ...current,
                              brandName: event.target.value,
                              brandId: undefined,
                            }))
                          }
                        />
                      </div>

                      {productDraft.brandName.trim() &&
                        !brandOptions.some(
                          (option) =>
                            option.label.trim().toLowerCase() ===
                            productDraft.brandName.trim().toLowerCase()
                        ) && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-brand-gold)]/30 bg-[var(--color-brand-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            Creating new brand: "{productDraft.brandName.trim()}"
                          </div>
                        )}
                    </div>
                  </FormField>
                </div>

                <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50/70 p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="space-y-4">
                    <FormField label="Price" name="price" required>
                      <Input
                        id="productPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={productDraft.price}
                        onChange={(event) =>
                          setProductDraft((current) => ({
                            ...current,
                            price: event.target.value,
                          }))
                        }
                      />
                    </FormField>

                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Product Summary</span>
                      <div className="rounded-xl border border-gray-200/60 bg-white p-3.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-[var(--color-brand-gold-dark)] shrink-0" />
                          <span className="text-xs font-semibold text-gray-900 truncate">
                            {productDraft.productName.trim() || 'Product Name'}
                          </span>
                        </div>
                        {productDraft.brandName.trim() && (
                          <div className="text-xs text-gray-500 pl-5.5 font-medium">
                            Brand: <span className="font-semibold text-gray-700">{productDraft.brandName.trim()}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-xs">
                          <span className="text-gray-500">Retail Price:</span>
                          <span className="font-bold text-gray-900">
                            {productDraft.price ? formatCurrency(Number(productDraft.price)) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      fullWidth
                      icon={<Plus className="h-4 w-4" />}
                      onClick={handleAddProduct}
                      isLoading={isCreatingProduct}
                      disabled={isCreatingProduct || duplicateProductExists}
                    >
                      Add Product
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CommonTable
            data={paginatedProducts}
            rowKey="id"
            selectable
            selectedRowKeys={selectedProductIds}
            onSelectionChange={(keys) => setSelectedProductIds(keys)}
            loading={isLoadingSalonProducts}
            title="Salon products"
            subtitle="Selected products for this salon with pricing and status."
            enableGlobalSearch={false}
            filters={
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Search products..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  <CommonDropdown
                    options={brandOptions}
                    value={
                      brandOptions.find((option) => option.label === brandFilter)?.value ?? brandFilter
                    }
                    onChange={(value) => {
                      const matched = brandOptions.find((option) => option.value === String(value));
                      setBrandFilter(matched?.label ?? String(value));
                      setCurrentPage(1);
                    }}
                    placeholder="Filter by brand"
                    searchable
                    loading={isLoadingBrands}
                  />
                </div>
                {selectedProductIds.length > 0 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="!py-1.5 text-xs font-semibold shrink-0"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setIsBulkDeletingProductsModalOpen(true)}
                  >
                    Delete Selected ({selectedProductIds.length})
                  </Button>
                )}
              </div>
            }
            columns={[
              {
                key: 'product_name',
                header: 'Product Name',
                accessor: 'product_name',
                sortable: true,
                render: (row) => row.product_name || '-',
              },
              {
                key: 'price',
                header: 'Price',
                accessor: (row) => formatCurrency(row.price),
                sortable: true,
                render: (row) => formatCurrency(row.price),
              },
              {
                key: 'created_at',
                header: 'Created Date',
                accessor: 'created_at',
                sortable: true,
                render: (row) => formatDateDMY(row.created_at, '-'),
              },
              {
                key: 'status',
                header: 'Status',
                accessor: 'status',
                sortable: true,
                type: 'status',
                render: (row) => row.status || '-',
              },
            ]}
            actions={[
              {
                type: 'edit',
                label: 'Edit',
                icon: <Pencil className="h-4 w-4" />,
                onClick: handleOpenProductEdit,
              },
              {
                type: 'delete',
                label: 'Delete',
                icon: <Trash2 className="h-4 w-4" />,
                onClick: (row) => setDeletingProduct(row),
              },
            ]}
            pagination
            manualPagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            totalItems={filteredProducts.length}
            onPageChange={setCurrentPage}
            emptyTitle="No salon products yet"
            emptyDescription="Add a predefined or custom product to start building this salon's catalog."
          />
          {filteredProducts.length > PAGE_SIZE && (
            <div className="flex justify-end text-xs text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
          )}
        </div>
      )}

      <CommonModal
        open={!!editingService}
        title="Edit service"
        subtitle="Update the service mapping, price, or status for this salon."
        onClose={() => setEditingService(null)}
        onConfirm={handleUpdateService}
        confirmLabel="Save changes"
        isLoading={false}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditingService(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateService} isLoading={isUpdating}>
              Save changes
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Service" name="editServiceName" required>
            <div className="space-y-2">
              <CommonDropdown
                options={serviceOptions}
                value={editDraft.serviceId}
                onChange={(value) => updateEditFromSelection(String(value))}
                placeholder="Search and select a predefined service"
                searchable
                loading={isLoadingMasterServices}
              />
              <Input
                id="editServiceName"
                placeholder="Or type a custom service name"
                value={editDraft.serviceName}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    serviceName: event.target.value,
                    serviceId: undefined,
                  }))
                }
              />
            </div>
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Normal Price" name="editPrice" required>
              <Input
                id="editPrice"
                type="number"
                min="1"
                step="0.01"
                value={editDraft.price}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Member Price" name="editMemberPrice">
              <Input
                id="editMemberPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={editDraft.memberPrice}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    memberPrice: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Status" name="editStatus" required>
              <CommonDropdown
                options={statusOptions}
                value={editDraft.status}
                onChange={(value) =>
                  setEditDraft((current) => ({
                    ...current,
                    status: String(value),
                  }))
                }
                searchable={false}
                clearable={false}
              />
            </FormField>
          </div>
        </div>
      </CommonModal>

      <CommonModal
        open={!!editingProduct}
        title="Edit product"
        subtitle="Update the product mapping, price, or status for this salon."
        onClose={() => setEditingProduct(null)}
        onConfirm={handleUpdateProduct}
        confirmLabel="Save changes"
        isLoading={false}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateProduct} isLoading={isUpdatingProduct}>
              Save changes
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Product" name="editProductName" required>
            <div className="space-y-2">
              <CommonDropdown
                options={productOptions}
                value={editProductDraft.productId}
                onChange={(value) => updateEditProductFromSelection(String(value))}
                placeholder="Search and select a predefined product"
                searchable
                loading={isLoadingMasterProducts}
              />
              <Input
                id="editProductName"
                placeholder="Or type a custom product name"
                value={editProductDraft.productName}
                onChange={(event) =>
                  setEditProductDraft((current) => ({
                    ...current,
                    productName: event.target.value,
                    productId: undefined,
                  }))
                }
              />
            </div>
          </FormField>

          <FormField label="Brand" name="editBrandName" required>
            <div className="space-y-2">
              <CommonDropdown
                options={brandOptions}
                value={editProductDraft.brandId}
                onChange={(value) => updateEditProductBrandFromSelection(String(value))}
                placeholder="Search and select a brand"
                searchable
                loading={isLoadingBrands}
              />
              <Input
                id="editBrandName"
                placeholder="Or type a new brand"
                value={editProductDraft.brandName}
                onChange={(event) =>
                  setEditProductDraft((current) => ({
                    ...current,
                    brandName: event.target.value,
                    brandId: undefined,
                  }))
                }
              />
            </div>
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Price" name="editProductPrice" required>
              <Input
                id="editProductPrice"
                type="number"
                min="0"
                step="0.01"
                value={editProductDraft.price}
                onChange={(event) =>
                  setEditProductDraft((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Status" name="editProductStatus" required>
              <CommonDropdown
                options={statusOptions}
                value={editProductDraft.status}
                onChange={(value) =>
                  setEditProductDraft((current) => ({
                    ...current,
                    status: String(value),
                  }))
                }
                searchable={false}
                clearable={false}
              />
            </FormField>
          </div>
          {editProductDraft.productName.trim() && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Preview:{' '}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {editProductDraft.productName.trim()}
                {editProductDraft.brandName.trim()
                  ? ` (${editProductDraft.brandName.trim()})`
                  : ''}{' '}
                - {formatCurrency(Number(editProductDraft.price || 0))}
              </span>
            </p>
          )}
        </div>
      </CommonModal>

      <CommonModal
        open={!!deletingService}
        title="Delete service"
        subtitle="This will remove the selected service from this salon."
        onClose={() => setDeletingService(null)}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setDeletingService(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteService}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">
            {deletingService?.service_name ?? '-'}
          </span>
          ?
        </p>
      </CommonModal>

      <CommonModal
        open={!!deletingProduct}
        title="Delete product"
        subtitle="This will remove the selected product from this salon."
        onClose={() => setDeletingProduct(null)}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setDeletingProduct(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteProduct}
              isLoading={isDeletingProduct}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">
            {deletingProduct?.product_name ?? '-'}
          </span>
          ?
        </p>
      </CommonModal>

      <CommonModal
        open={isBulkDeletingServicesModalOpen}
        title="Delete Selected Services"
        subtitle={`This will remove ${selectedServiceIds.length} selected services from this salon.`}
        onClose={() => setIsBulkDeletingServicesModalOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsBulkDeletingServicesModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleBulkDeleteServices}
              isLoading={isBulkDeletingServices}
            >
              Delete {selectedServiceIds.length} Items
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete these services? This action cannot be undone.
        </p>
      </CommonModal>

      <CommonModal
        open={isBulkDeletingProductsModalOpen}
        title="Delete Selected Products"
        subtitle={`This will remove ${selectedProductIds.length} selected products from this salon.`}
        onClose={() => setIsBulkDeletingProductsModalOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsBulkDeletingProductsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleBulkDeleteProducts}
              isLoading={isBulkDeletingProducts}
            >
              Delete {selectedProductIds.length} Items
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete these products? This action cannot be undone.
        </p>
      </CommonModal>

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleExcelImport}
        isImporting={isImporting}
      />
    </div>
  );
};

export default Services;
