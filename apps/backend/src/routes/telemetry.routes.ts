/**
 * Telemetría.
 *
 * Sirve a un propósito pedagógico concreto, no a la analítica por la analítica:
 * un docente necesita saber en qué actividad se atascan sus estudiantes y qué
 * error comenten, para poder explicar el concepto en clase. Los eventos que se
 * registran son exactamente los que responden a eso.
 *
 * Los eventos llegan por lotes porque un niño jugando genera muchos en poco
 * tiempo y no tiene sentido una petición por cada uno.
 *
 * La respuesta nunca incluye el identificador del evento: es un BigInt de una
 * tabla particionada, y serializarlo obligaría a un apaño en toda la API.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

/** Eventos que se aceptan. Una lista cerrada evita que crezca sin control. */
const EVENTOS = [
  'actividad_iniciada',
  'actividad_completada',
  'intento_fallido',
  'ejecucion',
  'error_sandbox',
  'pista_usada',
  'audio_repetido',
  'actividad_abandonada',
  'mundo_abierto',
] as const;

const eventoSchema = z.object({
  evento: z.enum(EVENTOS),
  actividadId: z.number().int().positive().optional(),
  sesionId: z.number().int().positive().optional(),
  // Los datos son libres pero acotados: nada de cargas arbitrarias grandes.
  datos: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

const loteSchema = z.object({
  eventos: z.array(eventoSchema).min(1).max(50),
});

export const telemetryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Registra un lote de eventos del niño que está jugando. */
  fastify.post('/eventos', { preHandler: fastify.autenticar }, async (request, reply) => {
    const datos = loteSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    await fastify.prisma.telemetryEvent.createMany({
      data: datos.data.eventos.map((e) => ({
        usuarioId: request.user.id,
        actividadId: e.actividadId ?? null,
        sesionId: e.sesionId ?? null,
        evento: e.evento,
        datos: e.datos ?? {},
      })),
    });

    // Solo el recuento: el identificador es un BigInt y no viaja al cliente.
    return reply.send({ recibidos: datos.data.eventos.length });
  });

  /**
   * Reporte de un niño para su tutor o su docente.
   * Se construye sobre las métricas diarias y el progreso, no sobre la
   * telemetría cruda: las consultas son órdenes de magnitud más baratas.
   */
  fastify.get(
    '/reporte/:ninoId',
    { preHandler: fastify.exigirAccesoANino },
    async (request, reply) => {
      const params = z
        .object({ ninoId: z.coerce.number().int().positive() })
        .safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

      const ninoId = params.data.ninoId;
      const desde = new Date();
      desde.setDate(desde.getDate() - 30);

      const [nino, progreso, metricas, porMundo] = await Promise.all([
        fastify.prisma.user.findUnique({
          where: { id: ninoId },
          select: {
            id: true,
            nombre: true,
            usuario: true,
            grupoEdad: true,
            monedas: true,
            estrellasTotales: true,
            rachaDias: true,
            ultimaActividad: true,
          },
        }),

        fastify.prisma.userActivityProgress.aggregate({
          where: { usuarioId: ninoId },
          _count: { _all: true },
          _sum: { mejorEstrellas: true, intentosTotales: true },
        }),

        fastify.prisma.userMetricDaily.findMany({
          where: { usuarioId: ninoId, fecha: { gte: desde } },
          orderBy: { fecha: 'asc' },
          select: {
            fecha: true,
            tiempoSeg: true,
            actividadesCompletadas: true,
            estrellas: true,
          },
        }),

        // Progreso por mundo: es lo que el tutor quiere ver de un vistazo.
        fastify.prisma.$queryRaw<
          { numero: number; nombre: string; completadas: bigint; estrellas: bigint }[]
        >`
          SELECT m.numero,
                 m.nombre,
                 count(*) FILTER (WHERE p.completada)  AS completadas,
                 coalesce(sum(p.mejor_estrellas), 0)   AS estrellas
          FROM   progreso_actividad p
          JOIN   actividades a ON a.id = p.actividad_id
          JOIN   mundos      m ON m.id = a.mundo_id
          WHERE  p.usuario_id = ${ninoId}
          GROUP  BY m.numero, m.nombre
          ORDER  BY m.numero
        `,
      ]);

      if (!nino) return reply.code(404).send({ error: 'Ese estudiante no existe' });

      // Actividades donde se atasca: muchos intentos y sin completar.
      const atascos = await fastify.prisma.userActivityProgress.findMany({
        where: { usuarioId: ninoId, completada: false, intentosTotales: { gte: 3 } },
        orderBy: { intentosTotales: 'desc' },
        take: 5,
        select: {
          intentosTotales: true,
          actividad: {
            select: { nombre: true, numeroEnMundo: true, mundo: { select: { numero: true, nombre: true } } },
          },
        },
      });

      return reply.send({
        nino,
        resumen: {
          actividadesJugadas: progreso._count._all,
          estrellas: progreso._sum.mejorEstrellas ?? 0,
          intentosTotales: progreso._sum.intentosTotales ?? 0,
        },
        // El tiempo se agrega por día para poder dibujar la evolución.
        actividadDiaria: metricas.map((m) => ({
          fecha: m.fecha,
          minutos: Math.round(m.tiempoSeg / 60),
          actividades: m.actividadesCompletadas,
          estrellas: m.estrellas,
        })),
        porMundo: porMundo.map((m) => ({
          numero: m.numero,
          nombre: m.nombre,
          completadas: Number(m.completadas),
          estrellas: Number(m.estrellas),
        })),
        atascos: atascos.map((a) => ({
          actividad: a.actividad.nombre,
          mundo: a.actividad.mundo.nombre,
          numeroEnMundo: a.actividad.numeroEnMundo,
          intentos: a.intentosTotales,
        })),
      });
    },
  );
};
