(function () {
  'use strict';

  const Libreria = (window.Libreria = window.Libreria || {});
  const TAMANO = Libreria.api.TAMANO_PAGINA;

  let refs = null;
  let estado = null;
  let detalleId = null;
  let iniciado = false;

  function crearCelda(texto, esNumero) {
    const celda = document.createElement('td');
    celda.textContent = texto;

    if (esNumero) {
      celda.className = 'tabla__numero';
    }

    return celda;
  }

  function crearCeldaFecha(fecha) {
    const celda = document.createElement('td');
    const tiempo = document.createElement('time');

    tiempo.dateTime = fecha;
    tiempo.textContent = Libreria.utils.formatearFechaHora(fecha);
    celda.append(tiempo);

    return celda;
  }

  function crearBotonDetalle(venta) {
    const boton = document.createElement('button');
    const oculto = document.createElement('span');

    boton.type = 'button';
    boton.className = 'boton boton--secundario boton--chico';
    boton.dataset.ventaId = venta.id;
    boton.textContent = 'Ver detalle';
    oculto.className = 'visualmente-oculto';
    oculto.textContent = ' de la venta ' + venta.id;
    boton.append(oculto);

    return boton;
  }

  function crearFilaVenta(venta) {
    const fila = document.createElement('tr');
    const celdaDetalle = document.createElement('td');

    celdaDetalle.append(crearBotonDetalle(venta));
    fila.append(
      crearCelda(String(venta.id), true),
      crearCeldaFecha(venta.fecha),
      crearCelda(venta.cliente.nombre),
      crearCelda(Libreria.utils.formatearPrecio(venta.total), true),
      celdaDetalle
    );

    return fila;
  }

  function ocultarDetalle() {
    detalleId = null;
    refs.detalle.hidden = true;
    refs.detalleCuerpo.replaceChildren();
    refs.detalleTotal.textContent = Libreria.utils.formatearPrecio(0);
    refs.detalleTitulo.textContent = 'Venta';
    refs.detalleMeta.replaceChildren();
    refs.detalleError.hidden = true;
    refs.detalleReintentar.hidden = true;
    refs.detalle.removeAttribute('aria-busy');
  }

  function renderizarHistorial(ventas) {
    const fragmento = document.createDocumentFragment();

    ventas.forEach(function (venta) {
      fragmento.append(crearFilaVenta(venta));
    });

    refs.cuerpo.replaceChildren(fragmento);
    refs.vacio.hidden = ventas.length > 0;
    refs.paginacion.hidden = ventas.length === 0;

    Libreria.utils.actualizarPaginacion({
      anterior: refs.anterior,
      siguiente: refs.siguiente,
      pagina: refs.pagina,
      desplazamiento: estado.desplazamiento,
      tamano: TAMANO,
      haySiguiente: ventas.length === TAMANO
    });
  }

  async function cargar(desplazamiento) {
    estado.desplazamiento = desplazamiento;
    refs.cargando.hidden = false;
    refs.error.hidden = true;
    refs.reintentar.hidden = true;

    try {
      const ventas = await Libreria.api.listarVentas({
        limit: TAMANO,
        offset: desplazamiento
      });

      if (ventas.length === 0 && desplazamiento > 0) {
        refs.cargando.hidden = true;
        await cargar(Math.max(0, desplazamiento - TAMANO));
        refs.fin.hidden = false;
        return;
      }

      renderizarHistorial(ventas);
    } catch (error) {
      refs.error.textContent = error.mensaje;
      refs.error.hidden = false;
      refs.reintentar.hidden = false;
      refs.paginacion.hidden = true;
    } finally {
      refs.cargando.hidden = true;
    }
  }

  function refrescar() {
    if (!refs) {
      return Promise.resolve();
    }

    ocultarDetalle();
    estado.desplazamiento = 0;

    return cargar(0);
  }

  function dibujarDetalle(venta) {
    const tiempo = document.createElement('time');

    refs.detalleTitulo.textContent = 'Venta ' + venta.id;
    tiempo.dateTime = venta.fecha;
    tiempo.textContent = Libreria.utils.formatearFechaHora(venta.fecha);
    refs.detalleMeta.replaceChildren(
      tiempo,
      document.createTextNode(' · ' + venta.cliente.nombre)
    );
    refs.detalleTablaTitulo.textContent = 'Renglones de la venta ' + venta.id;

    const fragmento = document.createDocumentFragment();

    venta.renglones.forEach(function (renglon) {
      const fila = document.createElement('tr');

      fila.append(
        crearCelda(renglon.titulo),
        crearCelda(String(renglon.cantidad), true),
        crearCelda(Libreria.utils.formatearPrecio(renglon.precio_unitario), true),
        crearCelda(Libreria.utils.formatearPrecio(renglon.subtotal), true)
      );
      fragmento.append(fila);
    });

    refs.detalleCuerpo.replaceChildren(fragmento);
    refs.detalleTotal.textContent = Libreria.utils.formatearPrecio(venta.total);
  }

  async function abrirDetalle(ventaId) {
    detalleId = ventaId;
    refs.detalle.hidden = false;
    refs.detalle.setAttribute('aria-busy', 'true');
    refs.detalleError.hidden = true;
    refs.detalleReintentar.hidden = true;
    refs.detalleCuerpo.replaceChildren();
    refs.detalleTitulo.textContent = 'Venta ' + ventaId;

    try {
      const venta = await Libreria.api.obtenerVenta(ventaId);

      dibujarDetalle(venta);
      refs.detalleTitulo.focus();
    } catch (error) {
      refs.detalleError.textContent = error.mensaje;
      refs.detalleError.hidden = false;
      refs.detalleReintentar.hidden = false;
    } finally {
      refs.detalle.removeAttribute('aria-busy');
    }
  }

  function configurarEventos() {
    refs.cuerpo.addEventListener('click', function (evento) {
      const boton = evento.target.closest('button[data-venta-id]');

      if (boton) {
        abrirDetalle(boton.dataset.ventaId);
      }
    });

    refs.anterior.addEventListener('click', function () {
      cargar(Math.max(0, estado.desplazamiento - TAMANO));
    });
    refs.siguiente.addEventListener('click', function () {
      cargar(estado.desplazamiento + TAMANO);
    });
    refs.reintentar.addEventListener('click', function () {
      cargar(estado.desplazamiento);
    });
    refs.detalleReintentar.addEventListener('click', function () {
      if (detalleId !== null) {
        abrirDetalle(detalleId);
      }
    });
  }

  async function iniciarHistorial() {
    if (iniciado) {
      return;
    }

    iniciado = true;
    estado = { desplazamiento: 0 };
    refs = {
      cuerpo: document.querySelector('#tabla-historial tbody'),
      vacio: document.getElementById('historial-vacio'),
      cargando: document.getElementById('historial-cargando'),
      error: document.getElementById('historial-error'),
      reintentar: document.getElementById('historial-reintentar'),
      fin: document.getElementById('historial-fin'),
      paginacion: document.getElementById('historial-paginacion'),
      anterior: document.getElementById('historial-anterior'),
      siguiente: document.getElementById('historial-siguiente'),
      pagina: document.getElementById('historial-pagina'),
      detalle: document.getElementById('detalle-venta'),
      detalleTitulo: document.getElementById('detalle-titulo'),
      detalleMeta: document.getElementById('detalle-meta'),
      detalleTablaTitulo: document.getElementById('detalle-tabla-titulo'),
      detalleCuerpo: document.querySelector('#detalle-renglones tbody'),
      detalleTotal: document.getElementById('detalle-total'),
      detalleError: document.getElementById('detalle-error'),
      detalleReintentar: document.getElementById('detalle-reintentar')
    };

    configurarEventos();
    await cargar(0);
  }

  Libreria.historial = {
    iniciar: iniciarHistorial,
    refrescar: refrescar,
    mostrarDetalle: abrirDetalle
  };
})();
