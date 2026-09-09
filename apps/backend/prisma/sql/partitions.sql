-- ═══════════════════════════════════════════════════════════════════════════
--  Particionado de telemetria y metricas  (PostgreSQL 15)
--
--  Prisma no sabe emitir `PARTITION BY`, asi que este archivo es la fuente de
--  verdad y su contenido se PEGA en la migracion generada con:
--      npm run prisma:migrate:create -w @codenest/backend -- --name init
--
--  Pasos exactos sobre el migration.sql generado:
--   1. Sustituir los tres `CREATE TABLE` de telemetria / metricas_* por sus
--      versiones de este archivo (con PARTITION BY y PK compuesta).
--   2. Pegar al final las funciones, la particion DEFAULT y las particiones
--      del ano en curso.
--
--  ⚠ `prisma db push` esta prohibido en este proyecto: recrearia estas tablas
--    sin particionar y sin avisar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── 1. Tablas particionadas ──────────────────────

CREATE TABLE "telemetria" (
    "id"           BIGSERIAL,
    "usuario_id"   INTEGER      NOT NULL,
    "actividad_id" INTEGER,
    "sesion_id"    INTEGER,
    "evento"       VARCHAR(60)  NOT NULL,
    "datos"        JSONB,
    "creado_en"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telemetria_pkey" PRIMARY KEY ("id", "creado_en")
) PARTITION BY RANGE ("creado_en");

CREATE INDEX "idx_telemetria_usuario"   ON "telemetria" ("usuario_id", "creado_en");
CREATE INDEX "idx_telemetria_actividad" ON "telemetria" ("actividad_id", "creado_en");
CREATE INDEX "idx_telemetria_evento"    ON "telemetria" ("evento", "creado_en");

CREATE TABLE "metricas_actividad_diaria" (
    "actividad_id"        INTEGER      NOT NULL,
    "fecha"               DATE         NOT NULL,
    "intentos"            INTEGER      NOT NULL DEFAULT 0,
    "completadas"         INTEGER      NOT NULL DEFAULT 0,
    "estrellas_promedio"  DECIMAL(4,2) NOT NULL DEFAULT 0,
    "tiempo_promedio_seg" INTEGER      NOT NULL DEFAULT 0,
    "pistas_usadas"       INTEGER      NOT NULL DEFAULT 0,
    "errores_comunes"     JSONB,
    CONSTRAINT "metricas_actividad_diaria_pkey" PRIMARY KEY ("actividad_id", "fecha")
) PARTITION BY RANGE ("fecha");

CREATE INDEX "idx_metricas_actividad_fecha" ON "metricas_actividad_diaria" ("fecha");

CREATE TABLE "metricas_usuario_diaria" (
    "usuario_id"             INTEGER NOT NULL,
    "fecha"                  DATE    NOT NULL,
    "tiempo_seg"             INTEGER NOT NULL DEFAULT 0,
    "actividades_completadas" INTEGER NOT NULL DEFAULT 0,
    "estrellas"              INTEGER NOT NULL DEFAULT 0,
    "monedas"                INTEGER NOT NULL DEFAULT 0,
    "sesiones"               INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "metricas_usuario_diaria_pkey" PRIMARY KEY ("usuario_id", "fecha")
) PARTITION BY RANGE ("fecha");

CREATE INDEX "idx_metricas_usuario_fecha" ON "metricas_usuario_diaria" ("fecha");

-- ──────────────── 2. Particiones DEFAULT (red de seguridad) ───────────────
-- Sin ellas, un INSERT fuera de todo rango falla y se pierde el evento.
-- Si acumulan filas de un mes, hay que moverlas antes de crear su particion.

CREATE TABLE IF NOT EXISTS "telemetria_default"
    PARTITION OF "telemetria" DEFAULT;
CREATE TABLE IF NOT EXISTS "metricas_actividad_diaria_default"
    PARTITION OF "metricas_actividad_diaria" DEFAULT;
CREATE TABLE IF NOT EXISTS "metricas_usuario_diaria_default"
    PARTITION OF "metricas_usuario_diaria" DEFAULT;

-- ─────────────── 3. Creacion idempotente de particiones mensuales ─────────

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

-- Particiones de los proximos 12 meses para las tres tablas.
SELECT crear_particion_mes(
           t,
           (date_trunc('month', CURRENT_DATE) + (n || ' month')::interval)::date
       )
FROM   unnest(ARRAY['telemetria',
                    'metricas_actividad_diaria',
                    'metricas_usuario_diaria']) AS t,
       generate_series(0, 11) AS n;

-- ─────────── 4. Coherencia del numero global de actividad (1-600) ─────────
-- numero_global = (mundo.numero - 1) * 20 + numero_en_mundo.
-- El CHECK cubre el rango; el seed valida la formula completa.

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

-- ──────────────── 5. Vista de progreso por aula (panel docente) ───────────
-- Portada de Codexia (database/schema.sql:227) y adaptada al nuevo esquema.

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
