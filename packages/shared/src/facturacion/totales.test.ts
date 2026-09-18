/**
 * Las cuentas de una factura.
 *
 * Un error aqui no se ve en ninguna pantalla: se ve impreso, firmado y enviado
 * a la tesoreria de un colegio. Por eso cada caso raro tiene su prueba.
 */
import { describe, expect, it } from 'vitest';

import { cotizacionPagable, estadoEfectivoCotizacion } from './documentos.js';
import { etiquetaMedio } from './etiquetas.js';
import { calcularTotales, numeroDocumento } from './totales.js';

describe('calcular totales', () => {
  it('suma lineas, aplica descuento y despues el IVA', () => {
    const t = calcularTotales({
      items: [
        { descripcion: 'Plan Escuela', cantidad: 1, valorUnitarioCop: 12_000_000 },
        { descripcion: 'Capacitacion docente', cantidad: 2, valorUnitarioCop: 500_000 },
      ],
      descuentoCop: 1_000_000,
      ivaPorcentaje: 19,
    });

    expect(t.subtotalCop).toBe(13_000_000);
    expect(t.baseCop).toBe(12_000_000);
    // El IVA va sobre la base con descuento, no sobre el subtotal.
    expect(t.ivaCop).toBe(2_280_000);
    expect(t.totalCop).toBe(14_280_000);
    expect(t.items[1]!.totalCop).toBe(1_000_000);
  });

  it('sin IVA ni descuento, el total es la suma', () => {
    const t = calcularTotales({
      items: [{ descripcion: 'Plan Personal', cantidad: 1, valorUnitarioCop: 180_000 }],
    });
    expect(t.totalCop).toBe(180_000);
    expect(t.ivaCop).toBe(0);
  });

  it('un descuento mayor que el subtotal no da un total negativo', () => {
    const t = calcularTotales({
      items: [{ descripcion: 'x', cantidad: 1, valorUnitarioCop: 100_000 }],
      descuentoCop: 250_000,
    });
    expect(t.descuentoCop).toBe(100_000);
    expect(t.totalCop).toBe(0);
  });

  it('redondea el IVA a pesos enteros', () => {
    // 333 * 19 % = 63,27 -> 63
    const t = calcularTotales({
      items: [{ descripcion: 'x', cantidad: 1, valorUnitarioCop: 333 }],
      ivaPorcentaje: 19,
    });
    expect(t.ivaCop).toBe(63);
    expect(Number.isInteger(t.totalCop)).toBe(true);
  });
});

describe('numeracion', () => {
  it('rellena con ceros a seis cifras', () => {
    expect(numeroDocumento('FAC', 1)).toBe('FAC-000001');
    expect(numeroDocumento('COT', 123_456)).toBe('COT-123456');
  });
});

describe('vigencia de una cotizacion', () => {
  const hoy = new Date('2026-09-18T15:00:00Z');

  it('sigue viva el ultimo dia de validez, todo el dia', () => {
    expect(estadoEfectivoCotizacion('enviada', '2026-09-18', hoy)).toBe('enviada');
  });

  it('al dia siguiente esta vencida y ya no se puede pagar', () => {
    const manana = new Date('2026-09-19T00:30:00Z');
    expect(estadoEfectivoCotizacion('enviada', '2026-09-18', manana)).toBe('vencida');
    expect(cotizacionPagable('enviada', '2026-09-18', manana)).toBe(false);
  });

  it('una pagada no "vence": ya esta pagada', () => {
    expect(estadoEfectivoCotizacion('pagada', '2020-01-01', hoy)).toBe('pagada');
    expect(cotizacionPagable('pagada', '2030-01-01', hoy)).toBe(false);
  });

  it('una anulada no se puede pagar aunque siga en fecha', () => {
    expect(cotizacionPagable('anulada', '2030-01-01', hoy)).toBe(false);
  });
});

describe('etiquetas', () => {
  it('traduce los codigos de Mercado Pago a lo que entiende un padre', () => {
    expect(etiquetaMedio('debvisa')).toBe('Visa Débito');
    expect(etiquetaMedio('pse', 'bank_transfer')).toBe('PSE');
  });

  it('si el medio es desconocido, usa el tipo', () => {
    expect(etiquetaMedio('naranja', 'credit_card')).toBe('Tarjeta de crédito');
  });
});
