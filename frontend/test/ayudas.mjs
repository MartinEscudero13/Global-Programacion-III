// Utilidades compartidas por los tests del frontend: respuestas falsas de la
// API, un `fetch` que registra los pedidos y ayudas de espera y de texto.

export function respuestaTexto(texto, estado) {
  const codigo = estado === undefined ? 200 : estado;

  return {
    ok: codigo >= 200 && codigo < 300,
    status: codigo,
    text: function () {
      return Promise.resolve(texto);
    }
  };
}

export function respuestaJson(datos, estado) {
  return respuestaTexto(JSON.stringify(datos), estado);
}

export function respuestaError(estado, cuerpo) {
  return respuestaJson(cuerpo, estado);
}

export function respuestaHtml(texto, estado) {
  return respuestaTexto(texto, estado === undefined ? 200 : estado);
}

// Acepta una función `(url, opciones, indice)` o un arreglo de respuestas. La
// función puede devolver una respuesta, una promesa o lanzar para simular un
// fallo de red. Cada pedido queda registrado en `fetch.llamadas`.
export function fetchFalso(manejador) {
  const llamadas = [];

  function fetch(url, opciones) {
    const configuracion = opciones || {};
    const indice = llamadas.length;

    llamadas.push({
      url: url,
      metodo: configuracion.method || 'GET',
      cuerpo: configuracion.body,
      cabeceras: configuracion.headers,
      signal: configuracion.signal
    });

    if (typeof manejador === 'function') {
      return Promise.resolve(manejador(url, configuracion, indice));
    }

    const respuesta =
      manejador[Math.min(indice, manejador.length - 1)];

    return Promise.resolve(respuesta);
  }

  fetch.llamadas = llamadas;

  return fetch;
}

export function cuerpoDe(llamada) {
  return llamada.cuerpo === undefined ? undefined : JSON.parse(llamada.cuerpo);
}

export function llamadasA(llamadas, fragmento) {
  return llamadas.filter(function (llamada) {
    return llamada.url.indexOf(fragmento) !== -1;
  });
}

// Deja correr microtareas, temporizadores y promesas pendientes de los módulos.
export async function asentar(veces) {
  const vueltas = veces === undefined ? 6 : veces;

  for (let i = 0; i < vueltas; i += 1) {
    await new Promise(function (resolver) {
      setImmediate(resolver);
    });
    await new Promise(function (resolver) {
      setTimeout(resolver, 0);
    });
  }
}

export function textoDe(nodo) {
  return nodo.textContent.replace(/\s+/g, ' ').trim();
}
