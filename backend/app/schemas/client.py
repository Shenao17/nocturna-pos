from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from app.models.models import DiscountType


class ClientCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None
    discount_type: DiscountType = DiscountType.none
    discount_value: float = 0.0
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()

    @field_validator("discount_value")
    @classmethod
    def discount_non_negative(cls, v):
        if v < 0:
            raise ValueError("El descuento no puede ser negativo")
        return v


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class ClientPublic(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    document_id: Optional[str] = None
    discount_type: DiscountType
    discount_value: float
    loyalty_points: int
    notes: Optional[str] = None
    active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClientSummary(BaseModel):
    """Vista reducida para selector en caja."""
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    discount_type: DiscountType
    discount_value: float
    loyalty_points: int

    class Config:
        from_attributes = True
