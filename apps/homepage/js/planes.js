/**
 * Pinta los planes con los precios que devuelve el servidor.
 *
 * Los precios no estan escritos en el HTML a proposito: el servidor es la unica
 * autoridad sobre cuanto cuesta cada plan, y si estuvieran duplicados en la
 * pagina acabarian desincronizados el dia que cambien.
 */
(function () {
  'use strict';

  var contenedor = document.getElementById('planes');
  var aviso = document.getElementById('cargandoPlanes');

  if (!contenedor) return;

  function formatearCop(monto) {
    return '$' + Number(monto).toLocaleString('es-CO') + ' COP';
  }

  function crearTarjeta(plan) {
    var tarjeta = document.createElement('article');
    tarjeta.className = 'plan' + (plan.destacado ? ' plan--destacado' : '');

    if (plan.destacado) {
      var etiqueta = document.createElement('span');
      etiqueta.className = 'plan__etiqueta';
      etiqueta.textContent = 'El mas elegido';
      tarjeta.appendChild(etiqueta);
    }

    var nombre = document.createElement('h2');
    nombre.className = 'plan__nombre';
    nombre.textContent = plan.nombre;
    tarjeta.appendChild(nombre);

    var descripcion = document.createElement('p');
    descripcion.className = 'plan__descripcion';
    descripcion.textContent = plan.descripcion;
    tarjeta.appendChild(descripcion);

    var precio = document.createElement('div');
    precio.className = 'plan__precio';
    precio.textContent = formatearCop(plan.precioCop);

    var periodo = document.createElement('small');
    periodo.textContent =
      'al ano' +
      (plan.maxNinos === null
        ? ' · estudiantes ilimitados'
        : ' · ' + plan.maxNinos + (plan.maxNinos === 1 ? ' nino' : ' ninos'));
    precio.appendChild(periodo);
    tarjeta.appendChild(precio);

    var lista = document.createElement('ul');
    lista.className = 'plan__beneficios';
    plan.beneficios.forEach(function (beneficio) {
      var elemento = document.createElement('li');
      elemento.textContent = beneficio;
      lista.appendChild(elemento);
    });
    tarjeta.appendChild(lista);

    var enlace = document.createElement('a');
    enlace.className = 'boton ' + (plan.destacado ? 'boton--verde' : 'boton--fantasma');
    enlace.style.width = '100%';
    enlace.href = '/checkout.html?plan=' + encodeURIComponent(plan.clave);
    enlace.textContent = 'Elegir ' + plan.nombre;
    tarjeta.appendChild(enlace);

    return tarjeta;
  }

  fetch('/api/pagos/config')
    .then(function (respuesta) {
      if (!respuesta.ok) throw new Error('respuesta ' + respuesta.status);
      return respuesta.json();
    })
    .then(function (config) {
      contenedor.innerHTML = '';

      config.planes
        .slice()
        .sort(function (a, b) {
          return a.orden - b.orden;
        })
        .forEach(function (plan) {
          contenedor.appendChild(crearTarjeta(plan));
        });

      // Si la pasarela no esta configurada conviene decirlo, en lugar de dejar
      // que el comprador llegue al formulario y falle alli.
      if (!config.configurado) {
        var nota = document.createElement('p');
        nota.style.gridColumn = '1 / -1';
        nota.style.textAlign = 'center';
        nota.style.color = 'var(--tinta-suave)';
        nota.textContent =
          'La compra en linea estara disponible en breve. Escribenos y te ayudamos a activar tu plan.';
        contenedor.appendChild(nota);
      }
    })
    .catch(function () {
      if (aviso) {
        aviso.textContent =
          'No pudimos cargar los precios ahora mismo. Recarga la pagina o escribenos.';
      }
    });
})();
