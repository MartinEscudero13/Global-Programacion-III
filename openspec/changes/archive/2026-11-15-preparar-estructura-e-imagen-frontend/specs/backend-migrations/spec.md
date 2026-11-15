# Spec Delta

## Purpose

Define cómo el esquema de PostgreSQL del backend se versiona con Alembic sobre la misma `DATABASE_URL` de la aplicación, cómo lo aplica la imagen al arrancar y cómo se adopta una base creada antes de existir las migraciones sin perder datos.

## ADDED Requirements

### Requirement: Esquema versionado en el repositorio

`backend/` SHALL contener `alembic.ini` y un directorio `migrations/` con `env.py`, `script.py.mako` y al menos una revisión cuya `down_revision` sea nula. La revisión inicial SHALL reflejar las nueve tablas del dominio actual: `autor`, `cliente`, `perfil_cliente`, `editorial`, `genero`, `libro`, `libro_autor`, `venta` y `renglon_venta`.

#### Scenario: Archivos de migración presentes

- **WHEN** se listan `backend/alembic.ini` y `backend/migrations/`
- **THEN** existen el archivo de configuración, `env.py`, `script.py.mako` y una revisión inicial en `migrations/versions/`

#### Scenario: Base limpia queda con las nueve tablas

- **WHEN** se ejecuta `alembic upgrade head` contra una base PostgreSQL vacía
- **THEN** la base contiene exactamente las nueve tablas del dominio y la tabla `alembic_version` con la revisión inicial

#### Scenario: La migración cubre el modelo

- **WHEN** se ejecuta `alembic check` después de `alembic upgrade head`
- **THEN** responde que no hay operaciones de migración pendientes

### Requirement: Migración como única fuente del esquema

El arranque de la aplicación SHALL NOT crear ni alterar tablas: la creación y el cambio del esquema pasan exclusivamente por Alembic. La API MUST NOT ejecutar `SQLModel.metadata.create_all` ni ningún otro DDL en su ciclo de vida.

#### Scenario: Arranque sobre una base sin migrar

- **WHEN** se inicia la API contra una base vacía sin ejecutar `alembic upgrade head`
- **THEN** el arranque no crea ninguna tabla del dominio

#### Scenario: Carga de datos iniciales sin crear esquema

- **WHEN** se ejecuta el comando de datos iniciales sobre una base sin migrar
- **THEN** el comando falla con un error de base de datos y no crea tablas por su cuenta

### Requirement: Configuración por la misma variable de entorno

`migrations/env.py` SHALL leer `DATABASE_URL` del entorno y usarla con el driver `postgresql+asyncpg`. El archivo `alembic.ini` MUST NOT contener una URL de conexión, usuario ni contraseña.

#### Scenario: Migración con la variable definida

- **WHEN** se ejecuta `alembic upgrade head` con `DATABASE_URL` válida en el entorno
- **THEN** la migración se aplica sin que la URL esté escrita en ningún archivo versionado

#### Scenario: Migración sin la variable

- **WHEN** se ejecuta `alembic upgrade head` sin `DATABASE_URL`
- **THEN** el comando aborta con un mensaje que nombra la variable faltante y no imprime credenciales

#### Scenario: Variable con otro driver

- **WHEN** `DATABASE_URL` no empieza con `postgresql+asyncpg://`
- **THEN** el comando aborta con un mensaje que indica el driver esperado

### Requirement: Revisión inicial reversible

La revisión inicial SHALL declarar un `downgrade` que elimine en orden inverso lo que creó su `upgrade`, de modo que una base limpia pueda volver al estado vacío sin intervención manual.

#### Scenario: Bajada a la base en una base de prueba

- **WHEN** se ejecuta `alembic upgrade head` y luego `alembic downgrade base` sobre una base de prueba
- **THEN** no queda ninguna tabla del dominio y la base puede migrarse de nuevo desde cero

### Requirement: Migraciones aplicadas al arrancar la imagen

La imagen del backend SHALL aplicar `alembic upgrade head` antes de iniciar Uvicorn, con un `CMD` que encadene ambos pasos y ceda el proceso al servidor. El contenedor MUST NOT quedar sirviendo si la migración falla.

#### Scenario: Primer arranque sobre base limpia

- **WHEN** se ejecuta el contenedor con una `DATABASE_URL` válida y una base vacía
- **THEN** `docker logs` muestra la migración aplicada y la API responde en `/health/ready`

#### Scenario: Arranque sobre base ya migrada

- **WHEN** se vuelve a iniciar el contenedor sobre la misma base
- **THEN** la migración no aplica cambios, la API arranca y los datos existentes se conservan

#### Scenario: Migración fallida

- **WHEN** la base es inalcanzable o la migración falla
- **THEN** Uvicorn no arranca, el contenedor no queda healthy y la causa aparece en `docker logs`

### Requirement: Adopción de una base creada sin Alembic

Una base cuyo esquema ya coincide con la revisión inicial pero no tiene `alembic_version` SHALL poder adoptarse con `alembic stamp head` antes del primer arranque de la imagen nueva. El procedimiento MUST NOT borrar ni recrear datos.

#### Scenario: Base existente adoptada

- **WHEN** se ejecuta `alembic stamp head` sobre una base con las nueve tablas y sin tabla de versiones
- **THEN** `alembic current` informa la revisión inicial y `alembic upgrade head` no aplica ninguna operación

#### Scenario: Datos conservados tras la adopción

- **WHEN** la base adoptada tiene libros, clientes y ventas cargados
- **THEN** el conteo de filas de esas tablas es el mismo antes y después del `stamp` y del arranque del contenedor

#### Scenario: Intento de migrar sin adoptar

- **WHEN** se ejecuta `alembic upgrade head` sobre esa base sin haber hecho `stamp head`
- **THEN** la migración falla porque las tablas ya existen y no se pierde ningún dato

### Requirement: Dependencia declarada y reproducible

`requirements.txt` SHALL declarar Alembic con una versión fija, instalable junto a las dependencias actuales del backend. La imagen SHALL incluir `alembic.ini` y `migrations/` para poder ejecutar la migración dentro del contenedor.

#### Scenario: Instalación desde requirements

- **WHEN** se instala `requirements.txt` en un entorno limpio
- **THEN** el comando `alembic` queda disponible y su versión coincide con la declarada

#### Scenario: Migraciones dentro de la imagen

- **WHEN** se ejecuta `docker run --rm <imagen> alembic current` con `DATABASE_URL` válida
- **THEN** el comando encuentra `alembic.ini`, resuelve `migrations/` y responde con la revisión actual

### Requirement: Documentación coherente con las migraciones

La documentación del backend SHALL dejar de afirmar que el esquema se crea con `create_all` y SHALL describir el orden `alembic upgrade head` y luego el arranque, además del `stamp head` para bases existentes. Las instrucciones para agentes MUST NOT prohibir Alembic.

#### Scenario: Documentación sin afirmaciones obsoletas

- **WHEN** se busca `create_all` como mecanismo de creación del esquema en `README.md`, `DEPLOY.md` y las instrucciones para agentes del backend
- **THEN** no queda ninguna afirmación vigente que lo presente como fuente del esquema

#### Scenario: Orden documentado

- **WHEN** se lee la sección de ejecución local del README del backend
- **THEN** indica aplicar las migraciones antes de iniciar Uvicorn y antes de cargar los datos iniciales
