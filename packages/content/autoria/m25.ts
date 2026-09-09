/**
 * Mundo 25: El Reactor Nuclear. Responder en vez de decidir antes.
 *
 * El plan original ponía aquí async/await, y no se puede enseñar en este juego con
 * honestidad: la API del Fuzz es sincrona y no hay nada que esperar, así que un
 * `await` sería decorativo y el niño aprendería a escribir una palabra que no hace
 * nada. Eso es peor que no enseñarla.
 *
 * Lo que sí es la otra mitad de esa idea, y la mitad que de verdad se usa, es
 * dejar de decidir de antemano y responder a lo que llega. En vez de una cadena de
 * condiciones escrita por el programador, una tabla que asocia cada aviso con la
 * función que lo atiende:
 *
 *     const avisos = {
 *       fuga: cerrarValvula,
 *       calor: bajarBarras,
 *     };
 *     avisos[aviso]();
 *
 * Que una función se pueda guardar en una variable, meter en un objeto y pasar a
 * otra función es la idea más grande de este mundo, y probablemente de los Hackers.
 * Es lo que hace posible todo lo que un día se llamará un evento.
 *
 * Por eso este mundo es solo de JavaScript: en pylite una función no es un valor
 * que se pueda guardar, y el catálogo lo declara.
 *
 * Progresión:
 *   1-4    una función guardada en una variable, y llamada por ese nombre.
 *   5-9    la tabla de avisos. Un objeto de funciones y el despacho.
 *   10-13  funciones que reciben funciones.
 *   14-17  una tabla que crece sin tocar el programa que la usa.
 *   18-20  la alarma del reactor.
 */
import { actividadHacker, type ContextoHacker } from '../src/generadores-hackers.js';
import { andar, estrellaAqui, gira, type PasoCamino } from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const API = ['avanzar', 'girarDerecha', 'girarIzquierda', 'puedeAvanzar', 'hayObstaculo'];

function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

function escalera(largos: readonly number[]): PasoCamino[] {
  return largos.flatMap((largo) => escalon(largo));
}

/** Camino que gira a un lado o al otro segun la lista de avisos. */
function caminoDeAvisos(avisos: readonly ('derecha' | 'izquierda' | 'recto')[]): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  avisos.forEach((aviso, i) => {
    pasos.push(andar(2));
    if (aviso === 'derecha') pasos.push(gira('derecha'));
    if (aviso === 'izquierda') pasos.push(gira('izquierda'));
    if (i === avisos.length - 1) pasos.push(andar(2));
  });
  return pasos;
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly javascript: string;
  readonly arranqueJs?: string;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Una funcion con nombre propio',
    instruccion:
      'El Reactor Nuclear del Nido lleva funcionando desde antes de que nadie se acuerde, y tiene un panel lleno de avisos. Empieza por algo que ya sabes con una vuelta de tuerca: en JavaScript, una funcion se puede guardar en una variable y llamarse por el nombre de esa variable.',
    exito:
      'Una funcion guardada en una variable. Parece un detalle y es la puerta de todo lo que viene: si una funcion se puede guardar, se puede pasar, elegir y meter en una lista.',
    pistas: [
      'Se escribe const y el nombre, igual, y la funcion sin nombre propio.',
      'Y se llama poniendo el nombre de la variable con parentesis.',
    ],
    camino: escalera([3, 3, 3]),
    javascript: `const tramo = function () {
  for (let p = 0; p < 3; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
};

tramo();
tramo();
tramo();`,
    arranqueJs: `const tramo = function () {
  // escribe aqui el tramo
};

`,
  },
  {
    nombre: 'Dos funciones guardadas',
    instruccion: 'Dos funciones en dos variables: una gira a la derecha y otra a la izquierda al acabar.',
    exito: 'Dos funciones guardadas. Ahora hay dos nombres y el programa elige cual llamar.',
    pistas: ['Cada funcion en su variable.', 'Se llaman por su nombre, en el orden que pide el tablero.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(2),
      gira('derecha'),
      andar(2),
    ],
    javascript: `const aDerecha = function () {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
};

const aIzquierda = function () {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
};

aDerecha();
aIzquierda();
aDerecha();
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Elegir la funcion',
    instruccion:
      'Una variable puede guardar una funcion o la otra segun una condicion, y luego se llama sin saber cual quedo dentro.',
    exito:
      'La variable no sabe que funcion lleva y el programa la llama igual. Eso es lo raro y lo potente: la decision se tomo antes, en otro sitio.',
    pistas: ['Una variable que se asigna dentro de un if.', 'Y una sola llamada al final.'],
    camino: [andar(2), gira('derecha'), andar(3)],
    javascript: `const aDerecha = function () {
  fuzz.girarDerecha();
};

const aIzquierda = function () {
  fuzz.girarIzquierda();
};

const aviso = "fuga";
let atender = aIzquierda;
if (aviso === "fuga") {
  atender = aDerecha;
}

for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}
atender();
for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Sensores del reactor',
    instruccion: 'Hay sensores por los tramos. Pasa por encima de todos.',
    exito: 'Los sensores. El reactor tiene doscientos y dicen que ninguno se ha averiado nunca.',
    pistas: ['La funcion guardada en una variable.', 'Los sensores estan en el camino.'],
    camino: escalera([2, 3, 2]).flatMap((paso, i) => (i % 4 === 0 ? [paso, estrellaAqui()] : [paso])),
    javascript: `const tramo = function (largo) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
};

tramo(2);
tramo(3);
tramo(2);`,
  },
  {
    nombre: 'La tabla de avisos',
    instruccion:
      'Aqui esta la idea del mundo. Un objeto puede guardar funciones igual que guarda numeros: la clave es el aviso y el valor es la funcion que lo atiende. Y para atender un aviso se saca su funcion de la tabla y se llama.',
    exito:
      'Una tabla de avisos. Fijate en lo que NO hay: ninguna cadena de condiciones. El programa no pregunta que aviso es, lo busca.',
    pistas: [
      'El objeto lleva claves con nombres de aviso y funciones como valor.',
      'Para llamarla se saca de la tabla con corchetes y se le ponen los parentesis.',
    ],
    camino: caminoDeAvisos(['derecha', 'izquierda', 'derecha']),
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarIzquierda();
  },
};

const panel = ["fuga", "calor", "fuga"];
for (const aviso of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  avisos[aviso]();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
    arranqueJs: `const avisos = {
  fuga: function () {
    // que se hace cuando hay una fuga
  },
};

const panel = ["fuga", "calor", "fuga"];
`,
  },
  {
    nombre: 'Un aviso mas',
    instruccion:
      'Ahora hay tres clases de aviso, y uno de ellos significa seguir recto. Anade su funcion a la tabla y no toques el bucle.',
    exito:
      'Un aviso mas y el bucle intacto. Eso es lo que se gana con una tabla: crecer por un lado sin tocar el otro.',
    pistas: ['La tabla tiene tres claves.', 'La del aviso que no gira no hace nada.'],
    camino: caminoDeAvisos(['derecha', 'recto', 'izquierda', 'derecha']),
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarIzquierda();
  },
  estable: function () {
    return;
  },
};

const panel = ["fuga", "estable", "calor", "fuga"];
for (const aviso of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  avisos[aviso]();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Ocho avisos',
    instruccion: 'El panel entero: ocho avisos mezclados. La tabla no crece y el bucle tampoco.',
    exito: 'Ocho avisos atendidos y el programa igual de largo que con tres. Eso no lo consigue una cadena de condiciones.',
    pistas: ['La tabla es la misma.', 'Solo crece la lista de avisos del panel.'],
    camino: caminoDeAvisos([
      'derecha',
      'recto',
      'derecha',
      'izquierda',
      'recto',
      'izquierda',
      'derecha',
      'recto',
    ]),
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarIzquierda();
  },
  estable: function () {
    return;
  },
};

const panel = [
  "fuga",
  "estable",
  "fuga",
  "calor",
  "estable",
  "calor",
  "fuga",
  "estable",
];
for (const aviso of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  avisos[aviso]();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'La tabla con datos y funciones',
    instruccion:
      'Cada aviso puede llevar su funcion y ademas cuantos pasos hay que dar antes de atenderlo. Un objeto con una clave que es un numero y otra que es una funcion.',
    exito:
      'Datos y comportamiento en el mismo objeto. Es la primera vez que ves algo asi, y es como se construye casi todo el software que usas.',
    pistas: ['Cada aviso es un objeto con las claves pasos y atender.', 'Se leen las dos: una con un bucle y la otra con parentesis.'],
    camino: [
      andar(3),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(4),
      gira('derecha'),
      andar(2),
    ],
    javascript: `const avisos = {
  fuga: {
    pasos: 3,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
  calor: {
    pasos: 2,
    atender: function () {
      fuzz.girarIzquierda();
    },
  },
  purga: {
    pasos: 4,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
};

const panel = ["fuga", "calor", "purga"];
for (const aviso of panel) {
  const orden = avisos[aviso];
  for (let p = 0; p < orden.pasos; p++) {
    fuzz.avanzar();
  }
  orden.atender();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Cinco clases de aviso',
    instruccion: 'Cinco avisos distintos, cada uno con sus pasos y su funcion. Leelos del tablero.',
    exito: 'Cinco clases de aviso y una sola linea que las atiende todas.',
    pistas: ['Cada aviso es un objeto con pasos y atender.', 'El bucle no cambia.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(3),
      gira('derecha'),
      andar(1),
      gira('izquierda'),
      andar(2),
      gira('izquierda'),
      andar(3),
    ],
    javascript: `const avisos = {
  fuga: {
    pasos: 2,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
  calor: {
    pasos: 3,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
  purga: {
    pasos: 1,
    atender: function () {
      fuzz.girarIzquierda();
    },
  },
  frio: {
    pasos: 2,
    atender: function () {
      fuzz.girarIzquierda();
    },
  },
};

const panel = ["fuga", "calor", "purga", "frio"];
for (const aviso of panel) {
  const orden = avisos[aviso];
  for (let p = 0; p < orden.pasos; p++) {
    fuzz.avanzar();
  }
  orden.atender();
}
for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Pasar una funcion a otra funcion',
    instruccion:
      'Si una funcion es un valor, se le puede pasar a otra funcion como parametro. Escribe una que reciba cuantos pasos dar y que hacer al final.',
    exito:
      'Una funcion que recibe otra funcion. Se llama asi, sin mas: el parametro se usa con parentesis igual que cualquier funcion.',
    pistas: ['El segundo parametro es una funcion.', 'Dentro se llama poniendole los parentesis.'],
    camino: [
      andar(3),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(3),
      gira('derecha'),
      andar(2),
    ],
    javascript: `const tramo = function (pasos, alFinal) {
  for (let p = 0; p < pasos; p++) {
    fuzz.avanzar();
  }
  alFinal();
};

const aDerecha = function () {
  fuzz.girarDerecha();
};

const aIzquierda = function () {
  fuzz.girarIzquierda();
};

tramo(3, aDerecha);
tramo(2, aIzquierda);
tramo(3, aDerecha);
tramo(2, function () {
  return;
});`,
  },
  {
    nombre: 'La funcion sin nombre',
    instruccion:
      'Una funcion que solo se usa una vez no necesita nombre: se escribe donde hace falta. Aqui el que hacer al final va escrito en la propia llamada.',
    exito:
      'Una funcion escrita en el sitio donde se usa. Ahorra un nombre, y un nombre que no hace falta es un nombre que hay que leer.',
    pistas: ['La funcion va dentro de los parentesis de la llamada.', 'No lleva nombre, solo la palabra function.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(3),
      gira('izquierda'),
      andar(2),
      gira('derecha'),
      andar(3),
    ],
    javascript: `const tramo = function (pasos, alFinal) {
  for (let p = 0; p < pasos; p++) {
    fuzz.avanzar();
  }
  alFinal();
};

tramo(2, function () {
  fuzz.girarDerecha();
});
tramo(3, function () {
  fuzz.girarIzquierda();
});
tramo(2, function () {
  fuzz.girarDerecha();
});
tramo(3, function () {
  return;
});`,
  },
  {
    nombre: 'Una lista de funciones',
    instruccion:
      'Si una funcion es un valor, cabe en una lista. Guarda en una lista lo que hay que hacer en cada esquina, en orden, y recorrela.',
    exito:
      'Una lista de funciones recorrida con un bucle. El programa no sabe que hace cada una: las llama en orden.',
    pistas: ['La lista lleva funciones separadas por comas.', 'Y el bucle sin indice las llama una a una.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(2),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(2),
    ],
    javascript: `const plan = [
  function () {
    fuzz.girarDerecha();
  },
  function () {
    fuzz.girarDerecha();
  },
  function () {
    fuzz.girarIzquierda();
  },
];

for (const paso of plan) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  paso();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'La funcion que devuelve una funcion',
    instruccion:
      'Y lo mas raro del mundo, que ademas es util: una funcion puede devolver otra funcion. Escribe una que reciba un lado y devuelva la funcion que gira hacia ese lado.',
    exito:
      'Una funcion que fabrica funciones. Suena a truco y es lo que hay detras de la mitad de las librerias que vas a usar en tu vida.',
    pistas: ['La funcion de fuera recibe el lado y devuelve una funcion.', 'La de dentro es la que gira, y se llama despues.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(2),
      gira('derecha'),
      andar(2),
    ],
    javascript: `const giroHacia = function (lado) {
  if (lado === "derecha") {
    return function () {
      fuzz.girarDerecha();
    };
  }
  return function () {
    fuzz.girarIzquierda();
  };
};

const plan = ["derecha", "izquierda", "derecha"];
for (const lado of plan) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  const girar = giroHacia(lado);
  girar();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'La tabla que crece',
    instruccion:
      'Un aviso nuevo no obliga a tocar el bucle: se anade a la tabla y ya esta. Aqui hay seis clases y el bucle es el mismo de la actividad cinco.',
    exito:
      'Seis clases de aviso, y el bucle no ha cambiado desde la actividad cinco. Eso es lo que se busca al separar la tabla del bucle.',
    pistas: ['La tabla tiene seis claves.', 'El bucle no cambia ni una letra.'],
    camino: caminoDeAvisos(['derecha', 'izquierda', 'recto', 'derecha', 'izquierda', 'recto']),
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarIzquierda();
  },
  estable: function () {
    return;
  },
  purga: function () {
    fuzz.girarDerecha();
  },
  frio: function () {
    fuzz.girarIzquierda();
  },
  revision: function () {
    return;
  },
};

const panel = ["fuga", "calor", "estable", "purga", "frio", "revision"];
for (const aviso of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  avisos[aviso]();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'El aviso desconocido',
    instruccion:
      'El panel trae un aviso que no esta en la tabla. Si se llama sin comprobar, el programa se rompe. Comprueba antes si la tabla lo conoce.',
    exito:
      'Comprobar antes de llamar. Una tabla de funciones es potente y tiene ese precio: hay que preguntar si la clave existe.',
    pistas: ['Se saca la funcion a una variable y se comprueba que existe.', 'Si no existe, se sigue sin hacer nada.'],
    camino: caminoDeAvisos(['derecha', 'recto', 'izquierda', 'recto']),
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarIzquierda();
  },
};

const panel = ["fuga", "raro", "calor", "otro"];
for (const aviso of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  const atender = avisos[aviso];
  if (atender) {
    atender();
  }
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Diez avisos',
    instruccion: 'El panel completo del reactor: diez avisos y dos de ellos desconocidos.',
    exito: 'Diez avisos, dos desconocidos, y el programa no se ha roto. El reactor sigue en marcha.',
    pistas: ['La tabla, la comprobacion y el bucle.', 'Lee el panel del tablero en orden.'],
    camino: caminoDeAvisos([
      'derecha',
      'recto',
      'izquierda',
      'derecha',
      'recto',
      'izquierda',
      'derecha',
      'recto',
    ]),
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarIzquierda();
  },
};

const panel = [
  "fuga",
  "raro",
  "calor",
  "fuga",
  "otro",
  "calor",
  "fuga",
  "raro",
];
for (const aviso of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  const atender = avisos[aviso];
  if (atender) {
    atender();
  }
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Un aviso que atiende dos cosas',
    instruccion:
      'Una funcion de la tabla puede hacer mas de una cosa, y puede llamar a otras funciones de la misma tabla. Aqui el aviso de emergencia hace lo de la fuga y lo del calor.',
    exito:
      'Una funcion de la tabla llamando a otra de la tabla. Se compone como se componen los bloques propios, y por las mismas razones.',
    pistas: ['La funcion de emergencia llama a las otras dos por la tabla.', 'Ojo al orden en que las llama.'],
    camino: [
      andar(2),
      gira('derecha'),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(2),
    ],
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarDerecha();
  },
  emergencia: function () {
    avisos.fuga();
    avisos.calor();
  },
};

const panel = ["emergencia", "izquierda"];
avisos.emergencia === undefined;
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}
avisos.emergencia();
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}
fuzz.girarIzquierda();
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'La cuenta atras',
    instruccion:
      'Chispa oyo una cuenta atras la noche de la tormenta: cinco, cuatro, tres. El panel del reactor guarda las cuentas atras de esa noche, y hay una que no acabo en cero. Ve a verla.',
    exito:
      'La cuenta atras del panel llega hasta uno y se corta. No hay cero. Y en el sitio del cero hay una palabra: lanzado. El reactor no lanza nada. El reactor solo calienta.',
    pistas: ['La tabla de avisos con la comprobacion.', 'Seis avisos en el panel.'],
    camino: caminoDeAvisos(['derecha', 'recto', 'izquierda', 'derecha', 'recto', 'izquierda']),
    javascript: `const avisos = {
  fuga: function () {
    fuzz.girarDerecha();
  },
  calor: function () {
    fuzz.girarIzquierda();
  },
  estable: function () {
    return;
  },
};

const panel = ["fuga", "estable", "calor", "fuga", "estable", "calor"];
for (const aviso of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  const atender = avisos[aviso];
  if (atender) {
    atender();
  }
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'El panel de esa noche',
    instruccion:
      'Este es el panel entero de la noche de la tormenta, con todos sus avisos en orden. Recorrelo. Al final esta Reactor esperando.',
    exito:
      'El panel de esa noche tiene veintidos avisos y el ultimo no es un aviso: es una hora. Las tres y catorce. Otra vez.',
    pistas: ['La tabla con datos y funciones: pasos y atender.', 'Cinco avisos con pasos distintos.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(3),
      gira('izquierda'),
      andar(1),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(3),
    ],
    javascript: `const avisos = {
  fuga: {
    pasos: 2,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
  calor: {
    pasos: 3,
    atender: function () {
      fuzz.girarIzquierda();
    },
  },
  purga: {
    pasos: 1,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
  frio: {
    pasos: 2,
    atender: function () {
      fuzz.girarIzquierda();
    },
  },
};

const panel = ["fuga", "calor", "purga", "frio"];
for (const aviso of panel) {
  const orden = avisos[aviso];
  for (let p = 0; p < orden.pasos; p++) {
    fuzz.avanzar();
  }
  orden.atender();
}
for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Donde esta Reactor',
    instruccion:
      'Ultimo del reactor. Reactor, el Fuzz, esta en la sala de control con el panel de esa noche congelado en la pantalla. Ve a por el. Tabla, lista de funciones y comprobacion: todo lo del mundo junto.',
    exito:
      'Reactor esta en casa, y ha traido la pantalla con el panel congelado. Dice que el reactor no lanzo nada esa noche, porque el reactor no puede lanzar nada. Que solo hay un sitio en el Nido capaz de lanzar algo, y es el Nucleo.',
    pistas: [
      'La tabla de avisos con pasos y funcion, y la comprobacion de que el aviso existe.',
      'Cinco avisos y uno desconocido.',
    ],
    camino: [
      andar(2),
      gira('derecha'),
      andar(3),
      gira('izquierda'),
      andar(2),
      gira('derecha'),
      andar(1),
      gira('izquierda'),
      andar(2),
    ],
    javascript: `const avisos = {
  fuga: {
    pasos: 2,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
  calor: {
    pasos: 3,
    atender: function () {
      fuzz.girarIzquierda();
    },
  },
  purga: {
    pasos: 2,
    atender: function () {
      fuzz.girarDerecha();
    },
  },
  frio: {
    pasos: 1,
    atender: function () {
      fuzz.girarIzquierda();
    },
  },
};

const panel = ["fuga", "calor", "purga", "frio"];
for (const aviso of panel) {
  const orden = avisos[aviso];
  if (orden) {
    for (let p = 0; p < orden.pasos; p++) {
      fuzz.avanzar();
    }
    orden.atender();
  }
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 25,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  return actividadHacker(contexto, {
    camino: receta.camino,
    api: API,
    javascript: receta.javascript,
    ...(receta.arranqueJs ? { arranque: { javascript: receta.arranqueJs } } : {}),
    exigeEstructuras: ['funcion'],
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 145 : undefined,
  });
});

export const mundo25: WorldContentFile = {
  mundo: 25,
  slug: 'reactor-nuclear',
  nombre: 'El Reactor Nuclear',
  introTexto:
    'El Reactor Nuclear tiene un panel lleno de avisos y aqui vas a aprender a atenderlos sin decidir de antemano cual va a llegar. La idea es esta: en JavaScript una funcion es un valor, asi que se puede guardar en una variable, meter en una lista, poner dentro de un objeto y pasar a otra funcion. Con eso se hace una tabla que asocia cada aviso con la funcion que lo atiende, y el programa deja de preguntar que ha pasado: lo busca.',
  actividades,
};
