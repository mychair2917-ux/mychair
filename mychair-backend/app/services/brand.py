import time

from beanie import PydanticObjectId

from app.auth.rbac_config import ROLE_SUPER_ADMIN, normalize_role
from app.core import tenant_context
from app.core.exceptions import ResourceNotFoundException
from app.models.brand import Brand
from app.models.salon_product import SalonProduct
from app.models.user import User
from app.schemas.brand import BrandItem

BRAND_CACHE_TTL_SECONDS = 60
_brand_cache: dict[tuple[str, str, str], tuple[float, list[BrandItem]]] = {}


class BrandService:
    @staticmethod
    def _normalize(value: str | None) -> str:
        return (value or "").strip().casefold()

    async def resolve_brand(
        self,
        actor: User,
        brand_id: str | None,
        brand_name: str | None,
        tenant_id: str,
    ) -> tuple[str | None, str | None]:
        if brand_id:
            try:
                brand_object_id = PydanticObjectId(brand_id)
            except Exception as exc:
                raise ResourceNotFoundException("Brand not found") from exc
            query = {"_id": brand_object_id, "is_deleted": False, "is_active": True}
            if normalize_role(actor.role) != ROLE_SUPER_ADMIN:
                query["$or"] = [{"tenant_id": None}, {"tenant_id": tenant_id}]
            brand = await Brand.find_one(query)
            if not brand:
                raise ResourceNotFoundException("Brand not found")
            return str(brand.id), brand.name

        cleaned_name = (brand_name or "").strip()
        if not cleaned_name:
            return None, None

        existing = await Brand.find_one(
            {
                "tenant_id": tenant_id,
                "name": {"$regex": f"^{cleaned_name}$", "$options": "i"},
                "is_deleted": False,
            }
        )
        if existing:
            return str(existing.id), existing.name

        created = Brand(
            tenant_id=tenant_id,
            name=cleaned_name,
            is_active=True,
            created_by=str(actor.id),
        )
        await created.insert()
        _brand_cache.clear()
        return str(created.id), created.name

    async def list_brands(
        self,
        actor: User,
        salon_id: str | None = None,
        search: str | None = None,
    ) -> list[BrandItem]:
        tenant_id = tenant_context.get_tenant_id()
        if normalize_role(actor.role) != ROLE_SUPER_ADMIN:
            tenant_id = str(actor.tenant_id or "").strip() or tenant_id

        cache_key = (tenant_id or "global", salon_id or "", self._normalize(search))
        cached = _brand_cache.get(cache_key)
        if cached and time.time() - cached[0] < BRAND_CACHE_TTL_SECONDS:
            return cached[1]

        brand_query = {"is_deleted": False, "is_active": True}
        if tenant_id:
            brand_query["$or"] = [{"tenant_id": None}, {"tenant_id": tenant_id}]
        else:
            brand_query["tenant_id"] = None
        if search and search.strip():
            brand_query["name"] = {"$regex": search.strip(), "$options": "i"}

        brands = await Brand.find(brand_query).sort("name").limit(50).to_list()
        usage_query = {
            "is_deleted": False,
            "brand_id": {"$ne": None},
        }
        if salon_id:
            usage_query["salon_id"] = salon_id
        elif tenant_id:
            usage_query["salon_id"] = tenant_id

        usage_counts: dict[str, int] = {}
        for item in await SalonProduct.find(usage_query).to_list():
            if item.brand_id:
                usage_counts[item.brand_id] = usage_counts.get(item.brand_id, 0) + 1

        result = [
            BrandItem(
                id=str(brand.id),
                name=brand.name,
                usage_count=usage_counts.get(str(brand.id), 0),
                created_at=brand.created_at,
                updated_at=brand.updated_at,
            )
            for brand in brands
        ]
        result.sort(key=lambda item: (-item.usage_count, item.name.casefold()))
        _brand_cache[cache_key] = (time.time(), result)
        return result
