(function () {
  'use strict';

  const Libreria = (window.Libreria = window.Libreria || {});
  const VISTAS = ['catalogo', 'libros', 'clientes', 'ventas', 'historial'];

  function iniciarRouter() {
    const enlaces = Array.prototype.slice.call(
      document.querySelectorAll('.nav-principal__enlace')
    );

    function actualizar(moverFoco) {
      const hash = window.location.hash || '#catalogo';

      enlaces.forEach(function (enlace) {
        if (enlace.getAttribute('href') === hash) {
          enlace.setAttribute('aria-current', 'location');
        } else {
          enlace.removeAttribute('aria-current');
        }
      });

      if (!moverFoco) {
        return;
      }

      const esVista = enlaces.some(function (enlace) {
        return enlace.getAttribute('href') === hash;
      });

      if (!esVista) {
        return;
      }

      const seccion = document.querySelector(hash);

      if (!seccion) {
        return;
      }

      const titulo = seccion.querySelector('h2');

      if (titulo) {
        titulo.setAttribute('tabindex', '-1');
        titulo.focus({ preventScroll: true });
      }
    }

    window.addEventListener('hashchange', function () {
      actualizar(true);
    });

    actualizar(false);
  }

  // Cada vista arranca por su cuenta: si una consulta falla, su módulo dibuja
  // el estado de error y las demás siguen funcionando.
  function iniciarVistas() {
    return Promise.all(
      VISTAS.map(function (nombre) {
        const modulo = Libreria[nombre];

        if (!modulo || typeof modulo.iniciar !== 'function') {
          return Promise.resolve();
        }

        return Promise.resolve()
          .then(function () {
            return modulo.iniciar();
          })
          .catch(function () {
            return undefined;
          });
      })
    );
  }

  document.addEventListener('DOMContentLoaded', function () {
    iniciarRouter();
    iniciarVistas();
  });
})();
