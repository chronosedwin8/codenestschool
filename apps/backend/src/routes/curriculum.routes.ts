/**
 * Currículo: mundos y actividades.
 *
 * El desbloqueo es progresivo. Un mundo se abre cuando el anterior de su mismo
 * grupo de edad esta completo, y el primer mundo de cada grupo esta siempre
 * abierto para que un nino de diez anos no tenga que pasar por los mundos de
 * cuatro anos antes de empezar.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ACTIVIDADES_POR_MUNDO, mundoDe } from '@codenest/shared';

const paramsMundo = z.object({ numero: z.coerce.number().int().min(1).max(30) });
const paramsActividad = z.object({ id: z.coerce.number().int().positive() });

export const curriculumRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Los 30 mundos con el progreso del nino que consulta. */
  fastify.get('/mundos', { preHandler: fastify.autenticar }, async (request, reply) => {
    const usuarioId = request.user.id;

    const [mundos, progreso] = await Promise.all([
      fastify.prisma.world.findMany({
        where: { activo: true },
        orderBy: { numero: 'asc' },
        include: {
          audioIntro: { select: { clave: true, rutaArchivo: true, estado: true } },
          _count: { select: { actividades: { where: { activo: true } } } },
        },
      }),
      fastify.prisma.userActivityProgress.findMany({
        where: { usuarioId, completada: true },
        select: { mejorEstrellas: true, actividad: { select: { mundoId: true } } },
      }),
    ]);

    // Progreso agregado por mundo.
    const porMundo = new Map<number, { completadas: number; estrellas: number }>();
    for (const p of progreso) {
      const actual = porMundo.get(p.actividad.mundoId) ?? { completadas: 0, estrellas: 0 };
      actual.completadas += 1;
      actual.estrellas += p.mejorEstrellas;
      porMundo.set(p.actividad.mundoId, actual);
    }

    const esAdulto = request.user.rol !== 'nino';
    let ultimoCompletadoPorGrupo = new Map<string, number>();

    for (const mundo of mundos) {
      const avance = porMundo.get(mundo.id);
      const total = mundo._count.actividades;
      if (total > 0 && avance?.completadas === total) {
        ultimoCompletadoPorGrupo.set(mundo.grupoEdad, mundo.numero);
      }
    }

    const resultado = mundos.map((mundo) => {
      const avance = porMundo.get(mundo.id) ?? { completadas: 0, estrellas: 0 };
      const total = mundo._count.actividades;

      // Primer mundo de cada grupo abierto; el resto exige el anterior.
      const primeroDelGrupo = mundos.find((m) => m.grupoEdad === mundo.grupoEdad)?.numero;
      const ultimoCompletado = ultimoCompletadoPorGrupo.get(mundo.grupoEdad) ?? 0;
      const desbloqueado =
        esAdulto || mundo.numero === primeroDelGrupo || mundo.numero <= ultimoCompletado + 1;

      return {
        numero: mundo.numero,
        slug: mundo.slug,
        nombre: mundo.nombre,
        grupoEdad: mundo.grupoEdad,
        concepto: mundo.concepto,
        descripcion: mundo.descripcion,
        bioma: mundo.bioma,
        editor: mundo.editor,
        lenguajes: mundo.lenguajes,
        icono: mundo.icono,
        colorPrimario: mundo.colorPrimario,
        colorSecundario: mundo.colorSecundario,
        audioIntro: mundo.audioIntro?.rutaArchivo ?? null,
        totalActividades: total,
        actividadesCompletadas: avance.completadas,
        estrellas: avance.estrellas,
        estrellasMaximas: total * 3,
        desbloqueado,
      };
    });

    return reply.send({ mundos: resultado });
  });

  /** Actividades de un mundo, con el progreso del nino. */
  fastify.get('/mundos/:numero/actividades', { preHandler: fastify.autenticar }, async (request, reply) => {
    const params = paramsMundo.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Numero de mundo invalido' });

    const mundo = await fastify.prisma.world.findUnique({
      where: { numero: params.data.numero },
      include: {
        actividades: {
          where: { activo: true },
          orderBy: { numeroEnMundo: 'asc' },
          select: {
            id: true,
            numeroGlobal: true,
            numeroEnMundo: true,
            slug: true,
            nombre: true,
            tipo: true,
            dificultad: true,
          },
        },
      },
    });

    if (!mundo) return reply.code(404).send({ error: 'Ese mundo no existe' });

    const progreso = await fastify.prisma.userActivityProgress.findMany({
      where: {
        usuarioId: request.user.id,
        actividad: { mundoId: mundo.id },
      },
      select: { actividadId: true, mejorEstrellas: true, completada: true },
    });

    const porActividad = new Map(progreso.map((p) => [p.actividadId, p]));

    return reply.send({
      mundo: {
        numero: mundo.numero,
        nombre: mundo.nombre,
        grupoEdad: mundo.grupoEdad,
        editor: mundo.editor,
        bioma: mundo.bioma,
        totalPrevisto: ACTIVIDADES_POR_MUNDO,
      },
      actividades: mundo.actividades.map((act, indice) => {
        const avance = porActividad.get(act.id);
        const anterior = indice === 0 ? null : mundo.actividades[indice - 1];
        const anteriorCompletada = anterior
          ? (porActividad.get(anterior.id)?.completada ?? false)
          : true;

        return {
          ...act,
          estrellas: avance?.mejorEstrellas ?? 0,
          completada: avance?.completada ?? false,
          desbloqueada: request.user.rol !== 'nino' || anteriorCompletada,
        };
      }),
    });
  });

  /** Configuracion completa de una actividad, lista para jugar. */
  fastify.get('/actividades/:id', { preHandler: fastify.autenticar }, async (request, reply) => {
    const params = paramsActividad.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Identificador invalido' });

    const actividad = await fastify.prisma.activity.findUnique({
      where: { id: params.data.id },
      include: {
        mundo: { select: { numero: true, nombre: true, grupoEdad: true, editor: true, bioma: true } },
        audioInstruccion: { select: { clave: true, rutaArchivo: true, estado: true } },
        audioExito: { select: { clave: true, rutaArchivo: true, estado: true } },
        pistas: {
          orderBy: { orden: 'asc' },
          select: {
            orden: true,
            texto: true,
            costoMonedas: true,
            audio: { select: { rutaArchivo: true } },
          },
        },
      },
    });

    if (!actividad?.activo) return reply.code(404).send({ error: 'Esa actividad no existe' });

    // La solucion de referencia nunca viaja al cliente.
    return reply.send({
      id: actividad.id,
      numeroGlobal: actividad.numeroGlobal,
      numeroEnMundo: actividad.numeroEnMundo,
      nombre: actividad.nombre,
      tipo: actividad.tipo,
      dificultad: actividad.dificultad,
      config: actividad.config,
      instruccionTexto: actividad.instruccionTexto,
      exitoTexto: actividad.exitoTexto,
      mundo: actividad.mundo,
      audio: {
        instruccion: actividad.audioInstruccion?.rutaArchivo ?? null,
        exito: actividad.audioExito?.rutaArchivo ?? null,
      },
      pistas: actividad.pistas.map((p) => ({
        orden: p.orden,
        texto: p.texto,
        costoMonedas: p.costoMonedas,
        audio: p.audio?.rutaArchivo ?? null,
      })),
    });
  });

  /** Catalogo estatico de los mundos, sin autenticacion (para la homepage). */
  fastify.get('/catalogo', async (_request, reply) => {
    const mundos = await fastify.prisma.world.findMany({
      where: { activo: true },
      orderBy: { numero: 'asc' },
      select: {
        numero: true,
        slug: true,
        nombre: true,
        grupoEdad: true,
        concepto: true,
        descripcion: true,
        icono: true,
        colorPrimario: true,
      },
    });
    return reply.send({ mundos, actividadesPorMundo: ACTIVIDADES_POR_MUNDO });
  });

  /** Comprobacion de coherencia: util en desarrollo y en las pruebas. */
  fastify.get('/salud-curriculo', async (_request, reply) => {
    const [mundos, actividades] = await Promise.all([
      fastify.prisma.world.count(),
      fastify.prisma.activity.count(),
    ]);
    return reply.send({
      mundos,
      actividades,
      mundosEsperados: 30,
      actividadesEsperadas: 600,
      primerMundo: mundoDe(1).nombre,
      ultimoMundo: mundoDe(30).nombre,
    });
  });
};
