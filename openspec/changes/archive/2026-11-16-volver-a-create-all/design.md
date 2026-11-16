# Design

## Decisión 1 · `create_all` en el `lifespan`

**Elegido**: `app/main.py` crea el esquema al arrancar, dentro del `lifespan`,
con `SQLModel.metadata.create_all` sobre el motor ya construido.

- `create_all` sólo crea las tablas que faltan y no altera las existentes: sobre
  la base actual del despliegue no hay cambios ni pérdida de datos.
- El arranque queda autocontenido: una base vacía queda lista sin pasos manuales.
- **Alternativa descartada**: dejar Alembic. Es la indicación del profesor en
  contrario y agrega una dependencia que la cátedra no quiere.

## Decisión 2 · `create_all` también en el seed

**Elegido**: `app/seed.py` vuelve a crear el esquema antes de insertar.

- La carga inicial documentada es `python -m app.seed`; si la API todavía no
  arrancó, sin esto el comando falla por tablas inexistentes.
- Es idempotente y no borra datos: `create_all` no toca lo que ya existe.

## Decisión 3 · Borrar `alembic_version` de la base desplegada

**Elegido**: eliminar la tabla `alembic_version` una vez redesplegado.

- No aporta información sin Alembic y confunde al revisar la base.
- Sólo contiene la marca `0001_esquema_inicial`; no hay datos de dominio.
- **Alternativa descartada**: dejarla. Es inofensiva en ejecución, pero deja
  rastros de una herramienta que la entrega ya no usa.

## Decisión 4 · Sin `alembic.ini` ni `migrations/`

**Elegido**: borrar ambos del repositorio y de la imagen.

- La consigna del Global pedía `alembic.ini` y `migrations/`, pero la indicación
  del profesor es posterior y prevalece.
- `env.example` sigue documentando `DATABASE_URL`, que ahora sólo usan la API y
  el seed.

## Decisión 5 · Qué pasa con la evidencia de la etapa anterior

**Elegido**: reemplazar `evidencia/E4-alembic.txt` por una evidencia de
`create_all`.

- Un archivo que documenta migraciones que ya no existen sería evidencia falsa.
- El resto de la evidencia (imagen, casos G) sigue vigente porque no depende de
  cómo se crea el esquema.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Una base con esquema viejo no se actualiza | Se documenta en `DEPLOY.md`: `create_all` no altera tablas existentes; un cambio de modelos exige recrear la base o aplicar `ALTER TABLE`. |
| El seed corre antes de que exista la base | `seed.py` crea el esquema, igual que el arranque. |
| El redespliegue rompe el servicio en marcha | Se verifica salud, catálogo y ventas después del deploy, y se conserva el volumen de Postgres. |
