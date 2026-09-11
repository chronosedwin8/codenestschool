-- Los valores nuevos de un enum no se pueden usar en la misma transaccion que
-- los crea, asi que esta migracion solo los anade: sembrar articulos de esos
-- tipos ocurre despues, en el seed.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_item_tienda" ADD VALUE 'poder';
ALTER TYPE "tipo_item_tienda" ADD VALUE 'pocion';
ALTER TYPE "tipo_item_tienda" ADD VALUE 'mundo';

-- AlterTable
ALTER TABLE "inventario_usuario" ADD COLUMN     "cantidad" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "items_tienda" DROP COLUMN "costo_monedas",
ADD COLUMN     "costo_estrellas" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "estrellas_disponibles" INTEGER NOT NULL DEFAULT 0;

