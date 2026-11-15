import test from 'node:test';
import assert from 'node:assert/strict';

import { crearPagina } from './pagina.mjs';
import { cargarModulos } from './cargar-modulos.mjs';
import { fetchFalso, respuestaJson, respuestaError, textoDe, asentar } from './ayudas.mjs';

const ANA = { id: 7, nombre: 'Ana Gómez', email: 'ana@example.com', perfil: null };

async function montarClientes(manejador, opciones) {
  const { documento } = crearPagina();
  const peticiones = fetchFalso(manejador);
  const cargado = await cargarModulos(
    Object.assign({ documento: documento, fetch: peticiones }, opciones)
  );

  await cargado.Libreria.clientes.iniciar();

  return {
    Libreria: cargado.Libreria,
    fetch: peticiones,
    documento: documento,
    elemento: function (id) {
      return documento.getElementById(id);
    },
    filas: function () {
      return documento.querySelectorAll('#tabla-clientes tbody tr');
    }
  };
}

function altas(fetch) {
  return fetch.llamadas.filter(function (llamada) {
    return llamada.url === '/api/clientes/' && llamada.metodo === 'POST';
  });
}

function completar(documento, elemento, nombre, email) {
  elemento('cliente-nombre').value = nombre;
  elemento('cliente-email').value = email;
  documento
    .getElementById('form-cliente')
    .dispatchEvent(documento.crearEvento('submit'));
}

test('el alta envía nombre y email y agrega el cliente devuelto por el servidor', async () => {
  const { documento, elemento, fetch } = await montarClientes(function () {
    return respuestaJson(ANA, 201);
  });

  completar(documento, elemento, '  Ana Gómez  ', 'Ana@Example.com');
  await asentar();

  const peticiones = altas(fetch);

  assert.equal(peticiones.length, 1);
  assert.deepEqual(JSON.parse(peticiones[0].cuerpo), {
    nombre: 'Ana Gómez',
    email: 'Ana@Example.com'
  });
  assert.equal(elemento('cliente-exito').hidden, false);
  assert.ok(textoDe(elemento('cliente-exito')).indexOf('Ana Gómez') !== -1);

  const filas = documento.querySelectorAll('#tabla-clientes tbody tr');
  assert.equal(filas.length, 1);
  assert.ok(textoDe(filas[0]).indexOf('7') !== -1);
  assert.ok(textoDe(filas[0]).indexOf('ana@example.com') !== -1);
  assert.equal(elemento('cliente-nombre').value, '');
  assert.equal(elemento('clientes-vacio').hidden, true);
});

test('dos altas con emails distintos agregan dos filas con los ids devueltos', async () => {
  let indice = 0;
  const { documento, elemento } = await montarClientes(function () {
    indice += 1;
    return respuestaJson(
      {
        id: indice === 1 ? 7 : 8,
        nombre: indice === 1 ? 'Ana Gómez' : 'Tomás Ríos',
        email: indice === 1 ? 'ana@example.com' : 'tomas@example.com'
      },
      201
    );
  });

  completar(documento, elemento, 'Ana Gómez', 'ana@example.com');
  await asentar();
  completar(documento, elemento, 'Tomás Ríos', 'tomas@example.com');
  await asentar();

  const filas = documento.querySelectorAll('#tabla-clientes tbody tr');

  assert.equal(filas.length, 2);
  assert.ok(textoDe(filas[0]).indexOf('7') !== -1);
  assert.ok(textoDe(filas[1]).indexOf('8') !== -1);
});

test('el email repetido muestra el mensaje del servidor y conserva los campos', async () => {
  const { documento, elemento, fetch } = await montarClientes(function () {
    return respuestaError(409, { detail: 'El email ya está registrado' });
  });

  completar(documento, elemento, 'Ana Gómez', 'ana@example.com');
  await asentar();

  assert.equal(altas(fetch).length, 1);
  assert.equal(elemento('cliente-mensaje').hidden, false);
  assert.equal(textoDe(elemento('cliente-mensaje')), 'El email ya está registrado');
  assert.equal(elemento('cliente-exito').hidden, true);
  assert.equal(elemento('cliente-email').value, 'ana@example.com');
  assert.equal(documento.querySelectorAll('#tabla-clientes tbody tr').length, 0);
});

test('un email con formato inválido no envía ninguna petición', async () => {
  const { documento, elemento, fetch } = await montarClientes(function () {
    return respuestaJson(ANA, 201);
  });

  completar(documento, elemento, 'Ana Gómez', 'ana.example.com');
  await asentar();

  assert.equal(fetch.llamadas.length, 0);
  assert.equal(elemento('cliente-email-error').hidden, false);
  assert.equal(elemento('cliente-email').getAttribute('aria-invalid'), 'true');
});

test('la consulta por identificador muestra nombre y email y agrega el cliente', async () => {
  const { documento, elemento, fetch } = await montarClientes(function () {
    return respuestaJson(ANA);
  });

  elemento('cliente-consulta-id').value = '7';
  elemento('cliente-consultar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(fetch.llamadas[0].url, '/api/clientes/7');
  assert.ok(textoDe(elemento('cliente-consulta-nombre')).indexOf('Ana Gómez') !== -1);
  assert.ok(textoDe(elemento('cliente-consulta-nombre')).indexOf('ana@example.com') !== -1);
  assert.equal(documento.querySelectorAll('#tabla-clientes tbody tr').length, 1);
  assert.equal(elemento('cliente-consulta-error').hidden, true);
});

test('consultar dos veces el mismo identificador no duplica la fila', async () => {
  const { documento, elemento } = await montarClientes(function () {
    return respuestaJson(ANA);
  });

  elemento('cliente-consulta-id').value = '7';
  elemento('cliente-consultar').dispatchEvent(documento.crearEvento('click'));
  await asentar();
  elemento('cliente-consultar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(documento.querySelectorAll('#tabla-clientes tbody tr').length, 1);
});

test('un cliente inexistente muestra el mensaje y no agrega filas', async () => {
  const { documento, elemento } = await montarClientes(function () {
    return respuestaError(404, { detail: 'El cliente indicado no existe' });
  });

  elemento('cliente-consulta-id').value = '99';
  elemento('cliente-consultar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(elemento('cliente-consulta-error').hidden, false);
  assert.equal(textoDe(elemento('cliente-consulta-error')), 'El cliente indicado no existe');
  assert.equal(documento.querySelectorAll('#tabla-clientes tbody tr').length, 0);
  assert.equal(textoDe(elemento('cliente-consulta-nombre')), '');
});

test('sin datos de ejemplo la lista empieza vacía y avisa que no hay consultas', async () => {
  const { elemento } = await montarClientes(function () {
    return respuestaJson(ANA);
  });

  assert.equal(elemento('clientes-vacio').hidden, false);
  assert.ok(textoDe(elemento('clientes-vacio')).indexOf('consultados') !== -1);
  assert.equal(elemento('tabla-clientes').querySelectorAll('tbody tr').length, 0);
});

test('las claves viejas de localStorage no alteran la lista ni se escriben', async () => {
  const escrituras = [];
  const localStorage = {
    getItem: function (clave) {
      const sembrado = {
        'libreria.v1.clientes': JSON.stringify([
          { id: 'c1', nombre: 'Cliente viejo', email: 'viejo@example.com' }
        ])
      };

      return Object.prototype.hasOwnProperty.call(sembrado, clave) ? sembrado[clave] : null;
    },
    setItem: function (clave, valor) {
      escrituras.push([clave, valor]);
    },
    removeItem: function () {
      escrituras.push('remove');
    }
  };

  const { documento, elemento } = await montarClientes(
    function () {
      return respuestaJson(ANA);
    },
    { localStorage: localStorage }
  );

  assert.equal(documento.querySelectorAll('#tabla-clientes tbody tr').length, 0);
  assert.equal(elemento('clientes-vacio').hidden, false);

  elemento('cliente-consulta-id').value = '7';
  elemento('cliente-consultar').dispatchEvent(documento.crearEvento('click'));
  await asentar();

  assert.equal(documento.querySelectorAll('#tabla-clientes tbody tr').length, 1);
  assert.deepEqual(escrituras, []);
});
