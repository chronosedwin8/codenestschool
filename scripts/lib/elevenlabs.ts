/**
 * Cliente REST minimo de ElevenLabs para la generacion OFFLINE de voz.
 *
 * No es sintesis en tiempo real: los MP3 se generan una vez y se sirven como
 * archivos estaticos. En el navegador, si un clip falta, la app cae a la Web
 * Speech API.
 *
 * Reglas de seguridad (aprendidas de Codexia, donde la clave quedo escrita en
 * 11 scripts y se filtro al repositorio):
 *  - la clave SOLO se lee de process.env.ELEVENLABS_API_KEY,
 *  - nunca se imprime, ni siquiera truncada,
 *  - si falta, el script falla con un mensaje claro (salvo en --dry-run).
 */
import { setTimeout as esperar } from 'node:timers/promises';

import {
  AUDIO_MODELO_POR_DEFECTO,
  AUDIO_OUTPUT_FORMAT,
  type VoiceSettings,
} from '@codenest/shared';

const API_BASE = 'https://api.elevenlabs.io/v1';

/** Formato de salida y modelo: definidos en @codenest/shared. */
export const OUTPUT_FORMAT = AUDIO_OUTPUT_FORMAT;
export const MODELO_POR_DEFECTO = AUDIO_MODELO_POR_DEFECTO;

export type { VoiceSettings };

/** Limite duro de la API por peticion. */
export const MAX_CARACTERES = 5000;

export interface SuscripcionElevenLabs {
  readonly caracteresUsados: number;
  readonly caracteresLimite: number;
  readonly caracteresDisponibles: number;
  readonly nivel: string;
}

/** Error que NO tiene sentido reintentar (clave mala, cuota agotada, texto invalido). */
export class ErrorFatalElevenLabs extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ErrorFatalElevenLabs';
  }
}

export function leerApiKey(obligatoria: boolean): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    if (obligatoria) {
      throw new ErrorFatalElevenLabs(
        'Falta ELEVENLABS_API_KEY. Definela en .env (nunca en el codigo) o usa --dry-run.',
        0,
      );
    }
    return '';
  }
  return key;
}

/** Cabeceras comunes. La clave jamas se registra en consola. */
function cabeceras(apiKey: string, accept: string): Record<string, string> {
  return {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
    Accept: accept,
  };
}

/** Estados que merecen reintento: limite de tasa, fallo temporal o red. */
function esReintentable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function detalleError(res: Response): Promise<string> {
  try {
    const texto = await res.text();
    return texto.slice(0, 300);
  } catch {
    return '(sin cuerpo)';
  }
}

/**
 * Convierte texto en audio. Reintenta con retroceso exponencial y jitter en
 * 429/5xx; aborta de inmediato en 401 (clave), 422 (cuota) y 400 (texto).
 */
export async function textoAVoz(opciones: {
  readonly apiKey: string;
  readonly texto: string;
  readonly voiceId: string;
  readonly modelo?: string;
  readonly settings: VoiceSettings;
  readonly maxIntentos?: number;
}): Promise<Buffer> {
  const { apiKey, texto, voiceId, settings } = opciones;
  const modelo = opciones.modelo ?? MODELO_POR_DEFECTO;
  const maxIntentos = opciones.maxIntentos ?? 5;

  if (texto.length > MAX_CARACTERES) {
    throw new ErrorFatalElevenLabs(
      `El texto tiene ${texto.length} caracteres y el limite es ${MAX_CARACTERES}.`,
      400,
    );
  }

  let ultimoError = 'desconocido';

  for (let intento = 1; intento <= maxIntentos; intento++) {
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE}/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
        {
          method: 'POST',
          headers: cabeceras(apiKey, 'audio/mpeg'),
          body: JSON.stringify({ text: texto, model_id: modelo, voice_settings: settings }),
          signal: AbortSignal.timeout(120_000),
        },
      );
    } catch (error) {
      // Fallo de red o timeout: reintentable.
      ultimoError = error instanceof Error ? error.message : String(error);
      if (intento === maxIntentos) break;
      await esperar(retroceso(intento));
      continue;
    }

    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }

    const detalle = await detalleError(res);

    if (res.status === 401 || res.status === 403) {
      throw new ErrorFatalElevenLabs(
        `ElevenLabs rechazo la clave (${res.status}). Revisa ELEVENLABS_API_KEY. ${detalle}`,
        res.status,
      );
    }
    if (res.status === 422 && /quota|limit/i.test(detalle)) {
      throw new ErrorFatalElevenLabs(`Cuota de ElevenLabs agotada: ${detalle}`, res.status);
    }
    if (!esReintentable(res.status)) {
      throw new ErrorFatalElevenLabs(`ElevenLabs ${res.status}: ${detalle}`, res.status);
    }

    ultimoError = `${res.status}: ${detalle}`;
    if (intento === maxIntentos) break;

    // 429 puede indicar cuanto esperar.
    const retryAfter = Number(res.headers.get('retry-after'));
    const espera = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : retroceso(intento);
    await esperar(espera);
  }

  throw new Error(`ElevenLabs fallo tras ${maxIntentos} intentos. Ultimo error: ${ultimoError}`);
}

/** Retroceso exponencial con jitter: 1s, 2s, 4s, 8s... (tope 30s). */
function retroceso(intento: number): number {
  const base = Math.min(30_000, 1000 * 2 ** (intento - 1));
  return base + Math.floor(Math.random() * 500);
}

/** Consulta la cuota disponible para abortar antes de empezar un lote grande. */
export async function consultarSuscripcion(apiKey: string): Promise<SuscripcionElevenLabs> {
  const res = await fetch(`${API_BASE}/user/subscription`, {
    headers: cabeceras(apiKey, 'application/json'),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new ErrorFatalElevenLabs(
      `No se pudo consultar la suscripcion (${res.status}): ${await detalleError(res)}`,
      res.status,
    );
  }
  const data = (await res.json()) as {
    character_count: number;
    character_limit: number;
    tier?: string;
  };
  return {
    caracteresUsados: data.character_count,
    caracteresLimite: data.character_limit,
    caracteresDisponibles: Math.max(0, data.character_limit - data.character_count),
    nivel: data.tier ?? 'desconocido',
  };
}

/** Genera un efecto de sonido a partir de una descripcion en ingles. */
export async function generarSonido(opciones: {
  readonly apiKey: string;
  readonly descripcion: string;
  readonly duracionSegundos: number;
  readonly influencia?: number;
}): Promise<Buffer> {
  const res = await fetch(`${API_BASE}/sound-generation`, {
    method: 'POST',
    headers: cabeceras(opciones.apiKey, 'audio/mpeg'),
    body: JSON.stringify({
      text: opciones.descripcion,
      duration_seconds: opciones.duracionSegundos,
      prompt_influence: opciones.influencia ?? 0.5,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`sound-generation ${res.status}: ${await detalleError(res)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Duracion aproximada de un MP3 CBR a partir de su tamano.
 * Suficiente para la barra de progreso y el manifest; no necesita ffmpeg.
 */
export function estimarDuracionMs(bytes: number, kbps = 64): number {
  return Math.round((bytes * 8) / (kbps * 1000) * 1000);
}
