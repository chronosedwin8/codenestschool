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
import { pagosRoutes } from './routes/pagos.routes.js';
import { docenteRoutes } from './routes/docente.routes.js';
import { portalRoutes } from './routes/portal.routes.js';
import { progresoRoutes } from './routes/progreso.routes.js';
import { sessionsRoutes } from './routes/sessions.routes.js';
import { telemetryRoutes } from './routes/telemetry.routes.js';
import { asegurarParticiones } from '../scripts/ensure-partitions.js';

/**
 * Donde estan el juego compilado y el sitio publico.
 *
 * Se pueden fijar por entorno porque en produccion el servidor no vive dentro
 * del repositorio: es un archivo empaquetado junto a sus estaticos, y contar
 * carpetas hacia arriba desde el codigo daba una ruta distinta segun se
 * ejecutara el fuente o el compilado. Eso hacia que en produccion el servidor
 * arrancara sin encontrar ni el juego ni la portada, y sin decir nada, porque un
 * estatico que no existe simplemente no se registra.
 */
const RAIZ_REPO = resolve(import.meta.dirname, '..', '..', '..');
const DIR_APP = process.env.DIR_APP
  ? resolve(process.env.DIR_APP)
  : resolve(RAIZ_REPO, 'apps', 'frontend', 'dist');
const DIR_HOMEPAGE = process.env.DIR_HOMEPAGE
  ? resolve(process.env.DIR_HOMEPAGE)
  : resolve(RAIZ_REPO, 'apps', 'homepage');

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
  await fastify.register(pagosRoutes, { prefix: '/api/pagos' });
  await fastify.register(portalRoutes, { prefix: '/api/portal' });
  await fastify.register(docenteRoutes, { prefix: '/api/docente' });
  await fastify.register(progresoRoutes, { prefix: '/api/progreso' });

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
  //
  // El comodin se deja activado a proposito. Con `wildcard: false` la libreria
  // recorre la carpeta al arrancar y registra una ruta por archivo, asi que
  // cualquier compilacion posterior del frontend queda invisible hasta reiniciar
  // el servidor: los assets nuevos caian en el reenvio de la SPA y el navegador
  // recibia HTML donde esperaba un modulo, con la pantalla en blanco y sin un
  // solo error legible. Con el comodin, un archivo que no existe llama al
  // manejador de "no encontrado", que es justo donde vive el reenvio.
  let sendFileDisponible = false;

  if (existsSync(DIR_APP)) {
    await fastify.register(fastifyStatic, {
      root: DIR_APP,
      prefix: '/app/',
      decorateReply: true,
    });
    sendFileDisponible = true;
  }

  if (existsSync(DIR_HOMEPAGE)) {
    await fastify.register(fastifyStatic, {
      root: DIR_HOMEPAGE,
      prefix: '/',
      decorateReply: !sendFileDisponible,
    });
    sendFileDisponible = true;
  }

  /**
   * Distingue una ruta del enrutador del cliente de una peticion de archivo.
   *
   * `/app/actividad/1` es una pantalla y debe devolver el index; `/app/assets/x.js`
   * o `/app/static/audio/y.mp3` son archivos, y si no estan, devolver el index
   * con un 200 solo sirve para esconder el fallo.
   */
  const pareceArchivo = (url: string): boolean => {
    const ruta = url.split('?')[0] ?? '';
    return /\.[a-z0-9]{2,5}$/i.test(ruta);
  };

  // Rutas no encontradas: la API responde JSON; el navegador recibe la pagina
  // que corresponda para que el enrutador del cliente tome el control.
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Ruta no encontrada' });
    }
    if (request.method === 'GET' && sendFileDisponible && !pareceArchivo(request.url)) {
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
    // El codigo puede venir en `statusCode` o en `status` segun quien lance el
    // error: los plugins no son uniformes. Leer solo `statusCode` convertia el
    // 429 del limite de peticiones en un 500, que rompe los reintentos del
    // cliente y ensucia la monitorizacion.
    const conCodigo = error as FastifyError & { status?: number };
    const status = conCodigo.statusCode ?? conCodigo.status ?? reply.statusCode ?? 500;

    if (status >= 500) {
      fastify.log.error({ err: error, url: request.url }, 'Error no controlado');
    }

    // Al cliente no se le devuelven trazas internas.
    return reply.code(status).send({
      error: status >= 500 ? 'Error interno' : (error.name || 'Error'),
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
