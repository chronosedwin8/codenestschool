/**
 * Sesiones de juego y envios de programa.
 *
 * El flujo de una actividad:
 *   1. POST /sesiones          -> abre (o reanuda) la sesion al entrar
 *   2. POST /sesiones/:id/envio -> cada vez que el nino pulsa "jugar"
 *
 * El envio manda el codigo (solo como registro pedagogico) y las acciones que
 * el sandbox ejecuto. El servidor reproduce esas acciones y decide las
 * estrellas por su cuenta.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ActivityConfigV3 } from '@codenest/shared';

import { evaluarIntento, registrarIntento } from '../services/scoring.service.js';

const abrirSesionSchema = z.object({
  actividadId: z.number().int().positive(),
  editor: z.enum(['comandos', 'bloques', 'texto']),
  lenguaje: z.enum(['comandos', 'javascript', 'python']),
});

const accionSchema = z.object({
  cmd: z.string().min(1).max(40),
  desde: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  hasta: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  celdasRecorridas: z
    .array(z.object({ x: z.number().int(), y: z.number().int() }))
    .max(2000)
    .optional(),
  dir: z.enum(['arriba', 'abajo', 'izquierda', 'derecha']).optional(),
  itemId: z.string().max(60).optional(),
  exito: z.boolean().optional(),
});

const envioSchema = z.object({
  codigo: z.string().max(20_000),
  programa: z.unknown().optional(),
  acciones: z.array(accionSchema).max(5000),
  tamanoPrograma: z.number().int().min(0).max(5000),
  tiempoSegundos: z.number().int().min(0).max(86_400).default(0),
  tiempoEjecucionMs: z.number().int().min(0).max(600_000).optional(),
  estructurasUsadas: z.array(z.string().max(40)).max(20).optional(),
  pistasUsadas: z.number().int().min(0).max(10).default(0),
});

const paramsSesion = z.object({ id: z.coerce.number().int().positive() });

export const sessionsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Abre o reanuda la sesion de una actividad. */
  fastify.post('/', { preHandler: fastify.autenticar }, async (request, reply) => {
    const datos = abrirSesionSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    const actividad = await fastify.prisma.activity.findUnique({
      where: { id: datos.data.actividadId },
      select: { id: true, activo: true },
    });
    if (!actividad?.activo) return reply.code(404).send({ error: 'Esa actividad no existe' });

    // Se reanuda la sesion abierta en lugar de crear una nueva por cada visita.
    const abierta = await fastify.prisma.activitySession.findFirst({
      where: { usuarioId: request.user.id, actividadId: actividad.id, completada: false },
      orderBy: { iniciadaEn: 'desc' },
    });

    const sesion =
      abierta ??
      (await fastify.prisma.activitySession.create({
        data: {
          usuarioId: request.user.id,
          actividadId: actividad.id,
          editorUsado: datos.data.editor,
          lenguaje: datos.data.lenguaje,
        },
      }));

    await fastify.prisma.telemetryEvent.create({
      data: {
        usuarioId: request.user.id,
        actividadId: actividad.id,
        sesionId: sesion.id,
        evento: 'actividad_iniciada',
        datos: { editor: datos.data.editor, lenguaje: datos.data.lenguaje },
      },
    });

    return reply.code(abierta ? 200 : 201).send({ sesion: { id: sesion.id, intentos: sesion.intentos } });
  });

  /** Envia un intento: el servidor lo verifica y concede las estrellas. */
  fastify.post('/:id/envio', { preHandler: fastify.autenticar }, async (request, reply) => {
    const params = paramsSesion.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Sesion invalida' });

    const datos = envioSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    const sesion = await fastify.prisma.activitySession.findUnique({
      where: { id: params.data.id },
      include: { actividad: true },
    });

    if (!sesion) return reply.code(404).send({ error: 'Esa sesion no existe' });
    if (sesion.usuarioId !== request.user.id) {
      return reply.code(403).send({ error: 'Esa sesion no es tuya' });
    }

    const config = sesion.actividad.config as unknown as ActivityConfigV3;

    const resultado = evaluarIntento(config, datos.data.acciones, {
      tamanoPrograma: datos.data.tamanoPrograma,
      instruccionesEjecutadas: datos.data.acciones.length,
      tiempoSegundos: datos.data.tiempoSegundos,
      estructurasUsadas: datos.data.estructurasUsadas,
    });

    const registro = await registrarIntento(fastify.prisma, {
      usuarioId: request.user.id,
      actividadId: sesion.actividadId,
      sesionId: sesion.id,
      resultado,
      tiempoSegundos: datos.data.tiempoSegundos,
      monedasBase: config.recompensa.monedas,
    });

    await fastify.prisma.codeSubmission.create({
      data: {
        sesionId: sesion.id,
        usuarioId: request.user.id,
        actividadId: sesion.actividadId,
        codigo: datos.data.codigo,
        editor: sesion.editorUsado,
        lenguaje: sesion.lenguaje,
        accionesEjecutadas: datos.data.acciones as unknown as object,
        tamanoPrograma: datos.data.tamanoPrograma,
        resultado: { objetivos: resultado.objetivos, mensaje: resultado.mensaje },
        exitoso: resultado.estrellas > 0,
        estrellas: resultado.estrellas,
        tiempoEjecucionMs: datos.data.tiempoEjecucionMs ?? null,
      },
    });

    await fastify.prisma.telemetryEvent.create({
      data: {
        usuarioId: request.user.id,
        actividadId: sesion.actividadId,
        sesionId: sesion.id,
        evento: resultado.estrellas > 0 ? 'actividad_completada' : 'intento_fallido',
        datos: {
          estrellas: resultado.estrellas,
          tamanoPrograma: datos.data.tamanoPrograma,
          instrucciones: datos.data.acciones.length,
          pistasUsadas: datos.data.pistasUsadas,
          verificado: resultado.valido,
        },
      },
    });

    return reply.send({
      estrellas: registro.estrellas,
      monedasGanadas: registro.monedasPagadas,
      monedasTotales: registro.monedasTotales,
      objetivos: resultado.objetivos,
      verificado: resultado.valido,
      mensaje: resultado.mensaje,
    });
  });

  /** Historial de intentos de una actividad (panel del tutor o del docente). */
  fastify.get('/actividad/:id/envios', { preHandler: fastify.autenticar }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    const envios = await fastify.prisma.codeSubmission.findMany({
      where: { actividadId: params.data.id, usuarioId: request.user.id },
      orderBy: { enviadoEn: 'desc' },
      take: 20,
      select: {
        id: true,
        editor: true,
        lenguaje: true,
        tamanoPrograma: true,
        estrellas: true,
        exitoso: true,
        enviadoEn: true,
      },
    });

    return reply.send({ envios });
  });
};
