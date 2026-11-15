import test from 'node:test';
import assert from 'node:assert/strict';

import { Documento } from './dom-simulado.mjs';

function crearArbol() {
  const documento = new Documento();
  const tabla = documento.createElement('table');
  const cuerpo = documento.createElement('tbody');
  const fila = documento.createElement('tr');
  const celda = documento.createElement('td');
  const control = documento.createElement('input');

  control.setAttribute('name', 'cantidad');
  control.setAttribute('data-libro-id', '7');
  control.value = '2';
  celda.append(control);
  fila.append(celda);
  cuerpo.append(fila);
  tabla.append(cuerpo);
  documento.body.append(tabla);

  return { documento, tabla, cuerpo, fila, celda, control };
}

test('crea elementos y asigna textContent a un nodo sin hijos', () => {
  const documento = new Documento();
  const titulo = documento.createElement('h3');

  titulo.textContent = 'El jardín de las horas';

  assert.equal(titulo.tagName, 'H3');
  assert.equal(titulo.textContent, 'El jardín de las horas');
  assert.equal(titulo.childNodes.length, 1);
  assert.equal(titulo.childNodes[0].nodeType, 3);
});

test('append acepta varios hijos y textContent concatena el texto anidado', () => {
  const documento = new Documento();
  const parrafo = documento.createElement('p');
  const negrita = documento.createElement('strong');

  negrita.append(documento.createTextNode('medio'));
  parrafo.append(
    documento.createTextNode('inicio-'),
    negrita,
    documento.createTextNode('-fin')
  );

  assert.equal(parrafo.textContent, 'inicio-medio-fin');
  assert.equal(parrafo.children.length, 1);
  assert.equal(parrafo.childNodes.length, 3);
  assert.equal(parrafo.children[0], negrita);
});

test('un fragmento traspasa sus hijos al elemento que lo recibe', () => {
  const documento = new Documento();
  const lista = documento.createElement('ul');
  const fragmento = documento.createDocumentFragment();

  fragmento.append(
    documento.createElement('li'),
    documento.createElement('li')
  );
  lista.append(fragmento);

  assert.equal(fragmento.childNodes.length, 0);
  assert.equal(lista.children.length, 2);
  assert.equal(lista.textContent, '');
});

test('replaceChildren descarta los hijos anteriores y asigna textContent vacío', () => {
  const documento = new Documento();
  const contenedor = documento.createElement('div');
  const primero = documento.createElement('span');

  primero.textContent = 'viejo';
  contenedor.append(primero);
  contenedor.replaceChildren();

  assert.equal(contenedor.childNodes.length, 0);
  assert.equal(contenedor.textContent, '');
  assert.equal(primero.parentNode, null);

  const segundo = documento.createElement('span');
  const tercero = documento.createElement('span');
  contenedor.replaceChildren(segundo, tercero);

  assert.equal(contenedor.children.length, 2);
  assert.equal(segundo.parentNode, contenedor);
});

test('expone atributos, className, dataset, hidden, disabled, value y checked', () => {
  const { control } = crearArbol();
  const seccion = control.ownerDocument.createElement('section');

  seccion.className = 'vista activa';
  seccion.hidden = true;
  control.disabled = true;
  control.checked = true;
  control.dataset.libroId = '9';

  assert.equal(control.getAttribute('name'), 'cantidad');
  assert.equal(control.hasAttribute('name'), true);
  assert.equal(control.dataset.libroId, '9');
  assert.equal(control.getAttribute('data-libro-id'), '9');
  assert.equal(seccion.className, 'vista activa');
  assert.equal(seccion.hidden, true);
  assert.equal(control.disabled, true);
  assert.equal(control.checked, true);
  assert.equal(control.value, '2');

  control.removeAttribute('name');
  assert.equal(control.hasAttribute('name'), false);
});

test('querySelector y querySelectorAll resuelven id, tag, clase, atributo y descendencia', () => {
  const { documento, tabla, fila, control } = crearArbol();
  fila.className = 'renglon';

  assert.equal(documento.querySelector('#nada'), null);
  assert.equal(documento.body.querySelector('td'), fila.children[0]);
  assert.equal(documento.querySelector('.renglon'), fila);
  assert.equal(documento.querySelector('[name="cantidad"]'), control);
  assert.equal(documento.querySelector('[data-libro-id]'), control);
  assert.equal(documento.querySelectorAll('tr input').length, 1);
  assert.equal(documento.querySelectorAll('section').length, 0);
  assert.equal(tabla.querySelectorAll('input').length, 1);

  const boton = documento.createElement('input');
  boton.setAttribute('name', 'autores');
  boton.type = 'checkbox';
  boton.checked = true;
  fila.append(boton);
  assert.equal(documento.querySelectorAll('input[name="autores"]:checked').length, 1);
  assert.equal(documento.querySelectorAll('input[name="autores"]:checked')[0], boton);
});

test('closest asciende desde una celda hasta la fila', () => {
  const { celda, fila } = crearArbol();

  assert.equal(celda.closest('tr'), fila);
  assert.equal(celda.closest('table'), fila.parentNode.parentNode);
  assert.equal(celda.closest('section'), null);
});

test('getElementById encuentra nodos en todo el documento', () => {
  const { documento, fila } = crearArbol();

  fila.id = 'renglon-1';
  assert.equal(documento.getElementById('renglon-1'), fila);
  assert.equal(documento.getElementById('otro'), null);
});

test('los eventos burbujean desde el control hasta la tabla', () => {
  const { documento, tabla, control } = crearArbol();
  const vistos = [];

  tabla.addEventListener('change', function (evento) {
    vistos.push('tabla:' + evento.target.getAttribute('name'));
  });
  control.addEventListener('change', function (evento) {
    vistos.push('control:' + evento.currentTarget.tagName);
  });

  const evento = documento.crearEvento('change');
  control.dispatchEvent(evento);

  assert.deepEqual(vistos, ['control:INPUT', 'tabla:cantidad']);
  assert.equal(evento.target, control);
});

test('focus registra el elemento activo y form.reset vuelve a los valores iniciales', () => {
  const documento = new Documento();
  const formulario = documento.createElement('form');
  const numero = documento.createElement('input');
  const casilla = documento.createElement('input');

  numero.value = '1';
  casilla.type = 'checkbox';
  casilla.checked = true;
  formulario.append(numero, casilla);
  documento.body.append(formulario);

  numero.value = '5';
  casilla.checked = false;
  numero.focus();

  assert.equal(documento.activeElement, numero);

  formulario.reset();
  assert.equal(numero.value, '1');
  assert.equal(casilla.checked, true);
});
