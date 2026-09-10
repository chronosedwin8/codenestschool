-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "origen_externo" VARCHAR(30),
ADD COLUMN     "origen_externo_id" VARCHAR(60);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_origen_externo_origen_externo_id_key" ON "usuarios"("origen_externo", "origen_externo_id");

