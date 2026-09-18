-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "estado_factura" AS ENUM ('emitida', 'anulada');

-- CreateEnum
CREATE TYPE "estado_cotizacion" AS ENUM ('borrador', 'enviada', 'aceptada', 'pagada', 'anulada');

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_licencia_id_fkey";

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "aprobado_en" TIMESTAMPTZ(6),
ADD COLUMN     "cotizacion_id" INTEGER,
ADD COLUMN     "cuotas" INTEGER,
ADD COLUMN     "origen" VARCHAR(20) NOT NULL DEFAULT 'mercadopago',
ADD COLUMN     "referencia_manual" VARCHAR(120),
ADD COLUMN     "registrado_por_id" INTEGER,
ADD COLUMN     "tipo_medio" VARCHAR(30),
ADD COLUMN     "usuario_id" INTEGER,
ALTER COLUMN "licencia_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "facturas" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "prefijo" VARCHAR(10) NOT NULL DEFAULT 'FAC',
    "estado" "estado_factura" NOT NULL DEFAULT 'emitida',
    "fecha_emision" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE,
    "usuario_id" INTEGER,
    "emisor" JSONB NOT NULL,
    "cliente" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal_cop" INTEGER NOT NULL,
    "descuento_cop" INTEGER NOT NULL DEFAULT 0,
    "iva_porcentaje" INTEGER NOT NULL DEFAULT 0,
    "iva_cop" INTEGER NOT NULL DEFAULT 0,
    "total_cop" INTEGER NOT NULL,
    "notas" TEXT,
    "pago_id" INTEGER,
    "cotizacion_id" INTEGER,
    "token_publico" VARCHAR(64) NOT NULL,
    "anulada_en" TIMESTAMPTZ(6),
    "motivo_anulacion" TEXT,
    "creado_por_id" INTEGER,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "prefijo" VARCHAR(10) NOT NULL DEFAULT 'COT',
    "estado" "estado_cotizacion" NOT NULL DEFAULT 'borrador',
    "fecha_emision" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valida_hasta" DATE NOT NULL,
    "usuario_id" INTEGER,
    "plan_id" INTEGER,
    "emisor" JSONB NOT NULL,
    "cliente" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal_cop" INTEGER NOT NULL,
    "descuento_cop" INTEGER NOT NULL DEFAULT 0,
    "iva_porcentaje" INTEGER NOT NULL DEFAULT 0,
    "iva_cop" INTEGER NOT NULL DEFAULT 0,
    "total_cop" INTEGER NOT NULL,
    "notas" TEXT,
    "condiciones" TEXT,
    "token_publico" VARCHAR(64) NOT NULL,
    "url_pago" TEXT,
    "pagada_en" TIMESTAMPTZ(6),
    "licencia_id" INTEGER,
    "anulada_en" TIMESTAMPTZ(6),
    "motivo_anulacion" TEXT,
    "creado_por_id" INTEGER,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes" (
    "clave" VARCHAR(60) NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "consecutivos" (
    "clave" VARCHAR(40) NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consecutivos_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_numero_key" ON "facturas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_pago_id_key" ON "facturas"("pago_id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_token_publico_key" ON "facturas"("token_publico");

-- CreateIndex
CREATE INDEX "facturas_usuario_id_idx" ON "facturas"("usuario_id");

-- CreateIndex
CREATE INDEX "facturas_fecha_emision_idx" ON "facturas"("fecha_emision");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_numero_key" ON "cotizaciones"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_token_publico_key" ON "cotizaciones"("token_publico");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_licencia_id_key" ON "cotizaciones"("licencia_id");

-- CreateIndex
CREATE INDEX "cotizaciones_usuario_id_idx" ON "cotizaciones"("usuario_id");

-- CreateIndex
CREATE INDEX "cotizaciones_estado_idx" ON "cotizaciones"("estado");

-- CreateIndex
CREATE INDEX "pagos_cotizacion_id_idx" ON "pagos"("cotizacion_id");

-- CreateIndex
CREATE INDEX "pagos_usuario_id_idx" ON "pagos"("usuario_id");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_licencia_id_fkey" FOREIGN KEY ("licencia_id") REFERENCES "licencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Relleno de lo que ya existia ───────────────────────────────────────────
-- Los pagos anteriores no sabian de quien eran: su dueno es el titular de la
-- licencia que pagaron. Sin esto, el historial del portal saldria vacio para
-- quien ya habia pagado.
UPDATE "pagos" p
SET "usuario_id" = l."titular_id"
FROM "licencias" l
WHERE p."licencia_id" = l."id" AND p."usuario_id" IS NULL;

UPDATE "pagos"
SET "aprobado_en" = "actualizado_en"
WHERE "estado" = 'aprobado' AND "aprobado_en" IS NULL;

-- Los consecutivos empiezan en cero: el primer documento sera el 1.
INSERT INTO "consecutivos" ("clave", "ultimo")
VALUES ('factura', 0), ('cotizacion', 0)
ON CONFLICT ("clave") DO NOTHING;
