/**
 * Consolida la telemetría del día en las tablas de métricas.
 *
 * Existe porque las consultas del panel docente no pueden agregar sobre la
 * telemetría cruda: con 600 actividades y un colegio entero jugando, eso son
 * millones de filas y una espera inaceptable al abrir el panel.
 *
 * El día se calcula en la zona horaria de Colombia, no en UTC. Sin eso, la
 * partida de un niño a las ocho de la noche contaría como del día siguiente y
 * los informes semanales que ve el docente estarían desplazados.
 *
 * Es idempotente: volver a ejecutarlo para el mismo día recalcula, no duplica.
 *
 * Uso:  npm run metrics:rollup                 (día de ayer y de hoy)
 *       npm run metrics:rollup -- 2026-09-08   (un día concreto)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Zona horaria del proyecto. Determina dónde empieza y acaba cada día. */
const ZONA = 'America/Bogota';

export interface ResultadoRollup {
  readonly fecha: string;
  readonly actividades: number;
  readonly usuarios: number;
}

/**
 * Recalcula las métricas de un día.
 *
 * Las dos consultas usan `AT TIME ZONE` para agrupar por el día local, y
 * `ON CONFLICT` para poder ejecutarse tantas veces como haga falta.
 */
export async function consolidarDia(fecha: string): Promise<ResultadoRollup> {
  // Métricas por actividad: lo que alimenta la vista del docente.
  const actividades = await prisma.$executeRawUnsafe(
    `
    INSERT INTO metricas_actividad_diaria
      (actividad_id, fecha, intentos, completadas, estrellas_promedio,
       tiempo_promedio_seg, pistas_usadas, errores_comunes)
    SELECT
      s.actividad_id,
      $1::date,
      count(*)                                              AS intentos,
      count(*) FILTER (WHERE s.completada)                  AS completadas,
      coalesce(round(avg(s.estrellas)::numeric, 2), 0)      AS estrellas_promedio,
      coalesce(round(avg(s.tiempo_segundos))::int, 0)       AS tiempo_promedio_seg,
      coalesce(sum(s.pistas_usadas), 0)                     AS pistas_usadas,
      '{}'::jsonb                                           AS errores_comunes
    FROM   sesiones_actividad s
    WHERE  (s.iniciada_en AT TIME ZONE $2)::date = $1::date
    GROUP  BY s.actividad_id
    ON CONFLICT (actividad_id, fecha) DO UPDATE SET
      intentos            = EXCLUDED.intentos,
      completadas         = EXCLUDED.completadas,
      estrellas_promedio  = EXCLUDED.estrellas_promedio,
      tiempo_promedio_seg = EXCLUDED.tiempo_promedio_seg,
      pistas_usadas       = EXCLUDED.pistas_usadas
    `,
    fecha,
    ZONA,
  );

  // Métricas por niño: lo que ve el tutor en el portal.
  const usuarios = await prisma.$executeRawUnsafe(
    `
    INSERT INTO metricas_usuario_diaria
      (usuario_id, fecha, tiempo_seg, actividades_completadas, estrellas, monedas, sesiones)
    SELECT
      s.usuario_id,
      $1::date,
      coalesce(sum(s.tiempo_segundos), 0)                   AS tiempo_seg,
      count(*) FILTER (WHERE s.completada)                  AS actividades_completadas,
      coalesce(sum(s.estrellas), 0)                         AS estrellas,
      coalesce(sum(s.monedas_ganadas), 0)                   AS monedas,
      count(*)                                              AS sesiones
    FROM   sesiones_actividad s
    WHERE  (s.iniciada_en AT TIME ZONE $2)::date = $1::date
    GROUP  BY s.usuario_id
    ON CONFLICT (usuario_id, fecha) DO UPDATE SET
      tiempo_seg              = EXCLUDED.tiempo_seg,
      actividades_completadas = EXCLUDED.actividades_completadas,
      estrellas               = EXCLUDED.estrellas,
      monedas                 = EXCLUDED.monedas,
      sesiones                = EXCLUDED.sesiones
    `,
    fecha,
    ZONA,
  );

  return { fecha, actividades, usuarios };
}

/**
 * Actualiza los errores más frecuentes de cada actividad de ese día.
 * Se hace aparte porque agrupa por el contenido del JSON de telemetría.
 */
export async function consolidarErrores(fecha: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `
    WITH conteo AS (
      SELECT actividad_id,
             coalesce(datos->>'codigo', 'otro') AS codigo,
             count(*) AS veces
      FROM   telemetria
      WHERE  evento = 'error_sandbox'
        AND  actividad_id IS NOT NULL
        AND  (creado_en AT TIME ZONE $2)::date = $1::date
      GROUP  BY actividad_id, coalesce(datos->>'codigo', 'otro')
    ),
    agregado AS (
      SELECT actividad_id, jsonb_object_agg(codigo, veces) AS errores
      FROM   conteo
      GROUP  BY actividad_id
    )
    UPDATE metricas_actividad_diaria m
    SET    errores_comunes = a.errores
    FROM   agregado a
    WHERE  m.actividad_id = a.actividad_id
      AND  m.fecha = $1::date
    `,
    fecha,
    ZONA,
  );
}

/** Fecha de hoy en la zona del proyecto, en formato ISO. */
function hoyLocal(desplazamientoDias = 0): string {
  const ahora = new Date();
  ahora.setDate(ahora.getDate() + desplazamientoDias);
  // `en-CA` da el formato AAAA-MM-DD, que es lo que espera PostgreSQL.
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA });
}

const esEjecucionDirecta = process.argv[1]?.includes('rollup-metrics');

if (esEjecucionDirecta) {
  const argumento = process.argv[2];
  // Por defecto se recalculan ayer y hoy: ayer puede haber cerrado tarde.
  const fechas = argumento ? [argumento] : [hoyLocal(-1), hoyLocal()];

  try {
    for (const fecha of fechas) {
      const resultado = await consolidarDia(fecha);
      const errores = await consolidarErrores(fecha);
      console.log(
        `OK ${resultado.fecha}: ${resultado.actividades} actividad(es), ` +
          `${resultado.usuarios} usuario(s), ${errores} con errores registrados`,
      );
    }
    console.log('\nMetricas consolidadas.');
  } catch (error) {
    console.error('FALLO al consolidar metricas:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
