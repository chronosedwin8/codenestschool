/**
 * La historia de CodeNest School.
 *
 * El nombre del producto es la historia: CodeNest es El Nido, un lugar flotando
 * en el espacio donde viven los Fuzzes. Una tormenta los dispersó por treinta
 * mundos, y el niño va rescatándolos de uno en uno.
 *
 * Esa premisa hace tres cosas a la vez, y por eso se eligió:
 *
 *  1. Da una razón para viajar. Cada mundo tiene un Fuzz perdido esperando.
 *  2. Da una razón para volver. El Nido se llena, y verlo llenarse es la
 *     recompensa que no cabe en una estrella.
 *  3. Invierte los papeles. Nube, que cuida el Nido, no puede rescatarlos sola y
 *     pide ayuda al niño. Un niño que ayuda a alguien se implica mucho más que un
 *     niño al que alguien enseña.
 *
 * CÓMO SE ESCRIBE LA NARRACIÓN. Un texto que solo describe lo que se ve en
 * pantalla es información redundante. Estas reglas hacen que cada frase empuje:
 *
 *  - Abrir con un gancho, no con una descripción. "¿Oyes eso?" antes que "Este
 *    es el bosque".
 *  - Dejar una pregunta sin responder. El niño juega para averiguarla.
 *  - Retar de frente. "Nadie lo ha conseguido a la primera" hace más que
 *    "inténtalo".
 *  - Que Nube tenga estados de ánimo. A veces está preocupada, a veces se ríe, a
 *    veces baja la voz para contar un secreto. Una guía que siempre suena igual
 *    deja de escucharse a las tres frases.
 *  - Nunca decir la instrucción técnica. No "arrastra una ficha de repetir", sino
 *    "Brinco no aguanta que le repitan las cosas. Díselo una vez y cuántas".
 *
 * EL HILO LARGO. La tormenta no fue una tormenta. Algo la provocó, y las pistas
 * aparecen desde el mundo 4: un eco que repite palabras que Nube no ha dicho, un
 * símbolo grabado en un cofre, un registro en el cohete. Se resuelve en el mundo
 * 30. Ese misterio es lo que sostiene la atención más allá del mundo cinco.
 */
import type { ColorCasilla } from '@codenest/shared';

export interface FuzzPerdido {
  readonly mundo: number;
  readonly nombre: string;
  readonly color: string;
  /** Rasgo de carácter. Da pie a lo que dice y a cómo se mueve. */
  readonly caracter: string;
  /** Qué hacía cuando llegó la tormenta. */
  readonly loQueHacia: string;
}

/**
 * Los treinta Fuzzes, uno por mundo.
 *
 * Los nombres son cortos y sonoros: un niño de cuatro años tiene que poder
 * repetirlos en voz alta después de oírlos una vez.
 */
export const FUZZES: readonly FuzzPerdido[] = [
  // ── Exploradores ──
  { mundo: 1, nombre: 'Pip', color: '#29A9E0', caracter: 'el mas pequeno y el mas valiente', loQueHacia: 'contaba estrellas desde el borde del Nido' },
  { mundo: 2, nombre: 'Iris', color: '#3FC55F', caracter: 've colores donde nadie los ve', loQueHacia: 'pintaba el arcoiris de los martes' },
  { mundo: 3, nombre: 'Brinco', color: '#FFC93C', caracter: 'no sabe andar, solo saltar', loQueHacia: 'practicaba su triple salto' },
  { mundo: 4, nombre: 'Eco', color: '#9B5DE5', caracter: 'repite todo dos veces, todo dos veces', loQueHacia: 'cantaba en la cueva para oirse volver' },
  { mundo: 5, nombre: 'Mango', color: '#FF8A3D', caracter: 'siempre tiene hambre', loQueHacia: 'guardaba fruta para el invierno' },
  { mundo: 6, nombre: 'Nimbo', color: '#8ED3F5', caracter: 'duda de todo antes de decidir', loQueHacia: 'elegia que nube pisar primero' },
  { mundo: 7, nombre: 'Garfio', color: '#FF4D9D', caracter: 'lo guarda todo en cajas', loQueHacia: 'ordenaba su tesoro por tamanos' },
  { mundo: 8, nombre: 'Chispa', color: '#FF3CAC', caracter: 'no sabe parar', loQueHacia: 'rodaba montana abajo sin frenar' },
  { mundo: 9, nombre: 'Fosil', color: '#5AD35A', caracter: 'encuentra lo que esta mal', loQueHacia: 'desenterraba huesos torcidos' },
  { mundo: 10, nombre: 'Orbita', color: '#7B61FF', caracter: 'mira siempre hacia arriba', loQueHacia: 'preparaba el cohete del Nido' },

  // ── Creadores ──
  { mundo: 11, nombre: 'Prisma', color: '#06B6D4', caracter: 'lo repite hasta que sale perfecto', loQueHacia: 'pulia los puentes de cristal' },
  { mundo: 12, nombre: 'Tuerca', color: '#FF8A3D', caracter: 'cuenta todo lo que ve', loQueHacia: 'llevaba la cuenta de las gemas' },
  { mundo: 13, nombre: 'Engra', color: '#FFD93D', caracter: 'arregla lo que otros rompen', loQueHacia: 'reparaba el puente del mercado' },
  { mundo: 14, nombre: 'Llama', color: '#FF4D9D', caracter: 'decide rapido y casi siempre acierta', loQueHacia: 'encendia las antorchas del templo' },
  { mundo: 15, nombre: 'Dedalo', color: '#9B5DE5', caracter: 'nunca se pierde', loQueHacia: 'dibujaba el mapa del laberinto' },
  { mundo: 16, nombre: 'Voltio', color: '#3FC55F', caracter: 'da energia a los demas', loQueHacia: 'cargaba las baterias del Nido' },
  { mundo: 17, nombre: 'Copo', color: '#8ED3F5', caracter: 'aguanta lo que sea', loQueHacia: 'probaba si el hielo aguantaba' },
  { mundo: 18, nombre: 'Lava', color: '#FF6B3D', caracter: 'recuerda todos los caminos', loQueHacia: 'memorizaba la ruta entre islas' },
  { mundo: 19, nombre: 'Radar', color: '#29A9E0', caracter: 've el error antes que nadie', loQueHacia: 'revisaba los planos de la mision' },
  { mundo: 20, nombre: 'Titan', color: '#475569', caracter: 'no se rinde jamas', loQueHacia: 'sostenia la puerta de la fortaleza' },

  // ── Hackers ──
  { mundo: 21, nombre: 'Byte', color: '#06B6D4', caracter: 'habla en frases muy cortas', loQueHacia: 'escribia el primer mensaje de la ciudad' },
  { mundo: 22, nombre: 'Indice', color: '#5AD35A', caracter: 'lo ordena todo por numero', loQueHacia: 'catalogaba las puertas del servidor' },
  { mundo: 23, nombre: 'Vacuna', color: '#3FC55F', caracter: 'limpia lo que otros ensucian', loQueHacia: 'cazaba virus en el laboratorio' },
  { mundo: 24, nombre: 'Coral', color: '#29A9E0', caracter: 'guarda cada cosa en su sitio', loQueHacia: 'clasificaba los datos del arrecife' },
  { mundo: 25, nombre: 'Fision', color: '#FFC93C', caracter: 'hace mil cosas a la vez', loQueHacia: 'vigilaba los sensores del reactor' },
  { mundo: 26, nombre: 'Duna', color: '#FF8A3D', caracter: 'encuentra cualquier cosa', loQueHacia: 'buscaba agua bajo la arena' },
  { mundo: 27, nombre: 'Escudo', color: '#9B5DE5', caracter: 'siempre tiene un plan B', loQueHacia: 'protegia el satelite de las averias' },
  { mundo: 28, nombre: 'Zumbi', color: '#29A9E0', caracter: 'vuela sin chocar nunca', loQueHacia: 'entrenaba a los drones novatos' },
  { mundo: 29, nombre: 'Nitido', color: '#FF4D9D', caracter: 'quita todo lo que sobra', loQueHacia: 'afinaba los motores de la arena' },
  { mundo: 30, nombre: 'Alma', color: '#FFD93D', caracter: 'el primer Fuzz que existio', loQueHacia: 'cuidaba el Nucleo del Nido' },
];

export const FUZZ_POR_MUNDO: ReadonlyMap<number, FuzzPerdido> = new Map(
  FUZZES.map((f) => [f.mundo, f]),
);

/** Un momento de una cinemática: lo que se ve, lo que se oye y cuánto dura. */
export interface Beat {
  readonly escena: string;
  readonly texto: string;
  readonly audio: string;
  readonly duracion: number;
  readonly fondo?: string;
  readonly fondoRayo?: string;
}

export interface Cinematica {
  readonly clave: string;
  readonly beats: readonly Beat[];
}

/** Paletas de fondo según el tono del momento. */
const MORADO = { fondo: '#7B3FD4', fondoRayo: '#8B52E0' };
const NOCHE = { fondo: '#2E4A9E', fondoRayo: '#3C5CBD' };
const VERDE = { fondo: '#2F9E5E', fondoRayo: '#3CBD72' };
const AMBAR = { fondo: '#D98A1F', fondoRayo: '#EDA43A' };
const CIRUELA = { fondo: '#5E2C8F', fondoRayo: '#7440AD' };

/**
 * Cinemática de apertura.
 *
 * Cuatro momentos y ni uno más: a los cuatro años el hilo se pierde al quinto.
 * El último deja la pregunta abierta que sostiene los treinta mundos.
 */
export const APERTURA: Cinematica = {
  clave: 'intro-general',
  beats: [
    {
      escena: 'nido-lleno',
      texto: 'Shhh. Acercate y mira. Esto es el Nido, y esas bolitas peludas son los Fuzzes. Treinta. Los he contado mil veces.',
      audio: 'cine_apertura_1',
      duracion: 5600,
      ...MORADO,
    },
    {
      escena: 'tormenta',
      texto: 'Hasta la noche de la tormenta. Vino de ninguna parte, sin viento y sin aviso. Y no dejo ni uno.',
      audio: 'cine_apertura_2',
      duracion: 5000,
      ...NOCHE,
    },
    {
      escena: 'nido-vacio',
      texto: 'Yo no puedo ir a buscarlos. Soy una nube, no llego tan lejos. Llevo mucho tiempo esperando a alguien como tu.',
      audio: 'cine_apertura_3',
      duracion: 5800,
      ...NOCHE,
    },
    {
      escena: 'mapa-mundos',
      texto: 'Treinta mundos, treinta Fuzzes. Y una cosa mas, que te contare cuando estes preparado: aquella tormenta no fue una tormenta. Vamos a por el primero.',
      audio: 'cine_apertura_4',
      duracion: 7200,
      ...MORADO,
    },
  ],
};

export interface HistoriaMundo {
  readonly mundo: number;
  readonly entrada: readonly Beat[];
  readonly rescate: readonly Beat[];
}

/** Historias de los mundos, en el orden en que se juegan. */
export const HISTORIAS: readonly HistoriaMundo[] = [
  // ══ Mundo 1: secuencias ══
  {
    mundo: 1,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'Ahi abajo, esa bolita azul que no para quieta, es Pip. El mas pequeno de los treinta y el unico que se atrevio a mirar la tormenta de frente.',
        audio: 'cine_m1_entrada_1',
        duracion: 6400,
        ...MORADO,
      },
      {
        escena: 'pip-presentacion',
        texto: 'Te aviso de una cosa antes de empezar: Pip no sabe frenar. Cuando echa a rodar, sigue recto hasta que se le acaba el suelo. Siempre.',
        audio: 'cine_m1_entrada_2',
        duracion: 6600,
        ...MORADO,
      },
      {
        escena: 'flechas',
        texto: 'Asi que tu decides hacia donde. El pone las patas, tu pones la cabeza. A ver cuanto tardas.',
        audio: 'cine_m1_entrada_3',
        duracion: 5400,
        ...VERDE,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Uno. El primero de treinta, y el mas dificil, porque no sabias si ibas a poder.',
        audio: 'cine_m1_rescate_1',
        duracion: 5200,
        ...VERDE,
      },
      {
        escena: 'nido-suma',
        texto: 'Pip dice que oyo algo raro justo antes de caer. Un zumbido. No le hice caso. Ahora vamos al Bosque Arcoiris, que Iris lleva demasiado tiempo sola.',
        audio: 'cine_m1_rescate_2',
        duracion: 7400,
        ...MORADO,
      },
    ],
  },

  // ══ Mundo 2: condicionales de color ══
  {
    mundo: 2,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'El Bosque Arcoiris. Aqui cada camino tiene su color, e Iris los pinto todos ella sola. Le llevo cuatrocientos anos.',
        audio: 'cine_m2_entrada_1',
        duracion: 6200,
        ...VERDE,
      },
      {
        escena: 'colores',
        texto: 'Y hay una regla que ella misma invento: en las casillas rojas se gira, en las verdes se sigue. Si te la saltas, el bosque te devuelve al principio.',
        audio: 'cine_m2_entrada_2',
        duracion: 7000,
        ...VERDE,
      },
      {
        escena: 'flechas',
        texto: 'Mira el color antes de decidir. Aqui no vale lanzarse: hay que fijarse. Iris te esta esperando al final.',
        audio: 'cine_m2_entrada_3',
        duracion: 5800,
        ...VERDE,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Iris esta bien. Dice que el bosque cambio de color aquella noche, y que ella nunca pinto ese que vio.',
        audio: 'cine_m2_rescate_1',
        duracion: 6000,
        ...VERDE,
      },
      {
        escena: 'nido-suma',
        texto: 'Dos rescatados. Siguiente parada: la Pradera de los Saltos. Y te lo digo ya, ahi vas a tener que repetirte.',
        audio: 'cine_m2_rescate_2',
        duracion: 6000,
        ...MORADO,
      },
    ],
  },

  // ══ Mundo 3: bucles ══
  {
    mundo: 3,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'Brinco cayo en la Pradera, y de todos los sitios posibles es el que mas le gusta. Brinco no camina. Brinco salta. Solo sabe saltar.',
        audio: 'cine_m3_entrada_1',
        duracion: 6800,
        ...AMBAR,
      },
      {
        escena: 'saltos',
        texto: 'La pradera esta llena de agujeros. Podrias poner una ficha de saltar por cada uno, claro. Ocho agujeros, ocho fichas. Que aburrimiento.',
        audio: 'cine_m3_entrada_2',
        duracion: 7000,
        ...AMBAR,
      },
      {
        escena: 'bucle',
        texto: 'O puedes decirle una sola vez que salte, y cuantas veces. Los Fuzzes listos hacen eso. Brinco es listo. Veamos si tu tambien.',
        audio: 'cine_m3_entrada_3',
        duracion: 7200,
        ...AMBAR,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Brinco lleva saltando desde que llegaste y no piensa parar. Dice que asi entra en calor.',
        audio: 'cine_m3_rescate_1',
        duracion: 5400,
        ...AMBAR,
      },
      {
        escena: 'nido-suma',
        texto: 'Tres. Ahora viene la Cueva de los Ecos, y ahi hay algo que llevo semanas sin querer contarte.',
        audio: 'cine_m3_rescate_2',
        duracion: 6000,
        ...CIRUELA,
      },
    ],
  },

  // ══ Mundo 4: patrones. Primera pista del misterio ══
  {
    mundo: 4,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'La Cueva de los Ecos. Aqui todo lo que dices vuelve. Eco vive aqui porque le encanta oirse, oirse.',
        audio: 'cine_m4_entrada_1',
        duracion: 6000,
        ...CIRUELA,
      },
      {
        escena: 'patron',
        texto: 'Y la cueva funciona igual: los caminos se repiten en el mismo orden, una y otra vez. Si descubres el patron, ya no tienes que pensar. Solo repetirlo.',
        audio: 'cine_m4_entrada_2',
        duracion: 7600,
        ...CIRUELA,
      },
      {
        escena: 'eco-extrano',
        texto: 'Una cosa mas. Eco me dijo que la cueva repite palabras que nadie ha dicho. Yo creo que se lo invento. Tu ve con cuidado igual.',
        audio: 'cine_m4_entrada_3',
        duracion: 7400,
        ...CIRUELA,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Eco esta a salvo. Pero antes de salir me repitio una palabra que la cueva le devolvia sin parar. Una sola: despierta.',
        audio: 'cine_m4_rescate_1',
        duracion: 7000,
        ...CIRUELA,
      },
      {
        escena: 'nido-suma',
        texto: 'Cuatro Fuzzes en casa. No me gusta esa palabra. Vamos al Oasis, que Mango tiene hambre y eso si lo entiendo.',
        audio: 'cine_m4_rescate_2',
        duracion: 6400,
        ...MORADO,
      },
    ],
  },

  // ══ Mundo 5: orden de recolección ══
  {
    mundo: 5,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'El Oasis Dulce. Mango cayo justo encima de la fruta, que es exactamente donde el habria elegido caer.',
        audio: 'cine_m5_entrada_1',
        duracion: 6000,
        ...AMBAR,
      },
      {
        escena: 'orden',
        texto: 'Pero hay un problema. Mango solo come en su orden: primero lo amarillo, luego lo naranja, y al final lo rojo. Si te equivocas, no se mueve.',
        audio: 'cine_m5_entrada_2',
        duracion: 7400,
        ...AMBAR,
      },
      {
        escena: 'flechas',
        texto: 'Asi que aqui no vale llegar. Hay que llegar en el orden correcto. Piensa el camino entero antes de poner la primera ficha.',
        audio: 'cine_m5_entrada_3',
        duracion: 6800,
        ...AMBAR,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Mango se lo comio todo y aun asi dice que tiene hambre. Es su forma de dar las gracias.',
        audio: 'cine_m5_rescate_1',
        duracion: 5600,
        ...AMBAR,
      },
      {
        escena: 'nido-suma',
        texto: 'Cinco. Ya vas por la sexta parte. Nimbo esta en el Castillo de Nubes, y Nimbo no decide nada sin pensarlo tres veces.',
        audio: 'cine_m5_rescate_2',
        duracion: 6600,
        ...MORADO,
      },
    ],
  },

  // ══ Mundo 6: si / si no ══
  {
    mundo: 6,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'El Castillo de Nubes. El suelo aqui no siempre esta. A veces hay nube, a veces hay aire, y desde arriba se parecen mucho.',
        audio: 'cine_m6_entrada_1',
        duracion: 6800,
        ...NOCHE,
      },
      {
        escena: 'decision',
        texto: 'Por eso Nimbo mira antes de pisar. Siempre. Si hay nube rueda, y si no hay nube salta. Nunca al reves, porque al reves se cae.',
        audio: 'cine_m6_entrada_2',
        duracion: 6600,
        ...NOCHE,
      },
      {
        escena: 'flechas',
        texto: 'Tu programa tiene que decidir solo, sin que tu mires. Eso es lo dificil de hoy. Suerte.',
        audio: 'cine_m6_entrada_3',
        duracion: 5800,
        ...NOCHE,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Nimbo bajo del castillo, y por primera vez en su vida no lo penso tres veces. Confio en tu programa.',
        audio: 'cine_m6_rescate_1',
        duracion: 6200,
        ...NOCHE,
      },
      {
        escena: 'nido-suma',
        texto: 'Seis. Garfio esta en la Bahia de los Piratas guardando su tesoro, como siempre. Ahi vas a aprender a guardar cosas tu tambien.',
        audio: 'cine_m6_rescate_2',
        duracion: 6800,
        ...MORADO,
      },
    ],
  },

  // ══ Mundo 7: subrutinas. Segunda pista ══
  {
    mundo: 7,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'La Bahia de los Piratas. Garfio lo guarda todo en cajas: los caramelos, los tornillos, y hasta los movimientos.',
        audio: 'cine_m7_entrada_1',
        duracion: 6400,
        ...AMBAR,
      },
      {
        escena: 'caja',
        texto: 'Mira esto. Coge tres fichas, las mete en una caja, le pone un nombre, y ya esta: cada vez que dice el nombre, hace las tres. A eso le llama su Super Salto.',
        audio: 'cine_m7_entrada_2',
        duracion: 8200,
        ...AMBAR,
      },
      {
        escena: 'flechas',
        texto: 'Hazte tu propia caja. Una vez la tengas, usala todas las veces que quieras. Es como tener un ayudante.',
        audio: 'cine_m7_entrada_3',
        duracion: 6600,
        ...AMBAR,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Garfio esta en casa, y ha traido su cofre. Dice que dentro hay algo que no guardo el.',
        audio: 'cine_m7_rescate_1',
        duracion: 5800,
        ...AMBAR,
      },
      {
        escena: 'nido-suma',
        texto: 'Siete. En el cofre hay una pieza de metal con un simbolo grabado. No es de ningun mundo que yo conozca. La guardo por si acaso.',
        audio: 'cine_m7_rescate_2',
        duracion: 7400,
        ...CIRUELA,
      },
    ],
  },

  // ══ Mundo 8: bucles exactos ══
  {
    mundo: 8,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'La Montana Neon. Chispa lleva rodando desde que cayo, y ya ha dado ochenta y siete vueltas. Las he contado.',
        audio: 'cine_m8_entrada_1',
        duracion: 6600,
        ...CIRUELA,
      },
      {
        escena: 'bucle',
        texto: 'El problema no es que ruede. Es que no sabe cuando parar. Si le dices repite muchas veces, se pasa. Si le dices pocas, se queda corto.',
        audio: 'cine_m8_entrada_2',
        duracion: 7400,
        ...CIRUELA,
      },
      {
        escena: 'flechas',
        texto: 'Aqui el numero exacto importa. Ni uno mas, ni uno menos. Cuenta bien antes de darle al boton.',
        audio: 'cine_m8_entrada_3',
        duracion: 6400,
        ...CIRUELA,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Chispa paro. Por primera vez en su vida, paro donde queria parar. Esta un poco mareada, pero contenta.',
        audio: 'cine_m8_rescate_1',
        duracion: 6400,
        ...CIRUELA,
      },
      {
        escena: 'nido-suma',
        texto: 'Ocho. Quedan dos para terminar los mundos de aqui abajo. Fosil te espera en el Valle de los Dinosaurios, y esta vez el trabajo es distinto.',
        audio: 'cine_m8_rescate_2',
        duracion: 7200,
        ...MORADO,
      },
    ],
  },

  // ══ Mundo 9: depuración ══
  {
    mundo: 9,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'El Valle de los Dinosaurios. Fosil se pasa el dia desenterrando cosas rotas y arreglandolas. Hoy vas a hacer lo mismo.',
        audio: 'cine_m9_entrada_1',
        duracion: 6600,
        ...VERDE,
      },
      {
        escena: 'error',
        texto: 'Estos programas ya estan escritos. Casi funcionan. Casi. En cada uno hay una ficha que esta mal, y solo una.',
        audio: 'cine_m9_entrada_2',
        duracion: 6800,
        ...VERDE,
      },
      {
        escena: 'flechas',
        texto: 'Encontrar el error es mas dificil que escribirlo de cero, y mucho mas util. Los mejores programadores se pasan la vida haciendo esto.',
        audio: 'cine_m9_entrada_3',
        duracion: 7600,
        ...VERDE,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Fosil dice que tienes buen ojo. Viniendo de el, que se pasa el dia mirando huesos torcidos, es mucho decir.',
        audio: 'cine_m9_rescate_1',
        duracion: 6600,
        ...VERDE,
      },
      {
        escena: 'nido-suma',
        texto: 'Nueve. Solo queda Orbita, en la Estacion Espacial. Y Orbita tiene el cohete, que es la unica forma de subir mas arriba.',
        audio: 'cine_m9_rescate_2',
        duracion: 7000,
        ...MORADO,
      },
    ],
  },

  // ══ Mundo 10: integrador. Tercera pista ══
  {
    mundo: 10,
    entrada: [
      {
        escena: 'caida-fuzz',
        texto: 'La Estacion Espacial Fuzz. Orbita estaba preparando el cohete la noche de la tormenta. Es el unico que la vio venir.',
        audio: 'cine_m10_entrada_1',
        duracion: 6800,
        ...NOCHE,
      },
      {
        escena: 'integrador',
        texto: 'Aqui va todo junto: flechas, colores, repeticiones y cajas. Todo lo que has aprendido en nueve mundos, en un solo tablero.',
        audio: 'cine_m10_entrada_2',
        duracion: 7200,
        ...NOCHE,
      },
      {
        escena: 'flechas',
        texto: 'No te voy a mentir: esto es lo mas dificil que has hecho. Y estoy segura de que puedes. Enciende ese cohete.',
        audio: 'cine_m10_entrada_3',
        duracion: 6800,
        ...NOCHE,
      },
    ],
    rescate: [
      {
        escena: 'fuzz-rescatado',
        texto: 'Diez de treinta. Un tercio. Y el cohete funciona.',
        audio: 'cine_m10_rescate_1',
        duracion: 5000,
        ...VERDE,
      },
      {
        escena: 'nido-suma',
        texto: 'Orbita ha revisado el registro del cohete. La noche de la tormenta algo salio del Nucleo, en el mundo treinta, y viajo hasta aqui. El simbolo del cofre de Garfio es de alli. Sube al cohete. Los mundos de arriba son mas dificiles, y ya no eres el mismo de antes.',
        audio: 'cine_m10_rescate_2',
        duracion: 11000,
        ...CIRUELA,
      },
    ],
  },
];

export const HISTORIA_POR_MUNDO: ReadonlyMap<number, HistoriaMundo> = new Map(
  HISTORIAS.map((h) => [h.mundo, h]),
);

/** Compatibilidad con lo que ya importaba la historia del mundo 1. */
export const HISTORIA_MUNDO_1 = HISTORIAS[0]!;

/** Todos los textos narrados de la historia, para el generador de voz. */
export function textosDeHistoria(): { clave: string; texto: string }[] {
  const textos: { clave: string; texto: string }[] = [];

  for (const beat of APERTURA.beats) {
    textos.push({ clave: beat.audio, texto: beat.texto });
  }
  for (const historia of HISTORIAS) {
    for (const beat of [...historia.entrada, ...historia.rescate]) {
      textos.push({ clave: beat.audio, texto: beat.texto });
    }
  }

  return textos;
}

export const COLOR_MUNDO: Readonly<Record<number, ColorCasilla | undefined>> = {};
