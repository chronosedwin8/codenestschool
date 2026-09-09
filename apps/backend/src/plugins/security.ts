/**
 * Cabeceras de seguridad, CORS y limites de peticiones.
 *
 * El limite de intentos importa mas de lo habitual: el acceso de los ninos es
 * un PIN de cuatro imagenes, mucho mas facil de adivinar que una contrasena.
 * Sin freno, un atacante lo agota en minutos.
 */
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { cargarConfig } from '../lib/env.js';

const ORIGENES_DESARROLLO = ['http://localhost:5173', 'http://localhost:3001'];

async function plugin(fastify: FastifyInstance): Promise<void> {
  const config = cargarConfig();
  const enProduccion = config.NODE_ENV === 'production';

  await fastify.register(fastifyHelmet, {
    // El juego usa canvas y trabajadores web; la politica se afina en la fase 3
    // cuando se conozcan los origenes reales de los recursos.
    contentSecurityPolicy: enProduccion
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://sdk.mercadopago.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            mediaSrc: ["'self'"],
            connectSrc: ["'self'", 'https://api.mercadopago.com'],
            workerSrc: ["'self'", 'blob:'],
            frameSrc: ["'self'", 'https://www.mercadopago.com'],
            objectSrc: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  });

  await fastify.register(fastifyCors, {
    origin: enProduccion ? [config.PUBLIC_BASE_URL] : ORIGENES_DESARROLLO,
    credentials: true,
  });

  // Limite general, generoso: un nino jugando hace muchas peticiones.
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Las rutas de autenticacion y pago llevan su propio limite, mas estricto.
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      error: 'Demasiadas peticiones',
      mensaje: 'Espera un momento antes de volver a intentarlo',
    }),
  });
}

export const securityPlugin = fp(plugin, { name: 'security' });

/**
 * Limite estricto para inicio de sesion y pagos: pocos intentos por minuto.
 * Se aplica por ruta con la opcion `config.rateLimit`.
 */
export const LIMITE_ESTRICTO = {
  rateLimit: {
    max: 8,
    timeWindow: '1 minute',
  },
} as const;
