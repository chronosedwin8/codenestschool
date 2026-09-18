/**
 * Formatos que se repiten en el portal, el panel y los documentos.
 */
export function cop(monto: number | null | undefined): string {
  return `$${(monto ?? 0).toLocaleString('es-CO')}`;
}

export function fecha(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  // Una fecha sola (AAAA-MM-DD) se lee a mediodia: a medianoche UTC, en
  // Colombia (UTC-5) saldria el dia anterior.
  const valor = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fechaHora(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Tono del chip segun el estado, para que se lea de un vistazo. */
export function tonoEstado(estado: string): 'bien' | 'espera' | 'mal' | 'info' | '' {
  switch (estado) {
    case 'aprobado':
    case 'activa':
    case 'emitida':
    case 'pagada':
      return 'bien';
    case 'pendiente':
    case 'enviada':
    case 'aceptada':
      return 'espera';
    case 'rechazado':
    case 'cancelada':
    case 'cancelado':
    case 'anulada':
    case 'vencida':
    case 'reembolsado':
      return 'mal';
    case 'borrador':
      return 'info';
    default:
      return '';
  }
}
