/**
 * Carga y valida los archivos de contenido de packages/content/worlds/.
 *
 * Solo se usa en Node (seed y scripts); el frontend recibe el contenido ya
 * sembrado desde la API, no lee el disco.
 */
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { worldContentFileSchema, type WorldContentFileInput } from '@codenest/shared/zod';

/** Carpeta con los JSON de mundo (m01-....json ... m30-....json). */
export const DIR_MUNDOS = resolve(import.meta.dirname, '..', 'worlds');

export interface ArchivoMundo {
  readonly archivo: string;
  readonly contenido: WorldContentFileInput;
}

/**
 * Lee todos los mundos disponibles y valida cada uno contra el esquema v3.
 * Falla con un mensaje util si algun archivo no cumple.
 */
export async function cargarMundos(filtro?: readonly number[]): Promise<ArchivoMundo[]> {
  if (!existsSync(DIR_MUNDOS)) return [];

  const nombres = (await readdir(DIR_MUNDOS)).filter((f) => f.endsWith('.json')).sort();
  const resultado: ArchivoMundo[] = [];

  for (const archivo of nombres) {
    const crudo = JSON.parse(readFileSync(join(DIR_MUNDOS, archivo), 'utf8')) as unknown;
    const parsed = worldContentFileSchema.safeParse(crudo);

    if (!parsed.success) {
      throw new Error(
        `El contenido de ${archivo} no cumple el esquema v3:\n` +
          JSON.stringify(parsed.error.flatten(), null, 2),
      );
    }
    if (filtro && !filtro.includes(parsed.data.mundo)) continue;
    resultado.push({ archivo, contenido: parsed.data });
  }

  return resultado;
}
