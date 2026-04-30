from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from app.database import get_db
from app.models.models import User, Product
from app.auth.dependencies import require_admin, require_any_role
from app.schemas.product import ProductCreate, ProductUpdate, ProductPublic, ProductSummary, StockAdjustment

router = APIRouter()


@router.get("/", response_model=list[ProductPublic])
def list_products(
    search: Optional[str] = Query(None, description="Buscar por nombre, SKU o barcode"),
    category: Optional[str] = Query(None),
    low_stock_only: bool = Query(False),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Lista productos con filtros opcionales."""
    query = db.query(Product)

    if not include_inactive:
        query = query.filter(Product.active == True)

    if search:
        query = query.filter(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
                Product.barcode.ilike(f"%{search}%"),
            )
        )

    if category:
        query = query.filter(Product.category == category)

    products = query.order_by(Product.name).all()

    if low_stock_only:
        products = [p for p in products if p.low_stock]

    return products


@router.get("/categories", response_model=list[str])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Lista todas las categorías únicas existentes."""
    results = (
        db.query(Product.category)
        .filter(Product.category != None, Product.active == True)
        .distinct()
        .order_by(Product.category)
        .all()
    )
    return [r[0] for r in results]


@router.get("/low-stock", response_model=list[ProductPublic])
def get_low_stock(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Retorna productos con stock igual o menor al mínimo definido."""
    products = db.query(Product).filter(Product.active == True).all()
    return [p for p in products if p.low_stock]


@router.get("/barcode/{barcode}", response_model=ProductSummary)
def get_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Busca un producto por barcode — para escaneo móvil futuro."""
    product = db.query(Product).filter(
        Product.barcode == barcode,
        Product.active == True
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.get("/{product_id}", response_model=ProductPublic)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.post("/", response_model=ProductPublic, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Crea un nuevo producto. Solo admin."""
    # Verificar SKU duplicado
    if payload.sku:
        if db.query(Product).filter(Product.sku == payload.sku).first():
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese SKU")

    # Verificar barcode duplicado
    if payload.barcode:
        if db.query(Product).filter(Product.barcode == payload.barcode).first():
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese barcode")

    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductPublic)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Actualiza un producto. Solo admin."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    update_data = payload.model_dump(exclude_unset=True)

    # Verificar duplicados si cambia SKU o barcode
    if "sku" in update_data and update_data["sku"]:
        existing = db.query(Product).filter(
            Product.sku == update_data["sku"],
            Product.id != product_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese SKU")

    if "barcode" in update_data and update_data["barcode"]:
        existing = db.query(Product).filter(
            Product.barcode == update_data["barcode"],
            Product.id != product_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese barcode")

    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/stock", response_model=ProductPublic)
def adjust_stock(
    product_id: int,
    payload: StockAdjustment,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Ajusta el stock manualmente (entrada o salida).
    quantity positivo = entrada, negativo = salida.
    Solo admin.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    new_stock = product.stock + payload.quantity
    if new_stock < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente. Stock actual: {product.stock}"
        )

    product.stock = new_stock
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def deactivate_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Desactiva un producto (soft delete). Solo admin."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    product.active = False
    db.commit()
    return {"message": f"Producto '{product.name}' desactivado"}
