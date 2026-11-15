import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { scriptsDePagina } from './cargar-modulos.mjs';

const RUTA_JS = fileURLToPath(new URL('../public/js/', import.meta.url));
const ARCHIVOS = [
  'api.js',
  'app.js',
  'books.js',
  'catalog.js',
  'clients.js',
  'history.js',
  'sales.js',
  'utils.js'
];

function leer(nombre) {
  return readFileSync(RUTA_JS + nombre, 'utf8');
}

function archivosDeJs() {
  return readdirSync(RUTA_JS)
    .filter(function (nombre) {
      return nombre.endsWith('.js');
    })
    .sort();
}

test('index.html carga los ocho scripts en el orden del diseño', () => {
  assert.deepEqual(scriptsDePagina(), [
    'js/api.js',
    'js/utils.js',
    'js/catalog.js',
    'js/books.js',
    'js/clients.js',
    'js/sales.js',
    'js/history.js',
    'js/app.js'
  ]);
});

test('public/js contiene sólo los ocho módulos del diseño', () => {
  assert.deepEqual(archivosDeJs(), ARCHIVOS);
});

test('ningún módulo usa HTML crudo ni persistencia en el navegador', () => {
  const prohibidas = [
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'document.write',
    'localStorage',
    'data.js',
    'store.js',
    'Libreria.datos',
    'Libreria.store'
  ];

  ARCHIVOS.forEach(function (nombre) {
    const contenido = leer(nombre);

    prohibidas.forEach(function (cadena) {
      assert.equal(
        contenido.indexOf(cadena),
        -1,
        nombre + ' no debe contener «' + cadena + '»'
      );
    });
  });
});

test('sólo la capa de API usa fetch y ninguna vista arma rutas /api', () => {
  ARCHIVOS.forEach(function (nombre) {
    const contenido = leer(nombre);

    if (nombre === 'api.js') {
      assert.ok(contenido.indexOf('fetch(') !== -1);
      return;
    }

    assert.equal(contenido.indexOf('fetch('), -1, nombre + ' no debe llamar a fetch');
    assert.equal(contenido.indexOf("'/api"), -1, nombre + ' no debe armar rutas /api');
  });
});

test('cada módulo es una IIFE con use strict que publica en window.Libreria', () => {
  ARCHIVOS.forEach(function (nombre) {
    const contenido = leer(nombre);

    assert.ok(contenido.indexOf("'use strict'") !== -1, nombre + ' sin use strict');
    assert.ok(contenido.indexOf('window.Libreria') !== -1, nombre + ' no publica en Libreria');
  });
});
