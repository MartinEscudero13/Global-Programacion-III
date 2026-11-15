(function () {
  'use strict';

  const Libreria = (window.Libreria = window.Libreria || {});
  const TEXTO_SIN_GENERO = Libreria.utils.TEXTO_SIN_GENERO;
  const TAMANO = Libreria.api.TAMANO_PAGINA;

  let refs = null;
  let estado = null;
  let detalleId = null;
  let iniciado = false;

  function crearFilaDato(etiqueta, valor) {
    const fila = document.createElement('div');
    const termino = document.createElement('dt');
    const definicion = document.createElement('dd');

    termino.textContent = etiqueta;
    definicion.textContent = valor;
    fila.append(termino, definicion);

    return fila;
  }

  function nombreDeGenero(libro) {
    return libro.genero ? libro.genero.nombre : TEXTO_SIN_GENERO;
  }

  function crearBotonDetalle(libro) {
    const boton = document.createElement('button');

    boton.type = 'button';
    boton.className = 'boton boton--secundario boton--chico';
    boton.dataset.libroId = libro.id;
    boton.textContent = 'Ver detalle';

    const oculto = document.createElement('span');
    oculto.className = 'visualmente-oculto';
    oculto.textContent = ' de ' + libro.titulo;
    boton.append(oculto);

    return boton;
  }

  function crearTarjetaLibro(libro) {
    const tarjeta = document.createElement('li');
    tarjeta.className = 'tarjeta libro';

    const lomo = document.createElement('div');
    lomo.className = 'libro__lomo';
    lomo.setAttribute('aria-hidden', 'true');

    const cuerpo = document.createElement('div');
    cuerpo.className = 'libro__cuerpo';

    const insignia = document.createElement('p');
    insignia.className = libro.genero ? 'insignia' : 'insignia insignia--sin';
    insignia.textContent = nombreDeGenero(libro);

    const titulo = document.createElement('h3');
    titulo.className = 'libro__titulo';
    titulo.textContent = libro.titulo;

    const datos = document.createElement('dl');
    datos.className = 'libro__datos';
    datos.append(
      crearFilaDato('ISBN', libro.isbn),
      crearFilaDato('Editorial', libro.editorial ? libro.editorial.nombre : '')
    );

    const precio = document.createElement('p');
    precio.className = 'libro__precio';
    precio.textContent = Libreria.utils.formatearPrecio(libro.precio);

    const botonDetalle = crearBotonDetalle(libro);
    botonDetalle.className = 'boton boton--secundario boton--chico boton--bloque';

    cuerpo.append(insignia, titulo, datos, precio, botonDetalle);    tarjeta.append(lomo, cuerpo);

    return tarjeta;
  }

  function ocultarMensajes() {
    refs.vacio.hidden = true;
    refs.sinResultados.hidden = true;
    refs.fin.hidden = true;
    refs.error.hidden = true;
    refs.reintentar.hidden = true;
  }

  function mostrarError(error) {
    refs.error.textContent = error.mensaje;
    refs.error.hidden = false;
    refs.reintentar.hidden = false;
    refs.paginacion.hidden = true;
  }

  function marcarCarga(activa) {
    refs.cargando.hidden = !activa;

    if (activa) {
      refs.seccion.setAttribute('aria-busy', 'true');
    } else {
      refs.seccion.removeAttribute('aria-busy');
    }
  }

  function dibujarLibros(libros) {
    const fragmento = document.createDocumentFragment();

    libros.forEach(function (libro) {
      fragmento.append(crearTarjetaLibro(libro));
    });

    refs.lista.replaceChildren(fragmento);
  }

  function dibujarPaginacion(libros) {
    refs.paginacion.hidden = libros.length === 0;

    Libreria.utils.actualizarPaginacion({
      anterior: refs.anterior,
      siguiente: refs.siguiente,
      pagina: refs.pagina,
      desplazamiento: estado.desplazamiento,
      tamano: TAMANO,
      haySiguiente: libros.length === TAMANO
    });
  }

  function dibujarEstadoVacio(libros, desplazamiento) {
    if (libros.length > 0) {
      return false;
    }

    if (desplazamiento > 0) {
      return true;
    }

    if (estado.titulo) {
      refs.sinResultados.hidden = false;
    } else {
      refs.vacio.hidden = false;
    }

    return false;
  }

  async function cargar(desplazamiento) {
    estado.desplazamiento = desplazamiento;
    marcarCarga(true);
    ocultarMensajes();

    try {
      const libros = await Libreria.api.listarLibros({
        titulo: estado.titulo,
        offset: desplazamiento,
        limit: TAMANO
      });

      if (libros.length === 0 && desplazamiento > 0) {
        marcarCarga(false);
        await cargar(Math.max(0, desplazamiento - TAMANO));
        refs.fin.hidden = false;
        return;
      }

      dibujarLibros(libros);
      dibujarPaginacion(libros);
      dibujarEstadoVacio(libros, desplazamiento);
    } catch (error) {
      mostrarError(error);
    } finally {
      marcarCarga(false);
    }
  }

  function refrescar() {
    return cargar(0);
  }

  function buscar(evento) {
    evento.preventDefault();
    estado.titulo = refs.input.value.trim();
    return cargar(0);
  }

  function paginaAnterior() {
    if (estado.desplazamiento === 0) {
      return;
    }

    cargar(Math.max(0, estado.desplazamiento - TAMANO));
  }

  function paginaSiguiente() {
    cargar(estado.desplazamiento + TAMANO);
  }

  function limpiarDetalle() {
    refs.detalleDatos.replaceChildren();
    refs.detalleAutores.replaceChildren();
    refs.detalleError.hidden = true;
    refs.detalleReintentar.hidden = true;
    refs.detalleTitulo.textContent = 'Libro';
  }

  function cerrarDetalle() {
    detalleId = null;
    limpiarDetalle();
    refs.detalle.hidden = true;
    refs.detalle.removeAttribute('aria-busy');
  }

  function dibujarDetalle(libro) {
    refs.detalleTitulo.textContent = libro.titulo;

    const datos = document.createDocumentFragment();
    datos.append(
      crearFilaDato('ISBN', libro.isbn),
      crearFilaDato('Editorial', libro.editorial ? libro.editorial.nombre : ''),
      crearFilaDato('Género', nombreDeGenero(libro)),
      crearFilaDato('Precio', Libreria.utils.formatearPrecio(libro.precio)),
      crearFilaDato('Stock', String(libro.stock))
    );
    refs.detalleDatos.replaceChildren(datos);

    const autorias = document.createDocumentFragment();

    (libro.autores || []).forEach(function (autoria) {
      const item = document.createElement('li');
      const nombre = document.createElement('strong');
      const detalle = document.createElement('span');

      nombre.textContent = autoria.nombre;
      detalle.textContent = ' · ' + autoria.rol + ' · orden ' + autoria.orden;
      item.append(nombre, detalle);
      autorias.append(item);
    });

    refs.detalleAutores.replaceChildren(autorias);
  }

  async function abrirDetalle(libroId) {
    detalleId = libroId;
    refs.detalle.hidden = false;
    refs.detalle.setAttribute('aria-busy', 'true');
    refs.detalleError.hidden = true;
    refs.detalleReintentar.hidden = true;
    refs.detalleDatos.replaceChildren();
    refs.detalleAutores.replaceChildren();
    refs.detalleTitulo.textContent = 'Libro ' + libroId;

    try {
      const libro = await Libreria.api.obtenerLibro(libroId);
      dibujarDetalle(libro);
    } catch (error) {
      refs.detalleError.textContent = error.mensaje;
      refs.detalleError.hidden = false;
      refs.detalleReintentar.hidden = false;
    } finally {
      refs.detalle.removeAttribute('aria-busy');
    }
  }

  function configurarEventos() {
    refs.form.addEventListener('submit', buscar);
    refs.anterior.addEventListener('click', paginaAnterior);
    refs.siguiente.addEventListener('click', paginaSiguiente);
    refs.reintentar.addEventListener('click', function () {
      cargar(estado.desplazamiento);
    });
    refs.lista.addEventListener('click', function (evento) {
      const boton = evento.target.closest('button[data-libro-id]');

      if (boton) {
        abrirDetalle(boton.dataset.libroId);
      }
    });
    refs.detalleCerrar.addEventListener('click', cerrarDetalle);
    refs.detalleReintentar.addEventListener('click', function () {
      if (detalleId !== null) {
        abrirDetalle(detalleId);
      }
    });
  }

  async function iniciarCatalogo() {
    if (iniciado) {
      return;
    }

    iniciado = true;
    estado = { titulo: '', desplazamiento: 0 };
    refs = {
      seccion: document.getElementById('catalogo'),
      form: document.getElementById('form-busqueda'),
      input: document.getElementById('busqueda-titulo'),
      lista: document.getElementById('catalogo-lista'),
      vacio: document.getElementById('catalogo-vacio'),
      sinResultados: document.getElementById('catalogo-sin-resultados'),
      cargando: document.getElementById('catalogo-cargando'),
      error: document.getElementById('catalogo-error'),
      reintentar: document.getElementById('catalogo-reintentar'),
      fin: document.getElementById('catalogo-fin'),
      paginacion: document.getElementById('catalogo-paginacion'),
      anterior: document.getElementById('catalogo-anterior'),
      siguiente: document.getElementById('catalogo-siguiente'),
      pagina: document.getElementById('catalogo-pagina'),
      detalle: document.getElementById('catalogo-detalle'),
      detalleTitulo: document.getElementById('catalogo-detalle-titulo'),
      detalleDatos: document.getElementById('catalogo-detalle-datos'),
      detalleAutores: document.getElementById('catalogo-detalle-autores'),
      detalleError: document.getElementById('catalogo-detalle-error'),
      detalleReintentar: document.getElementById('catalogo-detalle-reintentar'),
      detalleCerrar: document.getElementById('catalogo-detalle-cerrar')
    };

    configurarEventos();
    await cargar(0);
  }

  Libreria.catalogo = {
    iniciar: iniciarCatalogo,
    refrescar: refrescar,
    buscar: buscar,
    abrirDetalle: abrirDetalle,
    cerrarDetalle: cerrarDetalle
  };
})();
