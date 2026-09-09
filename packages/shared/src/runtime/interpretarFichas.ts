/**
 * Intérprete de programas de fichas.
 *
 * Ejecuta un `PasoPrograma[]` contra el simulador. Vive en el paquete compartido
 * porque tres sitios necesitan exactamente la misma semántica:
 *
 *  - `validate-content`, para comprobar que cada solución de referencia otorga
 *    las tres estrellas,
 *  - las pruebas del simulador,
 *  - y el traductor de fichas a JavaScript del cliente, que debe producir código
 *    que haga lo mismo que esto.
 *
 * Si esta lógica estuviera duplicada en el validador, una actividad podría pasar
 * la validación y ser imposible de completar en el juego real, o al contrario. Es
 * el tipo de divergencia que solo se descubre cuando un niño se atasca.
 */
import type { PasoPrograma } from '../types/activity.js';

import { ErrorJuego, type GridSimulator } from './GridSimulator.js';

export interface ResultadoInterpretacion {
  /** Tamaño del programa ESCRITO: es lo que mide la tercera estrella. */
  readonly tamano: number;
  readonly estructuras: readonly string[];
}

/** Cuenta las fichas de un programa, incluidas las anidadas. */
export function contarFichas(pasos: readonly PasoPrograma[]): number {
  return pasos.reduce(
    (total, paso) =>
      total + 1 + contarFichas(paso.hijos ?? []) + contarFichas(paso.sino ?? []),
    0,
  );
}

/**
 * Ejecuta un programa de fichas.
 *
 * `funciones` guarda los grupos declarados (el "super salto" del mundo 7) para
 * poder llamarlos más de una vez.
 */
function ejecutar(
  sim: GridSimulator,
  pasos: readonly PasoPrograma[],
  estructuras: Set<string>,
  funciones: Map<string, readonly PasoPrograma[]>,
  profundidad = 0,
): void {
  // Un programa anidado sin fin no debe agotar la pila de la máquina.
  if (profundidad > 20) {
    throw new ErrorJuego('El programa se anida demasiado.', 'limite');
  }

  for (const paso of pasos) {
    switch (paso.cmd) {
      // ── Movimiento ──
      case 'derecha':
      case 'izquierda':
      case 'arriba':
      case 'abajo':
        sim.mover(paso.cmd);
        break;
      case 'avanzar':
        sim.avanzar();
        break;
      case 'girarDerecha':
        sim.girarDerecha();
        break;
      case 'girarIzquierda':
        sim.girarIzquierda();
        break;
      case 'saltar':
        sim.saltar();
        break;
      case 'recoger':
        sim.recoger();
        break;

      // ── Bucle contado ──
      case 'repetir': {
        estructuras.add('repetir');
        const veces = Math.min(Math.max(1, paso.veces ?? 1), 100);
        for (let i = 0; i < veces; i++) {
          ejecutar(sim, paso.hijos ?? [], estructuras, funciones, profundidad + 1);
        }
        break;
      }

      // ── Condicional por color de casilla (mundo 2) ──
      case 'siColor': {
        estructuras.add('siColor');
        const esperado = paso.color ?? 'rojo';
        if (sim.colorCasilla() === esperado) {
          ejecutar(sim, paso.hijos ?? [], estructuras, funciones, profundidad + 1);
        } else {
          ejecutar(sim, paso.sino ?? [], estructuras, funciones, profundidad + 1);
        }
        break;
      }

      // ── Condicional por camino libre (mundo 6) ──
      case 'siSino': {
        estructuras.add('siSino');
        if (sim.puedeAvanzar()) {
          ejecutar(sim, paso.hijos ?? [], estructuras, funciones, profundidad + 1);
        } else {
          ejecutar(sim, paso.sino ?? [], estructuras, funciones, profundidad + 1);
        }
        break;
      }

      // ── Declaración de un grupo de fichas (mundo 7) ──
      case 'funcion': {
        estructuras.add('funcion');
        // Declarar no ejecuta: solo guarda el grupo para poder llamarlo.
        funciones.set(paso.nombre ?? 'superSalto', paso.hijos ?? []);
        break;
      }

      // ── Llamada a un grupo declarado ──
      case 'llamar': {
        const nombre = paso.nombre ?? 'superSalto';
        const cuerpo = funciones.get(nombre);
        if (!cuerpo) {
          throw new ErrorJuego(
            `Todavia no has creado el bloque "${nombre}".`,
            'comando_no_permitido',
          );
        }
        ejecutar(sim, cuerpo, estructuras, funciones, profundidad + 1);
        break;
      }

      default:
        throw new ErrorJuego(
          `El Fuzz no sabe hacer "${paso.cmd}".`,
          'comando_no_permitido',
        );
    }
  }
}

/**
 * Interpreta un programa de fichas contra el simulador.
 * Lanza `ErrorJuego` si el programa choca o usa algo que no existe.
 */
export function interpretarFichas(
  sim: GridSimulator,
  pasos: readonly PasoPrograma[],
): ResultadoInterpretacion {
  const estructuras = new Set<string>();
  const funciones = new Map<string, readonly PasoPrograma[]>();

  ejecutar(sim, pasos, estructuras, funciones);

  return { tamano: contarFichas(pasos), estructuras: [...estructuras] };
}
