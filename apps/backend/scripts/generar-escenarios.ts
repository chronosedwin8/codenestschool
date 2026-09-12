/**
 * Genera los diez escenarios del constructor de juegos y los sube a S3.
 *
 * Se ejecuta a mano, una vez por escenario nuevo:
 *
 *   npx tsx apps/backend/scripts/generar-escenarios.ts            (los que falten)
 *   npx tsx apps/backend/scripts/generar-escenarios.ts --forzar espacio bosque
 *
 * Tres cosas que no son obvias:
 *
 *  1. **Un fondo, no una escena.** El centro se pide vacío a propósito: encima
 *     va a haber un personaje, obstáculos y un marcador. Un fondo bonito con un
 *     dragón en medio hace el juego ilegible.
 *  2. **Se recomprime a JPEG con Chrome.** Magnific devuelve PNG de un mega, y
 *     un mega por escenario en la tableta de un colegio con wifi compartida es
 *     una espera tonta. No hay librería de imagen en el proyecto y no hacía
 *     falta traerla: el Chrome que ya se usa para verificar en el navegador sabe
 *     dibujar en un lienzo y exportar en JPEG. Baja de ~1100 KB a ~150 KB.
 *  3. **Se sube una vez y se sirve con caché de un año.** El alumno nunca genera
 *     imágenes: no se le puede dar a un niño un botón que gasta créditos.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ESCENARIOS, type Escenario } from '@codenest/shared';

import { almacenConfigurado, cargarConfig } from '../src/lib/env.js';
import { ClienteS3 } from '../src/lib/s3.js';
import { RUTAS } from '../src/services/almacen.service.js';

const BASE_MAGNIFIC = 'https://api.magnific.com';
const ANCHO = 1280;
const ALTO = 720;
const CALIDAD_JPEG = 0.86;

/**
 * Lo que se le pide a la IA por escenario.
 *
 * Todos comparten el mismo final del texto porque lo que hace útil un fondo no
 * es el tema, es que esté vacío por el medio y que no tenga letras: un rótulo
 * generado en inglés en el fondo de un juego de un niño colombiano se queda ahí
 * para siempre.
 */
const COMUN =
  'flat vector illustration, 2D game parallax background, no characters, no creatures, no text, no letters, no user interface, empty uncluttered center for gameplay, bright cheerful colors for children, soft shapes';

const TEMAS: Record<Escenario, string> = {
  espacio: 'outer space with purple and blue nebula, small stars, two distant planets',
  bosque: 'enchanted green forest clearing seen from the side, tall trees at both edges, soft sunbeams',
  oceano: 'underwater scene, turquoise water, coral and seaweed only at the bottom edge, bubbles',
  ciudad: 'friendly city skyline at daytime seen from far, rounded buildings at the bottom, fluffy clouds',
  nieve: 'snowy mountain landscape, pine trees at the bottom edges, falling snowflakes, pale blue sky',
  volcan: 'volcanic landscape at dusk, dark rocks at the bottom, orange lava glow, ash clouds',
  desierto: 'desert dunes at golden hour, distant pyramids on the horizon, warm sand tones',
  castillo: 'floating castle towers above the clouds at sunrise, pink and gold sky',
  laboratorio:
    'science laboratory wall seen from the side, shelves with colorful flasks only at the edges, clean light walls',
  dulces: 'candy land, chocolate ground at the bottom edge, lollipops and cupcakes at the edges, pastel pink sky',
};

/** La música de cada escenario. Ya está grabada: son las de los 30 mundos. */
export const MUSICA_POR_ESCENARIO: Record<Escenario, string> = {
  espacio: 'espacio-pastel',
  bosque: 'bosque-arcoiris',
  oceano: 'red-submarina',
  ciudad: 'ciudad-ciber',
  nieve: 'bioma-congelado',
  volcan: 'archipielago-volcanico',
  desierto: 'desierto-algoritmos',
  castillo: 'castillo-nubes',
  laboratorio: 'laboratorio',
  dulces: 'oasis-dulce',
};

// ───────────────────────────── Magnific ──────────────────────────────────

async function generarConIa(clave: Escenario, apiKey: string): Promise<Buffer> {
  const cabeceras = { 'x-magnific-api-key': apiKey, 'Content-Type': 'application/json' };

  const creada = await fetch(`${BASE_MAGNIFIC}/v1/ai/mystic`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({
      prompt: `${TEMAS[clave]}, ${COMUN}`,
      aspect_ratio: 'widescreen_16_9',
      model: 'fluid',
      resolution: '1k',
      adherence: 60,
      filter_nsfw: true,
    }),
  });
  if (!creada.ok) throw new Error(`Magnific respondio ${creada.status} al pedir ${clave}`);

  const tarea = ((await creada.json()) as { data?: { task_id?: string } }).data?.task_id;
  if (!tarea) throw new Error(`Magnific no devolvio tarea para ${clave}`);

  for (let intento = 0; intento < 40; intento++) {
    await new Promise((r) => setTimeout(r, 3000));
    const respuesta = await fetch(`${BASE_MAGNIFIC}/v1/ai/mystic/${tarea}`, { headers: cabeceras });
    const datos = (await respuesta.json()) as {
      data?: { status?: string; generated?: string[]; has_nsfw?: boolean[]; error?: string };
    };
    const estado = datos.data?.status;

    if (estado === 'FAILED') throw new Error(`Magnific fallo con ${clave}: ${datos.data?.error}`);
    if (estado !== 'COMPLETED') continue;

    if (datos.data?.has_nsfw?.[0]) throw new Error(`${clave} no paso el filtro de contenido`);

    const url = datos.data?.generated?.[0];
    if (!url) throw new Error(`Magnific termino sin imagen para ${clave}`);

    // La direccion que da Magnific caduca en una hora: se descarga ahora.
    const imagen = await fetch(url);
    if (!imagen.ok) throw new Error(`No se pudo descargar el fondo de ${clave}`);
    return Buffer.from(await imagen.arrayBuffer());
  }

  throw new Error(`Magnific tardo demasiado con ${clave}`);
}

// ──────────────────── Recompresion con Chrome (CDP) ──────────────────────

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO_CDP = 9390;

interface Navegador {
  recomprimir(png: Buffer): Promise<Buffer>;
  cerrar(): void;
}

async function abrirNavegador(): Promise<Navegador> {
  const perfil = mkdtempSync(join(tmpdir(), 'cdp-escenarios-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PUERTO_CDP}`,
      `--user-data-dir=${perfil}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let wsUrl = '';
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const respuesta = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`);
      if (respuesta.ok) wsUrl = ((await respuesta.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl;
    } catch {
      // Todavia arrancando.
    }
  }
  if (!wsUrl) throw new Error('Chrome no abrio el depurador');

  const ws = new WebSocket(wsUrl);
  let siguienteId = 0;
  const pendientes = new Map<number, (valor: unknown) => void>();

  await new Promise<void>((r) => {
    ws.onopen = () => r();
  });
  ws.onmessage = (evento: MessageEvent) => {
    const mensaje = JSON.parse(String(evento.data)) as { id?: number; result?: unknown };
    if (mensaje.id && pendientes.has(mensaje.id)) {
      pendientes.get(mensaje.id)!(mensaje.result);
      pendientes.delete(mensaje.id);
    }
  };

  const enviar = (method: string, params: unknown = {}, sessionId?: string): Promise<unknown> => {
    const id = ++siguienteId;
    return new Promise((resolver) => {
      pendientes.set(id, resolver);
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  };

  const { targetId } = (await enviar('Target.createTarget', { url: 'about:blank' })) as {
    targetId: string;
  };
  const { sessionId } = (await enviar('Target.attachToTarget', { targetId, flatten: true })) as {
    sessionId: string;
  };
  await enviar('Runtime.enable', {}, sessionId);

  return {
    async recomprimir(png: Buffer): Promise<Buffer> {
      const entrada = `data:image/png;base64,${png.toString('base64')}`;
      const expresion = `(async () => {
        const imagen = new Image();
        imagen.src = ${JSON.stringify(entrada)};
        await imagen.decode();
        const lienzo = document.createElement('canvas');
        lienzo.width = ${ANCHO};
        lienzo.height = ${ALTO};
        const pincel = lienzo.getContext('2d');
        pincel.drawImage(imagen, 0, 0, ${ANCHO}, ${ALTO});
        return lienzo.toDataURL('image/jpeg', ${CALIDAD_JPEG});
      })()`;

      const resultado = (await enviar(
        'Runtime.evaluate',
        { expression: expresion, awaitPromise: true, returnByValue: true },
        sessionId,
      )) as { result?: { value?: string }; exceptionDetails?: unknown };

      const dataUrl = resultado.result?.value;
      if (!dataUrl?.startsWith('data:image/jpeg;base64,')) {
        throw new Error('Chrome no devolvio el JPEG');
      }
      return Buffer.from(dataUrl.slice('data:image/jpeg;base64,'.length), 'base64');
    },
    cerrar(): void {
      ws.close();
      chrome.kill();
    },
  };
}

// ──────────────────────────────── Guion ───────────────────────────────────

async function main(): Promise<void> {
  const config = cargarConfig();
  if (!almacenConfigurado(config)) throw new Error('Faltan las variables S3_* en el .env');
  if (!config.MAGNIFIC_API_KEY) throw new Error('Falta MAGNIFIC_API_KEY en el .env');

  const argumentos = process.argv.slice(2);
  const forzar = argumentos.includes('--forzar');
  const pedidos = argumentos.filter((a) => !a.startsWith('--')) as Escenario[];
  const lista = pedidos.length > 0 ? pedidos : [...ESCENARIOS];

  for (const clave of lista) {
    if (!(ESCENARIOS as readonly string[]).includes(clave)) {
      throw new Error(`"${clave}" no es un escenario del catalogo`);
    }
  }

  const s3 = new ClienteS3({
    bucket: config.S3_BUCKET!,
    region: config.S3_REGION,
    accessKeyId: config.S3_ACCESS_KEY_ID!,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
  });

  const existentes = new Set(await s3.listar('catalogo/escenarios/'));
  const porHacer = lista.filter((c) => forzar || !existentes.has(RUTAS.escenario(c)));

  console.log(`Escenarios: ${lista.length} pedidos, ${porHacer.length} por generar`);
  if (porHacer.length === 0) {
    console.log('Todos estan ya en el bucket. Con --forzar se rehacen.');
    return;
  }

  const navegador = await abrirNavegador();
  try {
    for (const clave of porHacer) {
      const t0 = Date.now();
      const png = await generarConIa(clave, config.MAGNIFIC_API_KEY);
      const jpeg = await navegador.recomprimir(png);
      const url = await s3.subir(RUTAS.escenario(clave), jpeg, 'image/jpeg');

      console.log(
        `  ${clave.padEnd(12)} ${(png.length / 1024).toFixed(0)} KB PNG -> ` +
          `${(jpeg.length / 1024).toFixed(0)} KB JPEG en ${((Date.now() - t0) / 1000).toFixed(0)}s`,
      );
      console.log(`               ${url}`);
    }
  } finally {
    navegador.cerrar();
  }

  const claves = await s3.listar('catalogo/escenarios/');
  console.log(`\nEn el bucket hay ${claves.filter((c) => c.endsWith('.jpg')).length} escenarios.`);
}

main().catch((error: unknown) => {
  console.error('\nNo se pudieron generar los escenarios:', error instanceof Error ? error.message : error);
  process.exit(1);
});
