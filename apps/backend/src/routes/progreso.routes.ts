/**
 * Lo que un estudiante puede consultar sobre si mismo.
 *
 * Una sola ruta y sin parametro de identidad: siempre responde sobre quien
 * pregunta. Que no exista forma de pedir los datos de otro es mas simple y mas
 * seguro que comprobar permisos en cada llamada.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { diplomasDe } from '../services/diplomas.service.js';
import { insigniasDe } from '../services/logros.service.js';
import { estadisticasDeEstudiante } from '../services/progreso.service.js';

export const progresoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Mis datos: avance, estrellas, tiempo, insignias y puesto en mi grupo. */
  fastify.get('/mio', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const [datos, insignias, diplomas] = await Promise.all([
      estadisticasDeEstudiante(fastify.prisma, request.user.id),
      insigniasDe(fastify.prisma, request.user.id),
      diplomasDe(fastify.prisma, request.user.id),
    ]);
    // Las insignias y los diplomas van con lo demas y no en otra llamada: el
    // panel los ensena juntos, y dos peticiones para una sola pantalla se ven
    // como dos saltos en la tableta.
    return reply.send({ ...datos, insignias, diplomas });
  });
};
