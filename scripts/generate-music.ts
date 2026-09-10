/**
 * Genera la musica de fondo de los treinta biomas con la API de musica de
 * ElevenLabs. Se ejecuta una vez; los MP3 quedan servidos como estaticos y el
 * juego los reproduce en bucle con Howler.
 *
 * TRES REGLAS QUE MANDAN SOBRE EL GUSTO. Esta musica no se escucha: se oye
 * debajo de otra cosa. Suena al 22% de volumen, por debajo de la voz de Nube,
 * mientras un nino intenta resolver algo.
 *
 *  1. Sin melodia que se pegue. Un tema pegadizo compite con la instruccion
 *     hablada y gana, y entonces el nino no se entera de lo que hay que hacer.
 *     Se piden texturas, no canciones.
 *  2. Sin voces, sin percusion fuerte y sin cambios bruscos. Cualquier acento
 *     marcado se lee como que ha pasado algo en el juego.
 *  3. Que empiece y acabe igual de suave. El clip se repite en bucle sin corte,
 *     asi que el punto de union se oye una vez por minuto: si los dos extremos
 *     son el mismo acorde sostenido, casi no se nota.
 *
 * La estetica sigue a los tres grupos de edad: madera y campanas para los
 * pequenos, mas cuerpo y aventura para los medianos, sintetizadores contenidos
 * para los mayores.
 *
 * Uso:
 *   npm run voice:music -- --dry-run
 *   npm run voice:music -- --worlds 1-3
 *   npm run voice:music
 */
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

import { ErrorFatalElevenLabs, generarMusica, leerApiKey } from './lib/elevenlabs.js';
import { cargarEntorno } from './lib/entorno.js';
import { MUNDOS } from './lib/shared.js';

cargarEntorno();

const DIR_SALIDA = resolve(
  import.meta.dirname,
  '..',
  'apps',
  'frontend',
  'public',
  'static',
  'audio',
  'musica',
);

/**
 * Duracion de cada pista.
 *
 * Cincuenta segundos es el equilibrio: mas corto y la repeticion se nota en una
 * actividad que cuesta dos minutos; mas largo y son megabytes que una tableta de
 * colegio tiene que descargar al entrar en cada mundo.
 */
const DURACION_MS = 50_000;

/** Lo que se le pide a todas, para que las treinta suenen de la misma familia. */
const COMUN =
  'Instrumental only, no vocals, no drums, no sudden accents. Very soft dynamics, ' +
  'sits quietly under a narrator. Seamless ambient loop that begins and ends on the ' +
  'same sustained soft chord.';

interface PistaBioma {
  /** Coincide con el campo `bioma` del catalogo: es el nombre del archivo. */
  readonly bioma: string;
  readonly descripcion: string;
}

const PISTAS: readonly PistaBioma[] = [
  // ── Exploradores: madera, campanas, curiosidad ──
  { bioma: 'espacio-pastel', descripcion: 'Weightless pastel space lullaby, soft marimba and glassy bells, gentle wonder' },
  { bioma: 'bosque-arcoiris', descripcion: 'Sunny rainbow forest, warm ukulele harmonics and kalimba, light and friendly' },
  { bioma: 'pradera', descripcion: 'Open sunny meadow, soft acoustic guitar pads and pizzicato strings, breezy' },
  { bioma: 'cueva-cristal', descripcion: 'Crystal cave, dripping glass bells and deep warm drone, curious and echoey' },
  { bioma: 'oasis-dulce', descripcion: 'Sweet desert oasis, soft nylon guitar and dulcimer, warm and inviting' },
  { bioma: 'castillo-nubes', descripcion: 'Cloud castle, airy celesta and soft choir-like pads, floating and calm' },
  { bioma: 'bahia-pirata', descripcion: 'Friendly pirate bay at dawn, gentle accordion and soft mandolin, playful not rowdy' },
  { bioma: 'montana-neon', descripcion: 'Neon mountain, glowing soft synth bells over warm pads, bright and hypnotic' },
  { bioma: 'valle-jurasico', descripcion: 'Prehistoric valley, low warm flutes and soft mallets, ancient and green' },
  { bioma: 'estacion-espacial', descripcion: 'Friendly space station, soft analog synth pads and tiny bleeps, calm and hopeful' },

  // ── Creadores: mas cuerpo, aventura contenida ──
  { bioma: 'reino-cristal', descripcion: 'Crystal kingdom, shimmering glass harp and warm strings, elegant and clear' },
  { bioma: 'cuevas-mecanicas', descripcion: 'Mechanical caves, soft ticking textures and warm bass drone, curious workshop feel' },
  { bioma: 'ciudad-engranajes', descripcion: 'City of gears, gentle clockwork pulses and mellow brass pads, industrious but calm' },
  { bioma: 'templo-elementos', descripcion: 'Elemental temple, low hand-drum-free ambience, soft koto and airy flute, reverent' },
  { bioma: 'laberinto-iso', descripcion: 'Endless geometric maze, soft looping arpeggio and warm pads, focused and puzzling' },
  { bioma: 'fabrica-baterias', descripcion: 'Battery factory, humming electric pads and soft bell tones, steady energy' },
  { bioma: 'bioma-congelado', descripcion: 'Frozen biome, icy glass pads and distant soft bells, still and cold but kind' },
  { bioma: 'archipielago-volcanico', descripcion: 'Volcanic islands, warm low drone and soft island mallets, gentle heat and sea air' },
  { bioma: 'mision-recon', descripcion: 'Quiet reconnaissance, soft pulsing bass and sparse high tones, alert and patient' },
  { bioma: 'fortaleza-titan', descripcion: 'Titan fortress, deep warm strings and slow noble pads, big but never loud' },

  // ── Hackers: electronica contenida, para concentrarse ──
  { bioma: 'ciudad-ciber', descripcion: 'Cyber city at night, mellow synthwave pads and soft neon arpeggio, cool and focused' },
  { bioma: 'servidor-olvidado', descripcion: 'Forgotten server room, warm hum and slow dusty synth pads, lonely and calm' },
  { bioma: 'laboratorio', descripcion: 'Clean antivirus lab, soft clinical synth tones and gentle pulse, precise and calm' },
  { bioma: 'red-submarina', descripcion: 'Deep underwater network, submerged warm pads and slow sonar-like tones, spacious' },
  { bioma: 'reactor-nuclear', descripcion: 'Contained reactor, steady low hum and soft glowing pads, powerful but stable' },
  { bioma: 'desierto-algoritmos', descripcion: 'Algorithm desert, dry warm pads and sparse plucked notes, vast and thoughtful' },
  { bioma: 'satelite', descripcion: 'Drifting satellite, soft radio static texture and distant warm chords, weightless' },
  { bioma: 'centro-drones', descripcion: 'Drone control center, light hovering synth pads and soft blips, airy and precise' },
  { bioma: 'arena-ciber', descripcion: 'Clean cyber arena, minimal crisp synth pads and quiet pulse, sharp and uncluttered' },
  { bioma: 'nucleo-ia', descripcion: 'The AI core, deep warm choir-like synth and slow luminous pads, awe and warmth' },
];

/** `--worlds 1-3` limita a los biomas de esos mundos. */
function biomasPedidos(): Set<string> | null {
  const i = process.argv.indexOf('--worlds');
  if (i === -1) return null;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith('--')) throw new Error('--worlds necesita un valor (1, 1-10 o 1,3,5)');

  const numeros = new Set<number>();
  for (const parte of valor.split(',')) {
    const rango = parte.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (rango) {
      for (let n = Number(rango[1]); n <= Number(rango[2]); n++) numeros.add(n);
    } else if (/^\d+$/.test(parte.trim())) {
      numeros.add(Number(parte.trim()));
    }
  }

  const biomas = new Set<string>();
  for (const mundo of MUNDOS) {
    if (numeros.has(mundo.numero)) biomas.add(mundo.bioma);
  }
  return biomas;
}

/**
 * Comprueba que hay una pista por bioma del catalogo y ninguna de sobra.
 *
 * Un bioma sin pista es un mundo en silencio, y con el respaldo de voz del
 * navegador retirado el silencio ya no se distingue de una averia.
 */
function comprobarCobertura(): void {
  const declarados = new Set(PISTAS.map((p) => p.bioma));
  const faltan = MUNDOS.filter((m) => !declarados.has(m.bioma));
  const sobran = PISTAS.filter((p) => !MUNDOS.some((m) => m.bioma === p.bioma));

  if (faltan.length > 0) {
    throw new Error(
      `Sin musica: ${faltan.map((m) => `mundo ${m.numero} (${m.bioma})`).join(', ')}`,
    );
  }
  if (sobran.length > 0) {
    throw new Error(`Biomas que no existen en el catalogo: ${sobran.map((p) => p.bioma).join(', ')}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const filtro = biomasPedidos();

  console.log('CodeNest School - generador de musica de fondo\n');
  comprobarCobertura();

  const pendientes = PISTAS.filter((p) => !filtro || filtro.has(p.bioma));

  if (dryRun) {
    for (const pista of pendientes) {
      console.log(`  ${pista.bioma.padEnd(24)} "${pista.descripcion}"`);
    }
    const segundos = (pendientes.length * DURACION_MS) / 1000;
    console.log(`\n${pendientes.length} pistas, ${segundos}s de musica. Simulacion: no se llamo a la API.`);
    return;
  }

  const apiKey = leerApiKey(true);
  mkdirSync(DIR_SALIDA, { recursive: true });

  let generadas = 0;
  let omitidas = 0;
  let fallidas = 0;

  for (const pista of pendientes) {
    const destino = join(DIR_SALIDA, `${pista.bioma}.mp3`);
    if (existsSync(destino) && !force) {
      omitidas++;
      continue;
    }

    try {
      const audio = await generarMusica({
        apiKey,
        descripcion: `${pista.descripcion}. ${COMUN}`,
        duracionMs: DURACION_MS,
      });
      // Escritura atomica: un corte a mitad no deja un MP3 roto que luego
      // parezca generado y se omita en la siguiente pasada.
      const tmp = `${destino}.tmp`;
      writeFileSync(tmp, audio);
      renameSync(tmp, destino);
      generadas++;
      console.log(`OK  ${pista.bioma}.mp3  (${(audio.length / 1024).toFixed(0)} KB)`);
      await esperar(1000);
    } catch (error) {
      if (error instanceof ErrorFatalElevenLabs) throw error;
      fallidas++;
      console.error(`ERR ${pista.bioma}: ${(error as Error).message}`);
    }
  }

  console.log(`\nGeneradas: ${generadas} | Omitidas: ${omitidas} | Fallidas: ${fallidas}`);
  console.log('Salida: apps/frontend/public/static/audio/musica/');
  if (fallidas > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`\nFALLO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
