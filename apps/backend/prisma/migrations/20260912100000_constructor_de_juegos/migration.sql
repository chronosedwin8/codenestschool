-- Constructor de juegos: proyectos, me gusta y diplomas.
--
-- El titulo del juego es VARCHAR(60) porque sale de un sorteo de tres
-- palabras, no de un campo de texto: en una zona que ven otros menores no hay
-- texto libre escrito por un menor.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "estado_proyecto" AS ENUM ('borrador', 'publicado');

-- CreateTable
CREATE TABLE "proyectos_juego" (
    "id" SERIAL NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "titulo" VARCHAR(60) NOT NULL,
    "definicion" JSONB NOT NULL,
    "estado" "estado_proyecto" NOT NULL DEFAULT 'borrador',
    "portada_url" VARCHAR(400),
    "probado_en" TIMESTAMPTZ(6),
    "partidas" INTEGER NOT NULL DEFAULT 0,
    "me_gusta" INTEGER NOT NULL DEFAULT 0,
    "publicado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proyectos_juego_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juegos_megusta" (
    "id" SERIAL NOT NULL,
    "proyecto_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "juegos_megusta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diplomas" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "alumno_id" INTEGER NOT NULL,
    "proyecto_id" INTEGER NOT NULL,
    "titulo_juego" VARCHAR(60) NOT NULL,
    "nombre_alumno" VARCHAR(150) NOT NULL,
    "imagen_url" VARCHAR(400),
    "emitido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diplomas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proyectos_juego_autor_id_idx" ON "proyectos_juego"("autor_id");

-- CreateIndex
CREATE INDEX "proyectos_juego_estado_publicado_en_idx" ON "proyectos_juego"("estado", "publicado_en");

-- CreateIndex
CREATE UNIQUE INDEX "juegos_megusta_proyecto_id_usuario_id_key" ON "juegos_megusta"("proyecto_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "diplomas_codigo_key" ON "diplomas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "diplomas_proyecto_id_key" ON "diplomas"("proyecto_id");

-- CreateIndex
CREATE INDEX "diplomas_alumno_id_idx" ON "diplomas"("alumno_id");

-- AddForeignKey
ALTER TABLE "proyectos_juego" ADD CONSTRAINT "proyectos_juego_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juegos_megusta" ADD CONSTRAINT "juegos_megusta_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos_juego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juegos_megusta" ADD CONSTRAINT "juegos_megusta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomas" ADD CONSTRAINT "diplomas_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomas" ADD CONSTRAINT "diplomas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos_juego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

