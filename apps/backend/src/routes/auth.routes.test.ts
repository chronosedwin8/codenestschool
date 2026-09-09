/**
 * Pruebas de integracion de autenticacion y puntuacion.
 *
 * Se centran en lo que no puede romperse nunca:
 *   - un adulto solo ve a los ninos que tiene a su cargo,
 *   - el token recien emitido no es requisito para autorizar (fallo real que
 *     aparecio al probar el flujo: el tutor creaba al nino y su token antiguo
 *     ya no servia),
 *   - el servidor recalcula las estrellas y rechaza acciones imposibles,
 *   - repetir una actividad no permite acumular monedas.
 *
 * Usan la base de datos de desarrollo con identificadores unicos por ejecucion,
 * y limpian lo que crean.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { construirServidor } from '../server.js';

const marca = `t${Date.now().toString(36)}`;
const emailTutor = `tutor.${marca}@prueba.local`;
const emailAjeno = `ajeno.${marca}@prueba.local`;
const PASSWORD = 'clave-de-prueba-1234';
const PIN = ['gato', 'sol', 'gato', 'arbol'];

let app: FastifyInstance;
const creados: number[] = [];

async function json<T = Record<string, unknown>>(
  metodo: 'POST' | 'GET',
  url: string,
  opciones?: { token?: string; body?: unknown },
): Promise<{ status: number; datos: T }> {
  const respuesta = await app.inject({
    method: metodo,
    url,
    headers: opciones?.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    payload: opciones?.body as object | undefined,
  });
  return { status: respuesta.statusCode, datos: respuesta.json() as T };
}

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();
});

afterAll(async () => {
  // Se borra en orden inverso a las dependencias; el resto cae en cascada.
  if (creados.length > 0) {
    await app.prisma.user.deleteMany({ where: { id: { in: creados } } });
  }
  await app.close();
});

describe('registro y acceso de adultos', () => {
  it('registra un tutor y devuelve un token', async () => {
    const { status, datos } = await json<{ token: string; usuario: { id: number } }>(
      'POST',
      '/api/auth/registro',
      { body: { nombre: 'Tutor Prueba', email: emailTutor, password: PASSWORD, rol: 'tutor' } },
    );

    expect(status).toBe(201);
    expect(datos.token).toBeTruthy();
    creados.push(datos.usuario.id);
  });

  it('rechaza un correo repetido', async () => {
    const { status } = await json('POST', '/api/auth/registro', {
      body: { nombre: 'Otro', email: emailTutor, password: PASSWORD, rol: 'tutor' },
    });

    expect(status).toBe(409);
  });

  it('no revela si un correo existe cuando la contrasena es incorrecta', async () => {
    const conCorreoReal = await json<{ error: string }>('POST', '/api/auth/login', {
      body: { email: emailTutor, password: 'incorrecta-del-todo' },
    });
    const conCorreoFalso = await json<{ error: string }>('POST', '/api/auth/login', {
      body: { email: `nadie.${marca}@prueba.local`, password: 'incorrecta-del-todo' },
    });

    expect(conCorreoReal.status).toBe(401);
    expect(conCorreoFalso.status).toBe(401);
    // El mismo mensaje en ambos casos: no se filtra que cuentas existen.
    expect(conCorreoReal.datos.error).toBe(conCorreoFalso.datos.error);
  });
});

describe('ninos bajo la responsabilidad de un adulto', () => {
  let tokenTutor = '';
  let tokenAntiguo = '';
  let ninoId = 0;
  let ninoUsuario = '';

  beforeAll(async () => {
    const login = await json<{ token: string }>('POST', '/api/auth/login', {
      body: { email: emailTutor, password: PASSWORD },
    });
    // Este token se emite ANTES de crear al nino: no lo incluye.
    tokenAntiguo = login.datos.token;

    const nino = await json<{
      nino: { id: number; usuario: string; grupoEdad: string };
      token: string;
    }>('POST', '/api/auth/ninos', {
      token: tokenAntiguo,
      body: { nombre: 'Nina Prueba', fechaNacimiento: '2021-03-15', pin: PIN, parentesco: 'madre' },
    });

    ninoId = nino.datos.nino.id;
    ninoUsuario = nino.datos.nino.usuario;
    tokenTutor = nino.datos.token;
    creados.push(ninoId);
  });

  it('deriva el grupo de edad de la fecha de nacimiento', async () => {
    const nino = await app.prisma.user.findUniqueOrThrow({ where: { id: ninoId } });
    // Nacida en 2021: en 2026 tiene cinco anos, es exploradora.
    expect(nino.grupoEdad).toBe('exploradores');
  });

  it('genera un nombre de usuario sin exigir correo electronico', async () => {
    const nino = await app.prisma.user.findUniqueOrThrow({ where: { id: ninoId } });

    expect(nino.email).toBeNull();
    expect(nino.usuario).toMatch(/^nina/);
    expect(nino.pinHash).toBeTruthy();
    // El PIN nunca se guarda en claro.
    expect(nino.pinHash).not.toContain('gato');
  });

  it('devuelve un token renovado al crear el nino', () => {
    expect(tokenTutor).toBeTruthy();
    expect(tokenTutor).not.toBe(tokenAntiguo);
  });

  it('autoriza al tutor aunque su token sea anterior al alta del nino', async () => {
    const { status, datos } = await json<{ consentimiento: { estado: string } }>(
      'POST',
      '/api/auth/consentimiento',
      { token: tokenAntiguo, body: { ninoId, versionPolitica: '1.0', otorgado: true } },
    );

    expect(status).toBe(201);
    expect(datos.consentimiento.estado).toBe('otorgado');
  });

  it('impide que otro adulto toque los datos de ese nino', async () => {
    const ajeno = await json<{ token: string; usuario: { id: number } }>(
      'POST',
      '/api/auth/registro',
      { body: { nombre: 'Ajeno', email: emailAjeno, password: PASSWORD, rol: 'tutor' } },
    );
    creados.push(ajeno.datos.usuario.id);

    const { status } = await json('POST', '/api/auth/consentimiento', {
      token: ajeno.datos.token,
      body: { ninoId, versionPolitica: '1.0', otorgado: true },
    });

    expect(status).toBe(403);
  });

  it('deja entrar al nino con su PIN de imagenes', async () => {
    const { status, datos } = await json<{ token: string; usuario: { grupoEdad: string } }>(
      'POST',
      '/api/auth/login-nino',
      { body: { usuario: ninoUsuario, pin: PIN } },
    );

    expect(status).toBe(200);
    expect(datos.token).toBeTruthy();
    expect(datos.usuario.grupoEdad).toBe('exploradores');
  });

  it('rechaza un PIN con las imagenes en otro orden', async () => {
    const { status } = await json('POST', '/api/auth/login-nino', {
      body: { usuario: ninoUsuario, pin: ['sol', 'gato', 'gato', 'arbol'] },
    });

    expect(status).toBe(401);
  });
});

describe('puntuacion verificada en el servidor', () => {
  let tokenNino = '';
  let actividadId = 0;

  beforeAll(async () => {
    const login = await json<{ token: string }>('POST', '/api/auth/login-nino', {
      body: { usuario: (await primerNinoDePrueba()).usuario, pin: PIN },
    });
    tokenNino = login.datos.token;

    const actividad = await app.prisma.activity.findFirst({
      where: { mundo: { numero: 1 }, numeroEnMundo: 1 },
    });
    actividadId = actividad?.id ?? 0;
  });

  async function primerNinoDePrueba() {
    return app.prisma.user.findFirstOrThrow({
      where: { rol: 'nino', nombre: 'Nina Prueba' },
      orderBy: { id: 'desc' },
    });
  }

  async function abrirSesion(): Promise<number> {
    const { datos } = await json<{ sesion: { id: number } }>('POST', '/api/sesiones', {
      token: tokenNino,
      body: { actividadId, editor: 'comandos', lenguaje: 'comandos' },
    });
    return datos.sesion.id;
  }

  it('concede tres estrellas a la solucion optima', async () => {
    const sesionId = await abrirSesion();
    const { datos } = await json<{ estrellas: number; verificado: boolean }>(
      'POST',
      `/api/sesiones/${sesionId}/envio`,
      {
        token: tokenNino,
        body: {
          codigo: 'fuzz.derecha();',
          acciones: [
            {
              cmd: 'derecha',
              desde: { x: 0, y: 1 },
              hasta: { x: 4, y: 1 },
              celdasRecorridas: [
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 3, y: 1 },
                { x: 4, y: 1 },
              ],
            },
          ],
          tamanoPrograma: 1,
          tiempoSegundos: 10,
        },
      },
    );

    expect(datos.verificado).toBe(true);
    expect(datos.estrellas).toBe(3);
  });

  it('rechaza acciones que no se pueden reproducir en el tablero', async () => {
    const sesionId = await abrirSesion();
    const { datos } = await json<{ estrellas: number; verificado: boolean }>(
      'POST',
      `/api/sesiones/${sesionId}/envio`,
      {
        token: tokenNino,
        body: {
          codigo: '// intento manipulado',
          acciones: [{ cmd: 'arriba', desde: { x: 0, y: 1 }, hasta: { x: 4, y: 1 } }],
          tamanoPrograma: 1,
          tiempoSegundos: 1,
        },
      },
    );

    expect(datos.verificado).toBe(false);
    expect(datos.estrellas).toBe(0);
  });

  it('no paga monedas por repetir una actividad ya dominada', async () => {
    const sesionId = await abrirSesion();
    const { datos } = await json<{ monedasGanadas: number; estrellas: number }>(
      'POST',
      `/api/sesiones/${sesionId}/envio`,
      {
        token: tokenNino,
        body: {
          codigo: 'fuzz.derecha();',
          acciones: [
            {
              cmd: 'derecha',
              desde: { x: 0, y: 1 },
              hasta: { x: 4, y: 1 },
              celdasRecorridas: [
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 3, y: 1 },
                { x: 4, y: 1 },
              ],
            },
          ],
          tamanoPrograma: 1,
          tiempoSegundos: 4,
        },
      },
    );

    expect(datos.estrellas).toBe(3);
    expect(datos.monedasGanadas).toBe(0);
  });
});

describe('curriculo', () => {
  it('expone los 30 mundos en el catalogo publico', async () => {
    const { status, datos } = await json<{ mundos: unknown[]; actividadesPorMundo: number }>(
      'GET',
      '/api/curriculo/catalogo',
    );

    expect(status).toBe(200);
    expect(datos.mundos).toHaveLength(30);
    expect(datos.actividadesPorMundo).toBe(20);
  });

  it('no entrega la solucion de referencia al cliente', async () => {
    const actividad = await app.prisma.activity.findFirstOrThrow({
      where: { mundo: { numero: 1 } },
    });
    const login = await json<{ token: string }>('POST', '/api/auth/login', {
      body: { email: emailTutor, password: PASSWORD },
    });

    const { datos } = await json<Record<string, unknown>>(
      'GET',
      `/api/curriculo/actividades/${actividad.id}`,
      { token: login.datos.token },
    );

    expect(datos).not.toHaveProperty('solucionReferencia');
    expect(datos).toHaveProperty('config');
  });

  it('exige autenticacion para ver el mapa de mundos', async () => {
    const { status } = await json('GET', '/api/curriculo/mundos');

    expect(status).toBe(401);
  });
});

describe('servicio de archivos estaticos', () => {
  it('devuelve el index de la aplicacion en sus rutas internas', async () => {
    // El enrutador del cliente resuelve /app/actividad/1; el servidor solo
    // tiene que entregar el index. Un fallo aqui deja la pantalla en blanco.
    const respuesta = await app.inject({ method: 'GET', url: '/app/actividad/1' });

    // 200 si el frontend esta compilado; 404 si todavia no. Nunca un 500.
    expect([200, 404]).toContain(respuesta.statusCode);
    expect(respuesta.statusCode).not.toBe(500);
  });

  it('responde JSON, no HTML, en las rutas de la API que no existen', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/inventada' });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: 'Ruta no encontrada' });
  });
});

describe('un aula entera entrando a la vez', () => {
  /**
   * Treinta ninos comparten la red del colegio, asi que llegan con la misma IP.
   * Si el limite de peticiones contara solo por IP, los ultimos se quedarian
   * fuera sin haber hecho nada mal. Se cuenta por IP mas nombre de usuario.
   */
  it('no bloquea a los estudiantes que entran despues', async () => {
    const tutor = await json<{ token: string; usuario: { id: number } }>(
      'POST',
      '/api/auth/registro',
      {
        body: {
          nombre: 'Docente Aula',
          email: `aula.${marca}@prueba.local`,
          password: PASSWORD,
          rol: 'docente',
        },
      },
    );
    creados.push(tutor.datos.usuario.id);

    // Doce estudiantes, mas que el tope de ocho por minuto del acceso adulto.
    const usuarios: string[] = [];
    for (let i = 0; i < 12; i++) {
      const alta = await json<{ nino: { id: number; usuario: string } }>(
        'POST',
        '/api/auth/ninos',
        {
          token: tutor.datos.token,
          body: {
            nombre: `Estudiante ${i} Aula`,
            fechaNacimiento: '2020-05-10',
            pin: PIN,
          },
        },
      );
      creados.push(alta.datos.nino.id);
      usuarios.push(alta.datos.nino.usuario);
    }

    // Todos entran desde la misma direccion, como en un aula real.
    const resultados: number[] = [];
    for (const usuario of usuarios) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/auth/login-nino',
        payload: { usuario, pin: PIN },
        remoteAddress: '190.85.10.20',
      });
      resultados.push(respuesta.statusCode);
    }

    // Ni uno solo bloqueado por el limite de peticiones.
    expect(resultados.filter((c) => c === 429)).toHaveLength(0);
    expect(resultados.every((c) => c === 200)).toBe(true);
  });

  it('sigue frenando los intentos repetidos contra el mismo estudiante', async () => {
    const tutor = await json<{ token: string; usuario: { id: number } }>(
      'POST',
      '/api/auth/registro',
      {
        body: {
          nombre: 'Tutor Fuerza',
          email: `fuerza.${marca}@prueba.local`,
          password: PASSWORD,
          rol: 'tutor',
        },
      },
    );
    creados.push(tutor.datos.usuario.id);

    const alta = await json<{ nino: { id: number; usuario: string } }>(
      'POST',
      '/api/auth/ninos',
      {
        token: tutor.datos.token,
        body: { nombre: 'Objetivo Fuerza', fechaNacimiento: '2020-01-01', pin: PIN },
      },
    );
    creados.push(alta.datos.nino.id);

    // Quince intentos con PIN equivocado contra el mismo usuario.
    const codigos: number[] = [];
    for (let i = 0; i < 15; i++) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/auth/login-nino',
        payload: { usuario: alta.datos.nino.usuario, pin: ['pez', 'pez', 'pez', 'pez'] },
        remoteAddress: '200.1.2.3',
      });
      codigos.push(respuesta.statusCode);
    }

    // A partir de cierto punto se corta: adivinar un PIN a fuerza bruta no vale.
    expect(codigos).toContain(429);
  });
});
