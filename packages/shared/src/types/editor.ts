/**
 * Tipos de editor y lenguajes de programacion por grupo de edad.
 * Una sola fuente de verdad para la barra de fichas, Blockly y Monaco.
 */

export const TIPO_EDITOR = {
  /** Mundos 1-10: barra de fichas propia con drag & drop (estilo Kodable). */
  comandos: 'comandos',
  /** Mundos 11-20: Blockly 11 con vista paralela del codigo generado. */
  bloques: 'bloques',
  /** Mundos 21-30: Monaco Editor con JavaScript (y Python via pylite). */
  texto: 'texto',
} as const;

export type TipoEditor = (typeof TIPO_EDITOR)[keyof typeof TIPO_EDITOR];

export const LENGUAJE_CODIGO = {
  /** Programa como lista de fichas; no hay texto que escribir. */
  comandos: 'comandos',
  javascript: 'javascript',
  /** Subconjunto de Python transpilado a JavaScript por `pylite`. */
  python: 'python',
} as const;

export type LenguajeCodigo = (typeof LENGUAJE_CODIGO)[keyof typeof LENGUAJE_CODIGO];

/** Editor que corresponde a cada grupo de edad por defecto. */
export const EDITOR_POR_GRUPO = {
  exploradores: TIPO_EDITOR.comandos,
  creadores: TIPO_EDITOR.bloques,
  hackers: TIPO_EDITOR.texto,
} as const;

/**
 * Comandos disponibles del personaje (Fuzz). El nivel decide cuales se exponen
 * al sandbox y cuales aparecen en la barra de fichas o en el toolbox de Blockly.
 */
export const COMANDO_FUZZ = {
  // Movimiento absoluto (mundos 1-10, modo "rodar")
  derecha: 'derecha',
  izquierda: 'izquierda',
  arriba: 'arriba',
  abajo: 'abajo',
  // Movimiento relativo (mundos 11+, modo "paso")
  avanzar: 'avanzar',
  girarDerecha: 'girarDerecha',
  girarIzquierda: 'girarIzquierda',
  saltar: 'saltar',
  // Interaccion
  recoger: 'recoger',
  activarPalanca: 'activarPalanca',
  repararPuente: 'repararPuente',
  // Sensores (devuelven valor, no encolan accion)
  puedeAvanzar: 'puedeAvanzar',
  colorCasilla: 'colorCasilla',
  hayObstaculo: 'hayObstaculo',
} as const;

export type ComandoFuzz = (typeof COMANDO_FUZZ)[keyof typeof COMANDO_FUZZ];

/** Sensores: no encolan accion, devuelven un valor al programa. */
export const SENSORES: readonly ComandoFuzz[] = [
  COMANDO_FUZZ.puedeAvanzar,
  COMANDO_FUZZ.colorCasilla,
  COMANDO_FUZZ.hayObstaculo,
];

/** Estructuras de control disponibles como ficha o bloque. */
export const ESTRUCTURA = {
  repetir: 'repetir',
  siColor: 'siColor',
  siSino: 'siSino',
  mientras: 'mientras',
  hasta: 'hasta',
  funcion: 'funcion',
  variable: 'variable',
  lista: 'lista',
} as const;

export type Estructura = (typeof ESTRUCTURA)[keyof typeof ESTRUCTURA];
