-- Mecanografia: progreso por leccion y resumen por estudiante.
--
-- Las lecciones viven en packages/content, no aqui: asi se puede corregir el
-- texto de una leccion sin migrar nada.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateTable
CREATE TABLE "progreso_mecanografia" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "leccion_clave" VARCHAR(40) NOT NULL,
    "mejor_ppm" INTEGER NOT NULL DEFAULT 0,
    "mejor_precision" INTEGER NOT NULL DEFAULT 0,
    "estrellas" INTEGER NOT NULL DEFAULT 0,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "ultima_vez" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progreso_mecanografia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_mecanografia" (
    "usuario_id" INTEGER NOT NULL,
    "mejor_ppm" INTEGER NOT NULL DEFAULT 0,
    "ultima_ppm" INTEGER NOT NULL DEFAULT 0,
    "ultima_precision" INTEGER NOT NULL DEFAULT 0,
    "pulsaciones" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "segundos" INTEGER NOT NULL DEFAULT 0,
    "errores_por_tecla" JSONB NOT NULL DEFAULT '{}',
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "perfil_mecanografia_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateIndex
CREATE INDEX "progreso_mecanografia_usuario_id_idx" ON "progreso_mecanografia"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_mecanografia_usuario_id_leccion_clave_key" ON "progreso_mecanografia"("usuario_id", "leccion_clave");

-- AddForeignKey
ALTER TABLE "progreso_mecanografia" ADD CONSTRAINT "progreso_mecanografia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_mecanografia" ADD CONSTRAINT "perfil_mecanografia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

