/**
 * Generador OFFLINE de locuciones con ElevenLabs.
 *
 * Lee el contenido de packages/content y el catalogo de mundos, y produce los
 * MP3 en apps/frontend/public/static/audio/ junto con un manifest.json.
 * NO toca la base de datos: de eso se encarga apps/backend/scripts/sync-audio.ts
 * (una sola fuente de verdad, un solo sentido de escritura).
 *
 * Convencion de claves (la misma que packages/shared/src/types/audio.ts):
 *   instruction_world<X>_lvl<Y>   success_world<X>_lvl<Y>
 *   hint_world<X>_lvl<Y>_<n>      world<X>_intro
 *   ui_<slug>                     celebration_<n>
 *
 * Idempotencia: cada clip se identifica por sha256(texto+voz+modelo+ajustes+
 * formato). Si el hash no cambio y el archivo existe, se omite. Los textos
 * repetidos se cobran una sola vez gracias a la cache por contenido.
 *
 * Uso:
 *   npm run voice:generate -- --dry-run
 *   npm run voice:generate -- --worlds 1-2
 *   npm run voice:generate -- --worlds 1 --types instruction --limit 1
 *   npm run voice:generate -- --types ui,celebration
 *   npm run voice:generate -- --worlds 3 --force
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';

import {
  AUDIO_PREFIX,
  MUNDOS,
  POOL_CELEBRACIONES,
  TIPO_AUDIO,
  claveCelebracion,
  claveExito,
  claveInstruccion,
  claveMundoIntro,
  clavePista,
  claveUi,
  type AudioManifest,
  type EntradaManifest,
  type TipoAudio,
} from './lib/shared.js';
import {
  ErrorFatalElevenLabs,
  MODELO_POR_DEFECTO,
  OUTPUT_FORMAT,
  consultarSuscripcion,
  estimarDuracionMs,
  leerApiKey,
  textoAVoz,
} from './lib/elevenlabs.js';
import { cargarEntorno } from './lib/entorno.js';
import {
  CELEBRACIONES,
  FRASES_UI,
  VOZ_UI,
  textosDeContinuidad,
  textosDeHistoria,
  vozPara,
  type PerfilVoz,
} from '@codenest/content';
import { cargarMundos } from '@codenest/content/loader';

// La clave de ElevenLabs vive en el .env de la raiz.
cargarEntorno();

// ──────────────────────────── Rutas del proyecto ──────────────────────────

const RAIZ = resolve(import.meta.dirname, '..');
const DIR_SALIDA = join(RAIZ, 'apps', 'frontend', 'public', 'static', 'audio');
const DIR_CACHE = join(RAIZ, 'scripts', '.cache', 'audio');
const RUTA_MANIFEST = join(DIR_SALIDA, 'manifest.json');

// ─────────────────────────── Argumentos de consola ────────────────────────

interface Opciones {
  readonly mundos: readonly number[];
  readonly tipos: readonly TipoAudio[];
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly limite: number | null;
  readonly concurrencia: number;
}

/** Traduce el nombre publico del tipo (ingles) al enum interno (espanol). */
const TIPO_POR_ALIAS: Readonly<Record<string, TipoAudio>> = {
  instruction: TIPO_AUDIO.instruccion,
  success: TIPO_AUDIO.exito,
  hint: TIPO_AUDIO.pista,
  ui: TIPO_AUDIO.ui,
  intro: TIPO_AUDIO.mundo_intro,
  celebration: TIPO_AUDIO.celebracion,
};

function parsearRango(valor: string): number[] {
  const numeros = new Set<number>();
  for (const parte of valor.split(',')) {
    const rango = parte.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (rango) {
      const desde = Number(rango[1]);
      const hasta = Number(rango[2]);
      for (let n = desde; n <= hasta; n++) numeros.add(n);
    } else if (/^\d+$/.test(parte.trim())) {
      numeros.add(Number(parte.trim()));
    } else if (parte.trim()) {
      throw new Error(`Rango de mundos invalido: "${parte}". Usa 1, 1-10 o 1,3,5.`);
    }
  }
  return [...numeros].sort((a, b) => a - b);
}

function parsearOpciones(argv: readonly string[]): Opciones {
  const valor = (bandera: string): string | undefined => {
    const i = argv.indexOf(bandera);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) throw new Error(`${bandera} necesita un valor`);
    return v;
  };

  const mundosArg = valor('--worlds');
  const tiposArg = valor('--types');
  const limiteArg = valor('--limit');
  const concArg = valor('--concurrency');

  const tipos = tiposArg
    ? tiposArg.split(',').map((t) => {
        const tipo = TIPO_POR_ALIAS[t.trim()];
        if (!tipo) {
          throw new Error(
            `Tipo desconocido: "${t}". Validos: ${Object.keys(TIPO_POR_ALIAS).join(', ')}`,
          );
        }
        return tipo;
      })
    : (Object.values(TIPO_AUDIO) as TipoAudio[]);

  return {
    mundos: mundosArg ? parsearRango(mundosArg) : MUNDOS.map((m) => m.numero),
    tipos,
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    limite: limiteArg ? Number(limiteArg) : null,
    concurrencia: concArg ? Math.max(1, Math.min(5, Number(concArg))) : 2,
  };
}

// ─────────────────────────── Trabajos de locucion ─────────────────────────

interface Trabajo {
  readonly clave: string;
  readonly tipo: TipoAudio;
  readonly texto: string;
  readonly voz: PerfilVoz;
  readonly origen: string;
}

/** sha256 estable de todo lo que afecta al audio resultante. */
function hashDe(trabajo: Trabajo): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        texto: trabajo.texto,
        voz: trabajo.voz.elevenVoiceId,
        modelo: trabajo.voz.modelo,
        settings: trabajo.voz.settings,
        formato: OUTPUT_FORMAT,
      }),
    )
    .digest('hex');
}

/**
 * Normaliza el texto para que suene natural: quita markdown, expande las
 * abreviaturas de mundo y colapsa espacios.
 */
function normalizar(texto: string): string {
  return texto
    .replace(/[*_`#]/g, '')
    .replace(/\bM(\d{1,2})\b/g, (_, n: string) => `mundo ${n}`)
    .replace(/\s+/g, ' ')
    .trim();
}

/** El audio esta pre-renderizado: una plantilla sin sustituir se oiria literal. */
function verificarSinPlantillas(trabajo: Trabajo): void {
  if (/[{}]/.test(trabajo.texto)) {
    throw new Error(
      `El texto de "${trabajo.clave}" (${trabajo.origen}) contiene {plantillas}. ` +
        'El audio es pre-renderizado y no puede personalizarse en tiempo real.',
    );
  }
}

/** Construye la lista completa de clips a generar. */
async function construirTrabajos(opciones: Opciones): Promise<Trabajo[]> {
  const trabajos: Trabajo[] = [];
  const quiere = (t: TipoAudio): boolean => opciones.tipos.includes(t);

  // Frases fijas de interfaz.
  if (quiere(TIPO_AUDIO.ui)) {
    for (const frase of FRASES_UI) {
      trabajos.push({
        clave: claveUi(frase.slug),
        tipo: TIPO_AUDIO.ui,
        texto: normalizar(frase.texto),
        voz: VOZ_UI,
        origen: 'packages/content/src/ui-phrases.ts',
      });
    }
  }

  // Narracion de las cinematicas. La cuenta Nube, con la misma voz calida que
  // guia a los pequenos: es el mismo personaje.
  if (quiere(TIPO_AUDIO.ui)) {
    for (const { clave, texto } of textosDeHistoria()) {
      trabajos.push({
        clave,
        tipo: TIPO_AUDIO.ui,
        texto: normalizar(texto),
        voz: VOZ_UI,
        origen: 'packages/content/src/historia.ts',
      });
    }
  }

  // Lo que se dice al terminar: el reto de la siguiente actividad y el puente
  // al mundo que viene. Misma voz, porque sigue siendo Nube quien habla.
  if (quiere(TIPO_AUDIO.ui)) {
    for (const { clave, texto } of textosDeContinuidad()) {
      trabajos.push({
        clave,
        tipo: TIPO_AUDIO.ui,
        texto: normalizar(texto),
        voz: VOZ_UI,
        origen: 'packages/content/src/continuidad.ts',
      });
    }
  }

  // Pool de celebraciones compartidas por todas las actividades.
  if (quiere(TIPO_AUDIO.celebracion)) {
    CELEBRACIONES.slice(0, POOL_CELEBRACIONES).forEach((texto, i) => {
      trabajos.push({
        clave: claveCelebracion(i + 1),
        tipo: TIPO_AUDIO.celebracion,
        texto: normalizar(texto),
        voz: VOZ_UI,
        origen: 'packages/content/src/ui-phrases.ts',
      });
    });
  }

  const contenido = await cargarMundos(opciones.mundos);

  for (const { contenido: archivo } of contenido) {
    const mundo = MUNDOS.find((m) => m.numero === archivo.mundo);
    if (!mundo) throw new Error(`El archivo declara el mundo ${archivo.mundo}, que no existe`);
    const origen = `packages/content/worlds (mundo ${mundo.numero})`;

    if (quiere(TIPO_AUDIO.mundo_intro)) {
      trabajos.push({
        clave: claveMundoIntro(mundo.numero),
        tipo: TIPO_AUDIO.mundo_intro,
        texto: normalizar(archivo.introTexto),
        voz: vozPara(mundo.grupo, TIPO_AUDIO.mundo_intro),
        origen,
      });
    }

    for (const act of archivo.actividades) {
      const n = act.numeroEnMundo;

      if (quiere(TIPO_AUDIO.instruccion)) {
        trabajos.push({
          clave: claveInstruccion(mundo.numero, n),
          tipo: TIPO_AUDIO.instruccion,
          texto: normalizar(act.instruccionTexto),
          voz: vozPara(mundo.grupo, TIPO_AUDIO.instruccion),
          origen,
        });
      }

      // Solo se graba un exito propio si la actividad no usa el pool generico.
      const usaPool = act.config.audio.exito.startsWith(AUDIO_PREFIX.celebracion);
      if (quiere(TIPO_AUDIO.exito) && !usaPool) {
        trabajos.push({
          clave: claveExito(mundo.numero, n),
          tipo: TIPO_AUDIO.exito,
          texto: normalizar(act.exitoTexto),
          voz: vozPara(mundo.grupo, TIPO_AUDIO.exito),
          origen,
        });
      }

      if (quiere(TIPO_AUDIO.pista)) {
        act.pistas.forEach((pista, i) => {
          trabajos.push({
            clave: clavePista(mundo.numero, n, i + 1),
            tipo: TIPO_AUDIO.pista,
            texto: normalizar(pista),
            voz: vozPara(mundo.grupo, TIPO_AUDIO.pista),
            origen,
          });
        });
      }
    }
  }

  return trabajos;
}

// ─────────────────────────────── Manifest ─────────────────────────────────

function cargarManifest(): AudioManifest {
  if (!existsSync(RUTA_MANIFEST)) {
    return { version: 1, modelo: MODELO_POR_DEFECTO, formato: OUTPUT_FORMAT, entradas: {} };
  }
  return JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8')) as AudioManifest;
}

/** Se guarda tras CADA clip: una interrupcion no pierde lo ya pagado. */
function guardarManifest(manifest: AudioManifest): void {
  mkdirSync(dirname(RUTA_MANIFEST), { recursive: true });
  const tmp = `${RUTA_MANIFEST}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  renameSync(tmp, RUTA_MANIFEST);
}

/** Escritura atomica: nunca queda un MP3 a medias si se corta el proceso. */
function escribirAtomico(ruta: string, datos: Buffer): void {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, datos);
  renameSync(tmp, ruta);
}

// ──────────────────────────────── Principal ───────────────────────────────

async function main(): Promise<void> {
  const opciones = parsearOpciones(process.argv.slice(2));
  const manifest = cargarManifest();

  console.log('CodeNest School - generador de locuciones (ElevenLabs)');
  console.log(`  mundos       : ${opciones.mundos.length === 30 ? 'todos (1-30)' : opciones.mundos.join(', ')}`);
  console.log(`  tipos        : ${opciones.tipos.join(', ')}`);
  console.log(`  modo         : ${opciones.dryRun ? 'SIMULACION (--dry-run)' : 'generacion real'}`);
  console.log(`  concurrencia : ${opciones.concurrencia}`);
  console.log('');

  const todos = await construirTrabajos(opciones);
  for (const t of todos) verificarSinPlantillas(t);

  if (todos.length === 0) {
    console.log('No hay nada que generar. Falta contenido en packages/content/worlds/.');
    return;
  }

  // Reparto entre lo que ya esta y lo que falta.
  const pendientes: Trabajo[] = [];
  let omitidos = 0;

  for (const trabajo of todos) {
    const hash = hashDe(trabajo);
    const destino = join(DIR_SALIDA, `${trabajo.clave}.mp3`);
    const previo = manifest.entradas[trabajo.clave];
    const yaEsta = previo?.hash === hash && existsSync(destino);
    if (yaEsta && !opciones.force) {
      omitidos++;
      continue;
    }
    pendientes.push(trabajo);
  }

  const aGenerar = opciones.limite ? pendientes.slice(0, opciones.limite) : pendientes;
  const caracteres = aGenerar.reduce((suma, t) => suma + t.texto.length, 0);

  console.log(`Clips totales    : ${todos.length}`);
  console.log(`Ya generados     : ${omitidos}`);
  console.log(`Por generar      : ${aGenerar.length}`);
  console.log(`Caracteres       : ${caracteres.toLocaleString('es-CO')}`);
  console.log('');

  if (opciones.dryRun) {
    for (const t of aGenerar.slice(0, 40)) {
      console.log(`  [${t.tipo}] ${t.clave}  (${t.voz.nombre}, ${t.texto.length} car.)`);
    }
    if (aGenerar.length > 40) console.log(`  ... y ${aGenerar.length - 40} mas`);
    console.log('\nSimulacion terminada. No se llamo a la API ni se escribio ningun MP3.');
    return;
  }

  if (aGenerar.length === 0) {
    console.log('Todo esta al dia. Nada que generar.');
    return;
  }

  const apiKey = leerApiKey(true);

  // Comprobacion de cuota antes de gastar.
  try {
    const sub = await consultarSuscripcion(apiKey);
    console.log(
      `Cuota ElevenLabs : ${sub.caracteresDisponibles.toLocaleString('es-CO')} caracteres disponibles (plan ${sub.nivel})`,
    );
    if (sub.caracteresDisponibles < caracteres && !opciones.force) {
      throw new ErrorFatalElevenLabs(
        `Faltan caracteres: necesitas ${caracteres} y tienes ${sub.caracteresDisponibles}. ` +
          'Genera por lotes con --worlds o usa --force para intentarlo igual.',
        422,
      );
    }
  } catch (error) {
    if (error instanceof ErrorFatalElevenLabs && error.status === 422) throw error;
    console.warn(`  (no se pudo verificar la cuota: ${(error as Error).message})`);
  }
  console.log('');

  mkdirSync(DIR_SALIDA, { recursive: true });
  mkdirSync(DIR_CACHE, { recursive: true });

  let generados = 0;
  let desdeCache = 0;
  let fallidos = 0;
  let indice = 0;

  /** Un worker toma trabajos de la cola hasta agotarla. */
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = indice++;
      const trabajo = aGenerar[i];
      if (!trabajo) return;

      const hash = hashDe(trabajo);
      const destino = join(DIR_SALIDA, `${trabajo.clave}.mp3`);
      const enCache = join(DIR_CACHE, `${hash}.mp3`);

      try {
        let bytes: number;

        if (existsSync(enCache)) {
          // Mismo texto y misma voz que otro clip ya pagado: se copia.
          copyFileSync(enCache, destino);
          bytes = readFileSync(destino).length;
          desdeCache++;
        } else {
          const audio = await textoAVoz({
            apiKey,
            texto: trabajo.texto,
            voiceId: trabajo.voz.elevenVoiceId,
            modelo: trabajo.voz.modelo,
            settings: trabajo.voz.settings,
          });
          escribirAtomico(destino, audio);
          escribirAtomico(enCache, audio);
          bytes = audio.length;
          generados++;
          await esperar(400); // cortesia con la API
        }

        const entrada: EntradaManifest = {
          clave: trabajo.clave,
          tipo: trabajo.tipo,
          voz: trabajo.voz.clave,
          hash,
          archivo: `${trabajo.clave}.mp3`,
          caracteres: trabajo.texto.length,
          tamanoBytes: bytes,
          duracionMs: estimarDuracionMs(bytes),
          generadoEn: new Date().toISOString(),
        };
        manifest.entradas[trabajo.clave] = entrada;
        guardarManifest(manifest);

        console.log(`OK  ${trabajo.clave}  (${(bytes / 1024).toFixed(0)} KB, ${trabajo.voz.nombre})`);
      } catch (error) {
        if (error instanceof ErrorFatalElevenLabs) throw error; // aborta todo
        fallidos++;
        console.error(`ERR ${trabajo.clave}: ${(error as Error).message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: opciones.concurrencia }, worker));

  console.log('');
  console.log(`Generados   : ${generados}`);
  console.log(`Desde cache : ${desdeCache}`);
  console.log(`Omitidos    : ${omitidos}`);
  console.log(`Fallidos    : ${fallidos}`);
  console.log(`Salida      : apps/frontend/public/static/audio/`);
  console.log('');
  console.log('Siguiente paso: npm run voice:sync  (actualiza la tabla audios)');

  if (fallidos > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('');
  console.error(`FALLO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
