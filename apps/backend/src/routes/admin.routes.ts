/**
 * Panel de administracion: precios, pagos, facturas y cotizaciones.
 *
 * Todo exige el rol `admin`. Aqui se mueve dinero y se emiten documentos, asi
 * que cada ruta valida con zod y deja la logica en los servicios
 * (`cobros.service.ts`, `documentos.service.ts`), que son los mismos que usan el
 * checkout y el webhook: un pago manual se aplica con las mismas reglas que uno
 * de Mercado Pago.
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { estadoEfectivoCotizacion, numeroDocumento } from '@codenest/shared';
import {
  cotizacionSchema,
  emisorSchema,
  facturaSchema,
  planEditableSchema,
} from '@codenest/shared/zod';

import { cargarConfig, pagosConfigurados } from '../lib/env.js';
import {
  generarCodigoAcceso,
  generarPasswordTemporal,
  hashPassword,
} from '../services/auth.service.js';
import { ErrorMercadoPago, obtenerPago } from '../lib/mercadopago.js';
import {
  ErrorCobro,
  activarLicenciaDeCotizacion,
  aplicarPago,
  cancelarLicencia,
  conciliar,
  estadoEfectivoLicencia,
  iniciarPagoCotizacion,
  otorgarLicencia,
  registrarPagoManual,
} from '../services/cobros.service.js';
import {
  actualizarCotizacion,
  anularFactura,
  borradorFacturaDePago,
  cambiarEstadoCotizacion,
  crearCotizacion,
  crearFactura,
  guardarEmisor,
  leerEmisor,
} from '../services/documentos.service.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });

const pagoManualSchema = z
  .object({
    licenciaId: z.number().int().positive().nullable().optional(),
    cotizacionId: z.number().int().positive().nullable().optional(),
    montoCop: z.number().int().positive().max(340_000_000),
    metodo: z.enum(['transferencia', 'consignacion', 'efectivo']),
    referencia: z.string().trim().min(2).max(120),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => Boolean(d.licenciaId) !== Boolean(d.cotizacionId), {
    message: 'Un pago manual es de una licencia o de una cotización, no de las dos.',
  });

const motivoSchema = z.object({ motivo: z.string().trim().min(5).max(500) });

/** Roles que el panel puede repartir. Nunca `nino` ni `tutor`: esos nacen de otra forma. */
const rolEquipoSchema = z.enum(['docente', 'admin_escuela', 'admin']);

const nuevoMiembroSchema = z.object({
  nombre: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  rol: rolEquipoSchema,
  institucionId: z.number().int().positive().nullable().optional(),
});

const cambioMiembroSchema = z
  .object({
    rol: rolEquipoSchema.optional(),
    activo: z.boolean().optional(),
    institucionId: z.number().int().positive().nullable().optional(),
    phidiasHabilitado: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay nada que cambiar' });

const colegioSchema = z.object({
  nombre: z.string().trim().min(2).max(200),
  nit: z.string().trim().min(5).max(40).nullable().optional(),
  ciudad: z.string().trim().min(2).max(100).nullable().optional(),
  pais: z.string().trim().min(2).max(100).default('Colombia'),
  /** Cupo contratado. Null = sin limite, que es lo que tiene un plan Escuela. */
  maxEstudiantes: z.number().int().positive().max(100_000).nullable().optional(),
});

const nuevaLicenciaSchema = z.object({
  planId: z.number().int().positive(),
  titularId: z.number().int().positive(),
  institucionId: z.number().int().positive().nullable().optional(),
  /** Sin esto vale la vigencia del plan. Un piloto dura lo que dura. */
  dias: z.number().int().min(1).max(3_650).optional(),
});

const estadoCotizacionSchema = z.object({
  estado: z.enum(['enviada', 'aceptada', 'anulada']),
  motivo: z.string().trim().min(5).max(500).optional(),
});

function responderError(reply: FastifyReply, error: unknown, log: FastifyInstance['log']) {
  if (error instanceof ErrorCobro) return reply.code(error.codigo).send({ error: error.message });
  if (error instanceof ErrorMercadoPago) {
    log.error({ err: error, detalle: error.detalle }, 'Fallo de Mercado Pago desde el panel');
    return reply
      .code(502)
      .send({ error: `Mercado Pago no respondió como se esperaba (${error.estado}).` });
  }
  throw error;
}

/** Lo que el panel necesita de una cotizacion para listarla y abrirla. */
function cotizacionParaPanel(c: Prisma.QuoteGetPayload<{ include: { plan: true } }>, urlBase: string) {
  return {
    id: c.id,
    numero: numeroDocumento(c.prefijo, c.numero),
    estado: estadoEfectivoCotizacion(c.estado, c.validaHasta),
    estadoGuardado: c.estado,
    fechaEmision: c.fechaEmision,
    validaHasta: c.validaHasta.toISOString().slice(0, 10),
    cliente: c.cliente,
    items: c.items,
    subtotalCop: c.subtotalCop,
    descuentoCop: c.descuentoCop,
    ivaPorcentaje: c.ivaPorcentaje,
    ivaCop: c.ivaCop,
    totalCop: c.totalCop,
    notas: c.notas,
    condiciones: c.condiciones,
    plan: c.plan ? { id: c.plan.id, nombre: c.plan.nombre } : null,
    licenciaId: c.licenciaId,
    pagadaEn: c.pagadaEn,
    motivoAnulacion: c.motivoAnulacion,
    enlacePublico: `${urlBase}/app/documento/cotizacion/${c.tokenPublico}`,
    urlPago: c.urlPago,
  };
}

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const config = cargarConfig();
  const soloAdmin = fastify.exigirRol('admin');
  fastify.addHook('preHandler', soloAdmin);

  // ─────────────────────────────── Resumen ───────────────────────────────

  fastify.get('/resumen', async (_request, reply) => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [ingresosMes, pendientes, licenciasActivas, cotizacionesAbiertas, emisor] =
      await Promise.all([
        fastify.prisma.payment.aggregate({
          where: { estado: 'aprobado', aprobadoEn: { gte: inicioMes } },
          _sum: { montoCop: true },
          _count: true,
        }),
        fastify.prisma.payment.count({ where: { estado: 'pendiente' } }),
        fastify.prisma.license.count({
          where: { estado: 'activa', finVigencia: { gt: new Date() } },
        }),
        fastify.prisma.quote.count({ where: { estado: { in: ['enviada', 'aceptada'] } } }),
        leerEmisor(fastify.prisma),
      ]);

    return reply.send({
      ingresosMesCop: ingresosMes._sum.montoCop ?? 0,
      pagosMes: ingresosMes._count,
      pagosPendientes: pendientes,
      licenciasActivas,
      cotizacionesAbiertas,
      // Lo que falta configurar, para decirlo arriba y no descubrirlo al cobrar.
      configuracion: {
        pagos: pagosConfigurados(config),
        firmaWebhook: Boolean(config.MP_WEBHOOK_SECRET),
        emisor: Boolean(emisor),
        urlWebhook: `${config.PUBLIC_BASE_URL}/api/pagos/webhook`,
      },
    });
  });

  // ───────────────────────── Planes (tarjetas de precios) ─────────────────────────

  fastify.get('/planes', async (_request, reply) => {
    const planes = await fastify.prisma.plan.findMany({
      orderBy: { orden: 'asc' },
      include: { _count: { select: { licencias: { where: { estado: 'activa' } } } } },
    });
    return reply.send({
      planes: planes.map((p) => ({
        id: p.id,
        clave: p.clave,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precioCop: p.precioCop,
        beneficios: p.beneficios,
        destacado: p.destacado,
        orden: p.orden,
        activo: p.activo,
        maxNinos: p.maxNinos,
        vigenciaDias: p.vigenciaDias,
        licenciasActivas: p._count.licencias,
        actualizadoEn: p.actualizadoEn,
      })),
    });
  });

  /**
   * Cambia una tarjeta de precios. Se ve en el home al instante y es el precio
   * que se cobra desde ese momento. Las licencias ya pagadas no cambian, y una
   * pagina de pago ya abierta conserva el precio con el que se abrio.
   */
  fastify.put('/planes/:id', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const datos = planEditableSchema.safeParse(request.body);
    if (!params.success || !datos.success) {
      return reply.code(400).send({
        error: 'Revisa los datos del plan',
        detalles: datos.success ? undefined : datos.error.flatten(),
      });
    }
    const plan = await fastify.prisma.plan.findUnique({ where: { id: params.data.id } });
    if (!plan) return reply.code(404).send({ error: 'Ese plan no existe' });

    const actualizado = await fastify.prisma.plan.update({
      where: { id: plan.id },
      data: {
        ...datos.data,
        beneficios: datos.data.beneficios as unknown as Prisma.InputJsonValue,
      },
    });
    fastify.log.info(
      { planId: plan.id, antes: plan.precioCop, despues: actualizado.precioCop, admin: request.user.id },
      'Precio de plan actualizado',
    );
    return reply.send({ plan: actualizado });
  });

  // ─────────────────────────────── Pagos ───────────────────────────────

  fastify.get('/pagos', async (request, reply) => {
    const filtro = z
      .object({
        estado: z.enum(['pendiente', 'aprobado', 'rechazado', 'reembolsado', 'cancelado']).optional(),
      })
      .safeParse(request.query);

    const pagos = await fastify.prisma.payment.findMany({
      where: filtro.success && filtro.data.estado ? { estado: filtro.data.estado } : {},
      orderBy: { creadoEn: 'desc' },
      take: 200,
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        licencia: { select: { id: true, estado: true, plan: { select: { nombre: true } } } },
        cotizacion: { select: { id: true, prefijo: true, numero: true } },
        factura: { select: { id: true, prefijo: true, numero: true, estado: true } },
      },
    });

    return reply.send({
      pagos: pagos.map((p) => ({
        id: p.id,
        fecha: p.aprobadoEn ?? p.creadoEn,
        montoCop: p.montoCop,
        estado: p.estado,
        detalle: p.mpStatusDetail,
        metodo: p.metodo,
        tipoMedio: p.tipoMedio,
        cuotas: p.cuotas,
        origen: p.origen,
        mpPaymentId: p.mpPaymentId,
        referenciaManual: p.referenciaManual,
        email: p.usuario?.email ?? p.emailComprador,
        cliente: p.usuario?.nombre ?? null,
        licencia: p.licencia
          ? { id: p.licencia.id, plan: p.licencia.plan.nombre, estado: p.licencia.estado }
          : null,
        cotizacion: p.cotizacion
          ? { id: p.cotizacion.id, numero: numeroDocumento(p.cotizacion.prefijo, p.cotizacion.numero) }
          : null,
        factura:
          p.factura && p.factura.estado === 'emitida'
            ? { id: p.factura.id, numero: numeroDocumento(p.factura.prefijo, p.factura.numero) }
            : null,
      })),
    });
  });

  /** Vuelve a preguntar a Mercado Pago por un pago y lo aplica. */
  fastify.post('/pagos/:id/conciliar', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    const pago = await fastify.prisma.payment.findUnique({ where: { id: params.data.id } });
    if (!pago) return reply.code(404).send({ error: 'Ese pago no existe' });
    if (!pago.mpPaymentId) {
      return reply.code(409).send({ error: 'Es un pago manual: no hay nada que consultar.' });
    }
    try {
      const resultado = await aplicarPago(fastify.prisma, await obtenerPago(pago.mpPaymentId));
      return reply.send({ resultado });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  /** Registra una transferencia o consignacion y aplica sus efectos. */
  fastify.post('/pagos/manual', async (request, reply) => {
    const datos = pagoManualSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos del pago', detalles: datos.error.flatten() });
    }
    try {
      const r = await registrarPagoManual(fastify.prisma, {
        ...datos.data,
        fecha: new Date(`${datos.data.fecha}T12:00:00-05:00`),
        adminId: request.user.id,
      });
      return reply.code(201).send(r);
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.get('/pagos/:id/borrador-factura', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    try {
      return reply.send({ borrador: await borradorFacturaDePago(fastify.prisma, params.data.id) });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  // ─────────────────────────────── Licencias ───────────────────────────────

  fastify.get('/licencias', async (_request, reply) => {
    const licencias = await fastify.prisma.license.findMany({
      orderBy: { creadoEn: 'desc' },
      take: 300,
      include: {
        plan: { select: { nombre: true } },
        titular: { select: { id: true, nombre: true, email: true } },
        institucion: { select: { nombre: true } },
      },
    });
    return reply.send({
      licencias: licencias.map((l) => ({
        id: l.id,
        estado: estadoEfectivoLicencia(l),
        plan: l.plan.nombre,
        titular: l.titular,
        institucion: l.institucion?.nombre ?? null,
        inicioVigencia: l.inicioVigencia,
        finVigencia: l.finVigencia,
        esRenovacion: l.renovadaDeId !== null,
        creadoEn: l.creadoEn,
      })),
    });
  });

  /**
   * Da un plan a un docente, a un colegio o a una familia sin pasar por el
   * carrito. Es el camino de las ventas que se cierran por fuera: transferencia,
   * convenio, piloto.
   */
  fastify.post('/licencias', async (request, reply) => {
    const datos = nuevaLicenciaSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos', detalles: datos.error.flatten() });
    }
    try {
      const licencia = await otorgarLicencia(fastify.prisma, datos.data);
      fastify.log.info(
        { ...licencia, titularId: datos.data.titularId, admin: request.user.id },
        'Licencia otorgada desde el panel',
      );
      return reply.code(201).send({ licencia });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  /** Retira una licencia otorgada a mano. No se borra: queda cancelada. */
  fastify.post('/licencias/:id/cancelar', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    try {
      await cancelarLicencia(fastify.prisma, params.data.id);
      fastify.log.info({ licenciaId: params.data.id, admin: request.user.id }, 'Licencia cancelada');
      return reply.send({ mensaje: 'Licencia cancelada.' });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.post('/licencias/:id/conciliar', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    try {
      const resultados = await conciliar(fastify.prisma, { tipo: 'licencia', id: params.data.id });
      return reply.send({ encontrados: resultados.length, resultados });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  // ─────────────────────────────── Facturas ───────────────────────────────

  fastify.get('/facturas', async (_request, reply) => {
    const facturas = await fastify.prisma.invoice.findMany({
      orderBy: { numero: 'desc' },
      take: 300,
    });
    return reply.send({
      facturas: facturas.map((f) => ({
        id: f.id,
        numero: numeroDocumento(f.prefijo, f.numero),
        estado: f.estado,
        fechaEmision: f.fechaEmision,
        cliente: (f.cliente as { nombre: string }).nombre,
        totalCop: f.totalCop,
        pagoId: f.pagoId,
        motivoAnulacion: f.motivoAnulacion,
        enlacePublico: `${config.PUBLIC_BASE_URL}/app/documento/factura/${f.tokenPublico}`,
      })),
    });
  });

  fastify.post('/facturas', async (request, reply) => {
    const datos = facturaSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos de la factura', detalles: datos.error.flatten() });
    }
    try {
      const f = await crearFactura(fastify.prisma, datos.data, request.user.id);
      return reply.code(201).send({
        factura: {
          id: f.id,
          numero: numeroDocumento(f.prefijo, f.numero),
          enlacePublico: `${config.PUBLIC_BASE_URL}/app/documento/factura/${f.tokenPublico}`,
        },
      });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.post('/facturas/:id/anular', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const datos = motivoSchema.safeParse(request.body);
    if (!params.success || !datos.success) {
      return reply.code(400).send({ error: 'Anular exige un motivo de al menos 5 letras.' });
    }
    try {
      await anularFactura(fastify.prisma, params.data.id, datos.data.motivo);
      return reply.send({ mensaje: 'Factura anulada.' });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  // ────────────────────────────── Cotizaciones ──────────────────────────────

  fastify.get('/cotizaciones', async (_request, reply) => {
    const cotizaciones = await fastify.prisma.quote.findMany({
      orderBy: { numero: 'desc' },
      take: 300,
      include: { plan: true },
    });
    return reply.send({
      cotizaciones: cotizaciones.map((c) => cotizacionParaPanel(c, config.PUBLIC_BASE_URL)),
    });
  });

  fastify.get('/cotizaciones/:id', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    const c = await fastify.prisma.quote.findUnique({
      where: { id: params.data.id },
      include: { plan: true },
    });
    if (!c) return reply.code(404).send({ error: 'Esa cotización no existe' });
    return reply.send({ cotizacion: cotizacionParaPanel(c, config.PUBLIC_BASE_URL) });
  });

  fastify.post('/cotizaciones', async (request, reply) => {
    const datos = cotizacionSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos de la cotización', detalles: datos.error.flatten() });
    }
    try {
      const c = await crearCotizacion(fastify.prisma, datos.data, request.user.id);
      const conPlan = await fastify.prisma.quote.findUniqueOrThrow({
        where: { id: c.id },
        include: { plan: true },
      });
      return reply.code(201).send({ cotizacion: cotizacionParaPanel(conPlan, config.PUBLIC_BASE_URL) });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.put('/cotizaciones/:id', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const datos = cotizacionSchema.safeParse(request.body);
    if (!params.success || !datos.success) {
      return reply.code(400).send({
        error: 'Revisa los datos de la cotización',
        detalles: datos.success ? undefined : datos.error.flatten(),
      });
    }
    try {
      await actualizarCotizacion(fastify.prisma, params.data.id, datos.data);
      const c = await fastify.prisma.quote.findUniqueOrThrow({
        where: { id: params.data.id },
        include: { plan: true },
      });
      return reply.send({ cotizacion: cotizacionParaPanel(c, config.PUBLIC_BASE_URL) });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.post('/cotizaciones/:id/estado', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const datos = estadoCotizacionSchema.safeParse(request.body);
    if (!params.success || !datos.success) return reply.code(400).send({ error: 'Datos inválidos' });
    try {
      await cambiarEstadoCotizacion(fastify.prisma, params.data.id, datos.data.estado, datos.data.motivo);
      return reply.send({ mensaje: 'Estado actualizado.' });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.post('/cotizaciones/:id/enlace-pago', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    if (!pagosConfigurados(config)) {
      return reply.code(503).send({ error: 'Mercado Pago no está configurado en el servidor.' });
    }
    try {
      return reply.send(await iniciarPagoCotizacion(fastify.prisma, params.data.id, config.PUBLIC_BASE_URL));
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.post('/cotizaciones/:id/conciliar', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    try {
      const resultados = await conciliar(fastify.prisma, { tipo: 'cotizacion', id: params.data.id });
      return reply.send({ encontrados: resultados.length, resultados });
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  /**
   * Activa la licencia que vende una cotizacion pagada. Si el cliente no tenia
   * cuenta, devuelve una contrasena temporal que se muestra UNA vez.
   */
  fastify.post('/cotizaciones/:id/activar-licencia', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    try {
      return reply.send(await activarLicenciaDeCotizacion(fastify.prisma, params.data.id));
    } catch (error) {
      return responderError(reply, error, fastify.log);
    }
  });

  fastify.get('/cotizaciones/:id/borrador-factura', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    const c = await fastify.prisma.quote.findUnique({
      where: { id: params.data.id },
      include: { pagos: { where: { estado: 'aprobado' }, include: { factura: true } } },
    });
    if (!c) return reply.code(404).send({ error: 'Esa cotización no existe' });
    // Si hay un pago aprobado sin facturar, la factura documenta ese pago.
    const sinFacturar = c.pagos.find((p) => !p.factura);
    if (sinFacturar) {
      return reply.send({ borrador: await borradorFacturaDePago(fastify.prisma, sinFacturar.id) });
    }
    return reply.send({
      borrador: {
        cliente: c.cliente,
        items: (c.items as { descripcion: string; cantidad: number; valorUnitarioCop: number }[]).map(
          ({ descripcion, cantidad, valorUnitarioCop }) => ({ descripcion, cantidad, valorUnitarioCop }),
        ),
        descuentoCop: c.descuentoCop,
        ivaPorcentaje: c.ivaPorcentaje,
        notas: `Corresponde a la cotización ${numeroDocumento(c.prefijo, c.numero)}.`,
        usuarioId: c.usuarioId,
        cotizacionId: c.id,
      },
    });
  });

  // ────────────────────────────── Equipo ──────────────────────────────

  /**
   * Las personas que trabajan en la plataforma: docentes y administradores.
   *
   * Un docente se crea aqui y entra con su correo del colegio (por SSO de
   * Microsoft, si su dominio esta habilitado) o con la contrasena temporal que
   * se muestra UNA vez. Las familias y los estudiantes no salen en esta lista:
   * nacen de una compra o del alta que hace su docente.
   */
  fastify.get('/equipo', async (_request, reply) => {
    const miembros = await fastify.prisma.user.findMany({
      where: { rol: { in: ['docente', 'admin_escuela', 'admin'] } },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        phidiasHabilitado: true,
        origenExterno: true,
        creadoEn: true,
        ultimaActividad: true,
        institucion: { select: { id: true, nombre: true } },
        _count: { select: { aulasComoDocente: true } },
        licencias: {
          orderBy: { finVigencia: 'desc' },
          select: {
            id: true,
            estado: true,
            inicioVigencia: true,
            finVigencia: true,
            creadoEn: true,
            plan: { select: { id: true, nombre: true } },
            pagos: { where: { estado: 'aprobado' }, select: { id: true }, take: 1 },
          },
        },
      },
    });

    return reply.send({
      miembros: miembros.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        email: m.email,
        rol: m.rol,
        activo: m.activo,
        phidiasHabilitado: m.phidiasHabilitado,
        licencias: m.licencias.map((l) => ({
          id: l.id,
          estado: estadoEfectivoLicencia(l),
          plan: l.plan.nombre,
          finVigencia: l.finVigencia,
          // Una licencia pagada no se cancela desde aquí: eso es un reembolso.
          pagada: l.pagos.length > 0,
        })),
        // "entra" = entra con la cuenta del colegio; sin esto no se sabe si una
        // cuenta inactiva se desactivo o es que nunca ha entrado.
        entraCon: m.origenExterno === 'entra' ? 'Microsoft del colegio' : 'correo y contraseña',
        institucion: m.institucion,
        aulas: m._count.aulasComoDocente,
        creadoEn: m.creadoEn,
        ultimaActividad: m.ultimaActividad,
      })),
    });
  });

  // ────────────────────────────── Colegios ──────────────────────────────

  /**
   * Los colegios, con lo que de verdad se pregunta de ellos: cuanta gente hay
   * dentro, cuantos grupos y si su licencia sigue viva.
   *
   * Los estudiantes se cuentan aparte de los adultos porque el cupo contratado
   * es de estudiantes: un colegio con 900 niños y 40 docentes no tiene 940
   * licencias de estudiante.
   */
  fastify.get('/instituciones', async (_request, reply) => {
    const instituciones = await fastify.prisma.institution.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { usuarios: true, aulas: true, sedes: true } },
        licencias: {
          orderBy: { finVigencia: 'desc' },
          include: {
            plan: { select: { nombre: true } },
            titular: { select: { id: true, nombre: true, email: true } },
          },
        },
      },
    });

    const estudiantes = await fastify.prisma.user.groupBy({
      by: ['institucionId'],
      where: { rol: 'nino', institucionId: { not: null } },
      _count: { _all: true },
    });
    const ninosPor = new Map(estudiantes.map((e) => [e.institucionId, e._count._all]));

    return reply.send({
      instituciones: instituciones.map((i) => {
        const ninos = ninosPor.get(i.id) ?? 0;
        return {
          id: i.id,
          nombre: i.nombre,
          nit: i.nit,
          ciudad: i.ciudad,
          pais: i.pais,
          codigoAcceso: i.codigoAcceso,
          maxEstudiantes: i.maxEstudiantes,
          activa: i.activa,
          creadoEn: i.creadoEn,
          personas: i._count.usuarios,
          estudiantes: ninos,
          adultos: i._count.usuarios - ninos,
          grupos: i._count.aulas,
          sedes: i._count.sedes,
          licencias: i.licencias.map((l) => ({
            id: l.id,
            estado: estadoEfectivoLicencia(l),
            plan: l.plan.nombre,
            titular: l.titular,
            finVigencia: l.finVigencia,
          })),
        };
      }),
    });
  });

  /** Da de alta un colegio. El codigo de acceso lo identifica al vincular. */
  fastify.post('/instituciones', async (request, reply) => {
    const datos = colegioSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos del colegio', detalles: datos.error.flatten() });
    }
    if (datos.data.nit) {
      const repetido = await fastify.prisma.institution.findFirst({
        where: { nit: datos.data.nit },
        select: { id: true, nombre: true },
      });
      if (repetido) {
        return reply
          .code(409)
          .send({ error: `Ese NIT ya es de "${repetido.nombre}". Edítalo en la lista.` });
      }
    }

    const colegio = await fastify.prisma.institution.create({
      data: {
        nombre: datos.data.nombre,
        nit: datos.data.nit ?? null,
        ciudad: datos.data.ciudad ?? null,
        pais: datos.data.pais,
        maxEstudiantes: datos.data.maxEstudiantes ?? null,
        codigoAcceso: generarCodigoAcceso('COL'),
      },
    });
    fastify.log.info({ colegioId: colegio.id, admin: request.user.id }, 'Colegio creado');
    return reply.code(201).send({ colegio });
  });

  fastify.patch('/instituciones/:id', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const datos = colegioSchema.partial().extend({ activa: z.boolean().optional() }).safeParse(request.body);
    if (!params.success || !datos.success) {
      return reply.code(400).send({ error: 'Datos inválidos', detalles: datos.success ? undefined : datos.error.flatten() });
    }
    const existe = await fastify.prisma.institution.findUnique({ where: { id: params.data.id } });
    if (!existe) return reply.code(404).send({ error: 'Ese colegio no existe' });

    // Bajar el cupo por debajo de los que ya estan dentro no se hace callando:
    // el numero seguiria en rojo y nadie sabria por que.
    if (datos.data.maxEstudiantes != null) {
      const dentro = await fastify.prisma.user.count({
        where: { rol: 'nino', institucionId: existe.id },
      });
      if (dentro > datos.data.maxEstudiantes) {
        return reply.code(409).send({
          error: `Ese colegio ya tiene ${dentro} estudiantes: el cupo no puede ser menor.`,
        });
      }
    }

    const colegio = await fastify.prisma.institution.update({
      where: { id: existe.id },
      data: datos.data,
    });
    fastify.log.info({ colegioId: colegio.id, admin: request.user.id }, 'Colegio actualizado');
    return reply.send({ colegio });
  });

  fastify.post('/equipo', async (request, reply) => {
    const datos = nuevoMiembroSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos', detalles: datos.error.flatten() });
    }
    const { nombre, email, rol, institucionId } = datos.data;

    const yaExiste = await fastify.prisma.user.findUnique({
      where: { email },
      select: { id: true, rol: true },
    });
    if (yaExiste) {
      return reply.code(409).send({
        error: `Ya hay una cuenta con ese correo (${yaExiste.rol}). Cámbiale el rol en la lista en vez de crear otra.`,
      });
    }
    if (institucionId) {
      const inst = await fastify.prisma.institution.findUnique({ where: { id: institucionId } });
      if (!inst) return reply.code(404).send({ error: 'Esa institución no existe' });
    }

    const passwordTemporal = generarPasswordTemporal();
    const creado = await fastify.prisma.user.create({
      data: {
        usuario: email,
        email,
        nombre,
        rol,
        institucionId: institucionId ?? null,
        passwordHash: await hashPassword(passwordTemporal),
      },
      select: { id: true, nombre: true, email: true, rol: true },
    });

    fastify.log.info({ creadoId: creado.id, rol, admin: request.user.id }, 'Miembro del equipo creado');
    // La contrasena se devuelve UNA vez: no se guarda en claro en ningun sitio.
    return reply.code(201).send({ miembro: creado, passwordTemporal });
  });

  fastify.patch('/equipo/:id', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    const datos = cambioMiembroSchema.safeParse(request.body);
    if (!params.success || !datos.success) {
      return reply.code(400).send({ error: 'Datos inválidos' });
    }
    const miembro = await fastify.prisma.user.findUnique({ where: { id: params.data.id } });
    if (!miembro) return reply.code(404).send({ error: 'Esa persona no existe' });
    if (!['docente', 'admin_escuela', 'admin'].includes(miembro.rol)) {
      return reply.code(409).send({ error: 'Esa cuenta no es del equipo' });
    }
    // Nadie se quita a si mismo el acceso: dejaria la plataforma sin quien entre.
    if (miembro.id === request.user.id && (datos.data.rol !== undefined || datos.data.activo === false)) {
      return reply.code(409).send({ error: 'No puedes cambiar tu propio rol ni desactivarte.' });
    }
    // Y siempre tiene que quedar un administrador activo.
    const dejaDeSerAdmin =
      miembro.rol === 'admin' && (datos.data.rol !== undefined && datos.data.rol !== 'admin');
    if (miembro.rol === 'admin' && (dejaDeSerAdmin || datos.data.activo === false)) {
      const admins = await fastify.prisma.user.count({ where: { rol: 'admin', activo: true } });
      if (admins <= 1) {
        return reply.code(409).send({ error: 'Es el único administrador activo: nombra otro antes.' });
      }
    }

    const actualizado = await fastify.prisma.user.update({
      where: { id: miembro.id },
      data: {
        ...(datos.data.rol !== undefined ? { rol: datos.data.rol } : {}),
        ...(datos.data.activo !== undefined ? { activo: datos.data.activo } : {}),
        ...(datos.data.institucionId !== undefined ? { institucionId: datos.data.institucionId } : {}),
        ...(datos.data.phidiasHabilitado !== undefined
          ? { phidiasHabilitado: datos.data.phidiasHabilitado }
          : {}),
      },
      select: { id: true, nombre: true, rol: true, activo: true, phidiasHabilitado: true },
    });
    fastify.log.info({ miembroId: miembro.id, cambios: datos.data, admin: request.user.id }, 'Equipo actualizado');
    return reply.send({ miembro: actualizado });
  });

  /** Nueva contrasena temporal, para quien la perdio. Se muestra una vez. */
  fastify.post('/equipo/:id/clave', async (request, reply) => {
    const params = idSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador inválido' });
    const miembro = await fastify.prisma.user.findUnique({ where: { id: params.data.id } });
    if (!miembro || !['docente', 'admin_escuela', 'admin'].includes(miembro.rol)) {
      return reply.code(404).send({ error: 'Esa persona no existe' });
    }
    const passwordTemporal = generarPasswordTemporal();
    await fastify.prisma.user.update({
      where: { id: miembro.id },
      data: { passwordHash: await hashPassword(passwordTemporal) },
    });
    fastify.log.info({ miembroId: miembro.id, admin: request.user.id }, 'Contrasena de equipo restablecida');
    return reply.send({ email: miembro.email, passwordTemporal });
  });

  // ───────────────────────────── Datos de la empresa ─────────────────────────────

  fastify.get('/emisor', async (_request, reply) => {
    return reply.send({ emisor: await leerEmisor(fastify.prisma) });
  });

  fastify.put('/emisor', async (request, reply) => {
    const datos = emisorSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos de la empresa', detalles: datos.error.flatten() });
    }
    return reply.send({ emisor: await guardarEmisor(fastify.prisma, datos.data) });
  });
};
