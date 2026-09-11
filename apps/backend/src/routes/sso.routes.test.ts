/**
 * Las rutas del SSO: lo que ve el navegador.
 *
 * Son redirecciones, no JSON, y ahi es facil colar dos fallos silenciosos: un
 * redirector abierto (`volverA=https://otro-sitio`) y una sesion que se cuela en
 * la cadena de consulta, donde queda registrada en el proxy y en el historial.
 *
 * Se prueban sin hablar con Microsoft: hasta el canje del codigo no hace falta.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { construirServidor } from '../server.js';
import { cargarConfig, ssoConfigurado } from '../lib/env.js';

let app: FastifyInstance;
const activo = ssoConfigurado(cargarConfig());

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app.close();
});

describe('el estado del acceso del colegio', () => {
  it('dice si hay que ensenar el boton, y para que dominio', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/auth/sso/estado' });
    expect(respuesta.statusCode).toBe(200);

    const datos = respuesta.json() as { activo: boolean; dominios: string[]; obligatorio: boolean };
    expect(datos.activo).toBe(activo);
    expect(datos.dominios).toContain('colegioaleman.edu.co');
    expect(typeof datos.obligatorio).toBe('boolean');
  });

  it('no filtra el secreto de cliente por ninguna ruta publica', async () => {
    const estado = await app.inject({ method: 'GET', url: '/api/auth/sso/estado' });
    const secreto = cargarConfig().ENTRA_CLIENT_SECRET;
    if (secreto) expect(estado.body).not.toContain(secreto);

    // `/configuracion` no es publica: la politica de acceso la lee quien la administra.
    const configuracion = await app.inject({ method: 'GET', url: '/api/auth/sso/configuracion' });
    expect(configuracion.statusCode).toBe(401);
  });
});

describe.runIf(activo)('la ida hacia Microsoft', () => {
  it('redirige a Entra ID con la direccion de retorno registrada', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/auth/sso/inicio' });
    expect(respuesta.statusCode).toBe(302);

    const destino = new URL(respuesta.headers.location as string);
    expect(destino.hostname).toBe('login.microsoftonline.com');
    expect(destino.searchParams.get('redirect_uri')).toBe(
      `${cargarConfig().PUBLIC_BASE_URL.replace(/\/$/, '')}/api/auth/sso/retorno`,
    );
    expect(destino.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('no se deja usar como trampolin hacia otro sitio', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/sso/inicio?volverA=https://sitio-falso.example/entrar',
    });
    // Se entra igual, pero olvidando el destino ajeno.
    expect(respuesta.statusCode).toBe(302);
    expect(respuesta.headers.location as string).toContain('login.microsoftonline.com');

    const conDobleBarra = await app.inject({
      method: 'GET',
      url: '/api/auth/sso/inicio?volverA=//sitio-falso.example',
    });
    expect(conDobleBarra.headers.location as string).toContain('login.microsoftonline.com');
  });
});

describe('la vuelta de Microsoft', () => {
  it('devuelve al juego con un motivo cuando el usuario cancela', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/sso/retorno?error=access_denied&error_description=cancelado',
    });

    expect(respuesta.statusCode).toBe(302);
    expect(respuesta.headers.location as string).toContain('#sso-error=cancelado');
  });

  it('rechaza una respuesta con un state que no pidio nadie', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/sso/retorno?code=cualquiera&state=inventado',
    });

    expect(respuesta.statusCode).toBe(302);
    expect(respuesta.headers.location as string).toContain('#sso-error=state');
  });

  it('la sesion nunca viaja en la cadena de consulta', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/sso/retorno?error=access_denied',
    });

    const destino = respuesta.headers.location as string;
    // Todo lo que vuelve va detras de la almohadilla: el fragmento no llega al
    // servidor ni queda en sus registros.
    expect(destino).not.toContain('?');
    expect(destino).toContain('/app/#');
  });
});
