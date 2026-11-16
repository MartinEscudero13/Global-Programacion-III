# Librería web integrada · Global de Programación III

Aplicación de librería con frontend estático y API FastAPI sobre PostgreSQL,
desplegada en una VPS administrada con Easypanel.

**Grupo:** ZorionTech
**Integrantes:** Martín Escudero, Lautaro Naranjo
**Materia:** Programación III — Tecnicatura Universitaria en Programación
**Entrega:** Evaluación Global · Integración y despliegue
**URL pública:** https://libreria.zoriontech.me

## Qué hace

- **Catálogo** con búsqueda parcial por título, paginación con `limit` y `offset`,
  y detalle de cada libro con sus autorías (nombre, rol y orden).
- **Altas de libros** con editoriales y géneros traídos de la API, stock, género
  opcional y al menos una autoría verificada por ID.
- **Altas de clientes** con alta y recupero por ID.
- **Venta** con renglones, cambio de cantidades, confirmación contra la API y
  el desglose de importes que devuelve el servidor.
- **Historial** paginado con detalle de cada venta y los importes históricos.

Todo el estado persistente vive en PostgreSQL. La interfaz sólo conserva en
memoria el borrador de la venta en curso, como permite la consigna.

## Estructura

```
frontend/
├── public/                  index.html, css/ y js/ (lo único que se sirve)
├── Dockerfile               nginx:1.30-alpine
├── default.conf.template    sirve la web y proxea /api/ al backend
├── .dockerignore
└── test/                    runner node --test (no viaja en el paquete)
backend/
├── app/                     FastAPI por módulos (libros, clientes, ventas, ...)
├── test/                    pytest
├── Dockerfile
├── env.example
└── requirements.txt
evidencia/                   casos G-01 a G-07 con su salida real
DEPLOY.md                    URL, build paths, variables y pasos de despliegue
```

## Cómo ejecutarlo localmente

Requisitos: Docker, Python 3.12+ y Node 24 (solo para los tests del frontend).

**1. Base de datos**

```bash
docker run -d --name libreria-pg \
  -e POSTGRES_PASSWORD=libreria -e POSTGRES_DB=libreria \
  -p 127.0.0.1:5433:5432 postgres:18-alpine
```

**2. Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Linux/macOS: .venv/bin/pip
export DATABASE_URL="postgresql+asyncpg://postgres:libreria@127.0.0.1:5433/libreria"
.venv/Scripts/python -m app.seed
.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

El esquema lo crea la API con `SQLModel.metadata.create_all` al arrancar, y el
seed también lo crea si falta: es idempotente y no borra datos.

**3. Frontend**

```bash
cd frontend
docker build -t libreria-frontend .
docker run -d --name libreria-frontend -p 127.0.0.1:8080:80 \
  -e API_UPSTREAM=host.docker.internal:8000 libreria-frontend
```

Abrí <http://127.0.0.1:8080>. En Docker Desktop no se pasa `--add-host`.

La web no se puede abrir con doble clic en esta etapa: necesita el proxy `/api/`
que resuelve Nginx, porque todo el estado proviene de la API.

## Datos de prueba

`python -m app.seed` carga datos ficticios de forma idempotente:

| Tabla | Filas |
|---|---|
| editorial | 1 (Sudamericana) |
| genero | 1 (Novela) |
| autor | 4 (Cortázar, Piglia, García Márquez, Vargas Llosa) |
| libro | 4 (Rayuela, Antología del cuento latinoamericano, La ciudad y los perros, Respiración artificial) |
| libro_autor | 5 |
| cliente | 2 (Ana Gómez, Tomás Ríos) |
| venta | 1 (Tomás Ríos, 2 renglones, total 77000.00) |

Para probar la paginación del catálogo hacen falta más de 20 libros: se pueden
crear desde la propia pantalla de altas o con `POST /api/libros/`.

## Decisiones que la consigna pide documentar

**Clientes y autores se seleccionan por ID.** El contrato del backend no expone
listados de clientes ni de autores: sólo `GET /clientes/{id}` y
`GET /autores/{id}`. Por eso el alta de libros y la venta tienen un campo de
identificador con un botón de búsqueda que consulta la API, muestra el nombre
devuelto y recién entonces permite seleccionarlo. Es la alternativa que la
consigna habilita de forma explícita.

**La búsqueda del catálogo se ejecuta al enviar** el formulario (Enter o el
botón), no en cada tecla, para no disparar una petición por carácter.

**El total previo a confirmar es una estimación.** Los importes definitivos son
los que devuelve `POST /ventas/`; después de confirmar se muestran esos.

## Pruebas

```bash
# Frontend: 122 casos con el runner integrado de Node, sin dependencias
cd frontend
node --test "test/**/*.test.mjs"

# Backend
cd backend
.venv/Scripts/python -m pytest -q
```

El arnés del frontend simula el DOM y carga las IIFE reales en el orden de
`index.html`, con `fetch` interceptado para afirmar URL, método y cuerpo exactos.
Los casos con PostgreSQL se omiten si no hay `DATABASE_URL`.

## Comprobaciones realizadas

| Fecha | Qué se comprobó | Resultado |
|---|---|---|
| 15/11/2026 | `node --test` en `frontend/` | 122 casos, 0 fallos |
| 15/11/2026 | `pytest` en `backend/` | sin fallos; los casos de base se omiten sin `DATABASE_URL` |
| 15/11/2026 | Casos G-01 a G-06 por la URL pública | ver `evidencia/G-casos-publicos.txt` |
| 15/11/2026 | G-07: HTTPS, salud, redespliegue | ver `evidencia/G-07-despliegue.txt` |
| 15/11/2026 | Consola del navegador | sin errores de la aplicación |
| 15/11/2026 | Anchos de 320 px y 1280 px | sin desplazamiento horizontal |

## Entrega

El ZIP contiene `frontend/`, `backend/` (sin tooling), `README.md`, `DEPLOY.md` y
`evidencia/`. Se genera con:

```bash
git archive --format=zip -o global-programacion-iii.zip HEAD
```

`.gitattributes` excluye del paquete las carpetas de trabajo (`openspec/`,
`knowledge-base/`, `docs/`, `design-system/`, artefactos de agentes), los scripts
de la etapa anterior y los archivos de entorno.
