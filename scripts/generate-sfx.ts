/**
 * Genera los efectos de sonido del juego con la API de sound-generation de
 * ElevenLabs. Se ejecuta una vez; los MP3 quedan servidos como estaticos.
 *
 * Estetica: sonidos de dibujos animados (pops, boings, chispas), nunca
 * estridentes ni de "error" duro. Un nino que falla debe oir algo simpatico,
 * no una alarma.
 *
 * Uso:
 *   npm run voice:sfx -- --dry-run
 *   npm run voice:sfx
 */
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

import { ErrorFatalElevenLabs, generarSonido, leerApiKey } from './lib/elevenlabs.js';

const DIR_SALIDA = resolve(
  import.meta.dirname,
  '..',
  'apps',
  'frontend',
  'public',
  'static',
  'audio',
  'sfx',
);

interface EfectoSonido {
  readonly clave: string;
  /** La API entiende mejor las descripciones en ingles. */
  readonly descripcion: string;
  readonly duracion: number;
}

const EFECTOS: readonly EfectoSonido[] = [
  { clave: 'ficha-colocada', descripcion: 'soft playful pop, placing a wooden toy block, short and clean', duracion: 0.4 },
  { clave: 'ficha-quitada', descripcion: 'soft reverse pop, removing a toy block, very short', duracion: 0.3 },
  { clave: 'boton', descripcion: 'friendly UI button click for a kids game, bright and short', duracion: 0.3 },
  { clave: 'rodar', descripcion: 'fuzzy ball rolling on a wooden track, soft continuous whoosh', duracion: 0.8 },
  { clave: 'salto', descripcion: 'cartoon boing spring jump, bouncy and funny', duracion: 0.6 },
  { clave: 'choque', descripcion: 'funny cartoon bump, soft comedic thud, not scary for children', duracion: 0.7 },
  { clave: 'estrella', descripcion: 'magical sparkle chime collecting a star, bright twinkle', duracion: 0.9 },
  { clave: 'moneda', descripcion: 'coin pickup ding, classic video game, bright', duracion: 0.5 },
  { clave: 'victoria', descripcion: 'short happy victory fanfare for kids, cheerful and warm', duracion: 2.0 },
  { clave: 'tres-estrellas', descripcion: 'celebratory sparkle cascade with confetti, joyful kids reward', duracion: 2.4 },
  { clave: 'desbloqueo', descripcion: 'magical unlock shimmer, new world opening, wondrous', duracion: 1.5 },
  { clave: 'compra', descripcion: 'cash register plus happy chime, toy shop purchase', duracion: 1.0 },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  console.log('CodeNest School - generador de efectos de sonido\n');

  if (dryRun) {
    for (const efecto of EFECTOS) {
      console.log(`  ${efecto.clave.padEnd(16)} ${efecto.duracion}s  "${efecto.descripcion}"`);
    }
    console.log(`\n${EFECTOS.length} efectos. Simulacion: no se llamo a la API.`);
    return;
  }

  const apiKey = leerApiKey(true);
  mkdirSync(DIR_SALIDA, { recursive: true });

  let generados = 0;
  let omitidos = 0;
  let fallidos = 0;

  for (const efecto of EFECTOS) {
    const destino = join(DIR_SALIDA, `${efecto.clave}.mp3`);
    if (existsSync(destino) && !force) {
      omitidos++;
      continue;
    }
    try {
      const audio = await generarSonido({
        apiKey,
        descripcion: efecto.descripcion,
        duracionSegundos: efecto.duracion,
      });
      const tmp = `${destino}.tmp`;
      writeFileSync(tmp, audio);
      renameSync(tmp, destino);
      generados++;
      console.log(`OK  ${efecto.clave}.mp3  (${(audio.length / 1024).toFixed(0)} KB)`);
      await esperar(800);
    } catch (error) {
      if (error instanceof ErrorFatalElevenLabs) throw error;
      fallidos++;
      console.error(`ERR ${efecto.clave}: ${(error as Error).message}`);
    }
  }

  console.log(`\nGenerados: ${generados} | Omitidos: ${omitidos} | Fallidos: ${fallidos}`);
  console.log(`Salida: apps/frontend/public/static/audio/sfx/`);
  if (fallidos > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`\nFALLO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
