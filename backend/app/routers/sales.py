from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, date
from app.database import get_db
from app.models.models import User, Product, Client, Sale, SaleItem, SaleStatus, DiscountType
from app.auth.dependencies import require_any_role, require_admin
from app.schemas.sale import SaleCreate, SalePublic, SaleSummary, SaleItemPublic

router = APIRouter()


def _build_sale_public(sale: Sale) -> SalePublic:
    """Construye el schema SalePublic desde un modelo Sale."""
    items = []
    for item in sale.items:
        items.append(SaleItemPublic(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name if item.product else "Producto eliminado",
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
        ))

    return SalePublic(
        id=sale.id,
        client_id=sale.client_id,
        client_name=sale.client.name if sale.client else None,
        user_id=sale.user_id,
        user_name=sale.user.name if sale.user else "Usuario",
        subtotal=sale.subtotal,
        discount_amount=sale.discount_amount,
        total=sale.total,
        payment_method=sale.payment_method,
        amount_paid=sale.amount_paid,
        change_amount=sale.change_amount,
        status=sale.status,
        invoice_sent=sale.invoice_sent,
        notes=sale.notes,
        items=items,
        created_at=sale.created_at,
    )


@router.post("/", response_model=SalePublic, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role),
):
    """
    Crea una venta completa:
    - Valida stock de cada producto
    - Aplica descuento del cliente si tiene
    - Descuenta stock automáticamente
    - Calcula vuelto si pago en efectivo
    - Dispara email de factura si el cliente tiene email (background)
    """
    # ── 1. Validar productos y calcular subtotal ──
    subtotal = 0.0
    sale_items_data = []

    for item_input in payload.items:
        product = db.query(Product).filter(
            Product.id == item_input.product_id,
            Product.active == True
        ).first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Producto ID {item_input.product_id} no encontrado"
            )

        if product.stock < item_input.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{product.name}'. Disponible: {product.stock}"
            )

        item_subtotal = product.price * item_input.quantity
        subtotal += item_subtotal

        sale_items_data.append({
            "product": product,
            "quantity": item_input.quantity,
            "unit_price": product.price,
            "subtotal": item_subtotal,
        })

    # ── 2. Calcular descuento del cliente ──
    discount_amount = 0.0
    client = None

    if payload.client_id:
        client = db.query(Client).filter(
            Client.id == payload.client_id,
            Client.active == True
        ).first()

        if not client:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        if client.discount_type == DiscountType.percentage and client.discount_value > 0:
            discount_amount = round(subtotal * (client.discount_value / 100), 2)
        elif client.discount_type == DiscountType.fixed and client.discount_value > 0:
            discount_amount = min(client.discount_value, subtotal)

    total = round(subtotal - discount_amount, 2)

    # ── 3. Calcular vuelto ──
    change_amount = 0.0
    if payload.amount_paid is not None:
        if payload.amount_paid < total:
            raise HTTPException(
                status_code=400,
                detail=f"Monto pagado (${payload.amount_paid:,.0f}) insuficiente. Total: ${total:,.0f}"
            )
        change_amount = round(payload.amount_paid - total, 2)

    # ── 4. Crear la venta ──
    sale = Sale(
        client_id=payload.client_id,
        user_id=current_user.id,
        cash_session_id=payload.cash_session_id,
        subtotal=subtotal,
        discount_amount=discount_amount,
        total=total,
        payment_method=payload.payment_method,
        amount_paid=payload.amount_paid,
        change_amount=change_amount,
        notes=payload.notes,
        status=SaleStatus.completed,
    )
    db.add(sale)
    db.flush()  # Para obtener sale.id antes del commit

    # ── 5. Crear items y descontar stock ──
    for item_data in sale_items_data:
        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=item_data["product"].id,
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            subtotal=item_data["subtotal"],
        )
        db.add(sale_item)
        item_data["product"].stock -= item_data["quantity"]

    # ── 6. Puntos de fidelización (1 punto por cada $1000 COP) ──
    if client:
        points_earned = int(total // 1000)
        client.loyalty_points += points_earned

    db.commit()
    db.refresh(sale)

    # ── 7. Email factura en background ──
    if client and client.email:
        background_tasks.add_task(_send_invoice_email, sale.id, db)

    return _build_sale_public(sale)


@router.get("/", response_model=list[SaleSummary])
def list_sales(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    payment_method: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Lista ventas con filtros opcionales."""
    query = db.query(Sale).filter(Sale.status == SaleStatus.completed)

    if date_from:
        query = query.filter(Sale.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Sale.created_at <= datetime.combine(date_to, datetime.max.time()))
    if payment_method:
        query = query.filter(Sale.payment_method == payment_method)
    if user_id:
        query = query.filter(Sale.user_id == user_id)

    sales = query.order_by(desc(Sale.created_at)).limit(limit).all()

    result = []
    for sale in sales:
        result.append(SaleSummary(
            id=sale.id,
            client_name=sale.client.name if sale.client else None,
            user_name=sale.user.name if sale.user else "Usuario",
            total=sale.total,
            payment_method=sale.payment_method,
            status=sale.status,
            items_count=len(sale.items),
            created_at=sale.created_at,
        ))
    return result


@router.get("/{sale_id}", response_model=SalePublic)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Obtiene el detalle completo de una venta."""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return _build_sale_public(sale)


@router.put("/{sale_id}/cancel")
def cancel_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Cancela una venta y restaura el stock.
    Solo admin.
    """
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if sale.status != SaleStatus.completed:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar ventas completadas")

    # Restaurar stock
    for item in sale.items:
        if item.product:
            item.product.stock += item.quantity

    # Revertir puntos de fidelización
    if sale.client:
        points_to_remove = int(sale.total // 1000)
        sale.client.loyalty_points = max(0, sale.client.loyalty_points - points_to_remove)

    sale.status = SaleStatus.cancelled
    db.commit()

    return {"message": f"Venta #{sale_id} cancelada y stock restaurado"}



@router.post("/{sale_id}/send-invoice")
async def resend_invoice(
    sale_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Reenvía la factura PDF por email al cliente."""
    from app.core.invoice import send_invoice_email
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if not sale.client or not sale.client.email:
        raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")

    success = await send_invoice_email(sale)
    if success:
        sale.invoice_sent = True
        db.commit()
        return {"message": f"Factura #{sale_id} enviada a {sale.client.email}"}
    else:
        raise HTTPException(status_code=500, detail="Error al enviar el email")


async def _send_invoice_email(sale_id: int, db: Session):
    """Genera PDF y envía factura por email al cliente."""
    from app.core.invoice import send_invoice_email
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if sale:
        success = await send_invoice_email(sale)
        if success:
            sale.invoice_sent = True
            db.commit()
