/**
 * Cabeceras de seguridad, CORS y limites de peticiones.
 *
 * El diseño de los limites parte de un hecho del producto: un colegio con el plan
 * Escuela sale a internet por una sola direccion IP. Cinco aulas de treinta
 * estudiantes son ciento cincuenta ninos jugando desde la misma IP, y eso son mas
 * de mil peticiones por minuto perfectamente legitimas.
 *
 * Un limite por IP, por tanto, no distingue entre un abusador y un colegio
 * entero. La clave tiene que identificar al individuo:
 *
 *  - Peticiones AUTENTICADAS: se cuentan por credencial, no por IP. Cada
 *    estudiante tiene su propio cupo, asi que el aula de al lado no le consume el
 *    suyo. Para llegar aqui hace falta un token, y un token exige una cuenta con
 *    licencia, de modo que el cupo por cuenta es el control adecuado.
 *  - Peticiones ANONIMAS (acceso, pago, sitio publico): se cuentan por IP, porque
 *    no hay nada mejor. Los topes se fijan pensando en un colegio entero
 *    empezando la clase, y la proteccion contra adivinar credenciales no vive
 *    aqui sino en services/intentos.service.ts, que cuenta los FALLOS. Un colegio
 *    entrando bien no consume nada; alguien probando contrasenas se bloquea.
 *
 * Lo que estos limites NO cubren es una inundacion volumetrica de trafico basura.
 * Eso se resuelve delante de la aplicacion (balanceador, CDN), no aqui: cualquier
 * tope que frenara a un atacante con ancho de banda frenaria antes a un colegio.
 */
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { cargarConfig } from '../lib/env.js';

const ORIGENES_DESARROLLO = ['http://localhost:5173', 'http://localhost:3001'];

/**
 * Cupo por credencial y minuto para las peticiones autenticadas.
 *
 * Un estudiante jugando genera unas ocho peticiones por minuto: cargar la
 * actividad, abrir sesion, enviar dos o tres intentos, telemetria y navegar el
 * mapa. Doscientas cuarenta deja margen de sobra para el juego mas frenetico y
 * sigue siendo un tope real para una sola cuenta.
 */
const CUPO_POR_CREDENCIAL = 240;

/**
 * Cupo por IP y minuto para las peticiones anonimas.
 *
 * Dimensionado para un colegio grande empezando la clase a la vez: cada
 * estudiante hace UNA peticion de acceso, no ocho. Seiscientos cubre un colegio
 * de seiscientos alumnos entrando en el mismo minuto.
 */
const CUPO_ANONIMO_POR_IP = 600;

/**
 * Identifica quien hace la peticion para contarle su cupo.
 *
 * El limite se aplica en el gancho `onRequest`, antes de que el token este
 * verificado, asi que aqui no se puede saber si es valido. No importa: lo unico
 * que se necesita es un identificador estable por credencial. Un token invalido
 * consigue su propio cupo, pero no llega a ninguna parte porque el manejador lo
 * rechaza con un 401 sin tocar la base de datos.
 *
 * Se usa un resumen del token y no el token entero para no guardar credenciales
 * en la memoria del limitador.
 */
export function identificarSolicitante(peticion: FastifyRequest): string {
  const cabecera = peticion.headers.authorization;

  if (cabecera?.startsWith('Bearer ')) {
    const token = cabecera.slice(7).trim();
    if (token.length > 0) {
      return `cred:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;
    }
  }

  return `ip:${peticion.ip}`;
}

async function plugin(fastify: FastifyInstance): Promise<void> {
  const config = cargarConfig();
  const enProduccion = config.NODE_ENV === 'production';

  await fastify.register(fastifyHelmet, {
    // El juego usa canvas y trabajadores web; la politica se afina cuando se
    // conocen los origenes reales de los recursos en produccion.
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

  await fastify.register(fastifyRateLimit, {
    global: true,
    // El maximo depende de quien pregunta: por credencial es alto, y por IP
    // anonima se dimensiona para un colegio entero empezando la clase.
    max: (peticion) =>
      identificarSolicitante(peticion).startsWith('cred:')
        ? CUPO_POR_CREDENCIAL
        : CUPO_ANONIMO_POR_IP,
    timeWindow: '1 minute',
    keyGenerator: identificarSolicitante,
    // El objeto lleva su propio codigo: leerlo solo de `statusCode` convertia
    // este 429 en un 500 y rompia los reintentos del cliente.
    errorResponseBuilder: (_peticion, contexto) => ({
      statusCode: 429,
      error: 'Demasiadas peticiones',
      mensaje: `Espera ${Math.ceil(contexto.ttl / 1000)} segundos y vuelve a intentarlo.`,
    }),
  });
}

export const securityPlugin = fp(plugin, { name: 'security' });

/**
 * Limite del cobro con tarjeta.
 *
 * Aqui si conviene ser estricto y contar por IP: un colegio compra una vez al
 * ano, no ciento cincuenta veces por minuto. Un tope bajo frena a quien pruebe
 * tarjetas robadas.
 */
export const LIMITE_PAGO = {
  rateLimit: {
    max: 10,
    timeWindow: '1 minute',
  },
} as const;

/**
 * Limite de las rutas de acceso.
 *
 * Generoso a proposito y contado por IP: a las ocho de la manana un colegio
 * entero entra a la vez desde la misma red, y cada estudiante hace una sola
 * peticion. Frenar aqui seria frenar el arranque de la clase.
 *
 * Lo que impide adivinar credenciales es el contador de FALLOS por cuenta y por
 * IP de services/intentos.service.ts: entrar bien no cuesta nada, equivocarse si.
 */
export const LIMITE_ACCESO = {
  rateLimit: {
    max: 600,
    timeWindow: '1 minute',
  },
} as const;
