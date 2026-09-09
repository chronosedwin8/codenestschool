/**
 * Mundo 2: El Bosque Arcoíris. Condicionales de color.
 *
 * La idea que hay que hacer entender: una instrucción puede depender de algo que
 * el programa mira en ese momento, no solo de lo que el niño decidió antes.
 *
 * Cómo se enseña sin decirlo: las casillas donde el camino gira son rojas. Al
 * principio el niño puede resolverlo mirando el tablero y poniendo las flechas a
 * mano, y funciona. Pero a partir de la actividad ocho hay tantos giros que
 * ponerlos uno a uno se hace pesado, y la ficha "si es rojo, gira" resuelve todo
 * el camino de golpe. El descubrimiento llega por incomodidad, que es como llega
 * de verdad.
 *
 * Progresión:
 *   1-4    un solo giro, marcado en rojo. Se ve la regla.
 *   5-9    dos y tres giros. Empieza a cansar ponerlos a mano.
 *   10-14  aparece la ficha de color; el mismo camino con menos fichas.
 *   15-18  caminos donde solo la ficha de color es viable.
 *   19-20  dos colores distintos, cada uno con su regla.
 */
import {
  actividadExplorador,
  ir,
  siColor,
  t,
  type ContextoExplorador,
} from '../src/generadores-exploradores.js';
import type { ActivityDefinition, PasoPrograma, WorldContentFile } from '@codenest/shared';
import type { Tramo } from '../src/generadores.js';

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly tramos: readonly Tramo[];
  /** Color en el final de cada tramo. */
  readonly colores?: readonly (('rojo' | 'verde') | undefined)[];
  readonly estrellas?: readonly number[];
  readonly solucion: readonly PasoPrograma[];
  readonly comandos?: readonly string[];
  readonly maxFichas?: number;
  readonly exigeEstructuras?: readonly string[];
}

/** Direcciones básicas, disponibles en todo el mundo. */
const FLECHAS = ['derecha', 'izquierda', 'arriba', 'abajo'];
/** A partir de la actividad diez se desbloquea la ficha de color. */
const CON_COLOR = [...FLECHAS, 'siColor'];

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La casilla roja',
    instruccion:
      'Iris pinto de rojo todas las casillas donde hay que girar. Esta es la primera. Llega hasta ella y despues baja.',
    exito: 'Eso es. En el bosque de Iris, el rojo siempre significa gira.',
    pistas: [
      'Primero ve a la derecha hasta la casilla roja.',
      'Cuando estes en el rojo, baja.',
    ],
    tramos: [t('derecha', 3), t('abajo', 2)],
    colores: ['rojo', undefined],
    solucion: [ir('derecha'), ir('abajo')],
  },
  {
    nombre: 'Verde es seguir',
    instruccion:
      'Las verdes son distintas: en verde se sigue recto, no se gira. Este camino tiene una verde en medio y no cambia nada.',
    exito: 'Exacto. El verde no te pide nada, solo te deja pasar.',
    pistas: ['Sigue recto, el verde no te hace girar.', 'Una sola flecha basta.'],
    tramos: [t('derecha', 4)],
    colores: ['verde'],
    solucion: [ir('derecha')],
  },
  {
    nombre: 'Roja arriba',
    instruccion: 'Otra roja, pero esta vez el camino sube. El color dice gira, tu decides hacia donde.',
    exito: 'Muy bien. El rojo dice que gires; mirar el camino te dice hacia que lado.',
    pistas: ['Ve a la derecha hasta el rojo.', 'Desde el rojo, el camino sube.'],
    tramos: [t('derecha', 3), t('arriba', 3)],
    colores: ['rojo', undefined],
    solucion: [ir('derecha'), ir('arriba')],
  },
  {
    nombre: 'Dos colores',
    instruccion: 'Aqui hay una verde y una roja. Fijate bien en cual es cual antes de poner nada.',
    exito: 'Los distinguiste. Verde sigue, rojo gira: ya no se te olvida.',
    pistas: ['La verde no te hace girar.', 'La roja si: cuando llegues a ella, baja.'],
    tramos: [t('derecha', 4), t('abajo', 2)],
    colores: ['rojo', undefined],
    estrellas: [2],
    solucion: [ir('derecha'), ir('abajo')],
  },
  {
    nombre: 'Dos giros',
    instruccion: 'Dos casillas rojas en el mismo camino. Dos giros. Ve una por una.',
    exito: 'Dos giros seguidos y ni un fallo.',
    pistas: ['Primero derecha hasta la primera roja.', 'Baja, y en la segunda roja gira otra vez.'],
    tramos: [t('derecha', 3), t('abajo', 2), t('derecha', 3)],
    colores: ['rojo', 'rojo', undefined],
    estrellas: [3],
    solucion: [ir('derecha'), ir('abajo'), ir('derecha')],
  },
  {
    nombre: 'El zigzag de colores',
    instruccion: 'Tres rojas, tres giros. Sigue el camino con el dedo antes de empezar.',
    exito: 'Un zigzag entero leyendo los colores. Iris estaria orgullosa.',
    pistas: ['Cuenta las casillas rojas: son tres.', 'Cada roja es un giro, asi que necesitas cuatro flechas.'],
    tramos: [t('derecha', 2), t('abajo', 2), t('derecha', 2), t('abajo', 2)],
    colores: ['rojo', 'rojo', 'rojo', undefined],
    estrellas: [2, 6],
    solucion: [ir('derecha'), ir('abajo'), ir('derecha'), ir('abajo')],
  },
  {
    nombre: 'Sube y baja',
    instruccion: 'El camino sube y luego baja. Las rojas te avisan de donde cambia.',
    exito: 'Perfecto. Ya lees el bosque como Iris.',
    pistas: ['Sube hasta la primera roja.', 'Luego derecha, y en la siguiente roja baja.'],
    tramos: [t('arriba', 2), t('derecha', 3), t('abajo', 3)],
    colores: ['rojo', 'rojo', undefined],
    estrellas: [3],
    solucion: [ir('arriba'), ir('derecha'), ir('abajo')],
  },
  {
    nombre: 'Cuatro giros',
    instruccion:
      'Este camino tiene cuatro rojas. Cuatro giros y cinco flechas. Empieza a ser mucho, verdad?',
    exito: 'Cinco fichas. Funciona, pero seguro que se puede hacer mas corto. Ya lo veras.',
    pistas: ['Cuatro rojas son cuatro giros.', 'Necesitas cinco flechas en total.'],
    tramos: [t('derecha', 2), t('abajo', 2), t('derecha', 2), t('arriba', 2), t('derecha', 2)],
    colores: ['rojo', 'rojo', 'rojo', 'rojo', undefined],
    estrellas: [3, 7],
    solucion: [ir('derecha'), ir('abajo'), ir('derecha'), ir('arriba'), ir('derecha')],
  },
  {
    nombre: 'El camino largo',
    instruccion:
      'Cinco rojas. Seis flechas. Ponlas todas si quieres, pero fijate en que siempre haces lo mismo: llegar al rojo y girar.',
    exito: 'Seis fichas para hacer siempre lo mismo. Manana Iris te ensenara algo mejor.',
    pistas: ['Cada roja es un giro. Son cinco.', 'Mira el patron: siempre llegas al rojo y giras.'],
    tramos: [
      t('derecha', 2),
      t('abajo', 2),
      t('derecha', 2),
      t('abajo', 2),
      t('derecha', 2),
      t('abajo', 2),
    ],
    colores: ['rojo', 'rojo', 'rojo', 'rojo', 'rojo', undefined],
    estrellas: [4, 8],
    solucion: [
      ir('derecha'),
      ir('abajo'),
      ir('derecha'),
      ir('abajo'),
      ir('derecha'),
      ir('abajo'),
    ],
  },
  {
    nombre: 'La ficha nueva',
    instruccion:
      'Mira lo que te ha dejado Iris: una ficha que dice si la casilla es roja, gira. Ponla dentro y usala aqui.',
    exito: 'Esa ficha piensa por ti. Ella mira el color y decide, tu ya no tienes que estar pendiente.',
    pistas: [
      'La ficha nueva es la de color: si es roja, hace lo que le pongas dentro.',
      'Pon una flecha de abajo dentro de la ficha de color.',
    ],
    tramos: [t('derecha', 3), t('abajo', 3)],
    colores: ['rojo', undefined],
    comandos: CON_COLOR,
    solucion: [ir('derecha'), siColor('rojo', [ir('abajo')])],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'Con menos fichas',
    instruccion:
      'Este camino es el mismo que hiciste con cinco flechas. Ahora hazlo con la ficha de color y cuenta cuantas te sobran.',
    exito: 'Menos fichas, mismo camino. Eso es programar mejor, no solo programar.',
    pistas: ['Usa la ficha de color para los giros.', 'Dentro de la ficha va la flecha del giro.'],
    tramos: [t('derecha', 2), t('abajo', 2), t('derecha', 2)],
    colores: ['rojo', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [3],
    solucion: [ir('derecha'), siColor('rojo', [ir('abajo')]), siColor('rojo', [ir('derecha')])],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'El bosque decide',
    instruccion:
      'Aqui no puedes saber de antemano donde estan las rojas sin mirar mucho. Deja que la ficha de color lo mire por ti.',
    exito: 'Ya no miras tu el color: lo mira el programa. Eso cambia todo.',
    pistas: ['Empieza yendo a la derecha.', 'Luego deja que la ficha de color decida el giro.'],
    tramos: [t('derecha', 3), t('abajo', 2), t('izquierda', 3)],
    colores: ['rojo', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [3, 6],
    solucion: [ir('derecha'), siColor('rojo', [ir('abajo')]), siColor('rojo', [ir('izquierda')])],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'Verde tambien manda',
    instruccion:
      'Esta vez la ficha mira el verde. Si es verde, sigue recto. Es la misma idea al reves.',
    exito: 'Da igual el color: la ficha mira, compara y decide. Siempre igual.',
    pistas: ['Cambia el color de la ficha a verde.', 'En verde, sigue en la misma direccion.'],
    tramos: [t('derecha', 2), t('derecha', 2), t('abajo', 2)],
    colores: ['verde', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [3],
    solucion: [ir('derecha'), siColor('rojo', [ir('abajo')])],
    maxFichas: 3,
  },
  {
    nombre: 'La curva doble',
    instruccion: 'Dos giros seguidos hacia el mismo lado. La ficha de color se encarga de los dos.',
    exito: 'Los dos giros con la misma idea. Ya piensas en reglas, no en pasos.',
    pistas: ['Los dos giros van hacia abajo.', 'Necesitas la ficha de color dos veces.'],
    tramos: [t('derecha', 2), t('abajo', 2), t('izquierda', 2), t('abajo', 2)],
    colores: ['rojo', 'rojo', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [2, 6],
    solucion: [
      ir('derecha'),
      siColor('rojo', [ir('abajo')]),
      siColor('rojo', [ir('izquierda')]),
      siColor('rojo', [ir('abajo')]),
    ],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'Sin mirar el tablero',
    instruccion:
      'Iris te reta: haz este camino pensando solo en la regla, no en el dibujo. Si es rojo, gira. Punto.',
    exito: 'Lo hiciste con la regla, no con los ojos. Asi funcionan los programas de verdad.',
    pistas: ['No cuentes casillas: piensa en la regla.', 'Cada roja es un giro, y la ficha lo sabe.'],
    tramos: [t('derecha', 3), t('arriba', 2), t('derecha', 2), t('abajo', 3)],
    colores: ['rojo', 'rojo', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [3, 8],
    solucion: [
      ir('derecha'),
      siColor('rojo', [ir('arriba')]),
      siColor('rojo', [ir('derecha')]),
      siColor('rojo', [ir('abajo')]),
    ],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'El laberinto de Iris',
    instruccion: 'Cinco giros. Con flechas sueltas serian seis fichas. Con la regla, menos.',
    exito: 'Cinco giros resueltos con una idea repetida. Eso es elegante.',
    pistas: ['Son cinco rojas.', 'La ficha de color en cada giro, con la flecha correcta dentro.'],
    tramos: [
      t('derecha', 2),
      t('abajo', 2),
      t('derecha', 2),
      t('arriba', 2),
      t('derecha', 2),
      t('abajo', 2),
    ],
    colores: ['rojo', 'rojo', 'rojo', 'rojo', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [3, 7, 11],
    solucion: [
      ir('derecha'),
      siColor('rojo', [ir('abajo')]),
      siColor('rojo', [ir('derecha')]),
      siColor('rojo', [ir('arriba')]),
      siColor('rojo', [ir('derecha')]),
      siColor('rojo', [ir('abajo')]),
    ],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'Rojo y verde juntos',
    instruccion:
      'Ahora hay de los dos. Las rojas giran y las verdes se dejan pasar. Tu programa tiene que distinguirlas.',
    exito: 'Distinguir dos casos con la misma ficha. Ya sabes hacer que un programa piense.',
    pistas: ['Las verdes no piden nada.', 'Solo pon fichas de color para las rojas.'],
    tramos: [t('derecha', 2), t('derecha', 2), t('abajo', 3)],
    colores: ['verde', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [2, 5],
    solucion: [ir('derecha'), siColor('rojo', [ir('abajo')])],
    maxFichas: 3,
  },
  {
    nombre: 'La regla completa',
    instruccion:
      'Camino largo, con verdes por medio para despistarte. Confia en la regla y no en lo que ves.',
    exito: 'Ni una duda. Iris dice que ya sabes leer su bosque mejor que ella.',
    pistas: ['Las verdes estan para despistar: no hacen nada.', 'Solo cuentan las rojas.'],
    tramos: [t('derecha', 2), t('abajo', 2), t('derecha', 3), t('abajo', 2)],
    colores: ['rojo', 'verde', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [2, 7],
    solucion: [ir('derecha'), siColor('rojo', [ir('abajo')]), ir('derecha'), siColor('rojo', [ir('abajo')])],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'El camino de Iris',
    instruccion:
      'Este es el camino que Iris hace cada manana para pintar el bosque. Seis giros. Ella lo hace sin pensar.',
    exito: 'El camino entero de Iris. Ya puedes ir a buscarla.',
    pistas: ['Seis rojas, seis giros.', 'Una ficha de color por giro y una flecha para empezar.'],
    tramos: [
      t('derecha', 2),
      t('abajo', 2),
      t('izquierda', 2),
      t('abajo', 2),
      t('derecha', 3),
      t('abajo', 2),
    ],
    colores: ['rojo', 'rojo', 'rojo', 'rojo', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [3, 7, 11],
    solucion: [
      ir('derecha'),
      siColor('rojo', [ir('abajo')]),
      siColor('rojo', [ir('izquierda')]),
      siColor('rojo', [ir('abajo')]),
      siColor('rojo', [ir('derecha')]),
      siColor('rojo', [ir('abajo')]),
    ],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'Donde esta Iris',
    instruccion:
      'Ultimo del bosque. Iris esta al final de este camino, y lleva mucho tiempo sola. Traela.',
    exito:
      'La encontraste. Iris dice que nunca habia visto a nadie leer sus colores tan rapido.',
    pistas: [
      'Usa todo lo que has aprendido: la regla del rojo y las flechas.',
      'Son siete giros. Ve tramo a tramo sin prisa.',
    ],
    tramos: [
      t('derecha', 3),
      t('arriba', 2),
      t('derecha', 2),
      t('abajo', 3),
      t('derecha', 2),
      t('abajo', 2),
      t('izquierda', 3),
    ],
    colores: ['rojo', 'rojo', 'rojo', 'rojo', 'rojo', 'rojo', undefined],
    comandos: CON_COLOR,
    estrellas: [3, 8, 13],
    solucion: [
      ir('derecha'),
      siColor('rojo', [ir('arriba')]),
      siColor('rojo', [ir('derecha')]),
      siColor('rojo', [ir('abajo')]),
      siColor('rojo', [ir('derecha')]),
      siColor('rojo', [ir('abajo')]),
      siColor('rojo', [ir('izquierda')]),
    ],
    exigeEstructuras: ['siColor'],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 2,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  return actividadExplorador(contexto, {
    plan: {
      tramos: receta.tramos,
      coloresDeGiro: receta.colores,
      ...(receta.estrellas ? { estrellas: receta.estrellas } : {}),
    },
    comandos: receta.comandos ?? FLECHAS,
    solucion: receta.solucion,
    ...(receta.maxFichas ? { maxFichas: receta.maxFichas } : {}),
    ...(receta.exigeEstructuras ? { exigeEstructuras: receta.exigeEstructuras } : {}),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 45 : undefined,
  });
});

export const mundo2: WorldContentFile = {
  mundo: 2,
  slug: 'bosque-arcoiris',
  nombre: 'El Bosque Arcoiris',
  introTexto:
    'El Bosque Arcoiris lo pinto Iris ella sola, y le llevo cuatrocientos anos. Aqui cada color manda una cosa: en las casillas rojas se gira y en las verdes se sigue. Aprende a leer los colores y el bosque entero se abre.',
  actividades,
};
