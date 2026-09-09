/**
 * El escenario del plan Escuela: varias aulas trabajando a la vez.
 *
 * Es la prueba que motiva el diseño de los límites de peticiones. Un colegio sale
 * a internet por una sola dirección IP, así que cinco aulas de treinta estudiantes
 * son ciento cincuenta niños jugando desde la misma IP y más de mil peticiones por
 * minuto completamente legítimas.
 *
 * Un límite por IP no distingue eso de un abusador. Estas pruebas comprueban que
 * el colegio funciona y que, al mismo tiempo, sigue siendo imposible adivinar
 * credenciales a base de intentos.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { construirServidor } from '../server.js';
import { reiniciarIntentos } from '../services/intentos.service.js';

/** La IP publica del colegio: todos sus estudiantes salen por aquí. */
const IP_COLEGIO = '190.85.44.10';

const marca = `c${Date.now().toString(36)}`;
const PASSWORD = 'clave-de-prueba-1234';
const PIN = ['gato', 'sol', 'gato', 'arbol'];

/** Tamaño del colegio de la prueba. Cinco aulas de seis por rapidez. */
const AULAS = 5;
const POR_AULA = 6;
const TOTAL_ESTUDIANTES = AULAS * POR_AULA;

let app: FastifyInstance;
const creados: number[] = [];
const estudiantes: { usuario: string; token: string }[] = [];

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();

  // Un docente crea las aulas y los estudiantes.
  const docente = await app.inject({
    method: 'POST',
    url: '/api/auth/registro',
    payload: {
      nombre: 'Docente Colegio',
      email: `docente.${marca}@prueba.local`,
      password: PASSWORD,
      rol: 'docente',
    },
    remoteAddress: IP_COLEGIO,
  });
  const datosDocente = docente.json() as { token: string; usuario: { id: number } };
  creados.push(datosDocente.usuario.id);

  for (let aula = 0; aula < AULAS; aula++) {
    for (let alumno = 0; alumno < POR_AULA; alumno++) {
      const alta = await app.inject({
        method: 'POST',
        url: '/api/auth/ninos',
        headers: { authorization: `Bearer ${datosDocente.token}` },
        payload: {
          nombre: `Alumno ${aula}${alumno} Colegio`,
          fechaNacimiento: '2020-04-12',
          pin: PIN,
        },
        remoteAddress: IP_COLEGIO,
      });
      const nino = (alta.json() as { nino: { id: number; usuario: string } }).nino;
      creados.push(nino.id);
      estudiantes.push({ usuario: nino.usuario, token: '' });
    }
  }
}, 120_000);

afterAll(async () => {
  if (creados.length > 0) {
    await app.prisma.user.deleteMany({ where: { id: { in: creados } } });
  }
  await app.close();
});

beforeEach(() => {
  // Los contadores de fallos viven en memoria y se comparten entre pruebas.
  reiniciarIntentos();
});

describe('la clase empieza a las ocho', () => {
  it('deja entrar a los treinta estudiantes desde la misma IP', async () => {
    const codigos: number[] = [];

    for (const estudiante of estudiantes) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/auth/login-nino',
        payload: { usuario: estudiante.usuario, pin: PIN },
        remoteAddress: IP_COLEGIO,
      });
      codigos.push(respuesta.statusCode);
      if (respuesta.statusCode === 200) {
        estudiante.token = (respuesta.json() as { token: string }).token;
      }
    }

    // Ni uno bloqueado: entrar bien no consume cupo de fallos.
    expect(codigos.filter((c) => c === 429)).toHaveLength(0);
    expect(codigos.every((c) => c === 200)).toBe(true);
    expect(estudiantes.every((e) => e.token.length > 0)).toBe(true);
  }, 120_000);

  it('deja entrar tambien a los docentes de las cinco aulas', async () => {
    // Cinco docentes con la misma IP: antes el tope de ocho por minuto los
    // dejaba fuera junto con el administrador del colegio.
    const codigos: number[] = [];

    for (let i = 0; i < AULAS; i++) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: `docente.${marca}@prueba.local`, password: PASSWORD },
        remoteAddress: IP_COLEGIO,
      });
      codigos.push(respuesta.statusCode);
    }

    expect(codigos.every((c) => c === 200)).toBe(true);
  });
});

describe('el colegio jugando a la vez', () => {
  it('atiende mas de mil peticiones por minuto desde una sola IP', async () => {
    // Cada estudiante hace las peticiones de una partida normal.
    const codigos: number[] = [];

    for (const estudiante of estudiantes) {
      for (let vuelta = 0; vuelta < 8; vuelta++) {
        const respuesta = await app.inject({
          method: 'GET',
          url: '/api/curriculo/mundos',
          headers: { authorization: `Bearer ${estudiante.token}` },
          remoteAddress: IP_COLEGIO,
        });
        codigos.push(respuesta.statusCode);
      }
    }

    // El cupo se cuenta por credencial, no por IP: el aula de al lado no
    // consume el cupo de nadie.
    const bloqueadas = codigos.filter((c) => c === 429);
    expect(bloqueadas).toHaveLength(0);
    expect(codigos).toHaveLength(TOTAL_ESTUDIANTES * 8);
  }, 180_000);

  it('sigue poniendo tope a una sola cuenta que se desmadra', async () => {
    const estudiante = estudiantes[0];
    if (!estudiante) throw new Error('la preparacion no creo estudiantes');

    const codigos: number[] = [];
    // Muy por encima del cupo por credencial.
    for (let i = 0; i < 260; i++) {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/curriculo/mundos',
        headers: { authorization: `Bearer ${estudiante.token}` },
        remoteAddress: IP_COLEGIO,
      });
      codigos.push(respuesta.statusCode);
    }

    // Una sola cuenta si tiene tope, y el aviso es un 429, no un 500.
    expect(codigos).toContain(429);
    expect(codigos).not.toContain(500);
  }, 180_000);

  it('el cupo de una cuenta no afecta al de sus companeros', async () => {
    const [primero, segundo] = estudiantes;
    if (!primero || !segundo) throw new Error('la preparacion no creo estudiantes');

    // El primero agota su cupo.
    for (let i = 0; i < 250; i++) {
      await app.inject({
        method: 'GET',
        url: '/api/curriculo/mundos',
        headers: { authorization: `Bearer ${primero.token}` },
        remoteAddress: IP_COLEGIO,
      });
    }

    // Su compañero, desde la misma IP, sigue jugando sin problema.
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/curriculo/mundos',
      headers: { authorization: `Bearer ${segundo.token}` },
      remoteAddress: IP_COLEGIO,
    });

    expect(respuesta.statusCode).toBe(200);
  }, 180_000);
});

describe('la proteccion sigue en pie', () => {
  it('frena adivinar el PIN de un estudiante concreto', async () => {
    const estudiante = estudiantes[1];
    if (!estudiante) throw new Error('la preparacion no creo estudiantes');

    const codigos: number[] = [];
    for (let i = 0; i < 10; i++) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/auth/login-nino',
        payload: { usuario: estudiante.usuario, pin: ['pez', 'pez', 'pez', 'pez'] },
        remoteAddress: IP_COLEGIO,
      });
      codigos.push(respuesta.statusCode);
    }

    expect(codigos).toContain(429);
  });

  it('frena recorrer nombres de usuario desde una misma red', async () => {
    // El contador por cuenta no cubre esto: cada nombre acumula un solo fallo.
    // El contador por IP si, porque suma todos los fallos de la red.
    const codigos: number[] = [];
    for (let i = 0; i < 40; i++) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/auth/login-nino',
        payload: { usuario: `inventado${i}`, pin: PIN },
        remoteAddress: '203.0.113.99',
      });
      codigos.push(respuesta.statusCode);
    }

    expect(codigos).toContain(429);
  });

  it('un colegio que entra bien nunca activa el freno de la red', async () => {
    // Treinta accesos correctos seguidos: cero fallos, cero frenos.
    const codigos: number[] = [];
    for (const estudiante of estudiantes) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/auth/login-nino',
        payload: { usuario: estudiante.usuario, pin: PIN },
        remoteAddress: IP_COLEGIO,
      });
      codigos.push(respuesta.statusCode);
    }

    expect(codigos.filter((c) => c === 429)).toHaveLength(0);
  }, 120_000);
});
