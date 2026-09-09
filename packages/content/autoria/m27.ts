/**
 * Mundo 27: El Satélite Hackeado. Intentarlo y recuperarse.
 *
 * Hasta aquí, el Fuzz pregunta antes de moverse: `puedeAvanzar()` y luego avanza.
 * Este mundo enseña la otra forma de tratar con lo que puede salir mal, que es
 * intentarlo y tener preparado qué hacer si falla. Y enseña además la parte que
 * casi nunca se cuenta: cuándo conviene cada una.
 *
 *   Preguntar antes es mejor cuando la pregunta es fiable y barata. En el juego
 *   `puedeAvanzar()` lo es, así que en el mundo 14 era la respuesta correcta.
 *
 *   Intentarlo y recuperarse es mejor cuando no hay pregunta posible, cuando la
 *   respuesta puede cambiar entre preguntar y actuar, o cuando lo que falla está
 *   varios niveles más abajo y aquí arriba no se sabe qué preguntar.
 *
 * El satélite da el pretexto: está averiado y sus sensores mienten. Si la pregunta
 * no es fiable, preguntar no sirve, y solo queda intentarlo. Ese es el argumento
 * del mundo entero y también la razón técnica por la que `try` existe.
 *
 * Solo JavaScript: en pylite no hay try/except, y el catálogo lo declara.
 *
 * Progresión:
 *   1-4    try y catch. Intentar avanzar y girar si no se puede.
 *   5-9    el mismo recorrido sin preguntar nunca, y por qué aquí es mejor.
 *   10-13  el error trae información: leer su mensaje y decidir con él.
 *   14-17  lanzar un error propio, y finally.
 *   18-20  el satélite.
 */
import { actividadHacker, type ContextoHacker } from '../src/generadores-hackers.js';
import { andar, estrellaAqui, gira, type PasoCamino } from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const API = ['avanzar', 'girarDerecha', 'girarIzquierda', 'puedeAvanzar', 'hayObstaculo'];

/** Espiral que se abre: los brazos crecen para que nunca queden dos pegados. */
function espiral(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

/** Casillas de una espiral. */
function casillas(brazos: number, primero = 3): number {
  let total = 0;
  for (let i = 0; i < brazos; i++) total += primero + i;
  return total;
}

/**
 * Intentos que cuesta recorrer una espiral probando y recuperandose.
 *
 * Cada casilla es un intento que sale bien, y cada esquina es un intento que
 * falla mas el giro. Se calcula porque escribirlo a mano falla.
 */
function intentos(brazos: number, primero = 3): number {
  return casillas(brazos, primero) + (brazos - 1);
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
    nombre: 'Intentarlo y ver',
    instruccion:
      'El Satelite Hackeado esta averiado y sus sensores mienten: si le preguntas si puedes avanzar, a veces te dice que si cuando no. Asi que aqui no se pregunta. Se intenta, y se tiene preparado que hacer si sale mal. Eso se escribe con try y catch.',
    exito:
      'Has intentado avanzar sin preguntar, y cuando ha fallado has girado. El programa no sabe donde estan las paredes y las encuentra chocando con ellas, que es como se hace cuando no hay a quien preguntar.',
    pistas: [
      'Lo que puede fallar va dentro de try, entre llaves.',
      'Y lo que se hace si falla va dentro de catch, tambien entre llaves.',
    ],
    camino: espiral(2, 4),
    javascript: `for (let i = 0; i < ${intentos(2, 4)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
    arranqueJs: `for (let i = 0; i < ${intentos(2, 4)}; i++) {
  try {
    // intenta avanzar
  } catch (error) {
    // y si no puedes, gira
  }
}
`,
  },
  {
    nombre: 'Cuatro esquinas a ciegas',
    instruccion: 'Cuatro esquinas y el mismo programa. Sin una sola pregunta.',
    exito:
      'Cuatro esquinas encontradas a base de chocar. El numero de vueltas cuenta intentos: los que salen bien y los que no.',
    pistas: ['El programa no cambia.', 'Suma las casillas y las esquinas.'],
    camino: espiral(4),
    javascript: `for (let i = 0; i < ${intentos(4)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Seis esquinas',
    instruccion: 'Seis esquinas. Y fijate en que este programa es mas corto que el del mundo 14.',
    exito:
      'Mas corto que preguntando, porque no hay condicion: el fallo hace de condicion. No siempre es mejor, pero aqui lo es.',
    pistas: ['Cuenta las casillas y las esquinas por separado.', 'El programa es el mismo.'],
    camino: espiral(6),
    javascript: `for (let i = 0; i < ${intentos(6)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Piezas del satelite',
    instruccion: 'Hay piezas sueltas por los pasillos. Pasa por encima de todas.',
    exito: 'Las piezas. El satelite pierde una cada dos semanas y nadie sube a recogerlas.',
    pistas: ['El programa de intentar y girar.', 'Las piezas estan en el camino.'],
    camino: espiral(5).flatMap((paso) => ('gira' in paso ? [estrellaAqui(), paso] : [paso])),
    javascript: `for (let i = 0; i < ${intentos(5)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'El error trae informacion',
    instruccion:
      'Lo que llega al catch no es solo un aviso: es un objeto con informacion. Tiene una clave message con lo que ha pasado escrito. Aqui no cambia nada, pero mira lo que tienes en la mano.',
    exito:
      'El error trae su mensaje. Eso es lo que separa un fallo util de un fallo mudo, y por eso los mensajes de error se escriben con cuidado.',
    pistas: ['El objeto del catch tiene una clave message.', 'Aunque no lo uses, esta ahi.'],
    camino: espiral(4),
    javascript: `let choques = 0;
for (let i = 0; i < ${intentos(4)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    if (error.message.length > 0) {
      choques = choques + 1;
    }
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Contar los choques',
    instruccion:
      'Cuenta cuantas veces has chocado. Al final del recorrido, ese numero es exactamente el numero de esquinas, y no lo sabias antes de empezar.',
    exito:
      'Los choques son las esquinas. El programa ha medido el tablero sin mirarlo, solo intentando y contando.',
    pistas: ['Una variable que empieza en cero y sube en el catch.', 'No hace falta usarla para nada mas.'],
    camino: espiral(5),
    javascript: `let esquinas = 0;
for (let i = 0; i < ${intentos(5)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    esquinas = esquinas + 1;
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Intentar dos cosas',
    instruccion:
      'Un try puede llevar mas de una linea, y si falla la primera, las demas no se hacen. Aqui se intentan dos pasos seguidos: si el primero falla, el segundo no se intenta.',
    exito:
      'Cuando algo falla dentro de un try, lo que queda no se ejecuta. Eso es lo que hace que un try sea util y tambien lo que hay que tener en la cabeza al escribirlo.',
    pistas: ['Dos avanzar dentro del mismo try.', 'Y el giro en el catch.'],
    // Los brazos son pares a proposito: con dos pasos por intento, un brazo impar
    // deja el ultimo paso a medias y la cuenta de intentos deja de cuadrar.
    camino: [andar(4), gira('derecha'), andar(6)],
    javascript: `for (let i = 0; i < 6; i++) {
  try {
    fuzz.avanzar();
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Preguntar tambien vale',
    instruccion:
      'Hoy los sensores del satelite funcionan. Resuelve el mismo tablero preguntando, como en el mundo 14, y compara los dos programas: son igual de largos y uno depende de que el sensor no mienta.',
    exito:
      'Los dos llegan. Preguntar es mejor cuando la pregunta es fiable, y en este juego casi siempre lo es. Intentar es mejor cuando no hay pregunta o no se puede confiar en ella.',
    pistas: ['El programa del mundo 14: si puedes avanzar, avanza, y si no, gira.', 'Cuenta los intentos igual.'],
    camino: espiral(5),
    javascript: `for (let i = 0; i < ${intentos(5)}; i++) {
  if (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  } else {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Ocho esquinas a ciegas',
    instruccion: 'Ocho esquinas y los sensores otra vez averiados. Solo queda intentarlo.',
    exito: 'Ocho esquinas sin fiarse de nadie. El satelite es un sitio poco fiable.',
    pistas: ['El programa de intentar y girar.', 'Cuenta casillas mas esquinas.'],
    camino: espiral(8),
    javascript: `for (let i = 0; i < ${intentos(8)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Girar al otro lado si vuelve a fallar',
    instruccion:
      'Un catch puede llevar dentro otro try. Aqui, si al girar a la derecha tampoco se puede avanzar, se gira otra vez. Es un callejon sin salida y hay que dar media vuelta.',
    exito:
      'Un try dentro de un catch. Se lee raro y significa algo claro: si el plan B tambien falla, hay plan C.',
    pistas: ['Dentro del catch, gira y vuelve a intentar avanzar.', 'Y si eso falla, gira otra vez.'],
    camino: espiral(4, 5),
    // Aqui el catch gira y avanza, asi que cada intento adelanta una casilla:
    // los intentos son las casillas, no las casillas mas las esquinas.
    javascript: `for (let i = 0; i < ${casillas(4, 5)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
    try {
      fuzz.avanzar();
    } catch (otro) {
      fuzz.girarDerecha();
    }
  }
}`,
  },
  {
    nombre: 'La funcion que intenta',
    instruccion:
      'Mete el intento en una funcion que devuelva si salio bien. Asi el programa de fuera se lee como una frase y el try queda escondido donde corresponde.',
    exito:
      'Una funcion que devuelve si algo salio bien. Es la forma mas comun de esconder un try: quien la llama no tiene que saber que hay uno dentro.',
    pistas: ['La funcion devuelve verdadero si avanzo y falso si no.', 'Y el programa de fuera decide con eso.'],
    camino: espiral(5),
    javascript: `function intentarAvanzar() {
  try {
    fuzz.avanzar();
    return true;
  } catch (error) {
    return false;
  }
}

for (let i = 0; i < ${intentos(5)}; i++) {
  if (intentarAvanzar() === false) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Siete esquinas con la funcion',
    instruccion: 'Siete esquinas con la funcion de intentar. El programa de fuera son tres lineas.',
    exito: 'Siete esquinas y un try escondido en una funcion. Asi se escribe cuando el programa va a leerlo alguien mas.',
    pistas: ['La funcion no cambia.', 'Cuenta los intentos del tablero nuevo.'],
    camino: espiral(7),
    javascript: `function intentarAvanzar() {
  try {
    fuzz.avanzar();
    return true;
  } catch (error) {
    return false;
  }
}

for (let i = 0; i < ${intentos(7)}; i++) {
  if (intentarAvanzar() === false) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Lanzar un error propio',
    instruccion:
      'Un programa tambien puede lanzar sus propios errores con throw, y eso sirve para avisar de algo que el no sabe arreglar. Aqui la funcion avisa cuando ya ha girado demasiadas veces.',
    exito:
      'Un error lanzado por ti. Lanzar en vez de arreglar es lo correcto cuando aqui no hay informacion suficiente para decidir: el que llama sabra mas.',
    pistas: ['Se escribe throw y un error nuevo con su mensaje.', 'Y se atrapa en un try de fuera.'],
    camino: espiral(4),
    javascript: `let giros = 0;

function girarConCuidado() {
  giros = giros + 1;
  if (giros > 10) {
    throw new Error("demasiados giros");
  }
  fuzz.girarDerecha();
}

try {
  for (let i = 0; i < ${intentos(4)}; i++) {
    try {
      fuzz.avanzar();
    } catch (error) {
      girarConCuidado();
    }
  }
} catch (error) {
  fuzz.girarIzquierda();
}`,
  },
  {
    nombre: 'El bloque que siempre se hace',
    instruccion:
      'Detras de un try y su catch puede ir un finally, que se hace siempre: salga bien o salga mal. Sirve para lo que hay que hacer en los dos casos.',
    exito:
      'Finally se hace siempre. Se usa para cerrar lo que se abrio, y aqui para contar los intentos hayan salido bien o mal.',
    pistas: ['Finally va detras del catch, con sus llaves.', 'Lo de dentro se hace en los dos casos.'],
    camino: espiral(4),
    javascript: `let intentosHechos = 0;
for (let i = 0; i < ${intentos(4)}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  } finally {
    intentosHechos = intentosHechos + 1;
  }
}`,
  },
  {
    nombre: 'Un error que no se atrapa aqui',
    instruccion:
      'Si un error no se atrapa, sube al try de fuera. Aqui la funcion de dentro no atrapa nada y el de fuera lo recoge todo.',
    exito:
      'Un error sube hasta que alguien lo atrapa. Eso permite que las funciones pequenas no tengan que saber que hacer con los fallos.',
    pistas: ['La funcion de dentro solo avanza, sin try.', 'El try esta en el bucle de fuera.'],
    camino: espiral(5),
    javascript: `function paso() {
  fuzz.avanzar();
}

for (let i = 0; i < ${intentos(5)}; i++) {
  try {
    paso();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Diez esquinas',
    instruccion: 'Diez esquinas y el satelite entero. Con la funcion de intentar cabe en cinco lineas.',
    exito: 'Diez esquinas. El satelite esta recorrido de punta a punta sin fiarse de un solo sensor.',
    pistas: ['La funcion que devuelve si salio bien.', 'Cuenta casillas mas esquinas.'],
    camino: espiral(10),
    javascript: `function intentarAvanzar() {
  try {
    fuzz.avanzar();
    return true;
  } catch (error) {
    return false;
  }
}

for (let i = 0; i < ${intentos(10)}; i++) {
  if (intentarAvanzar() === false) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Cuando preguntar es mejor',
    instruccion:
      'Este tablero se puede hacer de las dos formas. Hazlo preguntando, y piensa por que: intentar y recuperarse cuesta un choque en cada esquina, y un choque en un satelite de verdad no es gratis. Si hay una pregunta fiable, se pregunta.',
    exito:
      'Preguntando. Intentar y recuperarse no es mejor ni peor: es lo que queda cuando no hay pregunta. Cuando la hay, preguntar cuesta menos.',
    pistas: ['El programa del mundo 14, con la condicion.', 'Los intentos se cuentan igual.'],
    camino: espiral(6),
    javascript: `for (let i = 0; i < ${intentos(6)}; i++) {
  if (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  } else {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Los dos a la vez',
    instruccion:
      'Y aqui la respuesta de verdad: se pregunta cuando se puede Y se protege con un try por si la respuesta miente. Los dos, que es lo que se hace en los programas que aguantan.',
    exito:
      'Preguntar y protegerse. No es desconfianza: es que la respuesta puede cambiar entre la pregunta y la accion, y eso pasa de verdad en los programas que hablan con el mundo.',
    pistas: ['El if de siempre, y dentro un try alrededor del avanzar.', 'Si falla, se gira igual que en el else.'],
    camino: espiral(6),
    javascript: `for (let i = 0; i < ${intentos(6)}; i++) {
  if (fuzz.puedeAvanzar()) {
    try {
      fuzz.avanzar();
    } catch (error) {
      fuzz.girarDerecha();
    }
  } else {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'El satelite que no responde',
    instruccion:
      'Satelite, el Fuzz, dice que su satelite dejo de responder a las tres y catorce de la noche de la tormenta, y que cuando volvio a responder tenia una orden dentro que nadie le mando. Ve a verlo.',
    exito:
      'La orden que aparecio en el satelite dice: apuntar al Nucleo y mantener. Y lleva mantenida cuatro semanas. Satelite dice que el satelite no puede apuntar solo.',
    pistas: ['La funcion de intentar y el bucle.', 'Nueve esquinas.'],
    camino: espiral(9),
    javascript: `function intentarAvanzar() {
  try {
    fuzz.avanzar();
    return true;
  } catch (error) {
    return false;
  }
}

for (let i = 0; i < ${intentos(9)}; i++) {
  if (intentarAvanzar() === false) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Donde esta Satelite',
    instruccion:
      'Ultimo del satelite. Satelite esta en la antena, leyendo la orden que nadie mando. Ve a por el con lo mejor de las dos formas: pregunta y protegete.',
    exito:
      'Satelite esta en casa, y ha traido la orden impresa. Apuntar al Nucleo y mantener. Con la placa de Garfio, el crater de Duna y el nodo de Coral, ya son cuatro cosas que senalan al mismo sitio.',
    pistas: [
      'El if con el try dentro, y la funcion si quieres.',
      'Once esquinas: cuenta despacio.',
    ],
    camino: espiral(11),
    javascript: `function intentarAvanzar() {
  if (fuzz.puedeAvanzar() === false) {
    return false;
  }
  try {
    fuzz.avanzar();
    return true;
  } catch (error) {
    return false;
  }
}

for (let i = 0; i < ${intentos(11)}; i++) {
  if (intentarAvanzar() === false) {
    fuzz.girarDerecha();
  }
}`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 27,
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
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 155 : undefined,
  });
});

export const mundo27: WorldContentFile = {
  mundo: 27,
  slug: 'satelite-hackeado',
  nombre: 'El Satelite Hackeado',
  introTexto:
    'El Satelite Hackeado esta averiado y sus sensores mienten: si le preguntas si puedes avanzar, a veces dice que si cuando no. Asi que aqui no se pregunta. Se intenta, y se tiene preparado que hacer si sale mal. Eso es todo lo que significa try y catch, y es la razon de que existan: no siempre hay una pregunta fiable que hacer antes de actuar.',
  actividades,
};
