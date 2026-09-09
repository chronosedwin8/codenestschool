-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('nino', 'tutor', 'docente', 'admin_escuela', 'admin');

-- CreateEnum
CREATE TYPE "grupo_edad" AS ENUM ('exploradores', 'creadores', 'hackers');

-- CreateEnum
CREATE TYPE "tipo_editor" AS ENUM ('comandos', 'bloques', 'texto');

-- CreateEnum
CREATE TYPE "lenguaje_codigo" AS ENUM ('comandos', 'javascript', 'python');

-- CreateEnum
CREATE TYPE "tipo_actividad" AS ENUM ('recorrido', 'recoleccion', 'debug', 'integrador', 'jefe');

-- CreateEnum
CREATE TYPE "tipo_audio" AS ENUM ('instruccion', 'exito', 'pista', 'ui', 'mundo_intro', 'celebracion');

-- CreateEnum
CREATE TYPE "estado_audio" AS ENUM ('pendiente', 'generado', 'fallido', 'obsoleto');

-- CreateEnum
CREATE TYPE "tipo_item_tienda" AS ENUM ('sombrero', 'gafas', 'disfraz', 'color', 'accesorio');

-- CreateEnum
CREATE TYPE "estado_consentimiento" AS ENUM ('pendiente', 'otorgado', 'revocado');

-- CreateEnum
CREATE TYPE "tipo_plan" AS ENUM ('personal', 'padres', 'escuela');

-- CreateEnum
CREATE TYPE "estado_licencia" AS ENUM ('pendiente', 'activa', 'vencida', 'cancelada');

-- CreateEnum
CREATE TYPE "estado_pago" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'reembolsado', 'cancelado');

-- CreateTable
CREATE TABLE "instituciones" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "nit" VARCHAR(40),
    "ciudad" VARCHAR(100),
    "pais" VARCHAR(100) NOT NULL DEFAULT 'Colombia',
    "codigo_acceso" VARCHAR(20),
    "max_estudiantes" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instituciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sedes" (
    "id" SERIAL NOT NULL,
    "institucion_id" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "direccion" VARCHAR(250),
    "ciudad" VARCHAR(100),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "usuario" CITEXT NOT NULL,
    "email" CITEXT,
    "password_hash" VARCHAR(255),
    "pin_hash" VARCHAR(255),
    "nombre" VARCHAR(150) NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'nino',
    "grupo_edad" "grupo_edad",
    "editor_pref" "tipo_editor",
    "fecha_nacimiento" DATE,
    "avatar_config" JSONB NOT NULL DEFAULT '{"fuzzColor":"azul","sombrero":null,"gafas":null,"disfraz":null}',
    "monedas" INTEGER NOT NULL DEFAULT 0,
    "estrellas_totales" INTEGER NOT NULL DEFAULT 0,
    "racha_dias" INTEGER NOT NULL DEFAULT 0,
    "ultima_actividad" DATE,
    "institucion_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutores_ninos" (
    "id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "nino_id" INTEGER NOT NULL,
    "parentesco" VARCHAR(50),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutores_ninos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimientos" (
    "id" SERIAL NOT NULL,
    "nino_id" INTEGER NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "estado" "estado_consentimiento" NOT NULL DEFAULT 'pendiente',
    "version_politica" VARCHAR(20) NOT NULL,
    "otorgado_en" TIMESTAMPTZ(6),
    "revocado_en" TIMESTAMPTZ(6),
    "ip" VARCHAR(64),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_accesos" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "nino_id" INTEGER,
    "accion" VARCHAR(60) NOT NULL,
    "recurso" VARCHAR(160) NOT NULL,
    "ip" VARCHAR(64),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_accesos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_refresh" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_refresh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "codigo_acceso" VARCHAR(20) NOT NULL,
    "docente_id" INTEGER NOT NULL,
    "institucion_id" INTEGER,
    "sede_id" INTEGER,
    "grado" VARCHAR(40),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" SERIAL NOT NULL,
    "nino_id" INTEGER NOT NULL,
    "aula_id" INTEGER NOT NULL,
    "inscrito_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id" SERIAL NOT NULL,
    "docente_id" INTEGER NOT NULL,
    "aula_id" INTEGER,
    "mundo_id" INTEGER,
    "actividad_id" INTEGER,
    "titulo" VARCHAR(200),
    "instrucciones" TEXT,
    "fecha_limite" DATE,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voces" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "eleven_voice_id" VARCHAR(60) NOT NULL,
    "modelo" VARCHAR(60) NOT NULL DEFAULT 'eleven_multilingual_v2',
    "settings" JSONB NOT NULL,
    "rol_personaje" VARCHAR(40) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audios" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(120) NOT NULL,
    "tipo" "tipo_audio" NOT NULL,
    "texto" TEXT NOT NULL,
    "texto_hash" VARCHAR(64) NOT NULL,
    "voz_id" INTEGER NOT NULL,
    "idioma" VARCHAR(10) NOT NULL DEFAULT 'es-CO',
    "ruta_archivo" VARCHAR(300),
    "formato" VARCHAR(10) NOT NULL DEFAULT 'mp3',
    "duracion_ms" INTEGER,
    "tamano_bytes" INTEGER,
    "estado" "estado_audio" NOT NULL DEFAULT 'pendiente',
    "error" TEXT,
    "generado_en" TIMESTAMPTZ(6),

    CONSTRAINT "audios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mundos" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "grupo_edad" "grupo_edad" NOT NULL,
    "concepto" VARCHAR(150) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "bioma" VARCHAR(60) NOT NULL,
    "editor" "tipo_editor" NOT NULL,
    "lenguajes" "lenguaje_codigo"[],
    "icono" VARCHAR(60) NOT NULL,
    "color_primario" VARCHAR(20) NOT NULL,
    "color_secundario" VARCHAR(20) NOT NULL,
    "fondo_url" VARCHAR(300),
    "musica_url" VARCHAR(300),
    "audio_intro_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mundos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades" (
    "id" SERIAL NOT NULL,
    "mundo_id" INTEGER NOT NULL,
    "numero_global" INTEGER NOT NULL,
    "numero_en_mundo" INTEGER NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "tipo" "tipo_actividad" NOT NULL,
    "dificultad" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "instruccion_texto" TEXT NOT NULL,
    "exito_texto" TEXT NOT NULL,
    "audio_instruccion_id" INTEGER,
    "audio_exito_id" INTEGER,
    "solucion_referencia" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 3,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pistas" (
    "id" SERIAL NOT NULL,
    "actividad_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "audio_id" INTEGER,
    "costo_monedas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_actividad" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "actividad_id" INTEGER NOT NULL,
    "editor_usado" "tipo_editor" NOT NULL,
    "lenguaje" "lenguaje_codigo" NOT NULL,
    "programa" JSONB,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "tiempo_segundos" INTEGER NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "estrellas" INTEGER NOT NULL DEFAULT 0,
    "monedas_ganadas" INTEGER NOT NULL DEFAULT 0,
    "pistas_usadas" INTEGER NOT NULL DEFAULT 0,
    "iniciada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completada_en" TIMESTAMPTZ(6),

    CONSTRAINT "sesiones_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envios_codigo" (
    "id" SERIAL NOT NULL,
    "sesion_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "actividad_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "editor" "tipo_editor" NOT NULL,
    "lenguaje" "lenguaje_codigo" NOT NULL,
    "acciones_ejecutadas" JSONB NOT NULL,
    "tamano_programa" INTEGER NOT NULL,
    "resultado" JSONB,
    "exitoso" BOOLEAN NOT NULL DEFAULT false,
    "estrellas" INTEGER NOT NULL DEFAULT 0,
    "tiempo_ejecucion_ms" INTEGER,
    "enviado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envios_codigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progreso_actividad" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "actividad_id" INTEGER NOT NULL,
    "mejor_estrellas" INTEGER NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "intentos_totales" INTEGER NOT NULL DEFAULT 0,
    "primera_vez" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progreso_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logros" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "icono" VARCHAR(60) NOT NULL,
    "condicion" JSONB NOT NULL,
    "rareza" VARCHAR(20) NOT NULL DEFAULT 'comun',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "logros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_logros" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "logro_id" INTEGER NOT NULL,
    "obtenido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_logros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_tienda" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" "tipo_item_tienda" NOT NULL,
    "descripcion" TEXT,
    "imagen_url" VARCHAR(300),
    "costo_monedas" INTEGER NOT NULL DEFAULT 0,
    "requiere_mundo" INTEGER,
    "grupo_edad" "grupo_edad",
    "datos" JSONB,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "items_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_usuario" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "comprado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" SERIAL NOT NULL,
    "clave" "tipo_plan" NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "precio_cop" INTEGER NOT NULL,
    "vigencia_dias" INTEGER NOT NULL DEFAULT 365,
    "max_ninos" INTEGER,
    "max_docentes" INTEGER,
    "beneficios" JSONB NOT NULL,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencias" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "titular_id" INTEGER NOT NULL,
    "institucion_id" INTEGER,
    "estado" "estado_licencia" NOT NULL DEFAULT 'pendiente',
    "codigo_acceso" VARCHAR(20),
    "inicio_vigencia" TIMESTAMPTZ(6),
    "fin_vigencia" TIMESTAMPTZ(6),
    "renovada_de_id" INTEGER,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "licencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "licencia_id" INTEGER NOT NULL,
    "mp_payment_id" VARCHAR(60),
    "mp_preference_id" VARCHAR(80),
    "idempotency_key" VARCHAR(120) NOT NULL,
    "monto_cop" INTEGER NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "estado" "estado_pago" NOT NULL DEFAULT 'pendiente',
    "mp_status" VARCHAR(40),
    "mp_status_detail" VARCHAR(80),
    "metodo" VARCHAR(40),
    "email_comprador" VARCHAR(255) NOT NULL,
    "payload_webhook" JSONB,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfiles_facturacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "razon_social" VARCHAR(200),
    "nit_cedula" VARCHAR(40) NOT NULL,
    "direccion" VARCHAR(250),
    "ciudad" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(40),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "perfiles_facturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "actividad_id" INTEGER,
    "sesion_id" INTEGER,
    "evento" VARCHAR(60) NOT NULL,
    "datos" JSONB,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetria_pkey" PRIMARY KEY ("id","creado_en")
) PARTITION BY RANGE ("creado_en");

-- CreateTable
CREATE TABLE "metricas_actividad_diaria" (
    "actividad_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "completadas" INTEGER NOT NULL DEFAULT 0,
    "estrellas_promedio" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "tiempo_promedio_seg" INTEGER NOT NULL DEFAULT 0,
    "pistas_usadas" INTEGER NOT NULL DEFAULT 0,
    "errores_comunes" JSONB,

    CONSTRAINT "metricas_actividad_diaria_pkey" PRIMARY KEY ("actividad_id","fecha")
) PARTITION BY RANGE ("fecha");

-- CreateTable
CREATE TABLE "metricas_usuario_diaria" (
    "usuario_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "tiempo_seg" INTEGER NOT NULL DEFAULT 0,
    "actividades_completadas" INTEGER NOT NULL DEFAULT 0,
    "estrellas" INTEGER NOT NULL DEFAULT 0,
    "monedas" INTEGER NOT NULL DEFAULT 0,
    "sesiones" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "metricas_usuario_diaria_pkey" PRIMARY KEY ("usuario_id","fecha")
) PARTITION BY RANGE ("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "instituciones_codigo_acceso_key" ON "instituciones"("codigo_acceso");

-- CreateIndex
CREATE INDEX "sedes_institucion_id_idx" ON "sedes"("institucion_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE INDEX "usuarios_institucion_id_idx" ON "usuarios"("institucion_id");

-- CreateIndex
CREATE INDEX "tutores_ninos_nino_id_idx" ON "tutores_ninos"("nino_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutores_ninos_tutor_id_nino_id_key" ON "tutores_ninos"("tutor_id", "nino_id");

-- CreateIndex
CREATE INDEX "consentimientos_nino_id_estado_idx" ON "consentimientos"("nino_id", "estado");

-- CreateIndex
CREATE INDEX "auditoria_accesos_nino_id_creado_en_idx" ON "auditoria_accesos"("nino_id", "creado_en");

-- CreateIndex
CREATE INDEX "auditoria_accesos_actor_id_creado_en_idx" ON "auditoria_accesos"("actor_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_refresh_token_hash_key" ON "tokens_refresh"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_refresh_usuario_id_expira_en_idx" ON "tokens_refresh"("usuario_id", "expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_codigo_acceso_key" ON "aulas"("codigo_acceso");

-- CreateIndex
CREATE INDEX "aulas_docente_id_idx" ON "aulas"("docente_id");

-- CreateIndex
CREATE INDEX "aulas_institucion_id_idx" ON "aulas"("institucion_id");

-- CreateIndex
CREATE INDEX "inscripciones_aula_id_idx" ON "inscripciones"("aula_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_nino_id_aula_id_key" ON "inscripciones"("nino_id", "aula_id");

-- CreateIndex
CREATE INDEX "asignaciones_aula_id_idx" ON "asignaciones"("aula_id");

-- CreateIndex
CREATE INDEX "asignaciones_docente_id_idx" ON "asignaciones"("docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "voces_clave_key" ON "voces"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "audios_clave_key" ON "audios"("clave");

-- CreateIndex
CREATE INDEX "audios_estado_idx" ON "audios"("estado");

-- CreateIndex
CREATE INDEX "audios_texto_hash_idx" ON "audios"("texto_hash");

-- CreateIndex
CREATE INDEX "audios_tipo_idx" ON "audios"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "mundos_numero_key" ON "mundos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "mundos_slug_key" ON "mundos"("slug");

-- CreateIndex
CREATE INDEX "mundos_grupo_edad_idx" ON "mundos"("grupo_edad");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_numero_global_key" ON "actividades"("numero_global");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_slug_key" ON "actividades"("slug");

-- CreateIndex
CREATE INDEX "actividades_mundo_id_idx" ON "actividades"("mundo_id");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_mundo_id_numero_en_mundo_key" ON "actividades"("mundo_id", "numero_en_mundo");

-- CreateIndex
CREATE UNIQUE INDEX "pistas_actividad_id_orden_key" ON "pistas"("actividad_id", "orden");

-- CreateIndex
CREATE INDEX "sesiones_actividad_usuario_id_actividad_id_completada_idx" ON "sesiones_actividad"("usuario_id", "actividad_id", "completada");

-- CreateIndex
CREATE INDEX "sesiones_actividad_actividad_id_idx" ON "sesiones_actividad"("actividad_id");

-- CreateIndex
CREATE INDEX "envios_codigo_usuario_id_idx" ON "envios_codigo"("usuario_id");

-- CreateIndex
CREATE INDEX "envios_codigo_actividad_id_idx" ON "envios_codigo"("actividad_id");

-- CreateIndex
CREATE INDEX "envios_codigo_sesion_id_idx" ON "envios_codigo"("sesion_id");

-- CreateIndex
CREATE INDEX "progreso_actividad_usuario_id_idx" ON "progreso_actividad"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_actividad_usuario_id_actividad_id_key" ON "progreso_actividad"("usuario_id", "actividad_id");

-- CreateIndex
CREATE UNIQUE INDEX "logros_clave_key" ON "logros"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_logros_usuario_id_logro_id_key" ON "usuarios_logros"("usuario_id", "logro_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_tienda_clave_key" ON "items_tienda"("clave");

-- CreateIndex
CREATE INDEX "items_tienda_tipo_idx" ON "items_tienda"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_usuario_usuario_id_item_id_key" ON "inventario_usuario"("usuario_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "planes_clave_key" ON "planes"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "licencias_codigo_acceso_key" ON "licencias"("codigo_acceso");

-- CreateIndex
CREATE UNIQUE INDEX "licencias_renovada_de_id_key" ON "licencias"("renovada_de_id");

-- CreateIndex
CREATE INDEX "licencias_titular_id_estado_idx" ON "licencias"("titular_id", "estado");

-- CreateIndex
CREATE INDEX "licencias_fin_vigencia_idx" ON "licencias"("fin_vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mp_payment_id_key" ON "pagos"("mp_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_idempotency_key_key" ON "pagos"("idempotency_key");

-- CreateIndex
CREATE INDEX "pagos_licencia_id_idx" ON "pagos"("licencia_id");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_facturacion_usuario_id_key" ON "perfiles_facturacion"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_telemetria_usuario" ON "telemetria"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "idx_telemetria_actividad" ON "telemetria"("actividad_id", "creado_en");

-- CreateIndex
CREATE INDEX "idx_telemetria_evento" ON "telemetria"("evento", "creado_en");

-- CreateIndex
CREATE INDEX "idx_metricas_actividad_fecha" ON "metricas_actividad_diaria"("fecha");

-- CreateIndex
CREATE INDEX "idx_metricas_usuario_fecha" ON "metricas_usuario_diaria"("fecha");

-- AddForeignKey
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "instituciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "instituciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutores_ninos" ADD CONSTRAINT "tutores_ninos_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutores_ninos" ADD CONSTRAINT "tutores_ninos_nino_id_fkey" FOREIGN KEY ("nino_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_nino_id_fkey" FOREIGN KEY ("nino_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_accesos" ADD CONSTRAINT "auditoria_accesos_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_accesos" ADD CONSTRAINT "auditoria_accesos_nino_id_fkey" FOREIGN KEY ("nino_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_refresh" ADD CONSTRAINT "tokens_refresh_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "instituciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_nino_id_fkey" FOREIGN KEY ("nino_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_mundo_id_fkey" FOREIGN KEY ("mundo_id") REFERENCES "mundos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audios" ADD CONSTRAINT "audios_voz_id_fkey" FOREIGN KEY ("voz_id") REFERENCES "voces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mundos" ADD CONSTRAINT "mundos_audio_intro_id_fkey" FOREIGN KEY ("audio_intro_id") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_mundo_id_fkey" FOREIGN KEY ("mundo_id") REFERENCES "mundos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_audio_instruccion_id_fkey" FOREIGN KEY ("audio_instruccion_id") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_audio_exito_id_fkey" FOREIGN KEY ("audio_exito_id") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pistas" ADD CONSTRAINT "pistas_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pistas" ADD CONSTRAINT "pistas_audio_id_fkey" FOREIGN KEY ("audio_id") REFERENCES "audios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_actividad" ADD CONSTRAINT "sesiones_actividad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_actividad" ADD CONSTRAINT "sesiones_actividad_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_codigo" ADD CONSTRAINT "envios_codigo_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "sesiones_actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_codigo" ADD CONSTRAINT "envios_codigo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_codigo" ADD CONSTRAINT "envios_codigo_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_actividad" ADD CONSTRAINT "progreso_actividad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_actividad" ADD CONSTRAINT "progreso_actividad_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_logros" ADD CONSTRAINT "usuarios_logros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_logros" ADD CONSTRAINT "usuarios_logros_logro_id_fkey" FOREIGN KEY ("logro_id") REFERENCES "logros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_usuario" ADD CONSTRAINT "inventario_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_usuario" ADD CONSTRAINT "inventario_usuario_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items_tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_titular_id_fkey" FOREIGN KEY ("titular_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "instituciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_renovada_de_id_fkey" FOREIGN KEY ("renovada_de_id") REFERENCES "licencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_licencia_id_fkey" FOREIGN KEY ("licencia_id") REFERENCES "licencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfiles_facturacion" ADD CONSTRAINT "perfiles_facturacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metricas_actividad_diaria" ADD CONSTRAINT "metricas_actividad_diaria_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metricas_usuario_diaria" ADD CONSTRAINT "metricas_usuario_diaria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === PARTICIONADO CodeNest (patch-partition-migration.mjs) ===
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
