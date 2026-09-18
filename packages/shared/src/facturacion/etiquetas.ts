/**
 * Nombres legibles para lo que Mercado Pago y la base guardan como codigos.
 *
 * El portal lo lee un padre de familia o la tesoreria de un colegio: "debvisa"
 * o "bank_transfer" no le dicen nada, "Visa Debito" y "PSE" si.
 */

const MEDIOS: Readonly<Record<string, string>> = {
  visa: 'Visa',
  master: 'Mastercard',
  amex: 'American Express',
  diners: 'Diners Club',
  codensa: 'Crédito Fácil Codensa',
  debvisa: 'Visa Débito',
  debmaster: 'Mastercard Débito',
  pse: 'PSE',
  efecty: 'Efecty',
  account_money: 'Dinero en Mercado Pago',
  transferencia: 'Transferencia bancaria',
  consignacion: 'Consignación',
};

const TIPOS_MEDIO: Readonly<Record<string, string>> = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta débito',
  prepaid_card: 'Tarjeta prepago',
  bank_transfer: 'Transferencia (PSE)',
  ticket: 'Pago en efectivo',
  account_money: 'Dinero en Mercado Pago',
};

/** "visa" -> "Visa"; si no se conoce el medio, se prueba con el tipo. */
export function etiquetaMedio(metodo: string | null | undefined, tipoMedio?: string | null): string {
  if (metodo && MEDIOS[metodo]) return MEDIOS[metodo];
  if (tipoMedio && TIPOS_MEDIO[tipoMedio]) return TIPOS_MEDIO[tipoMedio];
  return metodo ?? 'Sin definir';
}

export const ETIQUETA_ESTADO_PAGO: Readonly<Record<string, string>> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  reembolsado: 'Reembolsado',
  cancelado: 'Cancelado',
};

export const ETIQUETA_ESTADO_LICENCIA: Readonly<Record<string, string>> = {
  pendiente: 'Pendiente de pago',
  activa: 'Activa',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

export const ETIQUETA_ESTADO_COTIZACION: Readonly<Record<string, string>> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  pagada: 'Pagada',
  anulada: 'Anulada',
  vencida: 'Vencida',
};

export const ETIQUETA_ESTADO_FACTURA: Readonly<Record<string, string>> = {
  emitida: 'Emitida',
  anulada: 'Anulada',
};

/**
 * Tipos de documento que acepta Mercado Pago en Colombia, tal cual los devuelve
 * `/v1/identification_types` (consultado el 2026-09-18). No hay pasaporte: un
 * tipo que Mercado Pago no conoce hace fallar el cobro, asi que no se ofrece.
 */
export const TIPOS_DOCUMENTO = [
  { clave: 'CC', nombre: 'Cédula de ciudadanía' },
  { clave: 'NIT', nombre: 'NIT' },
  { clave: 'CE', nombre: 'Cédula de extranjería' },
  { clave: 'Otro', nombre: 'Otro' },
] as const;

/** Largo que exige Mercado Pago para el numero de documento. */
export const DOCUMENTO_MIN = 5;
export const DOCUMENTO_MAX = 20;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]['clave'];
