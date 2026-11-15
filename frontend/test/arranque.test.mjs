import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson, textoDe, asentar } from './ayudas.mjs';

test('los módulos del HTML exponen la capa de API', async () => {
  const { documento } = crearPagina();
  const { Libreria } = await cargarModulos({
    documento: documento,
    fetch: fetchFalso(function () {
      return respuestaJson([]);
    })
  });

  assert.equal(typeof Libreria.api, 'object');
  assert.equal(typeof Libreria.api.listarLibros, 'function');
  assert.equal(typeof Libreria.api.obtenerLibro, 'function');
});

test('api.js es el primer script de js/ del documento', async () => {
  const { scriptsDePagina } = await import('./cargar-modulos.mjs');
  const scripts = scriptsDePagina();

  assert.equal(scripts[0], 'js/api.js');
  assert.equal(scripts.filter(function (src) {
    return src === 'js/api.js';
  }).length, 1);
});

function respuestaCompleta(url, opciones) {
  if (url.indexOf('/api/editoriales/') === 0) {
    throw new TypeError('Failed to fetch');
  }

  if (url.indexOf('/api/generos/') === 0) {
    return respuestaJson([{ id: 1, nombre: 'Novela' }]);
  }

  if (url.indexOf('/api/libros/') === 0) {
    return respuestaJson([
      {
        id: 1,
        isbn: '978-950-00-0001-1',
        titulo: 'Rayuela',
        precio: '25000.00',
        stock: 10,
        editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
        genero: { id: 1, nombre: 'Novela' }
      }
    ]);
  }

  if (url.indexOf('/api/ventas/') === 0) {
    return respuestaJson([]);
  }

  return respuestaJson([]);
}

test('al arrancar, una vista con error no impide inicializar las demás', async () => {
  const { documento } = crearPagina();
  const registros = [];
  const consola = {
    log: function () {},
    info: function () {},
    warn: function () {},
    error: function () {
      registros.push(Array.prototype.slice.call(arguments));
    }
  };
  const cargado = await cargarModulos({
    documento: documento,
    fetch: fetchFalso(respuestaCompleta),
    consola: consola
  });

  documento.dispatchEvent(documento.crearEvento('DOMContentLoaded'));
  await asentar(10);

  assert.equal(cargado.Libreria.catalogo !== undefined, true);
  assert.equal(documento.querySelectorAll('#catalogo-lista li').length, 1);
  assert.equal(documento.querySelectorAll('#tabla-libros tbody tr').length, 1);
  assert.equal(documento.getElementById('libro-opciones-error').hidden, false);
  assert.equal(documento.getElementById('clientes-vacio').hidden, false);
  assert.equal(documento.getElementById('venta-libro').querySelectorAll('option').length, 2);
  assert.equal(documento.getElementById('historial-vacio').hidden, false);
  assert.deepEqual(registros, []);
});

test('el router marca el enlace de la vista activa al arrancar', async () => {
  const { documento } = crearPagina();
  const cargado = await cargarModulos({
    documento: documento,
    fetch: fetchFalso(respuestaCompleta),
    location: { hash: '#ventas', origin: 'http://127.0.0.1:8080' }
  });

  documento.dispatchEvent(documento.crearEvento('DOMContentLoaded'));
  await asentar(6);

  const enlaces = documento.querySelectorAll('.nav-principal__enlace');
  const activos = enlaces.filter(function (enlace) {
    return enlace.getAttribute('aria-current') === 'location';
  });

  assert.equal(activos.length, 1);
  assert.equal(activos[0].getAttribute('href'), '#ventas');
  assert.equal(typeof cargado.Libreria.api.listarLibros, 'function');
});

test('las claves viejas de localStorage no alteran las vistas ni se reescriben', async () => {
  const { documento } = crearPagina();
  const escrituras = [];
  const sembrado = {
    'libreria.v1.libros': JSON.stringify([
      { id: 'l1', titulo: 'Libro viejo', isbn: 'viejo', precio: 1 }
    ]),
    'libreria.v1.clientes': JSON.stringify([
      { id: 'c1', nombre: 'Cliente viejo', email: 'viejo@example.com' }
    ]),
    'libreria.v1.ventas': JSON.stringify([
      { id: 'V-0001', clienteNombre: 'Cliente viejo', total: 1, renglones: [] }
    ])
  };
  const localStorage = {
    getItem: function (clave) {
      return Object.prototype.hasOwnProperty.call(sembrado, clave) ? sembrado[clave] : null;
    },
    setItem: function (clave, valor) {
      escrituras.push([clave, valor]);
    },
    removeItem: function () {
      escrituras.push('remove');
    }
  };
  const venta = {
    id: 4,
    fecha: '2026-11-15T12:00:00.000000Z',
    total: '25000.00',
    cliente: { id: 2, nombre: 'Jorge Ramírez', email: 'jorge@example.com' },
    renglones: [
      {
        libro_id: 1,
        titulo: 'Rayuela',
        cantidad: 1,
        precio_unitario: '25000.00',
        subtotal: '25000.00'
      }
    ]
  };

  await cargarModulos({
    documento: documento,
    localStorage: localStorage,
    fetch: fetchFalso(function (url) {
      if (url.indexOf('/api/ventas/') === 0) {
        return respuestaJson([venta]);
      }

      return respuestaCompleta(url, { method: 'GET' });
    })
  });

  documento.dispatchEvent(documento.crearEvento('DOMContentLoaded'));
  await asentar(10);

  const catalogo = textoDe(documento.getElementById('catalogo-lista'));
  const historial = textoDe(documento.getElementById('tabla-historial'));

  assert.ok(catalogo.indexOf('Rayuela') !== -1, catalogo);
  assert.equal(catalogo.indexOf('Libro viejo'), -1);
  assert.ok(historial.indexOf('Jorge Ramírez') !== -1, historial);
  assert.equal(historial.indexOf('Cliente viejo'), -1);
  assert.equal(documento.getElementById('clientes-vacio').hidden, false);
  assert.deepEqual(escrituras, []);
});

