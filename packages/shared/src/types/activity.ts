/**
 * Formato de actividad v3. Evoluciona el formato v2 de Codexia
 * (frontend/src/game/types.ts) para soportar tres grupos de edad, el modo
 * "rodar" de Kodable y las claves de audio de ElevenLabs.
 *
 * Los textos narrados NO viven aqui: son columnas de la tabla `actividades`
 * (`instruccion_texto`, `exito_texto`) y de `pistas`, para que el generador de
 * voz y el panel docente los consulten sin abrir el JSONB.
 */
import type { GrupoEdad } from './age-group.js';
import type { LenguajeCodigo, TipoEditor } from './editor.js';
import type {
  ActorNivel,
  ColorCasilla,
  CriteriosEstrella,
  Grid,
  ItemNivel,
  ModoMovimiento,
  Objetivo,
  Spawn,
} from './runtime.js';

export const TIPO_ACTIVIDAD = {
  recorrido: 'recorrido',
  recoleccion: 'recoleccion',
  debug: 'debug',
  integrador: 'integrador',
  jefe: 'jefe',
} as const;

export type TipoActividad = (typeof TIPO_ACTIVIDAD)[keyof typeof TIPO_ACTIVIDAD];

/** Referencias de audio de la actividad (claves, no rutas). */
export interface AudioActividad {
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly string[];
}

export interface RecompensaActividad {
  readonly monedas: number;
  readonly gemas?: number;
}

/**
 * Un paso de programa. Se usa en el programa prefijado con errores a corregir
 * (mundos 9 y 19) y en las soluciones de referencia de las actividades de fichas.
 */
export interface PasoPrograma {
  readonly cmd: string;
  /** Repeticiones de un bucle. */
  readonly veces?: number;
  /** Pasos anidados dentro de un bucle, un condicional o una funcion. */
  readonly hijos?: readonly PasoPrograma[];
  /** Rama alternativa de un condicional si / si no. */
  readonly sino?: readonly PasoPrograma[];
  /** Color que dispara un condicional de casilla (mundo 2). */
  readonly color?: ColorCasilla;
  /** Nombre del grupo de fichas, para declararlo y luego llamarlo. */
  readonly nombre?: string;
}

/** Contenido de `Activity.config` en la base de datos. */
export interface ActivityConfigV3 {
  readonly version: 3;
  readonly grupo: GrupoEdad;
  readonly editor: TipoEditor;
  readonly lenguajes: readonly LenguajeCodigo[];
  readonly modoMovimiento: ModoMovimiento;
  readonly grid: Grid;
  readonly spawn: Spawn;
  readonly items: readonly ItemNivel[];
  readonly actores?: readonly ActorNivel[];
  readonly comandosPermitidos: readonly string[];
  readonly bloquesDisponibles: readonly string[];
  readonly codigoInicial?: Readonly<Partial<Record<LenguajeCodigo, string>>>;
  readonly programaPrefijado?: readonly PasoPrograma[];
  readonly objetivos: readonly Objetivo[];
  readonly criteriosEstrella: CriteriosEstrella;
  readonly audio: AudioActividad;
  /** Animacion de demostracion para prelectores (sustituye al texto). */
  readonly demoAnimada?: string;
  readonly recompensa: RecompensaActividad;
  readonly topeEjecucion: number;
}

/** Solucion de referencia; `validate-content` exige que otorgue 3 estrellas. */
export interface SolucionReferencia {
  readonly comandos?: readonly PasoPrograma[];
  readonly javascript?: string;
  readonly python?: string;
  /**
   * Bloques que ocupa la solucion en el editor de Blockly (mundos 11 al 20).
   *
   * Hace falta porque las dos partes miden el programa en unidades distintas: el
   * editor cuenta bloques y el validador, que solo tiene el JavaScript, contaria
   * lineas. Un `repetir` con dos bloques dentro son tres bloques y cuatro lineas,
   * asi que sin este dato el limite de la tercera estrella se aflojaria sin que
   * nadie lo notara.
   */
  readonly bloques?: number;
}

/** Actividad tal como se escribe en packages/content/worlds/*.json. */
export interface ActivityDefinition {
  readonly numeroEnMundo: number;
  readonly slug: string;
  readonly nombre: string;
  readonly tipo: TipoActividad;
  readonly dificultad: number;
  readonly instruccionTexto: string;
  readonly exitoTexto: string;
  readonly pistas: readonly string[];
  readonly config: ActivityConfigV3;
  readonly solucionReferencia: SolucionReferencia;
}

/** Archivo de un mundo completo: 20 actividades. */
export interface WorldContentFile {
  readonly mundo: number;
  readonly slug: string;
  readonly nombre: string;
  readonly introTexto: string;
  readonly actividades: readonly ActivityDefinition[];
}

export const ACTIVIDADES_POR_MUNDO = 20;
export const TOTAL_MUNDOS = 30;
export const TOTAL_ACTIVIDADES = ACTIVIDADES_POR_MUNDO * TOTAL_MUNDOS;

/** Numero global (1-600) a partir del mundo y la posicion en el mundo. */
export function numeroGlobal(mundo: number, numeroEnMundo: number): number {
  return (mundo - 1) * ACTIVIDADES_POR_MUNDO + numeroEnMundo;
}

/** Inverso: de numero global (1-600) a mundo y posicion. */
export function desdeNumeroGlobal(global: number): { mundo: number; numeroEnMundo: number } {
  return {
    mundo: Math.ceil(global / ACTIVIDADES_POR_MUNDO),
    numeroEnMundo: ((global - 1) % ACTIVIDADES_POR_MUNDO) + 1,
  };
}
