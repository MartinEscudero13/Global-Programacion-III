# Spec Delta

## MODIFIED Requirements

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
