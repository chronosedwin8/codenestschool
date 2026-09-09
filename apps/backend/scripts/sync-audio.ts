/**
 * Sincroniza el manifest de audio generado con la tabla `audios`.
 *
 * Es el unico puente entre el generador (que no toca la base de datos) y la
 * base de datos (que no llama a ElevenLabs). Un solo sentido de escritura:
 *
 *   generate-voiceover.ts  ->  manifest.json  ->  sync-audio.ts  ->  audios
 *
 * Uso: npm run voice:sync              (informa de los audios huerfanos)
 *      npm run voice:sync -- --limpiar (y los borra)
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

/** Borrar filas es destructivo, asi que hay que pedirlo de forma explicita. */
const limpiar = process.argv.includes('--limpiar');

async function main(): Promise<void> {
  if (!existsSync(RUTA_MANIFEST)) {
    console.log('No hay manifest.json todavia. Ejecuta antes: npm run voice:generate');
    return;
  }

  const manifest = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8')) as AudioManifest;
  const entradas = Object.values(manifest.entradas);

  let actualizados = 0;
  let sinFila = 0;
  /** Claves que estan en el manifest pero no tienen fila en la base de datos. */
  const sinSembrar: string[] = [];

  for (const entrada of entradas) {
    const fila = await prisma.audioAsset.findUnique({ where: { clave: entrada.clave } });
    if (!fila) {
      sinFila++;
      sinSembrar.push(entrada.clave);
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

  // Audios que ya no referencia nadie.
  //
  // Aparecen cuando el contenido cambia: si una actividad pasa de tener su propio
  // texto de exito a usar el grupo compartido de celebraciones, su clip queda
  // suelto. Sin esta comprobacion se regeneraria en cada pasada, pagando por un
  // audio que nadie va a oir.
  const sinUsar = await prisma.audioAsset.findMany({
    where: {
      // Las frases de interfaz y las celebraciones no las referencia ninguna
      // actividad por diseno: se piden por clave desde el cliente.
      tipo: { in: ['instruccion', 'exito', 'pista', 'mundo_intro'] },
      actividadInstruccion: { none: {} },
      actividadExito: { none: {} },
      pistas: { none: {} },
      mundosIntro: { none: {} },
    },
    select: { id: true, clave: true, tipo: true },
  });

  if (sinUsar.length > 0) {
    console.log('');
    console.log(`Audios sin usar         : ${sinUsar.length}`);
    for (const h of sinUsar.slice(0, 10)) {
      console.log(`  ${h.clave} (${h.tipo})`);
    }
    if (sinUsar.length > 10) console.log(`  ... y ${sinUsar.length - 10} mas`);

    if (limpiar) {
      await prisma.audioAsset.deleteMany({ where: { id: { in: sinUsar.map((h) => h.id) } } });
      console.log(`  Borrados. Los archivos MP3 siguen en disco; se pueden borrar a mano.`);
    } else {
      console.log('  Ejecuta con --limpiar para borrarlos de la base de datos.');
    }
  }

  const [generados, pendientes, obsoletos] = await Promise.all([
    prisma.audioAsset.count({ where: { estado: 'generado' } }),
    prisma.audioAsset.count({ where: { estado: 'pendiente' } }),
    prisma.audioAsset.count({ where: { estado: 'obsoleto' } }),
  ]);

  console.log(`Entradas en el manifest : ${entradas.length}`);
  console.log(`Filas actualizadas      : ${actualizados}`);
  if (sinFila > 0) {
    console.log(
      `Sin fila en la base     : ${sinFila}  (${sinSembrar.slice(0, 5).join(', ')}${sinSembrar.length > 5 ? ', ...' : ''})`,
    );
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
