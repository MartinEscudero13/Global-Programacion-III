# Tasks

Estrategia de pruebas: runner integrado de Node (`node --test`) con DOM simulado propio, sin dependencias (ver `design.md`, D9). Cada comportamiento se escribe primero como caso que falla (RED), se implementa lo mínimo para que pase (GREEN) y se agrega un segundo caso que triangula. Comando base desde la raíz del repositorio: `node --test frontend/test`.

## 1. Arnés de pruebas y contrato de DOM

- [x] 1.1 Crear el DOM simulado mínimo en `frontend/test/dom-simulado.mjs` con `Documento`, `Elemento`, `NodoTexto` y `Fragmento`, cubriendo `createElement`, `createTextNode`, `createDocumentFragment`, `append`, `replaceChildren` y `textContent`.
  - RED: escribir `frontend/test/dom.test.mjs` con el caso y ejecutar `node --test frontend/test`; falla porque el módulo no existe.
  - GREEN: implementar el mínimo; el mismo comando pasa.
  - TRIANGULACIÓN: agregar un caso con dos hijos y texto anidado; pasa.
- [x] 1.2 Extender el DOM simulado con atributos, `dataset`, `className`, `hidden`, `disabled`, `value`, `checked`, `closest`, `querySelector`/`querySelectorAll` (`#id`, `tag`, `.clase`, `[attr]`, `[attr="v"]`, descendencia y `:checked`), eventos con burbujeo, `focus` y `form.reset()`.
  - RED: agregar los casos a `frontend/test/dom.test.mjs`; fallan por métodos ausentes.
  - GREEN: implementar hasta que `node --test frontend/test` pase.
  - TRIANGULACIÓN: un caso de `closest('tr')` desde una celda y otro de `input[name="autores"]:checked`; pasan.
- [x] 1.3 Crear `frontend/test/pagina.mjs` con `crearPagina()` que replica el `body` actual de `frontend/public/index.html`, y `frontend/test/pagina.test.mjs` que compara el conjunto de ids del fixture con los `id="..."` del HTML.
  - RED: ejecutar `node --test frontend/test`; falla porque `pagina.mjs` no existe.
  - GREEN: implementar el fixture completo; el test de igualdad de ids pasa.
  - TRIANGULACIÓN: quitar un id del fixture y comprobar que el test falla con el nombre del id faltante; restaurarlo.
- [x] 1.4 Crear `frontend/test/cargar-modulos.mjs` (lee los `src` de `index.html`, evalúa cada script con `node:vm` en un contexto con `window`, `document`, `location`, `setTimeout` y un `fetch` falso) y `frontend/test/ayudas.mjs` (`respuestaJson`, `respuestaError`, `fetchFalso`, `asentar`, `textoDe`).
  - RED: escribir `frontend/test/cargar.test.mjs` que exige `window.Libreria.utils` y `window.Libreria.catalogo`; falla porque el cargador no existe.
  - GREEN: implementar cargador y ayudas; `node --test frontend/test` pasa.
  - TRIANGULACIÓN: segundo caso que registra una petición con `fetchFalso` y verifica URL y método; pasa.

## 2. Capa HTTP

- [x] 2.1 Incorporar `js/api.js` al arranque: crear `frontend/public/js/api.js` con `window.Libreria.api = {}` y agregar `<script src="js/api.js"></script>` como primer script de `frontend/public/index.html`; en `frontend/test/arranque.test.mjs`, afirmar que `Libreria.api` existe tras cargar los módulos del HTML.
  - RED: el test falla porque `Libreria.api` no existe.
  - GREEN: con el archivo mínimo y el `script` agregado, `node --test frontend/test` pasa.
  - TRIANGULACIÓN: afirmar además que `api.js` es el primer `src` de `js/`; pasa.
- [x] 2.2 Implementar en `frontend/test/api.test.mjs` la base `/api` y la barra final: `listarLibros` debe pedir `/api/libros/?limit=20&offset=0` y `obtenerLibro(7)` debe pedir `/api/libros/7`.
  - RED: los casos fallan porque `Libreria.api.listarLibros` no existe.
  - GREEN: implementar el mínimo con `fetch` y parseo de JSON; `node --test frontend/test` pasa.
  - TRIANGULACIÓN: agregar `obtenerVenta(3)` → `/api/ventas/3` y `crearCliente` → `POST /api/clientes/`; pasan.
- [x] 2.3 Agregar los parámetros de consulta: `titulo` recortado y codificado, `genero_id` cuando hay género y omisión de `titulo` cuando el texto queda vacío.
  - RED: extender `api.test.mjs` con `titulo: '  jardín  '` y con `titulo: ''`; fallan.
  - GREEN: construir la URL con `URLSearchParams` o codificación equivalente; pasan.
  - TRIANGULACIÓN: caso con `genero_id: 2` además del título; pasa.
- [x] 2.4 Implementar `crearLibro` y `crearVenta`: `POST` con `Content-Type: application/json`, cuerpo exacto y parseo del 201.
  - RED: casos en `api.test.mjs` que comparan método, cabecera y `JSON.parse` del cuerpo; fallan.
  - GREEN: implementar `crearLibro({isbn, titulo, precio, stock, editorial_id, genero_id, autores})` y `crearVenta({cliente_id, renglones})`; pasan.
  - TRIANGULACIÓN: `crearVenta` con dos renglones conserva el orden y no agrega campos; pasa.
- [x] 2.5 Convertir 404 y 409 en mensajes del servidor: lanzar un error con el string `detail` de `{"detail": "El ISBN ya está registrado"}`.
  - RED: casos en `api.test.mjs` que esperan el mensaje exacto; fallan.
  - GREEN: implementar la extracción de `detail` string y el lanzamiento de `ErrorApi` con `codigo: 'http'` y `estado`; pasan.
  - TRIANGULACIÓN: 404 con «El cliente indicado no existe»; pasa.
- [x] 2.6 Convertir el 422 en texto legible: con `detail` como lista de objetos, el mensaje debe nombrar el campo y el motivo, sin JSON crudo ni `[object Object]`.
  - RED: caso con `detail: [{loc: ['body','renglones',0,'cantidad'], msg: 'Input should be greater than 0', type: 'greater_than'}]`; falla.
  - GREEN: implementar la traducción por `type` con respaldo en `msg`, descartando `body` y `query`; pasa.
  - TRIANGULACIÓN: caso con dos errores y `loc` de consulta (`limit`); el mensaje une ambos y no repite prefijos.
- [x] 2.7 Diferenciar fallo de red y demora: sin respuesta, con respuesta no JSON o con `AbortController` agotado a los 10 s, el error debe tener `codigo: 'red'` y un mensaje de conexión o de demora.
  - RED: casos en `api.test.mjs` con `fetch` que rechaza, con `fetch` que devuelve HTML y con una promesa que no resuelve; fallan.
  - GREEN: implementar `AbortController`, lectura tolerante del cuerpo y mensajes propios; pasan.
  - TRIANGULACIÓN: comprobar que el `AbortSignal` se aborta y que una respuesta 500 con JSON conserva `codigo: 'http'`.
- [x] 2.8 Implementar `listarTodas` para `editoriales`, `generos` y `libros`: páginas de 100 hasta una incompleta, guarda de 20 páginas y resultado `{items, truncado}`.
  - RED: casos con 150 editoriales (dos pedidos, 150 ítems) y con páginas siempre completas (se detiene en la guarda con `truncado: true`); fallan.
  - GREEN: implementar el bucle con guarda; pasan.
  - TRIANGULACIÓN: colección vacía hace un solo pedido y devuelve `{items: [], truncado: false}`.
- [x] 2.9 Agregar a `frontend/public/js/utils.js` el manejo de importes y fechas de la API: `parsearImporte('25000.00')`, `formatearPrecio` aceptando string y `formatearFechaHora` para ISO UTC con `Z`.
  - RED: casos en `frontend/test/utils.test.mjs`; fallan.
  - GREEN: implementar; `node --test frontend/test` pasa.
  - TRIANGULACIÓN: `formatearPrecio('1234.5')` → `$ 1.234,50` y una fecha con microsegundos conserva el instante.
- [x] 2.10 Refactorizar `api.js` para concentrar el pedido en una función interna única (URL, cabeceras, timeout, parseo y errores) sin cambiar el comportamiento observable.
  - Verificación: `node --test frontend/test` sigue en verde y `node --check frontend/public/js/api.js` sale con código 0.
- [x] 2.11 Documentar en `frontend/README.md` la base `/api`, la barra final, los códigos de error y el timeout.
  - Verificación: `Select-String -Path frontend/README.md -Pattern '/api'` encuentra la sección y `Select-String -Path frontend/README.md -Pattern 'fetch'` la describe como capa única.

## 3. Catálogo

- [x] 3.1 Agregar a `frontend/public/index.html` los controles del catálogo y replicarlos en `frontend/test/pagina.mjs`: `#catalogo-cargando`, `#catalogo-error`, `#catalogo-reintentar`, `#catalogo-fin`, `#catalogo-paginacion`, `#catalogo-anterior`, `#catalogo-siguiente`, `#catalogo-pagina`, `#catalogo-detalle`, `#catalogo-detalle-titulo`, `#catalogo-detalle-datos`, `#catalogo-detalle-autores`, `#catalogo-detalle-error`, `#catalogo-detalle-reintentar` y `#catalogo-detalle-cerrar`.
  - RED: agregar los ids al HTML sin tocar el fixture; `node --test frontend/test` falla en el test de igualdad de ids.
  - GREEN: completar el fixture; pasa.
  - TRIANGULACIÓN: comprobar que cada botón nuevo está dentro de su `nav` o `section` con `closest`; pasa.
- [x] 3.2 Reemplazar el filtro local por la carga desde la API: `Libreria.catalogo.iniciar()` pide `GET /api/libros/?limit=20&offset=0` y dibuja título, ISBN, precio, editorial y género.
  - RED: `frontend/test/catalogo.test.mjs` con un `fetch` falso y la página montada; falla porque el módulo lee `Libreria.datos`.
  - GREEN: implementar la carga y el render con `createElement` y `textContent`; pasa.
  - TRIANGULACIÓN: un libro con `genero: null` muestra «Sin clasificar» y el precio `"25000.00"` se muestra `$ 25.000,00`.
- [x] 3.3 Implementar la búsqueda por título con el formulario: enviar `titulo`, reiniciar `offset` a 0 y reemplazar el listado; con el campo vacío no enviar `titulo`.
  - RED: casos en `catalogo.test.mjs` que verifican la URL y las tarjetas tras el `submit`; fallan.
  - GREEN: implementar el manejador del formulario; pasan.
  - TRIANGULACIÓN: desde `offset=20`, una búsqueda nueva usa `offset=0`; y borrar el filtro vuelve al listado completo.
- [x] 3.4 Implementar la paginación del catálogo con «Anterior» y «Siguiente», deshabilitando «Anterior» en `offset=0` y «Siguiente» cuando la página trae menos de 20 elementos.
  - RED: casos en `catalogo.test.mjs` con 20 y con 7 elementos; fallan.
  - GREEN: implementar los botones y el cálculo del desplazamiento; pasan.
  - TRIANGULACIÓN: avanzar y volver conserva el título del filtro activo.
- [x] 3.5 Implementar el detalle: un botón por tarjeta consulta `GET /api/libros/{id}` y muestra título, datos y autorías con nombre, rol y orden; el detalle se cierra sin tocar la página actual.
  - RED: casos en `catalogo.test.mjs`; fallan porque no hay detalle.
  - GREEN: implementar apertura, render y cierre; pasan.
  - TRIANGULACIÓN: un libro con dos autorías muestra las dos y el cierre limpia el contenido.
- [x] 3.6 Implementar los cuatro estados: carga con «Cargando…» y `aria-busy`, lista vacía solo en `offset=0` sin filtro, búsqueda sin coincidencias con filtro y página posterior vacía con aviso de fin.
  - RED: casos en `catalogo.test.mjs` que inspeccionan `hidden` y `aria-busy` durante la promesa pendiente y al resolver; fallan.
  - GREEN: implementar el estado y los mensajes; pasan.
  - TRIANGULACIÓN: una página 2 vacía sin filtro no muestra el mensaje de biblioteca vacía y sí el de fin.
- [x] 3.7 Implementar el error de conexión con reintento en catálogo y en detalle: mensaje propio, botón que repite la misma consulta y ocultamiento del estado vacío.
  - RED: casos con `fetch` que rechaza en la carga, en la búsqueda y en el detalle; fallan.
  - GREEN: implementar el manejo y el reintento; pasan.
  - TRIANGULACIÓN: el reintento de una búsqueda fallida repite título y `offset` originales.
- [x] 3.8 Extraer a `utils` la actualización de los controles de paginación (texto de página y `disabled` de ambos botones) y usarla en el catálogo.
  - RED: casos en `utils.test.mjs` para la función compartida; fallan.
  - GREEN: implementar y reemplazar el código del catálogo; `node --test frontend/test` pasa.
  - TRIANGULACIÓN: con página incompleta deshabilita «Siguiente» y con `offset=0` deshabilita «Anterior».
- [ ] 3.9 Agregar `.paginacion` a `frontend/public/css/components.css` y verificar el catálogo en navegador.
  - Verificación: en Chrome con el contenedor del frontend y el backend detrás del proxy, el catálogo pagina, los botones quedan en una fila legible, `scrollWidth === clientWidth` a 320 px y a 1280 px y la consola no muestra errores propios.

## 4. Alta de libros

- [x] 4.1 Agregar al HTML y al fixture los controles del alta: `#libro-stock` y su error, `#libro-autor-id`, `#libro-autor-buscar`, `#libro-autor-nombre`, `#libro-autor-rol`, `#libro-autor-agregar`, `#libro-autor-error`, `#libro-autorias`, `#libro-opciones-error`, `#libro-opciones-reintentar`, la paginación de la tabla (`#libros-paginacion`, `#libros-anterior`, `#libros-siguiente`, `#libros-pagina`, `#libros-fin`, `#libros-cargando`, `#libros-error`, `#libros-reintentar`).
  - RED: agregar ids al HTML sin el fixture; `node --test frontend/test` falla en la guarda de ids.
  - GREEN: completar `pagina.mjs`; pasa.
  - TRIANGULACIÓN: el test de accesibilidad del fixture verifica `label[for]` y `aria-describedby` de los campos nuevos; pasa.
- [x] 4.2 Cargar editoriales y géneros desde la API con `listarTodas`, poblar los selectores e informar el fallo con reintento sin dejar selectores vacíos silenciosos.
  - RED: `frontend/test/libros.test.mjs` con 150 editoriales y con `fetch` que falla; falla porque usa `Libreria.datos`.
  - GREEN: implementar la carga, el poblado y el error; pasan.
  - TRIANGULACIÓN: el reintento con la API disponible completa los selectores y conserva «Sin clasificar» en géneros.
- [x] 4.3 Implementar las autorías por identificador: consultar `GET /api/autores/{id}`, mostrar el nombre devuelto, agregar con rol y orden correlativo, quitar y rechazar duplicados.
  - RED: casos en `libros.test.mjs` (éxito, 404, duplicado, quitar); fallan.
  - GREEN: implementar la consulta y la lista de autorías; pasan.
  - TRIANGULACIÓN: agregar dos autores con roles distintos asigna orden 1 y 2 y quitar el primero reordena el envío.
- [x] 4.4 Implementar la validación local del alta: título, ISBN, precio mayor que cero, stock entero mayor o igual a cero, editorial y al menos una autoría, sin enviar petición cuando hay errores.
  - RED: casos en `libros.test.mjs` con campos vacíos, stock `-1`, stock `1.5` y precio `0`, verificando que no hubo `fetch`; fallan.
  - GREEN: implementar la validación y el marcado por campo; pasan.
  - TRIANGULACIÓN: un formulario válido completo no muestra errores y sí envía una petición.
- [x] 4.5 Implementar el envío del alta: cuerpo exacto con `precio` como string decimal, `stock` entero, `editorial_id`, `genero_id` opcional y autorías con `autor_id`, `rol` y `orden`; con 201 confirmar con los datos devueltos, limpiar y refrescar tabla y catálogo.
  - RED: casos en `libros.test.mjs` que comparan el cuerpo y el estado posterior al 201; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: alta sin género omite `genero_id` y el libro creado aparece en la tabla y en el catálogo con el id del servidor.
- [x] 4.6 Implementar los errores del alta: 409 muestra el mensaje del servidor conservando los campos y sin éxito; 422 muestra el detalle legible.
  - RED: casos en `libros.test.mjs` con 409 y 422; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: tras el 409 se corrige el ISBN y el reenvío usa el nuevo valor sin perder los demás campos.
- [x] 4.7 Implementar la tabla de libros paginada con `GET /api/libros/`: primera página, «Anterior/Siguiente», estados de carga, vacío, fin y error con reintento.
  - RED: casos en `libros.test.mjs` con 20, 5 y 0 libros y con `fetch` que falla; fallan.
  - GREEN: implementar con la ayuda de paginación de 3.8; pasan.
  - TRIANGULACIÓN: un alta exitosa vuelve a la primera página y muestra el libro nuevo.
- [ ] 4.8 Agregar `.autorias` a `components.css` y verificar el alta en navegador.
  - Verificación: alta de un libro con stock, género opcional y dos autorías desde el navegador; 201 visible, tabla y catálogo actualizados, sin desplazamiento horizontal a 320 px ni a 1280 px.

## 5. Clientes

- [x] 5.1 Agregar al HTML y al fixture la consulta por identificador (`#cliente-consulta-id`, `#cliente-consultar`, `#cliente-consulta-error`, `#cliente-consulta-nombre`) y la columna de identificador en `#tabla-clientes`.
  - RED: agregar ids al HTML sin el fixture; `node --test frontend/test` falla en la guarda.
  - GREEN: completar el fixture; pasa.
  - TRIANGULACIÓN: la tabla tiene tres columnas y el `caption` describe los clientes conocidos en la sesión; pasa.
- [x] 5.2 Implementar el alta de cliente con `POST /api/clientes/`: validación local del formato de email, 201 con el cliente devuelto y su incorporación a la lista de la sesión, y 409 con el mensaje del servidor conservando los campos.
  - RED: `frontend/test/clientes.test.mjs` con 201, 409 y email inválido; falla porque valida unicidad local.
  - GREEN: implementar sin comparar emails contra listas locales; pasan.
  - TRIANGULACIÓN: dos altas con emails distintos agregan dos filas con los ids devueltos.
- [x] 5.3 Implementar la consulta por identificador: `GET /api/clientes/{id}` muestra nombre y email y agrega el cliente a la lista de la sesión; un 404 muestra el mensaje y no agrega; la vista vacía dice que no hay clientes consultados.
  - RED: casos en `clientes.test.mjs` con 200 y 404; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: consultar dos veces el mismo id no duplica la fila.
- [x] 5.4 Retirar de `clients.js` la lectura de `Libreria.datos` y la comparación local de email, y verificar que datos viejos en `localStorage` no alteran la vista.
  - RED: caso en `clientes.test.mjs` que siembra `libreria.v1.clientes` con un valor falso y exige una lista vacía; falla.
  - GREEN: implementar; pasa.
  - TRIANGULACIÓN: el alta y la consulta siguen funcionando con las claves locales sembradas.
- [x] 5.5 Documentar en `frontend/README.md` la opción elegida para clientes: consulta individual por identificador porque la API no expone listado, y lista de conocidos en la sesión.
  - Verificación: `Select-String -Path frontend/README.md -Pattern 'clientes'` encuentra la sección con la palabra «identificador» y con la aclaración de que no existe `GET /clientes/`.

## 6. Ventas

- [ ] 6.1 Reemplazar en el HTML y el fixture el selector de cliente por `#venta-cliente-id`, `#venta-buscar-cliente`, `#venta-cliente-nombre`, `#venta-cliente-error` y agregar `#venta-envio`.
  - RED: modificar el HTML sin el fixture; `node --test frontend/test` falla en la guarda de ids.
  - GREEN: completar el fixture; pasa.
  - TRIANGULACIÓN: el selector de libro sigue presente y el nuevo campo de cliente tiene `label` y `aria-describedby`; pasa.
- [ ] 6.2 Implementar la verificación del cliente: consultar `GET /api/clientes/{id}`, mostrar el nombre, permitir confirmar solo con el cliente verificado y mostrar el 404 sin borrar los renglones.
  - RED: `frontend/test/ventas.test.mjs` con 200, 404 y confirmación sin verificar; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: cambiar el identificador después de verificar invalida el nombre mostrado hasta una nueva consulta.
- [ ] 6.3 Poblar el selector de libros de la venta con `listarTodas('libros')`, mostrando título e ISBN, y avisar si la guarda deja la lista incompleta.
  - RED: casos en `ventas.test.mjs` con dos libros y con `truncado: true`; fallan.
  - GREEN: implementar la carga y el aviso; pasan.
  - TRIANGULACIÓN: el fallo de carga muestra error con reintento y no un selector vacío sin explicación.
- [ ] 6.4 Implementar el borrador en memoria: agregar renglón con cantidad entera positiva, actualizar cantidad si el libro ya está, rechazar cantidades inválidas, quitar renglones y mostrar artículos y total estimado.
  - RED: casos en `ventas.test.mjs` para agregar, duplicado, cantidad `0`, `-2`, `1.5`, quitar y resumen; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: cambiar la cantidad a 3 recalcula subtotal y estimación sin peticiones.
- [ ] 6.5 Implementar la confirmación: validar cliente verificado, renglones y cantidades, enviar el cuerpo exacto, deshabilitar el botón y anunciar el envío; con 201 mostrar identificador, fecha local, cliente, precios unitarios, subtotales y total del servidor, limpiar el borrador y refrescar el historial.
  - RED: casos en `ventas.test.mjs` que comparan el cuerpo, el estado `disabled` durante la promesa pendiente y los importes del 201; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: una respuesta con importes distintos a los locales muestra los del servidor y no los calculados.
- [ ] 6.6 Implementar el rechazo: con 409 o 422 conservar cliente y renglones, mostrar el mensaje del servidor, rehabilitar el botón y no modificar el historial.
  - RED: casos en `ventas.test.mjs` con 409 y 422 que verifican el borrador y las filas del historial; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: tras el rechazo se corrige un renglón y el reenvío usa el cuerpo corregido.
- [ ] 6.7 Refactorizar el armado y la validación del cuerpo de la venta en funciones internas sin cambiar el comportamiento.
  - Verificación: `node --test frontend/test` sigue en verde y `node --check frontend/public/js/sales.js` sale con código 0.

## 7. Historial

- [ ] 7.1 Agregar al HTML y al fixture la paginación y los estados del historial (`#historial-cargando`, `#historial-error`, `#historial-reintentar`, `#historial-paginacion`, `#historial-anterior`, `#historial-siguiente`, `#historial-pagina`, `#detalle-error`, `#detalle-reintentar`).
  - RED: agregar ids al HTML sin el fixture; `node --test frontend/test` falla en la guarda.
  - GREEN: completar el fixture; pasa.
  - TRIANGULACIÓN: el detalle mantiene sus ids y su `hidden` inicial; pasa.
- [ ] 7.2 Implementar el listado con `GET /api/ventas/?limit=20&offset=0`, «Anterior/Siguiente» con el criterio compartido, estado vacío, carga y error con reintento.
  - RED: `frontend/test/historial.test.mjs` con 20 ventas, 3 ventas, 0 ventas y `fetch` que falla; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: avanzar a la segunda página usa `offset=20` y «Anterior» vuelve a `offset=0`.
- [ ] 7.3 Implementar el detalle con `GET /api/ventas/{id}`: fecha local, cliente, renglones con precio unitario y subtotal, y total; sin leer datos locales.
  - RED: casos en `historial.test.mjs` que comparan los importes del contrato; fallan.
  - GREEN: implementar; pasan.
  - TRIANGULACIÓN: una venta con dos renglones muestra los dos subtotales y el total de la respuesta.
- [ ] 7.4 Implementar el error del detalle sin romper el historial: mensaje con reintento y tabla del historial intacta.
  - RED: caso con `fetch` que falla solo en el detalle; falla.
  - GREEN: implementar; pasa.
  - TRIANGULACIÓN: el reintento exitoso muestra el detalle sin volver a pedir la página del historial.
- [ ] 7.5 Verificar la persistencia del detalle simulando una recarga: reconstruir la página, recargar los módulos con la misma API falsa y abrir la misma venta.
  - RED: caso en `historial.test.mjs` que exige los mismos importes tras la recarga; falla si algo se guarda en memoria del módulo.
  - GREEN: implementar lo que falte; pasa.
  - TRIANGULACIÓN: el detalle de una venta con precio de catálogo cambiado conserva sus importes.

## 8. Arranque, retiro de la persistencia local y documentación

- [ ] 8.1 Reescribir el arranque en `app.js`: los `iniciar` son asíncronos, cada uno maneja su error y el router por hash arranca igual; verificar con `frontend/test/arranque.test.mjs` que una vista que falla no impide inicializar las demás.
  - RED: caso con `fetch` que falla solo para editoriales y exige catálogo funcionando; falla.
  - GREEN: implementar el arranque tolerante; pasa.
  - TRIANGULACIÓN: la consola registrada en el contexto no contiene excepciones no capturadas.
- [ ] 8.2 Eliminar `frontend/public/js/data.js` y `frontend/public/js/store.js`, quitar sus `script` del HTML y dejar ocho scripts en el orden `api`, `utils`, `catalog`, `books`, `clients`, `sales`, `history`, `app`.
  - RED: `frontend/test/estatico.test.mjs` con la lista exacta de `src` y la ausencia de `data.js`/`store.js`; falla.
  - GREEN: borrar los dos archivos y actualizar los `script` del HTML; pasa.
  - TRIANGULACIÓN: afirmar que ningún módulo referencia `Libreria.store` ni `Libreria.datos`; pasa.
- [ ] 8.3 Agregar la guarda estática global: sin `innerHTML`, `insertAdjacentHTML`, `document.write`, `localStorage`, `data.js`, `store.js` ni `Libreria.datos` en `frontend/public/js/`, y conjunto de ids del fixture igual al de `index.html`.
  - RED: ejecutar `node --test frontend/test`; falla si queda alguna referencia.
  - GREEN: corregir las referencias restantes; pasa.
  - TRIANGULACIÓN: sembrar `localStorage` con las tres claves y recorrer catálogo, altas, venta e historial; las vistas siguen mostrando datos de la API.
- [ ] 8.4 Reescribir `frontend/README.md`: estado del proyecto, ejecución con backend y proxy, funcionalidades, arquitectura de los ocho scripts, endpoints usados, ausencia de `localStorage`, comando `node --test frontend/test` y comprobaciones realizadas con fecha real.
  - Verificación: `Select-String -Path frontend/README.md -Pattern 'Almacenamiento local|persistencia en|nueve scripts|libreria\.v1\.'` no devuelve líneas, `Select-String -Path frontend/README.md -Pattern 'node --test'` encuentra el comando y `Select-String -Path frontend/README.md -Pattern 'no usa localStorage'` encuentra la aclaración de la fuente de verdad.
- [ ] 8.5 Marcar `frontend/test` con `export-ignore` en `.gitattributes` y comprobar el paquete.
  - Verificación: `git check-attr export-ignore -- frontend/test` responde `set`; `git archive --format=tar HEAD | tar -tf - | Select-String 'frontend/test'` no devuelve líneas y sí aparecen `frontend/public/js/api.js` y `frontend/public/index.html`.
- [ ] 8.6 Ejecutar la verificación integral en navegador y sintaxis.
  - Verificación: `node --check` sobre cada archivo de `frontend/public/js/` sale con código 0; en el navegador con el contenedor y el backend detrás del proxy se recorren catálogo con búsqueda y paginación, alta de libro, alta de cliente, venta de dos renglones con detalle tras recargar, rechazo 409 y 422 conservando el borrador, y precio histórico con `PATCH /libros/{id}`; consola sin errores propios y `document.documentElement.scrollWidth === clientWidth` a 320 px y 1280 px.
- [ ] 8.7 Validar los artefactos del change: `openspec validate --strict "integrar-frontend-con-api"` responde que el change es válido.

## Workflow follow-up

- Ejecutar G-01 a G-06 como evidencia formal en el change de entrega, con la aplicación ya integrada.
- Archivar este change cuando la verificación esté completa.
