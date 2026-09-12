/**
 * Zona del docente: grupos, estudiantes, credenciales, tareas y seguimiento.
 *
 * Todo lo de aqui se hace de treinta en treinta. Por eso casi ninguna ruta opera
 * sobre un estudiante suelto: se dan de alta grupos enteros, se reparte el mismo
 * PIN a toda la clase porque se escribe en la pizarra, y se consulta una tabla
 * de quien va por donde en vez de una ficha cada vez.
 *
 * Los permisos no se comprueban aqui a mano: `aulaPermitida` y
 * `estudiantePermitido` son la unica puerta, y responden 404 en vez de 403 para
 * no confirmar la existencia de un aula de otro colegio.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { cargarConfig } from '../lib/env.js';
import { generarCodigoAcceso } from '../services/auth.service.js';
import { LECCIONES } from '@codenest/content';

import { mecanografiaDeAula } from '../services/mecanografia.service.js';
import { proyectosDeAulas } from '../services/proyectos.service.js';
import {
  ErrorDocente,
  IMAGENES_PIN,
  anotarAcceso,
  aulaPermitida,
  avancePorMundo,
  crearEstudiantes,
  estudiantePermitido,
  fichaDeEstudiante,
  importarEstudiantes,
  listaDeAula,
  panoramaDeAula,
  pinAleatorio,
  prepararPin,
  type Actor,
} from '../services/docente.service.js';
import { descifrarPin, hayClaveDePin, pinAImagenes } from '../services/pin-visible.service.js';
import {
  ErrorPhidias,
  filtrarPorSeccion,
  matriculas,
  phidiasConfigurado,
} from '../services/phidias.service.js';

const imagen = z.enum(IMAGENES_PIN);
const pinSchema = z.array(imagen).length(4);

const aulaSchema = z.object({
  nombre: z.string().min(2).max(150),
  grado: z.string().max(40).optional(),
  sedeId: z.number().int().positive().optional(),
});

const estudianteSchema = z.object({
  nombre: z.string().min(2).max(150),
  fechaNacimiento: z.coerce.date(),
  pin: pinSchema.optional(),
});

const loteSchema = z.object({
  estudiantes: z.array(estudianteSchema).min(1).max(60),
  /** Mismo PIN para todos los del lote: lo normal el primer dia de clase. */
  pinComun: pinSchema.optional(),
});

const pinMasivoSchema = z.object({
  /** Sin lista, se aplica a toda el aula. */
  ninoIds: z.array(z.number().int().positive()).optional(),
  /** Sin PIN, se genera uno distinto y al azar para cada estudiante. */
  pin: pinSchema.optional(),
});

const asignacionSchema = z
  .object({
    mundoNumero: z.number().int().min(1).max(30).optional(),
    actividadId: z.number().int().positive().optional(),
    titulo: z.string().max(200).optional(),
    instrucciones: z.string().max(2000).optional(),
    fechaLimite: z.coerce.date().optional(),
  })
  .refine((d) => d.mundoNumero !== undefined || d.actividadId !== undefined, {
    message: 'Indica un mundo o una actividad',
  });

export const docenteRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const config = cargarConfig();
  const soloDocentes = fastify.exigirRol('docente', 'admin_escuela', 'admin');

  const actorDe = (request: {
    user: { id: number; rol: string; institucionId?: number | null };
  }): Actor => ({
    id: request.user.id,
    rol: request.user.rol,
    institucionId: request.user.institucionId ?? null,
  });

  /** Traduce los errores del servicio al codigo que corresponde. */
  const responder = async <T>(
    reply: { code: (n: number) => { send: (c: unknown) => unknown } },
    trabajo: () => Promise<T>,
  ): Promise<unknown> => {
    try {
      return await trabajo();
    } catch (error) {
      if (error instanceof ErrorDocente) {
        return reply.code(error.codigo).send({ error: error.message });
      }
      throw error;
    }
  };

  /**
   * Los juegos que estan haciendo sus estudiantes, publicados o no.
   *
   * Los borradores se muestran a proposito: es su clase, y un proyecto a medias
   * es justo lo que hace falta ver para poder ayudar. El docente no puede
   * editarlos ni publicarlos; el juego es del estudiante.
   */
  fastify.get('/proyectos', { preHandler: soloDocentes }, async (request, reply) => {
    const actor = actorDe(request);

    const aulas = await fastify.prisma.classroom.findMany({
      where:
        actor.rol === 'admin'
          ? {}
          : actor.rol === 'admin_escuela' && actor.institucionId !== null
            ? { OR: [{ docenteId: actor.id }, { institucionId: actor.institucionId }] }
            : { docenteId: actor.id },
      select: { id: true },
    });

    const proyectos = await proyectosDeAulas(
      fastify.prisma,
      aulas.map((a) => a.id),
    );

    return reply.send({
      proyectos,
      resumen: {
        total: proyectos.length,
        publicados: proyectos.filter((p) => p.estado === 'publicado').length,
        constructores: new Set(proyectos.map((p) => p.autor.id)).size,
      },
    });
  });

  /**
   * Como va de mecanografia un grupo.
   *
   * Salen tambien los estudiantes que no han empezado, con ceros: la lista sirve
   * para saber a quien hay que animar, y quien no aparece no se ve.
   */
  fastify.get('/aulas/:aulaId/mecanografia', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);

    return responder(reply, async () => {
      const aula = await aulaPermitida(fastify.prisma, aulaId, actorDe(request));
      const filas = await mecanografiaDeAula(fastify.prisma, aula.id);
      // El total va en la respuesta y no escrito a mano en la tabla: las
      // lecciones se anaden, y un "de 24" fijo empieza a mentir el dia siguiente.
      return reply.send({
        aula: { id: aula.id, nombre: aula.nombre },
        filas,
        leccionesTotales: LECCIONES.length,
      });
    });
  });

  // ─────────────────────────────── Grupos ───────────────────────────────────

  /** Los grupos del docente, con cuantos estudiantes tiene cada uno. */
  fastify.get('/aulas', { preHandler: soloDocentes }, async (request, reply) => {
    const actor = actorDe(request);
    const aulas = await fastify.prisma.classroom.findMany({
      where:
        actor.rol === 'admin'
          ? {}
          : actor.rol === 'admin_escuela' && actor.institucionId !== null
            ? { OR: [{ docenteId: actor.id }, { institucionId: actor.institucionId }] }
            : { docenteId: actor.id },
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        grado: true,
        codigoAcceso: true,
        activa: true,
        creadoEn: true,
        docente: { select: { id: true, nombre: true } },
        _count: { select: { inscripciones: true, asignaciones: true } },
      },
    });

    return reply.send({
      aulas: aulas.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        grado: a.grado,
        codigoAcceso: a.codigoAcceso,
        activa: a.activa,
        creadoEn: a.creadoEn,
        docente: a.docente,
        estudiantes: a._count.inscripciones,
        tareas: a._count.asignaciones,
      })),
      /** Si es false, el portal avisa de que los PIN no se podran consultar. */
      puedeVerPines: hayClaveDePin(config.PIN_SECRET),
    });
  });

  /** Crea un grupo. El codigo de acceso sirve para que el aula se identifique. */
  fastify.post('/aulas', { preHandler: soloDocentes }, async (request, reply) => {
    const datos = aulaSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    const aula = await fastify.prisma.classroom.create({
      data: {
        nombre: datos.data.nombre,
        grado: datos.data.grado ?? null,
        sedeId: datos.data.sedeId ?? null,
        docenteId: request.user.id,
        institucionId: request.user.institucionId,
        codigoAcceso: generarCodigoAcceso('AULA'),
      },
      select: { id: true, nombre: true, grado: true, codigoAcceso: true, activa: true },
    });

    return reply.code(201).send({ aula });
  });

  /** Renombra un grupo o lo archiva. Archivar no borra a nadie. */
  fastify.put('/aulas/:aulaId', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);
    const datos = aulaSchema.partial().extend({ activa: z.boolean().optional() }).safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    return responder(reply, async () => {
      await aulaPermitida(fastify.prisma, aulaId, actorDe(request));
      const aula = await fastify.prisma.classroom.update({
        where: { id: aulaId },
        data: datos.data,
        select: { id: true, nombre: true, grado: true, codigoAcceso: true, activa: true },
      });
      return reply.send({ aula });
    });
  });

  // ───────────────────────────── Estudiantes ────────────────────────────────

  /** La lista del grupo, con su avance. Sin PIN: eso va por su propia ruta. */
  fastify.get('/aulas/:aulaId/estudiantes', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);

    return responder(reply, async () => {
      const aula = await aulaPermitida(fastify.prisma, aulaId, actorDe(request));
      const estudiantes = await listaDeAula(fastify.prisma, aulaId);
      return reply.send({ aula: { id: aula.id, nombre: aula.nombre }, estudiantes });
    });
  });

  /**
   * Alta de estudiantes, de uno o de treinta.
   *
   * Es la misma ruta a proposito: el alta individual es un lote de uno, y tener
   * dos caminos distintos para lo mismo es como acaban divergiendo.
   *
   * Devuelve los PIN en claro UNA vez, que es cuando el docente los imprime.
   */
  fastify.post('/aulas/:aulaId/estudiantes', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);
    const datos = loteSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    return responder(reply, async () => {
      const aula = await aulaPermitida(fastify.prisma, aulaId, actorDe(request));

      const conPin = datos.data.estudiantes.map((e) => ({
        ...e,
        pin: e.pin ?? datos.data.pinComun,
      }));

      const creados = await crearEstudiantes(fastify.prisma, {
        aulaId,
        docenteId: aula.docenteId,
        institucionId: aula.institucionId,
        estudiantes: conPin,
        secretoPin: config.PIN_SECRET,
      });

      await anotarAcceso(fastify.prisma, {
        actorId: request.user.id,
        accion: 'alta_estudiantes',
        recurso: `aula:${aulaId} (${creados.length})`,
        ip: request.ip,
      });

      return reply.code(201).send({ estudiantes: creados });
    });
  });

  /** Cambia nombre o usuario de un estudiante. */
  fastify.put('/estudiantes/:ninoId', { preHandler: soloDocentes }, async (request, reply) => {
    const ninoId = Number((request.params as { ninoId: string }).ninoId);
    const datos = z
      .object({
        nombre: z.string().min(2).max(150).optional(),
        usuario: z
          .string()
          .min(3)
          .max(60)
          .regex(/^[a-z0-9._-]+$/, 'Solo minusculas, numeros, punto, guion y guion bajo')
          .optional(),
        activo: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    return responder(reply, async () => {
      await estudiantePermitido(fastify.prisma, ninoId, actorDe(request));

      if (datos.data.usuario) {
        const ocupado = await fastify.prisma.user.findUnique({
          where: { usuario: datos.data.usuario },
          select: { id: true },
        });
        if (ocupado && ocupado.id !== ninoId) {
          return reply.code(409).send({ error: 'Ese usuario ya esta cogido' });
        }
      }

      const nino = await fastify.prisma.user.update({
        where: { id: ninoId },
        data: datos.data,
        select: { id: true, nombre: true, usuario: true, activo: true },
      });
      return reply.send({ estudiante: nino });
    });
  });

  /** Mueve un estudiante de grupo, o lo inscribe en uno mas. */
  fastify.post('/aulas/:aulaId/inscribir', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);
    const datos = z
      .object({
        ninoIds: z.array(z.number().int().positive()).min(1).max(60),
        /** Si se indica, se saca del aula de origen: es un traslado. */
        desdeAulaId: z.number().int().positive().optional(),
      })
      .safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    return responder(reply, async () => {
      const actor = actorDe(request);
      await aulaPermitida(fastify.prisma, aulaId, actor);
      if (datos.data.desdeAulaId) await aulaPermitida(fastify.prisma, datos.data.desdeAulaId, actor);
      for (const id of datos.data.ninoIds) await estudiantePermitido(fastify.prisma, id, actor);

      const movidos = await fastify.prisma.$transaction(async (tx) => {
        if (datos.data.desdeAulaId) {
          await tx.enrollment.deleteMany({
            where: { aulaId: datos.data.desdeAulaId, ninoId: { in: datos.data.ninoIds } },
          });
        }
        const resultado = await tx.enrollment.createMany({
          data: datos.data.ninoIds.map((ninoId) => ({ ninoId, aulaId })),
          skipDuplicates: true,
        });
        return resultado.count;
      });

      return reply.send({ inscritos: movidos });
    });
  });

  /** Saca a un estudiante del grupo. No borra la cuenta ni su progreso. */
  fastify.delete(
    '/aulas/:aulaId/estudiantes/:ninoId',
    { preHandler: soloDocentes },
    async (request, reply) => {
      const { aulaId, ninoId } = request.params as { aulaId: string; ninoId: string };

      return responder(reply, async () => {
        await aulaPermitida(fastify.prisma, Number(aulaId), actorDe(request));
        await fastify.prisma.enrollment.deleteMany({
          where: { aulaId: Number(aulaId), ninoId: Number(ninoId) },
        });
        return reply.send({ retirado: true });
      });
    },
  );

  // ────────────────────────────── Credenciales ──────────────────────────────

  /**
   * Las credenciales del grupo, PIN incluido.
   *
   * Es la lista que el docente imprime y pega en la pared. Solo funciona si hay
   * clave de cifrado configurada; si no, cada PIN sale como no disponible y hay
   * que asignar uno nuevo para conocerlo.
   *
   * Cada consulta queda anotada: son credenciales de menores.
   */
  fastify.get('/aulas/:aulaId/credenciales', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);

    return responder(reply, async () => {
      const aula = await aulaPermitida(fastify.prisma, aulaId, actorDe(request));

      const inscripciones = await fastify.prisma.enrollment.findMany({
        where: { aulaId },
        orderBy: { nino: { nombre: 'asc' } },
        select: {
          nino: { select: { id: true, nombre: true, usuario: true, pinCifrado: true, activo: true } },
        },
      });

      await anotarAcceso(fastify.prisma, {
        actorId: request.user.id,
        accion: 'ver_credenciales',
        recurso: `aula:${aulaId} (${inscripciones.length})`,
        ip: request.ip,
      });

      return reply.send({
        aula: { id: aula.id, nombre: aula.nombre },
        puedeVerPines: hayClaveDePin(config.PIN_SECRET),
        credenciales: inscripciones.map(({ nino }) => {
          const claro =
            hayClaveDePin(config.PIN_SECRET) && nino.pinCifrado
              ? descifrarPin(nino.pinCifrado, config.PIN_SECRET)
              : null;
          return {
            id: nino.id,
            nombre: nino.nombre,
            usuario: nino.usuario,
            activo: nino.activo,
            pin: claro ? pinAImagenes(claro) : null,
          };
        }),
      });
    });
  });

  /**
   * Cambia el PIN de varios estudiantes de una vez.
   *
   * Los dos casos reales: el mismo PIN para toda la clase (se escribe en la
   * pizarra y se acabo), o uno distinto al azar para cada uno cuando el grupo ya
   * sabe cuidarlo. Sin `ninoIds` se aplica al aula entera.
   */
  fastify.post('/aulas/:aulaId/pines', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);
    const datos = pinMasivoSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    return responder(reply, async () => {
      const actor = actorDe(request);
      await aulaPermitida(fastify.prisma, aulaId, actor);

      const delAula = await fastify.prisma.enrollment.findMany({
        where: { aulaId },
        select: { ninoId: true, nino: { select: { nombre: true, usuario: true } } },
      });
      const pedidos = datos.data.ninoIds;
      const objetivo = pedidos
        ? delAula.filter((e) => pedidos.includes(e.ninoId))
        : delAula;

      if (objetivo.length === 0) {
        return reply.code(400).send({ error: 'No hay estudiantes a los que cambiar el PIN' });
      }

      // Se preparan todos los hashes antes de escribir: bcrypt es lento y la
      // transaccion no tiene por que esperarlo.
      const cambios = [] as { ninoId: number; nombre: string; usuario: string; pin: string[]; pinHash: string; pinCifrado: string | null }[];
      for (const e of objetivo) {
        const pin = datos.data.pin ? [...datos.data.pin] : pinAleatorio();
        const { pinHash, pinCifrado } = await prepararPin(pin, config.PIN_SECRET);
        cambios.push({
          ninoId: e.ninoId,
          nombre: e.nino.nombre,
          usuario: e.nino.usuario,
          pin,
          pinHash,
          pinCifrado,
        });
      }

      await fastify.prisma.$transaction(
        cambios.map((c) =>
          fastify.prisma.user.update({
            where: { id: c.ninoId },
            data: { pinHash: c.pinHash, pinCifrado: c.pinCifrado },
          }),
        ),
      );

      await anotarAcceso(fastify.prisma, {
        actorId: request.user.id,
        accion: datos.data.pin ? 'pin_comun' : 'pin_aleatorio',
        recurso: `aula:${aulaId} (${cambios.length})`,
        ip: request.ip,
      });

      return reply.send({
        cambiados: cambios.length,
        credenciales: cambios.map((c) => ({
          id: c.ninoId,
          nombre: c.nombre,
          usuario: c.usuario,
          pin: c.pin,
        })),
      });
    });
  });

  // ─────────────────────────────── Tareas ───────────────────────────────────

  /** Las tareas del grupo. */
  fastify.get('/aulas/:aulaId/tareas', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);

    return responder(reply, async () => {
      await aulaPermitida(fastify.prisma, aulaId, actorDe(request));
      const tareas = await fastify.prisma.assignment.findMany({
        where: { aulaId },
        orderBy: { creadoEn: 'desc' },
        select: {
          id: true,
          titulo: true,
          instrucciones: true,
          fechaLimite: true,
          creadoEn: true,
          mundo: { select: { numero: true, nombre: true } },
          actividad: { select: { id: true, nombre: true, numeroEnMundo: true } },
        },
      });
      return reply.send({ tareas });
    });
  });

  /** Asigna un mundo entero o una actividad concreta al grupo. */
  fastify.post('/aulas/:aulaId/tareas', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);
    const datos = asignacionSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    return responder(reply, async () => {
      await aulaPermitida(fastify.prisma, aulaId, actorDe(request));

      let mundoId: number | null = null;
      if (datos.data.mundoNumero !== undefined) {
        const mundo = await fastify.prisma.world.findUnique({
          where: { numero: datos.data.mundoNumero },
          select: { id: true },
        });
        if (!mundo) return reply.code(404).send({ error: 'Ese mundo no existe' });
        mundoId = mundo.id;
      }

      if (datos.data.actividadId !== undefined) {
        const existe = await fastify.prisma.activity.findUnique({
          where: { id: datos.data.actividadId },
          select: { id: true },
        });
        if (!existe) return reply.code(404).send({ error: 'Esa actividad no existe' });
      }

      const tarea = await fastify.prisma.assignment.create({
        data: {
          aulaId,
          docenteId: request.user.id,
          mundoId,
          actividadId: datos.data.actividadId ?? null,
          titulo: datos.data.titulo ?? null,
          instrucciones: datos.data.instrucciones ?? null,
          fechaLimite: datos.data.fechaLimite ?? null,
        },
        select: {
          id: true,
          titulo: true,
          fechaLimite: true,
          mundo: { select: { numero: true, nombre: true } },
          actividad: { select: { id: true, nombre: true } },
        },
      });

      return reply.code(201).send({ tarea });
    });
  });

  /** Retira una tarea. */
  fastify.delete('/tareas/:tareaId', { preHandler: soloDocentes }, async (request, reply) => {
    const tareaId = Number((request.params as { tareaId: string }).tareaId);

    return responder(reply, async () => {
      const tarea = await fastify.prisma.assignment.findUnique({
        where: { id: tareaId },
        select: { id: true, aulaId: true },
      });
      if (!tarea?.aulaId) return reply.code(404).send({ error: 'Esa tarea no existe' });

      await aulaPermitida(fastify.prisma, tarea.aulaId, actorDe(request));
      await fastify.prisma.assignment.delete({ where: { id: tareaId } });
      return reply.send({ retirada: true });
    });
  });

  // ──────────────────────── Importar desde el colegio ───────────────────────

  const configPhidias = { baseUrl: config.PHIDIAS_BASE_URL, token: config.PHIDIAS_TOKEN };

  /** Traduce los fallos de Phidias sin dejar escapar detalles internos. */
  const conPhidias = async <T>(
    reply: { code: (n: number) => { send: (c: unknown) => unknown } },
    trabajo: () => Promise<T>,
  ): Promise<unknown> => {
    try {
      return await trabajo();
    } catch (error) {
      if (error instanceof ErrorPhidias) return reply.code(error.codigo).send({ error: error.message });
      if (error instanceof ErrorDocente) return reply.code(error.codigo).send({ error: error.message });
      throw error;
    }
  };

  /**
   * Los cursos del colegio, con cuantos matriculados tiene cada seccion.
   *
   * Es lo primero que ve el docente al importar: elige de aqui una seccion
   * entera, o entra en ella para escoger nombre a nombre.
   */
  fastify.get('/phidias/cursos', { preHandler: soloDocentes }, async (_request, reply) => {
    if (!phidiasConfigurado(configPhidias)) {
      return reply.send({ disponible: false, secciones: [] });
    }
    return conPhidias(reply, async () => {
      const { secciones } = await matriculas(configPhidias);
      return reply.send({ disponible: true, secciones });
    });
  });

  /**
   * Los matriculados, ordenados por apellido.
   *
   * `secciones` acota a unas secciones concretas; sin ella vienen todos, que es
   * lo que hace falta para armar un grupo mixto buscando por nombre.
   */
  fastify.get('/phidias/estudiantes', { preHandler: soloDocentes }, async (request, reply) => {
    const consulta = z
      .object({
        secciones: z.string().optional(),
        refrescar: z.coerce.boolean().optional(),
      })
      .safeParse(request.query);
    if (!consulta.success) return reply.code(400).send({ error: 'Consulta invalida' });

    if (!phidiasConfigurado(configPhidias)) {
      return reply.send({ disponible: false, estudiantes: [] });
    }

    return conPhidias(reply, async () => {
      const { estudiantes } = await matriculas(configPhidias, {
        refrescar: consulta.data.refrescar,
      });

      const ids = (consulta.data.secciones ?? '')
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);

      const lista = ids.length > 0 ? filtrarPorSeccion(estudiantes, ids) : estudiantes;

      // Cuales de estos ya tienen cuenta aqui: el docente necesita saber que
      // reimportar no duplica a nadie antes de pulsar el boton.
      const conocidos = await fastify.prisma.user.findMany({
        where: {
          origenExterno: 'phidias',
          origenExternoId: { in: lista.map((e) => String(e.id)) },
        },
        select: { origenExternoId: true },
      });
      const yaEstan = new Set(conocidos.map((c) => c.origenExternoId));

      return reply.send({
        disponible: true,
        total: lista.length,
        estudiantes: lista.map((e) => ({ ...e, yaImportado: yaEstan.has(String(e.id)) })),
      });
    });
  });

  /**
   * Trae al grupo los estudiantes elegidos.
   *
   * Admite las dos formas que pide un aula: secciones enteras, y una lista suelta
   * de estudiantes de cualquier curso para armar un grupo mixto. Se pueden
   * combinar las dos en la misma llamada.
   */
  fastify.post('/aulas/:aulaId/importar', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);
    const datos = z
      .object({
        seccionIds: z.array(z.number().int().positive()).max(60).optional(),
        estudianteIds: z.array(z.number().int().positive()).max(400).optional(),
        pinComun: pinSchema.optional(),
      })
      .refine((d) => (d.seccionIds?.length ?? 0) + (d.estudianteIds?.length ?? 0) > 0, {
        message: 'Elige al menos una seccion o un estudiante',
      })
      .safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    return conPhidias(reply, async () => {
      const aula = await aulaPermitida(fastify.prisma, aulaId, actorDe(request));
      const { estudiantes } = await matriculas(configPhidias);

      // Un estudiante puede llegar por su seccion y ademas suelto: se juntan por
      // identificador para no intentar crearlo dos veces en la misma llamada.
      const elegidos = new Map<number, (typeof estudiantes)[number]>();
      for (const e of filtrarPorSeccion(estudiantes, datos.data.seccionIds ?? [])) {
        elegidos.set(e.id, e);
      }
      const sueltos = new Set(datos.data.estudianteIds ?? []);
      for (const e of estudiantes) if (sueltos.has(e.id)) elegidos.set(e.id, e);

      if (elegidos.size === 0) {
        return reply.code(404).send({ error: 'Ninguno de los elegidos esta matriculado' });
      }

      const resultado = await importarEstudiantes(fastify.prisma, {
        aulaId,
        docenteId: aula.docenteId,
        institucionId: aula.institucionId,
        secretoPin: config.PIN_SECRET,
        pinComun: datos.data.pinComun,
        externos: [...elegidos.values()].map((e) => ({
          origen: 'phidias',
          origenId: String(e.id),
          // Se guarda "Nombre Apellidos": el orden natural para dirigirse a un
          // nino. La lista se ordena por apellido en la interfaz, no en el dato.
          nombre: [e.nombre, e.apellidos].filter(Boolean).join(' ').trim() || e.listado,
          fechaNacimiento: e.fechaNacimiento ? new Date(e.fechaNacimiento) : null,
        })),
      });

      await anotarAcceso(fastify.prisma, {
        actorId: request.user.id,
        accion: 'importar_phidias',
        recurso: `aula:${aulaId} (${resultado.creados.length} nuevos, ${resultado.reutilizados.length} ya existian)`,
        ip: request.ip,
      });

      return reply.code(201).send(resultado);
    });
  });

  // ────────────────────────────── Seguimiento ───────────────────────────────

  /** Por donde va el grupo, mundo a mundo. */
  fastify.get('/aulas/:aulaId/avance', { preHandler: soloDocentes }, async (request, reply) => {
    const aulaId = Number((request.params as { aulaId: string }).aulaId);

    return responder(reply, async () => {
      const aula = await aulaPermitida(fastify.prisma, aulaId, actorDe(request));
      const [mundos, estudiantes, panorama] = await Promise.all([
        avancePorMundo(fastify.prisma, aulaId),
        listaDeAula(fastify.prisma, aulaId),
        panoramaDeAula(fastify.prisma, aulaId),
      ]);
      return reply.send({
        aula: { id: aula.id, nombre: aula.nombre },
        mundos,
        estudiantes,
        ...panorama,
      });
    });
  });

  /** La ficha de un estudiante: avance, y donde se atasca. */
  fastify.get('/estudiantes/:ninoId/avance', { preHandler: soloDocentes }, async (request, reply) => {
    const ninoId = Number((request.params as { ninoId: string }).ninoId);

    return responder(reply, async () => {
      await estudiantePermitido(fastify.prisma, ninoId, actorDe(request));
      const ficha = await fichaDeEstudiante(fastify.prisma, ninoId);

      await anotarAcceso(fastify.prisma, {
        actorId: request.user.id,
        ninoId,
        accion: 'ver_avance',
        recurso: `estudiante:${ninoId}`,
        ip: request.ip,
      });

      return reply.send(ficha);
    });
  });
};
