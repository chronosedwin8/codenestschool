/**
 * Panel de administracion: precios, facturas, cotizaciones y pagos manuales.
 *
 * Lo que se protege:
 *  - solo el administrador entra,
 *  - la numeracion no tiene huecos ni repetidos, aunque se emitan a la vez,
 *  - un pago se factura una sola vez, y anular libera el pago,
 *  - una cotizacion recorre su vida entera: borrador, enviada, pagada por
 *    enlace, licencia activada, y no se puede pagar un borrador ni una vencida.
 */
import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import type { PagoMercadoPago } from '../lib/mercadopago.js';

const SECRETO = 'secreto-admin-prueba';
const pagosMp = new Map<number, PagoMercadoPago>();
const expiradas: string[] = [];

vi.mock('../lib/mercadopago.js', async () => {
  const real = await vi.importActual<typeof import('../lib/mercadopago.js')>('../lib/mercadopago.js');
  let n = 0;
  return {
    ...real,
    crearPreferencia: vi.fn(async () => {
      n += 1;
      return { id: `pref-a${n}`, urlPago: `https://mp.test/checkout?pref_id=pref-a${n}` };
    }),
    obtenerPago: vi.fn(async (id: string | number) => {
      const p = pagosMp.get(Number(id));
      if (!p) throw new real.ErrorMercadoPago('no existe', 404);
      return p;
    }),
    buscarPagos: vi.fn(async (ref: string) => [...pagosMp.values()].filter((p) => p.externalReference === ref)),
    expirarPreferencia: vi.fn(async (id: string) => {
      expiradas.push(id);
    }),
  };
});

process.env.MP_ACCESS_TOKEN = 'token-falso-admin';
process.env.MP_PUBLIC_KEY = 'publica-falsa-admin';
process.env.MP_WEBHOOK_SECRET = SECRETO;

const { construirServidor } = await import('../server.js');
const { construirToken, hashPassword } = await import('../services/auth.service.js');

const marca = `a${Date.now().toString(36)}`;
let app: FastifyInstance;
let admin = { id: 0, auth: {} as Record<string, string> };
let tutor = { id: 0, auth: {} as Record<string, string> };
const usuarios: number[] = [];
const correosCreados: string[] = [];
let emisorPrevio: unknown = null;
let siguienteIdPago = 7_000_000 + Math.floor(Math.random() * 100_000);

async function crearUsuario(rol: 'admin' | 'tutor', nombre: string) {
  const email = `${nombre}.${marca}@prueba.local`;
  const u = await app.prisma.user.create({
    data: { usuario: email, email, nombre, rol, passwordHash: await hashPassword('clave-1234-prueba') },
  });
  usuarios.push(u.id);
  const token = app.jwt.sign(await construirToken(app.prisma, u.id));
  return { id: u.id, auth: { authorization: `Bearer ${token}` } };
}

const cliente = {
  nombre: `Colegio Prueba ${marca}`,
  tipoDocumento: 'NIT',
  documento: '900123456',
  email: `compras.${marca}@prueba.local`,
  ciudad: 'Medellín',
  contacto: 'Laura Gómez',
};

function hoyMas(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();
  admin = await crearUsuario('admin', 'admin');
  tutor = await crearUsuario('tutor', 'tutor');
  emisorPrevio = (await app.prisma.setting.findUnique({ where: { clave: 'emisor' } }))?.valor ?? null;
  await app.prisma.setting.deleteMany({ where: { clave: 'emisor' } });
});

afterAll(async () => {
  const creados = await app.prisma.user.findMany({ where: { email: { in: correosCreados } }, select: { id: true, institucionId: true } });
  const ids = [...usuarios, ...creados.map((u) => u.id)];
  const cotizaciones = await app.prisma.quote.findMany({
    where: { cliente: { path: ['nombre'], equals: cliente.nombre } },
    select: { id: true },
  });
  const cotIds = cotizaciones.map((c) => c.id);
  await app.prisma.invoice.deleteMany({ where: { OR: [{ creadoPorId: admin.id }, { cotizacionId: { in: cotIds } }] } });
  await app.prisma.payment.deleteMany({ where: { OR: [{ usuarioId: { in: ids } }, { cotizacionId: { in: cotIds } }] } });
  await app.prisma.quote.deleteMany({ where: { id: { in: cotIds } } });
  // Los grupos van antes que sus docentes: la clave foranea no deja al reves.
  await app.prisma.classroom.deleteMany({ where: { docenteId: { in: ids } } });
  await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app.prisma.institution.deleteMany({
    where: { id: { in: creados.map((u) => u.institucionId).filter((x): x is number => x !== null) } },
  });
  // Los colegios creados por el panel en esta ejecucion llevan la marca en el
  // nombre: se borran por ahi, que es lo unico que los distingue.
  await app.prisma.institution.deleteMany({ where: { nombre: { contains: marca } } });
  if (emisorPrevio) {
    await app.prisma.setting.upsert({
      where: { clave: 'emisor' },
      create: { clave: 'emisor', valor: emisorPrevio as object },
      update: { valor: emisorPrevio as object },
    });
  } else {
    await app.prisma.setting.deleteMany({ where: { clave: 'emisor' } });
  }
  await app.close();
});

describe('acceso', () => {
  it('un tutor no entra al panel, ni sin sesion', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/resumen', headers: tutor.auth })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/admin/resumen' })).statusCode).toBe(401);
  });

  it('el resumen dice que falta configurar y cual es la URL del aviso', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/admin/resumen', headers: admin.auth });
    const d = r.json() as { configuracion: { emisor: boolean; firmaWebhook: boolean; urlWebhook: string } };
    expect(d.configuracion.emisor).toBe(false);
    expect(d.configuracion.firmaWebhook).toBe(true);
    expect(d.configuracion.urlWebhook).toMatch(/\/api\/pagos\/webhook$/);
  });
});

describe('equipo', () => {
  let creadoId = 0;

  it('el administrador crea un profesor y recibe su contrasena una vez', async () => {
    const email = `profe.${marca}@colegio.local`;
    correosCreados.push(email);
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/equipo',
      headers: admin.auth,
      payload: { nombre: 'Marta Docente', email, rol: 'docente' },
    });
    expect(r.statusCode).toBe(201);
    const d = r.json() as { miembro: { id: number; rol: string }; passwordTemporal: string };
    creadoId = d.miembro.id;
    expect(d.miembro.rol).toBe('docente');
    expect(d.passwordTemporal.length).toBeGreaterThan(10);

    // Y con esa contrasena entra de verdad.
    const entra = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: d.passwordTemporal },
    });
    expect(entra.statusCode).toBe(200);

    // Que es lo que hacia falta: ya puede crear su grupo.
    const aula = await app.inject({
      method: 'POST',
      url: '/api/docente/aulas',
      headers: { authorization: `Bearer ${(entra.json() as { token: string }).token}` },
      payload: { nombre: `Grupo ${marca}`, grado: '5' },
    });
    expect(aula.statusCode).toBe(201);
  });

  it('no se crean dos cuentas con el mismo correo', async () => {
    const email = `repe.${marca}@colegio.local`;
    correosCreados.push(email);
    const cuerpo = { nombre: 'Repetida', email, rol: 'docente' };
    expect((await app.inject({ method: 'POST', url: '/api/admin/equipo', headers: admin.auth, payload: cuerpo })).statusCode).toBe(201);
    const otra = await app.inject({ method: 'POST', url: '/api/admin/equipo', headers: admin.auth, payload: cuerpo });
    expect(otra.statusCode).toBe(409);
  });

  it('un tutor no puede crear profesores', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/equipo',
      headers: tutor.auth,
      payload: { nombre: 'X', email: `cuela.${marca}@colegio.local`, rol: 'admin' },
    });
    expect(r.statusCode).toBe(403);
  });

  it('el administrador no puede desactivarse ni cambiarse el rol a si mismo', async () => {
    for (const cambio of [{ activo: false }, { rol: 'docente' }]) {
      const r = await app.inject({ method: 'PATCH', url: `/api/admin/equipo/${admin.id}`, headers: admin.auth, payload: cambio });
      expect(r.statusCode).toBe(409);
    }
  });

  it('nunca se queda la plataforma sin un administrador activo', async () => {
    // Se asciende al docente creado y se degrada: con dos admins ya se puede.
    const subir = await app.inject({ method: 'PATCH', url: `/api/admin/equipo/${creadoId}`, headers: admin.auth, payload: { rol: 'admin' } });
    expect(subir.statusCode).toBe(200);
    const bajar = await app.inject({ method: 'PATCH', url: `/api/admin/equipo/${creadoId}`, headers: admin.auth, payload: { rol: 'docente' } });
    expect(bajar.statusCode).toBe(200);
  });

  it('desactivar quita el acceso sin borrar nada', async () => {
    const apagar = await app.inject({ method: 'PATCH', url: `/api/admin/equipo/${creadoId}`, headers: admin.auth, payload: { activo: false } });
    expect(apagar.statusCode).toBe(200);
    const lista = (await app.inject({ method: 'GET', url: '/api/admin/equipo', headers: admin.auth })).json() as {
      miembros: { id: number; activo: boolean; aulas: number }[];
    };
    const suyo = lista.miembros.find((m) => m.id === creadoId)!;
    expect(suyo.activo).toBe(false);
    // Su grupo sigue existiendo.
    expect(suyo.aulas).toBe(1);
  });
});

describe('precios desde el panel', () => {
  it('cambiar una tarjeta se ve en el home; un precio imposible se rechaza', async () => {
    const plan = await app.prisma.plan.findUniqueOrThrow({ where: { clave: 'padres' } });
    const cuerpo = {
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      precioCop: 525_000,
      beneficios: plan.beneficios,
      destacado: plan.destacado,
      orden: plan.orden,
      activo: true,
      maxNinos: plan.maxNinos,
      vigenciaDias: plan.vigenciaDias,
    };
    try {
      const r = await app.inject({ method: 'PUT', url: `/api/admin/planes/${plan.id}`, headers: admin.auth, payload: cuerpo });
      expect(r.statusCode).toBe(200);
      const config = (await app.inject({ method: 'GET', url: '/api/pagos/config' })).json() as {
        planes: { clave: string; precioCop: number }[];
      };
      expect(config.planes.find((p) => p.clave === 'padres')?.precioCop).toBe(525_000);

      // Por debajo del minimo de Mercado Pago no hay medio que lo cobre.
      const malo = await app.inject({
        method: 'PUT',
        url: `/api/admin/planes/${plan.id}`,
        headers: admin.auth,
        payload: { ...cuerpo, precioCop: 500 },
      });
      expect(malo.statusCode).toBe(400);
    } finally {
      await app.prisma.plan.update({ where: { id: plan.id }, data: { precioCop: plan.precioCop } });
    }
  });
});

describe('facturas', () => {
  const lineas = [{ descripcion: 'Plan Escuela · licencia anual', cantidad: 1, valorUnitarioCop: 12_000_000 }];

  it('sin datos de la empresa no se emite nada', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/facturas',
      headers: admin.auth,
      payload: { cliente, items: lineas },
    });
    expect(r.statusCode).toBe(409);
  });

  it('con los datos de la empresa, cinco facturas a la vez salen seguidas y sin repetir', async () => {
    const emisor = {
      razonSocial: 'CodeNest School S.A.S.',
      nit: '901234567-8',
      direccion: 'Calle 1 # 2-3',
      ciudad: 'Bogotá',
      email: 'facturacion@codenestschool.com',
    };
    expect((await app.inject({ method: 'PUT', url: '/api/admin/emisor', headers: admin.auth, payload: emisor })).statusCode).toBe(200);

    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.inject({ method: 'POST', url: '/api/admin/facturas', headers: admin.auth, payload: { cliente, items: lineas, ivaPorcentaje: 19 } }),
      ),
    );
    for (const r of respuestas) expect(r.statusCode).toBe(201);
    const numeros = respuestas
      .map((r) => Number((r.json() as { factura: { numero: string } }).factura.numero.slice(4)))
      .sort((a, b) => a - b);
    expect(new Set(numeros).size).toBe(5);
    expect(numeros[4]! - numeros[0]!).toBe(4);

    // El total lo calcula el servidor: 12.000.000 + 19 % = 14.280.000.
    const f = await app.prisma.invoice.findFirstOrThrow({ where: { numero: numeros[0] } });
    expect(f.totalCop).toBe(14_280_000);
  });

  it('el enlace publico muestra la factura; un token inventado no muestra nada', async () => {
    const f = await app.prisma.invoice.findFirstOrThrow({ where: { creadoPorId: admin.id } });
    const r = await app.inject({ method: 'GET', url: `/api/documentos/factura/${f.tokenPublico}` });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { cliente: { nombre: string } }).cliente.nombre).toBe(cliente.nombre);
    expect(r.body).not.toContain('usuarioId');

    const falso = 'a'.repeat(64);
    expect((await app.inject({ method: 'GET', url: `/api/documentos/factura/${falso}` })).statusCode).toBe(404);
  });

  it('un pago se factura una vez; anular la factura lo libera', async () => {
    const pago = await app.inject({
      method: 'POST',
      url: '/api/admin/pagos/manual',
      headers: admin.auth,
      payload: { licenciaId: await licenciaPendienteDe(tutor.id), montoCop: 180_000, metodo: 'transferencia', referencia: 'TRF-001', fecha: hoyMas(0) },
    });
    expect(pago.statusCode).toBe(201);
    const { pagoId, licenciaActivada } = pago.json() as { pagoId: number; licenciaActivada: boolean };
    // Un pago manual activa la licencia igual que uno de Mercado Pago.
    expect(licenciaActivada).toBe(true);

    const { borrador } = (await app.inject({ method: 'GET', url: `/api/admin/pagos/${pagoId}/borrador-factura`, headers: admin.auth })).json() as {
      borrador: { cliente: Record<string, unknown> } & Record<string, unknown>;
    };
    // Este tutor nunca dio sus datos de facturacion: el borrador lo deja a la
    // vista (documento vacio) y la factura no sale hasta que se complete.
    expect(borrador.cliente.documento).toBe('');
    expect((await app.inject({ method: 'POST', url: '/api/admin/facturas', headers: admin.auth, payload: borrador })).statusCode).toBe(400);

    const completo = { ...borrador, cliente: { ...borrador.cliente, documento: '52123456' } };
    const facturar = () => app.inject({ method: 'POST', url: '/api/admin/facturas', headers: admin.auth, payload: completo });

    const primera = await facturar();
    expect(primera.statusCode).toBe(201);
    expect((await facturar()).statusCode).toBe(409);

    const id = (primera.json() as { factura: { id: number } }).factura.id;
    expect((await app.inject({ method: 'POST', url: `/api/admin/facturas/${id}/anular`, headers: admin.auth, payload: { motivo: 'NIT equivocado' } })).statusCode).toBe(200);
    expect((await facturar()).statusCode).toBe(201);

    // Y el cliente la ve en su portal.
    const portal = (await app.inject({ method: 'GET', url: '/api/portal/facturas', headers: tutor.auth })).json() as {
      facturas: { estado: string }[];
    };
    expect(portal.facturas.map((f) => f.estado).sort()).toEqual(['anulada', 'emitida']);
  });
});

async function licenciaPendienteDe(usuarioId: number): Promise<number> {
  const plan = await app.prisma.plan.findUniqueOrThrow({ where: { clave: 'personal' } });
  const l = await app.prisma.license.create({ data: { planId: plan.id, titularId: usuarioId, estado: 'pendiente' } });
  return l.id;
}

describe('cotizaciones', () => {
  function cuerpoCotizacion(validaHasta: string) {
    return {
      cliente,
      items: [
        { descripcion: 'Plan Escuela · licencia anual', cantidad: 1, valorUnitarioCop: 12_000_000 },
        { descripcion: 'Capacitación docente (4 horas)', cantidad: 1, valorUnitarioCop: 800_000 },
      ],
      descuentoCop: 800_000,
      validaHasta,
      planId: null as number | null,
    };
  }

  it('de borrador a licencia activa, pagando por el enlace', async () => {
    const plan = await app.prisma.plan.findUniqueOrThrow({ where: { clave: 'escuela' } });
    correosCreados.push(cliente.email);

    const creada = await app.inject({
      method: 'POST',
      url: '/api/admin/cotizaciones',
      headers: admin.auth,
      payload: { ...cuerpoCotizacion(hoyMas(30)), planId: plan.id },
    });
    expect(creada.statusCode).toBe(201);
    const c = (creada.json() as { cotizacion: { id: number; totalCop: number; enlacePublico: string } }).cotizacion;
    expect(c.totalCop).toBe(12_000_000);
    const token = c.enlacePublico.split('/').at(-1)!;

    // Un borrador se ve pero no se paga.
    const publica = (await app.inject({ method: 'GET', url: `/api/documentos/cotizacion/${token}` })).json() as { pagable: boolean };
    expect(publica.pagable).toBe(false);
    expect((await app.inject({ method: 'POST', url: `/api/documentos/cotizacion/${token}/pagar` })).statusCode).toBe(409);

    // Enviada: ya no se edita, y se puede pagar.
    await app.inject({ method: 'POST', url: `/api/admin/cotizaciones/${c.id}/estado`, headers: admin.auth, payload: { estado: 'enviada' } });
    const editar = await app.inject({ method: 'PUT', url: `/api/admin/cotizaciones/${c.id}`, headers: admin.auth, payload: cuerpoCotizacion(hoyMas(30)) });
    expect(editar.statusCode).toBe(409);

    const pagar = await app.inject({ method: 'POST', url: `/api/documentos/cotizacion/${token}/pagar` });
    expect(pagar.statusCode).toBe(200);

    // Mercado Pago avisa del pago de la cotizacion.
    siguienteIdPago += 1;
    pagosMp.set(siguienteIdPago, {
      id: siguienteIdPago, status: 'approved', statusDetail: 'accredited', transactionAmount: 12_000_000,
      currencyId: 'COP', paymentMethodId: 'pse', paymentTypeId: 'bank_transfer', installments: 1,
      externalReference: `cns-cot-${c.id}`, dateApproved: new Date().toISOString(), payerEmail: cliente.email,
    });
    const plantilla = `id:${siguienteIdPago};request-id:r;ts:1;`;
    const v1 = createHmac('sha256', SECRETO).update(plantilla).digest('hex');
    const aviso = await app.inject({
      method: 'POST',
      url: `/api/pagos/webhook?data.id=${siguienteIdPago}&type=payment`,
      headers: { 'x-signature': `ts=1,v1=${v1}`, 'x-request-id': 'r' },
      payload: { type: 'payment', data: { id: String(siguienteIdPago) } },
    });
    expect(aviso.statusCode).toBe(200);
    expect((await app.prisma.quote.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe('pagada');

    // Activar la licencia crea la cuenta del colegio, con contrasena temporal.
    const activar = await app.inject({ method: 'POST', url: `/api/admin/cotizaciones/${c.id}/activar-licencia`, headers: admin.auth });
    expect(activar.statusCode).toBe(200);
    const a = activar.json() as { cuentaNueva: { email: string; passwordTemporal: string }; licenciaId: number };
    expect(a.cuentaNueva.email).toBe(cliente.email);

    const entrar = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: cliente.email, password: a.cuentaNueva.passwordTemporal },
    });
    expect(entrar.statusCode).toBe(200);
    const l = await app.prisma.license.findUniqueOrThrow({ where: { id: a.licenciaId } });
    expect(l.estado).toBe('activa');

    // Dos veces no.
    expect((await app.inject({ method: 'POST', url: `/api/admin/cotizaciones/${c.id}/activar-licencia`, headers: admin.auth })).statusCode).toBe(409);
  });

  it('una vencida no se paga', async () => {
    const creada = await app.inject({ method: 'POST', url: '/api/admin/cotizaciones', headers: admin.auth, payload: cuerpoCotizacion(hoyMas(-2)) });
    const c = (creada.json() as { cotizacion: { id: number; estado: string; enlacePublico: string } }).cotizacion;
    await app.inject({ method: 'POST', url: `/api/admin/cotizaciones/${c.id}/estado`, headers: admin.auth, payload: { estado: 'enviada' } });
    const token = c.enlacePublico.split('/').at(-1)!;
    const publica = (await app.inject({ method: 'GET', url: `/api/documentos/cotizacion/${token}` })).json() as { estado: string; pagable: boolean };
    expect(publica.estado).toBe('vencida');
    expect(publica.pagable).toBe(false);
  });

  it('anular exige motivo y cierra la pagina de pago en Mercado Pago', async () => {
    const creada = await app.inject({ method: 'POST', url: '/api/admin/cotizaciones', headers: admin.auth, payload: cuerpoCotizacion(hoyMas(10)) });
    const c = (creada.json() as { cotizacion: { id: number } }).cotizacion;
    await app.inject({ method: 'POST', url: `/api/admin/cotizaciones/${c.id}/estado`, headers: admin.auth, payload: { estado: 'enviada' } });
    await app.inject({ method: 'POST', url: `/api/admin/cotizaciones/${c.id}/enlace-pago`, headers: admin.auth });

    const sinMotivo = await app.inject({ method: 'POST', url: `/api/admin/cotizaciones/${c.id}/estado`, headers: admin.auth, payload: { estado: 'anulada' } });
    expect(sinMotivo.statusCode).toBe(400);

    const antes = expiradas.length;
    const conMotivo = await app.inject({
      method: 'POST',
      url: `/api/admin/cotizaciones/${c.id}/estado`,
      headers: admin.auth,
      payload: { estado: 'anulada', motivo: 'El colegio pidió otro alcance' },
    });
    expect(conMotivo.statusCode).toBe(200);
    expect(expiradas.length).toBe(antes + 1);
  });
});

describe('colegios y planes', () => {
  let colegioId = 0;
  let docenteId = 0;

  it('el administrador crea un colegio y recibe su codigo de acceso', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/instituciones',
      headers: admin.auth,
      payload: {
        nombre: `Colegio Nuevo ${marca}`,
        nit: `9001${marca.slice(-5)}`,
        ciudad: 'Bogotá',
        maxEstudiantes: 500,
      },
    });

    expect(r.statusCode).toBe(201);
    const { colegio } = r.json() as {
      colegio: { id: number; codigoAcceso: string; maxEstudiantes: number };
    };
    colegioId = colegio.id;
    expect(colegio.codigoAcceso).toMatch(/^COL/);
    expect(colegio.maxEstudiantes).toBe(500);
  });

  it('el mismo NIT no entra dos veces', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/instituciones',
      headers: admin.auth,
      payload: { nombre: `Copia ${marca}`, nit: `9001${marca.slice(-5)}` },
    });

    expect(r.statusCode).toBe(409);
  });

  it('sale en la lista con lo que hay dentro', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/admin/instituciones', headers: admin.auth });
    const { instituciones } = r.json() as {
      instituciones: { id: number; estudiantes: number; adultos: number; grupos: number }[];
    };
    const mio = instituciones.find((i) => i.id === colegioId)!;
    expect(mio.estudiantes).toBe(0);
    expect(mio.grupos).toBe(0);
  });

  it('un tutor no crea colegios', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/instituciones',
      headers: tutor.auth,
      payload: { nombre: 'Colegio de nadie' },
    });

    expect(r.statusCode).toBe(403);
  });

  it('da un plan a un docente, y el docente lo ve como propio', async () => {
    const email = `conplan.${marca}@colegio.local`;
    correosCreados.push(email);
    const creado = await app.inject({
      method: 'POST',
      url: '/api/admin/equipo',
      headers: admin.auth,
      payload: { nombre: 'Docente Con Plan', email, rol: 'docente', institucionId: colegioId },
    });
    const d = creado.json() as { miembro: { id: number }; passwordTemporal: string };
    docenteId = d.miembro.id;

    const plan = await app.prisma.plan.findFirstOrThrow({ where: { activo: true } });
    const dado = await app.inject({
      method: 'POST',
      url: '/api/admin/licencias',
      headers: admin.auth,
      payload: { planId: plan.id, titularId: docenteId, dias: 30 },
    });

    expect(dado.statusCode).toBe(201);
    const { licencia } = dado.json() as {
      licencia: { licenciaId: number; finVigencia: string; codigoAcceso: string };
    };
    // Treinta dias y no los del plan: un piloto dura lo que dura.
    const dias = Math.round(
      (new Date(licencia.finVigencia).getTime() - Date.now()) / 86_400_000,
    );
    expect(dias).toBe(30);
    expect(licencia.codigoAcceso).toMatch(/^LIC/);

    // Y la ve en su portal, igual que si la hubiera comprado.
    const entra = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: d.passwordTemporal },
    });
    const suyo = await app.inject({
      method: 'GET',
      url: '/api/portal/suscripcion',
      headers: { authorization: `Bearer ${(entra.json() as { token: string }).token}` },
    });
    expect(suyo.statusCode).toBe(200);
    expect(JSON.stringify(suyo.json())).toContain(plan.nombre);
  });

  it('el plan sale en la lista del equipo y se puede retirar', async () => {
    const lista = await app.inject({ method: 'GET', url: '/api/admin/equipo', headers: admin.auth });
    const miembro = (
      lista.json() as {
        miembros: { id: number; licencias: { id: number; estado: string; pagada: boolean }[] }[];
      }
    ).miembros.find((m) => m.id === docenteId)!;

    expect(miembro.licencias[0]!.estado).toBe('activa');
    // No tiene pago: se puede retirar sin reembolsar nada.
    expect(miembro.licencias[0]!.pagada).toBe(false);

    const retirada = await app.inject({
      method: 'POST',
      url: `/api/admin/licencias/${miembro.licencias[0]!.id}/cancelar`,
      headers: admin.auth,
    });
    expect(retirada.statusCode).toBe(200);
  });

  it('un estudiante no puede ser titular de un plan', async () => {
    const nino = await app.prisma.user.create({
      data: { usuario: `nino.plan.${marca}`, nombre: 'Nino Prueba', rol: 'nino' },
    });
    usuarios.push(nino.id);
    const plan = await app.prisma.plan.findFirstOrThrow({ where: { activo: true } });

    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/licencias',
      headers: admin.auth,
      payload: { planId: plan.id, titularId: nino.id },
    });

    expect(r.statusCode).toBe(409);
  });

  it('el permiso de Phidias se enciende y se apaga desde la lista', async () => {
    const encendido = await app.inject({
      method: 'PATCH',
      url: `/api/admin/equipo/${docenteId}`,
      headers: admin.auth,
      payload: { phidiasHabilitado: true },
    });
    expect(encendido.statusCode).toBe(200);
    expect((encendido.json() as { miembro: { phidiasHabilitado: boolean } }).miembro.phidiasHabilitado).toBe(true);

    const apagado = await app.inject({
      method: 'PATCH',
      url: `/api/admin/equipo/${docenteId}`,
      headers: admin.auth,
      payload: { phidiasHabilitado: false },
    });
    expect((apagado.json() as { miembro: { phidiasHabilitado: boolean } }).miembro.phidiasHabilitado).toBe(false);
  });

  it('bajar el cupo por debajo de los que ya estan dentro se rechaza', async () => {
    const nino = await app.prisma.user.create({
      data: {
        usuario: `nino.cupo.${marca}`,
        nombre: 'Nino Matriculado',
        rol: 'nino',
        institucionId: colegioId,
      },
    });
    usuarios.push(nino.id);

    const r = await app.inject({
      method: 'PATCH',
      url: `/api/admin/instituciones/${colegioId}`,
      headers: admin.auth,
      payload: { maxEstudiantes: 0 },
    });

    // Cero no es un cupo valido; con uno de dentro, tampoco vale menos de uno.
    expect([400, 409]).toContain(r.statusCode);
  });
});
