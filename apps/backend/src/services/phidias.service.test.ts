/**
 * La lectura del sistema academico del colegio.
 *
 * Se prueba sin red, con la forma real de la respuesta de Phidias recortada a lo
 * imprescindible. Lo que se protege son las dos cosas que decidimos en el
 * recorte y que no se ven hasta que hay mil estudiantes en pantalla:
 *
 *  1. Que solo salga de aqui lo que el juego necesita. La respuesta real trae
 *     direccion, telefono, documento y hasta el hash de la contrasena de cada
 *     menor. Si eso se colara al resto de la aplicacion, acabaria en un registro
 *     o en una respuesta HTTP sin que nadie lo decidiera.
 *  2. Que el orden sea el de una lista de clase: por apellido, y en espanol, que
 *     no es lo mismo que en ASCII.
 */
import { describe, expect, it } from 'vitest';

import {
  ErrorPhidias,
  filtrarPorSeccion,
  matriculas,
  olvidarCachePhidias,
  phidiasConfigurado,
} from './phidias.service.js';

/** Un trozo de respuesta con la forma exacta que devuelve el colegio. */
const RESPUESTA = [
  {
    id: 17,
    name: 'KINDERGARTEN',
    courses: [
      {
        id: 79,
        name: 'KINDER',
        sections: [
          {
            id: 311,
            name: 'KIN1',
            students: [
              {
                id: 3720,
                firstname: 'HELENA LUCÍA',
                lastname: 'ALFONSO LOZADA',
                lastname1: 'ALFONSO',
                lastname2: 'LOZADA',
                email: '3720@colegioaleman.edu.co',
                birthday: 1620874800,
                // Todo lo que sigue NO debe salir de aqui.
                document: 1234567,
                address: 'CALLE FALSA 123',
                phone: 3000000,
                mobile: 573202002020,
                password: '556d3097e647a5f7f51f0b17edae37d1',
                observations: 'nota reservada del colegio',
              },
              {
                id: 3721,
                firstname: 'Santiago',
                lastname: 'Ñandú Perez',
                lastname1: 'Ñandú',
                lastname2: 'Perez',
                email: '',
                birthday: 1610000000,
              },
              {
                id: 3722,
                firstname: 'ALICIA',
                lastname: 'alcaraz villota',
                lastname1: 'alcaraz',
                lastname2: 'villota',
                email: null,
                birthday: 0,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 18,
    name: 'PRIMARIA',
    courses: [
      {
        id: 80,
        name: 'PRIMERO',
        sections: [
          {
            id: 401,
            name: 'P1',
            students: [
              {
                id: 4000,
                firstname: 'Bruno',
                lastname: 'Zapata Diaz',
                lastname1: 'Zapata',
                lastname2: 'Diaz',
                email: 'bruno@colegioaleman.edu.co',
                birthday: 1500000000,
              },
            ],
          },
        ],
      },
    ],
  },
];

/** Sustituye la red devolviendo la respuesta de arriba. */
function conRespuesta(cuerpo: unknown, estado = 200): void {
  olvidarCachePhidias();
  globalThis.fetch = (async () =>
    ({
      ok: estado >= 200 && estado < 300,
      status: estado,
      json: async () => cuerpo,
    }) as Response) as typeof fetch;
}

const CONFIG = { baseUrl: 'https://colegio.example/rest', token: 'x'.repeat(40) };

describe('configuracion', () => {
  it('sin token, la importacion no esta disponible', () => {
    expect(phidiasConfigurado({ baseUrl: CONFIG.baseUrl, token: undefined })).toBe(false);
    expect(phidiasConfigurado(CONFIG)).toBe(true);
  });

  it('pedir matriculas sin configurar avisa en vez de reventar', async () => {
    await expect(matriculas({ baseUrl: undefined, token: undefined })).rejects.toBeInstanceOf(
      ErrorPhidias,
    );
  });
});

describe('lo que sale del colegio', () => {
  it('solo trae lo que el juego necesita', async () => {
    conRespuesta(RESPUESTA);
    const { estudiantes } = await matriculas(CONFIG);

    const helena = estudiantes.find((e) => e.id === 3720)!;
    expect(helena.nombre).toBe('HELENA LUCÍA');
    expect(helena.apellidos).toBe('ALFONSO LOZADA');
    expect(helena.fechaNacimiento).toBe('2021-05-13');
    expect(helena.curso).toBe('KINDER');
    expect(helena.seccion).toBe('KIN1');

    // Lo importante es lo que NO esta: son datos de un menor que este juego no
    // usa para nada, y lo que no se copia no se puede filtrar despues.
    const campos = Object.keys(helena);
    for (const prohibido of ['document', 'address', 'phone', 'mobile', 'password', 'observations']) {
      expect(campos).not.toContain(prohibido);
    }
  });

  it('ordena por apellido como una lista de clase, en espanol', async () => {
    conRespuesta(RESPUESTA);
    const { estudiantes } = await matriculas(CONFIG);

    // "alcaraz" en minusculas va primero, y la enie de "Ñandú" va entre N y O,
    // no al final como haria una comparacion por codigo de caracter.
    expect(estudiantes.map((e) => e.apellidos)).toEqual([
      'alcaraz villota',
      'ALFONSO LOZADA',
      'Ñandú Perez',
      'Zapata Diaz',
    ]);
  });

  it('deja el correo en null cuando no lo hay', async () => {
    conRespuesta(RESPUESTA);
    const { estudiantes } = await matriculas(CONFIG);

    expect(estudiantes.find((e) => e.id === 3721)?.email).toBeNull();
    expect(estudiantes.find((e) => e.id === 3722)?.email).toBeNull();
    expect(estudiantes.find((e) => e.id === 4000)?.email).toBe('bruno@colegioaleman.edu.co');
  });

  it('sin fecha de nacimiento la deja en null en lugar de inventarla', async () => {
    conRespuesta(RESPUESTA);
    const { estudiantes } = await matriculas(CONFIG);

    // De la fecha depende con que editor juega el nino: adivinarla seria poner a
    // escribir codigo a uno de cinco anos. La importacion lo omite mas adelante.
    expect(estudiantes.find((e) => e.id === 3722)?.fechaNacimiento).toBeNull();
  });

  it('resume las secciones con cuantos matriculados tiene cada una', async () => {
    conRespuesta(RESPUESTA);
    const { secciones } = await matriculas(CONFIG);

    expect(secciones).toHaveLength(2);
    expect(secciones.find((s) => s.id === 311)).toMatchObject({
      nombre: 'KIN1',
      curso: 'KINDER',
      nivel: 'KINDERGARTEN',
      estudiantes: 3,
    });
  });

  it('filtra por seccion conservando el orden', async () => {
    conRespuesta(RESPUESTA);
    const { estudiantes } = await matriculas(CONFIG);

    const soloKin1 = filtrarPorSeccion(estudiantes, [311]);
    expect(soloKin1.map((e) => e.id)).toEqual([3722, 3720, 3721]);
    expect(filtrarPorSeccion(estudiantes, [999])).toHaveLength(0);
  });
});

describe('cuando el colegio no responde bien', () => {
  it('distingue un token caducado de una averia', async () => {
    conRespuesta({}, 401);
    await expect(matriculas(CONFIG)).rejects.toThrow(/token/i);
  });

  it('no acepta una respuesta que no sea la lista de matriculas', async () => {
    conRespuesta({ mensaje: 'otra cosa' });
    await expect(matriculas(CONFIG)).rejects.toThrow(/matriculas/i);
  });

  it('un fallo de red se distingue de un rechazo de permisos', async () => {
    olvidarCachePhidias();
    globalThis.fetch = (async () => {
      throw new Error('socket hang up');
    }) as typeof fetch;

    await expect(matriculas(CONFIG)).rejects.toThrow(/no se pudo hablar/i);
  });
});
