/**
 * La zona de juegos publicados.
 *
 * A diferencia del taller, esto lo ve cualquiera con sesion: los estudiantes
 * para jugar y el docente para mirar. Por eso va con `autenticar` y no con
 * `exigirJugador`.
 *
 * El diploma es la excepcion: se verifica SIN sesion. Un diploma que solo se
 * puede comprobar estando dentro de la plataforma no sirve para ensenarselo a
 * la familia, que es justo para lo que existe.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  ACCIONES_CATALOGO,
  CONTROLES_CATALOGO,
  ESCENARIOS_CATALOGO,
  EVENTOS_CATALOGO,
  FRECUENCIAS_CATALOGO,
  METAS_CATALOGO,
  MOVIMIENTOS_CATALOGO,
  MUSICA_POR_ESCENARIO,
  OBSTACULOS_CATALOGO,
  PERSONAJES_CATALOGO,
  PREMIOS_CATALOGO,
  TAMANOS_CATALOGO,
  VELOCIDADES_CATALOGO,
} from '@codenest/content';
import { COLORES_JUEGO, LIMITES } from '@codenest/shared';

import { LIMITE_ACCESO } from '../plugins/security.js';
import { urlEscenario } from '../services/almacen.service.js';
import { verificarDiploma } from '../services/diplomas.service.js';
import {
  ErrorProyecto,
  alternarMeGusta,
  juegosPublicados,
  registrarPartida,
} from '../services/proyectos.service.js';

const paramsId = z.object({ id: z.coerce.number().int().positive() });

const listadoSchema = z.object({
  orden: z.enum(['recientes', 'populares', 'jugados']).default('recientes'),
  limite: z.coerce.number().int().min(1).max(100).default(60),
  /** Solo los juegos de un aula concreta. Lo usa el docente y la vista de clase. */
  aula: z.coerce.number().int().positive().optional(),
});

export const juegosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * Todo lo que el constructor puede ofrecer.
   *
   * Las direcciones de los escenarios las resuelve el servidor y no el
   * navegador: asi el nombre del bucket (o el dia que haya una CDN delante) vive
   * en una variable de entorno y no compilado dentro del paquete del navegador.
   *
   * Si no hay almacenamiento configurado, `imagenUrl` viene nula y el
   * constructor pinta un degradado: se puede trabajar en local sin AWS.
   */
  fastify.get('/catalogo', { preHandler: fastify.autenticar }, async (_request, reply) => {
    return reply.send({
      escenarios: ESCENARIOS_CATALOGO.map((e) => ({
        ...e,
        imagenUrl: urlEscenario(e.clave),
        musica: MUSICA_POR_ESCENARIO[e.clave],
      })),
      personajes: PERSONAJES_CATALOGO,
      obstaculos: OBSTACULOS_CATALOGO,
      premios: PREMIOS_CATALOGO,
      velocidades: VELOCIDADES_CATALOGO,
      frecuencias: FRECUENCIAS_CATALOGO,
      tamanos: TAMANOS_CATALOGO,
      movimientos: MOVIMIENTOS_CATALOGO,
      controles: CONTROLES_CATALOGO,
      metas: METAS_CATALOGO,
      eventos: EVENTOS_CATALOGO,
      acciones: ACCIONES_CATALOGO,
      colores: COLORES_JUEGO,
      limites: LIMITES,
    });
  });

  /** Los juegos publicados. */
  fastify.get('/', { preHandler: fastify.autenticar }, async (request, reply) => {
    const datos = listadoSchema.safeParse(request.query);
    if (!datos.success) return reply.code(400).send({ error: 'Filtro invalido' });

    const juegos = await juegosPublicados(fastify.prisma, request.user.id, {
      orden: datos.data.orden,
      limite: datos.data.limite,
      aulaId: datos.data.aula,
    });
    return reply.send({ juegos });
  });

  /** Suma una partida al abrir un juego. */
  fastify.post('/:id/partida', { preHandler: fastify.autenticar }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    try {
      const partidas = await registrarPartida(fastify.prisma, params.data.id);
      return reply.send({ partidas });
    } catch (error) {
      if (error instanceof ErrorProyecto) return reply.code(error.codigo).send({ error: error.message });
      throw error;
    }
  });

  /** Me gusta / ya no me gusta. */
  fastify.post('/:id/megusta', { preHandler: fastify.autenticar }, async (request, reply) => {
    const params = paramsId.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    try {
      return reply.send(await alternarMeGusta(fastify.prisma, params.data.id, request.user.id));
    } catch (error) {
      if (error instanceof ErrorProyecto) return reply.code(error.codigo).send({ error: error.message });
      throw error;
    }
  });

  /**
   * Verificacion publica de un diploma.
   *
   * Con limite de peticiones: el codigo es de 27^8 combinaciones, asi que no se
   * puede adivinar a mano, pero tampoco hace falta dejar que alguien lo intente
   * un millon de veces desde la misma direccion.
   */
  fastify.get('/diploma/:codigo', { config: LIMITE_ACCESO }, async (request, reply) => {
    const params = z
      .object({ codigo: z.string().min(6).max(20).regex(/^[A-Za-z0-9-]+$/) })
      .safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Codigo invalido' });

    const diploma = await verificarDiploma(fastify.prisma, params.data.codigo);
    if (!diploma) return reply.code(404).send({ error: 'Ese diploma no existe' });

    return reply.send({ diploma });
  });
};
