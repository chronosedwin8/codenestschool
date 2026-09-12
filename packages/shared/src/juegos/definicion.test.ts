/**
 * La definición de un juego, probada por donde entra lo de fuera.
 *
 * Lo que se guarda viene del navegador de un niño, y un navegador se manipula
 * con las herramientas de desarrollo abiertas. Si esta frontera cede, un juego
 * publicado puede apuntar a cualquier imagen de internet y aparecer en una zona
 * que ven otros menores: eso es lo que se prueba aquí, no el camino feliz.
 */
import { describe, expect, it } from 'vitest';

import {
  COMBINACIONES,
  LIMITES,
  juegoDePartida,
  revisarJuego,
  sortearTitulo,
  tituloValido,
  type DefinicionJuego,
} from './index.js';
import { definicionJuegoSchema, leerDefinicionJuego } from '../zod/juego.js';

/** El juego de partida con un cambio, para probar un caso concreto. */
function conCambio(cambio: Partial<DefinicionJuego>): unknown {
  return { ...juegoDePartida(), ...cambio };
}

describe('el juego de partida', () => {
  it('es valido y se puede jugar tal cual', () => {
    const def = leerDefinicionJuego(juegoDePartida());
    expect(def.version).toBe(1);
    expect(def.obstaculos.length).toBeGreaterThan(0);
    expect(def.premios.length).toBeGreaterThan(0);
  });

  it('no tiene ni un aviso: se gana, se pierde y hay reto', () => {
    // Si el juego de partida tuviera avisos, el constructor recibiria a cada
    // nino con una lista de problemas que no ha creado el.
    expect(revisarJuego(juegoDePartida())).toEqual([]);
  });
});

describe('lo que el servidor no acepta', () => {
  it('un escenario que no esta en el catalogo', () => {
    expect(definicionJuegoSchema.safeParse(conCambio({ escenario: 'mordor' as never })).success).toBe(
      false,
    );
  });

  it('un color fuera de la paleta', () => {
    const def = juegoDePartida();
    const manipulado = { ...def, jugador: { ...def.jugador, color: '#000000' } };
    expect(definicionJuegoSchema.safeParse(manipulado).success).toBe(false);
  });

  it('un personaje inventado', () => {
    const def = juegoDePartida();
    const manipulado = { ...def, jugador: { ...def.jugador, personaje: 'goku' as never } };
    expect(definicionJuegoSchema.safeParse(manipulado).success).toBe(false);
  });

  it('mas obstaculos de los que caben en la pantalla', () => {
    const uno = juegoDePartida().obstaculos[0]!;
    const muchos = Array.from({ length: LIMITES.obstaculos + 1 }, (_, i) => ({
      ...uno,
      id: `o${i + 1}`,
    }));
    expect(definicionJuegoSchema.safeParse(conCambio({ obstaculos: muchos })).success).toBe(false);
  });

  it('dos obstaculos con el mismo identificador', () => {
    const uno = juegoDePartida().obstaculos[0]!;
    // Borrar uno en el constructor se llevaria los dos.
    expect(definicionJuegoSchema.safeParse(conCambio({ obstaculos: [uno, uno] })).success).toBe(
      false,
    );
  });

  it('un premio que da mil puntos', () => {
    const def = juegoDePartida();
    const manipulado = { ...def, premios: [{ ...def.premios[0]!, puntos: 5000 }] };
    expect(definicionJuegoSchema.safeParse(manipulado).success).toBe(false);
  });

  it('cien vidas', () => {
    const def = juegoDePartida();
    const manipulado = { ...def, jugador: { ...def.jugador, vidas: 100 } };
    expect(definicionJuegoSchema.safeParse(manipulado).success).toBe(false);
  });

  it('una partida por tiempo de dos horas', () => {
    expect(
      definicionJuegoSchema.safeParse(conCambio({ meta: { tipo: 'tiempo', valor: 7200 } })).success,
    ).toBe(false);
  });

  it('un campo de mas no cuela como imagen propia', () => {
    // El caso que importa de verdad: colar una URL en la definicion.
    const manipulado = { ...juegoDePartida(), fondoUrl: 'https://sitio-ajeno.example/x.jpg' };
    const leido = definicionJuegoSchema.parse(manipulado) as Record<string, unknown>;
    expect(leido.fondoUrl).toBeUndefined();
  });
});

describe('los avisos de si el juego tiene sentido', () => {
  it('avisa cuando la meta son puntos y no hay premios', () => {
    const avisos = revisarJuego({ ...juegoDePartida(), premios: [] });
    expect(avisos.map((a) => a.clave)).toContain('sin-premios');
  });

  it('avisa cuando no hay forma de ganar', () => {
    const def = juegoDePartida();
    const sinVictoria = { ...def, reglas: def.reglas.filter((r) => r.entonces !== 'ganar') };
    expect(revisarJuego(sinVictoria).map((a) => a.clave)).toContain('sin-victoria');
  });

  it('avisa cuando no hay forma de perder', () => {
    const def = juegoDePartida();
    const sinRiesgo = {
      ...def,
      reglas: def.reglas.filter((r) => r.entonces !== 'perder' && r.entonces !== 'quitarVida'),
    };
    expect(revisarJuego(sinRiesgo).map((a) => a.clave)).toContain('sin-derrota');
  });

  it('avisa cuando no hay obstaculos', () => {
    expect(revisarJuego({ ...juegoDePartida(), obstaculos: [] }).map((a) => a.clave)).toContain(
      'sin-obstaculos',
    );
  });
});

describe('el sorteo de titulos', () => {
  it('da titulos que el servidor reconoce', () => {
    for (let i = 0; i < 200; i++) {
      const titulo = sortearTitulo();
      expect(tituloValido(titulo)).toBe(true);
      expect(titulo.length).toBeLessThanOrEqual(40);
    }
  });

  it('rechaza cualquier cosa escrita a mano', () => {
    // Es la razon de ser del sorteo: sin esto, la zona de juegos publicados
    // seria texto libre escrito por menores y leido por menores.
    expect(tituloValido('El juego de Pedro')).toBe(false);
    expect(tituloValido('tonto')).toBe(false);
    expect(tituloValido('')).toBe(false);
    expect(tituloValido('Veloz Cohete')).toBe(false);
    expect(tituloValido('Veloz Cohete Inventado')).toBe(false);
  });

  it('tiene variedad de sobra para un colegio entero', () => {
    // Con 20x20x16 nadie se queda sin nombre distinto en un aula.
    expect(COMBINACIONES).toBeGreaterThan(5000);
    const cien = new Set(Array.from({ length: 100 }, () => sortearTitulo()));
    expect(cien.size).toBeGreaterThan(80);
  });
});
