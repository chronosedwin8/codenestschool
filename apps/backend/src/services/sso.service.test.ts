/**
 * La entrada con la cuenta del colegio, probada por donde se rompe en silencio.
 *
 * Un SSO mal validado no falla: deja entrar. Por eso aqui no se prueba el camino
 * feliz y poco mas, sino cada comprobacion por separado, falsificando el token
 * con una clave propia y comprobando que el servidor la rechaza.
 *
 * Se genera un par RSA en memoria y se sirve como si fuera el JWKS de Microsoft,
 * interceptando `fetch`. Asi se puede firmar un `id_token` valido de verdad (y
 * tambien uno firmado con otra clave, que es el caso que importa).
 */
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Config } from '../lib/env.js';
import {
  ErrorSso,
  esCorreoDelColegio,
  iniciarSso,
  olvidarClaves,
  recuperarPendiente,
  urlDeRetorno,
  verificarIdToken,
} from './sso.service.js';

// Inventados: el inquilino y la aplicacion del colegio no pintan nada en una
// prueba, y este repositorio es publico.
const TENANT = '11111111-2222-3333-4444-555555555555';
const CLIENTE = '66666666-7777-8888-9999-000000000000';
const KID = 'clave-de-prueba';

const config = {
  PUBLIC_BASE_URL: 'https://codenestschool.com',
  ENTRA_TENANT_ID: TENANT,
  ENTRA_CLIENT_ID: CLIENTE,
  ENTRA_CLIENT_SECRET: 'secreto-de-prueba',
  SSO_DOMINIOS: 'colegioaleman.edu.co',
} as unknown as Config;

const buena = generateKeyPairSync('rsa', { modulusLength: 2048 });
/** Un atacante con su propio par de claves: el caso que de verdad importa. */
const falsa = generateKeyPairSync('rsa', { modulusLength: 2048 });

function base64url(valor: object): string {
  return Buffer.from(JSON.stringify(valor)).toString('base64url');
}

interface Opciones {
  readonly claims?: Record<string, unknown>;
  readonly clave?: typeof buena;
  readonly alg?: string;
}

/** Fabrica un `id_token` como el que emitiria Entra ID. */
function firmarToken(opciones: Opciones = {}): string {
  const ahora = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
    aud: CLIENTE,
    tid: TENANT,
    oid: 'a1b2c3d4-0000-0000-0000-000000000001',
    exp: ahora + 3600,
    nbf: ahora - 60,
    nonce: 'nonce-esperado',
    name: 'Marta Docente',
    preferred_username: 'Marta.Docente@colegioaleman.edu.co',
    ...opciones.claims,
  };

  const cabecera = base64url({ alg: opciones.alg ?? 'RS256', kid: KID, typ: 'JWT' });
  const carga = base64url(claims);
  const firmado = `${cabecera}.${carga}`;
  const firma = createSign('RSA-SHA256')
    .update(firmado)
    .end()
    .sign((opciones.clave ?? buena).privateKey)
    .toString('base64url');

  return `${firmado}.${firma}`;
}

const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  olvidarClaves();
  const jwk = buena.publicKey.export({ format: 'jwk' });
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes('/discovery/v2.0/keys')) {
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID, use: 'sig', alg: 'RS256' }] }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`peticion inesperada a ${String(url)}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe('la ida hacia Microsoft', () => {
  it('pide codigo con PKCE y con un state de un solo uso', () => {
    const url = new URL(iniciarSso(config, '/portal/docente'));

    expect(url.origin + url.pathname).toBe(
      `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`,
    );
    expect(url.searchParams.get('client_id')).toBe(CLIENTE);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    // La direccion de retorno tiene que ser exactamente la registrada en Entra.
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://codenestschool.com/api/auth/sso/retorno',
    );

    const state = url.searchParams.get('state')!;
    const pendiente = recuperarPendiente(state);
    expect(pendiente.volverA).toBe('/portal/docente');
    expect(pendiente.nonce).toBe(url.searchParams.get('nonce'));

    // Y el segundo intento con el mismo state falla: una respuesta de Microsoft
    // no se puede repetir.
    expect(() => recuperarPendiente(state)).toThrow(ErrorSso);
  });

  it('la direccion de retorno no duplica la barra', () => {
    const conBarra = { ...config, PUBLIC_BASE_URL: 'https://codenestschool.com/' } as Config;
    expect(urlDeRetorno(conBarra)).toBe('https://codenestschool.com/api/auth/sso/retorno');
  });
});

describe('la vuelta: validar la identidad', () => {
  it('acepta un token bien firmado y devuelve el correo en minusculas', async () => {
    const identidad = await verificarIdToken(config, firmarToken(), 'nonce-esperado');

    expect(identidad.email).toBe('marta.docente@colegioaleman.edu.co');
    expect(identidad.nombre).toBe('Marta Docente');
    expect(identidad.oid).toBe('a1b2c3d4-0000-0000-0000-000000000001');
  });

  it('rechaza un token firmado con otra clave', async () => {
    // Es el caso que separa una comprobacion de verdad de una decorativa: los
    // claims son perfectos, lo unico que falla es la firma.
    await expect(
      verificarIdToken(config, firmarToken({ clave: falsa }), 'nonce-esperado'),
    ).rejects.toThrow(/firma/i);
  });

  it('rechaza el algoritmo "none" y cualquiera que no sea RS256', async () => {
    await expect(
      verificarIdToken(config, firmarToken({ alg: 'none' }), 'nonce-esperado'),
    ).rejects.toThrow(ErrorSso);
  });

  it('rechaza un token de otro inquilino', async () => {
    const otro = randomUUID();
    await expect(
      verificarIdToken(
        config,
        firmarToken({ claims: { tid: otro, iss: `https://login.microsoftonline.com/${otro}/v2.0` } }),
        'nonce-esperado',
      ),
    ).rejects.toThrow(/colegio/i);
  });

  it('rechaza un token emitido para otra aplicacion del mismo inquilino', async () => {
    await expect(
      verificarIdToken(config, firmarToken({ claims: { aud: randomUUID() } }), 'nonce-esperado'),
    ).rejects.toThrow(/aplicacion/i);
  });

  it('rechaza un token caducado', async () => {
    const hace = Math.floor(Date.now() / 1000) - 7200;
    await expect(
      verificarIdToken(config, firmarToken({ claims: { exp: hace } }), 'nonce-esperado'),
    ).rejects.toThrow(/caduco/i);
  });

  it('rechaza un nonce que no es el que se pidio', async () => {
    // Sin esto, una respuesta capturada de otra sesion valdria para entrar.
    await expect(verificarIdToken(config, firmarToken(), 'otro-nonce')).rejects.toThrow(/coincide/i);
  });

  it('rechaza a un invitado del inquilino con correo de fuera', async () => {
    // El inquilino es del colegio, pero admite invitados, y su token es valido.
    // El dominio del correo es la frontera que de verdad decide quien entra.
    await expect(
      verificarIdToken(
        config,
        firmarToken({ claims: { preferred_username: 'alguien@gmail.com' } }),
        'nonce-esperado',
      ),
    ).rejects.toThrow(/colegio/i);
  });

  it('admite varios dominios si el colegio los declara', async () => {
    const dos = { ...config, SSO_DOMINIOS: 'colegioaleman.edu.co, ds-barranquilla.edu.co' } as Config;
    const identidad = await verificarIdToken(
      dos,
      firmarToken({ claims: { preferred_username: 'jefe@ds-barranquilla.edu.co' } }),
      'nonce-esperado',
    );
    expect(identidad.email).toBe('jefe@ds-barranquilla.edu.co');
  });

  it('usa `email` si viene, y si no el nombre de usuario', async () => {
    const identidad = await verificarIdToken(
      config,
      firmarToken({ claims: { email: 'Otro.Correo@colegioaleman.edu.co' } }),
      'nonce-esperado',
    );
    expect(identidad.email).toBe('otro.correo@colegioaleman.edu.co');
  });

  it('rechaza un token con la carga manipulada despues de firmar', async () => {
    const token = firmarToken();
    const [cabecera, , firma] = token.split('.');
    const cargaFalsa = base64url({
      iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
      aud: CLIENTE,
      tid: TENANT,
      oid: 'x',
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: 'nonce-esperado',
      preferred_username: 'rector@colegioaleman.edu.co',
    });

    await expect(
      verificarIdToken(config, `${cabecera}.${cargaFalsa}.${firma}`, 'nonce-esperado'),
    ).rejects.toThrow(/firma/i);
  });
});

describe('que correos van por SSO', () => {
  it('reconoce el dominio del colegio, sin importar mayusculas', () => {
    expect(esCorreoDelColegio(config, 'Docente@ColegioAleman.edu.co')).toBe(true);
    expect(esCorreoDelColegio(config, 'alguien@gmail.com')).toBe(false);
    expect(esCorreoDelColegio(config, null)).toBe(false);
    // Un subdominio parecido no cuenta: se compara el dominio entero.
    expect(esCorreoDelColegio(config, 'x@falso-colegioaleman.edu.co')).toBe(false);
  });
});
