/**
 * Los juegos que hacen los estudiantes.
 *
 * Reglas que están en el código y no solo en la interfaz:
 *
 *  1. **El título nunca llega del navegador.** Lo sortea el servidor al crear, y
 *     al pedir otro también. Si viniera de fuera, el sorteo sería una sugerencia
 *     y la zona de juegos publicados pasaría a ser texto libre escrito por
 *     menores y leído por menores.
 *  2. **La definición se valida entera en cada guardado**, con el esquema zod
 *     compartido. Lo que no esté en el catálogo no se guarda.
 *  3. **Para publicar hay que haber ganado el juego.** Es la única forma de que
 *     la zona pública no se llene de juegos imposibles. El servidor además
 *     comprueba que el juego se puede ganar, así que las dos cosas concuerdan.
 *  4. Un juego solo lo toca su autor. El docente mira; nadie más entra.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

import {
  revisarJuego,
  sortearTitulo,
  tituloValido,
  type DefinicionJuego,
} from '@codenest/shared';
import { leerDefinicionJuego } from '@codenest/shared/zod';

import { borrarMultimediaDe, guardarPortada } from './almacen.service.js';
import { emitirDiploma, type DiplomaEmitido } from './diplomas.service.js';
import { revisarInsigniasDeConstructor, type LogroConcedido } from './logros.service.js';

/**
 * Compara dos definiciones por su contenido, no por como estan escritas.
 *
 * Hace falta porque Postgres guarda JSONB **normalizado**: reordena las claves de
 * cada objeto y descarta los espacios. Comparar con `JSON.stringify` decia
 * siempre "cambio", asi que cada guardado borraba la marca de "probado" y
 * publicar —que guarda antes de publicar— fallaba siempre con un 409 diciendo
 * que el juego no se habia probado, justo despues de haberlo ganado.
 */
function mismaDefinicion(a: unknown, b: unknown): boolean {
  return canonico(a) === canonico(b);
}

function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>)
      // `undefined` no llega a JSONB: una clave ausente y otra sin valor son lo
      // mismo para la base, y tienen que serlo tambien aqui.
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

/** Tope de proyectos por estudiante. Un taller, no un almacén. */
export const MAX_PROYECTOS = 20;

export class ErrorProyecto extends Error {
  constructor(
    message: string,
    readonly codigo: number = 400,
  ) {
    super(message);
    this.name = 'ErrorProyecto';
  }
}

const CAMPOS_LISTA = {
  id: true,
  titulo: true,
  estado: true,
  portadaUrl: true,
  partidas: true,
  meGusta: true,
  probadoEn: true,
  publicadoEn: true,
  actualizadoEn: true,
} as const;

export interface ProyectoEnLista {
  readonly id: number;
  readonly titulo: string;
  readonly estado: 'borrador' | 'publicado';
  readonly portadaUrl: string | null;
  readonly partidas: number;
  readonly meGusta: number;
  readonly probado: boolean;
  readonly publicadoEn: Date | null;
  readonly actualizadoEn: Date;
}

function aLista(fila: {
  id: number;
  titulo: string;
  estado: string;
  portadaUrl: string | null;
  partidas: number;
  meGusta: number;
  probadoEn: Date | null;
  publicadoEn: Date | null;
  actualizadoEn: Date;
}): ProyectoEnLista {
  return {
    id: fila.id,
    titulo: fila.titulo,
    estado: fila.estado as 'borrador' | 'publicado',
    portadaUrl: fila.portadaUrl,
    partidas: fila.partidas,
    meGusta: fila.meGusta,
    probado: fila.probadoEn !== null,
    publicadoEn: fila.publicadoEn,
    actualizadoEn: fila.actualizadoEn,
  };
}

// ────────────────────────────── Del estudiante ─────────────────────────────

/** Crea un juego nuevo, ya jugable, con un título sorteado. */
export async function crearProyecto(
  prisma: PrismaClient,
  autorId: number,
  definicion: DefinicionJuego,
): Promise<ProyectoEnLista> {
  const cuantos = await prisma.gameProject.count({ where: { autorId } });
  if (cuantos >= MAX_PROYECTOS) {
    throw new ErrorProyecto(
      `Ya tienes ${MAX_PROYECTOS} juegos. Borra uno para empezar otro.`,
      409,
    );
  }

  const fila = await prisma.gameProject.create({
    data: {
      autorId,
      titulo: sortearTitulo(),
      definicion: definicion as unknown as Prisma.InputJsonValue,
    },
    select: CAMPOS_LISTA,
  });
  return aLista(fila);
}

export async function misProyectos(
  prisma: PrismaClient,
  autorId: number,
): Promise<ProyectoEnLista[]> {
  const filas = await prisma.gameProject.findMany({
    where: { autorId },
    orderBy: { actualizadoEn: 'desc' },
    select: CAMPOS_LISTA,
  });
  return filas.map(aLista);
}

export interface ProyectoCompleto extends ProyectoEnLista {
  readonly definicion: DefinicionJuego;
  readonly autor: { readonly id: number; readonly nombre: string };
  readonly avisos: readonly { readonly clave: string; readonly texto: string }[];
  readonly diploma: string | null;
}

/**
 * Un proyecto para verlo o editarlo.
 *
 * `quienPregunta` decide qué se puede abrir: su autor ve lo suyo siempre; los
 * demás, solo lo publicado. El docente pasa por otra ruta.
 */
export async function verProyecto(
  prisma: PrismaClient,
  id: number,
  quienPregunta: { id: number; esAdulto: boolean },
): Promise<ProyectoCompleto> {
  const fila = await prisma.gameProject.findUnique({
    where: { id },
    include: {
      autor: { select: { id: true, nombre: true } },
      diploma: { select: { codigo: true } },
    },
  });
  if (!fila) throw new ErrorProyecto('Ese juego no existe', 404);

  const esSuyo = fila.autorId === quienPregunta.id;
  if (!esSuyo && fila.estado !== 'publicado' && !quienPregunta.esAdulto) {
    // Mismo mensaje que si no existiera: un borrador ajeno no se anuncia.
    throw new ErrorProyecto('Ese juego no existe', 404);
  }

  const definicion = leerDefinicionJuego(fila.definicion);

  return {
    ...aLista(fila),
    definicion,
    autor: fila.autor,
    avisos: revisarJuego(definicion),
    diploma: fila.diploma?.codigo ?? null,
  };
}

/** Guarda la definición. Lo llama el constructor al cambiar cualquier cosa. */
export async function guardarProyecto(
  prisma: PrismaClient,
  id: number,
  autorId: number,
  definicion: DefinicionJuego,
): Promise<ProyectoEnLista> {
  const mio = await prisma.gameProject.findFirst({
    where: { id, autorId },
    select: { id: true, definicion: true },
  });
  if (!mio) throw new ErrorProyecto('Ese juego no existe', 404);

  // Si cambió el juego, la prueba anterior ya no vale: un juego que se ganó con
  // un obstáculo lento puede ser imposible tras acelerarlo. Y si no cambió, la
  // prueba se conserva: guardar lo mismo no puede deshacer lo que ya se logró.
  const igual = mismaDefinicion(mio.definicion, definicion);

  const fila = await prisma.gameProject.update({
    where: { id },
    data: {
      definicion: definicion as unknown as Prisma.InputJsonValue,
      ...(igual ? {} : { probadoEn: null }),
    },
    select: CAMPOS_LISTA,
  });
  return aLista(fila);
}

/** Otro título del sorteo, para el mismo juego. */
export async function renombrarProyecto(
  prisma: PrismaClient,
  id: number,
  autorId: number,
): Promise<string> {
  const mio = await prisma.gameProject.findFirst({ where: { id, autorId }, select: { titulo: true } });
  if (!mio) throw new ErrorProyecto('Ese juego no existe', 404);

  // Que no salga el mismo dos veces seguidas: al niño le parecería que el botón
  // no funciona.
  let titulo = sortearTitulo();
  for (let i = 0; i < 5 && titulo === mio.titulo; i++) titulo = sortearTitulo();

  await prisma.gameProject.update({ where: { id }, data: { titulo } });
  return titulo;
}

/**
 * Anota que el estudiante jugó su juego y lo ganó.
 *
 * Lo dice el navegador, y el navegador se puede manipular. Aquí se acepta
 * igualmente: el premio por engañar a esta ruta es publicar un juego propio, y a
 * cambio la comprobación de "se puede ganar de verdad" la hace el servidor con
 * `revisarJuego` al publicar. Guardar la partida en el servidor no aportaría
 * nada más y convertiría el motor en algo que hay que reimplementar aquí.
 */
export async function marcarProbado(
  prisma: PrismaClient,
  id: number,
  autorId: number,
): Promise<void> {
  const resultado = await prisma.gameProject.updateMany({
    where: { id, autorId },
    data: { probadoEn: new Date() },
  });
  if (resultado.count === 0) throw new ErrorProyecto('Ese juego no existe', 404);
}

export interface ResultadoPublicacion {
  readonly proyecto: ProyectoEnLista;
  readonly diploma: DiplomaEmitido;
  readonly insignias: readonly LogroConcedido[];
}

/** Publica el juego: diploma, insignia y sitio en la zona pública. */
export async function publicarProyecto(
  prisma: PrismaClient,
  id: number,
  autorId: number,
  portadaDataUrl?: string,
): Promise<ResultadoPublicacion> {
  const fila = await prisma.gameProject.findFirst({
    where: { id, autorId },
    include: { autor: { select: { nombre: true } } },
  });
  if (!fila) throw new ErrorProyecto('Ese juego no existe', 404);

  if (!fila.probadoEn) {
    throw new ErrorProyecto('Prueba tu juego y ganalo antes de publicarlo', 409);
  }

  // El titulo esta guardado, pero se comprueba igual: si alguien lo hubiera
  // cambiado por otra via, no se publica.
  if (!tituloValido(fila.titulo)) {
    throw new ErrorProyecto('El titulo de ese juego no es valido', 409);
  }

  const definicion = leerDefinicionJuego(fila.definicion);
  const graves = revisarJuego(definicion).filter(
    (a) => a.clave === 'sin-victoria' || a.clave === 'sin-premios',
  );
  if (graves.length > 0) {
    throw new ErrorProyecto(graves[0]!.texto, 409);
  }

  // La portada es un extra: si S3 falla, el juego se publica igual y se queda
  // con la portada de siempre. Perder la publicacion por una imagen seria peor.
  let portadaUrl = fila.portadaUrl;
  if (portadaDataUrl) {
    portadaUrl = (await guardarPortada(id, portadaDataUrl).catch(() => null)) ?? portadaUrl;
  }

  const actualizado = await prisma.gameProject.update({
    where: { id },
    data: {
      estado: 'publicado',
      publicadoEn: fila.publicadoEn ?? new Date(),
      portadaUrl,
    },
    select: CAMPOS_LISTA,
  });

  const diploma = await emitirDiploma(prisma, {
    alumnoId: autorId,
    proyectoId: id,
    nombreAlumno: fila.autor.nombre,
    tituloJuego: fila.titulo,
  });

  const insignias = await revisarInsigniasDeConstructor(prisma, autorId);

  return { proyecto: aLista(actualizado), diploma, insignias };
}

/** Lo retira de la zona pública. El diploma no se retira: ya se ganó. */
export async function despublicarProyecto(
  prisma: PrismaClient,
  id: number,
  autorId: number,
): Promise<ProyectoEnLista> {
  const resultado = await prisma.gameProject.updateMany({
    where: { id, autorId },
    data: { estado: 'borrador' },
  });
  if (resultado.count === 0) throw new ErrorProyecto('Ese juego no existe', 404);

  const fila = await prisma.gameProject.findUniqueOrThrow({ where: { id }, select: CAMPOS_LISTA });
  return aLista(fila);
}

export async function borrarProyecto(
  prisma: PrismaClient,
  id: number,
  autorId: number,
): Promise<void> {
  const resultado = await prisma.gameProject.deleteMany({ where: { id, autorId } });
  if (resultado.count === 0) throw new ErrorProyecto('Ese juego no existe', 404);
  await borrarMultimediaDe(id);
}

// ─────────────────────────── La zona publicada ─────────────────────────────

export interface JuegoPublicado {
  readonly id: number;
  readonly titulo: string;
  readonly portadaUrl: string | null;
  readonly partidas: number;
  readonly meGusta: number;
  readonly publicadoEn: Date | null;
  readonly autor: string;
  readonly esMio: boolean;
  readonly leDiMeGusta: boolean;
}

export type OrdenJuegos = 'recientes' | 'populares' | 'jugados';

/**
 * Los juegos publicados.
 *
 * Del autor sale el NOMBRE, no su usuario ni su aula: en una pantalla que ven
 * otros niños, "Sofia" es lo que hace falta para saber de quién es el juego.
 */
export async function juegosPublicados(
  prisma: PrismaClient,
  quienMira: number,
  opciones: { orden?: OrdenJuegos; limite?: number; aulaId?: number } = {},
): Promise<JuegoPublicado[]> {
  const orden: Prisma.GameProjectOrderByWithRelationInput =
    opciones.orden === 'populares'
      ? { meGusta: 'desc' }
      : opciones.orden === 'jugados'
        ? { partidas: 'desc' }
        : { publicadoEn: 'desc' };

  const filas = await prisma.gameProject.findMany({
    where: {
      estado: 'publicado',
      ...(opciones.aulaId
        ? { autor: { inscripciones: { some: { aulaId: opciones.aulaId } } } }
        : {}),
    },
    orderBy: [orden, { id: 'desc' }],
    take: Math.min(opciones.limite ?? 60, 100),
    select: {
      id: true,
      titulo: true,
      portadaUrl: true,
      partidas: true,
      meGusta: true,
      publicadoEn: true,
      autorId: true,
      autor: { select: { nombre: true } },
      gustos: { where: { usuarioId: quienMira }, select: { id: true } },
    },
  });

  return filas.map((f) => ({
    id: f.id,
    titulo: f.titulo,
    portadaUrl: f.portadaUrl,
    partidas: f.partidas,
    meGusta: f.meGusta,
    publicadoEn: f.publicadoEn,
    // Solo el nombre de pila: es lo que se dicen entre ellos en clase.
    autor: f.autor.nombre.split(/\s+/)[0] ?? f.autor.nombre,
    esMio: f.autorId === quienMira,
    leDiMeGusta: f.gustos.length > 0,
  }));
}

/** Suma una partida. Se llama al empezar a jugar, no al acabar. */
export async function registrarPartida(prisma: PrismaClient, id: number): Promise<number> {
  const fila = await prisma.gameProject.findFirst({
    where: { id, estado: 'publicado' },
    select: { id: true, autorId: true },
  });
  if (!fila) throw new ErrorProyecto('Ese juego no existe', 404);

  const actualizado = await prisma.gameProject.update({
    where: { id },
    data: { partidas: { increment: 1 } },
    select: { partidas: true },
  });

  // La insignia de juego popular es del AUTOR, no de quien juega.
  if (actualizado.partidas >= 10) {
    const { conceder } = await import('./logros.service.js');
    await conceder(prisma, fila.autorId, 'juego-popular').catch(() => null);
  }

  return actualizado.partidas;
}

/**
 * Pone o quita el "me gusta". Uno por persona y juego.
 *
 * El contador se recalcula contando filas en lugar de sumar uno: dos toques
 * seguidos en un movil lento no pueden dejar un contador que no se corresponde
 * con los "me gusta" que hay de verdad.
 */
export async function alternarMeGusta(
  prisma: PrismaClient,
  id: number,
  usuarioId: number,
): Promise<{ meGusta: number; leDiMeGusta: boolean }> {
  const juego = await prisma.gameProject.findFirst({
    where: { id, estado: 'publicado' },
    select: { id: true },
  });
  if (!juego) throw new ErrorProyecto('Ese juego no existe', 404);

  const existente = await prisma.gameLike.findUnique({
    where: { proyectoId_usuarioId: { proyectoId: id, usuarioId } },
    select: { id: true },
  });

  if (existente) {
    await prisma.gameLike.delete({ where: { id: existente.id } });
  } else {
    await prisma.gameLike.create({ data: { proyectoId: id, usuarioId } });
  }

  const total = await prisma.gameLike.count({ where: { proyectoId: id } });
  await prisma.gameProject.update({ where: { id }, data: { meGusta: total } });

  return { meGusta: total, leDiMeGusta: !existente };
}

// ──────────────────────────── Para el docente ──────────────────────────────

export interface ProyectoDeAula extends ProyectoEnLista {
  readonly autor: { readonly id: number; readonly nombre: string; readonly usuario: string };
  readonly aulas: readonly string[];
}

/**
 * Todos los juegos de los estudiantes de unas aulas, publicados o no.
 *
 * El docente ve los borradores a propósito: es su clase, y un proyecto a medias
 * es justo lo que necesita ver para poder ayudar.
 */
export async function proyectosDeAulas(
  prisma: PrismaClient,
  aulaIds: readonly number[],
): Promise<ProyectoDeAula[]> {
  if (aulaIds.length === 0) return [];

  const filas = await prisma.gameProject.findMany({
    where: { autor: { inscripciones: { some: { aulaId: { in: [...aulaIds] } } } } },
    orderBy: { actualizadoEn: 'desc' },
    select: {
      ...CAMPOS_LISTA,
      autor: {
        select: {
          id: true,
          nombre: true,
          usuario: true,
          inscripciones: {
            where: { aulaId: { in: [...aulaIds] } },
            select: { aula: { select: { nombre: true } } },
          },
        },
      },
    },
  });

  return filas.map((f) => ({
    ...aLista(f),
    autor: { id: f.autor.id, nombre: f.autor.nombre, usuario: f.autor.usuario },
    aulas: f.autor.inscripciones.map((i) => i.aula.nombre),
  }));
}
