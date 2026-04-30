from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    cost: Optional[float] = None
    stock: int = 0
    min_stock: int = 5
    image_url: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()

    @field_validator("price")
    @classmethod
    def price_positive(cls, v):
        if v <= 0:
            raise ValueError("El precio debe ser mayor a 0")
        return v

    @field_validator("stock", "min_stock")
    @classmethod
    def non_negative(cls, v):
        if v < 0:
            raise ValueError("El valor no puede ser negativo")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock: Optional[int] = None
    min_stock: Optional[int] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None


class StockAdjustment(BaseModel):
    quantity: int  # Positivo = entrada, negativo = salida
    note: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def not_zero(cls, v):
        if v == 0:
            raise ValueError("La cantidad no puede ser 0")
        return v


class ProductPublic(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    cost: Optional[float] = None
    stock: int
    min_stock: int
    low_stock: bool
    image_url: Optional[str] = None
    active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductSummary(BaseModel):
    """Vista reducida para usar en ventas."""
    id: int
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    price: float
    stock: int
    low_stock: bool
    category: Optional[str] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True
