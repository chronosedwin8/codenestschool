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

import { estadoEfectivoCotizacion, numeroDocumento } from '@codenest/shared';
import { datosFacturacionSchema } from '@codenest/shared/zod';

import { explicarRechazo } from '../lib/mercadopago.js';
import { hashPin, LONGITUD_PIN } from '../services/auth.service.js';
import { estadoEfectivoLicencia, licenciaVigente } from '../services/cobros.service.js';
import { comprobarAccesoANino } from '../services/guardian.service.js';

const cambiarPinSchema = z.object({
  ninoId: z.number().int().positive(),
  pin: z.array(z.string().min(1).max(30)).length(LONGITUD_PIN),
});

export const portalRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const soloTitulares = fastify.exigirRol('tutor', 'docente', 'admin_escuela');

  /**
   * La suscripcion del titular: la licencia que le toca ver, su renovacion si
   * la hay, y los cupos.
   */
  fastify.get('/suscripcion', { preHandler: soloTitulares }, async (request, reply) => {
    const licencias = await fastify.prisma.license.findMany({
      where: { titularId: request.user.id },
      include: {
        plan: { select: { id: true, nombre: true, clave: true, precioCop: true, maxNinos: true, activo: true } },
        renovacion: { select: { id: true, estado: true, inicioVigencia: true, finVigencia: true } },
      },
    });

    // Una renovacion ya pagada que empieza en el futuro no desplaza a la que
    // esta en curso: licenciaVigente prefiere la que cubre hoy, y la renovacion
    // se muestra como tal debajo.
    const vigente = licenciaVigente(licencias);

    const usados = await fastify.prisma.guardianLink.count({
      where: { tutorId: request.user.id },
    });

    const ahora = new Date();
    return reply.send({
      licencia: vigente
        ? {
            id: vigente.id,
            estado: estadoEfectivoLicencia(vigente, ahora),
            inicioVigencia: vigente.inicioVigencia,
            finVigencia: vigente.finVigencia,
            // El codigo solo se entrega si la licencia esta activa.
            codigoAcceso: vigente.estado === 'activa' ? vigente.codigoAcceso : null,
            plan: vigente.plan,
            renovacion: vigente.renovacion
              ? {
                  id: vigente.renovacion.id,
                  estado: vigente.renovacion.estado,
                  inicioVigencia: vigente.renovacion.inicioVigencia,
                  finVigencia: vigente.renovacion.finVigencia,
                }
              : null,
          }
        : null,
      cupos: { usados, maximo: vigente?.plan.maxNinos ?? null },
    });
  });

  /**
   * Todos los pagos del titular, de todas sus licencias.
   *
   * Antes solo se veian los de la licencia mostrada: tras renovar, el pago del
   * ano anterior desaparecia del historial.
   */
  fastify.get('/pagos', { preHandler: soloTitulares }, async (request, reply) => {
    const pagos = await fastify.prisma.payment.findMany({
      where: {
        OR: [{ usuarioId: request.user.id }, { licencia: { titularId: request.user.id } }],
      },
      orderBy: { creadoEn: 'desc' },
      take: 100,
      include: {
        licencia: { select: { plan: { select: { nombre: true } } } },
        cotizacion: { select: { prefijo: true, numero: true } },
        factura: { select: { prefijo: true, numero: true, tokenPublico: true, estado: true } },
      },
    });

    return reply.send({
      pagos: pagos.map((p) => ({
        id: p.id,
        fecha: p.aprobadoEn ?? p.creadoEn,
        montoCop: p.montoCop,
        estado: p.estado,
        // Por que se rechazo, dicho de forma que el cliente sepa que hacer.
        motivo: p.estado === 'rechazado' ? explicarRechazo(p.mpStatusDetail) : null,
        metodo: p.metodo,
        tipoMedio: p.tipoMedio,
        cuotas: p.cuotas,
        origen: p.origen,
        operacion: p.mpPaymentId ?? p.referenciaManual,
        concepto: p.licencia
          ? `Plan ${p.licencia.plan.nombre}`
          : p.cotizacion
            ? `Cotización ${numeroDocumento(p.cotizacion.prefijo, p.cotizacion.numero)}`
            : 'Pago',
        factura:
          p.factura && p.factura.estado === 'emitida'
            ? {
                numero: numeroDocumento(p.factura.prefijo, p.factura.numero),
                token: p.factura.tokenPublico,
              }
            : null,
      })),
    });
  });

  /** Las facturas del titular. Las anuladas tambien: desaparecer seria peor. */
  fastify.get('/facturas', { preHandler: soloTitulares }, async (request, reply) => {
    const facturas = await fastify.prisma.invoice.findMany({
      where: { usuarioId: request.user.id },
      orderBy: { fechaEmision: 'desc' },
      take: 100,
    });
    return reply.send({
      facturas: facturas.map((f) => ({
        id: f.id,
        numero: numeroDocumento(f.prefijo, f.numero),
        fechaEmision: f.fechaEmision,
        totalCop: f.totalCop,
        estado: f.estado,
        token: f.tokenPublico,
      })),
    });
  });

  /**
   * Las cotizaciones dirigidas al titular. Los borradores no: todavia no se
   * han enviado, y un precio en borrador no es una oferta.
   */
  fastify.get('/cotizaciones', { preHandler: soloTitulares }, async (request, reply) => {
    const cotizaciones = await fastify.prisma.quote.findMany({
      where: { usuarioId: request.user.id, estado: { not: 'borrador' } },
      orderBy: { fechaEmision: 'desc' },
      take: 50,
    });
    return reply.send({
      cotizaciones: cotizaciones.map((c) => ({
        id: c.id,
        numero: numeroDocumento(c.prefijo, c.numero),
        fechaEmision: c.fechaEmision,
        validaHasta: c.validaHasta,
        totalCop: c.totalCop,
        estado: estadoEfectivoCotizacion(c.estado, c.validaHasta),
        token: c.tokenPublico,
      })),
    });
  });

  /** Datos de facturacion del titular: lo que va en sus facturas. */
  fastify.get('/facturacion', { preHandler: soloTitulares }, async (request, reply) => {
    const perfil = await fastify.prisma.billingProfile.findUnique({
      where: { usuarioId: request.user.id },
    });
    return reply.send({
      perfil: perfil
        ? {
            tipoDocumento: perfil.tipoDocumento,
            documento: perfil.nitCedula,
            razonSocial: perfil.razonSocial,
            direccion: perfil.direccion,
            ciudad: perfil.ciudad,
            telefono: perfil.telefono,
          }
        : null,
    });
  });

  fastify.put('/facturacion', { preHandler: soloTitulares }, async (request, reply) => {
    const datos = datosFacturacionSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos', detalles: datos.error.flatten() });
    }
    const { documento, ...resto } = datos.data;
    const valores = {
      tipoDocumento: resto.tipoDocumento,
      nitCedula: documento,
      razonSocial: resto.razonSocial ?? null,
      direccion: resto.direccion ?? null,
      ciudad: resto.ciudad,
      telefono: resto.telefono ?? null,
    };
    await fastify.prisma.billingProfile.upsert({
      where: { usuarioId: request.user.id },
      update: valores,
      create: { usuarioId: request.user.id, ...valores },
    });
    return reply.send({ mensaje: 'Datos de facturación guardados.' });
  });

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
        return reply.code(400).send({ error: 'Datos inválidos', detalles: datos.error.flatten() });
      }

      const acceso = await comprobarAccesoANino(
        fastify.prisma,
        request.user,
        datos.data.ninoId,
      );
      if (!acceso.permitido) {
        return reply.code(403).send({ error: 'Ese estudiante no está a tu cargo' });
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
      if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });

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
      if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });

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
