## ADDED Requirements

### Requirement: Esquema creado al arrancar la API
La API SHALL crear las tablas del dominio con `SQLModel.metadata.create_all` al
iniciar, sin herramientas de migración.

#### Scenario: Base vacía
- **WHEN** la API arranca contra una base PostgreSQL sin tablas
- **THEN** el esquema queda creado antes de atender el primer pedido y
  `/health/ready` responde 200

#### Scenario: Base ya poblada
- **WHEN** la API arranca contra una base que ya tiene las tablas
- **THEN** `create_all` no altera ni borra ninguna tabla y los datos se
  conservan

#### Scenario: Tablas ajenas al modelo
- **WHEN** la base contiene tablas que no pertenecen al modelo
- **THEN** la API arranca igual y no las modifica

### Requirement: Carga inicial autocontenida
El comando de carga inicial SHALL poder ejecutarse sobre una base sin esquema.

#### Scenario: Seed sobre base vacía
- **WHEN** se ejecuta `python -m app.seed` sobre una base sin tablas
- **THEN** el esquema se crea y los datos ficticios quedan insertados

#### Scenario: Seed repetido
- **WHEN** el seed se ejecuta dos veces
- **THEN** no duplica registros ni falla

### Requirement: Imagen sin herramientas de migración
La imagen del backend SHALL arrancar Uvicorn directamente, sin dependencias de
migración y sin archivos de migración.

#### Scenario: Arranque del contenedor
- **WHEN** el contenedor inicia
- **THEN** ejecuta `uvicorn app.main:app --host 0.0.0.0 --port 8000` y no
  invoca ningún comando de migración

#### Scenario: Contenido de la imagen
- **WHEN** se inspecciona la imagen
- **THEN** no contiene `alembic.ini`, ni `migrations/`, ni el paquete `alembic`

### Requirement: Documentación coherente con el esquema
La documentación SHALL describir el esquema como creado al arrancar y declarar la
limitación de `create_all`.

#### Scenario: Sin referencias a migraciones
- **WHEN** se revisan `README.md`, `DEPLOY.md` y la documentación del backend
- **THEN** no presentan Alembic como parte del flujo de despliegue

#### Scenario: Limitación declarada
- **WHEN** se lee la sección de esquema
- **THEN** se explica que `create_all` no altera tablas existentes y qué hacer
  ante un cambio de modelos
