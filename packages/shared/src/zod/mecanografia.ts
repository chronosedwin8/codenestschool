/**
 * Esquema del resultado de una leccion de mecanografia.
 *
 * Lo que llega es lo que el navegador midio mientras el nino escribia, asi que
 * viene con topes: un intento de 500 pulsaciones en tres segundos no es una
 * hazana, es un navegador manipulado o un fallo de medicion. El servidor
 * recalcula las estrellas con `medir` y `estrellasDe`; nunca las acepta del
 * cliente.
 */
import { z } from 'zod';

export const resultadoLeccionSchema = z.object({
  /** Caracteres acertados a la primera. */
  correctos: z.number().int().min(0).max(5000),
  errores: z.number().int().min(0).max(5000),
  milisegundos: z.number().int().min(1).max(60 * 60 * 1000),
  /**
   * Errores por tecla: la tecla y cuantas veces se fallo.
   *
   * Es lo unico de aqui que el servidor no puede recalcular, y es lo que hace
   * util el panel del docente: "le cuesta la ñ" es una frase que se puede
   * accionar, y "76 % de precision" no.
   */
  erroresPorTecla: z
    // Hasta 10 caracteres porque la clave del espacio es la palabra "espacio":
    // con un tope de 4 el envio entero se rechazaba con un 400 en cuanto el nino
    // fallaba un espacio, que es el primer error que comete cualquiera.
    .record(z.string().min(1).max(10), z.number().int().min(1).max(500))
    .default({}),
});

export type ResultadoLeccionEntrada = z.infer<typeof resultadoLeccionSchema>;

export const resultadoPracticaSchema = z.object({
  juego: z.enum(['ola', 'pesca', 'carrera']),
  palabras: z.number().int().min(0).max(2000),
  correctos: z.number().int().min(0).max(20000),
  errores: z.number().int().min(0).max(20000),
  milisegundos: z.number().int().min(1).max(60 * 60 * 1000),
  puntos: z.number().int().min(0).max(100000),
});

export type ResultadoPracticaEntrada = z.infer<typeof resultadoPracticaSchema>;
