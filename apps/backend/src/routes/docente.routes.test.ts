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
 * Quien puede jugar.
 *
 * Los estudiantes y los adultos del colegio: un docente no puede explicar el
 * lunes un mundo que no ha jugado, y un administrador tiene que poder ver lo
 * que vende. Su progreso es suyo y no entra en los agregados del aula, que se
 * calculan sobre los estudiantes inscritos.
 *
 * La familia no: su cuenta sirve para acompanar y pagar, y jugar con ella
 * mezclaria su progreso con el de su hijo en el mismo portal.
 */
describe('quien puede jugar', () => {
  async function primeraActividad(): Promise<number> {
    const actividad = await app.prisma.activity.findFirstOrThrow({
      where: { numeroGlobal: 1 },
      select: { id: true },
    });
    return actividad.id;
  }

  const abrirSesion = async (token: string) =>
    app.inject({
      method: 'POST',
      url: '/api/sesiones',
      headers: como(token),
      payload: { actividadId: await primeraActividad(), editor: 'comandos', lenguaje: 'comandos' },
    });

  it('un docente abre una sesion de juego y manda su telemetria', async () => {
    expect((await abrirSesion(docente.token)).statusCode).toBe(201);

    const telemetria = await app.inject({
      method: 'POST',
      url: '/api/telemetria/eventos',
      headers: como(docente.token),
      payload: { eventos: [{ evento: 'actividad_iniciada', datos: {} }] },
    });
    expect(telemetria.statusCode).toBe(200);
  });

  it('un administrador tambien', async () => {
    const alta = await app.inject({
      method: 'POST',
      url: '/api/auth/registro',
      payload: {
        nombre: 'Admin Prueba',
        email: `admin.${marca}@prueba.local`,
        password: PASSWORD,
        rol: 'tutor',
      },
    });
    const datos = alta.json() as { usuario: { id: number } };
    creados.push(datos.usuario.id);
    // Se asciende por la base: no hay ruta publica para crear un admin.
    await app.prisma.user.update({ where: { id: datos.usuario.id }, data: { rol: 'admin' } });

    const acceso = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `admin.${marca}@prueba.local`, password: PASSWORD },
    });
    expect((await abrirSesion((acceso.json() as { token: string }).token)).statusCode).toBe(201);
  });

  it('la familia no: se le manda a la cuenta del estudiante', async () => {
    const alta = await app.inject({
      method: 'POST',
      url: '/api/auth/registro',
      payload: {
        nombre: 'Tutor Prueba',
        email: `tutor.juega.${marca}@prueba.local`,
        password: PASSWORD,
        rol: 'tutor',
      },
    });
    const datos = alta.json() as { token: string; usuario: { id: number } };
    creados.push(datos.usuario.id);

    const sesion = await abrirSesion(datos.token);
    expect(sesion.statusCode).toBe(403);
    expect((sesion.json() as { mensaje: string }).mensaje).toContain('cuenta del estudiante');
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

describe('asignar a unos pocos y seguirlo', () => {
  /** Los dos primeros de la lista: a ellos se les manda el repaso. */
  let elegidos: { id: number; nombre: string }[] = [];
  let tareaDeTodos = 0;
  let tareaDePocos = 0;

  it('una tarea puede ir solo a algunos estudiantes', async () => {
    const lista = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/estudiantes`,
      headers: como(docente.token),
    });
    elegidos = (lista.json() as { estudiantes: { id: number; nombre: string }[] }).estudiantes.slice(
      0,
      2,
    );

    const actividad = await app.prisma.activity.findFirst({
      where: { numeroGlobal: 2 },
      select: { id: true },
    });

    const creada = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/tareas`,
      headers: como(docente.token),
      payload: {
        actividadId: actividad!.id,
        titulo: 'Repaso del martes',
        ninoIds: elegidos.map((e) => e.id),
      },
    });

    expect(creada.statusCode).toBe(201);
    const { tarea } = creada.json() as {
      tarea: { id: number; alcance: string; destinatarios: { id: number }[] };
    };
    tareaDePocos = tarea.id;
    expect(tarea.alcance).toBe('estudiantes');
    expect(tarea.destinatarios.map((d) => d.id).sort()).toEqual(elegidos.map((e) => e.id).sort());
  });

  it('no se puede asignar a un estudiante de otro grupo', async () => {
    const otroGrupo = await app.inject({
      method: 'POST',
      url: '/api/docente/aulas',
      headers: como(docente.token),
      payload: { nombre: 'Grupo de al lado' },
    });
    const otroId = (otroGrupo.json() as { aula: { id: number } }).aula.id;

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${otroId}/tareas`,
      headers: como(docente.token),
      payload: { mundoNumero: 1, ninoIds: [elegidos[0]!.id] },
    });

    expect(respuesta.statusCode).toBe(400);
    expect((respuesta.json() as { error: string }).error).toContain('no esta en este grupo');
  });

  it('la matriz solo tiene celda para quien recibio la tarea', async () => {
    const delGrupo = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/tareas`,
      headers: como(docente.token),
      payload: { mundoNumero: 1, titulo: 'Mundo uno para todos' },
    });
    tareaDeTodos = (delGrupo.json() as { tarea: { id: number } }).tarea.id;

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/seguimiento`,
      headers: como(docente.token),
    });

    expect(respuesta.statusCode).toBe(200);
    const datos = respuesta.json() as {
      asignaciones: { id: number; alcance: string; actividades: number }[];
      filas: { id: number; celdas: Record<string, { porcentaje: number; total: number }> }[];
      resumen: { estudiantes: number; sinEmpezar: number };
    };

    const cabecera = datos.asignaciones.find((a) => a.id === tareaDePocos)!;
    expect(cabecera.alcance).toBe('estudiantes');
    expect(cabecera.actividades).toBe(1);
    expect(datos.asignaciones.find((a) => a.id === tareaDeTodos)!.actividades).toBe(20);

    const elegido = datos.filas.find((f) => f.id === elegidos[0]!.id)!;
    const resto = datos.filas.find((f) => !elegidos.some((e) => e.id === f.id))!;
    expect(elegido.celdas[String(tareaDePocos)]).toBeDefined();
    // Al que no se le asigno no le sale vacia: no le sale.
    expect(resto.celdas[String(tareaDePocos)]).toBeUndefined();
    expect(resto.celdas[String(tareaDeTodos)]).toBeDefined();
    // Todos tienen el mundo uno asignado, asi que todos cuentan.
    expect(datos.resumen.estudiantes).toBe(datos.filas.length);
    expect(datos.resumen.sinEmpezar).toBe(datos.filas.length);
  });

  it('el porcentaje sube con lo que el estudiante termina', async () => {
    const actividades = await app.prisma.activity.findMany({
      where: { mundo: { numero: 1 } },
      orderBy: { numeroEnMundo: 'asc' },
      select: { id: true },
      take: 20,
    });
    const quien = elegidos[0]!.id;

    // Cinco de las veinte terminadas, y una empezada sin terminar: las dos
    // senales que la matriz tiene que distinguir.
    await app.prisma.userActivityProgress.createMany({
      data: actividades.slice(0, 5).map((a) => ({
        usuarioId: quien,
        actividadId: a.id,
        completada: true,
        mejorEstrellas: 3,
        intentosTotales: 1,
      })),
      skipDuplicates: true,
    });
    await app.prisma.userActivityProgress.create({
      data: {
        usuarioId: elegidos[1]!.id,
        actividadId: actividades[0]!.id,
        completada: false,
        mejorEstrellas: 0,
        intentosTotales: 4,
      },
    });

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/seguimiento`,
      headers: como(docente.token),
    });
    const datos = respuesta.json() as {
      filas: {
        id: number;
        celdas: Record<string, { porcentaje: number; estrellas: number; empezada: boolean }>;
      }[];
      resumen: { iniciando: number; enProgreso: number; promedio: number };
    };

    const celda = datos.filas.find((f) => f.id === quien)!.celdas[String(tareaDeTodos)]!;
    expect(celda.porcentaje).toBe(25);
    expect(celda.estrellas).toBe(15);

    const empezada = datos.filas.find((f) => f.id === elegidos[1]!.id)!.celdas[
      String(tareaDeTodos)
    ]!;
    expect(empezada.porcentaje).toBe(0);
    expect(empezada.empezada).toBe(true);

    expect(datos.resumen.iniciando).toBe(1);
    expect(datos.resumen.enProgreso).toBe(1);
    expect(datos.resumen.promedio).toBeGreaterThan(0);
  });

  it('el seguimiento de un grupo ajeno no existe', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/docente/aulas/${aulaId}/seguimiento`,
      headers: como(ajeno.token),
    });

    expect(respuesta.statusCode).toBe(404);
  });
});

describe('el permiso para consultar el colegio', () => {
  it('un docente nuevo no lo tiene', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/docente/phidias/cursos',
      headers: como(docente.token),
    });

    expect(respuesta.statusCode).toBe(200);
    expect((respuesta.json() as { habilitado: boolean }).habilitado).toBe(false);
  });

  it('y sin el no puede buscar por codigo, ni siquiera saber si hay conexion', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/docente/phidias/buscar',
      headers: como(docente.token),
      payload: { codigos: ['1234567'] },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('ni importar', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/docente/aulas/${aulaId}/importar`,
      headers: como(docente.token),
      payload: { codigos: ['1234567'] },
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('cuando se lo dan, vale en el momento y con el mismo token', async () => {
    await app.prisma.user.update({
      where: { id: docente.id },
      data: { phidiasHabilitado: true },
    });

    // Con el MISMO token de antes: el permiso se lee de la base en cada
    // llamada, no del token, asi que no espera a que caduque la sesion.
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/docente/phidias/buscar',
      headers: como(docente.token),
      payload: { codigos: ['1234567'] },
    });

    // Se comprueba que ya NO es 403, y no que sea 200: lo que haya detrás es el
    // servidor del colegio, que en esta máquina puede estar configurado o no y
    // puede no responder. Atar la prueba a él la haría fallar por algo que no
    // es lo que se está probando.
    expect(respuesta.statusCode).not.toBe(403);
  });
});
