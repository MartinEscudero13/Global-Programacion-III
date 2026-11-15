(function () {
  'use strict';

  const Libreria = (window.Libreria = window.Libreria || {});
  const TEXTO_SIN_GENERO = Libreria.utils.TEXTO_SIN_GENERO;
  const TAMANO = Libreria.api.TAMANO_PAGINA;
  const ROLES = ['autor', 'coautor', 'traductor', 'ilustrador'];

  let refs = null;
  let estado = null;
  let autorias = [];
  let autorVerificado = null;
  let opcionesListas = false;
  let limpiandoFormulario = false;
  let iniciado = false;

  function crearCelda(texto, esNumero) {
    const celda = document.createElement('td');
    celda.textContent = texto;

    if (esNumero) {
      celda.className = 'tabla__numero';
    }

    return celda;
  }

  function crearFilaLibro(libro) {
    const fila = document.createElement('tr');

    fila.append(
      crearCelda(libro.titulo),
      crearCelda(libro.isbn),
      crearCelda(libro.editorial ? libro.editorial.nombre : ''),
      crearCelda(libro.genero ? libro.genero.nombre : TEXTO_SIN_GENERO),
      crearCelda(String(libro.stock), true),
      crearCelda(Libreria.utils.formatearPrecio(libro.precio), true)
    );

    return fila;
  }

  function renderizarTabla(libros) {
    const fragmento = document.createDocumentFragment();

    libros.forEach(function (libro) {
      fragmento.append(crearFilaLibro(libro));
    });

    refs.cuerpo.replaceChildren(fragmento);
    refs.vacio.hidden = libros.length > 0;
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

  async function cargarTabla(desplazamiento) {
    estado.desplazamiento = desplazamiento;
    refs.cargando.hidden = false;
    refs.error.hidden = true;
    refs.reintentar.hidden = true;

    try {
      const libros = await Libreria.api.listarLibros({
        limit: TAMANO,
        offset: desplazamiento
      });

      if (libros.length === 0 && desplazamiento > 0) {
        refs.cargando.hidden = true;
        await cargarTabla(Math.max(0, desplazamiento - TAMANO));
        refs.fin.hidden = false;
        return;
      }

      renderizarTabla(libros);
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
    return cargarTabla(0);
  }

  // Después de un alta, la tabla se ubica en la página que contiene el libro
  // creado: el listado de la API ordena por id y el nuevo queda al final.
  async function irAlLibroCreado(libroId) {
    for (let pagina = 0; pagina < 20; pagina += 1) {
      const libros = await Libreria.api.listarLibros({
        limit: TAMANO,
        offset: pagina * TAMANO
      });
      const encontrado = libros.some(function (libro) {
        return libro.id === libroId;
      });

      if (encontrado || libros.length < TAMANO) {
        estado.desplazamiento = pagina * TAMANO;
        renderizarTabla(libros);
        return;
      }
    }

    await cargarTabla(0);
  }

  function opcionesDeEditorial() {
    return refs.editoriales.map(function (editorial) {
      return { valor: String(editorial.id), texto: editorial.nombre };
    });
  }

  function opcionesDeGenero() {
    return refs.generos.map(function (genero) {
      return { valor: String(genero.id), texto: genero.nombre };
    });
  }

  function poblarSelects() {
    const editorialPrevia = refs.editorial.value;
    const generoPrevio = refs.genero.value;

    Libreria.utils.poblarSelect(
      refs.editorial,
      opcionesDeEditorial(),
      'Seleccioná una editorial',
      editorialPrevia
    );
    Libreria.utils.poblarSelect(
      refs.genero,
      opcionesDeGenero(),
      TEXTO_SIN_GENERO,
      generoPrevio
    );
  }

  function marcarOpciones(disponibles, mensaje) {
    opcionesListas = disponibles;
    refs.registrar.disabled = !disponibles;
    refs.opcionesError.hidden = disponibles;
    refs.opcionesReintentar.hidden = disponibles;

    if (!disponibles) {
      refs.opcionesError.textContent =
        mensaje || 'No se pudieron cargar las editoriales y los géneros.';
    }
  }

  async function cargarOpciones() {
    refs.opcionesError.hidden = true;
    refs.opcionesReintentar.hidden = true;

    try {
      const resultados = await Promise.all([
        Libreria.api.listarTodas('editoriales'),
        Libreria.api.listarTodas('generos')
      ]);
      const editoriales = resultados[0];
      const generos = resultados[1];

      refs.editoriales = editoriales.items;
      refs.generos = generos.items;
      poblarSelects();

      if (editoriales.truncado || generos.truncado) {
        marcarOpciones(
          true,
          'La lista de editoriales o géneros quedó incompleta porque supera el máximo de 2000 elementos.'
        );
        refs.opcionesError.className = 'mensaje mensaje--aviso';
        refs.opcionesError.hidden = false;
        return;
      }

      refs.opcionesError.className = 'mensaje mensaje--error';
      marcarOpciones(true);
    } catch (error) {
      refs.opcionesError.className = 'mensaje mensaje--error';
      marcarOpciones(false, error.mensaje);
    }
  }

  function limpiarErrorAutor() {
    refs.errores.autorias.textContent = '';
    refs.errores.autorias.hidden = true;
    refs.grupoAutorias.removeAttribute('aria-invalid');
  }

  function mostrarErrorAutor(mensaje) {
    refs.errores.autorias.textContent = mensaje;
    refs.errores.autorias.hidden = false;
    refs.grupoAutorias.setAttribute('aria-invalid', 'true');
  }

  function renderizarAutorias() {
    const fragmento = document.createDocumentFragment();

    autorias.forEach(function (autoria) {
      const item = document.createElement('li');
      const nombre = document.createElement('strong');
      const detalle = document.createElement('span');
      const quitar = document.createElement('button');

      nombre.textContent = autoria.nombre;
      detalle.textContent = ' · ' + autoria.rol + ' · orden ' + autoria.orden;
      quitar.type = 'button';
      quitar.className = 'boton boton--peligro boton--chico';
      quitar.dataset.autorId = autoria.autor_id;
      quitar.textContent = 'Quitar';

      const oculto = document.createElement('span');
      oculto.className = 'visualmente-oculto';
      oculto.textContent = ' ' + autoria.nombre;
      quitar.append(oculto);

      item.append(nombre, detalle, quitar);
      fragmento.append(item);
    });

    refs.autoriasLista.replaceChildren(fragmento);
  }

  function invalidarAutor() {
    autorVerificado = null;
    refs.autorNombre.textContent = '';
    refs.autorAgregar.disabled = true;
  }

  function limpiarAutor() {
    invalidarAutor();
    refs.autorId.value = '';
  }

  function describirAutor(autor) {
    return 'Autor ' + autor.id + ': ' + autor.nombre;
  }

  async function buscarAutor() {
    const texto = refs.autorId.value.trim();
    const identificador = Number(texto);

    refs.autorNombre.textContent = '';
    refs.autorAgregar.disabled = true;
    autorVerificado = null;
    limpiarErrorAutor();

    if (!texto || !Number.isInteger(identificador) || identificador < 1) {
      mostrarErrorAutor('Ingresá un identificador de autor válido.');
      refs.autorId.focus();
      return;
    }

    refs.autorNombre.textContent = 'Buscando…';

    try {
      const autor = await Libreria.api.obtenerAutor(identificador);

      autorVerificado = { id: autor.id, nombre: autor.nombre };
      refs.autorNombre.textContent = describirAutor(autor);
      refs.autorAgregar.disabled = false;
    } catch (error) {
      refs.autorNombre.textContent = '';
      mostrarErrorAutor(error.mensaje);
    }
  }

  function agregarAutoria() {
    limpiarErrorAutor();

    if (!autorVerificado) {
      mostrarErrorAutor('Verificá el autor por identificador antes de agregarlo.');
      return;
    }

    const repetido = autorias.some(function (autoria) {
      return autoria.autor_id === autorVerificado.id;
    });

    if (repetido) {
      mostrarErrorAutor('El autor ya está en la lista de autorías.');
      return;
    }

    const rol = refs.autorRol.value;

    if (ROLES.indexOf(rol) === -1) {
      mostrarErrorAutor('Elegí un rol válido para la autoría.');
      return;
    }

    autorias.push({
      autor_id: autorVerificado.id,
      nombre: autorVerificado.nombre,
      rol: rol,
      orden: autorias.length + 1
    });
    renderizarAutorias();
    limpiarAutor();
  }

  function quitarAutoria(autorId) {
    const indice = autorias.findIndex(function (autoria) {
      return String(autoria.autor_id) === String(autorId);
    });

    if (indice === -1) {
      return;
    }

    autorias.splice(indice, 1);
    autorias.forEach(function (autoria, posicion) {
      autoria.orden = posicion + 1;
    });
    renderizarAutorias();
  }

  function leerFormulario() {
    return {
      titulo: refs.titulo.value.trim(),
      isbn: refs.isbn.value.trim(),
      precio: refs.precio.value.trim(),
      stock: refs.stock.value.trim(),
      editorialId: refs.editorial.value,
      generoId: refs.genero.value,
      autorias: autorias.slice()
    };
  }

  function validarLibro(datos) {
    const errores = {};
    let precio = null;
    let stock = null;

    if (!datos.titulo) {
      errores.titulo = 'Ingresá el título.';
    }

    if (!datos.isbn) {
      errores.isbn = 'Ingresá el ISBN.';
    }

    if (!datos.precio) {
      errores.precio = 'Ingresá el precio.';
    } else {
      const numero = Libreria.utils.parsearImporte(datos.precio);

      if (!Number.isFinite(numero) || numero <= 0) {
        errores.precio = 'El precio debe ser un número mayor que cero.';
      } else {
        precio = Libreria.utils.redondearCentavos(numero);
      }
    }

    if (datos.stock === '') {
      errores.stock = 'Ingresá el stock.';
    } else {
      const numero = Number(datos.stock);

      if (!Number.isInteger(numero) || numero < 0) {
        errores.stock = 'El stock debe ser un número entero mayor o igual a cero.';
      } else {
        stock = numero;
      }
    }

    if (!datos.editorialId) {
      errores.editorialId = 'Seleccioná una editorial.';
    }

    if (datos.autorias.length === 0) {
      errores.autorias = 'Agregá al menos una autoría.';
    }

    return {
      valido: Object.keys(errores).length === 0,
      errores: errores,
      valores: {
        titulo: datos.titulo,
        isbn: datos.isbn,
        precio: precio,
        stock: stock,
        editorialId: datos.editorialId,
        generoId: datos.generoId || null,
        autorias: datos.autorias
      }
    };
  }

  function controlesDeCampo(clave) {
    if (clave === 'autorias') {
      return null;
    }

    return refs.controles[clave];
  }

  function erroresDeCampo(clave) {
    return refs.errores[clave];
  }

  function marcarError(clave, mensaje) {
    const error = erroresDeCampo(clave);

    error.textContent = mensaje;
    error.hidden = false;

    if (clave === 'autorias') {
      refs.grupoAutorias.setAttribute('aria-invalid', 'true');
      return;
    }

    controlesDeCampo(clave).setAttribute('aria-invalid', 'true');
  }

  function limpiarError(clave) {
    const error = erroresDeCampo(clave);

    error.textContent = '';
    error.hidden = true;

    if (clave === 'autorias') {
      refs.grupoAutorias.removeAttribute('aria-invalid');
      return;
    }

    controlesDeCampo(clave).removeAttribute('aria-invalid');
  }

  const CAMPOS = [
    'titulo',
    'isbn',
    'precio',
    'stock',
    'editorialId',
    'generoId',
    'autorias'
  ];

  function limpiarErrores() {
    CAMPOS.forEach(limpiarError);
    refs.mensaje.hidden = true;
  }

  function mostrarErrores(errores) {
    const claves = CAMPOS.filter(function (clave) {
      return Boolean(errores[clave]);
    });

    claves.forEach(function (clave) {
      marcarError(clave, errores[clave]);
    });

    if (claves.length > 0) {
      const clave = claves[0];

      if (clave === 'autorias') {
        refs.autorId.focus();
      } else {
        controlesDeCampo(clave).focus();
      }
    }
  }

  function ocultarExito() {
    refs.exito.hidden = true;
  }

  function mostrarExito(mensaje) {
    refs.exito.textContent = mensaje;
    refs.exito.hidden = false;
  }

  function cuerpoLibro(valores) {
    const cuerpo = {
      isbn: valores.isbn,
      titulo: valores.titulo,
      precio: valores.precio.toFixed(2),
      stock: valores.stock,
      editorial_id: Number(valores.editorialId),
      autores: valores.autorias.map(function (autoria) {
        return {
          autor_id: autoria.autor_id,
          rol: autoria.rol,
          orden: autoria.orden
        };
      })
    };

    if (valores.generoId) {
      cuerpo.genero_id = Number(valores.generoId);
    }

    return cuerpo;
  }

  function limpiarFormulario() {
    limpiandoFormulario = true;
    refs.form.reset();
    limpiandoFormulario = false;
    autorias = [];
    autorVerificado = null;
    refs.autoriasLista.replaceChildren();
    refs.autorNombre.textContent = '';
    refs.autorAgregar.disabled = true;
    refs.autorId.value = '';
    limpiarErrores();
  }

  async function registrarLibro(evento) {
    evento.preventDefault();
    ocultarExito();
    limpiarErrores();

    const resultado = validarLibro(leerFormulario());

    if (!resultado.valido) {
      mostrarErrores(resultado.errores);
      return;
    }

    if (!opcionesListas) {
      refs.opcionesError.hidden = false;
      return;
    }

    refs.registrar.disabled = true;

    try {
      const creado = await Libreria.api.crearLibro(cuerpoLibro(resultado.valores));

      limpiarFormulario();
      mostrarExito(
        'Listo: se registró «' + creado.titulo + '» con el identificador ' + creado.id + '.'
      );
      refs.titulo.focus();
      await irAlLibroCreado(creado.id);
      await Libreria.catalogo.refrescar();
    } catch (error) {
      refs.mensaje.textContent = error.mensaje;
      refs.mensaje.hidden = false;
    } finally {
      refs.registrar.disabled = !opcionesListas;
    }
  }

  function configurarEventos() {
    refs.form.addEventListener('submit', registrarLibro);
    refs.opcionesReintentar.addEventListener('click', function () {
      cargarOpciones();
    });
    refs.autorBuscar.addEventListener('click', buscarAutor);
    refs.autorAgregar.addEventListener('click', agregarAutoria);
    refs.autorId.addEventListener('input', invalidarAutor);
    refs.autoriasLista.addEventListener('click', function (evento) {
      const boton = evento.target.closest('button[data-autor-id]');

      if (boton) {
        quitarAutoria(boton.dataset.autorId);
      }
    });

    refs.form.addEventListener('reset', function () {
      if (limpiandoFormulario) {
        return;
      }

      window.setTimeout(function () {
        autorias = [];
        autorVerificado = null;
        refs.autoriasLista.replaceChildren();
        refs.autorNombre.textContent = '';
        refs.autorAgregar.disabled = true;
        limpiarErrores();
        ocultarExito();
      }, 0);
    });

    Object.keys(refs.controles).forEach(function (clave) {
      const control = refs.controles[clave];

      function manejarCambio() {
        limpiarError(clave);
        refs.mensaje.hidden = true;
        ocultarExito();
      }

      control.addEventListener('input', manejarCambio);
      control.addEventListener('change', manejarCambio);
    });

    refs.anterior.addEventListener('click', function () {
      cargarTabla(Math.max(0, estado.desplazamiento - TAMANO));
    });
    refs.siguiente.addEventListener('click', function () {
      cargarTabla(estado.desplazamiento + TAMANO);
    });
    refs.reintentar.addEventListener('click', function () {
      cargarTabla(estado.desplazamiento);
    });
  }

  async function iniciarLibros() {
    if (iniciado) {
      return;
    }

    iniciado = true;
    estado = { desplazamiento: 0 };
    refs = {
      form: document.getElementById('form-libro'),
      titulo: document.getElementById('libro-titulo'),
      isbn: document.getElementById('libro-isbn'),
      precio: document.getElementById('libro-precio'),
      stock: document.getElementById('libro-stock'),
      editorial: document.getElementById('libro-editorial'),
      genero: document.getElementById('libro-genero'),
      mensaje: document.getElementById('libro-mensaje'),
      exito: document.getElementById('libro-exito'),
      registrar: document.getElementById('libro-registrar'),
      limpiar: document.getElementById('libro-limpiar'),
      opcionesError: document.getElementById('libro-opciones-error'),
      opcionesReintentar: document.getElementById('libro-opciones-reintentar'),
      autorId: document.getElementById('libro-autor-id'),
      autorBuscar: document.getElementById('libro-autor-buscar'),
      autorNombre: document.getElementById('libro-autor-nombre'),
      autorRol: document.getElementById('libro-autor-rol'),
      autorAgregar: document.getElementById('libro-autor-agregar'),
      autoriasLista: document.getElementById('libro-autorias'),
      grupoAutorias: document.getElementById('libro-autorias').closest('fieldset'),
      cuerpo: document.querySelector('#tabla-libros tbody'),
      vacio: document.getElementById('libros-vacio'),
      cargando: document.getElementById('libros-cargando'),
      error: document.getElementById('libros-error'),
      reintentar: document.getElementById('libros-reintentar'),
      fin: document.getElementById('libros-fin'),
      paginacion: document.getElementById('libros-paginacion'),
      anterior: document.getElementById('libros-anterior'),
      siguiente: document.getElementById('libros-siguiente'),
      pagina: document.getElementById('libros-pagina'),
      editoriales: [],
      generos: [],
      errores: {
        titulo: document.getElementById('libro-titulo-error'),
        isbn: document.getElementById('libro-isbn-error'),
        precio: document.getElementById('libro-precio-error'),
        stock: document.getElementById('libro-stock-error'),
        editorialId: document.getElementById('libro-editorial-error'),
        generoId: document.getElementById('libro-genero-error'),
        autorias: document.getElementById('libro-autor-error')
      }
    };

    refs.controles = {
      titulo: refs.titulo,
      isbn: refs.isbn,
      precio: refs.precio,
      stock: refs.stock,
      editorialId: refs.editorial,
      generoId: refs.genero
    };

    refs.registrar.disabled = true;
    configurarEventos();
    await Promise.all([cargarOpciones(), cargarTabla(0)]);
  }

  Libreria.libros = {
    iniciar: iniciarLibros,
    refrescar: refrescar,
    validarLibro: validarLibro,
    renderizarTabla: renderizarTabla
  };
})();
