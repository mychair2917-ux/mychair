from beanie import PydanticObjectId

from app.auth.rbac_config import ROLE_SUPER_ADMIN, normalize_role
from app.constants.master_products import MASTER_PRODUCT_NAMES
from app.core import tenant_context
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.product import Product
from app.models.salon_product import SalonProduct
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.salon_product import (
    MasterProductItem,
    SalonProductCreate,
    SalonProductListItem,
    SalonProductUpdate,
)
from app.services.brand import BrandService


class SalonProductService:
    def __init__(self) -> None:
        self.brand_service = BrandService()

    @staticmethod
    def _normalize_name(value: str | None) -> str:
        return (value or "").strip().casefold()

    @staticmethod
    def _combined_name(product_name: str, brand_name: str | None) -> str:
        cleaned_product = (product_name or "").strip() or "-"
        cleaned_brand = (brand_name or "").strip()
        return f"{cleaned_product} ({cleaned_brand})" if cleaned_brand else cleaned_product

    async def seed_master_products(self) -> None:
        existing = await Product.find(
            {"tenant_id": None, "is_deleted": False}
        ).to_list()
        existing_names = {
            self._normalize_name(item.name) for item in existing if getattr(item, "name", None)
        }

        items_to_create = []
        for name in MASTER_PRODUCT_NAMES:
            normalized = self._normalize_name(name)
            if normalized in existing_names:
                continue
            items_to_create.append(
                Product(
                    tenant_id=None,
                    name=name,
                    description=None,
                    price=1,
                    tax_rate=0,
                    is_active=True,
                )
            )
            existing_names.add(normalized)

        if items_to_create:
            await Product.insert_many(items_to_create)

    async def list_master_products(self, actor: User) -> list[MasterProductItem]:
        tenant_id = tenant_context.get_tenant_id()
        if normalize_role(actor.role) != ROLE_SUPER_ADMIN:
            tenant_id = str(actor.tenant_id or "").strip() or tenant_id

        query = {
            "is_deleted": False,
            "is_active": True,
        }
        if tenant_id:
            query["$or"] = [{"tenant_id": None}, {"tenant_id": tenant_id}]
        else:
            query["tenant_id"] = None

        products = await Product.find(query).sort("name").to_list()
        return [
            MasterProductItem(
                id=str(product.id),
                name=product.name,
                status="ACTIVE" if product.is_active else "INACTIVE",
                created_at=product.created_at,
                updated_at=product.updated_at,
            )
            for product in products
        ]

    async def _resolve_actor_salon_scope(
        self, actor: User, salon_id: str | None = None
    ) -> str:
        normalized_role = normalize_role(actor.role)
        if normalized_role == ROLE_SUPER_ADMIN:
            if not salon_id:
                raise PermissionDeniedException(detail="salon_id is required for super admin")
            tenant = await Tenant.find_one(
                Tenant.id == PydanticObjectId(salon_id), Tenant.is_deleted == False
            )
            if not tenant:
                raise ResourceNotFoundException("Salon not found")
            return str(tenant.id)

        resolved_salon_id = salon_id or (actor.tenant_id and str(actor.tenant_id))
        if not resolved_salon_id:
            raise PermissionDeniedException(detail="No salon associated with your account")
        return resolved_salon_id

    async def _get_master_product(self, actor: User, product_id: str) -> Product:
        try:
            object_id = PydanticObjectId(product_id)
        except Exception as exc:
            raise ResourceNotFoundException("Master product not found") from exc

        tenant_id = tenant_context.get_tenant_id()
        if normalize_role(actor.role) != ROLE_SUPER_ADMIN:
            tenant_id = str(actor.tenant_id or "").strip() or tenant_id

        query = {
            "_id": object_id,
            "is_deleted": False,
            "is_active": True,
        }
        if tenant_id:
            query["$or"] = [{"tenant_id": None}, {"tenant_id": tenant_id}]
        else:
            query["tenant_id"] = None

        product = await Product.find_one(query)
        if not product:
            raise ResourceNotFoundException("Master product not found")
        return product

    async def _ensure_no_duplicate(
        self,
        salon_id: str,
        product_id: str | None,
        custom_product_name: str | None,
        brand_id: str | None,
        custom_brand_name: str | None,
        exclude_id: str | None = None,
    ) -> None:
        query: dict = {
            "salon_id": salon_id,
            "is_deleted": False,
            "brand_id": brand_id,
            "custom_brand_name": custom_brand_name,
        }
        if product_id:
            query["product_id"] = product_id
        else:
            query["custom_product_name"] = custom_product_name

        existing = await SalonProduct.find_one(query)
        if existing and str(existing.id) != exclude_id:
            raise PermissionDeniedException(
                detail="This product and brand combination already exists for the selected salon"
            )

    async def _get_or_create_product(
        self,
        actor: User,
        payload: SalonProductCreate | SalonProductUpdate,
        tenant_id: str,
    ) -> tuple[str | None, str]:
        if payload.product_id:
            master_product = await self._get_master_product(actor, payload.product_id)
            payload.custom_product_name = None
            return str(master_product.id), master_product.name

        product_name = (payload.custom_product_name or "").strip()
        existing_product = await Product.find_one(
            Product.tenant_id == tenant_id,
            Product.name == product_name,
            Product.is_deleted == False,
        )
        if existing_product:
            return str(existing_product.id), existing_product.name

        created_product = Product(
            tenant_id=tenant_id,
            name=product_name,
            price=payload.price,
            tax_rate=0.0,
            is_active=True,
            created_by=str(actor.id),
        )
        await created_product.insert()
        return str(created_product.id), created_product.name

    async def create_salon_product(
        self, actor: User, payload: SalonProductCreate, salon_id: str | None = None
    ) -> SalonProductListItem:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        resolved_product_id, product_name = await self._get_or_create_product(
            actor, payload, resolved_salon_id
        )
        resolved_brand_id, brand_name = await self.brand_service.resolve_brand(
            actor,
            payload.brand_id,
            payload.custom_brand_name,
            resolved_salon_id,
        )

        await self._ensure_no_duplicate(
            resolved_salon_id,
            resolved_product_id,
            payload.custom_product_name,
            resolved_brand_id,
            brand_name if not resolved_brand_id else None,
        )

        item = SalonProduct(
            salon_id=resolved_salon_id,
            product_id=resolved_product_id,
            brand_id=resolved_brand_id,
            custom_product_name=payload.custom_product_name,
            custom_brand_name=brand_name if not resolved_brand_id else None,
            price=payload.price,
            status="ACTIVE",
            created_by=str(actor.id),
        )
        await item.insert()
        return SalonProductListItem(
            id=str(item.id),
            salon_id=item.salon_id,
            product_id=item.product_id,
            brand_id=item.brand_id,
            custom_product_name=item.custom_product_name,
            custom_brand_name=item.custom_brand_name,
            product_name=self._combined_name(product_name, brand_name),
            base_product_name=product_name,
            brand_name=brand_name,
            price=item.price,
            status=item.status,
            created_by=item.created_by,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def list_salon_products(
        self, actor: User, salon_id: str | None = None
    ) -> list[SalonProductListItem]:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        items = await SalonProduct.find(
            SalonProduct.salon_id == resolved_salon_id,
            SalonProduct.is_deleted == False,
        ).sort("-created_at").to_list()

        master_product_ids = [
            PydanticObjectId(item.product_id) for item in items if item.product_id
        ]
        master_product_map: dict[str, Product] = {}
        if master_product_ids:
            master_products = await Product.find(
                {"_id": {"$in": master_product_ids}, "is_deleted": False}
            ).to_list()
            master_product_map = {str(product.id): product for product in master_products}

        brand_ids = [
            PydanticObjectId(item.brand_id) for item in items if item.brand_id
        ]
        brand_map: dict[str, str] = {}
        if brand_ids:
            from app.models.brand import Brand

            brands = await Brand.find(
                {"_id": {"$in": brand_ids}, "is_deleted": False}
            ).to_list()
            brand_map = {str(brand.id): brand.name for brand in brands}

        result: list[SalonProductListItem] = []
        for item in items:
            base_product_name = (
                master_product_map.get(item.product_id).name
                if item.product_id and master_product_map.get(item.product_id)
                else item.custom_product_name
            ) or "-"
            brand_name = (
                brand_map.get(item.brand_id)
                if item.brand_id and brand_map.get(item.brand_id)
                else item.custom_brand_name
            )
            result.append(
                SalonProductListItem(
                    id=str(item.id),
                    salon_id=item.salon_id,
                    product_id=item.product_id,
                    brand_id=item.brand_id,
                    custom_product_name=item.custom_product_name,
                    custom_brand_name=item.custom_brand_name,
                    product_name=self._combined_name(base_product_name, brand_name),
                    base_product_name=base_product_name,
                    brand_name=brand_name,
                    price=item.price,
                    status=item.status,
                    created_by=item.created_by,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )
        return result

    async def update_salon_product(
        self,
        actor: User,
        salon_product_id: str,
        payload: SalonProductUpdate,
        salon_id: str | None = None,
    ) -> SalonProductListItem:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        item = await SalonProduct.find_one(
            SalonProduct.id == PydanticObjectId(salon_product_id),
            SalonProduct.salon_id == resolved_salon_id,
            SalonProduct.is_deleted == False,
        )
        if not item:
            raise ResourceNotFoundException("Salon product not found")

        resolved_product_id, product_name = await self._get_or_create_product(
            actor, payload, resolved_salon_id
        )
        resolved_brand_id, brand_name = await self.brand_service.resolve_brand(
            actor,
            payload.brand_id,
            payload.custom_brand_name,
            resolved_salon_id,
        )

        await self._ensure_no_duplicate(
            resolved_salon_id,
            resolved_product_id,
            payload.custom_product_name,
            resolved_brand_id,
            brand_name if not resolved_brand_id else None,
            exclude_id=str(item.id),
        )

        item.product_id = resolved_product_id
        item.brand_id = resolved_brand_id
        item.custom_product_name = payload.custom_product_name
        item.custom_brand_name = brand_name if not resolved_brand_id else None
        item.price = payload.price
        item.status = payload.status
        item.updated_by = str(actor.id)
        await item.save()

        return SalonProductListItem(
            id=str(item.id),
            salon_id=item.salon_id,
            product_id=item.product_id,
            brand_id=item.brand_id,
            custom_product_name=item.custom_product_name,
            custom_brand_name=item.custom_brand_name,
            product_name=self._combined_name(product_name, brand_name),
            base_product_name=product_name,
            brand_name=brand_name,
            price=item.price,
            status=item.status,
            created_by=item.created_by,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def delete_salon_product(
        self, actor: User, salon_product_id: str, salon_id: str | None = None
    ) -> None:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        item = await SalonProduct.find_one(
            SalonProduct.id == PydanticObjectId(salon_product_id),
            SalonProduct.salon_id == resolved_salon_id,
            SalonProduct.is_deleted == False,
        )
        if not item:
            raise ResourceNotFoundException("Salon product not found")
        item.is_deleted = True
        item.updated_by = str(actor.id)
        await item.save()
