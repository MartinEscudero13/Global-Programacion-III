import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson, textoDe, asentar } from './ayudas.mjs';

const VENTA = {
  id: 5,
  fecha: '2026-11-15T12:00:00.000000Z',
  total: '5000.00',
  cliente: { id: 2, nombre: 'Jorge Ramírez', email: 'jorge@example.com' },
  renglones: [
    {
      libro_id: 1,
      titulo: 'Rayuela',
      cantidad: 2,
      precio_unitario: '1500.00',
      subtotal: '3000.00'
    },
    {
      libro_id: 4,
      titulo: 'Respiración artificial',
      cantidad: 1,
      precio_unitario: '2000.00',
      subtotal: '2000.00'
    }
  ]
};

function ventasFalsas(cantidad, desde) {
  const inicio = desde === undefined ? 1 : desde;

  return Array.from({ length: cantidad }, function (_, indice) {
    const id = inicio + indice;

    return {
      id: id,
      fecha: '2026-11-0' + ((id % 9) + 1) + 'T12:00:00.000000Z',
      total: '1000.00',
      cliente: { id: 2, nombre: 'Cliente ' + id, email: 'cliente' + id + '@example.com' },
      renglones: [
        {
          libro_id: 1,
          titulo: 'Rayuela',
          cantidad: 1,
          precio_unitario: '1000.00',
          subtotal: '1000.00'
        }
      ]
    };
  });
}

async function montarHistorial(manejador, opciones) {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(manejador);
  const cargado = await cargarModulos(
    Object.assign({ documento: documento, fetch: peticiones }, opciones)
  );

  await cargado.Libreria.historial.iniciar();

  return {
    Libreria: cargado.Libreria,
    fetch: peticiones,
    documento: documento,
    elemento: function (id) {
      return documento.getElementById(id);
    },
    filas: function () {
      return documento.querySelectorAll('#tabla-historial tbody tr');
    },
    abrirDetalle: function (indice) {
      const fila = documento.querySelectorAll('#tabla-historial tbody tr')[indice || 0];

      fila
        .querySelector('button[data-venta-id]')
        .dispatchEvent(documento.crearEvento('click'));
    }
  };
}

function paginas(fetch) {
  return fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('/api/ventas/?limit') === 0 && llamada.metodo === 'GET';
  });
}

function fechaLocal(iso) {
  const instante = new Date(iso);
  const dos = function (numero) {
    return String(numero).padStart(2, '0');
  };

  return (
    dos(instante.getDate()) +
    '/' +
    dos(instante.getMonth() + 1) +
    '/' +
    instante.getFullYear() +
    ' ' +
    dos(instante.getHours()) +
    ':' +
    dos(instante.getMinutes())
  );
}

test('el historial pide la primera página y pagina con el criterio compartido', async () => {
  const { elemento, fetch, filas, documento } = await montarHistorial(function (url) {
    const coincidencia = /offset=(\d+)/.exec(url);

    if (coincidencia) {
      const desplazamiento = Number(coincidencia[1]);
      return respuestaJson(ventasFalsas(40).slice(desplazamiento, desplazamiento + 20));
    }

    return respuestaJson(VENTA);
  });

  assert.equal(paginas(fetch)[0].url, '/api/ventas/?limit=20&offset=0');
  assert.equal(filas().length, 20);
  assert.equal(elemento('historial-anterior').disabled, true);
  assert.equal(elemento('historial-siguiente').disabled, false);
  assert.equal(elemento('historial-pagina').textContent, 'Página 1');
  assert.equal(elemento('historial-vacio').hidden, true);

  elemento('historial-siguiente').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(filas().length, 20);
  assert.equal(elemento('historial-pagina').textContent, 'Página 2');
  assert.equal(elemento('historial-anterior').disabled, false);

  elemento('historial-anterior').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(paginas(fetch)[paginas(fetch).length - 1].url, '/api/ventas/?limit=20&offset=0');
  assert.equal(elemento('historial-pagina').textContent, 'Página 1');
});

test('un historial vacío informa que no hay ventas', async () => {
  const { elemento } = await montarHistorial(function () {
    return respuestaJson([]);
  });

  assert.equal(elemento('historial-vacio').hidden, false);
  assert.equal(elemento('historial-paginacion').hidden, true);
  assert.equal(elemento('historial-error').hidden, true);
});

test('el error del historial se distingue del vacío y se puede reintentar', async () => {
  let falla = true;
  const { elemento, documento, fetch } = await montarHistorial(function () {
    if (falla) {
      throw new TypeError('Failed to fetch');
    }

    return respuestaJson([VENTA]);
  });

  assert.equal(elemento('historial-error').hidden, false);
  assert.equal(elemento('historial-vacio').hidden, true);

  falla = false;
  elemento('historial-reintentar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('historial-error').hidden, true);
  assert.equal(documento.querySelectorAll('#tabla-historial tbody tr').length, 1);
  assert.equal(paginas(fetch)[paginas(fetch).length - 1].url, '/api/ventas/?limit=20&offset=0');
});

test('el detalle consulta la venta y muestra fecha local, renglones y total', async () => {
  const { elemento, fetch, abrirDetalle, documento } = await montarHistorial(function (url) {
    if (url === '/api/ventas/5') {
      return respuestaJson(VENTA);
    }

    return respuestaJson([VENTA]);
  });

  abrirDetalle(0);
  await asentar();

  const consultas = fetch.llamadas.filter(function (llamada) {
    return llamada.url === '/api/ventas/5';
  });
  const renglones = documento.querySelectorAll('#detalle-renglones tbody tr');
  const meta = textoDe(elemento('detalle-meta'));

  assert.equal(consultas.length, 1);
  assert.equal(elemento('detalle-venta').hidden, false);
  assert.equal(elemento('detalle-titulo').textContent, 'Venta 5');
  assert.ok(meta.indexOf(fechaLocal(VENTA.fecha)) !== -1, meta);
  assert.ok(meta.indexOf('Jorge Ramírez') !== -1, meta);
  assert.equal(renglones.length, 2);
  assert.ok(textoDe(renglones[0]).indexOf('$ 1.500,00') !== -1);
  assert.ok(textoDe(renglones[0]).indexOf('$ 3.000,00') !== -1);
  assert.ok(textoDe(renglones[1]).indexOf('$ 2.000,00') !== -1);
  assert.equal(elemento('detalle-total').textContent, '$ 5.000,00');
});

test('el error del detalle no rompe el historial y el reintento no repite la página', async () => {
  let falla = true;
  const { elemento, documento, abrirDetalle, fetch } = await montarHistorial(function (url) {
    if (url === '/api/ventas/5') {
      if (falla) {
        throw new TypeError('Failed to fetch');
      }

      return respuestaJson(VENTA);
    }

    return respuestaJson([VENTA]);
  });

  abrirDetalle(0);
  await asentar();

  assert.equal(elemento('detalle-error').hidden, false);
  assert.equal(elemento('detalle-reintentar').hidden, false);
  assert.equal(documento.querySelectorAll('#tabla-historial tbody tr').length, 1);

  const antes = paginas(fetch).length;
  falla = false;
  elemento('detalle-reintentar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('detalle-error').hidden, true);
  assert.equal(elemento('detalle-titulo').textContent, 'Venta 5');
  assert.equal(paginas(fetch).length, antes);
});

test('el detalle se reconstruye igual tras recargar la página', async () => {
  const manejador = function (url) {
    if (url === '/api/ventas/5') {
      return respuestaJson(VENTA);
    }

    return respuestaJson([VENTA]);
  };

  const primera = await montarHistorial(manejador);
  primera.abrirDetalle(0);
  await asentar();
  const textoAntes = textoDe(primera.elemento('detalle-venta'));

  const segunda = await montarHistorial(manejador);
  segunda.abrirDetalle(0);
  await asentar();

  assert.equal(textoDe(segunda.elemento('detalle-venta')), textoAntes);
  assert.equal(segunda.elemento('detalle-total').textContent, '$ 5.000,00');
});

test('el detalle conserva los importes históricos aunque el catálogo tenga otro precio', async () => {
  const conPrecioNuevo = {
    id: 5,
    fecha: VENTA.fecha,
    total: '5000.00',
    cliente: VENTA.cliente,
    renglones: VENTA.renglones
  };
  const { elemento, abrirDetalle } = await montarHistorial(function (url) {
    if (url === '/api/ventas/5') {
      return respuestaJson(conPrecioNuevo);
    }

    if (url.indexOf('/api/libros/') === 0) {
      return respuestaJson([
        {
          id: 1,
          isbn: '978-950-00-0001-1',
          titulo: 'Rayuela',
          precio: '99999.00',
          stock: 10,
          editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
          genero: null
        }
      ]);
    }

    return respuestaJson([VENTA]);
  });

  abrirDetalle(0);
  await asentar();

  assert.equal(elemento('detalle-total').textContent, '$ 5.000,00');
  assert.ok(
    textoDe(elemento('detalle-venta')).indexOf('$ 1.500,00') !== -1
  );
  assert.equal(textoDe(elemento('detalle-venta')).indexOf('$ 99.999,00'), -1);
});
