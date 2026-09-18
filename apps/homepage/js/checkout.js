/**
 * Compra de un plan.
 *
 * El navegador solo manda que plan se quiere y los datos de la cuenta. El
 * precio lo decide el servidor, que crea la cuenta, deja la licencia pendiente
 * y devuelve la pagina de pago de Mercado Pago. Aqui se guarda la sesion antes
 * de salir hacia Mercado Pago: si el comprador cierra la pestana a medio pago,
 * al volver ya tiene cuenta y termina desde el portal.
 *
 * La tarjeta nunca pasa por esta pagina: se escribe en Mercado Pago.
 */
(function () {
  'use strict';

  var CLAVE_TOKEN = 'codenest.token';
  /** Efecty no admite pagos mayores a este valor en Mercado Pago Colombia. */
  var TOPE_EFECTY = 8000000;

  var form = document.getElementById('formCompra');
  var boton = document.getElementById('botonPagar');
  var alerta = document.getElementById('alerta');
  if (!form || !boton) return;

  var clave = new URLSearchParams(window.location.search).get('plan');
  var plan = null;

  function cop(monto) {
    return '$' + Number(monto).toLocaleString('es-CO');
  }

  function mostrarAlerta(texto, enlace) {
    alerta.textContent = texto + (enlace ? ' ' : '');
    if (enlace) {
      var a = document.createElement('a');
      a.href = enlace.href;
      a.textContent = enlace.texto;
      alerta.appendChild(a);
    }
    alerta.hidden = false;
    alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function pintarPedido(p) {
    document.getElementById('pedidoTitulo').textContent = 'Plan ' + p.nombre;
    document.getElementById('pedidoDescripcion').textContent = p.descripcion;
    document.getElementById('pedidoPrecio').textContent = cop(p.precioCop) + ' COP';
    document.getElementById('pedidoPeriodo').textContent =
      p.vigenciaDias === 365 ? 'por un año' : 'por ' + p.vigenciaDias + ' días';

    var lista = document.getElementById('pedidoBeneficios');
    lista.innerHTML = '';
    (p.beneficios || []).forEach(function (b) {
      var li = document.createElement('li');
      li.textContent = b;
      lista.appendChild(li);
    });

    // Decirlo antes evita que alguien elija Efecty en Mercado Pago y se tope
    // con un rechazo que no entiende.
    if (p.precioCop > TOPE_EFECTY) {
      document.getElementById('pedidoMedios').textContent =
        'Tarjeta de crédito o débito, o PSE desde tu banco. Efecty no admite pagos de este valor.';
    }

    var esEscuela = p.clave === 'escuela';
    document.getElementById('bloqueColegio').hidden = !esEscuela;
    document.getElementById('colegio').required = esEscuela;
    document.getElementById('numFacturacion').textContent = esEscuela ? '3' : '2';
    if (esEscuela) document.getElementById('tipoDocumento').value = 'NIT';
  }

  function sinPlan(texto) {
    document.getElementById('pedidoTitulo').textContent = 'Elige un plan';
    mostrarAlerta(texto, { href: '/planes.html', texto: 'Ver los planes' });
  }

  fetch('/api/pagos/config')
    .then(function (r) {
      if (!r.ok) throw new Error('config ' + r.status);
      return r.json();
    })
    .then(function (config) {
      plan = (config.planes || []).filter(function (p) {
        return p.clave === clave;
      })[0];
      if (!plan) {
        sinPlan('No encontramos ese plan.');
        return;
      }
      pintarPedido(plan);
      if (!config.configurado) {
        mostrarAlerta(
          'La compra en línea no está disponible en este momento. Escríbenos y te ayudamos a activar tu plan.',
        );
        return;
      }
      boton.disabled = false;
      boton.textContent = 'Continuar al pago · ' + cop(plan.precioCop);
    })
    .catch(function () {
      sinPlan('No pudimos cargar el plan. Recarga la página.');
    });

  // Ver u ocultar la contrasena: escribirla a ciegas en un telefono es donde se
  // equivoca la gente, y despues no puede entrar al portal.
  var verPassword = document.getElementById('verPassword');
  var password = document.getElementById('password');
  verPassword.addEventListener('click', function () {
    var ver = password.type === 'password';
    password.type = ver ? 'text' : 'password';
    verPassword.textContent = ver ? 'Ocultar' : 'Ver';
    verPassword.setAttribute('aria-pressed', String(ver));
  });

  function valor(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    alerta.hidden = true;
    if (!plan) return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var cuerpo = {
      plan: plan.clave,
      cuenta: {
        nombre: valor('nombre'),
        email: valor('email'),
        password: document.getElementById('password').value,
      },
      facturacion: {
        tipoDocumento: valor('tipoDocumento'),
        documento: valor('documento'),
        ciudad: valor('ciudad'),
      },
      aceptaTerminos: document.getElementById('terminos').checked,
    };
    // Los opcionales solo si se escribieron: vacio no es lo mismo que ausente.
    ['razonSocial', 'direccion', 'telefono'].forEach(function (campo) {
      if (valor(campo)) cuerpo.facturacion[campo] = valor(campo);
    });
    if (plan.clave === 'escuela') {
      cuerpo.institucion = { nombre: valor('colegio') };
      if (valor('colegioCiudad')) cuerpo.institucion.ciudad = valor('colegioCiudad');
    }

    boton.disabled = true;
    var textoBoton = boton.textContent;
    boton.textContent = 'Preparando tu pago…';

    fetch('/api/pagos/comprar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
      .then(function (r) {
        return r.json().then(function (datos) {
          return { estado: r.status, datos: datos };
        });
      })
      .then(function (res) {
        if (res.estado === 201 && res.datos.urlPago) {
          try {
            window.localStorage.setItem(CLAVE_TOKEN, res.datos.token);
          } catch (e) {
            // Sin almacenamiento: al volver tendra que entrar con su correo.
          }
          boton.textContent = 'Te llevamos a Mercado Pago…';
          window.location.href = res.datos.urlPago;
          return;
        }

        boton.disabled = false;
        boton.textContent = textoBoton;
        if (res.estado === 409) {
          mostrarAlerta(res.datos.error, { href: '/app/portal', texto: 'Entrar al portal' });
        } else if (res.estado === 429) {
          mostrarAlerta('Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.');
        } else {
          mostrarAlerta(res.datos.error || 'No pudimos continuar. Revisa los datos e inténtalo de nuevo.');
        }
      })
      .catch(function () {
        boton.disabled = false;
        boton.textContent = textoBoton;
        mostrarAlerta('Se perdió la conexión. Revisa tu internet e inténtalo de nuevo.');
      });
  });
})();
