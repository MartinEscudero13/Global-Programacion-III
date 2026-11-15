# frontend-hosting Specification

## Purpose
Define cómo la web estática del frontend se separa en `public/`, se sirve desde un contenedor Nginx reproducible y llega a la API bajo el mismo origen mediante el prefijo `/api`, para que el Ejercicio 4 del Global se pueda construir, ejecutar y verificar con comandos repetibles.

## Requirements

### Requirement: Separación de los archivos públicos

Los archivos que Nginx sirve SHALL vivir bajo `frontend/public/`: `index.html`, `css/` y `js/`. El `Dockerfile`, `.dockerignore`, `default.conf.template` y la documentación del frontend MUST NOT estar dentro de `public/`.

#### Scenario: Raíz pública con la web

- **WHEN** se listan `frontend/public/` después de mover los archivos
- **THEN** aparecen `index.html`, `css/` y `js/`, y la raíz de `frontend/` contiene el `Dockerfile`, `.dockerignore`, `default.conf.template` y `README.md`

#### Scenario: Configuración fuera de la carpeta pública

- **WHEN** se busca cualquier archivo de configuración del contenedor dentro de `frontend/public/`
- **THEN** no hay ninguno, y la imagen no expone `default.conf.template` como recurso descargable

### Requirement: Rutas relativas conservadas

El documento SHALL cargar sus tres hojas de estilo y sus ocho scripts con rutas relativas que resuelvan dentro de `public/`, con la capa de API cargada antes que los módulos de vista. Ninguna referencia del HTML MUST apuntar a un archivo fuera de `public/`.

#### Scenario: Recursos del documento

- **WHEN** se abre `http://127.0.0.1:8080/` en el navegador
- **THEN** las tres hojas de `css/` y los ocho scripts de `js/` responden 200 y la consola no muestra errores de carga

#### Scenario: Orden de los scripts

- **WHEN** se revisan los atributos `src` de los `script` de `public/index.html`
- **THEN** aparecen `js/api.js`, `js/utils.js`, `js/catalog.js`, `js/books.js`, `js/clients.js`, `js/sales.js`, `js/history.js` y `js/app.js` en ese orden, sin `js/data.js` ni `js/store.js`

#### Scenario: Referencias fuera de la carpeta pública

- **WHEN** se revisan los atributos `href` y `src` de `index.html`
- **THEN** todos resuelven a rutas bajo `public/` o a anclas del mismo documento, sin rutas absolutas al disco ni a `../`

### Requirement: Imagen del frontend reproducible

`frontend/` SHALL contener un `Dockerfile` basado en `nginx:1.30-alpine` que copie `public/` a `/usr/share/nginx/html/` y la plantilla a `/etc/nginx/templates/default.conf.template`, y SHALL declarar el puerto interno 80. `docker build -t libreria-frontend .` ejecutado en `frontend/` MUST terminar con código 0.

#### Scenario: Build desde la carpeta del frontend

- **WHEN** se ejecuta `docker build -t libreria-frontend .` dentro de `frontend/`
- **THEN** el build termina con código 0 y la imagen queda etiquetada `libreria-frontend:latest`

#### Scenario: Imagen con la web en la ruta servida

- **WHEN** se ejecuta `docker run --rm libreria-frontend ls /usr/share/nginx/html`
- **THEN** la salida incluye `index.html`, `css` y `js`, y no incluye `default.conf.template`

### Requirement: Proxy bajo el mismo origen con prefijo recortado

La configuración de Nginx SHALL reenviar `location /api/` a `http://${API_UPSTREAM}/`, de modo que el prefijo `/api` se recorte y el navegador hable con la API bajo el mismo origen que sirve la web. La aplicación MUST NOT depender de CORS ni de un origen distinto.

#### Scenario: Salud a través del proxy

- **WHEN** el contenedor corre con `API_UPSTREAM` apuntando a un backend en ejecución y se solicita `GET http://127.0.0.1:8080/api/health/ready`
- **THEN** la respuesta es 200 con `{"estado":"listo","base":"ok"}`

#### Scenario: Ruta de la API con prefijo recortado

- **WHEN** se solicita `GET http://127.0.0.1:8080/api/libros/`
- **THEN** el backend recibe `GET /libros/` y la respuesta es la lista de libros, sin redirecciones ni errores de origen cruzado

#### Scenario: Destino del proxy configurable al correr

- **WHEN** el mismo contenedor se ejecuta con otro valor de `API_UPSTREAM`
- **THEN** el proxy apunta al nuevo destino sin reconstruir la imagen

### Requirement: Sustitución limitada a la variable del proxy

El `Dockerfile` SHALL declarar `ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$` para que Nginx sustituya únicamente `API_UPSTREAM` al iniciar. Las variables propias de Nginx de la plantilla (`$uri`, `$uri/`) MUST llegar intactas a la configuración final.

#### Scenario: Plantilla renderizada sin romper variables de Nginx

- **WHEN** el contenedor arranca y se inspecciona `/etc/nginx/conf.d/default.conf` dentro de él
- **THEN** `try_files` conserva `$uri` y `$uri/`, y `proxy_pass` muestra el valor recibido en `API_UPSTREAM`

#### Scenario: Arranque sin la variable

- **WHEN** el contenedor se ejecuta sin `API_UPSTREAM`
- **THEN** las peticiones a `/api/...` no llegan al backend y la causa queda visible en `docker logs`

### Requirement: Web servida con archivos locales

El servidor SHALL servir `index.html` como documento por defecto y SHALL responder 404 para rutas que no correspondan a un archivo, sin reescribir a la API. La aplicación MUST NOT pedir recursos a dominios externos, CDNs ni servidores de desarrollo.

#### Scenario: Documento por defecto

- **WHEN** se solicita `GET http://127.0.0.1:8080/`
- **THEN** la respuesta es 200 con el HTML de `public/index.html`

#### Scenario: Archivo inexistente

- **WHEN** se solicita `GET http://127.0.0.1:8080/no-existe.html`
- **THEN** la respuesta es 404 y no se reenvía al backend

#### Scenario: Sin dependencias externas

- **WHEN** se revisan las peticiones del navegador al abrir la web
- **THEN** todas se dirigen al mismo origen y no hay pedidos a CDNs ni a otros dominios

### Requirement: Contexto de build acotado

`frontend/.dockerignore` SHALL excluir `.git`, `**/.env`, `**/.env.*`, `**/node_modules` y `**/.DS_Store`. El contexto de build MUST NOT incluir variables de entorno reales ni dependencias instaladas.

#### Scenario: Contexto sin secretos

- **WHEN** se construye la imagen con un `.env` presente en el árbol de trabajo
- **THEN** ese archivo no forma parte del contexto y no aparece en ninguna capa de la imagen

#### Scenario: Archivos excluidos del contexto

- **WHEN** se revisa `frontend/.dockerignore`
- **THEN** contiene las cinco entradas exigidas y no excluye `public/`, `Dockerfile` ni `default.conf.template`
