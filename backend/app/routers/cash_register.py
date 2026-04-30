from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.models import User, CashSession, CashMovement, Sale, SaleStatus, CashMovementType, PaymentMethod
from app.auth.dependencies import require_any_role, require_admin
from pydantic import BaseModel

router = APIRouter()


# ─────────────────────────────────────────
# SCHEMAS LOCALES
# ─────────────────────────────────────────

class OpenSessionRequest(BaseModel):
    open_amount: float
    notes: Optional[str] = None


class CloseSessionRequest(BaseModel):
    close_amount: float
    notes: Optional[str] = None


class CashMovementRequest(BaseModel):
    type: CashMovementType
    amount: float
    note: Optional[str] = None


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def _get_active_session(user_id: int, db: Session) -> Optional[CashSession]:
    return db.query(CashSession).filter(
        CashSession.user_id == user_id,
        CashSession.closed_at == None
    ).first()


def _calculate_expected(session: CashSession, db: Session) -> float:
    """Calcula el monto esperado en caja basado en ventas en efectivo + movimientos."""
    # Ventas en efectivo del turno
    cash_sales = db.query(func.sum(Sale.total)).filter(
        Sale.cash_session_id == session.id,
        Sale.payment_method == PaymentMethod.cash,
        Sale.status == SaleStatus.completed,
    ).scalar() or 0.0

    # Movimientos manuales
    income = db.query(func.sum(CashMovement.amount)).filter(
        CashMovement.session_id == session.id,
        CashMovement.type == CashMovementType.income,
    ).scalar() or 0.0

    expense = db.query(func.sum(CashMovement.amount)).filter(
        CashMovement.session_id == session.id,
        CashMovement.type == CashMovementType.expense,
    ).scalar() or 0.0

    return round(session.open_amount + cash_sales + income - expense, 2)


# ─────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────

@router.post("/open", status_code=status.HTTP_201_CREATED)
def open_session(
    payload: OpenSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role),
):
    """Abre un turno de caja para el usuario autenticado."""
    existing = _get_active_session(current_user.id, db)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ya tienes un turno abierto (ID: {existing.id}). Ciérralo antes de abrir uno nuevo."
        )

    session = CashSession(
        user_id=current_user.id,
        open_amount=payload.open_amount,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "message": "Turno abierto correctamente",
        "session_id": session.id,
        "user": current_user.name,
        "open_amount": session.open_amount,
        "opened_at": session.opened_at,
    }


@router.get("/active")
def get_active_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role),
):
    """Retorna el turno activo del usuario autenticado, si existe."""
    session = _get_active_session(current_user.id, db)
    if not session:
        return {"active": False, "session": None}

    expected = _calculate_expected(session, db)

    # Resumen de ventas del turno
    sales = db.query(Sale).filter(
        Sale.cash_session_id == session.id,
        Sale.status == SaleStatus.completed
    ).all()

    total_sales = sum(s.total for s in sales)
    cash_sales = sum(s.total for s in sales if s.payment_method == PaymentMethod.cash)
    card_sales = sum(s.total for s in sales if s.payment_method == PaymentMethod.card)
    transfer_sales = sum(s.total for s in sales if s.payment_method == PaymentMethod.transfer)

    return {
        "active": True,
        "session": {
            "id": session.id,
            "user": current_user.name,
            "open_amount": session.open_amount,
            "opened_at": session.opened_at,
            "expected_amount": expected,
            "total_sales": total_sales,
            "sales_count": len(sales),
            "breakdown": {
                "cash": cash_sales,
                "card": card_sales,
                "transfer": transfer_sales,
            },
            "movements": [
                {
                    "id": m.id,
                    "type": m.type,
                    "amount": m.amount,
                    "note": m.note,
                    "created_at": m.created_at,
                }
                for m in session.movements
            ],
        }
    }


@router.post("/movement")
def add_movement(
    payload: CashMovementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role),
):
    """Registra un ingreso o egreso manual en el turno activo."""
    session = _get_active_session(current_user.id, db)
    if not session:
        raise HTTPException(status_code=400, detail="No tienes un turno abierto")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")

    movement = CashMovement(
        session_id=session.id,
        type=payload.type,
        amount=payload.amount,
        note=payload.note,
    )
    db.add(movement)
    db.commit()

    return {
        "message": f"{'Ingreso' if payload.type == CashMovementType.income else 'Egreso'} registrado",
        "amount": payload.amount,
        "note": payload.note,
    }


@router.post("/close")
def close_session(
    payload: CloseSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role),
):
    """
    Cierra el turno activo.
    Calcula la diferencia entre el monto físico y el esperado.
    """
    session = _get_active_session(current_user.id, db)
    if not session:
        raise HTTPException(status_code=400, detail="No tienes un turno abierto")

    expected = _calculate_expected(session, db)
    difference = round(payload.close_amount - expected, 2)

    session.close_amount = payload.close_amount
    session.expected_amount = expected
    session.difference = difference
    session.closed_at = datetime.utcnow()
    if payload.notes:
        session.notes = payload.notes

    db.commit()

    status_msg = "✅ Cuadre exacto"
    if difference > 0:
        status_msg = f"⚠️ Sobrante de ${difference:,.0f} COP"
    elif difference < 0:
        status_msg = f"⚠️ Faltante de ${abs(difference):,.0f} COP"

    return {
        "message": "Turno cerrado correctamente",
        "session_id": session.id,
        "open_amount": session.open_amount,
        "expected_amount": expected,
        "close_amount": payload.close_amount,
        "difference": difference,
        "status": status_msg,
        "opened_at": session.opened_at,
        "closed_at": session.closed_at,
    }


@router.get("/history")
def get_session_history(
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Historial de todos los turnos cerrados. Solo admin."""
    sessions = (
        db.query(CashSession)
        .filter(CashSession.closed_at != None)
        .order_by(desc(CashSession.opened_at))
        .limit(limit)
        .all()
    )

    return [
        {
            "id": s.id,
            "user": s.user.name if s.user else "Usuario",
            "open_amount": s.open_amount,
            "close_amount": s.close_amount,
            "expected_amount": s.expected_amount,
            "difference": s.difference,
            "opened_at": s.opened_at,
            "closed_at": s.closed_at,
        }
        for s in sessions
    ]
