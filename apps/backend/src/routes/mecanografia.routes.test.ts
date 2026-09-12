/**
 * Mecanografía, probada por donde cede.
 *
 * Lo que hay que proteger aquí es una nota: las estrellas y las palabras por
 * minuto acaban en el panel del docente. Y el que las mide es el navegador del
 * niño, así que lo importante es que el servidor **no se fíe**: recalcula, y
 * rechaza lo imposible.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import {
  ACENTUADAS,
  LECCIONES,
  PALABRAS_JUEGO,
  TECLADO_ES,
  comoEscribir,
} from '@codenest/content';

import { construirServidor } from '../server.js';

const marca = `m${Date.now().toString(36)}`;
const PIN = ['gato', 'sol', 'luna', 'flor'];

let app: FastifyInstance;
let docente = { id: 0, token: '' };
let alumno = { id: 0, token: '' };
let aulaId = 0;
const adultos: number[] = [];

const como = (token: string) => ({ authorization: `Bearer ${token}` });

/** Una lección concreta, para poder razonar sobre sus mínimos. */
const PRIMERA = LECCIONES[0]!;

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();

  const alta = await app.inject({
    method: 'POST',
    url: '/api/auth/registro',
    payload: {
      nombre: 'Docente Teclado',
      email: `docente.teclado.${marca}@prueba.local`,
      password: 'clave-de-prueba-1234',
      rol: 'docente',
    },
  });
  const datos = alta.json() as { token: string; usuario: { id: number } };
  docente = { id: datos.usuario.id, token: datos.token };
  adultos.push(docente.id);

  const aula = await app.inject({
    method: 'POST',
    url: '/api/docente/aulas',
    headers: como(docente.token),
    payload: { nombre: `Teclado ${marca}`, grado: '6' },
  });
  aulaId = (aula.json() as { aula: { id: number } }).aula.id;

  const estudiantes = await app.inject({
    method: 'POST',
    url: `/api/docente/aulas/${aulaId}/estudiantes`,
    headers: como(docente.token),
    payload: {
      estudiantes: [{ nombre: `Ana Teclado ${marca}`, fechaNacimiento: '2014-03-10' }],
      pinComun: PIN,
    },
  });
  const creado = (estudiantes.json() as { estudiantes: { id: number; usuario: string }[] })
    .estudiantes[0]!;

  const acceso = await app.inject({
    method: 'POST',
    url: '/api/auth/login-nino',
    payload: { usuario: creado.usuario, pin: PIN },
  });
  alumno = { id: creado.id, token: (acceso.json() as { token: string }).token };
}, 120_000);

afterAll(async () => {
  const suyos = await app.prisma.guardianLink.findMany({
    where: { tutorId: { in: adultos } },
    select: { ninoId: true },
  });
  const ninos = suyos.map((g) => g.ninoId);
  await app.prisma.typingProgress.deleteMany({ where: { usuarioId: { in: ninos } } });
  await app.prisma.typingProfile.deleteMany({ where: { usuarioId: { in: ninos } } });
  await app.prisma.user.deleteMany({ where: { id: { in: ninos } } });
  await app.prisma.classroom.deleteMany({ where: { docenteId: { in: adultos } } });
  await app.prisma.user.deleteMany({ where: { id: { in: adultos } } });
  await app.close();
});

describe('el teclado que se sirve', () => {
  it('es el español: tiene ñ, tilde muerta y ¿', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/mecanografia/teclado',
      headers: como(alumno.token),
    });
    expect(respuesta.statusCode).toBe(200);

    const { filas, dedos } = respuesta.json() as {
      filas: { base: string; alta?: string; altGr?: string; muerta?: boolean; dedo: string }[][];
      dedos: { clave: string }[];
    };
    const todas = filas.flat();

    // Sin esto, un niño que aprende aqui no encuentra la ñ en su teclado.
    const enie = todas.find((t) => t.base === 'ñ');
    expect(enie).toBeDefined();
    expect(enie!.dedo).toBe('menique-der');

    expect(todas.some((t) => t.muerta === true)).toBe(true);
    // `¿` es la tecla y `¡` lo que escribe con Mayus, como en el teclado real.
    expect(todas.some((t) => t.base === '¿' && t.alta === '¡')).toBe(true);
    // La arroba va en la Q con Alt Gr: es el teclado latinoamericano, no el de
    // España (donde seria Alt Gr + 2). Sin esta tecla, la leccion de escribir un
    // correo electronico no se puede terminar en una tableta.
    expect(todas.find((t) => t.base === 'q')?.altGr).toBe('@');
    // Y las llaves, que hacen falta para la leccion de escribir codigo.
    expect(todas.some((t) => t.base === '[' && t.alta === '{')).toBe(true);
    expect(todas.some((t) => t.base === ']' && t.alta === '}')).toBe(true);
    expect(dedos.length).toBe(9);
  });

  it('el mapa trae las tres zonas y la primera leccion abierta', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/mecanografia',
      headers: como(alumno.token),
    });
    const { zonas, resumen } = respuesta.json() as {
      zonas: { clave: string; grado: string; lecciones: { orden: number; desbloqueada: boolean }[] }[];
      resumen: { leccionesTotales: number; mejorPpm: number };
    };

    expect(zonas.map((z) => z.clave)).toEqual(['playa', 'laguna', 'cima']);
    expect(resumen.leccionesTotales).toBe(LECCIONES.length);
    expect(resumen.mejorPpm).toBe(0);

    // La primera de CADA zona esta abierta: un alumno de 7.o no tiene que pasar
    // por las lecciones de 5.o para llegar a la suya.
    for (const zona of zonas) {
      expect(zona.lecciones[0]!.desbloqueada).toBe(true);
      if (zona.lecciones.length > 1) expect(zona.lecciones[1]!.desbloqueada).toBe(false);
    }
  });
});

describe('todo lo que se pide escribir se puede escribir', () => {
  /*
   * Esta prueba existe por un fallo que no se ve en ninguna pantalla de
   * escritorio: dos lecciones de la Cima pedian `@`, `{`, `}`, `>` y `_`, y esas
   * teclas no estaban dibujadas. En un portatil da igual —el niño usa su teclado
   * fisico— pero en una tableta se escribe TOCANDO el teclado de la pantalla, y
   * alli esas dos lecciones eran imposibles de terminar. No fallaba nada: el
   * niño simplemente no podia avanzar.
   */
  const alcanzables = new Set<string>([' ']);
  for (const tecla of TECLADO_ES.flat()) {
    if (tecla.base) alcanzables.add(tecla.base);
    if (tecla.alta) alcanzables.add(tecla.alta);
    if (tecla.altGr) alcanzables.add(tecla.altGr);
    // Con la tecla muerta se alcanzan las vocales acentuadas.
    if (tecla.muerta) for (const acentuada of Object.keys(ACENTUADAS)) alcanzables.add(acentuada);
  }

  it.each(LECCIONES.map((l) => [l.clave, l.texto] as const))(
    'la leccion %s se puede escribir con el teclado de la pantalla',
    (_clave, texto) => {
      const imposibles = [...new Set([...texto].filter((c) => !alcanzables.has(c)))];
      expect(imposibles).toEqual([]);
    },
  );

  it('las palabras de los minijuegos tambien', () => {
    const imposibles = [
      ...new Set(PALABRAS_JUEGO.flatMap((p) => [...p]).filter((c) => !alcanzables.has(c))),
    ];
    expect(imposibles).toEqual([]);
  });

  it('y de cada caracter se sabe decir con que dedo y con que modificador', () => {
    // Si `comoEscribir` devolviera null, el niño veria la tecla iluminada pero
    // sin saber que dedo usar, que es la mitad de lo que enseña esto.
    const sinPulsacion = [...new Set(LECCIONES.flatMap((l) => [...l.texto]))]
      .filter((c) => c !== ' ')
      .filter((c) => comoEscribir(c) === null);
    expect(sinPulsacion).toEqual([]);
  });

  it('la arroba es Alt Gr + Q, que es el teclado latinoamericano', () => {
    // En el de España seria Alt Gr + 2. El colegio es colombiano.
    const arroba = comoEscribir('@');
    expect(arroba?.tecla.base).toBe('q');
    expect(arroba?.conAltGr).toBe(true);
    expect(arroba?.conMayus).toBe(false);
  });

  it('las llaves son Mayus sobre los corchetes, a la derecha de la ñ', () => {
    expect(comoEscribir('{')?.conMayus).toBe(true);
    expect(comoEscribir('{')?.tecla.base).toBe('[');
    expect(comoEscribir('}')?.tecla.base).toBe(']');
  });
});

describe('guardar un intento', () => {
  it('calcula las estrellas en el servidor, no las acepta del cliente', async () => {
    const texto = PRIMERA.texto.length;
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/mecanografia/leccion/${PRIMERA.clave}`,
      headers: como(alumno.token),
      payload: {
        correctos: texto,
        errores: 0,
        milisegundos: 30_000,
        erroresPorTecla: {},
        // Se manda de mas: si el servidor lo usara, aqui habria tres estrellas
        // regaladas.
        estrellas: 3,
        ppm: 999,
      },
    });
    expect(respuesta.statusCode).toBe(200);

    const resultado = respuesta.json() as { ppm: number; precision: number; estrellas: number };
    // 38 caracteres en 30 s son unas 15 ppm, no 999.
    expect(resultado.ppm).toBeLessThan(30);
    expect(resultado.precision).toBe(100);
    expect(resultado.estrellas).toBeGreaterThan(0);
  });

  it('rechaza un resultado imposible', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/mecanografia/leccion/${PRIMERA.clave}`,
      headers: como(alumno.token),
      payload: {
        // Mas caracteres correctos de los que tiene la leccion, y en un segundo.
        correctos: 4000,
        errores: 0,
        milisegundos: 1000,
        erroresPorTecla: {},
      },
    });
    expect(respuesta.statusCode).toBe(422);
  });

  it('no baja el record por un intento peor', async () => {
    const antes = await app.inject({
      method: 'GET',
      url: '/api/mecanografia',
      headers: como(alumno.token),
    });
    const mejorAntes = (antes.json() as { resumen: { mejorPpm: number } }).resumen.mejorPpm;
    expect(mejorAntes).toBeGreaterThan(0);

    // Un intento lento y con errores: nadie pierde lo que ya logro por practicar.
    await app.inject({
      method: 'POST',
      url: `/api/mecanografia/leccion/${PRIMERA.clave}`,
      headers: como(alumno.token),
      payload: { correctos: 10, errores: 10, milisegundos: 60_000, erroresPorTecla: { a: 5 } },
    });

    const despues = await app.inject({
      method: 'GET',
      url: '/api/mecanografia',
      headers: como(alumno.token),
    });
    const mapa = despues.json() as {
      zonas: { lecciones: { clave: string; estrellas: number; mejorPpm: number }[] }[];
      resumen: { mejorPpm: number; teclasDificiles: { tecla: string }[] };
    };
    expect(mapa.resumen.mejorPpm).toBe(mejorAntes);

    const leccion = mapa.zonas
      .flatMap((z) => z.lecciones)
      .find((l) => l.clave === PRIMERA.clave)!;
    expect(leccion.estrellas).toBeGreaterThan(0);
    expect(leccion.mejorPpm).toBe(mejorAntes);

    // Y los errores por tecla se acumulan: es lo que ve el docente.
    expect(mapa.resumen.teclasDificiles.map((t) => t.tecla)).toContain('a');
  });

  it('superar la primera abre la segunda', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/mecanografia',
      headers: como(alumno.token),
    });
    const zonas = (respuesta.json() as {
      zonas: { clave: string; lecciones: { orden: number; desbloqueada: boolean }[] }[];
    }).zonas;
    const playa = zonas.find((z) => z.clave === 'playa')!;
    expect(playa.lecciones[1]!.desbloqueada).toBe(true);
  });

  it('una leccion que no existe da 404', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/mecanografia/leccion/playa-99',
      headers: como(alumno.token),
      payload: { correctos: 10, errores: 0, milisegundos: 10_000, erroresPorTecla: {} },
    });
    expect(respuesta.statusCode).toBe(404);
  });
});

describe('la practica', () => {
  it('suma minutos y pulsaciones, pero no da estrellas', async () => {
    const antes = await app.inject({
      method: 'GET',
      url: '/api/mecanografia',
      headers: como(alumno.token),
    });
    const estrellasAntes = (antes.json() as { resumen: { estrellas: number } }).resumen.estrellas;

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/mecanografia/practica',
      headers: como(alumno.token),
      payload: {
        juego: 'ola',
        palabras: 20,
        correctos: 120,
        errores: 6,
        milisegundos: 60_000,
        puntos: 800,
      },
    });
    expect(respuesta.statusCode).toBe(200);
    expect((respuesta.json() as { ppm: number }).ppm).toBe(24);

    const despues = await app.inject({
      method: 'GET',
      url: '/api/mecanografia',
      headers: como(alumno.token),
    });
    const resumen = (despues.json() as {
      resumen: { estrellas: number; minutosPracticados: number };
    }).resumen;
    expect(resumen.estrellas).toBe(estrellasAntes);
    expect(resumen.minutosPracticados).toBeGreaterThanOrEqual(1);
  });
});

describe('quien puede entrar', () => {
  it('el docente no practica, pero ve a su grupo', async () => {
    const suya = await app.inject({
      method: 'GET',
      url: '/api/mecanografia',
      headers: como(docente.token),
    });
    expect(suya.statusCode).toBe(403);

    const aula = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/mecanografia`,
      headers: como(docente.token),
    });
    expect(aula.statusCode).toBe(200);

    const { filas } = aula.json() as {
      filas: { alumno: { id: number }; mejorPpm: number; teclasDificiles: string[] }[];
    };
    const fila = filas.find((f) => f.alumno.id === alumno.id)!;
    expect(fila.mejorPpm).toBeGreaterThan(0);
    // Lo que hace util la tabla: que tecla se le atraviesa.
    expect(fila.teclasDificiles.length).toBeGreaterThan(0);
  });

  it('sin sesion no hay nada', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/mecanografia' })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/mecanografia/teclado' })).statusCode,
    ).toBe(401);
  });
});
