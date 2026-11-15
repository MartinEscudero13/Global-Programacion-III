# frontend-altas Specification

## Purpose
Altas de libros y clientes contra la API: formulario de libro con stock, editorial, género opcional y autorías verificadas por identificador, alta de cliente con email único del servidor y consulta individual de clientes para mostrarlos y usarlos en una venta.

## Requirements

### Requirement: Alta de libro con el cuerpo del contrato

El alta de libro SHALL enviar `POST /libros/` con ISBN, título, precio positivo, stock entero desde cero, editorial, género opcional y al menos una autoría, y cada autoría SHALL llevar `autor_id`, un rol entre `autor`, `coautor`, `traductor` e `ilustrador`, y un orden entero desde 1.

#### Scenario: Alta válida

- **WHEN** se completa el formulario con un ISBN nuevo, precio mayor que cero, stock 3, editorial, género y una autoría con rol y orden
- **THEN** la petición usa `POST /api/libros/` con esos campos y la respuesta 201 se muestra como alta exitosa

#### Scenario: Género opcional

- **WHEN** se registra un libro sin elegir género
- **THEN** el cuerpo no envía `genero_id` y el alta se completa con el género nulo

#### Scenario: Varias autorías con orden

- **WHEN** se registra un libro con tres autorías de roles distintos
- **THEN** el cuerpo envía las tres con su `autor_id`, su `rol` y un `orden` correlativo desde 1

### Requirement: Validación local antes de enviar

El formulario SHALL validar los campos obligatorios, el precio numérico mayor que cero, el stock entero mayor o igual a cero, la editorial y al menos una autoría. Con errores MUST NOT enviar ninguna petición y SHALL marcar cada campo con su mensaje.

#### Scenario: Campos vacíos

- **WHEN** se envía el formulario sin título, sin ISBN, sin editorial y sin autorías
- **THEN** cada campo muestra su mensaje y no sale ninguna petición de alta

#### Scenario: Stock inválido

- **WHEN** se envía el alta con stock negativo o con decimales
- **THEN** el campo de stock muestra el error y no sale ninguna petición

#### Scenario: Precio inválido

- **WHEN** se envía el alta con precio vacío, cero o negativo
- **THEN** el campo de precio muestra el error y no sale ninguna petición

### Requirement: Editoriales y géneros desde la API

Las opciones de editorial y género SHALL cargarse desde `GET /editoriales/` y `GET /generos/`, recorriendo sus páginas. Si la carga falla, el formulario SHALL informar el error con reintento y MUST NOT mostrar selectores vacíos como si no hubiera opciones.

#### Scenario: Opciones disponibles

- **WHEN** el alta se abre con editoriales y géneros registrados en la API
- **THEN** los selectores ofrecen esas opciones y el género incluye la opción «Sin clasificar»

#### Scenario: Fallo al cargar las opciones

- **WHEN** la consulta de editoriales falla por conexión
- **THEN** el formulario muestra el error con reintento y no permite registrar un libro hasta resolverlo

#### Scenario: Reintento de las opciones

- **WHEN** se reintenta la carga de opciones con la API disponible
- **THEN** los selectores se completan y el formulario queda utilizable

### Requirement: Autorías verificadas por identificador

Como la API no expone el listado de autores, el formulario SHALL pedir un identificador y consultar `GET /autores/{id}`. El autor SHALL mostrarse con el nombre devuelto y solo entonces podrá agregarse a la autoría; un identificador inexistente MUST NOT agregarse.

#### Scenario: Autor encontrado

- **WHEN** se ingresa el identificador 4 y la API devuelve el autor «Lucía Ferrer»
- **THEN** el formulario muestra ese nombre y habilita agregarlo con un rol

#### Scenario: Autor inexistente

- **WHEN** se consulta un identificador que la API responde con 404
- **THEN** el formulario muestra el mensaje del servidor y no agrega la autoría

#### Scenario: Autor repetido

- **WHEN** se intenta agregar dos veces el mismo `autor_id`
- **THEN** la segunda vez se informa que el autor ya está en la lista y no se duplica

#### Scenario: Quitar una autoría

- **WHEN** se quita una autoría agregada
- **THEN** desaparece de la lista y no se envía en el cuerpo del alta

### Requirement: Respuesta del alta de libro

Con 201 la interfaz SHALL confirmar el alta con los datos devueltos, SHALL limpiar el formulario y SHALL actualizar el listado de libros y el catálogo. El identificador del libro lo asigna el servidor y MUST NOT generarse en el navegador.

#### Scenario: Confirmación del servidor

- **WHEN** la API responde 201 con el libro creado
- **THEN** la interfaz informa el alta con el título y el identificador devueltos y el formulario queda limpio

#### Scenario: Vistas actualizadas

- **WHEN** termina un alta exitosa
- **THEN** el libro aparece en la tabla de libros y en el catálogo sin recargar la página

### Requirement: Errores del alta de libro

Ante un 409 el formulario SHALL mostrar el mensaje del servidor junto al formulario y SHALL conservar los valores cargados. Ante un 422 SHALL mostrar el detalle legible de los campos inválidos.

#### Scenario: ISBN repetido

- **WHEN** el alta responde 409 porque el ISBN ya existe
- **THEN** el formulario muestra el mensaje del servidor, conserva los campos y no informa un alta exitosa

#### Scenario: Editorial o autor inexistente

- **WHEN** el alta responde 409 porque la editorial o un autor dejó de existir
- **THEN** el formulario muestra ese mensaje y conserva los datos para corregirlos

#### Scenario: Contrato rechazado

- **WHEN** el alta responde 422 con errores de validación
- **THEN** el formulario muestra los campos inválidos en español y no un arreglo JSON

### Requirement: Alta de cliente

El alta de cliente SHALL enviar `POST /clientes/` con nombre y email, SHALL validar el formato del email en el navegador y SHALL mostrar como éxito el cliente devuelto por el servidor. La unicidad del email la decide el servidor.

#### Scenario: Cliente registrado

- **WHEN** se envía un nombre y un email válido que no está registrado
- **THEN** la API responde 201 y la interfaz muestra el cliente devuelto con su identificador

#### Scenario: Email repetido

- **WHEN** el alta responde 409 porque el email ya está registrado
- **THEN** la interfaz muestra el mensaje del servidor, conserva los campos y no informa un alta exitosa

#### Scenario: Email con formato inválido

- **WHEN** se envía un email sin arroba o sin dominio
- **THEN** el campo muestra el error y no sale ninguna petición

### Requirement: Consulta de cliente por identificador

Como la API no expone el listado de clientes, la vista SHALL permitir consultar un cliente por identificador con `GET /clientes/{id}` y SHALL mostrar su nombre y email. Los clientes conocidos SHALL listarse solo en la sesión actual tras un alta o una consulta.

#### Scenario: Cliente encontrado

- **WHEN** se consulta el identificador 2 y la API devuelve «Jorge Ramírez»
- **THEN** la vista muestra el nombre y el email y agrega el cliente a la lista de la sesión

#### Scenario: Cliente inexistente

- **WHEN** se consulta un identificador que la API responde con 404
- **THEN** la vista muestra el mensaje del servidor y no agrega ninguna fila

#### Scenario: Lista de la sesión sin datos locales

- **WHEN** se abre la vista de clientes en una sesión nueva
- **THEN** la lista aparece vacía y no se cargan los tres clientes de ejemplo de la etapa anterior

### Requirement: Cliente verificado para la venta

La venta SHALL seleccionar el cliente por identificador verificado: el nombre devuelto por `GET /clientes/{id}` SHALL mostrarse antes de permitir confirmar la venta.

#### Scenario: Cliente listo para vender

- **WHEN** la consulta del cliente devuelve su nombre
- **THEN** la venta muestra ese nombre y permite confirmar con ese identificador

#### Scenario: Venta sin cliente verificado

- **WHEN** se intenta confirmar una venta con un identificador escrito pero sin consulta exitosa
- **THEN** la interfaz pide verificar el cliente y no envía la venta
