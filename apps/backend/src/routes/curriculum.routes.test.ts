/**
 * Lo que el juego necesita saber para encadenar una actividad con la siguiente.
 *
 * La respuesta de una actividad lleva cual viene despues. No es un adorno: es lo
 * que permite que al resolver aparezca un boton hacia delante en vez de una
 * vuelta al mapa, y volver al mapa a los cinco anos es una salida, y cualquier
 * salida se toma.
 *
 * Los tres casos que importan son las tres fronteras: dentro de un mundo, al
 * cambiar de mundo, y al acabarse las seiscientas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { construirServidor } from '../server.js';

const marca = `k${Date.now().toString(36)}`;
const PIN = ['gato', 'sol', 'gato', 'arbol'];

let app: FastifyInstance;
let token = '';
const creados: number[] = [];

/** Devuelve el id de la actividad que ocupa ese puesto en las seiscientas. */
async function idPorNumeroGlobal(numeroGlobal: number): Promise<number> {
  const fila = await app.prisma.activity.findFirst({
    where: { numeroGlobal },
    select: { id: true },
  });
  if (!fila) throw new Error(`No existe la actividad global ${numeroGlobal}`);
  return fila.id;
}

interface RespuestaActividad {
  readonly numeroGlobal: number;
  readonly mundo: { readonly numero: number };
  readonly siguiente: {
    readonly id: number;
    readonly numeroEnMundo: number;
    readonly mundo: { readonly numero: number; readonly nombre: string };
    readonly cambiaDeMundo: boolean;
  } | null;
}

async function leerActividad(id: number): Promise<RespuestaActividad> {
  const respuesta = await app.inject({
    method: 'GET',
    url: `/api/curriculo/actividades/${id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(respuesta.statusCode).toBe(200);
  return respuesta.json() as RespuestaActividad;
}

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();

  const tutor = await app.inject({
    method: 'POST',
    url: '/api/auth/registro',
    payload: {
      nombre: 'Tutor Continuidad',
      email: `continuidad.${marca}@prueba.local`,
      password: 'clave-de-prueba-1234',
      rol: 'tutor',
    },
  });
  const datosTutor = tutor.json() as { token: string; usuario: { id: number } };
  creados.push(datosTutor.usuario.id);

  const alta = await app.inject({
    method: 'POST',
    url: '/api/auth/ninos',
    headers: { authorization: `Bearer ${datosTutor.token}` },
    payload: { nombre: 'Nina Continuidad', fechaNacimiento: '2020-04-12', pin: PIN },
  });
  const nino = (alta.json() as { nino: { id: number; usuario: string } }).nino;
  creados.push(nino.id);

  const acceso = await app.inject({
    method: 'POST',
    url: '/api/auth/login-nino',
    payload: { usuario: nino.usuario, pin: PIN },
  });
  token = (acceso.json() as { token: string }).token;
}, 60_000);

afterAll(async () => {
  if (creados.length > 0) {
    await app.prisma.user.deleteMany({ where: { id: { in: creados } } });
  }
  await app.close();
});

describe('que viene despues de esta actividad', () => {
  it('dentro de un mundo, la siguiente es la de al lado', async () => {
    const actividad = await leerActividad(await idPorNumeroGlobal(1));

    expect(actividad.siguiente).not.toBeNull();
    expect(actividad.siguiente?.numeroEnMundo).toBe(2);
    expect(actividad.siguiente?.mundo.numero).toBe(1);
    expect(actividad.siguiente?.cambiaDeMundo).toBe(false);
  });

  it('en la ultima de un mundo, la siguiente abre el mundo que viene', async () => {
    // La 20 cierra el mundo 1; la 21 es la primera del mundo 2.
    const actividad = await leerActividad(await idPorNumeroGlobal(20));

    expect(actividad.siguiente?.mundo.numero).toBe(2);
    expect(actividad.siguiente?.numeroEnMundo).toBe(1);
    // Esta es la bandera que hace que el boton diga el nombre del mundo nuevo
    // en vez de un "siguiente" que no cuenta a donde se va.
    expect(actividad.siguiente?.cambiaDeMundo).toBe(true);
    expect(actividad.siguiente?.mundo.nombre.length).toBeGreaterThan(0);
  });

  it('en la ultima de las seiscientas no hay siguiente', async () => {
    const actividad = await leerActividad(await idPorNumeroGlobal(600));

    // Sin siguiente, el juego ofrece el mapa: es el unico caso en el que volver
    // al mapa es lo correcto.
    expect(actividad.siguiente).toBeNull();
  });

  it('el id que devuelve como siguiente se puede abrir de verdad', async () => {
    const actividad = await leerActividad(await idPorNumeroGlobal(20));
    const siguiente = await leerActividad(actividad.siguiente!.id);

    expect(siguiente.numeroGlobal).toBe(21);
    expect(siguiente.mundo.numero).toBe(2);
  });
});
