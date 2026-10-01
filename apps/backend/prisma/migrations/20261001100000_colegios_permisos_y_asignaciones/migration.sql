-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "phidias_habilitado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "asignaciones_estudiantes" (
    "id" SERIAL NOT NULL,
    "asignacion_id" INTEGER NOT NULL,
    "nino_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asignaciones_estudiantes_nino_id_idx" ON "asignaciones_estudiantes"("nino_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_estudiantes_asignacion_id_nino_id_key" ON "asignaciones_estudiantes"("asignacion_id", "nino_id");

-- AddForeignKey
ALTER TABLE "asignaciones_estudiantes" ADD CONSTRAINT "asignaciones_estudiantes_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "asignaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_estudiantes" ADD CONSTRAINT "asignaciones_estudiantes_nino_id_fkey" FOREIGN KEY ("nino_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

