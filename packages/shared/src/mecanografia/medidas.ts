/**
 * Las medidas de la mecanografía: PPM, precisión y estrellas.
 *
 * Están aquí, puras y sin dependencias, porque las calculan **los dos lados**: el
 * navegador para mostrarlas mientras el niño escribe, y el servidor para
 * recalcularlas al recibir el resultado. Si cada uno usara su propia fórmula, el
 * niño vería 32 PPM en pantalla y el servidor le guardaría 28, y no habría forma
 * de explicarle por qué.
 *
 * PPM son "pulsaciones por minuto"... salvo que no: la medida universal de
 * mecanografía es **palabras por minuto**, y una "palabra" son cinco caracteres
 * por convenio, espacios incluidos. Se mantiene esa convención porque es la que
 * usan todas las pruebas de mecanografía del mundo, y un niño que dice "hago 30"
 * tiene que poder compararse con cualquier otra medida.
 */

export interface Intento {
  /** Caracteres escritos correctamente (los que coincidieron a la primera). */
  readonly correctos: number;
  /** Pulsaciones equivocadas. */
  readonly errores: number;
  /** Duración real de la escritura, en milisegundos. */
  readonly milisegundos: number;
}

export interface Medidas {
  /** Palabras por minuto (cinco caracteres = una palabra). */
  readonly ppm: number;
  /** Porcentaje de acierto, de 0 a 100. */
  readonly precision: number;
  readonly correctos: number;
  readonly errores: number;
  readonly segundos: number;
}

/** Cinco caracteres son una palabra. Es el convenio de toda la mecanografía. */
export const CARACTERES_POR_PALABRA = 5;

/** Lo más rápido que se considera humano. Por encima, algo va mal. */
export const PPM_MAXIMAS_CREIBLES = 200;

/**
 * Cuántas pulsaciones hacen falta para que la velocidad signifique algo.
 *
 * En los primeros instantes el reloj lleva milisegundos, y un solo carácter da
 * cifras absurdas: una tecla en 10 ms son 12.000 ppm. No es un error de
 * cálculo, es que todavía no hay nada que medir. El contador en vivo muestra un
 * guion hasta que hay una palabra escrita; el resultado final no lo necesita,
 * porque ahí siempre hay una lección entera detrás.
 */
export const PULSACIONES_MINIMAS_PARA_VELOCIDAD = CARACTERES_POR_PALABRA;

/** La velocidad que se le puede mostrar al niño, o `null` si aún no hay. */
export function velocidadEnVivo(medidas: Medidas): number | null {
  if (medidas.correctos + medidas.errores < PULSACIONES_MINIMAS_PARA_VELOCIDAD) return null;
  return medidas.ppm;
}

export function medir(intento: Intento): Medidas {
  const segundos = Math.max(0, intento.milisegundos) / 1000;
  const pulsaciones = intento.correctos + intento.errores;

  // Sin tiempo no hay velocidad. Ocurre de verdad: un intento de dos teclas en
  // el mismo milisegundo daría una division por cero y un PPM infinito.
  const minutos = segundos / 60;
  const ppm = minutos > 0 ? intento.correctos / CARACTERES_POR_PALABRA / minutos : 0;

  return {
    ppm: Math.round(ppm),
    precision: pulsaciones > 0 ? Math.round((intento.correctos / pulsaciones) * 100) : 0,
    correctos: intento.correctos,
    errores: intento.errores,
    segundos: Math.round(segundos),
  };
}

export interface Exigencia {
  /** Precisión mínima para 1, 2 y 3 estrellas. */
  readonly precision: readonly [number, number, number];
  /** PPM mínimas para 1, 2 y 3 estrellas. */
  readonly ppm: readonly [number, number, number];
}

/**
 * Cuántas estrellas merece un intento.
 *
 * La precisión es una **puerta**, no un promedio: para tener dos estrellas hay
 * que cumplir la precisión de dos estrellas Y las PPM de dos estrellas. Es
 * deliberado y es lo contrario de lo que hacen casi todos los tutores de
 * mecanografía: aquí no se puede comprar velocidad a cambio de errores, porque
 * teclear rápido y mal es justo el hábito que después cuesta años quitar.
 */
export function estrellasDe(medidas: Medidas, exigencia: Exigencia): number {
  let estrellas = 0;
  for (let nivel = 0; nivel < 3; nivel++) {
    const cumplePrecision = medidas.precision >= exigencia.precision[nivel]!;
    const cumpleVelocidad = medidas.ppm >= exigencia.ppm[nivel]!;
    if (cumplePrecision && cumpleVelocidad) estrellas = nivel + 1;
  }
  return estrellas;
}

/**
 * Por qué no se llegó a la estrella siguiente.
 *
 * Existe porque "2 de 3 estrellas" no le dice a nadie qué hacer distinto la
 * próxima vez. Esto sí: o vas más despacio, o vas más rápido.
 */
export function queFalta(
  medidas: Medidas,
  exigencia: Exigencia,
  estrellas: number,
): { falta: 'precision' | 'velocidad' | 'nada'; objetivo: number } {
  if (estrellas >= 3) return { falta: 'nada', objetivo: 0 };

  const siguiente = estrellas; // índice del nivel que no se alcanzó
  const precisionPedida = exigencia.precision[siguiente]!;
  const ppmPedidas = exigencia.ppm[siguiente]!;

  // Si falla la precisión, eso es lo que hay que arreglar: ir más rápido con
  // errores no sube ninguna estrella.
  if (medidas.precision < precisionPedida) {
    return { falta: 'precision', objetivo: precisionPedida };
  }
  return { falta: 'velocidad', objetivo: ppmPedidas };
}

/**
 * Si un resultado es creíble.
 *
 * El navegador mide el tiempo y cuenta las pulsaciones, así que puede mentir. No
 * se puede evitar del todo —el teclado está en su máquina— pero sí se puede
 * rechazar lo imposible: 300 PPM, un texto de cien caracteres escrito en dos
 * segundos, o más caracteres correctos de los que tiene la lección.
 */
export function esCreible(intento: Intento, caracteresDelTexto: number): boolean {
  if (intento.correctos < 0 || intento.errores < 0 || intento.milisegundos <= 0) return false;
  if (intento.correctos > caracteresDelTexto) return false;
  if (intento.milisegundos > 60 * 60 * 1000) return false;

  return medir(intento).ppm <= PPM_MAXIMAS_CREIBLES;
}
