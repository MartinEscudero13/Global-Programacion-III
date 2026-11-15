(function () {
  'use strict';

  const Libreria = (window.Libreria = window.Libreria || {});

  let refs = null;
  let renglones = [];
  let libros = [];
  let clienteVerificado = null;
  let enviando = false;
  let iniciado = false;

  function crearCelda(texto, esNumero) {
    const celda = document.createElement('td');
    celda.textContent = texto;

    if (esNumero) {
      celda.className = 'tabla__numero';
    }

    return celda;
  }

  function mostrarMensaje(texto, tipo) {
    refs.mensaje.textContent = texto;
    refs.mensaje.className = 'mensaje mensaje--' + (tipo || 'error');
    refs.mensaje.hidden = false;
  }

  function ocultarMensaje() {
    refs.mensaje.textContent = '';
    refs.mensaje.hidden = true;
  }

  function ocultarConfirmacion() {
    refs.confirmada.replaceChildren();
    refs.confirmada.hidden = true;
  }

  function buscarLibro(libroId) {
    return libros.find(function (libro) {
      return String(libro.id) === String(libroId);
    }) || null;
  }

  function calcularSubtotal(cantidad, precioUnitario) {
    return Libreria.utils.redondearCentavos(cantidad * precioUnitario);
  }

  function actualizarResumen() {
    const articulos = renglones.reduce(function (total, renglon) {
      return total + renglon.cantidad;
    }, 0);
    const total = renglones.reduce(function (suma, renglon) {
      return Libreria.utils.redondearCentavos(suma + renglon.subtotal);
    }, 0);

    refs.articulos.textContent = String(articulos);
    refs.total.textContent = Libreria.utils.formatearPrecio(total);
  }

  function crearControlCantidad(renglon) {
    const control = document.createElement('input');

    control.type = 'number';
    control.min = '1';
    control.step = '1';
    control.value = String(renglon.cantidad);
    control.className = 'campo__control tabla__cantidad';
    control.setAttribute('aria-label', 'Cantidad de ' + renglon.titulo);
    control.dataset.libroId = renglon.libroId;

    return control;
  }

  function crearBotonQuitar(renglon) {
    const boton = document.createElement('button');
    const oculto = document.createElement('span');

    boton.type = 'button';
    boton.className = 'boton boton--peligro boton--chico';
    boton.dataset.libroId = renglon.libroId;
    boton.textContent = 'Quitar';
    oculto.className = 'visualmente-oculto';
    oculto.textContent = ' ' + renglon.titulo + ' de la venta';
    boton.append(oculto);

    return boton;
  }

  function crearFilaRenglon(renglon) {
    const fila = document.createElement('tr');
    const celdaCantidad = document.createElement('td');
    const celdaAcciones = document.createElement('td');
    const acciones = document.createElement('div');

    celdaCantidad.className = 'tabla__numero';
    celdaCantidad.append(crearControlCantidad(renglon));
    acciones.className = 'tabla__acciones';
    acciones.append(crearBotonQuitar(renglon));
    celdaAcciones.append(acciones);

    fila.append(
      crearCelda(renglon.titulo),
      celdaCantidad,
      crearCelda(Libreria.utils.formatearPrecio(renglon.precioUnitario), true),
      crearCelda(Libreria.utils.formatearPrecio(renglon.subtotal), true),
      celdaAcciones
    );

    return fila;
  }

  function renderizarRenglones() {
    const fragmento = document.createDocumentFragment();

    renglones.forEach(function (renglon) {
      fragmento.append(crearFilaRenglon(renglon));
    });

    refs.cuerpo.replaceChildren(fragmento);
    refs.vacio.hidden = renglones.length > 0;
  }

  function refrescarBorrador() {
    renderizarRenglones();
    actualizarResumen();
  }

  function opcionesDeLibros() {
    return libros.map(function (libro) {
      return { valor: String(libro.id), texto: libro.titulo + ' · ' + libro.isbn };
    });
  }

  function marcarLibros(disponibles) {
    refs.librosError.hidden = disponibles;
    refs.reintentar.hidden = disponibles;
    refs.agregar.disabled = !disponibles;
    refs.libro.disabled = !disponibles;
  }

  async function cargarLibros() {
    refs.librosError.hidden = true;
    refs.reintentar.hidden = true;

    try {
      const resultado = await Libreria.api.listarTodas('libros');
      const valorPrevio = refs.libro.value;

      libros = resultado.items;
      Libreria.utils.poblarSelect(
        refs.libro,
        opcionesDeLibros(),
        'Seleccioná un libro',
        valorPrevio
      );
      marcarLibros(true);

      if (resultado.truncado) {
        mostrarMensaje(
          'La lista de libros quedó incompleta porque supera el máximo de 2000 elementos.',
          'aviso'
        );
      }
    } catch (error) {
      libros = [];
      refs.libro.replaceChildren();
      marcarLibros(false);
      refs.librosError.textContent = error.mensaje;
      refs.librosError.hidden = false;
      refs.reintentar.hidden = false;
    }
  }

  function invalidarCliente() {
    clienteVerificado = null;
    refs.clienteNombre.textContent = '';
    refs.clienteError.hidden = true;
  }

  async function verificarClienteActual() {
    const texto = refs.clienteId.value.trim();
    const identificador = Number(texto);

    invalidarCliente();

    refs.clienteError.hidden = true;

    if (!texto || !Number.isInteger(identificador) || identificador < 1) {
      refs.clienteError.textContent = 'Ingresá un identificador de cliente válido.';
      refs.clienteError.hidden = false;
      refs.clienteId.focus();
      return;
    }

    refs.buscarCliente.disabled = true;

    try {
      const cliente = await Libreria.api.obtenerCliente(identificador);

      clienteVerificado = { id: cliente.id, nombre: cliente.nombre };
      refs.clienteNombre.textContent = 'Cliente ' + cliente.id + ': ' + cliente.nombre;
      refs.clienteError.hidden = true;
    } catch (error) {
      refs.clienteError.textContent = error.mensaje;
      refs.clienteError.hidden = false;
    } finally {
      refs.buscarCliente.disabled = false;
    }
  }

  function agregarRenglon(evento) {
    evento.preventDefault();
    ocultarMensaje();
    ocultarConfirmacion();

    const libroId = refs.libro.value;
    const cantidad = Number(refs.cantidad.value);

    if (!libroId) {
      mostrarMensaje('Seleccioná un libro.');
      refs.libro.focus();
      return;
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      mostrarMensaje('La cantidad debe ser un número entero mayor que cero.');
      refs.cantidad.focus();
      return;
    }

    const libro = buscarLibro(libroId);

    if (!libro) {
      mostrarMensaje('El libro seleccionado no está en la lista cargada.');
      refs.libro.focus();
      return;
    }

    const existente = renglones.find(function (renglon) {
      return String(renglon.libroId) === String(libroId);
    });

    if (existente) {
      existente.cantidad += cantidad;
      existente.subtotal = calcularSubtotal(existente.cantidad, existente.precioUnitario);
      refrescarBorrador();
      mostrarMensaje(
        'El libro ya estaba en la venta; se actualizó la cantidad del renglón.',
        'aviso'
      );
      refs.cantidad.value = '1';
      refs.libro.value = '';
      refs.libro.focus();
      return;
    }

    const precioUnitario = Libreria.utils.parsearImporte(libro.precio);

    renglones.push({
      libroId: libro.id,
      titulo: libro.titulo,
      isbn: libro.isbn,
      cantidad: cantidad,
      precioUnitario: precioUnitario,
      subtotal: calcularSubtotal(cantidad, precioUnitario)
    });

    refrescarBorrador();
    refs.cantidad.value = '1';
    refs.libro.value = '';
    refs.libro.focus();
  }

  function cambiarCantidad(input) {
    const renglon = renglones.find(function (item) {
      return String(item.libroId) === String(input.dataset.libroId);
    });
    const cantidad = Number(input.value);

    if (!renglon) {
      return;
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      input.value = String(renglon.cantidad);
      mostrarMensaje('La cantidad debe ser un número entero mayor que cero.');
      input.focus();
      return;
    }

    renglon.cantidad = cantidad;
    renglon.subtotal = calcularSubtotal(cantidad, renglon.precioUnitario);

    const fila = input.closest('tr');
    const subtotal = fila ? fila.children[3] : null;

    if (subtotal) {
      subtotal.textContent = Libreria.utils.formatearPrecio(renglon.subtotal);
    }

    actualizarResumen();
    ocultarMensaje();
    ocultarConfirmacion();
  }

  function quitarRenglon(libroId) {
    const indice = renglones.findIndex(function (renglon) {
      return String(renglon.libroId) === String(libroId);
    });

    if (indice === -1) {
      return;
    }

    renglones.splice(indice, 1);
    refrescarBorrador();
    ocultarMensaje();
    ocultarConfirmacion();
  }

  function sincronizarCantidades() {
    const controles = refs.cuerpo.querySelectorAll('input[data-libro-id]');
    let valido = true;

    controles.forEach(function (control) {
      const renglon = renglones.find(function (item) {
        return String(item.libroId) === String(control.dataset.libroId);
      });
      const cantidad = Number(control.value);

      if (!renglon) {
        return;
      }

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        valido = false;
        control.value = String(renglon.cantidad);
        return;
      }

      renglon.cantidad = cantidad;
      renglon.subtotal = calcularSubtotal(cantidad, renglon.precioUnitario);
    });

    return valido;
  }

  function cuerpoDeVenta() {
    return {
      cliente_id: clienteVerificado.id,
      renglones: renglones.map(function (renglon) {
        return { libro_id: Number(renglon.libroId), cantidad: renglon.cantidad };
      })
    };
  }

  function dibujarConfirmacion(venta) {
    const titulo = document.createElement('p');
    const meta = document.createElement('p');
    const tiempo = document.createElement('time');
    const lista = document.createElement('ul');
    const total = document.createElement('p');

    refs.confirmada.replaceChildren();
    titulo.textContent = 'Listo: la venta ' + venta.id + ' se registró correctamente.';
    tiempo.dateTime = venta.fecha;
    tiempo.textContent = Libreria.utils.formatearFechaHora(venta.fecha);
    meta.append(tiempo, document.createTextNode(' · ' + venta.cliente.nombre));
    lista.className = 'autorias';

    venta.renglones.forEach(function (renglon) {
      const item = document.createElement('li');
      const texto = document.createElement('span');

      texto.textContent =
        renglon.cantidad +
        ' × ' +
        renglon.titulo +
        ' · ' +
        Libreria.utils.formatearPrecio(renglon.precio_unitario) +
        ' = ' +
        Libreria.utils.formatearPrecio(renglon.subtotal);
      item.textContent = texto.textContent;
      lista.append(item);
    });

    total.textContent = 'Total: ' + Libreria.utils.formatearPrecio(venta.total);
    refs.confirmada.append(titulo, meta, lista, total);
    refs.confirmada.hidden = false;
  }

  function limpiarVenta() {
    renglones = [];
    invalidarCliente();
    refs.clienteId.value = '';
    refs.libro.value = '';
    refs.cantidad.value = '1';
    refrescarBorrador();
  }

  async function confirmarVenta() {
    if (enviando) {
      return;
    }

    ocultarMensaje();
    ocultarConfirmacion();

    if (!clienteVerificado) {
      mostrarMensaje(
        'Verificá el cliente por identificador antes de confirmar la venta.'
      );
      refs.clienteId.focus();
      return;
    }

    if (renglones.length === 0) {
      mostrarMensaje('Agregá al menos un renglón antes de confirmar la venta.');
      refs.libro.focus();
      return;
    }

    if (!sincronizarCantidades()) {
      mostrarMensaje('Revisá las cantidades: deben ser enteros mayores que cero.');
      const primero = refs.cuerpo.querySelector('input[data-libro-id]');

      if (primero) {
        primero.focus();
      }
      return;
    }

    enviando = true;
    refs.confirmar.disabled = true;
    refs.envio.hidden = false;

    try {
      const venta = await Libreria.api.crearVenta(cuerpoDeVenta());

      limpiarVenta();
      dibujarConfirmacion(venta);
      await Libreria.historial.refrescar();
    } catch (error) {
      mostrarMensaje(error.mensaje);
    } finally {
      enviando = false;
      refs.confirmar.disabled = false;
      refs.envio.hidden = true;
    }
  }

  function configurarEventos() {
    refs.form.addEventListener('submit', agregarRenglon);
    refs.confirmar.addEventListener('click', confirmarVenta);
    refs.buscarCliente.addEventListener('click', verificarClienteActual);
    refs.reintentar.addEventListener('click', cargarLibros);
    refs.clienteId.addEventListener('input', function () {
      invalidarCliente();
      ocultarMensaje();
      ocultarConfirmacion();
    });

    refs.cuerpo.addEventListener('change', function (evento) {
      const control = evento.target.closest('input[data-libro-id]');

      if (control) {
        cambiarCantidad(control);
      }
    });

    refs.cuerpo.addEventListener('click', function (evento) {
      const boton = evento.target.closest('button[data-libro-id]');

      if (boton) {
        quitarRenglon(boton.dataset.libroId);
      }
    });

    refs.libro.addEventListener('change', function () {
      ocultarMensaje();
    });
  }

  async function iniciarVentas() {
    if (iniciado) {
      return;
    }

    iniciado = true;
    renglones = [];
    libros = [];
    clienteVerificado = null;
    refs = {
      form: document.getElementById('form-venta'),
      clienteId: document.getElementById('venta-cliente-id'),
      buscarCliente: document.getElementById('venta-buscar-cliente'),
      clienteNombre: document.getElementById('venta-cliente-nombre'),
      clienteError: document.getElementById('venta-cliente-error'),
      librosError: document.getElementById('venta-libros-error'),
      reintentar: document.getElementById('venta-reintentar'),
      libro: document.getElementById('venta-libro'),
      cantidad: document.getElementById('venta-cantidad'),
      agregar: document.getElementById('venta-agregar'),
      mensaje: document.getElementById('venta-mensaje'),
      envio: document.getElementById('venta-envio'),
      cuerpo: document.querySelector('#tabla-renglones tbody'),
      vacio: document.getElementById('venta-vacio'),
      articulos: document.getElementById('venta-articulos'),
      total: document.getElementById('venta-total'),
      confirmar: document.getElementById('venta-confirmar'),
      confirmada: document.getElementById('venta-confirmada')
    };

    configurarEventos();
    refrescarBorrador();
    ocultarMensaje();
    ocultarConfirmacion();
    await cargarLibros();
  }

  Libreria.ventas = {
    iniciar: iniciarVentas,
    confirmar: confirmarVenta,
    refrescar: cargarLibros
  };
})();
