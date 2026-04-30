"""
seed.py — Crea el primer usuario Admin en la DB.
Ejecutar UNA sola vez después de arrancar el servidor por primera vez.

Uso:
    cd backend
    python seed.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, create_tables
from app.models.models import User, UserRole
from app.auth.utils import hash_pin


def seed():
    print("🌱 Nocturna POS — Seed inicial")
    print("─" * 40)

    # Crear tablas si no existen
    create_tables()
    print("✅ Tablas verificadas / creadas en MySQL")

    db = SessionLocal()
    try:
        # Verificar si ya existe un admin
        existing = db.query(User).filter(User.role == UserRole.admin).first()
        if existing:
            print(f"⚠️  Ya existe un admin: {existing.name} (id={existing.id})")
            print("   No se creó un nuevo usuario.")
            return

        # Crear admin por defecto
        admin = User(
            name="Administrador",
            email="admin@nocturna.co",
            pin_hash=hash_pin("0000"),
            role=UserRole.admin,
            active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"✅ Admin creado exitosamente")
        print(f"   ID:    {admin.id}")
        print(f"   Nombre: {admin.name}")
        print(f"   PIN:   0000  ← CAMBIA ESTO DESPUÉS DE ENTRAR")
        print("─" * 40)
        print("🚀 Ya puedes iniciar sesión en Nocturna POS")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
