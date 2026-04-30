from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.auth.utils import verify_pin, hash_pin, create_access_token
from app.auth.dependencies import get_current_user
from app.schemas.user import LoginRequest, TokenResponse, PinChangeRequest, UserPublic, UserListItem

router = APIRouter()


@router.get("/users", response_model=list[UserListItem])
def list_users_for_login(db: Session = Depends(get_db)):
    """Lista usuarios activos para la pantalla de selección de login."""
    users = db.query(User).filter(User.active == True).order_by(User.name).all()
    return [UserListItem.model_validate(u) for u in users]


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login con ID de usuario + PIN de 4 dígitos. Retorna JWT."""
    user = db.query(User).filter(
        User.id == payload.user_id,
        User.active == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )

    if not verify_pin(payload.pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN incorrecto",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna los datos del usuario autenticado."""
    return current_user


@router.put("/change-pin")
def change_pin(
    payload: PinChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al usuario cambiar su propio PIN."""
    if not verify_pin(payload.current_pin, current_user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN actual incorrecto",
        )
    current_user.pin_hash = hash_pin(payload.new_pin)
    db.commit()
    return {"message": "PIN actualizado correctamente"}
