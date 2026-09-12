/**
 * El taller del estudiante: sus juegos.
 *
 * Todo va con `exigirJugador`. Construir juegos es de los estudiantes, igual que
 * jugar las actividades: un docente que publicara un juego lo publicaria como
 * alumno, se llevaria un diploma a su nombre y apareceria en la zona de los
 * ninos. Para mirar los juegos de su clase tiene su propia ruta.
 *
 * El titulo no aparece en ningun esquema de entrada, y es deliberado: lo pone el
 * servidor. Lo que no se puede mandar, no se puede manipular.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { juegoDePartida, type DefinicionJuego } from '@codenest/shared';
import { definicionJuegoSchema } from '@codenest/shared/zod';

import { ErrorAlmacen } from '../services/almacen.service.js';
import { diplomasDe } from '../services/diplomas.service.js';
import {
  ErrorProyecto,
  borrarProyecto,
  crearProyecto,
  despublicarProyecto,
  guardarProyecto,
  marcarProbado,
  misProyectos,
  publicarProyecto,
  renombrarProyecto,
  verProyecto,
} from '../services/proyectos.service.js';

const paramsId = z.object({ id: z.coerce.number().int().positive() });

const guardarSchema = z.object({ definicion: definicionJuegoSchema });

const publicarSchema = z.object({
  /** Captura del propio lienzo del juego, en base64. Opcional. */
  portada: z.string().max(600_000).optional(),
});

/** Convierte un error del servicio en una respuesta, o lo deja subir. */
async function conErrores(
  reply: { code: (n: number) => { send: (c: unknown) => unknown } },
  accion: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await accion();
  } catch (error) {
    if (error instanceof ErrorProyecto || error instanceof ErrorAlmacen) {
      return reply.code(error.codigo).send({ error: error.message });
    }
    throw error;
  }
}

export const proyectosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Mis juegos. */
  fastify.get('/', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const proyectos = await misProyectos(fastify.prisma, request.user.id);
    const diplomas = await diplomasDe(fastify.prisma, request.user.id);
    return reply.send({ proyectos, diplomas });
  });

  /** Un juego nuevo, ya jugable y con titulo sorteado. */
  fastify.post('/', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    return conErrores(reply, async () => {
      // La plantilla la pone el servidor: asi un juego recien creado siempre es
      // valido, y no depende de que el navegador mande algo sensato.
      const proyecto = await crearProyecto(fastify.prisma, request.user.id, juegoDePartida());
      return reply.code(201).send({ proyecto });
    });
  });

  /** Abrir un juego para verlo o editarlo. */
  fastify.get('/:id', { preHandler: fastify.autenticar }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    return conErrores(reply, async () => {
      const proyecto = await verProyecto(fastify.prisma, params.data.id, {
        id: request.user.id,
        esAdulto: request.user.rol !== 'nino',
      });
      return reply.send({ proyecto });
    });
  });

  /** Guardar los cambios del constructor. */
  fastify.put('/:id', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    const datos = guardarSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({
        error: 'Ese juego tiene algo que no se puede guardar',
        detalles: datos.error.flatten(),
      });
    }

    return conErrores(reply, async () => {
      const proyecto = await guardarProyecto(
        fastify.prisma,
        params.data.id,
        request.user.id,
        datos.data.definicion as unknown as DefinicionJuego,
      );
      return reply.send({ proyecto });
    });
  });

  /** Otro titulo del sorteo. */
  fastify.post('/:id/titulo', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    return conErrores(reply, async () => {
      const titulo = await renombrarProyecto(fastify.prisma, params.data.id, request.user.id);
      return reply.send({ titulo });
    });
  });

  /** "Lo probe y lo gane". Requisito para publicar. */
  fastify.post('/:id/probado', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    return conErrores(reply, async () => {
      await marcarProbado(fastify.prisma, params.data.id, request.user.id);
      return reply.send({ probado: true });
    });
  });

  /** Publicar: diploma, insignia y sitio en la zona de juegos. */
  fastify.post('/:id/publicar', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    const datos = publicarSchema.safeParse(request.body ?? {});
    if (!datos.success) return reply.code(400).send({ error: 'Datos invalidos' });

    return conErrores(reply, async () => {
      const resultado = await publicarProyecto(
        fastify.prisma,
        params.data.id,
        request.user.id,
        datos.data.portada,
      );

      await fastify.prisma.telemetryEvent.create({
        data: {
          usuarioId: request.user.id,
          evento: 'juego_publicado',
          datos: { proyectoId: params.data.id, diploma: resultado.diploma.codigo },
        },
      });

      return reply.send(resultado);
    });
  });

  fastify.post('/:id/despublicar', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    return conErrores(reply, async () => {
      const proyecto = await despublicarProyecto(fastify.prisma, params.data.id, request.user.id);
      return reply.send({ proyecto });
    });
  });

  fastify.delete('/:id', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    return conErrores(reply, async () => {
      await borrarProyecto(fastify.prisma, params.data.id, request.user.id);
      return reply.send({ borrado: true });
    });
  });
};
