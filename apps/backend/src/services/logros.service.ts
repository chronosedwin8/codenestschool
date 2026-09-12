/**
 * Insignias.
 *
 * Las tablas `logros` y `usuarios_logros` existían desde el primer esquema y no
 * las usaba nadie: no había forma de conceder una. Esto es esa forma.
 *
 * Conceder es idempotente. Importa más de lo que parece: el estudiante puede
 * publicar, despublicar y volver a publicar el mismo juego, y cada publicación
 * pasa por aquí. Si la segunda vez fallara con un error de clave duplicada, el
 * estudiante vería un fallo al publicar por haber ganado ya su insignia.
 */
import type { PrismaClient } from '@prisma/client';

/** Las insignias del constructor de juegos. Se siembran con el resto. */
export const LOGROS_CONSTRUCTOR = [
  {
    clave: 'constructor-de-juegos',
    nombre: 'Constructor de Juegos',
    descripcion: 'Publicaste tu primer juego en Codexia.',
    icono: '🛠️',
    rareza: 'raro',
    condicion: { tipo: 'juegos_publicados', valor: 1 },
  },
  {
    clave: 'constructor-experto',
    nombre: 'Constructor Experto',
    descripcion: 'Publicaste tres juegos. Ya eres un estudio de videojuegos.',
    icono: '🏗️',
    rareza: 'epico',
    condicion: { tipo: 'juegos_publicados', valor: 3 },
  },
  {
    clave: 'juego-popular',
    nombre: 'Juego Popular',
    descripcion: 'Alguien jugo diez veces uno de tus juegos.',
    icono: '🌟',
    rareza: 'epico',
    condicion: { tipo: 'partidas_recibidas', valor: 10 },
  },
] as const;

export interface LogroConcedido {
  readonly clave: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly icono: string;
  readonly rareza: string;
  /** Cierto solo la primera vez: es lo que decide si se celebra en pantalla. */
  readonly esNuevo: boolean;
}

/**
 * Concede una insignia si el estudiante no la tenía.
 *
 * Devuelve null si la insignia no está sembrada, en lugar de lanzar: una
 * insignia que falta en el catálogo es un problema de contenido, y no tiene por
 * qué tumbar la acción que el niño acaba de hacer (publicar su juego).
 */
export async function conceder(
  prisma: PrismaClient,
  usuarioId: number,
  clave: string,
): Promise<LogroConcedido | null> {
  const logro = await prisma.achievement.findUnique({ where: { clave } });
  if (!logro?.activo) return null;

  const yaLoTiene = await prisma.userAchievement.findUnique({
    where: { usuarioId_logroId: { usuarioId, logroId: logro.id } },
    select: { id: true },
  });

  if (!yaLoTiene) {
    await prisma.userAchievement.create({ data: { usuarioId, logroId: logro.id } });
  }

  return {
    clave: logro.clave,
    nombre: logro.nombre,
    descripcion: logro.descripcion,
    icono: logro.icono,
    rareza: logro.rareza,
    esNuevo: !yaLoTiene,
  };
}

/** Las insignias que tiene un estudiante, para su perfil. */
export async function insigniasDe(
  prisma: PrismaClient,
  usuarioId: number,
): Promise<
  {
    clave: string;
    nombre: string;
    descripcion: string | null;
    icono: string;
    rareza: string;
    obtenidoEn: Date;
  }[]
> {
  const filas = await prisma.userAchievement.findMany({
    where: { usuarioId },
    orderBy: { obtenidoEn: 'desc' },
    include: { logro: true },
  });

  return filas.map((f) => ({
    clave: f.logro.clave,
    nombre: f.logro.nombre,
    descripcion: f.logro.descripcion,
    icono: f.logro.icono,
    rareza: f.logro.rareza,
    obtenidoEn: f.obtenidoEn,
  }));
}

/**
 * Revisa las insignias que dependen de cuántos juegos ha publicado.
 *
 * Se llama al publicar. No calcula nada a partir de lo que diga el navegador:
 * cuenta las filas de la base.
 */
export async function revisarInsigniasDeConstructor(
  prisma: PrismaClient,
  usuarioId: number,
): Promise<LogroConcedido[]> {
  const publicados = await prisma.gameProject.count({
    where: { autorId: usuarioId, estado: 'publicado' },
  });

  const concedidas: LogroConcedido[] = [];
  for (const logro of LOGROS_CONSTRUCTOR) {
    if (logro.condicion.tipo !== 'juegos_publicados') continue;
    if (publicados < logro.condicion.valor) continue;

    const dada = await conceder(prisma, usuarioId, logro.clave);
    if (dada) concedidas.push(dada);
  }
  return concedidas;
}
