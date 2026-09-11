/**
 * La zona del docente, probada como se usa: un curso entero de una vez.
 *
 * Lo que se protege aqui son dos cosas que se rompen en silencio:
 *
 *  1. La frontera del aula. Un docente no puede ver ni tocar el grupo de otro,
 *     y menos aun sus credenciales. Es la parte que ninguna interfaz puede
 *     garantizar, porque esconder un boton no cierra una ruta.
 *  2. Que el PIN que se muestra sea el PIN con el que se entra de verdad. Son
 *     dos columnas distintas (el hash y la copia cifrada) y si se separan, el
 *     docente reparte en clase unas credenciales que no funcionan.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { construirServidor } from '../server.js';

const marca = `d${Date.now().toString(36)}`;
const PASSWORD = 'clave-de-prueba-1234';

let app: FastifyInstance;
/** El docente de la historia y el de al lado, que no debe ver nada. */
let docente = { id: 0, token: '' };
let ajeno = { id: 0, token: '' };
let aulaId = 0;
const creados: number[] = [];

async function altaDocente(nombre: string): Promise<{ id: number; token: string }> {
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/auth/registro',
    payload: {
      nombre,
      email: `${nombre.toLowerCase().replace(/\s+/g, '.')}.${marca}@prueba.local`,
      password: PASSWORD,
      rol: 'docente',
    },
  });
  const datos = respuesta.json() as { token: string; usuario: { id: number } };
  creados.push(datos.usuario.id);
  return { id: datos.usuario.id, token: datos.token };
}

const como = (token: string) => ({ authorization: `Bearer ${token}` });

/** Fecha de nacimiento de quien cumple hoy los anos indicados. */
function haceAnos(anos: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();

  docente = await altaDocente('Marta Docente');
  ajeno = await altaDocente('Otro Docente');

  const aula = await app.inject({
    method: 'POST',
    url: '/api/docente/aulas',
    headers: como(docente.token),
    payload: { nombre: 'Tercero B', grado: '3' },
  });
  aulaId = (aula.json() as { aula: { id: number } }).aula.id;
}, 120_000);

afterAll(async () => {
  // Se limpia por el docente y no por el aula. Un estudiante trasladado a otro
  // grupo ya no esta en `aulaId`, y borrar el aula solo se lleva la inscripcion:
  // la cuenta quedaba huerfana y su nombre de usuario contaminaba la siguiente
  // ejecucion, que es exactamente como se descubrio que faltaba comprobar los
  // nombres reservados contra la base y no solo contra el lote.
  const suyos = await app.prisma.guardianLink.findMany({
    where: { tutorId: { in: creados } },
    select: { ninoId: true },
  });
  await app.prisma.user.deleteMany({ where: { id: { in: suyos.map((g) => g.ninoId) } } });
  await app.prisma.classroom.deleteMany({ where: { docenteId: { in: creados } } });
  await app.prisma.user.deleteMany({ where: { id: { in: creados } } });
  await app.close();
});

describe('el primer dia de clase', () => {
  it('da de alta el curso entero con el mismo PIN', async () => {
    const nombres = ['Ana Lopez', 'Bruno Diaz', 'Carla Ruiz', 'Ana Lopez'];

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
      payload: {
        estudiantes: nombres.map((nombre) => ({ nombre, fechaNacimiento: '2017-05-10' })),
        pinComun: ['gato', 'sol', 'luna', 'flor'],
      },
    });

    expect(respuesta.statusCode).toBe(201);
    const { estudiantes } = respuesta.json() as {
      estudiantes: { id: number; usuario: string; pin: string[] }[];
    };

    expect(estudiantes).toHaveLength(4);
    // Dos "Ana Lopez" en el mismo lote: ninguna existe todavia al consultar, asi
    // que sin cuidado las dos pediria el mismo usuario y el alta fallaria entera.
    expect(new Set(estudiantes.map((e) => e.usuario)).size).toBe(4);
    for (const e of estudiantes) expect(e.pin).toEqual(['gato', 'sol', 'luna', 'flor']);
  });

  it('el PIN que se reparte es con el que se entra de verdad', async () => {
    const credenciales = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/credenciales`,
      headers: como(docente.token),
    });
    const { credenciales: lista } = credenciales.json() as {
      credenciales: { usuario: string; pin: string[] | null }[];
    };
    const primero = lista[0]!;
    expect(primero.pin).not.toBeNull();

    // La prueba de fuego: entrar al juego con lo que el portal muestra.
    const acceso = await app.inject({
      method: 'POST',
      url: '/api/auth/login-nino',
      payload: { usuario: primero.usuario, pin: primero.pin },
    });

    expect(acceso.statusCode).toBe(200);
  });

  it('el alta individual es la misma ruta con un solo estudiante', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
      // La fecha se calcula desde hoy: una fija convertiria esta prueba en una
      // bomba de relojeria que empieza a fallar cuando el nino "cumple anos".
      payload: { estudiantes: [{ nombre: 'Diego Solo', fechaNacimiento: haceAnos(8) }] },
    });

    expect(respuesta.statusCode).toBe(201);
    const { estudiantes } = respuesta.json() as { estudiantes: { pin: string[]; grupoEdad: string }[] };
    // Sin PIN dictado se genera uno, y se devuelve para poder anotarlo.
    expect(estudiantes[0]?.pin).toHaveLength(4);
    // Y el grupo de edad sale de la fecha, no de lo que diga el cliente.
    expect(estudiantes[0]?.grupoEdad).toBe('creadores');
  });
});

describe('cambiar los PIN a mitad de curso', () => {
  it('pone el mismo a toda la clase de una vez', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/pines`,
      headers: como(docente.token),
      payload: { pin: ['pez', 'pez', 'nube', 'tren'] },
    });

    expect(respuesta.statusCode).toBe(200);
    const { cambiados, credenciales } = respuesta.json() as {
      cambiados: number;
      credenciales: { usuario: string; pin: string[] }[];
    };
    expect(cambiados).toBe(5);

    const acceso = await app.inject({
      method: 'POST',
      url: '/api/auth/login-nino',
      payload: { usuario: credenciales[0]!.usuario, pin: ['pez', 'pez', 'nube', 'tren'] },
    });
    expect(acceso.statusCode).toBe(200);
  });

  it('o uno distinto al azar para cada estudiante', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/pines`,
      headers: como(docente.token),
      payload: {},
    });

    const { credenciales } = respuesta.json() as { credenciales: { usuario: string; pin: string[] }[] };
    // Con cinco estudiantes y 6.561 combinaciones, que salgan todos iguales
    // significaria que no se esta generando nada.
    expect(new Set(credenciales.map((c) => c.pin.join('|'))).size).toBeGreaterThan(1);

    const acceso = await app.inject({
      method: 'POST',
      url: '/api/auth/login-nino',
      payload: { usuario: credenciales[0]!.usuario, pin: credenciales[0]!.pin },
    });
    expect(acceso.statusCode).toBe(200);
  });

  it('el PIN anterior deja de servir', async () => {
    const acceso = await app.inject({
      method: 'POST',
      url: '/api/auth/login-nino',
      payload: { usuario: 'ana.l', pin: ['gato', 'sol', 'luna', 'flor'] },
    });

    expect(acceso.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('el aula de otro docente no existe', () => {
  it('no deja ver la lista', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(ajeno.token),
    });

    // 404 y no 403: confirmar que existe ya seria contar algo del otro colegio.
    expect(respuesta.statusCode).toBe(404);
  });

  it('no deja ver las credenciales', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/credenciales`,
      headers: como(ajeno.token),
    });

    expect(respuesta.statusCode).toBe(404);
  });

  it('no deja cambiar los PIN', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/pines`,
      headers: como(ajeno.token),
      payload: { pin: ['gato', 'gato', 'gato', 'gato'] },
    });

    expect(respuesta.statusCode).toBe(404);
  });

  it('no deja renombrar a un estudiante ajeno', async () => {
    const lista = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
    });
    const ninoId = (lista.json() as { estudiantes: { id: number }[] }).estudiantes[0]!.id;

    const respuesta = await app.inject({
      method: 'PUT',
      url: `/api/docente/estudiantes/${ninoId}`,
      headers: como(ajeno.token),
      payload: { nombre: 'Nombre Robado' },
    });

    expect(respuesta.statusCode).toBe(404);
  });

  it('y una familia tampoco entra en la zona del docente', async () => {
    const tutor = await app.inject({
      method: 'POST',
      url: '/api/auth/registro',
      payload: {
        nombre: 'Padre Curioso',
        email: `padre.${marca}@prueba.local`,
        password: PASSWORD,
        rol: 'tutor',
      },
    });
    const datos = tutor.json() as { token: string; usuario: { id: number } };
    creados.push(datos.usuario.id);

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/docente/aulas',
      headers: como(datos.token),
    });

    expect(respuesta.statusCode).toBe(403);
  });
});

describe('tareas y seguimiento', () => {
  it('asigna un mundo al grupo y lo lista', async () => {
    const creada = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/tareas`,
      headers: como(docente.token),
      payload: { mundoNumero: 3, titulo: 'Repasar los bucles', fechaLimite: '2026-10-01' },
    });
    expect(creada.statusCode).toBe(201);

    const lista = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/tareas`,
      headers: como(docente.token),
    });
    const { tareas } = lista.json() as { tareas: { mundo: { numero: number } | null }[] };
    expect(tareas.some((t) => t.mundo?.numero === 3)).toBe(true);
  });

  it('rechaza una tarea que no apunta a nada', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/tareas`,
      headers: como(docente.token),
      payload: { titulo: 'Sin destino' },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('muestra el avance del grupo mundo a mundo', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/avance`,
      headers: como(docente.token),
    });

    expect(respuesta.statusCode).toBe(200);
    const { mundos, estudiantes } = respuesta.json() as {
      mundos: { mundo: number; actividades: number }[];
      estudiantes: unknown[];
    };
    expect(mundos).toHaveLength(30);
    expect(mundos[0]?.actividades).toBe(20);
    expect(estudiantes).toHaveLength(5);
  });

  it('y la ficha de un estudiante concreto', async () => {
    const lista = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
    });
    const ninoId = (lista.json() as { estudiantes: { id: number }[] }).estudiantes[0]!.id;

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/docente/estudiantes/${ninoId}/avance`,
      headers: como(docente.token),
    });

    expect(respuesta.statusCode).toBe(200);
    const ficha = respuesta.json() as { estudiante: { id: number }; porMundo: unknown[] };
    expect(ficha.estudiante.id).toBe(ninoId);
    expect(Array.isArray(ficha.porMundo)).toBe(true);
  });
});

describe('mover estudiantes entre grupos', () => {
  it('traslada sin perder el progreso ni la cuenta', async () => {
    const otra = await app.inject({
      method: 'POST',
      url: '/api/docente/aulas',
      headers: como(docente.token),
      payload: { nombre: 'Cuarto A' },
    });
    const destinoId = (otra.json() as { aula: { id: number } }).aula.id;

    const lista = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
    });
    const ninoId = (lista.json() as { estudiantes: { id: number }[] }).estudiantes[0]!.id;

    const traslado = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${destinoId}/inscribir`,
      headers: como(docente.token),
      payload: { ninoIds: [ninoId], desdeAulaId: aulaId },
    });
    expect(traslado.statusCode).toBe(200);

    const origen = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
    });
    const quedan = (origen.json() as { estudiantes: { id: number }[] }).estudiantes;
    expect(quedan.some((e) => e.id === ninoId)).toBe(false);

    // La cuenta sigue existiendo: trasladar no es dar de baja.
    const cuenta = await app.prisma.user.findUnique({ where: { id: ninoId } });
    expect(cuenta).not.toBeNull();

    await app.prisma.classroom.delete({ where: { id: destinoId } });
  });
});

/**
 * Jugar es de los estudiantes.
 *
 * Un adulto que abre una sesion y envia un programa no comete una travesura: se
 * crea progreso, estrellas y monedas en SU cuenta, y ese ruido acaba en los
 * agregados del aula, que es justo lo que el docente mira para decidir a quien
 * se sienta al lado.
 *
 * Se comprueba con un administrador a proposito. `exigirRol` deja pasar siempre
 * al admin —y para las rutas administrativas esta bien— asi que si estas rutas
 * usaran esa guarda, la prueba lo cazaria.
 */
describe('las actividades son para las cuentas de estudiante', () => {
  it('un docente no puede abrir una sesion de juego', async () => {
    const actividad = await app.prisma.activity.findFirst({
      where: { numeroGlobal: 1 },
      select: { id: true },
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/sesiones',
      headers: como(docente.token),
      payload: { actividadId: actividad!.id, editor: 'comandos', lenguaje: 'comandos' },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('ni siquiera un administrador de la plataforma', async () => {
    const admin = await app.inject({
      method: 'POST',
      url: '/api/auth/registro',
      payload: {
        nombre: 'Admin Prueba',
        email: `admin.${marca}@prueba.local`,
        password: PASSWORD,
        rol: 'tutor',
      },
    });
    const datos = admin.json() as { usuario: { id: number } };
    creados.push(datos.usuario.id);
    // Se asciende a admin por la base: no hay ruta publica para crear uno.
    await app.prisma.user.update({ where: { id: datos.usuario.id }, data: { rol: 'admin' } });

    const acceso = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `admin.${marca}@prueba.local`, password: PASSWORD },
    });
    const tokenAdmin = (acceso.json() as { token: string }).token;

    const actividad = await app.prisma.activity.findFirst({
      where: { numeroGlobal: 1 },
      select: { id: true },
    });
    const sesion = await app.inject({
      method: 'POST',
      url: '/api/sesiones',
      headers: como(tokenAdmin),
      payload: { actividadId: actividad!.id, editor: 'comandos', lenguaje: 'comandos' },
    });

    expect(sesion.statusCode).toBe(403);

    // Y tampoco puede mandar telemetria de juego.
    const telemetria = await app.inject({
      method: 'POST',
      url: '/api/telemetria/eventos',
      headers: como(tokenAdmin),
      payload: { eventos: [{ evento: 'actividad_iniciada', datos: {} }] },
    });
    expect(telemetria.statusCode).toBe(403);
  });

  it('pero un estudiante si', async () => {
    const lista = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
    });
    const alumno = (lista.json() as { estudiantes: { usuario: string }[] }).estudiantes[0]!;

    // El PIN de este grupo se cambio al azar en una prueba anterior; se lee el
    // que tiene ahora mismo por la ruta de credenciales.
    const credenciales = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/credenciales`,
      headers: como(docente.token),
    });
    const suyas = (credenciales.json() as { credenciales: { usuario: string; pin: string[] | null }[] })
      .credenciales.find((c) => c.usuario === alumno.usuario)!;

    const acceso = await app.inject({
      method: 'POST',
      url: '/api/auth/login-nino',
      payload: { usuario: suyas.usuario, pin: suyas.pin },
    });
    const tokenNino = (acceso.json() as { token: string }).token;

    const actividad = await app.prisma.activity.findFirst({
      where: { numeroGlobal: 1 },
      select: { id: true },
    });
    const sesion = await app.inject({
      method: 'POST',
      url: '/api/sesiones',
      headers: como(tokenNino),
      payload: { actividadId: actividad!.id, editor: 'comandos', lenguaje: 'comandos' },
    });

    expect(sesion.statusCode).toBe(201);
  });
});
