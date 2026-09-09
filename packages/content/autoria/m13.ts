/**
 * Mundo 13: La Ciudad de los Engranajes. Hacerse un bloque propio.
 *
 * El problema de diseño es el mismo que tuvo el mundo 7 con la caja de Garfio, y
 * conviene recordarlo porque la tentación de resolverlo mal es fuerte: un bucle
 * es más barato que una función siempre que lo repetido esté seguido. Arreglar
 * cuatro puentes que están a la misma distancia se hace con un bucle de cinco
 * piezas; con una función propia hacen falta ocho. Contado en piezas, la función
 * pierde.
 *
 * Gana cuando lo mismo aparece en sitios SEPARADOS y entre ellos hay caminos
 * distintos, porque un bucle no puede saltarse lo de en medio. Así que la ciudad
 * tiene los puentes repartidos a distancias que no se repiten, y arreglar cada
 * uno son siempre los mismos tres movimientos: arreglar, pisar el puente, salir
 * al otro lado.
 *
 * Y hay una segunda razón, más importante que ahorrar piezas, que este mundo
 * enseña en la actividad catorce: cuando el bloque propio está mal, se arregla una
 * vez y se arregla en los cinco sitios. Eso es lo que de verdad hace útil ponerle
 * nombre a un grupo de piezas.
 *
 * Sobre cómo está escrito: el tablero y el programa salen de la misma lista de
 * tramos. El primer intento los llevaba por separado y el acercamiento a cada
 * puente se descontaba a mano, con el resultado previsible de que a partir del
 * segundo puente el Fuzz intentaba reparar el suelo. Contar dos veces la misma
 * cosa nunca sale bien.
 *
 * Progresión:
 *   1-3    el puente roto: lo que es, y que no se puede pisar.
 *   4-5    tres y cuatro puentes a mano. Empieza a cansar.
 *   6-9    el bloque propio. El mismo camino con la mitad de piezas.
 *   10-13  bloques más largos, el acercamiento dentro, y el bloque en un bucle.
 *   14-17  cambiar el bloque una vez, dos bloques, y un bloque que usa otro.
 *   18-20  la ciudad entera y el puente del mercado.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  define,
  estrellaAqui,
  gira,
  girarDerecha,
  girarIzquierda,
  puenteRoto,
  repararPuente,
  repetir,
  usa,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const SIN_FUNCION = ['avanzar', 'girarDerecha', 'girarIzquierda', 'repararPuente', 'repetir'];
const CON_FUNCION = [...SIN_FUNCION, 'funcion'];

/**
 * Un tramo de la ciudad.
 *
 * `puente` dice cuántas casillas hay que andar antes de llegar al puente. De esta
 * lista salen a la vez el tablero y el programa, y por eso no pueden discrepar.
 */
type Tramo =
  | { readonly puente: number; readonly ancho?: boolean; readonly premio?: boolean }
  | { readonly recto: number }
  | { readonly giro: 'derecha' | 'izquierda' };

const puente = (acercamiento: number, extras: { ancho?: boolean; premio?: boolean } = {}): Tramo => ({
  puente: acercamiento,
  ...extras,
});
const recto = (casillas: number): Tramo => ({ recto: casillas });
const giro = (lado: 'derecha' | 'izquierda'): Tramo => ({ giro: lado });

/** El camino que dibujan unos tramos. */
function caminoDe(tramos: readonly Tramo[]): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (const tramo of tramos) {
    if ('giro' in tramo) {
      pasos.push(gira(tramo.giro));
      continue;
    }
    if ('recto' in tramo) {
      pasos.push(andar(tramo.recto));
      continue;
    }
    if (tramo.puente > 0) pasos.push(andar(tramo.puente));
    pasos.push(puenteRoto());
    // Un puente ancho tiene dos casillas de camino al salir en vez de una.
    pasos.push(andar(tramo.ancho ? 2 : 1));
    if (tramo.premio) pasos.push(estrellaAqui());
  }
  return pasos;
}

/** Repetir una pieza varias veces, para los acercamientos escritos a mano. */
function pasos(veces: number): Bloque[] {
  return Array.from({ length: veces }, () => avanzar());
}

/** Cruzar un puente: arreglarlo, pisarlo y salir al otro lado. */
function cruce(ancho = false): Bloque[] {
  return ancho
    ? [repararPuente(), avanzar(), avanzar(), avanzar()]
    : [repararPuente(), avanzar(), avanzar()];
}

/** El programa escrito a mano, sin bloques propios. */
function aMano(tramos: readonly Tramo[]): Bloque[] {
  const salida: Bloque[] = [];
  for (const tramo of tramos) {
    if ('giro' in tramo) {
      salida.push(tramo.giro === 'derecha' ? girarDerecha() : girarIzquierda());
    } else if ('recto' in tramo) {
      salida.push(...pasos(tramo.recto));
    } else {
      salida.push(...pasos(tramo.puente), ...cruce(tramo.ancho));
    }
  }
  return salida;
}

/**
 * El programa que usa un bloque propio para cruzar.
 *
 * `dentro` dice qué se mete en el bloque: solo el cruce, o también el
 * acercamiento. Lo segundo solo vale si todos los acercamientos miden lo mismo,
 * y esa decisión es justo lo que se aprende en la actividad once.
 */
function conBloque(
  tramos: readonly Tramo[],
  opciones: { nombre?: string; conAcercamiento?: boolean; ancho?: boolean } = {},
): { readonly definicion: Bloque; readonly programa: Bloque[] } {
  const nombre = opciones.nombre ?? 'cruzar';
  const acercamiento = opciones.conAcercamiento
    ? (tramos.find((t) => 'puente' in t) as { puente: number } | undefined)?.puente ?? 0
    : 0;

  const definicion = define(nombre, [
    ...(opciones.conAcercamiento ? pasos(acercamiento) : []),
    ...cruce(opciones.ancho),
  ]);

  const programa: Bloque[] = [];
  for (const tramo of tramos) {
    if ('giro' in tramo) {
      programa.push(tramo.giro === 'derecha' ? girarDerecha() : girarIzquierda());
    } else if ('recto' in tramo) {
      programa.push(...pasos(tramo.recto));
    } else {
      if (!opciones.conAcercamiento) programa.push(...pasos(tramo.puente));
      programa.push(usa(nombre));
    }
  }

  return { definicion, programa };
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly tramos: readonly Tramo[];
  /** Cómo se resuelve: a mano, con un bloque propio, o a medida. */
  readonly como: 'mano' | 'bloque' | 'bloqueEntero' | ((tramos: readonly Tramo[]) => Bloque[]);
  readonly bloques?: readonly string[];
  /** Si el bloque propio cruza puentes anchos. */
  readonly ancho?: boolean;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'El puente roto',
    instruccion:
      'Bienvenido a la Ciudad de los Engranajes. Fijate en la casilla de tablones sueltos: es un puente roto y no se puede pisar. Engra arregla lo que otros rompen, y te ha dejado su pieza de reparar. Ponte delante del puente y usala.',
    exito:
      'Arreglado. Y fijate en el orden: primero se arregla y luego se pisa. Al reves el Fuzz se cae, y un puente no se arregla desde dentro.',
    pistas: [
      'Avanza hasta quedar justo delante del puente, sin pisarlo.',
      'Ahi usa la pieza de reparar, y despues avanza.',
    ],
    tramos: [puente(2), recto(1)],
    como: 'mano',
    bloques: SIN_FUNCION,
  },
  {
    nombre: 'Dos puentes',
    instruccion:
      'Dos puentes, y entre ellos un tramo de camino bueno. Los mismos tres movimientos, dos veces.',
    exito: 'Dos puentes con los mismos tres movimientos. Empieza a fijarte en ese grupo de tres.',
    pistas: [
      'Cada puente son tres piezas: reparar, avanzar y avanzar.',
      'Y antes de cada puente hay que acercarse.',
    ],
    tramos: [puente(1), puente(2)],
    como: 'mano',
    bloques: SIN_FUNCION,
  },
  {
    nombre: 'El puente de la esquina',
    instruccion: 'Este puente esta pasada una esquina. Hay que girar antes de ponerse delante.',
    exito: 'Girar, acercarse, arreglar y pasar. Los tres movimientos del puente no cambian nunca.',
    pistas: ['Avanza hasta la esquina y gira a la derecha.', 'Luego acercate al puente y arreglalo.'],
    tramos: [recto(2), giro('derecha'), puente(1), recto(1)],
    como: 'mano',
    bloques: SIN_FUNCION,
  },
  {
    nombre: 'Tres puentes a mano',
    instruccion:
      'Tres puentes y los tres acercamientos son distintos. Escribelo entero, con las piezas sueltas, y cuenta cuantas te han hecho falta.',
    exito:
      'Doce piezas, y nueve de ellas son el mismo grupo de tres repetido. Eso tiene que poder decirse mejor.',
    pistas: ['Los tres puentes se cruzan igual.', 'Lo que cambia es cuanto hay que andar para llegar a cada uno.'],
    tramos: [puente(1), puente(2), puente(1)],
    como: 'mano',
    bloques: SIN_FUNCION,
  },
  {
    nombre: 'Cuatro puentes a mano',
    instruccion:
      'Cuatro. Y antes de que preguntes: no, la pieza de repetir no te sirve, porque los tramos de en medio no son iguales. Escribelo a mano una ultima vez.',
    exito:
      'Diecisiete piezas para cuatro puentes. Ahora vas a hacer esto con nueve. Guarda el enfado.',
    pistas: ['Ve puente por puente y comprueba antes de seguir.', 'Los acercamientos miden uno, dos, uno y tres.'],
    tramos: [puente(1), puente(2), puente(1), puente(3)],
    como: 'mano',
    bloques: SIN_FUNCION,
  },
  {
    nombre: 'Mi propio bloque',
    instruccion:
      'Mira la categoria nueva: mis bloques. Puedes coger un grupo de piezas, meterlas en un bloque tuyo y ponerle nombre. Llamalo cruzar y mete dentro los tres movimientos del puente. Luego usalo tres veces.',
    exito:
      'Un bloque tuyo, con tu nombre, usado tres veces. Engra dice que ella tiene catorce y que uno se llama arreglar el arreglo.',
    pistas: [
      'Dentro de tu bloque van: reparar, avanzar y avanzar.',
      'Y en el programa: acercarte a cada puente y usar tu bloque.',
    ],
    tramos: [puente(1), puente(2), puente(1)],
    como: 'bloque',
  },
  {
    nombre: 'Cuatro puentes con un bloque',
    instruccion: 'El de los cuatro puentes, otra vez. Ahora con tu bloque. Cuenta las piezas al acabar.',
    exito:
      'Once piezas donde antes hicieron falta diecisiete. Y si manana Engra cambia como se arreglan los puentes, tu cambias un bloque y no diecisiete piezas.',
    pistas: ['El bloque es el mismo de antes.', 'Solo cambian los acercamientos.'],
    tramos: [puente(1), puente(2), puente(1), puente(3)],
    como: 'bloque',
  },
  {
    nombre: 'Puentes y esquinas',
    instruccion:
      'Puentes en tramos que giran. Tu bloque sirve igual: no dice hacia donde, dice que hacer.',
    exito:
      'Tu bloque cruzando puentes en tres direcciones distintas. No sabe hacia donde mira el Fuzz, y no le hace falta.',
    pistas: ['Gira antes de acercarte a cada puente.', 'El bloque no cambia nunca.'],
    tramos: [puente(1), giro('derecha'), puente(1), giro('izquierda'), puente(1)],
    como: 'bloque',
  },
  {
    nombre: 'Cinco puentes',
    instruccion: 'Cinco puentes por toda la ciudad. Con tu bloque esto ya no da miedo.',
    exito: 'Cinco puentes, y tu bloque escrito una sola vez. Asi trabaja Engra.',
    pistas: ['Ve tramo a tramo.', 'Los acercamientos miden uno, dos, uno, uno y dos.'],
    tramos: [
      puente(1),
      puente(2),
      puente(1),
      giro('derecha'),
      puente(1),
      puente(2),
    ],
    como: 'bloque',
  },
  {
    nombre: 'Un bloque mas largo',
    instruccion:
      'Aqui los puentes vienen de dos en dos, uno detras del otro. Mete los dos cruces en el mismo bloque tuyo.',
    exito:
      'Tu bloque ahora hace seis movimientos de golpe. Un bloque propio puede ser tan grande como quieras.',
    pistas: [
      'Dentro del bloque: cruzar un puente y cruzar el otro.',
      'Usalo dos veces, con su acercamiento delante.',
    ],
    tramos: [puente(1), puente(0), recto(1), puente(1), puente(0)],
    como: (tramos) => {
      void tramos;
      return [
        define('doble', [...cruce(), ...cruce()]),
        avanzar(),
        usa('doble'),
        avanzar(),
        avanzar(),
        usa('doble'),
      ];
    },
  },
  {
    nombre: 'El bloque con el acercamiento dentro',
    instruccion:
      'Prueba otra cosa: mete tambien el avanzar del acercamiento dentro del bloque. Sirve solo si todos los acercamientos miden lo mismo. Aqui miden lo mismo.',
    exito:
      'Cuatro movimientos dentro y cuatro llamadas. Decidir que va dentro del bloque y que se queda fuera es la mitad del trabajo.',
    pistas: ['Dentro del bloque: avanzar, reparar, avanzar, avanzar.', 'Y en el programa, solo cuatro llamadas.'],
    tramos: [puente(1), puente(1), puente(1), puente(1)],
    como: 'bloqueEntero',
  },
  {
    nombre: 'El bloque dentro del bucle',
    instruccion:
      'Y si los acercamientos son todos iguales, tu bloque puede ir dentro de una pieza de repetir. Las dos ideas juntas.',
    exito:
      'Un bloque propio dentro de un bucle. Cinco puentes con siete piezas: es lo mas corto que has escrito hoy.',
    pistas: ['Tu bloque lleva el acercamiento dentro.', 'Y el bucle lo llama cinco veces.'],
    tramos: [puente(1), puente(1), puente(1), puente(1), puente(1)],
    como: () => [define('cruzar', [avanzar(), ...cruce()]), repetir(5, usa('cruzar'))],
  },
  {
    nombre: 'Engranajes por el camino',
    instruccion:
      'Engra ha perdido tres engranajes y estan al otro lado de tres puentes. Pasa por encima de todos.',
    exito: 'Los tres engranajes. Engra dice que sin el pequeno no puede arreglar nada.',
    pistas: ['El bloque de cruzar es el de siempre.', 'Los engranajes estan justo al salir de cada puente.'],
    tramos: [
      puente(1, { premio: true }),
      puente(2, { premio: true }),
      puente(1, { premio: true }),
    ],
    como: 'bloque',
  },
  {
    nombre: 'Cambiar el bloque una vez',
    instruccion:
      'Aqui viene lo bueno de tener un bloque propio, y es mas importante que ahorrar piezas. Estos cinco puentes son mas anchos: al salir hay que avanzar una vez mas. Cambialo dentro del bloque y mira lo que pasa.',
    exito:
      'Una pieza cambiada y cinco puentes arreglados de otra forma. Si lo hubieras escrito suelto, habrias tenido que cambiarlo en cinco sitios y te habrias olvidado de uno.',
    pistas: [
      'Dentro del bloque hay un avanzar mas que antes.',
      'El programa de fuera no cambia nada.',
    ],
    tramos: [
      puente(1, { ancho: true }),
      puente(1, { ancho: true }),
      puente(1, { ancho: true }),
      puente(1, { ancho: true }),
      puente(1, { ancho: true }),
    ],
    ancho: true,
    como: 'bloqueEntero',
  },
  {
    nombre: 'Dos bloques distintos',
    instruccion:
      'Dos clases de puente en la misma ciudad: unos anchos y otros estrechos. Hazte dos bloques y elige cual usar en cada uno.',
    exito: 'Dos bloques propios y cuatro llamadas. Elegir el bloque correcto es mas dificil que hacerlo.',
    pistas: [
      'Un bloque para el puente estrecho y otro para el ancho.',
      'El ancho lleva un avanzar mas.',
    ],
    tramos: [
      puente(1),
      puente(1, { ancho: true }),
      puente(1),
      puente(1, { ancho: true }),
    ],
    como: (tramos) => {
      const programa: Bloque[] = [
        define('estrecho', cruce()),
        define('ancho', cruce(true)),
      ];
      for (const tramo of tramos) {
        if ('puente' in tramo) {
          programa.push(...pasos(tramo.puente), usa(tramo.ancho ? 'ancho' : 'estrecho'));
        }
      }
      return programa;
    },
  },
  {
    nombre: 'Un bloque que usa otro',
    instruccion:
      'Un bloque tuyo puede usar otro bloque tuyo por dentro. Haz uno que cruce un puente y otro que cruce dos y gire.',
    exito:
      'Un bloque dentro de otro bloque. Asi se construye todo lo grande: cosas con nombre hechas de cosas con nombre.',
    pistas: [
      'El bloque pequeno cruza un puente con su acercamiento.',
      'El grande usa el pequeno dos veces y luego gira y avanza.',
    ],
    tramos: [
      puente(1),
      puente(1),
      giro('derecha'),
      recto(1),
      puente(1),
      puente(1),
      giro('derecha'),
      recto(1),
    ],
    como: () => [
      define('cruzar', [avanzar(), ...cruce()]),
      define('tramo', [usa('cruzar'), usa('cruzar'), girarDerecha(), avanzar()]),
      usa('tramo'),
      usa('tramo'),
    ],
  },
  {
    nombre: 'Ocho puentes',
    instruccion:
      'Ocho puentes, dos esquinas y dos clases de puente. Es el tablero mas grande de la ciudad. Con bloques propios cabe en la pantalla.',
    exito: 'Ocho puentes. Engra ha dicho que si quieres trabajo, hay sitio.',
    pistas: [
      'Hazte los dos bloques primero y comprueba cada uno con un puente.',
      'Luego ve tramo a tramo.',
    ],
    tramos: [
      puente(1),
      puente(1),
      giro('derecha'),
      puente(1, { ancho: true }),
      puente(1, { ancho: true }),
      giro('izquierda'),
      puente(1),
      puente(1),
    ],
    como: (tramos) => {
      const programa: Bloque[] = [
        define('estrecho', [avanzar(), ...cruce()]),
        define('ancho', [avanzar(), ...cruce(true)]),
      ];
      for (const tramo of tramos) {
        if ('giro' in tramo) {
          programa.push(tramo.giro === 'derecha' ? girarDerecha() : girarIzquierda());
        } else if ('puente' in tramo) {
          programa.push(usa(tramo.ancho ? 'ancho' : 'estrecho'));
        }
      }
      return programa;
    },
  },
  {
    nombre: 'El bucle de los seis',
    instruccion:
      'Seis puentes iguales seguidos y despues un tramo distinto. El bucle para los seis, y el resto suelto.',
    exito: 'Seis puentes en un bucle con tu bloque dentro. El programa mas corto de la ciudad.',
    pistas: ['El bloque lleva el acercamiento dentro.', 'Y el tramo del final va fuera del bucle.'],
    tramos: [
      puente(1),
      puente(1),
      puente(1),
      puente(1),
      puente(1),
      puente(1),
      giro('derecha'),
      recto(3),
    ],
    como: () => [
      define('cruzar', [avanzar(), ...cruce()]),
      repetir(6, usa('cruzar')),
      girarDerecha(),
      repetir(3, avanzar()),
    ],
  },
  {
    nombre: 'El puente que nadie rompio',
    instruccion:
      'Engra tiene una queja. Dice que el puente grande del mercado se rompio la noche de la tormenta, y que ella lo habia revisado esa misma tarde y estaba entero. Dice que no se rompio: dice que algo lo rompio. Ve a verla.',
    exito:
      'Me ensenó el puente. Los tablones no estan partidos por el medio, como cuando algo cede por abajo. Estan arrancados hacia arriba. Engra dice que eso solo pasa cuando algo tira desde el cielo.',
    pistas: [
      'Un bloque para cruzar con su acercamiento, y otro que use el primero dos veces y gire.',
      'El camino gira dos veces.',
    ],
    tramos: [
      puente(1),
      puente(1),
      giro('derecha'),
      recto(1),
      puente(1),
      puente(1),
      giro('derecha'),
      recto(2),
    ],
    como: () => [
      define('cruzar', [avanzar(), ...cruce()]),
      define('tramo', [usa('cruzar'), usa('cruzar'), girarDerecha(), avanzar()]),
      usa('tramo'),
      usa('tramo'),
      avanzar(),
    ],
  },
  {
    nombre: 'Donde esta Engra',
    instruccion:
      'Ultimo de la ciudad. Engra esta al fondo, debajo del puente del mercado, mirando los tablones arrancados. Ve a por ella. Vas a necesitar tu bloque, un bucle y un tramo suelto.',
    exito:
      'Engra esta en casa, y se ha traido un tablon. Lo dejo al lado del cristal de Prisma y de la libreta de Tuerca. Empieza a parecer un monton de pruebas, y nadie ha dicho todavia de que.',
    pistas: [
      'Hazte el bloque de cruzar con el acercamiento dentro.',
      'Los cuatro primeros puentes van en un bucle, y el resto suelto.',
    ],
    tramos: [
      puente(1),
      puente(1),
      puente(1),
      puente(1),
      giro('derecha'),
      puente(1),
      puente(2),
      recto(1),
    ],
    como: (tramos) => {
      void tramos;
      return [
        define('cruzar', [avanzar(), ...cruce()]),
        repetir(4, usa('cruzar')),
        girarDerecha(),
        usa('cruzar'),
        avanzar(),
        usa('cruzar'),
        avanzar(),
      ];
    },
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 13,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  let solucion: Bloque[];
  if (typeof receta.como === 'function') {
    solucion = receta.como(receta.tramos);
  } else if (receta.como === 'mano') {
    solucion = aMano(receta.tramos);
  } else {
    const armado = conBloque(receta.tramos, {
      conAcercamiento: receta.como === 'bloqueEntero',
      ...(receta.ancho ? { ancho: true } : {}),
    });
    solucion = [armado.definicion, ...armado.programa];
  }

  return actividadCreador(contexto, {
    camino: caminoDe(receta.tramos),
    bloques: receta.bloques ?? CON_FUNCION,
    solucion,
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 90 : undefined,
  });
});

export const mundo13: WorldContentFile = {
  mundo: 13,
  slug: 'ciudad-de-los-engranajes',
  nombre: 'La Ciudad de los Engranajes',
  introTexto:
    'Engra arregla lo que otros rompen, y en la Ciudad de los Engranajes hay mucho roto: puentes de tablones sueltos que no se pueden pisar hasta que se arreglan. Arreglar uno son siempre los mismos tres movimientos, y en esta ciudad hay ocho puentes. Aqui vas a aprender a coger un grupo de piezas, ponerle un nombre y usarlo donde te haga falta. Y algo mejor: cuando ese grupo esta mal, se arregla una vez y se arregla en todas partes.',
  actividades,
};
