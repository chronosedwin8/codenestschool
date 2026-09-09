/**
 * Quien puede ver los datos de un menor.
 *
 * El token lleva la lista de ninos a cargo como via rapida, pero esa lista
 * envejece: un tutor que acaba de crear el perfil de su hijo sigue teniendo el
 * token anterior, donde ese hijo no aparece. Por eso toda decision se confirma
 * contra la base de datos antes de negar el acceso.
 *
 * El orden importa: primero el camino barato (el token), y solo si no basta se
 * consulta. Asi el caso habitual no paga una consulta extra y el caso recien
 * creado tampoco falla.
 */
import type { PrismaClient } from '@prisma/client';

import type { TokenUsuario } from '../plugins/auth.js';

export interface ResultadoAcceso {
  readonly permitido: boolean;
  /** true si es el propio nino consultando sus datos (no se audita). */
  readonly esElMismo: boolean;
}

export async function comprobarAccesoANino(
  prisma: PrismaClient,
  actor: TokenUsuario,
  ninoId: number,
): Promise<ResultadoAcceso> {
  // Un nino siempre puede ver lo suyo.
  if (actor.rol === 'nino') {
    return { permitido: actor.id === ninoId, esElMismo: actor.id === ninoId };
  }

  // Administrador de la plataforma.
  if (actor.rol === 'admin') {
    return { permitido: true, esElMismo: false };
  }

  // Via rapida: el token ya lo incluye.
  if (actor.ninos.includes(ninoId)) {
    return { permitido: true, esElMismo: false };
  }

  // El token puede ser anterior al alta del nino: se confirma en la base.
  const vinculo = await prisma.guardianLink.findUnique({
    where: { tutorId_ninoId: { tutorId: actor.id, ninoId } },
    select: { id: true },
  });
  if (vinculo) return { permitido: true, esElMismo: false };

  // Un administrador de escuela ve a los estudiantes de su institucion.
  if (actor.rol === 'admin_escuela' && actor.institucionId) {
    const nino = await prisma.user.findFirst({
      where: { id: ninoId, institucionId: actor.institucionId },
      select: { id: true },
    });
    if (nino) return { permitido: true, esElMismo: false };
  }

  // Un docente ve a los estudiantes inscritos en sus aulas.
  if (actor.rol === 'docente') {
    const inscripcion = await prisma.enrollment.findFirst({
      where: { ninoId, aula: { docenteId: actor.id } },
      select: { id: true },
    });
    if (inscripcion) return { permitido: true, esElMismo: false };
  }

  return { permitido: false, esElMismo: false };
}

/** Deja constancia de un acceso de un adulto a los datos de un menor. */
export async function auditarAcceso(
  prisma: PrismaClient,
  datos: { actorId: number; ninoId: number; accion: string; recurso: string; ip?: string },
): Promise<void> {
  await prisma.accessAudit.create({
    data: {
      actorId: datos.actorId,
      ninoId: datos.ninoId,
      accion: datos.accion.slice(0, 60),
      recurso: datos.recurso.slice(0, 160),
      ip: datos.ip,
    },
  });
}
