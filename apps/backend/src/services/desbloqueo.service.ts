/**
 * Que mundos tiene abiertos un nino.
 *
 * Estaba escrito dentro de la ruta del curriculo, y al aparecer el Pase del Nido
 * habria quedado en dos sitios: el mapa diria una cosa y la tienda otra. La
 * regla vive aqui, es pura y se puede probar sin base de datos.
 *
 * La regla: el primer mundo de cada grupo de edad esta siempre abierto (un nino
 * de diez anos no tiene que pasar por los mundos de cuatro), y cada mundo
 * siguiente pide el anterior completo. Un pase comprado abre un mundo concreto
 * sin tocar esa cuenta.
 */
import type { PrismaClient } from '@prisma/client';

export interface MundoParaDesbloqueo {
  readonly numero: number;
  readonly grupoEdad: string;
  readonly completadas: number;
  readonly total: number;
}

export interface OpcionesDesbloqueo {
  /** Los adultos ven el curriculo entero: lo revisan, no lo juegan. */
  readonly esAdulto?: boolean;
  /** Mundos abiertos con un Pase del Nido. */
  readonly mundosExtra?: readonly number[];
}

/** Mundos terminados al cien por cien. Es lo que exige `mundosNecesarios`. */
export function mundosCompletados(
  mundos: readonly MundoParaDesbloqueo[],
): ReadonlySet<number> {
  const hechos = new Set<number>();
  for (const m of mundos) {
    if (m.total > 0 && m.completadas >= m.total) hechos.add(m.numero);
  }
  return hechos;
}

export function mundosAbiertos(
  mundos: readonly MundoParaDesbloqueo[],
  opciones: OpcionesDesbloqueo = {},
): ReadonlySet<number> {
  const extra = new Set(opciones.mundosExtra ?? []);
  const hechos = mundosCompletados(mundos);

  // Ultimo mundo terminado de cada grupo, y primero de cada grupo.
  const ultimoHecho = new Map<string, number>();
  const primero = new Map<string, number>();
  for (const m of [...mundos].sort((a, b) => a.numero - b.numero)) {
    if (!primero.has(m.grupoEdad)) primero.set(m.grupoEdad, m.numero);
    if (hechos.has(m.numero)) ultimoHecho.set(m.grupoEdad, m.numero);
  }

  const abiertos = new Set<number>();
  for (const m of mundos) {
    const siguienteAlUltimo = (ultimoHecho.get(m.grupoEdad) ?? 0) + 1;
    if (
      opciones.esAdulto === true ||
      extra.has(m.numero) ||
      m.numero === primero.get(m.grupoEdad) ||
      m.numero <= siguienteAlUltimo
    ) {
      abiertos.add(m.numero);
    }
  }
  return abiertos;
}

/**
 * El primer mundo cerrado de un grupo: lo que abre un Pase del Nido.
 *
 * Null si no queda ninguno cerrado, y entonces el pase no se puede gastar: mejor
 * que se quede en la mochila que cobrarselo por nada.
 */
export function primerMundoCerrado(
  mundos: readonly MundoParaDesbloqueo[],
  grupoEdad: string,
  opciones: OpcionesDesbloqueo = {},
): number | null {
  const abiertos = mundosAbiertos(mundos, opciones);
  const cerrados = mundos
    .filter((m) => m.grupoEdad === grupoEdad && !abiertos.has(m.numero))
    .map((m) => m.numero)
    .sort((a, b) => a - b);
  return cerrados[0] ?? null;
}

/** Estado de los 30 mundos para un nino, listo para las funciones de arriba. */
export async function estadoDeMundos(
  prisma: PrismaClient,
  usuarioId: number,
): Promise<MundoParaDesbloqueo[]> {
  const [mundos, progreso] = await Promise.all([
    prisma.world.findMany({
      where: { activo: true },
      orderBy: { numero: 'asc' },
      select: {
        id: true,
        numero: true,
        grupoEdad: true,
        _count: { select: { actividades: { where: { activo: true } } } },
      },
    }),
    prisma.userActivityProgress.findMany({
      where: { usuarioId, completada: true },
      select: { actividad: { select: { mundoId: true } } },
    }),
  ]);

  const completadasPorMundo = new Map<number, number>();
  for (const p of progreso) {
    const clave = p.actividad.mundoId;
    completadasPorMundo.set(clave, (completadasPorMundo.get(clave) ?? 0) + 1);
  }

  return mundos.map((m) => ({
    numero: m.numero,
    grupoEdad: m.grupoEdad,
    completadas: completadasPorMundo.get(m.id) ?? 0,
    total: m._count.actividades,
  }));
}
