/**
 * Despliegue a produccion: variables, disparo y seguimiento.
 *
 * Normalmente no hace falta: al empujar a `main`, GitHub Actions prueba,
 * construye la imagen y llama a Coolify. Este script existe para las tres veces
 * en que eso no basta:
 *
 *  1. **Antes** de empujar, cuando hay variables de entorno nuevas. Tienen que
 *     estar en Coolify antes de que arranque la imagen, porque algunas cambian
 *     el comportamiento del servidor y no solo su configuracion: el CSP deriva
 *     el origen de S3 de `S3_BUCKET`, asi que sin ella Phaser no puede cargar
 *     ni un fondo y el constructor de juegos llega en degradado.
 *  2. Cuando el paso "Pedir el despliegue" falla —pasa si el secreto
 *     `COOLIFY_TOKEN` del repositorio esta obsoleto— y hay que encolarlo a mano.
 *  3. Para mirar como va, sin entrar al panel.
 *
 * Uso:
 *   npm run deploy:env -- S3_BUCKET S3_REGION   # copia esas del .env a Coolify
 *   npm run deploy:env -- --ver                 # solo lista, sin escribir
 *   npm run deploy                              # encola y espera
 *   npm run deploy:ci                           # sigue el workflow de GitHub
 *
 * Ningun valor de variable se imprime nunca, ni en los errores.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { parseEnv } from 'node:util';

import { cargarEntorno, RUTA_ENV } from './lib/entorno.js';

cargarEntorno();

/**
 * `POST`, no `GET`.
 *
 * En versiones antiguas de Coolify el disparo era `GET /api/v1/deploy`, y la
 * documentacion que circula por ahi sigue diciendo eso. En la 4.3.18 devuelve
 * 404 y parece que la aplicacion no existe.
 */
const RUTA_DESPLIEGUE = '/api/v1/deploy';

interface Ajustes {
  readonly base: string;
  readonly token: string;
  readonly app: string;
  readonly repo: string;
}

function ajustes(): Ajustes {
  const base = process.env.COOLIFY_URL?.trim();
  const token = process.env.COOLIFY_TOKEN?.trim();
  const app = process.env.COOLIFY_APP_UUID?.trim();
  const faltan = [
    !base && 'COOLIFY_URL',
    !token && 'COOLIFY_TOKEN',
    !app && 'COOLIFY_APP_UUID',
  ].filter(Boolean);

  if (faltan.length > 0) {
    console.error(`Faltan en ${RUTA_ENV}: ${faltan.join(', ')}`);
    process.exit(1);
  }
  return {
    base: base!.replace(/\/+$/, ''),
    token: token!,
    app: app!,
    repo: process.env.GITHUB_REPO?.trim() ?? 'chronosedwin8/codenestschool',
  };
}

function cabeceras(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/json',
    'content-type': 'application/json',
  };
}

/**
 * Lee una clave del .env sin volcar el archivo a la consola.
 *
 * Con `parseEnv` de Node, que entiende el formato igual que la aplicacion: quita
 * las comillas y respeta los `#`. Antes se leia la linea en crudo, y un valor
 * escrito entre comillas (`MP_ACCESS_TOKEN="APP_USR-..."`) subia a Coolify CON
 * las comillas: Mercado Pago rechazaba el token y ninguna firma de aviso
 * validaba. Se vio el 2026-09-18, por suerte antes de desplegar.
 */
function delEnv(clave: string): string | undefined {
  try {
    const valor = parseEnv(readFileSync(RUTA_ENV, 'utf8'))[clave]?.trim();
    return valor ? valor : undefined;
  } catch {
    // Sin .env no hay nada que copiar; el llamador ya lo dira.
    return undefined;
  }
}

interface VariableCoolify {
  readonly uuid: string;
  readonly key: string;
  readonly is_preview?: boolean;
}

async function variablesDeCoolify(a: Ajustes): Promise<VariableCoolify[]> {
  const respuesta = await fetch(`${a.base}/api/v1/applications/${a.app}/envs`, {
    headers: cabeceras(a.token),
  });
  const cuerpo: unknown = await respuesta.json();
  if (!respuesta.ok || !Array.isArray(cuerpo)) {
    console.error(
      `Coolify no devolvio la lista de variables (HTTP ${respuesta.status}). ` +
        'Si es 401, el token esta obsoleto.',
    );
    process.exit(1);
  }
  return cuerpo as VariableCoolify[];
}

/**
 * Copia variables del .env local a Coolify y borra las copias de vista previa.
 *
 * Coolify duplica sola cada variable con `is_preview: true`. Hay que borrar esas
 * copias: un despliegue de vista previa con ellas escribiria en la base de
 * PRODUCCION.
 */
async function sincronizarVariables(claves: string[], soloVer: boolean): Promise<void> {
  const a = ajustes();
  const existentes = await variablesDeCoolify(a);

  if (soloVer || claves.length === 0) {
    const produccion = existentes.filter((e) => !e.is_preview).map((e) => e.key).sort();
    const previas = existentes.filter((e) => e.is_preview);
    console.log(`variables en produccion (${produccion.length}):`);
    console.log('  ' + produccion.join(', '));
    console.log(`copias is_preview: ${previas.length}${previas.length > 0 ? ' <- hay que borrarlas' : ' (bien)'}`);
    if (claves.length === 0 && !soloVer) {
      console.log('\nNo se dijo que variable copiar. Ejemplo:');
      console.log('  npm run deploy:env -- S3_BUCKET S3_REGION');
    }
    return;
  }

  const porClave = new Map(existentes.filter((e) => !e.is_preview).map((e) => [e.key, e]));
  const sinValor = claves.filter((c) => delEnv(c) === undefined);
  if (sinValor.length > 0) {
    console.error(`No estan (o estan vacias) en el .env: ${sinValor.join(', ')}`);
    process.exit(1);
  }

  for (const clave of claves) {
    const cuerpo = JSON.stringify({
      key: clave,
      value: delEnv(clave),
      is_preview: false,
      // `is_build_time` NO se manda: la API lo rechaza con un 422
      // ("This field is not allowed") y el mensaje no dice cual sobra.
      is_literal: true,
    });
    const ya = porClave.has(clave);
    const respuesta = await fetch(`${a.base}/api/v1/applications/${a.app}/envs`, {
      method: ya ? 'PATCH' : 'POST',
      headers: cabeceras(a.token),
      body: cuerpo,
    });
    console.log(`${clave}: ${ya ? 'actualizada' : 'creada'} -> HTTP ${respuesta.status}`);
    if (!respuesta.ok) console.error('  ', (await respuesta.text()).slice(0, 200));
  }

  // Y fuera las copias de vista previa que Coolify acaba de inventarse.
  for (const copia of (await variablesDeCoolify(a)).filter((e) => e.is_preview)) {
    const r = await fetch(`${a.base}/api/v1/applications/${a.app}/envs/${copia.uuid}`, {
      method: 'DELETE',
      headers: cabeceras(a.token),
    });
    console.log(`copia is_preview de ${copia.key}: borrada -> HTTP ${r.status}`);
  }

  const finales = await variablesDeCoolify(a);
  const previas = finales.filter((e) => e.is_preview).length;
  console.log(`\nen produccion: ${finales.length - previas} | copias is_preview: ${previas} (debe ser 0)`);
  const puestas = claves.every((c) => finales.some((e) => e.key === c && !e.is_preview));
  console.log(`las pedidas estan: ${puestas ? 'si' : 'NO'}`);
  // Y que el valor es exactamente el del .env, sin comillas ni espacios de mas.
  // No se imprime ningun valor: solo si coincide.
  const conValor = finales as (VariableCoolify & { value?: string })[];
  const distintas = claves.filter(
    (c) => conValor.find((e) => e.key === c && !e.is_preview)?.value !== delEnv(c),
  );
  console.log(`valores identicos al .env: ${distintas.length === 0 ? 'si' : `NO (${distintas.join(', ')})`}`);
  if (!puestas || distintas.length > 0) process.exit(1);
}

/** Encola un despliegue y espera a que termine. */
async function desplegar(): Promise<void> {
  const a = ajustes();
  const respuesta = await fetch(
    `${a.base}${RUTA_DESPLIEGUE}?uuid=${encodeURIComponent(a.app)}&force=true`,
    { method: 'POST', headers: cabeceras(a.token) },
  );
  const cuerpo = (await respuesta.json()) as {
    deployments?: { deployment_uuid: string; message: string }[];
    message?: string;
  };
  if (!respuesta.ok) {
    console.error(`Coolify respondio ${respuesta.status}: ${cuerpo.message ?? ''}`);
    if (respuesta.status === 401) {
      console.error('El token esta obsoleto. Cambialo en el .env y en el secreto de GitHub.');
    }
    process.exit(1);
  }

  const uuid = cuerpo.deployments?.[0]?.deployment_uuid;
  console.log(cuerpo.deployments?.[0]?.message ?? 'encolado');
  if (!uuid) return;

  let ultimo = '';
  for (let intento = 0; intento < 120; intento += 1) {
    const d = (await fetch(`${a.base}/api/v1/deployments/${uuid}`, {
      headers: cabeceras(a.token),
    }).then((r) => r.json())) as { status?: string; logs?: string };
    const estado = d.status ?? 'desconocido';
    if (estado !== ultimo) {
      console.log(`[${new Date().toLocaleTimeString('es-CO')}] ${estado}`);
      ultimo = estado;
    }
    if (['finished', 'failed', 'cancelled'].includes(estado)) {
      if (estado !== 'finished' && d.logs) {
        const lineas = String(d.logs)
          .split(/\r?\n/)
          .filter((l) => /error|fail|fatal/i.test(l));
        console.error('\nlineas con error:\n' + lineas.slice(-25).join('\n'));
      }
      process.exit(estado === 'finished' ? 0 : 1);
    }
    await esperar(15_000);
  }
  console.error('se agoto la espera');
  process.exit(2);
}

/**
 * Sigue el workflow de GitHub.
 *
 * El repositorio es publico, asi que la lista de ejecuciones se lee sin token.
 * Los REGISTROS de un trabajo fallido no: eso da 403 sin permisos de
 * administrador, y por eso aqui se informa de que paso fallo pero no de por que.
 */
async function seguirCi(): Promise<void> {
  const a = ajustes();
  const api = `https://api.github.com/repos/${a.repo}/actions`;
  const cab = { accept: 'application/vnd.github+json' };

  const lista = (await fetch(`${api}/runs?per_page=1`, { headers: cab }).then((r) =>
    r.json(),
  )) as { workflow_runs?: { id: number; head_sha: string; display_title: string }[] };
  const run = lista.workflow_runs?.[0];
  if (!run) {
    console.error('No se pudo leer la lista de ejecuciones.');
    process.exit(1);
  }
  console.log(`ejecucion ${run.id} sobre ${run.head_sha.slice(0, 7)}: ${run.display_title}`);

  let ultimo = '';
  for (let intento = 0; intento < 120; intento += 1) {
    const estadoRun = (await fetch(`${api}/runs/${run.id}`, { headers: cab }).then((r) =>
      r.json(),
    )) as { status: string; conclusion: string | null };
    const trabajos = (await fetch(`${api}/runs/${run.id}/jobs`, { headers: cab }).then((r) =>
      r.json(),
    )) as { jobs?: { name: string; status: string; conclusion: string | null; steps?: { name: string; conclusion: string | null }[] }[] };

    const resumen = (trabajos.jobs ?? [])
      .map((j) => `${j.name}:${j.conclusion ?? j.status}`)
      .join(' | ');
    if (resumen !== ultimo) {
      console.log(`[${new Date().toLocaleTimeString('es-CO')}] ${resumen}`);
      ultimo = resumen;
    }

    if (estadoRun.status === 'completed') {
      console.log(`\nRESULTADO: ${estadoRun.conclusion}`);
      for (const j of trabajos.jobs ?? []) {
        for (const paso of j.steps ?? []) {
          if (paso.conclusion && !['success', 'skipped'].includes(paso.conclusion)) {
            console.log(`  PASO FALLIDO en ${j.name}: ${paso.name} (${paso.conclusion})`);
            if (/despliegue/i.test(paso.name)) {
              console.log('  -> Casi siempre es el secreto COOLIFY_TOKEN obsoleto.');
              console.log('     Encolalo a mano con: npm run deploy');
            }
          }
        }
      }
      process.exit(estadoRun.conclusion === 'success' ? 0 : 1);
    }
    await esperar(20_000);
  }
  console.error('se agoto la espera');
  process.exit(2);
}

const [orden, ...resto] = process.argv.slice(2);
switch (orden) {
  case 'env':
    await sincronizarVariables(
      resto.filter((x) => !x.startsWith('--')),
      resto.includes('--ver'),
    );
    break;
  case 'ci':
    await seguirCi();
    break;
  case 'ahora':
    await desplegar();
    break;
  default:
    console.log('Ordenes: env [CLAVES...] [--ver] | ahora | ci');
    console.log('  npm run deploy:env -- --ver');
    console.log('  npm run deploy');
    console.log('  npm run deploy:ci');
    process.exit(orden === undefined ? 0 : 1);
}
