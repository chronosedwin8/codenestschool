/**
 * Demostracion jugable de la portada.
 *
 * Reproduce la mecanica real del primer mundo: cada flecha hace rodar al Fuzz
 * hasta que se acaba el camino. Es la forma mas honesta de ensenar el producto,
 * mejor que un video: quien mira lo prueba y entiende en diez segundos por que un
 * nino de cuatro anos puede usarlo.
 *
 * No comparte codigo con el juego a proposito: la pagina publica no debe
 * descargar el motor entero para mostrar un tablero de cinco por cinco.
 */
(function () {
  'use strict';

  var tablero = document.getElementById('demoTablero');
  var panelPrograma = document.getElementById('demoPrograma');
  var mensaje = document.getElementById('demoMensaje');
  var botonJugar = document.getElementById('demoJugar');
  var botonBorrar = document.getElementById('demoBorrar');

  if (!tablero || !panelPrograma) return;

  // El mapa: '.' camino, '#' fuera del camino, 'M' meta, '*' estrella.
  var MAPA = [
    ['.', '.', '.', '#', '#'],
    ['#', '#', '.', '#', '#'],
    ['#', '#', '*', '.', '.'],
    ['#', '#', '#', '#', '.'],
    ['#', '#', '#', '#', 'M']
  ];

  var INICIO = { x: 0, y: 0 };
  var DELTA = {
    derecha: { dx: 1, dy: 0 },
    izquierda: { dx: -1, dy: 0 },
    arriba: { dx: 0, dy: -1 },
    abajo: { dx: 0, dy: 1 }
  };
  var FLECHA = { derecha: '→', izquierda: '←', arriba: '↑', abajo: '↓' };
  var MAXIMO_FICHAS = 6;

  var programa = [];
  var fuzz = { x: INICIO.x, y: INICIO.y };
  var estrellaRecogida = false;
  var jugando = false;

  function transitable(x, y) {
    if (y < 0 || y >= MAPA.length) return false;
    if (x < 0 || x >= MAPA[y].length) return false;
    return MAPA[y][x] !== '#';
  }

  function pintar() {
    tablero.innerHTML = '';

    for (var y = 0; y < MAPA.length; y++) {
      for (var x = 0; x < MAPA[y].length; x++) {
        var casilla = document.createElement('div');
        casilla.className = 'demo__casilla';

        if (!transitable(x, y)) {
          casilla.className += ' demo__casilla--muro';
        }

        if (fuzz.x === x && fuzz.y === y) {
          casilla.textContent = '🔵';
        } else if (MAPA[y][x] === 'M') {
          casilla.textContent = '🚩';
        } else if (MAPA[y][x] === '*' && !estrellaRecogida) {
          casilla.textContent = '⭐';
        }

        tablero.appendChild(casilla);
      }
    }

    panelPrograma.innerHTML = '';
    programa.forEach(function (dir) {
      var paso = document.createElement('span');
      paso.className = 'demo__paso';
      paso.textContent = FLECHA[dir];
      panelPrograma.appendChild(paso);
    });
  }

  function esperar(ms) {
    return new Promise(function (resolver) {
      setTimeout(resolver, ms);
    });
  }

  /** Rueda en una direccion hasta que se acaba el camino. */
  function rodar(dir) {
    var d = DELTA[dir];
    var movio = false;

    function siguientePaso() {
      if (!transitable(fuzz.x + d.dx, fuzz.y + d.dy)) {
        return Promise.resolve(movio);
      }

      fuzz.x += d.dx;
      fuzz.y += d.dy;
      movio = true;

      if (MAPA[fuzz.y][fuzz.x] === '*') estrellaRecogida = true;

      pintar();
      return esperar(190).then(siguientePaso);
    }

    return siguientePaso();
  }

  function jugar() {
    if (jugando) return;

    if (programa.length === 0) {
      mensaje.textContent = 'Pon algunas flechas primero.';
      return;
    }

    jugando = true;
    mensaje.textContent = '';
    fuzz = { x: INICIO.x, y: INICIO.y };
    estrellaRecogida = false;
    pintar();

    var indice = 0;

    function siguienteFicha() {
      if (indice >= programa.length) {
        if (MAPA[fuzz.y][fuzz.x] === 'M') {
          mensaje.textContent = estrellaRecogida
            ? 'Perfecto. Llegaste y recogiste la estrella.'
            : 'Llegaste. Puedes recoger tambien la estrella.';
        } else {
          mensaje.textContent = 'Casi. Todavia no llegaste a la bandera.';
        }
        jugando = false;
        return;
      }

      var dir = programa[indice];
      indice += 1;

      rodar(dir).then(function (movio) {
        if (!movio) {
          mensaje.textContent = 'Por ahi no hay camino. Prueba con otra flecha.';
          jugando = false;
          return;
        }
        siguienteFicha();
      });
    }

    esperar(260).then(siguienteFicha);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.demo__ficha'), function (boton) {
    boton.addEventListener('click', function () {
      if (jugando || programa.length >= MAXIMO_FICHAS) return;
      programa.push(boton.getAttribute('data-dir'));
      mensaje.textContent = '';
      pintar();
    });
  });

  if (botonJugar) botonJugar.addEventListener('click', jugar);

  if (botonBorrar) {
    botonBorrar.addEventListener('click', function () {
      if (jugando) return;
      programa = [];
      fuzz = { x: INICIO.x, y: INICIO.y };
      estrellaRecogida = false;
      mensaje.textContent = '';
      pintar();
    });
  }

  pintar();
})();
