import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson } from './ayudas.mjs';

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
