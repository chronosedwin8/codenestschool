/**
 * Sincroniza el manifest de audio generado con la tabla `audios`.
 *
 * Es el unico puente entre el generador (que no toca la base de datos) y la
 * base de datos (que no llama a ElevenLabs). Un solo sentido de escritura:
 *
 *   generate-voiceover.ts  ->  manifest.json  ->  sync-audio.ts  ->  audios
 *
 * Uso: npm run voice:sync
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

import { rutaAudio, type AudioManifest } from '@codenest/shared';

const prisma = new PrismaClient();

const RUTA_MANIFEST = resolve(
  import.meta.dirname,
  '..',
  '..',
  'frontend',
  'public',
  'static',
  'audio',
  'manifest.json',
);

async function main(): Promise<void> {
  if (!existsSync(RUTA_MANIFEST)) {
    console.log('No hay manifest.json todavia. Ejecuta antes: npm run voice:generate');
    return;
  }

  const manifest = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8')) as AudioManifest;
  const entradas = Object.values(manifest.entradas);

  let actualizados = 0;
  let sinFila = 0;
  const huerfanos: string[] = [];

  for (const entrada of entradas) {
    const fila = await prisma.audioAsset.findUnique({ where: { clave: entrada.clave } });
    if (!fila) {
      sinFila++;
      huerfanos.push(entrada.clave);
      continue;
    }

    // Si el hash del manifest no coincide con el texto actual en base de datos,
    // el MP3 corresponde a una version vieja del texto: queda obsoleto.
    const coincide = fila.textoHash === entrada.hash;

    await prisma.audioAsset.update({
      where: { id: fila.id },
      data: {
        estado: coincide ? 'generado' : 'obsoleto',
        rutaArchivo: rutaAudio(entrada.clave),
        duracionMs: entrada.duracionMs ?? null,
        tamanoBytes: entrada.tamanoBytes,
        generadoEn: new Date(entrada.generadoEn),
        error: coincide ? null : 'El texto cambio despues de generar el audio',
      },
    });
    actualizados++;
  }

  const [generados, pendientes, obsoletos] = await Promise.all([
    prisma.audioAsset.count({ where: { estado: 'generado' } }),
    prisma.audioAsset.count({ where: { estado: 'pendiente' } }),
    prisma.audioAsset.count({ where: { estado: 'obsoleto' } }),
  ]);

  console.log(`Entradas en el manifest : ${entradas.length}`);
  console.log(`Filas actualizadas      : ${actualizados}`);
  if (sinFila > 0) {
    console.log(`Sin fila en la base     : ${sinFila}  (${huerfanos.slice(0, 5).join(', ')}${huerfanos.length > 5 ? ', ...' : ''})`);
    console.log('  Sugerencia: ejecuta el seed para crear esas filas.');
  }
  console.log('');
  console.log(`Estado actual -> generados: ${generados} | pendientes: ${pendientes} | obsoletos: ${obsoletos}`);
}

main()
  .catch((error: unknown) => {
    console.error('FALLO al sincronizar el audio:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
