from typing import TypeVar, Generic, List, Optional, Dict, Any, Union
from beanie import Document, PydanticObjectId
from beanie.operators import And
from pydantic import BaseModel
from app.core import tenant_context
from app.core.exceptions import ResourceNotFoundException, TenantAccessDeniedException

T = TypeVar("T", bound=Document)

class BaseRepository(Generic[T]):
    """
    Generic Asynchronous Repository enforcing strict Multi-Tenant isolation
    and Soft Delete filtering at the core query engine level.
    """
    def __init__(self, model: type[T]) -> None:
        self.model = model

    def _build_tenant_query(self, *filters: Any) -> Dict[str, Any]:
        """
        Builds standard multi-tenant and soft-delete filters.
        Enforces tenant isolation by injecting active tenant_id unless global admin context.
        """
        query: Dict[str, Any] = {}
        
        # Enforce soft-delete filter
        if hasattr(self.model, "is_deleted"):
            query["is_deleted"] = False
            
        # Enforce tenant isolation
        if hasattr(self.model, "tenant_id"):
            active_tenant = tenant_context.get_tenant_id()
            if active_tenant:
                query["tenant_id"] = active_tenant
                
        # Merge with other filters
        for f in filters:
            if isinstance(f, dict):
                query.update(f)
        return query

    async def get(self, id: Union[str, PydanticObjectId]) -> T:
        """
        Fetches a single document by unique identifier.
        Enforces tenant isolation and throws exception if not found.
        """
        if isinstance(id, str):
            try:
                obj_id = PydanticObjectId(id)
            except Exception:
                raise ResourceNotFoundException(f"{self.model.__name__} not found")
        else:
            obj_id = id
            
        query = self._build_tenant_query()
        query["_id"] = obj_id
        
        db_obj = await self.model.find_one(query)
        if not db_obj:
            raise ResourceNotFoundException(f"{self.model.__name__} not found")
        return db_obj

    async def get_optional(self, id: Union[str, PydanticObjectId]) -> Optional[T]:
        """Returns None instead of raising an exception if the document does not exist."""
        try:
            return await self.get(id)
        except ResourceNotFoundException:
            return None

    async def list(
        self,
        filters: Optional[Dict[str, Any]] = None,
        skip: int = 0,
        limit: int = 100,
        sort: Optional[Union[str, List[str]]] = None
    ) -> List[T]:
        """
        Lists records, applying tenant boundaries, pagination, and sorting filters.
        """
        merged_filters = self._build_tenant_query(filters or {})
        query = self.model.find(merged_filters)
        
        if sort:
            if isinstance(sort, list):
                # Beanie supports multiple sorts, but we can chain them or apply formatting
                for s in sort:
                    query = query.sort(s)
            else:
                query = query.sort(sort)
                
        return await query.skip(skip).limit(limit).to_list()

    async def create(self, schema_data: Union[BaseModel, Dict[str, Any]]) -> T:
        """
        Saves a new record into the collection.
        Tenant tagging is automatically triggered via base model event hooks.
        """
        if isinstance(schema_data, BaseModel):
            payload = schema_data.model_dump(exclude_unset=True)
        else:
            payload = schema_data
            
        new_doc = self.model(**payload)
        await new_doc.insert()
        return new_doc

    async def update(self, db_obj: T, schema_data: Union[BaseModel, Dict[str, Any]]) -> T:
        """
        Updates an existing, fetched document, preserving tenant tags.
        """
        # Validate that the object belongs to the active tenant if applicable
        if hasattr(db_obj, "tenant_id"):
            active_tenant = tenant_context.get_tenant_id()
            if active_tenant and db_obj.tenant_id != active_tenant:
                raise TenantAccessDeniedException()
                
        if isinstance(schema_data, BaseModel):
            update_data = schema_data.model_dump(exclude_unset=True)
        else:
            update_data = schema_data
            
        for field, value in update_data.items():
            setattr(db_obj, field, value)
            
        await db_obj.save()
        return db_obj

    async def delete(self, db_obj: T) -> T:
        """
        Executes a soft delete or hard delete depending on model capabilities.
        """
        if hasattr(db_obj, "tenant_id"):
            active_tenant = tenant_context.get_tenant_id()
            if active_tenant and db_obj.tenant_id != active_tenant:
                raise TenantAccessDeniedException()

        if hasattr(db_obj, "is_deleted"):
            db_obj.is_deleted = True
            await db_obj.save()
            return db_obj
        else:
            await db_obj.delete()
            return db_obj

    async def restore(self, db_obj: T) -> T:
        """
        Restores a soft-deleted document back to an active state.
        """
        if hasattr(db_obj, "is_deleted"):
            db_obj.is_deleted = False
            await db_obj.save()
        return db_obj
