# Spec Delta

## Purpose

Composición y registro de ventas contra la API: borrador en memoria con renglones editables, envío del cuerpo exacto del contrato, confirmación con los importes devueltos por el servidor, rechazo que conserva el borrador, historial paginado y detalle consultado por identificador.

## ADDED Requirements

### Requirement: Borrador de venta en memoria

La venta SHALL armarse con libros del catálogo en forma de renglones con cantidad entera positiva, SHALL permitir cambiar la cantidad y quitar renglones, y MUST NOT aceptar dos renglones con el mismo libro. El borrador SHALL vivir solo en memoria.

#### Scenario: Agregar un renglón

- **WHEN** se elige un libro del catálogo y la cantidad 2
- **THEN** la venta muestra un renglón con ese libro y cantidad 2

#### Scenario: Libro repetido

- **WHEN** se agrega un libro que ya está en el borrador
- **THEN** la venta informa que el libro ya está cargado y no crea un segundo renglón

#### Scenario: Cantidad inválida

- **WHEN** se ingresa cantidad cero, negativa o con decimales
- **THEN** la venta muestra el error y no agrega ni modifica el renglón

#### Scenario: Quitar un renglón

- **WHEN** se quita un renglón del borrador
- **THEN** el renglón desaparece y el resumen se recalcula

#### Scenario: Borrador no persistido

- **WHEN** se cargan renglones y se recarga la página
- **THEN** el borrador queda vacío y no se recupera de `localStorage`

### Requirement: Resumen previo estimado

Mientras la venta no se confirma, el resumen SHALL mostrar la cantidad de artículos y un total estimado a partir de los precios del catálogo, identificado como estimación. Ese total MUST NOT presentarse como el importe registrado.

#### Scenario: Estimación con dos renglones

- **WHEN** el borrador tiene 2 unidades de un libro de `$ 1.500,00` y 1 unidad de uno de `$ 2.000,00`
- **THEN** el resumen muestra 3 artículos y `$ 5.000,00` como estimación antes de confirmar

#### Scenario: Cambio de cantidad

- **WHEN** se cambia la cantidad de un renglón
- **THEN** el resumen actualiza los artículos y la estimación sin enviar ninguna petición

### Requirement: Confirmación con el cuerpo exacto

La confirmación SHALL exigir un cliente verificado, al menos un renglón y cantidades enteras positivas, y SHALL enviar `POST /ventas/` con `cliente_id` y `renglones` de `libro_id` y `cantidad` únicamente. MUST NOT enviar precios, subtotales, total ni fecha.

#### Scenario: Cuerpo de la venta

- **WHEN** se confirma una venta del cliente 2 con dos renglones
- **THEN** el cuerpo es `{"cliente_id": 2, "renglones": [{"libro_id": 1, "cantidad": 2}, {"libro_id": 4, "cantidad": 1}]}` sin otros campos

#### Scenario: Venta sin renglones

- **WHEN** se confirma sin renglones cargados
- **THEN** la venta muestra el error y no envía ninguna petición

#### Scenario: Venta sin cliente verificado

- **WHEN** se confirma sin haber verificado el cliente por identificador
- **THEN** la venta muestra el error y no envía ninguna petición

#### Scenario: Cantidad editada inválida

- **WHEN** se edita una cantidad a un valor no entero o menor que 1 y se confirma
- **THEN** la venta muestra el error, restaura el último valor válido y no envía la petición

### Requirement: Envío en curso deshabilitado

Mientras la petición de la venta está en curso, el botón de confirmación SHALL quedar deshabilitado y la venta SHALL indicar que está procesando. El botón SHALL volver a habilitarse cuando la petición termina, con éxito o con error.

#### Scenario: Botón deshabilitado durante el envío

- **WHEN** se confirma la venta y la API todavía no respondió
- **THEN** el botón de confirmación está deshabilitado y no se puede enviar dos veces la misma venta

#### Scenario: Botón habilitado tras el rechazo

- **WHEN** la API rechaza la venta con 409 o 422
- **THEN** el botón vuelve a estar habilitado y la venta puede corregirse y reenviarse

### Requirement: Confirmación con importes del servidor

Con 201 la interfaz SHALL mostrar el identificador, la fecha, el cliente, los renglones con precio unitario y subtotal, y el total devueltos por la API. SHALL limpiar el formulario y el borrador, y SHALL actualizar el historial.

#### Scenario: Importes tomados de la respuesta

- **WHEN** la API responde 201 con precios unitarios, subtotales y total
- **THEN** la confirmación muestra esos valores y no los calculados en el navegador

#### Scenario: Limpieza posterior

- **WHEN** la venta se confirma con éxito
- **THEN** el borrador queda vacío, el cliente verificado se limpia y el historial refleja la venta nueva

#### Scenario: Fecha de la respuesta

- **WHEN** la API devuelve la fecha de la venta en UTC con sufijo Z
- **THEN** la confirmación y el historial muestran esa fecha convertida a la zona local

### Requirement: Rechazo que conserva el borrador

Ante 409 o 422 la venta SHALL conservar el cliente verificado y todos los renglones, SHALL mostrar el mensaje del servidor y MUST NOT modificar el historial.

#### Scenario: Libro o cliente inexistente

- **WHEN** la API responde 409 porque el cliente o un libro dejó de existir
- **THEN** la venta muestra el mensaje del servidor y el borrador sigue completo para corregirlo

#### Scenario: Renglones repetidos rechazados

- **WHEN** la API responde 422 por un cuerpo inválido
- **THEN** la venta muestra el detalle legible del rechazo y conserva los renglones

#### Scenario: Historial intacto tras el rechazo

- **WHEN** una venta es rechazada
- **THEN** el historial sigue mostrando las mismas ventas que antes del intento

### Requirement: Historial paginado desde la API

El historial SHALL consultar `GET /ventas/` con `limit` y `offset`, SHALL mostrar identificador, fecha, cliente y total de cada venta y SHALL ofrecer «Anterior» y «Siguiente» con el mismo criterio de página incompleta que el catálogo.

#### Scenario: Primera página del historial

- **WHEN** se abre el historial con ventas registradas
- **THEN** se consulta `limit=20` y `offset=0` y se muestra la primera página

#### Scenario: Historial vacío

- **WHEN** la API devuelve una lista vacía en el primer desplazamiento
- **THEN** el historial muestra el mensaje de que no hay ventas registradas

#### Scenario: Error de conexión en el historial

- **WHEN** la consulta del historial falla por conexión
- **THEN** el historial muestra el error con reintento y no el mensaje de historial vacío

### Requirement: Detalle de venta consultado por identificador

El detalle SHALL obtenerse con `GET /ventas/{id}` al abrirlo y SHALL mostrar fecha, cliente, renglones con precio unitario y subtotal históricos, y total. El detalle MUST NOT depender de datos guardados en el navegador.

#### Scenario: Detalle reabierto tras recargar

- **WHEN** se recarga la página y se abre el detalle de una venta del historial
- **THEN** la API devuelve el mismo detalle y la vista muestra los mismos renglones e importes

#### Scenario: Error al abrir el detalle

- **WHEN** la consulta del detalle falla
- **THEN** el historial sigue visible y el detalle muestra el error con reintento

### Requirement: Precio histórico independiente del catálogo

Los importes del historial y del detalle SHALL provenir de la venta registrada. Un cambio posterior del precio de un libro MUST NOT alterar los importes de las ventas ya confirmadas.

#### Scenario: Precio del catálogo modificado

- **WHEN** se cambia el precio de un libro con `PATCH /libros/{id}` y se vuelve a abrir una venta anterior que lo incluía
- **THEN** el detalle conserva el precio unitario, el subtotal y el total registrados en esa venta

#### Scenario: Sin recálculo local en el detalle

- **WHEN** se muestra el detalle de una venta
- **THEN** los importes mostrados son los del contrato de la API y no el resultado de multiplicar por el precio actual del catálogo
