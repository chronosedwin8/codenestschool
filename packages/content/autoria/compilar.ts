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
import { mundo2 } from './m02.js';
import { mundo3 } from './m03.js';
import { mundo4 } from './m04.js';
import { mundo5 } from './m05.js';
import { mundo6 } from './m06.js';
import { mundo7 } from './m07.js';
import { mundo8 } from './m08.js';
import { mundo9 } from './m09.js';
import { mundo10 } from './m10.js';
import { mundo11 } from './m11.js';
import { mundo12 } from './m12.js';
import { mundo13 } from './m13.js';
import { mundo14 } from './m14.js';
import { mundo15 } from './m15.js';
import { mundo16 } from './m16.js';
import { mundo17 } from './m17.js';
import { mundo18 } from './m18.js';
import { mundo19 } from './m19.js';
import { mundo20 } from './m20.js';

/** Mundos ya escritos. Se van añadiendo a medida que se redactan. */
const MUNDOS: readonly WorldContentFile[] = [mundo1, mundo2, mundo3, mundo4, mundo5, mundo6, mundo7, mundo8, mundo9, mundo10, mundo11, mundo12, mundo13, mundo14, mundo15, mundo16, mundo17, mundo18, mundo19, mundo20];

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
