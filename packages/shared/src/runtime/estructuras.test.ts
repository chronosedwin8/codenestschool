/**
 * Pruebas del detector de estructuras.
 *
 * Importan más de lo que parece: esta lista es la que decide si se concede la
 * tercera estrella de los mundos que piden usar cierta herramienta. Si dice que
 * hay una función donde no la hay, el mundo de las funciones se puede terminar
 * sin escribir ninguna, y el servidor lo dará por bueno porque confía en ella.
 *
 * Ese caso exacto estaba ocurriendo: el editor daba por buena una función en
 * cualquier programa con un bucle, porque el bucle se genera como
 * `repetir(3, () => { ... })` y la flecha parecía una función del niño.
 */
import { describe, expect, it } from 'vitest';

import { estructurasDelCodigo } from './estructuras.js';

describe('bucles', () => {
  it('reconoce el bucle contado de los bloques', () => {
    expect(estructurasDelCodigo('repetir(4, () => {\n  fuzz.avanzar();\n});')).toContain(
      'repetir',
    );
  });

  it('un bucle contado NO es una funcion del nino', () => {
    const codigo = 'repetir(4, () => {\n  fuzz.avanzar();\n});';

    expect(estructurasDelCodigo(codigo)).not.toContain('funcion');
  });

  it('distingue mientras de hasta', () => {
    const mientras = estructurasDelCodigo('while (fuzz.puedeAvanzar()) {\n  fuzz.avanzar();\n}');
    expect(mientras).toContain('mientras');
    expect(mientras).not.toContain('hasta');

    const hasta = estructurasDelCodigo('while (!(fuzz.hayObstaculo())) {\n  fuzz.avanzar();\n}');
    expect(hasta).toContain('mientras');
    expect(hasta).toContain('hasta');
  });
});

describe('funciones', () => {
  it('reconoce una funcion declarada', () => {
    const codigo = 'function cruzar() {\n  fuzz.avanzar();\n}\ncruzar();';

    expect(estructurasDelCodigo(codigo)).toContain('funcion');
    expect(estructurasDelCodigo(codigo)).not.toContain('parametro');
  });

  it('distingue una funcion con parametros', () => {
    const codigo = 'function andar(pasos) {\n  repetir(pasos, () => {\n  fuzz.avanzar();\n});\n}';

    expect(estructurasDelCodigo(codigo)).toContain('funcion');
    expect(estructurasDelCodigo(codigo)).toContain('parametro');
  });
});

describe('condicionales', () => {
  it('distingue el si del si con rama contraria', () => {
    const soloSi = estructurasDelCodigo('if (fuzz.puedeAvanzar()) {\n  fuzz.avanzar();\n}');
    expect(soloSi).toContain('si');
    expect(soloSi).not.toContain('sino');

    const conSino = estructurasDelCodigo(
      'if (fuzz.puedeAvanzar()) {\n  fuzz.avanzar();\n} else {\n  fuzz.girarDerecha();\n}',
    );
    expect(conSino).toContain('sino');
  });

  it('dice de que sensor depende la decision', () => {
    expect(
      estructurasDelCodigo("if (fuzz.colorCasilla() === 'rojo') {\n  fuzz.girarDerecha();\n}"),
    ).toContain('siColor');

    expect(estructurasDelCodigo('if (fuzz.puedeAvanzar()) {\n  fuzz.avanzar();\n}')).toContain(
      'siSino',
    );
  });

  it('reconoce los operadores logicos', () => {
    const codigo = 'if (fuzz.puedeAvanzar() && !fuzz.hayObstaculo()) {\n  fuzz.avanzar();\n}';

    expect(estructurasDelCodigo(codigo)).toContain('logica');
  });
});

describe('variables y listas', () => {
  it('reconoce una variable declarada', () => {
    expect(estructurasDelCodigo('var pasos = 3;')).toContain('variable');
    expect(estructurasDelCodigo('let pasos = 3;')).toContain('variable');
  });

  it('no confunde un acceso por indice con una lista', () => {
    const acceso = estructurasDelCodigo('fuzz.avanzar();\nvar x = ruta[i - 1];');

    expect(acceso).toContain('variable');
    expect(acceso).not.toContain('lista');
  });

  it('reconoce una lista escrita', () => {
    expect(estructurasDelCodigo('var ruta = [3, 1, 2];')).toContain('lista');
  });
});

describe('programa sin estructuras', () => {
  it('una secuencia suelta no declara nada', () => {
    expect(estructurasDelCodigo('fuzz.avanzar();\nfuzz.girarDerecha();\nfuzz.avanzar();')).toEqual(
      [],
    );
  });
});
