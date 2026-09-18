/**
 * Cliente de Mercado Pago (Checkout Pro).
 *
 * El comprador paga en la pagina de Mercado Pago. Nosotros creamos una
 * *preferencia* con el monto que decide el servidor, y Mercado Pago nos avisa
 * cuando hay un pago. Se eligio Checkout Pro frente al formulario propio porque
 * resuelve con una sola integracion tarjetas, PSE y Efecty, las cuotas y 3-D
 * Secure, y no obliga a abrir el CSP a los dominios de Mercado Pago. Ver
 * `docs/PLAN-PAGOS.md`.
 *
 * El token de acceso es secreto y solo existe en el servidor.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const API_BASE = 'https://api.mercadopago.com';

/** Error de Mercado Pago con su codigo HTTP, para distinguir un rechazo de una caida. */
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

async function llamar(ruta: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokenAcceso()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(25_000),
  });

  const cuerpo = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!respuesta.ok) {
    throw new ErrorMercadoPago(
      typeof cuerpo.message === 'string' ? cuerpo.message : `Mercado Pago respondio ${respuesta.status}`,
      respuesta.status,
      cuerpo,
    );
  }
  return cuerpo;
}

// ───────────────────────────── Preferencias ─────────────────────────────

export interface DatosPreferencia {
  /** Identificador propio del producto: "plan-escuela", "COT-000012"... */
  readonly idProducto: string;
  readonly titulo: string;
  readonly descripcion: string;
  /** Lo decide el servidor, siempre. */
  readonly montoCop: number;
  /**
   * Referencia propia: "lic-123" o "cot-45". Es lo que el webhook usa para
   * saber que se esta pagando, y lo que permite conciliar un pago cuyo aviso
   * nunca llego, buscandolo en Mercado Pago por esta referencia.
   */
  readonly referenciaExterna: string;
  readonly comprador: {
    readonly nombre: string;
    readonly email?: string;
    readonly tipoDocumento?: string;
    readonly documento?: string;
    readonly telefono?: string;
  };
  /** Base publica del sitio: de aqui salen el aviso y las URL de regreso. */
  readonly urlBase: string;
  /** Adonde vuelve el comprador. Se le anade `?pago=exito|pendiente|fallo`. */
  readonly rutaRegreso: string;
  /** La preferencia deja de aceptar pagos en esta fecha. */
  readonly expiraEn?: Date;
}

export interface Preferencia {
  readonly id: string;
  /** La pagina de pago de Mercado Pago. */
  readonly urlPago: string;
}

/** Indica si una URL es publica: Mercado Pago no puede avisar a localhost. */
export function esUrlPublica(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith('https://') && !url.includes('localhost') && !url.includes('127.0.0.1');
}

/** Separa "Ana Maria Perez Gomez" en nombre y apellidos, como pide Mercado Pago. */
function partirNombre(completo: string): { nombre: string; apellido: string } {
  const partes = completo.trim().split(/\s+/);
  if (partes.length <= 1) return { nombre: completo.trim(), apellido: '' };
  const mitad = Math.ceil(partes.length / 2);
  return { nombre: partes.slice(0, mitad).join(' '), apellido: partes.slice(mitad).join(' ') };
}

export async function crearPreferencia(datos: DatosPreferencia): Promise<Preferencia> {
  const publica = esUrlPublica(datos.urlBase);
  const regreso = (estado: string) => {
    const separador = datos.rutaRegreso.includes('?') ? '&' : '?';
    return `${datos.urlBase}${datos.rutaRegreso}${separador}pago=${estado}`;
  };
  const { nombre, apellido } = partirNombre(datos.comprador.nombre);

  const cuerpo = await llamar('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          id: datos.idProducto,
          title: datos.titulo,
          description: datos.descripcion,
          // "learnings" es la categoria de educacion. Declararla mejora la tasa
          // de aprobacion: el antifraude de Mercado Pago la tiene en cuenta.
          category_id: 'learnings',
          quantity: 1,
          currency_id: 'COP',
          unit_price: datos.montoCop,
        },
      ],
      payer: {
        name: nombre,
        ...(apellido ? { surname: apellido } : {}),
        ...(datos.comprador.email ? { email: datos.comprador.email } : {}),
        ...(datos.comprador.tipoDocumento && datos.comprador.documento
          ? {
              identification: {
                type: datos.comprador.tipoDocumento,
                number: datos.comprador.documento,
              },
            }
          : {}),
        ...(datos.comprador.telefono ? { phone: { number: datos.comprador.telefono } } : {}),
      },
      external_reference: datos.referenciaExterna,
      back_urls: {
        success: regreso('exito'),
        pending: regreso('pendiente'),
        failure: regreso('fallo'),
      },
      // `auto_return` exige URL de regreso validas para Mercado Pago; con
      // localhost la preferencia se rechaza, asi que solo va en produccion.
      ...(publica ? { auto_return: 'approved' } : {}),
      // `source_news=webhooks` pide avisos en el formato nuevo (con firma) y
      // evita los duplicados en formato IPN antiguo.
      ...(publica
        ? { notification_url: `${datos.urlBase}/api/pagos/webhook?source_news=webhooks` }
        : {}),
      // Lo que aparece en el extracto de la tarjeta. Sin esto sale el nombre de
      // la cuenta de Mercado Pago, y un cargo que no se reconoce acaba en
      // contracargo.
      statement_descriptor: 'CODENEST',
      ...(datos.expiraEn
        ? { expires: true, expiration_date_to: datos.expiraEn.toISOString() }
        : {}),
    }),
  });

  const id = typeof cuerpo.id === 'string' ? cuerpo.id : '';
  const urlPago = typeof cuerpo.init_point === 'string' ? cuerpo.init_point : '';
  if (!id || !urlPago) {
    throw new ErrorMercadoPago('Mercado Pago no devolvio la pagina de pago', 502, cuerpo);
  }
  return { id, urlPago };
}

/** El identificador de preferencia que va en la URL de pago (`?pref_id=`). */
export function preferenciaDeUrl(urlPago: string | null | undefined): string | null {
  if (!urlPago) return null;
  try {
    return new URL(urlPago).searchParams.get('pref_id');
  } catch {
    return null;
  }
}

/**
 * Cierra una pagina de pago ya creada.
 *
 * Al anular una cotizacion no basta con olvidar su enlace: el cliente puede
 * tenerlo en el correo, y Mercado Pago lo seguiria cobrando hasta que caducara.
 */
export async function expirarPreferencia(id: string): Promise<void> {
  await llamar(`/checkout/preferences/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ expires: true, expiration_date_to: new Date().toISOString() }),
  });
}

// ───────────────────────────────── Pagos ─────────────────────────────────

export interface PagoMercadoPago {
  readonly id: number;
  readonly status: string;
  readonly statusDetail: string;
  readonly transactionAmount: number;
  readonly currencyId: string;
  readonly paymentMethodId: string;
  readonly paymentTypeId: string;
  readonly installments: number | null;
  readonly externalReference: string | null;
  readonly dateApproved: string | null;
  readonly payerEmail: string | null;
}

function leerPago(cuerpo: Record<string, unknown>): PagoMercadoPago {
  const payer = (cuerpo.payer ?? {}) as Record<string, unknown>;
  return {
    id: Number(cuerpo.id),
    status: String(cuerpo.status ?? ''),
    statusDetail: String(cuerpo.status_detail ?? ''),
    transactionAmount: Number(cuerpo.transaction_amount ?? 0),
    currencyId: String(cuerpo.currency_id ?? 'COP'),
    paymentMethodId: String(cuerpo.payment_method_id ?? ''),
    paymentTypeId: String(cuerpo.payment_type_id ?? ''),
    installments: typeof cuerpo.installments === 'number' ? cuerpo.installments : null,
    externalReference:
      typeof cuerpo.external_reference === 'string' && cuerpo.external_reference !== ''
        ? cuerpo.external_reference
        : null,
    dateApproved: typeof cuerpo.date_approved === 'string' ? cuerpo.date_approved : null,
    payerEmail: typeof payer.email === 'string' ? payer.email : null,
  };
}

/**
 * Consulta un pago.
 *
 * Es la unica fuente de verdad sobre un cobro. El aviso del webhook solo trae
 * un identificador; el estado se pide siempre aqui, con nuestro token. Por eso un
 * aviso falsificado no puede activar nada: como mucho, provoca una consulta.
 */
export async function obtenerPago(id: string | number): Promise<PagoMercadoPago> {
  return leerPago(await llamar(`/v1/payments/${encodeURIComponent(String(id))}`));
}

/**
 * Busca los pagos de una referencia propia.
 *
 * Sirve para conciliar cuando el aviso no llega: el comprador pago, cerro la
 * pestana antes de volver y el webhook fallo. Con esto, el portal o el panel
 * pueden preguntar "¿hay algun pago para lic-123?" sin conocer su identificador.
 */
export async function buscarPagos(referenciaExterna: string): Promise<PagoMercadoPago[]> {
  const parametros = new URLSearchParams({
    external_reference: referenciaExterna,
    sort: 'date_created',
    criteria: 'desc',
    limit: '20',
  });
  const cuerpo = await llamar(`/v1/payments/search?${parametros.toString()}`);
  const resultados = Array.isArray(cuerpo.results) ? cuerpo.results : [];
  return resultados.map((r) => leerPago(r as Record<string, unknown>));
}

// ────────────────────────────── Webhook ──────────────────────────────

/**
 * Comprueba la firma de un aviso de Mercado Pago.
 *
 * Mercado Pago firma con HMAC-SHA256 una plantilla hecha con el identificador
 * del recurso, el `x-request-id` y la marca de tiempo, usando la clave secreta
 * que se genera al registrar el webhook. La cabecera llega como
 * `x-signature: ts=1704908010,v1=618c85...`.
 *
 * Los elementos que no vengan en el aviso se omiten de la plantilla, y el
 * identificador va en minusculas si es alfanumerico: son las dos reglas de la
 * documentacion que, si se saltan, hacen que ninguna firma valide.
 */
export function firmaValida(entrada: {
  readonly cabeceraFirma: string | undefined;
  readonly idSolicitud: string | undefined;
  readonly idRecurso: string | undefined;
  readonly secreto: string;
}): boolean {
  if (!entrada.cabeceraFirma) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const parte of entrada.cabeceraFirma.split(',')) {
    const [clave, valor] = parte.split('=').map((x) => x?.trim());
    if (clave === 'ts') ts = valor;
    if (clave === 'v1') v1 = valor;
  }
  if (!ts || !v1) return false;

  const id = entrada.idRecurso
    ? /^[a-z0-9]+$/i.test(entrada.idRecurso)
      ? entrada.idRecurso.toLowerCase()
      : entrada.idRecurso
    : undefined;

  let plantilla = '';
  if (id) plantilla += `id:${id};`;
  if (entrada.idSolicitud) plantilla += `request-id:${entrada.idSolicitud};`;
  plantilla += `ts:${ts};`;

  const esperada = createHmac('sha256', entrada.secreto).update(plantilla).digest('hex');
  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─────────────────────────────── Estados ───────────────────────────────

/**
 * Traduce el estado de Mercado Pago al del proyecto.
 *
 * `in_process` y `pending` son estados reales y frecuentes: un pago por PSE o en
 * efectivo tarda horas en confirmarse. Tratarlos como rechazo dejaria al cliente
 * sin licencia despues de haber pagado.
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
 * Explica un rechazo al comprador.
 * Mercado Pago devuelve codigos tecnicos; el comprador necesita saber que hacer.
 */
export function explicarRechazo(detalle: string | null | undefined): string {
  switch (detalle) {
    case 'cc_rejected_insufficient_amount':
      return 'La tarjeta no tiene fondos o cupo suficiente.';
    case 'cc_rejected_bad_filled_security_code':
      return 'El código de seguridad no es correcto.';
    case 'cc_rejected_bad_filled_date':
      return 'La fecha de vencimiento no es correcta.';
    case 'cc_rejected_bad_filled_other':
      return 'Revisa los datos de la tarjeta.';
    case 'cc_rejected_high_risk':
      return 'El banco rechazó la operación. Prueba con otro medio de pago.';
    case 'cc_rejected_call_for_authorize':
      return 'Tu banco debe autorizar este pago. Llámalos y vuelve a intentarlo.';
    case 'cc_rejected_card_disabled':
      return 'La tarjeta está inactiva. Llama a tu banco para activarla.';
    case 'cc_rejected_duplicated_payment':
      return 'Ya hiciste un pago igual. Revisa tu correo antes de reintentar.';
    case 'cc_rejected_max_attempts':
      return 'Superaste el número de intentos. Prueba con otra tarjeta.';
    default:
      return 'No se pudo completar el pago. Prueba con otro medio de pago.';
  }
}
