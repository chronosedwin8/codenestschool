/**
 * Mundo 5: El Oasis Dulce. El orden importa.
 *
 * Los cuatro mundos anteriores tenían una sola respuesta: el camino era el
 * camino. Aquí hay varias formas de llegar y no todas valen, porque Mango come
 * en un orden y solo en ese. Es la primera vez que el niño tiene que elegir.
 *
 * El problema de diseño fue geométrico. En el modo rodar el Fuzz no se para
 * donde quiere: avanza hasta que se acaba el camino. Sobre un camino abierto eso
 * significa que el orden de recogida lo decide el tablero, no el niño, y la
 * actividad no enseña nada.
 *
 * La solución son tableros con ciclos. En un anillo, desde cada esquina se puede
 * ir a dos sitios, así que dar la vuelta en un sentido o en el otro recoge la
 * fruta en órdenes distintos. Y la salida está detrás de un hueco: para salir
 * hay que volver a una esquina concreta y saltar desde ahí. Eso convierte "por
 * dónde empiezo" en una decisión con consecuencias.
 *
 * Progresión:
 *   1-2    dos frutas en un camino recto. El orden ya se mide, pero no se elige.
 *   3-5    dos brazos y una sola salida. La primera elección de verdad.
 *   6-11   anillos. Dar la vuelta por la izquierda o por la derecha.
 *   12-16  anillos grandes, tres frutas, y la salida cambia de esquina.
 *   17-20  árboles de tres ramas: más órdenes posibles y solo uno barato.
 *
 * La tercera estrella es la que exige el orden. Un niño que recoge las tres
 * frutas en el orden equivocado se lleva dos: ha resuelto el laberinto y ha
 * fallado la receta, y eso no es lo mismo que no hacer nada.
 */
import {
  actividadExplorador,
  ir,
  saltar,
  t,
  type ContextoExplorador,
  type ObjetoEnCamino,
} from '../src/generadores-exploradores.js';
import type { Tramo } from '../src/generadores.js';
import type {
  ActivityDefinition,
  ColorCasilla,
  Objetivo,
  PasoPrograma,
  WorldContentFile,
} from '@codenest/shared';

const COMANDOS = ['derecha', 'izquierda', 'arriba', 'abajo', 'saltar', 'repetir'];

/** Las frutas del oasis, con el color que las identifica en el tablero. */
const FRUTAS: Readonly<Record<string, ColorCasilla>> = {
  amarilla: 'amarillo',
  naranja: 'naranja',
  roja: 'rojo',
  verde: 'verde',
};

/** Un tablero: por dónde se puede andar y en qué casilla para el Fuzz. */
interface Tablero {
  readonly tramos: readonly Tramo[];
  readonly agujeros: readonly number[];
  /** Índices del recorrido donde el Fuzz se detiene. Ahí va la fruta. */
  readonly paradas: readonly number[];
}

/**
 * Camino recto que gira una vez. No hay nada que elegir: sirve para presentar
 * la idea de que el orden se mide.
 */
function codo(largo: number, alto: number): Tablero {
  return {
    tramos: [t('derecha', largo), t('abajo', alto)],
    agujeros: [],
    paradas: [largo, largo + alto],
  };
}

/**
 * Dos brazos que salen de la casilla de partida, y la salida al final de uno de
 * ellos, detrás de un hueco.
 *
 * El Fuzz puede entrar en un brazo y volver, porque al rodar de vuelta se para
 * en la esquina: el brazo contrario no continúa en esa dirección. Es la forma
 * más pequeña que permite elegir por dónde empezar.
 */
function dosBrazos(brazo: number, otro: number): Tablero {
  return {
    // Bajar, volver a subir, y salir por la derecha saltando el hueco.
    tramos: [t('abajo', otro), t('arriba', otro), t('derecha', brazo + 2)],
    agujeros: [2 * otro + brazo + 1],
    paradas: [otro, 2 * otro + brazo],
  };
}

/**
 * Anillo rectangular con la salida detrás de un hueco.
 *
 * Las cuatro esquinas son los únicos sitios donde el Fuzz se detiene, y desde
 * cada una se llega a las dos vecinas. Con la salida pasada la esquina de arriba
 * a la derecha, para salir hay que llegar a esa esquina rodando hacia la derecha
 * y saltar. Eso obliga a planear la vuelta entera, no solo el primer paso.
 */
function anilloDerecha(ancho: number, alto: number): Tablero {
  const A = 0;
  const B = ancho;
  const C = ancho + alto;
  const D = 2 * ancho + alto;
  const vuelta = 2 * ancho + 2 * alto;
  return {
    tramos: [
      t('derecha', ancho),
      t('abajo', alto),
      t('izquierda', ancho),
      t('arriba', alto),
      // Se vuelve a recorrer el borde de arriba para dejar el hueco y la meta.
      t('derecha', ancho + 2),
    ],
    agujeros: [vuelta + ancho + 1],
    paradas: [A, B, C, D],
  };
}

/** El mismo anillo, con la salida pasada la esquina de abajo a la derecha. */
function anilloAbajo(ancho: number, alto: number): Tablero {
  const B = ancho;
  const C = ancho + alto;
  const D = 2 * ancho + alto;
  const vuelta = 2 * ancho + 2 * alto;
  return {
    tramos: [
      t('derecha', ancho),
      t('abajo', alto),
      t('izquierda', ancho),
      t('arriba', alto),
      t('derecha', ancho),
      t('abajo', alto + 2),
    ],
    agujeros: [vuelta + ancho + alto + 1],
    paradas: [0, B, C, D],
  };
}

/**
 * Tres ramas: una a la derecha que se dobla hacia abajo, y otra hacia abajo con
 * la salida al final.
 *
 * Tiene una parada más que el anillo y ninguna forma de atajar, así que los
 * órdenes posibles cuestan números de fichas muy distintos. Es el cierre del
 * mundo.
 */
function arbol(rama: number, codoRama: number, bajada: number): Tablero {
  const P1 = rama;
  const P2 = rama + codoRama;
  const vuelta = 2 * rama + 2 * codoRama;
  const P3 = vuelta + bajada;
  return {
    tramos: [
      t('derecha', rama),
      t('abajo', codoRama),
      t('arriba', codoRama),
      t('izquierda', rama),
      t('abajo', bajada + 2),
    ],
    agujeros: [P3 + 1],
    paradas: [P1, P2, P3],
  };
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly tablero: Tablero;
  /** Fruta en cada parada: la posición en la lista es la parada. */
  readonly frutas: readonly (keyof typeof FRUTAS | null)[];
  /** Orden en que Mango exige comerlas. */
  readonly orden: readonly (keyof typeof FRUTAS)[];
  readonly solucion: readonly PasoPrograma[];
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Primero la amarilla',
    instruccion:
      'Mango tiene hambre y tiene reglas. Come primero la amarilla y despues la naranja, nunca al reves. Hoy el camino te lo pone facil: solo hay uno.',
    exito: 'Amarilla y luego naranja. Mango ha comido y ya esta pensando en la siguiente.',
    pistas: ['Rueda a la derecha y luego baja.', 'Las frutas ya estan en el orden correcto.'],
    tablero: codo(4, 3),
    frutas: ['amarilla', 'naranja'],
    orden: ['amarilla', 'naranja'],
    solucion: [ir('derecha'), ir('abajo')],
  },
  {
    nombre: 'Tres en fila',
    instruccion:
      'Tres frutas: amarilla, naranja y roja. Ese es el orden de Mango y no cambia nunca. Mira si el camino te lo respeta.',
    exito: 'Las tres en su orden. Mango dice que hoy comes con el.',
    pistas: ['El camino baja, gira y vuelve a bajar.', 'Las frutas estan puestas en el orden bueno.'],
    tablero: {
      tramos: [t('abajo', 3), t('derecha', 3), t('abajo', 3)],
      agujeros: [],
      paradas: [3, 6, 9],
    },
    frutas: ['amarilla', 'naranja', 'roja'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [ir('abajo'), ir('derecha'), ir('abajo')],
  },
  {
    nombre: 'Dos caminos, uno bueno',
    instruccion:
      'Ahora si hay que elegir. Una fruta abajo y otra a la derecha, y la salida esta al fondo del camino de la derecha, detras de un hueco. Cual coges primero?',
    exito:
      'La de abajo primero, porque a la de la derecha se llega justo antes de salir. Has pensado el final antes del principio.',
    pistas: [
      'Si vas primero a la derecha, tendras que volver, y eso son fichas de mas.',
      'Baja, vuelve a subir, y sal por la derecha saltando el hueco.',
    ],
    tablero: dosBrazos(3, 3),
    frutas: ['naranja', 'roja'],
    orden: ['naranja', 'roja'],
    solucion: [ir('abajo'), ir('arriba'), ir('derecha'), saltar()],
  },
  {
    nombre: 'La salida esta abajo',
    instruccion:
      'El mismo oasis del reves. Ahora el hueco y la salida estan abajo. Piensa por donde tienes que salir antes de decidir por donde entras.',
    exito: 'Cuando cambia la salida, cambia el orden. El final manda sobre el principio.',
    pistas: [
      'La salida esta al fondo del camino de abajo.',
      'Asi que la fruta de la derecha tiene que ser la primera.',
    ],
    tablero: {
      tramos: [t('derecha', 3), t('izquierda', 3), t('abajo', 5)],
      agujeros: [10],
      paradas: [3, 9],
    },
    frutas: ['amarilla', 'naranja'],
    orden: ['amarilla', 'naranja'],
    solucion: [ir('derecha'), ir('izquierda'), ir('abajo'), saltar()],
  },
  {
    nombre: 'El camino largo',
    instruccion:
      'Atencion a este. Mango quiere la roja primero, y la roja esta justo al lado de la salida. Vas a tener que ir, volver, y volver otra vez. A veces el camino correcto es el largo.',
    exito:
      'Seis fichas cuando cuatro parecian suficientes. Has hecho lo que pedia Mango y no lo que era comodo.',
    pistas: [
      'Ve primero a la derecha por la roja, aunque tengas que volver.',
      'Luego baja por la naranja, sube, y sal por la derecha.',
    ],
    tablero: dosBrazos(3, 3),
    frutas: ['naranja', 'roja'],
    orden: ['roja', 'naranja'],
    solucion: [ir('derecha'), ir('izquierda'), ir('abajo'), ir('arriba'), ir('derecha'), saltar()],
  },
  {
    nombre: 'La vuelta al oasis',
    instruccion:
      'Esto es un anillo: se puede dar la vuelta entera. La salida esta arriba a la derecha, pasado el hueco. Hay dos formas de recorrerlo, y las frutas te dicen cual.',
    exito: 'Has dado la vuelta por donde tocaba. Un anillo tiene dos sentidos y solo uno servia.',
    pistas: [
      'Baja primero por el lado izquierdo del anillo.',
      'Da la vuelta entera y sal por arriba a la derecha.',
    ],
    tablero: anilloDerecha(4, 3),
    frutas: [null, null, 'naranja', 'amarilla'],
    orden: ['amarilla', 'naranja'],
    solucion: [ir('abajo'), ir('derecha'), ir('arriba'), ir('izquierda'), ir('derecha'), saltar()],
  },
  {
    nombre: 'Por el otro lado',
    instruccion:
      'El mismo anillo y las mismas frutas, pero Mango las quiere al contrario. Da la vuelta al reves.',
    exito: 'Mismo tablero, orden distinto, camino distinto. El anillo no ha cambiado: has cambiado tu.',
    pistas: ['Empieza rodando a la derecha por arriba.', 'Sigue dando la vuelta hasta volver arriba.'],
    tablero: anilloDerecha(4, 3),
    frutas: [null, null, 'naranja', 'amarilla'],
    orden: ['naranja', 'amarilla'],
    solucion: [ir('derecha'), ir('abajo'), ir('izquierda'), ir('arriba'), ir('derecha'), saltar()],
  },
  {
    nombre: 'La fruta de la esquina',
    instruccion:
      'Dos frutas y un atajo. Una esta en la esquina de al lado de la salida, y a esa se llega al final. La otra esta abajo a la izquierda.',
    exito: 'Cuatro fichas. Has encontrado el atajo, y el atajo respetaba el orden.',
    pistas: [
      'Baja por la izquierda, coge la fruta de abajo y vuelve a subir.',
      'La otra fruta esta justo antes del hueco.',
    ],
    tablero: anilloDerecha(4, 3),
    frutas: [null, 'roja', null, 'amarilla'],
    orden: ['amarilla', 'roja'],
    solucion: [ir('abajo'), ir('arriba'), ir('derecha'), saltar()],
  },
  {
    nombre: 'Tres frutas y una vuelta',
    instruccion:
      'Las tres frutas en tres esquinas. Amarilla, naranja y roja, en ese orden. Mira donde esta cada una antes de mover una sola ficha.',
    exito: 'Tres frutas, tres esquinas, una sola vuelta. Ni una ficha de sobra.',
    pistas: [
      'Empieza rodando a la derecha por el borde de arriba.',
      'Da la vuelta completa y vuelve a la esquina de la salida.',
    ],
    tablero: anilloDerecha(4, 3),
    frutas: [null, 'amarilla', 'naranja', 'roja'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [ir('derecha'), ir('abajo'), ir('izquierda'), ir('arriba'), ir('derecha'), saltar()],
  },
  {
    nombre: 'Al contrario',
    instruccion:
      'El mismo anillo, y ahora Mango quiere empezar por la que esta abajo a la izquierda. Todo al reves.',
    exito: 'La vuelta entera en el otro sentido. Ya sabes leer un anillo en las dos direcciones.',
    pistas: ['Baja primero por el borde izquierdo.', 'Y sal por arriba a la derecha, como siempre.'],
    tablero: anilloDerecha(4, 3),
    frutas: [null, 'roja', 'naranja', 'amarilla'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [ir('abajo'), ir('derecha'), ir('arriba'), ir('izquierda'), ir('derecha'), saltar()],
  },
  {
    nombre: 'Un anillo mas grande',
    instruccion: 'Anillo grande, tres frutas. El tamano no cambia nada: lo que cuenta son las esquinas.',
    exito: 'Un anillo grande se recorre igual que uno pequeno. Las esquinas son las mismas cuatro.',
    pistas: ['Las esquinas son las unicas casillas donde el Fuzz se para.', 'Da la vuelta en el sentido que pide el orden.'],
    tablero: anilloDerecha(6, 4),
    frutas: [null, 'amarilla', 'naranja', 'roja'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [ir('derecha'), ir('abajo'), ir('izquierda'), ir('arriba'), ir('derecha'), saltar()],
  },
  {
    nombre: 'La salida cambia de sitio',
    instruccion:
      'Cuidado, mira bien: el hueco ya no esta arriba. Esta abajo a la derecha. Para salir tienes que llegar a esa esquina bajando.',
    exito:
      'Has salido por abajo. Cuando la salida se mueve, el plan entero se mueve con ella.',
    pistas: [
      'Tienes que acabar en la esquina de abajo a la derecha, y llegar a ella bajando.',
      'Baja primero por la izquierda para coger la fruta de abajo.',
    ],
    tablero: anilloAbajo(4, 3),
    frutas: [null, 'roja', 'naranja', 'amarilla'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [ir('abajo'), ir('derecha'), ir('arriba'), ir('abajo'), saltar()],
  },
  {
    nombre: 'Cinco fichas justas',
    instruccion:
      'La salida sigue abajo a la derecha. Tres frutas otra vez, y Mango tiene prisa: esto se hace en cinco fichas.',
    exito: 'Cinco. Ni una mas. Has encontrado el camino que no repite nada.',
    pistas: [
      'La ultima ficha es el salto, y la anterior tiene que ser bajar.',
      'Empieza por abajo a la izquierda y ve hacia la derecha.',
    ],
    tablero: anilloAbajo(5, 3),
    frutas: [null, 'roja', 'naranja', 'amarilla'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [ir('abajo'), ir('derecha'), ir('arriba'), ir('abajo'), saltar()],
  },
  {
    nombre: 'La roja primero',
    instruccion:
      'Mango ha cambiado de gusto y hoy quiere la roja primero. La roja esta arriba a la derecha, justo donde empieza todo.',
    exito: 'Empezar por la esquina de al lado y acabar volviendo a ella. Eso es dar la vuelta con cabeza.',
    pistas: ['Ve primero a la derecha por arriba.', 'Luego da la vuelta y vuelve a esa misma esquina.'],
    tablero: anilloAbajo(4, 3),
    frutas: [null, 'roja', 'amarilla', 'naranja'],
    orden: ['roja', 'amarilla', 'naranja'],
    solucion: [
      ir('derecha'),
      ir('abajo'),
      ir('izquierda'),
      ir('arriba'),
      ir('derecha'),
      ir('abajo'),
      saltar(),
    ],
  },
  {
    nombre: 'Cuatro frutas',
    instruccion:
      'Cuatro frutas y cuatro esquinas: amarilla, naranja, roja y verde. Una vuelta entera y ni un paso de mas. Puedes hacerlo?',
    exito: 'Las cuatro esquinas en una sola vuelta. Este es de los que se cuentan en casa.',
    pistas: [
      'Si el orden coincide con el sentido de la vuelta, no hace falta volver nunca.',
      'Empieza a la derecha por arriba y no cambies de sentido.',
    ],
    tablero: anilloAbajo(5, 4),
    frutas: ['verde', 'amarilla', 'naranja', 'roja'],
    orden: ['amarilla', 'naranja', 'roja', 'verde'],
    solucion: [
      ir('derecha'),
      ir('abajo'),
      ir('izquierda'),
      ir('arriba'),
      ir('derecha'),
      ir('abajo'),
      saltar(),
    ],
  },
  {
    nombre: 'La fruta que se recoge al volver',
    instruccion:
      'Fijate en la fruta verde: esta en la casilla donde empiezas. No la coges ahora, la coges cuando vuelvas. Y tienes que volver.',
    exito:
      'La fruta de debajo de tus pies era la ultima. Nadie mira nunca donde esta parado.',
    pistas: [
      'La verde esta en tu casilla, pero no cuenta hasta que vuelvas a pisarla.',
      'Da la vuelta al anillo entero y pasa otra vez por donde empezaste.',
    ],
    tablero: anilloAbajo(4, 3),
    frutas: ['verde', 'amarilla', 'naranja', 'roja'],
    orden: ['amarilla', 'naranja', 'roja', 'verde'],
    solucion: [
      ir('derecha'),
      ir('abajo'),
      ir('izquierda'),
      ir('arriba'),
      ir('derecha'),
      ir('abajo'),
      saltar(),
    ],
  },
  {
    nombre: 'Tres ramas',
    instruccion:
      'Esto ya no es un anillo. Son tres ramas, y desde el final de una no se puede pasar a otra: hay que volver siempre al centro. La salida esta al fondo de la rama de abajo.',
    exito: 'Tres ramas y una sola salida. Volver al centro cada vez cuesta fichas, y no habia otra.',
    pistas: [
      'Entra en la rama de la derecha, baja hasta el fondo y vuelve.',
      'Deja la rama de abajo para el final: la salida esta ahi.',
    ],
    tablero: arbol(3, 3, 3),
    frutas: ['amarilla', 'naranja', 'roja'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [
      ir('derecha'),
      ir('abajo'),
      ir('arriba'),
      ir('izquierda'),
      ir('abajo'),
      saltar(),
    ],
  },
  {
    nombre: 'El fondo de la rama',
    instruccion:
      'La fruta que Mango quiere primero esta en el sitio mas escondido del oasis: al fondo de la rama que se dobla. Ve por ella.',
    exito: 'Del rincon mas lejano al primero de la lista. Has ido a buscarla sin quejarte.',
    pistas: [
      'Entra a la derecha y baja hasta el fondo de esa rama.',
      'Luego vuelve arriba, al centro, y baja por la otra rama.',
    ],
    tablero: arbol(3, 4, 3),
    frutas: [null, 'amarilla', 'naranja'],
    orden: ['amarilla', 'naranja'],
    solucion: [ir('derecha'), ir('abajo'), ir('arriba'), ir('izquierda'), ir('abajo'), saltar()],
  },
  {
    nombre: 'Volver dos veces',
    instruccion:
      'Mango quiere la de la salida primero. Eso significa bajar, volver a subir, dar toda la vuelta por la otra rama, y bajar otra vez. Ocho fichas. Cuentalas.',
    exito:
      'Ocho fichas y ni una perdida. Cuando el orden pelea contra el camino, gana el orden.',
    pistas: [
      'Baja primero por la rama de la salida, pero no saltes todavia.',
      'Sube, ve a la rama de la derecha, y vuelve para saltar al final.',
    ],
    tablero: arbol(3, 3, 3),
    frutas: ['naranja', 'roja', 'amarilla'],
    orden: ['amarilla', 'naranja', 'roja'],
    solucion: [
      ir('abajo'),
      ir('arriba'),
      ir('derecha'),
      ir('abajo'),
      ir('arriba'),
      ir('izquierda'),
      ir('abajo'),
      saltar(),
    ],
  },
  {
    nombre: 'Donde esta Mango',
    instruccion:
      'Ultimo del oasis. Mango esta al fondo de la rama de abajo, sentado encima de la fruta roja. Se la come en cuanto llegues, y entonces pedira la amarilla y despues la verde. Y tendras que volver hasta el. Ocho fichas.',
    exito:
      'Mango se ha comido las tres y ha dicho que le sobra sitio. Cuando le pregunte si vio algo raro la noche de la tormenta, dijo que estaba comiendo. Pero se quedo callado un rato.',
    pistas: [
      'Baja primero hasta Mango por la roja, pero no saltes todavia.',
      'La amarilla esta en la rama de la derecha y la verde al fondo de esa rama.',
    ],
    tablero: arbol(4, 3, 4),
    frutas: ['amarilla', 'verde', 'roja'],
    orden: ['roja', 'amarilla', 'verde'],
    solucion: [
      ir('abajo'),
      ir('arriba'),
      ir('derecha'),
      ir('abajo'),
      ir('arriba'),
      ir('izquierda'),
      ir('abajo'),
      saltar(),
    ],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 5,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const objetos: ObjetoEnCamino[] = [];
  receta.frutas.forEach((fruta, i) => {
    const parada = receta.tablero.paradas[i];
    if (fruta && parada !== undefined) {
      objetos.push({ indice: parada, id: fruta, tipo: 'gema', color: FRUTAS[fruta]! });
    }
  });

  const orden: Objetivo = {
    id: 'orden',
    tipo: 'orden_recoleccion',
    orden: [...receta.orden],
    obligatorio: false,
  };

  return actividadExplorador(contexto, {
    plan: {
      tramos: receta.tablero.tramos,
      agujeros: receta.tablero.agujeros,
      objetos,
    },
    comandos: COMANDOS,
    solucion: receta.solucion,
    objetivosTercera: [orden],
    tipo: indice === 19 ? 'integrador' : 'recoleccion',
    monedas: indice === 19 ? 55 : undefined,
  });
});

export const mundo5: WorldContentFile = {
  mundo: 5,
  slug: 'oasis-dulce',
  nombre: 'El Oasis Dulce',
  introTexto:
    'Mango cayo en el Oasis Dulce, encima de la fruta, que es exactamente donde el habria elegido caer. El problema es que Mango solo come en su orden: primero la amarilla, luego la naranja y al final la roja. Si te equivocas no se mueve. Aqui los caminos dan la vuelta y hay mas de una forma de llegar, asi que por primera vez no basta con encontrar el camino. Hay que elegir el bueno.',
  actividades,
};
