# Proposal

## Why

Las pantallas del primer parcial simulan altas y ventas en el navegador: no existe ninguna petición HTTP y los datos viven en `localStorage`. El Global exige reutilizar esas pantallas conectándolas a la API de la librería (Ejercicios 1, 2 y 3, 65 puntos) para que los libros, clientes y ventas confirmadas provengan de FastAPI y queden en PostgreSQL.

## What Changes

- Nueva capa HTTP única en `frontend/public/js/api.js` sobre la base `/api`, con `fetch`, parseo de JSON, conservación de la barra final de las rutas de colección, timeout y normalización de errores 409/404/422 y de fallos de conexión.
- Se retiran del flujo `js/data.js` y `js/store.js`: la API es la fuente de verdad de libros, clientes, ventas, editoriales, géneros y autores. Desaparece `localStorage` y desaparece `Libreria.datos`.
- Se retiran del cliente la generación de ids `lN`/`cN`/`V-000N` y las validaciones de unicidad de ISBN y email: las asigna y valida el servidor.
- Catálogo: listado desde `GET /libros/` con búsqueda por `titulo`, paginación por `limit`/`offset` con reinicio del desplazamiento al cambiar el filtro y detalle de autores desde `GET /libros/{id}`.
- Altas: libro con stock, editoriales y géneros cargados desde la API, y autorías por `autor_id` verificado individualmente con rol y orden; cliente con `POST /clientes/` y consulta por ID.
- Ventas: borrador en memoria, confirmación con el cuerpo exacto `{cliente_id, renglones}`, importes tomados de la respuesta 201, botón deshabilitado durante el envío y borrador conservado ante 409/422.
- Historial paginado con `GET /ventas/` y detalle por `GET /ventas/{id}`, sin releer precios del catálogo.
- Estados de interfaz nuevos: carga, error de conexión con reintento y controles deshabilitados, reutilizando las clases `.mensaje--*` y `.boton:disabled` existentes.
- **BREAKING**: la aplicación deja de funcionar sin backend y deja de conservar datos en el navegador; `frontend/README.md` y las specs que describen el comportamiento local se actualizan.
- Nuevo arnés de pruebas del frontend con el runner integrado de Node (`node --test`), sin dependencias, excluido del paquete de entrega.

## Capabilities

### New Capabilities

- `frontend-api-client`: base `/api`, rutas y paginación del contrato, parseo de importes y fechas, mensajes de error del servidor y de conexión, y lecturas completas de colecciones de apoyo.
- `frontend-catalogo`: catálogo consultado a la API con búsqueda, paginación, detalle de autores y estados de carga, vacío, sin coincidencias y error con reintento.
- `frontend-altas`: alta de libros con autorías verificadas por ID y alta y consulta individual de clientes, con las opciones de editorial y género traídas de la API.
- `frontend-ventas`: composición del borrador de venta, envío y confirmación con importes del servidor, rechazo que conserva el borrador, historial paginado y detalle consultado a la API.

### Modified Capabilities

- `frontend-hosting`: el orden y la cantidad de scripts cambian (ocho, con la capa de API primero) y se elimina el requisito de funcionar sin la API.
- `delivery-package`: el arnés de pruebas del frontend se suma al tooling marcado con `export-ignore`.

## Impact

- Código: `frontend/public/index.html`, `frontend/public/js/*.js` (ocho archivos, con `api.js` nuevo y `data.js`/`store.js` eliminados), `frontend/public/css/components.css` (sólo clases de paginación y autorías) y `frontend/README.md`.
- Pruebas: `frontend/test/` nuevo (arnés y casos con `node --test`), excluido del paquete con `.gitattributes`.
- Sin cambios en el backend ni en su contrato. No se agregan dependencias, CDNs ni orígenes externos.
- Fuera de alcance: Easypanel, dominio, despliegue, G-07, la ejecución formal de G-01 a G-06 (queda para el change de entrega) y el ZIP.
