/**
 * Pruebas de la medida del tamaño de un programa.
 *
 * Existen por un fallo que llegó hasta el final: el editor del niño y el generador
 * de contenido contaban las líneas de forma distinta, y la diferencia eran las
 * llaves de cierre. Todo programa de JavaScript con una llave en su línea (o sea,
 * todos) medía más de lo que su propia actividad permitía, así que la tercera
 * estrella de los mundos 21 al 30 era imposible de conseguir.
 *
 * El validador no lo vio porque usaba la misma cuenta que el generador: los dos
 * estaban de acuerdo en el número equivocado. Lo encontró la prueba que juega las
 * actividades contra el servidor de verdad.
 */
import { describe, expect, it } from 'vitest';

import { lineasDeCodigo } from './medidas.js';

describe('lineas de un programa', () => {
  it('cuenta solo las lineas con contenido', () => {
    expect(lineasDeCodigo('fuzz.avanzar();\n\nfuzz.girarDerecha();\n')).toBe(2);
  });

  it('no cuenta los comentarios de ninguno de los dos lenguajes', () => {
    expect(lineasDeCodigo('// esto explica\nfuzz.avanzar();')).toBe(1);
    expect(lineasDeCodigo('# esto explica\nfuzz.avanzar()')).toBe(1);
  });

  it('no cuenta las llaves solas', () => {
    // Es la clave del fallo: sin esto, el mismo programa mide mas en JavaScript
    // que en Python y la misma actividad se vuelve mas dificil de puntuar.
    const js = 'for (let i = 0; i < 8; i++) {\n  fuzz.avanzar();\n}';
    const py = 'for i in range(8):\n    fuzz.avanzar()';

    expect(lineasDeCodigo(js)).toBe(2);
    expect(lineasDeCodigo(py)).toBe(2);
    expect(lineasDeCodigo(js)).toBe(lineasDeCodigo(py));
  });

  it('no cuenta el cierre de una funcion pasada como argumento', () => {
    const codigo = 'repetir(3, () => {\n  fuzz.avanzar();\n});';

    expect(lineasDeCodigo(codigo)).toBe(2);
  });

  it('un programa de las dos formas mide lo mismo', () => {
    const conLlaves = `function tramo() {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}

tramo();`;
    const enPython = `def tramo():
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()

tramo()`;

    expect(lineasDeCodigo(conLlaves)).toBe(lineasDeCodigo(enPython));
  });

  it('aguanta los saltos de linea de Windows', () => {
    expect(lineasDeCodigo('fuzz.avanzar();\r\nfuzz.girarDerecha();\r\n')).toBe(2);
  });
});
