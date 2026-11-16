# Proposal

## Why

El profesor indicó que el esquema se cree con `SQLModel.metadata.create_all` y
que **no** se use Alembic. Eso revierte la decisión que tomó el change
`preparar-estructura-e-imagen-frontend`, donde Alembic pasó a ser la única
fuente del esquema y la imagen aplicaba `alembic upgrade head` al arrancar.

La consecuencia práctica: si se deja como está, la entrega no sigue la
indicación vigente de la cátedra, y el backend arrastra una dependencia
(`alembic`), dos archivos de configuración y una revisión inicial que ya no
deben existir.

## What Changes

- `app/main.py` vuelve a crear el esquema en el `lifespan` con
  `SQLModel.metadata.create_all` antes de atender pedidos.
- `app/seed.py` vuelve a crear el esquema, para que la carga inicial funcione
  sobre una base recién creada sin depender de que la API haya arrancado antes.
- Se eliminan `backend/alembic.ini`, `backend/migrations/` y la dependencia
  `alembic` de `backend/requirements.txt`.
- El `CMD` del `Dockerfile` vuelve a ser sólo Uvicorn y se quitan los `COPY` de
  `alembic.ini` y `migrations/`.
- Se elimina `test/test_artefactos_migraciones.py` y se ajustan los tests que
  esperaban el `CMD` con migraciones o que el arranque no tocara el esquema.
- Se actualiza la documentación (`backend/README.md`, `backend/DEPLOY.md`,
  `backend/AGENTS.md`, `backend/CLAUDE.md`, `README.md`, `DEPLOY.md`) y la
  evidencia de la etapa anterior que describe Alembic.
- En la base que ya está desplegada se elimina la tabla `alembic_version`, que
  queda sin sentido al no existir migraciones.

## Impact

- **Backend**: `app/main.py`, `app/seed.py`, `Dockerfile`, `requirements.txt`,
  `README.md`, `DEPLOY.md`, `AGENTS.md`, `CLAUDE.md`, `env.example` y cinco
  archivos de `test/`.
- **Raíz**: `README.md`, `DEPLOY.md`, `evidencia/`.
- **Despliegue**: el servicio `libreria-backend` se redespliega con la imagen
  nueva; el esquema ya existe, así que `create_all` no altera nada.
- **Riesgo**: bajo. `create_all` crea tablas faltantes y no modifica las
  existentes; los datos actuales no se tocan.

## Fuera de alcance

- El frontend y el contrato HTTP no cambian.
- No se modifica la estructura de tablas ni los modelos.
