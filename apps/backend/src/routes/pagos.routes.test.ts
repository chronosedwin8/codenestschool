/**
 * Pruebas de la compra, el pago y la renovacion de licencias.
 *
 * Lo que se protege aqui es dinero de clientes reales:
 *  - el precio lo pone el servidor, leyendo la base (y cambia si el
 *    administrador lo cambia),
 *  - quien no termino de pagar no queda bloqueado,
 *  - el mismo pago aplicado dos veces, o dos avisos a la vez, activan UNA vez,
 *  - una renovacion empieza cuando acaba la anterior,
 *  - un aviso con firma falsa se rechaza, y sin firma no puede inventar un pago.
 *
 * Mercado Pago se sustituye por un doble: cobrar de verdad en una prueba no es
 * una opcion. El token de acceso se fija a un valor falso para que, si algo se
 * escapara del doble, fallara en vez de hablar con la cuenta real.
 */
import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import type { PagoMercadoPago } from '../lib/mercadopago.js';

const SECRETO_WEBHOOK = 'secreto-de-prueba-webhook';

/** Pagos que "existen" en el Mercado Pago simulado, por identificador. */
const pagosMp = new Map<number, PagoMercadoPago>();
/** Preferencias pedidas, para comprobar monto y referencia. */
const preferencias: { montoCop: number; referenciaExterna: string }[] = [];
let preferenciaFalla = false;

vi.mock('../lib/mercadopago.js', async () => {
  const real = await vi.importActual<typeof import('../lib/mercadopago.js')>('../lib/mercadopago.js');
  return {
    ...real,
    crearPreferencia: vi.fn(async (d: { montoCop: number; referenciaExterna: string }) => {
      if (preferenciaFalla) throw new real.ErrorMercadoPago('caido', 500);
      preferencias.push({ montoCop: d.montoCop, referenciaExterna: d.referenciaExterna });
      return { id: `pref-${preferencias.length}`, urlPago: `https://mp.test/checkout?pref_id=pref-${preferencias.length}` };
    }),
    obtenerPago: vi.fn(async (id: string | number) => {
      const pago = pagosMp.get(Number(id));
      if (!pago) throw new real.ErrorMercadoPago('no existe', 404);
      return pago;
    }),
    buscarPagos: vi.fn(async (referencia: string) =>
      [...pagosMp.values()].filter((p) => p.externalReference === referencia).reverse(),
    ),
    expirarPreferencia: vi.fn(async () => undefined),
  };
});

// Antes de importar el servidor: la configuracion se lee una vez.
process.env.MP_ACCESS_TOKEN = 'token-falso-de-prueba';
process.env.MP_PUBLIC_KEY = 'clave-publica-falsa';
process.env.MP_WEBHOOK_SECRET = SECRETO_WEBHOOK;

const { construirServidor } = await import('../server.js');

const marca = `p${Date.now().toString(36)}`;
let app: FastifyInstance;
const correos: string[] = [];
let siguientePago = 9_000_000 + Math.floor(Math.random() * 100_000);

function pagoMp(referencia: string, status: string, extra: Partial<PagoMercadoPago> = {}): PagoMercadoPago {
  siguientePago += 1;
  const pago: PagoMercadoPago = {
    id: siguientePago,
    status,
    statusDetail: status === 'approved' ? 'accredited' : status === 'rejected' ? 'cc_rejected_high_risk' : 'pending_waiting_transfer',
    transactionAmount: 180_000,
    currencyId: 'COP',
    paymentMethodId: status === 'pending' ? 'pse' : 'visa',
    paymentTypeId: status === 'pending' ? 'bank_transfer' : 'credit_card',
    installments: 1,
    externalReference: referencia,
    dateApproved: status === 'approved' ? new Date().toISOString() : null,
    payerEmail: null,
    ...extra,
  };
  pagosMp.set(pago.id, pago);
  return pago;
}

let ip = 0;
function desdeOtraIp() {
  ip += 1;
  return `10.9.${Math.floor(ip / 250)}.${ip % 250}`;
}

function cuerpoCompra(email: string, plan: 'personal' | 'padres' | 'escuela' = 'personal') {
  return {
    plan,
    cuenta: { nombre: 'Ana María Pérez', email, password: 'clave-de-prueba-1234' },
    facturacion: { tipoDocumento: 'CC', documento: '1020304050', ciudad: 'Bogotá' },
    ...(plan === 'escuela' ? { institucion: { nombre: `Colegio ${marca}` } } : {}),
    aceptaTerminos: true,
  };
}

async function comprar(email: string, plan: 'personal' | 'padres' | 'escuela' = 'personal') {
  correos.push(email);
  return app.inject({
    method: 'POST',
    url: '/api/pagos/comprar',
    payload: cuerpoCompra(email, plan),
    remoteAddress: desdeOtraIp(),
  });
}

/** Firma un aviso como lo firma Mercado Pago. */
function firmar(idPago: number, idSolicitud = 'req-1', ts = '1704908010') {
  const plantilla = `id:${idPago};request-id:${idSolicitud};ts:${ts};`;
  const v1 = createHmac('sha256', SECRETO_WEBHOOK).update(plantilla).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': idSolicitud };
}

async function avisar(idPago: number, firmado = true) {
  return app.inject({
    method: 'POST',
    url: `/api/pagos/webhook?data.id=${idPago}&type=payment`,
    headers: firmado ? firmar(idPago) : {},
    payload: { type: 'payment', action: 'payment.updated', data: { id: String(idPago) } },
  });
}

beforeAll(async () => {
  app = await construirServidor();
  await app.ready();
});

afterAll(async () => {
  const usuarios = await app.prisma.user.findMany({
    where: { email: { in: correos } },
    select: { id: true, institucionId: true },
  });
  const ids = usuarios.map((u) => u.id);
  // Los pagos sobreviven a la licencia a proposito; en la prueba se limpian a mano.
  await app.prisma.payment.deleteMany({ where: { usuarioId: { in: ids } } });
  await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
  const instituciones = usuarios.map((u) => u.institucionId).filter((x): x is number => x !== null);
  await app.prisma.institution.deleteMany({ where: { id: { in: instituciones } } });
  await app.close();
});

beforeEach(() => {
  preferenciaFalla = false;
});

describe('precios', () => {
  it('salen de la base, y un cambio se cobra desde ese momento', async () => {
    const plan = await app.prisma.plan.findUniqueOrThrow({ where: { clave: 'personal' } });
    const original = plan.precioCop;
    try {
      await app.prisma.plan.update({ where: { id: plan.id }, data: { precioCop: 199_000 } });

      const config = (await app.inject({ method: 'GET', url: '/api/pagos/config' })).json() as {
        planes: { clave: string; precioCop: number }[];
      };
      expect(config.planes.find((p) => p.clave === 'personal')?.precioCop).toBe(199_000);

      const r = await comprar(`precio.${marca}@prueba.local`);
      expect(r.statusCode).toBe(201);
      expect(preferencias.at(-1)?.montoCop).toBe(199_000);
    } finally {
      await app.prisma.plan.update({ where: { id: plan.id }, data: { precioCop: original } });
    }
  });

  it('no expone el token de la pasarela', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/pagos/config' });
    expect(r.body).not.toContain('token-falso-de-prueba');
    expect(r.body).not.toContain('clave-publica-falsa');
  });

  it('el home trae el precio real dentro del JSON-LD, no una marca sin sustituir', async () => {
    const r = await app.inject({ method: 'GET', url: '/planes.html' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.body).not.toContain('{{precio:');
    expect(r.body).toContain('"highPrice": "12000000"');
  });
});

describe('compra', () => {
  it('crea cuenta, datos de facturacion y licencia pendiente, y devuelve la pagina de pago', async () => {
    const email = `compra.${marca}@prueba.local`;
    const r = await comprar(email, 'escuela');
    expect(r.statusCode).toBe(201);

    const datos = r.json() as { urlPago: string; token: string; licenciaId: number };
    expect(datos.urlPago).toMatch(/^https:\/\//);
    expect(datos.token.length).toBeGreaterThan(20);
    expect(preferencias.at(-1)).toEqual({ montoCop: 12_000_000, referenciaExterna: `cns-lic-${datos.licenciaId}` });

    const usuario = await app.prisma.user.findUniqueOrThrow({
      where: { email },
      include: { perfilFacturacion: true, licencias: true, institucion: true },
    });
    expect(usuario.rol).toBe('admin_escuela');
    expect(usuario.perfilFacturacion?.nitCedula).toBe('1020304050');
    expect(usuario.licencias[0]?.estado).toBe('pendiente');
    expect(usuario.institucion?.nombre).toContain('Colegio');
  });

  it('si Mercado Pago no responde, deshace el alta y el correo sigue libre', async () => {
    const email = `caido.${marca}@prueba.local`;
    preferenciaFalla = true;
    const r = await comprar(email);
    expect(r.statusCode).toBe(502);
    expect(await app.prisma.user.findUnique({ where: { email } })).toBeNull();

    preferenciaFalla = false;
    expect((await comprar(email)).statusCode).toBe(201);
  });

  it('un correo que ya tiene cuenta no queda bloqueado: se le manda al portal', async () => {
    const email = `repetido.${marca}@prueba.local`;
    await comprar(email);
    const r = await comprar(email);
    expect(r.statusCode).toBe(409);
    expect((r.json() as { portal: string }).portal).toBe('/app/portal');
  });

  it('sin aceptar los terminos no hay compra', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/pagos/comprar',
      payload: { ...cuerpoCompra(`terminos.${marca}@prueba.local`), aceptaTerminos: false },
      remoteAddress: desdeOtraIp(),
    });
    expect(r.statusCode).toBe(400);
  });

  it('la ruta publica que regalaba codigos de acceso ya no existe', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/pagos/licencia/1' });
    expect(r.statusCode).toBe(404);
  });
});

describe('el aviso de pago', () => {
  async function compraPendiente(nombre: string) {
    const r = await comprar(`${nombre}.${marca}@prueba.local`);
    return r.json() as { licenciaId: number; token: string };
  }

  it('un pago aprobado activa la licencia por un ano', async () => {
    const { licenciaId } = await compraPendiente('aprobado');
    const pago = pagoMp(`cns-lic-${licenciaId}`, 'approved');

    expect((await avisar(pago.id)).statusCode).toBe(200);

    const l = await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } });
    expect(l.estado).toBe('activa');
    const dias = (l.finVigencia!.getTime() - l.inicioVigencia!.getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(365);

    const fila = await app.prisma.payment.findUniqueOrThrow({ where: { mpPaymentId: String(pago.id) } });
    expect(fila.estado).toBe('aprobado');
    expect(fila.usuarioId).not.toBeNull();
  });

  it('el mismo aviso tres veces, dos de ellas a la vez, activa una sola vez', async () => {
    const { licenciaId } = await compraPendiente('repetido-aviso');
    const pago = pagoMp(`cns-lic-${licenciaId}`, 'approved');

    await Promise.all([avisar(pago.id), avisar(pago.id)]);
    const tras1 = await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } });
    await avisar(pago.id);
    const tras2 = await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } });

    // Si se hubiera activado dos veces, la vigencia se habria movido.
    expect(tras2.finVigencia?.getTime()).toBe(tras1.finVigencia?.getTime());
    expect(await app.prisma.payment.count({ where: { mpPaymentId: String(pago.id) } })).toBe(1);
  });

  it('PSE pendiente deja la licencia esperando; al aprobarse, se activa', async () => {
    const { licenciaId } = await compraPendiente('pse');
    const pago = pagoMp(`cns-lic-${licenciaId}`, 'pending');
    await avisar(pago.id);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('pendiente');

    pagosMp.set(pago.id, { ...pago, status: 'approved', statusDetail: 'accredited', dateApproved: new Date().toISOString() });
    await avisar(pago.id);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('activa');
  });

  it('una tarjeta rechazada no cancela la compra: el segundo intento la activa', async () => {
    const { licenciaId } = await compraPendiente('reintento');
    await avisar(pagoMp(`cns-lic-${licenciaId}`, 'rejected').id);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('pendiente');

    await avisar(pagoMp(`cns-lic-${licenciaId}`, 'approved').id);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('activa');
  });

  it('un reembolso quita el acceso que ese dinero compro', async () => {
    const { licenciaId } = await compraPendiente('reembolso');
    const pago = pagoMp(`cns-lic-${licenciaId}`, 'approved');
    await avisar(pago.id);
    pagosMp.set(pago.id, { ...pago, status: 'refunded', statusDetail: 'refunded' });
    await avisar(pago.id);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('cancelada');
  });

  it('con firma falsa se rechaza', async () => {
    const { licenciaId } = await compraPendiente('firma-falsa');
    const pago = pagoMp(`cns-lic-${licenciaId}`, 'approved');
    const r = await app.inject({
      method: 'POST',
      url: `/api/pagos/webhook?data.id=${pago.id}&type=payment`,
      headers: { 'x-signature': 'ts=1704908010,v1=deadbeef', 'x-request-id': 'req-1' },
      payload: { type: 'payment', data: { id: String(pago.id) } },
    });
    expect(r.statusCode).toBe(401);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('pendiente');
  });

  it('sin firma, un aviso no puede inventarse un pago: el estado se pide a Mercado Pago', async () => {
    const { licenciaId } = await compraPendiente('inventado');
    // Un pago que Mercado Pago no conoce: el aviso miente.
    const r = await avisar(123_456_789, false);
    expect(r.statusCode).toBe(200);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('pendiente');
  });

  it('la cuenta es compartida: un pago de otro negocio no toca nuestras licencias', async () => {
    // La cuenta de Mercado Pago cobra tambien Untis, UntiCloud y Veyon. Sus
    // pagos llegan al mismo aviso. Ni un numero suelto ni un "lic-N" sin
    // nuestro prefijo pueden activar una licencia de CodeNest.
    const { licenciaId } = await compraPendiente('ajeno');
    for (const referencia of [String(licenciaId), `lic-${licenciaId}`, 'UC-UNTIS-2027', 'INV-1']) {
      const r = await avisar(pagoMp(referencia, 'approved').id);
      expect(r.statusCode).toBe(200);
    }
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('pendiente');
  });

  it('entiende tambien el formato IPN antiguo', async () => {
    const { licenciaId } = await compraPendiente('ipn');
    const pago = pagoMp(`cns-lic-${licenciaId}`, 'approved');
    const r = await app.inject({ method: 'POST', url: `/api/pagos/webhook?topic=payment&id=${pago.id}` });
    expect(r.statusCode).toBe(200);
    expect((await app.prisma.license.findUniqueOrThrow({ where: { id: licenciaId } })).estado).toBe('activa');
  });
});

describe('desde el portal', () => {
  it('quien no termino de pagar paga desde el portal, sin crear otra licencia', async () => {
    const r = await comprar(`sin-terminar.${marca}@prueba.local`);
    const { licenciaId, token } = r.json() as { licenciaId: number; token: string };

    const pagar = await app.inject({
      method: 'POST',
      url: '/api/pagos/pagar',
      headers: { authorization: `Bearer ${token}` },
      payload: { licenciaId },
      remoteAddress: desdeOtraIp(),
    });
    expect(pagar.statusCode).toBe(200);
    expect((pagar.json() as { licenciaId: number }).licenciaId).toBe(licenciaId);
    expect(preferencias.at(-1)?.referenciaExterna).toBe(`cns-lic-${licenciaId}`);
  });

  it('al volver de Mercado Pago se concilia aunque el aviso no haya llegado', async () => {
    const r = await comprar(`sin-aviso.${marca}@prueba.local`);
    const { licenciaId, token } = r.json() as { licenciaId: number; token: string };
    pagoMp(`cns-lic-${licenciaId}`, 'approved'); // pagado, pero nadie avisa

    const v = await app.inject({
      method: 'POST',
      url: '/api/pagos/verificar',
      headers: { authorization: `Bearer ${token}` },
      payload: { licenciaId },
      remoteAddress: desdeOtraIp(),
    });
    expect(v.statusCode).toBe(200);
    expect((v.json() as { estado: string }).estado).toBe('activa');
  });

  it('no se puede pagar ni consultar la licencia de otro', async () => {
    const a = (await comprar(`duena.${marca}@prueba.local`)).json() as { licenciaId: number };
    const b = (await comprar(`intrusa.${marca}@prueba.local`)).json() as { token: string };
    for (const url of ['/api/pagos/pagar', '/api/pagos/verificar']) {
      const r = await app.inject({
        method: 'POST',
        url,
        headers: { authorization: `Bearer ${b.token}` },
        payload: { licenciaId: a.licenciaId },
        remoteAddress: desdeOtraIp(),
      });
      expect(r.statusCode).toBe(403);
    }
  });
});

describe('renovacion', () => {
  it('empieza cuando acaba la anterior, que sigue siendo la vigente', async () => {
    const r = await comprar(`renueva.${marca}@prueba.local`);
    const { licenciaId, token } = r.json() as { licenciaId: number; token: string };
    await avisar(pagoMp(`cns-lic-${licenciaId}`, 'approved').id);
    // Le quedan cien dias.
    const fin = new Date(Date.now() + 100 * 86_400_000);
    await app.prisma.license.update({ where: { id: licenciaId }, data: { finVigencia: fin } });

    const auth = { authorization: `Bearer ${token}` };
    const pedir = () =>
      app.inject({ method: 'POST', url: '/api/pagos/pagar', headers: auth, payload: { licenciaId }, remoteAddress: desdeOtraIp() });

    // Dos intentos (el comprador cierra Mercado Pago y vuelve): una sola renovacion.
    const p1 = (await pedir()).json() as { licenciaId: number };
    const p2 = (await pedir()).json() as { licenciaId: number };
    expect(p2.licenciaId).toBe(p1.licenciaId);
    expect(p1.licenciaId).not.toBe(licenciaId);

    await avisar(pagoMp(`cns-lic-${p1.licenciaId}`, 'approved').id);

    const renovacion = await app.prisma.license.findUniqueOrThrow({ where: { id: p1.licenciaId } });
    expect(renovacion.estado).toBe('activa');
    expect(renovacion.inicioVigencia?.getTime()).toBe(fin.getTime());

    // El portal sigue mostrando la que esta en curso, con su renovacion debajo.
    const s = (await app.inject({ method: 'GET', url: '/api/portal/suscripcion', headers: auth })).json() as {
      licencia: { id: number; estado: string; renovacion: { estado: string } | null };
    };
    expect(s.licencia.id).toBe(licenciaId);
    expect(s.licencia.estado).toBe('activa');
    expect(s.licencia.renovacion?.estado).toBe('activa');

    // Y el historial trae los pagos de las dos licencias.
    const pagos = (await app.inject({ method: 'GET', url: '/api/portal/pagos', headers: auth })).json() as {
      pagos: unknown[];
    };
    expect(pagos.pagos.length).toBe(2);
  });

  it('una renovacion pendiente no tapa la licencia activa en el portal', async () => {
    const r = await comprar(`tapa.${marca}@prueba.local`);
    const { licenciaId, token } = r.json() as { licenciaId: number; token: string };
    await avisar(pagoMp(`cns-lic-${licenciaId}`, 'approved').id);
    const auth = { authorization: `Bearer ${token}` };
    await app.inject({ method: 'POST', url: '/api/pagos/pagar', headers: auth, payload: { licenciaId }, remoteAddress: desdeOtraIp() });

    const s = (await app.inject({ method: 'GET', url: '/api/portal/suscripcion', headers: auth })).json() as {
      licencia: { id: number; estado: string; renovacion: { estado: string } | null };
    };
    expect(s.licencia.id).toBe(licenciaId);
    expect(s.licencia.estado).toBe('activa');
    expect(s.licencia.renovacion?.estado).toBe('pendiente');
  });
});
