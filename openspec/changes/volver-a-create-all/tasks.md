# Tasks

## A. Código del backend

- [x] A.1 Restaurar `create_all` en el `lifespan` de `app/main.py`: construir el motor, crear el esquema con `SQLModel.metadata.create_all` antes de ceder el control y liberar el motor al apagar. Verificación: `Select-String -Path backend\app\main.py -Pattern 'create_all'` devuelve una coincidencia y `pytest test/test_lifespan.py -q` termina sin fallos.
- [x] A.2 Restaurar `create_all` en `app/seed.py` antes de las inserciones, con su import. Verificación: el módulo contiene `create_all` y `pytest test/test_seed.py -q` pasa.
- [x] A.3 Quitar `alembic` de `backend/requirements.txt`. Verificación: `Select-String -Path backend\requirements.txt -Pattern alembic` no devuelve coincidencias.
- [x] A.4 Borrar `backend/alembic.ini` y `backend/migrations/` con `git rm -r`. Verificación: `Test-Path backend\alembic.ini` y `Test-Path backend\migrations` son `False`.
- [x] A.5 Ajustar `backend/Dockerfile`: quitar los `COPY` de `alembic.ini` y `migrations/` y volver el `CMD` a `["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`. Verificación: el archivo no menciona alembic y `pytest test/test_artefactos_imagen.py -q` pasa.

## B. Pruebas

- [x] B.1 Borrar `backend/test/test_artefactos_migraciones.py`. Verificación: `Test-Path` responde `False`.
- [x] B.2 Ajustar `test/test_lifespan.py`: el arranque crea el esquema y sobre una base vacía quedan las nueve tablas; sobre una base con tablas no borra datos. Verificación: `pytest test/test_lifespan.py -q` sin fallos.
- [x] B.3 Ajustar `test/test_seed.py`: el seed crea el esquema cuando falta. Verificación: `pytest test/test_seed.py -q` sin fallos.
- [x] B.4 Ajustar `test/test_artefactos_despliegue.py` y `test/test_artefactos_imagen.py` para que exijan `create_all` y un `CMD` sin migraciones. Verificación: ambos archivos pasan.
- [x] B.5 Suite completa: `pytest -q` en `backend/`. Verificación: `0 failed`.

## C. Documentación

- [x] C.1 `backend/README.md`, `backend/DEPLOY.md`, `backend/AGENTS.md` y `backend/CLAUDE.md`: reemplazar las afirmaciones sobre Alembic por `create_all` al arrancar, incluida la limitación de que no altera tablas existentes. Verificación: `Select-String -Path backend\*.md -Pattern 'alembic'` sólo devuelve la nota histórica que se decida conservar.
- [x] C.2 `README.md` y `DEPLOY.md` de la raíz: quitar `alembic.ini` y `migrations/` de la estructura y del flujo de despliegue. Verificación: `Select-String -Path README.md,DEPLOY.md -Pattern 'alembic'` no devuelve coincidencias.
- [x] C.3 `backend/env.example`: dejar `DATABASE_URL` documentada como usada por la API y el seed.

## D. Evidencia y entrega

- [x] D.1 Reemplazar `evidencia/E4-alembic.txt` por `evidencia/esquema-create-all.txt` con la salida real: base limpia, arranque de la API, nueve tablas creadas, seed sobre base vacía y redespliegue. Verificación: el archivo existe y `E4-alembic.txt` ya no.
- [x] D.2 Regenerar el ZIP y comprobar que no lleva `alembic.ini` ni `migrations/`. Verificación: `tar -tf global-programacion-iii.zip` no los lista y la suite del paquete descomprimido pasa.

## E. Despliegue

- [x] E.1 Redesplegar `libreria-backend` desde `main` y confirmar en los logs que el arranque crea el esquema. Verificación: `docker service logs` muestra el arranque de Uvicorn sin `alembic` y `/health/ready` responde 200.
- [x] E.2 Eliminar la tabla `alembic_version` de la base desplegada. Verificación: `\dt` no la lista y los datos de dominio siguen (libros y ventas).
- [x] E.3 Verificar desde la URL pública: catálogo, detalle y una venta. Verificación: `GET /api/libros/` responde 200 con datos y `POST /api/ventas/` responde 201.
