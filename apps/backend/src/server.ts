/**
 * Servidor de CodeNest School.
 *
 * Sirve tres cosas desde un solo proceso:
 *   /api      la API
 *   /app      el juego y el portal del cliente (aplicacion Vue)
 *   /         el sitio publico, optimizado para buscadores
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';

import { cargarConfig, pagosConfigurados } from './lib/env.js';
import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';
import { securityPlugin } from './plugins/security.js';
import { authRoutes } from './routes/auth.routes.js';
import { curriculumRoutes } from './routes/curriculum.routes.js';
import { sessionsRoutes } from './routes/sessions.routes.js';
import { telemetryRoutes } from './routes/telemetry.routes.js';
import { asegurarParticiones } from '../scripts/ensure-partitions.js';

const RAIZ_REPO = resolve(import.meta.dirname, '..', '..', '..');
const DIR_APP = resolve(RAIZ_REPO, 'apps', 'frontend', 'dist');
const DIR_HOMEPAGE = resolve(RAIZ_REPO, 'apps', 'homepage');

export async function construirServidor(): Promise<FastifyInstance> {
  const config = cargarConfig();
  const enProduccion = config.NODE_ENV === 'production';

  const fastify = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : enProduccion
      ? { level: 'warn' }
      : {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
    // Cabeceras de proxy: en produccion el servidor va detras de uno.
    trustProxy: enProduccion,
    bodyLimit: 1_048_576, // 1 MB: los programas de los ninos son pequenos
  });

  await fastify.register(securityPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);

  // Rutas de la API.
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(curriculumRoutes, { prefix: '/api/curriculo' });
  await fastify.register(sessionsRoutes, { prefix: '/api/sesiones' });
  await fastify.register(telemetryRoutes, { prefix: '/api/telemetria' });

  fastify.get('/health', async () => ({
    estado: 'ok',
    momento: new Date().toISOString(),
    pagos: pagosConfigurados(config) ? 'configurados' : 'sin configurar',
  }));

  // Archivos estaticos, solo si existen (en desarrollo el frontend usa Vite).
  //
  // Exactamente UNO de los registros debe decorar la respuesta con sendFile:
  // @fastify/static lanza si se registra dos veces, pero si ninguno la decora,
  // el reenvio del enrutador del cliente falla con un 500. Decora el primero
  // que exista y los siguientes pasan la raiz explicitamente al usarlo.
  let sendFileDisponible = false;

  if (existsSync(DIR_APP)) {
    await fastify.register(fastifyStatic, {
      root: DIR_APP,
      prefix: '/app/',
      wildcard: false,
      decorateReply: true,
    });
    sendFileDisponible = true;
  }

  if (existsSync(DIR_HOMEPAGE)) {
    await fastify.register(fastifyStatic, {
      root: DIR_HOMEPAGE,
      prefix: '/',
      wildcard: false,
      decorateReply: !sendFileDisponible,
    });
    sendFileDisponible = true;
  }

  // Rutas no encontradas: la API responde JSON; el navegador recibe la pagina
  // que corresponda para que el enrutador del cliente tome el control.
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Ruta no encontrada' });
    }
    if (request.method === 'GET' && sendFileDisponible) {
      // Rutas internas del juego y del portal: las resuelve el enrutador del
      // cliente, asi que se devuelve su index.
      if (request.url.startsWith('/app') && existsSync(DIR_APP)) {
        return reply.sendFile('index.html', DIR_APP);
      }
      if (existsSync(DIR_HOMEPAGE)) {
        return reply.sendFile('index.html', DIR_HOMEPAGE);
      }
    }
    return reply.code(404).send({ error: 'Ruta no encontrada' });
  });

  fastify.setErrorHandler(async (error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      fastify.log.error({ err: error, url: request.url }, 'Error no controlado');
    }
    // Al cliente no se le devuelven trazas internas.
    return reply.code(status).send({
      error: status >= 500 ? 'Error interno' : error.name,
      mensaje: status >= 500 ? 'Algo salio mal. Intentalo de nuevo.' : error.message,
    });
  });

  return fastify;
}

async function main(): Promise<void> {
  const config = cargarConfig();
  const fastify = await construirServidor();

  // Las particiones del mes en curso deben existir antes de la primera escritura
  // de telemetria; si no, todo caeria en la particion por defecto.
  try {
    const particiones = await asegurarParticiones(fastify.prisma);
    for (const p of particiones) {
      if (p.enDefault > 0) {
        fastify.log.warn(
          `${p.tabla}: ${p.enDefault} fila(s) en la particion por defecto; conviene reubicarlas`,
        );
      }
    }
  } catch (error) {
    fastify.log.error({ err: error }, 'No se pudieron asegurar las particiones');
  }

  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });

  for (const senal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(senal, () => {
      void fastify.close().then(() => process.exit(0));
    });
  }
}

// Solo arranca si se ejecuta directamente; las pruebas importan el constructor.
if (process.argv[1]?.includes('server')) {
  main().catch((error: unknown) => {
    console.error('No se pudo arrancar el servidor:', error);
    process.exit(1);
  });
}
