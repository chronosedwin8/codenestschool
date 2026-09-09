/**
 * Claves y rutas del audio pre-renderizado con ElevenLabs.
 *
 * La convencion de nombres es la unica fuente de verdad compartida por:
 *  - scripts/generate-voiceover.ts (genera los MP3)
 *  - apps/backend/prisma/seed.ts   (crea las filas `audios` en estado pendiente)
 *  - apps/frontend/stores/audio.ts (reproduce con Howler)
 *  - scripts/validate-content.ts   (exige que la clave tenga su MP3)
 *
 * Toda la voz es grabada: no hay sintesis del navegador en ninguna parte. Una
 * clave sin MP3 deja la pantalla muda, asi que el validador la rechaza.
 */

export const TIPO_AUDIO = {
  instruccion: 'instruccion',
  exito: 'exito',
  pista: 'pista',
  ui: 'ui',
  mundo_intro: 'mundo_intro',
  celebracion: 'celebracion',
} as const;

export type TipoAudio = (typeof TIPO_AUDIO)[keyof typeof TIPO_AUDIO];

/** Prefijo de archivo por tipo de audio (en ingles, como pide la especificacion). */
export const AUDIO_PREFIX: Readonly<Record<TipoAudio, string>> = {
  instruccion: 'instruction',
  exito: 'success',
  pista: 'hint',
  ui: 'ui',
  mundo_intro: 'world',
  celebracion: 'celebration',
};

export const ESTADO_AUDIO = {
  pendiente: 'pendiente',
  generado: 'generado',
  fallido: 'fallido',
  obsoleto: 'obsoleto',
} as const;

export type EstadoAudio = (typeof ESTADO_AUDIO)[keyof typeof ESTADO_AUDIO];

/** Claves con tipo plantilla: un error de nombre se detecta al compilar. */
export type ClaveInstruccion = `instruction_world${number}_lvl${number}`;
export type ClaveExito = `success_world${number}_lvl${number}`;
export type ClavePista = `hint_world${number}_lvl${number}_${number}`;
export type ClaveMundoIntro = `world${number}_intro`;
export type ClaveUi = `ui_${string}`;
export type ClaveCelebracion = `celebration_${number}`;

export type ClaveAudio =
  | ClaveInstruccion
  | ClaveExito
  | ClavePista
  | ClaveMundoIntro
  | ClaveUi
  | ClaveCelebracion;

export const claveInstruccion = (mundo: number, actividad: number): ClaveInstruccion =>
  `instruction_world${mundo}_lvl${actividad}`;

export const claveExito = (mundo: number, actividad: number): ClaveExito =>
  `success_world${mundo}_lvl${actividad}`;

export const clavePista = (mundo: number, actividad: number, orden: number): ClavePista =>
  `hint_world${mundo}_lvl${actividad}_${orden}`;

export const claveMundoIntro = (mundo: number): ClaveMundoIntro => `world${mundo}_intro`;

export const claveUi = (slug: string): ClaveUi => `ui_${slug}`;

export const claveCelebracion = (n: number): ClaveCelebracion => `celebration_${n}`;

/** Carpeta publica servida por Vite/Fastify. */
export const AUDIO_BASE_PATH = '/static/audio';

export const rutaAudio = (clave: string): string => `${AUDIO_BASE_PATH}/${clave}.mp3`;

/** Numero de clips del pool de celebraciones genericas (evita 600 MP3 iguales). */
export const POOL_CELEBRACIONES = 15;

/** Entrada del manifest que acompana a los MP3 generados. */
export interface EntradaManifest {
  readonly clave: string;
  readonly tipo: TipoAudio;
  readonly voz: string;
  readonly hash: string;
  readonly archivo: string;
  readonly caracteres: number;
  readonly tamanoBytes: number;
  readonly duracionMs?: number;
  readonly generadoEn: string;
}

export interface AudioManifest {
  readonly version: number;
  readonly modelo: string;
  readonly formato: string;
  readonly entradas: Record<string, EntradaManifest>;
}

/**
 * Normaliza una frase en espanol a un slug estable para reutilizar clips.
 * Debe coincidir byte a byte entre el generador (Node) y el cliente (Vue).
 * Portado de Codexia: frontend/src/composables/vozBank.ts.
 */
export function slugFrase(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ─────────────────────── Perfiles de voz (ElevenLabs) ─────────────────────

/** Ajustes de sintesis de ElevenLabs. */
export interface VoiceSettings {
  readonly stability: number;
  readonly similarity_boost: number;
  readonly style: number;
  readonly use_speaker_boost: boolean;
}

/** Una voz del reparto: quien habla, con que ajustes y en que papel. */
export interface PerfilVoz {
  readonly clave: string;
  readonly nombre: string;
  readonly elevenVoiceId: string;
  readonly modelo: string;
  readonly settings: VoiceSettings;
  /** Papel narrativo dentro del juego (guia_infantil, robot_sistema...). */
  readonly rolPersonaje: string;
}

/** Formato de salida de los MP3: 64 kbps basta para voz y pesa la mitad. */
export const AUDIO_OUTPUT_FORMAT = 'mp3_44100_64';
export const AUDIO_MODELO_POR_DEFECTO = 'eleven_multilingual_v2';
