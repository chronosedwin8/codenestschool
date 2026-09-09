/**
 * Convierte en PARTICIONADAS las tres tablas de telemetria/metricas dentro de
 * una migracion generada por `prisma migrate dev --create-only`.
 *
 * Prisma no sabe emitir `PARTITION BY`, asi que este paso es obligatorio y
 * debe repetirse si alguna vez se regenera la migracion inicial.
 * La fuente de verdad del SQL añadido es prisma/sql/partitions.sql.
 *
 * Uso:  node scripts/patch-partition-migration.mjs [<carpeta_de_migracion>]
 *       (sin argumento toma la migracion mas reciente)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '..', 'prisma', 'migrations');
const MARCA = '-- === PARTICIONADO CodeNest (patch-partition-migration.mjs) ===';

/** Tablas a particionar y su clave de rango. */
const PARTICIONADAS = [
  { tabla: 'telemetria', clave: 'creado_en' },
  { tabla: 'metricas_actividad_diaria', clave: 'fecha' },
  { tabla: 'metricas_usuario_diaria', clave: 'fecha' },
];

function ultimaMigracion() {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const ultima = dirs.at(-1);
  if (!ultima) throw new Error('No hay migraciones en prisma/migrations');
  return ultima;
}

/**
 * Añade `PARTITION BY RANGE (clave)` al CREATE TABLE de una tabla.
 * Localiza el parentesis de cierre que corresponde al de apertura para no
 * romperse con los parentesis de DECIMAL(4,2) o VARCHAR(60).
 */
function particionar(sql, tabla, clave) {
  const inicio = sql.indexOf(`CREATE TABLE "${tabla}" (`);
  if (inicio === -1) {
    throw new Error(`No se encontro CREATE TABLE "${tabla}" en la migracion`);
  }
  let i = sql.indexOf('(', inicio);
  let nivel = 0;
  for (; i < sql.length; i++) {
    if (sql[i] === '(') nivel++;
    else if (sql[i] === ')') {
      nivel--;
      if (nivel === 0) break;
    }
  }
  const cierre = i; // indice del ')' que cierra la definicion
  const resto = sql.slice(cierre + 1);
  if (!resto.startsWith(';')) {
    throw new Error(`Formato inesperado tras el CREATE TABLE de "${tabla}"`);
  }
  return `${sql.slice(0, cierre + 1)} PARTITION BY RANGE ("${clave}")${resto}`;
}

const sqlExtra = `
${MARCA}
-- Generado a partir de prisma/sql/partitions.sql. No editar a mano:
-- reejecutar scripts/patch-partition-migration.mjs si se regenera la migracion.

-- 1. Particiones DEFAULT: red de seguridad para que ningun INSERT falle.
CREATE TABLE IF NOT EXISTS "telemetria_default"
    PARTITION OF "telemetria" DEFAULT;
CREATE TABLE IF NOT EXISTS "metricas_actividad_diaria_default"
    PARTITION OF "metricas_actividad_diaria" DEFAULT;
CREATE TABLE IF NOT EXISTS "metricas_usuario_diaria_default"
    PARTITION OF "metricas_usuario_diaria" DEFAULT;

-- 2. Creacion idempotente de particiones mensuales.
CREATE OR REPLACE FUNCTION crear_particion_mes(tabla text, mes date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    ini    date := date_trunc('month', mes)::date;
    fin    date := (date_trunc('month', mes) + interval '1 month')::date;
    nombre text := format('%s_%s', tabla, to_char(ini, 'YYYY_MM'));
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        nombre, tabla, ini, fin
    );
END;
$$;

COMMENT ON FUNCTION crear_particion_mes(text, date) IS
    'Crea (si falta) la particion mensual de una tabla particionada por rango. La invoca scripts/ensure-partitions.ts en cada arranque del backend.';

-- 3. Particiones de los proximos 12 meses.
SELECT crear_particion_mes(
           t,
           (date_trunc('month', CURRENT_DATE) + (n || ' month')::interval)::date
       )
FROM   unnest(ARRAY['telemetria',
                    'metricas_actividad_diaria',
                    'metricas_usuario_diaria']) AS t,
       generate_series(0, 11) AS n;

-- 4. Coherencia del curriculo (30 mundos x 20 actividades = 600).
ALTER TABLE "actividades"
    ADD CONSTRAINT "chk_actividades_numero_global"
    CHECK ("numero_global" BETWEEN 1 AND 600);

ALTER TABLE "actividades"
    ADD CONSTRAINT "chk_actividades_numero_en_mundo"
    CHECK ("numero_en_mundo" BETWEEN 1 AND 20);

ALTER TABLE "mundos"
    ADD CONSTRAINT "chk_mundos_numero"
    CHECK ("numero" BETWEEN 1 AND 30);

ALTER TABLE "sesiones_actividad"
    ADD CONSTRAINT "chk_sesiones_estrellas"
    CHECK ("estrellas" BETWEEN 0 AND 3);

ALTER TABLE "progreso_actividad"
    ADD CONSTRAINT "chk_progreso_estrellas"
    CHECK ("mejor_estrellas" BETWEEN 0 AND 3);

-- 5. Vista de progreso por aula (panel docente del portal).
CREATE OR REPLACE VIEW v_progreso_aula AS
SELECT
    i.aula_id,
    u.id                                              AS nino_id,
    u.nombre                                          AS nino_nombre,
    u.grupo_edad,
    COUNT(DISTINCT p.actividad_id)
        FILTER (WHERE p.completada)                   AS actividades_completadas,
    COALESCE(SUM(p.mejor_estrellas), 0)               AS total_estrellas,
    COALESCE(SUM(p.intentos_totales), 0)              AS intentos_totales,
    u.monedas                                         AS monedas_actuales,
    u.racha_dias,
    COUNT(DISTINCT e.id) FILTER (WHERE e.editor = 'comandos') AS envios_fichas,
    COUNT(DISTINCT e.id) FILTER (WHERE e.editor = 'bloques')  AS envios_bloques,
    COUNT(DISTINCT e.id) FILTER (WHERE e.editor = 'texto')    AS envios_texto,
    MAX(p.ultima_vez)                                 AS ultima_actividad
FROM        inscripciones      i
JOIN        usuarios           u ON u.id = i.nino_id
LEFT JOIN   progreso_actividad p ON p.usuario_id = u.id
LEFT JOIN   envios_codigo      e ON e.usuario_id = u.id
GROUP BY    i.aula_id, u.id, u.nombre, u.grupo_edad, u.monedas, u.racha_dias;

COMMENT ON VIEW v_progreso_aula IS
    'Progreso agregado por estudiante y aula. La consume el panel docente del portal del cliente.';
`;

const carpeta = process.argv[2] ?? ultimaMigracion();
const ruta = join(MIGRATIONS_DIR, carpeta, 'migration.sql');
if (!existsSync(ruta)) throw new Error(`No existe ${ruta}`);

let sql = readFileSync(ruta, 'utf8');

if (sql.includes(MARCA)) {
  console.log(`= ${carpeta}/migration.sql ya estaba parcheada; no se toca.`);
  process.exit(0);
}

for (const { tabla, clave } of PARTICIONADAS) {
  sql = particionar(sql, tabla, clave);
  console.log(`+ "${tabla}" ahora es PARTITION BY RANGE ("${clave}")`);
}

sql = `${sql.trimEnd()}\n${sqlExtra}`;
writeFileSync(ruta, sql, 'utf8');

console.log(`+ particiones DEFAULT, crear_particion_mes(), 12 meses, CHECKs y v_progreso_aula`);
console.log(`OK ${carpeta}/migration.sql parcheada.`);
