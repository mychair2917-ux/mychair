from beanie import PydanticObjectId

from app.auth.rbac_config import ROLE_SUPER_ADMIN, normalize_role
from app.constants.master_services import MASTER_SERVICE_NAMES
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.tenant import Tenant
from app.models.salon_service import SalonService
from app.models.service import Service
from app.models.user import User
from app.schemas.salon_service import (
    MasterServiceItem,
    SalonServiceCreate,
    SalonServiceListItem,
    SalonServiceUpdate,
)


class SalonServiceService:
    @staticmethod
    def _normalize_name(value: str | None) -> str:
        return (value or "").strip().casefold()

    async def seed_master_services(self) -> None:
        existing = await Service.find(
            {"tenant_id": None, "is_deleted": False}
        ).to_list()
        existing_names = {
            self._normalize_name(item.name) for item in existing if getattr(item, "name", None)
        }

        items_to_create = []
        for name in MASTER_SERVICE_NAMES:
            normalized = self._normalize_name(name)
            if normalized in existing_names:
                continue
            items_to_create.append(
                Service(
                    tenant_id=None,
                    name=name,
                    category="General",
                    description=None,
                    price=1,
                    duration_minutes=30,
                    tax_rate=0,
                    is_active=True,
                )
            )
            existing_names.add(normalized)

        if items_to_create:
            await Service.insert_many(items_to_create)

    async def list_master_services(self) -> list[MasterServiceItem]:
        services = await Service.find(
            {"tenant_id": None, "is_deleted": False, "is_active": True}
        ).sort("name").to_list()
        return [
            MasterServiceItem(
                id=str(service.id),
                name=service.name,
                status="ACTIVE" if service.is_active else "INACTIVE",
                created_at=service.created_at,
                updated_at=service.updated_at,
            )
            for service in services
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

    async def _get_master_service(self, service_id: str) -> Service:
        try:
            object_id = PydanticObjectId(service_id)
        except Exception as exc:
            raise ResourceNotFoundException("Master service not found") from exc

        service = await Service.find_one(
            Service.id == object_id,
            Service.tenant_id == None,
            Service.is_deleted == False,
            Service.is_active == True,
        )
        if not service:
            raise ResourceNotFoundException("Master service not found")
        return service

    async def _ensure_no_duplicate(
        self,
        salon_id: str,
        payload: SalonServiceCreate | SalonServiceUpdate,
        exclude_id: str | None = None,
    ) -> None:
        query: dict = {
            "salon_id": salon_id,
            "is_deleted": False,
        }
        if payload.service_id:
            query["service_id"] = payload.service_id
        else:
            query["custom_service_name"] = payload.custom_service_name

        existing = await SalonService.find_one(query)
        if existing and str(existing.id) != exclude_id:
            raise PermissionDeniedException(
                detail="This service already exists for the selected salon"
            )

    async def create_salon_service(
        self, actor: User, payload: SalonServiceCreate, salon_id: str | None = None
    ) -> SalonServiceListItem:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        if payload.service_id:
            master_service = await self._get_master_service(payload.service_id)
            payload.custom_service_name = None
            service_name = master_service.name
        else:
            service_name = payload.custom_service_name or ""

        await self._ensure_no_duplicate(resolved_salon_id, payload)

        item = SalonService(
            salon_id=resolved_salon_id,
            service_id=payload.service_id,
            custom_service_name=payload.custom_service_name,
            price=payload.price,
            status="ACTIVE",
            created_by=str(actor.id),
        )
        await item.insert()
        return SalonServiceListItem(
            id=str(item.id),
            salon_id=item.salon_id,
            service_id=item.service_id,
            custom_service_name=item.custom_service_name,
            service_name=service_name,
            price=item.price,
            status=item.status,
            created_by=item.created_by,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def list_salon_services(
        self, actor: User, salon_id: str | None = None
    ) -> list[SalonServiceListItem]:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        items = await SalonService.find(
            SalonService.salon_id == resolved_salon_id,
            SalonService.is_deleted == False,
        ).sort("-created_at").to_list()

        master_service_ids = [PydanticObjectId(item.service_id) for item in items if item.service_id]
        master_service_map: dict[str, Service] = {}
        if master_service_ids:
            master_services = await Service.find(
                {"_id": {"$in": master_service_ids}, "is_deleted": False}
            ).to_list()
            master_service_map = {str(service.id): service for service in master_services}

        result: list[SalonServiceListItem] = []
        for item in items:
            service_name = (
                master_service_map.get(item.service_id).name
                if item.service_id and master_service_map.get(item.service_id)
                else item.custom_service_name
            ) or "-"
            result.append(
                SalonServiceListItem(
                    id=str(item.id),
                    salon_id=item.salon_id,
                    service_id=item.service_id,
                    custom_service_name=item.custom_service_name,
                    service_name=service_name,
                    price=item.price,
                    status=item.status,
                    created_by=item.created_by,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )
        return result

    async def update_salon_service(
        self,
        actor: User,
        salon_service_id: str,
        payload: SalonServiceUpdate,
        salon_id: str | None = None,
    ) -> SalonServiceListItem:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        item = await SalonService.find_one(
            SalonService.id == PydanticObjectId(salon_service_id),
            SalonService.salon_id == resolved_salon_id,
            SalonService.is_deleted == False,
        )
        if not item:
            raise ResourceNotFoundException("Salon service not found")

        await self._ensure_no_duplicate(resolved_salon_id, payload, exclude_id=str(item.id))

        service_name = payload.custom_service_name or "-"
        if payload.service_id:
            master_service = await self._get_master_service(payload.service_id)
            item.service_id = str(master_service.id)
            item.custom_service_name = None
            service_name = master_service.name
        else:
            item.service_id = None
            item.custom_service_name = payload.custom_service_name
            service_name = payload.custom_service_name or "-"

        item.price = payload.price
        item.status = payload.status
        item.updated_by = str(actor.id)
        await item.save()

        return SalonServiceListItem(
            id=str(item.id),
            salon_id=item.salon_id,
            service_id=item.service_id,
            custom_service_name=item.custom_service_name,
            service_name=service_name,
            price=item.price,
            status=item.status,
            created_by=item.created_by,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    async def delete_salon_service(
        self, actor: User, salon_service_id: str, salon_id: str | None = None
    ) -> None:
        resolved_salon_id = await self._resolve_actor_salon_scope(actor, salon_id)
        item = await SalonService.find_one(
            SalonService.id == PydanticObjectId(salon_service_id),
            SalonService.salon_id == resolved_salon_id,
            SalonService.is_deleted == False,
        )
        if not item:
            raise ResourceNotFoundException("Salon service not found")
        item.is_deleted = True
        item.updated_by = str(actor.id)
        await item.save()
