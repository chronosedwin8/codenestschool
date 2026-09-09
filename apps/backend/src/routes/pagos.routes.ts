/**
 * Compra y renovación de licencias.
 *
 * Reglas que no se negocian:
 *  1. El precio lo pone el servidor a partir del plan. El cliente solo dice qué
 *     plan quiere.
 *  2. La cuenta y la licencia se crean antes de cobrar, en estado pendiente. Si
 *     el cobro se rechaza, se deshace todo: nadie queda con una cuenta a medias.
 *  3. Un pago aprobado activa la licencia; uno pendiente (PSE, efectivo) la deja
 *     esperando y el webhook la activa cuando el banco confirme.
 *  4. El webhook es idempotente: Mercado Pago lo reintenta, y activar dos veces
 *     no puede duplicar la vigencia.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { PLAN_POR_CLAVE, TIPO_PLAN, formatearCop } from '@codenest/shared';

import { cargarConfig, pagosConfigurados } from '../lib/env.js';
import {
  crearPago,
  esUrlPublica,
  explicarRechazo,
  obtenerPago,
  traducirEstado,
  ErrorMercadoPago,
} from '../lib/mercadopago.js';
import { LIMITE_ESTRICTO } from '../plugins/security.js';
import { generarCodigoAcceso, hashPassword } from '../services/auth.service.js';

const compraSchema = z.object({
  plan: z.enum([TIPO_PLAN.personal, TIPO_PLAN.padres, TIPO_PLAN.escuela]),
  cuenta: z.object({
    nombre: z.string().min(2).max(150),
    email: z.string().email(),
    password: z.string().min(8).max(200),
  }),
  institucion: z
    .object({
      nombre: z.string().min(2).max(200),
      nit: z.string().max(40).optional(),
      ciudad: z.string().max(100).optional(),
    })
    .optional(),
  pago: z.object({
    token: z.string().min(1),
    paymentMethodId: z.string().min(1),
    issuerId: z.string().optional(),
    installments: z.number().int().min(1).max(36).default(1),
    identificacion: z
      .object({ tipo: z.string().min(2).max(10), numero: z.string().min(4).max(20) })
      .optional(),
  }),
});

const renovacionSchema = z.object({
  licenciaId: z.number().int().positive(),
  pago: compraSchema.shape.pago,
});

export const pagosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const config = cargarConfig();

  /** Precio de cada plan según lo configurado. El servidor es la autoridad. */
  function precioDe(clave: keyof typeof PLAN_POR_CLAVE): number {
    switch (clave) {
      case TIPO_PLAN.personal:
        return config.PRECIO_PERSONAL_COP;
      case TIPO_PLAN.padres:
        return config.PRECIO_PADRES_COP;
      case TIPO_PLAN.escuela:
        return config.PRECIO_ESCUELA_COP;
    }
  }

  /** Configuración pública para el formulario de pago. Sin secretos. */
  fastify.get('/config', async (_request, reply) => {
    return reply.send({
      publicKey: config.MP_PUBLIC_KEY ?? '',
      configurado: pagosConfigurados(config),
      moneda: 'COP',
      planes: Object.values(PLAN_POR_CLAVE).map((plan) => ({
        clave: plan.clave,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precioCop: precioDe(plan.clave),
        precioFormateado: formatearCop(precioDe(plan.clave)),
        vigenciaDias: plan.vigenciaDias,
        maxNinos: plan.maxNinos,
        beneficios: plan.beneficios,
        destacado: plan.destacado,
        orden: plan.orden,
      })),
    });
  });

  /** Compra de una licencia nueva, con alta de cuenta. */
  fastify.post('/comprar', { config: LIMITE_ESTRICTO }, async (request, reply) => {
    if (!pagosConfigurados(config)) {
      return reply.code(503).send({
        error: 'Pasarela sin configurar',
        mensaje: 'La pasarela de pago no esta disponible. Escribenos y te ayudamos.',
      });
    }

    const datos = compraSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }
    const { plan: clavePlan, cuenta, institucion, pago } = datos.data;

    if (clavePlan === TIPO_PLAN.escuela && !institucion) {
      return reply
        .code(400)
        .send({ error: 'La licencia de colegio necesita los datos de la institucion' });
    }

    const yaExiste = await fastify.prisma.user.findUnique({ where: { email: cuenta.email } });
    if (yaExiste) {
      return reply.code(409).send({ error: 'Ese correo ya tiene una cuenta' });
    }

    const plan = await fastify.prisma.plan.findUnique({ where: { clave: clavePlan } });
    if (!plan?.activo) {
      return reply.code(404).send({ error: 'Ese plan no esta disponible' });
    }

    // El monto sale del plan, nunca del cuerpo de la peticion.
    const montoCop = precioDe(clavePlan);
    const definicion = PLAN_POR_CLAVE[clavePlan];

    // 1) Cuenta, institucion y licencia pendiente, todo o nada.
    const creado = await fastify.prisma.$transaction(async (tx) => {
      let institucionId: number | null = null;
      let codigoInstitucion: string | null = null;

      if (clavePlan === TIPO_PLAN.escuela && institucion) {
        codigoInstitucion = generarCodigoAcceso('CNS');
        const inst = await tx.institution.create({
          data: {
            nombre: institucion.nombre,
            nit: institucion.nit ?? null,
            ciudad: institucion.ciudad ?? null,
            codigoAcceso: codigoInstitucion,
            maxEstudiantes: definicion.maxNinos,
          },
        });
        institucionId = inst.id;
      }

      const usuario = await tx.user.create({
        data: {
          usuario: cuenta.email,
          email: cuenta.email,
          passwordHash: await hashPassword(cuenta.password),
          nombre: cuenta.nombre,
          rol: definicion.rolTitular,
          institucionId,
        },
      });

      const licencia = await tx.license.create({
        data: {
          planId: plan.id,
          titularId: usuario.id,
          institucionId,
          estado: 'pendiente',
          codigoAcceso: generarCodigoAcceso('LIC'),
        },
      });

      return { usuarioId: usuario.id, licenciaId: licencia.id, institucionId, codigoInstitucion };
    });

    // 2) Cobro. La clave de idempotencia impide un cargo doble por reintento.
    const claveIdempotencia = `lic-${creado.licenciaId}-${randomUUID()}`;

    try {
      const resultado = await crearPago(
        {
          token: pago.token,
          paymentMethodId: pago.paymentMethodId,
          issuerId: pago.issuerId,
          installments: pago.installments,
          montoCop,
          descripcion: `CodeNest School - plan ${definicion.nombre}`,
          emailComprador: cuenta.email,
          identificacion: pago.identificacion
            ? { tipo: pago.identificacion.tipo, numero: pago.identificacion.numero }
            : undefined,
          referenciaExterna: String(creado.licenciaId),
          urlNotificacion: esUrlPublica(config.PUBLIC_BASE_URL)
            ? `${config.PUBLIC_BASE_URL}/api/pagos/webhook`
            : undefined,
        },
        claveIdempotencia,
      );

      const estado = traducirEstado(resultado.status);

      await fastify.prisma.payment.create({
        data: {
          licenciaId: creado.licenciaId,
          mpPaymentId: String(resultado.id),
          idempotencyKey: claveIdempotencia,
          montoCop,
          estado,
          mpStatus: resultado.status,
          mpStatusDetail: resultado.statusDetail,
          metodo: resultado.paymentMethodId,
          emailComprador: cuenta.email,
        },
      });

      // 3a) Rechazado: se deshace el alta para no dejar cuentas huérfanas.
      if (estado === 'rechazado') {
        await limpiarCompra(fastify, creado);
        return reply.code(402).send({
          error: 'Pago rechazado',
          mensaje: explicarRechazo(resultado.statusDetail),
          detalle: resultado.statusDetail,
        });
      }

      // 3b) Aprobado: se activa la licencia y se entrega la sesión.
      if (estado === 'aprobado') {
        const licencia = await activarLicencia(fastify, creado.licenciaId, plan.vigenciaDias);
        const token = fastify.jwt.sign({
          id: creado.usuarioId,
          usuario: cuenta.email,
          nombre: cuenta.nombre,
          rol: definicion.rolTitular,
          ninos: [],
          institucionId: creado.institucionId,
        });

        return reply.code(201).send({
          estado: 'aprobado',
          token,
          licencia: {
            id: licencia.id,
            codigoAcceso: licencia.codigoAcceso,
            finVigencia: licencia.finVigencia,
          },
          codigoInstitucion: creado.codigoInstitucion,
          mensaje: 'Listo. Tu licencia ya esta activa.',
        });
      }

      // 3c) Pendiente (PSE, efectivo): la cuenta existe, la licencia espera.
      return reply.code(202).send({
        estado: 'pendiente',
        licenciaId: creado.licenciaId,
        mensaje:
          'Estamos esperando la confirmacion de tu banco. Te avisamos en cuanto se acredite.',
      });
    } catch (error) {
      await limpiarCompra(fastify, creado);

      if (error instanceof ErrorMercadoPago) {
        fastify.log.error({ err: error, detalle: error.detalle }, 'Fallo de Mercado Pago');
        return reply.code(402).send({
          error: 'No se pudo cobrar',
          mensaje: 'No se pudo procesar el pago. Revisa los datos o prueba con otra tarjeta.',
        });
      }
      throw error;
    }
  });

  /** Renovación de una licencia por su titular. */
  fastify.post(
    '/renovar',
    { config: LIMITE_ESTRICTO, preHandler: fastify.exigirRol('tutor', 'admin_escuela') },
    async (request, reply) => {
      const datos = renovacionSchema.safeParse(request.body);
      if (!datos.success) {
        return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
      }

      const anterior = await fastify.prisma.license.findUnique({
        where: { id: datos.data.licenciaId },
        include: { plan: true, titular: { select: { email: true, nombre: true } } },
      });

      if (!anterior) return reply.code(404).send({ error: 'Esa licencia no existe' });
      if (anterior.titularId !== request.user.id) {
        return reply.code(403).send({ error: 'Esa licencia no es tuya' });
      }

      const montoCop = precioDe(anterior.plan.clave);
      const nueva = await fastify.prisma.license.create({
        data: {
          planId: anterior.planId,
          titularId: anterior.titularId,
          institucionId: anterior.institucionId,
          estado: 'pendiente',
          renovadaDeId: anterior.id,
          codigoAcceso: generarCodigoAcceso('LIC'),
        },
      });

      const claveIdempotencia = `ren-${nueva.id}-${randomUUID()}`;
      const correo = anterior.titular.email ?? '';

      try {
        const resultado = await crearPago(
          {
            token: datos.data.pago.token,
            paymentMethodId: datos.data.pago.paymentMethodId,
            issuerId: datos.data.pago.issuerId,
            installments: datos.data.pago.installments,
            montoCop,
            descripcion: `CodeNest School - renovacion plan ${anterior.plan.nombre}`,
            emailComprador: correo,
            referenciaExterna: String(nueva.id),
            urlNotificacion: esUrlPublica(config.PUBLIC_BASE_URL)
              ? `${config.PUBLIC_BASE_URL}/api/pagos/webhook`
              : undefined,
          },
          claveIdempotencia,
        );

        const estado = traducirEstado(resultado.status);

        await fastify.prisma.payment.create({
          data: {
            licenciaId: nueva.id,
            mpPaymentId: String(resultado.id),
            idempotencyKey: claveIdempotencia,
            montoCop,
            estado,
            mpStatus: resultado.status,
            mpStatusDetail: resultado.statusDetail,
            metodo: resultado.paymentMethodId,
            emailComprador: correo,
          },
        });

        if (estado === 'rechazado') {
          await fastify.prisma.license.delete({ where: { id: nueva.id } });
          return reply.code(402).send({
            error: 'Pago rechazado',
            mensaje: explicarRechazo(resultado.statusDetail),
          });
        }

        if (estado === 'aprobado') {
          // La renovación empieza cuando acaba la anterior, no hoy: el cliente
          // no pierde los días que le quedaban por renovar con antelación.
          const desde =
            anterior.finVigencia && anterior.finVigencia > new Date()
              ? anterior.finVigencia
              : new Date();
          const licencia = await activarLicencia(
            fastify,
            nueva.id,
            anterior.plan.vigenciaDias,
            desde,
          );
          await fastify.prisma.license.update({
            where: { id: anterior.id },
            data: { estado: 'vencida' },
          });

          return reply.send({
            estado: 'aprobado',
            licencia: { id: licencia.id, finVigencia: licencia.finVigencia },
            mensaje: 'Renovacion lista.',
          });
        }

        return reply.code(202).send({
          estado: 'pendiente',
          licenciaId: nueva.id,
          mensaje: 'Estamos esperando la confirmacion de tu banco.',
        });
      } catch (error) {
        await fastify.prisma.license.delete({ where: { id: nueva.id } });
        if (error instanceof ErrorMercadoPago) {
          return reply.code(402).send({ error: 'No se pudo cobrar la renovacion' });
        }
        throw error;
      }
    },
  );

  /**
   * Webhook de Mercado Pago.
   *
   * Es idempotente por construcción: consulta el estado real del pago y activa
   * la licencia solo si sigue pendiente. Mercado Pago reintenta este aviso varias
   * veces, y activar dos veces no puede sumar dos años de vigencia.
   */
  fastify.post('/webhook', async (request, reply) => {
    const cuerpo = request.body as { type?: string; data?: { id?: string | number } } | undefined;
    const idPago = cuerpo?.data?.id;

    // Se responde 200 siempre que el aviso sea legible: un error haría que
    // Mercado Pago reintente en bucle por algo que no vamos a poder procesar.
    if (!idPago || cuerpo?.type !== 'payment') {
      return reply.send({ recibido: true });
    }

    try {
      const pago = await obtenerPago(idPago);
      const licenciaId = Number(pago.externalReference);
      if (!Number.isInteger(licenciaId)) return reply.send({ recibido: true });

      const estado = traducirEstado(pago.status);

      await fastify.prisma.payment.updateMany({
        where: { mpPaymentId: String(pago.id) },
        data: {
          estado,
          mpStatus: pago.status,
          mpStatusDetail: pago.statusDetail,
          payloadWebhook: cuerpo as object,
        },
      });

      const licencia = await fastify.prisma.license.findUnique({
        where: { id: licenciaId },
        include: { plan: true },
      });

      // Solo se activa si sigue pendiente: la doble notificación no hace nada.
      if (licencia?.estado === 'pendiente' && estado === 'aprobado') {
        await activarLicencia(fastify, licenciaId, licencia.plan.vigenciaDias);
        fastify.log.info({ licenciaId }, 'Licencia activada por webhook');
      }

      if (licencia?.estado === 'pendiente' && estado === 'rechazado') {
        await fastify.prisma.license.update({
          where: { id: licenciaId },
          data: { estado: 'cancelada' },
        });
      }

      return reply.send({ recibido: true });
    } catch (error) {
      fastify.log.error({ err: error, idPago }, 'Fallo al procesar el webhook');
      // 200 igualmente: el estado se puede reconciliar consultando el pago.
      return reply.send({ recibido: true });
    }
  });

  /** Estado de una licencia, para la pantalla de espera del comprador. */
  fastify.get('/licencia/:id', async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    const licencia = await fastify.prisma.license.findUnique({
      where: { id: params.data.id },
      select: {
        id: true,
        estado: true,
        finVigencia: true,
        codigoAcceso: true,
        plan: { select: { nombre: true, clave: true } },
      },
    });

    if (!licencia) return reply.code(404).send({ error: 'Esa licencia no existe' });

    // El código de acceso solo se entrega cuando la licencia está activa.
    return reply.send({
      ...licencia,
      codigoAcceso: licencia.estado === 'activa' ? licencia.codigoAcceso : null,
    });
  });
};

/** Activa una licencia y calcula su vigencia. */
async function activarLicencia(
  fastify: FastifyInstance,
  licenciaId: number,
  vigenciaDias: number,
  desde: Date = new Date(),
) {
  const fin = new Date(desde);
  fin.setDate(fin.getDate() + vigenciaDias);

  return fastify.prisma.license.update({
    where: { id: licenciaId },
    data: { estado: 'activa', inicioVigencia: desde, finVigencia: fin },
  });
}

/**
 * Deshace un alta cuyo cobro no salió.
 *
 * Importa el orden: primero la licencia (que apunta al usuario), después el
 * usuario, y por último la institución. Al revés, las claves foráneas lo
 * impedirían.
 */
async function limpiarCompra(
  fastify: FastifyInstance,
  creado: { usuarioId: number; licenciaId: number; institucionId: number | null },
): Promise<void> {
  try {
    await fastify.prisma.$transaction([
      fastify.prisma.payment.deleteMany({ where: { licenciaId: creado.licenciaId } }),
      fastify.prisma.license.deleteMany({ where: { id: creado.licenciaId } }),
      fastify.prisma.user.deleteMany({ where: { id: creado.usuarioId } }),
      ...(creado.institucionId
        ? [fastify.prisma.institution.deleteMany({ where: { id: creado.institucionId } })]
        : []),
    ]);
  } catch (error) {
    // Si la limpieza falla, queda una cuenta sin licencia. Se registra para
    // poder repararla a mano; no se propaga, porque el comprador ya tiene su
    // mensaje de rechazo y un segundo error no le aporta nada.
    fastify.log.error({ err: error, creado }, 'No se pudo deshacer una compra rechazada');
  }
}
