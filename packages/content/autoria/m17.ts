/**
 * Mundo 17: El Bioma Congelado. Repetir sin contar.
 *
 * Todos los bucles de los dieciséis mundos anteriores llevan un número, y ese
 * número es lo que más falla. El niño cuenta las casillas, se pasa de una, y el
 * Fuzz se estrella. Aquí desaparece: "mientras puedas avanzar, avanza" no lleva
 * número ninguno y cruza un pasillo de seis casillas igual que uno de veinte.
 *
 * Es, con diferencia, el bucle más potente que se enseña en los Creadores, y por
 * eso llega tan tarde: hace falta haber sufrido el número. Un niño que llega aquí
 * después de contar mal cincuenta veces entiende en diez segundos para qué sirve.
 *
 * El mismo bucle se dice de dos maneras y las dos están en el editor, en el mismo
 * bloque con un desplegable: `mientras` sigue mientras la respuesta sea sí, y
 * `hasta` sigue hasta que la respuesta sea sí. Son la misma idea del revés, y
 * conviene que el niño vea las dos porque en el mundo 21 va a encontrar las dos
 * escritas.
 *
 * Un cuidado que ya venía del mundo 14: como el programa pregunta hacia dónde va,
 * los pasillos no pueden quedar pegados. Los laberintos crecen de brazo en brazo
 * para que la espiral se abra y nunca haya camino donde el programa espera pared.
 *
 * Progresión:
 *   1-3    el pasillo de largo desconocido. Tres piezas y ningún número.
 *   4-8    varios tramos: un bucle para andar y otro para contar las esquinas.
 *   9-11   la otra forma de decirlo: hasta que haya un obstáculo.
 *   12-15  el bucle sin número dentro de un bloque propio.
 *   16-18  mientras con dos condiciones: sigue mientras el hielo aguante.
 *   19-20  el hielo de Copo.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  define,
  esColor,
  estrellaAqui,
  gira,
  girarDerecha,
  hasta,
  hayObstaculo,
  mientras,
  pinta,
  puedeAvanzar,
  repetir,
  usa,
  y,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const BLOQUES = [
  'avanzar',
  'girarDerecha',
  'girarIzquierda',
  'repetir',
  'mientras',
  'hasta',
  'siColor',
  'siSino',
  'funcion',
];

/**
 * Un laberinto en espiral que se abre.
 *
 * Los brazos crecen de uno en uno porque el Fuzz solo gira a la derecha: con
 * brazos parecidos la espiral se cierra, dos pasillos quedan pegados, y entonces
 * el sensor ve camino donde la actividad supone que hay pared.
 */
function espiral(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

/** La misma espiral, con el hielo bueno pintado de verde salvo el final de cada brazo. */
function espiralConHielo(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [pinta('verde')];
  for (let i = 0; i < brazos; i++) {
    const largo = primero + i;
    for (let c = 0; c < largo; c++) {
      pasos.push(andar(1));
      // La ultima casilla del brazo se queda sin pintar: es lo que para el bucle.
      if (c < largo - 1) pasos.push(pinta('verde'));
    }
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

/** Mientras puedas avanzar, avanza. El bucle sin numero. */
const ANDAR_HASTA_EL_FINAL = mientras(puedeAvanzar, avanzar());

/** Lo mismo dicho del reves: hasta que haya un obstaculo. */
const ANDAR_HASTA_LA_PARED = hasta(hayObstaculo, avanzar());

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly brazos: number;
  readonly primero?: number;
  readonly modo: 'mientras' | 'hasta' | 'bloque' | 'hielo';
  readonly premios?: boolean;
}

function programa(receta: Receta): Bloque[] {
  const { brazos, modo } = receta;

  if (modo === 'hielo') {
    /**
     * Aqui aparece una trampa que merece la pena entender.
     *
     * Este bucle se para por lo que dice la casilla donde esta el Fuzz, no por lo
     * que hay delante. Y eso significa que despues de girar sigue mirando la
     * misma casilla, que sigue sin ser verde, asi que el bucle no arranca y el
     * Fuzz se queda dando vueltas sobre si mismo. Hace falta un paso suelto
     * despues del giro para salir de la casilla que paro el bucle.
     *
     * Por eso el ultimo tramo va fuera del bucle grande: si estuviera dentro, el
     * paso suelto sacaria al Fuzz de la meta despues de haber llegado.
     */
    return [
      define('tramo', [mientras(y(puedeAvanzar, esColor('verde')), avanzar())]),
      repetir(brazos - 1, usa('tramo'), girarDerecha(), avanzar()),
      usa('tramo'),
    ];
  }
  if (modo === 'bloque') {
    return [
      define('tramo', [ANDAR_HASTA_EL_FINAL, girarDerecha()]),
      repetir(brazos, usa('tramo')),
    ];
  }
  const cuerpo = modo === 'hasta' ? ANDAR_HASTA_LA_PARED : ANDAR_HASTA_EL_FINAL;
  if (brazos === 1) return [cuerpo];
  return [repetir(brazos, cuerpo, girarDerecha())];
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Mientras puedas, avanza',
    instruccion:
      'Copo prueba el hielo antes de pisarlo y dice que aguanta lo que sea. Mira el bloque nuevo: repite lo que le pongas dentro MIENTRAS la respuesta a su pregunta sea si. Y fijate en lo que no tiene: no tiene numero. Ponle dentro avanzar y preguntale si puede avanzar.',
    exito:
      'Tres piezas y ningun numero. Lleva diecisiete mundos contando casillas y hoy no has contado ninguna.',
    pistas: [
      'En la pregunta del bloque va puedes avanzar, y dentro va avanzar.',
      'No hay ningun numero que poner. Ninguno.',
    ],
    brazos: 1,
    primero: 6,
    modo: 'mientras',
  },
  {
    nombre: 'Un pasillo mas largo',
    instruccion:
      'Este pasillo mide el doble. Sin tocar el programa. En serio: no cambies nada y dale a jugar.',
    exito:
      'El mismo programa, el doble de pasillo. Un bucle sin numero no se entera de lo largo que es el camino.',
    pistas: ['No cambies nada.', 'De verdad: dale a jugar tal cual.'],
    brazos: 1,
    primero: 12,
    modo: 'mientras',
  },
  {
    nombre: 'Una esquina',
    instruccion:
      'Dos pasillos y una esquina. Un bucle sin numero para el primero, el giro, y otro bucle sin numero para el segundo.',
    exito: 'Dos bucles sin numero. Ninguno de los dos sabe cuanto mide su pasillo.',
    pistas: ['Mientras puedas avanzar, avanza. Luego gira.', 'Y otra vez lo mismo.'],
    brazos: 2,
    primero: 4,
    modo: 'mientras',
  },
  {
    nombre: 'Cuatro esquinas',
    instruccion:
      'Cuatro pasillos. Ahora si hay un numero, pero fijate en QUE cuenta: cuenta esquinas, no casillas. Y las esquinas se ven de un vistazo.',
    exito:
      'El unico numero del programa cuenta esquinas. Contar cuatro esquinas es facil; contar veintidos casillas no.',
    pistas: [
      'Mete el bucle sin numero y el giro dentro de una pieza de repetir.',
      'El numero de fuera son las esquinas, no las casillas.',
    ],
    brazos: 4,
    modo: 'mientras',
  },
  {
    nombre: 'Seis esquinas',
    instruccion: 'Seis pasillos de largos distintos. Cuenta las esquinas y ya esta.',
    exito: 'Seis esquinas y ni una casilla contada. Copo dice que asi es como el cruza el bioma.',
    pistas: ['El programa es el mismo del nivel anterior.', 'Cuenta las esquinas: seis.'],
    brazos: 6,
    modo: 'mientras',
  },
  {
    nombre: 'Pasillos larguisimos',
    instruccion:
      'Cinco pasillos, y el mas largo mide catorce casillas. Da igual. Ni te molestes en mirarlos.',
    exito:
      'Catorce casillas que nadie ha contado. Este es el momento del curriculo en el que contar deja de hacer falta.',
    pistas: ['Cinco esquinas.', 'No mires los largos.'],
    brazos: 5,
    primero: 10,
    modo: 'mientras',
  },
  {
    nombre: 'Cristales de hielo',
    instruccion: 'Copo ha dejado cristales por los pasillos. Pasa por encima de todos.',
    exito: 'Los cristales. Copo dice que los usa para saber por donde ha pasado.',
    pistas: ['El programa no cambia.', 'Los cristales estan en el camino.'],
    brazos: 4,
    modo: 'mientras',
    premios: true,
  },
  {
    nombre: 'Ocho esquinas',
    instruccion: 'Ocho pasillos. El programa sigue teniendo seis piezas.',
    exito: 'Ocho esquinas con seis piezas. Un programa que no crece cuando crece el problema.',
    pistas: ['Cuenta las esquinas con el dedo.', 'Ocho.'],
    brazos: 8,
    modo: 'mientras',
  },
  {
    nombre: 'Hasta que haya pared',
    instruccion:
      'El mismo bloque tiene un desplegable con otra palabra: HASTA. En vez de seguir mientras se pueda, sigue hasta que haya un obstaculo. Es la misma idea dicha del reves. Pruebala.',
    exito:
      'Mientras puedas avanzar y hasta que haya pared son lo mismo. Elegir una u otra es cuestion de cual se lee mejor.',
    pistas: [
      'Cambia el desplegable del bloque de mientras a hasta.',
      'Y la pregunta pasa a ser hay un obstaculo.',
    ],
    brazos: 1,
    primero: 8,
    modo: 'hasta',
  },
  {
    nombre: 'Hasta, con esquinas',
    instruccion: 'Cuatro esquinas con la version del hasta. Igual de corto.',
    exito: 'Las dos formas hacen lo mismo. La de hasta se lee mejor cuando lo que buscas es un final.',
    pistas: ['El bloque en modo hasta, con hay un obstaculo dentro.', 'Cuatro esquinas.'],
    brazos: 4,
    modo: 'hasta',
  },
  {
    nombre: 'Siete esquinas con hasta',
    instruccion: 'Siete pasillos con la version del hasta. Y ya lo tienes.',
    exito: 'Siete esquinas. Las dos formas del bucle sin numero, dominadas.',
    pistas: ['No cambies la condicion.', 'Cuenta las esquinas.'],
    brazos: 7,
    modo: 'hasta',
  },
  {
    nombre: 'El tramo en un bloque',
    instruccion:
      'Andar un pasillo y girar es siempre lo mismo, asi que metelo en un bloque propio y llamalo tramo. Luego repite la llamada.',
    exito:
      'Un bloque propio con un bucle sin numero dentro. Se lee como una frase: repite cuatro veces el tramo.',
    pistas: ['Dentro del bloque: el bucle sin numero y el giro.', 'Y fuera, un repetir con la llamada.'],
    brazos: 4,
    modo: 'bloque',
  },
  {
    nombre: 'Seis tramos',
    instruccion: 'El mismo bloque, seis llamadas. Solo cambia el numero del repetir.',
    exito: 'Seis tramos y un bloque. Este programa se entiende leyendolo en voz alta.',
    pistas: ['No toques el bloque.', 'Cuenta las esquinas: seis.'],
    brazos: 6,
    modo: 'bloque',
  },
  {
    nombre: 'Nueve tramos',
    instruccion: 'Nueve. El bioma congelado es grande y tu programa sigue teniendo siete piezas.',
    exito: 'Nueve tramos con siete piezas. Copo esta impresionado y Copo no se impresiona.',
    pistas: ['El bloque es el mismo.', 'Nueve esquinas.'],
    brazos: 9,
    modo: 'bloque',
  },
  {
    nombre: 'Diez tramos',
    instruccion: 'Diez pasillos, el laberinto helado completo. Con el bloque esto ya es una linea.',
    exito: 'Diez tramos. Y ni una sola casilla contada en todo el mundo.',
    pistas: ['El bloque de tramo y un repetir.', 'Diez.'],
    brazos: 10,
    modo: 'bloque',
  },
  {
    nombre: 'Mientras el hielo aguante',
    instruccion:
      'Copo dice que el hielo bueno es el verde y que el blanco cruje. Ahora el bucle necesita dos condiciones: sigue mientras puedas avanzar Y el hielo sea verde. Cuando el verde se acaba, hay que girar aunque el pasillo siga.',
    exito:
      'Y aqui hay algo que solo se ve haciendolo: este bucle se para por la casilla donde ESTA el Fuzz, no por lo que hay delante. Despues de girar sigue mirando esa misma casilla, que sigue sin ser verde, asi que hace falta un paso suelto para salir de ella. Si no, el Fuzz gira sobre si mismo para siempre.',
    pistas: [
      'Mete el bucle en un bloque propio llamado tramo.',
      'Despues de cada giro hace falta un avanzar suelto, y el ultimo tramo va fuera del bucle grande.',
    ],
    brazos: 3,
    modo: 'hielo',
  },
  {
    nombre: 'Cinco tramos de hielo',
    instruccion: 'El hielo verde y cinco esquinas. El mismo programa.',
    exito: 'Cinco tramos leyendo el hielo. Copo dice que tu programa es mas prudente que el.',
    pistas: ['No cambies la condicion doble.', 'Cinco esquinas.'],
    brazos: 5,
    modo: 'hielo',
  },
  {
    nombre: 'Siete tramos de hielo',
    instruccion: 'Siete esquinas, el hielo verde, y el bucle sin numero. Todo lo del mundo junto.',
    exito: 'Siete tramos. El bioma entero cruzado con seis piezas y ninguna cuenta.',
    pistas: ['La condicion es la misma.', 'Siete esquinas.'],
    brazos: 7,
    modo: 'hielo',
  },
  {
    nombre: 'El hielo que no cruje',
    instruccion:
      'Copo tiene algo que ensenarte. Dice que hay una zona del bioma donde el hielo no cruje ni con su peso encima, y que antes de la tormenta esa zona no estaba. Ve a verla.',
    exito:
      'El hielo de esa zona esta liso como un espejo y no cruje. Copo dice que el hielo solo se pone asi cuando algo lo derrite y se vuelve a congelar de golpe. Algo muy caliente, dice, y muy grande.',
    pistas: ['El bucle sin numero, y ocho esquinas.', 'Usa el bloque de tramo para que quepa.'],
    brazos: 8,
    modo: 'bloque',
    premios: true,
  },
  {
    nombre: 'Donde esta Copo',
    instruccion:
      'Ultimo del bioma. Copo esta en el centro de la zona lisa, dando saltos encima del hielo para ver si cruje. No cruje. El camino tiene diez esquinas y el hielo bueno pintado.',
    exito:
      'Copo esta en casa, y ha traido un trozo del hielo liso en una caja. Dice que no se derrite. Lo ha puesto al lado de la bateria de Voltio, que tampoco se enfria.',
    pistas: [
      'La condicion doble: puedes avanzar Y el hielo es verde.',
      'Diez esquinas. Cuentalas dos veces.',
    ],
    brazos: 10,
    modo: 'hielo',
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 17,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  let camino =
    receta.modo === 'hielo'
      ? espiralConHielo(receta.brazos, receta.primero)
      : espiral(receta.brazos, receta.primero);

  if (receta.premios) {
    // Un cristal en la esquina de cada brazo: se recogen al pasar.
    camino = camino.flatMap((paso) =>
      'gira' in paso ? [estrellaAqui(), paso] : [paso],
    );
  }

  return actividadCreador(contexto, {
    camino,
    bloques: BLOQUES,
    solucion: programa(receta),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 110 : undefined,
  });
});

export const mundo17: WorldContentFile = {
  mundo: 17,
  slug: 'bioma-congelado',
  nombre: 'El Bioma Congelado',
  introTexto:
    'Copo prueba el hielo antes de pisarlo y dice que aguanta lo que sea. Aqui desaparece el numero de los bucles. Mientras puedas avanzar, avanza: tres piezas, ningun numero, y cruza un pasillo de seis casillas igual que uno de veinte. Es el bucle mas potente de todo el grupo, y llega ahora porque para entenderlo hace falta haber contado mal unas cincuenta veces.',
  actividades,
};
