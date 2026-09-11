/**
 * La tienda, probada por donde se rompe sin avisar.
 *
 * Tres cosas:
 *
 *  1. Que no se pueda gastar lo que no se tiene, ni dos veces lo mismo. Una
 *     tienda que deja el saldo en negativo regala estrellas, y las estrellas son
 *     lo unico que el nino gano jugando.
 *  2. Que no se pueda equipar lo que no se compro. La interfaz solo ofrece lo
 *     comprado, pero esconder un boton no cierra una ruta.
 *  3. Que la tienda sea del nino. Un docente no compra gorros con las estrellas
 *     de nadie, igual que no juega las actividades.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { construirServidor } from '../server.js';

const marca = `t${Date.now().toString(36)}`;
const PASSWORD = 'clave-de-prueba-1234';
const PIN = ['gato', 'sol', 'luna', 'flor'];

let app: FastifyInstance;
let docente = { id: 0, token: '' };
let nino = { id: 0, usuario: '', token: '' };
const creados: number[] = [];

const como = (token: string) => ({ authorization: `Bearer ${token}` });

/** Un articulo cualquiera de la tienda, por su clave. */
async function articulo(clave: string): Promise<{
  costoEstrellas: number;
  tengo: boolean;
  equipado: boolean;
  puedoComprar: boolean;
  motivo: string | null;
}> {
  const respuesta = await app.inject({ method: 'GET', url: '/api/tienda', headers: como(nino.token) });
  const vista = respuesta.json() as { articulos: { clave: string }[] };
  const encontrado = vista.articulos.find((a) => a.clave === clave);
  if (!encontrado) throw new Error(`la tienda no trae ${clave}`);
  return encontrado as never;
}

async function saldo(): Promise<number> {
  const respuesta = await app.inject({ method: 'GET', url: '/api/tienda', headers: como(nino.token) });
  return (respuesta.json() as { estrellasDisponibles: number }).estrellasDisponibles;
}

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();

  const alta = await app.inject({
    method: 'POST',
    url: '/api/auth/registro',
    payload: {
      nombre: 'Docente Tienda',
      email: `docente.tienda.${marca}@prueba.local`,
      password: PASSWORD,
      rol: 'docente',
    },
  });
  const datosDocente = alta.json() as { token: string; usuario: { id: number } };
  docente = { id: datosDocente.usuario.id, token: datosDocente.token };
  creados.push(docente.id);

  const aula = await app.inject({
    method: 'POST',
    url: '/api/docente/aulas',
    headers: como(docente.token),
    payload: { nombre: `Tienda ${marca}`, grado: '2' },
  });
  const aulaId = (aula.json() as { aula: { id: number } }).aula.id;

  const estudiantes = await app.inject({
    method: 'POST',
    url: `/api/docente/aulas/${aulaId}/estudiantes`,
    headers: como(docente.token),
    payload: {
      estudiantes: [{ nombre: `Nino Tienda ${marca}`, fechaNacimiento: '2018-04-10' }],
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
  nino = {
    id: creado.id,
    usuario: creado.usuario,
    token: (acceso.json() as { token: string }).token,
  };

  // Estrellas de regalo para poder comprar: en el juego las da el servidor al
  // resolver actividades, y aqui lo que se prueba es la tienda, no la puntuacion.
  await app.prisma.user.update({
    where: { id: nino.id },
    data: { estrellasTotales: 40, estrellasDisponibles: 40 },
  });
}, 120_000);

afterAll(async () => {
  const suyos = await app.prisma.guardianLink.findMany({
    where: { tutorId: { in: creados } },
    select: { ninoId: true },
  });
  const ninos = suyos.map((g) => g.ninoId);
  await app.prisma.userInventory.deleteMany({ where: { usuarioId: { in: ninos } } });
  await app.prisma.user.deleteMany({ where: { id: { in: ninos } } });
  await app.prisma.classroom.deleteMany({ where: { docenteId: { in: creados } } });
  await app.prisma.user.deleteMany({ where: { id: { in: creados } } });
  await app.close();
});

describe('el nino en la tienda', () => {
  it('ve el catalogo con lo que puede y lo que no', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/tienda',
      headers: como(nino.token),
    });
    expect(respuesta.statusCode).toBe(200);

    const vista = respuesta.json() as {
      estrellasDisponibles: number;
      colorFuzz: string;
      articulos: { clave: string; puedoComprar: boolean; motivo: string | null }[];
    };
    expect(vista.estrellasDisponibles).toBe(40);
    // Sin nada comprado, el Fuzz va del color de fabrica.
    expect(vista.colorFuzz).toBe('#1FA2FF');
    expect(vista.articulos.length).toBeGreaterThan(20);

    // La corona pide diez mundos terminados: se ve, pero se dice por que no.
    const corona = vista.articulos.find((a) => a.clave === 'gorro-corona')!;
    expect(corona.puedoComprar).toBe(false);
    expect(corona.motivo).toContain('10 mundos');
  });

  it('compra un color, lo estrena solo y paga el precio', async () => {
    const antes = await saldo();
    const color = await articulo('color-verde');

    const compra = await app.inject({
      method: 'POST',
      url: '/api/tienda/comprar',
      headers: como(nino.token),
      payload: { clave: 'color-verde' },
    });
    expect(compra.statusCode).toBe(200);

    const despues = await app.inject({
      method: 'GET',
      url: '/api/tienda',
      headers: como(nino.token),
    });
    const vista = despues.json() as {
      estrellasDisponibles: number;
      estrellasTotales: number;
      colorFuzz: string;
    };
    expect(vista.estrellasDisponibles).toBe(antes - color.costoEstrellas);
    // Lo ganado no baja al gastar: son dos numeros distintos a proposito.
    expect(vista.estrellasTotales).toBe(40);
    // Y se pone solo, sin un segundo toque.
    expect(vista.colorFuzz).toBe('#5AD35A');
  });

  it('no cobra dos veces el mismo cosmetico', async () => {
    const antes = await saldo();
    const otra = await app.inject({
      method: 'POST',
      url: '/api/tienda/comprar',
      headers: como(nino.token),
      payload: { clave: 'color-verde' },
    });
    expect(otra.statusCode).toBe(409);
    expect(await saldo()).toBe(antes);
  });

  it('no deja el saldo en negativo', async () => {
    await app.prisma.user.update({
      where: { id: nino.id },
      data: { estrellasDisponibles: 2 },
    });

    const caro = await app.inject({
      method: 'POST',
      url: '/api/tienda/comprar',
      headers: como(nino.token),
      payload: { clave: 'gorro-mago' },
    });
    expect(caro.statusCode).toBe(409);
    expect(await saldo()).toBe(2);

    await app.prisma.user.update({
      where: { id: nino.id },
      data: { estrellasDisponibles: 40 },
    });
  });

  it('no se puede poner lo que no compro', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/tienda/equipar',
      headers: como(nino.token),
      payload: { tipo: 'sombrero', clave: 'gorro-mago' },
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('se quita lo puesto sin perderlo', async () => {
    const quitar = await app.inject({
      method: 'POST',
      url: '/api/tienda/equipar',
      headers: como(nino.token),
      payload: { tipo: 'color', clave: null },
    });
    expect(quitar.statusCode).toBe(200);

    const vista = await app.inject({ method: 'GET', url: '/api/tienda', headers: como(nino.token) });
    const datos = vista.json() as { colorFuzz: string; articulos: { clave: string; tengo: boolean }[] };
    expect(datos.colorFuzz).toBe('#1FA2FF');
    expect(datos.articulos.find((a) => a.clave === 'color-verde')!.tengo).toBe(true);
  });

  it('las pociones se acumulan y se gastan de una en una', async () => {
    for (let i = 0; i < 2; i++) {
      const compra = await app.inject({
        method: 'POST',
        url: '/api/tienda/comprar',
        headers: como(nino.token),
        payload: { clave: 'pocion-gigante' },
      });
      expect(compra.statusCode).toBe(200);
    }
    expect((await articulo('pocion-gigante')).tengo).toBe(true);

    const uso = await app.inject({
      method: 'POST',
      url: '/api/tienda/usar',
      headers: como(nino.token),
      payload: { clave: 'pocion-gigante' },
    });
    expect(uso.statusCode).toBe(200);
    expect((uso.json() as { quedan: number }).quedan).toBe(1);

    // Y queda activa para la actividad que juegue ahora.
    const vista = await app.inject({ method: 'GET', url: '/api/tienda', headers: como(nino.token) });
    expect((vista.json() as { efectos: { pocion: string | null } }).efectos.pocion).toBe('gigante');
  });

  it('un poder se enciende y se apaga cuando quiere', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/tienda/comprar',
      headers: como(nino.token),
      payload: { clave: 'poder-camara-lenta' },
    });
    // Comprado queda encendido: es lo que el nino espera al pagarlo.
    expect((await articulo('poder-camara-lenta')).equipado).toBe(true);

    await app.inject({
      method: 'POST',
      url: '/api/tienda/poder',
      headers: como(nino.token),
      payload: { clave: 'poder-camara-lenta', encendido: false },
    });
    expect((await articulo('poder-camara-lenta')).equipado).toBe(false);

    const vista = await app.inject({ method: 'GET', url: '/api/tienda', headers: como(nino.token) });
    expect((vista.json() as { efectos: { poderes: string[] } }).efectos.poderes).toEqual([]);
  });

  it('no se puede encender un poder sin comprarlo', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/tienda/poder',
      headers: como(nino.token),
      payload: { clave: 'poder-huellas', encendido: true },
    });
    expect(respuesta.statusCode).toBe(403);
  });
});

describe('la tienda no es de los adultos', () => {
  it('el docente no la puede abrir', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/tienda',
      headers: como(docente.token),
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('el docente no puede comprar', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/tienda/comprar',
      headers: como(docente.token),
      payload: { clave: 'color-rosa' },
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('sin sesion no hay tienda', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/tienda' });
    expect(respuesta.statusCode).toBe(401);
  });
});
