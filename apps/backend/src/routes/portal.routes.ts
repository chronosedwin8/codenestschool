/**
 * Portal del cliente.
 *
 * Responde a lo que un tutor o un colegio necesita resolver sin escribir un
 * correo: en qué estado está su licencia, cuántos perfiles le quedan, qué pagos
 * hay registrados y cómo va cada estudiante.
 *
 * Los reportes por niño viven en las rutas de telemetría; aquí está lo
 * administrativo.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { hashPin, LONGITUD_PIN } from '../services/auth.service.js';
import { comprobarAccesoANino } from '../services/guardian.service.js';

const facturacionSchema = z.object({
  razonSocial: z.string().max(200).optional(),
  nitCedula: z.string().min(4).max(40),
  direccion: z.string().max(250).optional(),
  ciudad: z.string().min(2).max(100),
  telefono: z.string().max(40).optional(),
});

const cambiarPinSchema = z.object({
  ninoId: z.number().int().positive(),
  pin: z.array(z.string().min(1).max(30)).length(LONGITUD_PIN),
});

export const portalRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Estado de la suscripción del titular. */
  fastify.get(
    '/suscripcion',
    { preHandler: fastify.exigirRol('tutor', 'docente', 'admin_escuela') },
    async (request, reply) => {
      const licencia = await fastify.prisma.license.findFirst({
        where: { titularId: request.user.id },
        // La más reciente: una renovación crea una licencia nueva.
        orderBy: [{ estado: 'asc' }, { creadoEn: 'desc' }],
        include: {
          plan: { select: { nombre: true, clave: true, precioCop: true, maxNinos: true } },
          pagos: {
            orderBy: { creadoEn: 'desc' },
            take: 20,
            select: {
              id: true,
              montoCop: true,
              estado: true,
              metodo: true,
              creadoEn: true,
              mpPaymentId: true,
            },
          },
        },
      });

      // Perfiles ya creados, para poder mostrar los cupos restantes.
      const usados = await fastify.prisma.guardianLink.count({
        where: { tutorId: request.user.id },
      });

      return reply.send({
        licencia: licencia
          ? {
              id: licencia.id,
              estado: licencia.estado,
              inicioVigencia: licencia.inicioVigencia,
              finVigencia: licencia.finVigencia,
              // El código solo se entrega si la licencia está activa.
              codigoAcceso: licencia.estado === 'activa' ? licencia.codigoAcceso : null,
              plan: licencia.plan,
            }
          : null,
        pagos: licencia?.pagos ?? [],
        cupos: { usados, maximo: licencia?.plan.maxNinos ?? null },
      });
    },
  );

  /** Datos de facturación del titular. */
  fastify.get(
    '/facturacion',
    { preHandler: fastify.exigirRol('tutor', 'docente', 'admin_escuela') },
    async (request, reply) => {
      const perfil = await fastify.prisma.billingProfile.findUnique({
        where: { usuarioId: request.user.id },
      });
      return reply.send({ perfil });
    },
  );

  fastify.put(
    '/facturacion',
    { preHandler: fastify.exigirRol('tutor', 'docente', 'admin_escuela') },
    async (request, reply) => {
      const datos = facturacionSchema.safeParse(request.body);
      if (!datos.success) {
        return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
      }

      const perfil = await fastify.prisma.billingProfile.upsert({
        where: { usuarioId: request.user.id },
        update: datos.data,
        create: { usuarioId: request.user.id, ...datos.data },
      });

      return reply.send({ perfil });
    },
  );

  /**
   * Cambia el PIN de imágenes de un niño.
   *
   * Hace falta más de lo que parece: los PIN de dibujos se comparten entre
   * hermanos y se olvidan, y sin esta ruta el adulto tendría que crear un perfil
   * nuevo y perder todo el progreso.
   */
  fastify.put(
    '/pin',
    { preHandler: fastify.exigirRol('tutor', 'docente', 'admin_escuela') },
    async (request, reply) => {
      const datos = cambiarPinSchema.safeParse(request.body);
      if (!datos.success) {
        return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
      }

      const acceso = await comprobarAccesoANino(
        fastify.prisma,
        request.user,
        datos.data.ninoId,
      );
      if (!acceso.permitido) {
        return reply.code(403).send({ error: 'Ese estudiante no esta a tu cargo' });
      }

      await fastify.prisma.user.update({
        where: { id: datos.data.ninoId },
        data: { pinHash: await hashPin(datos.data.pin) },
      });

      return reply.send({ mensaje: 'Listo. El nuevo PIN ya funciona.' });
    },
  );

  /**
   * Derecho de supresión (Ley 1581): borra el perfil de un niño y sus datos.
   *
   * Se hace de verdad, no marcando una casilla: el progreso, las sesiones, los
   * envíos y el vínculo con el tutor desaparecen en cascada. La telemetría no
   * tiene clave foránea justamente para que este borrado sea posible, así que se
   * elimina aparte.
   */
  fastify.delete(
    '/ninos/:ninoId',
    { preHandler: fastify.exigirAccesoANino },
    async (request, reply) => {
      const params = z
        .object({ ninoId: z.coerce.number().int().positive() })
        .safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

      const ninoId = params.data.ninoId;

      const nino = await fastify.prisma.user.findUnique({
        where: { id: ninoId },
        select: { rol: true },
      });
      if (nino?.rol !== 'nino') {
        return reply.code(400).send({ error: 'Solo se pueden borrar perfiles de estudiantes' });
      }

      await fastify.prisma.$transaction([
        // La telemetría no cae en cascada (no tiene clave foránea).
        fastify.prisma.telemetryEvent.deleteMany({ where: { usuarioId: ninoId } }),
        fastify.prisma.user.delete({ where: { id: ninoId } }),
      ]);

      fastify.log.info(
        { ninoId, actorId: request.user.id },
        'Perfil de estudiante borrado a peticion del responsable',
      );

      return reply.send({ mensaje: 'El perfil y todos sus datos se borraron.' });
    },
  );

  /**
   * Exportación de los datos de un niño (derecho de acceso, Ley 1581).
   * Se entrega todo lo que la plataforma guarda sobre ese menor.
   */
  fastify.get(
    '/ninos/:ninoId/datos',
    { preHandler: fastify.exigirAccesoANino },
    async (request, reply) => {
      const params = z
        .object({ ninoId: z.coerce.number().int().positive() })
        .safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

      const ninoId = params.data.ninoId;

      const [nino, progreso, sesiones, consentimientos] = await Promise.all([
        fastify.prisma.user.findUnique({
          where: { id: ninoId },
          select: {
            usuario: true,
            nombre: true,
            grupoEdad: true,
            fechaNacimiento: true,
            avatarConfig: true,
            monedas: true,
            estrellasTotales: true,
            creadoEn: true,
          },
        }),
        fastify.prisma.userActivityProgress.findMany({
          where: { usuarioId: ninoId },
          select: {
            mejorEstrellas: true,
            completada: true,
            intentosTotales: true,
            primeraVez: true,
            ultimaVez: true,
            actividad: { select: { nombre: true, mundo: { select: { nombre: true } } } },
          },
        }),
        fastify.prisma.activitySession.count({ where: { usuarioId: ninoId } }),
        fastify.prisma.parentalConsent.findMany({
          where: { ninoId },
          select: { estado: true, versionPolitica: true, otorgadoEn: true, revocadoEn: true },
        }),
      ]);

      if (!nino) return reply.code(404).send({ error: 'Ese estudiante no existe' });

      return reply.send({
        generadoEn: new Date().toISOString(),
        perfil: nino,
        totalSesiones: sesiones,
        progreso,
        consentimientos,
        nota: 'Estos son todos los datos que CodeNest School guarda sobre este estudiante.',
      });
    },
  );
};
