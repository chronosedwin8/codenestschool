/**
 * Perfiles de voz de CodeNest School.
 *
 * Criterio pedagogico:
 *  - Exploradores (4-6) y Creadores (7-9): voz femenina calida y cercana, ritmo
 *    pausado. Es la guia "Nube", la mascota que acompana al Fuzz.
 *  - Hackers (10-12+): voz de robot/sistema para las instrucciones tecnicas y
 *    la guia para la narrativa; suena a consola de mision, no a cuento.
 *
 * Los identificadores de voz Jessica y Alice estan probados en espanol neutro
 * en el proyecto anterior (Codexia). Los de Josh y Adam son los estandar de
 * ElevenLabs; conviene escucharlos en el lote de prueba del Mundo 21.
 */
import type { GrupoEdad, PerfilVoz, TipoAudio } from '@codenest/shared';

export type { PerfilVoz };

/** Guia principal para los mas pequenos: calida, expresiva, sin prisa. */
export const VOZ_GUIA_CLARA: PerfilVoz = {
  clave: 'guia_clara',
  nombre: 'Clara',
  elevenVoiceId: 'cgSgspJ2msm6clMCkdW9', // Jessica
  modelo: 'eleven_multilingual_v2',
  settings: { stability: 0.45, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
  rolPersonaje: 'guia_infantil',
};

/** Narradora educadora: mas neutra, para explicaciones de concepto. */
export const VOZ_GUIA_BELLA: PerfilVoz = {
  clave: 'guia_bella',
  nombre: 'Bella',
  elevenVoiceId: 'Xb7hH8MSUJpSbSDYk0k2', // Alice
  modelo: 'eleven_multilingual_v2',
  settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
  rolPersonaje: 'narradora',
};

/** Robot de a bordo para los Hackers: seco, preciso, con caracter. */
export const VOZ_ROBOT_JOSH: PerfilVoz = {
  clave: 'robot_josh',
  nombre: 'Josh',
  elevenVoiceId: 'TxGEqnHWrfWFTfGW9XjX',
  modelo: 'eleven_multilingual_v2',
  settings: { stability: 0.6, similarity_boost: 0.7, style: 0.2, use_speaker_boost: true },
  rolPersonaje: 'robot_sistema',
};

/** Segunda voz de sistema, para alertas y misiones. */
export const VOZ_ROBOT_ADAM: PerfilVoz = {
  clave: 'robot_adam',
  nombre: 'Adam',
  elevenVoiceId: 'pNInz6obpgDQGcFmaJgB',
  modelo: 'eleven_multilingual_v2',
  settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
  rolPersonaje: 'robot_mision',
};

export const VOCES: readonly PerfilVoz[] = [
  VOZ_GUIA_CLARA,
  VOZ_GUIA_BELLA,
  VOZ_ROBOT_JOSH,
  VOZ_ROBOT_ADAM,
];

export const VOZ_POR_CLAVE: ReadonlyMap<string, PerfilVoz> = new Map(
  VOCES.map((v) => [v.clave, v]),
);

/**
 * Elige la voz segun el grupo de edad y el tipo de clip.
 * Los Hackers oyen al robot en las instrucciones tecnicas, pero la celebracion
 * y la intro de mundo siguen siendo narrativas.
 */
export function vozPara(grupo: GrupoEdad, tipo: TipoAudio): PerfilVoz {
  if (grupo === 'hackers') {
    return tipo === 'instruccion' || tipo === 'pista' ? VOZ_ROBOT_JOSH : VOZ_GUIA_BELLA;
  }
  if (grupo === 'creadores' && tipo === 'mundo_intro') {
    return VOZ_GUIA_BELLA;
  }
  return VOZ_GUIA_CLARA;
}

/** Voz de los textos fijos de interfaz (no dependen de un mundo). */
export const VOZ_UI = VOZ_GUIA_CLARA;
