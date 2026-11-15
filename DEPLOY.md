# DEPLOY.md · Despliegue del Global de Programación III

Grupo **ZorionTech**. Despliegue de la librería en la VPS de la cátedra,
administrada con **Easypanel** (Docker Swarm + Traefik).

## Datos del despliegue

| Parámetro | Valor |
|---|---|
| URL pública | `https://libreria.zoriontech.me` |
| Fecha del despliegue | `15/11/2026` |
| Revisión desplegada | `ece2a8b` de `main` |
| Repositorio | `https://github.com/MartinEscudero13/Global-Programacion-III` |
| Proyecto en Easypanel | `zoriontech-crm` |
| Panel | Easypanel sobre `srv1920450` (Ubuntu 24.04, Docker 29.7.1, Traefik 3.6.7) |
| Vista local del sitio | `http://127.0.0.1:8080` |

## Servicios

| Servicio | Tipo | Build Path | Imagen / build | Réplicas |
|---|---|---|---|---|
| `libreria-frontend` | App | `/frontend` | `Dockerfile` (nginx:1.30-alpine) | 1 |
| `libreria-backend` | App | `/backend` | `Dockerfile` (python:3.12-alpine) | 1 |
| `libreria-db` | Postgres | — | `postgres:18-alpine` | 1 |

Nombres internos en Swarm: `zoriontech-crm_libreria-frontend`,
`zoriontech-crm_libreria-backend`, `zoriontech-crm_libreria-db`.

> **Por qué el proyecto es `zoriontech-crm`**: el panel no permite crear un
> cuarto proyecto (`You are not allowed to create more projects`;
> `canCreateProject` devuelve `false`). Los servicios del Global se crearon
> dentro del proyecto del grupo con el prefijo `libreria-` para no mezclarse con
> los de otras materias.

## Puertos y proxy

- **Frontend**: puerto interno `80`. El dominio `libreria.zoriontech.me` entra
  por HTTPS (Traefik) y habla HTTP contra el puerto 80 del contenedor.
- **Backend**: puerto interno `8000`, **sin dominio público**. Sólo se alcanza
  por la red interna del proyecto.
- **Postgres**: puerto interno `5432`, sin puerto publicado.

`default.conf.template` define:

```nginx
location /api/ { proxy_pass http://${API_UPSTREAM}/; }
```

La barra final recorta `/api/`, así que `GET /api/libros/` llega a FastAPI como
`GET /libros/`. Web y API comparten origen: **no hace falta CORS**.

## Variables de entorno

Se cargan en el panel, nunca en el repositorio.

| Servicio | Variable | Contenido |
|---|---|---|
| `libreria-frontend` | `API_UPSTREAM` | `zoriontech-crm_libreria-backend:8000` |
| `libreria-backend` | `DATABASE_URL` | `postgresql+asyncpg://libreria:<clave>@zoriontech-crm_libreria-db:5432/libreria` |
| `libreria-backend` | `SQL_ECHO` | `false` |

`backend/env.example` documenta los nombres y una URL de muestra. La clave real
vive en `/root/libreria-global.env` de la VPS (permisos `600`, dueño `root`).

## Migraciones

El `CMD` del backend aplica el esquema antes de arrancar:

```
alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Los logs del despliegue muestran `Running upgrade -> 0001_esquema_inicial`. Si
alguna vez se reutiliza una base creada sin Alembic, hay que adoptarla una vez
con `alembic stamp head` antes de arrancar la imagen nueva; si no, `upgrade head`
falla con «already exists» sin perder datos.

## Carga inicial de datos

Una sola vez, después del primer despliegue y desde el panel
(Shell del servicio `libreria-backend`):

```bash
python -m app.seed
```

Imprime los conteos por tabla. Es idempotente: no duplica ni pisa datos.

## Pasos de despliegue (reproducibles)

1. Push a `main` del repositorio.
2. Panel → proyecto `zoriontech-crm` → servicio `libreria-db` → **Deploy** (o
   dejarlo corriendo si ya está).
3. `libreria-backend`: Build Path `/backend`, builder **Dockerfile** ruta
   `Dockerfile`, variable `DATABASE_URL`. **Deploy** y revisar los logs hasta ver
   la migración y `Uvicorn running`.
4. Healthcheck interno:
   ```bash
   URL=http://127.0.0.1:8000/health/ready
   python -c "from urllib.request import urlopen; print(urlopen('$URL').status)"
   ```
   Debe imprimir `200`. Sin datos, ejecutar el seed.
5. `libreria-frontend`: Build Path `/frontend`, builder **Dockerfile** ruta
   `Dockerfile`, variable `API_UPSTREAM`. **Deploy**.
6. Dominio `libreria.zoriontech.me` apuntando al servicio frontend, protocolo
   interno HTTP, puerto 80, HTTPS activo. Traefik emite el certificado por
   Let's Encrypt.
7. Comprobar:
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://libreria.zoriontech.me/
   curl -sS https://libreria.zoriontech.me/api/health/ready
   ```
   `200` y `{"estado":"listo","base":"ok"}`.

## Actualización

1. Push a `main`.
2. **Deploy** del servicio que cambió (sólo el frontend si no hay cambios de API).
3. Si hubo cambios de esquema, `alembic upgrade head` corre solo al arrancar.
4. Repetir G-04 y comprobar que las ventas anteriores conservan sus importes.

Easypanel conserva el volumen de Postgres entre redespliegues: los datos siguen
disponibles, como se verificó en `evidencia/G-07-despliegue.txt`.

## Diagnóstico

| Síntoma | Qué revisar |
|---|---|
| Falla un `COPY` | El Build Path del servicio y que `public/` exista en `frontend/`. |
| `/api/` devuelve 502 | Logs del frontend, `API_UPSTREAM`, que el backend esté `1/1`. |
| `/api/health/ready` falla | Logs del backend, `DATABASE_URL`, que `libreria-db` esté corriendo y el estado de las migraciones. |
| Una ruta de la API devuelve 404 | El prefijo `/api` y la barra final de las rutas de colección (`/api/libros/`, `/api/ventas/`). |
| El certificado no se emite | Que el DNS del dominio apunte a la VPS y el dominio esté asociado al servicio frontend. |

## Evidencia

| Caso | Archivo |
|---|---|
| G-01 a G-06 (interfaz y API pública) | `evidencia/G-casos-publicos.txt` |
| G-07 (HTTPS, salud, migraciones, redespliegue) | `evidencia/G-07-despliegue.txt` |
| Imagen del frontend y migraciones en local | `evidencia/E4-imagen-frontend.txt`, `evidencia/E4-alembic.txt` |

Las capturas y salidas no incluyen contraseñas ni valores privados.
