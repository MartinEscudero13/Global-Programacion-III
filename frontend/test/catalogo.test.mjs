import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson, respuestaError, textoDe, asentar } from './ayudas.mjs';

const RAYUELA = {
  id: 1,
  isbn: '978-950-00-0001-1',
  titulo: 'Rayuela',
  precio: '25000.00',
  stock: 10,
  editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
  genero: { id: 1, nombre: 'Novela' }
};

const SIN_GENERO = {
  id: 5,
  isbn: '978-950-00-0005-1',
  titulo: 'Manual del lector',
  precio: '1234.5',
  stock: 2,
  editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
  genero: null
};

function crearLibros(cantidad, desde) {
  const inicio = desde === undefined ? 1 : desde;

  return Array.from({ length: cantidad }, function (_, indice) {
    return {
      id: inicio + indice,
      isbn: '978-950-00-' + String(inicio + indice).padStart(4, '0') + '-1',
      titulo: 'Libro ' + (inicio + indice),
      precio: '1000.00',
      stock: 1,
      editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
      genero: null
    };
  });
}

async function montarCatalogo(manejador, opciones) {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(manejador);
  const cargado = await cargarModulos(
    Object.assign({ documento: documento, fetch: peticiones }, opciones)
  );

  await cargado.Libreria.catalogo.iniciar();

  return {
    Libreria: cargado.Libreria,
    fetch: peticiones,
    documento: documento,
    tarjetas: function () {
      return documento.querySelectorAll('#catalogo-lista li');
    },
    elemento: function (id) {
      return documento.getElementById(id);
    }
  };
}

test('el catálogo pide la primera página y dibuja los datos de cada libro', async () => {
  const { fetch, tarjetas } = await montarCatalogo(function () {
    return respuestaJson([RAYUELA]);
  });

  assert.equal(fetch.llamadas.length, 1);
  assert.equal(fetch.llamadas[0].url, '/api/libros/?limit=20&offset=0');
  assert.equal(tarjetas().length, 1);

  const texto = textoDe(tarjetas()[0]);

  assert.ok(texto.indexOf('Rayuela') !== -1, texto);
  assert.ok(texto.indexOf('978-950-00-0001-1') !== -1, texto);
  assert.ok(texto.indexOf('$ 25.000,00') !== -1, texto);
  assert.ok(texto.indexOf('Sudamericana') !== -1, texto);
  assert.ok(texto.indexOf('Novela') !== -1, texto);
});

test('un libro sin género se muestra como «Sin clasificar» con su precio formateado', async () => {
  const { tarjetas } = await montarCatalogo(function () {
    return respuestaJson([SIN_GENERO]);
  });

  const texto = textoDe(tarjetas()[0]);

  assert.ok(texto.indexOf('Sin clasificar') !== -1, texto);
  assert.ok(texto.indexOf('$ 1.234,50') !== -1, texto);
  assert.equal(tarjetas()[0].querySelector('.insignia').className.indexOf('insignia--sin') !== -1, true);
});

function enviarBusqueda(documento, texto) {
  const formulario = documento.getElementById('form-busqueda');

  documento.getElementById('busqueda-titulo').value = texto;
  formulario.dispatchEvent(documento.crearEvento('submit'));
}

test('la búsqueda envía el título recortado y reemplaza el listado', async () => {
  const { fetch, documento, tarjetas } = await montarCatalogo(function (url) {
    if (url.indexOf('titulo=') !== -1) {
      return respuestaJson([RAYUELA]);
    }

    return respuestaJson(crearLibros(20));
  });

  enviarBusqueda(documento, '  Rayuela  ');
  await asentar();

  const ultima = fetch.llamadas[fetch.llamadas.length - 1];

  assert.equal(ultima.url, '/api/libros/?limit=20&offset=0&titulo=Rayuela');
  assert.equal(tarjetas().length, 1);
  assert.ok(textoDe(tarjetas()[0]).indexOf('Rayuela') !== -1);
});

test('una búsqueda desde la segunda página vuelve a offset 0 y borrar el filtro lista todo', async () => {
  const { fetch, documento, elemento } = await montarCatalogo(function () {
    return respuestaJson(crearLibros(20));
  });

  elemento('catalogo-siguiente').dispatchEvent(documento.crearEvento('click'));
  await asentar();
  assert.equal(fetch.llamadas[1].url, '/api/libros/?limit=20&offset=20');

  enviarBusqueda(documento, 'Rayuela');
  await asentar();
  assert.equal(fetch.llamadas[2].url, '/api/libros/?limit=20&offset=0&titulo=Rayuela');

  enviarBusqueda(documento, '   ');
  await asentar();
  assert.equal(fetch.llamadas[3].url, '/api/libros/?limit=20&offset=0');
});

test('la paginación deshabilita Anterior en 0 y Siguiente con página incompleta', async () => {
  const { documento, elemento } = await montarCatalogo(function () {
    return respuestaJson(crearLibros(7));
  });

  assert.equal(elemento('catalogo-anterior').disabled, true);
  assert.equal(elemento('catalogo-siguiente').disabled, true);
  assert.equal(elemento('catalogo-pagina').textContent, 'Página 1');
  assert.equal(elemento('catalogo-paginacion').hidden, false);
});

test('avanzar a la segunda página usa offset 20 y volver conserva el filtro activo', async () => {
  const { fetch, documento, elemento } = await montarCatalogo(function () {
    return respuestaJson(crearLibros(20));
  });

  enviarBusqueda(documento, 'Libro');
  await asentar();
  assert.equal(elemento('catalogo-siguiente').disabled, false);

  elemento('catalogo-siguiente').dispatchEvent(documento.crearEvento('click'));
  await asentar();
  assert.equal(
    fetch.llamadas[fetch.llamadas.length - 1].url,
    '/api/libros/?limit=20&offset=20&titulo=Libro'
  );
  assert.equal(elemento('catalogo-pagina').textContent, 'Página 2');
  assert.equal(elemento('catalogo-anterior').disabled, false);

  elemento('catalogo-anterior').dispatchEvent(documento.crearEvento('click'));
  await asentar();
  assert.equal(
    fetch.llamadas[fetch.llamadas.length - 1].url,
    '/api/libros/?limit=20&offset=0&titulo=Libro'
  );
  assert.equal(elemento('catalogo-pagina').textContent, 'Página 1');
  assert.equal(elemento('catalogo-anterior').disabled, true);
});

const DETALLE_RAYUELA = Object.assign({}, RAYUELA, {
  autores: [
    { autor_id: 1, nombre: 'Julio Cortázar', rol: 'autor', orden: 1 },
    { autor_id: 2, nombre: 'Ricardo Piglia', rol: 'coautor', orden: 2 }
  ]
});

test('abrir el detalle consulta el libro por identificador y muestra sus autorías', async () => {
  const { documento, fetch, elemento, tarjetas } = await montarCatalogo(function (url) {
    if (url === '/api/libros/1') {
      return respuestaJson(DETALLE_RAYUELA);
    }

    return respuestaJson([RAYUELA]);
  });

  tarjetas()[0]
    .querySelector('button[data-libro-id]')
    .dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(fetch.llamadas.length, 2);
  assert.equal(fetch.llamadas[1].url, '/api/libros/1');
  assert.equal(elemento('catalogo-detalle').hidden, false);
  assert.equal(elemento('catalogo-detalle-titulo').textContent, 'Rayuela');

  const datos = textoDe(elemento('catalogo-detalle-datos'));
  assert.ok(datos.indexOf('978-950-00-0001-1') !== -1, datos);
  assert.ok(datos.indexOf('Sudamericana') !== -1, datos);
  assert.ok(datos.indexOf('Novela') !== -1, datos);
  assert.ok(datos.indexOf('$ 25.000,00') !== -1, datos);
  assert.ok(datos.indexOf('10') !== -1, datos);

  const autorias = elemento('catalogo-detalle-autores').querySelectorAll('li');
  assert.equal(autorias.length, 2);
  assert.ok(textoDe(autorias[0]).indexOf('Julio Cortázar') !== -1);
  assert.ok(textoDe(autorias[0]).indexOf('autor') !== -1);
  assert.ok(textoDe(autorias[0]).indexOf('orden 1') !== -1);
  assert.ok(textoDe(autorias[1]).indexOf('Ricardo Piglia') !== -1);
});

test('el cierre del detalle limpia el contenido y conserva el catálogo', async () => {
  const { documento, elemento, tarjetas } = await montarCatalogo(function (url) {
    if (url === '/api/libros/1') {
      return respuestaJson(DETALLE_RAYUELA);
    }

    return respuestaJson([RAYUELA]);
  });

  tarjetas()[0]
    .querySelector('button[data-libro-id]')
    .dispatchEvent(documento.crearEvento('click'));
  await asentar();

  elemento('catalogo-detalle-cerrar').dispatchEvent(documento.crearEvento('click'));

  assert.equal(elemento('catalogo-detalle').hidden, true);
  assert.equal(elemento('catalogo-detalle-titulo').textContent, 'Libro');
  assert.equal(elemento('catalogo-detalle-datos').childNodes.length, 0);
  assert.equal(elemento('catalogo-detalle-autores').childNodes.length, 0);
  assert.equal(tarjetas().length, 1);
});

test('mientras la primera página carga se muestra «Cargando…» y aria-busy', async () => {
  const { documento } = crearPagina();
  const peticiones = [];
  let resolver = null;
  const pendiente = new Promise(function (listo) {
    resolver = listo;
  });
  const fetch = fetchFalso(function () {
    peticiones.push('consulta');
    return pendiente;
  });
  const cargado = await cargarModulos({ documento: documento, fetch: fetch });
  const promesa = cargado.Libreria.catalogo.iniciar();

  assert.equal(documento.getElementById('catalogo-cargando').hidden, false);
  assert.equal(documento.getElementById('catalogo').getAttribute('aria-busy'), 'true');

  resolver(respuestaJson([RAYUELA]));
  await promesa;

  assert.equal(documento.getElementById('catalogo-cargando').hidden, true);
  assert.equal(documento.getElementById('catalogo').getAttribute('aria-busy'), null);
  assert.equal(documento.querySelectorAll('#catalogo-lista li').length, 1);
});

test('la biblioteca sin libros informa lista vacía y no búsqueda sin coincidencias', async () => {
  const { elemento } = await montarCatalogo(function () {
    return respuestaJson([]);
  });

  assert.equal(elemento('catalogo-vacio').hidden, false);
  assert.equal(elemento('catalogo-sin-resultados').hidden, true);
  assert.equal(elemento('catalogo-fin').hidden, true);
  assert.equal(elemento('catalogo-paginacion').hidden, true);
});

test('una búsqueda sin coincidencias conserva el texto buscado', async () => {
  const { documento, elemento } = await montarCatalogo(function () {
    return respuestaJson([]);
  });

  enviarBusqueda(documento, 'zzz');
  await asentar();

  assert.equal(elemento('catalogo-sin-resultados').hidden, false);
  assert.equal(elemento('catalogo-vacio').hidden, true);
  assert.equal(elemento('busqueda-titulo').value, 'zzz');
});

test('una página posterior vacía avisa el fin y vuelve a la última página con datos', async () => {
  const { documento, elemento, fetch } = await montarCatalogo(function (url) {
    if (url.indexOf('offset=20') !== -1) {
      return respuestaJson([]);
    }

    return respuestaJson(crearLibros(20));
  });

  elemento('catalogo-siguiente').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('catalogo-fin').hidden, false);
  assert.equal(elemento('catalogo-vacio').hidden, true);
  assert.equal(elemento('catalogo-sin-resultados').hidden, true);
  assert.equal(elemento('catalogo-pagina').textContent, 'Página 1');
  assert.equal(fetch.llamadas.length, 3);
  assert.equal(fetch.llamadas[2].url, '/api/libros/?limit=20&offset=0');
});

test('un fallo de conexión al cargar muestra error con reintento y no el estado vacío', async () => {
  const { elemento } = await montarCatalogo(function () {
    throw new TypeError('Failed to fetch');
  });

  assert.equal(elemento('catalogo-error').hidden, false);
  assert.equal(elemento('catalogo-reintentar').hidden, false);
  assert.equal(elemento('catalogo-vacio').hidden, true);
  assert.ok(textoDe(elemento('catalogo-error')).toLowerCase().indexOf('conectar') !== -1);
});

test('el reintento de una búsqueda fallida repite el mismo título y desplazamiento', async () => {
  let falla = true;
  const { documento, elemento, fetch } = await montarCatalogo(function () {
    if (falla) {
      throw new TypeError('Failed to fetch');
    }

    return respuestaJson([RAYUELA]);
  });

  enviarBusqueda(documento, 'Rayuela');
  await asentar();

  assert.equal(elemento('catalogo-error').hidden, false);
  falla = false;
  elemento('catalogo-reintentar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  const intentos = fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('titulo=Rayuela') !== -1;
  });

  assert.equal(intentos.length, 2);
  assert.equal(intentos[1].url, '/api/libros/?limit=20&offset=0&titulo=Rayuela');
  assert.equal(elemento('catalogo-error').hidden, true);
});

test('el error del detalle no rompe el catálogo y permite reintentar', async () => {
  let falla = true;
  const { documento, elemento, tarjetas } = await montarCatalogo(function (url) {
    if (url === '/api/libros/1') {
      if (falla) {
        throw new TypeError('Failed to fetch');
      }

      return respuestaJson(DETALLE_RAYUELA);
    }

    return respuestaJson([RAYUELA]);
  });

  tarjetas()[0]
    .querySelector('button[data-libro-id]')
    .dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('catalogo-detalle-error').hidden, false);
  assert.equal(elemento('catalogo-detalle-reintentar').hidden, false);
  assert.equal(tarjetas().length, 1);

  falla = false;
  elemento('catalogo-detalle-reintentar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('catalogo-detalle-error').hidden, true);
  assert.equal(elemento('catalogo-detalle-titulo').textContent, 'Rayuela');
});
