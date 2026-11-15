(function () {
  'use strict';

  const Libreria = (window.Libreria = window.Libreria || {});

  const BASE = '/api';
  const TAMANO_PAGINA = 20;
  const TAMANO_LOTE = 100;
  const MAXIMO_PAGINAS = 20;
  const TIEMPO_MAXIMO = 10000;

  const MENSAJE_CONEXION =
    'No se pudo conectar con el servidor. Revisá tu conexión y volvé a intentar.';
  const MENSAJE_DEMORA =
    'La operación demoró más de lo esperado. Volvé a intentar en unos instantes.';
  const MENSAJE_ILEGIBLE =
    'El servidor devolvió una respuesta que no se puede leer. Volvé a intentar.';

  class ErrorApi extends Error {
    constructor(mensaje, codigo, estado) {
      super(mensaje);
      this.nombre = 'ErrorApi';
      this.name = 'ErrorApi';
      this.mensaje = mensaje;
      this.codigo = codigo;
      this.estado = estado === undefined ? 0 : estado;
    }
  }

  function construirRuta(ruta, parametros) {
    if (!parametros || parametros.length === 0) {
      return ruta;
    }

    const consulta = parametros
      .map(function (par) {
        return encodeURIComponent(par[0]) + '=' + encodeURIComponent(par[1]);
      })
      .join('&');

    return ruta + '?' + consulta;
  }

  function esIdentificador(valor) {
    return valor !== undefined && valor !== null && valor !== '';
  }

  function nombreDeCampo(loc) {
    if (!Array.isArray(loc)) {
      return '';
    }

    const prefijos = ['body', 'query', 'path', 'header', 'cookie'];
    let texto = '';

    loc.forEach(function (parte) {
      if (typeof parte === 'number') {
        texto += '[' + parte + ']';
        return;
      }

      if (prefijos.indexOf(parte) !== -1) {
        return;
      }

      texto += texto ? '.' + parte : String(parte);
    });

    return texto;
  }

  function motivoDelError(detalle) {
    const tipo = detalle.type;
    const contexto = detalle.ctx || {};

    if (tipo === 'missing') {
      return 'es obligatorio';
    }

    if (tipo === 'greater_than') {
      return 'debe ser mayor que ' + contexto.gt;
    }

    if (tipo === 'greater_than_equal') {
      return 'debe ser mayor o igual que ' + contexto.ge;
    }

    if (tipo === 'less_than') {
      return 'debe ser menor que ' + contexto.lt;
    }

    if (tipo === 'less_than_equal') {
      return 'debe ser menor o igual que ' + contexto.le;
    }

    if (tipo === 'int_parsing' || tipo === 'int_type') {
      return 'debe ser un número entero';
    }

    if (tipo === 'decimal_parsing' || tipo === 'decimal_type') {
      return 'debe ser un número decimal';
    }

    if (tipo === 'string_pattern_mismatch') {
      return 'tiene un formato inválido';
    }

    if (tipo === 'string_too_short') {
      return 'es demasiado corto';
    }

    if (tipo === 'string_too_long') {
      return 'es demasiado largo';
    }

    if (tipo === 'literal_error') {
      return 'debe ser uno de los valores permitidos';
    }

    if (tipo === 'list_type' || tipo === 'model_attributes_type') {
      return 'tiene un formato inválido';
    }

    const respaldo = String(detalle.msg || 'tiene un valor inválido').replace(
      /^Value error,\s*/i,
      ''
    );

    return respaldo.charAt(0).toLowerCase() + respaldo.slice(1);
  }

  function traducirDetalle(detalles) {
    const mensajes = detalles.map(function (detalle) {
      const campo = nombreDeCampo(detalle.loc);
      const motivo = motivoDelError(detalle);

      return campo ? campo + ': ' + motivo : motivo;
    });

    return mensajes.join('; ');
  }

  function errorDesdeRespuesta(estado, datos) {
    const detalle = datos && datos.detail;

    if (estado === 422 && Array.isArray(detalle)) {
      return new ErrorApi(traducirDetalle(detalle), 'validacion', estado);
    }

    if (typeof detalle === 'string' && detalle) {
      return new ErrorApi(detalle, 'http', estado);
    }

    return new ErrorApi(
      'El servidor respondió con un error (' + estado + ').',
      'http',
      estado
    );
  }

  async function pedir(ruta, opciones) {
    const configuracion = opciones || {};
    const cabeceras = { Accept: 'application/json' };
    const pedido = { method: configuracion.metodo || 'GET', headers: cabeceras };
    let controlador = null;
    let temporizador = null;

    if (configuracion.cuerpo !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      pedido.body = JSON.stringify(configuracion.cuerpo);
    }

    if (typeof AbortController === 'function') {
      controlador = new AbortController();
      pedido.signal = controlador.signal;
    }

    try {
      if (controlador) {
        temporizador = setTimeout(function () {
          controlador.abort();
        }, TIEMPO_MAXIMO);
      }

      const respuesta = await fetch(ruta, pedido);
      const texto = await respuesta.text();
      let datos = null;

      if (texto) {
        try {
          datos = JSON.parse(texto);
        } catch (error) {
          throw new ErrorApi(MENSAJE_ILEGIBLE, 'red', 0);
        }
      }

      if (!respuesta.ok) {
        throw errorDesdeRespuesta(respuesta.status, datos);
      }

      return datos;
    } catch (error) {
      if (error && error.nombre === 'ErrorApi') {
        throw error;
      }

      if (controlador && controlador.signal.aborted) {
        throw new ErrorApi(MENSAJE_DEMORA, 'red', 0);
      }

      throw new ErrorApi(MENSAJE_CONEXION, 'red', 0);
    } finally {
      if (temporizador !== null) {
        clearTimeout(temporizador);
      }
    }
  }

  function parametrosDePagina(opciones) {
    const configuracion = opciones || {};

    return [
      [
        'limit',
        esIdentificador(configuracion.limit) ? configuracion.limit : TAMANO_PAGINA
      ],
      ['offset', esIdentificador(configuracion.offset) ? configuracion.offset : 0]
    ];
  }

  function listarLibros(opciones) {
    const configuracion = opciones || {};
    const parametros = parametrosDePagina(configuracion);
    const titulo = String(configuracion.titulo || '').trim();

    if (titulo) {
      parametros.push(['titulo', titulo]);
    }

    if (esIdentificador(configuracion.generoId) && Number(configuracion.generoId) > 0) {
      parametros.push(['genero_id', configuracion.generoId]);
    }

    return pedir(construirRuta(BASE + '/libros/', parametros));
  }

  async function listarTodas(coleccion) {
    const items = [];
    let desplazamiento = 0;

    for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina += 1) {
      const lote = await pedir(
        construirRuta(BASE + '/' + coleccion + '/', [
          ['limit', TAMANO_LOTE],
          ['offset', desplazamiento]
        ])
      );
      const lista = Array.isArray(lote) ? lote : [];

      items.push.apply(items, lista);

      if (lista.length < TAMANO_LOTE) {
        return { items: items, truncado: false };
      }

      desplazamiento += TAMANO_LOTE;
    }

    return { items: items, truncado: true };
  }

  function obtenerLibro(id) {
    return pedir(BASE + '/libros/' + encodeURIComponent(id));
  }

  function crearLibro(cuerpo) {
    return pedir(BASE + '/libros/', { metodo: 'POST', cuerpo: cuerpo });
  }

  function obtenerAutor(id) {
    return pedir(BASE + '/autores/' + encodeURIComponent(id));
  }

  function obtenerCliente(id) {
    return pedir(BASE + '/clientes/' + encodeURIComponent(id));
  }

  function crearCliente(cuerpo) {
    return pedir(BASE + '/clientes/', { metodo: 'POST', cuerpo: cuerpo });
  }

  function crearVenta(cuerpo) {
    return pedir(BASE + '/ventas/', { metodo: 'POST', cuerpo: cuerpo });
  }

  function listarVentas(opciones) {
    return pedir(construirRuta(BASE + '/ventas/', parametrosDePagina(opciones)));
  }

  function obtenerVenta(id) {
    return pedir(BASE + '/ventas/' + encodeURIComponent(id));
  }

  Libreria.api = {
    BASE: BASE,
    TAMANO_PAGINA: TAMANO_PAGINA,
    ErrorApi: ErrorApi,
    listarLibros: listarLibros,
    obtenerLibro: obtenerLibro,
    crearLibro: crearLibro,
    listarTodas: listarTodas,
    obtenerAutor: obtenerAutor,
    obtenerCliente: obtenerCliente,
    crearCliente: crearCliente,
    crearVenta: crearVenta,
    listarVentas: listarVentas,
    obtenerVenta: obtenerVenta
  };
})();
