## REMOVED Requirements

### Requirement: Esquema versionado en el repositorio
**Reason**: La indicación del profesor es crear el esquema con `create_all`; el
repositorio ya no contiene `alembic.ini` ni `migrations/`.

### Requirement: Migración como única fuente del esquema
**Reason**: La fuente del esquema vuelve a ser `SQLModel.metadata.create_all` en
el `lifespan` y en el seed.

### Requirement: Configuración por la misma variable de entorno
**Reason**: Sin Alembic no hay un segundo consumidor de `DATABASE_URL` en el
arranque; la variable sigue documentada para la API y el seed.

### Requirement: Revisión inicial reversible
**Reason**: No hay revisiones que aplicar ni revertir.

### Requirement: Migraciones aplicadas al arrancar la imagen
**Reason**: El contenedor arranca Uvicorn directamente y el esquema se crea en
el `lifespan`.

### Requirement: Adopción de una base creada sin Alembic
**Reason**: Sin migraciones no existe el problema de adoptar una base con
`stamp head`.

### Requirement: Dependencia declarada y reproducible
**Reason**: `alembic` se quitó de `requirements.txt` y de la imagen.

### Requirement: Documentación coherente con las migraciones
**Reason**: Reemplazada por el requisito de documentación de
`backend-schema`, que describe `create_all` y su limitación.
