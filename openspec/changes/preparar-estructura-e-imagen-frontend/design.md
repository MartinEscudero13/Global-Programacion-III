# Design

## Context

Ver `proposal.md` §Why. Estado concreto del repositorio que condiciona el diseño:

- `frontend/` contiene `index.html`, `css/` (tres hojas), `js/` (nueve scripts) y `README.md`. El HTML referencia todo con rutas relativas (`css/base.css`, `js/data.js`), sin `../`, sin `url()` en CSS, sin imágenes y sin recursos externos. No hay `public/`, ni `Dockerfile`, ni plantilla de Nginx.
- `backend/` es el TP de los capítulos 1 a 4: routers montados **sin prefijo** (`/libros`, `/clientes`, `/ventas`, `/editoriales`, `/generos`, `/autores`, `/health`), `app/main.py` crea el esquema con `SQLModel.metadata.create_all` en el `lifespan`, `app/seed.py` también ejecuta `create_all`, y `requirements.txt` tiene versiones fijas (`sqlmodel==0.0.48`, `sqlalchemy[asyncio]==2.1.8`, `asyncpg==0.32.0`).
- Las nueve tablas y sus restricciones con nombre viven en `app/modules/*/models.py`: siete `CHECK` (`ck_libro_precio_positivo`, `ck_libro_stock_no_negativo`, `ck_libro_autor_rol`, `ck_libro_autor_orden`, `ck_venta_total_no_negativo`, `ck_renglon_venta_cantidad_positiva`, `ck_renglon_venta_precio_positivo`), cinco `UNIQUE` (`uq_cliente_email`, `uq_perfil_cliente_cliente_id`, `uq_editorial_nombre`, `uq_genero_nombre`, `uq_libro_isbn`) y los índices de `ix_libro_titulo` más los `index=True` de las claves foráneas.
- `backend/Dockerfile` usa `python:3.12-alpine`, usuario `appuser` (uid 1000), `HEALTHCHECK` contra `127.0.0.1:8000/health/ready` y `CMD` en forma exec que arranca Uvicorn sin migraciones.
- `backend/AGENTS.md` y `backend/CLAUDE.md` tienen una regla dura que prohíbe Alembic; `backend/README.md` y `backend/DEPLOY.md` afirman que no hay migraciones. `backend/test/test_lifespan.py` y `backend/test/test_artefactos_despliegue.py` verifican el comportamiento actual con `create_all`.
- `backend/test/conftest.py` crea el esquema de la base de test con `SQLModel.metadata.create_all`; la suite se salta esos casos sin `DATABASE_URL`.
- La raíz tiene `openspec/`, `docs/`, `.opencode/`, `frontend/` y `backend/`; todavía no hay `README.md`, `DEPLOY.md` ni `evidencia/` propios del Global.
- El CLI de Docker existe pero el motor no está corriendo en el entorno de desarrollo al planificar. El apply debe iniciar Docker Desktop; si no lo logra, la evidencia del contenedor queda marcada como pendiente, nunca simulada.

## Goals / Non-Goals

**Goals:**

- Dejar `frontend/` en la forma que pide el Ejercicio 4, con el contenido de `Dockerfile`, `.dockerignore` y `default.conf.template` idéntico al de la consigna.
- Hacer de Alembic la única fuente del esquema del backend, sin perder la base existente ni los datos.
- Dejar el paquete de entrega definido por atributos de Git, verificable antes de que existan `README.md`, `DEPLOY.md` y `evidencia/` de la raíz.
- Producir evidencia real de build, ejecución, proxy y migraciones; si el motor no está disponible, dejar el comando y el criterio con estado pendiente.

**Non-Goals:**

- No se integra `fetch` ni se cambia una línea de la lógica del frontend: el catálogo sigue leyendo `localStorage` en esta etapa.
- No se configura nada en Easypanel, ni dominios, ni variables del panel.
- No se generan los casos G-01 a G-07 ni los documentos finales de la raíz.
- No se actualiza la base de conocimiento del backend ni las specs del parcial: son tooling excluido del paquete y quedan como deuda declarada.
- No se agregan frameworks de test, migraciones de datos ni cambios de contrato HTTP.

## Decisions

### 1. `public/` como raíz servida, con la configuración fuera

`frontend/public/` agrupa `index.html`, `css/` y `js/`; `Dockerfile`, `.dockerignore`, `default.conf.template` y `README.md` quedan en `frontend/`. Las rutas relativas del HTML no cambian, porque `css/` y `js/` se mueven junto con el documento y no hay referencias hacia arriba.

**Alternativa descartada**: dejar la web en `frontend/` y usar `COPY . /usr/share/nginx/html/`. Expondría como descargables el `Dockerfile`, la plantilla de Nginx y el `.dockerignore`, y el contexto de build mezclaría contenido con configuración.

**Alternativa descartada**: copiar archivo por archivo (`COPY index.html css js ...`). Se rompe en cuanto se agrega `img/` o una página nueva, que es justamente lo que la consigna anticipa en el árbol de `public/`.

**Alternativa descartada**: mover también `README.md` a `public/`. La documentación no es un recurso de la web y quedaría accesible desde el navegador.

No hace falta tocar el HTML: las tres hojas y los nueve scripts ya están referenciados con rutas relativas y sólo se actualizan las instrucciones de `frontend/README.md` que dicen abrir `index.html`.

### 2. Imagen Nginx con la plantilla oficial de `envsubst`

`frontend/Dockerfile`, exacto según la consigna:

```dockerfile
FROM nginx:1.30-alpine
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$
COPY public/ /usr/share/nginx/html/
COPY default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
```

`frontend/default.conf.template`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ =404;
  }

  location /api/ {
    proxy_pass http://${API_UPSTREAM}/;
  }
}
```

El `ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$` no es decorativo: la imagen oficial de Nginx pasa `envsubst` sobre la plantilla y, sin filtro, borraría `$uri` y `$uri/` y dejaría `try_files` inservible. Con el filtro, sólo se sustituye `API_UPSTREAM`.

La barra final de `proxy_pass` recorta el prefijo: `/api/libros/` llega como `/libros/`, que es como están montados los routers. Por eso el backend no se toca y el frontend podrá usar `/api` como base en el change de integración.

`try_files` sin fallback a `index.html` es correcto porque la aplicación usa anclas (`#catalogo`) y no rutas profundas de una SPA; un fallback ocultaría los 404 reales que la consigna pide poder distinguir.

**Alternativa descartada**: fijar `API_UPSTREAM` en el `Dockerfile` con `ENV`. Impediría reutilizar la imagen entre entornos y metería el nombre interno del proyecto en una capa.

**Alternativa descartada**: `nginx:alpine` sin versión. La consigna fija `1.30-alpine` y una etiqueta móvil haría el build no reproducible.

### 3. Sin CORS: la web y la API comparten origen

El navegador pide `http://<host>[:8080]/` y `http://<host>[:8080]/api/...`: mismo esquema, host y puerto. No hay origen cruzado, no hay preflight y no hace falta `CORSMiddleware` ni cabecera `Access-Control-Allow-*`. El proxy de Nginx es el único que habla con `API_UPSTREAM`, desde la red interna, donde CORS no existe.

**Alternativa descartada**: agregar `CORSMiddleware` al backend. No resuelve nada que el proxy no resuelva y agrega una superficie de configuración que la consigna no pide.

**Alternativa descartada**: montar los routers de FastAPI bajo `/api` para no recortar el prefijo. Cambiaría el contrato del TP, duplicaría el prefijo entre Nginx y FastAPI y obligaría a reescribir tests y documentación del backend.

**Consecuencia para el change de integración**: la base del cliente HTTP será `/api` y se conservará la barra final de las rutas que la traen (`/api/libros/`), como pide el Ejercicio 1.

### 4. Alembic reemplaza a `create_all` en tiempo de ejecución

`app/main.py` deja de ejecutar `SQLModel.metadata.create_all`: el `lifespan` sólo construye el motor y la fábrica, los publica en `app.state` y libera el motor al apagar. `app/seed.py` también deja de crear el esquema y pasa a ser sólo datos.

Razón: con las migraciones aplicadas por la imagen, un `create_all` simultáneo es una segunda fuente de esquema. Si la migración falla pero `create_all` corre, la API arranca con un esquema parcial y el error queda escondido; si el modelo y la migración divergen, `create_all` crea tablas nuevas sin `alembic_version`, que es exactamente el estado que hay que evitar. Una sola fuente hace que `alembic check` signifique algo.

**Alternativa descartada**: conservar `create_all` como red de seguridad idempotente. `create_all` sólo crea tablas faltantes, no altera ni borra; no aporta nada que la migración no haga y tapa fallos.

**Alternativa descartada**: dejar `create_all` sólo en el seed. Permite sembrar una base sin migrar y crea tablas sin versión registrada, reproduciendo el problema en cada base nueva.

**Consecuencia en tests**: `test/conftest.py` sigue creando el esquema de la base de test con `create_all`. Es DDL de test, no de runtime: corre en una base `_test` desechable, se recrea por prueba y evita levantar Alembic en cada caso. La equivalencia entre migración y modelo se verifica aparte con `alembic check` sobre una base limpia y con una consulta a `pg_constraint`, no con la suite unitaria.

Los imports explícitos de los seis módulos de `models` en `app/main.py` se conservan aunque ya no alimenten un `create_all`: completan el registro de clases que SQLAlchemy necesita para resolver las relaciones declaradas por cadena. Sólo se actualiza el comentario que los justificaba.

### 5. `env.py` asincrónico que reutiliza la validación de la aplicación

`migrations/env.py` usa el motor asincrónico (`async_engine_from_config` + `connection.run_sync`) y obtiene la URL con `app.core.config.get_settings()`, la misma función que valida `DATABASE_URL` al arrancar la API. Así el mensaje de error por variable faltante o por driver equivocado es el mismo en los dos caminos y no se duplica la regla del prefijo `postgresql+asyncpg://`.

`target_metadata` es `SQLModel.metadata` y `env.py` importa explícitamente los seis módulos de `models` —el mismo patrón que ya usa `app/main.py`— para que el metadata tenga las nueve tablas. `prepend_sys_path = .` en `alembic.ini` hace importable `app` cuando se ejecuta con `backend/` o `/app` como directorio de trabajo, que es como lo invocan la consigna, las tareas y la imagen.

`alembic.ini` no lleva `sqlalchemy.url`: la URL se inyecta en `config.set_main_option` después de leerla del entorno, con `%` escapado como `%%` para que configparser no interprete la contraseña.

**Alternativa descartada**: leer `os.environ` directamente en `env.py`. Duplicaría la validación y el mensaje, y ese camino no estaría cubierto por los tests de configuración existentes.

**Alternativa descartada**: motor sincrónico con `psycopg2`. Agregaría un driver y una dependencia que la aplicación no usa.

### 6. Revisión inicial generada con autogenerate y completada a mano

Se genera con `alembic revision --autogenerate -m "esquema inicial"` contra una base limpia y después se revisa el archivo. La revisión se completa a mano con los siete `CHECK`, porque autogenerate no los detecta ni los compara: sin ese paso, `alembic check` diría que todo está al día aunque falten restricciones que el modelo exige.

Criterio de equivalencia, verificable:

1. `alembic upgrade head` sobre una base limpia deja las nueve tablas más `alembic_version`.
2. `alembic check` no reporta operaciones pendientes.
3. `SELECT conname FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace` devuelve los siete nombres de `CHECK` del modelo.
4. `alembic downgrade base` deja la base sin tablas del dominio y `upgrade head` vuelve a crearlas.

**Alternativa descartada**: escribir la migración a mano desde cero. Más error de transcripción en nueve tablas con índices, claves y restricciones; autogenerate acierta la estructura y el repaso manual cubre lo que no detecta.

**Alternativa descartada**: usar `SQLModel.metadata.create_all` dentro de la primera migración. La migración dejaría de describir el esquema y no sería revisable; además impediría un `downgrade` coherente.

### 7. `stamp head` para la base que ya existe en la VPS

La base de la VPS se creó con `create_all`, así que su esquema coincide con la revisión inicial pero no tiene `alembic_version`. Ejecutar `alembic upgrade head` ahí falla con "relation already exists" (sin perder datos). El procedimiento es adoptar la base antes del primer arranque de la imagen nueva:

```bash
docker run --rm --env-file /root/libreria-zoriontech.env \
  libreria-zoriontech alembic stamp head
```

Se ejecuta sobre la imagen nueva sobrescribiendo el `CMD`, antes de reemplazar el contenedor en servicio. Después, `alembic upgrade head` es un no-op y el arranque automático queda en el mismo estado.

**Alternativa descartada**: escribir la revisión inicial con `IF NOT EXISTS` en cada `CREATE`. Alembic no genera ese DDL, oculta el estado real de la base y deja `alembic_version` sin marcar; el próximo `upgrade` volvería a intentar crear todo.

**Alternativa descartada**: recrear la base desde cero. Pierde los datos ficticios cargados y contradice la regla de no ejecutar `DROP` por cuenta propia.

**Orden obligatorio para el despliegue posterior**: `stamp head` sobre la base existente y sólo después el arranque normal. Si la base asignada para el Global es nueva, el `upgrade head` del `CMD` alcanza y el `stamp` no se ejecuta.

### 8. `CMD` en forma shell con `exec`

```dockerfile
CMD alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

El `Dockerfile` suma `COPY alembic.ini ./alembic.ini` y `COPY migrations ./migrations` antes de cambiar de usuario. `exec` reemplaza el shell por Uvicorn, de modo que el proceso queda como PID 1 y recibe `SIGTERM` en `docker stop`; sin `exec`, el shell sería PID 1, Uvicorn no recibiría la señal y Docker lo mataría tras el tiempo de gracia. Si `alembic upgrade head` falla, el `&&` corta la cadena y Uvicorn no arranca: el contenedor queda en error y la causa está en `docker logs`.

Se conserva `python:3.12-alpine`, el usuario `appuser` y el `HEALTHCHECK` existentes. El ejemplo `python:3.12-slim` de la consigna es para quien todavía no tiene `Dockerfile`; reemplazar la base actual perdería la decisión de imagen liviana ya verificada en el parcial. Alembic es Python puro: no necesita compilador ni `libpq` en Alpine.

**Alternativa descartada**: un `entrypoint.sh` con la migración y luego `exec "$@"`. Agrega un archivo y un `COPY` que la consigna no pide, sin mejorar el comportamiento.

**Alternativa descartada**: migrar en un paso separado del despliegue (init container). Easypanel con dos servicios App no ofrece ese paso; la consigna pide que la imagen aplique la migración.

### 9. `alembic.ini` mínimo y versionado

Sólo lo necesario: `[alembic]` con `script_location = migrations`, `prepend_sys_path = .`, `path_separator = os`, la plantilla de logging estándar y `sqlalchemy.url` vacío. `alembic` se agrega a `requirements.txt` con versión fija, resuelta durante el apply contra `sqlalchemy==2.1.8`; la versión exacta queda escrita en el archivo y verificada con `pip show alembic`.

**Alternativa descartada**: `alembic>=1.16`. Repetiría el problema de reproducibilidad que el proyecto ya evita en las demás dependencias.

**Alternativa descartada**: `alembic.ini` generado por `alembic init`. Trae secciones y comentarios de ejemplo, logging verboso y `sqlalchemy.url` con la URL de ejemplo que hay que borrar; un archivo mínimo es más fácil de auditar.

### 10. `.dockerignore` del frontend exacto

Las cinco líneas de la consigna (`.git`, `**/.env`, `**/.env.*`, `**/node_modules`, `**/.DS_Store`) cubren secretos y artefactos. No se excluye `README.md`: el `Dockerfile` no lo copia y excluirlo sólo agrega una regla que hay que mantener.

**Alternativa descartada**: `.env*`. Excluiría `env.example` si algún día vive en el frontend; la lista explícita es más clara.

### 11. `.gitattributes` con lista explícita de exclusiones

Contenido propuesto en la raíz:

```gitattributes
# Empaquetado de la entrega: git archive respeta export-ignore.
.gitattributes export-ignore
AGENTS.md export-ignore
CHANGES.md export-ignore
.active-orchestrator-state.json export-ignore
.atl/ export-ignore
.opencode/ export-ignore
design-system/ export-ignore
docs/ export-ignore
knowledge-base/ export-ignore
openspec/ export-ignore

backend/AGENTS.md export-ignore
backend/CHANGES.md export-ignore
backend/CLAUDE.md export-ignore
backend/DEPLOY.md export-ignore
backend/.active-orchestrator-state.json export-ignore
backend/.atl/ export-ignore
backend/.opencode/ export-ignore
backend/design-system/ export-ignore
backend/docs/ export-ignore
backend/evidencia/ export-ignore
backend/knowledge-base/ export-ignore
backend/openspec/ export-ignore
backend/scripts/ export-ignore
backend/test/test_artefactos_despliegue.py export-ignore
backend/test/test_artefactos_http.py export-ignore
backend/test/test_artefactos_imagen.py export-ignore
```

Qué se conserva y por qué:

- `frontend/` completo, incluido su `README.md`: es documentación del componente que se entrega.
- `backend/app`, `backend/test`, `backend/migrations`, `backend/alembic.ini`, `backend/requirements*.txt`, `backend/pyproject.toml`, `backend/env.example`, `backend/Dockerfile`, `backend/.dockerignore`, `backend/.gitignore` y `backend/README.md`: código, migraciones, pruebas, configuración de ejemplo y el manual operativo de la API.
- `backend/scripts/` se excluye: son los scripts de despliegue del parcial (`desplegar_vps.sh`, `verificar_imagen.sh`, `verificar_publico.sh`, `verificar_despliegue.sh`, `generar_evidencia_c07.py`) atados al contenedor `libreria-zoriontech` y a la IP del parcial; la entrega del Global documenta su propio despliegue en la raíz.
- `backend/evidencia/` se excluye: contiene D-01 a D-07 y C-07 del parcial; la evidencia del Global va en `evidencia/` de la raíz.
- `backend/DEPLOY.md` se excluye: describe el despliegue del parcial y compite con el `DEPLOY.md` de la raíz del Global.
- `backend/CHANGES.md`, `AGENTS.md`, `CLAUDE.md` y los árboles de OpenSpec y knowledge base son tooling de agentes, no parte del entregable.
- `backend/test/test_artefactos_despliegue.py`, `backend/test/test_artefactos_http.py` y `backend/test/test_artefactos_imagen.py` se excluyen porque verifican justamente los artefactos que salen del paquete (`DEPLOY.md`, `scripts/`, `evidencia/` del parcial): si viajaran, la suite del ZIP fallaría al no encontrar esos archivos. El resto de `backend/test/` sí viaja y la suite completa del paquete debe quedar sin fallos.
- `README.md`, `DEPLOY.md` y `evidencia/` de la raíz no se excluyen: todavía no existen y los crea el change de documentación final.

**Alternativa descartada**: un `.gitattributes` dentro de `backend/`. Funciona, pero dispersa la política de entrega en dos archivos y es más difícil de auditar; una lista única en la raíz se lee de un vistazo.

**Alternativa descartada**: armar el ZIP con una lista blanca copiada a un directorio temporal. Requiere un script y deja el paquete dependiente de que nadie olvide excluir algo; `git archive` con `export-ignore` es reproducible desde el commit.

### 12. Correcciones documentales mínimas en el backend

Quitar `create_all` deja falsas tres afirmaciones y una regla dura. Se corrigen en el mismo change, con el alcance mínimo:

- `backend/README.md`: las líneas que dicen "no hay migraciones" y "el esquema se crea con `create_all`" pasan a describir `alembic upgrade head` antes de Uvicorn y antes del seed.
- `backend/DEPLOY.md`: la sección "Limitación de `create_all` (DD-06)" pasa a "Migraciones con Alembic", con `upgrade head`, `stamp head` para bases existentes y el orden de actualización.
- `backend/AGENTS.md` y `backend/CLAUDE.md`: la regla "NUNCA Alembic ni migraciones" se invierte, porque es la que impediría implementar este change.
- `backend/test/test_artefactos_despliegue.py`: el test que exige la mención de `create_all` en `DEPLOY.md` pasa a exigir `alembic upgrade head` y `stamp head`.
- `backend/test/test_artefactos_imagen.py`: la prueba del `CMD` en forma exec pasa a exigir el encadenado `alembic upgrade head && exec uvicorn` con `--host 0.0.0.0` y `--port 8000`.
- `backend/env.example`: un comentario que aclara que `DATABASE_URL` la usan la API y Alembic.

La base de conocimiento y las specs del parcial no se tocan: son tooling excluido del paquete y su sincronización es deuda declarada.

**Alternativa descartada**: dejar la documentación para el change final. Durante el apply y el despliegue intermedio, `DEPLOY.md` afirmaría un mecanismo que ya no existe y un test lo respaldaría.

### 13. Verificación del contenedor con evidencia real

El apply ejecuta, en `frontend/`:

```bash
docker info
docker build -t libreria-frontend .
docker run -d --name libreria-frontend -p 127.0.0.1:8080:80 \
  --add-host=host.docker.internal:host-gateway \
  -e API_UPSTREAM=host.docker.internal:8000 libreria-frontend
```

Con el backend local levantado (`alembic upgrade head` + `uvicorn`), se comprueba `GET http://127.0.0.1:8080/`, `GET /api/health/ready`, `GET /api/libros/`, el catálogo en el navegador y la ausencia de errores en consola. Las salidas se guardan en `evidencia/E4-imagen-frontend.txt`; las de Alembic, en `evidencia/E4-alembic.txt`. Si el motor no está disponible, ambos archivos conservan `ESTADO: PENDIENTE` con el comando y el criterio, y el change no declara el caso como verificado.

**Alternativa descartada**: dejar sólo los comandos en la documentación. La consigna pide resultados observados y el repositorio ya usa la convención de evidencia capturada.

## Risks / Trade-offs

- **Motor Docker apagado en el entorno de desarrollo** → el apply intenta iniciar Docker Desktop y verifica con `docker info`; si no hay motor, el build y el run quedan como evidencia pendiente y el change no se marca como verificado. No se escribe ninguna salida inventada.
- **La etiqueta `nginx:1.30-alpine` podría no existir en el registro** → se usa la que fija la consigna; si `docker build` falla al resolverla, el apply se detiene y se informa, en lugar de sustituirla en silencio por otra versión.
- **`stamp head` sobre una base cuyo esquema no coincide** → marcaría como aplicada una migración que la base no refleja y el próximo cambio de esquema fallaría de forma confusa. Mitigación: antes del `stamp` se comprueba que existan las nueve tablas y, si la base tiene un esquema distinto, se escala al change de despliegue sin tocar datos.
- **Autogenerate omite los `CHECK`** → mitigación explícita: repaso manual de la revisión y consulta a `pg_constraint` que debe devolver los siete nombres. Sin ese paso, `alembic check` no lo detecta.
- **Migración automática al arrancar con varias réplicas** → dos contenedores podrían migrar a la vez. En este despliegue hay un único servicio backend; se documenta como limitación para escalar.
- **La imagen arranca más lento por la migración** → el `HEALTHCHECK` existente tiene `--start-period=10s`; si la migración inicial tarda más en una base lenta, el primer chequeo puede marcar `unhealthy` sin que el proceso esté caído. Se mantiene el valor y se registra como observación; los reintentos cada 30 s corrigen el estado.
- **Tests de base saltados sin `DATABASE_URL`** → la equivalencia migración/modelo se verifica en el apply sobre una base local limpia; en un clon sin base, `alembic check` no se puede ejecutar y el test estático de artefactos sigue cubriendo la forma de los archivos.
- **Documentación interna del backend desactualizada** (knowledge base, specs del parcial) → se declara como deuda; no entra al paquete y no afecta el comportamiento. El riesgo es que un agente lea una decisión vieja; mitigación: la regla dura de `AGENTS.md`/`CLAUDE.md` sí se corrige.
- **`public/` cambia rutas del repositorio** → cualquier enlace externo al `frontend/index.html` del repositorio se rompe. No hay enlaces así; el cambio se hace con `git mv` para conservar el historial.
- **Dos raíces de OpenSpec** (raíz y `backend/openspec`) → este change vive en la raíz y no sincroniza las specs del parcial; se anota para no confundir el `archive` de cada uno.

## Migration Plan

1. **Frontend**: `git mv` de `index.html`, `css/` y `js/` a `public/`; agregar `Dockerfile`, `.dockerignore` y `default.conf.template`; corregir las rutas en `frontend/README.md`.
2. **Backend**: agregar `alembic` a `requirements.txt` e instalarlo en el entorno; crear `alembic.ini` y `migrations/`; quitar `create_all` de `app/main.py` y `app/seed.py`; generar y completar la revisión inicial; ajustar `Dockerfile`; corregir documentación y tests afectados; agregar el test estático de migraciones.
3. **Raíz**: crear `.gitattributes`.
4. **Verificación**: suite del backend, `alembic upgrade head`/`check`/`downgrade base`/`upgrade head` sobre base limpia, `openspec validate --strict`, build y run del frontend con el backend local y recorrido del navegador.
5. **Despliegue posterior** (otro change): `stamp head` sobre la base existente si se reutiliza, servicios de Easypanel, dominio y casos G-01 a G-07.
6. **Rollback**: revertir el commit. En la base no hay que hacer nada mientras no se haya ejecutado `stamp head` ni `upgrade head`; si ya se ejecutaron, el esquema sigue siendo el mismo que producía `create_all` y la tabla `alembic_version` es inocua. El contenedor anterior del frontend no existe todavía.

## Open Questions

- Ninguna que afecte specs, enfoque o tareas. La versión exacta de `alembic` y el identificador de la revisión inicial se fijan durante el apply y quedan escritos en los archivos.
