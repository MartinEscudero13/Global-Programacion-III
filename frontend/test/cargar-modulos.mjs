// Cargador de los scripts clásicos de `public/`: lee los `src` de
// `index.html`, los evalúa en un contexto `vm` con `window`, `document`,
// `location`, un `fetch` inyectado y los temporizadores, y devuelve la API
// publicada en `window.Libreria`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = new URL('../', import.meta.url);
const RUTA_HTML = fileURLToPath(new URL('../public/index.html', import.meta.url));

function htmlDeLaPagina() {
  return readFileSync(RUTA_HTML, 'utf8');
}

export function scriptsDePagina() {
  const html = htmlDeLaPagina();
  const coincidencias = html.matchAll(/<script\s+src="([^"]+)"><\/script>/g);

  return Array.from(coincidencias, function (coincidencia) {
    return coincidencia[1];
  });
}

function crearVentana(location, temporizador) {
  const oyentes = new Map();

  const ventana = {
    location: location,
    setTimeout: temporizador,
    clearTimeout: clearTimeout,
    addEventListener: function (tipo, oyente) {
      if (!oyentes.has(tipo)) {
        oyentes.set(tipo, []);
      }

      oyentes.get(tipo).push(oyente);
    },
    removeEventListener: function (tipo, oyente) {
      const lista = oyentes.get(tipo) || [];
      const indice = lista.indexOf(oyente);

      if (indice !== -1) {
        lista.splice(indice, 1);
      }
    },
    dispatchEvent: function (evento) {
      const lista = oyentes.get(evento.type) || [];
      lista.slice().forEach(function (oyente) {
        oyente.call(ventana, evento);
      });
      return true;
    }
  };

  return ventana;
}

export async function cargarModulos(opciones) {
  const configuracion = opciones || {};
  const documento = configuracion.documento;
  const location = configuracion.location || {
    hash: '',
    origin: 'http://127.0.0.1:8080',
    href: 'http://127.0.0.1:8080/'
  };
  const temporizador = configuracion.temporizador || setTimeout;
  const consola = configuracion.consola || console;
  const ventana = crearVentana(location, temporizador);

  const contexto = vm.createContext({
    window: ventana,
    document: documento,
    location: location,
    fetch: configuracion.fetch,
    console: consola,
    setTimeout: temporizador,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    queueMicrotask: queueMicrotask,
    AbortController: AbortController,
    AbortSignal: AbortSignal,
    Intl: Intl,
    URLSearchParams: URLSearchParams
  });

  scriptsDePagina().forEach(function (src) {
    const ruta = new URL('public/' + src, RAIZ);
    const codigo = readFileSync(ruta, 'utf8');
    vm.runInContext(codigo, contexto, { filename: src });
  });

  return { Libreria: ventana.Libreria, ventana: ventana, contexto: contexto };
}
