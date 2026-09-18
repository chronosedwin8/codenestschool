/**
 * La forma de los datos que viajan dentro de una factura o una cotizacion.
 *
 * Se guardan como FOTO (JSONB) en el documento, no como referencia: si manana
 * cambia la direccion de la empresa o el NIT de un cliente, la factura de ayer
 * tiene que seguir diciendo lo que decia cuando se emitio.
 */

export interface DatosEmisor {
  readonly razonSocial: string;
  readonly nit: string;
  readonly direccion: string;
  readonly ciudad: string;
  readonly telefono?: string;
  readonly email: string;
  /** "Responsable de IVA", "No responsable de IVA"... Lo dice el contador. */
  readonly regimen?: string;
  readonly sitioWeb?: string;
  /** Texto al pie: cuenta para transferencias, resolucion, etc. */
  readonly notaPie?: string;
}

export interface DatosCliente {
  readonly nombre: string;
  readonly tipoDocumento: string;
  readonly documento: string;
  readonly email?: string;
  readonly direccion?: string;
  readonly ciudad?: string;
  readonly telefono?: string;
  /** Persona de contacto, para cotizaciones a colegios. */
  readonly contacto?: string;
}

/**
 * Estado que se muestra de una cotizacion.
 *
 * "Vencida" no se guarda: se deduce de la fecha. Guardarla exigiria una tarea
 * programada que la marcara cada noche, y si esa tarea fallara una cotizacion
 * caducada se seguiria pudiendo pagar.
 */
export function estadoEfectivoCotizacion(
  estado: string,
  validaHasta: Date | string,
  hoy: Date = new Date(),
): string {
  if (estado !== 'borrador' && estado !== 'enviada') return estado;
  const limite = new Date(validaHasta);
  // Valida HASTA ese dia incluido: se compara con el final del dia.
  limite.setUTCHours(23, 59, 59, 999);
  return hoy.getTime() > limite.getTime() ? 'vencida' : estado;
}

/** Una cotizacion solo se puede pagar si esta viva: ni pagada, ni anulada, ni vencida. */
export function cotizacionPagable(estado: string, validaHasta: Date | string, hoy?: Date): boolean {
  const efectivo = estadoEfectivoCotizacion(estado, validaHasta, hoy);
  return efectivo === 'borrador' || efectivo === 'enviada' || efectivo === 'aceptada';
}
