# Spec Delta

## Purpose

Catálogo de la librería consultado a la API: búsqueda parcial por título, paginación por `limit` y `offset`, detalle con autores y estados de interfaz explícitos para carga, lista vacía, búsqueda sin coincidencias y error de conexión.

## ADDED Requirements

### Requirement: Catálogo cargado desde la API

El catálogo SHALL mostrarse con los libros que devuelve `GET /libros/` y cada tarjeta SHALL incluir título, ISBN, precio, editorial y género, mostrando «Sin clasificar» cuando el género es nulo.

#### Scenario: Primera carga con libros

- **WHEN** se abre la aplicación con la API disponible y libros registrados
- **THEN** el catálogo muestra la primera página de libros con título, ISBN, precio formateado, editorial y género

#### Scenario: Libro sin género

- **WHEN** un libro devuelto por la API tiene `genero` nulo
- **THEN** su tarjeta muestra «Sin clasificar» en el lugar del género

#### Scenario: Sin datos de ejemplo locales

- **WHEN** se abre la aplicación en un navegador sin datos guardados
- **THEN** el catálogo muestra los libros de la API y no seis libros de ejemplo locales

### Requirement: Búsqueda parcial por título

La búsqueda SHALL enviar el título recortado a la API, SHALL reiniciar el desplazamiento a 0 y SHALL reemplazar el listado por los resultados. Borrar el filtro y buscar de nuevo SHALL recuperar el listado completo.

#### Scenario: Búsqueda con coincidencias

- **WHEN** se busca `jardín` y la API devuelve un libro que contiene ese texto en el título
- **THEN** el catálogo muestra solo ese libro

#### Scenario: Cambio de filtro con página avanzada

- **WHEN** se está en la segunda página y se envía una búsqueda nueva
- **THEN** la consulta usa `offset=0` y el listado muestra el primer tramo de resultados

#### Scenario: Filtro borrado

- **WHEN** se envía la búsqueda con el campo vacío después de haber filtrado
- **THEN** el catálogo vuelve a mostrar la primera página del listado completo

### Requirement: Paginación del catálogo

El catálogo SHALL ofrecer «Anterior» y «Siguiente» sobre `limit` y `offset`, SHALL deshabilitar «Anterior» en el desplazamiento 0 y SHALL deshabilitar «Siguiente» cuando la página recibida es más corta que el tamaño de página.

#### Scenario: Avanzar y volver

- **WHEN** se pulsa «Siguiente» con una primera página completa y luego «Anterior»
- **THEN** el listado muestra la segunda página y después vuelve a la primera con `offset=0`

#### Scenario: Primera página sin anterior

- **WHEN** el catálogo está en la primera página
- **THEN** el botón «Anterior» está deshabilitado

#### Scenario: Página incompleta

- **WHEN** la API devuelve menos libros que el tamaño de página
- **THEN** el botón «Siguiente» está deshabilitado y no se ofrecen páginas posteriores

### Requirement: Detalle de libro con autores

Cada tarjeta SHALL permitir abrir el detalle de su libro mediante `GET /libros/{id}`, que SHALL mostrar los datos del listado y las autorías con nombre, rol y orden.

#### Scenario: Detalle con autorías

- **WHEN** se pide el detalle de un libro con dos autorías
- **THEN** el detalle muestra el título y las dos autorías con su nombre y su rol

#### Scenario: Cierre del detalle

- **WHEN** se cierra el detalle abierto
- **THEN** el catálogo queda visible y el detalle deja de mostrarse

### Requirement: Estado de carga

Mientras una consulta del catálogo está en curso, la vista SHALL indicarlo con el texto «Cargando…» y SHALL marcar la región como ocupada, sin borrar de forma confusa el listado anterior.

#### Scenario: Carga en curso

- **WHEN** se solicita una página o una búsqueda y la respuesta todavía no llegó
- **THEN** la vista muestra «Cargando…» y la región del catálogo queda marcada como ocupada

#### Scenario: Fin de la carga

- **WHEN** la respuesta llega y el listado se dibuja
- **THEN** el aviso de carga desaparece y la región deja de estar marcada como ocupada

### Requirement: Catálogo vacío y búsqueda sin coincidencias

El catálogo SHALL distinguir una biblioteca sin libros de una búsqueda sin coincidencias. La lista vacía SHALL informarse solo en el primer desplazamiento sin filtro, y el aviso de sin coincidencias SHALL mostrarse cuando hay filtro y la respuesta no trae libros.

#### Scenario: Biblioteca sin libros

- **WHEN** se consulta la primera página sin filtro y la API devuelve una lista vacía
- **THEN** el catálogo muestra el mensaje de que no hay libros y no el de búsqueda sin coincidencias

#### Scenario: Búsqueda sin coincidencias

- **WHEN** se busca un título que no existe y la API devuelve una lista vacía
- **THEN** el catálogo muestra el mensaje de búsqueda sin coincidencias y conserva el texto buscado

#### Scenario: Página posterior vacía

- **WHEN** se avanza a una página que la API devuelve vacía sin filtro
- **THEN** no se muestra el mensaje de biblioteca vacía y se informa que no hay más resultados

### Requirement: Error de conexión con reintento

Cuando una consulta del catálogo falla por conexión el catálogo SHALL mostrar un mensaje de error con un botón de reintento que repita la misma consulta, sin mostrar el estado vacío.

#### Scenario: Fallo al cargar la primera página

- **WHEN** la API no responde al abrir la aplicación
- **THEN** el catálogo muestra el error de conexión y el botón de reintento

#### Scenario: Reintento de la búsqueda fallida

- **WHEN** falla una búsqueda por título y se pulsa reintentar con la API disponible
- **THEN** se repite la búsqueda con el mismo título y el mismo desplazamiento y se muestran los resultados

### Requirement: Error al abrir el detalle

Si el detalle de un libro falla, la vista SHALL mostrar un mensaje de error en el detalle sin romper el catálogo ni la paginación.

#### Scenario: Detalle que no se puede consultar

- **WHEN** se abre el detalle de un libro y la API responde con error de conexión
- **THEN** el catálogo sigue visible con su página actual y el detalle muestra el mensaje de error con reintento
