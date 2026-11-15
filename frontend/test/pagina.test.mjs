import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { crearPagina, compararIds, idsDeLaPagina } from './pagina.mjs';

const RUTA_HTML = fileURLToPath(new URL('../public/index.html', import.meta.url));

function idsDelHtml() {
  const html = readFileSync(RUTA_HTML, 'utf8');
  const coincidencias = html.matchAll(/\sid="([^"]+)"/g);
  return Array.from(coincidencias, function (coincidencia) {
    return coincidencia[1];
  });
}

test('el fixture replica exactamente los ids de index.html', () => {
  const { faltantes, sobrantes } = compararIds(idsDelHtml(), idsDeLaPagina(crearPagina()));

  assert.deepEqual(faltantes, [], 'ids de index.html que faltan en el fixture');
  assert.deepEqual(sobrantes, [], 'ids del fixture que no existen en index.html');
});

test('la comparación de ids informa el id que falta', () => {
  const pagina = crearPagina({ omitir: ['catalogo'] });
  const { faltantes } = compararIds(idsDelHtml(), idsDeLaPagina(pagina));

  assert.ok(faltantes.includes('catalogo'));
});
