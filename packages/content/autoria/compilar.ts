/**
 * Compila la autoría en los JSON de contenido.
 *
 * Los mundos se escriben en TypeScript (carpeta `autoria`) porque así el
 * compilador comprueba cada actividad mientras se escribe, y los generadores
 * ahorran la parte mecánica. El resultado se vuelca a JSON en `worlds`, que es lo
 * que consumen el seed y el generador de voz: datos, sin código.
 *
 * Uso: npm run content:compile
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { worldContentFileSchema } from '@codenest/shared/zod';
import type { WorldContentFile } from '@codenest/shared';

import { mundo1 } from './m01.js';

/** Mundos ya escritos. Se van añadiendo a medida que se redactan. */
const MUNDOS: readonly WorldContentFile[] = [mundo1];

const DESTINO = resolve(import.meta.dirname, '..', 'worlds');

function main(): void {
  mkdirSync(DESTINO, { recursive: true });

  let total = 0;

  for (const mundo of MUNDOS) {
    // Se valida antes de escribir: un JSON invalido no debe llegar al disco.
    const validado = worldContentFileSchema.safeParse(mundo);
    if (!validado.success) {
      console.error(`FALLO en el mundo ${mundo.mundo}:`);
      console.error(JSON.stringify(validado.error.flatten(), null, 2));
      process.exitCode = 1;
      return;
    }

    const nombre = `m${String(mundo.mundo).padStart(2, '0')}-${mundo.slug}.json`;
    writeFileSync(join(DESTINO, nombre), `${JSON.stringify(mundo, null, 2)}\n`, 'utf8');

    console.log(`OK ${nombre}  (${mundo.actividades.length} actividades)`);
    total += mundo.actividades.length;
  }

  console.log(`\n${MUNDOS.length} mundo(s), ${total} actividades escritas en packages/content/worlds/`);
}

main();
