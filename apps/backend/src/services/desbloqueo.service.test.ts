/**
 * La regla de desbloqueo, sin base de datos.
 *
 * Se prueba aparte porque es la unica pieza que deciden a la vez el mapa y la
 * tienda: si el Pase del Nido y el mapa no coinciden, el nino paga treinta
 * estrellas por un mundo que sigue con candado.
 */
import { describe, expect, it } from 'vitest';

import {
  mundosAbiertos,
  mundosCompletados,
  primerMundoCerrado,
  type MundoParaDesbloqueo,
} from './desbloqueo.service.js';

/** Tres mundos por grupo, para que quepa un caso de cada cosa. */
function mundos(completadasPorMundo: Record<number, number>): MundoParaDesbloqueo[] {
  const grupoDe = (n: number): string =>
    n <= 3 ? 'exploradores' : n <= 6 ? 'creadores' : 'hackers';

  return Array.from({ length: 9 }, (_, i) => ({
    numero: i + 1,
    grupoEdad: grupoDe(i + 1),
    completadas: completadasPorMundo[i + 1] ?? 0,
    total: 20,
  }));
}

describe('que mundos estan abiertos', () => {
  it('abre el primero de cada grupo aunque no haya jugado nada', () => {
    const abiertos = mundosAbiertos(mundos({}));
    // Un nino de diez anos entra por el mundo 7, no por el de cuatro anos.
    expect([...abiertos].sort((a, b) => a - b)).toEqual([1, 4, 7]);
  });

  it('abre el siguiente solo cuando el anterior esta completo', () => {
    expect(mundosAbiertos(mundos({ 1: 19 })).has(2)).toBe(false);
    expect(mundosAbiertos(mundos({ 1: 20 })).has(2)).toBe(true);
  });

  it('un mundo terminado de otro grupo no abre nada en este', () => {
    const abiertos = mundosAbiertos(mundos({ 1: 20 }));
    expect(abiertos.has(2)).toBe(true);
    expect(abiertos.has(5)).toBe(false);
  });

  it('el pase abre un mundo concreto sin tocar la cuenta normal', () => {
    const abiertos = mundosAbiertos(mundos({}), { mundosExtra: [2] });
    expect(abiertos.has(2)).toBe(true);
    // Y solo ese: el pase no es una llave maestra.
    expect(abiertos.has(3)).toBe(false);
  });

  it('el adulto ve el curriculo entero', () => {
    expect(mundosAbiertos(mundos({}), { esAdulto: true }).size).toBe(9);
  });

  it('un mundo sin actividades no cuenta como terminado', () => {
    const vacio: MundoParaDesbloqueo[] = [
      { numero: 1, grupoEdad: 'exploradores', completadas: 0, total: 0 },
      { numero: 2, grupoEdad: 'exploradores', completadas: 0, total: 20 },
    ];
    expect(mundosCompletados(vacio).has(1)).toBe(false);
  });
});

describe('que abre un Pase del Nido', () => {
  it('el primer mundo cerrado de su grupo', () => {
    expect(primerMundoCerrado(mundos({}), 'exploradores')).toBe(2);
    expect(primerMundoCerrado(mundos({ 1: 20 }), 'exploradores')).toBe(3);
  });

  it('nada si ya los tiene todos abiertos', () => {
    const todos = mundos({ 1: 20, 2: 20, 3: 20 });
    expect(primerMundoCerrado(todos, 'exploradores')).toBeNull();
  });

  it('no cuenta el mundo que ya abrio con otro pase', () => {
    expect(primerMundoCerrado(mundos({}), 'exploradores', { mundosExtra: [2] })).toBe(3);
  });
});
