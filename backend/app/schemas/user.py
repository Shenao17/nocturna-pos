from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from app.models.models import UserRole


# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────

class LoginRequest(BaseModel):
    user_id: int
    pin: str

    @field_validator("pin")
    @classmethod
    def pin_must_be_4_digits(cls, v):
        if not v.isdigit() or len(v) != 4:
            raise ValueError("El PIN debe ser exactamente 4 dígitos numéricos")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class PinChangeRequest(BaseModel):
    current_pin: str
    new_pin: str

    @field_validator("current_pin", "new_pin")
    @classmethod
    def pin_must_be_4_digits(cls, v):
        if not v.isdigit() or len(v) != 4:
            raise ValueError("El PIN debe ser exactamente 4 dígitos numéricos")
        return v


# ─────────────────────────────────────────
# USUARIOS
# ─────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    pin: str
    role: UserRole = UserRole.cashier

    @field_validator("pin")
    @classmethod
    def pin_must_be_4_digits(cls, v):
        if not v.isdigit() or len(v) != 4:
            raise ValueError("El PIN debe ser exactamente 4 dígitos numéricos")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    active: Optional[bool] = None


class UserPublic(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    role: UserRole
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserListItem(BaseModel):
    """Vista reducida para el selector de login (solo nombre e id, sin datos sensibles)."""
    id: int
    name: str
    role: UserRole
    active: bool

    class Config:
        from_attributes = True


# Resolver forward reference
TokenResponse.model_rebuild()
