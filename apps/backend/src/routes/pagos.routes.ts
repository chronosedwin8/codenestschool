/**
 * Compra, pago y renovacion de licencias, y el aviso de Mercado Pago.
 *
 * Reglas que no se negocian (ver `docs/PLAN-PAGOS.md`):
 *  1. El precio lo pone el servidor, leyendo el plan de la base. El cliente solo
 *     dice que plan quiere.
 *  2. La cuenta y la licencia se crean antes de cobrar, en estado pendiente. Si
 *     el comprador no termina de pagar, entra al portal y paga desde ahi: nunca
 *     se queda bloqueado por "ese correo ya existe".
 *  3. El estado de un pago se pide siempre a Mercado Pago. El aviso solo trae
 *     un identificador.
 *  4. Aplicar un pago es idempotente (ver `cobros.service.ts`).
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';

import { PLAN_POR_CLAVE, TIPO_PLAN, formatearCop } from '@codenest/shared';
import { datosFacturacionSchema } from '@codenest/shared/zod';

import { cargarConfig, pagosConfigurados } from '../lib/env.js';
import { ErrorMercadoPago, firmaValida, obtenerPago } from '../lib/mercadopago.js';
import { LIMITE_PAGO } from '../plugins/security.js';
import { construirToken, generarCodigoAcceso, hashPassword } from '../services/auth.service.js';
import {
  ErrorCobro,
  aplicarPago,
  conciliar,
  estadoEfectivoLicencia,
  iniciarPagoLicencia,
  iniciarRenovacion,
} from '../services/cobros.service.js';

const compraSchema = z.object({
  plan: z.enum([TIPO_PLAN.personal, TIPO_PLAN.padres, TIPO_PLAN.escuela]),
  cuenta: z.object({
    nombre: z.string().trim().min(2).max(150),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(200),
  }),
  facturacion: datosFacturacionSchema,
  institucion: z
    .object({
      nombre: z.string().trim().min(2).max(200),
      ciudad: z.string().trim().max(100).optional(),
    })
    .optional(),
  // Sin aceptar los terminos y la politica de datos no hay compra: la
  // plataforma trata datos de menores (Ley 1581).
  aceptaTerminos: z.literal(true),
});

const licenciaSchema = z.object({ licenciaId: z.number().int().positive() });

/** Traduce los errores de cobro a una respuesta que el comprador entienda. */
function responderError(reply: FastifyReply, error: unknown, log: FastifyInstance['log']) {
  if (error instanceof ErrorCobro) {
    return reply.code(error.codigo).send({ error: error.message });
  }
  if (error instanceof ErrorMercadoPago) {
    log.error({ err: error, detalle: error.detalle }, 'Fallo de Mercado Pago');
    return reply.code(502).send({
      error: 'No pudimos abrir la página de pago. Intenta de nuevo en unos minutos.',
    });
  }
  throw error;
}

export const pagosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const config = cargarConfig();

  /**
   * Planes y precios para las tarjetas del home y el checkout. Sin secretos.
   *
   * Sale de la base: es lo que el administrador edita en el panel, y es lo
   * mismo que despues se cobra.
   */
  fastify.get('/config', async (_request, reply) => {
    const planes = await fastify.prisma.plan.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });
    // Unos segundos de cache en el navegador: el precio cambia de uvas a peras,
    // y un cambio en el panel se ve casi al instante.
    reply.header('Cache-Control', 'public, max-age=30');
    return reply.send({
      configurado: pagosConfigurados(config),
      moneda: 'COP',
      planes: planes.map((plan) => ({
        clave: plan.clave,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precioCop: plan.precioCop,
        precioFormateado: formatearCop(plan.precioCop),
        vigenciaDias: plan.vigenciaDias,
        maxNinos: plan.maxNinos,
        beneficios: plan.beneficios,
        destacado: plan.destacado,
        orden: plan.orden,
      })),
    });
  });

  /**
   * Compra de una licencia nueva: alta de cuenta y pagina de pago.
   *
   * Devuelve la sesion junto con la URL de Mercado Pago. Asi, al volver del
   * pago —o si el comprador cierra la pestana a medias— ya tiene cuenta y
   * puede terminar desde el portal.
   */
  fastify.post('/comprar', { config: LIMITE_PAGO }, async (request, reply) => {
    if (!pagosConfigurados(config)) {
      return reply.code(503).send({
        error: 'La compra en línea no está disponible ahora mismo. Escríbenos y te ayudamos.',
      });
    }

    const datos = compraSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Revisa los datos del formulario', detalles: datos.error.flatten() });
    }
    const { plan: clavePlan, cuenta, facturacion, institucion } = datos.data;

    if (clavePlan === TIPO_PLAN.escuela && !institucion) {
      return reply.code(400).send({ error: 'El plan Escuela necesita el nombre del colegio.' });
    }

    const yaExiste = await fastify.prisma.user.findUnique({ where: { email: cuenta.email } });
    if (yaExiste) {
      return reply.code(409).send({
        error:
          'Ya existe una cuenta con ese correo. Entra al portal para pagar o renovar tu plan.',
        portal: '/app/portal',
      });
    }

    const plan = await fastify.prisma.plan.findUnique({ where: { clave: clavePlan } });
    if (!plan?.activo) {
      return reply.code(404).send({ error: 'Ese plan no está disponible.' });
    }
    const definicion = PLAN_POR_CLAVE[clavePlan];

    // 1) Cuenta, institucion, datos de facturacion y licencia pendiente: todo o nada.
    const creado = await fastify.prisma.$transaction(async (tx) => {
      let institucionId: number | null = null;
      if (clavePlan === TIPO_PLAN.escuela && institucion) {
        const inst = await tx.institution.create({
          data: {
            nombre: institucion.nombre,
            nit: facturacion.tipoDocumento === 'NIT' ? facturacion.documento : null,
            ciudad: institucion.ciudad ?? facturacion.ciudad,
            codigoAcceso: generarCodigoAcceso('CNS'),
            maxEstudiantes: plan.maxNinos,
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

      await tx.billingProfile.create({
        data: {
          usuarioId: usuario.id,
          razonSocial:
            facturacion.razonSocial ?? (institucion ? institucion.nombre : null),
          tipoDocumento: facturacion.tipoDocumento,
          nitCedula: facturacion.documento,
          direccion: facturacion.direccion ?? null,
          ciudad: facturacion.ciudad,
          telefono: facturacion.telefono ?? null,
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

      return { usuarioId: usuario.id, licenciaId: licencia.id, institucionId };
    });

    // 2) La pagina de pago. Si Mercado Pago no responde, se deshace el alta:
    //    una cuenta sin forma de pagar solo serviria para bloquear ese correo.
    try {
      const { urlPago } = await iniciarPagoLicencia(
        fastify.prisma,
        creado.licenciaId,
        config.PUBLIC_BASE_URL,
      );
      const token = fastify.jwt.sign(await construirToken(fastify.prisma, creado.usuarioId));
      return reply.code(201).send({ urlPago, token, licenciaId: creado.licenciaId });
    } catch (error) {
      await deshacerAlta(fastify, creado);
      return responderError(reply, error, fastify.log);
    }
  });

  /**
   * Pagar desde el portal: una licencia pendiente o la renovacion de una que ya
   * se pago. Es tambien la salida para quien empezo una compra y no la termino.
   */
  fastify.post(
    '/pagar',
    { config: LIMITE_PAGO, preHandler: fastify.autenticar },
    async (request, reply) => {
      if (!pagosConfigurados(config)) {
        return reply.code(503).send({ error: 'Los pagos en línea no están disponibles ahora mismo.' });
      }
      const datos = licenciaSchema.safeParse(request.body);
      if (!datos.success) return reply.code(400).send({ error: 'Datos inválidos' });

      const licencia = await fastify.prisma.license.findUnique({
        where: { id: datos.data.licenciaId },
        select: { id: true, titularId: true, estado: true },
      });
      if (!licencia) return reply.code(404).send({ error: 'Esa licencia no existe' });
      if (licencia.titularId !== request.user.id) {
        return reply.code(403).send({ error: 'Esa licencia no es tuya' });
      }

      try {
        const r =
          licencia.estado === 'pendiente'
            ? {
                ...(await iniciarPagoLicencia(fastify.prisma, licencia.id, config.PUBLIC_BASE_URL)),
                licenciaId: licencia.id,
              }
            : await iniciarRenovacion(
                fastify.prisma,
                request.user.id,
                licencia.id,
                config.PUBLIC_BASE_URL,
              );
        return reply.send(r);
      } catch (error) {
        return responderError(reply, error, fastify.log);
      }
    },
  );

  /**
   * "¿Ya se acredito mi pago?" Lo llama el portal al volver de Mercado Pago.
   *
   * No espera al webhook: busca en Mercado Pago los pagos de esa licencia y los
   * aplica. Si el aviso llega despues, no pasa nada: aplicar es idempotente.
   */
  fastify.post(
    '/verificar',
    { config: LIMITE_PAGO, preHandler: fastify.autenticar },
    async (request, reply) => {
      const datos = licenciaSchema.safeParse(request.body);
      if (!datos.success) return reply.code(400).send({ error: 'Datos inválidos' });

      const licencia = await fastify.prisma.license.findUnique({
        where: { id: datos.data.licenciaId },
      });
      if (!licencia) return reply.code(404).send({ error: 'Esa licencia no existe' });
      if (licencia.titularId !== request.user.id) {
        return reply.code(403).send({ error: 'Esa licencia no es tuya' });
      }

      if (pagosConfigurados(config) && licencia.estado !== 'activa') {
        try {
          await conciliar(fastify.prisma, { tipo: 'licencia', id: licencia.id });
        } catch (error) {
          // Si Mercado Pago no responde, se contesta con lo que ya sabemos: el
          // webhook activara la licencia cuando llegue.
          fastify.log.warn({ err: error, licenciaId: licencia.id }, 'No se pudo conciliar');
        }
      }

      const actual = await fastify.prisma.license.findUniqueOrThrow({
        where: { id: licencia.id },
        include: {
          pagos: { orderBy: { creadoEn: 'desc' }, take: 1 },
        },
      });
      const ultimo = actual.pagos[0];
      return reply.send({
        licenciaId: actual.id,
        estado: estadoEfectivoLicencia(actual),
        finVigencia: actual.finVigencia,
        ultimoPago: ultimo
          ? { estado: ultimo.estado, detalle: ultimo.mpStatusDetail, metodo: ultimo.metodo }
          : null,
      });
    },
  );

  /**
   * Aviso de Mercado Pago.
   *
   * Entiende los tres formatos que Mercado Pago usa: el de webhooks (cuerpo con
   * `type` y `data.id`, y lo mismo en la URL), y el IPN antiguo
   * (`?topic=payment&id=`). Solo procesa pagos.
   *
   * La firma se comprueba si llega. Aun sin ella, un aviso falsificado no puede
   * activar nada: el pago se vuelve a pedir a Mercado Pago con nuestro token, y
   * es esa respuesta, no el aviso, la que manda.
   */
  fastify.post('/webhook', async (request, reply) => {
    const consulta = request.query as Record<string, string | undefined>;
    const cuerpo = (request.body ?? {}) as { type?: string; data?: { id?: string | number } };

    const tipo = cuerpo.type ?? consulta.type ?? consulta.topic;
    const idPago = String(consulta['data.id'] ?? cuerpo.data?.id ?? consulta.id ?? '');

    const secreto = config.MP_WEBHOOK_SECRET;
    const cabeceraFirma = request.headers['x-signature'];
    if (secreto && typeof cabeceraFirma === 'string') {
      const valida = firmaValida({
        cabeceraFirma,
        idSolicitud: typeof request.headers['x-request-id'] === 'string'
          ? request.headers['x-request-id']
          : undefined,
        idRecurso: consulta['data.id'] ?? (cuerpo.data?.id !== undefined ? String(cuerpo.data.id) : undefined),
        secreto,
      });
      if (!valida) {
        fastify.log.warn({ idPago }, 'Aviso de Mercado Pago con firma invalida');
        return reply.code(401).send({ error: 'Firma inválida' });
      }
    }

    // Un aviso que no es de un pago (una orden, una prueba) se agradece y ya.
    if (tipo !== 'payment' || !/^\d+$/.test(idPago)) {
      return reply.send({ recibido: true });
    }

    try {
      const pago = await obtenerPago(idPago);
      const resultado = await aplicarPago(fastify.prisma, pago, request.body ?? consulta);
      if (resultado.licenciaActivada) {
        fastify.log.info({ idPago, pagoId: resultado.pagoId }, 'Licencia activada por aviso de pago');
      }
      return reply.send({ recibido: true });
    } catch (error) {
      if (error instanceof ErrorMercadoPago && error.estado === 404) {
        // El boton "Simular notificacion" del panel de Mercado Pago manda un
        // identificador que no existe. Se responde 200 para que no reintente.
        return reply.send({ recibido: true });
      }
      // Cualquier otro fallo (Mercado Pago caido, la base ocupada) devuelve 500
      // a proposito: Mercado Pago reintenta el aviso mas tarde, que es justo lo
      // que queremos.
      fastify.log.error({ err: error, idPago }, 'Fallo al procesar el aviso de pago');
      return reply.code(500).send({ error: 'No se pudo procesar el aviso' });
    }
  });
};

/**
 * Deshace un alta cuya pagina de pago no se pudo crear.
 *
 * El orden importa: primero la licencia (apunta al usuario), despues el usuario
 * (arrastra su perfil de facturacion) y por ultimo la institucion.
 */
async function deshacerAlta(
  fastify: FastifyInstance,
  creado: { usuarioId: number; licenciaId: number; institucionId: number | null },
): Promise<void> {
  try {
    await fastify.prisma.$transaction([
      fastify.prisma.license.deleteMany({ where: { id: creado.licenciaId } }),
      fastify.prisma.user.deleteMany({ where: { id: creado.usuarioId } }),
      ...(creado.institucionId
        ? [fastify.prisma.institution.deleteMany({ where: { id: creado.institucionId } })]
        : []),
    ]);
  } catch (error) {
    fastify.log.error({ err: error, creado }, 'No se pudo deshacer un alta sin pago');
  }
}
