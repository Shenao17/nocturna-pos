# Nocturna POS — Backend
**BlackLabs Development** · v1.0.0

---

## Requisitos
- Python 3.11+
- MySQL Community 8.0+

---

## Setup inicial

### 1. Crear la base de datos en MySQL
```sql
CREATE DATABASE nocturna_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Configurar variables de entorno
```bash
# Copia el archivo de ejemplo
cp .env.example .env

# Edita .env con tus datos de MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root          # o tu usuario MySQL
DB_PASSWORD=tu_pass
DB_NAME=nocturna_pos
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Crear tablas + primer admin
```bash
python seed.py
```
Esto crea todas las tablas en MySQL y genera el usuario admin con PIN `0000`.
> ⚠️ Cambia el PIN apenas entres por primera vez.

### 5. Arrancar el servidor
```bash
uvicorn app.main:app --reload --port 8000
```

El servidor queda disponible en: `http://localhost:8000`
Health check: `http://localhost:8000/api/v1/health`

---

## Endpoints disponibles — Fase 3

### Auth (público)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/auth/users` | Lista usuarios para pantalla de login |
| POST | `/api/v1/auth/login` | Login con user_id + PIN |
| GET | `/api/v1/auth/me` | Datos del usuario autenticado |
| PUT | `/api/v1/auth/change-pin` | Cambiar propio PIN |

### Usuarios (solo Admin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/users/` | Listar todos los usuarios |
| POST | `/api/v1/users/` | Crear usuario |
| GET | `/api/v1/users/{id}` | Ver usuario |
| PUT | `/api/v1/users/{id}` | Editar usuario |
| PUT | `/api/v1/users/{id}/reset-pin` | Resetear PIN |
| DELETE | `/api/v1/users/{id}` | Desactivar usuario |

---

## Ejemplo de login
```json
POST /api/v1/auth/login
{
  "user_id": 1,
  "pin": "0000"
}
```
Respuesta:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": 1, "name": "Administrador", "role": "admin", ... }
}
```

Usa el token en las siguientes requests:
```
Authorization: Bearer eyJ...
```
