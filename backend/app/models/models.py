from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


# ─────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    cashier = "cashier"


class DiscountType(str, enum.Enum):
    none = "none"
    percentage = "percentage"
    fixed = "fixed"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    transfer = "transfer"


class CashMovementType(str, enum.Enum):
    income = "income"
    expense = "expense"


class SaleStatus(str, enum.Enum):
    completed = "completed"
    cancelled = "cancelled"
    refunded = "refunded"


# ─────────────────────────────────────────
# USUARIOS
# ─────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=True)  # Opcional para cajeros
    pin_hash = Column(String(255), nullable=False)           # bcrypt hash del PIN 4 dígitos
    role = Column(Enum(UserRole), default=UserRole.cashier, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    sales = relationship("Sale", back_populates="user")
    cash_sessions = relationship("CashSession", back_populates="user")


# ─────────────────────────────────────────
# PRODUCTOS
# ─────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(100), unique=True, nullable=True)
    barcode = Column(String(100), unique=True, nullable=True)  # Para escaneo móvil futuro
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    price = Column(Float, nullable=False)
    cost = Column(Float, nullable=True)        # Precio de costo (para reportes de margen)
    stock = Column(Integer, default=0)
    min_stock = Column(Integer, default=5)     # Umbral alerta stock bajo
    image_url = Column(String(500), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    sale_items = relationship("SaleItem", back_populates="product")

    @property
    def low_stock(self) -> bool:
        return self.stock <= self.min_stock


# ─────────────────────────────────────────
# CLIENTES
# ─────────────────────────────────────────

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(150), unique=True, nullable=True)
    document_id = Column(String(50), nullable=True)          # Cédula / NIT
    discount_type = Column(Enum(DiscountType), default=DiscountType.none)
    discount_value = Column(Float, default=0.0)              # % o monto fijo en COP
    loyalty_points = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    sales = relationship("Sale", back_populates="client")


# ─────────────────────────────────────────
# VENTAS
# ─────────────────────────────────────────

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)   # Venta anónima ok
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cash_session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=True)

    subtotal = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.cash)
    amount_paid = Column(Float, nullable=True)    # Para calcular vuelto
    change_amount = Column(Float, default=0.0)    # Vuelto
    status = Column(Enum(SaleStatus), default=SaleStatus.completed)
    notes = Column(Text, nullable=True)
    invoice_sent = Column(Boolean, default=False) # ¿Se envió factura por email?
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    client = relationship("Client", back_populates="sales")
    user = relationship("User", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    cash_session = relationship("CashSession", back_populates="sales")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)   # Precio al momento de la venta
    subtotal = Column(Float, nullable=False)      # quantity * unit_price

    # Relaciones
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")


# ─────────────────────────────────────────
# CAJA / TURNOS
# ─────────────────────────────────────────

class CashSession(Base):
    __tablename__ = "cash_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    open_amount = Column(Float, nullable=False)      # Monto inicial en caja
    close_amount = Column(Float, nullable=True)      # Monto al cierre (null = abierta)
    expected_amount = Column(Float, nullable=True)   # Lo que debería haber según ventas
    difference = Column(Float, nullable=True)        # close_amount - expected_amount
    notes = Column(Text, nullable=True)
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    user = relationship("User", back_populates="cash_sessions")
    sales = relationship("Sale", back_populates="cash_session")
    movements = relationship("CashMovement", back_populates="session", cascade="all, delete-orphan")

    @property
    def is_open(self) -> bool:
        return self.closed_at is None


class CashMovement(Base):
    __tablename__ = "cash_movements"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cash_sessions.id"), nullable=False)
    type = Column(Enum(CashMovementType), nullable=False)
    amount = Column(Float, nullable=False)
    note = Column(String(300), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    session = relationship("CashSession", back_populates="movements")
