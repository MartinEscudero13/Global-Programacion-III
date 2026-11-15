import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson } from './ayudas.mjs';

async function cargarUtils() {
  const { documento } = crearPagina();
  const { Libreria } = await cargarModulos({
    documento: documento,
    fetch: fetchFalso(function () {
      return respuestaJson([]);
    })
  });

  return Libreria.utils;
}

test('parsearImporte convierte el string decimal de la API en número', async () => {
  const utils = await cargarUtils();

  assert.equal(utils.parsearImporte('25000.00'), 25000);
  assert.equal(utils.parsearImporte('1234.5'), 1234.5);
  assert.ok(Number.isNaN(utils.parsearImporte('no es un número')));
});

test('formatearPrecio acepta el string de la API y muestra dos decimales', async () => {
  const utils = await cargarUtils();

  assert.equal(utils.formatearPrecio('25000.00'), '$ 25.000,00');
  assert.equal(utils.formatearPrecio('1234.5'), '$ 1.234,50');
});

test('formatearFechaHora interpreta el ISO con Z como UTC y muestra la hora local', async () => {
  const utils = await cargarUtils();
  const iso = '2026-10-08T21:14:11.751581Z';
  const instante = new Date(iso);
  const dosDigitos = function (numero) {
    return String(numero).padStart(2, '0');
  };
  const esperado =
    dosDigitos(instante.getDate()) +
    '/' +
    dosDigitos(instante.getMonth() + 1) +
    '/' +
    instante.getFullYear() +
    ' ' +
    dosDigitos(instante.getHours()) +
    ':' +
    dosDigitos(instante.getMinutes());

  assert.equal(utils.formatearFechaHora(iso), esperado);
});

test('los microsegundos del ISO no alteran el instante mostrado', async () => {
  const utils = await cargarUtils();

  assert.equal(
    utils.formatearFechaHora('2026-10-08T21:14:11.751581Z'),
    utils.formatearFechaHora('2026-10-08T21:14:11Z')
  );
});
