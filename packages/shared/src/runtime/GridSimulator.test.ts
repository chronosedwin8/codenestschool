/**
 * Pruebas del simulador de rejilla.
 *
 * Cubren lo que define la experiencia de juego: que rodar funcione como en
 * Kodable, que chocar sea un error amable y no un fallo tecnico, que el tope de
 * instrucciones corte los bucles infinitos, y que el servidor pueda detectar un
 * intento de hacer trampa reproduciendo acciones imposibles.
 */
import { describe, expect, it } from 'vitest';

import type { Accion, Grid, ItemNivel, Spawn } from '../types/runtime.js';

import { ErrorJuego, GridSimulator, reproducirAcciones } from './GridSimulator.js';
import { calcularEstrellas, evaluarObjetivos, monedasPorEstrellas } from './stars.js';

/** Construye una rejilla a partir de un dibujo en texto. */
function rejilla(filas: readonly string[]): Grid {
  const tiles = filas.map((fila) =>
    [...fila].map((c) => {
      switch (c) {
        case '.':
          return { t: 'camino' as const };
        case 'M':
          return { t: 'meta' as const };
        case 'O':
          return { t: 'agujero' as const };
        case 'R':
          return { t: 'camino' as const, color: 'rojo' as const };
        case 'P':
          return { t: 'puente' as const };
        default:
          return { t: 'vacio' as const };
      }
    }),
  );
  return { cols: filas[0]?.length ?? 0, rows: filas.length, tiles };
}

const SPAWN: Spawn = { x: 0, y: 1, dir: 'derecha' };

/** Pasillo recto de 5 casillas con la meta al final. */
const PASILLO = rejilla([
  '     ',
  '....M',
  '     ',
]);

function crear(opciones?: {
  grid?: Grid;
  spawn?: Spawn;
  items?: readonly ItemNivel[];
  modo?: 'rodar' | 'paso';
  comandos?: readonly string[];
  tope?: number;
}): GridSimulator {
  return new GridSimulator({
    grid: opciones?.grid ?? PASILLO,
    spawn: opciones?.spawn ?? SPAWN,
    items: opciones?.items ?? [],
    modo: opciones?.modo ?? 'rodar',
    comandosPermitidos: opciones?.comandos ?? ['derecha', 'izquierda', 'arriba', 'abajo'],
    topeEjecucion: opciones?.tope ?? 1000,
  });
}

describe('modo rodar (mundos 1 al 10)', () => {
  it('una sola ficha lleva al Fuzz hasta el final del camino', () => {
    const sim = crear();
    const accion = sim.mover('derecha');

    expect(sim.estado.x).toBe(4);
    expect(sim.estado.y).toBe(1);
    expect(accion.celdasRecorridas).toHaveLength(4);
  });

  it('el Fuzz se detiene al borde de un agujero sin caer', () => {
    const sim = crear({ grid: rejilla(['     ', '..O.M', '     ']) });
    sim.mover('derecha');

    expect(sim.estado.x).toBe(1);
    expect(sim.estado.vivo).toBe(true);
  });

  it('avisa con un mensaje amable cuando no hay camino', () => {
    const sim = crear();

    expect(() => sim.mover('arriba')).toThrow(ErrorJuego);
    try {
      sim.mover('arriba');
    } catch (error) {
      expect((error as ErrorJuego).codigo).toBe('choque');
      // El mensaje es para un nino de cuatro anos: sin jerga tecnica.
      expect((error as ErrorJuego).message).not.toMatch(/undefined|null|Error|stack/i);
    }
  });

  it('recoge los items que encuentra al pasar por encima', () => {
    const items: ItemNivel[] = [
      { id: 'e1', tipo: 'estrella', x: 2, y: 1 },
      { id: 'e2', tipo: 'estrella', x: 4, y: 1 },
    ];
    const sim = crear({ items });
    sim.mover('derecha');

    expect(sim.estado.recogidos).toEqual(['e1', 'e2']);
  });
});

describe('modo paso (mundos 11 en adelante)', () => {
  it('cada comando avanza exactamente una casilla', () => {
    const sim = crear({ modo: 'paso' });
    sim.mover('derecha');

    expect(sim.estado.x).toBe(1);
  });

  it('avanzar respeta la direccion en que mira el Fuzz', () => {
    const sim = crear({
      modo: 'paso',
      comandos: ['avanzar', 'girarDerecha', 'girarIzquierda'],
    });
    sim.avanzar();
    sim.avanzar();

    expect(sim.estado.x).toBe(2);
    expect(sim.estado.dir).toBe('derecha');
  });

  it('girar cuatro veces a la derecha deja al Fuzz mirando igual', () => {
    const sim = crear({ modo: 'paso', comandos: ['girarDerecha'] });
    const inicial = sim.estado.dir;
    for (let i = 0; i < 4; i++) sim.girarDerecha();

    expect(sim.estado.dir).toBe(inicial);
  });
});

describe('limites de seguridad', () => {
  it('corta el programa al superar el tope de instrucciones', () => {
    const sim = crear({ tope: 3 });

    expect(() => {
      for (let i = 0; i < 100; i++) {
        try {
          sim.mover('derecha');
        } catch (error) {
          if ((error as ErrorJuego).codigo === 'limite') throw error;
          // Los choques son normales aqui; solo nos interesa el tope.
        }
      }
    }).toThrow(/repite demasiadas veces/);
  });

  it('rechaza comandos que la actividad no ha desbloqueado', () => {
    const sim = crear({ comandos: ['derecha'] });

    expect(() => sim.mover('abajo')).toThrow(/todavia no puedes usar/);
  });
});

describe('verificacion en el servidor', () => {
  const items: ItemNivel[] = [{ id: 'e1', tipo: 'estrella', x: 4, y: 1 }];
  const opciones = {
    grid: PASILLO,
    spawn: SPAWN,
    items,
    modo: 'rodar' as const,
    comandosPermitidos: ['derecha'],
    topeEjecucion: 1000,
  };

  it('reproduce un intento legitimo y concede las tres estrellas', () => {
    const sim = new GridSimulator(opciones);
    sim.mover('derecha');
    const acciones = [...sim.accionesEjecutadas];

    const resultado = evaluarObjetivos(
      opciones,
      acciones,
      [
        { id: 'salida', tipo: 'alcanzar_celda', x: 4, y: 1, obligatorio: true },
        { id: 'estrella', tipo: 'recoger_item', itemId: 'e1', obligatorio: false },
      ],
      items,
    );

    expect(resultado.valida).toBe(true);
    expect(resultado.cumplidos.salida).toBe(true);

    const estrellas = calcularEstrellas(
      {
        '1': { objetivos: ['salida'] },
        '2': { objetivos: ['salida', 'estrella'] },
        '3': { objetivos: ['salida', 'estrella'], maxFichas: 1 },
      },
      resultado.cumplidos,
      { tamanoPrograma: 1, instruccionesEjecutadas: acciones.length },
    );

    expect(estrellas).toBe(3);
  });

  it('no concede nada si el cliente inventa acciones imposibles', () => {
    // Un cliente manipulado afirma haber llegado a la meta de un salto.
    const inventadas: Accion[] = [
      { cmd: 'arriba', desde: { x: 0, y: 1 }, hasta: { x: 4, y: 1 } },
    ];

    const resultado = evaluarObjetivos(
      opciones,
      inventadas,
      [{ id: 'salida', tipo: 'alcanzar_celda', x: 4, y: 1, obligatorio: true }],
      items,
    );

    expect(resultado.valida).toBe(false);
    expect(resultado.cumplidos.salida).toBe(false);
  });

  it('baja a dos estrellas cuando el programa usa mas fichas de las permitidas', () => {
    const sim = new GridSimulator({ ...opciones, modo: 'paso', comandosPermitidos: ['derecha'] });
    for (let i = 0; i < 4; i++) sim.mover('derecha');
    const acciones = [...sim.accionesEjecutadas];

    const resultado = evaluarObjetivos(
      { ...opciones, modo: 'paso' },
      acciones,
      [
        { id: 'salida', tipo: 'alcanzar_celda', x: 4, y: 1, obligatorio: true },
        { id: 'estrella', tipo: 'recoger_item', itemId: 'e1', obligatorio: false },
      ],
      items,
    );

    const estrellas = calcularEstrellas(
      {
        '1': { objetivos: ['salida'] },
        '2': { objetivos: ['salida', 'estrella'] },
        '3': { objetivos: ['salida', 'estrella'], maxFichas: 1 },
      },
      resultado.cumplidos,
      { tamanoPrograma: 4, instruccionesEjecutadas: acciones.length },
    );

    expect(estrellas).toBe(2);
  });
});

describe('recompensas', () => {
  it('reparte las monedas segun las estrellas', () => {
    expect(monedasPorEstrellas(30, 3)).toBe(30);
    expect(monedasPorEstrellas(30, 2)).toBe(20);
    expect(monedasPorEstrellas(30, 0)).toBe(0);
  });
});

describe('condicionales de color (mundo 2)', () => {
  it('el sensor informa del color de la casilla actual', () => {
    const sim = crear({ grid: rejilla(['     ', '..R.M', '     ']), modo: 'paso' });
    sim.mover('derecha');
    sim.mover('derecha');

    expect(sim.colorCasilla()).toBe('rojo');
  });
});

describe('puentes rotos (mundo 13)', () => {
  /** Pasillo con dos puentes rotos que hay que reparar para pasar. */
  const CIUDAD = rejilla([
    '       ',
    '.P..P.M',
    '       ',
  ]);

  const COMANDOS = ['avanzar', 'girarDerecha', 'girarIzquierda', 'repararPuente'];

  it('un puente roto no se puede pisar', () => {
    const sim = crear({ grid: CIUDAD, modo: 'paso', comandos: COMANDOS });

    expect(sim.puedeAvanzar()).toBe(false);
    expect(() => sim.avanzar()).toThrow(ErrorJuego);
  });

  it('repararlo abre el paso', () => {
    const sim = crear({ grid: CIUDAD, modo: 'paso', comandos: COMANDOS });

    sim.repararPuente();

    expect(sim.puedeAvanzar()).toBe(true);
    sim.avanzar();
    expect(sim.estado.x).toBe(1);
  });

  it('no se puede reparar donde no hay puente', () => {
    const sim = crear({ grid: CIUDAD, modo: 'paso', comandos: COMANDOS });
    sim.repararPuente();
    sim.avanzar();

    // Delante hay camino normal, no un puente.
    expect(() => sim.repararPuente()).toThrow(ErrorJuego);
  });

  it('no se repara dos veces el mismo puente', () => {
    const sim = crear({ grid: CIUDAD, modo: 'paso', comandos: COMANDOS });
    sim.repararPuente();

    expect(() => sim.repararPuente()).toThrow(ErrorJuego);
  });

  it('cada intento empieza con los puentes rotos otra vez', () => {
    // El tablero llega de solo lectura, asi que reparar no puede dejar rastro
    // entre intentos: si lo dejara, el segundo intento seria mas facil que el
    // primero y el servidor daria estrellas por un programa incompleto.
    const primero = crear({ grid: CIUDAD, modo: 'paso', comandos: COMANDOS });
    primero.repararPuente();
    primero.avanzar();

    const segundo = crear({ grid: CIUDAD, modo: 'paso', comandos: COMANDOS });
    expect(segundo.puedeAvanzar()).toBe(false);
  });

  it('el servidor reproduce la reparacion igual que el cliente', () => {
    const opciones = {
      grid: CIUDAD,
      spawn: SPAWN,
      items: [],
      modo: 'paso' as const,
      comandosPermitidos: COMANDOS,
      topeEjecucion: 1000,
    };

    const sim = new GridSimulator(opciones);
    sim.repararPuente();
    sim.avanzar();
    sim.avanzar();
    sim.avanzar();
    sim.repararPuente();
    sim.avanzar();
    sim.avanzar();
    sim.avanzar();

    const repetido = reproducirAcciones(opciones, sim.accionesEjecutadas);

    expect(repetido.valida).toBe(true);
    expect(repetido.estado.x).toBe(6);
  });

  it('una reparacion inventada no se reproduce', () => {
    const opciones = {
      grid: CIUDAD,
      spawn: SPAWN,
      items: [],
      modo: 'paso' as const,
      comandosPermitidos: COMANDOS,
      topeEjecucion: 1000,
    };

    // El cliente dice haber avanzado sobre el puente sin arreglarlo.
    const acciones: Accion[] = [
      { cmd: 'avanzar', desde: { x: 0, y: 1 }, hasta: { x: 1, y: 1 }, dir: 'derecha' },
    ];

    expect(reproducirAcciones(opciones, acciones).valida).toBe(false);
  });
});

/**
 * Lo que se recoge al pasar por encima.
 *
 * Existe por un fallo que afectaba a 177 de las 600 actividades. El simulador
 * apuntaba la estrella como recogida y devolvia su identificador, pero quien lo
 * llamaba tiraba ese valor: la accion que llegaba al renderizador no decia que
 * se hubiera recogido nada. El resultado era que la actividad se superaba, el
 * servidor daba las estrellas, y en pantalla la estrella seguia dibujada en su
 * sitio sin desaparecer ni sonar.
 *
 * Se comprueba en las tres formas de recoger sin ficha de recoger: rodando,
 * avanzando y saltando.
 */
describe('estrellas recogidas al pasar', () => {
  /** Pasillo recto de una fila con estrellas donde se pidan. */
  const pasillo = (largo: number, estrellas: { x: number; id: string }[]) => ({
    grid: {
      cols: largo,
      rows: 1,
      tiles: [Array.from({ length: largo }, () => ({ t: 'camino' as const }))],
    },
    spawn: { x: 0, y: 0, dir: 'derecha' as const },
    items: estrellas.map((e) => ({ id: e.id, tipo: 'estrella' as const, x: e.x, y: 0 })),
    comandosPermitidos: ['derecha', 'izquierda', 'avanzar', 'saltar', 'recoger', 'girarIzquierda'],
    topeEjecucion: 500,
  });

  it('rodando dice cuales recogio y en que casilla estaba cada una', () => {
    const sim = new GridSimulator({
      ...pasillo(6, [
        { x: 2, id: 'estrella1' },
        { x: 4, id: 'estrella2' },
      ]),
      modo: 'rodar',
    });

    const accion = sim.mover('derecha');

    // La casilla importa: rodando se atraviesan varias de una vez, y sin ella el
    // renderizador no puede apagar cada estrella en el momento de pasar.
    expect(accion.itemsRecogidos).toEqual([
      { id: 'estrella1', x: 2, y: 0 },
      { id: 'estrella2', x: 4, y: 0 },
    ]);
  });

  it('avanzando de una en una tambien', () => {
    const sim = new GridSimulator({ ...pasillo(4, [{ x: 1, id: 'unica' }]), modo: 'paso' });

    const primera = sim.avanzar();
    const segunda = sim.avanzar();

    expect(primera.itemsRecogidos).toEqual([{ id: 'unica', x: 1, y: 0 }]);
    // Y la siguiente casilla no inventa ninguna.
    expect(segunda.itemsRecogidos).toBeUndefined();
  });

  it('saltando encima de una', () => {
    const sim = new GridSimulator({ ...pasillo(5, [{ x: 2, id: 'saltada' }]), modo: 'paso' });

    const accion = sim.saltar();

    expect(accion.itemsRecogidos).toEqual([{ id: 'saltada', x: 2, y: 0 }]);
  });

  it('no la recoge dos veces si se vuelve a pasar', () => {
    const sim = new GridSimulator({ ...pasillo(4, [{ x: 1, id: 'unica' }]), modo: 'paso' });

    sim.avanzar();
    sim.girarIzquierda();
    sim.girarIzquierda();
    const vuelta = sim.avanzar();

    expect(vuelta.itemsRecogidos).toBeUndefined();
  });

  it('un camino sin estrellas no las anuncia', () => {
    const sim = new GridSimulator({ ...pasillo(5, []), modo: 'rodar' });

    // Esto es lo que hacia sonar el tilin sin haber recogido nada: el sonido se
    // disparaba con cualquier recorrido largo en vez de con lo recogido.
    expect(sim.mover('derecha').itemsRecogidos).toBeUndefined();
  });
});
