from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import Optional
from app.database import get_db
from app.models.models import User, Client, Sale, SaleStatus
from app.auth.dependencies import require_any_role, require_admin
from app.schemas.client import ClientCreate, ClientUpdate, ClientPublic, ClientSummary

router = APIRouter()


@router.get("/", response_model=list[ClientPublic])
def list_clients(
    search: Optional[str] = Query(None, description="Buscar por nombre, teléfono, email o documento"),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Lista clientes con búsqueda opcional."""
    query = db.query(Client)

    if not include_inactive:
        query = query.filter(Client.active == True)

    if search:
        query = query.filter(
            or_(
                Client.name.ilike(f"%{search}%"),
                Client.phone.ilike(f"%{search}%"),
                Client.email.ilike(f"%{search}%"),
                Client.document_id.ilike(f"%{search}%"),
            )
        )

    return query.order_by(Client.name).all()


@router.get("/search", response_model=list[ClientSummary])
def search_clients_for_pos(
    q: str = Query(..., min_length=2, description="Mínimo 2 caracteres"),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """
    Búsqueda rápida para el selector en caja.
    Retorna vista reducida con descuento y puntos.
    """
    clients = db.query(Client).filter(
        Client.active == True,
        or_(
            Client.name.ilike(f"%{q}%"),
            Client.phone.ilike(f"%{q}%"),
            Client.document_id.ilike(f"%{q}%"),
        )
    ).limit(10).all()
    return clients


@router.get("/{client_id}", response_model=ClientPublic)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.get("/{client_id}/history")
def get_client_history(
    client_id: int,
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),
):
    """Historial de compras de un cliente con totales."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    sales = (
        db.query(Sale)
        .filter(Sale.client_id == client_id, Sale.status == SaleStatus.completed)
        .order_by(desc(Sale.created_at))
        .limit(limit)
        .all()
    )

    total_spent = sum(s.total for s in sales)

    return {
        "client_id": client_id,
        "client_name": client.name,
        "loyalty_points": client.loyalty_points,
        "total_purchases": len(sales),
        "total_spent": total_spent,
        "sales": [
            {
                "id": s.id,
                "total": s.total,
                "discount_amount": s.discount_amount,
                "payment_method": s.payment_method,
                "items_count": len(s.items),
                "created_at": s.created_at,
            }
            for s in sales
        ],
    }


@router.post("/", response_model=ClientPublic, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_role),  # Cajero también puede crear clientes
):
    """Crea un nuevo cliente."""
    if payload.email:
        if db.query(Client).filter(Client.email == payload.email).first():
            raise HTTPException(status_code=400, detail="Ya existe un cliente con ese email")

    if payload.document_id:
        if db.query(Client).filter(Client.document_id == payload.document_id).first():
            raise HTTPException(status_code=400, detail="Ya existe un cliente con ese documento")

    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.put("/{client_id}", response_model=ClientPublic)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Actualiza un cliente. Solo admin."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    update_data = payload.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"]:
        existing = db.query(Client).filter(
            Client.email == update_data["email"],
            Client.id != client_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un cliente con ese email")

    for field, value in update_data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client


@router.put("/{client_id}/points")
def adjust_loyalty_points(
    client_id: int,
    points: int,
    note: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Ajuste manual de puntos de fidelización. Solo admin."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    new_points = client.loyalty_points + points
    if new_points < 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se pueden restar más puntos de los que tiene ({client.loyalty_points})"
        )

    client.loyalty_points = new_points
    db.commit()

    return {
        "client_id": client_id,
        "client_name": client.name,
        "points_adjusted": points,
        "new_total": client.loyalty_points,
        "note": note,
    }


@router.delete("/{client_id}")
def deactivate_client(
    client_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Desactiva un cliente (soft delete). Solo admin."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    client.active = False
    db.commit()
    return {"message": f"Cliente '{client.name}' desactivado"}
