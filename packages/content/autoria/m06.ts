/**
 * Mundo 6: El Castillo de Nubes. Si hay camino, rueda. Si no, salta.
 *
 * Aquí está el salto conceptual más grande de los Exploradores. Hasta ahora el
 * niño mira el tablero, cuenta, y escribe la respuesta. El programa no decide
 * nada: repite lo que ya se decidió al escribirlo.
 *
 * Este mundo rompe eso. La forma de conseguirlo es puramente geométrica: los
 * huecos dejan de estar a distancias regulares. En el mundo 3 estaban cada tres
 * casillas, así que "rueda y salta" repetido cruzaba el tablero sin mirar. Aquí
 * un tramo mide cuatro casillas y el siguiente una, y no hay ningún patrón que
 * valga para los dos. La única forma de cruzar con un programa corto es
 * preguntar antes de cada paso: hay nube delante? Entonces rueda. No hay?
 * Entonces salta.
 *
 * Y ahí ocurre algo que los niños notan enseguida: el mismo programa resuelve
 * tableros distintos. Es la primera vez que escriben algo que no sabían de
 * antemano cómo iba a comportarse.
 *
 * El número del bucle sigue importando, y es la parte difícil. No cuenta pasos:
 * cuenta decisiones. Un tramo de cuatro casillas es una decisión, igual que uno
 * de una. Por eso el generador lo calcula y no lo escribe nadie a mano: pedir un
 * número de decisiones equivocado deja la actividad imposible sin que se vea
 * leyendo el código.
 *
 * Progresión:
 *   1-4    pasillos cortos. Se aprende qué hace la ficha que pregunta.
 *   5-8    pasillos verticales y pasillos donde casi todo son saltos.
 *   9-13   pasillos largos: escribir las fichas a mano deja de caber.
 *   14-17  dos pasillos con un giro entre ellos. Un bucle por tramo.
 *   18-20  los más largos del castillo. Contar decisiones es todo el reto.
 */
import {
  actividadExplorador,
  caminoDeNubes,
  estrellasEn,
  programaDeNubes,
  type ContextoExplorador,
  type SegmentoNubes,
} from '../src/generadores-exploradores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const COMANDOS = ['derecha', 'izquierda', 'arriba', 'abajo', 'saltar', 'repetir', 'siSino'];

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly segmentos: readonly SegmentoNubes[];
  readonly estrellas?: number;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La ficha que mira',
    instruccion:
      'Mira esta ficha nueva. Tiene dos huecos: en el de arriba pones lo que hacer si hay nube delante, y en el de abajo lo que hacer si no hay. Nimbo la usa siempre. Nimbo no ha caido nunca.',
    exito:
      'Tu programa ha decidido solo, sin que tu mires. Lee otra vez lo que escribiste: no dice donde estan los huecos. Y aun asi los ha saltado.',
    pistas: [
      'Arriba pon rodar a la derecha. Abajo pon saltar.',
      'Y repite esa ficha cuatro veces: cuatro decisiones.',
    ],
    segmentos: [{ dir: 'derecha', nubes: [3, 1, 3] }],
  },
  {
    nombre: 'Nubes de dos en dos',
    instruccion:
      'Otro pasillo, otras nubes, y el mismo programa de antes. Solo cambia el numero de veces. Cuenta las decisiones, no las casillas.',
    exito: 'Mismo programa, tablero distinto. Eso no lo habias hecho hasta hoy.',
    pistas: ['Cada trozo de nube es una rodada y cada hueco es un salto.', 'Cuenta: cinco decisiones.'],
    segmentos: [{ dir: 'derecha', nubes: [2, 2, 2] }],
    estrellas: 1,
  },
  {
    nombre: 'Una nube sola',
    instruccion:
      'Cuidado con la nube del medio: es de una sola casilla. Ahi no se rueda, se aterriza y se vuelve a saltar. Eso son dos saltos seguidos y ni una rodada.',
    exito:
      'Dos saltos seguidos sin rodar entre ellos. La ficha que mira se ha dado cuenta y tu no has tenido que decirle nada.',
    pistas: [
      'Una nube de una casilla no se rueda: se salta desde ella.',
      'Cuenta las decisiones: rodar, saltar, saltar, rodar. Cuatro.',
    ],
    segmentos: [{ dir: 'derecha', nubes: [4, 1, 4] }],
  },
  {
    nombre: 'Empezar saltando',
    instruccion:
      'Fijate donde estas parado: la nube de debajo tiene una sola casilla. Tu primera decision no va a ser rodar.',
    exito: 'Tres saltos y una rodada. Ni un solo paso de mas, y ni una ficha de mas.',
    pistas: ['Delante de ti hay un hueco, no nube. Que hace la ficha entonces?', 'Son cuatro decisiones.'],
    segmentos: [{ dir: 'derecha', nubes: [1, 1, 1, 4] }],
    estrellas: 1,
  },
  {
    nombre: 'Bajando del castillo',
    instruccion:
      'El pasillo baja. A la ficha que mira le da igual la direccion: mira hacia donde va el Fuzz, no hacia donde miras tu.',
    exito: 'Hacia abajo funciona igual. La ficha pregunta por lo que tiene delante, y delante es donde va.',
    pistas: ['Arriba pon bajar y abajo pon saltar.', 'Cinco decisiones.'],
    segmentos: [{ dir: 'abajo', nubes: [3, 2, 3] }],
    estrellas: 1,
  },
  {
    nombre: 'Casi todo aire',
    instruccion:
      'De este pasillo queda mas aire que nube. Cuatro nubes de una casilla seguidas. Vas a saltar mucho.',
    exito: 'Cuatro saltos seguidos. Nimbo dice que este pasillo es el que mas miedo le da del castillo.',
    pistas: ['Las nubes de una casilla no se ruedan.', 'Cuenta: una rodada al principio, cuatro saltos, y una rodada al final.'],
    segmentos: [{ dir: 'derecha', nubes: [5, 1, 1, 1, 5] }],
    estrellas: 1,
  },
  {
    nombre: 'Nubes desiguales',
    instruccion:
      'Aqui no hay ningun patron: dos, una, tres, una, dos. Ningun numero de repeticiones a lo bruto sirve. Solo sirve preguntar.',
    exito:
      'Siete decisiones con cuatro fichas. Escribirlas a mano habrian sido siete, y para el siguiente pasillo no habrian valido.',
    pistas: [
      'No cuentes casillas. Cuenta cuantas veces hay que decidir.',
      'Cada nube de mas de una casilla es una rodada y cada hueco es un salto.',
    ],
    segmentos: [{ dir: 'derecha', nubes: [2, 1, 3, 1, 2] }],
    estrellas: 2,
  },
  {
    nombre: 'El pasillo que baja mal',
    instruccion: 'Bajando otra vez, y las nubes cada vez peor puestas. Cuenta despacio.',
    exito: 'Bien contado. Este es de los que se fallan por uno.',
    pistas: ['Un hueco, una decision. Una nube larga, otra decision.', 'Ve trozo por trozo desde arriba.'],
    segmentos: [{ dir: 'abajo', nubes: [2, 1, 1, 3, 2] }],
    estrellas: 2,
  },
  {
    nombre: 'Ocho decisiones',
    instruccion:
      'Pasillo largo. Si lo escribes ficha a ficha te van a hacer falta ocho. Con la ficha que mira te hacen falta cuatro, y ya sabes cuales.',
    exito: 'Cuatro fichas para ocho decisiones. La barra de programa se te esta quedando vacia.',
    pistas: ['El programa es el mismo de siempre: rodar o saltar.', 'Lo unico que tienes que acertar es el numero.'],
    segmentos: [{ dir: 'derecha', nubes: [3, 1, 2, 1, 2, 2] }],
    estrellas: 2,
  },
  {
    nombre: 'Diez',
    instruccion:
      'El pasillo mas largo que has visto. Diez decisiones. Cuentalas dos veces antes de darle a jugar, porque si te pasas de una, Nimbo salta al vacio.',
    exito:
      'Diez exactas. Y fijate: si te hubieras pasado de una, la ficha habria mandado saltar cuando ya no habia donde caer.',
    pistas: ['Ve trozo por trozo y ve sumando.', 'Nube larga suma uno. Hueco suma uno. Nube de una casilla no suma rodada.'],
    segmentos: [{ dir: 'derecha', nubes: [2, 1, 2, 1, 2, 1, 3] }],
    estrellas: 2,
  },
  {
    nombre: 'Subir mirando',
    instruccion: 'Hacia arriba, hacia la torre. Nimbo esta arriba y las nubes de subida son las peores.',
    exito: 'Subiendo tambien. Nimbo te ve desde la torre y esta contando tus fichas.',
    pistas: ['Arriba en la ficha pon subir, y abajo saltar.', 'Cuenta las decisiones de abajo hacia arriba.'],
    segmentos: [{ dir: 'arriba', nubes: [3, 1, 2, 1, 3] }],
    estrellas: 2,
  },
  {
    nombre: 'Nueve y un hueco al final',
    instruccion:
      'Este acaba en una nube de una sola casilla. Eso significa que tu ultima decision es un salto, no una rodada. Muchos se equivocan aqui.',
    exito: 'El ultimo movimiento era un salto. Lo has visto antes de que pasara.',
    pistas: ['La ultima nube tiene una casilla: no se rueda.', 'Asi que la ultima decision es saltar.'],
    segmentos: [{ dir: 'derecha', nubes: [3, 2, 1, 3, 1] }],
    estrellas: 2,
  },
  {
    nombre: 'El mismo programa otra vez',
    instruccion:
      'Mira el tablero y luego mira el programa que escribiste en el pasillo anterior. Es el mismo. Solo cambia un numero. Eso es lo que has aprendido en este mundo.',
    exito:
      'Un programa que sirve para tableros que no has visto. A eso los mayores le llaman algoritmo, y tu acabas de escribir uno.',
    pistas: ['No hay nada nuevo. Rodar o saltar, repetido.', 'Solo tienes que contar bien.'],
    segmentos: [{ dir: 'derecha', nubes: [4, 1, 3, 2, 2] }],
    estrellas: 2,
  },
  {
    nombre: 'La esquina de la torre',
    instruccion:
      'Dos pasillos: uno a la derecha y otro hacia abajo. Cada pasillo necesita su propio bucle, y entre los dos una ficha de direccion para que el Fuzz mire hacia donde va a saltar.',
    exito:
      'Dos bucles y un giro. Si te hubieras olvidado del giro, la ficha de saltar habria saltado hacia la derecha desde la esquina. Al vacio.',
    pistas: [
      'Primero el bucle del pasillo de la derecha.',
      'Luego la ficha de bajar, y despues el bucle del pasillo de abajo.',
    ],
    segmentos: [
      { dir: 'derecha', nubes: [2, 1, 3, 2] },
      { dir: 'abajo', nubes: [3, 1, 3, 2] },
    ],
    estrellas: 2,
  },
  {
    nombre: 'Dos torres',
    instruccion:
      'Otra esquina, y los dos pasillos son largos. Cuenta las decisiones de cada uno por separado: son numeros distintos.',
    exito: 'Dos numeros distintos en dos bucles iguales. Ya no te lias.',
    pistas: ['Cuenta el primer pasillo entero antes de mirar el segundo.', 'La ficha de bajar cuenta como la primera decision del segundo.'],
    segmentos: [
      { dir: 'derecha', nubes: [3, 1, 2, 1, 3] },
      { dir: 'abajo', nubes: [2, 1, 3, 1, 2] },
    ],
    estrellas: 3,
  },
  {
    nombre: 'Bajar y seguir',
    instruccion: 'Ahora se baja primero y luego se sigue a la derecha. El orden de los bucles importa.',
    exito: 'Bajar primero y girar despues. El programa tiene que contar la misma historia que el tablero.',
    pistas: ['El primer bucle es el de bajar.', 'Luego la ficha de derecha y el segundo bucle.'],
    segmentos: [
      { dir: 'abajo', nubes: [2, 1, 2, 1, 2] },
      { dir: 'derecha', nubes: [3, 2, 1, 3] },
    ],
    estrellas: 2,
  },
  {
    nombre: 'Tres tramos',
    instruccion:
      'Tres pasillos, tres bucles, dos giros. Es el programa mas largo que has escrito, y cada trozo es una cosa que ya sabes hacer.',
    exito: 'Tres bucles seguidos sin equivocarte en ningun numero. Nimbo esta impresionado, y Nimbo duda de todo.',
    pistas: [
      'Haz un pasillo, comprueba, y despues el siguiente.',
      'Cada giro gasta la primera decision del pasillo que empieza.',
    ],
    segmentos: [
      { dir: 'derecha', nubes: [2, 1, 3] },
      { dir: 'abajo', nubes: [3, 1, 2, 2] },
      { dir: 'derecha', nubes: [2, 1, 3] },
    ],
    estrellas: 3,
  },
  {
    nombre: 'El pasillo del viento',
    instruccion:
      'Nimbo dice que este pasillo cambia de sitio con el viento y que nunca es igual dos veces. Exagera. Pero tu programa funcionaria igual si fuera verdad, y eso es lo bueno.',
    exito:
      'Tu programa no sabe donde estan los huecos y los cruza igual. Si manana el viento los mueve, seguira funcionando.',
    pistas: ['Once decisiones. Cuenta trozo por trozo.', 'Las nubes de una casilla no suman rodada.'],
    segmentos: [{ dir: 'derecha', nubes: [2, 1, 2, 1, 2, 1, 2, 2] }],
    estrellas: 3,
  },
  {
    nombre: 'La escalera de nubes',
    instruccion:
      'Baja, gira, baja otra vez. Tres tramos con huecos por todas partes. Este es el ultimo antes de llegar a Nimbo.',
    exito: 'Casi. Nimbo ya te ve desde la ventana y dice que no se lo esperaba de ti. Es un cumplido, en su idioma.',
    pistas: ['Un bucle por tramo y una ficha de giro entre cada dos.', 'Cuenta cada tramo por separado, sin prisa.'],
    segmentos: [
      { dir: 'abajo', nubes: [2, 1, 3] },
      { dir: 'derecha', nubes: [3, 1, 2, 2] },
      { dir: 'abajo', nubes: [2, 2, 3] },
    ],
    estrellas: 3,
  },
  {
    nombre: 'Donde esta Nimbo',
    instruccion:
      'Ultimo del castillo. Nimbo esta en la torre y lleva tres dias sin bajar porque no se decide. Ve a por el con un programa que decida por los dos.',
    exito:
      'Nimbo bajo sin pensarlo dos veces, y eso en el es historico. Por el camino me dijo una cosa: que la noche de la tormenta el viento venia de abajo. De abajo, dijo. Las tormentas no vienen de abajo.',
    pistas: [
      'Son tres tramos y cada uno tiene su numero de decisiones.',
      'Si te sobra una decision, el Fuzz salta al vacio. Si te falta, se queda a medias.',
    ],
    segmentos: [
      { dir: 'derecha', nubes: [2, 1, 3] },
      { dir: 'arriba', nubes: [3, 1, 2, 2] },
      { dir: 'derecha', nubes: [2, 1, 3, 2] },
    ],
    estrellas: 3,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 6,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const tablero = caminoDeNubes(receta.segmentos);

  return actividadExplorador(contexto, {
    plan: {
      tramos: tablero.tramos,
      agujeros: tablero.agujeros,
      estrellas: estrellasEn(tablero.firmes, receta.estrellas ?? 0),
    },
    comandos: COMANDOS,
    solucion: programaDeNubes(receta.segmentos, tablero.decisiones),
    exigeEstructuras: ['siSino'],
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 60 : undefined,
  });
});

export const mundo6: WorldContentFile = {
  mundo: 6,
  slug: 'castillo-de-nubes',
  nombre: 'El Castillo de Nubes',
  introTexto:
    'En el Castillo de Nubes el suelo no siempre esta. A veces hay nube y a veces hay aire, y desde arriba se parecen mucho. Por eso Nimbo mira antes de pisar, siempre, y por eso no se ha caido nunca. Aqui vas a escribir tu primer programa que decide solo, sin que tu sepas de antemano lo que va a hacer. Es raro la primera vez.',
  actividades,
};
