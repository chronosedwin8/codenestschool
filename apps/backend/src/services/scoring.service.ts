/**
 * Puntuacion: el servidor decide, el cliente propone.
 *
 * El navegador envia las ACCIONES que dice haber ejecutado. Aqui se reproducen
 * sobre el tablero real con el simulador compartido; si no encajan, el intento
 * no vale. Nunca se ejecuta el codigo del alumno en el servidor.
 */
import type { PrismaClient } from '@prisma/client';

import {
  calcularEstrellas,
  evaluarObjetivos,
  monedasPorEstrellas,
  type Accion,
  type ActivityConfigV3,
  type MedidasPrograma,
} from '@codenest/shared';

export interface ResultadoIntento {
  readonly estrellas: number;
  readonly monedasGanadas: number;
  readonly objetivos: Readonly<Record<string, boolean>>;
  readonly valido: boolean;
  readonly mensaje: string;
}

/**
 * Evalua un intento y devuelve las estrellas y monedas que corresponden.
 * `tamanoPrograma` lo mide el cliente sobre el programa escrito (fichas,
 * bloques o lineas), pero solo puede perjudicarle: sirve para exigir eficiencia,
 * nunca para conceder mas estrellas de las que dan los objetivos cumplidos.
 */
export function evaluarIntento(
  config: ActivityConfigV3,
  acciones: readonly Accion[],
  medidas: MedidasPrograma,
): ResultadoIntento {
  const opciones = {
    grid: config.grid,
    spawn: config.spawn,
    items: config.items,
    modo: config.modoMovimiento,
    comandosPermitidos: config.comandosPermitidos,
    topeEjecucion: config.topeEjecucion,
  };

  const resultado = evaluarObjetivos(opciones, acciones, config.objetivos, config.items);

  if (!resultado.valida) {
    return {
      estrellas: 0,
      monedasGanadas: 0,
      objetivos: resultado.cumplidos,
      valido: false,
      mensaje: 'El intento no se pudo verificar en el servidor',
    };
  }

  const estrellas = calcularEstrellas(config.criteriosEstrella, resultado.cumplidos, medidas);
  const obligatoriosOk = config.objetivos
    .filter((o) => o.obligatorio)
    .every((o) => resultado.cumplidos[o.id]);

  return {
    estrellas,
    monedasGanadas: monedasPorEstrellas(config.recompensa.monedas, estrellas),
    objetivos: resultado.cumplidos,
    valido: true,
    mensaje: obligatoriosOk ? 'Actividad superada' : 'Faltan objetivos obligatorios',
  };
}

/**
 * Registra el resultado de un intento: actualiza la sesion, el progreso
 * historico y el saldo del nino, todo en una transaccion.
 *
 * Las monedas solo se pagan por la mejora: si el nino repite una actividad que
 * ya tenia dos estrellas y ahora saca tres, cobra la diferencia. Asi no se
 * puede farmear repitiendo el mismo nivel.
 */
export async function registrarIntento(
  prisma: PrismaClient,
  parametros: {
    usuarioId: number;
    actividadId: number;
    sesionId: number;
    resultado: ResultadoIntento;
    tiempoSegundos: number;
    monedasBase: number;
  },
): Promise<{ estrellas: number; monedasPagadas: number; monedasTotales: number }> {
  const { usuarioId, actividadId, sesionId, resultado, tiempoSegundos, monedasBase } = parametros;

  return prisma.$transaction(async (tx) => {
    const previo = await tx.userActivityProgress.findUnique({
      where: { usuarioId_actividadId: { usuarioId, actividadId } },
    });

    const mejorAnterior = previo?.mejorEstrellas ?? 0;
    const mejorAhora = Math.max(mejorAnterior, resultado.estrellas);

    // Se paga solo la mejora respecto al mejor resultado anterior.
    const monedasPagadas =
      monedasPorEstrellas(monedasBase, mejorAhora) - monedasPorEstrellas(monedasBase, mejorAnterior);

    await tx.userActivityProgress.upsert({
      where: { usuarioId_actividadId: { usuarioId, actividadId } },
      update: {
        mejorEstrellas: mejorAhora,
        completada: previo?.completada || resultado.estrellas > 0,
        intentosTotales: { increment: 1 },
      },
      create: {
        usuarioId,
        actividadId,
        mejorEstrellas: resultado.estrellas,
        completada: resultado.estrellas > 0,
        intentosTotales: 1,
      },
    });

    await tx.activitySession.update({
      where: { id: sesionId },
      data: {
        completada: resultado.estrellas > 0,
        estrellas: resultado.estrellas,
        monedasGanadas: monedasPagadas,
        tiempoSegundos,
        completadaEn: resultado.estrellas > 0 ? new Date() : null,
        intentos: { increment: 1 },
      },
    });

    const usuario = await tx.user.update({
      where: { id: usuarioId },
      data: {
        monedas: { increment: monedasPagadas },
        estrellasTotales: { increment: Math.max(0, mejorAhora - mejorAnterior) },
        ultimaActividad: new Date(),
      },
      select: { monedas: true },
    });

    return { estrellas: resultado.estrellas, monedasPagadas, monedasTotales: usuario.monedas };
  });
}
