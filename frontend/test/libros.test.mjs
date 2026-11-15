import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson, respuestaError, textoDe, asentar } from './ayudas.mjs';

const EDITORIALES = [
  { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
  { id: 2, nombre: 'Anagrama', pais: 'España' }
];

const GENEROS = [
  { id: 1, nombre: 'Novela' },
  { id: 2, nombre: 'Ensayo' }
];

const LIBROS = [
  {
    id: 1,
    isbn: '978-950-00-0001-1',
    titulo: 'Rayuela',
    precio: '25000.00',
    stock: 10,
    editorial: { id: 1, nombre: 'Sudamericana', pais: 'Argentina' },
    genero: { id: 1, nombre: 'Novela' }
  }
];

function respuestaBase(url, opciones, extra) {
  if (extra) {
    const respuesta = extra(url, opciones);

    if (respuesta !== undefined) {
      return respuesta;
    }
  }

  if (url.indexOf('/api/editoriales/') === 0) {
    return respuestaJson(EDITORIALES);
  }

  if (url.indexOf('/api/generos/') === 0) {
    return respuestaJson(GENEROS);
  }

  if (url.indexOf('/api/autores/') === 0) {
    return respuestaJson({ id: 4, nombre: 'Lucía Ferrer', nacionalidad: 'Argentina' });
  }

  if (url === '/api/libros/' && (opciones.method || 'GET') === 'POST') {
    return respuestaJson(
      {
        id: 9,
        isbn: '978-950-00-0009-9',
        titulo: 'Libro nuevo',
        precio: '1500.00',
        stock: 3,
        editorial: EDITORIALES[0],
        genero: null,
        autores: []
      },
      201
    );
  }

  if (url.indexOf('/api/libros/') === 0) {
    return respuestaJson(LIBROS);
  }

  if (extra) {
    return extra(url, opciones);
  }

  return respuestaJson([]);
}

async function montarLibros(extra, opciones) {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(function (url, configuracion) {
    return respuestaBase(url, configuracion, extra);
  });
  const cargado = await cargarModulos(
    Object.assign({ documento: documento, fetch: peticiones }, opciones)
  );

  await cargado.Libreria.libros.iniciar();

  return {
    Libreria: cargado.Libreria,
    fetch: peticiones,
    documento: documento,
    elemento: function (id) {
      return documento.getElementById(id);
    },
    opcionesDe: function (id) {
      return documento.getElementById(id).querySelectorAll('option');
    },
    filas: function () {
      return documento.querySelectorAll('#tabla-libros tbody tr');
    }
  };
}

test('las editoriales y los géneros se cargan recorriendo las páginas de la API', async () => {
  const { fetch, opcionesDe } = await montarLibros();

  const pedidosEditoriales = fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('/api/editoriales/') === 0;
  });
  const pedidosGeneros = fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('/api/generos/') === 0;
  });

  assert.equal(pedidosEditoriales.length, 1);
  assert.equal(pedidosEditoriales[0].url, '/api/editoriales/?limit=100&offset=0');
  assert.equal(pedidosGeneros[0].url, '/api/generos/?limit=100&offset=0');

  const editoriales = opcionesDe('libro-editorial');
  assert.equal(editoriales.length, 3);
  assert.equal(editoriales[0].value, '');
  assert.equal(editoriales[1].textContent, 'Sudamericana');
  assert.equal(editoriales[2].value, '2');

  const generos = opcionesDe('libro-genero');
  assert.equal(generos[0].textContent, 'Sin clasificar');
  assert.equal(generos[1].value, '1');
});

test('si las opciones no cargan se avisa con reintento y no se puede registrar', async () => {
  const { elemento } = await montarLibros(function (url) {
    if (url.indexOf('/api/editoriales/') === 0) {
      throw new TypeError('Failed to fetch');
    }

    return undefined;
  });

  assert.equal(elemento('libro-opciones-error').hidden, false);
  assert.equal(elemento('libro-opciones-reintentar').hidden, false);
  assert.equal(elemento('libro-registrar').disabled, true);
  assert.equal(elemento('libro-editorial').querySelectorAll('option').length, 0);
});

test('el reintento completa los selectores y deja el formulario utilizable', async () => {
  let falla = true;
  const { elemento, documento } = await montarLibros(function (url) {
    if (url.indexOf('/api/editoriales/') === 0 && falla) {
      throw new TypeError('Failed to fetch');
    }

    return undefined;
  });

  falla = false;
  elemento('libro-opciones-reintentar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('libro-opciones-error').hidden, true);
  assert.equal(elemento('libro-registrar').disabled, false);
  assert.equal(elemento('libro-editorial').querySelectorAll('option').length, 3);
  assert.equal(elemento('libro-genero').querySelectorAll('option')[0].textContent, 'Sin clasificar');
});

test('las 150 editoriales se piden en dos páginas y se ofrecen completas', async () => {
  const muchas = Array.from({ length: 150 }, function (_, indice) {
    return { id: indice + 1, nombre: 'Editorial ' + (indice + 1), pais: 'Argentina' };
  });

  const { elemento, fetch } = await montarLibros(function (url) {
    if (url.indexOf('/api/editoriales/') === 0) {
      const coincidencia = /offset=(\d+)/.exec(url);
      const desplazamiento = Number(coincidencia[1]);
      return respuestaJson(muchas.slice(desplazamiento, desplazamiento + 100));
    }

    return undefined;
  });

  const pedidos = fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('/api/editoriales/') === 0;
  });

  assert.equal(pedidos.length, 2);
  assert.equal(elemento('libro-editorial').querySelectorAll('option').length, 151);
  assert.equal(textoDe(elemento('libro-editorial').querySelectorAll('option')[150]), 'Editorial 150');
});

async function agregarAutor(documento, elemento, identificador, rol) {
  elemento('libro-autor-id').value = String(identificador);
  elemento('libro-autor-buscar').dispatchEvent(documento.crearEvento('click'));
  await asentar();
  elemento('libro-autor-rol').value = rol || 'autor';
  elemento('libro-autor-agregar').dispatchEvent(documento.crearEvento('click'));
}

function completarFormulario(elemento) {
  elemento('libro-titulo').value = 'Libro nuevo';
  elemento('libro-isbn').value = '978-950-00-0009-9';
  elemento('libro-precio').value = '1500';
  elemento('libro-stock').value = '3';
  elemento('libro-editorial').value = '1';
}

function enviarAlta(documento) {
  documento
    .getElementById('form-libro')
    .dispatchEvent(documento.crearEvento('submit'));
}

function altas(fetch) {
  return fetch.llamadas.filter(function (llamada) {
    return llamada.url === '/api/libros/' && llamada.metodo === 'POST';
  });
}

test('el autor se verifica por identificador y se agrega con rol y orden', async () => {
  const { documento, elemento, fetch } = await montarLibros();

  await agregarAutor(documento, elemento, 4, 'traductor');

  const consultas = fetch.llamadas.filter(function (llamada) {
    return llamada.url === '/api/autores/4';
  });
  const items = elemento('libro-autorias').querySelectorAll('li');

  assert.equal(consultas.length, 1);
  assert.equal(items.length, 1);
  assert.ok(textoDe(items[0]).indexOf('Lucía Ferrer') !== -1, textoDe(items[0]));
  assert.ok(textoDe(items[0]).indexOf('traductor') !== -1);
  assert.ok(textoDe(items[0]).indexOf('orden 1') !== -1);
  assert.equal(elemento('libro-autor-id').value, '');
  assert.equal(elemento('libro-autor-agregar').disabled, true);
});

test('un autor inexistente muestra el mensaje del servidor y no se agrega', async () => {
  const { documento, elemento } = await montarLibros(function (url) {
    if (url.indexOf('/api/autores/') === 0) {
      return respuestaError(404, { detail: 'El autor indicado no existe' });
    }

    return undefined;
  });

  elemento('libro-autor-id').value = '77';
  elemento('libro-autor-buscar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('libro-autor-error').hidden, false);
  assert.equal(textoDe(elemento('libro-autor-error')), 'El autor indicado no existe');
  assert.equal(elemento('libro-autor-agregar').disabled, true);
  assert.equal(elemento('libro-autorias').querySelectorAll('li').length, 0);
});

test('agregar dos veces el mismo autor no duplica la autoría', async () => {
  const { documento, elemento } = await montarLibros();

  await agregarAutor(documento, elemento, 4, 'autor');
  await agregarAutor(documento, elemento, 4, 'coautor');

  assert.equal(elemento('libro-autorias').querySelectorAll('li').length, 1);
  assert.ok(textoDe(elemento('libro-autor-error')).indexOf('ya está') !== -1);
});

test('quitar una autoría la borra de la lista y reordena las restantes', async () => {
  const { documento, elemento } = await montarLibros(function (url) {
    if (url === '/api/autores/1') {
      return respuestaJson({ id: 1, nombre: 'Julio Cortázar' });
    }

    if (url === '/api/autores/2') {
      return respuestaJson({ id: 2, nombre: 'Ricardo Piglia' });
    }

    return undefined;
  });

  await agregarAutor(documento, elemento, 1, 'autor');
  await agregarAutor(documento, elemento, 2, 'coautor');

  const items = elemento('libro-autorias').querySelectorAll('li');
  assert.equal(items.length, 2);
  assert.ok(textoDe(items[1]).indexOf('orden 2') !== -1);

  items[0]
    .querySelector('button[data-autor-id]')
    .dispatchEvent(documento.crearEvento('click'));

  const restantes = elemento('libro-autorias').querySelectorAll('li');
  assert.equal(restantes.length, 1);
  assert.ok(textoDe(restantes[0]).indexOf('Ricardo Piglia') !== -1);
  assert.ok(textoDe(restantes[0]).indexOf('orden 1') !== -1);
});

test('un formulario incompleto no envía ninguna petición y marca cada campo', async () => {
  const { documento, elemento, fetch } = await montarLibros();

  enviarAlta(documento);
  await asentar();

  assert.equal(altas(fetch).length, 0);
  assert.equal(elemento('libro-titulo-error').hidden, false);
  assert.equal(elemento('libro-isbn-error').hidden, false);
  assert.equal(elemento('libro-precio-error').hidden, false);
  assert.equal(elemento('libro-stock-error').hidden, false);
  assert.equal(elemento('libro-editorial-error').hidden, false);
  assert.equal(elemento('libro-autor-error').hidden, false);
});

test('stock negativo o decimal y precio cero se rechazan sin enviar', async () => {
  const { documento, elemento, fetch } = await montarLibros();

  completarFormulario(elemento);
  elemento('libro-stock').value = '-1';
  elemento('libro-precio').value = '0';
  enviarAlta(documento);
  await asentar();

  assert.equal(elemento('libro-stock-error').hidden, false);
  assert.equal(elemento('libro-precio-error').hidden, false);
  assert.equal(altas(fetch).length, 0);

  elemento('libro-stock').value = '1.5';
  elemento('libro-precio').value = '1500';
  enviarAlta(documento);
  await asentar();

  assert.equal(elemento('libro-stock-error').hidden, false);
  assert.equal(altas(fetch).length, 0);
});

test('un alta válida envía el cuerpo del contrato y confirma con los datos devueltos', async () => {
  const { documento, elemento, fetch } = await montarLibros();

  completarFormulario(elemento);
  await agregarAutor(documento, elemento, 4, 'traductor');
  enviarAlta(documento);
  await asentar();

  const peticiones = altas(fetch);

  assert.equal(peticiones.length, 1);
  assert.equal(peticiones[0].cabeceras['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(peticiones[0].cuerpo), {
    isbn: '978-950-00-0009-9',
    titulo: 'Libro nuevo',
    precio: '1500.00',
    stock: 3,
    editorial_id: 1,
    autores: [{ autor_id: 4, rol: 'traductor', orden: 1 }]
  });

  assert.equal(elemento('libro-exito').hidden, false);
  assert.ok(textoDe(elemento('libro-exito')).indexOf('Libro nuevo') !== -1);
  assert.ok(textoDe(elemento('libro-exito')).indexOf('9') !== -1);
  assert.equal(elemento('libro-titulo').value, '');
  assert.equal(elemento('libro-autorias').querySelectorAll('li').length, 0);
});

test('el alta sin género omite genero_id y el libro aparece en la tabla y en el catálogo', async () => {
  let creado = false;
  const nuevo = {
    id: 9,
    isbn: '978-950-00-0009-9',
    titulo: 'Libro nuevo',
    precio: '1500.00',
    stock: 3,
    editorial: EDITORIALES[0],
    genero: null
  };
  const { documento, elemento, fetch, Libreria } = await montarLibros(function (url, opciones) {
    if (url === '/api/libros/' && opciones.method === 'POST') {
      creado = true;
      return respuestaJson(nuevo, 201);
    }

    if (url.indexOf('/api/libros/') === 0 && creado) {
      return respuestaJson([nuevo].concat(LIBROS));
    }

    return undefined;
  });

  await Libreria.catalogo.iniciar();
  completarFormulario(elemento);
  await agregarAutor(documento, elemento, 4, 'autor');
  enviarAlta(documento);
  await asentar();

  const cuerpo = JSON.parse(altas(fetch)[0].cuerpo);

  assert.equal(Object.prototype.hasOwnProperty.call(cuerpo, 'genero_id'), false);
  assert.equal(elemento('tabla-libros').querySelectorAll('tbody tr').length, 2);
  assert.equal(documento.querySelectorAll('#catalogo-lista li').length, 2);
  assert.ok(
    textoDe(documento.getElementById('catalogo-lista')).indexOf('Libro nuevo') !== -1
  );
});

test('un 409 del alta muestra el mensaje del servidor y conserva los campos', async () => {
  const { documento, elemento, fetch } = await montarLibros(function (url, opciones) {
    if (url === '/api/libros/' && opciones.method === 'POST') {
      return respuestaError(409, { detail: 'El ISBN ya está registrado' });
    }

    return undefined;
  });

  completarFormulario(elemento);
  await agregarAutor(documento, elemento, 4, 'autor');
  enviarAlta(documento);
  await asentar();

  assert.equal(elemento('libro-mensaje').hidden, false);
  assert.equal(textoDe(elemento('libro-mensaje')), 'El ISBN ya está registrado');
  assert.equal(elemento('libro-exito').hidden, true);
  assert.equal(elemento('libro-titulo').value, 'Libro nuevo');
  assert.equal(elemento('libro-autorias').querySelectorAll('li').length, 1);
  assert.equal(elemento('libro-registrar').disabled, false);
  assert.equal(altas(fetch).length, 1);
});

test('un 422 del alta se muestra como texto legible', async () => {
  const { documento, elemento } = await montarLibros(function (url, opciones) {
    if (url === '/api/libros/' && opciones.method === 'POST') {
      return respuestaError(422, {
        detail: [
          {
            loc: ['body', 'precio'],
            msg: 'Input should be greater than 0',
            type: 'greater_than',
            ctx: { gt: 0 }
          }
        ]
      });
    }

    return undefined;
  });

  completarFormulario(elemento);
  await agregarAutor(documento, elemento, 4, 'autor');
  enviarAlta(documento);
  await asentar();

  const mensaje = textoDe(elemento('libro-mensaje'));

  assert.equal(elemento('libro-mensaje').hidden, false);
  assert.ok(mensaje.indexOf('precio') !== -1, mensaje);
  assert.ok(mensaje.indexOf('mayor que 0') !== -1, mensaje);
  assert.ok(mensaje.indexOf('[object') === -1, mensaje);
});

test('tras el 409 se corrige el ISBN y el reenvío conserva los demás campos', async () => {
  let intentos = 0;
  const { documento, elemento, fetch } = await montarLibros(function (url, opciones) {
    if (url === '/api/libros/' && opciones.method === 'POST') {
      intentos += 1;

      if (intentos === 1) {
        return respuestaError(409, { detail: 'El ISBN ya está registrado' });
      }

      return respuestaJson({ id: 9, titulo: 'Libro nuevo' }, 201);
    }

    return undefined;
  });

  completarFormulario(elemento);
  await agregarAutor(documento, elemento, 4, 'autor');
  enviarAlta(documento);
  await asentar();

  elemento('libro-isbn').value = '978-950-00-0099-9';
  elemento('libro-precio').value = '2000';
  enviarAlta(documento);
  await asentar();

  const peticiones = altas(fetch);
  const cuerpo = JSON.parse(peticiones[1].cuerpo);

  assert.equal(peticiones.length, 2);
  assert.equal(cuerpo.isbn, '978-950-00-0099-9');
  assert.equal(cuerpo.titulo, 'Libro nuevo');
  assert.equal(cuerpo.precio, '2000.00');
  assert.equal(cuerpo.stock, 3);
  assert.deepEqual(cuerpo.autores, [{ autor_id: 4, rol: 'autor', orden: 1 }]);
  assert.equal(elemento('libro-exito').hidden, false);
});

test('la tabla de libros pide la primera página y deshabilita Anterior', async () => {
  const veinte = Array.from({ length: 40 }, function (_, indice) {
    return {
      id: indice + 1,
      isbn: '978-950-00-' + String(indice + 1).padStart(4, '0') + '-1',
      titulo: 'Libro ' + (indice + 1),
      precio: '1000.00',
      stock: 1,
      editorial: EDITORIALES[0],
      genero: null
    };
  });

  const { elemento, documento, fetch } = await montarLibros(function (url) {
    if (url.indexOf('/api/libros/') === 0 && url.indexOf('offset') !== -1) {
      const coincidencia = /offset=(\d+)/.exec(url);
      const desplazamiento = Number(coincidencia[1]);
      return respuestaJson(veinte.slice(desplazamiento, desplazamiento + 20));
    }

    return undefined;
  });

  const pedidos = fetch.llamadas.filter(function (llamada) {
    return llamada.url.indexOf('/api/libros/') === 0;
  });

  assert.equal(pedidos[0].url, '/api/libros/?limit=20&offset=0');
  assert.equal(elemento('tabla-libros').querySelectorAll('tbody tr').length, 20);
  assert.equal(elemento('libros-anterior').disabled, true);
  assert.equal(elemento('libros-siguiente').disabled, false);
  assert.equal(elemento('libros-pagina').textContent, 'Página 1');
  assert.equal(elemento('libros-vacio').hidden, true);

  elemento('libros-siguiente').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(
    fetch.llamadas[fetch.llamadas.length - 1].url,
    '/api/libros/?limit=20&offset=20'
  );
  assert.equal(elemento('libros-pagina').textContent, 'Página 2');

  elemento('libros-anterior').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(
    fetch.llamadas[fetch.llamadas.length - 1].url,
    '/api/libros/?limit=20&offset=0'
  );
});

test('una página incompleta deshabilita Siguiente y una vacía informa el vacío', async () => {
  const cinco = Array.from({ length: 5 }, function (_, indice) {
    return {
      id: indice + 1,
      isbn: '978-950-00-' + String(indice + 1).padStart(4, '0') + '-1',
      titulo: 'Libro ' + (indice + 1),
      precio: '1000.00',
      stock: 1,
      editorial: EDITORIALES[0],
      genero: null
    };
  });

  const conCinco = await montarLibros(function (url) {
    if (url.indexOf('/api/libros/') === 0 && url.indexOf('offset') !== -1) {
      return respuestaJson(cinco);
    }

    return undefined;
  });

  assert.equal(conCinco.elemento('libros-siguiente').disabled, true);
  assert.equal(conCinco.elemento('tabla-libros').querySelectorAll('tbody tr').length, 5);

  const vacio = await montarLibros(function (url) {
    if (url.indexOf('/api/libros/') === 0 && url.indexOf('offset') !== -1) {
      return respuestaJson([]);
    }

    return undefined;
  });

  assert.equal(vacio.elemento('libros-vacio').hidden, false);
  assert.equal(vacio.elemento('libros-paginacion').hidden, true);
});

test('el error de la tabla muestra reintento y vuelve a pedir la misma página', async () => {
  let falla = true;
  const { documento, elemento, fetch } = await montarLibros(function (url) {
    if (url.indexOf('/api/libros/') === 0 && url.indexOf('offset') !== -1) {
      if (falla) {
        throw new TypeError('Failed to fetch');
      }

      return respuestaJson(LIBROS);
    }

    return undefined;
  });

  assert.equal(elemento('libros-error').hidden, false);
  assert.equal(elemento('libros-reintentar').hidden, false);
  assert.equal(elemento('libros-vacio').hidden, true);

  falla = false;
  elemento('libros-reintentar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('libros-error').hidden, true);
  assert.equal(elemento('tabla-libros').querySelectorAll('tbody tr').length, 1);
  assert.equal(
    fetch.llamadas[fetch.llamadas.length - 1].url,
    '/api/libros/?limit=20&offset=0'
  );
});

test('escribir en el identificador invalida la verificación sin borrar el valor', async () => {
  const { documento, elemento } = await montarLibros();

  elemento('libro-autor-id').value = '4';
  elemento('libro-autor-id').dispatchEvent(documento.crearEvento('input'));

  assert.equal(elemento('libro-autor-id').value, '4');

  elemento('libro-autor-buscar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.ok(textoDe(elemento('libro-autor-nombre')).indexOf('Lucía Ferrer') !== -1);
  assert.equal(elemento('libro-autor-agregar').disabled, false);

  elemento('libro-autor-id').value = '5';
  elemento('libro-autor-id').dispatchEvent(documento.crearEvento('input'));

  assert.equal(textoDe(elemento('libro-autor-nombre')), '');
  assert.equal(elemento('libro-autor-agregar').disabled, true);
});

test('tras un alta la tabla se ubica en la página donde quedó el libro creado', async () => {
  const viejos = Array.from({ length: 25 }, function (_, indice) {
    return {
      id: indice + 1,
      isbn: '978-950-00-' + String(indice + 1).padStart(4, '0') + '-1',
      titulo: 'Libro ' + (indice + 1),
      precio: '1000.00',
      stock: 1,
      editorial: EDITORIALES[0],
      genero: null
    };
  });
  const nuevo = {
    id: 99,
    isbn: '978-950-00-0099-9',
    titulo: 'Libro nuevo',
    precio: '1500.00',
    stock: 3,
    editorial: EDITORIALES[0],
    genero: null
  };
  let creado = false;
  const { documento, elemento } = await montarLibros(function (url, opciones) {
    if (url === '/api/libros/' && opciones.method === 'POST') {
      creado = true;
      return respuestaJson(nuevo, 201);
    }

    if (url.indexOf('/api/libros/') === 0 && url.indexOf('offset') !== -1) {
      const libros = creado ? viejos.concat([nuevo]) : viejos;
      const coincidencia = /offset=(\d+)/.exec(url);
      const desplazamiento = Number(coincidencia[1]);

      return respuestaJson(libros.slice(desplazamiento, desplazamiento + 20));
    }

    return undefined;
  });

  completarFormulario(elemento);
  await agregarAutor(documento, elemento, 4, 'autor');
  enviarAlta(documento);
  await asentar(12);

  const filas = documento.querySelectorAll('#tabla-libros tbody tr');

  assert.equal(elemento('libros-pagina').textContent, 'Página 2');
  assert.equal(filas.length, 6);
  assert.ok(textoDe(filas[5]).indexOf('Libro nuevo') !== -1, textoDe(filas[5]));
});
