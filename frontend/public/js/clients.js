(function () {
  'use strict';

  const Libreria = (window.Libreria = window.Libreria || {});
  const ORDEN_CAMPOS = ['nombre', 'email'];

  let refs = null;
  let clientes = [];
  let iniciado = false;

  function crearCelda(texto, esNumero) {
    const celda = document.createElement('td');
    celda.textContent = texto;

    if (esNumero) {
      celda.className = 'tabla__numero';
    }

    return celda;
  }

  function crearFilaCliente(cliente) {
    const fila = document.createElement('tr');
    const email = crearCelda(cliente.email);

    email.className = 'tabla__email';
    fila.append(crearCelda(String(cliente.id), true), crearCelda(cliente.nombre), email);

    return fila;
  }

  function renderizarTabla() {
    const fragmento = document.createDocumentFragment();

    clientes.forEach(function (cliente) {
      fragmento.append(crearFilaCliente(cliente));
    });

    refs.cuerpo.replaceChildren(fragmento);
    refs.vacio.hidden = clientes.length > 0;
  }

  function agregarCliente(cliente) {
    const existe = clientes.some(function (conocido) {
      return conocido.id === cliente.id;
    });

    if (!existe) {
      clientes.push({
        id: cliente.id,
        nombre: cliente.nombre,
        email: cliente.email
      });
      renderizarTabla();
    }
  }

  function leerFormulario() {
    return {
      nombre: refs.nombre.value.trim(),
      email: refs.email.value.trim()
    };
  }

  function validarCliente(datos) {
    const errores = {};

    if (!datos.nombre) {
      errores.nombre = 'Ingresá el nombre completo.';
    }

    if (!datos.email) {
      errores.email = 'Ingresá el email.';
    } else if (!Libreria.utils.esEmailValido(datos.email)) {
      errores.email = 'Ingresá un email válido.';
    }

    return {
      valido: Object.keys(errores).length === 0,
      errores: errores,
      valores: { nombre: datos.nombre, email: datos.email }
    };
  }

  function marcarError(clave, mensaje) {
    const error = refs.errores[clave];

    error.textContent = mensaje;
    error.hidden = false;
    refs.controles[clave].setAttribute('aria-invalid', 'true');
  }

  function limpiarError(clave) {
    const error = refs.errores[clave];

    error.textContent = '';
    error.hidden = true;
    refs.controles[clave].removeAttribute('aria-invalid');
  }

  function limpiarErrores() {
    ORDEN_CAMPOS.forEach(limpiarError);
    refs.mensaje.hidden = true;
  }

  function mostrarErrores(errores) {
    const claves = ORDEN_CAMPOS.filter(function (clave) {
      return Boolean(errores[clave]);
    });

    claves.forEach(function (clave) {
      marcarError(clave, errores[clave]);
    });

    if (claves.length > 0) {
      refs.controles[claves[0]].focus();
    }
  }

  function ocultarExito() {
    refs.exito.hidden = true;
  }

  async function registrarCliente(evento) {
    evento.preventDefault();
    ocultarExito();
    limpiarErrores();

    const resultado = validarCliente(leerFormulario());

    if (!resultado.valido) {
      mostrarErrores(resultado.errores);
      return;
    }

    refs.registrar.disabled = true;

    try {
      const cliente = await Libreria.api.crearCliente(resultado.valores);

      agregarCliente(cliente);
      refs.form.reset();
      limpiarErrores();
      refs.exito.textContent =
        'Listo: se registró «' + cliente.nombre + '» con el identificador ' + cliente.id + '.';
      refs.exito.hidden = false;
      refs.nombre.focus();
    } catch (error) {
      refs.mensaje.textContent = error.mensaje;
      refs.mensaje.hidden = false;
    } finally {
      refs.registrar.disabled = false;
    }
  }

  async function consultarCliente() {
    const texto = refs.consultaId.value.trim();
    const identificador = Number(texto);

    refs.consultaError.hidden = true;
    refs.consultaNombre.textContent = '';

    if (!texto || !Number.isInteger(identificador) || identificador < 1) {
      refs.consultaError.textContent = 'Ingresá un identificador de cliente válido.';
      refs.consultaError.hidden = false;
      refs.consultaId.focus();
      return;
    }

    refs.consultar.disabled = true;

    try {
      const cliente = await Libreria.api.obtenerCliente(identificador);

      refs.consultaNombre.textContent = cliente.nombre + ' · ' + cliente.email;
      agregarCliente(cliente);
    } catch (error) {
      refs.consultaError.textContent = error.mensaje;
      refs.consultaError.hidden = false;
    } finally {
      refs.consultar.disabled = false;
    }
  }

  function configurarEventos() {
    refs.form.addEventListener('submit', registrarCliente);
    refs.consultar.addEventListener('click', consultarCliente);

    refs.limpiar.addEventListener('click', function () {
      window.setTimeout(function () {
        limpiarErrores();
        ocultarExito();
      }, 0);
    });

    Object.keys(refs.controles).forEach(function (clave) {
      const control = refs.controles[clave];

      function manejarCambio() {
        limpiarError(clave);
        ocultarExito();
      }

      control.addEventListener('input', manejarCambio);
      control.addEventListener('change', manejarCambio);
    });
  }

  async function iniciarClientes() {
    if (iniciado) {
      return;
    }

    iniciado = true;
    clientes = [];
    refs = {
      form: document.getElementById('form-cliente'),
      nombre: document.getElementById('cliente-nombre'),
      email: document.getElementById('cliente-email'),
      limpiar: document.getElementById('cliente-limpiar'),
      registrar: document.getElementById('cliente-registrar'),
      mensaje: document.getElementById('cliente-mensaje'),
      exito: document.getElementById('cliente-exito'),
      consultaId: document.getElementById('cliente-consulta-id'),
      consultar: document.getElementById('cliente-consultar'),
      consultaNombre: document.getElementById('cliente-consulta-nombre'),
      consultaError: document.getElementById('cliente-consulta-error'),
      cuerpo: document.querySelector('#tabla-clientes tbody'),
      vacio: document.getElementById('clientes-vacio'),
      errores: {
        nombre: document.getElementById('cliente-nombre-error'),
        email: document.getElementById('cliente-email-error')
      }
    };

    refs.controles = {
      nombre: refs.nombre,
      email: refs.email
    };

    configurarEventos();
    renderizarTabla();
  }

  Libreria.clientes = {
    iniciar: iniciarClientes,
    validarCliente: validarCliente,
    consultarCliente: consultarCliente
  };
})();
