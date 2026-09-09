/**
 * Garantiza que existan las particiones mensuales de telemetria y metricas.
 *
 * Se ejecuta:
 *  - al arrancar el backend (apps/backend/src/server.ts, FASE 1.5),
 *  - manualmente con `npm run partitions -w @codenest/backend`,
 *  - en un cron mensual en produccion.
 *
 * Es idempotente: `crear_particion_mes` usa CREATE TABLE IF NOT EXISTS.
 * Crea siempre unos meses por delante para que un pico de trafico a fin de mes
 * no caiga en la particion DEFAULT.
 */
import { PrismaClient } from '@prisma/client';

/** Tablas particionadas por rango mensual. */
const TABLAS_PARTICIONADAS = [
  'telemetria',
  'metricas_actividad_diaria',
  'metricas_usuario_diaria',
] as const;

/** Cuantos meses por delante se aseguran en cada ejecucion. */
export const MESES_POR_DELANTE = 3;

export interface ResultadoParticiones {
  readonly tabla: string;
  readonly particiones: number;
  readonly enDefault: number;
}

/**
 * Crea las particiones que falten y devuelve el estado de cada tabla.
 * `enDefault` mayor que cero significa que hubo inserciones fuera de rango:
 * hay que reubicarlas antes de poder crear la particion de ese mes.
 */
export async function asegurarParticiones(
  prisma: PrismaClient,
  mesesPorDelante: number = MESES_POR_DELANTE,
): Promise<ResultadoParticiones[]> {
  const resultados: ResultadoParticiones[] = [];

  for (const tabla of TABLAS_PARTICIONADAS) {
    for (let n = 0; n <= mesesPorDelante; n++) {
      await prisma.$executeRawUnsafe(
        `SELECT crear_particion_mes($1, (date_trunc('month', CURRENT_DATE) + ($2 || ' month')::interval)::date)`,
        tabla,
        String(n),
      );
    }

    const [conteo] = await prisma.$queryRawUnsafe<{ particiones: bigint }[]>(
      `SELECT count(*)::bigint AS particiones FROM pg_inherits WHERE inhparent = $1::regclass`,
      tabla,
    );

    const [enDefault] = await prisma.$queryRawUnsafe<{ filas: bigint }[]>(
      `SELECT count(*)::bigint AS filas FROM ${tabla}_default`,
    );

    resultados.push({
      tabla,
      particiones: Number(conteo?.particiones ?? 0),
      enDefault: Number(enDefault?.filas ?? 0),
    });
  }

  return resultados;
}

/** Ejecucion directa por linea de comandos. */
const esEjecucionDirecta = process.argv[1]?.includes('ensure-partitions');

if (esEjecucionDirecta) {
  const prisma = new PrismaClient();
  try {
    const resultados = await asegurarParticiones(prisma);
    for (const r of resultados) {
      const aviso =
        r.enDefault > 0
          ? `  [ATENCION] ${r.enDefault} fila(s) en la particion DEFAULT: reubicar antes de crear su mes`
          : '';
      console.log(`OK ${r.tabla}: ${r.particiones} particiones${aviso}`);
    }
    console.log('\nParticiones aseguradas.');
  } catch (error) {
    console.error('FALLO al asegurar particiones:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
