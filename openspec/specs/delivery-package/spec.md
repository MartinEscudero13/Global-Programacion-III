# delivery-package Specification

## Purpose
Define qué contiene el paquete de entrega del Global producido con `git archive`: los dos componentes del monorepo y la documentación de la entrega, sin tooling de agentes, sin documentación interna y sin secretos.

## Requirements

### Requirement: Paquete con la estructura pedida por la cátedra

El paquete SHALL contener `frontend/` y `backend/` directamente en la raíz del archivo, sin un directorio extra, y MUST NOT excluir `README.md`, `DEPLOY.md` ni `evidencia/` de la raíz. La estructura interna de cada componente SHALL conservarse.

#### Scenario: Componentes en la raíz del paquete

- **WHEN** se lista el contenido del ZIP generado con `git archive`
- **THEN** aparecen las entradas de `frontend/` y `backend/` directamente en la raíz del archivo

#### Scenario: Frontend entregable completo

- **WHEN** se recorren las entradas de `frontend/` en el paquete
- **THEN** incluye `public/index.html`, `public/css/`, `public/js/`, `Dockerfile`, `.dockerignore`, `default.conf.template` y `README.md`

#### Scenario: Backend entregable completo

- **WHEN** se recorren las entradas de `backend/` en el paquete
- **THEN** incluye `app/`, `alembic.ini`, `migrations/`, `requirements.txt`, `requirements-dev.txt`, `pyproject.toml`, `env.example`, `Dockerfile`, `.dockerignore`, `.gitignore`, `README.md` y `test/`

### Requirement: Tooling fuera del paquete

El `.gitattributes` de la raíz SHALL marcar con `export-ignore` todo el tooling de agentes, de gestión y de pruebas: `openspec/`, `docs/`, `knowledge-base/`, `design-system/`, `.opencode/`, `.atl/`, `AGENTS.md`, `CHANGES.md`, `.active-orchestrator-state.json`, `.gitattributes`, `frontend/test/` y sus equivalentes dentro de `backend/`. Esos elementos MUST NOT aparecer en el paquete.

#### Scenario: Tooling de la raíz excluido

- **WHEN** se buscan `openspec/`, `docs/consigna-global.md`, `knowledge-base/`, `design-system/`, `.opencode/` o `AGENTS.md` dentro del paquete
- **THEN** no aparece ninguno

#### Scenario: Tooling del frontend excluido

- **WHEN** se busca `frontend/test/` dentro del paquete
- **THEN** no aparece el arnés de pruebas del frontend y sí aparecen `frontend/public/js/api.js` y el resto de los archivos entregables

#### Scenario: Tooling del backend excluido

- **WHEN** se buscan `backend/openspec/`, `backend/knowledge-base/`, `backend/design-system/`, `backend/docs/`, `backend/.opencode/`, `backend/AGENTS.md` o `backend/CLAUDE.md` dentro del paquete
- **THEN** no aparece ninguno

#### Scenario: Artefactos de la etapa anterior excluidos

- **WHEN** se buscan `backend/evidencia/`, `backend/scripts/` o `backend/DEPLOY.md` dentro del paquete
- **THEN** no aparece ninguno, porque corresponden al despliegue del parcial y la entrega del Global documenta el suyo en la raíz

#### Scenario: Rutas de entrega no excluidas

- **WHEN** se consulta `git check-attr export-ignore` sobre `frontend/`, `backend/`, `README.md`, `DEPLOY.md` y `evidencia/`
- **THEN** ninguna de esas rutas figura con el atributo en `set`

### Requirement: Paquete sin secretos ni dependencias instaladas

El paquete MUST NOT contener `.env`, archivos de variables reales, `.venv`, `__pycache__`, `.pytest_cache`, `node_modules` ni archivos `.zip`. La revisión SHALL hacerse sobre el contenido del archivo generado, no sobre el árbol de trabajo.

#### Scenario: Archivos de entorno ausentes

- **WHEN** se buscan archivos `.env` o `.env.*` distintos de `env.example` dentro del paquete
- **THEN** no hay ninguno

#### Scenario: Entornos virtuales y cachés ausentes

- **WHEN** se busca `.venv/`, `__pycache__/`, `.pytest_cache/` o `node_modules/` dentro del paquete
- **THEN** no aparece ninguno

#### Scenario: Valores privados ausentes

- **WHEN** se buscan contraseñas, tokens o cadenas de conexión con usuario y host reales en los archivos del paquete
- **THEN** `env.example` sólo muestra marcadores y no hay credenciales en ningún archivo

### Requirement: Paquete reproducible desde el commit

El paquete SHALL generarse con `git archive --format=zip -o <archivo>.zip HEAD` desde un clon del repositorio, sin depender de archivos ignorados ni de pasos manuales sobre el árbol de trabajo.

#### Scenario: Generación desde un clon limpio

- **WHEN** se clona el repositorio en un directorio sin archivos ignorados y se ejecuta `git archive --format=zip -o entrega.zip HEAD`
- **THEN** el comando termina con código 0 y el archivo contiene el mismo conjunto de rutas versionadas

#### Scenario: Contenido independiente del estado local

- **WHEN** el árbol de trabajo tiene un archivo sin versionar o ignorado
- **THEN** ese archivo no aparece en el paquete

### Requirement: Suite ejecutable en el paquete descomprimido

La suite del backend incluida en el paquete SHALL ejecutarse sin fallos desde el directorio descomprimido, sin depender de archivos que quedaron fuera. Los tests que verifican artefactos excluidos MUST NOT viajar en el paquete.

#### Scenario: Suite sin fallos fuera del repositorio

- **WHEN** se descomprime el paquete y se ejecuta `pytest -q` en `backend/` con las dependencias instaladas
- **THEN** la suite termina con 0 fallos y los casos que requieren PostgreSQL se saltan cuando no hay `DATABASE_URL`

#### Scenario: Tests de artefactos excluidos

- **WHEN** se buscan `test_artefactos_despliegue.py`, `test_artefactos_http.py` o `test_artefactos_imagen.py` dentro de `backend/test/` en el paquete
- **THEN** no aparece ninguno y el resto de los módulos de `test/` sí está presente
