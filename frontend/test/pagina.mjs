// Árbol del `body` equivalente a `public/index.html`, armado con el DOM
// simulado. Los tests lo usan como página montada; el id de cada nodo debe
// coincidir con el documento real (lo verifica `pagina.test.mjs`).

import { Documento } from './dom-simulado.mjs';

const ATRIBUTOS_SIMPLES = [
  'role',
  'type',
  'name',
  'href',
  'placeholder',
  'autocomplete',
  'inputmode',
  'min',
  'max',
  'step',
  'tabindex',
  'spellcheck',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-live'
];

function crear(documento, etiqueta, propiedades, hijos) {
  const configuracion = propiedades || {};
  const elemento = documento.createElement(etiqueta);

  if (configuracion.id) {
    elemento.id = configuracion.id;
  }

  if (configuracion.clase) {
    elemento.className = configuracion.clase;
  }

  ATRIBUTOS_SIMPLES.forEach(function (nombre) {
    if (configuracion[nombre] !== undefined) {
      elemento.setAttribute(nombre, configuracion[nombre]);
    }
  });

  if (configuracion.texto !== undefined) {
    elemento.textContent = configuracion.texto;
  }

  if (configuracion.hidden) {
    elemento.hidden = true;
  }

  if (configuracion.deshabilitado) {
    elemento.disabled = true;
  }

  if (configuracion.valor !== undefined) {
    elemento.value = configuracion.valor;
  }

  if (configuracion.marcado) {
    elemento.checked = true;
  }

  (hijos || []).forEach(function (hijo) {
    elemento.append(hijo);
  });

  return elemento;
}

function campo(documento, id, etiqueta, hijos) {
  return crear(documento, 'div', { clase: 'campo' }, [
    crear(documento, 'label', {
      clase: 'campo__etiqueta',
      for: id,
      texto: etiqueta
    }),
    crear(documento, 'input', {
      id: id,
      clase: 'campo__control',
      type: 'text',
      'aria-describedby': id + '-error'
    })
  ].concat(hijos || []));
}

function menuPrincipal(documento) {
  const enlaces = [
    { href: '#catalogo', texto: 'Catálogo' },
    { href: '#libros', texto: 'Libros' },
    { href: '#clientes', texto: 'Clientes' },
    { href: '#ventas', texto: 'Ventas' },
    { href: '#historial', texto: 'Historial' }
  ];

  return crear(
    documento,
    'nav',
    { clase: 'nav-principal', 'aria-label': 'Navegación principal' },
    [
      crear(
        documento,
        'ul',
        { clase: 'nav-principal__lista' },
        enlaces.map(function (enlace) {
          return crear(documento, 'li', {}, [
            crear(documento, 'a', {
              clase: 'nav-principal__enlace',
              href: enlace.href,
              texto: enlace.texto
            })
          ]);
        })
      )
    ]
  );
}

function vistaCatalogo(documento) {
  return crear(
    documento,
    'section',
    { id: 'catalogo', clase: 'vista', 'aria-labelledby': 'catalogo-titulo' },
    [
      crear(documento, 'div', { clase: 'vista__encabezado' }, [
        crear(documento, 'p', { clase: 'vista__sobretitulo', texto: 'Librería' }),
        crear(documento, 'h2', { id: 'catalogo-titulo', texto: 'Catálogo' }),
        crear(documento, 'p', {
          clase: 'vista__descripcion',
          texto: 'Libros disponibles. Buscá por título para acotar el listado.'
        })
      ]),
      crear(documento, 'form', { id: 'form-busqueda', clase: 'buscador', role: 'search' }, [
        crear(documento, 'div', { clase: 'campo' }, [
          crear(documento, 'label', {
            clase: 'campo__etiqueta',
            for: 'busqueda-titulo',
            texto: 'Buscar por título'
          }),
          crear(documento, 'input', {
            id: 'busqueda-titulo',
            clase: 'campo__control',
            type: 'search',
            name: 'busqueda',
            placeholder: 'Ej.: jardín',
            autocomplete: 'off'
          })
        ]),
        crear(documento, 'button', {
          id: 'boton-buscar',
          clase: 'boton boton--primario',
          type: 'submit',
          texto: 'Buscar'
        })
      ]),
      crear(documento, 'p', {
        id: 'catalogo-vacio',
        clase: 'mensaje mensaje--vacio',
        role: 'status',
        texto: 'No hay libros para mostrar.',
        hidden: true
      }),
      crear(documento, 'p', {
        id: 'catalogo-sin-resultados',
        clase: 'mensaje mensaje--aviso',
        role: 'status',
        texto: 'No se encontraron libros con ese título.',
        hidden: true
      }),
      crear(documento, 'ul', {
        id: 'catalogo-lista',
        clase: 'rejilla-libros',
        'aria-label': 'Libros del catálogo'
      })
    ]
  );
}

function formularioLibro(documento) {
  const rejilla = crear(documento, 'div', { clase: 'formulario__rejilla' }, [
    crear(documento, 'div', { clase: 'campo' }, [
      crear(documento, 'label', {
        clase: 'campo__etiqueta',
        for: 'libro-titulo',
        texto: 'Título (obligatorio)'
      }),
      crear(documento, 'input', {
        id: 'libro-titulo',
        clase: 'campo__control',
        type: 'text',
        name: 'titulo',
        autocomplete: 'off',
        'aria-describedby': 'libro-titulo-error'
      }),
      crear(documento, 'p', {
        id: 'libro-titulo-error',
        clase: 'campo__error',
        hidden: true
      })
    ]),
    crear(documento, 'div', { clase: 'campo' }, [
      crear(documento, 'label', {
        clase: 'campo__etiqueta',
        for: 'libro-isbn',
        texto: 'ISBN (obligatorio)'
      }),
      crear(documento, 'input', {
        id: 'libro-isbn',
        clase: 'campo__control',
        type: 'text',
        name: 'isbn',
        inputmode: 'numeric',
        autocomplete: 'off',
        spellcheck: 'false',
        'aria-describedby': 'libro-isbn-ayuda libro-isbn-error'
      }),
      crear(documento, 'p', {
        id: 'libro-isbn-ayuda',
        clase: 'campo__ayuda',
        texto: 'Tal como figura en el libro.'
      }),
      crear(documento, 'p', {
        id: 'libro-isbn-error',
        clase: 'campo__error',
        hidden: true
      })
    ]),
    crear(documento, 'div', { clase: 'campo' }, [
      crear(documento, 'label', {
        clase: 'campo__etiqueta',
        for: 'libro-precio',
        texto: 'Precio (obligatorio)'
      }),
      crear(documento, 'input', {
        id: 'libro-precio',
        clase: 'campo__control',
        type: 'number',
        name: 'precio',
        min: '0.01',
        step: '0.01',
        inputmode: 'decimal',
        'aria-describedby': 'libro-precio-error'
      }),
      crear(documento, 'p', {
        id: 'libro-precio-error',
        clase: 'campo__error',
        hidden: true
      })
    ]),
    crear(documento, 'div', { clase: 'campo' }, [
      crear(documento, 'label', {
        clase: 'campo__etiqueta',
        for: 'libro-editorial',
        texto: 'Editorial (obligatoria)'
      }),
      crear(documento, 'select', {
        id: 'libro-editorial',
        clase: 'campo__control',
        name: 'editorial',
        'aria-describedby': 'libro-editorial-error'
      }),
      crear(documento, 'p', {
        id: 'libro-editorial-error',
        clase: 'campo__error',
        hidden: true
      })
    ]),
    crear(documento, 'div', { clase: 'campo' }, [
      crear(documento, 'label', {
        clase: 'campo__etiqueta',
        for: 'libro-genero',
        texto: 'Género'
      }),
      crear(documento, 'select', {
        id: 'libro-genero',
        clase: 'campo__control',
        name: 'genero',
        'aria-describedby': 'libro-genero-error'
      }),
      crear(documento, 'p', { clase: 'campo__ayuda', texto: 'Opcional.' }),
      crear(documento, 'p', {
        id: 'libro-genero-error',
        clase: 'campo__error',
        hidden: true
      })
    ]),
    crear(
      documento,
      'fieldset',
      { clase: 'campo campo--grupo campo--ancho', 'aria-describedby': 'libro-autores-error' },
      [
        crear(documento, 'legend', {
          clase: 'campo__etiqueta',
          texto: 'Autores (al menos uno)'
        }),
        crear(documento, 'div', { id: 'libro-autores', clase: 'opciones' }),
        crear(documento, 'p', {
          id: 'libro-autores-error',
          clase: 'campo__error',
          hidden: true
        })
      ]
    )
  ]);

  return crear(documento, 'form', { id: 'form-libro', clase: 'formulario' }, [
    crear(documento, 'h3', { clase: 'formulario__titulo', texto: 'Alta de libro' }),
    rejilla,
    crear(documento, 'p', {
      id: 'libro-mensaje',
      clase: 'mensaje mensaje--error',
      role: 'alert',
      texto: 'Revisá los campos marcados.',
      hidden: true
    }),
    crear(documento, 'p', {
      id: 'libro-exito',
      clase: 'mensaje mensaje--exito',
      role: 'status',
      texto: 'Listo: el libro se registró correctamente.',
      hidden: true
    }),
    crear(documento, 'div', { clase: 'formulario__acciones' }, [
      crear(documento, 'button', {
        id: 'libro-registrar',
        clase: 'boton boton--primario',
        type: 'submit',
        texto: 'Registrar libro'
      }),
      crear(documento, 'button', {
        id: 'libro-limpiar',
        clase: 'boton boton--secundario',
        type: 'reset',
        texto: 'Limpiar formulario'
      })
    ])
  ]);
}

function tablaLibros(documento) {
  return crear(documento, 'div', { clase: 'panel' }, [
    crear(documento, 'h3', { clase: 'panel__titulo', texto: 'Libros registrados' }),
    crear(
      documento,
      'section',
      { clase: 'tabla-contenedor', 'aria-labelledby': 'libros-tabla-titulo', tabindex: '0' },
      [
        crear(documento, 'table', { id: 'tabla-libros', clase: 'tabla' }, [
          crear(documento, 'caption', {
            id: 'libros-tabla-titulo',
            clase: 'tabla__titulo visualmente-oculto',
            texto: 'Listado de libros'
          }),
          crear(documento, 'thead', {}, [
            crear(documento, 'tr', {}, [
              crear(documento, 'th', { scope: 'col', texto: 'Título' }),
              crear(documento, 'th', { scope: 'col', texto: 'ISBN' }),
              crear(documento, 'th', { scope: 'col', texto: 'Editorial' }),
              crear(documento, 'th', { scope: 'col', texto: 'Género' }),
              crear(documento, 'th', { scope: 'col', texto: 'Autores' }),
              crear(documento, 'th', { scope: 'col', clase: 'tabla__numero', texto: 'Precio' })
            ])
          ]),
          crear(documento, 'tbody', {})
        ])
      ]
    ),
    crear(documento, 'p', {
      id: 'libros-vacio',
      clase: 'mensaje mensaje--vacio',
      role: 'status',
      texto: 'No hay libros registrados.',
      hidden: true
    })
  ]);
}

function vistaLibros(documento) {
  return crear(
    documento,
    'section',
    { id: 'libros', clase: 'vista', 'aria-labelledby': 'libros-titulo' },
    [
      crear(documento, 'div', { clase: 'vista__encabezado' }, [
        crear(documento, 'p', { clase: 'vista__sobretitulo', texto: 'Altas' }),
        crear(documento, 'h2', { id: 'libros-titulo', texto: 'Libros' })
      ]),
      crear(documento, 'div', { clase: 'disposicion-alta' }, [
        formularioLibro(documento),
        tablaLibros(documento)
      ])
    ]
  );
}

function formularioCliente(documento) {
  return crear(documento, 'form', { id: 'form-cliente', clase: 'formulario' }, [
    crear(documento, 'h3', { clase: 'formulario__titulo', texto: 'Alta de cliente' }),
    crear(documento, 'div', { clase: 'formulario__rejilla' }, [
      crear(documento, 'div', { clase: 'campo campo--ancho' }, [
        crear(documento, 'label', {
          clase: 'campo__etiqueta',
          for: 'cliente-nombre',
          texto: 'Nombre completo (obligatorio)'
        }),
        crear(documento, 'input', {
          id: 'cliente-nombre',
          clase: 'campo__control',
          type: 'text',
          name: 'nombre',
          autocomplete: 'name',
          'aria-describedby': 'cliente-nombre-error'
        }),
        crear(documento, 'p', {
          id: 'cliente-nombre-error',
          clase: 'campo__error',
          hidden: true
        })
      ]),
      crear(documento, 'div', { clase: 'campo campo--ancho' }, [
        crear(documento, 'label', {
          clase: 'campo__etiqueta',
          for: 'cliente-email',
          texto: 'Email (obligatorio)'
        }),
        crear(documento, 'input', {
          id: 'cliente-email',
          clase: 'campo__control',
          type: 'email',
          name: 'email',
          autocomplete: 'email',
          'aria-describedby': 'cliente-email-ayuda cliente-email-error'
        }),
        crear(documento, 'p', {
          id: 'cliente-email-ayuda',
          clase: 'campo__ayuda',
          texto: 'La unicidad la controla el servidor.'
        }),
        crear(documento, 'p', {
          id: 'cliente-email-error',
          clase: 'campo__error',
          hidden: true
        })
      ])
    ]),
    crear(documento, 'p', {
      id: 'cliente-mensaje',
      clase: 'mensaje mensaje--error',
      role: 'alert',
      texto: 'Revisá los campos marcados.',
      hidden: true
    }),
    crear(documento, 'p', {
      id: 'cliente-exito',
      clase: 'mensaje mensaje--exito',
      role: 'status',
      texto: 'Listo: el cliente se registró correctamente.',
      hidden: true
    }),
    crear(documento, 'div', { clase: 'formulario__acciones' }, [
      crear(documento, 'button', {
        id: 'cliente-registrar',
        clase: 'boton boton--primario',
        type: 'submit',
        texto: 'Registrar cliente'
      }),
      crear(documento, 'button', {
        id: 'cliente-limpiar',
        clase: 'boton boton--secundario',
        type: 'reset',
        texto: 'Limpiar formulario'
      })
    ])
  ]);
}

function tablaClientes(documento) {
  return crear(documento, 'div', { clase: 'panel' }, [
    crear(documento, 'h3', { clase: 'panel__titulo', texto: 'Clientes registrados' }),
    crear(
      documento,
      'section',
      { clase: 'tabla-contenedor', 'aria-labelledby': 'clientes-tabla-titulo', tabindex: '0' },
      [
        crear(documento, 'table', { id: 'tabla-clientes', clase: 'tabla tabla--angosta' }, [
          crear(documento, 'caption', {
            id: 'clientes-tabla-titulo',
            clase: 'tabla__titulo visualmente-oculto',
            texto: 'Listado de clientes'
          }),
          crear(documento, 'thead', {}, [
            crear(documento, 'tr', {}, [
              crear(documento, 'th', { scope: 'col', texto: 'Nombre completo' }),
              crear(documento, 'th', { scope: 'col', texto: 'Email' })
            ])
          ]),
          crear(documento, 'tbody', {})
        ])
      ]
    ),
    crear(documento, 'p', {
      id: 'clientes-vacio',
      clase: 'mensaje mensaje--vacio',
      role: 'status',
      texto: 'No hay clientes registrados.',
      hidden: true
    })
  ]);
}

function vistaClientes(documento) {
  return crear(
    documento,
    'section',
    { id: 'clientes', clase: 'vista', 'aria-labelledby': 'clientes-titulo' },
    [
      crear(documento, 'div', { clase: 'vista__encabezado' }, [
        crear(documento, 'p', { clase: 'vista__sobretitulo', texto: 'Altas' }),
        crear(documento, 'h2', { id: 'clientes-titulo', texto: 'Clientes' })
      ]),
      crear(documento, 'div', { clase: 'disposicion-alta' }, [
        formularioCliente(documento),
        tablaClientes(documento)
      ])
    ]
  );
}

function formularioVenta(documento) {
  return crear(documento, 'form', { id: 'form-venta', clase: 'formulario' }, [
    crear(documento, 'h3', { clase: 'formulario__titulo', texto: 'Nueva venta' }),
    crear(documento, 'div', { clase: 'campo' }, [
      crear(documento, 'label', {
        clase: 'campo__etiqueta',
        for: 'venta-cliente',
        texto: 'Cliente (obligatorio)'
      }),
      crear(documento, 'select', {
        id: 'venta-cliente',
        clase: 'campo__control',
        name: 'cliente'
      })
    ]),
    crear(documento, 'div', { clase: 'formulario__renglon' }, [
      crear(documento, 'div', { clase: 'campo' }, [
        crear(documento, 'label', {
          clase: 'campo__etiqueta',
          for: 'venta-libro',
          texto: 'Libro (obligatorio)'
        }),
        crear(documento, 'select', {
          id: 'venta-libro',
          clase: 'campo__control',
          name: 'libro'
        })
      ]),
      crear(documento, 'div', { clase: 'campo' }, [
        crear(documento, 'label', {
          clase: 'campo__etiqueta',
          for: 'venta-cantidad',
          texto: 'Cantidad (obligatoria)'
        }),
        crear(documento, 'input', {
          id: 'venta-cantidad',
          clase: 'campo__control',
          type: 'number',
          name: 'cantidad',
          min: '1',
          step: '1',
          inputmode: 'numeric',
          valor: '1'
        })
      ]),
      crear(documento, 'button', {
        id: 'venta-agregar',
        clase: 'boton boton--secundario',
        type: 'submit',
        texto: 'Agregar renglón'
      })
    ]),
    crear(documento, 'p', {
      id: 'venta-mensaje',
      clase: 'mensaje mensaje--error',
      role: 'alert',
      hidden: true
    }),
    crear(documento, 'h4', { clase: 'formulario__subtitulo', texto: 'Renglones de la venta' }),
    crear(
      documento,
      'section',
      { clase: 'tabla-contenedor', 'aria-labelledby': 'renglones-tabla-titulo', tabindex: '0' },
      [
        crear(documento, 'table', { id: 'tabla-renglones', clase: 'tabla' }, [
          crear(documento, 'caption', {
            id: 'renglones-tabla-titulo',
            clase: 'tabla__titulo visualmente-oculto',
            texto: 'Renglones cargados'
          }),
          crear(documento, 'thead', {}, [
            crear(documento, 'tr', {}, [
              crear(documento, 'th', { scope: 'col', texto: 'Libro' }),
              crear(documento, 'th', { scope: 'col', clase: 'tabla__numero', texto: 'Cantidad' }),
              crear(documento, 'th', {
                scope: 'col',
                clase: 'tabla__numero',
                texto: 'Precio unitario'
              }),
              crear(documento, 'th', { scope: 'col', clase: 'tabla__numero', texto: 'Subtotal' }),
              crear(documento, 'th', { scope: 'col', texto: 'Acciones' })
            ])
          ]),
          crear(documento, 'tbody', {})
        ])
      ]
    ),
    crear(documento, 'p', {
      id: 'venta-vacio',
      clase: 'mensaje mensaje--vacio',
      role: 'status',
      texto: 'Todavía no se agregaron renglones a la venta.',
      hidden: true
    })
  ]);
}

function resumenVenta(documento) {
  return crear(
    documento,
    'aside',
    { clase: 'resumen', 'aria-labelledby': 'resumen-titulo' },
    [
      crear(documento, 'h3', {
        id: 'resumen-titulo',
        clase: 'resumen__titulo',
        texto: 'Resumen de la venta'
      }),
      crear(documento, 'dl', { clase: 'resumen__lista' }, [
        crear(documento, 'div', { clase: 'resumen__fila' }, [
          crear(documento, 'dt', { texto: 'Artículos' }),
          crear(documento, 'dd', { id: 'venta-articulos', texto: '0' })
        ]),
        crear(documento, 'div', { clase: 'resumen__fila resumen__fila--total' }, [
          crear(documento, 'dt', { texto: 'Total estimado' }),
          crear(documento, 'dd', { id: 'venta-total', 'aria-live': 'polite', texto: '$ 0,00' })
        ])
      ]),
      crear(documento, 'button', {
        id: 'venta-confirmar',
        clase: 'boton boton--primario boton--bloque',
        type: 'button',
        texto: 'Confirmar venta'
      }),
      crear(documento, 'p', {
        id: 'venta-confirmada',
        clase: 'mensaje mensaje--exito',
        role: 'status',
        hidden: true
      })
    ]
  );
}

function vistaVentas(documento) {
  return crear(
    documento,
    'section',
    { id: 'ventas', clase: 'vista', 'aria-labelledby': 'ventas-titulo' },
    [
      crear(documento, 'div', { clase: 'vista__encabezado' }, [
        crear(documento, 'p', { clase: 'vista__sobretitulo', texto: 'Operaciones' }),
        crear(documento, 'h2', { id: 'ventas-titulo', texto: 'Ventas' })
      ]),
      crear(documento, 'div', { clase: 'disposicion-venta' }, [
        formularioVenta(documento),
        resumenVenta(documento)
      ])
    ]
  );
}

function vistaHistorial(documento) {
  return crear(
    documento,
    'section',
    { id: 'historial', clase: 'vista', 'aria-labelledby': 'historial-titulo' },
    [
      crear(documento, 'div', { clase: 'vista__encabezado' }, [
        crear(documento, 'p', { clase: 'vista__sobretitulo', texto: 'Consultas' }),
        crear(documento, 'h2', { id: 'historial-titulo', texto: 'Historial' })
      ]),
      crear(
        documento,
        'section',
        { clase: 'tabla-contenedor', 'aria-labelledby': 'historial-tabla-titulo', tabindex: '0' },
        [
          crear(documento, 'table', { id: 'tabla-historial', clase: 'tabla' }, [
            crear(documento, 'caption', {
              id: 'historial-tabla-titulo',
              clase: 'tabla__titulo visualmente-oculto',
              texto: 'Ventas registradas'
            }),
            crear(documento, 'thead', {}, [
              crear(documento, 'tr', {}, [
                crear(documento, 'th', { scope: 'col', texto: 'ID' }),
                crear(documento, 'th', { scope: 'col', texto: 'Fecha' }),
                crear(documento, 'th', { scope: 'col', texto: 'Cliente' }),
                crear(documento, 'th', { scope: 'col', clase: 'tabla__numero', texto: 'Total' }),
                crear(documento, 'th', { scope: 'col', texto: 'Detalle' })
              ])
            ]),
            crear(documento, 'tbody', {})
          ])
        ]
      ),
      crear(documento, 'p', {
        id: 'historial-vacio',
        clase: 'mensaje mensaje--vacio',
        role: 'status',
        texto: 'No hay ventas registradas.',
        hidden: true
      }),
      crear(
        documento,
        'section',
        { id: 'detalle-venta', clase: 'detalle', 'aria-labelledby': 'detalle-titulo', hidden: true },
        [
          crear(documento, 'div', { clase: 'detalle__encabezado' }, [
            crear(documento, 'p', { clase: 'vista__sobretitulo', texto: 'Detalle' }),
            crear(documento, 'h3', { id: 'detalle-titulo', tabindex: '-1', texto: 'Venta' }),
            crear(documento, 'p', { id: 'detalle-meta', clase: 'detalle__meta' })
          ]),
          crear(
            documento,
            'section',
            { clase: 'tabla-contenedor', 'aria-labelledby': 'detalle-tabla-titulo', tabindex: '0' },
            [
              crear(documento, 'table', { id: 'detalle-renglones', clase: 'tabla' }, [
                crear(documento, 'caption', {
                  id: 'detalle-tabla-titulo',
                  clase: 'tabla__titulo visualmente-oculto',
                  texto: 'Renglones de la venta'
                }),
                crear(documento, 'thead', {}, [
                  crear(documento, 'tr', {}, [
                    crear(documento, 'th', { scope: 'col', texto: 'Libro' }),
                    crear(documento, 'th', {
                      scope: 'col',
                      clase: 'tabla__numero',
                      texto: 'Cantidad'
                    }),
                    crear(documento, 'th', {
                      scope: 'col',
                      clase: 'tabla__numero',
                      texto: 'Precio unitario'
                    }),
                    crear(documento, 'th', {
                      scope: 'col',
                      clase: 'tabla__numero',
                      texto: 'Subtotal'
                    })
                  ])
                ]),
                crear(documento, 'tbody', {})
              ])
            ]
          ),
          crear(documento, 'p', { clase: 'detalle__total' }, [
            crear(documento, 'span', { id: 'detalle-total', texto: '$ 0,00' })
          ])
        ]
      )
    ]
  );
}

export function crearPagina(opciones) {
  const configuracion = opciones || {};
  const omitidos = configuracion.omitir || [];
  const documento = new Documento();

  const cuerpo = documento.body;

  cuerpo.append(
    crear(documento, 'a', {
      clase: 'salto-contenido',
      href: '#contenido',
      texto: 'Saltar al contenido'
    }),
    crear(documento, 'header', { clase: 'cabecera' }, [menuPrincipal(documento)]),
    crear(documento, 'main', { id: 'contenido', clase: 'contenido', tabindex: '-1' }, [
      crear(documento, 'div', { clase: 'contenedor' }, [
        vistaCatalogo(documento),
        vistaLibros(documento),
        vistaClientes(documento),
        vistaVentas(documento),
        vistaHistorial(documento)
      ])
    ])
  );

  if (omitidos.length > 0) {
    documento.querySelectorAll('[id]').forEach(function (elemento) {
      if (omitidos.indexOf(elemento.id) !== -1) {
        elemento.removeAttribute('id');
      }
    });
  }

  return { documento, cuerpo };
}

export function idsDeLaPagina(pagina) {
  return pagina.documento.querySelectorAll('[id]').map(function (elemento) {
    return elemento.id;
  });
}

export function compararIds(idsEsperados, idsObtenidos) {
  const esperados = new Set(idsEsperados);
  const obtenidos = new Set(idsObtenidos);

  return {
    faltantes: Array.from(esperados).filter(function (id) {
      return !obtenidos.has(id);
    }),
    sobrantes: Array.from(obtenidos).filter(function (id) {
      return !esperados.has(id);
    })
  };
}
