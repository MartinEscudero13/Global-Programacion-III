import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos, scriptsDePagina } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson } from './ayudas.mjs';

test('carga los scripts declarados en index.html y publica los módulos', async () => {
  const { documento } = crearPagina();
  const { Libreria } = await cargarModulos({
    documento,
    fetch: fetchFalso(function () {
      return respuestaJson([]);
    })
  });

  assert.equal(typeof Libreria.utils.formatearPrecio, 'function');
  assert.equal(typeof Libreria.catalogo.iniciar, 'function');
  assert.equal(typeof Libreria.utils.TEXTO_SIN_GENERO, 'string');
});

test('el cargador respeta el orden de los src del HTML', () => {
  const scripts = scriptsDePagina();

  assert.equal(scripts[0], 'js/api.js');
  assert.equal(scripts[scripts.length - 1], 'js/app.js');
});

test('fetchFalso registra URL, método y cuerpo de cada petición', async () => {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(function (url) {
    if (url.indexOf('clientes') !== -1) {
      return respuestaJson({ id: 9, nombre: 'Ana', email: 'ana@example.com' }, 201);
    }

    return respuestaJson([]);
  });

  await cargarModulos({ documento, fetch: peticiones });

  const respuesta = await peticiones('/api/clientes/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Ana' })
  });

  assert.equal(peticiones.llamadas.length, 1);
  assert.equal(peticiones.llamadas[0].url, '/api/clientes/');
  assert.equal(peticiones.llamadas[0].metodo, 'POST');
  assert.equal(JSON.parse(peticiones.llamadas[0].cuerpo).nombre, 'Ana');
  assert.equal(respuesta.status, 201);
});
