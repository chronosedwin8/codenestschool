/**
 * Interacciones del sitio publico.
 *
 * Es JavaScript sin librerias a proposito: son cuatro comportamientos y no
 * justifican descargar un framework en la pagina que decide si alguien compra.
 */
(function () {
  'use strict';

  // ── Menu en pantallas pequenas ──
  var boton = document.getElementById('navAbrir');
  var nav = document.getElementById('nav');

  if (boton && nav) {
    boton.addEventListener('click', function () {
      var abierta = nav.classList.toggle('abierta');
      boton.setAttribute('aria-expanded', String(abierta));
      boton.setAttribute('aria-label', abierta ? 'Cerrar el menu' : 'Abrir el menu');
    });

    // Al tocar un enlace el menu se cierra: si no, tapa el destino.
    nav.addEventListener('click', function (evento) {
      if (evento.target.tagName === 'A') {
        nav.classList.remove('abierta');
        boton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /** Anima una cifra de cero a su valor final. */
  function contarSiHace(contenedor) {
    var objetivo = contenedor.querySelector('[data-contar]');
    if (!objetivo) return;

    var destino = parseInt(objetivo.getAttribute('data-contar'), 10);
    if (isNaN(destino)) return;

    // Con movimiento reducido se muestra el numero directamente.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      objetivo.textContent = String(destino);
      return;
    }

    var duracion = 900;
    var inicio = performance.now();

    function paso(ahora) {
      var avance = Math.min(1, (ahora - inicio) / duracion);
      // Desaceleracion cubica: llega suave al numero final.
      var suave = 1 - Math.pow(1 - avance, 3);
      objetivo.textContent = String(Math.round(destino * suave));
      if (avance < 1) requestAnimationFrame(paso);
    }

    requestAnimationFrame(paso);
  }

  // ── Aparicion al desplazar ──
  var revelables = document.querySelectorAll('.revelar');

  if ('IntersectionObserver' in window && revelables.length > 0) {
    var observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add('visible');
          contarSiHace(entrada.target);
          observador.unobserve(entrada.target);
        });
      },
      { threshold: 0.2 }
    );

    revelables.forEach(function (elemento) {
      observador.observe(elemento);
    });
  } else {
    // Sin soporte, todo visible: nunca contenido oculto por una API ausente.
    revelables.forEach(function (elemento) {
      elemento.classList.add('visible');
      contarSiHace(elemento);
    });
  }

  // ── Ano en el pie ──
  var anio = document.getElementById('anio');
  if (anio) anio.textContent = String(new Date().getFullYear());
})();
