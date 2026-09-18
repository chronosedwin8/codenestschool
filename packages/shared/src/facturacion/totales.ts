/**
 * Cuentas de facturas y cotizaciones.
 *
 * Se calculan aqui, una sola vez, y las usan los dos lados: el panel muestra el
 * total mientras el administrador escribe, y el servidor lo vuelve a calcular al
 * guardar. El servidor nunca acepta un total que venga del navegador; si las
 * cuentas vivieran en dos sitios, el documento guardado y el que se vio en
 * pantalla podrian no coincidir, y eso en una factura no se arregla despues.
 *
 * Todo en pesos enteros: el peso colombiano no usa centavos en la practica, y
 * Mercado Pago cobra montos enteros en COP.
 */

export interface LineaDocumento {
  readonly descripcion: string;
  readonly cantidad: number;
  readonly valorUnitarioCop: number;
}

export interface LineaCalculada extends LineaDocumento {
  readonly totalCop: number;
}

export interface Totales {
  readonly items: readonly LineaCalculada[];
  /** Suma de las lineas, antes del descuento. */
  readonly subtotalCop: number;
  readonly descuentoCop: number;
  /** Lo que queda tras el descuento: sobre esto se calcula el IVA. */
  readonly baseCop: number;
  readonly ivaPorcentaje: number;
  readonly ivaCop: number;
  readonly totalCop: number;
}

/** Minimo de Mercado Pago en Colombia para PSE; por debajo, no se puede cobrar. */
export const PRECIO_MINIMO_COP = 1_600;
/** Tope de PSE en Mercado Pago Colombia. Mas arriba no hay medio que lo cobre. */
export const PRECIO_MAXIMO_COP = 340_000_000;

/** Tarifas de IVA vigentes en Colombia. Otra cifra es casi seguro un error. */
export const TARIFAS_IVA = [0, 5, 19] as const;

export function calcularTotales(entrada: {
  readonly items: readonly LineaDocumento[];
  readonly descuentoCop?: number;
  readonly ivaPorcentaje?: number;
}): Totales {
  const items = entrada.items.map((linea) => ({
    ...linea,
    totalCop: Math.round(linea.cantidad * linea.valorUnitarioCop),
  }));

  const subtotalCop = items.reduce((suma, linea) => suma + linea.totalCop, 0);

  // Un descuento mayor que el subtotal daria un total negativo: se limita.
  const descuentoCop = Math.min(Math.max(0, Math.round(entrada.descuentoCop ?? 0)), subtotalCop);
  const baseCop = subtotalCop - descuentoCop;

  const ivaPorcentaje = entrada.ivaPorcentaje ?? 0;
  const ivaCop = Math.round((baseCop * ivaPorcentaje) / 100);

  return {
    items,
    subtotalCop,
    descuentoCop,
    baseCop,
    ivaPorcentaje,
    ivaCop,
    totalCop: baseCop + ivaCop,
  };
}

/** "FAC" y 123 -> "FAC-000123". Seis cifras: sobra para decadas. */
export function numeroDocumento(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(6, '0')}`;
}
