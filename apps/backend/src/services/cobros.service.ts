/**
 * Cobros: de "quiero pagar" a "la licencia esta activa".
 *
 * Aqui vive todo lo que toca dinero, para que haya un solo camino. Un pago de
 * Mercado Pago puede llegar por tres puertas —el webhook, el regreso del
 * comprador y la conciliacion desde el panel— y las tres llaman a
 * `aplicarPago`. Si cada puerta tuviera su logica, tarde o temprano una
 * activaria dos veces o una se olvidaria de la renovacion.
 *
 * Dos garantias sostienen el resto:
 *
 *  - **Idempotencia.** El pago se guarda con un upsert por su identificador de
 *    Mercado Pago, y la licencia se activa con un UPDATE condicionado a que siga
 *    sin activar. El mismo aviso recibido tres veces, o dos avisos a la vez,
 *    activan una sola vez.
 *  - **El estado sale de Mercado Pago, nunca del aviso.** Quien llama pasa un
 *    pago recien consultado con nuestro token.
 */
import { randomBytes } from 'node:crypto';

import type { Prisma, PrismaClient } from '@prisma/client';

import { PLAN_POR_CLAVE, cotizacionPagable, numeroDocumento } from '@codenest/shared';

import {
  buscarPagos,
  crearPreferencia,
  traducirEstado,
  type PagoMercadoPago,
} from '../lib/mercadopago.js';
import { generarCodigoAcceso, generarPasswordTemporal, hashPassword } from './auth.service.js';

type Tx = Prisma.TransactionClient;

// ───────────────────────────── Referencias ─────────────────────────────

export type Referencia =
  | { readonly tipo: 'licencia'; readonly id: number }
  | { readonly tipo: 'cotizacion'; readonly id: number };

/**
 * Prefijo de nuestras referencias en Mercado Pago.
 *
 * La cuenta de Mercado Pago es COMPARTIDA con otros negocios (Untis,
 * UntiCloud, Veyon), y el webhook y la busqueda de pagos ven los de todos. Con
 * un prefijo propio, un pago ajeno nunca se confunde con uno nuestro: sin el,
 * una referencia "lic-12" de otro sistema podria activar nuestra licencia 12.
 */
const PREFIJO = 'cns';

export function crearReferencia(ref: Referencia): string {
  return `${PREFIJO}-${ref.tipo === 'licencia' ? 'lic' : 'cot'}-${ref.id}`;
}

/**
 * "cns-lic-12" -> licencia 12; "cns-cot-3" -> cotizacion 3; cualquier otra
 * cosa -> null (es de otro sistema y se ignora).
 *
 * No se aceptan numeros sueltos: en una cuenta compartida, "12345" puede ser la
 * referencia de otro negocio. No hace falta compatibilidad hacia atras:
 * produccion nunca tuvo Mercado Pago configurado, asi que no hay pagos antiguos.
 */
export function leerReferencia(texto: string | null | undefined): Referencia | null {
  if (!texto) return null;
  const m = /^cns-(lic|cot)-(\d+)$/.exec(texto);
  if (!m) return null;
  return { tipo: m[1] === 'lic' ? 'licencia' : 'cotizacion', id: Number(m[2]) };
}

// ─────────────────────────── Licencia vigente ───────────────────────────

interface LicenciaResumen {
  readonly id: number;
  readonly estado: string;
  readonly inicioVigencia: Date | null;
  readonly finVigencia: Date | null;
  readonly creadoEn: Date;
}

/**
 * La licencia que el portal debe mostrar como "la suya".
 *
 * Antes se ordenaba por estado y una renovacion PENDIENTE aparecia por encima de
 * la ACTIVA: el cliente pagaba, empezaba una renovacion por PSE y el portal le
 * decia que no tenia plan. El orden correcto es el de la vida real: primero la
 * que esta en curso, despues la que empieza cuando esa acabe, despues una por
 * pagar, y por ultimo lo que ya paso.
 */
export function licenciaVigente<T extends LicenciaResumen>(
  licencias: readonly T[],
  ahora: Date = new Date(),
): T | null {
  const t = ahora.getTime();
  const activas = licencias.filter((l) => l.estado === 'activa');

  const enCurso = activas
    .filter((l) => (l.inicioVigencia?.getTime() ?? 0) <= t && (l.finVigencia?.getTime() ?? 0) > t)
    .sort((a, b) => (b.finVigencia?.getTime() ?? 0) - (a.finVigencia?.getTime() ?? 0));
  if (enCurso[0]) return enCurso[0];

  const futuras = activas
    .filter((l) => (l.inicioVigencia?.getTime() ?? 0) > t)
    .sort((a, b) => (a.inicioVigencia?.getTime() ?? 0) - (b.inicioVigencia?.getTime() ?? 0));
  if (futuras[0]) return futuras[0];

  const porPagar = licencias
    .filter((l) => l.estado === 'pendiente')
    .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
  if (porPagar[0]) return porPagar[0];

  return (
    [...licencias].sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())[0] ?? null
  );
}

/** "activa" con la fecha ya pasada se muestra como vencida: nadie la marca a medianoche. */
export function estadoEfectivoLicencia(l: LicenciaResumen, ahora: Date = new Date()): string {
  if (l.estado === 'activa' && l.finVigencia && l.finVigencia.getTime() <= ahora.getTime()) {
    return 'vencida';
  }
  return l.estado;
}

// ────────────────────────────── Activacion ──────────────────────────────

/**
 * Activa una licencia pagada. Devuelve `true` solo si ESTA llamada la activo.
 *
 * El UPDATE lleva la condicion de estado en el WHERE: si dos avisos llegan a la
 * vez, uno actualiza una fila y el otro cero. Leer primero y escribir despues
 * dejaria una ventana en la que ambos ven "pendiente" y ambos activan.
 *
 * Una renovacion empieza cuando acaba la licencia que renueva, no hoy: quien
 * renueva con un mes de antelacion no pierde ese mes. Era un fallo real del
 * webhook anterior, que activaba desde la fecha del aviso.
 */
export async function activarLicenciaPagada(tx: Tx, licenciaId: number): Promise<boolean> {
  const licencia = await tx.license.findUnique({
    where: { id: licenciaId },
    include: { plan: true, renovadaDe: true },
  });
  if (!licencia) return false;

  const ahora = new Date();
  const anterior = licencia.renovadaDe;
  const desde =
    anterior?.estado === 'activa' && anterior.finVigencia && anterior.finVigencia > ahora
      ? anterior.finVigencia
      : ahora;
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + licencia.plan.vigenciaDias);

  const { count } = await tx.license.updateMany({
    // `cancelada` tambien: un pago en efectivo puede acreditarse despues de que
    // alguien diera la compra por perdida, y quien paga recibe lo que pago.
    where: { id: licenciaId, estado: { in: ['pendiente', 'cancelada'] } },
    data: { estado: 'activa', inicioVigencia: desde, finVigencia: hasta },
  });
  return count === 1;
}

// ─────────────────────────── Aplicar un pago ───────────────────────────

export interface ResultadoAplicacion {
  readonly pagoId: number | null;
  readonly estado: string;
  readonly licenciaActivada: boolean;
  readonly cotizacionPagada: boolean;
  /** El pago no es nuestro (otra referencia): se ignora sin error. */
  readonly ajeno: boolean;
}

export async function aplicarPago(
  prisma: PrismaClient,
  pago: PagoMercadoPago,
  payloadAviso?: unknown,
): Promise<ResultadoAplicacion> {
  const referencia = leerReferencia(pago.externalReference);
  const estado = traducirEstado(pago.status);

  if (!referencia || !Number.isFinite(pago.id)) {
    return { pagoId: null, estado, licenciaActivada: false, cotizacionPagada: false, ajeno: true };
  }

  return prisma.$transaction(async (tx) => {
    let licenciaId: number | null = null;
    let cotizacionId: number | null = null;
    let usuarioId: number | null = null;
    let correo = pago.payerEmail ?? '';

    if (referencia.tipo === 'licencia') {
      const licencia = await tx.license.findUnique({
        where: { id: referencia.id },
        select: { id: true, titularId: true, titular: { select: { email: true } } },
      });
      if (!licencia) {
        return { pagoId: null, estado, licenciaActivada: false, cotizacionPagada: false, ajeno: true };
      }
      licenciaId = licencia.id;
      usuarioId = licencia.titularId;
      correo = correo || licencia.titular.email || '';
    } else {
      const cotizacion = await tx.quote.findUnique({
        where: { id: referencia.id },
        select: { id: true, usuarioId: true, licenciaId: true, cliente: true },
      });
      if (!cotizacion) {
        return { pagoId: null, estado, licenciaActivada: false, cotizacionPagada: false, ajeno: true };
      }
      cotizacionId = cotizacion.id;
      usuarioId = cotizacion.usuarioId;
      licenciaId = cotizacion.licenciaId;
      const cliente = cotizacion.cliente as { email?: string };
      correo = correo || cliente.email || '';
    }

    const aprobadoEn = estado === 'aprobado' ? new Date(pago.dateApproved ?? Date.now()) : null;
    const datos = {
      estado,
      mpStatus: pago.status,
      mpStatusDetail: pago.statusDetail,
      metodo: pago.paymentMethodId || null,
      tipoMedio: pago.paymentTypeId || null,
      cuotas: pago.installments,
      ...(payloadAviso ? { payloadWebhook: payloadAviso as Prisma.InputJsonValue } : {}),
    };

    // Upsert por el identificador de Mercado Pago, que es unico: dos avisos
    // simultaneos del mismo pago acaban en una sola fila.
    const fila = await tx.payment.upsert({
      where: { mpPaymentId: String(pago.id) },
      create: {
        ...datos,
        licenciaId,
        cotizacionId,
        usuarioId,
        mpPaymentId: String(pago.id),
        idempotencyKey: `mp-${pago.id}`,
        montoCop: Math.round(pago.transactionAmount),
        moneda: pago.currencyId || 'COP',
        emailComprador: correo,
        origen: 'mercadopago',
        aprobadoEn,
      },
      update: { ...datos, ...(aprobadoEn ? { aprobadoEn } : {}) },
    });

    let licenciaActivada = false;
    let cotizacionPagada = false;

    if (estado === 'aprobado') {
      if (referencia.tipo === 'licencia' && licenciaId) {
        licenciaActivada = await activarLicenciaPagada(tx, licenciaId);
      }
      if (referencia.tipo === 'cotizacion' && cotizacionId) {
        // Una anulada no se "desanula" porque llegue un pago tarde: el pago
        // queda registrado y el administrador decide (normalmente, devolverlo).
        const { count } = await tx.quote.updateMany({
          where: { id: cotizacionId, estado: { notIn: ['pagada', 'anulada'] } },
          data: { estado: 'pagada', pagadaEn: aprobadoEn ?? new Date() },
        });
        cotizacionPagada = count === 1;
      }
    }

    // Un reembolso o un contracargo deshace el acceso que ese dinero compro,
    // pero solo si no queda otro pago aprobado que lo sostenga (uno manual,
    // por ejemplo).
    if (estado === 'reembolsado' && licenciaId) {
      const quedan = await tx.payment.count({ where: { licenciaId, estado: 'aprobado' } });
      if (quedan === 0) {
        await tx.license.updateMany({
          where: { id: licenciaId, estado: 'activa' },
          data: { estado: 'cancelada' },
        });
      }
    }

    return { pagoId: fila.id, estado, licenciaActivada, cotizacionPagada, ajeno: false };
  });
}

/**
 * Busca en Mercado Pago los pagos de una referencia y los aplica.
 *
 * Es la red de seguridad del webhook: el comprador pago, el aviso se perdio, y
 * aun asi al volver al portal (o al pulsar "Consultar" en el panel) la
 * licencia se activa.
 */
export async function conciliar(
  prisma: PrismaClient,
  referencia: Referencia,
): Promise<ResultadoAplicacion[]> {
  const pagos = await buscarPagos(crearReferencia(referencia));
  const resultados: ResultadoAplicacion[] = [];
  // Del mas antiguo al mas reciente: un rechazo seguido de un aprobado debe
  // dejar la licencia activa, no al reves.
  for (const pago of [...pagos].reverse()) {
    resultados.push(await aplicarPago(prisma, pago));
  }
  return resultados;
}

// ─────────────────────── Iniciar un pago (preferencias) ───────────────────────

export class ErrorCobro extends Error {
  constructor(
    message: string,
    readonly codigo: number,
  ) {
    super(message);
    this.name = 'ErrorCobro';
  }
}

/** Dias que una pagina de pago de licencia sigue aceptando pagos. */
const DIAS_VIGENCIA_PREFERENCIA = 7;

/**
 * Crea la pagina de pago de una licencia pendiente.
 *
 * El monto se lee del plan en la base en este momento: es el precio que ve el
 * cliente en la tarjeta, y es el que queda fijado en la preferencia.
 */
export async function iniciarPagoLicencia(
  prisma: PrismaClient,
  licenciaId: number,
  urlBase: string,
): Promise<{ urlPago: string; montoCop: number }> {
  const licencia = await prisma.license.findUnique({
    where: { id: licenciaId },
    include: {
      plan: true,
      titular: { select: { nombre: true, email: true, perfilFacturacion: true } },
    },
  });
  if (!licencia) throw new ErrorCobro('Esa licencia no existe', 404);
  if (licencia.estado !== 'pendiente') {
    throw new ErrorCobro('Esa licencia no tiene un pago pendiente', 409);
  }
  if (!licencia.plan.activo) throw new ErrorCobro('Ese plan ya no está disponible', 409);

  const perfil = licencia.titular.perfilFacturacion;
  const expira = new Date();
  expira.setDate(expira.getDate() + DIAS_VIGENCIA_PREFERENCIA);

  const { urlPago } = await crearPreferencia({
    idProducto: `plan-${licencia.plan.clave}`,
    titulo: `CodeNest School · Plan ${licencia.plan.nombre}`,
    descripcion: licencia.renovadaDeId
      ? `Renovación anual del plan ${licencia.plan.nombre}`
      : `Licencia anual del plan ${licencia.plan.nombre}`,
    montoCop: licencia.plan.precioCop,
    referenciaExterna: crearReferencia({ tipo: 'licencia', id: licencia.id }),
    comprador: {
      nombre: perfil?.razonSocial || licencia.titular.nombre,
      email: licencia.titular.email ?? undefined,
      tipoDocumento: perfil?.tipoDocumento,
      documento: perfil?.nitCedula,
      telefono: perfil?.telefono ?? undefined,
    },
    urlBase,
    rutaRegreso: `/app/portal?licencia=${licencia.id}`,
    expiraEn: expira,
  });

  return { urlPago, montoCop: licencia.plan.precioCop };
}

/**
 * Prepara la renovacion de una licencia y devuelve su pagina de pago.
 *
 * Reutiliza la renovacion pendiente si ya hay una. `renovadaDeId` es unico: si
 * cada intento creara una licencia nueva, el segundo intento (el comprador que
 * cierra Mercado Pago y vuelve a pulsar "Renovar") fallaria por la clave unica.
 */
export async function iniciarRenovacion(
  prisma: PrismaClient,
  usuarioId: number,
  licenciaId: number,
  urlBase: string,
): Promise<{ urlPago: string; montoCop: number; licenciaId: number }> {
  const anterior = await prisma.license.findUnique({
    where: { id: licenciaId },
    include: { renovacion: true, plan: true },
  });
  if (!anterior) throw new ErrorCobro('Esa licencia no existe', 404);
  if (anterior.titularId !== usuarioId) throw new ErrorCobro('Esa licencia no es tuya', 403);
  if (anterior.estado === 'pendiente') {
    // No hay nada que renovar: lo que falta es pagarla.
    const r = await iniciarPagoLicencia(prisma, anterior.id, urlBase);
    return { ...r, licenciaId: anterior.id };
  }

  let renovacion = anterior.renovacion;
  if (renovacion?.estado === 'activa') {
    throw new ErrorCobro('Esta licencia ya está renovada', 409);
  }
  if (renovacion) {
    renovacion = await prisma.license.update({
      where: { id: renovacion.id },
      data: { estado: 'pendiente' },
    });
  } else {
    renovacion = await prisma.license.create({
      data: {
        planId: anterior.planId,
        titularId: anterior.titularId,
        institucionId: anterior.institucionId,
        estado: 'pendiente',
        renovadaDeId: anterior.id,
        codigoAcceso: generarCodigoAcceso('LIC'),
      },
    });
  }

  const r = await iniciarPagoLicencia(prisma, renovacion.id, urlBase);
  return { ...r, licenciaId: renovacion.id };
}

/** Fin del dia `validaHasta` en Bogota (UTC-5), para que caduque cuando dice. */
function finDelDiaEnBogota(fecha: Date): Date {
  const iso = fecha.toISOString().slice(0, 10);
  return new Date(`${iso}T23:59:59-05:00`);
}

/** Crea (o reutiliza) la pagina de pago de una cotizacion. */
export async function iniciarPagoCotizacion(
  prisma: PrismaClient,
  cotizacionId: number,
  urlBase: string,
): Promise<{ urlPago: string; montoCop: number }> {
  const cotizacion = await prisma.quote.findUnique({ where: { id: cotizacionId } });
  if (!cotizacion) throw new ErrorCobro('Esa cotización no existe', 404);
  if (cotizacion.estado === 'borrador') {
    throw new ErrorCobro('Esta cotización todavía es un borrador', 409);
  }
  if (!cotizacionPagable(cotizacion.estado, cotizacion.validaHasta)) {
    throw new ErrorCobro('Esta cotización ya no se puede pagar', 409);
  }
  if (cotizacion.totalCop < 1_600) {
    throw new ErrorCobro('El total es menor que el mínimo que cobra Mercado Pago', 409);
  }

  // Una cotizacion enviada no cambia, asi que su pagina de pago tampoco.
  if (cotizacion.urlPago) return { urlPago: cotizacion.urlPago, montoCop: cotizacion.totalCop };

  const cliente = cotizacion.cliente as {
    nombre: string;
    email?: string;
    tipoDocumento?: string;
    documento?: string;
    telefono?: string;
  };
  const numero = numeroDocumento(cotizacion.prefijo, cotizacion.numero);

  const { urlPago } = await crearPreferencia({
    idProducto: numero,
    titulo: `CodeNest School · Cotización ${numero}`,
    descripcion: `Pago de la cotización ${numero}`,
    montoCop: cotizacion.totalCop,
    referenciaExterna: crearReferencia({ tipo: 'cotizacion', id: cotizacion.id }),
    comprador: {
      nombre: cliente.nombre,
      email: cliente.email,
      tipoDocumento: cliente.tipoDocumento,
      documento: cliente.documento,
      telefono: cliente.telefono,
    },
    urlBase,
    rutaRegreso: `/app/documento/cotizacion/${cotizacion.tokenPublico}`,
    expiraEn: finDelDiaEnBogota(cotizacion.validaHasta),
  });

  await prisma.quote.update({ where: { id: cotizacion.id }, data: { urlPago } });
  return { urlPago, montoCop: cotizacion.totalCop };
}

// ─────────────────── Pago manual y licencias desde el panel ───────────────────

/**
 * Registra un pago que no paso por Mercado Pago: una transferencia o una
 * consignacion. Es como pagan muchos colegios, contra factura.
 *
 * Aplica exactamente las mismas reglas que un pago de Mercado Pago aprobado.
 */
export async function registrarPagoManual(
  prisma: PrismaClient,
  entrada: {
    readonly licenciaId?: number | null;
    readonly cotizacionId?: number | null;
    readonly montoCop: number;
    readonly metodo: string;
    readonly referencia: string;
    readonly fecha: Date;
    readonly adminId: number;
  },
): Promise<{ pagoId: number; licenciaActivada: boolean; cotizacionPagada: boolean }> {
  return prisma.$transaction(async (tx) => {
    let usuarioId: number | null = null;
    let correo = '';

    if (entrada.licenciaId) {
      const l = await tx.license.findUnique({
        where: { id: entrada.licenciaId },
        select: { titularId: true, titular: { select: { email: true } } },
      });
      if (!l) throw new ErrorCobro('Esa licencia no existe', 404);
      usuarioId = l.titularId;
      correo = l.titular.email ?? '';
    }
    if (entrada.cotizacionId) {
      const c = await tx.quote.findUnique({
        where: { id: entrada.cotizacionId },
        select: { usuarioId: true, cliente: true, estado: true },
      });
      if (!c) throw new ErrorCobro('Esa cotización no existe', 404);
      if (c.estado === 'anulada') throw new ErrorCobro('Esa cotización está anulada', 409);
      usuarioId = usuarioId ?? c.usuarioId;
      correo = correo || ((c.cliente as { email?: string }).email ?? '');
    }

    const pago = await tx.payment.create({
      data: {
        licenciaId: entrada.licenciaId ?? null,
        cotizacionId: entrada.cotizacionId ?? null,
        usuarioId,
        idempotencyKey: `manual-${randomBytes(12).toString('hex')}`,
        montoCop: entrada.montoCop,
        estado: 'aprobado',
        metodo: entrada.metodo,
        origen: 'manual',
        referenciaManual: entrada.referencia,
        registradoPorId: entrada.adminId,
        aprobadoEn: entrada.fecha,
        emailComprador: correo,
      },
    });

    const licenciaActivada = entrada.licenciaId
      ? await activarLicenciaPagada(tx, entrada.licenciaId)
      : false;

    let cotizacionPagada = false;
    if (entrada.cotizacionId) {
      const { count } = await tx.quote.updateMany({
        where: { id: entrada.cotizacionId, estado: { notIn: ['pagada', 'anulada'] } },
        data: { estado: 'pagada', pagadaEn: entrada.fecha },
      });
      cotizacionPagada = count === 1;
    }

    return { pagoId: pago.id, licenciaActivada, cotizacionPagada };
  });
}


/**
 * Activa la licencia que vende una cotizacion pagada.
 *
 * Si el cliente ya tiene cuenta con ese correo, la licencia se le suma (y si
 * tiene una vigente, empieza cuando esa acabe). Si no, se le crea la cuenta con
 * una contrasena temporal que se muestra UNA vez al administrador: no hay
 * proveedor de correo, y guardarla en claro en algun sitio seria peor.
 */
export async function activarLicenciaDeCotizacion(
  prisma: PrismaClient,
  cotizacionId: number,
): Promise<{
  licenciaId: number;
  cuentaNueva: { email: string; passwordTemporal: string } | null;
  codigoInstitucion: string | null;
}> {
  return prisma.$transaction(async (tx) => {
    const cotizacion = await tx.quote.findUnique({
      where: { id: cotizacionId },
      include: { plan: true },
    });
    if (!cotizacion) throw new ErrorCobro('Esa cotización no existe', 404);
    if (cotizacion.estado !== 'pagada') {
      throw new ErrorCobro('La cotización todavía no está pagada', 409);
    }
    if (!cotizacion.plan) throw new ErrorCobro('La cotización no vende ningún plan', 409);
    if (cotizacion.licenciaId) throw new ErrorCobro('La licencia ya se activó', 409);

    const cliente = cotizacion.cliente as {
      nombre: string;
      email?: string;
      tipoDocumento: string;
      documento: string;
      direccion?: string;
      ciudad?: string;
      telefono?: string;
      contacto?: string;
    };
    const definicion = PLAN_POR_CLAVE[cotizacion.plan.clave];

    let usuario = cotizacion.usuarioId
      ? await tx.user.findUnique({ where: { id: cotizacion.usuarioId } })
      : cliente.email
        ? await tx.user.findUnique({ where: { email: cliente.email } })
        : null;

    let cuentaNueva: { email: string; passwordTemporal: string } | null = null;
    let codigoInstitucion: string | null = null;

    if (!usuario) {
      if (!cliente.email) {
        throw new ErrorCobro('La cotización no tiene correo: no se puede crear la cuenta', 409);
      }
      let institucionId: number | null = null;
      if (definicion.rolTitular === 'admin_escuela') {
        codigoInstitucion = generarCodigoAcceso('CNS');
        const inst = await tx.institution.create({
          data: {
            nombre: cliente.nombre,
            nit: cliente.documento,
            ciudad: cliente.ciudad ?? null,
            codigoAcceso: codigoInstitucion,
            maxEstudiantes: cotizacion.plan.maxNinos,
          },
        });
        institucionId = inst.id;
      }
      const clave = generarPasswordTemporal();
      usuario = await tx.user.create({
        data: {
          usuario: cliente.email,
          email: cliente.email,
          nombre: cliente.contacto || cliente.nombre,
          passwordHash: await hashPassword(clave),
          rol: definicion.rolTitular,
          institucionId,
        },
      });
      await tx.billingProfile.create({
        data: {
          usuarioId: usuario.id,
          razonSocial: cliente.nombre,
          tipoDocumento: cliente.tipoDocumento,
          nitCedula: cliente.documento,
          direccion: cliente.direccion ?? null,
          ciudad: cliente.ciudad ?? 'Sin ciudad',
          telefono: cliente.telefono ?? null,
        },
      });
      cuentaNueva = { email: cliente.email, passwordTemporal: clave };
    }

    // Si tiene una licencia vigente sin renovar, esta la renueva.
    const vigentes = await tx.license.findMany({
      where: { titularId: usuario.id, estado: 'activa', renovacion: null },
      orderBy: { finVigencia: 'desc' },
      take: 1,
    });
    const anterior = vigentes[0] && vigentes[0].finVigencia && vigentes[0].finVigencia > new Date()
      ? vigentes[0]
      : null;

    const licencia = await tx.license.create({
      data: {
        planId: cotizacion.plan.id,
        titularId: usuario.id,
        institucionId: usuario.institucionId,
        estado: 'pendiente',
        renovadaDeId: anterior?.id ?? null,
        codigoAcceso: generarCodigoAcceso('LIC'),
      },
    });
    await activarLicenciaPagada(tx, licencia.id);

    await tx.quote.update({
      where: { id: cotizacion.id },
      data: { licenciaId: licencia.id, usuarioId: usuario.id },
    });
    // Los pagos de la cotizacion pasan a documentar tambien la licencia, para
    // que el cliente los vea en su historial.
    await tx.payment.updateMany({
      where: { cotizacionId: cotizacion.id },
      data: { licenciaId: licencia.id, usuarioId: usuario.id },
    });

    return { licenciaId: licencia.id, cuentaNueva, codigoInstitucion };
  });
}
