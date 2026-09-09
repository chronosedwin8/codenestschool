/**
 * Mundo 16: La Fábrica de Baterías. Un bloque propio que recibe un número.
 *
 * El mundo 13 enseñó a hacerse un bloque, y ese bloque hacía siempre lo mismo. El
 * 12 enseñó las variables, y una variable puede cambiar mientras el programa
 * corre, pero el bloque de repetir la mira cuando pasa por ahí: no se le puede
 * decir "haz esto tres veces aquí y cinco veces allí" sin escribirlo dos veces.
 *
 * Un parámetro resuelve exactamente eso, y para que se vea hay que diseñar el
 * tablero al revés de como se diseñó el mundo 12. Allí los tramos crecían de uno
 * en uno, y por eso una variable que sumaba uno los recorría todos. Aquí los
 * tramos miden lo que les da la gana: tres, cinco, dos, seis. Ninguna cuenta los
 * genera, así que la única forma de no repetir el bloque es que el bloque acepte
 * el número desde fuera.
 *
 * La geometría es de escalera y no de espiral, y eso es a propósito: el bloque
 * acaba girando a un lado y al otro, así que el camino siempre avanza hacia abajo
 * y a la derecha y no puede pisarse a sí mismo. Con una espiral, tramos de largo
 * arbitrario se cruzan y el tablero queda roto.
 *
 * Progresión:
 *   1-3    el bloque de siempre, y el momento en que hacen falta dos iguales.
 *   4-8    el hueco del bloque. El mismo bloque con números distintos.
 *   9-13   escaleras largas con tramos que no siguen ninguna cuenta.
 *   14-17  dos huecos, y un bloque que llama a otro pasandole su propio número.
 *   18-20  las baterías de Voltio.
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
  num,
  repetir,
  usa,
  vble,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const BLOQUES = ['avanzar', 'girarDerecha', 'girarIzquierda', 'repetir', 'variable', 'funcion'];

/**
 * Un escalón: se anda `largo` casillas, se baja una y se vuelve a mirar al frente.
 *
 * Siempre progresa hacia la derecha y hacia abajo, así que dos escalones nunca se
 * pisan por muy raros que sean sus largos.
 */
function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

/**
 * El camino de una escalera entera.
 *
 * `bajadas` hace falta en las actividades de dos huecos: si el programa baja dos
 * casillas y el camino solo dibuja una, el Fuzz se estrella en el primer escalon.
 */
function escalera(largos: readonly number[], bajadas?: readonly number[]): PasoCamino[] {
  return largos.flatMap((largo, i) => escalon(largo, bajadas?.[i] ?? 1));
}

/** El bloque propio que recorre un escalón, con el largo como hueco. */
const PASO_CON_HUECO: Bloque = define(
  'paso',
  [repetir(vble('largo'), avanzar()), girarDerecha(), avanzar(), girarIzquierda()],
  ['largo'],
);

/** El mismo escalón escrito con un número fijo, sin hueco. */
function pasoFijo(largo: number): Bloque[] {
  return [repetir(largo, avanzar()), girarDerecha(), avanzar(), girarIzquierda()];
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly largos: readonly number[];
  /** Cómo se resuelve: sin bloque, con bloque sin hueco, o con hueco. */
  readonly como: 'suelto' | 'sinHueco' | 'conHueco' | ((largos: readonly number[]) => Bloque[]);
  readonly premios?: boolean;
  /** Cuanto baja cada escalon, cuando no es una sola casilla. */
  readonly bajadas?: readonly number[];
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Un escalon',
    instruccion:
      'La Fabrica de Baterias esta construida en escalones. Voltio carga las baterias de todo el Nido y dice que sube y baja por aqui cincuenta veces al dia. Empieza con un escalon: anda tres, baja uno y vuelve a mirar al frente.',
    exito: 'Un escalon. Fijate en la forma, porque la vas a ver mucho: andar, girar, bajar, girar.',
    pistas: ['Tres avanzar, girar a la derecha, avanzar, girar a la izquierda.', 'Usa el bucle para los tres avanzar.'],
    largos: [3],
    como: 'suelto',
  },
  {
    nombre: 'Dos escalones iguales',
    instruccion: 'Dos escalones y los dos miden tres. Hazte un bloque propio como en la ciudad de Engra.',
    exito: 'Un bloque y dos llamadas. Esto ya lo sabias hacer.',
    pistas: ['Dentro del bloque va el escalon entero.', 'Y luego dos llamadas.'],
    largos: [3, 3],
    como: 'sinHueco',
  },
  {
    nombre: 'Dos escalones distintos',
    instruccion:
      'Y aqui esta el problema del mundo. Estos dos escalones miden tres y cinco. Tu bloque de antes solo sabe hacer tres. Puedes hacerte dos bloques, uno para cada largo, y va a funcionar. Hazlo asi hoy.',
    exito:
      'Dos bloques que se parecen en todo menos en un numero. Cuando dos cosas se parecen tanto, casi siempre falta una idea.',
    pistas: ['Un bloque para el escalon de tres y otro para el de cinco.', 'Cada uno con su bucle.'],
    largos: [3, 5],
    como: (largos) => [
      define('corto', pasoFijo(largos[0]!)),
      define('largo', pasoFijo(largos[1]!)),
      usa('corto'),
      usa('largo'),
    ],
  },
  {
    nombre: 'El hueco del bloque',
    instruccion:
      'Mira lo que se puede hacer: al crear tu bloque, ponle un hueco. Ese hueco es un numero que le das cada vez que lo llamas, y dentro del bloque se usa como si fuera una caja. Un solo bloque para los dos escalones.',
    exito:
      'Un bloque con un hueco, dos llamadas con numeros distintos. Voltio dice que eso es lo primero que aprendio en la fabrica.',
    pistas: [
      'Al crear el bloque, anadele un hueco y llamalo largo.',
      'Dentro, el bucle usa el hueco. Y al llamar, le pones el numero.',
    ],
    largos: [3, 5],
    como: 'conHueco',
  },
  {
    nombre: 'Cuatro largos distintos',
    instruccion: 'Cuatro escalones y ningun par igual. Un bloque, cuatro llamadas, cuatro numeros.',
    exito:
      'Un bloque para cuatro escalones distintos. Sin el hueco habrian sido cuatro bloques o veinticuatro piezas.',
    pistas: ['El bloque no cambia.', 'Solo cambia el numero que le pones en cada llamada.'],
    largos: [2, 4, 3, 5],
    como: 'conHueco',
  },
  {
    nombre: 'No hay ninguna cuenta',
    instruccion:
      'Fijate en los largos: dos, cinco, tres, seis, dos. No suben, no bajan, no siguen ninguna regla. Por eso una caja que suma uno no sirve aqui: el bloque tiene que recibir cada numero desde fuera.',
    exito:
      'Ninguna cuenta genera esos numeros. Cuando los valores no siguen una regla, hay que pasarlos uno a uno, y para eso es el hueco.',
    pistas: ['El bloque es el mismo de antes.', 'Lee los largos del tablero de arriba abajo.'],
    largos: [2, 5, 3, 6, 2],
    como: 'conHueco',
  },
  {
    nombre: 'Baterias en los escalones',
    instruccion: 'Voltio ha dejado baterias al final de tres escalones. Pasa por encima de todas.',
    exito: 'Tres baterias. Voltio dice que estaban a media carga y que ahora ya no.',
    pistas: ['El bloque con hueco de siempre.', 'Las baterias estan en el camino, no hay que desviarse.'],
    largos: [3, 2, 4],
    como: 'conHueco',
    premios: true,
  },
  {
    nombre: 'Siete escalones',
    instruccion: 'Siete escalones y siete numeros. El programa crece una pieza por escalon y nada mas.',
    exito: 'Siete llamadas. Sin el hueco esto habrian sido cuarenta y dos piezas.',
    pistas: ['Ve leyendo los largos en orden.', 'Comprueba cada dos o tres llamadas.'],
    largos: [2, 4, 1, 5, 3, 2, 2],
    como: 'conHueco',
  },
  {
    nombre: 'El escalon de una casilla',
    instruccion:
      'Cuidado con el escalon de una sola casilla. El bloque funciona igual, pero el numero es un uno y es facil contarlo mal.',
    exito: 'El uno tambien vale. Un bloque con hueco no pregunta si el numero es grande.',
    pistas: ['Hay dos escalones de una sola casilla.', 'El bloque no cambia.'],
    largos: [1, 3, 1, 4, 2],
    como: 'conHueco',
  },
  {
    nombre: 'Diez escalones',
    instruccion: 'La escalera larga de la fabrica. Diez escalones, diez numeros, un bloque.',
    exito: 'Diez escalones. Voltio los sube todos los dias y dice que tu programa es mas rapido.',
    pistas: ['Ve de tres en tres comprobando.', 'Si te equivocas en un numero, el Fuzz se estrella en ese escalon.'],
    largos: [2, 3, 1, 4, 2, 1, 1, 3, 2, 1],
    como: 'conHueco',
  },
  {
    nombre: 'El bucle no sirve aqui',
    instruccion:
      'Prueba a resolverlo con una pieza de repetir alrededor de la llamada. Vas a ver que no puedes, porque cada llamada necesita un numero distinto y el bucle repite lo mismo. Hazlo con llamadas sueltas.',
    exito:
      'Un bucle repite lo mismo; un bloque con hueco hace algo distinto cada vez. No son la misma herramienta y aqui se ve por que.',
    pistas: ['Cada escalon necesita su propio numero.', 'Llamadas sueltas, una por escalon.'],
    largos: [4, 2, 5, 3],
    como: 'conHueco',
  },
  {
    nombre: 'Cuando si sirve el bucle',
    instruccion:
      'Y ahora al contrario: aqui los cinco escalones miden lo mismo. Con un numero igual en todas las llamadas, el bucle SI sirve, y ahorra cuatro piezas. Usalo.',
    exito:
      'Un bucle con una llamada dentro. Cuando los numeros se repiten, el bucle gana; cuando no, gana el hueco. Saber cual toca es el oficio.',
    pistas: ['Los cinco escalones miden tres.', 'Mete la llamada dentro de una pieza de repetir.'],
    largos: [3, 3, 3, 3, 3],
    como: (largos) => [
      PASO_CON_HUECO,
      repetir(largos.length, usa('paso', num(largos[0]!))),
    ],
  },
  {
    nombre: 'Dos huecos',
    instruccion:
      'Un bloque puede tener mas de un hueco. Este escalon necesita dos numeros: cuanto andar y cuanto bajar. Ponle los dos.',
    exito: 'Dos huecos en el mismo bloque. Los huecos se llenan por orden, asi que el orden importa.',
    pistas: [
      'El bloque lleva dos huecos: largo y bajada.',
      'Dentro hay dos bucles, uno para cada hueco.',
    ],
    largos: [3, 2, 4],
    como: (largos) => [
      define(
        'paso',
        [
          repetir(vble('largo'), avanzar()),
          girarDerecha(),
          repetir(vble('bajada'), avanzar()),
          girarIzquierda(),
        ],
        ['largo', 'bajada'],
      ),
      ...largos.map((largo) => usa('paso', num(largo), num(1))),
    ],
  },
  {
    nombre: 'Bajadas distintas',
    instruccion:
      'Ahora las bajadas tampoco son iguales. Dos huecos y dos numeros por llamada. Leelos con cuidado del tablero.',
    exito: 'Dos numeros por llamada y ni uno cambiado de sitio. Voltio te ha ofrecido su puesto.',
    pistas: [
      'El primer numero es lo que se anda y el segundo lo que se baja.',
      'Si los cambias de sitio, el Fuzz se va por donde no debe.',
    ],
    largos: [3, 2, 4],
    bajadas: [2, 1, 2],
    como: (largos) => [
      define(
        'paso',
        [
          repetir(vble('largo'), avanzar()),
          girarDerecha(),
          repetir(vble('bajada'), avanzar()),
          girarIzquierda(),
        ],
        ['largo', 'bajada'],
      ),
      usa('paso', num(largos[0]!), num(2)),
      usa('paso', num(largos[1]!), num(1)),
      usa('paso', num(largos[2]!), num(2)),
    ],
  },
  {
    nombre: 'Un bloque que llama a otro',
    instruccion:
      'Un bloque con hueco puede llamar a otro bloque con hueco, y pasarle su propio numero. Haz uno que llame al escalon dos veces con el mismo largo.',
    exito:
      'Un hueco que viaja de un bloque a otro. Lo que entra por el hueco de fuera sale por el de dentro, y eso permite construir cosas grandes con piezas pequenas.',
    pistas: [
      'El bloque grande tiene un hueco y llama dos veces al escalon.',
      'En las dos llamadas le pasa su propio hueco.',
    ],
    largos: [3, 3, 4, 4],
    como: () => [
      PASO_CON_HUECO,
      define('doble', [usa('paso', vble('largo')), usa('paso', vble('largo'))], ['largo']),
      usa('doble', num(3)),
      usa('doble', num(4)),
    ],
  },
  {
    nombre: 'El hueco con una cuenta',
    instruccion:
      'Al llamar a un bloque no hace falta darle un numero pelado: se le puede dar una cuenta. Aqui cada escalon mide uno mas que el anterior, asi que puedes llamarlo con la caja y con la caja mas uno.',
    exito:
      'Una cuenta dentro del hueco. El bloque no sabe si le has dado un numero o una suma, y no le hace falta saberlo.',
    pistas: [
      'Crea una caja con un dos.',
      'Y llama al escalon con la caja, con la caja mas uno, y con la caja mas dos.',
    ],
    largos: [2, 3, 4],
    como: () => [
      PASO_CON_HUECO,
      { pon: 'base', a: num(2) },
      usa('paso', vble('base')),
      usa('paso', { aritmetica: '+', a: vble('base'), b: num(1) }),
      usa('paso', { aritmetica: '+', a: vble('base'), b: num(2) }),
    ],
  },
  {
    nombre: 'La escalera entera',
    instruccion: 'Doce escalones con largos sin ninguna regla. Es la escalera completa de la fabrica.',
    exito: 'Doce escalones. Voltio dice que la fabrica entera funciona con tres bloques como el tuyo.',
    pistas: ['Ve por partes y comprueba a mitad.', 'Un numero mal deja al Fuzz estrellado en ese escalon.'],
    largos: [1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 1],
    como: 'conHueco',
  },
  {
    nombre: 'El hueco que no se usa',
    instruccion:
      'Atencion a este, que es una trampa. El bloque tiene un hueco, pero en los cinco escalones le vas a dar el mismo numero. Cuando eso pasa, el hueco no hace falta y sobra: metelo en un bucle y quitale el hueco. Un programa mas corto es mejor programa.',
    exito:
      'Sin hueco y con un bucle. Un hueco que siempre recibe lo mismo es una pieza de mas, y las piezas de mas se quitan.',
    pistas: [
      'Los cinco escalones miden dos.',
      'Hazte el bloque sin hueco y llamalo cinco veces con un bucle.',
    ],
    largos: [2, 2, 2, 2, 2],
    como: (largos) => [
      define('paso', pasoFijo(largos[0]!)),
      repetir(largos.length, usa('paso')),
    ],
  },
  {
    nombre: 'La bateria que se cargo sola',
    instruccion:
      'Voltio tiene algo raro que contarte. Dice que la noche de la tormenta todas las baterias del Nido se descargaron de golpe, menos una, que se cargo. Sola. Ve a verla.',
    exito:
      'La bateria esta en el estante de arriba y sigue llena. Voltio dice que una bateria no se carga sola: se carga si algo le pasa energia por encima. Y esa noche no habia nadie arriba.',
    pistas: ['El bloque con hueco de siempre.', 'Lee los ocho largos del tablero.'],
    largos: [3, 1, 4, 2, 3, 1, 3, 2],
    como: 'conHueco',
    premios: true,
  },
  {
    nombre: 'Donde esta Voltio',
    instruccion:
      'Ultimo de la fabrica. Voltio esta arriba, al lado de la bateria que se cargo sola, con la mano encima para notar si se calienta. El camino son diez escalones y dos bajadas distintas.',
    exito:
      'Voltio esta en casa, y ha traido la bateria. La ha dejado con el mapa de Dedalo y el tablon de Engra. Sigue caliente, dice. Cuatro dias despues, sigue caliente.',
    pistas: [
      'El bloque de dos huecos: largo y bajada.',
      'Las bajadas van alternando entre una y dos casillas.',
    ],
    largos: [2, 2, 3, 1, 2, 2, 3, 1, 2, 1],
    bajadas: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
    como: (largos) => [
      define(
        'paso',
        [
          repetir(vble('largo'), avanzar()),
          girarDerecha(),
          repetir(vble('bajada'), avanzar()),
          girarIzquierda(),
        ],
        ['largo', 'bajada'],
      ),
      ...largos.map((largo, i) => usa('paso', num(largo), num(i % 2 === 0 ? 1 : 2))),
    ],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 16,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  // El camino se dibuja igual para todas: lo que cambia es el programa.
  let camino: PasoCamino[];
  let solucion: Bloque[];

  if (typeof receta.como === 'function') {
    // Las recetas a medida pueden llevar bajadas de mas de una casilla; el camino
    // se construye a partir de la propia solucion en el caso de dos huecos.
    camino = escalera(receta.largos, receta.bajadas);
    solucion = receta.como(receta.largos);
  } else if (receta.como === 'suelto') {
    camino = escalera(receta.largos);
    solucion = pasoFijo(receta.largos[0]!);
  } else if (receta.como === 'sinHueco') {
    camino = escalera(receta.largos);
    solucion = [define('paso', pasoFijo(receta.largos[0]!)), ...receta.largos.map(() => usa('paso'))];
  } else {
    camino = escalera(receta.largos);
    solucion = [PASO_CON_HUECO, ...receta.largos.map((largo) => usa('paso', num(largo)))];
  }

  if (receta.premios) {
    // Una bateria al final de cada escalon: se recogen de paso.
    camino = receta.largos.flatMap((largo) => [...escalon(largo).slice(0, 1), estrellaAqui(), ...escalon(largo).slice(1)]);
  }

  return actividadCreador(contexto, {
    camino,
    bloques: BLOQUES,
    solucion,
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 105 : undefined,
  });
});

export const mundo16: WorldContentFile = {
  mundo: 16,
  slug: 'fabrica-de-baterias',
  nombre: 'La Fabrica de Baterias',
  introTexto:
    'Voltio carga las baterias de todo el Nido y sube y baja los escalones de esta fabrica cincuenta veces al dia. Los escalones miden lo que les da la gana: tres, cinco, dos, seis. Ninguna cuenta los genera, asi que ni un bucle ni una caja que suma uno los recorren. Aqui vas a aprender a ponerle un hueco a tu propio bloque: un numero que le das cada vez que lo llamas, distinto en cada llamada.',
  actividades,
};
