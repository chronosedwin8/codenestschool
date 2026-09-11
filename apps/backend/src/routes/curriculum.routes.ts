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

import { mundosAbiertos } from '../services/desbloqueo.service.js';

const paramsMundo = z.object({ numero: z.coerce.number().int().min(1).max(30) });
const paramsActividad = z.object({ id: z.coerce.number().int().positive() });

export const curriculumRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Los 30 mundos con el progreso del nino que consulta. */
  fastify.get('/mundos', { preHandler: fastify.autenticar }, async (request, reply) => {
    const usuarioId = request.user.id;

    const [mundos, progreso, usuario] = await Promise.all([
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
      fastify.prisma.user.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { mundosExtra: true },
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

    // La regla de desbloqueo vive en su propio servicio porque la tienda tambien
    // la necesita: el Pase del Nido abre un mundo, y si la regla estuviera solo
    // aqui el mapa y la tienda dirian cosas distintas.
    const abiertos = mundosAbiertos(
      mundos.map((m) => ({
        numero: m.numero,
        grupoEdad: m.grupoEdad,
        completadas: porMundo.get(m.id)?.completadas ?? 0,
        total: m._count.actividades,
      })),
      { esAdulto, mundosExtra: usuario.mundosExtra },
    );

    const resultado = mundos.map((mundo) => {
      const avance = porMundo.get(mundo.id) ?? { completadas: 0, estrellas: 0 };
      const total = mundo._count.actividades;
      const desbloqueado = abiertos.has(mundo.numero);

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

    // Cual viene despues. Va en la misma respuesta a proposito: al resolver, el
    // juego tiene que poder encadenar sin volver al mapa ni esperar otra
    // consulta, que es justo el momento en el que un nino se levanta y se va.
    // El orden es el numero global, que ya recorre los treinta mundos seguidos.
    const siguiente = await fastify.prisma.activity.findFirst({
      where: { numeroGlobal: { gt: actividad.numeroGlobal }, activo: true },
      orderBy: { numeroGlobal: 'asc' },
      select: {
        id: true,
        numeroEnMundo: true,
        nombre: true,
        mundo: { select: { numero: true, nombre: true } },
      },
    });

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
      siguiente: siguiente
        ? {
            id: siguiente.id,
            numeroEnMundo: siguiente.numeroEnMundo,
            nombre: siguiente.nombre,
            mundo: siguiente.mundo,
            cambiaDeMundo: siguiente.mundo.numero !== actividad.mundo.numero,
          }
        : null,
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
