/**
 * Los datos del estudiante, para el estudiante.
 *
 * No es el panel del docente en pequeño. Cambia quien pregunta y por tanto
 * cambia que se cuenta:
 *
 *  - El docente necesita comparar; el niño necesita verse avanzar. Por eso lo
 *    primero son sus propios numeros y el puesto en el grupo va aparte.
 *  - No se devuelve nada de sus companeros salvo cuantos son y en que puesto
 *    queda. Ni nombres, ni quien va delante: eso es dato de otros menores y
 *    ademas convierte la pantalla en otra cosa.
 *  - "Sin terminar" son actividades que EMPEZO y no resolvio. Las que no ha
 *    tocado no son un fallo suyo: son el camino que le queda.
 */
import type { PrismaClient } from '@prisma/client';

export interface EstadisticasEstudiante {
  readonly actividades: {
    readonly completadas: number;
    readonly empezadasSinTerminar: number;
    readonly totales: number;
    readonly porcentajeCompletado: number;
  };
  readonly mundos: {
    readonly completados: number;
    readonly totales: number;
    readonly enCurso: { readonly numero: number; readonly nombre: string; readonly completadas: number; readonly actividades: number } | null;
  };
  readonly estrellas: {
    readonly ganadas: number;
    readonly posiblesDeLoJugado: number;
    readonly perfectas: number;
  };
  readonly monedas: number;
  readonly rachaDias: number;
  readonly tiempo: {
    readonly totalMinutos: number;
    readonly medioPorActividadSegundos: number;
  };
  /** Null si no esta en ningun grupo: entonces no hay con quien compararse. */
  readonly grupo: {
    readonly nombre: string;
    readonly posicion: number;
    readonly companeros: number;
  } | null;
}

export async function estadisticasDeEstudiante(
  prisma: PrismaClient,
  ninoId: number,
): Promise<EstadisticasEstudiante> {
  const [nino, totalActividades, totalMundos, progreso, sesiones, inscripcion] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: ninoId },
      select: { estrellasTotales: true, monedas: true, rachaDias: true },
    }),
    prisma.activity.count({ where: { activo: true } }),
    prisma.world.count({ where: { activo: true } }),
    prisma.userActivityProgress.findMany({
      where: { usuarioId: ninoId },
      select: {
        completada: true,
        mejorEstrellas: true,
        actividad: {
          select: {
            mundo: { select: { numero: true, nombre: true, _count: { select: { actividades: true } } } },
          },
        },
      },
    }),
    prisma.activitySession.aggregate({
      where: { usuarioId: ninoId },
      _sum: { tiempoSegundos: true },
      _count: { _all: true },
    }),
    prisma.enrollment.findFirst({
      where: { ninoId },
      orderBy: { inscritoEn: 'desc' },
      select: { aulaId: true, aula: { select: { nombre: true } } },
    }),
  ]);

  const completadas = progreso.filter((p) => p.completada).length;
  const perfectas = progreso.filter((p) => p.completada && p.mejorEstrellas === 3).length;

  // Por mundo, para saber cuales estan terminados y en cual anda ahora.
  const porMundo = new Map<number, { nombre: string; completadas: number; actividades: number }>();
  for (const p of progreso) {
    const m = p.actividad.mundo;
    const fila = porMundo.get(m.numero) ?? {
      nombre: m.nombre,
      completadas: 0,
      actividades: m._count.actividades,
    };
    if (p.completada) fila.completadas += 1;
    porMundo.set(m.numero, fila);
  }

  const mundosCompletados = [...porMundo.values()].filter(
    (m) => m.actividades > 0 && m.completadas >= m.actividades,
  ).length;

  // El mundo en curso: el mas avanzado que ha tocado y aun no ha terminado.
  const enCurso = [...porMundo.entries()]
    .filter(([, m]) => m.completadas < m.actividades)
    .sort((a, b) => b[0] - a[0])[0];

  const segundos = sesiones._sum.tiempoSegundos ?? 0;

  return {
    actividades: {
      completadas,
      // Las que empezo y no resolvio. Las que no ha tocado no cuentan: no son un
      // fallo suyo, son el camino que le queda.
      empezadasSinTerminar: progreso.length - completadas,
      totales: totalActividades,
      porcentajeCompletado:
        totalActividades > 0 ? Number(((completadas / totalActividades) * 100).toFixed(1)) : 0,
    },
    mundos: {
      completados: mundosCompletados,
      totales: totalMundos,
      enCurso: enCurso
        ? {
            numero: enCurso[0],
            nombre: enCurso[1].nombre,
            completadas: enCurso[1].completadas,
            actividades: enCurso[1].actividades,
          }
        : null,
    },
    estrellas: {
      ganadas: nino.estrellasTotales,
      // Tres por cada actividad que ha completado: es contra lo que tiene
      // sentido medirse, no contra las 1.800 de un curriculo que no ha jugado.
      posiblesDeLoJugado: completadas * 3,
      perfectas,
    },
    monedas: nino.monedas,
    rachaDias: nino.rachaDias,
    tiempo: {
      totalMinutos: Math.round(segundos / 60),
      medioPorActividadSegundos:
        sesiones._count._all > 0 ? Math.round(segundos / sesiones._count._all) : 0,
    },
    grupo: inscripcion ? await puestoEnElGrupo(prisma, ninoId, inscripcion.aulaId, inscripcion.aula.nombre) : null,
  };
}

/**
 * En que puesto va dentro de su grupo.
 *
 * Se ordena por actividades completadas y se desempata por estrellas. No sale de
 * aqui ni un dato de sus companeros: solo cuantos son y que puesto ocupa el, que
 * es lo unico que le concierne.
 */
async function puestoEnElGrupo(
  prisma: PrismaClient,
  ninoId: number,
  aulaId: number,
  nombreAula: string,
): Promise<{ nombre: string; posicion: number; companeros: number }> {
  const companeros = await prisma.enrollment.findMany({
    where: { aulaId },
    select: { nino: { select: { id: true, estrellasTotales: true } } },
  });

  const completadasPorNino = await prisma.userActivityProgress.groupBy({
    by: ['usuarioId'],
    where: { usuarioId: { in: companeros.map((c) => c.nino.id) }, completada: true },
    _count: { _all: true },
  });
  const cuenta = new Map(completadasPorNino.map((c) => [c.usuarioId, c._count._all]));

  const tabla = companeros
    .map((c) => ({
      id: c.nino.id,
      completadas: cuenta.get(c.nino.id) ?? 0,
      estrellas: c.nino.estrellasTotales,
    }))
    .sort((a, b) => b.completadas - a.completadas || b.estrellas - a.estrellas);

  return {
    nombre: nombreAula,
    posicion: tabla.findIndex((t) => t.id === ninoId) + 1,
    companeros: tabla.length,
  };
}
