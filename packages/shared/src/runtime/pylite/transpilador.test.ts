/**
 * Pruebas del transpilador de Python.
 *
 * Cada prueba comprueba dos cosas: que la traducción sea la esperada y que el
 * JavaScript resultante haga lo que el Python original decía. Lo segundo es lo
 * que de verdad importa: un niño del mundo 23 escribe un bucle y espera que su
 * dron recorra la matriz, no que el código se parezca a algo.
 */
import { describe, expect, it } from 'vitest';

import { ErrorSintaxisPython, transpilarPython } from './transpilador.js';

/** Ejecuta el JavaScript traducido y devuelve lo que hizo. */
function ejecutar(python: string, api: Record<string, unknown> = {}): unknown[] {
  const { codigo } = transpilarPython(python);
  const registro: unknown[] = [];
  const contexto = { anotar: (v: unknown) => registro.push(v), ...api };

  const nombres = Object.keys(contexto);
  const valores = Object.values(contexto);
  new Function(...nombres, codigo)(...valores);

  return registro;
}

describe('asignaciones y aritmetica', () => {
  it('declara la variable la primera vez y no la redeclara', () => {
    const { codigo } = transpilarPython('x = 5\nx = 6');

    expect(codigo).toBe('let x = 5;\nx = 6;');
  });

  it('traduce la division entera de Python', () => {
    // En Python 7 // 2 es 3, no 3.5.
    const resultado = ejecutar('anotar(7 // 2)');

    expect(resultado).toEqual([3]);
  });

  it('traduce la potencia', () => {
    expect(ejecutar('anotar(2 ** 8)')).toEqual([256]);
  });

  it('usa comparacion estricta', () => {
    const { codigo } = transpilarPython('if x == 1:\n  y = 2');

    expect(codigo).toContain('x === 1');
  });
});

describe('bucles for con range', () => {
  it('traduce range con un solo argumento', () => {
    expect(ejecutar('for i in range(3):\n  anotar(i)')).toEqual([0, 1, 2]);
  });

  it('traduce range con inicio y fin', () => {
    expect(ejecutar('for i in range(2, 5):\n  anotar(i)')).toEqual([2, 3, 4]);
  });

  it('traduce range con paso', () => {
    expect(ejecutar('for i in range(0, 10, 3):\n  anotar(i)')).toEqual([0, 3, 6, 9]);
  });

  it('admite un paso negativo', () => {
    expect(ejecutar('for i in range(3, 0, -1):\n  anotar(i)')).toEqual([3, 2, 1]);
  });

  it('no materializa el array en un for con range', () => {
    // range(1000000) no debe reservar memoria: se traduce a un for clasico.
    const { codigo } = transpilarPython('for i in range(1000000):\n  x = i');

    expect(codigo).toContain('for (let i = 0; i < 1000000; i += 1)');
    expect(codigo).not.toContain('Array.from');
  });

  it('recorre una lista con for in', () => {
    expect(ejecutar('for x in [10, 20, 30]:\n  anotar(x)')).toEqual([10, 20, 30]);
  });
});

describe('condicionales', () => {
  it('traduce if, elif y else en cadena', () => {
    const python = ['if n == 1:', '  anotar("uno")', 'elif n == 2:', '  anotar("dos")', 'else:', '  anotar("otro")'].join('\n');

    expect(ejecutar(`n = 2\n${python}`)).toEqual(['dos']);
    expect(ejecutar(`n = 1\n${python}`)).toEqual(['uno']);
    expect(ejecutar(`n = 9\n${python}`)).toEqual(['otro']);
  });

  it('traduce and, or y not', () => {
    const { codigo } = transpilarPython('if a and not b or c:\n  x = 1');

    expect(codigo).toContain('a && !(b) || c');
  });

  it('admite el if de una sola linea', () => {
    expect(ejecutar('n = 5\nif n > 3: anotar("grande")')).toEqual(['grande']);
  });
});

describe('bucles while', () => {
  it('repite mientras la condicion se cumpla', () => {
    const python = ['i = 0', 'while i < 3:', '  anotar(i)', '  i += 1'].join('\n');

    expect(ejecutar(python)).toEqual([0, 1, 2]);
  });

  it('respeta break y continue', () => {
    const python = [
      'i = 0',
      'while i < 10:',
      '  i += 1',
      '  if i == 2:',
      '    continue',
      '  if i == 4:',
      '    break',
      '  anotar(i)',
    ].join('\n');

    expect(ejecutar(python)).toEqual([1, 3]);
  });
});

describe('funciones', () => {
  it('traduce def con parametros y return', () => {
    const python = ['def doble(n):', '  return n * 2', 'anotar(doble(21))'].join('\n');

    expect(ejecutar(python)).toEqual([42]);
  });

  it('admite varios parametros', () => {
    const python = ['def suma(a, b, c):', '  return a + b + c', 'anotar(suma(1, 2, 3))'].join('\n');

    expect(ejecutar(python)).toEqual([6]);
  });

  it('registra las estructuras usadas', () => {
    const { estructuras } = transpilarPython(
      ['def f():', '  for i in range(2):', '    if i == 0:', '      x = 1'].join('\n'),
    );

    expect(estructuras).toContain('funcion');
    expect(estructuras).toContain('para');
    expect(estructuras).toContain('si');
  });
});

describe('listas y diccionarios', () => {
  it('traduce len a la propiedad length', () => {
    expect(ejecutar('anotar(len([1, 2, 3]))')).toEqual([3]);
  });

  it('accede a una lista por indice', () => {
    expect(ejecutar('xs = [7, 8, 9]\nanotar(xs[1])')).toEqual([8]);
  });

  it('asigna a un elemento de la lista', () => {
    expect(ejecutar('xs = [1, 2]\nxs[0] = 99\nanotar(xs[0])')).toEqual([99]);
  });

  it('traduce un diccionario', () => {
    // Es la sintaxis del mundo 24: { x: 4, y: 12, estado: "activo" }.
    expect(ejecutar("d = { 'x': 4, 'estado': 'activo' }\nanotar(d['estado'])")).toEqual(['activo']);
  });
});

describe('llamadas al objeto del juego', () => {
  it('traduce metodos encadenados con indices', () => {
    // La sintaxis del mundo 22: puertas[0].unlock()
    const abiertas: number[] = [];
    const puertas = [0, 1, 2].map((i) => ({ unlock: () => abiertas.push(i) }));

    ejecutar('puertas[0].unlock()\npuertas[2].unlock()', { puertas });

    expect(abiertas).toEqual([0, 2]);
  });

  it('traduce el ejemplo del mundo 21', () => {
    const movimientos: number[] = [];
    const python = ['velocidad = 5', 'move(velocidad)'].join('\n');

    ejecutar(python, { move: (v: number) => movimientos.push(v) });

    expect(movimientos).toEqual([5]);
  });
});

describe('sangria', () => {
  it('cierra varios niveles a la vez', () => {
    const python = [
      'for i in range(2):',
      '  for j in range(2):',
      '    anotar(j)',
      'anotar(99)',
    ].join('\n');

    expect(ejecutar(python)).toEqual([0, 1, 0, 1, 99]);
  });

  it('ignora los comentarios y las lineas vacias', () => {
    const python = ['# esto es un comentario', '', 'x = 1  # otro', '', 'anotar(x)'].join('\n');

    expect(ejecutar(python)).toEqual([1]);
  });

  it('avisa con el numero de linea si la sangria no encaja', () => {
    const python = ['if True:', '    x = 1', '  y = 2'].join('\n');

    try {
      transpilarPython(python);
      expect.unreachable('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorSintaxisPython);
      expect((error as ErrorSintaxisPython).linea).toBe(3);
    }
  });
});

describe('errores comprensibles', () => {
  it('senala la linea de una comilla sin cerrar', () => {
    try {
      transpilarPython('x = 1\ny = "sin cerrar');
      expect.unreachable('deberia haber lanzado');
    } catch (error) {
      expect((error as ErrorSintaxisPython).linea).toBe(2);
      expect((error as Error).message).toContain('comilla');
    }
  });

  it('rechaza lo que queda fuera del subconjunto', () => {
    // try/except no se traduce: el mundo 27 se juega solo en JavaScript.
    expect(() => transpilarPython('try:\n  x = 1')).toThrow(ErrorSintaxisPython);
  });
});
