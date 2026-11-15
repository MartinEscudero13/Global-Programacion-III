# Proposal

## Why

El Ejercicio 4 del Global (15 puntos) exige un `frontend/public/`, un `Dockerfile` de Nginx con proxy hacia `/api/` y la prueba de que la web se sirve desde el contenedor; hoy `frontend/` sólo tiene `index.html`, `css/`, `js/` y `README.md` en su raíz, sin `Dockerfile`, sin `.dockerignore` y sin plantilla de Nginx, así que ese ejercicio no se puede entregar ni reproducir.

Además, la guía de despliegue (paso 5) exige `backend/alembic.ini` y `backend/migrations/` y una imagen que aplique `alembic upgrade head` antes de arrancar. El backend actual crea el esquema con `SQLModel.metadata.create_all` en el `lifespan` y no tiene Alembic, de modo que la imagen no puede desplegarse como pide la consigna y cualquier cambio de esquema queda sin versionar.

Este change resuelve ambas cosas en el monorepo recién creado y deja además el `.gitattributes` que define qué viaja en el ZIP de la cátedra. Sin esta base, los changes de integración (`fetch` contra `/api`), el de servicios de Easypanel y el de documentación final no tienen sobre qué apoyarse.

## What Changes

- **Estructura pública del frontend**: mover `frontend/index.html`, `frontend/css/` y `frontend/js/` a `frontend/public/`, conservar las rutas relativas existentes y corregir las referencias documentales a `index.html` que queden apuntando fuera de `public/`.
- **Imagen del frontend**: agregar `frontend/Dockerfile` (`nginx:1.30-alpine`, `ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$`, los dos `COPY`, `EXPOSE 80`), `frontend/.dockerignore` y `frontend/default.conf.template` con `try_files` y `location /api/ { proxy_pass http://${API_UPSTREAM}/; }`, con el contenido exacto de la consigna.
- **Migraciones del backend**: agregar `alembic` a `requirements.txt`, `backend/alembic.ini`, `backend/migrations/env.py` asincrónico que lea `DATABASE_URL` del entorno con el driver `postgresql+asyncpg` y una revisión inicial que refleje las nueve tablas actuales; quitar `create_all` de las rutas de ejecución para que la migración sea la única fuente del esquema; ajustar el `CMD` del `Dockerfile` a `alembic upgrade head && exec uvicorn ...` y copiar `alembic.ini` y `migrations/` en la imagen.
- **Base ya existente sin Alembic**: documentar el `alembic stamp head` previo al primer arranque de la imagen nueva, con el comando que lo ejecuta sobre la imagen publicada.
- **Tooling de entrega**: agregar `.gitattributes` en la raíz con `export-ignore` para que `git archive` produzca un paquete con `frontend/`, `backend/` (sin tooling), `README.md`, `DEPLOY.md` y `evidencia/`.
- **Verificación local del contenedor**: build de la imagen, ejecución con `API_UPSTREAM=host.docker.internal:8000`, respuesta 200 en `/api/health/ready`, catálogo servido (todavía desde `localStorage`) y `alembic upgrade head` sobre una base limpia con las nueve tablas.

### Fuera de alcance

- Ejercicios 1, 2 y 3: el frontend **sigue** leyendo y escribiendo en `localStorage`, sin `fetch`, sin `async` y sin `/api`. La conexión real a la API es un change posterior.
- Ejercicio 5: creación y configuración de los servicios `frontend` y `backend` en Easypanel, dominio HTTPS y variables del panel. Hay acceso al panel, pero se despliega en un change posterior.
- Casos G-01 a G-07, `README.md` y `DEPLOY.md` finales de la raíz, y la carpeta `evidencia/` del Global. Este change sólo corrige las afirmaciones de la documentación del backend que quedan falsas al quitar `create_all`.
- El ZIP en sí: se entrega el `.gitattributes` que lo gobierna; generarlo es parte del change de entrega.
- Refactor del backend, cambios de contrato HTTP, de rutas o de esquema de datos.

## Capabilities

### New Capabilities

- `frontend-hosting`: estructura pública del frontend (`public/`), imagen Nginx reproducible, plantilla de proxy hacia `API_UPSTREAM`, mismo origen para la web y `/api/`, y verificación local del contenedor.
- `backend-migrations`: esquema versionado con Alembic sobre `DATABASE_URL`, revisión inicial equivalente a las nueve tablas, arranque de la imagen que aplica `alembic upgrade head` y adopción de una base creada sin Alembic mediante `stamp head`.
- `delivery-package`: contenido exacto del paquete de entrega del Global definido con `export-ignore`, sin tooling, sin secretos y reproducible con `git archive`.

### Modified Capabilities

Ninguna. El proyecto raíz todavía no tiene specs; las specs del backend del parcial viven en `backend/openspec/specs/`, que es otro root de OpenSpec y no se toca en este change.

## Impact

- **Frontend**: `frontend/index.html`, `frontend/css/*`, `frontend/js/*` cambian de ubicación a `frontend/public/`; se agregan `frontend/Dockerfile`, `frontend/.dockerignore` y `frontend/default.conf.template`; `frontend/README.md` ajusta sus rutas.
- **Backend**: nuevos `alembic.ini`, `migrations/env.py`, `migrations/script.py.mako`, `migrations/versions/0001_*.py` y `test/test_artefactos_migraciones.py`; cambios en `app/main.py` (sin `create_all`), `app/seed.py` (sin `create_all`), `Dockerfile`, `requirements.txt`, `env.example`, `test/test_lifespan.py`, y correcciones mínimas en `README.md`, `DEPLOY.md`, `AGENTS.md`/`CLAUDE.md`, `test/test_artefactos_despliegue.py` y `test/test_artefactos_imagen.py` que hoy afirman que no hay migraciones o esperan un `CMD` sin Alembic.
- **Raíz**: nuevo `.gitattributes`.
- **Infraestructura**: sin cambios de servicios; el despliegue en Easypanel y el dominio quedan para el change siguiente. La base PostgreSQL existente de la VPS no se toca desde este repositorio: se documenta el `stamp head`.
- **Riesgo**: el motor Docker no está corriendo en el entorno de desarrollo al momento de planificar, y la etiqueta `nginx:1.30-alpine` debe existir en el registro. El apply ejecuta el build y el run; si el motor no está disponible, la evidencia queda marcada como pendiente y nunca se inventa.
