/**
 * Generadores de los Hackers (mundos 21 al 30), que escriben código de verdad.
 *
 * Aquí desaparece el andamio: no hay piezas que encajen solo donde deben, así que
 * un paréntesis olvidado ya es un error de sintaxis. Eso cambia dos cosas del
 * diseño y las dos están resueltas en este archivo.
 *
 * La primera es que las actividades vienen con código de arranque. Un niño de diez
 * años que ve un editor vacío no escribe nada; uno que ve tres líneas y un
 * comentario que dice "escribe aquí" escribe. El arranque no es una ayuda opcional,
 * es parte del ejercicio, y por eso lo pide el generador y no es un extra.
 *
 * La segunda es que el mismo tablero se resuelve en dos lenguajes. Las dos
 * soluciones se escriben a mano, porque el objetivo del grupo es precisamente que
 * el niño escriba, y traducir una a la otra automáticamente produciría código que
 * ningún humano escribiría. `validate-content` ejecuta las dos por separado: antes
 * comprobaba solo la primera, y una solución de Python rota pasaba desapercibida.
 *
 * El tablero se dibuja con el mismo generador que los Creadores. Lo que cambia es
 * el editor y el lenguaje, no la geometría: el Fuzz sigue avanzando de casilla en
 * casilla y girando, y eso es a propósito. Un niño que llega al mundo 21 reconoce
 * el tablero y solo tiene que aprender a escribir lo que antes arrastraba.
 */
import {
  claveInstruccion,
  clavePista,
  numeroGlobal,
  type ActivityDefinition,
  type Direccion,
  type GrupoEdad,
  type LenguajeCodigo,
  type Objetivo,
  type TipoActividad,
} from '@codenest/shared';

import { slug, type TextosActividad } from './generadores.js';
import { tableroDeCamino, type PasoCamino } from './generadores-creadores.js';

/** Contexto común a todas las actividades de los Hackers. */
export interface ContextoHacker {
  readonly mundo: number;
  readonly numeroEnMundo: number;
  readonly textos: TextosActividad;
}

/**
 * Líneas con contenido real de un programa.
 *
 * Es la medida que usa el editor del niño y por tanto la que compara la tercera
 * estrella. Se descartan los comentarios de los dos lenguajes y las llaves solas,
 * que en JavaScript son puntuación y no programa: si contaran, cerrar una función
 * en su línea saldría más caro que dejarla abierta.
 */
export function lineasDeCodigo(codigo: string): number {
  return codigo
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('#') && l !== '}' && l !== '{',
    ).length;
}

export interface OpcionesHacker {
  readonly camino: readonly PasoCamino[];
  readonly dirInicial?: Direccion;
  /** API del Fuzz que esta actividad permite usar. */
  readonly api: readonly string[];
  /** Solución en JavaScript. Todas la tienen. */
  readonly javascript: string;
  /** Solución en Python, en los mundos que lo admiten. */
  readonly python?: string;
  /** Código con el que arranca el editor, por lenguaje. */
  readonly arranque?: Readonly<Partial<Record<LenguajeCodigo, string>>>;
  /** Líneas máximas para la tercera estrella. Por defecto, las de la solución. */
  readonly maxLineas?: number;
  /** Estructuras que exige la tercera estrella. */
  readonly exigeEstructuras?: readonly string[];
  readonly objetivosExtra?: readonly Objetivo[];
  readonly tipo?: TipoActividad;
  readonly dificultad?: number;
  readonly monedas?: number;
}

/**
 * Crea una actividad de Hackers.
 *
 * El límite de la tercera estrella se mide sobre la solución más larga de las dos:
 * si se midiera sobre la de JavaScript, la misma actividad sería más difícil de
 * puntuar en Python solo porque el lenguaje ocupa otras líneas, y eso no es lo que
 * se quiere evaluar.
 */
export function actividadHacker(
  contexto: ContextoHacker,
  opciones: OpcionesHacker,
): ActivityDefinition {
  const { mundo, numeroEnMundo, textos } = contexto;
  const tablero = tableroDeCamino(
    opciones.camino,
    opciones.dirInicial,
    `M${mundo}-A${numeroEnMundo} "${textos.nombre}"`,
  );

  const objetivos: Objetivo[] = [
    {
      id: 'salida',
      tipo: 'alcanzar_celda',
      x: tablero.meta.x,
      y: tablero.meta.y,
      obligatorio: true,
    },
  ];
  if (tablero.items.length > 0) {
    objetivos.push({ id: 'todas', tipo: 'recoger_todos', obligatorio: false });
  }
  for (const extra of opciones.objetivosExtra ?? []) objetivos.push(extra);

  const conEstrellas = [
    'salida',
    ...(tablero.items.length > 0 ? ['todas'] : []),
    ...(opciones.objetivosExtra ?? []).map((o) => o.id),
  ];

  const lineas = Math.max(
    lineasDeCodigo(opciones.javascript),
    opciones.python ? lineasDeCodigo(opciones.python) : 0,
  );

  const lenguajes: LenguajeCodigo[] = opciones.python ? ['javascript', 'python'] : ['javascript'];

  return {
    numeroEnMundo,
    slug: `m${String(mundo).padStart(2, '0')}-a${String(numeroEnMundo).padStart(2, '0')}-${slug(textos.nombre)}`,
    nombre: textos.nombre,
    tipo: opciones.tipo ?? (tablero.items.length > 0 ? 'recoleccion' : 'recorrido'),
    dificultad: opciones.dificultad ?? Math.min(5, Math.ceil(numeroEnMundo / 4)),
    instruccionTexto: textos.instruccion,
    exitoTexto: textos.exito,
    pistas: textos.pistas,
    config: {
      version: 3,
      grupo: 'hackers' as GrupoEdad,
      editor: 'texto',
      lenguajes,
      modoMovimiento: 'paso',
      grid: tablero.grid,
      spawn: tablero.spawn,
      items: tablero.items,
      comandosPermitidos: [...opciones.api],
      bloquesDisponibles: [],
      ...(opciones.arranque ? { codigoInicial: opciones.arranque } : {}),
      objetivos,
      criteriosEstrella: {
        '1': { objetivos: ['salida'] },
        '2': { objetivos: conEstrellas },
        '3': {
          objetivos: conEstrellas,
          maxFichas: opciones.maxLineas ?? lineas,
          ...(opciones.exigeEstructuras ? { requiereEstructuras: opciones.exigeEstructuras } : {}),
        },
      },
      audio: {
        instruccion: claveInstruccion(mundo, numeroEnMundo),
        exito: `celebration_${((numeroGlobal(mundo, numeroEnMundo) - 1) % 15) + 1}`,
        pistas: textos.pistas.map((_, i) => clavePista(mundo, numeroEnMundo, i + 1)),
      },
      recompensa: { monedas: opciones.monedas ?? 15 + numeroEnMundo },
      topeEjecucion: 8000,
    },
    solucionReferencia: {
      javascript: opciones.javascript,
      ...(opciones.python ? { python: opciones.python } : {}),
    },
  };
}
