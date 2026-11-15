FROM python:3.12-alpine

WORKDIR /app

# Dependencias primero: si requirements.txt no cambia, la capa sale de caché
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código después del pip install
COPY app ./app

# Migraciones: la imagen aplica el esquema antes de arrancar Uvicorn
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations

# Usuario sin privilegios (uid 1000), sin home
RUN adduser -D -H -u 1000 appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/health/ready || exit 1

# `exec` deja a Uvicorn como PID 1 para que reciba SIGTERM en `docker stop`.
# Si la migración falla, el `&&` corta la cadena y el contenedor no sirve.
CMD alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000
