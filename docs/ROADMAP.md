# Roadmap técnico

## Fase 1 — Base (completada)

- Monorepo Django/DRF + React/Vite, API REST completa con OpenAPI.
- Autenticación email/password + Google OAuth, JWT con rotación.
- Catálogo, reseñas, comentarios, ejemplares, préstamos con doble confirmación, reservas en cola.
- Seed de 100 libros (OpenLibrary + Wikipedia).
- Tests: pytest (≈97 %) y Vitest.

## Fase 2 — Endurecimiento para producción

- [ ] Migrar a PostgreSQL: índices GIN sobre `SearchVector` (columna `search_vector` generada) y `pg_trgm` para tolerancia a erratas.
- [ ] Refresh token en cookie `HttpOnly; Secure; SameSite=Lax` y access token solo en memoria (elimina exposición a XSS vía `localStorage`).
- [ ] Verificación de email obligatoria y plantillas HTML de email.
- [ ] Gestión de secretos (Vault/SSM) y `check --deploy` en CI.
- [ ] Almacenamiento de avatares (S3/MinIO) con validación y reescalado.
- [ ] Logs estructurados, Sentry y métricas (Prometheus).
- [ ] Dockerfile multi-stage + `docker-compose` (api, web, postgres, redis).

## Fase 3 — CI/CD y calidad

- [ ] GitHub Actions: lint (ruff, eslint), pytest con PostgreSQL, Vitest, build, auditoría de dependencias.
- [ ] Tests E2E con Playwright (registro, reseña, flujo de préstamo completo, panel admin).
- [ ] Tipado (mypy/django-stubs) en el backend y migración gradual a TypeScript en el frontend.
- [ ] Pre-commit hooks y Renovate/Dependabot.

## Fase 4 — Producto

- [ ] Notificaciones (email y en la app) para solicitudes, aprobaciones, devoluciones y reservas que pasan a disponibles.
- [ ] Mensajería entre propietario y prestatario por préstamo.
- [ ] Fechas límite de devolución, recordatorios y reputación de usuarios.
- [ ] Listas de lectura, estanterías y seguimiento de lectura.
- [ ] Reacciones a reseñas y reportes de contenido con cola de moderación.
- [ ] Geolocalización/zona para facilitar préstamos en persona.

## Fase 5 — Datos y escalabilidad

- [ ] Celery + Redis para el scraping periódico y reintentos, con caché de portadas en almacenamiento propio.
- [ ] Caché de listados (Redis) e invalidación por eventos; denormalizar `average_rating`/`review_count` si el volumen lo exige.
- [ ] Throttling distribuido (Redis) y WAF/CDN delante de la SPA.
- [ ] Internacionalización (i18n) del frontend y del contenido (es/en).
- [ ] Accesibilidad: modo de alto contraste, reducción de movimiento (desactivar efecto CRT) y mejoras de teclado.
- [ ] Modo móvil (actualmente solo escritorio).
