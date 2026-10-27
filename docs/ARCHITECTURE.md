# Arquitectura

## Visión general

```mermaid
flowchart LR
    subgraph Browser["Navegador (SPA React)"]
        UI["pages / layouts / components"]
        F["features: auth · books · reviews · loans · admin"]
        RQ["TanStack Query (caché y mutaciones)"]
        AX["Axios (Bearer + refresh automático)"]
        UI --> F --> RQ --> AX
    end

    subgraph API["Backend Django 5 + DRF"]
        MW["CORS · Throttling · Auth JWT"]
        VS["ViewSets + permisos"]
        SV["Servicios de dominio (loans.services)"]
        SR["Serializers (validación + sanitización)"]
        ORM["Django ORM"]
        MW --> VS --> SR --> SV --> ORM
    end

    subgraph Ext["Servicios externos"]
        G["Google OAuth"]
        OL["OpenLibrary"]
        WK["Wikipedia"]
    end

    AX -- "REST /api (JSON)" --> MW
    F -- "authorization code" --> G
    VS -- "POST /api/auth/google/" --> G
    SC["apps.scraping · seed_scifi_catalog"] --> OL
    SC --> WK
    SC --> ORM
    ORM --> DB[("SQLite (dev) / PostgreSQL (prod)")]
```

El frontend y el backend están completamente desacoplados: la única interfaz es la API REST documentada con OpenAPI (`/api/docs/`).

## Backend (`backend/apps`)

| App | Responsabilidad |
|---|---|
| `common` | Permisos (`IsAdminOrReadOnly`, `IsOwnerOrAdminOrReadOnly`), paginación, throttles, sanitización de texto. |
| `users` | Usuario con login por email, perfil (avatar, nombre, préstamos completados), registro, Google OAuth, reset de contraseña. |
| `authors`, `sagas`, `awards` | Entidades de catálogo con CRUD (escritura solo admin). |
| `books` | `Book` (rating medio y nº de reseñas calculados), `UserBook` (ejemplar físico), filtros y búsqueda full-text. |
| `reviews` | `Review` (1-5, varias por usuario) y `ReviewComment`. |
| `loans` | `Loan` con máquina de estados y doble confirmación de devolución; `Reservation` con cola por libro. |
| `scraping` | Clientes OpenLibrary/Wikipedia, importador idempotente y comando `seed_scifi_catalog`. |

### Capas

1. **Views (ViewSets):** autorización, filtros, paginación. Sin lógica de negocio compleja.
2. **Serializers:** validación de entrada y sanitización; representación de salida (campos calculados, `allowed_actions`).
3. **Services:** reglas de negocio transaccionales (`apps/loans/services.py`): transiciones de préstamo, cola de reservas, bloqueos de fila (`select_for_update`).
4. **Modelos:** restricciones de integridad en BD (CheckConstraint, UniqueConstraint parcial).

### Máquina de estados del préstamo

```mermaid
stateDiagram-v2
    [*] --> REQUESTED: prestatario solicita
    REQUESTED --> APPROVED: propietario aprueba
    REQUESTED --> CANCELLED: cualquiera cancela
    APPROVED --> BORROWED: propietario entrega
    APPROVED --> CANCELLED
    BORROWED --> RETURN_PENDING: una parte confirma devolución
    BORROWED --> LOST: propietario marca perdido
    RETURN_PENDING --> RETURN_CONFIRMED: la otra parte confirma
    RETURN_PENDING --> LOST
    RETURN_CONFIRMED --> [*]
    CANCELLED --> [*]
    LOST --> [*]
```

Las reservas solo se pueden crear cuando todos los ejemplares ofrecidos están prestados. Al solicitar un préstamo se respeta el orden de la cola (los ejemplares libres quedan reservados para los usuarios en cola) y la reserva del solicitante se consume y la cola se reordena.

Al aprobar un préstamo se cancelan automáticamente el resto de solicitudes pendientes sobre el mismo ejemplar. Si el propietario marca el ejemplar como perdido, este deja de estar disponible para préstamo. La restricción `unique_active_loan_per_copy` impide a nivel de BD dos préstamos activos sobre el mismo ejemplar.

## Modelo de datos

```mermaid
erDiagram
    USER ||--o{ USERBOOK : posee
    USER ||--o{ REVIEW : escribe
    USER ||--o{ REVIEWCOMMENT : escribe
    USER ||--o{ LOAN : "owner / borrower"
    USER ||--o{ RESERVATION : crea
    AUTHOR ||--o{ BOOK : escribe
    SAGA |o--o{ BOOK : agrupa
    AWARD }o--o{ BOOK : "M2M"
    BOOK ||--o{ USERBOOK : ejemplares
    BOOK ||--o{ REVIEW : tiene
    BOOK ||--o{ RESERVATION : cola
    REVIEW ||--o{ REVIEWCOMMENT : tiene
    USERBOOK ||--o{ LOAN : prestado_en
```

## Frontend (`frontend/src`)

| Carpeta | Contenido |
|---|---|
| `pages/` | Una por ruta (`/`, `/books`, `/books/:id`, `/authors`, `/sagas`, `/awards`, `/profile`, `/login`, `/register`, `/admin`…). |
| `features/` | Lógica por dominio: `auth` (contexto, rutas protegidas, Google), `books` (filtros, listados genéricos), `reviews`, `loans`, `admin` (CRUD genérico configurable). |
| `components/` | UI reutilizable con CSS Modules (PixelButton, Panel, BookCard, StarRating…). |
| `layouts/` | `MainLayout` (cabecera, efecto CRT) y `AuthLayout`. |
| `services/` | Axios (`api.js`), tokens, servicios REST por recurso. |
| `hooks/` | `useAuth`, `useResources` (queries/mutaciones + invalidación), `useDebounce`. |

### Autenticación en el cliente

```mermaid
sequenceDiagram
    participant U as Usuario
    participant SPA
    participant API
    U->>SPA: email + password / Google code
    SPA->>API: POST /api/auth/login/ (o /google/)
    API-->>SPA: access + refresh + user
    SPA->>API: GET /api/... (Bearer access)
    API-->>SPA: 401 (access caducado)
    SPA->>API: POST /api/auth/token/refresh/ (una sola vez, compartido)
    API-->>SPA: nuevo access (+ refresh rotado)
    SPA->>API: reintenta petición original
```

## Decisiones clave

- **JWT con rotación y blacklist** para sesiones sin estado en el servidor de aplicación.
- **Compatibilidad PostgreSQL:** sin SQL específico del motor; la búsqueda detecta `connection.vendor` y usa full-text nativo en PostgreSQL.
- **`allowed_actions` calculado en el servidor:** el cliente no duplica reglas de negocio.
- **CRUD admin genérico** en el frontend, dirigido por configuración (`features/admin/config.js`).
- **Rate limiting** por defecto en DRF (anon/user/write/auth).
