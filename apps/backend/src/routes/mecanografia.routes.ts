/**
 * Mecanografía.
 *
 * Todo va con `exigirJugador`: practicar es de los estudiantes. El docente ve el
 * avance de su aula por su propia ruta.
 *
 * Las lecciones se sirven desde aquí y no se compilan dentro del paquete del
 * navegador: son veinticuatro textos con sus mínimos, y el catálogo del teclado
 * pesa lo suyo. Una sola petición al entrar, cacheada por el store.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  ACENTUADAS,
  INFO_DEDOS,
  INFO_JUEGOS,
  PALABRAS_JUEGO,
  TECLADO_ES,
  leccionPorClave,
} from '@codenest/content';
import { resultadoLeccionSchema, resultadoPracticaSchema } from '@codenest/shared/zod';

import {
  ErrorMecanografia,
  guardarIntento,
  guardarPractica,
  mapaDeMecanografia,
} from '../services/mecanografia.service.js';

const paramsClave = z.object({
  clave: z.string().min(3).max(40).regex(/^[a-z]+-\d{2}$/, 'Clave de leccion invalida'),
});

export const mecanografiaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * El teclado y las palabras de los minijuegos.
   *
   * El teclado es el ESPAÑOL (Latinoamerica): con ñ, con tecla muerta de tilde y
   * con ¿ y ¡. De aqui sale el dibujo y tambien que dedo toca cada tecla, asi
   * que no pueden discrepar.
   */
  fastify.get('/teclado', { preHandler: fastify.autenticar }, async (_request, reply) => {
    return reply.send({
      filas: TECLADO_ES,
      dedos: INFO_DEDOS,
      acentuadas: ACENTUADAS,
      juegos: INFO_JUEGOS,
      palabras: PALABRAS_JUEGO,
    });
  });

  /** El mapa de las tres zonas con mi progreso. */
  fastify.get('/', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    return reply.send(await mapaDeMecanografia(fastify.prisma, request.user.id));
  });

  /** Una leccion, con su texto. */
  fastify.get('/leccion/:clave', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsClave.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Leccion invalida' });

    const leccion = leccionPorClave(params.data.clave);
    if (!leccion) return reply.code(404).send({ error: 'Esa leccion no existe' });

    const progreso = await fastify.prisma.typingProgress.findUnique({
      where: { usuarioId_leccionClave: { usuarioId: request.user.id, leccionClave: leccion.clave } },
      select: { estrellas: true, mejorPpm: true, mejorPrecision: true, intentos: true },
    });

    return reply.send({ leccion, progreso });
  });

  /** El resultado de una leccion. Las estrellas las decide el servidor. */
  fastify.post('/leccion/:clave', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsClave.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Leccion invalida' });

    const datos = resultadoLeccionSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Resultado invalido', detalles: datos.error.flatten() });
    }

    try {
      const resultado = await guardarIntento(
        fastify.prisma,
        request.user.id,
        params.data.clave,
        datos.data,
      );

      await fastify.prisma.telemetryEvent.create({
        data: {
          usuarioId: request.user.id,
          evento: 'mecanografia_leccion',
          datos: {
            leccion: params.data.clave,
            ppm: resultado.ppm,
            precision: resultado.precision,
            estrellas: resultado.estrellas,
          },
        },
      });

      return reply.send(resultado);
    } catch (error) {
      if (error instanceof ErrorMecanografia) {
        return reply.code(error.codigo).send({ error: error.message });
      }
      throw error;
    }
  });

  /** El resultado de una partida de practica. No da estrellas: suma practica. */
  fastify.post('/practica', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const datos = resultadoPracticaSchema.safeParse(request.body);
    if (!datos.success) return reply.code(400).send({ error: 'Resultado invalido' });

    try {
      const resultado = await guardarPractica(fastify.prisma, request.user.id, datos.data);

      await fastify.prisma.telemetryEvent.create({
        data: {
          usuarioId: request.user.id,
          evento: 'mecanografia_practica',
          datos: {
            juego: datos.data.juego,
            palabras: datos.data.palabras,
            ppm: resultado.ppm,
            puntos: datos.data.puntos,
          },
        },
      });

      return reply.send(resultado);
    } catch (error) {
      if (error instanceof ErrorMecanografia) {
        return reply.code(error.codigo).send({ error: error.message });
      }
      throw error;
    }
  });
};
