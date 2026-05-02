# Nocturna POS — Desktop App
**BlackLabs Development** · v1.0.0

Sistema de Punto de Venta desktop construido con Tauri + React/Vite + FastAPI + MySQL.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop shell | Tauri 2 |
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Base de datos | MySQL Community |
| Auth | JWT + PIN bcrypt |

---

## Requisitos

- Node.js 18+
- Python 3.12+
- MySQL Community 8.0+
- Rust (https://rustup.rs)
- En Windows: Microsoft Visual Studio C++ Build Tools

---

## Desarrollo

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python seed.py               # Solo primera vez
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (web dev)
```bash
cd frontend
npm install
npm run dev
# Abre http://localhost:5173
```

### 3. App desktop (dev mode)
```bash
cd frontend
npm run tauri:dev
# Abre ventana nativa con hot-reload
```

---

## Build — Generar instalador .exe

```bash
cd frontend
npm run tauri:build
```

El instalador queda en:
```
frontend/src-tauri/target/release/bundle/
  ├── msi/          ← Nocturna POS_1.0.0_x64_en-US.msi
  └── nsis/         ← Nocturna POS_1.0.0_x64-setup.exe
```

---

## Updater (GitHub Releases)

1. Genera keypair para firmar updates:
```bash
npm run tauri -- signer generate -w ~/.tauri/nocturna.key
```

2. Agrega la clave pública en `tauri.conf.json` → `plugins.updater.pubkey`

3. Cambia la URL del endpoint a tu repo:
```json
"endpoints": ["https://github.com/TU_USUARIO/nocturna-pos/releases/latest/download/latest.json"]
```

4. Al hacer release en GitHub, sube el instalador + el archivo `latest.json` con la firma.

---

## Estructura del proyecto

```
nocturna-pos/
├── backend/              # FastAPI + MySQL
│   ├── app/
│   │   ├── models/       # ORM SQLAlchemy
│   │   ├── routers/      # Endpoints /api/v1/
│   │   ├── schemas/      # Pydantic
│   │   ├── auth/         # JWT + bcrypt PIN
│   │   └── core/         # Config + facturación PDF
│   ├── seed.py           # Setup inicial DB
│   └── requirements.txt
│
└── frontend/             # React + Vite + Tauri
    ├── src/
    │   ├── pages/        # Módulos UI
    │   ├── components/   # Sidebar, Toast, OfflineScreen
    │   ├── api/          # Axios client
    │   ├── store/        # Zustand auth
    │   └── hooks/        # useToast, useBackendHealth
    └── src-tauri/        # Config Tauri + Rust
        ├── icons/        # Íconos app
        ├── src/          # main.rs + lib.rs
        └── tauri.conf.json
```

---

## Credenciales por defecto

| Campo | Valor |
|-------|-------|
| Usuario | Administrador |
| PIN | 0000 |

⚠️ Cambia el PIN inmediatamente después del primer login.

---

*Nocturna POS v1.0.0 · BlackLabs Development · 2025*
