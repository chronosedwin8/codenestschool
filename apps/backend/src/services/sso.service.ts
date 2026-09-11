/**
 * Entrar con la cuenta del colegio (Microsoft Entra ID).
 *
 * Flujo de codigo de autorizacion con PKCE. El secreto de cliente no baja nunca
 * al navegador: el unico que habla con Microsoft para canjear el codigo es este
 * servidor.
 *
 * Tres comprobaciones que no son opcionales, y por que:
 *
 *  1. **La firma del `id_token`.** Aunque el token llega por TLS directo desde
 *     Microsoft, se verifica contra su JWKS. Es lo que evita que un fallo futuro
 *     (un proxy, una URL de token mal configurada) convierta un texto cualquiera
 *     en una sesion.
 *  2. **El inquilino y el publico.** `tid` tiene que ser el del colegio y `aud`
 *     esta aplicacion. Sin eso, un token emitido para otra aplicacion del mismo
 *     inquilino serviria para entrar aqui.
 *  3. **El dominio del correo.** El inquilino es del colegio, pero admite
 *     invitados externos, y un invitado recibe un token igual de valido. Esta es
 *     la frontera que de verdad decide quien entra a una plataforma de menores.
 *
 * Lo que NO hace: los ninos no pasan por aqui. No tienen correo (el expediente
 * academico se importa sin el, por minimizacion de datos) y un nino de cinco
 * anos no escribe una contrasena de Microsoft. Siguen entrando con su PIN de
 * imagenes.
 */
import { createHash, createVerify, randomBytes, timingSafeEqual } from 'node:crypto';

import type { Config } from '../lib/env.js';
import { dominiosSso } from '../lib/env.js';

/** Margen de reloj admitido al comprobar la vigencia del token, en segundos. */
const MARGEN_RELOJ = 120;

/** Lo que dura un intento de entrada a medias. Diez minutos es de sobra. */
const VIDA_PENDIENTE_MS = 10 * 60 * 1000;

/** Tope de intentos simultaneos guardados, por si alguien golpea la ruta. */
const MAX_PENDIENTES = 2000;

/** Cuanto se reutilizan las claves publicas de Microsoft antes de volver a pedirlas. */
const VIDA_JWKS_MS = 60 * 60 * 1000;

export interface IdentidadSso {
  /** Correo corporativo, en minusculas. */
  readonly email: string;
  readonly nombre: string;
  /** Identificador estable del usuario en Entra ID (`oid`). */
  readonly oid: string;
}

export class ErrorSso extends Error {
  constructor(
    message: string,
    /** Codigo corto para la pantalla de entrada; nunca lleva detalles internos. */
    readonly codigo: string,
  ) {
    super(message);
    this.name = 'ErrorSso';
  }
}

// ─────────────────────────── Puntos de Microsoft ───────────────────────────

/**
 * Los extremos v2.0 de un inquilino.
 *
 * Se construyen y no se descubren por `.well-known` a proposito: son estables
 * desde hace anos y una peticion menos es un modo menos de que la entrada falle
 * por algo que no depende de nosotros.
 */
function extremos(tenantId: string): {
  autorizar: string;
  token: string;
  claves: string;
  emisor: string;
} {
  const base = `https://login.microsoftonline.com/${tenantId}`;
  return {
    autorizar: `${base}/oauth2/v2.0/authorize`,
    token: `${base}/oauth2/v2.0/token`,
    claves: `${base}/discovery/v2.0/keys`,
    emisor: `${base}/v2.0`,
  };
}

/** A donde vuelve Microsoft. Tiene que coincidir con el registro de la aplicacion. */
export function urlDeRetorno(config: Config): string {
  return `${config.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/auth/sso/retorno`;
}

// ──────────────────────── Intentos a medio camino ──────────────────────────

interface Pendiente {
  readonly verificador: string;
  readonly nonce: string;
  readonly volverA: string | null;
  readonly creado: number;
}

/**
 * Intentos abiertos, en memoria.
 *
 * En memoria y no en la base porque duran diez minutos y el servidor es un solo
 * proceso; si algun dia hay varias replicas, esto pasa a Redis o a una tabla. Se
 * borra al usarlo: un `state` vale exactamente una vez, que es lo que impide
 * repetir una respuesta de Microsoft.
 */
const pendientes = new Map<string, Pendiente>();

function limpiarCaducados(ahora: number): void {
  for (const [clave, dato] of pendientes) {
    if (ahora - dato.creado > VIDA_PENDIENTE_MS) pendientes.delete(clave);
  }
}

function base64url(datos: Buffer): string {
  return datos.toString('base64url');
}

/** Empieza la entrada: devuelve la URL de Microsoft a la que hay que mandar al navegador. */
export function iniciarSso(config: Config, volverA: string | null): string {
  if (!config.ENTRA_TENANT_ID || !config.ENTRA_CLIENT_ID) {
    throw new ErrorSso('El acceso con la cuenta del colegio no esta configurado', 'no-configurado');
  }

  const ahora = Date.now();
  limpiarCaducados(ahora);
  if (pendientes.size >= MAX_PENDIENTES) {
    throw new ErrorSso('Demasiadas entradas a la vez, intentalo en un momento', 'saturado');
  }

  const state = base64url(randomBytes(24));
  const verificador = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(16));

  pendientes.set(state, { verificador, nonce, volverA, creado: ahora });

  const reto = base64url(createHash('sha256').update(verificador).digest());
  const parametros = new URLSearchParams({
    client_id: config.ENTRA_CLIENT_ID,
    response_type: 'code',
    redirect_uri: urlDeRetorno(config),
    response_mode: 'query',
    // `openid profile email` basta para saber quien entra. No se pide nada mas:
    // la aplicacion no lee correo, ni calendario, ni archivos de nadie.
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: reto,
    code_challenge_method: 'S256',
  });

  return `${extremos(config.ENTRA_TENANT_ID).autorizar}?${parametros.toString()}`;
}

/** Recupera (y consume) un intento abierto. */
export function recuperarPendiente(state: string): Pendiente {
  const ahora = Date.now();
  limpiarCaducados(ahora);

  const dato = pendientes.get(state);
  pendientes.delete(state);

  if (!dato) {
    throw new ErrorSso('La entrada tardo demasiado o ya se uso. Intentalo otra vez.', 'state');
  }
  return dato;
}

// ─────────────────────────── Canje y validacion ────────────────────────────

/** Canjea el codigo por el `id_token`. Aqui es donde se usa el secreto. */
export async function canjearCodigo(
  config: Config,
  codigo: string,
  verificador: string,
): Promise<string> {
  if (!config.ENTRA_TENANT_ID || !config.ENTRA_CLIENT_ID || !config.ENTRA_CLIENT_SECRET) {
    throw new ErrorSso('El acceso con la cuenta del colegio no esta configurado', 'no-configurado');
  }

  const cuerpo = new URLSearchParams({
    client_id: config.ENTRA_CLIENT_ID,
    client_secret: config.ENTRA_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: codigo,
    redirect_uri: urlDeRetorno(config),
    code_verifier: verificador,
    scope: 'openid profile email',
  });

  const respuesta = await fetch(extremos(config.ENTRA_TENANT_ID).token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
    signal: AbortSignal.timeout(10_000),
  });

  if (!respuesta.ok) {
    // El cuerpo del error trae descripciones utiles para el registro, pero
    // tambien puede traer el correo del usuario: no sale de aqui.
    throw new ErrorSso(`Microsoft rechazo el codigo (${respuesta.status})`, 'canje');
  }

  const datos = (await respuesta.json()) as { id_token?: unknown };
  if (typeof datos.id_token !== 'string') {
    throw new ErrorSso('Microsoft no devolvio identidad', 'canje');
  }
  return datos.id_token;
}

interface ClavePublica {
  readonly kid: string;
  readonly jwk: Record<string, unknown>;
}

let jwksCache: { claves: ClavePublica[]; caduca: number } | null = null;

/** Claves publicas de Microsoft, con cache: rotan, pero no cada minuto. */
async function clavesDeMicrosoft(tenantId: string, forzar = false): Promise<ClavePublica[]> {
  if (!forzar && jwksCache && jwksCache.caduca > Date.now()) return jwksCache.claves;

  const respuesta = await fetch(extremos(tenantId).claves, { signal: AbortSignal.timeout(10_000) });
  if (!respuesta.ok) throw new ErrorSso('No se pudieron leer las claves de Microsoft', 'claves');

  const datos = (await respuesta.json()) as { keys?: { kid?: string }[] };
  const claves = (datos.keys ?? [])
    .filter((k): k is { kid: string } => typeof k.kid === 'string')
    .map((k) => ({ kid: k.kid, jwk: k as unknown as Record<string, unknown> }));

  jwksCache = { claves, caduca: Date.now() + VIDA_JWKS_MS };
  return claves;
}

/** Solo para las pruebas: olvida las claves cacheadas. */
export function olvidarClaves(): void {
  jwksCache = null;
}

interface ClaimsEntra {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  tid?: unknown;
  oid?: unknown;
  nonce?: unknown;
  name?: unknown;
  email?: unknown;
  preferred_username?: unknown;
  upn?: unknown;
}

function trozos(token: string): { cabecera: Record<string, unknown>; claims: ClaimsEntra; firmado: string; firma: Buffer } {
  const partes = token.split('.');
  if (partes.length !== 3) throw new ErrorSso('Identidad mal formada', 'token');

  try {
    return {
      cabecera: JSON.parse(Buffer.from(partes[0]!, 'base64url').toString('utf8')) as Record<string, unknown>,
      claims: JSON.parse(Buffer.from(partes[1]!, 'base64url').toString('utf8')) as ClaimsEntra,
      firmado: `${partes[0]}.${partes[1]}`,
      firma: Buffer.from(partes[2]!, 'base64url'),
    };
  } catch {
    throw new ErrorSso('Identidad mal formada', 'token');
  }
}

/**
 * Verifica el `id_token` y devuelve quien es.
 *
 * El orden importa: primero la firma, y solo despues se mira el contenido. Leer
 * los claims de un token sin verificar y decidir con ellos es la forma clasica
 * de tener una comprobacion que en realidad no comprueba nada.
 */
export async function verificarIdToken(
  config: Config,
  idToken: string,
  nonceEsperado: string,
): Promise<IdentidadSso> {
  const tenantId = config.ENTRA_TENANT_ID;
  const clientId = config.ENTRA_CLIENT_ID;
  if (!tenantId || !clientId) {
    throw new ErrorSso('El acceso con la cuenta del colegio no esta configurado', 'no-configurado');
  }

  const { cabecera, claims, firmado, firma } = trozos(idToken);
  if (cabecera.alg !== 'RS256') throw new ErrorSso('Firma no admitida', 'token');
  if (typeof cabecera.kid !== 'string') throw new ErrorSso('Identidad sin clave', 'token');

  // Si el `kid` no esta, puede ser que Microsoft haya rotado sus claves desde la
  // ultima vez: se vuelven a pedir una sola vez antes de rendirse.
  let claves = await clavesDeMicrosoft(tenantId);
  let clave = claves.find((k) => k.kid === cabecera.kid);
  if (!clave) {
    claves = await clavesDeMicrosoft(tenantId, true);
    clave = claves.find((k) => k.kid === cabecera.kid);
  }
  if (!clave) throw new ErrorSso('Identidad firmada con una clave desconocida', 'token');

  const publica = { key: clave.jwk as never, format: 'jwk' as const };
  const valida = createVerify('RSA-SHA256').update(firmado).end().verify(publica, firma);
  if (!valida) throw new ErrorSso('La firma de la identidad no es valida', 'token');

  // A partir de aqui el contenido es de fiar.
  const ahora = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + MARGEN_RELOJ < ahora) {
    throw new ErrorSso('La identidad caduco', 'token');
  }
  if (typeof claims.nbf === 'number' && claims.nbf - MARGEN_RELOJ > ahora) {
    throw new ErrorSso('La identidad todavia no vale', 'token');
  }
  if (claims.tid !== tenantId) throw new ErrorSso('Esa cuenta no es del colegio', 'inquilino');
  if (claims.iss !== extremos(tenantId).emisor) throw new ErrorSso('Emisor inesperado', 'token');
  if (claims.aud !== clientId) throw new ErrorSso('Identidad emitida para otra aplicacion', 'token');

  if (typeof claims.nonce !== 'string' || !igualSegura(claims.nonce, nonceEsperado)) {
    throw new ErrorSso('La entrada no coincide con la que se pidio', 'nonce');
  }
  if (typeof claims.oid !== 'string') throw new ErrorSso('Identidad sin identificador', 'token');

  const email = primerTexto(claims.email, claims.preferred_username, claims.upn)?.toLowerCase();
  if (!email || !email.includes('@')) {
    throw new ErrorSso('Esa cuenta no tiene correo', 'sin-correo');
  }

  const dominio = email.split('@')[1] ?? '';
  if (!dominiosSso(config).includes(dominio)) {
    throw new ErrorSso('Esa cuenta no es del colegio', 'dominio');
  }

  return {
    email,
    nombre: primerTexto(claims.name) ?? email.split('@')[0]!,
    oid: claims.oid,
  };
}

function primerTexto(...valores: unknown[]): string | null {
  for (const v of valores) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

/** Comparacion en tiempo constante: el nonce se compara con lo que mando otro. */
function igualSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Si un correo pertenece a un dominio que entra por SSO. */
export function esCorreoDelColegio(config: Config, correo: string | null | undefined): boolean {
  if (!correo) return false;
  const dominio = correo.toLowerCase().split('@')[1] ?? '';
  return dominiosSso(config).includes(dominio);
}
