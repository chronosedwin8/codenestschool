/**
 * Contrato de ejecucion compartido entre el sandbox (Web Worker), el
 * renderizador (Phaser) y el backend (que recalcula estrellas sin ejecutar
 * codigo del usuario, re-simulando unicamente las acciones).
 *
 * Portado y generalizado de Codexia: frontend/src/game/types.ts y
 * frontend/src/workers/codeRunner.worker.ts.
 */
import type { ComandoFuzz, LenguajeCodigo } from './editor.js';

export type Direccion = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

/**
 * Modo de movimiento del Fuzz.
 * - `rodar`: cada ficha desplaza al Fuzz hasta chocar o salir del camino
 *   (mecanica original de Kodable, mundos 1-10).
 * - `paso`: cada comando avanza exactamente una casilla (mundos 11-30).
 */
export type ModoMovimiento = 'rodar' | 'paso';

export interface Celda {
  readonly x: number;
  readonly y: number;
}

/** Color de casilla para los condicionales visuales del Mundo 2. */
export type ColorCasilla = 'rojo' | 'azul' | 'verde' | 'amarillo' | 'magenta' | 'naranja';

export type TipoTile =
  | 'camino'
  | 'vacio'
  | 'pared'
  | 'agujero'
  | 'charco'
  | 'hielo'
  | 'viento'
  | 'meta';

export interface Tile {
  readonly t: TipoTile;
  readonly color?: ColorCasilla;
  /** Direccion del viento o del deslizamiento en hielo. */
  readonly dir?: Direccion;
}

export interface Grid {
  readonly cols: number;
  readonly rows: number;
  readonly tiles: readonly (readonly Tile[])[];
}

export type TipoItem = 'estrella' | 'moneda' | 'gema' | 'llave' | 'bateria' | 'pieza';

export interface ItemNivel extends Celda {
  readonly id: string;
  readonly tipo: TipoItem;
  /** Color requerido (llaves del Mundo 15: llaveAzul AND llaveRoja). */
  readonly color?: ColorCasilla;
}

export interface ActorNivel {
  readonly id: string;
  readonly tipo: 'rodador' | 'enemigo' | 'dron';
  readonly ruta: readonly (readonly [number, number])[];
  readonly periodo: number;
}

export interface Spawn extends Celda {
  readonly dir: Direccion;
}

/**
 * Una accion ejecutada por el programa del nino. Es el unico formato que el
 * servidor considera confiable: recalcula estrellas re-simulando estas
 * acciones, nunca ejecutando el codigo enviado.
 *
 * `desde`/`hasta`/`celdasRecorridas` son necesarios para el modo `rodar`,
 * donde una sola ficha puede atravesar varias casillas.
 */
export interface Accion {
  readonly cmd: ComandoFuzz | string;
  readonly desde?: Celda;
  readonly hasta?: Celda;
  readonly celdasRecorridas?: readonly Celda[];
  readonly dir?: Direccion;
  readonly itemId?: string;
  readonly exito?: boolean;
  readonly datos?: Readonly<Record<string, unknown>>;
}

export type TipoObjetivo =
  | 'alcanzar_celda'
  | 'recoger_item'
  | 'recoger_todos'
  | 'activar_palanca'
  | 'evitar_choque'
  | 'orden_recoleccion';

export interface Objetivo {
  readonly id: string;
  readonly tipo: TipoObjetivo;
  readonly x?: number;
  readonly y?: number;
  readonly itemId?: string;
  /** Para `orden_recoleccion`: secuencia exacta de items esperada. */
  readonly orden?: readonly string[];
  readonly obligatorio: boolean;
}

/** Criterio para otorgar 1, 2 o 3 estrellas. */
export interface CriterioEstrella {
  readonly objetivos: readonly string[];
  /** Tamano maximo del programa ESCRITO (premia bucles y funciones). */
  readonly maxFichas?: number;
  /** Acciones EJECUTADAS como maximo (premia el camino optimo). */
  readonly maxInstrucciones?: number;
  readonly tiempoMaxSeg?: number;
  /** Mundo 29: exige usar cierta estructura (p. ej. una funcion). */
  readonly requiereEstructuras?: readonly string[];
}

export interface CriteriosEstrella {
  readonly '1': CriterioEstrella;
  readonly '2': CriterioEstrella;
  readonly '3': CriterioEstrella;
}

/** Mensaje que el hilo principal envia al Web Worker del sandbox. */
export interface WorkerRequest {
  readonly codigo: string;
  readonly lenguaje: LenguajeCodigo;
  readonly apiPermitida: readonly string[];
  readonly topeEjecucion: number;
  readonly modoMovimiento: ModoMovimiento;
  readonly grid: Grid;
  readonly spawn: Spawn;
  readonly items: readonly ItemNivel[];
}

export interface ErrorEjecucion {
  /** Mensaje amable para el nino, nunca una traza tecnica. */
  readonly mensaje: string;
  readonly linea?: number;
  readonly codigo?: 'choque' | 'limite' | 'timeout' | 'sintaxis' | 'comando_no_permitido' | 'caida';
}

export interface WorkerResponse {
  readonly ok: boolean;
  readonly acciones?: readonly Accion[];
  readonly error?: ErrorEjecucion;
  readonly accionesParciales?: readonly Accion[];
  readonly instruccionesEjecutadas?: number;
}

/**
 * Abstraccion del renderizador para que la logica del juego no dependa de
 * Phaser. Portada de Codexia (`IRenderer`), permite sustituir el motor sin
 * tocar el sandbox ni el calculo de estrellas.
 */
export interface IRenderer {
  cargarNivel(config: unknown): Promise<void> | void;
  reproducirAccion(accion: Accion): Promise<void>;
  reiniciar(): void;
  resaltarObjetivo(id: string): void;
  celebrar(estrellas: number): Promise<void>;
  animarChoque(): Promise<void>;
  destruir(): void;
}
