/**
 * Lo que un estudiante puede consultar sobre si mismo.
 *
 * Una sola ruta y sin parametro de identidad: siempre responde sobre quien
 * pregunta. Que no exista forma de pedir los datos de otro es mas simple y mas
 * seguro que comprobar permisos en cada llamada.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { estadisticasDeEstudiante } from '../services/progreso.service.js';

export const progresoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Mis datos: avance, estrellas, tiempo y puesto en mi grupo. */
  fastify.get('/mio', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const datos = await estadisticasDeEstudiante(fastify.prisma, request.user.id);
    return reply.send(datos);
  });
};
