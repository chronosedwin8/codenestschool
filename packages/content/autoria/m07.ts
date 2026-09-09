/**
 * Mundo 7: La Bahía de los Piratas. La caja de Garfio, que es una subrutina.
 *
 * El mundo 3 enseñó a repetir y el 4 a repetir cosas dentro de cosas. Este tiene
 * que enseñar algo distinto, y ahí está la dificultad de diseño: un bucle es más
 * barato que una función siempre que lo repetido esté seguido. `repetir` cuesta
 * una ficha y sirve para diez saltos iguales; una caja con nombre cuesta una
 * ficha por la caja, una por cada movimiento de dentro, y una por cada vez que
 * se llama. Sobre un camino uniforme, el bucle gana. Siempre.
 *
 * Así que la caja tiene que ganar por donde el bucle no llega: cuando el mismo
 * grupo de movimientos aparece en sitios SEPARADOS del tablero, y entre ellos
 * hay caminos distintos. Un bucle no puede saltarse lo de en medio. Una caja sí,
 * porque no le importa dónde se llame.
 *
 * De ahí sale la geometría de la bahía: piedras y huecos alternos, uno sí y uno
 * no, de forma que rodar no sirve para nada y hay que saltar de piedra en
 * piedra. Es exactamente la geometría que en el mundo 3 era un error: allí el
 * niño rodaba y saltaba, y un hueco cada dos casillas lo dejaba sin sitio para
 * rodar. Aquí es la mecánica.
 *
 * El Super Salto de Garfio son tres movimientos: salta, baja una piedra, salta
 * otra vez. Aparece tres o cuatro veces por tablero, y entre cada dos hay un
 * trozo de camino distinto. Escrito a mano son nueve o doce fichas. Metido en la
 * caja, son cuatro y tres llamadas.
 *
 * Progresión:
 *   1-3    la caja con dos usos. Se aprende a guardar y a llamar.
 *   4-8    tres usos y caminos distintos entre ellos. La caja ya sale a cuenta.
 *   9-13   cuatro usos, y cajas de otras formas.
 *   14-17  dos cajas distintas en el mismo programa.
 *   18-20  los tableros grandes de la bahía.
 */
import {
  actividadExplorador,
  estrellasEn,
  repite,
  rueda,
  salta,
  tableroDePrograma,
  usa,
  type Cajas,
  type ContextoExplorador,
  type Movimiento,
} from '../src/generadores-exploradores.js';
import type { Tramo } from '../src/generadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const COMANDOS = [
  'derecha',
  'izquierda',
  'arriba',
  'abajo',
  'saltar',
  'repetir',
  'funcion',
  'llamar',
];

type Dir = Tramo['dir'];

/** El Super Salto: salta, baja una piedra, y vuelve a saltar. */
const SUPER_SALTO: readonly Movimiento[] = [salta(), rueda('abajo'), salta()];

/** El Doble Salto: dos saltos seguidos, sin tocar el suelo entre ellos. */
const DOBLE: readonly Movimiento[] = [salta(), salta()];

/** El Rodeo: baja, salta, y sigue bajando. */
const RODEO: readonly Movimiento[] = [rueda('abajo'), salta(), rueda('abajo')];

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly dirInicial?: Dir;
  readonly cajas: Cajas;
  readonly programa: readonly Movimiento[];
  readonly estrellas?: number;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La caja de Garfio',
    instruccion:
      'Garfio lo guarda todo en cajas, hasta los movimientos. Coge tres fichas, las mete en una caja, le pone un nombre, y ya esta: cada vez que dice el nombre, hace las tres. Prueba: mete salta, baja y salta.',
    exito:
      'Has llamado a la caja dos veces y ha hecho seis movimientos. Garfio dice que la caja se llama Super Salto y que la invento el.',
    pistas: [
      'Dentro de la caja van tres fichas: saltar, bajar y saltar.',
      'Luego llama a la caja dos veces, con una rodada a la derecha en medio.',
    ],
    cajas: { superSalto: SUPER_SALTO },
    programa: [usa(), rueda('derecha'), usa()],
  },
  {
    nombre: 'Rodar no sirve',
    instruccion:
      'Fijate en las piedras: hay una y luego un hueco, una y un hueco. Aqui no se puede rodar ni una casilla. Solo saltar. Por eso Garfio tiene la caja.',
    exito: 'Ni una rodada en todo el tablero. La bahia es asi: de piedra en piedra o al agua.',
    pistas: ['Rodar no vale: delante de ti siempre hay agua.', 'Usa la caja dos veces.'],
    cajas: { superSalto: SUPER_SALTO },
    programa: [usa(), rueda('derecha'), usa()],
    estrellas: 1,
  },
  {
    nombre: 'Tres veces la misma caja',
    instruccion:
      'Tres Super Saltos, y entre cada dos un trozo de camino distinto. Escribirlo ficha a ficha son once. Con la caja son nueve. Empieza a merecer la pena.',
    exito: 'Una caja y tres llamadas. Nueve fichas para once movimientos.',
    pistas: ['La caja es la misma de antes: saltar, bajar, saltar.', 'Llamala tres veces.'],
    cajas: { superSalto: SUPER_SALTO },
    programa: [usa(), rueda('derecha'), usa(), rueda('derecha'), usa()],
    estrellas: 1,
  },
  {
    nombre: 'Caminos distintos',
    instruccion:
      'Mira bien: entre el primer Super Salto y el segundo hay una casilla, y entre el segundo y el tercero hay tres y un giro. Por eso una ficha de repetir no te sirve aqui: lo de en medio no es igual.',
    exito:
      'Ahi esta la diferencia. Un bucle repite lo que esta seguido. Una caja se usa donde te haga falta, y no le importa lo que haya en medio.',
    pistas: [
      'Los trozos de camino entre las cajas no son iguales.',
      'Llama a la caja tres veces y pon el camino que toca entre cada dos.',
    ],
    cajas: { superSalto: SUPER_SALTO },
    programa: [usa(), rueda('derecha'), usa(), rueda('derecha', 2), rueda('abajo'), usa()],
    estrellas: 2,
  },
  {
    nombre: 'El muelle largo',
    instruccion: 'Cuatro Super Saltos. Cuenta las llamadas, no los saltos.',
    exito: 'Cuatro llamadas, doce movimientos. La caja ya te ha ahorrado mas fichas que la barra entera.',
    pistas: ['La caja no cambia nunca: saltar, bajar, saltar.', 'Son cuatro llamadas y tres trozos de camino.'],
    cajas: { superSalto: SUPER_SALTO },
    programa: [
      usa(),
      rueda('derecha'),
      usa(),
      rueda('derecha'),
      usa(),
      rueda('derecha'),
      usa(),
    ],
    estrellas: 2,
  },
  {
    nombre: 'Con un giro en medio',
    instruccion:
      'El muelle gira. Un trozo de camino puede bajar en vez de ir a la derecha, y la caja sigue funcionando igual: salta hacia donde mira el Fuzz.',
    exito:
      'La caja ha saltado hacia abajo sin que le cambiaras nada. No dice hacia donde salta: dice salta.',
    pistas: ['Un trozo de camino baja en vez de ir a la derecha.', 'La caja es siempre la misma.'],
    cajas: { superSalto: SUPER_SALTO },
    programa: [usa(), rueda('abajo'), usa(), rueda('derecha'), usa()],
    estrellas: 2,
  },
  {
    nombre: 'La caja de dos saltos',
    instruccion:
      'Garfio tiene otra caja mas pequena: dos saltos seguidos, sin tocar el suelo entre ellos. La llama el Doble. Metela tu.',
    exito: 'Dos fichas dentro y cuatro llamadas. El Doble es la caja favorita de Garfio porque es la mas corta.',
    pistas: ['Dentro de la caja van solo dos fichas de saltar.', 'Llamala cuatro veces.'],
    cajas: { doble: DOBLE },
    programa: [usa('doble'), rueda('abajo'), usa('doble'), rueda('derecha'), usa('doble')],
    estrellas: 2,
  },
  {
    nombre: 'El Doble por la bahia',
    instruccion: 'El Doble cuatro veces, y los caminos entre ellos todos distintos. Lee el tablero despacio.',
    exito: 'Cuatro Dobles en cuatro sitios distintos. Ni un bucle podria haber hecho eso.',
    pistas: ['Los trozos de camino entre las cajas no se parecen.', 'Ve caja a caja y comprueba antes de seguir.'],
    cajas: { doble: DOBLE },
    programa: [
      usa('doble'),
      rueda('abajo'),
      usa('doble'),
      rueda('derecha', 2),
      usa('doble'),
      rueda('abajo'),
      usa('doble'),
    ],
    estrellas: 2,
  },
  {
    nombre: 'El Rodeo',
    instruccion:
      'Esta caja no empieza saltando: empieza bajando. Se llama el Rodeo. Baja, salta, y sigue bajando. Fijate en el orden.',
    exito: 'El Rodeo baja mas de lo que salta. Garfio la usa cuando el agua esta picada, dice.',
    pistas: ['Dentro van tres fichas: bajar, saltar y bajar.', 'Llamala tres veces.'],
    cajas: { rodeo: RODEO },
    programa: [usa('rodeo'), rueda('derecha'), usa('rodeo'), rueda('derecha'), usa('rodeo')],
    estrellas: 2,
  },
  {
    nombre: 'Cuatro Rodeos',
    instruccion: 'El Rodeo cuatro veces. Doce movimientos, y en tu barra van a caber siete fichas.',
    exito: 'Siete fichas para doce movimientos. Garfio te ha invitado a su barco.',
    pistas: ['La caja es bajar, saltar, bajar.', 'Cuatro llamadas y tres trozos de camino.'],
    cajas: { rodeo: RODEO },
    programa: [
      usa('rodeo'),
      rueda('derecha'),
      usa('rodeo'),
      rueda('derecha'),
      usa('rodeo'),
      rueda('derecha'),
      usa('rodeo'),
    ],
    estrellas: 2,
  },
  {
    nombre: 'Lo que no cabe en la caja',
    instruccion:
      'Cuidado: no todo el tablero es Super Salto. Hay trozos que no se repiten en ningun otro sitio, y esos van sueltos, fuera de la caja. Saber que NO meter es la mitad del truco.',
    exito:
      'Lo que se repite, dentro. Lo que pasa una sola vez, fuera. Eso es lo que hace un programador cuando ordena su codigo.',
    pistas: [
      'La caja solo lleva lo que se repite en varios sitios.',
      'Los trozos raros del final van sueltos, sin caja.',
    ],
    cajas: { superSalto: SUPER_SALTO },
    programa: [
      usa(),
      rueda('derecha'),
      usa(),
      rueda('derecha', 2),
      rueda('abajo', 2),
      rueda('derecha'),
      usa(),
    ],
    estrellas: 3,
  },
  {
    nombre: 'La caja larga',
    instruccion:
      'Esta caja lleva cinco movimientos: salta, baja, salta, baja, salta. Es la mas larga de Garfio y la que mas ahorra.',
    exito: 'Cinco movimientos dentro y tres llamadas. Quince movimientos con nueve fichas.',
    pistas: ['Dentro van cinco fichas, alternando saltar y bajar.', 'Llamala tres veces.'],
    cajas: {
      superSalto: [salta(), rueda('abajo'), salta(), rueda('abajo'), salta()],
    },
    programa: [usa(), rueda('derecha'), usa(), rueda('derecha'), usa()],
    estrellas: 3,
  },
  {
    nombre: 'Empezar bajando',
    instruccion:
      'Hoy el Fuzz mira hacia abajo desde el principio, asi que la caja va a saltar hacia abajo. La misma caja, otra direccion.',
    exito: 'La caja no sabe hacia donde salta. Salta hacia donde mira el Fuzz, y hoy miraba abajo.',
    pistas: ['La caja es la de siempre.', 'Los trozos de camino son los que cambian de direccion.'],
    dirInicial: 'abajo',
    cajas: { doble: DOBLE },
    programa: [usa('doble'), rueda('derecha'), usa('doble'), rueda('abajo'), usa('doble')],
    estrellas: 2,
  },
  {
    nombre: 'Dos cajas',
    instruccion:
      'Garfio ha traido dos cajas: el Super Salto y el Doble. En este tablero hacen falta las dos, y no da igual cual usas donde.',
    exito: 'Dos cajas en un programa. Garfio dice que asi es como tiene ordenado el barco entero.',
    pistas: [
      'El Super Salto lleva tres movimientos y el Doble solo dos.',
      'Mira cada trozo del tablero y decide cual de las dos encaja.',
    ],
    cajas: { superSalto: SUPER_SALTO, doble: DOBLE },
    programa: [usa(), rueda('derecha'), usa('doble'), rueda('derecha'), usa()],
    estrellas: 3,
  },
  {
    nombre: 'Cual de las dos',
    instruccion:
      'Las dos cajas otra vez, y esta vez el tablero no te lo dice tan claro. Cuenta las piedras de cada tramo antes de decidir.',
    exito: 'Has elegido bien las cinco veces. Elegir la caja correcta es mas dificil que hacerla.',
    pistas: ['Dos piedras seguidas piden el Doble.', 'Tres movimientos con una bajada en medio piden el Super Salto.'],
    cajas: { superSalto: SUPER_SALTO, doble: DOBLE },
    programa: [
      usa('doble'),
      rueda('derecha'),
      usa(),
      rueda('derecha'),
      usa('doble'),
      rueda('abajo'),
      usa(),
    ],
    estrellas: 3,
  },
  {
    nombre: 'El Rodeo y el Doble',
    instruccion: 'Otras dos cajas: el Rodeo y el Doble. Una baja mucho y la otra salta seguido.',
    exito: 'Dos cajas distintas, cinco llamadas y ni una ficha suelta de mas.',
    pistas: ['El Rodeo empieza bajando. El Doble empieza saltando.', 'Fijate en como empieza cada tramo.'],
    cajas: { rodeo: RODEO, doble: DOBLE },
    programa: [
      usa('rodeo'),
      rueda('derecha'),
      usa('doble'),
      rueda('derecha'),
      usa('rodeo'),
      rueda('derecha'),
      usa('doble'),
    ],
    estrellas: 3,
  },
  {
    nombre: 'El almacen',
    instruccion:
      'Garfio dice que este es el tablero que usa para ensenar a los piratas nuevos. Dos cajas, seis llamadas, y todos los caminos distintos.',
    exito: 'Seis llamadas sin equivocarte de caja. Garfio te ha dado un gancho de recuerdo. No preguntes de donde lo saco.',
    pistas: ['Ve tramo a tramo y no intentes verlo todo de golpe.', 'Comprueba despues de cada llamada.'],
    cajas: { superSalto: SUPER_SALTO, doble: DOBLE },
    programa: [
      usa(),
      rueda('derecha'),
      usa('doble'),
      rueda('derecha'),
      usa('doble'),
      rueda('derecha'),
      usa(),
    ],
    estrellas: 3,
  },
  {
    nombre: 'El simbolo del cofre',
    instruccion:
      'Garfio tiene un cofre que no abre nunca. Dice que dentro hay una placa de metal con un dibujo, y que la encontro esa noche, flotando. Cruza la bahia y te lo ensena.',
    exito:
      'La placa tiene un circulo con tres rayas dentro. Garfio dice que no es de ningun barco de la bahia. Y que la encontro antes de la tormenta, no despues.',
    pistas: ['La caja larga lleva cinco movimientos.', 'Son tres llamadas y dos trozos de camino.'],
    cajas: {
      superSalto: [salta(), rueda('abajo'), salta(), rueda('abajo'), salta()],
    },
    programa: [usa(), rueda('derecha', 2), usa(), rueda('derecha'), usa()],
    estrellas: 3,
  },
  {
    nombre: 'El muelle roto',
    instruccion:
      'El muelle se rompio con la tormenta y quedo asi: piedras sueltas y agua. Cuatro Super Saltos y cuatro trozos de camino, todos distintos. El mas largo de la bahia.',
    exito: 'El muelle entero cruzado. Garfio dice que el tardo tres dias en aprenderse este.',
    pistas: ['Ve de cuatro en cuatro movimientos: cada llamada son tres.', 'Comprueba despues de cada caja.'],
    cajas: { superSalto: SUPER_SALTO },
    programa: [
      usa(),
      rueda('derecha'),
      usa(),
      rueda('derecha', 2),
      usa(),
      rueda('abajo'),
      rueda('derecha'),
      usa(),
    ],
    estrellas: 3,
  },
  {
    nombre: 'Donde esta Garfio',
    instruccion:
      'Ultimo de la bahia. Garfio esta en la punta del muelle con el cofre en las rodillas, esperandote. Lleva dos cajas puestas y tu vas a necesitar las dos.',
    exito:
      'Garfio esta en casa, y ha traido el cofre. Cuando le pregunte por que lo guarda, dijo que hay cosas que se guardan porque algun dia alguien va a preguntar por ellas. Y me miro a mi.',
    pistas: [
      'Empieza mirando que caja encaja en el primer tramo.',
      'Hay cinco llamadas y ninguna repetida seguida.',
    ],
    cajas: { superSalto: SUPER_SALTO, doble: DOBLE },
    programa: [
      usa('doble'),
      rueda('derecha'),
      usa(),
      rueda('derecha'),
      usa('doble'),
      rueda('derecha'),
      usa(),
      rueda('abajo'),
      usa('doble'),
    ],
    estrellas: 3,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 7,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const tablero = tableroDePrograma({
    ...(receta.dirInicial ? { dirInicial: receta.dirInicial } : {}),
    cajas: receta.cajas,
    movimientos: receta.programa,
  });

  return actividadExplorador(contexto, {
    plan: {
      tramos: tablero.tramos,
      agujeros: tablero.agujeros,
      estrellas: estrellasEn(tablero.firmes, receta.estrellas ?? 0),
    },
    comandos: COMANDOS,
    solucion: tablero.fichas,
    exigeEstructuras: ['funcion'],
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 65 : undefined,
  });
});

export const mundo7: WorldContentFile = {
  mundo: 7,
  slug: 'bahia-de-los-piratas',
  nombre: 'La Bahia de los Piratas',
  introTexto:
    'En la Bahia de los Piratas hay una piedra y un hueco, una piedra y un hueco. Aqui no se rueda: se salta de piedra en piedra o se acaba en el agua. Garfio lo guarda todo en cajas, los caramelos, los tornillos y hasta los movimientos: coge tres fichas, las mete en una caja, le pone un nombre, y cada vez que dice el nombre hace las tres. A eso le llama su Super Salto, y hoy te lo presta.',
  actividades,
};
