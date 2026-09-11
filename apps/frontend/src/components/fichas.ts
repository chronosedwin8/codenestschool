/**
 * Las fichas con las que programan los prelectores: qué existe y de qué color es.
 *
 * Vive fuera del componente porque `<script setup>` no puede exportar valores, y
 * esta tabla necesita comprobarse: si falta un comando que el currículo usa, el
 * componente lee `undefined.fondo` al montarse y no se cae una ficha, se cae el
 * editor entero y con él la actividad. Paso con `llamar` y dejó sesenta
 * actividades sin poder jugarse.
 */

export type ClaseFicha =
  | 'derecha'
  | 'izquierda'
  | 'arriba'
  | 'abajo'
  | 'saltar'
  | 'recoger'
  | 'repetir'
  | 'siColor'
  | 'siSino'
  | 'funcion'
  | 'llamar';

export interface TonoFicha {
  readonly fondo: string;
  readonly borde: string;
}

/** Cada comando tiene su color propio, constante en toda la aplicación. */
export const TONOS_FICHA: Record<ClaseFicha, TonoFicha> = {
  derecha: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  izquierda: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  arriba: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  abajo: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  saltar: { fondo: 'var(--verde-cesped)', borde: 'var(--verde-cesped-oscuro)' },
  recoger: { fondo: 'var(--amarillo)', borde: 'var(--amarillo-oscuro)' },
  repetir: { fondo: 'var(--naranja)', borde: 'var(--naranja-oscuro)' },
  siColor: { fondo: 'var(--magenta)', borde: 'var(--magenta-oscuro)' },
  siSino: { fondo: 'var(--magenta)', borde: 'var(--magenta-oscuro)' },
  funcion: { fondo: 'var(--morado)', borde: 'var(--morado-oscuro)' },
  // `funcion` define el Super salto y `llamar` lo usa. Aparecen SIEMPRE juntas en
  // las mismas sesenta actividades, así que no pueden verse igual: comparten
  // familia de color y cambia el tono.
  llamar: { fondo: 'var(--pieza-morado)', borde: 'var(--pieza-morado-bisel)' },
};

/** Giro de la flecha según la dirección. Solo las cuatro direcciones lo tienen. */
export const GIRO_FICHA: Partial<Record<ClaseFicha, number>> = {
  derecha: 0,
  abajo: 90,
  izquierda: 180,
  arriba: 270,
};
