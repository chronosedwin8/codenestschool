/**
 * Diplomas de constructor de juegos.
 *
 * Lo que convierte un diploma en un diploma, y no en un dibujo bonito, es que se
 * pueda comprobar: cada uno lleva un código como `CDX-7F3K-9QA2` y una dirección
 * pública donde cualquiera —la familia, el colegio— puede verificar que existe,
 * a nombre de quién y por qué juego.
 *
 * Dos decisiones sobre el código:
 *
 *  - Se generan con `randomBytes`, no con un contador. Un `CDX-0001` invita a
 *    probar el `0002`, y entonces la dirección de verificación se convierte en un
 *    listado de nombres de menores para cualquiera que sepa contar.
 *  - Del alfabeto se quitan las letras y cifras que se confunden al leerlas en
 *    voz alta o al copiarlas de una hoja impresa: 0/O, 1/I/L, 5/S, 2/Z.
 */
import { randomInt } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY3467689';
const BLOQUES = 2;
const LARGO_BLOQUE = 4;

export interface DiplomaEmitido {
  readonly codigo: string;
  readonly nombreAlumno: string;
  readonly tituloJuego: string;
  readonly emitidoEn: Date;
  readonly esNuevo: boolean;
}

function bloqueAlAzar(): string {
  let salida = '';
  for (let i = 0; i < LARGO_BLOQUE; i++) salida += ALFABETO[randomInt(ALFABETO.length)];
  return salida;
}

export function generarCodigo(): string {
  return `CDX-${Array.from({ length: BLOQUES }, bloqueAlAzar).join('-')}`;
}

/**
 * Emite el diploma de un proyecto, o devuelve el que ya tenía.
 *
 * Un proyecto tiene un diploma y solo uno (`proyectoId` es único): publicar,
 * despublicar y volver a publicar no reparte diplomas nuevos. El primero ya
 * decía la verdad.
 */
export async function emitirDiploma(
  prisma: PrismaClient,
  datos: {
    alumnoId: number;
    proyectoId: number;
    nombreAlumno: string;
    tituloJuego: string;
  },
): Promise<DiplomaEmitido> {
  const existente = await prisma.diploma.findUnique({ where: { proyectoId: datos.proyectoId } });
  if (existente) {
    return {
      codigo: existente.codigo,
      nombreAlumno: existente.nombreAlumno,
      tituloJuego: existente.tituloJuego,
      emitidoEn: existente.emitidoEn,
      esNuevo: false,
    };
  }

  // Un choque de código es improbable (27^8) pero no imposible, y la columna es
  // única: se reintenta en lugar de devolverle un error al estudiante.
  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigo();
    try {
      const fila = await prisma.diploma.create({
        data: {
          codigo,
          alumnoId: datos.alumnoId,
          proyectoId: datos.proyectoId,
          nombreAlumno: datos.nombreAlumno,
          tituloJuego: datos.tituloJuego,
        },
      });
      return {
        codigo: fila.codigo,
        nombreAlumno: fila.nombreAlumno,
        tituloJuego: fila.tituloJuego,
        emitidoEn: fila.emitidoEn,
        esNuevo: true,
      };
    } catch (error) {
      const codigoPrisma = (error as { code?: string }).code;
      if (codigoPrisma !== 'P2002') throw error;
      // Si el choque fue por `proyectoId`, el diploma ya existe: se devuelve.
      const otro = await prisma.diploma.findUnique({ where: { proyectoId: datos.proyectoId } });
      if (otro) {
        return {
          codigo: otro.codigo,
          nombreAlumno: otro.nombreAlumno,
          tituloJuego: otro.tituloJuego,
          emitidoEn: otro.emitidoEn,
          esNuevo: false,
        };
      }
    }
  }

  throw new Error('No se pudo emitir el diploma: demasiados codigos repetidos');
}

export interface DiplomaPublico {
  readonly codigo: string;
  readonly nombreAlumno: string;
  readonly tituloJuego: string;
  readonly emitidoEn: Date;
  /** El juego, si sigue publicado; null si el estudiante lo retiró. */
  readonly proyectoId: number | null;
}

/**
 * Verificación pública de un diploma.
 *
 * Sin sesión, porque el sentido de un diploma es poder mostrarlo. Lo que sale de
 * aquí es exactamente lo que ya está impreso en el propio diploma —nombre, juego
 * y fecha— y nada más: ni el usuario del niño, ni su aula, ni su edad.
 */
export async function verificarDiploma(
  prisma: PrismaClient,
  codigo: string,
): Promise<DiplomaPublico | null> {
  const fila = await prisma.diploma.findUnique({
    where: { codigo: codigo.trim().toUpperCase() },
    include: { proyecto: { select: { id: true, estado: true } } },
  });
  if (!fila) return null;

  return {
    codigo: fila.codigo,
    nombreAlumno: fila.nombreAlumno,
    tituloJuego: fila.tituloJuego,
    emitidoEn: fila.emitidoEn,
    proyectoId: fila.proyecto.estado === 'publicado' ? fila.proyecto.id : null,
  };
}

/** Los diplomas de un estudiante, para su perfil. */
export async function diplomasDe(
  prisma: PrismaClient,
  alumnoId: number,
): Promise<{ codigo: string; tituloJuego: string; emitidoEn: Date; proyectoId: number }[]> {
  const filas = await prisma.diploma.findMany({
    where: { alumnoId },
    orderBy: { emitidoEn: 'desc' },
    select: { codigo: true, tituloJuego: true, emitidoEn: true, proyectoId: true },
  });
  return filas;
}
