/**
 * Evaluacion de objetivos y calculo de estrellas.
 *
 * Vive en el paquete compartido porque el servidor tiene que recalcular las
 * estrellas por su cuenta: el cliente propone, el servidor decide. Portado del
 * criterio de Codexia (useLevelRunner.ts), que distingue dos medidas:
 *
 *   - maxFichas         -> tamano del programa ESCRITO. Premia usar bucles y
 *                          funciones en vez de repetir fichas.
 *   - maxInstrucciones  -> acciones EJECUTADAS. Premia encontrar el camino
 *                          mas corto.
 *
 * Un nivel puede exigir las dos cosas a la vez para su tercera estrella.
 */
import type { Accion, Celda, CriteriosEstrella, ItemNivel, Objetivo } from '../types/runtime.js';

import { reproducirAcciones, type EstadoFuzz, type OpcionesSimulador } from './GridSimulator.js';

export interface ResultadoObjetivos {
  /** Objetivo id -> cumplido o no. */
  readonly cumplidos: Readonly<Record<string, boolean>>;
  readonly estado: EstadoFuzz;
  readonly celdasVisitadas: readonly Celda[];
  /** false si las acciones no son reproducibles sobre este tablero. */
  readonly valida: boolean;
}

/** Comprueba que se recogieron los items en el orden exigido. */
function ordenCorrecto(recogidos: readonly string[], esperado: readonly string[]): boolean {
  if (recogidos.length < esperado.length) return false;
  return esperado.every((id, i) => recogidos[i] === id);
}

/**
 * Evalua los objetivos de una actividad reproduciendo las acciones enviadas.
 * Es la funcion que ejecuta el backend antes de conceder estrellas.
 */
export function evaluarObjetivos(
  opciones: OpcionesSimulador,
  acciones: readonly Accion[],
  objetivos: readonly Objetivo[],
  items: readonly ItemNivel[],
): ResultadoObjetivos {
  const { estado, celdasVisitadas, valida } = reproducirAcciones(opciones, acciones);
  const cumplidos: Record<string, boolean> = {};

  // Si la reproduccion no es valida, ningun objetivo se da por cumplido.
  if (!valida) {
    for (const obj of objetivos) cumplidos[obj.id] = false;
    return { cumplidos, estado, celdasVisitadas, valida: false };
  }

  const paso = (x: number, y: number): boolean =>
    celdasVisitadas.some((c) => c.x === x && c.y === y);

  for (const obj of objetivos) {
    switch (obj.tipo) {
      case 'alcanzar_celda':
        cumplidos[obj.id] =
          obj.x !== undefined && obj.y !== undefined && estado.x === obj.x && estado.y === obj.y;
        break;

      case 'recoger_item':
        cumplidos[obj.id] = obj.itemId !== undefined && estado.recogidos.includes(obj.itemId);
        break;

      case 'recoger_todos':
        cumplidos[obj.id] =
          items.length > 0 && items.every((i) => estado.recogidos.includes(i.id));
        break;

      case 'orden_recoleccion':
        cumplidos[obj.id] = obj.orden !== undefined && ordenCorrecto(estado.recogidos, obj.orden);
        break;

      case 'activar_palanca':
        cumplidos[obj.id] =
          acciones.some((a) => a.cmd === 'activarPalanca') &&
          obj.x !== undefined &&
          obj.y !== undefined &&
          paso(obj.x, obj.y);
        break;

      case 'evitar_choque':
        cumplidos[obj.id] = estado.vivo;
        break;

      default:
        cumplidos[obj.id] = false;
    }
  }

  return { cumplidos, estado, celdasVisitadas, valida: true };
}

export interface MedidasPrograma {
  /** Tamano del programa escrito: fichas, bloques o lineas de codigo. */
  readonly tamanoPrograma: number;
  /** Acciones realmente ejecutadas. */
  readonly instruccionesEjecutadas: number;
  readonly tiempoSegundos?: number;
  /** Estructuras usadas (repetir, funcion...), para los mundos de eficiencia. */
  readonly estructurasUsadas?: readonly string[];
}

/**
 * Calcula cuantas estrellas merece un intento: de 3 a 0, quedandose con el
 * primer criterio que se cumpla por completo.
 */
export function calcularEstrellas(
  criterios: CriteriosEstrella,
  cumplidos: Readonly<Record<string, boolean>>,
  medidas: MedidasPrograma,
): number {
  const cumpleNivel = (nivel: '1' | '2' | '3'): boolean => {
    const criterio = criterios[nivel];

    if (!criterio.objetivos.every((id) => cumplidos[id])) return false;

    if (criterio.maxFichas !== undefined && medidas.tamanoPrograma > criterio.maxFichas) {
      return false;
    }
    if (
      criterio.maxInstrucciones !== undefined &&
      medidas.instruccionesEjecutadas > criterio.maxInstrucciones
    ) {
      return false;
    }
    if (
      criterio.tiempoMaxSeg !== undefined &&
      medidas.tiempoSegundos !== undefined &&
      medidas.tiempoSegundos > criterio.tiempoMaxSeg
    ) {
      return false;
    }
    if (criterio.requiereEstructuras?.length) {
      const usadas = medidas.estructurasUsadas ?? [];
      if (!criterio.requiereEstructuras.every((e) => usadas.includes(e))) return false;
    }
    return true;
  };

  if (cumpleNivel('3')) return 3;
  if (cumpleNivel('2')) return 2;
  if (cumpleNivel('1')) return 1;
  return 0;
}

/**
 * Cuenta el tamano de un programa escrito en texto: lineas con contenido real,
 * sin comentarios ni llaves sueltas. Un bucle cuenta poco aunque ejecute mucho,
 * que es justo lo que queremos premiar.
 */
export function contarTamanoTexto(codigo: string): number {
  return codigo
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith('//') && !l.startsWith('#'))
    .filter((l) => l !== '{' && l !== '}').length;
}

/** Recompensa en monedas, proporcional a las estrellas obtenidas. */
export function monedasPorEstrellas(monedasBase: number, estrellas: number): number {
  if (estrellas <= 0) return 0;
  return Math.round((monedasBase * estrellas) / 3);
}
