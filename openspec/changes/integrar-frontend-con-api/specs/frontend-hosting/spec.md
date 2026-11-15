# Spec Delta

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Funcionamiento sin la API en esta etapa

**Reason**: La integración con la API es el objeto de este change. La aplicación deja de ser autónoma respecto del backend y ya no conserva libros, clientes ni ventas en el navegador.

**Migration**: Los datos guardados en `localStorage` bajo `libreria.v1.*` dejan de leerse y pueden descartarse. La aplicación requiere el backend en ejecución detrás del proxy `/api`; sin él muestra estados de error de conexión con reintento. La documentación del frontend se actualiza para indicar que la API es la fuente de verdad.
