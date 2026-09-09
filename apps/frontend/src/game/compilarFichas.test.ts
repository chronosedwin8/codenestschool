/**
 * Pruebas del traductor de fichas a JavaScript.
 *
 * Lo importante que se protege aquí: las fichas de un niño de cinco años y el
 * texto de uno de once tienen que acabar en el mismo lenguaje, porque los dos
 * pasan por el mismo sandbox y el mismo verificador. Si esta traducción se
 * desvía, los prelectores jugarían con un motor distinto al de los mayores.
 */
import { describe, expect, it } from 'vitest';

import type { PasoPrograma } from './tipos';

import { compilarFichas } from './compilarFichas';

/** Atajo para escribir programas de prueba sin repetir los identificadores. */
function ficha(
  comando: PasoPrograma['comando'],
  extra: Partial<PasoPrograma> = {},
): PasoPrograma {
  return { id: Math.random().toString(36).slice(2), comando, ...extra };
}

describe('secuencias simples', () => {
  it('traduce una flecha a una llamada del Fuzz', () => {
    const { codigo, tamano } = compilarFichas([ficha('derecha')]);

    expect(codigo).toBe('fuzz.derecha();');
    expect(tamano).toBe(1);
  });

  it('mantiene el orden de las fichas', () => {
    const { codigo } = compilarFichas([ficha('derecha'), ficha('abajo'), ficha('izquierda')]);

    expect(codigo.split('\n')).toEqual([
      'fuzz.derecha();',
      'fuzz.abajo();',
      'fuzz.izquierda();',
    ]);
  });

  it('devuelve un programa vacío sin fallar', () => {
    const { codigo, tamano } = compilarFichas([]);

    expect(codigo).toBe('');
    expect(tamano).toBe(0);
  });
});

describe('bucles', () => {
  it('traduce la ficha de repetir con su cuerpo anidado', () => {
    const { codigo, estructuras } = compilarFichas([
      ficha('repetir', { veces: 3, hijos: [ficha('derecha'), ficha('saltar')] }),
    ]);

    expect(codigo).toBe(
      ['repetir(3, () => {', '  fuzz.derecha();', '  fuzz.saltar();', '});'].join('\n'),
    );
    expect(estructuras).toContain('repetir');
  });

  it('cuenta las fichas anidadas en el tamaño del programa', () => {
    // Es la medida que decide la tercera estrella: un bucle con dos fichas
    // dentro son tres fichas, no una.
    const { tamano } = compilarFichas([
      ficha('repetir', { veces: 4, hijos: [ficha('derecha'), ficha('abajo')] }),
    ]);

    expect(tamano).toBe(3);
  });

  it('genera un bucle vacío legible en lugar de romperse', () => {
    const { codigo } = compilarFichas([ficha('repetir', { veces: 2, hijos: [] })]);

    expect(codigo).toContain('repetir(2, () => {');
    expect(codigo).toContain('aqui van las fichas');
  });
});

describe('condicionales de color', () => {
  it('compara el color de la casilla con el de la ficha', () => {
    const { codigo, estructuras } = compilarFichas([
      ficha('siColor', { color: 'rojo', hijos: [ficha('arriba')] }),
    ]);

    expect(codigo).toContain("if (fuzz.colorCasilla() === 'rojo')");
    expect(codigo).toContain('  fuzz.arriba();');
    expect(estructuras).toContain('siColor');
  });

  it('genera las dos ramas del si / si no', () => {
    const { codigo } = compilarFichas([
      ficha('siSino', { hijos: [ficha('derecha')], sino: [ficha('abajo')] }),
    ]);

    expect(codigo).toContain('if (fuzz.puedeAvanzar())');
    expect(codigo).toContain('} else {');
    expect(codigo).toContain('  fuzz.derecha();');
    expect(codigo).toContain('  fuzz.abajo();');
  });
});

describe('el código generado es JavaScript válido', () => {
  it('se puede analizar sin errores de sintaxis', () => {
    const { codigo } = compilarFichas([
      ficha('derecha'),
      ficha('repetir', {
        veces: 2,
        hijos: [ficha('saltar'), ficha('siColor', { color: 'azul', hijos: [ficha('arriba')] })],
      }),
      ficha('recoger'),
    ]);

    // Si el traductor generara algo mal formado, el constructor lanzaría.
    expect(() => new Function('fuzz', 'repetir', codigo)).not.toThrow();
  });

  it('ejecuta el programa contra una API simulada en el orden esperado', () => {
    const { codigo } = compilarFichas([
      ficha('derecha'),
      ficha('repetir', { veces: 3, hijos: [ficha('saltar')] }),
    ]);

    const llamadas: string[] = [];
    const fuzzFalso = {
      derecha: () => llamadas.push('derecha'),
      saltar: () => llamadas.push('saltar'),
    };
    const repetir = (veces: number, cuerpo: () => void): void => {
      for (let i = 0; i < veces; i++) cuerpo();
    };

    new Function('fuzz', 'repetir', codigo)(fuzzFalso, repetir);

    expect(llamadas).toEqual(['derecha', 'saltar', 'saltar', 'saltar']);
  });
});

describe('funciones (el super salto del mundo 7)', () => {
  it('declara la función antes de usarla', () => {
    const { codigo, estructuras } = compilarFichas([
      ficha('funcion', { hijos: [ficha('saltar'), ficha('saltar')] }),
    ]);

    const lineas = codigo.split('\n');
    expect(lineas[0]).toBe('function superSalto() {');
    // La llamada aparece después de la declaración.
    expect(codigo.indexOf('superSalto();')).toBeGreaterThan(codigo.indexOf('function superSalto()'));
    expect(estructuras).toContain('funcion');
  });
});
