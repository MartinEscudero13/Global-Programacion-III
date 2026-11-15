# TPI Librería — Frontend

Trabajo Práctico Integrador de **Programación III**, Tecnicatura Universitaria en Programación a Distancia.

## Integrantes

- Martín Escudero
- Lautaro Naranjo

## Estado del proyecto

**Integración con la API completada.** Las pantallas del primer parcial —catálogo, altas de libros y clientes, venta e historial— funcionan contra la API de la librería con JavaScript nativo. La API es la única fuente de verdad: la aplicación **no usa `localStorage`** ni datos de ejemplo locales.

La aplicación necesita la API en ejecución detrás del proxy `/api`. Sin backend muestra estados de error de conexión con reintento, no listas vacías.

## Cómo ejecutar el proyecto

1. Levantar PostgreSQL y el backend del repositorio:

   ```bash
   cd backend
   alembic upgrade head
   python -m app.seed
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. Construir y ejecutar la imagen del frontend:

   ```bash
   cd frontend
   docker build -t libreria-frontend .
   docker run --rm -p 127.0.0.1:8080:80 -e API_UPSTREAM=host.docker.internal:8000 libreria-frontend
   ```

3. Abrir `http://127.0.0.1:8080/`.

Nginx sirve la web y reenvía `/api/` al backend recortando el prefijo, así que el navegador habla con un solo origen y no hace falta CORS. Abrir `public/index.html` con doble clic ya no alcanza: sin el proxy no hay API.

El proyecto usa HTML, CSS y JavaScript nativos, sin librerías, frameworks, CDNs ni `node_modules` en el entregable.

## Navegación entre vistas

| Vista | Enlace |
| --- | --- |
| Catálogo | `#catalogo` |
| Libros | `#libros` |
| Clientes | `#clientes` |
| Ventas | `#ventas` |
| Historial | `#historial` |

Las cinco vistas conviven en `public/index.html` y se navegan con anclas. El router por hash actualiza `aria-current="location"` y mueve el foco al título de la vista. El enlace «Saltar al contenido» lleva el foco a `main`.

## Funcionalidades

- Catálogo cargado desde `GET /api/libros/` con búsqueda parcial por título, paginación de 20 en 20 y detalle de autorías.
- Cada tarjeta muestra género (o «Sin clasificar» si es nulo), título, ISBN, editorial y precio formateado; el botón «Ver detalle» consulta `GET /api/libros/{id}` y agrega autorías con nombre, rol y orden.
- Estados explícitos de carga, lista vacía, búsqueda sin coincidencias, fin de resultados y error de conexión con reintento, tanto en el catálogo como en el listado de libros y en el historial.
- Alta de libros con stock, editorial, género opcional y autorías verificadas por identificador; validación local antes de enviar y cuerpo exacto del contrato.
- Alta de clientes con `POST /api/clientes/` y consulta individual por identificador; la tabla muestra los clientes conocidos en la sesión.
- Venta con borrador en memoria: renglones editables, un solo renglón por libro, artículos y total estimado, cliente verificado por identificador y confirmación con el cuerpo exacto `{cliente_id, renglones}`.
- La confirmación muestra los importes que devuelve la API; un rechazo 409 o 422 conserva el borrador y vuelve a habilitar el botón.
- Historial paginado y detalle histórico consultado por identificador; un cambio posterior de precio en el catálogo no altera las ventas registradas.
- CSS externo en tres archivos, foco visible, contenedores de tabla con desplazamiento propio y diseño adaptable a 320 px y 1280 px.
- Ocho scripts clásicos enlazados al final del `body`, sin módulos ES.

### Fuera de alcance

El PDF no pide editar ni eliminar libros o clientes: sólo altas y consultas. Los únicos botones de quitar son los de renglones de una venta antes de confirmar. Tampoco se implementan autenticación, carrito persistente ni descuento de stock.

## Datos de prueba

Los datos ficticios se cargan con `python -m app.seed` en el backend. La API del repositorio siembra una editorial, un género, cuatro autores, cuatro libros, dos clientes y una venta de ejemplo.

| Recurso | Contenido del seed |
| --- | --- |
| Editorial | Sudamericana (`1`) |
| Género | Novela (`1`) |
| Autores | Julio Cortázar (`1`), Ricardo Piglia (`2`), Gabriel García Márquez (`3`), Mario Vargas Llosa (`4`) |
| Libros | Rayuela (`1`), Antología del cuento latinoamericano (`2`), La ciudad y los perros (`3`), Respiración artificial (`4`) |
| Clientes | Ana Gómez (`1`), Tomás Ríos (`2`) |
| Venta | `2`, 2 × Rayuela + 1 × Respiración artificial |

Combinación de prueba: cliente `2` con 2 × libro `1` y 1 × libro `4` da `$ 77.000,00` con los precios del seed.

## Arquitectura de JavaScript

- `js/api.js`: capa HTTP única sobre la base `/api`; arma URLs, envía JSON, parsea respuestas, aplica el tiempo máximo y traduce los errores.
- `js/utils.js`: formato de precios y fechas, parseo de importes, validación de email, poblado de selectores y actualización de la paginación.
- `js/catalog.js`: catálogo, búsqueda, paginación, detalle de autorías y estados de la vista.
- `js/books.js`: alta de libros con autorías verificadas, tabla paginada y opciones de editorial y género.
- `js/clients.js`: alta de clientes, consulta por identificador y lista de la sesión.
- `js/sales.js`: borrador de la venta, verificación del cliente, envío y confirmación con importes del servidor.
- `js/history.js`: historial paginado y detalle de cada venta.
- `js/app.js`: arranque asíncrono tolerante de las vistas y router por hash.

Los scripts son clásicos (sin `type="module"`) y se cargan en ese orden al final del `body`. Cada uno es una IIFE con `'use strict'` que publica su API en `window.Libreria`. Todo dato proveniente del usuario o de la API se inserta con `textContent`.

## Integración con la API

La aplicación habla con la API a través de una única capa HTTP, `js/api.js`, montada sobre la base `/api`. El mismo origen sirve la web y reenvía `/api/` al backend con Nginx, que recorta el prefijo: no hay CORS ni orígenes externos.

- La barra final de las rutas de colección se conserva: `POST /api/libros/`, no `/api/libros`.
- Los recursos individuales no llevan barra final: `GET /api/libros/{id}`.
- `fetch` se usa sólo en `js/api.js`; ningún módulo de vista arma URLs ni lee respuestas crudas.

| Operación del cliente | Petición |
| --- | --- |
| `listarLibros({titulo, generoId, limit, offset})` | `GET /api/libros/?limit&offset[&titulo][&genero_id]` |
| `obtenerLibro(id)` | `GET /api/libros/{id}` |
| `crearLibro(cuerpo)` | `POST /api/libros/` |
| `listarTodas('editoriales'\|'generos'\|'libros')` | `GET /api/{coleccion}/?limit=100&offset=N` en bucle |
| `obtenerAutor(id)` | `GET /api/autores/{id}` |
| `obtenerCliente(id)` | `GET /api/clientes/{id}` |
| `crearCliente({nombre, email})` | `POST /api/clientes/` |
| `crearVenta({cliente_id, renglones})` | `POST /api/ventas/` |
| `listarVentas({limit, offset})` | `GET /api/ventas/?limit&offset` |
| `obtenerVenta(id)` | `GET /api/ventas/{id}` |

Códigos de error y mensajes:

- `404` y `409`: se muestra el texto `detail` que devuelve el servidor.
- `422`: la lista `detail` de FastAPI se traduce a una frase en español con el campo y el motivo; nunca se muestra el arreglo ni `[object Object]`.
- Fallo de red, respuesta que no es JSON o demora: se informa como error de conexión, distinto de una lista vacía, con reintento manual de la misma consulta.
- Tiempo máximo por petición: 10 segundos (`AbortController`).

Los importes llegan como string decimal y se conservan así; sólo se convierten al mostrarse. La fecha de una venta llega en ISO 8601 UTC con sufijo `Z` y se muestra en la zona local.

## Selección de clientes y autores por identificador

La API no expone `GET /clientes/` ni `GET /autores/`: sólo admite la consulta individual. Por eso la interfaz pide el **identificador** y lo verifica antes de usar el recurso:

- En el alta de un libro, `GET /api/autores/{id}` devuelve el nombre; recién entonces se habilita «Agregar autoría» con su rol y su orden.
- En la vista de clientes, `GET /api/clientes/{id}` muestra nombre y email y suma el cliente a la tabla. Esa tabla lista **los clientes conocidos en la sesión** (los dados de alta o consultados), no un inventario completo, porque no existe un listado en el contrato.
- En la venta, el cliente se confirma sólo después de consultarlo: el nombre devuelto por la API queda visible y la confirmación exige esa verificación.

## Sin datos en el navegador

La aplicación no usa localStorage ni ningún otro almacenamiento del navegador. Libros, clientes, ventas, editoriales, géneros y autores provienen siempre de la API.

Las claves `libreria.v1.libros`, `libreria.v1.clientes` y `libreria.v1.ventas` de la etapa anterior dejaron de leerse y pueden descartarse: no alteran ninguna vista. El borrador de una venta vive sólo en memoria y se pierde al recargar, como habilita la consigna.

## Pruebas automatizadas

El frontend tiene un arnés propio con el runner integrado de Node, sin dependencias: un DOM simulado, un fixture del `body` y un cargador que evalúa los scripts clásicos en un contexto `vm` con un `fetch` falso.

```bash
node --test "frontend/test/**/*.test.mjs"
```

El comando se ejecuta desde la raíz del repositorio. Node 24 interpreta el argumento de `--test` como un patrón glob y no expande directorios, por eso se indica el patrón completo.

| Archivo | Responsabilidad |
| --- | --- |
| `test/dom-simulado.mjs` | Nodos, atributos, selectores, eventos con burbujeo, foco y `form.reset()` |
| `test/pagina.mjs` | Árbol del `body` con los mismos ids que `index.html` |
| `test/cargar-modulos.mjs` | Lee los `src` del HTML y los evalúa en un contexto `vm` |
| `test/ayudas.mjs` | Respuestas falsas, `fetch` que registra pedidos y espera de microtareas |
| `test/*.test.mjs` | Un archivo por módulo más `estatico.test.mjs`, `pagina.test.mjs` y `arranque.test.mjs` |

Las guardas estáticas verifican que los ids del fixture coinciden con `index.html`, que los scripts son los ocho del diseño y que en `public/js/` no aparecen `innerHTML`, `insertAdjacentHTML`, `document.write`, `localStorage`, `data.js`, `store.js` ni `Libreria.datos`.

El arnés vive en `frontend/test/` y queda fuera del paquete de entrega por `export-ignore`.

## Comprobaciones realizadas

Comprobaciones ejecutadas el **15/11/2026** contra la API real (`python -m app.seed` sobre PostgreSQL 18, Uvicorn en `:8000`) y el contenedor de Nginx en `http://127.0.0.1:8080` con `API_UPSTREAM=host.docker.internal:8000`. El recorrido se hizo con Chrome 157 en modo headless.

| Comprobación | Resultado observado |
| --- | --- |
| Suite del frontend | `node --test "frontend/test/**/*.test.mjs"`: 122 casos, 0 fallos. |
| Sintaxis | `node --check` sobre los ocho archivos de `public/js/`: código 0. |
| Catálogo y paginación | 20 tarjetas en la página 1 con «Anterior» deshabilitado; «Siguiente» mostró 11 tarjetas y quedó deshabilitado; «Anterior» volvió a las 20 con `offset=0`. |
| Búsqueda | «rayuela» mostró 1 tarjeta; «zzz» mostró el mensaje de sin coincidencias y conservó el texto; borrar el filtro volvió a 20 tarjetas. |
| Detalle de libro | «Rayuela» con ISBN, Sudamericana, Novela, `$ 25.000,00`, stock 10 y la autoría «Julio Cortázar · autor · orden 1». El cierre ocultó el detalle. |
| Alta de libro | «Crónica del sur» con stock 3, sin género y una autoría se registró con el identificador 39; el formulario quedó limpio; la tabla se ubicó en la página 2 con el libro visible y el catálogo lo mostró como «Sin clasificar» con `$ 1.234,50`. |
| 409 de ISBN | Repetir el ISBN mostró «El ISBN ya está registrado», conservó los campos y no informó un alta exitosa. |
| Alta de cliente | «Prueba Navegador» se registró con el identificador 13; repetir el email mostró «El email ya está registrado» conservando el valor. |
| Consulta de cliente | El identificador 2 mostró «Tomás Ríos · tomas@example.com» y sumó una segunda fila a la lista de la sesión. |
| Venta | Cliente 2 verificado por nombre, dos renglones (2 × Rayuela y 1 × Respiración artificial), estimación `$ 77.000,00` y confirmación de la venta 14 con precio unitario, subtotales y total del servidor. El borrador quedó vacío. |
| 422 de renglón repetido | Con el cuerpo duplicado en el camino hacia la API, el servidor respondió 422 y la vista mostró «el libro no puede repetirse en la venta» conservando los dos renglones y el cliente, con el botón habilitado. |
| 409 de cliente inexistente | Con el cliente cambiado a 999 en el camino, la vista mostró «El cliente indicado no existe» y conservó el borrador completo. |
| Recarga y detalle | Después de recargar, el historial mostró 7 ventas y el detalle de la venta 14 mantuvo fecha local, cliente, renglones y total `$ 77.000,00`. |
| Precio histórico | `PATCH /api/libros/1` con precio `99000.00`, recarga y reapertura del detalle: la venta 14 siguió en `$ 77.000,00` y `$ 25.000,00` por unidad. |
| Consola | 0 errores de JavaScript y 0 excepciones. Sólo 4 avisos de red de Chrome por las respuestas 409 y 422 provocadas a propósito. |
| Anchos | `document.documentElement.scrollWidth === clientWidth` en 1280 px (1280/1280) y en 320 px (320/320); sin desplazamiento horizontal de página. |

## Imágenes

No se utilizan imágenes externas ni recursos gráficos ajenos. Si en etapas posteriores se incorporan recursos locales, se documentará su procedencia y licencia.

## Nota sobre esta etapa

La aplicación reutiliza las pantallas del primer parcial conectadas a FastAPI: los libros, clientes y ventas confirmadas provienen de la API y quedan en PostgreSQL. El borrador de la venta es el único estado que vive en el navegador, y sólo en memoria. El README debe mantenerse actualizado si cambia el contrato de la API o el orden de los scripts.
