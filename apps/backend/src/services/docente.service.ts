/**
 * Lo que hace un docente con su aula.
 *
 * Un colegio no se parece a una familia y por eso esto no vive en el portal de
 * tutores. Aqui las operaciones son de treinta en treinta: se dan de alta grupos
 * enteros el primer dia de clase, se reparte el mismo PIN a todo el curso porque
 * se escribe en la pizarra, y lo que se mira no es un nino sino una tabla de
 * quien va por donde.
 *
 * Tres reglas que atraviesan todo el modulo:
 *
 *  1. El aula es la frontera de permisos. Un docente solo toca sus aulas, y la
 *     comprobacion se hace aqui, no en la interfaz: la interfaz solo esconde
 *     botones.
 *  2. Nada a medias. Dar de alta treinta estudiantes es una transaccion: si el
 *     numero doce falla, no queda un aula con once y un docente sin saber cuales.
 *  3. Los agregados salen de `progreso_actividad`, no de la telemetria cruda.
 *     La telemetria puede borrarse por peticion de una familia (Ley 1581) y las
 *     notas del curso no pueden depender de eso.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

import {
  generarUsuarioLibre,
  grupoPorFechaNacimiento,
  hashPin,
  normalizarPin,
} from './auth.service.js';
import { cifrarPin, hayClaveDePin } from './pin-visible.service.js';

/** Imagenes con las que se forma un PIN. Las mismas que ofrece la pantalla. */
export const IMAGENES_PIN = [
  'gato',
  'sol',
  'arbol',
  'luna',
  'pez',
  'flor',
  'nube',
  'tren',
  'pato',
] as const;

export class ErrorDocente extends Error {
  constructor(
    readonly codigo: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDocente';
  }
}

/** Un PIN al azar, para el alta masiva cuando el docente no dicta uno. */
export function pinAleatorio(longitud = 4): string[] {
  return Array.from(
    { length: longitud },
    () => IMAGENES_PIN[Math.floor(Math.random() * IMAGENES_PIN.length)]!,
  );
}

/**
 * Prepara las dos formas en que se guarda un PIN: el hash con el que se entra y
 * la copia cifrada con la que el docente lo consulta.
 *
 * Si no hay clave configurada se guarda solo el hash. El juego funciona igual;
 * lo que se pierde es poder mirarlo despues, y eso se avisa en la interfaz en
 * lugar de fallar.
 */
export async function prepararPin(
  imagenes: readonly string[],
  secreto: string | undefined,
): Promise<{ pinHash: string; pinCifrado: string | null }> {
  const normalizado = normalizarPin(imagenes);
  return {
    pinHash: await hashPin(imagenes),
    pinCifrado: hayClaveDePin(secreto) ? cifrarPin(normalizado, secreto) : null,
  };
}

/** Comprueba que las imagenes existen y que no hay ninguna vacia. */
export function pinValido(imagenes: readonly string[]): boolean {
  return (
    imagenes.length === 4 &&
    imagenes.every((i) => (IMAGENES_PIN as readonly string[]).includes(i.trim().toLowerCase()))
  );
}

// ───────────────────────────────── Permisos ─────────────────────────────────

export interface Actor {
  readonly id: number;
  readonly rol: string;
  readonly institucionId: number | null;
}

/**
 * Devuelve el aula si el actor puede tocarla, y lanza si no.
 *
 * El docente manda en las aulas que creo. El administrador del colegio manda en
 * todas las de su institucion, porque es quien responde cuando un docente se va
 * a mitad de curso. El administrador de la plataforma, en todas.
 */
export async function aulaPermitida(
  prisma: PrismaClient,
  aulaId: number,
  actor: Actor,
): Promise<{ id: number; nombre: string; docenteId: number; institucionId: number | null }> {
  const aula = await prisma.classroom.findUnique({
    where: { id: aulaId },
    select: { id: true, nombre: true, docenteId: true, institucionId: true },
  });
  if (!aula) throw new ErrorDocente(404, 'Ese grupo no existe');

  if (actor.rol === 'admin') return aula;
  if (aula.docenteId === actor.id) return aula;
  if (
    actor.rol === 'admin_escuela' &&
    actor.institucionId !== null &&
    aula.institucionId === actor.institucionId
  ) {
    return aula;
  }

  // Se responde 404 y no 403 a proposito: confirmar que el aula existe ya diria
  // algo de un colegio que no es el suyo.
  throw new ErrorDocente(404, 'Ese grupo no existe');
}

/** Igual que la anterior pero para un estudiante: debe estar en un aula suya. */
export async function estudiantePermitido(
  prisma: PrismaClient,
  ninoId: number,
  actor: Actor,
): Promise<{ id: number; nombre: string; usuario: string }> {
  const nino = await prisma.user.findFirst({
    where: { id: ninoId, rol: 'nino' },
    select: { id: true, nombre: true, usuario: true, inscripciones: { select: { aulaId: true } } },
  });
  if (!nino) throw new ErrorDocente(404, 'Ese estudiante no existe');

  for (const inscripcion of nino.inscripciones) {
    try {
      await aulaPermitida(prisma, inscripcion.aulaId, actor);
      return { id: nino.id, nombre: nino.nombre, usuario: nino.usuario };
    } catch {
      // Se prueba con la siguiente: un estudiante puede estar en varias aulas.
    }
  }
  throw new ErrorDocente(404, 'Ese estudiante no existe');
}

// ──────────────────────────────── Altas ─────────────────────────────────────

export interface EstudianteNuevo {
  readonly nombre: string;
  readonly fechaNacimiento: Date;
  /** Si no se indica, se genera uno al azar. */
  readonly pin?: readonly string[];
}

export interface EstudianteCreado {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly grupoEdad: string;
  /** El PIN en claro, devuelto UNA vez al crearlo para poder repartirlo. */
  readonly pin: readonly string[];
}

/**
 * Da de alta estudiantes en un aula, todos o ninguno.
 *
 * El docente queda como adulto responsable de cada uno (`tutores_ninos`), que es
 * lo que despues acota sus consultas, y el consentimiento nace pendiente igual
 * que en el alta familiar: el colegio lo recoge en papel y lo marca despues.
 */
export async function crearEstudiantes(
  prisma: PrismaClient,
  opciones: {
    readonly aulaId: number;
    readonly docenteId: number;
    readonly institucionId: number | null;
    readonly estudiantes: readonly EstudianteNuevo[];
    readonly secretoPin: string | undefined;
    /** De donde viene cada uno, si vienen del sistema del colegio. Mismo orden. */
    readonly origenes?: readonly { origen: string; origenId: string }[];
  },
): Promise<EstudianteCreado[]> {
  const { aulaId, docenteId, institucionId, estudiantes, secretoPin, origenes } = opciones;

  // El nombre de usuario y el hash se calculan FUERA de la transaccion: bcrypt
  // con treinta estudiantes tarda lo suyo y no conviene tener la transaccion
  // abierta mientras tanto.
  const preparados = [] as {
    datos: EstudianteNuevo;
    usuario: string;
    pin: readonly string[];
    pinHash: string;
    pinCifrado: string | null;
    grupoEdad: 'exploradores' | 'creadores' | 'hackers';
  }[];

  // Los nombres ya repartidos en este lote pero aun sin crear. Dos "Sofia
  // Ramirez" en la misma clase pedirian el mismo usuario, porque ninguna de las
  // dos existe todavia en la base cuando se consulta.
  const usuariosPedidos = new Set<string>();
  for (const datos of estudiantes) {
    const usuario = await generarUsuarioLibre(prisma, datos.nombre, usuariosPedidos);
    usuariosPedidos.add(usuario);

    const pin = datos.pin && datos.pin.length > 0 ? datos.pin : pinAleatorio();
    const { pinHash, pinCifrado } = await prepararPin(pin, secretoPin);

    preparados.push({
      datos,
      usuario,
      pin,
      pinHash,
      pinCifrado,
      grupoEdad: grupoPorFechaNacimiento(datos.fechaNacimiento),
    });
  }

  return prisma.$transaction(async (tx) => {
    const creados: EstudianteCreado[] = [];

    for (const [indice, p] of preparados.entries()) {
      const procedencia = origenes?.[indice];
      const nino = await tx.user.create({
        data: {
          usuario: p.usuario,
          nombre: p.datos.nombre,
          rol: 'nino',
          grupoEdad: p.grupoEdad,
          fechaNacimiento: p.datos.fechaNacimiento,
          pinHash: p.pinHash,
          pinCifrado: p.pinCifrado,
          institucionId,
          origenExterno: procedencia?.origen ?? null,
          origenExternoId: procedencia?.origenId ?? null,
        },
        select: { id: true, nombre: true, usuario: true, grupoEdad: true },
      });

      await tx.guardianLink.create({
        data: { tutorId: docenteId, ninoId: nino.id, parentesco: 'docente' },
      });
      await tx.enrollment.create({ data: { ninoId: nino.id, aulaId } });
      await tx.parentalConsent.create({
        data: { ninoId: nino.id, tutorId: docenteId, estado: 'pendiente', versionPolitica: '1.0' },
      });

      creados.push({
        id: nino.id,
        nombre: nino.nombre,
        usuario: nino.usuario,
        grupoEdad: nino.grupoEdad ?? p.grupoEdad,
        pin: p.pin,
      });
    }

    return creados;
  });
}

// ───────────────────────────── Lista del aula ───────────────────────────────

export interface FilaEstudiante {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly grupoEdad: string | null;
  readonly activo: boolean;
  readonly consentimiento: string;
  readonly estrellas: number;
  readonly actividadesCompletadas: number;
  readonly ultimaActividad: Date | null;
}

/** La lista del aula con su avance, en una sola pasada por la base. */
export async function listaDeAula(
  prisma: PrismaClient,
  aulaId: number,
): Promise<FilaEstudiante[]> {
  const inscripciones = await prisma.enrollment.findMany({
    where: { aulaId },
    orderBy: { nino: { nombre: 'asc' } },
    select: {
      nino: {
        select: {
          id: true,
          nombre: true,
          usuario: true,
          grupoEdad: true,
          activo: true,
          estrellasTotales: true,
          ultimaActividad: true,
          consentimientosComoNino: {
            orderBy: { id: 'desc' },
            take: 1,
            select: { estado: true },
          },
        },
      },
    },
  });

  const ids = inscripciones.map((i) => i.nino.id);
  if (ids.length === 0) return [];

  // Una sola agregacion para todo el grupo en vez de una consulta por nino.
  const completadas = await prisma.userActivityProgress.groupBy({
    by: ['usuarioId'],
    where: { usuarioId: { in: ids }, completada: true },
    _count: { _all: true },
  });
  const porNino = new Map(completadas.map((c) => [c.usuarioId, c._count._all]));

  return inscripciones.map(({ nino }) => ({
    id: nino.id,
    nombre: nino.nombre,
    usuario: nino.usuario,
    grupoEdad: nino.grupoEdad,
    activo: nino.activo,
    consentimiento: nino.consentimientosComoNino[0]?.estado ?? 'pendiente',
    estrellas: nino.estrellasTotales,
    actividadesCompletadas: porNino.get(nino.id) ?? 0,
    ultimaActividad: nino.ultimaActividad,
  }));
}

// ─────────────────────────────── Progreso ───────────────────────────────────

/**
 * Avance del aula por mundo: cuantos estudiantes han terminado cada mundo y
 * cuantas estrellas llevan de media.
 *
 * Es la vista que responde a la pregunta que hace un docente de verdad, que no
 * es "cuantas estrellas tiene Juan" sino "por donde va el grupo y quien se ha
 * quedado atras".
 */
export async function avancePorMundo(
  prisma: PrismaClient,
  aulaId: number,
): Promise<
  {
    mundo: number;
    nombre: string;
    actividades: number;
    completadasTotales: number;
    estudiantesQueLoTerminaron: number;
    estrellasPromedio: number;
  }[]
> {
  const ids = (
    await prisma.enrollment.findMany({ where: { aulaId }, select: { ninoId: true } })
  ).map((i) => i.ninoId);

  const mundos = await prisma.world.findMany({
    where: { activo: true },
    orderBy: { numero: 'asc' },
    select: { id: true, numero: true, nombre: true, _count: { select: { actividades: true } } },
  });

  if (ids.length === 0) {
    return mundos.map((m) => ({
      mundo: m.numero,
      nombre: m.nombre,
      actividades: m._count.actividades,
      completadasTotales: 0,
      estudiantesQueLoTerminaron: 0,
      estrellasPromedio: 0,
    }));
  }

  const progreso = await prisma.userActivityProgress.findMany({
    where: { usuarioId: { in: ids }, completada: true },
    select: { usuarioId: true, mejorEstrellas: true, actividad: { select: { mundoId: true } } },
  });

  return mundos.map((mundo) => {
    const suyas = progreso.filter((p) => p.actividad.mundoId === mundo.id);
    const porNino = new Map<number, number>();
    for (const p of suyas) porNino.set(p.usuarioId, (porNino.get(p.usuarioId) ?? 0) + 1);

    const terminaron = [...porNino.values()].filter(
      (n) => n >= mundo._count.actividades && mundo._count.actividades > 0,
    ).length;
    const estrellas = suyas.reduce((suma, p) => suma + p.mejorEstrellas, 0);

    return {
      mundo: mundo.numero,
      nombre: mundo.nombre,
      actividades: mundo._count.actividades,
      completadasTotales: suyas.length,
      estudiantesQueLoTerminaron: terminaron,
      estrellasPromedio: suyas.length > 0 ? Number((estrellas / suyas.length).toFixed(2)) : 0,
    };
  });
}

/**
 * Ficha de un estudiante: por donde va, cuanto tarda y donde se atasca.
 *
 * "Donde se atasca" son las actividades con muchos intentos, que es la senal que
 * de verdad sirve para sentarse al lado de un nino. Una actividad sin completar
 * puede ser simplemente una a la que aun no ha llegado.
 */
export async function fichaDeEstudiante(
  prisma: PrismaClient,
  ninoId: number,
): Promise<{
  estudiante: { id: number; nombre: string; usuario: string; grupoEdad: string | null; estrellas: number; monedas: number; rachaDias: number; ultimaActividad: Date | null };
  porMundo: { mundo: number; nombre: string; actividades: number; completadas: number; estrellas: number }[];
  atascos: { mundo: number; actividad: number; nombre: string; intentos: number; estrellas: number; completada: boolean }[];
}> {
  const nino = await prisma.user.findUniqueOrThrow({
    where: { id: ninoId },
    select: {
      id: true,
      nombre: true,
      usuario: true,
      grupoEdad: true,
      estrellasTotales: true,
      monedas: true,
      rachaDias: true,
      ultimaActividad: true,
    },
  });

  const progreso = await prisma.userActivityProgress.findMany({
    where: { usuarioId: ninoId },
    select: {
      completada: true,
      mejorEstrellas: true,
      intentosTotales: true,
      actividad: {
        select: {
          numeroEnMundo: true,
          nombre: true,
          mundo: { select: { numero: true, nombre: true, _count: { select: { actividades: true } } } },
        },
      },
    },
  });

  const mundos = new Map<
    number,
    { mundo: number; nombre: string; actividades: number; completadas: number; estrellas: number }
  >();
  for (const p of progreso) {
    const m = p.actividad.mundo;
    const fila =
      mundos.get(m.numero) ??
      { mundo: m.numero, nombre: m.nombre, actividades: m._count.actividades, completadas: 0, estrellas: 0 };
    if (p.completada) {
      fila.completadas += 1;
      fila.estrellas += p.mejorEstrellas;
    }
    mundos.set(m.numero, fila);
  }

  const atascos = progreso
    .filter((p) => p.intentosTotales >= 4)
    .sort((a, b) => b.intentosTotales - a.intentosTotales)
    .slice(0, 8)
    .map((p) => ({
      mundo: p.actividad.mundo.numero,
      actividad: p.actividad.numeroEnMundo,
      nombre: p.actividad.nombre,
      intentos: p.intentosTotales,
      estrellas: p.mejorEstrellas,
      completada: p.completada,
    }));

  return {
    estudiante: {
      id: nino.id,
      nombre: nino.nombre,
      usuario: nino.usuario,
      grupoEdad: nino.grupoEdad,
      estrellas: nino.estrellasTotales,
      monedas: nino.monedas,
      rachaDias: nino.rachaDias,
      ultimaActividad: nino.ultimaActividad,
    },
    porMundo: [...mundos.values()].sort((a, b) => a.mundo - b.mundo),
    atascos,
  };
}

/** Anota en la auditoria quien miro que, para lo que toca datos de menores. */
export async function anotarAcceso(
  prisma: PrismaClient,
  datos: { actorId: number; ninoId?: number | null; accion: string; recurso: string; ip?: string },
): Promise<void> {
  await prisma.accessAudit.create({
    data: {
      actorId: datos.actorId,
      ninoId: datos.ninoId ?? null,
      accion: datos.accion,
      recurso: datos.recurso,
      ip: datos.ip ?? null,
    } satisfies Prisma.AccessAuditUncheckedCreateInput,
  });
}

// ─────────────────────── Importacion desde el colegio ───────────────────────

export interface EstudianteExterno {
  readonly origen: string;
  readonly origenId: string;
  readonly nombre: string;
  readonly fechaNacimiento: Date | null;
}

export interface ResultadoImportacion {
  readonly creados: EstudianteCreado[];
  /** Ya existian de una importacion anterior: se reutiliza su cuenta. */
  readonly reutilizados: { id: number; nombre: string; usuario: string }[];
  /** Ya estaban en este grupo: no se hace nada con ellos. */
  readonly yaEnElGrupo: number;
  /** No se pudieron importar y por que. */
  readonly omitidos: { origenId: string; nombre: string; motivo: string }[];
}

/**
 * Trae estudiantes del sistema del colegio a un grupo de CodeNest.
 *
 * La regla que sostiene todo esto: un estudiante del colegio es UNA cuenta aqui,
 * aunque se le importe cinco veces y a cinco grupos distintos. Por eso se busca
 * primero por su identificador de origen y solo se crea si no aparece. Sin eso,
 * el nino que esta en el grupo de su curso y en uno mixto de refuerzo tendria dos
 * perfiles y la mitad de su progreso en cada uno.
 *
 * Sin fecha de nacimiento no se importa: el grupo de edad decide con que editor
 * juega el nino, y adivinarlo seria ponerle a escribir codigo a los cinco anos o
 * a arrastrar flechas a los doce.
 */
export async function importarEstudiantes(
  prisma: PrismaClient,
  opciones: {
    readonly aulaId: number;
    readonly docenteId: number;
    readonly institucionId: number | null;
    readonly externos: readonly EstudianteExterno[];
    readonly secretoPin: string | undefined;
    /** Mismo PIN para todos los importados, si el docente lo dicta. */
    readonly pinComun?: readonly string[];
  },
): Promise<ResultadoImportacion> {
  const { aulaId, docenteId, institucionId, externos, secretoPin, pinComun } = opciones;

  const omitidos: ResultadoImportacion['omitidos'] = [];
  const nuevos: (EstudianteNuevo & { origen: string; origenId: string })[] = [];
  const reutilizados: ResultadoImportacion['reutilizados'] = [];
  const paraInscribir: number[] = [];

  for (const externo of externos) {
    const yaExiste = await prisma.user.findFirst({
      where: { origenExterno: externo.origen, origenExternoId: externo.origenId },
      select: { id: true, nombre: true, usuario: true },
    });

    if (yaExiste) {
      reutilizados.push(yaExiste);
      paraInscribir.push(yaExiste.id);
      continue;
    }

    if (!externo.fechaNacimiento) {
      omitidos.push({
        origenId: externo.origenId,
        nombre: externo.nombre,
        motivo: 'sin fecha de nacimiento: no se puede saber con que editor juega',
      });
      continue;
    }

    nuevos.push({
      nombre: externo.nombre,
      fechaNacimiento: externo.fechaNacimiento,
      pin: pinComun,
      origen: externo.origen,
      origenId: externo.origenId,
    });
  }

  const creados =
    nuevos.length > 0
      ? await crearEstudiantes(prisma, {
          aulaId,
          docenteId,
          institucionId,
          estudiantes: nuevos,
          secretoPin,
          origenes: nuevos.map((n) => ({ origen: n.origen, origenId: n.origenId })),
        })
      : [];

  // Los que ya tenian cuenta solo necesitan la inscripcion en este grupo.
  const yaEnElGrupo = paraInscribir.length
    ? (
        await prisma.enrollment.findMany({
          where: { aulaId, ninoId: { in: paraInscribir } },
          select: { ninoId: true },
        })
      ).length
    : 0;

  if (paraInscribir.length > 0) {
    await prisma.enrollment.createMany({
      data: paraInscribir.map((ninoId) => ({ ninoId, aulaId })),
      skipDuplicates: true,
    });
  }

  return { creados, reutilizados, yaEnElGrupo, omitidos };
}
