# API_SPEC - API REST

## 1. Alcance y convenciones

Contrato de la API implementada en [config/urls.py](../backend/config/urls.py)
y en sus ViewSets/serializers. Los ejemplos son ficticios, no datos exportados.

- Base local: `http://localhost:8000/api/`.
- Formato de negocio: JSON; usa `Content-Type: application/json` al enviar cuerpos.
- Las rutas siguientes incluyen `/api/` y barra final.
- Los identificadores del dominio son enteros; las fechas se serializan en
  formato ISO 8601. Las fechas opcionales pueden ser `null`.
- PUT actualiza una representacion; PATCH modifica parcialmente.
- HEAD y OPTIONS complementan los metodos de negocio segun DRF.
- No existe un prefijo de version como `/api/v1/` actualmente.

Documentacion generada:

| Ruta | Contenido |
|---|---|
| `GET /api/schema/` | Esquema OpenAPI; YAML por defecto. |
| `GET /api/docs/` | Swagger UI. |
| `GET /api/redoc/` | ReDoc. |
| `GET /api/` | Indice de recursos de DefaultRouter. |

El esquema generado puede advertir sobre querysets anonimos y tipado del
parametro `id` de prestamos/reservas. No implica que sus IDs de dominio sean
cadenas. Este documento explicita permisos y reglas que el esquema no expresa.

## 2. Autenticacion y permisos

Para acceder a recursos protegidos:

```http
Authorization: Bearer <access_token>
```

Los access tokens duran 30 minutos y los refresh 7 dias por defecto, configurables.
El refresco rota el token y revoca el anterior. Guarda el nuevo refresh cuando
se devuelva. El cliente SPA reintenta una vez la peticion despues de refrescar.

Un token invalido puede provocar HTTP 401 incluso en una ruta de lectura publica.
El rol admin significa `is_staff` o `is_superuser`.

### Endpoints de identidad

| Metodo y ruta | Cuerpo JSON / comportamiento |
|---|---|
| `POST /api/auth/registration/` | `email`, `password1`, `password2`; `name` opcional. Alta publica. |
| `POST /api/auth/login/` | `email`, `password`; devuelve credenciales JWT y usuario. |
| `POST /api/auth/google/` | La SPA envia `code` obtenido de Google. Requiere configuracion OAuth. |
| `POST /api/auth/token/refresh/` | `refresh`; devuelve nuevo `access` y refresh rotado. |
| `POST /api/auth/token/verify/` | `token`; comprueba su validez. |
| `POST /api/auth/logout/` | `refresh`; intenta revocarlo. El cliente debe borrar sus tokens. |
| `GET /api/auth/user/` | Perfil del usuario autenticado. |
| `PUT /api/auth/user/` | Perfil: `name`, `avatar_url`; resto de campos de solo lectura. |
| `PATCH /api/auth/user/` | Edicion parcial del mismo perfil. |
| `POST /api/auth/password/reset/` | `email`; inicia recuperacion. |
| `POST /api/auth/password/reset/confirm/` | `uid`, `token`, `new_password1`, `new_password2`. |
| `POST /api/auth/password/change/` | Autenticado; `new_password1`, `new_password2`. |
| `POST /api/auth/registration/verify-email/` | `key` de confirmacion. |
| `POST /api/auth/registration/resend-email/` | `email`. |

La API tambien registra las rutas auxiliares de allauth
`/api/auth/registration/account-confirm-email/{key}/` y
`/api/auth/registration/account-email-verification-sent/`.
No son recursos CRUD de negocio para el cliente.

El login real exige email y contrasena aunque el esquema generico de la libreria
muestre `email` como opcional. El serializer de Google admite distintos campos
de token; el flujo usado por esta SPA es `code`.
El cambio de contrasena no exige `old_password` con la configuracion actual.

La verificacion de email es `optional` por defecto; si se configura como
`mandatory`, el registro puede responder con un mensaje de verificacion en lugar
de autenticar inmediatamente. No presupongas que todo registro devuelve tokens.
En desarrollo, el correo se imprime en la consola del backend.

## 3. Paginacion, filtros y errores

Las listas de recursos del router son paginadas:

```json
{
  "count": 0,
  "next": null,
  "previous": null,
  "results": []
}
```

El ejemplo representa una busqueda sin resultados.
`count` es el total filtrado, no el tamano de pagina.
Parametros comunes: `page` (desde 1), `page_size` (12 por defecto, maximo 100)
y `ordering` con campos permitidos separados por comas; `-` indica descendente.
Los filtros booleanos se pueden enviar como `true` o `false`.

| Codigo | Significado habitual |
|---|---|
| 200 | Lectura, actualizacion o accion completada. |
| 201 | Recurso creado. |
| 204 | DELETE completado, sin cuerpo. |
| 400 | Validacion de campos o regla de negocio incumplida. |
| 401 | Falta autenticacion valida o token caducado/invalido. |
| 403 | Usuario autenticado sin permiso para esa operacion. |
| 404 | Recurso inexistente o fuera del queryset visible. |
| 405 | Metodo no soportado por el endpoint. |
| 409 | Borrado bloqueado por referencias protegidas (`ProtectedError`). |
| 429 | Limite de peticiones excedido. |

Los errores siguen DRF, sin un sobre unico personalizado:

```json
{"rating": ["Asegurese de que este valor es menor o igual a 5."]}
```

```json
{"detail": "No se puede eliminar: existen elementos relacionados que dependen de este registro."}
```

Tambien puede aparecer `non_field_errors` como lista. No dependas de un texto
literal para distinguir todos los fallos.

Limites predeterminados configurados: anonimo 120/min, usuario 600/min,
escritura 60/min y scope `dj_rest_auth` 20/min. Los throttles aplicables se
combinan y son configurables por entorno; 429 puede incluir `Retry-After`.

## 4. Matriz de recursos

`/{id}/` representa un elemento. Los permisos de escritura indicados se
comprueban en el servidor.

| Recurso bajo `/api/` | Coleccion | Elemento | Acceso |
|---|---|---|---|
| `books` | GET, POST | GET, PUT, PATCH, DELETE | Lectura publica; escritura admin. |
| `authors` | GET, POST | GET, PUT, PATCH, DELETE | Lectura publica; escritura admin. |
| `sagas` | GET, POST | GET, PUT, PATCH, DELETE | Lectura publica; escritura admin. |
| `awards` | GET, POST | GET, PUT, PATCH, DELETE | Lectura publica; escritura admin. |
| `reviews` | GET, POST | GET, PUT, PATCH, DELETE | Lectura publica; alta autenticada; editar/borrar autor o admin. |
| `review-comments` | GET, POST | GET, PUT, PATCH, DELETE | Igual que resenas, segun autor del comentario. |
| `user-books` | GET, POST | GET, PUT, PATCH, DELETE | Lectura publica; alta autenticada; editar/borrar propietario o admin. |
| `loans` | GET, POST | GET, PUT, PATCH, DELETE | Autenticado; visibilidad por participante; PUT/PATCH/DELETE solo admin. |
| `reservations` | GET, POST | GET, DELETE | Autenticado; propias o todas si admin. Sin PUT/PATCH. |
| `users` | GET | GET, PUT, PATCH, DELETE | Solo admin. Sin POST; usar registro para crear cuentas. |

Adicionalmente, `GET /api/users/me/` y `PATCH /api/users/me/` permiten consultar
y editar el perfil propio a cualquier usuario autenticado.

## 5. Catalogo

### Libros

`GET /api/books/` admite:

| Parametro | Funcion |
|---|---|
| `q` | Busqueda por titulo, autor, ISBN y sinopsis. No es `search`. |
| `title`, `author_name` | Coincidencia parcial sin distinguir mayusculas. |
| `author`, `saga`, `award` | ID de la entidad relacionada. |
| `language` | Coincidencia exacta sin distinguir mayusculas. |
| `year`, `year_min`, `year_max` | Ano exacto o limites inclusivos. |
| `available_for_loan` | Filtra segun existencia de ejemplares libres. |
| `has_reviews` | Filtra segun existencia de resenas. |
| `ordering` | `title`, `publication_year`, `created_at`, `average_rating`, `review_count`. |

Ejemplo: `GET /api/books/?q=dune&language=en&ordering=-average_rating&page_size=12`.
Sin busqueda ni orden explicito se ordena por creacion descendente y despues ID.
En PostgreSQL `q` introduce orden por relevancia; SQLite usa busqueda por terminos.

El listado contiene `id`, `title`, referencias `author` y `saga` (o `null`),
`publication_year`, `language`, `external_cover_url`, `created_at` y estadisticas:

- `average_rating`: numero redondeado a dos decimales o `null`.
- `review_count`, `available_copies`, `offered_copies`, `reservation_count`: enteros.
- `loan_availability`: `available`, `lent` o `none`.

El detalle anade `isbn`, `synopsis`, `awards`, `amazon_url`,
`casa_del_libro_url` y `updated_at`. Las referencias de autor/saga/premio
se representan como `{ "id": 1, "name": "Ejemplo" }`.

Alta minima (admin):

```json
{"title": "Libro de ejemplo", "author_id": 1}
```

Campos opcionales de escritura: `isbn`, `publication_year`, `language`,
`synopsis`, `external_cover_url`, `saga_id` (admite `null`) y `award_ids` (lista).
No se escriben los objetos anidados `author`, `saga` y `awards`.
ISBN vacio pasa a `null`, se eliminan espacios/guiones y se normaliza a mayusculas;
debe tener formato ISBN-10 o ISBN-13 y ser unico. No se valida su checksum.
El ano admite `null` o un entero entre 1000 y el ano actual + 1.

### Autores, sagas y premios

Colecciones: `/api/authors/`, `/api/sagas/` y `/api/awards/`.
Detalles: `/api/authors/{id}/`, `/api/sagas/{id}/` y `/api/awards/{id}/`.

| Recurso | Campos de escritura | Filtros / orden |
|---|---|---|
| `authors` | `name` obligatorio; `biography`, `birth_date`, `country` opcionales. | `name` parcial, `country` exacto, `search` sobre nombre/biografia; ordenar por `name`, `created_at`, `book_count`. |
| `sagas` | `name` obligatorio, `description` opcional. | `search` sobre nombre/descripcion; ordenar por `name`, `book_count`. |
| `awards` | `name` obligatorio, `description` opcional. | Igual que sagas. |

Los tres exponen `id`, `name` y `book_count`; el resto de datos propios se
devuelve tambien. Autor incluye `created_at`; saga y premio no tienen fechas.
Los nombres se validan como unicos sin distinguir mayusculas en la API.

## 6. Resenas y comentarios

### `/api/reviews/`

Alta autenticada:

```json
{"book": 1, "title": "Mi resena", "content": "Texto de ejemplo.", "rating": 5}
```

Campos de salida: `id`, `user`, `book`, `book_title`, `title`, `content`,
`rating`, `created_at`, `updated_at`; las consultas anotan `comment_count`.
`user` es una referencia publica con `id`, `name` y `avatar_url`, sin email.
El autor se asigna desde la sesion, no desde el cuerpo.

Filtros: `book`, `user`, `rating`. Orden: `created_at`, `rating`.
El contenido tiene maximo 10000 caracteres; titulo, 200; rating, 1-5.
Se admiten varias resenas por usuario y libro. El libro no se puede cambiar.

### `/api/review-comments/`

Alta: `{"review": 1, "content": "Comentario de ejemplo."}`.
Salida: `id`, `review`, `user`, `content`, `created_at`.
Filtros: `review`, `user`; orden: `created_at`.
Contenido de maximo 3000 caracteres; la resena no se puede cambiar al editar.

## 7. Ejemplares

### `/api/user-books/`

Alta: `{"book": 1, "available_for_loan": true, "notes": "Buen estado."}`.
Solo `book` es obligatorio; el propietario se asigna desde la sesion.
Salida: `id`, `owner` publico, `book`, `book_title`, `book_author`, `book_cover`,
`available_for_loan`, `notes`, `created_at`; las consultas anaden `on_loan`.

Filtros: `book`, `owner`, `available_for_loan`, `mine`, `on_loan`.
Orden: `created_at`. `mine=true` sin sesion produce una lista vacia.
No se puede cambiar el libro; notas de maximo 2000 caracteres.
DELETE devuelve 400 si tiene cualquier prestamo asociado: se debe dejar de
ofrecer el ejemplar en lugar de borrarlo.

## 8. Prestamos

### Crear y consultar

`POST /api/loans/` recibe `{"user_book": 1}` y devuelve el prestamo completo
con HTTP 201. Propietario y prestatario se determinan en el servidor.

No se permite pedir un ejemplar propio, no ofrecido o comprometido, duplicar una
solicitud pendiente propia ni saltarse la prioridad de las reservas.
`GET /api/loans/` y `GET /api/loans/{id}/` muestran solo prestamos en los que
participa el usuario; el admin puede consultar todos.

Filtros: `status`, `user_book`, `owner`, `borrower`, `book` y `role`
(`owner` o `borrower`, relativo al usuario actual).
Orden: `requested_at`, `status`; por defecto fecha descendente y despues ID.

Salida: `id`, `owner`, `borrower`, `user_book`, `book_id`, `book_title`,
`book_cover`, `status`, `requested_at`, `approved_at`, `borrowed_at`,
`returned_at`, `owner_confirmed_return`, `borrower_confirmed_return`,
`allowed_actions`. Owner y borrower son referencias publicas.

### Acciones

Todas usan POST sin campos obligatorios y devuelven el prestamo actualizado
con HTTP 200. Se puede enviar `{}`.

| Ruta `/api/loans/{id}/.../` | Actor | Estado inicial | Resultado |
|---|---|---|---|
| `approve` | Propietario | `REQUESTED` | `APPROVED`; fecha de aprobacion; cancela otras solicitudes pendientes del ejemplar. |
| `cancel` | Cualquier participante | `REQUESTED`, `APPROVED` | `CANCELLED`. |
| `mark-borrowed` | Propietario | `APPROVED` | `BORROWED`; fecha de entrega. |
| `confirm-return` | Participante sin confirmar | `BORROWED`, `RETURN_PENDING` | Primera confirmacion: `RETURN_PENDING`; segunda: `RETURN_CONFIRMED` y fecha de devolucion. |
| `mark-lost` | Propietario | `BORROWED`, `RETURN_PENDING` | `LOST`; el ejemplar deja de ofrecerse. |

Los valores de `allowed_actions` usan guion bajo: `approve`, `cancel`,
`mark_borrowed`, `confirm_return`, `mark_lost`. No son literalmente los segmentos
de ruta cuando contienen `_`. Ser admin no sustituye al participante requerido.

`APPROVED`, `BORROWED` y `RETURN_PENDING` comprometen el ejemplar.
`REQUESTED` permite solicitudes concurrentes hasta que se aprueba una.

### Moderacion administrativa

PUT/PATCH de `/api/loans/{id}/` acepta unicamente `status`, uno de los siete
estados. Es una correccion directa, no una transicion de servicio: no actualiza
fechas, confirmaciones, disponibilidad ni solicitudes rivales.
DELETE esta reservado al admin y elimina el registro; no equivale a cancelar.

## 9. Reservas

`POST /api/reservations/` recibe `{"book": 1}` y devuelve HTTP 201.
Se exige que haya ejemplares ofrecidos por otros usuarios y que ninguno este
libre para el solicitante. No se admite otra reserva activa propia del libro.

Salida: `id`, `user` publico, `book`, `book_title`, `queue_position`, `active`,
`created_at`. La posicion y actividad las fija el servidor.
Filtros: `book`, `active`, `user`; orden: `queue_position`, `created_at`.
La visibilidad es propia; el admin puede ver todas.

DELETE de `/api/reservations/{id}/` responde 204 pero **no borra la fila**:
marca `active=false` y reordena la cola. PUT/PATCH no estan permitidos.
Al solicitar un prestamo se consume la reserva propia y se reajustan posiciones.

## 10. Usuarios y perfil

El perfil devuelve `id`, `email`, `name`, `avatar_url`, `role`,
`completed_loans`, `date_joined`. `role` vale `user` o `admin`;
`completed_loans` cuenta prestamos devueltos en cualquiera de los dos roles.

`PATCH /api/users/me/` acepta `name` y `avatar_url` (HTTP/HTTPS o vacio).
Email, rol, fechas y contador no se editan por este endpoint.

Para admin, `/api/users/` y `/api/users/{id}/` exponen tambien
`is_active` e `is_staff`, que son editables junto con nombre/avatar.
Filtros: `is_active`, `is_staff`; `search` por email/nombre;
orden: `date_joined`, `email`, `name`.
No se permite al administrador eliminar su propia cuenta ni quitarse a si mismo
el acceso o `is_staff` desde este panel.

## 11. Ejemplo de consulta desde PowerShell

```powershell
Invoke-RestMethod -Uri 'http://localhost:8000/api/books/?q=dune&page_size=12'
```

Para consultar un perfil con un access token propio:

```powershell
$headers = @{ Authorization = "Bearer $accessToken" }
Invoke-RestMethod -Uri 'http://localhost:8000/api/users/me/' -Headers $headers
```

No guardes tokens reales en ejemplos, capturas ni archivos versionados.
Para el modelo de datos y el flujo de servicios, consulta [ERD.md](ERD.md)
y [SDD.md](SDD.md).
