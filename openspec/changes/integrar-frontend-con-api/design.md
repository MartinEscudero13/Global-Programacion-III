# Design

## Context

Ver `proposal.md` para la motivación. El estado actual del frontend está en `frontend/public/`: nueve scripts clásicos enlazados en `index.html`, cada uno una IIFE que publica en `window.Libreria`, sin ninguna petición HTTP y con `localStorage` como único respaldo (`js/store.js`, claves `libreria.v1.*`). Los ids `lN`/`cN`/`V-000N` y las unicidades de ISBN y email se calculan en el cliente. Todo el render usa `createElement`, `textContent` y `replaceChildren`; no hay estados de carga ni de conexión.

Restricciones que condicionan el diseño:

- Sólo HTML, CSS y JavaScript nativos. Sin frameworks, librerías, bundlers ni npm en el entregable.
- Ocho scripts clásicos (sin módulos ES) cargados al final del `body`; sin `type="module"`.
- Misma origen mediante el proxy de Nginx: base `/api` y barra final conservada en las rutas de colección; no hace falta CORS.
- Prohibidos `innerHTML`, `insertAdjacentHTML` y `document.write`.
- La API no expone listados de autores ni de clientes, y no devuelve el total de una colección paginada.
- El backend y su contrato no se modifican. Los importes llegan como string decimal y la fecha como ISO 8601 UTC con sufijo `Z`.
- El proyecto no tiene runner de pruebas de JavaScript. Node 24.16.0 está disponible en el equipo de desarrollo.

## Goals / Non-Goals

**Goals:**

- Una única capa HTTP que traduzca el contrato a operaciones de la interfaz y concentre URL base, paginación, parseo y errores.
- Que la API sea la única fuente de verdad, sin estado persistido en el navegador.
- Que cada comportamiento nuevo pueda verificarse con RED/GREEN automatizado y sin dependencias externas.
- Mantener el render seguro con `textContent` y los estados de interfaz accesibles y distinguibles.

**Non-Goals:**

- Cambiar el backend, sus rutas, sus DTO o sus códigos de error.
- Desplegar, construir la imagen, configurar Easypanel o ejecutar G-01 a G-07 como evidencia formal.
- Agregar edición o baja de libros y clientes, carrito persistente, autenticación o stock decreciente: no están en la consigna ni en el contrato.
- Reproducir la experiencia de filtro instantáneo tecla por tecla: la búsqueda pasa a enviarse con el formulario.

## Decisions

### D1. `js/api.js` como única capa HTTP

Se agrega `frontend/public/js/api.js` y se retiran del orden de carga `js/data.js` y `js/store.js`. El orden queda: `api.js`, `utils.js`, `catalog.js`, `books.js`, `clients.js`, `sales.js`, `history.js`, `app.js` (ocho scripts). `api.js` no depende de otros módulos, por eso va primero; `utils.js` sólo depende de nada, y los módulos de vista dependen de ambos.

`Libreria.api` expone:

| Operación | Petición |
| --- | --- |
| `listarLibros({titulo, generoId, limit, offset})` | `GET /api/libros/?limit&offset[&titulo][&genero_id]` |
| `obtenerLibro(id)` | `GET /api/libros/{id}` |
| `crearLibro(cuerpo)` | `POST /api/libros/` |
| `listarTodas('editoriales'\|'generos'\|'libros')` | `GET /api/{coleccion}/?limit=100&offset=N` en bucle |
| `obtenerAutor(id)` | `GET /api/autores/{id}` |
| `obtenerCliente(id)` | `GET /api/clientes/{id}` |
| `crearCliente({nombre, email})` | `POST /api/clientes/` |
| `crearVenta(cuerpo)` | `POST /api/ventas/` |
| `listarVentas({limit, offset})` | `GET /api/ventas/?limit&offset` |
| `obtenerVenta(id)` | `GET /api/ventas/{id}` |

Todas devuelven datos ya parseados y lanzan `ErrorApi` ante cualquier fallo. Alternativa descartada: `fetch` disperso en cada módulo, que duplicaría la base, el manejo de 422 y los reintentos.

### D2. La API como fuente de verdad y borrador en memoria

Se eliminan `Libreria.datos`, las semillas y toda lectura o escritura de `localStorage`. Los ids y las unicidades pasan a ser responsabilidad del servidor: el cliente no genera `lN`/`cN`/`V-000N` ni compara ISBN o emails contra listas locales. El borrador de la venta vive en una variable de `sales.js` y se pierde al recargar, como habilita la consigna. Las claves `libreria.v1.*` de la etapa anterior se ignoran y quedan documentadas como descartables.

### D3. Selección de clientes y autores por identificador

La API no ofrece `GET /clientes/` ni `GET /autores/`. Se elige la opción que la consigna habilita explícitamente: un campo numérico de identificador más un botón de consulta que llama a `GET /clientes/{id}` o `GET /autores/{id}`. La vista muestra el nombre devuelto y sólo entonces habilita el uso del recurso (agregar la autoría o confirmar la venta). Un 404 se muestra como mensaje del servidor y no agrega nada. La opción queda documentada en `frontend/README.md`.

Consecuencia asumida: la tabla «Clientes registrados» deja de ser un listado completo y pasa a mostrar los clientes conocidos en la sesión (los creados o consultados), con una nota visible de que la API no expone el listado. Alternativa descartada: inventar un endpoint de búsqueda inexistente.

### D4. Paginación sin total

Se usa `limit=20` y `offset` desde 0. «Anterior» se deshabilita en `offset=0`. Como la API devuelve un arreglo sin total, «Siguiente» se deshabilita cuando la página recibida trae menos de 20 elementos; si trae 20, se asume que puede haber otra. Al cambiar el filtro el desplazamiento vuelve a 0. Si una página posterior llega vacía, no se muestra el estado de biblioteca vacía: se informa que no hay más resultados y se retrocede a la última página con datos. Este criterio se aplica igual en catálogo, tabla de libros e historial. Alternativa descartada: calcular páginas con un total que el contrato no entrega.

### D5. Modelo de error único

`ErrorApi` lleva `codigo` (`red`, `http`, `validacion`, `limite`), `estado` y `mensaje`.

- 404 y 409: `mensaje` es el string `detail` del servidor, mostrado tal cual.
- 422: `detail` es una lista; se convierte en una frase en español con el campo y el motivo. Se traduce por `type` (`missing`, `greater_than`, `greater_than_equal`, `int_parsing`, `string_pattern_mismatch`, `literal_error`, `value_error`, etc.) y se usa `msg` como respaldo. Se descartan los prefijos `body`/`query` de `loc` y se unen los casos con `; `. Nunca se muestra JSON crudo ni `[object Object]`.
- Fallo de red, respuesta no JSON o `AbortController` agotado (10 s): `codigo: 'red'` con un mensaje propio de conexión o de demora, distinto de una lista vacía.
- `listarTodas` corta en una guarda de 20 páginas (2 000 elementos) y devuelve `{items, truncado}`; con `truncado` la vista muestra un aviso y no sigue pidiendo.

Los reintentos son manuales y repiten exactamente la misma consulta (mismo filtro y mismo desplazamiento).

### D6. Importes y fechas sin conversión destructiva

Los importes se guardan en el estado como el string recibido. `utils.formatearPrecio` acepta string o número y convierte sólo para mostrar con `Intl.NumberFormat('es-AR')`. `utils.parsearImporte` existe únicamente para la estimación previa del borrador. El total, los subtotales y los precios unitarios que se muestran tras confirmar salen de la respuesta 201 o del detalle, nunca de una multiplicación local.

`utils.formatearFechaHora` recibe el ISO con `Z`, construye un `Date` y muestra fecha y hora en la zona local del navegador. El valor original se conserva en `datetime` del elemento `time`.

### D7. Estados de interfaz y accesibilidad

Cada vista con consultas tiene cuatro estados excluyentes: carga, datos, vacío/sin coincidencias y error con reintento. Se reutilizan `.mensaje--aviso`, `.mensaje--error`, `.mensaje--vacio`, `.mensaje--exito` y `.boton:disabled`. La carga se marca con `aria-busy="true"` en la región y el texto «Cargando…» en un `role="status"`. Los errores usan `role="alert"`. Los botones afectados quedan `disabled` mientras hay una petición en curso. Los campos nuevos llevan `label`, `aria-describedby` hacia su error y `aria-invalid` cuando corresponde.

En CSS se agregan sólo dos clases en `components.css`: `.paginacion` (contenedor flexible que envuelve en 320 px) y `.autorias` (lista de autorías agregadas). No se agregan estilos inline ni dependencias.

### D8. Borrador conservado y envío único

Antes de enviar se valida cliente verificado, al menos un renglón, cantidades enteras positivas y un solo renglón por libro. El botón se deshabilita y la vista anuncia «Enviando la venta…». Con 201 se muestran los importes del servidor, se limpia el borrador y se recarga el historial. Con 409 o 422 se conserva el cliente verificado y todos los renglones, se muestra el mensaje del servidor y se vuelve a habilitar el botón. No hay reintento automático: un POST no es idempotente.

### D9. Estrategia de pruebas: `node --test` con DOM simulado

Decisión: las pruebas del frontend se ejecutan con el runner integrado de Node (`node --test`), sin dependencias, sobre un DOM simulado propio y un cargador que evalúa las IIFE en un contexto `vm`. Los archivos viven en `frontend/test/` y se excluyen del paquete con `export-ignore`.

Motivos:

- El entregable prohíbe npm; Jest, Vitest o jsdom introducirían dependencias y un `node_modules` que no debe viajar.
- Node 24 ya está disponible y su runner no requiere instalación ni conexión.
- `vm` permite cargar scripts clásicos tal como los carga el navegador, respetando el orden real de `index.html`, y permite inyectar un `fetch` falso para afirmar URL, método y cuerpo exactos.
- Permite exigir RED antes de cada comportamiento: el test falla porque el módulo o la función todavía no existe, y luego pasa con la implementación mínima.

Alternativas descartadas: Playwright como gate principal (requiere instalación y descarga de navegadores, y no permite un ciclo RED/GREEN barato por unidad) y verificación sólo manual (no permite demostrar RED). La verificación en navegador se mantiene como aceptación de lo que el doble no puede probar: CSS, anchos, foco real y red con el proxy.

Arnes:

| Archivo | Responsabilidad |
| --- | --- |
| `frontend/test/dom-simulado.mjs` | `Documento`, `Elemento`, `NodoTexto` y `Fragmento` con el subconjunto que usan los módulos: `createElement`, `createTextNode`, `createDocumentFragment`, `getElementById`, `querySelector(All)` para `#id`, `tag`, `.clase`, `[attr]`, `[attr="v"]`, descendencia por espacio y `:checked`; `append`, `replaceChildren`, `textContent`, atributos, `dataset`, `className`, `hidden`, `disabled`, `value`, `checked`, `closest`, `focus`, `addEventListener`, `dispatchEvent` con burbujeo y `form.reset()` |
| `frontend/test/pagina.mjs` | `crearPagina()` arma el árbol completo del `body` con los mismos ids y estructura que `index.html` |
| `frontend/test/cargar-modulos.mjs` | Lee los `src` de `index.html`, los evalúa en un contexto `vm` con `window`, `document`, `fetch` falso, `location` y `setTimeout`, y devuelve `window.Libreria` |
| `frontend/test/ayudas.mjs` | `respuestaJson`, `respuestaError`, `fetchFalso` (registra URL, método y cuerpo), `asentar()` para vaciar microtareas y `textoDe()` |
| `frontend/test/*.test.mjs` | Un archivo por módulo más `estatico.test.mjs` y `pagina.test.mjs` |

Guardas estáticas que complementan el doble: un test compara el conjunto de ids de `pagina.mjs` con los `id="..."` de `index.html`, otro verifica el orden y la lista de scripts, y otro prohíbe en `public/js/` las cadenas `innerHTML`, `insertAdjacentHTML`, `document.write`, `localStorage`, `data.js`, `store.js` y `Libreria.datos`.

Comandos: `node --test frontend/test` para la suite y `node --check <archivo>` por cada script modificado. El doble de DOM se amplía sólo cuando un test lo exige, y cada ampliación queda cubierta por un caso.

### D10. Contrato de DOM de las vistas

Los tests y las tareas se apoyan en estos ids. Los existentes se conservan; los nuevos se agregan en `index.html`.

- Catálogo: `#form-busqueda`, `#busqueda-titulo`, `#catalogo-lista`, `#catalogo-vacio`, `#catalogo-sin-resultados`, `#catalogo-fin`, `#catalogo-cargando`, `#catalogo-error`, `#catalogo-reintentar`, `#catalogo-paginacion`, `#catalogo-anterior`, `#catalogo-siguiente`, `#catalogo-pagina`, `#catalogo-detalle`, `#catalogo-detalle-titulo`, `#catalogo-detalle-datos`, `#catalogo-detalle-autores`, `#catalogo-detalle-error`, `#catalogo-detalle-reintentar`, `#catalogo-detalle-cerrar`.
- Libros: los ids actuales del formulario y la tabla, más `#libro-stock`, `#libro-stock-error`, `#libro-autor-id`, `#libro-autor-buscar`, `#libro-autor-nombre`, `#libro-autor-rol`, `#libro-autor-agregar`, `#libro-autor-error`, `#libro-autorias`, `#libro-opciones-error`, `#libro-opciones-reintentar`, `#libros-cargando`, `#libros-error`, `#libros-reintentar`, `#libros-fin`, `#libros-paginacion`, `#libros-anterior`, `#libros-siguiente`, `#libros-pagina`.
- Clientes: los ids actuales del alta y la tabla, más `#cliente-consulta-id`, `#cliente-consultar`, `#cliente-consulta-error`, `#cliente-consulta-nombre`. La tabla gana la columna de identificador.
- Ventas: `#venta-cliente-id` (reemplaza al selector `#venta-cliente`), `#venta-buscar-cliente`, `#venta-cliente-nombre`, `#venta-cliente-error`, `#venta-libro`, `#venta-cantidad`, `#venta-agregar`, `#venta-mensaje`, `#venta-envio`, `#tabla-renglones`, `#venta-vacio`, `#venta-articulos`, `#venta-total`, `#venta-confirmar`, `#venta-confirmada`.
- Historial: `#tabla-historial`, `#historial-vacio`, `#historial-cargando`, `#historial-error`, `#historial-reintentar`, `#historial-paginacion`, `#historial-anterior`, `#historial-siguiente`, `#historial-pagina`, `#detalle-venta`, `#detalle-titulo`, `#detalle-meta`, `#detalle-tabla-titulo`, `#detalle-renglones`, `#detalle-total`, `#detalle-error`, `#detalle-reintentar`.

### D11. Arranque asíncrono

`iniciar` de cada módulo devuelve una promesa y captura sus propios errores para dibujar el estado de error, de modo que una vista que falla no impide arrancar las demás. `app.js` ejecuta los `iniciar` sin `await` bloqueante (los encadena con `Promise.all` y `.catch` por módulo) y mantiene el router por hash igual que hoy. Alternativa descartada: inicialización secuencial con `await` global, que dejaría la navegación inutilizable mientras una consulta lenta responde.

### D12. Documentación y paquete

`frontend/README.md` se reescribe en las secciones afectadas: estado del proyecto, cómo ejecutar con backend y proxy, funcionalidades, arquitectura de los ocho scripts, tabla de endpoints usados, decisión de selección por identificador, ausencia de `localStorage`, comando de pruebas y comprobaciones realizadas con fecha real. El arnés `frontend/test/` se agrega a `.gitattributes` con `export-ignore` y se documenta en la spec de `delivery-package`.

## Risks / Trade-offs

- [El DOM simulado diverge del navegador] → Guardas de ids y orden de scripts, subconjunto acotado y pasada de aceptación en navegador por bloque (red, foco, CSS, 320 px y 1280 px).
- [La inferencia de última página falla si los datos cambian entre dos pedidos] → Se deshabilita «Siguiente» sólo con página incompleta y, si una página llega vacía, se retrocede a la última con datos en lugar de mostrar un estado falso.
- [Los mensajes de 422 de Pydantic cambian entre versiones] → Traducción por `type` con respaldo en `msg`; el texto siempre queda en español legible y nunca se muestra el arreglo.
- [El backend usa 409 también para referencias inexistentes] → El cliente no distingue por código: muestra el `detail` del servidor, que ya es legible.
- [Sin listado de clientes la tabla pierde sentido de inventario] → Se rotula como clientes conocidos en la sesión y se documenta la limitación y la opción elegida.
- [El selector de libros de la venta recorre todas las páginas] → La guarda de 20 páginas acota el costo y el aviso de lista incompleta evita una truncación silenciosa.
- [Un POST de venta no es idempotente] → Sin reintento automático; el botón se deshabilita durante el envío y se conserva el borrador ante rechazo.
- [Precio enviado como string decimal a un campo `Decimal`] → Pydantic acepta strings; se verifica en la tarea de alta contra el backend local antes de dar el comportamiento por cerrado.
- [El arnés suma código que no es entregable] → Vive en `frontend/test/`, se excluye con `export-ignore` y la spec de entrega lo declara.

## Migration Plan

1. Implementar y probar la capa HTTP y los módulos con el backend local disponible y datos ficticios cargados.
2. Reemplazar el orden de scripts en `index.html`; las vistas dejan de leer `Libreria.datos` en el mismo commit para no dejar estados intermedios roto.
3. Actualizar `frontend/README.md`, `.gitattributes` y las comprobaciones realizadas con fechas reales.
4. Verificar con el proxy de Nginx (`/api` recortado) que catálogo, altas, venta e historial funcionan; dejar la app lista para G-01 a G-06, que se ejecutan en el change de entrega.
5. Reversión: el backend no cambia; revertir el commit del frontend restaura la versión con `localStorage`. Los datos del navegador de la etapa anterior no se migran ni se borran por la aplicación.

## Open Questions

- Si conviene mostrar el stock en el catálogo o en el detalle: no lo exige la consigna y puede agregarse sin cambiar las specs.
- Si el catálogo supera los 2 000 libros, el selector de la venta necesitará búsqueda propia en lugar de la guarda actual.
- El valor de 10 s para el tiempo de espera es una constante ajustable si la red del despliegue resulta más lenta.
