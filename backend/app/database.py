from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # Verifica conexión antes de usar
    pool_recycle=3600,        # Recicla conexiones cada hora
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,      # Loguea SQL solo en DEBUG
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency para inyectar sesión DB en los routers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Crea todas las tablas si no existen."""
    Base.metadata.create_all(bind=engine)
