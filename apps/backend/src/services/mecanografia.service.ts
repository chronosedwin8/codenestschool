/**
 * Mecanografía: progreso, récords y errores por tecla.
 *
 * Dos reglas que están en el código:
 *
 *  1. **Las estrellas las calcula el servidor.** El navegador manda pulsaciones y
 *     tiempo; las PPM, la precisión y las estrellas salen de `medir` y
 *     `estrellasDe` de `@codenest/shared`, las mismas funciones que usa la
 *     pantalla. Si el cliente mandara las estrellas, bastaría con cambiar un
 *     número en las herramientas de desarrollo.
 *  2. **Solo se guarda el mejor intento.** Practicar una lección ya superada no
 *     puede quitarle estrellas a nadie: quien repite para mejorar no se arriesga
 *     a perder lo que tenía.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

import {
  INFO_ZONAS,
  LECCIONES,
  leccionPorClave,
  type Zona,
} from '@codenest/content';
import { esCreible, estrellasDe, medir, queFalta, type Intento } from '@codenest/shared';

import { conceder, type LogroConcedido } from './logros.service.js';

export class ErrorMecanografia extends Error {
  constructor(
    message: string,
    readonly codigo: number = 400,
  ) {
    super(message);
    this.name = 'ErrorMecanografia';
  }
}

/** Las insignias de mecanografía. Se siembran con el resto. */
export const LOGROS_TECLADO = [
  {
    clave: 'dedos-en-casa',
    nombre: 'Dedos en su Casa',
    descripcion: 'Terminaste la Playa de las Teclas: ya conoces todo el teclado.',
    icono: '⌨️',
    rareza: 'raro',
    condicion: { tipo: 'zona_mecanografia', valor: 'playa' },
  },
  {
    clave: 'escriba-de-la-laguna',
    nombre: 'Escriba de la Laguna',
    descripcion: 'Tildes, mayusculas y signos: escribes español de verdad.',
    icono: '✍️',
    rareza: 'epico',
    condicion: { tipo: 'zona_mecanografia', valor: 'laguna' },
  },
  {
    clave: 'campeon-del-teclado',
    nombre: 'Campeon del Teclado',
    descripcion: 'Conquistaste la Cima de los Parrafos.',
    icono: '🏔️',
    rareza: 'legendario',
    condicion: { tipo: 'zona_mecanografia', valor: 'cima' },
  },
  {
    clave: 'treinta-palabras',
    nombre: 'Treinta por Minuto',
    descripcion: 'Escribiste a 30 palabras por minuto con buena precision.',
    icono: '💨',
    rareza: 'epico',
    condicion: { tipo: 'ppm', valor: 30 },
  },
  {
    clave: 'precision-perfecta',
    nombre: 'Pulso de Cirujano',
    descripcion: 'Una leccion entera sin un solo error.',
    icono: '🎯',
    rareza: 'epico',
    condicion: { tipo: 'precision', valor: 100 },
  },
] as const;

// ──────────────────────────── Lo que ve el niño ────────────────────────────

export interface LeccionConProgreso {
  readonly clave: string;
  readonly zona: Zona;
  readonly orden: number;
  readonly nombre: string;
  readonly teclasNuevas: readonly string[];
  readonly consejo: string;
  readonly caracteres: number;
  readonly estrellas: number;
  readonly mejorPpm: number;
  readonly mejorPrecision: number;
  readonly completada: boolean;
  readonly desbloqueada: boolean;
}

export interface MapaMecanografia {
  readonly zonas: readonly {
    readonly clave: Zona;
    readonly nombre: string;
    readonly grado: string;
    readonly descripcion: string;
    readonly icono: string;
    readonly color: string;
    readonly lecciones: readonly LeccionConProgreso[];
    readonly completadas: number;
    readonly estrellas: number;
  }[];
  readonly resumen: {
    readonly mejorPpm: number;
    readonly ultimaPpm: number;
    readonly ultimaPrecision: number;
    readonly leccionesCompletadas: number;
    readonly leccionesTotales: number;
    readonly estrellas: number;
    readonly minutosPracticados: number;
    /** Las cinco teclas que más falla, ya ordenadas. */
    readonly teclasDificiles: readonly { readonly tecla: string; readonly errores: number }[];
  };
}

/**
 * El mapa completo con el progreso de un estudiante.
 *
 * El desbloqueo es simple y a propósito: la primera lección de cada zona está
 * abierta, y cada siguiente pide la anterior. Así un niño de 7.º no tiene que
 * pasar por las lecciones de 5.º para llegar a la suya, pero dentro de su zona
 * el orden sí importa: la mecanografía se aprende en un orden concreto.
 */
export async function mapaDeMecanografia(
  prisma: PrismaClient,
  usuarioId: number,
): Promise<MapaMecanografia> {
  const [progresos, perfil] = await Promise.all([
    prisma.typingProgress.findMany({ where: { usuarioId } }),
    prisma.typingProfile.findUnique({ where: { usuarioId } }),
  ]);

  const porClave = new Map(progresos.map((p) => [p.leccionClave, p]));

  const zonas = INFO_ZONAS.map((zona) => {
    const lecciones = LECCIONES.filter((l) => l.zona === zona.clave)
      .sort((a, b) => a.orden - b.orden)
      .map((leccion, indice, todas) => {
        const progreso = porClave.get(leccion.clave);
        const anterior = indice === 0 ? null : todas[indice - 1];
        const anteriorHecha = anterior ? (porClave.get(anterior.clave)?.completada ?? false) : true;

        return {
          clave: leccion.clave,
          zona: leccion.zona,
          orden: leccion.orden,
          nombre: leccion.nombre,
          teclasNuevas: leccion.teclasNuevas,
          consejo: leccion.consejo,
          caracteres: leccion.texto.length,
          estrellas: progreso?.estrellas ?? 0,
          mejorPpm: progreso?.mejorPpm ?? 0,
          mejorPrecision: progreso?.mejorPrecision ?? 0,
          completada: progreso?.completada ?? false,
          desbloqueada: indice === 0 || anteriorHecha,
        };
      });

    return {
      ...zona,
      lecciones,
      completadas: lecciones.filter((l) => l.completada).length,
      estrellas: lecciones.reduce((suma, l) => suma + l.estrellas, 0),
    };
  });

  const erroresPorTecla = leerErrores(perfil?.erroresPorTecla);
  const teclasDificiles = Object.entries(erroresPorTecla)
    .map(([tecla, errores]) => ({ tecla, errores }))
    .sort((a, b) => b.errores - a.errores)
    .slice(0, 5);

  return {
    zonas,
    resumen: {
      mejorPpm: perfil?.mejorPpm ?? 0,
      ultimaPpm: perfil?.ultimaPpm ?? 0,
      ultimaPrecision: perfil?.ultimaPrecision ?? 0,
      leccionesCompletadas: progresos.filter((p) => p.completada).length,
      leccionesTotales: LECCIONES.length,
      estrellas: progresos.reduce((suma, p) => suma + p.estrellas, 0),
      minutosPracticados: Math.round((perfil?.segundos ?? 0) / 60),
      teclasDificiles,
    },
  };
}

function leerErrores(valor: unknown): Record<string, number> {
  if (typeof valor !== 'object' || valor === null) return {};
  const salida: Record<string, number> = {};
  for (const [tecla, veces] of Object.entries(valor as Record<string, unknown>)) {
    // 10 y no 4: la clave del espacio es la palabra "espacio".
    if (typeof veces === 'number' && Number.isFinite(veces) && veces > 0 && tecla.length <= 10) {
      salida[tecla] = Math.round(veces);
    }
  }
  return salida;
}

// ──────────────────────────── Guardar un intento ───────────────────────────

export interface ResultadoGuardado {
  readonly ppm: number;
  readonly precision: number;
  readonly estrellas: number;
  readonly mejorPpm: number;
  readonly esRecord: boolean;
  readonly falta: { readonly falta: 'precision' | 'velocidad' | 'nada'; readonly objetivo: number };
  readonly insignias: readonly LogroConcedido[];
  readonly siguiente: string | null;
}

export async function guardarIntento(
  prisma: PrismaClient,
  usuarioId: number,
  leccionClave: string,
  intento: Intento & { erroresPorTecla: Record<string, number> },
): Promise<ResultadoGuardado> {
  const leccion = leccionPorClave(leccionClave);
  if (!leccion) throw new ErrorMecanografia('Esa leccion no existe', 404);

  if (!esCreible(intento, leccion.texto.length)) {
    throw new ErrorMecanografia('Ese resultado no es posible. Vuelve a intentarlo.', 422);
  }

  const medidas = medir(intento);
  const exigencia = { precision: leccion.precision, ppm: leccion.ppm };
  const estrellas = estrellasDe(medidas, exigencia);

  const anterior = await prisma.typingProgress.findUnique({
    where: { usuarioId_leccionClave: { usuarioId, leccionClave } },
  });

  // El mejor intento, no el ultimo.
  const mejorPpm = Math.max(anterior?.mejorPpm ?? 0, medidas.ppm);
  const mejorPrecision = Math.max(anterior?.mejorPrecision ?? 0, medidas.precision);
  const mejoresEstrellas = Math.max(anterior?.estrellas ?? 0, estrellas);

  await prisma.typingProgress.upsert({
    where: { usuarioId_leccionClave: { usuarioId, leccionClave } },
    create: {
      usuarioId,
      leccionClave,
      mejorPpm: medidas.ppm,
      mejorPrecision: medidas.precision,
      estrellas,
      intentos: 1,
      completada: estrellas > 0,
    },
    update: {
      mejorPpm,
      mejorPrecision,
      estrellas: mejoresEstrellas,
      intentos: { increment: 1 },
      completada: mejoresEstrellas > 0,
      ultimaVez: new Date(),
    },
  });

  const perfil = await actualizarPerfil(prisma, usuarioId, medidas, intento.erroresPorTecla);
  const insignias = await revisarInsignias(prisma, usuarioId, medidas);

  // Cual sigue: la siguiente de la misma zona, si existe.
  const deLaZona = LECCIONES.filter((l) => l.zona === leccion.zona).sort(
    (a, b) => a.orden - b.orden,
  );
  const indice = deLaZona.findIndex((l) => l.clave === leccionClave);
  const siguiente = estrellas > 0 ? (deLaZona[indice + 1]?.clave ?? null) : null;

  return {
    ppm: medidas.ppm,
    precision: medidas.precision,
    estrellas,
    mejorPpm: perfil.mejorPpm,
    esRecord: medidas.ppm > (anterior?.mejorPpm ?? 0) && medidas.ppm > 0,
    falta: queFalta(medidas, exigencia, estrellas),
    insignias,
    siguiente,
  };
}

/** Suma el intento al resumen del estudiante y acumula los errores por tecla. */
async function actualizarPerfil(
  prisma: PrismaClient,
  usuarioId: number,
  medidas: { ppm: number; precision: number; correctos: number; errores: number; segundos: number },
  erroresPorTecla: Record<string, number>,
): Promise<{ mejorPpm: number }> {
  const perfil = await prisma.typingProfile.findUnique({ where: { usuarioId } });
  const acumulados = leerErrores(perfil?.erroresPorTecla);

  for (const [tecla, veces] of Object.entries(erroresPorTecla)) {
    acumulados[tecla] = (acumulados[tecla] ?? 0) + veces;
  }

  const datos = {
    mejorPpm: Math.max(perfil?.mejorPpm ?? 0, medidas.ppm),
    ultimaPpm: medidas.ppm,
    ultimaPrecision: medidas.precision,
    pulsaciones: (perfil?.pulsaciones ?? 0) + medidas.correctos + medidas.errores,
    errores: (perfil?.errores ?? 0) + medidas.errores,
    segundos: (perfil?.segundos ?? 0) + medidas.segundos,
    erroresPorTecla: acumulados as unknown as Prisma.InputJsonValue,
  };

  const guardado = await prisma.typingProfile.upsert({
    where: { usuarioId },
    create: { usuarioId, ...datos },
    update: datos,
  });

  return { mejorPpm: guardado.mejorPpm };
}

/**
 * Insignias de mecanografía.
 *
 * Las de zona se conceden al terminar TODAS sus lecciones, contando filas en la
 * base y no lo que diga el navegador. La de velocidad pide además precisión: una
 * insignia por escribir rápido y mal enseñaría justo lo contrario.
 */
async function revisarInsignias(
  prisma: PrismaClient,
  usuarioId: number,
  medidas: { ppm: number; precision: number; errores: number },
): Promise<LogroConcedido[]> {
  const completadas = await prisma.typingProgress.findMany({
    where: { usuarioId, completada: true },
    select: { leccionClave: true },
  });
  const hechas = new Set(completadas.map((c) => c.leccionClave));
  const concedidas: LogroConcedido[] = [];

  for (const logro of LOGROS_TECLADO) {
    let cumple = false;

    if (logro.condicion.tipo === 'zona_mecanografia') {
      const deLaZona = LECCIONES.filter((l) => l.zona === logro.condicion.valor);
      cumple = deLaZona.length > 0 && deLaZona.every((l) => hechas.has(l.clave));
    } else if (logro.condicion.tipo === 'ppm') {
      // Velocidad, pero con la precision que se exige en la zona mas facil.
      cumple = medidas.ppm >= Number(logro.condicion.valor) && medidas.precision >= 90;
    } else if (logro.condicion.tipo === 'precision') {
      cumple = medidas.errores === 0 && medidas.precision === 100;
    }

    if (!cumple) continue;
    const dada = await conceder(prisma, usuarioId, logro.clave);
    if (dada?.esNuevo) concedidas.push(dada);
  }

  return concedidas;
}

/**
 * Guarda una partida de práctica.
 *
 * No da estrellas ni desbloquea nada: la práctica es para jugar. Lo único que
 * hace es sumar al resumen —minutos, pulsaciones, errores por tecla— porque esos
 * minutos son práctica de verdad y tienen que contar para las insignias de
 * velocidad y para lo que ve el docente.
 */
export async function guardarPractica(
  prisma: PrismaClient,
  usuarioId: number,
  intento: Intento & { erroresPorTecla?: Record<string, number> },
): Promise<{ ppm: number; precision: number; mejorPpm: number; insignias: readonly LogroConcedido[] }> {
  if (!esCreible(intento, Number.MAX_SAFE_INTEGER)) {
    throw new ErrorMecanografia('Ese resultado no es posible', 422);
  }

  const medidas = medir(intento);
  const perfil = await actualizarPerfil(prisma, usuarioId, medidas, intento.erroresPorTecla ?? {});
  const insignias = await revisarInsignias(prisma, usuarioId, medidas);

  return {
    ppm: medidas.ppm,
    precision: medidas.precision,
    mejorPpm: perfil.mejorPpm,
    insignias,
  };
}

// ──────────────────────────── Para el docente ──────────────────────────────

export interface FilaMecanografiaAula {
  readonly alumno: { readonly id: number; readonly nombre: string; readonly usuario: string };
  readonly leccionesCompletadas: number;
  readonly estrellas: number;
  readonly mejorPpm: number;
  readonly ultimaPrecision: number;
  readonly minutos: number;
  readonly teclasDificiles: readonly string[];
}

/**
 * El estado de mecanografía de un aula.
 *
 * Incluye a los estudiantes que **no** han empezado, con ceros. Es a propósito:
 * la lista sirve para saber a quién hay que animar, y quien no aparece no se ve.
 */
export async function mecanografiaDeAula(
  prisma: PrismaClient,
  aulaId: number,
): Promise<FilaMecanografiaAula[]> {
  const inscritos = await prisma.enrollment.findMany({
    where: { aulaId },
    select: { nino: { select: { id: true, nombre: true, usuario: true } } },
  });
  if (inscritos.length === 0) return [];

  const ids = inscritos.map((i) => i.nino.id);
  const [progresos, perfiles] = await Promise.all([
    prisma.typingProgress.findMany({ where: { usuarioId: { in: ids } } }),
    prisma.typingProfile.findMany({ where: { usuarioId: { in: ids } } }),
  ]);

  const porAlumno = new Map(perfiles.map((p) => [p.usuarioId, p]));

  return inscritos
    .map((inscrito) => {
      const suyos = progresos.filter((p) => p.usuarioId === inscrito.nino.id);
      const perfil = porAlumno.get(inscrito.nino.id);
      const errores = leerErrores(perfil?.erroresPorTecla);

      return {
        alumno: inscrito.nino,
        leccionesCompletadas: suyos.filter((p) => p.completada).length,
        estrellas: suyos.reduce((suma, p) => suma + p.estrellas, 0),
        mejorPpm: perfil?.mejorPpm ?? 0,
        ultimaPrecision: perfil?.ultimaPrecision ?? 0,
        minutos: Math.round((perfil?.segundos ?? 0) / 60),
        teclasDificiles: Object.entries(errores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tecla]) => tecla),
      };
    })
    .sort((a, b) => b.leccionesCompletadas - a.leccionesCompletadas);
}
