import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layers3, Package, Pencil, Plus, Scissors, Trash2, Warehouse } from 'lucide-react';

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
} from '../../../redux/slices/salonProducts/salonProductsApi';
import { SalonProductItem } from '../../../redux/slices/salonProducts/Types';
import {
  useCreateSalonServiceMutation,
  useDeleteSalonServiceMutation,
  useGetMasterServicesQuery,
  useGetSalonServicesQuery,
  useUpdateSalonServiceMutation,
} from '../../../redux/slices/salonServices/salonServicesApi';
import { SalonServiceItem } from '../../../redux/slices/salonServices/Types';
import { getApiErrorMessage } from '../../../utils/apiErrors';
import { formatCurrency } from '../../../utils/currency';
import { formatDateDMY } from '../../../utils/utilities';

type ManageSalonTab = 'services' | 'products' | 'assets';

type ServiceDraft = {
  serviceName: string;
  serviceId?: string;
  price: string;
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
    status: string;
  }>({
    serviceName: '',
    serviceId: undefined,
    price: '',
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

    if (!serviceName) {
      showToast('warning', 'Select or create a service before adding');
      return;
    }
    if (!draft.price || Number.isNaN(price) || price <= 0) {
      showToast('warning', 'Enter a valid price before adding');
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
            }
          : {
              custom_service_name: serviceName,
              price,
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

    if (!serviceName) {
      showToast('warning', 'Select or create a service before saving');
      return;
    }
    if (!editDraft.price || Number.isNaN(price) || price <= 0) {
      showToast('warning', 'Enter a valid price before saving');
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
              status: editDraft.status,
            }
          : {
              custom_service_name: serviceName,
              price,
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

  if (!salonId && isSuperAdmin(user?.role)) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Select a salon from the header to manage salon services and products.
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
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-gray-900">Add salon service</h2>
              <p className="text-sm text-gray-500">
                Search a master service or type a new one, then set a price before adding it to this
                salon.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_140px]">
              <FormField label="Service" name="serviceName" required>
                <div className="space-y-2">
                  <CommonDropdown
                    options={serviceOptions}
                    value={draft.serviceId}
                    onChange={(value) => updateDraftFromSelection(String(value))}
                    placeholder="Search and select a predefined service"
                    searchable
                    loading={isLoadingMasterServices}
                  />
                  <Input
                    id="serviceName"
                    placeholder="Or type a custom service name"
                    value={draft.serviceName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        serviceName: event.target.value,
                        serviceId: undefined,
                      }))
                    }
                  />
                  {draft.serviceName.trim() &&
                    !serviceOptions.some(
                      (option) =>
                        option.label.trim().toLowerCase() === draft.serviceName.trim().toLowerCase()
                    ) && (
                      <p className="text-xs text-[var(--color-brand-gold-dark)]">
                        Create new service: "{draft.serviceName.trim()}"
                      </p>
                    )}
                </div>
              </FormField>

              <FormField label="Price" name="price" required>
                <Input
                  id="price"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Enter price"
                  value={draft.price}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                />
              </FormField>

              <div className="flex items-end">
                <Button
                  type="button"
                  fullWidth
                  icon={<Plus className="h-4 w-4" />}
                  onClick={handleAddService}
                  isLoading={isCreating}
                  disabled={isCreating || duplicateExists}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <CommonTable
            data={paginatedServices}
            rowKey="id"
            loading={isLoadingSalonServices}
            title="Salon services"
            subtitle="Selected services for this salon with pricing and status."
            enableGlobalSearch={false}
            filters={
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
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-gray-900">Add salon product</h2>
              <p className="text-sm text-gray-500">
                Search a product or type a new one, then set a price before adding it to this salon.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_140px]">
              <FormField label="Product" name="productName" required>
                <div className="space-y-2">
                  <CommonDropdown
                    options={productOptions}
                    value={productDraft.productId}
                    onChange={(value) => updateProductDraftFromSelection(String(value))}
                    placeholder="Search and select a predefined product"
                    searchable
                    loading={isLoadingMasterProducts}
                  />
                  <Input
                    id="productName"
                    placeholder="Or type a custom product name"
                    value={productDraft.productName}
                    onChange={(event) =>
                      setProductDraft((current) => ({
                        ...current,
                        productName: event.target.value,
                        productId: undefined,
                      }))
                    }
                  />
                  {productDraft.productName.trim() &&
                    !productOptions.some(
                      (option) =>
                        option.label.trim().toLowerCase() ===
                        productDraft.productName.trim().toLowerCase()
                    ) && (
                      <p className="text-xs text-[var(--color-brand-gold-dark)]">
                        Create new product: "{productDraft.productName.trim()}"
                      </p>
                    )}
                </div>
              </FormField>

              <FormField label="Brand" name="brandName">
                <div className="space-y-2">
                  <CommonDropdown
                    options={brandOptions}
                    value={productDraft.brandId}
                    onChange={(value) => updateProductBrandDraftFromSelection(String(value))}
                    placeholder="Search and select a brand"
                    searchable
                    loading={isLoadingBrands}
                  />
                  <Input
                    id="brandName"
                    placeholder="Or type a new brand"
                    value={productDraft.brandName}
                    onChange={(event) =>
                      setProductDraft((current) => ({
                        ...current,
                        brandName: event.target.value,
                        brandId: undefined,
                      }))
                    }
                  />
                  {productDraft.brandName.trim() &&
                    !brandOptions.some(
                      (option) =>
                        option.label.trim().toLowerCase() ===
                        productDraft.brandName.trim().toLowerCase()
                    ) && (
                      <p className="text-xs text-[var(--color-brand-gold-dark)]">
                        Create new brand: "{productDraft.brandName.trim()}"
                      </p>
                    )}
                </div>
              </FormField>

              <FormField label="Price" name="price" required>
                <Input
                  id="productPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter price"
                  value={productDraft.price}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                />
              </FormField>

              <div className="flex items-end">
                <Button
                  type="button"
                  fullWidth
                  icon={<Plus className="h-4 w-4" />}
                  onClick={handleAddProduct}
                  isLoading={isCreatingProduct}
                  disabled={isCreatingProduct || duplicateProductExists}
                >
                  Add
                </Button>
              </div>
            </div>
            {productDraft.productName.trim() && (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                Preview:{' '}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {productDraft.productName.trim()}
                  {productDraft.brandName.trim() ? ` (${productDraft.brandName.trim()})` : ''} -{' '}
                  {formatCurrency(Number(productDraft.price || 0))}
                </span>
              </p>
            )}
          </div>

          <CommonTable
            data={paginatedProducts}
            rowKey="id"
            loading={isLoadingSalonProducts}
            title="Salon products"
            subtitle="Selected products for this salon with pricing and status."
            enableGlobalSearch={false}
            filters={
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
            <FormField label="Price" name="editPrice" required>
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

          <FormField label="Brand" name="editBrandName">
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
    </div>
  );
};

export default Services;
