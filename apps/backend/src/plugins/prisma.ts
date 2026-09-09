/**
 * Cliente Prisma unico para toda la aplicacion.
 *
 * Codexia creaba un `new PrismaClient()` en cada archivo de rutas: ocho pools
 * de conexiones para una sola base de datos. Aqui hay uno, decorado en la
 * instancia de Fastify y cerrado limpiamente al apagar el servidor.
 */
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function plugin(fastify: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'error' }],
  });

  prisma.$on('error', (evento) => {
    fastify.log.error({ prisma: evento }, 'Error de Prisma');
  });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instancia) => {
    await instancia.prisma.$disconnect();
  });
}

export const prismaPlugin = fp(plugin, { name: 'prisma' });
