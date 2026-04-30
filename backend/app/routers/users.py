from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.auth.utils import hash_pin
from app.auth.dependencies import require_admin
from app.schemas.user import UserCreate, UserUpdate, UserPublic

router = APIRouter()


@router.get("/", response_model=list[UserPublic])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.name).all()


@router.post("/", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if payload.email:
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")
    user = User(name=payload.name, email=payload.email, pin_hash=hash_pin(payload.pin), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.put("/{user_id}", response_model=UserPublic)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == current_user.id and payload.active is False:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/reset-pin")
def reset_pin(user_id: int, new_pin: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not new_pin.isdigit() or len(new_pin) != 4:
        raise HTTPException(status_code=400, detail="El PIN debe ser exactamente 4 dígitos")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.pin_hash = hash_pin(new_pin)
    db.commit()
    return {"message": f"PIN de {user.name} reseteado correctamente"}


@router.delete("/{user_id}")
def deactivate_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.active = False
    db.commit()
    return {"message": f"Usuario {user.name} desactivado"}
