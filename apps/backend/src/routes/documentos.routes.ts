/**
 * Documentos por enlace: una cotizacion o una factura, sin iniciar sesion.
 *
 * Existe por un caso concreto: compras de un colegio pide una cotizacion antes
 * de aprobar un gasto de doce millones, y quien la recibe no tiene cuenta en
 * CodeNest. El enlace lleva un token de 64 caracteres hexadecimales que no se
 * adivina ni se recorre, a diferencia de un identificador secuencial.
 *
 * Solo se entrega lo que va impreso en el documento. Nada de identificadores
 * internos, ni del usuario, ni de otros documentos.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { cotizacionPagable, estadoEfectivoCotizacion, numeroDocumento } from '@codenest/shared';

import { cargarConfig, pagosConfigurados } from '../lib/env.js';
import { ErrorMercadoPago } from '../lib/mercadopago.js';
import { LIMITE_PAGO } from '../plugins/security.js';
import { ErrorCobro, conciliar, iniciarPagoCotizacion } from '../services/cobros.service.js';

const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });

export const documentosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const config = cargarConfig();

  fastify.get('/cotizacion/:token', async (request, reply) => {
    const params = tokenSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ error: 'Ese documento no existe' });

    const c = await fastify.prisma.quote.findUnique({ where: { tokenPublico: params.data.token } });
    if (!c) return reply.code(404).send({ error: 'Ese documento no existe' });

    return reply.send({
      tipo: 'cotizacion',
      numero: numeroDocumento(c.prefijo, c.numero),
      estado: estadoEfectivoCotizacion(c.estado, c.validaHasta),
      fechaEmision: c.fechaEmision,
      validaHasta: c.validaHasta.toISOString().slice(0, 10),
      emisor: c.emisor,
      cliente: c.cliente,
      items: c.items,
      subtotalCop: c.subtotalCop,
      descuentoCop: c.descuentoCop,
      ivaPorcentaje: c.ivaPorcentaje,
      ivaCop: c.ivaCop,
      totalCop: c.totalCop,
      notas: c.notas,
      condiciones: c.condiciones,
      pagadaEn: c.pagadaEn,
      motivoAnulacion: c.motivoAnulacion,
      // Un borrador se puede ver (el administrador lo revisa) pero no pagar.
      pagable:
        pagosConfigurados(config) &&
        c.estado !== 'borrador' &&
        cotizacionPagable(c.estado, c.validaHasta),
    });
  });

  fastify.post('/cotizacion/:token/pagar', { config: LIMITE_PAGO }, async (request, reply) => {
    const params = tokenSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ error: 'Ese documento no existe' });
    const c = await fastify.prisma.quote.findUnique({
      where: { tokenPublico: params.data.token },
      select: { id: true },
    });
    if (!c) return reply.code(404).send({ error: 'Ese documento no existe' });
    if (!pagosConfigurados(config)) {
      return reply.code(503).send({ error: 'El pago en línea no está disponible ahora mismo.' });
    }
    try {
      const { urlPago } = await iniciarPagoCotizacion(fastify.prisma, c.id, config.PUBLIC_BASE_URL);
      return reply.send({ urlPago });
    } catch (error) {
      if (error instanceof ErrorCobro) return reply.code(error.codigo).send({ error: error.message });
      if (error instanceof ErrorMercadoPago) {
        fastify.log.error({ err: error, detalle: error.detalle }, 'Fallo de Mercado Pago (cotizacion)');
        return reply.code(502).send({ error: 'No pudimos abrir la página de pago. Intenta de nuevo en unos minutos.' });
      }
      throw error;
    }
  });

  /** Al volver de Mercado Pago: ¿ya consta el pago? No espera al webhook. */
  fastify.post('/cotizacion/:token/verificar', { config: LIMITE_PAGO }, async (request, reply) => {
    const params = tokenSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ error: 'Ese documento no existe' });
    const c = await fastify.prisma.quote.findUnique({ where: { tokenPublico: params.data.token } });
    if (!c) return reply.code(404).send({ error: 'Ese documento no existe' });

    if (pagosConfigurados(config) && c.estado !== 'pagada') {
      await conciliar(fastify.prisma, { tipo: 'cotizacion', id: c.id }).catch((error) =>
        fastify.log.warn({ err: error, cotizacionId: c.id }, 'No se pudo conciliar la cotizacion'),
      );
    }
    const actual = await fastify.prisma.quote.findUniqueOrThrow({ where: { id: c.id } });
    return reply.send({ estado: estadoEfectivoCotizacion(actual.estado, actual.validaHasta) });
  });

  fastify.get('/factura/:token', async (request, reply) => {
    const params = tokenSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ error: 'Ese documento no existe' });

    const f = await fastify.prisma.invoice.findUnique({
      where: { tokenPublico: params.data.token },
      include: { pago: { select: { metodo: true, tipoMedio: true, aprobadoEn: true, mpPaymentId: true } } },
    });
    if (!f) return reply.code(404).send({ error: 'Ese documento no existe' });

    return reply.send({
      tipo: 'factura',
      numero: numeroDocumento(f.prefijo, f.numero),
      estado: f.estado,
      fechaEmision: f.fechaEmision,
      fechaVencimiento: f.fechaVencimiento?.toISOString().slice(0, 10) ?? null,
      emisor: f.emisor,
      cliente: f.cliente,
      items: f.items,
      subtotalCop: f.subtotalCop,
      descuentoCop: f.descuentoCop,
      ivaPorcentaje: f.ivaPorcentaje,
      ivaCop: f.ivaCop,
      totalCop: f.totalCop,
      notas: f.notas,
      motivoAnulacion: f.motivoAnulacion,
      pago: f.pago
        ? {
            metodo: f.pago.metodo,
            tipoMedio: f.pago.tipoMedio,
            fecha: f.pago.aprobadoEn,
            operacion: f.pago.mpPaymentId,
          }
        : null,
    });
  });
};
