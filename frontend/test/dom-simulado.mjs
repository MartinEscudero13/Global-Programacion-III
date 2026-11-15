// DOM simulado mínimo para probar los módulos de `public/js/` sin navegador.
// Cubre sólo el subconjunto que usan los módulos: creación de nodos, texto,
// hijos, atributos, selectores simples, eventos con burbujeo, foco y
// `form.reset()`. Se amplía cuando un caso lo exige (design.md, D9).

const PATRON_TOKEN = /[a-zA-Z][a-zA-Z0-9-]*|#[^.#[\]:\s]+|\.[^.#[\]:\s]+|\[[^\]]+\]|:checked/g;

function aKebab(nombre) {
  return String(nombre).replace(/[A-Z]/g, function (letra) {
    return '-' + letra.toLowerCase();
  });
}

function esElemento(nodo) {
  return nodo instanceof Elemento;
}

function descendientes(nodo, acumulado) {
  const encontrados = acumulado || [];

  nodo.childNodes.forEach(function (hijo) {
    if (esElemento(hijo)) {
      encontrados.push(hijo);
      descendientes(hijo, encontrados);
    }
  });

  return encontrados;
}

function coincideAtributo(elemento, contenido) {
  const coincidencia = /^([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/.exec(
    contenido.trim()
  );

  if (!coincidencia) {
    return false;
  }

  const nombre = coincidencia[1];
  const esperado =
    coincidencia[2] !== undefined
      ? coincidencia[2]
      : coincidencia[3] !== undefined
        ? coincidencia[3]
        : coincidencia[4];

  if (esperado === undefined) {
    return elemento.hasAttribute(nombre);
  }

  return elemento.getAttribute(nombre) === esperado;
}

function coincideCompuesto(elemento, compuesto) {
  const tokens = compuesto.match(PATRON_TOKEN) || [];

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every(function (token) {
    if (token.charAt(0) === '#') {
      return elemento.id === token.slice(1);
    }

    if (token.charAt(0) === '.') {
      return elemento.classList.contains(token.slice(1));
    }

    if (token.charAt(0) === '[') {
      return coincideAtributo(elemento, token.slice(1, -1));
    }

    if (token === ':checked') {
      return elemento.checked === true;
    }

    return elemento.localName === token.toLowerCase();
  });
}

function coincideSelector(elemento, selector) {
  const partes = String(selector).trim().split(/\s+/);

  if (!coincideCompuesto(elemento, partes[partes.length - 1])) {
    return false;
  }

  let indice = partes.length - 2;
  let nodo = elemento.parentNode;

  while (indice >= 0 && nodo) {
    if (esElemento(nodo) && coincideCompuesto(nodo, partes[indice])) {
      indice -= 1;
    }

    nodo = nodo.parentNode;
  }

  return indice < 0;
}

export class Evento {
  constructor(tipo, opciones) {
    const configuracion = opciones || {};

    this.type = tipo;
    this.tipo = tipo;
    this.bubbles = configuracion.bubbles !== false;
    this.target = null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.propagacionDetenida = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagacionDetenida = true;
  }
}

export class Nodo {
  constructor(documento) {
    this.ownerDocument = documento;
    this.parentNode = null;
    this.childNodes = [];
    this._oyentes = new Map();
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get children() {
    return this.childNodes.filter(function (hijo) {
      return esElemento(hijo);
    });
  }

  append() {
    for (let i = 0; i < arguments.length; i += 1) {
      this.agregar(arguments[i]);
    }
  }

  agregar(hijo) {
    if (hijo === null || hijo === undefined || hijo === false) {
      return;
    }

    if (typeof hijo === 'string' || typeof hijo === 'number') {
      this.agregar(new NodoTexto(this.ownerDocument, String(hijo)));
      return;
    }

    if (hijo instanceof Fragmento) {
      hijo.childNodes.slice().forEach(function (nieto) {
        this.agregar(nieto);
      }, this);
      hijo.childNodes = [];
      return;
    }

    if (hijo.parentNode) {
      hijo.parentNode.quitar(hijo);
    }

    hijo.parentNode = this;
    this.childNodes.push(hijo);
  }

  quitar(hijo) {
    const indice = this.childNodes.indexOf(hijo);

    if (indice !== -1) {
      this.childNodes.splice(indice, 1);
      hijo.parentNode = null;
    }
  }

  replaceChildren() {
    this.childNodes.slice().forEach(function (hijo) {
      hijo.parentNode = null;
    }, this);
    this.childNodes = [];
    this.append.apply(this, arguments);
  }

  get textContent() {
    return this.childNodes
      .map(function (hijo) {
        return hijo.textContent;
      })
      .join('');
  }

  set textContent(valor) {
    this.replaceChildren();
    const texto = valor === null || valor === undefined ? '' : String(valor);

    if (texto !== '') {
      this.append(new NodoTexto(this.ownerDocument, texto));
    }
  }

  addEventListener(tipo, oyente) {
    if (!this._oyentes.has(tipo)) {
      this._oyentes.set(tipo, []);
    }

    this._oyentes.get(tipo).push(oyente);
  }

  removeEventListener(tipo, oyente) {
    const lista = this._oyentes.get(tipo);

    if (!lista) {
      return;
    }

    const indice = lista.indexOf(oyente);

    if (indice !== -1) {
      lista.splice(indice, 1);
    }
  }

  dispatchEvent(evento) {
    evento.target = this;

    const ruta = [];
    let nodo = this;

    while (nodo) {
      ruta.push(nodo);
      nodo = nodo.parentNode;
    }

    if (this.ownerDocument && ruta[ruta.length - 1] !== this.ownerDocument) {
      ruta.push(this.ownerDocument);
    }

    for (let i = 0; i < ruta.length; i += 1) {
      const actual = ruta[i];
      evento.currentTarget = actual;

      const oyentes = actual._oyentes.get(evento.type) || [];

      for (let j = 0; j < oyentes.length; j += 1) {
        oyentes[j].call(actual, evento);
      }

      if (evento.propagacionDetenida || !evento.bubbles) {
        break;
      }
    }

    return !evento.defaultPrevented;
  }
}

export class NodoTexto extends Nodo {
  constructor(documento, texto) {
    super(documento);
    this.nodeType = 3;
    this.nodeName = '#text';
    this._texto = texto;
  }

  get textContent() {
    return this._texto;
  }

  set textContent(valor) {
    this._texto = valor === null || valor === undefined ? '' : String(valor);
  }
}

export class Fragmento extends Nodo {
  constructor(documento) {
    super(documento);
    this.nodeType = 11;
    this.nodeName = '#document-fragment';
  }
}

export class Elemento extends Nodo {
  constructor(documento, etiqueta) {
    super(documento);
    this.nodeType = 1;
    this.localName = String(etiqueta).toLowerCase();
    this.tagName = this.localName.toUpperCase();
    this.attributes = new Map();
    this.hidden = false;
    this.disabled = false;
    this._valor = '';
    this._valorInicial = '';
    this._marcado = false;
    this._marcadoInicial = false;

    const elemento = this;

    this.dataset = new Proxy(
      {},
      {
        get: function (destino, propiedad) {
          const valor = elemento.getAttribute('data-' + aKebab(propiedad));
          return valor === null ? undefined : valor;
        },
        set: function (destino, propiedad, valor) {
          elemento.setAttribute('data-' + aKebab(propiedad), String(valor));
          return true;
        },
        has: function (destino, propiedad) {
          return elemento.hasAttribute('data-' + aKebab(propiedad));
        },
        deleteProperty: function (destino, propiedad) {
          elemento.removeAttribute('data-' + aKebab(propiedad));
          return true;
        }
      }
    );
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(valor) {
    this.setAttribute('id', valor);
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(valor) {
    this.setAttribute('class', valor);
  }

  get classList() {
    const elemento = this;

    return {
      contains: function (clase) {
        return elemento.className.split(/\s+/).indexOf(clase) !== -1;
      },
      add: function (clase) {
        if (!this.contains(clase)) {
          elemento.className = (elemento.className + ' ' + clase).trim();
        }
      },
      remove: function (clase) {
        elemento.className = elemento.className
          .split(/\s+/)
          .filter(function (actual) {
            return actual && actual !== clase;
          })
          .join(' ');
      },
      toggle: function (clase) {
        if (this.contains(clase)) {
          this.remove(clase);
          return false;
        }

        this.add(clase);
        return true;
      }
    };
  }

  get value() {
    if (this.localName === 'select') {
      const opcion = this.children.find(function (hijo) {
        return hijo.localName === 'option' && hijo.value === this._valor;
      }, this);

      return opcion ? this._valor : this._valor === undefined ? '' : this._valor;
    }

    return this._valor;
  }

  set value(valor) {
    this._valor = valor === null || valor === undefined ? '' : String(valor);

    // La primera asignación fija el valor por omisión que restaura `reset()`;
    // las siguientes sólo cambian el valor vigente.
    if (this._valorInicialFijado !== true) {
      this._valorInicial = this._valor;
      this._valorInicialFijado = true;
    }
  }

  get checked() {
    return this._marcado;
  }

  set checked(valor) {
    this._marcado = Boolean(valor);

    if (this._marcadoInicialFijado !== true) {
      this._marcadoInicial = this._marcado;
      this._marcadoInicialFijado = true;
    }
  }

  setAttribute(nombre, valor) {
    this.attributes.set(String(nombre), String(valor));
  }

  getAttribute(nombre) {
    if (!this.attributes.has(String(nombre))) {
      return null;
    }

    return this.attributes.get(String(nombre));
  }

  hasAttribute(nombre) {
    return this.attributes.has(String(nombre));
  }

  removeAttribute(nombre) {
    this.attributes.delete(String(nombre));
  }

  toggleAttribute(nombre, forzar) {
    const activo = forzar === undefined ? !this.hasAttribute(nombre) : Boolean(forzar);

    if (activo) {
      this.setAttribute(nombre, '');
    } else {
      this.removeAttribute(nombre);
    }

    return activo;
  }

  matches(selector) {
    return coincideSelector(this, selector);
  }

  closest(selector) {
    let nodo = this;

    while (nodo) {
      if (esElemento(nodo) && coincideCompuesto(nodo, selector.trim().split(/\s+/).pop())) {
        if (coincideSelector(nodo, selector)) {
          return nodo;
        }
      }

      nodo = nodo.parentNode;
    }

    return null;
  }

  querySelector(selector) {
    const encontrados = this.querySelectorAll(selector);
    return encontrados.length > 0 ? encontrados[0] : null;
  }

  querySelectorAll(selector) {
    return descendientes(this).filter(function (elemento) {
      return coincideSelector(elemento, selector);
    });
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  reset() {
    if (this.localName !== 'form') {
      return;
    }

    descendientes(this).forEach(function (elemento) {
      if (
        elemento.localName === 'input' ||
        elemento.localName === 'select' ||
        elemento.localName === 'textarea'
      ) {
        elemento._valor = elemento._valorInicial;
        elemento._marcado = elemento._marcadoInicial;
      }
    });
  }
}

export class Documento extends Nodo {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.nodeName = '#document';
    this.body = new Elemento(this, 'body');
    this.body.parentNode = this;
    this.childNodes.push(this.body);
    this.activeElement = this.body;
  }

  get documentElement() {
    return this.body;
  }

  createElement(etiqueta) {
    return new Elemento(this, etiqueta);
  }

  createTextNode(texto) {
    return new NodoTexto(this, String(texto));
  }

  createDocumentFragment() {
    return new Fragmento(this);
  }

  crearEvento(tipo, opciones) {
    return new Evento(tipo, opciones);
  }

  getElementById(id) {
    const encontrado = descendientes(this.body).find(function (elemento) {
      return elemento.id === id;
    });

    return encontrado || null;
  }

  querySelector(selector) {
    const encontrados = this.querySelectorAll(selector);
    return encontrados.length > 0 ? encontrados[0] : null;
  }

  querySelectorAll(selector) {
    return descendientes(this.body).filter(function (elemento) {
      return coincideSelector(elemento, selector);
    });
  }
}
