# MUNDOS DE ACERO OSCURO

Comunidad online de literatura de ciencia ficción con estética retro pixel art / terminal CRT de los años 80-90.

Los usuarios pueden consultar el catálogo (libros, autores, sagas, premios), puntuar y reseñar libros, comentar reseñas, ofrecer ejemplares propios para préstamo, solicitar préstamos y reservar libros que están prestados.

- **Backend:** Python 3.12 · Django 5 · Django REST Framework · django-allauth · dj-rest-auth · JWT (SimpleJWT) · drf-spectacular (OpenAPI).
- **Frontend:** React 19 · Vite · React Router · Axios · TanStack Query · CSS Modules (solo escritorio).
- **Base de datos:** SQLite en desarrollo; preparado para PostgreSQL (ver [PostgreSQL](#migrar-a-postgresql)).

Documentación adicional: [Arquitectura](docs/ARCHITECTURE.md) · [Roadmap técnico](docs/ROADMAP.md) · [Arranque manual del backend en Windows](docs/BACKEND_LOCAL.md).

Documentos de referencia: [SDD](docs/SDD.md) · [ERD](docs/ERD.md) · [API](docs/API_SPEC.md) · [Arranque del frontend en Windows](docs/FRONTEND_LOCAL.md).

---

## Estructura del monorepo

```
/
├── backend/
│   ├── config/                 # settings (base/dev/prod/test), urls, wsgi/asgi
│   ├── apps/
│   │   ├── common/             # permisos, paginación, sanitizadores, throttles
│   │   ├── users/              # usuario por email, perfil, auth (JWT + Google)
│   │   ├── authors/  sagas/  awards/
│   │   ├── books/              # libros, ejemplares (UserBook), búsqueda full-text
│   │   ├── reviews/            # reseñas y comentarios
│   │   ├── loans/              # préstamos (máquina de estados) y reservas
│   │   └── scraping/           # OpenLibrary + Wikipedia, comando seed_scifi_catalog
│   ├── tests/                  # pytest (cobertura > 95 %)
│   └── requirements*.txt
├── frontend/
│   └── src/
│       ├── components/  layouts/  pages/
│       ├── features/{auth,books,reviews,loans,admin}/
│       ├── hooks/  services/  utils/  styles/
│       └── test/               # Vitest + Testing Library
├── docs/                       # ARCHITECTURE.md, ROADMAP.md
└── scripts/                    # setup/dev para Windows (.ps1) y Unix (.sh)
```

## Requisitos

- Python 3.12 (también funciona en versiones posteriores)
- Node.js 20+ y npm
- Opcional: PostgreSQL 14+ para producción

## Instalación rápida

**Windows (PowerShell)**

```powershell
./scripts/setup.ps1          # venv, dependencias, migraciones, .env
./scripts/dev.ps1            # arranca backend (8000) y frontend (5173)
```

**Linux / macOS**

```bash
bash scripts/setup.sh
bash scripts/dev.sh
```

Los scripts de instalación aceptan `-Seed` (PowerShell) / `--seed` (bash) para importar el catálogo inicial.

### Instalación manual

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env                # Linux/macOS: cp .env.example .env
python manage.py migrate
python manage.py createsuperuser      # administrador
python manage.py seed_scifi_catalog   # 100 libros (ver más abajo)
python manage.py runserver            # http://localhost:8000

# Frontend (otra terminal)
cd frontend
npm install
copy .env.example .env
npm run dev                           # http://localhost:5173
```

URLs útiles:

| URL | Descripción |
|---|---|
| http://localhost:5173 | Aplicación (SPA) |
| http://localhost:8000/api/docs/ | Swagger UI (OpenAPI) |
| http://localhost:8000/api/redoc/ | ReDoc |
| http://localhost:8000/api/schema/ | Esquema OpenAPI (YAML) |
| http://localhost:8000/admin/ | Admin de Django |

En desarrollo, Vite hace proxy de `/api` hacia `VITE_PROXY_TARGET` (por defecto `http://localhost:8000`), por lo que no hay problemas de CORS. En producción define `VITE_API_URL` con la URL pública de la API.

## Variables de entorno

### Backend (`backend/.env`, ver [`.env.example`](backend/.env.example))

| Variable | Descripción | Por defecto |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev` / `config.settings.prod` | `config.settings.dev` |
| `DJANGO_SECRET_KEY` | Clave secreta (**obligatoria en prod**) | clave insegura de dev |
| `DJANGO_DEBUG` | Modo debug | `True` en dev |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos | `localhost,127.0.0.1` |
| `DATABASE_URL` | URL de BD (`sqlite:///…` o `postgres://…`) | SQLite local |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | Orígenes del frontend | `http://localhost:5173` |
| `FRONTEND_URL` | Base de los enlaces de email (reset de contraseña) | `http://localhost:5173` |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | Vida de los tokens | `30`, `7` |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Credenciales Google | vacío |
| `ACCOUNT_EMAIL_VERIFICATION` | `none` / `optional` / `mandatory` | `optional` |
| `EMAIL_BACKEND`, `DEFAULT_FROM_EMAIL` | Envío de emails (consola en dev) | consola |
| `THROTTLE_ANON/USER/WRITE/AUTH` | Rate limiting | `120/min`, `600/min`, `60/min`, `20/min` |
| `AMAZON_SEARCH_URL`, `CASA_DEL_LIBRO_SEARCH_URL` | Plantillas de enlaces de compra | ver `.env.example` |
| `SCRAPING_TIMEOUT` | Timeout HTTP del scraper (s) | `15` |

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API (por defecto `/api`, usa el proxy de Vite) |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google (si falta, el botón de Google se oculta) |
| `VITE_PROXY_TARGET` | Destino del proxy de desarrollo |

## Configuración de Google OAuth

La aplicación usa el flujo **authorization code**: el frontend obtiene un `code` con `@react-oauth/google` y lo envía a `POST /api/auth/google/`; el backend lo intercambia con Google, crea o enlaza la cuenta y devuelve `{access, refresh, user}`.

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto y configura la **pantalla de consentimiento OAuth** (scopes `openid`, `email`, `profile`).
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
3. En **Orígenes de JavaScript autorizados** añade `http://localhost:5173` (y el dominio de producción).
4. No hace falta configurar *URI de redirección*: el flujo popup usa `postmessage` internamente (el backend lo tiene configurado como `callback_url`).
5. Copia las credenciales:
   - `backend/.env`: `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`.
   - `frontend/.env`: `VITE_GOOGLE_CLIENT_ID` (mismo Client ID).
6. Reinicia ambos servidores.

## Catálogo inicial (scraping)

```powershell
python manage.py seed_scifi_catalog                 # 100 libros de una lista curada (>100) + enriquecimiento
python manage.py seed_scifi_catalog --limit 20      # solo los 20 primeros
python manage.py seed_scifi_catalog --discover --limit 150   # completa con OpenLibrary
python manage.py seed_scifi_catalog --help
```

Para cada libro se parte de una lista curada de clásicos de ciencia ficción y se enriquece con **OpenLibrary** (ISBN, año, portada, sinopsis, idioma) y **Wikipedia** (sinopsis/extracto, idiomas por orden de preferencia `es,en`). El comando es idempotente (reejecutarlo actualiza en lugar de duplicar) y tolera fallos de red por libro.

## Roles y permisos

| Rol | Capacidades |
|---|---|
| Visitante | Consultar libros, autores, sagas, premios, reseñas; buscar. Sin escritura. |
| Usuario registrado | Lo anterior + puntuar/reseñar (varias reseñas por libro), comentar, ofrecer ejemplares, solicitar préstamos, reservar. |
| Administrador | CRUD completo, moderación de reseñas/comentarios, gestión de usuarios y préstamos (panel `/admin`). |

### Préstamos

Estados: `REQUESTED → APPROVED → BORROWED → RETURN_PENDING → RETURN_CONFIRMED`, además de `CANCELLED` y `LOST`. La devolución requiere **confirmación de ambas partes** (propietario y prestatario). La API devuelve `allowed_actions` para cada préstamo según el usuario y el estado, y el frontend solo muestra esos botones. Las reservas forman una cola (`queue_position`) por libro, solo disponible cuando todos los ejemplares ofrecidos están prestados; al solicitar un préstamo se respeta el orden de la cola y la cola se reajusta al cancelar o consumir una reserva.

## Búsqueda

`GET /api/books/?q=…` más filtros `title`, `author_name`, `language`, `saga`, `award`, `year`, `available_for_loan`, `has_reviews`, `ordering`. En PostgreSQL usa full-text nativo (`SearchVector` / `SearchRank`, config `simple`, ponderado título > autor/ISBN > sinopsis); en SQLite hace un fallback multi-término con `icontains` sobre los mismos campos.

## Tests

```powershell
# Backend (pytest, umbral de cobertura 80 %)
cd backend
.\.venv\Scripts\python.exe -m pytest            # añade --cov-report=html para informe HTML

# Frontend (Vitest)
cd frontend
npm test
npm run test:coverage
```

Estado actual: 103 tests de backend (≈97 % de cobertura) y 55 tests de frontend.

## Seguridad

- **JWT** (SimpleJWT) con refresh rotatorio y blacklist; refresco automático en el cliente ante un 401.
- **Permisos DRF** por rol y propiedad (`IsOwnerOrAdminOrReadOnly`, solo lectura para visitantes, acciones de préstamo validadas en servicio).
- **Rate limiting** por IP/usuario, throttle de escritura y throttle específico para endpoints de autenticación.
- **Validación en backend** (serializers + `clean`/restricciones de BD: rating 1-5, unicidad de reservas activas, etc.).
- **Sanitización** de texto de usuario (reseñas, comentarios, notas, biografía): se eliminan etiquetas HTML y React escapa al renderizar.
- **CSRF:** la API autentica con cabecera `Authorization: Bearer`, por lo que no es vulnerable a CSRF clásico; el admin de Django usa sesión con protección CSRF y `CSRF_TRUSTED_ORIGINS`.
- Cabeceras y cookies seguras, HSTS y redirección SSL en `config.settings.prod`; el arranque falla en producción con la `SECRET_KEY` por defecto.
- Enlaces externos con `rel="noopener noreferrer nofollow"`.

> **Nota:** los tokens JWT se guardan en `localStorage` (simple y adecuado para desarrollo). Para producción, el roadmap contempla mover el refresh token a una cookie `HttpOnly; SameSite`.

## Migrar a PostgreSQL

```powershell
pip install -r requirements-postgres.txt
# backend/.env
DATABASE_URL=postgres://USUARIO:CLAVE@localhost:5432/mundos_acero_oscuro
python manage.py migrate
python manage.py seed_scifi_catalog
```

No hay SQL específico de SQLite. La búsqueda cambia automáticamente a full-text nativo; para rendimiento añade índices GIN (ver roadmap).

## Producción (resumen)

1. `DJANGO_SETTINGS_MODULE=config.settings.prod`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`.
2. `python manage.py check --deploy` y `python manage.py collectstatic`.
3. Servir la API con gunicorn/uvicorn tras un proxy TLS.
4. `npm run build` en `frontend/` con `VITE_API_URL` apuntando a la API; servir `frontend/dist` como estático con *fallback* a `index.html`.
