/**
 * Pruebas de aislamiento del sandbox.
 *
 * El código que se ejecuta lo escribe un niño, pero también podría escribirlo
 * cualquiera con la consola del navegador abierta. Estas pruebas comprueban las
 * defensas que no dependen del Web Worker (que aquí no existe): el tope de
 * instrucciones, la lista de comandos permitidos y que el estado del juego no se
 * pueda manipular desde el programa.
 *
 * El aislamiento del worker en sí (sin DOM, sin red, sin sesión) es una garantía
 * del navegador y se verifica en las pruebas de extremo a extremo.
 */
import { describe, expect, it } from 'vitest';

import type { Grid, ItemNivel, Spawn } from '../types/runtime.js';

import { ErrorJuego, GridSimulator } from './GridSimulator.js';

const GRID: Grid = {
  cols: 5,
  rows: 3,
  tiles: [
    [{ t: 'vacio' }, { t: 'vacio' }, { t: 'vacio' }, { t: 'vacio' }, { t: 'vacio' }],
    [{ t: 'camino' }, { t: 'camino' }, { t: 'camino' }, { t: 'camino' }, { t: 'meta' }],
    [{ t: 'vacio' }, { t: 'vacio' }, { t: 'vacio' }, { t: 'vacio' }, { t: 'vacio' }],
  ],
};

const SPAWN: Spawn = { x: 0, y: 1, dir: 'derecha' };

function simulador(opciones?: {
  comandos?: readonly string[];
  tope?: number;
  items?: readonly ItemNivel[];
  modo?: 'rodar' | 'paso';
}): GridSimulator {
  return new GridSimulator({
    grid: GRID,
    spawn: SPAWN,
    items: opciones?.items ?? [],
    modo: opciones?.modo ?? 'paso',
    comandosPermitidos: opciones?.comandos ?? ['derecha', 'izquierda', 'arriba', 'abajo'],
    topeEjecucion: opciones?.tope ?? 10_000,
  });
}

/**
 * Reproduce lo que hace el worker: expone la API tras un Proxy que solo deja
 * ver los comandos desbloqueados.
 */
function apiConProxy(sim: GridSimulator, permitidos: readonly string[]): Record<string, unknown> {
  const api: Record<string, unknown> = {
    derecha: () => sim.mover('derecha'),
    izquierda: () => sim.mover('izquierda'),
    arriba: () => sim.mover('arriba'),
    abajo: () => sim.mover('abajo'),
    avanzar: () => sim.avanzar(),
    puedeAvanzar: () => sim.puedeAvanzar(),
  };

  return new Proxy(api, {
    get(objetivo, propiedad) {
      const nombre = String(propiedad);
      if (!permitidos.includes(nombre)) {
        throw new ErrorJuego(
          `El Fuzz todavia no sabe hacer "${nombre}" en esta actividad.`,
          'comando_no_permitido',
        );
      }
      return objetivo[nombre];
    },
    set() {
      return false;
    },
  });
}

describe('bucles infinitos', () => {
  it('corta un bucle sin fin con el tope de instrucciones', () => {
    const sim = simulador({ tope: 50, comandos: ['derecha', 'izquierda'] });

    // Un programa que va y viene para siempre.
    expect(() => {
      for (let i = 0; i < 10_000; i++) {
        try {
          sim.mover(i % 2 === 0 ? 'derecha' : 'izquierda');
        } catch (error) {
          // Los choques contra el borde son normales; solo interesa el tope.
          if ((error as ErrorJuego).codigo === 'limite') throw error;
        }
      }
    }).toThrow(/repite demasiadas veces/);

    expect(sim.totalInstrucciones).toBeLessThanOrEqual(51);
  });

  it('cuenta también las llamadas a los sensores', () => {
    // Un bucle `while (fuzz.puedeAvanzar())` sin avanzar sería infinito si los
    // sensores no contaran contra el tope.
    const sim = simulador({ tope: 20 });

    expect(() => {
      for (let i = 0; i < 1000; i++) sim.puedeAvanzar();
    }).toThrow(/repite demasiadas veces/);
  });
});

describe('comandos no desbloqueados', () => {
  it('impide usar un comando que la actividad no permite', () => {
    const sim = simulador({ comandos: ['derecha'] });
    const fuzz = apiConProxy(sim, ['derecha']);

    // El mundo 1 solo tiene la flecha derecha: pedir `avanzar` no debe colar.
    expect(() => (fuzz as { avanzar: () => void }).avanzar()).toThrow(/todavia no sabe hacer/);
  });

  it('avisa con un mensaje comprensible, no con un error técnico', () => {
    const sim = simulador({ comandos: ['derecha'] });
    const fuzz = apiConProxy(sim, ['derecha']);

    try {
      (fuzz as { saltar: () => void }).saltar();
      expect.unreachable('deberia haber lanzado');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).not.toMatch(/undefined|TypeError|Proxy|prototype/);
      expect(mensaje).toContain('El Fuzz');
    }
  });

  it('no permite añadir comandos nuevos a la API', () => {
    const sim = simulador({ comandos: ['derecha'] });
    const fuzz = apiConProxy(sim, ['derecha']);

    // Intento de inyectar un comando propio.
    expect(() => {
      'use strict';
      (fuzz as unknown as Record<string, unknown>).volar = () => 'trampa';
    }).toThrow();
  });
});

describe('integridad del estado del juego', () => {
  it('no expone el estado interno para modificarlo', () => {
    const sim = simulador();
    const estado = sim.estado;

    // El objeto devuelto es una copia: tocarlo no mueve al Fuzz.
    (estado as { x: number }).x = 99;

    expect(sim.estado.x).toBe(SPAWN.x);
  });

  it('la lista de recogidos que se devuelve es una copia', () => {
    const items: ItemNivel[] = [{ id: 'e1', tipo: 'estrella', x: 1, y: 1 }];
    const sim = simulador({ items });
    sim.mover('derecha');

    const recogidos = sim.estado.recogidos as string[];
    recogidos.push('inventado');

    expect(sim.estado.recogidos).toEqual(['e1']);
  });

  it('no se puede recoger dos veces el mismo objeto', () => {
    const items: ItemNivel[] = [{ id: 'e1', tipo: 'estrella', x: 1, y: 1 }];
    const sim = simulador({ items, comandos: ['derecha', 'izquierda', 'recoger'] });

    sim.mover('derecha');
    sim.recoger();
    sim.recoger();

    expect(sim.estado.recogidos).toEqual(['e1']);
  });
});

describe('limites del tablero', () => {
  it('no deja salir al Fuzz del mapa', () => {
    const sim = simulador({ modo: 'rodar' });
    sim.mover('derecha');

    // Ha llegado al final del pasillo; no puede seguir.
    expect(sim.estado.x).toBe(4);
    expect(() => sim.mover('derecha')).toThrow(ErrorJuego);
  });

  it('trata las coordenadas fuera del mapa como intransitables', () => {
    const sim = simulador();

    expect(sim.esTransitable(-1, 1)).toBe(false);
    expect(sim.esTransitable(99, 1)).toBe(false);
    expect(sim.esTransitable(0, -5)).toBe(false);
  });
});
