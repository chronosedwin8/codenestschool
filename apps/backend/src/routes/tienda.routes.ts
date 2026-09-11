/**
 * La tienda.
 *
 * Todas las rutas van con `exigirJugador`: la tienda es del nino. Un docente o
 * un administrador no compran gorros ni gastan estrellas de nadie, igual que no
 * juegan las actividades.
 *
 * Ninguna ruta recibe un precio ni un saldo. Lo unico que viaja desde el
 * navegador es la clave de lo que quiere, y el servidor decide si puede.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  ErrorTienda,
  cambiarPoder,
  comprar,
  equipar,
  esEquipable,
  usar,
  verTienda,
} from '../services/tienda.service.js';

const claveSchema = z.object({ clave: z.string().min(1).max(60) });

const equiparSchema = z.object({
  tipo: z.enum(['color', 'sombrero', 'gafas', 'disfraz', 'accesorio']),
  /** Nula para quitarse lo que lleva puesto de ese tipo. */
  clave: z.string().min(1).max(60).nullable(),
});

const poderSchema = z.object({
  clave: z.string().min(1).max(60),
  encendido: z.boolean(),
});

export const tiendaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** El catalogo con el estado de este nino en cada articulo. */
  fastify.get('/', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    return reply.send(await verTienda(fastify.prisma, request.user.id));
  });

  fastify.post('/comprar', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const datos = claveSchema.safeParse(request.body);
    if (!datos.success) return reply.code(400).send({ error: 'Articulo invalido' });

    try {
      const compra = await comprar(fastify.prisma, request.user.id, datos.data.clave);

      await fastify.prisma.telemetryEvent.create({
        data: {
          usuarioId: request.user.id,
          evento: 'compra_tienda',
          datos: { clave: compra.clave, tipo: compra.tipo },
        },
      });

      return reply.send(compra);
    } catch (error) {
      if (error instanceof ErrorTienda) {
        return reply.code(error.codigo).send({ error: error.message });
      }
      throw error;
    }
  });

  fastify.post('/equipar', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const datos = equiparSchema.safeParse(request.body);
    if (!datos.success) return reply.code(400).send({ error: 'Datos invalidos' });
    if (!esEquipable(datos.data.tipo)) return reply.code(400).send({ error: 'Eso no se lleva puesto' });

    try {
      const aspecto = await equipar(
        fastify.prisma,
        request.user.id,
        datos.data.tipo,
        datos.data.clave,
      );
      return reply.send({ aspecto });
    } catch (error) {
      if (error instanceof ErrorTienda) {
        return reply.code(error.codigo).send({ error: error.message });
      }
      throw error;
    }
  });

  /** Enciende o apaga un poder ya comprado. */
  fastify.post('/poder', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const datos = poderSchema.safeParse(request.body);
    if (!datos.success) return reply.code(400).send({ error: 'Datos invalidos' });

    try {
      const aspecto = await cambiarPoder(
        fastify.prisma,
        request.user.id,
        datos.data.clave,
        datos.data.encendido,
      );
      return reply.send({ aspecto });
    } catch (error) {
      if (error instanceof ErrorTienda) {
        return reply.code(error.codigo).send({ error: error.message });
      }
      throw error;
    }
  });

  /** Gasta una pocion o un Pase del Nido. */
  fastify.post('/usar', { preHandler: fastify.exigirJugador }, async (request, reply) => {
    const datos = claveSchema.safeParse(request.body);
    if (!datos.success) return reply.code(400).send({ error: 'Articulo invalido' });

    try {
      const uso = await usar(fastify.prisma, request.user.id, datos.data.clave);

      await fastify.prisma.telemetryEvent.create({
        data: {
          usuarioId: request.user.id,
          evento: 'uso_tienda',
          datos: { clave: uso.clave, mundoAbierto: uso.mundoAbierto },
        },
      });

      return reply.send(uso);
    } catch (error) {
      if (error instanceof ErrorTienda) {
        return reply.code(error.codigo).send({ error: error.message });
      }
      throw error;
    }
  });
};
