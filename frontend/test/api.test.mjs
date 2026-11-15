import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import {
  fetchFalso,
  respuestaJson,
  respuestaError,
  respuestaHtml,
  cuerpoDe,
  llamadasA
} from './ayudas.mjs';

async function cargarApi(manejador, opciones) {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(manejador);
  const cargado = await cargarModulos(
    Object.assign({ documento: documento, fetch: peticiones }, opciones)
  );

  return { api: cargado.Libreria.api, Libreria: cargado.Libreria, fetch: peticiones };
}

test('listarLibros usa la base /api y conserva la barra final de la colección', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson([]);
  });

  const libros = await api.listarLibros({});

  assert.equal(libros.length, 0);
  assert.equal(fetch.llamadas.length, 1);
  assert.equal(fetch.llamadas[0].url, '/api/libros/?limit=20&offset=0');
  assert.equal(fetch.llamadas[0].metodo, 'GET');
});

test('obtenerLibro pide el recurso por identificador, sin barra final', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson({ id: 7, titulo: 'Rayuela' });
  });

  const libro = await api.obtenerLibro(7);

  assert.equal(libro.titulo, 'Rayuela');
  assert.equal(fetch.llamadas[0].url, '/api/libros/7');
});

test('obtenerVenta y crearCliente usan las rutas del contrato', async () => {
  const { api, fetch } = await cargarApi(function (url) {
    if (url === '/api/ventas/3') {
      return respuestaJson({ id: 3, total: '5000.00' });
    }

    return respuestaJson({ id: 9, nombre: 'Ana', email: 'ana@example.com' }, 201);
  });

  const venta = await api.obtenerVenta(3);
  const cliente = await api.crearCliente({
    nombre: 'Ana',
    email: 'ana@example.com'
  });

  assert.equal(venta.total, '5000.00');
  assert.equal(cliente.id, 9);
  assert.equal(fetch.llamadas[0].url, '/api/ventas/3');
  assert.equal(fetch.llamadas[1].url, '/api/clientes/');
  assert.equal(fetch.llamadas[1].metodo, 'POST');
  assert.deepEqual(cuerpoDe(fetch.llamadas[1]), {
    nombre: 'Ana',
    email: 'ana@example.com'
  });
});

test('la búsqueda recorta el título, lo codifica y omite el filtro vacío', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson([]);
  });

  await api.listarLibros({ titulo: '  Jardín  ' });
  await api.listarLibros({ titulo: '   ' });

  assert.ok(fetch.llamadas[0].url.indexOf('titulo=Jard%C3%ADn') !== -1);
  assert.equal(
    fetch.llamadas[0].url,
    '/api/libros/?limit=20&offset=0&titulo=Jard%C3%ADn'
  );
  assert.equal(fetch.llamadas[1].url, '/api/libros/?limit=20&offset=0');
});

test('el género se agrega sólo cuando está indicado y la paginación se respeta', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson([]);
  });

  await api.listarLibros({ titulo: 'sur', generoId: 2, limit: 5, offset: 10 });
  await api.listarLibros({ generoId: 0, limit: 100, offset: 0 });

  assert.equal(
    fetch.llamadas[0].url,
    '/api/libros/?limit=5&offset=10&titulo=sur&genero_id=2'
  );
  assert.equal(fetch.llamadas[1].url, '/api/libros/?limit=100&offset=0');
});

test('crearLibro envía price como string, editorial, género y autorías en JSON', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson({ id: 12, titulo: 'Nuevo' }, 201);
  });

  const cuerpo = {
    isbn: '978-950-00-0012-3',
    titulo: 'Nuevo',
    precio: '1500.00',
    stock: 3,
    editorial_id: 1,
    genero_id: 2,
    autores: [{ autor_id: 4, rol: 'traductor', orden: 1 }]
  };
  const creado = await api.crearLibro(cuerpo);

  assert.equal(creado.id, 12);
  assert.equal(fetch.llamadas[0].url, '/api/libros/');
  assert.equal(fetch.llamadas[0].metodo, 'POST');
  assert.equal(fetch.llamadas[0].cabeceras['Content-Type'], 'application/json');
  assert.deepEqual(cuerpoDe(fetch.llamadas[0]), cuerpo);
});

test('crearVenta envía sólo cliente_id y renglones, en orden y sin otros campos', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson({ id: 8, total: '77000.00' }, 201);
  });

  const venta = await api.crearVenta({
    cliente_id: 2,
    renglones: [
      { libro_id: 1, cantidad: 2 },
      { libro_id: 4, cantidad: 1 }
    ]
  });

  assert.equal(venta.id, 8);
  assert.equal(fetch.llamadas[0].url, '/api/ventas/');
  assert.equal(fetch.llamadas[0].metodo, 'POST');
  assert.deepEqual(cuerpoDe(fetch.llamadas[0]), {
    cliente_id: 2,
    renglones: [
      { libro_id: 1, cantidad: 2 },
      { libro_id: 4, cantidad: 1 }
    ]
  });
  assert.deepEqual(Object.keys(cuerpoDe(fetch.llamadas[0])), ['cliente_id', 'renglones']);
});

test('listarVentas pagina con limit y offset', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson([]);
  });

  await api.listarVentas({ limit: 20, offset: 20 });

  assert.equal(fetch.llamadas[0].url, '/api/ventas/?limit=20&offset=20');
});

test('obtenerAutor y obtenerCliente consultan por identificador', async () => {
  const { api, fetch } = await cargarApi(function (url) {
    if (url === '/api/autores/4') {
      return respuestaJson({ id: 4, nombre: 'Lucía Ferrer', nacionalidad: 'Argentina' });
    }

    return respuestaJson({ id: 2, nombre: 'Jorge Ramírez', perfil: null });
  });

  const autor = await api.obtenerAutor(4);
  const cliente = await api.obtenerCliente(2);

  assert.equal(autor.nombre, 'Lucía Ferrer');
  assert.equal(cliente.nombre, 'Jorge Ramírez');
  assert.equal(fetch.llamadas[0].url, '/api/autores/4');
  assert.equal(fetch.llamadas[1].url, '/api/clientes/2');
  assert.equal(llamadasA(fetch.llamadas, '/api/autores/').length, 1);
});

function esperarErrorApi(promesa) {
  return promesa.then(
    function () {
      throw new Error('la promesa debía rechazar');
    },
    function (error) {
      return error;
    }
  );
}

test('un 409 se convierte en el mensaje del servidor', async () => {
  const { api } = await cargarApi(function () {
    return respuestaError(409, { detail: 'El ISBN ya está registrado' });
  });

  const error = await esperarErrorApi(api.crearLibro({ isbn: '1' }));

  assert.equal(error.nombre, 'ErrorApi');
  assert.equal(error.codigo, 'http');
  assert.equal(error.estado, 409);
  assert.equal(error.mensaje, 'El ISBN ya está registrado');
  assert.equal(error.message, 'El ISBN ya está registrado');
});

test('un 404 conserva el mensaje del servidor', async () => {
  const { api } = await cargarApi(function () {
    return respuestaError(404, { detail: 'El cliente indicado no existe' });
  });

  const error = await esperarErrorApi(api.obtenerCliente(99));

  assert.equal(error.codigo, 'http');
  assert.equal(error.estado, 404);
  assert.equal(error.mensaje, 'El cliente indicado no existe');
});

test('un 422 se traduce a una frase en español con campo y motivo', async () => {
  const { api } = await cargarApi(function () {
    return respuestaError(422, {
      detail: [
        {
          loc: ['body', 'renglones', 0, 'cantidad'],
          msg: 'Input should be greater than 0',
          type: 'greater_than',
          ctx: { gt: 0 }
        }
      ]
    });
  });

  const error = await esperarErrorApi(api.crearVenta({ cliente_id: 1 }));

  assert.equal(error.codigo, 'validacion');
  assert.equal(error.estado, 422);
  assert.ok(error.mensaje.indexOf('cantidad') !== -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('mayor que 0') !== -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('body') === -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('{') === -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('[object') === -1, error.mensaje);
});

test('el 422 une varios errores y descarta los prefijos de consulta', async () => {
  const { api } = await cargarApi(function () {
    return respuestaError(422, {
      detail: [
        {
          loc: ['query', 'limit'],
          msg: 'Input should be greater than or equal to 1',
          type: 'greater_than_equal',
          ctx: { ge: 1 }
        },
        {
          loc: ['body', 'cliente_id'],
          msg: 'Field required',
          type: 'missing'
        }
      ]
    });
  });

  const error = await esperarErrorApi(api.listarVentas({ limit: 0 }));

  assert.ok(error.mensaje.indexOf('limit') !== -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('cliente_id') !== -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('obligatorio') !== -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('query') === -1, error.mensaje);
  assert.ok(error.mensaje.indexOf('; ') !== -1, error.mensaje);
});

test('un fallo de red se distingue con codigo red y un mensaje de conexión', async () => {
  const { api } = await cargarApi(function () {
    throw new TypeError('Failed to fetch');
  });

  const error = await esperarErrorApi(api.listarLibros({}));

  assert.equal(error.codigo, 'red');
  assert.ok(error.mensaje.toLowerCase().indexOf('conectar') !== -1, error.mensaje);
  assert.equal(error.estado, 0);
});

test('una respuesta que no es JSON se informa como fallo de conexión', async () => {
  const { api } = await cargarApi(function () {
    return respuestaHtml('<html><body>502 Bad Gateway</body></html>');
  });

  const error = await esperarErrorApi(api.listarLibros({}));

  assert.equal(error.codigo, 'red');
});

test('el tiempo de espera agotado aborta la petición y avisa la demora', async () => {
  let senal = null;
  const { api } = await cargarApi(
    function (url, opciones) {
      senal = opciones.signal;
      return new Promise(function (resolver, rechazar) {
        if (opciones.signal.aborted) {
          rechazar(new Error('abortado'));
          return;
        }

        opciones.signal.addEventListener('abort', function () {
          rechazar(new Error('abortado'));
        });
      });
    },
    {
      temporizador: function (funcion) {
        return setTimeout(funcion, 0);
      }
    }
  );

  const promesa = esperarErrorApi(api.listarLibros({}));
  const error = await promesa;

  assert.equal(error.codigo, 'red');
  assert.ok(error.mensaje.toLowerCase().indexOf('demor') !== -1, error.mensaje);
  assert.equal(senal.aborted, true);
});

test('un 500 con JSON conserva codigo http y el mensaje del servidor', async () => {
  const { api } = await cargarApi(function () {
    return respuestaError(500, { detail: 'Error interno de la base' });
  });

  const error = await esperarErrorApi(api.obtenerLibro(1));

  assert.equal(error.codigo, 'http');
  assert.equal(error.estado, 500);
  assert.equal(error.mensaje, 'Error interno de la base');
});

test('listarTodas recorre páginas de 100 hasta una incompleta', async () => {
  const editoriales = [];
  for (let i = 1; i <= 150; i += 1) {
    editoriales.push({ id: i, nombre: 'Editorial ' + i, pais: 'Argentina' });
  }

  const { api, fetch } = await cargarApi(function (url) {
    const coincidencia = /offset=(\d+)/.exec(url);
    const desplazamiento = Number(coincidencia[1]);
    return respuestaJson(editoriales.slice(desplazamiento, desplazamiento + 100));
  });

  const resultado = await api.listarTodas('editoriales');

  assert.equal(resultado.items.length, 150);
  assert.equal(resultado.truncado, false);
  assert.equal(resultado.items[149].nombre, 'Editorial 150');
  assert.equal(fetch.llamadas.length, 2);
  assert.ok(fetch.llamadas[0].url.indexOf('limit=100') !== -1);
  assert.ok(fetch.llamadas[1].url.indexOf('offset=100') !== -1);
});

test('listarTodas se detiene en la guarda y avisa que truncó', async () => {
  const { api, fetch } = await cargarApi(function (url) {
    const coincidencia = /offset=(\d+)/.exec(url);
    const desplazamiento = Number(coincidencia[1]);

    return respuestaJson(
      Array.from({ length: 100 }, function (_, indice) {
        return { id: desplazamiento + indice + 1, nombre: 'Elemento' };
      })
    );
  });

  const resultado = await api.listarTodas('generos');

  assert.equal(resultado.truncado, true);
  assert.equal(resultado.items.length, 2000);
  assert.equal(fetch.llamadas.length, 20);
});

test('listarTodas con una colección vacía hace un solo pedido', async () => {
  const { api, fetch } = await cargarApi(function () {
    return respuestaJson([]);
  });

  const resultado = await api.listarTodas('libros');

  assert.equal(resultado.items.length, 0);
  assert.equal(resultado.truncado, false);
  assert.equal(fetch.llamadas.length, 1);
  assert.equal(fetch.llamadas[0].url, '/api/libros/?limit=100&offset=0');
});
