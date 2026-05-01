from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional
from datetime import datetime, date
from app.database import get_db
from app.models.models import User, Sale, SaleItem, Product, Client, SaleStatus, PaymentMethod
from app.auth.dependencies import require_admin, require_any_role

router = APIRouter()


def date_range(date_from: Optional[date], date_to: Optional[date]):
    """Helper para construir filtro de rango de fechas."""
    filters = [Sale.status == SaleStatus.completed]
    if date_from:
        filters.append(Sale.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        filters.append(Sale.created_at <= datetime.combine(date_to, datetime.max.time()))
    return filters


@router.get("/summary")
def get_summary(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Resumen general de ventas en un periodo."""
    filters = date_range(date_from, date_to)
    sales = db.query(Sale).filter(*filters).all()

    total_revenue = sum(s.total for s in sales)
    total_discounts = sum(s.discount_amount for s in sales)
    total_items = sum(len(s.items) for s in sales)

    by_payment = {}
    for method in PaymentMethod:
        by_payment[method.value] = sum(s.total for s in sales if s.payment_method == method)

    return {
        "period": {"from": date_from, "to": date_to},
        "total_sales": len(sales),
        "total_revenue": round(total_revenue, 2),
        "total_discounts": round(total_discounts, 2),
        "total_items_sold": total_items,
        "average_ticket": round(total_revenue / len(sales), 2) if sales else 0,
        "by_payment_method": by_payment,
    }


@router.get("/top-products")
def get_top_products(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Productos más vendidos por cantidad y por ingresos."""
    filters = date_range(date_from, date_to)
    sale_ids = [s.id for s in db.query(Sale.id).filter(*filters).all()]

    if not sale_ids:
        return []

    results = (
        db.query(
            Product.id,
            Product.name,
            Product.category,
            func.sum(SaleItem.quantity).label("total_qty"),
            func.sum(SaleItem.subtotal).label("total_revenue"),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .filter(SaleItem.sale_id.in_(sale_ids))
        .group_by(Product.id, Product.name, Product.category)
        .order_by(desc("total_qty"))
        .limit(limit)
        .all()
    )

    return [
        {
            "product_id": r.id,
            "name": r.name,
            "category": r.category,
            "total_qty": r.total_qty,
            "total_revenue": round(r.total_revenue, 2),
        }
        for r in results
    ]


@router.get("/top-clients")
def get_top_clients(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Clientes con mayor gasto en el periodo. Solo admin."""
    filters = date_range(date_from, date_to)
    filters.append(Sale.client_id != None)

    results = (
        db.query(
            Client.id,
            Client.name,
            Client.email,
            Client.loyalty_points,
            func.count(Sale.id).label("total_purchases"),
            func.sum(Sale.total).label("total_spent"),
        )
        .join(Sale, Sale.client_id == Client.id)
        .filter(*filters)
        .group_by(Client.id, Client.name, Client.email, Client.loyalty_points)
        .order_by(desc("total_spent"))
        .limit(limit)
        .all()
    )

    return [
        {
            "client_id": r.id,
            "name": r.name,
            "email": r.email,
            "loyalty_points": r.loyalty_points,
            "total_purchases": r.total_purchases,
            "total_spent": round(r.total_spent, 2),
        }
        for r in results
    ]


@router.get("/by-category")
def get_sales_by_category(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Ventas agrupadas por categoría de producto."""
    filters = date_range(date_from, date_to)
    sale_ids = [s.id for s in db.query(Sale.id).filter(*filters).all()]

    if not sale_ids:
        return []

    results = (
        db.query(
            Product.category,
            func.sum(SaleItem.quantity).label("total_qty"),
            func.sum(SaleItem.subtotal).label("total_revenue"),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .filter(SaleItem.sale_id.in_(sale_ids))
        .group_by(Product.category)
        .order_by(desc("total_revenue"))
        .all()
    )

    return [
        {
            "category": r.category or "Sin categoría",
            "total_qty": r.total_qty,
            "total_revenue": round(r.total_revenue, 2),
        }
        for r in results
    ]


@router.get("/daily")
def get_daily_sales(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Ventas día a día para gráfica de tendencia."""
    filters = date_range(date_from, date_to)

    results = (
        db.query(
            func.date(Sale.created_at).label("day"),
            func.count(Sale.id).label("total_sales"),
            func.sum(Sale.total).label("total_revenue"),
        )
        .filter(*filters)
        .group_by(func.date(Sale.created_at))
        .order_by("day")
        .all()
    )

    return [
        {
            "date": str(r.day),
            "total_sales": r.total_sales,
            "total_revenue": round(r.total_revenue, 2),
        }
        for r in results
    ]


@router.get("/low-stock-alert")
def get_low_stock_alert(
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Productos con stock bajo o agotado."""
    products = db.query(Product).filter(Product.active == True).all()
    low = [p for p in products if p.low_stock]

    return {
        "total_alerts": len(low),
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "category": p.category,
                "stock": p.stock,
                "min_stock": p.min_stock,
                "status": "agotado" if p.stock == 0 else "stock bajo",
            }
            for p in low
        ],
    }
