from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from app.models.models import PaymentMethod, SaleStatus


class SaleItemInput(BaseModel):
    product_id: int
    quantity: int

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v):
        if v <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
        return v


class SaleCreate(BaseModel):
    client_id: Optional[int] = None
    cash_session_id: Optional[int] = None
    items: list[SaleItemInput]
    payment_method: PaymentMethod = PaymentMethod.cash
    amount_paid: Optional[float] = None
    notes: Optional[str] = None

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("La venta debe tener al menos un producto")
        return v


class SaleItemPublic(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float

    class Config:
        from_attributes = True


class SalePublic(BaseModel):
    id: int
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    user_id: int
    user_name: str
    subtotal: float
    discount_amount: float
    total: float
    payment_method: PaymentMethod
    amount_paid: Optional[float] = None
    change_amount: float
    status: SaleStatus
    invoice_sent: bool
    notes: Optional[str] = None
    items: list[SaleItemPublic] = []
    created_at: datetime

    class Config:
        from_attributes = True


class SaleSummary(BaseModel):
    """Vista reducida para listas."""
    id: int
    client_name: Optional[str] = None
    user_name: str
    total: float
    payment_method: PaymentMethod
    status: SaleStatus
    items_count: int
    created_at: datetime

    class Config:
        from_attributes = True
