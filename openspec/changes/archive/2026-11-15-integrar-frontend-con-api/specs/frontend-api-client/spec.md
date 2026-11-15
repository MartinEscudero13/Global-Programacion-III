# Spec Delta

## Purpose

Capa HTTP única del frontend: resuelve las rutas del contrato bajo `/api`, normaliza respuestas y convierte los errores de FastAPI en mensajes en español que la interfaz puede mostrar sin conocer detalles del servidor.

## ADDED Requirements

### Requirement: Base única bajo el mismo origen

Toda petición del frontend SHALL dirigirse al mismo origen bajo la base `/api` y SHALL conservar la barra final de las rutas de colección. El cliente MUST NOT usar otro origen ni depender de CORS.

#### Scenario: Alta contra una ruta de colección

- **WHEN** la interfaz registra un libro
- **THEN** la petición es `POST /api/libros/` y no `POST /api/libros`

#### Scenario: Detalle de un recurso

- **WHEN** la interfaz abre el detalle de un libro con identificador 7
- **THEN** la petición es `GET /api/libros/7`

#### Scenario: Sin orígenes externos

- **WHEN** se recorre la pestaña Red con la aplicación en uso
- **THEN** todas las peticiones van al mismo origen que sirve la página y ninguna a un CDN, a otro dominio o a un puerto distinto

### Requirement: Parámetros de consulta del catálogo

Las consultas de libros SHALL enviar `titulo`, `genero_id`, `limit` y `offset` solo cuando correspondan, con los valores codificados para la URL. Un título vacío MUST NOT viajar como filtro.

#### Scenario: Búsqueda con acentos y espacios

- **WHEN** se busca `  jardín  `
- **THEN** la petición incluye `titulo=Jard%C3%ADn` con el texto recortado y sin distinguir mayúsculas en el resultado

#### Scenario: Filtro vacío

- **WHEN** se envía la búsqueda con el campo vacío
- **THEN** la petición no incluye el parámetro `titulo` y el catálogo muestra la primera página completa

#### Scenario: Consulta sin género

- **WHEN** una consulta de libros no indica género
- **THEN** la petición no incluye el parámetro `genero_id`

### Requirement: Valores de paginación dentro del contrato

El cliente SHALL solicitar 20 elementos por página y SHALL calcular el desplazamiento desde 0. MUST NOT enviar `limit` menor a 1 ni mayor a 100, ni `offset` negativo.

#### Scenario: Primera página

- **WHEN** se abre el catálogo sin filtros
- **THEN** la petición incluye `limit=20` y `offset=0`

#### Scenario: Página siguiente

- **WHEN** se avanza una página desde el desplazamiento 0
- **THEN** la petición incluye `limit=20` y `offset=20`

#### Scenario: Última página parcial

- **WHEN** la API devuelve menos elementos que el tamaño de página
- **THEN** el cliente considera que no hay página siguiente y no solicita un desplazamiento mayor

### Requirement: Importes conservados como string decimal

Los importes que devuelve la API SHALL conservarse tal como llegan, como string decimal, y SHALL formatearse solo al mostrarse. El cliente MUST NOT recalcular los importes de una venta ya registrada.

#### Scenario: Precio formateado para mostrar

- **WHEN** la API devuelve `"precio": "25000.00"`
- **THEN** la interfaz muestra `$ 25.000,00`

#### Scenario: Importe histórico sin recálculo

- **WHEN** se muestra el total de una venta registrada
- **THEN** el valor mostrado proviene del string devuelto por la API y no de una multiplicación local

### Requirement: Fecha de venta interpretada como UTC

La fecha de una venta SHALL interpretarse como UTC y SHALL mostrarse en la zona local del navegador, conservando el valor recibido para las comparaciones y el orden.

#### Scenario: Fecha con sufijo Z

- **WHEN** la API devuelve `"fecha": "2026-10-08T21:14:11.751581Z"`
- **THEN** la interfaz muestra la fecha y la hora locales correspondientes a ese instante

#### Scenario: Misma fecha tras recargar

- **WHEN** se recarga la página y se vuelve a abrir el detalle de la misma venta
- **THEN** la fecha mostrada es la misma que antes de la recarga

### Requirement: Errores del servidor como mensajes legibles

Ante 404 o 409 el cliente SHALL usar el string `detail` del servidor como mensaje visible. Ante 422 SHALL convertir la lista `detail` en un texto legible en español que nombre el campo y el motivo, sin mostrar JSON crudo ni `[object Object]`.

#### Scenario: Conflicto con mensaje propio

- **WHEN** el alta de un libro responde 409 con `detail` «El ISBN ya está registrado»
- **THEN** la interfaz muestra ese texto junto al formulario

#### Scenario: Contrato inválido con lista de detalles

- **WHEN** la venta responde 422 con una lista de errores de validación
- **THEN** la interfaz muestra un texto en español con los campos inválidos y no muestra el arreglo JSON ni `[object Object]`

#### Scenario: Recurso inexistente

- **WHEN** se consulta un cliente con un identificador que no existe y la API responde 404
- **THEN** la interfaz muestra el mensaje del servidor y no un error genérico de programa

### Requirement: Fallo de conexión diferenciado

Si no hay respuesta, la respuesta no es JSON o se agota el tiempo de espera, el cliente SHALL informar un error de conexión distinguible de una lista vacía y SHALL permitir reintentar la misma consulta.

#### Scenario: Backend detenido

- **WHEN** se abre la aplicación con el backend apagado
- **THEN** el catálogo muestra un mensaje de error de conexión con la opción de reintentar, y no el mensaje de catálogo vacío

#### Scenario: Tiempo de espera agotado

- **WHEN** la API no responde dentro del tiempo máximo configurado
- **THEN** la interfaz informa que la operación tardó demasiado y habilita el reintento

#### Scenario: Reintento exitoso

- **WHEN** se reintenta la consulta con el backend disponible
- **THEN** la misma consulta se repite y la vista muestra los datos

### Requirement: Colecciones de apoyo completas y acotadas

Las editoriales y los géneros SHALL leerse recorriendo páginas de 100 hasta recibir una página incompleta. El recorrido MUST NOT superar una guarda de páginas ni entrar en un bucle infinito cuando la API siempre devuelve páginas completas.

#### Scenario: Colección con más de una página

- **WHEN** hay 150 editoriales y se cargan las opciones del alta
- **THEN** el cliente hace dos pedidos de 100 y 50 elementos y ofrece las 150 opciones

#### Scenario: Guarda alcanzada

- **WHEN** la API devuelve siempre páginas completas de 100 elementos
- **THEN** el recorrido se detiene en la guarda, la interfaz avisa que la lista quedó incompleta y no repite pedidos indefinidamente

### Requirement: La API como única fuente de verdad

La API SHALL ser la única fuente de libros, clientes, ventas, editoriales, géneros y autores. El frontend MUST NOT inicializar, respaldar ni recuperar esos datos desde `localStorage` ni desde arreglos locales de ejemplo.

#### Scenario: Almacenamiento local con datos viejos

- **WHEN** el navegador conserva las claves `libreria.v1.libros`, `libreria.v1.clientes` o `libreria.v1.ventas` de la etapa anterior y se abre la aplicación
- **THEN** las vistas muestran los datos de la API y esos valores locales no alteran el catálogo, el historial ni las altas

#### Scenario: Sin escrituras en el navegador

- **WHEN** se registran altas y ventas
- **THEN** la aplicación no escribe ninguna clave en `localStorage`

### Requirement: Documentación de la integración

`frontend/README.md` SHALL describir la base `/api`, el orden de los ocho scripts, la selección de clientes y autores por identificador, la ausencia de `localStorage` y el comando de pruebas del arnés.

#### Scenario: README sin afirmaciones obsoletas

- **WHEN** se busca en `frontend/README.md` la persistencia en `localStorage`, los nueve scripts o los archivos `data.js` y `store.js`
- **THEN** no queda ninguna afirmación vigente que los presente como parte de la aplicación

#### Scenario: Opción de selección documentada

- **WHEN** se lee la sección de altas y ventas del README
- **THEN** indica que clientes y autores se eligen verificando su identificador con la consulta individual porque la API no expone listados de esos recursos
