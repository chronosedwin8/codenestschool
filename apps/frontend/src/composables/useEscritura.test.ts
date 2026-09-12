/**
 * El motor de escritura, por donde cede de verdad.
 *
 * Estas pruebas existen por un fallo concreto: la tecla muerta se *armaba* y
 * nunca se *aplicaba*, asi que `´` + `a` se comparaba como `a` contra `á` y
 * contaba error. En un portatil no se notaba —el sistema operativo compone la
 * vocal antes de que la aplicacion la vea— pero en el teclado de la pantalla,
 * que es el que usan los niños en tableta y movil, no hay nada que lo tape: cada
 * palabra con tilde de la Laguna se contaba mal por muy bien escrita que
 * estuviera.
 */
import { describe, expect, it } from 'vitest';

import { useEscritura } from './useEscritura';

/** Escribe una cadena caracter a caracter y devuelve el motor. */
function escribirTodo(texto: string, pulsaciones: string[]) {
  const motor = useEscritura();
  motor.empezar(texto);
  for (const pulsacion of pulsaciones) motor.escribir(pulsacion);
  return motor;
}

describe('la tecla muerta del acento', () => {
  it('compone la vocal: ´ y luego a dan á', () => {
    const motor = escribirTodo('má', ['m', '´', 'a']);

    expect(motor.medidas.value.correctos).toBe(2);
    expect(motor.medidas.value.errores).toBe(0);
    expect(motor.medidas.value.precision).toBe(100);
    expect(motor.terminado.value).toBe(true);
  });

  it('el acento solo no avanza el cursor', () => {
    const motor = escribirTodo('á', ['´']);

    expect(motor.posicion.value).toBe(0);
    expect(motor.acentoArmado.value).toBe('tilde');
    expect(motor.terminado.value).toBe(false);
  });

  it('la dieresis es otra tecla: ¨ y u dan ü, no ú', () => {
    // Importa: "pingüino" se escribe con ¨ y "menú" con ´. Si se confundieran,
    // la leccion de la dieresis seria imposible de aprobar.
    expect(escribirTodo('ü', ['¨', 'u']).medidas.value.correctos).toBe(1);
    expect(escribirTodo('ü', ['´', 'u']).medidas.value.errores).toBe(1);
    expect(escribirTodo('ú', ['´', 'u']).medidas.value.correctos).toBe(1);
  });

  it('acentuar una consonante no inventa un caracter', () => {
    // `´` + `s` no existe en español: debe llegar la `s` tal cual y contar como
    // el error que es, no como un caracter raro que no esta en ningun teclado.
    const motor = escribirTodo('s', ['´', 's']);
    expect(motor.medidas.value.correctos).toBe(1);
  });

  it('una vocal sin acento despues del acento no arrastra el armado', () => {
    const motor = escribirTodo('áa', ['´', 'a', 'a']);
    expect(motor.medidas.value.correctos).toBe(2);
    expect(motor.medidas.value.errores).toBe(0);
  });
});

describe('lo que no se corrige', () => {
  it('una tecla equivocada avanza igual y cuenta error', () => {
    // Es la decision pedagogica del motor: se mide lo que hacen los dedos, no un
    // texto revisado.
    const motor = escribirTodo('sol', ['s', 'x', 'l']);
    expect(motor.posicion.value).toBe(3);
    expect(motor.medidas.value.errores).toBe(1);
    expect(motor.medidas.value.precision).toBe(67);
  });

  it('anota el error en la tecla que se esperaba, que es la que hay que repasar', () => {
    const motor = escribirTodo('ñu', ['x', 'u']);
    expect(motor.resultado().erroresPorTecla).toEqual({ 'ñ': 1 });
  });

  it('el espacio se anota con su nombre, no con un hueco', () => {
    // Un docente no puede leer una tabla con una celda en blanco.
    const motor = escribirTodo('a b', ['a', 'x', 'b']);
    expect(motor.resultado().erroresPorTecla).toEqual({ espacio: 1 });
  });
});

describe('el reloj', () => {
  it('no empieza al abrir la pantalla, sino en la primera tecla', () => {
    const motor = useEscritura();
    motor.empezar('sol');
    expect(motor.medidas.value.segundos).toBe(0);
    expect(motor.medidas.value.ppm).toBe(0);
  });
});
