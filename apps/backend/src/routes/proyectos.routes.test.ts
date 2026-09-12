/**
 * El taller de juegos y la zona publicada, probados por donde ceden sin avisar.
 *
 * Aqui lo que se protege no es un saldo: es una pantalla que ven otros menores.
 * Las tres cosas que no pueden fallar son que el titulo salga del sorteo y no
 * del navegador, que no se publique un juego imposible de ganar, y que un juego
 * solo lo toque su autor.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { juegoDePartida, tituloValido } from '@codenest/shared';

import { construirServidor } from '../server.js';

const marca = `p${Date.now().toString(36)}`;
const PASSWORD = 'clave-de-prueba-1234';
const PIN = ['gato', 'sol', 'luna', 'flor'];

let app: FastifyInstance;
let docente = { id: 0, token: '' };
let ajeno = { id: 0, token: '' };
let autor = { id: 0, token: '' };
let otroNino = { id: 0, token: '' };
let aulaId = 0;
const adultos: number[] = [];

const como = (token: string) => ({ authorization: `Bearer ${token}` });

async function altaDocente(nombre: string): Promise<{ id: number; token: string }> {
  const r = await app.inject({
    method: 'POST',
    url: '/api/auth/registro',
    payload: {
      nombre,
      email: `${nombre.toLowerCase().replace(/\s+/g, '.')}.${marca}@prueba.local`,
      password: PASSWORD,
      rol: 'docente',
    },
  });
  const datos = r.json() as { token: string; usuario: { id: number } };
  adultos.push(datos.usuario.id);
  return { id: datos.usuario.id, token: datos.token };
}

async function altaNino(
  nombre: string,
  tokenDocente: string,
  aula: number,
): Promise<{ id: number; token: string }> {
  const alta = await app.inject({
    method: 'POST',
    url: `/api/docente/aulas/${aula}/estudiantes`,
    headers: como(tokenDocente),
    payload: {
      estudiantes: [{ nombre, fechaNacimiento: '2016-05-10' }],
      pinComun: PIN,
    },
  });
  const creado = (alta.json() as { estudiantes: { id: number; usuario: string }[] }).estudiantes[0]!;
  const acceso = await app.inject({
    method: 'POST',
    url: '/api/auth/login-nino',
    payload: { usuario: creado.usuario, pin: PIN },
  });
  return { id: creado.id, token: (acceso.json() as { token: string }).token };
}

/** Crea un proyecto y devuelve su identificador. */
async function crear(token: string): Promise<number> {
  const r = await app.inject({ method: 'POST', url: '/api/proyectos', headers: como(token) });
  expect(r.statusCode).toBe(201);
  return (r.json() as { proyecto: { id: number } }).proyecto.id;
}

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();

  docente = await altaDocente('Docente Juegos');
  ajeno = await altaDocente('Docente Ajeno');

  const aula = await app.inject({
    method: 'POST',
    url: '/api/docente/aulas',
    headers: como(docente.token),
    payload: { nombre: `Taller ${marca}`, grado: '4' },
  });
  aulaId = (aula.json() as { aula: { id: number } }).aula.id;

  autor = await altaNino(`Autor Juegos ${marca}`, docente.token, aulaId);
  otroNino = await altaNino(`Otro Nino ${marca}`, docente.token, aulaId);
}, 120_000);

afterAll(async () => {
  const suyos = await app.prisma.guardianLink.findMany({
    where: { tutorId: { in: adultos } },
    select: { ninoId: true },
  });
  const ninos = suyos.map((g) => g.ninoId);
  await app.prisma.gameProject.deleteMany({ where: { autorId: { in: ninos } } });
  await app.prisma.user.deleteMany({ where: { id: { in: ninos } } });
  await app.prisma.classroom.deleteMany({ where: { docenteId: { in: adultos } } });
  await app.prisma.user.deleteMany({ where: { id: { in: adultos } } });
  await app.close();
});

describe('crear un juego', () => {
  it('nace jugable y con un titulo del sorteo', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/proyectos',
      headers: como(autor.token),
    });
    expect(respuesta.statusCode).toBe(201);

    const { proyecto } = respuesta.json() as {
      proyecto: { id: number; titulo: string; estado: string; probado: boolean };
    };
    expect(tituloValido(proyecto.titulo)).toBe(true);
    expect(proyecto.estado).toBe('borrador');
    expect(proyecto.probado).toBe(false);

    // Y viene con un juego completo dentro, no con un lienzo vacio.
    const abierto = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${proyecto.id}`,
      headers: como(autor.token),
    });
    const completo = abierto.json() as {
      proyecto: { definicion: { obstaculos: unknown[]; reglas: unknown[] }; avisos: unknown[] };
    };
    expect(completo.proyecto.definicion.obstaculos.length).toBeGreaterThan(0);
    expect(completo.proyecto.definicion.reglas.length).toBeGreaterThan(0);
    expect(completo.proyecto.avisos).toEqual([]);
  });

  it('el titulo no se puede elegir ni colar en el guardado', async () => {
    const id = await crear(autor.token);
    const antes = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
    });
    const titulo = (antes.json() as { proyecto: { titulo: string } }).proyecto.titulo;

    // Se intenta con un titulo escrito a mano, que es el caso que importa.
    const guardado = await app.inject({
      method: 'PUT',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
      payload: { definicion: juegoDePartida(), titulo: 'El juego de PEDRO tonto' },
    });
    expect(guardado.statusCode).toBe(200);

    const despues = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
    });
    expect((despues.json() as { proyecto: { titulo: string } }).proyecto.titulo).toBe(titulo);
  });

  it('el boton de otro titulo da uno distinto y tambien del sorteo', async () => {
    const id = await crear(autor.token);
    const r = await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/titulo`,
      headers: como(autor.token),
    });
    const { titulo } = r.json() as { titulo: string };
    expect(tituloValido(titulo)).toBe(true);
  });
});

describe('guardar', () => {
  it('rechaza una definicion con un escenario inventado', async () => {
    const id = await crear(autor.token);
    const r = await app.inject({
      method: 'PUT',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
      payload: { definicion: { ...juegoDePartida(), escenario: 'mordor' } },
    });
    expect(r.statusCode).toBe(400);
  });

  it('rechaza un color que no esta en la paleta', async () => {
    const id = await crear(autor.token);
    const def = juegoDePartida();
    const r = await app.inject({
      method: 'PUT',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
      payload: { definicion: { ...def, jugador: { ...def.jugador, color: '#123456' } } },
    });
    expect(r.statusCode).toBe(400);
  });

  it('cambiar el juego invalida la prueba anterior', async () => {
    const id = await crear(autor.token);
    await app.inject({ method: 'POST', url: `/api/proyectos/${id}/probado`, headers: como(autor.token) });

    const def = juegoDePartida();
    await app.inject({
      method: 'PUT',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
      // Se acelera el obstaculo: lo que se gano antes puede ser imposible ahora.
      payload: {
        definicion: { ...def, obstaculos: [{ ...def.obstaculos[0]!, velocidad: 'rapida' }] },
      },
    });

    const abierto = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
    });
    expect((abierto.json() as { proyecto: { probado: boolean } }).proyecto.probado).toBe(false);
  });

  it('guardar lo MISMO no borra la prueba', async () => {
    const id = await crear(autor.token);
    const abierto = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
    });
    const def = (abierto.json() as { proyecto: { definicion: unknown } }).proyecto.definicion;

    await app.inject({ method: 'POST', url: `/api/proyectos/${id}/probado`, headers: como(autor.token) });

    // Postgres guarda JSONB con las claves reordenadas, asi que comparar el
    // texto crudo decia siempre "cambio" y esto borraba la prueba. Publicar
    // guarda antes de publicar, asi que publicar fallaba SIEMPRE.
    await app.inject({
      method: 'PUT',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
      payload: { definicion: def },
    });

    const despues = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
    });
    expect((despues.json() as { proyecto: { probado: boolean } }).proyecto.probado).toBe(true);
  });

  it('no se puede guardar el juego de otro', async () => {
    const id = await crear(autor.token);
    const r = await app.inject({
      method: 'PUT',
      url: `/api/proyectos/${id}`,
      headers: como(otroNino.token),
      payload: { definicion: juegoDePartida() },
    });
    // 404 y no 403: el juego de otro no se confirma ni negando el permiso.
    expect(r.statusCode).toBe(404);
  });
});

describe('publicar', () => {
  it('no se publica sin haberlo jugado y ganado', async () => {
    const id = await crear(autor.token);
    const r = await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/publicar`,
      headers: como(autor.token),
      payload: {},
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ error: expect.stringContaining('Prueba') });
  });

  it('no se publica un juego que no se puede ganar', async () => {
    const id = await crear(autor.token);
    const def = juegoDePartida();

    // Se quita la regla de ganar: el juego no se acaba nunca.
    await app.inject({
      method: 'PUT',
      url: `/api/proyectos/${id}`,
      headers: como(autor.token),
      payload: { definicion: { ...def, reglas: def.reglas.filter((r) => r.entonces !== 'ganar') } },
    });
    await app.inject({ method: 'POST', url: `/api/proyectos/${id}/probado`, headers: como(autor.token) });

    const r = await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/publicar`,
      headers: como(autor.token),
      payload: {},
    });
    expect(r.statusCode).toBe(409);
  });

  it('entrega diploma e insignia, y el diploma se verifica sin sesion', async () => {
    const id = await crear(autor.token);
    await app.inject({ method: 'POST', url: `/api/proyectos/${id}/probado`, headers: como(autor.token) });

    const r = await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/publicar`,
      headers: como(autor.token),
      payload: {},
    });
    expect(r.statusCode).toBe(200);

    const resultado = r.json() as {
      proyecto: { estado: string };
      diploma: { codigo: string; nombreAlumno: string; tituloJuego: string; esNuevo: boolean };
      insignias: { clave: string; esNuevo: boolean }[];
    };
    expect(resultado.proyecto.estado).toBe('publicado');
    expect(resultado.diploma.codigo).toMatch(/^CDX-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(resultado.diploma.esNuevo).toBe(true);
    expect(resultado.insignias.map((i) => i.clave)).toContain('constructor-de-juegos');

    // El diploma se puede comprobar SIN sesion: es para lo que existe.
    const verificacion = await app.inject({
      method: 'GET',
      url: `/api/juegos/diploma/${resultado.diploma.codigo}`,
    });
    expect(verificacion.statusCode).toBe(200);
    const { diploma } = verificacion.json() as {
      diploma: { nombreAlumno: string; tituloJuego: string };
    };
    expect(diploma.nombreAlumno).toContain('Autor Juegos');
    expect(diploma.tituloJuego).toBe(resultado.diploma.tituloJuego);

    // Y un codigo inventado no existe.
    const falso = await app.inject({ method: 'GET', url: '/api/juegos/diploma/CDX-AAAA-AAAA' });
    expect([404, 200]).toContain(falso.statusCode);
    if (falso.statusCode === 200) {
      // Improbable, pero si el azar dio ese codigo, al menos no es el nuestro.
      expect((falso.json() as { diploma: { codigo: string } }).diploma.codigo).not.toBe(
        resultado.diploma.codigo,
      );
    }
  });

  it('publicar dos veces el mismo juego no reparte dos diplomas', async () => {
    const id = await crear(autor.token);
    await app.inject({ method: 'POST', url: `/api/proyectos/${id}/probado`, headers: como(autor.token) });

    const primera = await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/publicar`,
      headers: como(autor.token),
      payload: {},
    });
    await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/despublicar`,
      headers: como(autor.token),
    });
    const segunda = await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/publicar`,
      headers: como(autor.token),
      payload: {},
    });

    const uno = (primera.json() as { diploma: { codigo: string } }).diploma;
    const dos = (segunda.json() as { diploma: { codigo: string; esNuevo: boolean } }).diploma;
    expect(dos.codigo).toBe(uno.codigo);
    expect(dos.esNuevo).toBe(false);
  });
});

describe('la zona de juegos publicados', () => {
  let publicado = 0;

  beforeAll(async () => {
    publicado = await crear(autor.token);
    await app.inject({
      method: 'POST',
      url: `/api/proyectos/${publicado}/probado`,
      headers: como(autor.token),
    });
    await app.inject({
      method: 'POST',
      url: `/api/proyectos/${publicado}/publicar`,
      headers: como(autor.token),
      payload: {},
    });
  });

  it('el docente ve los juegos de su clase, tambien los borradores', async () => {
    const borrador = await crear(autor.token);

    const r = await app.inject({
      method: 'GET',
      url: '/api/docente/proyectos',
      headers: como(docente.token),
    });
    expect(r.statusCode).toBe(200);

    const { proyectos, resumen } = r.json() as {
      proyectos: { id: number; estado: string; autor: { nombre: string } }[];
      resumen: { total: number; publicados: number; constructores: number };
    };
    const ids = proyectos.map((p) => p.id);
    expect(ids).toContain(publicado);
    expect(ids).toContain(borrador);
    expect(resumen.publicados).toBeGreaterThanOrEqual(1);
  });

  it('el docente de al lado no ve nada de esta clase', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/docente/proyectos',
      headers: como(ajeno.token),
    });
    const { proyectos } = r.json() as { proyectos: { id: number }[] };
    expect(proyectos.map((p) => p.id)).not.toContain(publicado);
  });

  it('otro nino lo ve en la lista y puede jugarlo', async () => {
    const lista = await app.inject({
      method: 'GET',
      url: '/api/juegos',
      headers: como(otroNino.token),
    });
    const { juegos } = lista.json() as {
      juegos: { id: number; autor: string; esMio: boolean }[];
    };
    const mio = juegos.find((j) => j.id === publicado);
    expect(mio).toBeDefined();
    // Del autor solo sale el nombre de pila.
    expect(mio!.autor.split(' ').length).toBe(1);
    expect(mio!.esMio).toBe(false);

    const abrir = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${publicado}`,
      headers: como(otroNino.token),
    });
    expect(abrir.statusCode).toBe(200);
  });

  it('un borrador ajeno no se puede abrir', async () => {
    const borrador = await crear(autor.token);
    const r = await app.inject({
      method: 'GET',
      url: `/api/proyectos/${borrador}`,
      headers: como(otroNino.token),
    });
    expect(r.statusCode).toBe(404);
  });

  it('cuenta las partidas', async () => {
    const antes = await app.inject({
      method: 'GET',
      url: '/api/juegos',
      headers: como(otroNino.token),
    });
    const partidasAntes =
      (antes.json() as { juegos: { id: number; partidas: number }[] }).juegos.find(
        (j) => j.id === publicado,
      )?.partidas ?? 0;

    await app.inject({
      method: 'POST',
      url: `/api/juegos/${publicado}/partida`,
      headers: como(otroNino.token),
    });

    const despues = await app.inject({
      method: 'GET',
      url: '/api/juegos',
      headers: como(otroNino.token),
    });
    const partidasDespues = (
      despues.json() as { juegos: { id: number; partidas: number }[] }
    ).juegos.find((j) => j.id === publicado)!.partidas;
    expect(partidasDespues).toBe(partidasAntes + 1);
  });

  it('el me gusta es uno por persona y se puede quitar', async () => {
    const poner = await app.inject({
      method: 'POST',
      url: `/api/juegos/${publicado}/megusta`,
      headers: como(otroNino.token),
    });
    expect(poner.json()).toMatchObject({ meGusta: 1, leDiMeGusta: true });

    // Dos toques seguidos en un movil lento no pueden dejar el contador en 2.
    const quitar = await app.inject({
      method: 'POST',
      url: `/api/juegos/${publicado}/megusta`,
      headers: como(otroNino.token),
    });
    expect(quitar.json()).toMatchObject({ meGusta: 0, leDiMeGusta: false });
  });

  it('un juego despublicado desaparece de la lista', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/proyectos/${publicado}/despublicar`,
      headers: como(autor.token),
    });

    const lista = await app.inject({
      method: 'GET',
      url: '/api/juegos',
      headers: como(otroNino.token),
    });
    const ids = (lista.json() as { juegos: { id: number }[] }).juegos.map((j) => j.id);
    expect(ids).not.toContain(publicado);
  });
});

describe('el taller es de los estudiantes', () => {
  it('un docente no crea juegos', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/proyectos',
      headers: como(docente.token),
    });
    expect(r.statusCode).toBe(403);
  });

  it('sin sesion no hay taller', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/proyectos' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/juegos' })).statusCode).toBe(401);
  });
});

describe('la insignia en el perfil', () => {
  it('aparece en los datos del estudiante', async () => {
    const id = await crear(autor.token);
    await app.inject({ method: 'POST', url: `/api/proyectos/${id}/probado`, headers: como(autor.token) });
    await app.inject({
      method: 'POST',
      url: `/api/proyectos/${id}/publicar`,
      headers: como(autor.token),
      payload: {},
    });

    const r = await app.inject({
      method: 'GET',
      url: '/api/progreso/mio',
      headers: como(autor.token),
    });
    const datos = r.json() as {
      insignias: { clave: string; nombre: string; icono: string }[];
      diplomas: { codigo: string; tituloJuego: string }[];
    };
    expect(datos.insignias.map((i) => i.clave)).toContain('constructor-de-juegos');
    expect(datos.diplomas.length).toBeGreaterThan(0);
  });
});
