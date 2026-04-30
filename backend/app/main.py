from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.database import create_tables

# Routers (se irán añadiendo por fases)
from app.routers import auth, users, products, clients, sales, cash_register, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: crea tablas si no existen."""
    create_tables()
    print(f"✅ {settings.APP_NAME} v{settings.APP_VERSION} - {settings.BUILT_BY}")
    yield
    print("👋 Nocturna POS apagado.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=f"POS API — Construido por {settings.BUILT_BY}",
    docs_url="/api/docs" if settings.DEBUG else None,   # Swagger solo en DEBUG
    redoc_url=None,
    lifespan=lifespan,
)

# ─────────────────────────────────────────
# CORS — Listo para web y móvil futuro
# ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",          # Tauri desktop
        "http://localhost:5173",      # Vite dev
        "http://localhost:3000",      # Web futura
        "http://192.168.1.*",         # LAN local
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# ROUTERS — todos bajo /api/v1/
# ─────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth.router,          prefix=f"{PREFIX}/auth",          tags=["Auth"])
app.include_router(users.router,         prefix=f"{PREFIX}/users",         tags=["Usuarios"])
app.include_router(products.router,      prefix=f"{PREFIX}/products",      tags=["Productos"])
app.include_router(clients.router,       prefix=f"{PREFIX}/clients",       tags=["Clientes"])
app.include_router(sales.router,         prefix=f"{PREFIX}/sales",         tags=["Ventas"])
app.include_router(cash_register.router, prefix=f"{PREFIX}/cash",          tags=["Caja"])
app.include_router(reports.router,       prefix=f"{PREFIX}/reports",       tags=["Reportes"])


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "built_by": settings.BUILT_BY,
    }
