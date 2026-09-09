/**
 * Cliente de Mercado Pago (Checkout API).
 *
 * El flujo es el de pago transparente: la tarjeta se convierte en un token en el
 * navegador con la clave pública, y ese token llega aquí. El número de la tarjeta
 * nunca pasa por nuestro servidor, que es justamente lo que evita tener que
 * cumplir con PCI DSS por nuestra cuenta.
 *
 * El token de acceso es secreto y solo existe en el servidor. El monto lo decide
 * el servidor a partir del plan: si se aceptara el que envía el cliente,
 * cualquiera podría comprar la licencia de colegio por mil pesos.
 */
const API_BASE = 'https://api.mercadopago.com';

export interface DatosPago {
  readonly token: string;
  readonly paymentMethodId: string;
  readonly issuerId?: string;
  readonly installments: number;
  readonly montoCop: number;
  readonly descripcion: string;
  readonly emailComprador: string;
  readonly identificacion?: { readonly tipo: string; readonly numero: string };
  /** Referencia propia: es la que usa el webhook para localizar la licencia. */
  readonly referenciaExterna: string;
  readonly urlNotificacion?: string;
}

export interface RespuestaPago {
  readonly id: number;
  readonly status: string;
  readonly statusDetail: string;
  readonly transactionAmount: number;
  readonly paymentMethodId: string;
  readonly externalReference?: string;
}

/** Error de Mercado Pago con su código, para poder distinguir un rechazo. */
export class ErrorMercadoPago extends Error {
  constructor(
    message: string,
    readonly estado: number,
    readonly detalle?: unknown,
  ) {
    super(message);
    this.name = 'ErrorMercadoPago';
  }
}

function tokenAcceso(): string {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new ErrorMercadoPago('La pasarela de pago no esta configurada.', 503);
  }
  return token;
}

/**
 * Cobra un pago.
 *
 * La clave de idempotencia es obligatoria: sin ella, un reintento por un fallo
 * de red cobraría dos veces. Se construye a partir del identificador de la
 * licencia, así que reintentar la misma compra nunca duplica el cargo.
 */
export async function crearPago(
  datos: DatosPago,
  claveIdempotencia: string,
): Promise<RespuestaPago> {
  const respuesta = await fetch(`${API_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenAcceso()}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': claveIdempotencia,
    },
    body: JSON.stringify({
      transaction_amount: datos.montoCop,
      token: datos.token,
      description: datos.descripcion,
      installments: datos.installments,
      payment_method_id: datos.paymentMethodId,
      ...(datos.issuerId ? { issuer_id: datos.issuerId } : {}),
      external_reference: datos.referenciaExterna,
      // Solo se envía si la URL es pública: Mercado Pago rechaza localhost.
      ...(datos.urlNotificacion ? { notification_url: datos.urlNotificacion } : {}),
      payer: {
        email: datos.emailComprador,
        ...(datos.identificacion
          ? {
              identification: {
                type: datos.identificacion.tipo,
                number: datos.identificacion.numero,
              },
            }
          : {}),
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const cuerpo = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;

  if (!respuesta.ok) {
    throw new ErrorMercadoPago(
      typeof cuerpo.message === 'string' ? cuerpo.message : 'No se pudo procesar el pago',
      respuesta.status,
      cuerpo,
    );
  }

  return {
    id: Number(cuerpo.id),
    status: String(cuerpo.status),
    statusDetail: String(cuerpo.status_detail),
    transactionAmount: Number(cuerpo.transaction_amount),
    paymentMethodId: String(cuerpo.payment_method_id),
    externalReference:
      typeof cuerpo.external_reference === 'string' ? cuerpo.external_reference : undefined,
  };
}

/** Consulta un pago. La usa el webhook, que solo recibe el identificador. */
export async function obtenerPago(id: string | number): Promise<RespuestaPago> {
  const respuesta = await fetch(`${API_BASE}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${tokenAcceso()}` },
    signal: AbortSignal.timeout(20_000),
  });

  const cuerpo = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;

  if (!respuesta.ok) {
    throw new ErrorMercadoPago('No se pudo consultar el pago', respuesta.status, cuerpo);
  }

  return {
    id: Number(cuerpo.id),
    status: String(cuerpo.status),
    statusDetail: String(cuerpo.status_detail),
    transactionAmount: Number(cuerpo.transaction_amount),
    paymentMethodId: String(cuerpo.payment_method_id),
    externalReference:
      typeof cuerpo.external_reference === 'string' ? cuerpo.external_reference : undefined,
  };
}

/**
 * Traduce el estado de Mercado Pago al del proyecto.
 *
 * `in_process` y `pending` son estados reales y frecuentes: un pago por PSE o en
 * efectivo tarda horas en confirmarse. Tratarlos como rechazo dejaría al cliente
 * sin licencia después de haber pagado.
 */
export function traducirEstado(
  estado: string,
): 'aprobado' | 'pendiente' | 'rechazado' | 'reembolsado' | 'cancelado' {
  switch (estado) {
    case 'approved':
      return 'aprobado';
    case 'authorized':
    case 'pending':
    case 'in_process':
    case 'in_mediation':
      return 'pendiente';
    case 'rejected':
      return 'rechazado';
    case 'refunded':
    case 'charged_back':
      return 'reembolsado';
    case 'cancelled':
      return 'cancelado';
    default:
      return 'pendiente';
  }
}

/**
 * Mensaje para el comprador según el motivo del rechazo.
 * Mercado Pago devuelve códigos técnicos; el comprador necesita saber qué hacer.
 */
export function explicarRechazo(detalle: string): string {
  switch (detalle) {
    case 'cc_rejected_insufficient_amount':
      return 'La tarjeta no tiene fondos suficientes.';
    case 'cc_rejected_bad_filled_security_code':
      return 'El codigo de seguridad no es correcto.';
    case 'cc_rejected_bad_filled_date':
      return 'La fecha de vencimiento no es correcta.';
    case 'cc_rejected_bad_filled_other':
      return 'Revisa los datos de la tarjeta.';
    case 'cc_rejected_high_risk':
      return 'El banco rechazo la operacion. Prueba con otro medio de pago.';
    case 'cc_rejected_call_for_authorize':
      return 'Tu banco debe autorizar este pago. Llamalos y vuelve a intentarlo.';
    case 'cc_rejected_card_disabled':
      return 'La tarjeta esta inactiva. Llama a tu banco para activarla.';
    case 'cc_rejected_duplicated_payment':
      return 'Ya hiciste un pago igual. Revisa tu correo antes de reintentar.';
    default:
      return 'No se pudo completar el pago. Prueba con otro medio de pago.';
  }
}

/** Indica si una URL es pública, para decidir si enviar `notification_url`. */
export function esUrlPublica(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith('https://') && !url.includes('localhost') && !url.includes('127.0.0.1')
  );
}
