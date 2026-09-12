/**
 * Las medidas de mecanografía.
 *
 * Se prueban con cuidado porque las calculan dos lados —el navegador y el
 * servidor— y porque de ellas depende una nota. Un error aquí no se ve: se ve un
 * niño discutiendo que en pantalla ponía otra cosa.
 */
import { describe, expect, it } from 'vitest';

import {
  esCreible,
  estrellasDe,
  medir,
  queFalta,
  velocidadEnVivo,
  type Exigencia,
} from './medidas.js';

const EXIGENCIA: Exigencia = { precision: [80, 90, 95], ppm: [10, 20, 30] };

describe('medir un intento', () => {
  it('usa el convenio de cinco caracteres por palabra', () => {
    // 100 caracteres correctos en un minuto = 20 palabras por minuto.
    expect(medir({ correctos: 100, errores: 0, milisegundos: 60_000 }).ppm).toBe(20);
  });

  it('la precision cuenta las pulsaciones, no los caracteres del texto', () => {
    // 90 aciertos y 10 fallos son 100 pulsaciones: 90 %.
    expect(medir({ correctos: 90, errores: 10, milisegundos: 60_000 }).precision).toBe(90);
  });

  it('no divide por cero cuando no hubo tiempo', () => {
    // Pasa de verdad: dos teclas en el mismo milisegundo darian PPM infinitas.
    const medidas = medir({ correctos: 2, errores: 0, milisegundos: 0 });
    expect(medidas.ppm).toBe(0);
    expect(Number.isFinite(medidas.ppm)).toBe(true);
  });

  it('sin pulsaciones la precision es cero, no cien', () => {
    // Quien no escribio nada no acerto todo.
    expect(medir({ correctos: 0, errores: 0, milisegundos: 5000 }).precision).toBe(0);
  });
});

describe('las estrellas', () => {
  it('exige precision Y velocidad, no una de las dos', () => {
    // Rapidisimo y lleno de errores: no compra estrellas con velocidad.
    const rapidoYSucio = medir({ correctos: 300, errores: 200, milisegundos: 60_000 });
    expect(rapidoYSucio.ppm).toBeGreaterThan(30);
    expect(estrellasDe(rapidoYSucio, EXIGENCIA)).toBe(0);
  });

  it('da tres estrellas a quien cumple los dos minimos', () => {
    const impecable = medir({ correctos: 160, errores: 4, milisegundos: 60_000 });
    expect(impecable.ppm).toBe(32);
    expect(impecable.precision).toBe(98);
    expect(estrellasDe(impecable, EXIGENCIA)).toBe(3);
  });

  it('da una estrella a quien empieza', () => {
    const principiante = medir({ correctos: 60, errores: 12, milisegundos: 60_000 });
    expect(principiante.ppm).toBe(12);
    expect(principiante.precision).toBe(83);
    expect(estrellasDe(principiante, EXIGENCIA)).toBe(1);
  });

  it('no da nada a quien escribe bien pero demasiado despacio', () => {
    const lento = medir({ correctos: 40, errores: 0, milisegundos: 60_000 });
    expect(lento.precision).toBe(100);
    expect(lento.ppm).toBe(8);
    expect(estrellasDe(lento, EXIGENCIA)).toBe(0);
  });
});

describe('que hay que mejorar', () => {
  it('si falla la precision, lo dice: ir mas rapido no ayudaria', () => {
    const medidas = medir({ correctos: 200, errores: 50, milisegundos: 60_000 });
    const estrellas = estrellasDe(medidas, EXIGENCIA);
    expect(queFalta(medidas, EXIGENCIA, estrellas).falta).toBe('precision');
  });

  it('si la precision sobra, lo que falta es velocidad', () => {
    const medidas = medir({ correctos: 60, errores: 1, milisegundos: 60_000 });
    const estrellas = estrellasDe(medidas, EXIGENCIA);
    expect(queFalta(medidas, EXIGENCIA, estrellas).falta).toBe('velocidad');
  });

  it('con tres estrellas no falta nada', () => {
    const medidas = medir({ correctos: 200, errores: 2, milisegundos: 60_000 });
    expect(queFalta(medidas, EXIGENCIA, estrellasDe(medidas, EXIGENCIA)).falta).toBe('nada');
  });
});

describe('lo que no es creible', () => {
  it('doscientas cincuenta palabras por minuto', () => {
    // El record mundial anda por 200. Un nino de doce no lo va a batir hoy.
    expect(esCreible({ correctos: 1500, errores: 0, milisegundos: 60_000 }, 2000)).toBe(false);
  });

  it('mas caracteres correctos de los que tiene la leccion', () => {
    expect(esCreible({ correctos: 500, errores: 0, milisegundos: 120_000 }, 40)).toBe(false);
  });

  it('un intento sin tiempo', () => {
    expect(esCreible({ correctos: 40, errores: 0, milisegundos: 0 }, 40)).toBe(false);
  });

  it('un intento normal si lo es', () => {
    expect(esCreible({ correctos: 38, errores: 4, milisegundos: 30_000 }, 40)).toBe(true);
  });
});

describe('el contador que ve el nino mientras escribe', () => {
  it('no muestra velocidad con una sola tecla pulsada', () => {
    // Esto pasaba de verdad: la primera tecla salia como "12000 ppm" porque el
    // reloj llevaba diez milisegundos. La cifra era correcta y no significaba
    // nada.
    const medidas = medir({ correctos: 1, errores: 0, milisegundos: 5 });
    expect(medidas.ppm).toBeGreaterThan(1000);
    expect(velocidadEnVivo(medidas)).toBeNull();
  });

  it('la muestra en cuanto hay una palabra escrita', () => {
    const medidas = medir({ correctos: 5, errores: 0, milisegundos: 6_000 });
    expect(velocidadEnVivo(medidas)).toBe(10);
  });

  it('los errores tambien cuentan como pulsaciones', () => {
    // Quien lleva cinco intentos ya escribio algo, aunque fuera mal.
    const medidas = medir({ correctos: 2, errores: 3, milisegundos: 10_000 });
    expect(velocidadEnVivo(medidas)).not.toBeNull();
  });
});
