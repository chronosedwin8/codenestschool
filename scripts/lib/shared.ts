/**
 * Punto unico por el que los scripts acceden a @codenest/shared.
 *
 * Concentrar aqui las importaciones evita que cada script dependa de la forma
 * exacta del paquete y facilita cambiarla mas adelante.
 */
export {
  AUDIO_PREFIX,
  AUDIO_BASE_PATH,
  POOL_CELEBRACIONES,
  TIPO_AUDIO,
  claveCelebracion,
  claveExito,
  claveInstruccion,
  claveMundoIntro,
  clavePista,
  claveUi,
  rutaAudio,
  slugFrase,
  ACTIVIDADES_POR_MUNDO,
  TOTAL_ACTIVIDADES,
  TOTAL_MUNDOS,
  numeroGlobal,
  desdeNumeroGlobal,
  GRUPO_EDAD,
  MUNDOS,
  MUNDO_POR_NUMERO,
  MUNDO_POR_SLUG,
  mundoDe,
  mundosDeGrupo,
  comandosAcumulados,
  PLANES,
  PLAN_POR_CLAVE,
  TIPO_PLAN,
  formatearCop,
} from '@codenest/shared';

export type {
  AudioManifest,
  EntradaManifest,
  TipoAudio,
  EstadoAudio,
  GrupoEdad,
  WorldDefinition,
  ActivityDefinition,
  WorldContentFile,
  PlanDefinicion,
  TipoPlan,
} from '@codenest/shared';

export {
  activityDefinitionSchema,
  activityConfigSchema,
  worldContentFileSchema,
} from '@codenest/shared/zod';

export type {
  ActivityDefinitionInput,
  ActivityConfigInput,
  WorldContentFileInput,
} from '@codenest/shared/zod';
