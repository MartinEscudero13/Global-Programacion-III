import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson, respuestaError, textoDe, asentar } from './ayudas.mjs';

const LIBROS = [
  {
    id: 1,
    isbn: '978-950-00-0001-1',
    titulo: 'Rayuela',
    precio: '1500.00',
    stock: 10,
    editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
    genero: { id: 1, nombre: 'Novela' }
  },
  {
    id: 4,
    isbn: '978-950-00-0004-2',
    titulo: 'Respiración artificial',
    precio: '2000.00',
    stock: 8,
    editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
    genero: { id: 1, nombre: 'Novela' }
  }
];

const CLIENTE = {
  id: 2,
  nombre: 'Jorge Ramírez',
  email: 'jorge@example.com',
  perfil: null
};

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

function respuestaBase(url, opciones, extra) {
  if (extra) {
    const respuesta = extra(url, opciones);

    if (respuesta !== undefined) {
      return respuesta;
    }
  }

  if (url.indexOf('/api/clientes/') === 0) {
    return respuestaJson(CLIENTE);
  }

  if (url === '/api/ventas/' && (opciones.method || 'GET') === 'POST') {
    return respuestaJson(VENTA, 201);
  }

  if (url === '/api/ventas/5') {
    return respuestaJson(VENTA);
  }

  if (url.indexOf('/api/ventas/') === 0) {
    return respuestaJson([]);
  }

  if (url.indexOf('/api/libros/') === 0) {
    return respuestaJson(LIBROS);
  }

  return respuestaJson([]);
}

async function montarVentas(extra, opciones) {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(function (url, configuracion) {
    return respuestaBase(url, configuracion, extra);
  });
  const cargado = await cargarModulos(
    Object.assign({ documento: documento, fetch: peticiones }, opciones)
  );

  await cargado.Libreria.ventas.iniciar();

  return {
    Libreria: cargado.Libreria,
    fetch: peticiones,
    documento: documento,
    elemento: function (id) {
      return documento.getElementById(id);
    },
    filas: function () {
      return documento.querySelectorAll('#tabla-renglones tbody tr');
    }
  };
}

function verificarCliente(documento, elemento, identificador) {
  elemento('venta-cliente-id').value = String(identificador);
  elemento('venta-buscar-cliente').dispatchEvent(documento.crearEvento('click'));
}

function agregarRenglon(documento, elemento, libroId, cantidad) {
  elemento('venta-libro').value = String(libroId);
  elemento('venta-cantidad').value = String(cantidad);
  documento
    .getElementById('form-venta')
    .dispatchEvent(documento.crearEvento('submit'));
}

function confirmar(documento, elemento) {
  elemento('venta-confirmar').dispatchEvent(documento.crearEvento('click'));
}

function envios(fetch) {
  return fetch.llamadas.filter(function (llamada) {
    return llamada.url === '/api/ventas/' && llamada.metodo === 'POST';
  });
}

test('verificar el cliente muestra el nombre devuelto por la API', async () => {
  const { documento, elemento, fetch } = await montarVentas();

  verificarCliente(documento, elemento, 2);
  await asentar();

  const consultas = fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('/api/clientes/') === 0;
  });

  assert.equal(consultas[0].url, '/api/clientes/2');
  assert.ok(textoDe(elemento('venta-cliente-nombre')).indexOf('Jorge Ramírez') !== -1);
  assert.equal(elemento('venta-cliente-error').hidden, true);
});

test('cambiar el identificador invalida el nombre verificado hasta consultar de nuevo', async () => {
  const { documento, elemento } = await montarVentas();

  verificarCliente(documento, elemento, 2);
  await asentar();
  assert.ok(textoDe(elemento('venta-cliente-nombre')).indexOf('Jorge Ramírez') !== -1);

  elemento('venta-cliente-id').value = '3';
  elemento('venta-cliente-id').dispatchEvent(documento.crearEvento('input'));

  assert.equal(textoDe(elemento('venta-cliente-nombre')), '');
});

test('un cliente inexistente muestra el mensaje y conserva los renglones', async () => {
  const { documento, elemento } = await montarVentas(function (url) {
    if (url === '/api/clientes/99') {
      return respuestaError(404, { detail: 'El cliente indicado no existe' });
    }

    return undefined;
  });

  agregarRenglon(documento, elemento, 1, 2);
  verificarCliente(documento, elemento, 99);
  await asentar();

  assert.equal(elemento('venta-cliente-error').hidden, false);
  assert.equal(textoDe(elemento('venta-cliente-error')), 'El cliente indicado no existe');
  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 1);
});

test('confirmar sin cliente verificado no envía la venta', async () => {
  const { documento, elemento, fetch } = await montarVentas();

  elemento('venta-cliente-id').value = '2';
  agregarRenglon(documento, elemento, 1, 2);
  confirmar(documento, elemento);
  await asentar();

  assert.equal(envios(fetch).length, 0);
  assert.equal(elemento('venta-mensaje').hidden, false);
  assert.ok(textoDe(elemento('venta-mensaje')).toLowerCase().indexOf('verificá') !== -1);
});

test('el selector de libros ofrece título e ISBN de la API', async () => {
  const { elemento, fetch } = await montarVentas();
  const opciones = elemento('venta-libro').querySelectorAll('option');
  const pedidos = fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('/api/libros/') === 0;
  });

  assert.equal(pedidos[0].url, '/api/libros/?limit=100&offset=0');
  assert.equal(opciones.length, 3);
  assert.ok(textoDe(opciones[1]).indexOf('Rayuela') !== -1);
  assert.ok(textoDe(opciones[1]).indexOf('978-950-00-0001-1') !== -1);
});

test('si la lista de libros quedó truncada se avisa', async () => {
  const cien = Array.from({ length: 100 }, function (_, indice) {
    return {
      id: indice + 1,
      isbn: '978-950-00-' + String(indice + 1).padStart(4, '0') + '-1',
      titulo: 'Libro ' + (indice + 1),
      precio: '1000.00',
      stock: 1,
      editorial: LIBROS[0].editorial,
      genero: null
    };
  });

  const { elemento, documento } = await montarVentas(function (url) {
    if (url.indexOf('/api/libros/') === 0) {
      return respuestaJson(cien);
    }

    return undefined;
  });

  assert.equal(elemento('venta-mensaje').hidden, false);
  assert.ok(textoDe(elemento('venta-mensaje')).indexOf('incompleta') !== -1);
  assert.equal(documento.getElementById('venta-libro').querySelectorAll('option').length, 2001);
});

test('el fallo al cargar los libros muestra error con reintento', async () => {
  let falla = true;
  const { documento, elemento } = await montarVentas(function (url) {
    if (url.indexOf('/api/libros/') === 0 && falla) {
      throw new TypeError('Failed to fetch');
    }

    return undefined;
  });

  assert.equal(elemento('venta-libros-error').hidden, false);
  assert.equal(elemento('venta-reintentar').hidden, false);
  assert.equal(elemento('venta-libro').querySelectorAll('option').length, 0);

  falla = false;
  elemento('venta-reintentar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('venta-libros-error').hidden, true);
  assert.equal(elemento('venta-libro').querySelectorAll('option').length, 3);
});

async function montarVentaEHistorial(extra) {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(function (url, configuracion) {
    return respuestaBase(url, configuracion, extra);
  });
  const cargado = await cargarModulos({ documento: documento, fetch: peticiones });

  await cargado.Libreria.historial.iniciar();
  await cargado.Libreria.ventas.iniciar();

  return {
    Libreria: cargado.Libreria,
    fetch: peticiones,
    documento: documento,
    elemento: function (id) {
      return documento.getElementById(id);
    }
  };
}

function prepararVenta(documento, elemento) {
  verificarCliente(documento, elemento, 2);
  agregarRenglon(documento, elemento, 1, 2);
  agregarRenglon(documento, elemento, 4, 1);
}

test('el borrador muestra la estimación de artículos y total', async () => {
  const { documento, elemento } = await montarVentas();

  prepararVenta(documento, elemento);
  await asentar();

  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 2);
  assert.equal(elemento('venta-articulos').textContent, '3');
  assert.equal(elemento('venta-total').textContent, '$ 5.000,00');
  assert.equal(elemento('venta-vacio').hidden, true);
});

test('agregar un libro repetido actualiza la cantidad sin crear otro renglón', async () => {
  const { documento, elemento } = await montarVentas();

  agregarRenglon(documento, elemento, 1, 1);
  agregarRenglon(documento, elemento, 1, 2);

  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 1);
  assert.equal(elemento('venta-articulos').textContent, '3');
  assert.equal(elemento('venta-total').textContent, '$ 4.500,00');
  assert.ok(textoDe(elemento('venta-mensaje')).indexOf('ya estaba') !== -1);
});

test('cantidades cero, negativas o decimales no agregan renglones', async () => {
  const { documento, elemento } = await montarVentas();

  [0, -2, 1.5].forEach(function (cantidad) {
    agregarRenglon(documento, elemento, 1, cantidad);
  });

  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 0);
  assert.equal(elemento('venta-mensaje').hidden, false);
});

test('quitar un renglón recalcula el resumen', async () => {
  const { documento, elemento } = await montarVentas();

  prepararVenta(documento, elemento);
  elemento('tabla-renglones')
    .querySelectorAll('tbody tr')[0]
    .querySelector('button[data-libro-id]')
    .dispatchEvent(documento.crearEvento('click'));

  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 1);
  assert.equal(elemento('venta-articulos').textContent, '1');
  assert.equal(elemento('venta-total').textContent, '$ 2.000,00');
});

test('cambiar la cantidad recalcula el subtotal y la estimación sin pedir nada', async () => {
  const { documento, elemento, fetch } = await montarVentas();

  agregarRenglon(documento, elemento, 1, 1);
  const antes = fetch.llamadas.length;
  const control = elemento('tabla-renglones').querySelector('input[data-libro-id]');

  control.value = '3';
  control.dispatchEvent(documento.crearEvento('change'));

  const fila = documento.querySelectorAll('#tabla-renglones tbody tr')[0];

  assert.equal(fetch.llamadas.length, antes);
  assert.equal(elemento('venta-articulos').textContent, '3');
  assert.equal(elemento('venta-total').textContent, '$ 4.500,00');
  assert.ok(textoDe(fila).indexOf('$ 4.500,00') !== -1, textoDe(fila));
});

test('confirmar envía el cuerpo exacto y muestra los importes del servidor', async () => {
  const { documento, elemento, fetch } = await montarVentas();

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);
  await asentar();

  const peticiones = envios(fetch);
  const texto = textoDe(elemento('venta-confirmada'));

  assert.equal(peticiones.length, 1);
  assert.deepEqual(JSON.parse(peticiones[0].cuerpo), {
    cliente_id: 2,
    renglones: [
      { libro_id: 1, cantidad: 2 },
      { libro_id: 4, cantidad: 1 }
    ]
  });
  assert.equal(elemento('venta-confirmada').hidden, false);
  assert.ok(texto.indexOf('venta 5') !== -1, texto);
  assert.ok(texto.indexOf('Jorge Ramírez') !== -1, texto);
  assert.ok(texto.indexOf('2 × Rayuela') !== -1, texto);
  assert.ok(texto.indexOf('$ 1.500,00') !== -1, texto);
  assert.ok(texto.indexOf('$ 3.000,00') !== -1, texto);
  assert.ok(texto.indexOf('$ 2.000,00') !== -1, texto);
  assert.ok(texto.indexOf('Total: $ 5.000,00') !== -1, texto);
});

test('al confirmar se limpia el borrador y el cliente verificado', async () => {
  const { documento, elemento } = await montarVentas();

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);
  await asentar();

  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 0);
  assert.equal(elemento('venta-articulos').textContent, '0');
  assert.equal(elemento('venta-total').textContent, '$ 0,00');
  assert.equal(elemento('venta-cliente-id').value, '');
  assert.equal(textoDe(elemento('venta-cliente-nombre')), '');
  assert.equal(elemento('venta-vacio').hidden, false);
});

test('el botón de confirmar queda deshabilitado mientras el envío está en curso', async () => {
  let resolver = null;
  const pendiente = new Promise(function (listo) {
    resolver = listo;
  });
  const { documento, elemento } = await montarVentas(function (url, opciones) {
    if (url === '/api/ventas/' && opciones.method === 'POST') {
      return pendiente;
    }

    return undefined;
  });

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);

  assert.equal(elemento('venta-confirmar').disabled, true);
  assert.equal(elemento('venta-envio').hidden, false);

  resolver(respuestaJson(VENTA, 201));
  await asentar();

  assert.equal(elemento('venta-confirmar').disabled, false);
  assert.equal(elemento('venta-envio').hidden, true);
});

test('la confirmación muestra los importes de la respuesta y no los calculados', async () => {
  const alterada = {
    id: 6,
    fecha: '2026-11-15T12:00:00.000000Z',
    total: '9999.00',
    cliente: VENTA.cliente,
    renglones: [
      {
        libro_id: 1,
        titulo: 'Rayuela',
        cantidad: 2,
        precio_unitario: '4999.50',
        subtotal: '9999.00'
      }
    ]
  };
  const { documento, elemento } = await montarVentas(function (url, opciones) {
    if (url === '/api/ventas/' && opciones.method === 'POST') {
      return respuestaJson(alterada, 201);
    }

    return undefined;
  });

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);
  await asentar();

  const texto = textoDe(elemento('venta-confirmada'));

  assert.ok(texto.indexOf('$ 4.999,50') !== -1, texto);
  assert.ok(texto.indexOf('Total: $ 9.999,00') !== -1, texto);
  assert.equal(texto.indexOf('$ 5.000,00'), -1);
});

test('tras confirmar se refresca el historial y no se modifica si falla', async () => {
  const { documento, elemento, fetch } = await montarVentaEHistorial();

  const paginas = function () {
    return fetch.llamadas.filter(function (llamada) {
      return llamada.url === '/api/ventas/?limit=20&offset=0' && llamada.metodo === 'GET';
    });
  };

  assert.equal(paginas().length, 1);

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);
  await asentar();

  assert.equal(paginas().length, 2);
});

test('un 409 conserva el borrador, rehabilita el botón y deja el historial igual', async () => {
  const { documento, elemento, fetch } = await montarVentaEHistorial(function (url, opciones) {
    if (url === '/api/ventas/' && opciones.method === 'POST') {
      return respuestaError(409, { detail: 'El libro indicado no existe' });
    }

    return undefined;
  });

  const paginas = function () {
    return fetch.llamadas.filter(function (llamada) {
      return llamada.url === '/api/ventas/?limit=20&offset=0' && llamada.metodo === 'GET';
    });
  };

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);
  await asentar();

  assert.equal(elemento('venta-mensaje').hidden, false);
  assert.equal(textoDe(elemento('venta-mensaje')), 'El libro indicado no existe');
  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 2);
  assert.ok(textoDe(elemento('venta-cliente-nombre')).indexOf('Jorge Ramírez') !== -1);
  assert.equal(elemento('venta-confirmar').disabled, false);
  assert.equal(elemento('venta-confirmada').hidden, true);
  assert.equal(paginas().length, 1);
});

test('un 422 muestra el detalle legible y conserva los renglones', async () => {
  const { documento, elemento } = await montarVentas(function (url, opciones) {
    if (url === '/api/ventas/' && opciones.method === 'POST') {
      return respuestaError(422, {
        detail: [
          {
            loc: ['body'],
            msg: 'Value error, El libro no puede repetirse en la venta',
            type: 'value_error'
          }
        ]
      });
    }

    return undefined;
  });

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);
  await asentar();

  const mensaje = textoDe(elemento('venta-mensaje'));

  assert.ok(mensaje.indexOf('repetirse') !== -1, mensaje);
  assert.equal(mensaje.indexOf('Value error'), -1);
  assert.equal(documento.querySelectorAll('#tabla-renglones tbody tr').length, 2);
});

test('tras el rechazo se corrige un renglón y el reenvío usa el cuerpo nuevo', async () => {
  let intentos = 0;
  const { documento, elemento, fetch } = await montarVentas(function (url, opciones) {
    if (url === '/api/ventas/' && opciones.method === 'POST') {
      intentos += 1;

      if (intentos === 1) {
        return respuestaError(409, { detail: 'El libro indicado no existe' });
      }

      return respuestaJson(VENTA, 201);
    }

    return undefined;
  });

  prepararVenta(documento, elemento);
  await asentar();
  confirmar(documento, elemento);
  await asentar();

  const control = documento
    .getElementById('tabla-renglones')
    .querySelectorAll('tbody tr')[1]
    .querySelector('input[data-libro-id]');

  control.value = '2';
  control.dispatchEvent(documento.crearEvento('change'));
  confirmar(documento, elemento);
  await asentar();

  const peticiones = envios(fetch);

  assert.equal(peticiones.length, 2);
  assert.deepEqual(JSON.parse(peticiones[1].cuerpo), {
    cliente_id: 2,
    renglones: [
      { libro_id: 1, cantidad: 2 },
      { libro_id: 4, cantidad: 2 }
    ]
  });
});
