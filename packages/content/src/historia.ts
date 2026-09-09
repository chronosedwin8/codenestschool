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
 * Cada Fuzz rescatado tiene nombre, color y carácter. No son treinta bolas
 * iguales: son treinta personajes, y el niño recuerda a los suyos.
 */
import type { ColorCasilla } from '@codenest/shared';

export interface FuzzPerdido {
  /** Mundo donde cayó. */
  readonly mundo: number;
  readonly nombre: string;
  /** Color del pelaje, en hexadecimal. */
  readonly color: string;
  /** Rasgo de carácter. Da pie a lo que dice y a cómo se mueve. */
  readonly caracter: string;
  /** Qué hacía cuando llegó la tormenta. Aparece en la cinemática de rescate. */
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
  /** Escena a dibujar. La conoce el reproductor. */
  readonly escena: string;
  /** Lo que narra Nube. Es también el texto del que se genera el audio. */
  readonly texto: string;
  /** Clave del clip de voz. */
  readonly audio: string;
  /** Duración mínima en pantalla, en milisegundos. */
  readonly duracion: number;
  /** Color de fondo de este momento. */
  readonly fondo?: string;
  readonly fondoRayo?: string;
}

export interface Cinematica {
  readonly clave: string;
  readonly beats: readonly Beat[];
}

/** Colores de fondo por momento narrativo. */
const MORADO = { fondo: '#7B3FD4', fondoRayo: '#8B52E0' };
const AZUL_NOCHE = { fondo: '#2E4A9E', fondoRayo: '#3C5CBD' };
const VERDE = { fondo: '#2F9E5E', fondoRayo: '#3CBD72' };

/**
 * Cinemática de apertura: solo se ve una vez, la primera vez que el niño entra.
 *
 * Establece la premisa en cuatro momentos. Más de cuatro y un niño de cuatro años
 * pierde el hilo; menos y no se entiende por qué está aquí.
 */
export const APERTURA: Cinematica = {
  clave: 'intro-general',
  beats: [
    {
      escena: 'nido-lleno',
      texto: 'Esto es el Nido. Aqui viven los Fuzzes, unas bolitas peludas muy curiosas. Yo soy Nube y cuido de ellos.',
      audio: 'cine_apertura_1',
      duracion: 5200,
      ...MORADO,
    },
    {
      escena: 'tormenta',
      texto: 'Pero una noche llego una tormenta enorme y se los llevo a todos. A los treinta.',
      audio: 'cine_apertura_2',
      duracion: 4200,
      ...AZUL_NOCHE,
    },
    {
      escena: 'nido-vacio',
      texto: 'Ahora el Nido esta vacio y yo no puedo ir a buscarlos. Pero tu si.',
      audio: 'cine_apertura_3',
      duracion: 4200,
      ...AZUL_NOCHE,
    },
    {
      escena: 'mapa-mundos',
      texto: 'Cayeron en treinta mundos distintos. Enseñales el camino de vuelta y traelos a casa, uno por uno. Empezamos.',
      audio: 'cine_apertura_4',
      duracion: 5600,
      ...MORADO,
    },
  ],
};

/** Cinemática de entrada a un mundo. */
export interface HistoriaMundo {
  readonly mundo: number;
  readonly entrada: readonly Beat[];
  readonly rescate: readonly Beat[];
}

/**
 * Historia del Mundo 1.
 *
 * Es la que más peso tiene: enseña la mecánica sin decir una sola instrucción
 * técnica. Nube no explica "arrastra una ficha de flecha": dice que Pip solo sabe
 * ir en línea recta y que hay que decirle hacia dónde. Es la misma información,
 * pero en el idioma del niño.
 */
export const HISTORIA_MUNDO_1: HistoriaMundo = {
  mundo: 1,
  entrada: [
    {
      escena: 'caida-fuzz',
      texto: 'Mira, alli abajo. Ese es Pip, el mas pequeno de todos. Cayo en su propio planeta y no sabe volver.',
      audio: 'cine_m1_entrada_1',
      duracion: 5000,
      ...MORADO,
    },
    {
      escena: 'pip-presentacion',
      texto: 'Pip es muy valiente, pero tiene una cosa: cuando echa a rodar, no sabe parar. Sigue recto hasta que se acaba el camino.',
      audio: 'cine_m1_entrada_2',
      duracion: 6000,
      ...MORADO,
    },
    {
      escena: 'flechas',
      texto: 'Por eso te necesita. Tu le dices hacia donde rodar con estas flechas, y el hace el resto. Vamos a buscarlo.',
      audio: 'cine_m1_entrada_3',
      duracion: 5600,
      ...VERDE,
    },
  ],
  rescate: [
    {
      escena: 'fuzz-rescatado',
      texto: 'Lo lograste. Pip esta a salvo y ya conoce el camino de vuelta al Nido.',
      audio: 'cine_m1_rescate_1',
      duracion: 4600,
      ...VERDE,
    },
    {
      escena: 'nido-suma',
      texto: 'Uno de treinta. Quedan veintinueve Fuzzes ahi fuera, y cada uno esta en un sitio distinto. El siguiente es Iris, en el Bosque Arcoiris.',
      audio: 'cine_m1_rescate_2',
      duracion: 6400,
      ...MORADO,
    },
  ],
};

export const HISTORIAS: readonly HistoriaMundo[] = [HISTORIA_MUNDO_1];

export const HISTORIA_POR_MUNDO: ReadonlyMap<number, HistoriaMundo> = new Map(
  HISTORIAS.map((h) => [h.mundo, h]),
);

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

/** El color de casilla de cada mundo, para teñir su cinemática. */
export const COLOR_MUNDO: Readonly<Record<number, ColorCasilla | undefined>> = {};
