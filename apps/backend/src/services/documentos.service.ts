/**
 * Facturas y cotizaciones.
 *
 * Tres reglas, que son las de cualquier documento contable:
 *
 *  1. **Numeracion sin huecos.** El consecutivo se toma dentro de la misma
 *     transaccion que crea el documento. Si algo falla, el numero no se gasta.
 *  2. **El documento es una foto.** Emisor, cliente y lineas se copian dentro
 *     del documento. Cambiar el NIT de la empresa manana no cambia la factura de
 *     ayer.
 *  3. **No se borra nada.** Una factura se anula con motivo; una cotizacion
 *     tambien.
 *
 * Las cuentas (subtotal, descuento, IVA, total) las hace `calcularTotales` de
 * `@codenest/shared`, la misma funcion que usa el panel para la vista previa.
 * El total que llega del navegador no se lee nunca.
 */
import { randomBytes } from 'node:crypto';

import type { Prisma, PrismaClient } from '@prisma/client';

import {
  ETIQUETA_ESTADO_COTIZACION,
  calcularTotales,
  numeroDocumento,
  type DatosEmisor,
} from '@codenest/shared';
import type { EntradaCotizacion, EntradaFactura } from '@codenest/shared/zod';

import { expirarPreferencia, preferenciaDeUrl } from '../lib/mercadopago.js';
import { ErrorCobro } from './cobros.service.js';

type Tx = Prisma.TransactionClient;

const CLAVE_EMISOR = 'emisor';

// ─────────────────────────────── Emisor ───────────────────────────────

export async function leerEmisor(prisma: PrismaClient | Tx): Promise<DatosEmisor | null> {
  const fila = await prisma.setting.findUnique({ where: { clave: CLAVE_EMISOR } });
  return (fila?.valor as DatosEmisor | undefined) ?? null;
}

export async function guardarEmisor(prisma: PrismaClient, datos: DatosEmisor): Promise<DatosEmisor> {
  const valor = datos as unknown as Prisma.InputJsonValue;
  await prisma.setting.upsert({
    where: { clave: CLAVE_EMISOR },
    create: { clave: CLAVE_EMISOR, valor },
    update: { valor },
  });
  return datos;
}

async function exigirEmisor(tx: Tx): Promise<DatosEmisor> {
  const emisor = await leerEmisor(tx);
  if (!emisor) {
    throw new ErrorCobro(
      'Completa los datos de la empresa (razón social, NIT, dirección) antes de emitir documentos.',
      409,
    );
  }
  return emisor;
}

// ────────────────────────────── Consecutivos ──────────────────────────────

/**
 * El siguiente numero de un consecutivo, sin huecos.
 *
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` es atomico y bloquea la fila
 * hasta el final de la transaccion: dos facturas a la vez esperan en fila, y si
 * la transaccion de una falla, su numero vuelve a quedar libre. Una SEQUENCE de
 * Postgres no hace eso: el numero consumido en una transaccion fallida se pierde.
 */
export async function siguienteConsecutivo(tx: Tx, clave: 'factura' | 'cotizacion'): Promise<number> {
  const filas = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO "consecutivos" ("clave", "ultimo") VALUES (${clave}, 1)
    ON CONFLICT ("clave") DO UPDATE SET "ultimo" = "consecutivos"."ultimo" + 1
    RETURNING "ultimo"`;
  const numero = filas[0]?.ultimo;
  if (!numero) throw new Error(`No se pudo obtener el consecutivo de ${clave}`);
  return Number(numero);
}

function tokenPublico(): string {
  // 32 bytes: no se adivina ni se recorre como un numero secuencial.
  return randomBytes(32).toString('hex');
}

// ────────────────────────────── Cotizaciones ──────────────────────────────

async function usuarioPorCorreo(tx: Tx, email: string | undefined): Promise<number | null> {
  if (!email) return null;
  const u = await tx.user.findUnique({ where: { email }, select: { id: true } });
  return u?.id ?? null;
}

function datosCotizacion(entrada: EntradaCotizacion) {
  const totales = calcularTotales({
    items: entrada.items,
    descuentoCop: entrada.descuentoCop,
    ivaPorcentaje: entrada.ivaPorcentaje,
  });
  return {
    cliente: entrada.cliente as unknown as Prisma.InputJsonValue,
    items: totales.items as unknown as Prisma.InputJsonValue,
    subtotalCop: totales.subtotalCop,
    descuentoCop: totales.descuentoCop,
    ivaPorcentaje: totales.ivaPorcentaje,
    ivaCop: totales.ivaCop,
    totalCop: totales.totalCop,
    validaHasta: new Date(`${entrada.validaHasta}T00:00:00Z`),
    planId: entrada.planId ?? null,
    notas: entrada.notas ?? null,
    condiciones: entrada.condiciones ?? null,
  };
}

export async function crearCotizacion(
  prisma: PrismaClient,
  entrada: EntradaCotizacion,
  adminId: number,
) {
  return prisma.$transaction(async (tx) => {
    const emisor = await exigirEmisor(tx);
    if (entrada.planId) {
      const plan = await tx.plan.findUnique({ where: { id: entrada.planId } });
      if (!plan) throw new ErrorCobro('Ese plan no existe', 404);
    }
    const numero = await siguienteConsecutivo(tx, 'cotizacion');
    return tx.quote.create({
      data: {
        ...datosCotizacion(entrada),
        numero,
        prefijo: 'COT',
        emisor: emisor as unknown as Prisma.InputJsonValue,
        usuarioId: await usuarioPorCorreo(tx, entrada.cliente.email),
        tokenPublico: tokenPublico(),
        creadoPorId: adminId,
      },
    });
  });
}

/** Solo un borrador se puede editar: lo que ya se envio es lo que el cliente aprobo. */
export async function actualizarCotizacion(
  prisma: PrismaClient,
  id: number,
  entrada: EntradaCotizacion,
) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.quote.findUnique({ where: { id } });
    if (!actual) throw new ErrorCobro('Esa cotización no existe', 404);
    if (actual.estado !== 'borrador') {
      throw new ErrorCobro(
        'Solo se puede editar un borrador. Anula esta y crea una nueva.',
        409,
      );
    }
    return tx.quote.update({
      where: { id },
      data: {
        ...datosCotizacion(entrada),
        // El emisor se refresca mientras es borrador: aun no se ha enviado.
        emisor: (await exigirEmisor(tx)) as unknown as Prisma.InputJsonValue,
        usuarioId: await usuarioPorCorreo(tx, entrada.cliente.email),
      },
    });
  });
}

const TRANSICIONES: Readonly<Record<string, readonly string[]>> = {
  borrador: ['enviada', 'anulada'],
  enviada: ['aceptada', 'anulada'],
  aceptada: ['anulada'],
  pagada: [],
  anulada: [],
};

export async function cambiarEstadoCotizacion(
  prisma: PrismaClient,
  id: number,
  nuevo: 'enviada' | 'aceptada' | 'anulada',
  motivo?: string,
) {
  const actual = await prisma.quote.findUnique({ where: { id } });
  if (!actual) throw new ErrorCobro('Esa cotización no existe', 404);
  if (!TRANSICIONES[actual.estado]?.includes(nuevo)) {
    throw new ErrorCobro(
      `Una cotización ${ETIQUETA_ESTADO_COTIZACION[actual.estado]?.toLowerCase()} no puede pasar a ${ETIQUETA_ESTADO_COTIZACION[nuevo]?.toLowerCase()}.`,
      409,
    );
  }
  if (nuevo === 'anulada' && !motivo) {
    throw new ErrorCobro('Anular exige un motivo: queda en el documento.', 400);
  }
  if (nuevo === 'anulada') {
    const preferencia = preferenciaDeUrl(actual.urlPago);
    if (preferencia) {
      // Si Mercado Pago no responde, la cotizacion se anula igual: la pagina de
      // pago caduca sola en su fecha, y aplicarPago no desanula una anulada.
      await expirarPreferencia(preferencia).catch(() => undefined);
    }
  }
  return prisma.quote.update({
    where: { id },
    data: {
      estado: nuevo,
      ...(nuevo === 'anulada'
        ? { anuladaEn: new Date(), motivoAnulacion: motivo ?? null, urlPago: null }
        : {}),
    },
  });
}

// ─────────────────────────────── Facturas ───────────────────────────────

export async function crearFactura(prisma: PrismaClient, entrada: EntradaFactura, adminId: number) {
  return prisma.$transaction(async (tx) => {
    const emisor = await exigirEmisor(tx);

    let usuarioId = entrada.usuarioId ?? null;
    if (entrada.pagoId) {
      const pago = await tx.payment.findUnique({
        where: { id: entrada.pagoId },
        include: { factura: { select: { id: true, numero: true, prefijo: true } } },
      });
      if (!pago) throw new ErrorCobro('Ese pago no existe', 404);
      if (pago.estado !== 'aprobado') {
        throw new ErrorCobro('Solo se factura un pago aprobado', 409);
      }
      if (pago.factura) {
        throw new ErrorCobro(
          `Ese pago ya tiene la factura ${numeroDocumento(pago.factura.prefijo, pago.factura.numero)}.`,
          409,
        );
      }
      usuarioId = usuarioId ?? pago.usuarioId;
    }
    usuarioId = usuarioId ?? (await usuarioPorCorreo(tx, entrada.cliente.email));

    const totales = calcularTotales({
      items: entrada.items,
      descuentoCop: entrada.descuentoCop,
      ivaPorcentaje: entrada.ivaPorcentaje,
    });
    const numero = await siguienteConsecutivo(tx, 'factura');

    return tx.invoice.create({
      data: {
        numero,
        prefijo: 'FAC',
        fechaVencimiento: entrada.fechaVencimiento
          ? new Date(`${entrada.fechaVencimiento}T00:00:00Z`)
          : null,
        usuarioId,
        emisor: emisor as unknown as Prisma.InputJsonValue,
        cliente: entrada.cliente as unknown as Prisma.InputJsonValue,
        items: totales.items as unknown as Prisma.InputJsonValue,
        subtotalCop: totales.subtotalCop,
        descuentoCop: totales.descuentoCop,
        ivaPorcentaje: totales.ivaPorcentaje,
        ivaCop: totales.ivaCop,
        totalCop: totales.totalCop,
        notas: entrada.notas ?? null,
        pagoId: entrada.pagoId ?? null,
        cotizacionId: entrada.cotizacionId ?? null,
        tokenPublico: tokenPublico(),
        creadoPorId: adminId,
      },
    });
  });
}

export async function anularFactura(prisma: PrismaClient, id: number, motivo: string) {
  const factura = await prisma.invoice.findUnique({ where: { id } });
  if (!factura) throw new ErrorCobro('Esa factura no existe', 404);
  if (factura.estado === 'anulada') throw new ErrorCobro('Esa factura ya está anulada', 409);
  return prisma.invoice.update({
    where: { id },
    // El pago queda libre para volver a facturarse bien: por eso se suelta
    // `pagoId`. La factura anulada conserva todo lo demas.
    data: { estado: 'anulada', anuladaEn: new Date(), motivoAnulacion: motivo, pagoId: null },
  });
}

// ─────────────────────── Borradores para el panel ───────────────────────

function hoyIso(masDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + masDias);
  return d.toISOString().slice(0, 10);
}

function fechaCorta(fecha: Date | null): string {
  return fecha ? fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/**
 * Lo que el panel precarga al pulsar "Facturar" en un pago.
 *
 * Es solo una propuesta: el administrador la revisa y la ajusta antes de
 * emitir. El valor de la linea es lo que se cobro, sin IVA; si el precio
 * incluia IVA, lo decide quien emite, no el codigo.
 */
export async function borradorFacturaDePago(prisma: PrismaClient, pagoId: number): Promise<EntradaFactura> {
  const pago = await prisma.payment.findUnique({
    where: { id: pagoId },
    include: {
      usuario: { include: { perfilFacturacion: true } },
      licencia: { include: { plan: true } },
      cotizacion: true,
    },
  });
  if (!pago) throw new ErrorCobro('Ese pago no existe', 404);

  // Una cotizacion pagada ya tiene sus lineas y su cliente: se reutilizan.
  if (pago.cotizacion) {
    const c = pago.cotizacion;
    return {
      cliente: c.cliente as EntradaFactura['cliente'],
      items: (c.items as { descripcion: string; cantidad: number; valorUnitarioCop: number }[]).map(
        ({ descripcion, cantidad, valorUnitarioCop }) => ({ descripcion, cantidad, valorUnitarioCop }),
      ),
      descuentoCop: c.descuentoCop,
      ivaPorcentaje: c.ivaPorcentaje,
      notas: `Corresponde a la cotización ${numeroDocumento(c.prefijo, c.numero)}.`,
      usuarioId: pago.usuarioId,
      pagoId: pago.id,
      cotizacionId: c.id,
    };
  }

  const perfil = pago.usuario?.perfilFacturacion;
  const licencia = pago.licencia;
  const periodo =
    licencia?.inicioVigencia && licencia.finVigencia
      ? ` (${fechaCorta(licencia.inicioVigencia)} a ${fechaCorta(licencia.finVigencia)})`
      : '';

  return {
    cliente: {
      nombre: perfil?.razonSocial || pago.usuario?.nombre || pago.emailComprador,
      tipoDocumento: perfil?.tipoDocumento ?? 'CC',
      documento: perfil?.nitCedula ?? '',
      email: pago.usuario?.email ?? pago.emailComprador ?? undefined,
      direccion: perfil?.direccion ?? undefined,
      ciudad: perfil?.ciudad ?? undefined,
      telefono: perfil?.telefono ?? undefined,
    },
    items: [
      {
        descripcion: licencia
          ? `CodeNest School · Plan ${licencia.plan.nombre} · licencia anual${periodo}`
          : 'CodeNest School · licencia',
        cantidad: 1,
        valorUnitarioCop: pago.montoCop,
      },
    ],
    descuentoCop: 0,
    ivaPorcentaje: 0,
    fechaVencimiento: hoyIso(),
    notas: pago.mpPaymentId
      ? `Pagado con Mercado Pago, operación ${pago.mpPaymentId}.`
      : pago.referenciaManual
        ? `Pagado por transferencia, referencia ${pago.referenciaManual}.`
        : undefined,
    usuarioId: pago.usuarioId,
    pagoId: pago.id,
  };
}
