/**
 * Pruebas de la compra de licencias.
 *
 * Lo que se protege aquí es el dinero y la integridad de las cuentas:
 *  - el precio lo pone el servidor, no el cliente,
 *  - un pago rechazado no deja una cuenta a medias,
 *  - un pago pendiente (PSE, efectivo) no se trata como rechazo,
 *  - el webhook se puede recibir dos veces sin duplicar la vigencia.
 *
 * Mercado Pago se sustituye por un doble: cobrar de verdad en una prueba
 * automatizada no es una opción, y lo que hay que verificar es nuestra lógica.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

/**
 * Respuesta que devolverá el doble de Mercado Pago en cada prueba.
 *
 * El identificador se genera distinto en cada cobro, como hace la pasarela real.
 * La columna `mp_payment_id` es única, y un doble que devolviera siempre el mismo
 * número fallaría a la segunda compra por una razón que no tiene nada que ver con
 * lo que se está probando.
 */
let siguienteId = 1000;
let respuestaSimulada: { id: number | null; status: string; statusDetail: string } = {
  id: null,
  status: 'approved',
  statusDetail: 'accredited',
};

/** Claves de idempotencia recibidas, para comprobar que no se repiten. */
const clavesRecibidas: string[] = [];

vi.mock('../lib/mercadopago.js', async () => {
  const real = await vi.importActual<typeof import('../lib/mercadopago.js')>(
    '../lib/mercadopago.js',
  );

  return {
    ...real,
    crearPago: vi.fn(
      async (
        datos: { montoCop: number; referenciaExterna: string },
        clave: string,
      ) => {
        clavesRecibidas.push(clave);
        // Si la prueba no fija un id concreto, se genera uno nuevo.
        const id = respuestaSimulada.id ?? (siguienteId += 1);
        respuestaSimulada = { ...respuestaSimulada, id };
        return {
          id,
          status: respuestaSimulada.status,
          statusDetail: respuestaSimulada.statusDetail,
          // El monto que devuelve el doble es el que le llegó: así la prueba
          // comprueba qué precio envió el servidor.
          transactionAmount: datos.montoCop,
          paymentMethodId: 'visa',
          externalReference: datos.referenciaExterna,
        };
      },
    ),
    obtenerPago: vi.fn(async (id: string | number) => ({
      id: Number(id),
      status: respuestaSimulada.status,
      statusDetail: respuestaSimulada.statusDetail,
      transactionAmount: 12_000_000,
      paymentMethodId: 'visa',
      externalReference: String(referenciaWebhook),
    })),
  };
});

/** Licencia a la que apuntará el webhook simulado. */
let referenciaWebhook = 0;

const { construirServidor } = await import('../server.js');

const marca = `p${Date.now().toString(36)}`;
let app: FastifyInstance;
const usuariosCreados: number[] = [];
const institucionesCreadas: number[] = [];

/** Cuerpo de compra válido, con el correo variable por prueba. */
function cuerpoCompra(email: string, plan = 'escuela') {
  return {
    plan,
    cuenta: { nombre: 'Colegio de Prueba', email, password: 'clave-de-prueba-1234' },
    institucion: { nombre: 'Colegio de Prueba', ciudad: 'Bogota' },
    pago: { token: 'tok_prueba', paymentMethodId: 'visa', installments: 1 },
  };
}

beforeAll(async () => {
  // La pasarela tiene que parecer configurada para que la ruta no responda 503.
  process.env.MP_ACCESS_TOKEN = 'prueba';
  process.env.MP_PUBLIC_KEY = 'prueba';

  app = await construirServidor();
  await app.ready();
});

afterAll(async () => {
  if (usuariosCreados.length > 0) {
    await app.prisma.user.deleteMany({ where: { id: { in: usuariosCreados } } });
  }
  if (institucionesCreadas.length > 0) {
    await app.prisma.institution.deleteMany({ where: { id: { in: institucionesCreadas } } });
  }
  await app.close();
});

beforeEach(() => {
  clavesRecibidas.length = 0;
  respuestaSimulada = { id: null, status: 'approved', statusDetail: 'accredited' };
});

/**
 * Envia una compra desde una direccion distinta en cada llamada.
 *
 * El limite de peticiones de la ruta de pago es de ocho por minuto y por IP, que
 * es lo correcto en produccion. En una prueba que hace ocho compras seguidas eso
 * las bloquea, asi que cada una llega desde una direccion propia, como llegarian
 * ocho compradores reales.
 */
let contadorIp = 0;
async function comprar(cuerpo: unknown) {
  contadorIp += 1;
  return app.inject({
    method: 'POST',
    url: '/api/pagos/comprar',
    payload: cuerpo as object,
    remoteAddress: `10.0.0.${contadorIp}`,
  });
}

/** Registra lo creado por una compra para poder limpiarlo al terminar. */
async function anotarCreados(email: string): Promise<void> {
  const usuario = await app.prisma.user.findUnique({
    where: { email },
    select: { id: true, institucionId: true },
  });
  if (usuario) {
    usuariosCreados.push(usuario.id);
    if (usuario.institucionId) institucionesCreadas.push(usuario.institucionId);
  }
}

describe('precios', () => {
  it('expone los tres planes con el precio de colegio en doce millones', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/pagos/config' });
    const datos = respuesta.json() as {
      planes: { clave: string; precioCop: number; maxNinos: number | null }[];
    };

    expect(respuesta.statusCode).toBe(200);
    expect(datos.planes).toHaveLength(3);

    const escuela = datos.planes.find((p) => p.clave === 'escuela');
    expect(escuela?.precioCop).toBe(12_000_000);
    // El plan de colegio no tiene tope de estudiantes.
    expect(escuela?.maxNinos).toBeNull();
  });

  it('no expone el token secreto de la pasarela', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/pagos/config' });
    const texto = respuesta.body;

    expect(texto).not.toContain('MP_ACCESS_TOKEN');
    expect(texto).not.toContain('accessToken');
  });
});

describe('compra de una licencia', () => {
  it('cobra el precio del servidor, no el que envie el cliente', async () => {
    const email = `escuela.${marca}@prueba.local`;
    const { crearPago } = await import('../lib/mercadopago.js');

    const respuesta = await comprar({ ...cuerpoCompra(email), montoCop: 1000, precio: 1000 });
    await anotarCreados(email);

    expect(respuesta.statusCode).toBe(201);

    const llamada = vi.mocked(crearPago).mock.calls.at(-1);
    expect(llamada?.[0].montoCop).toBe(12_000_000);
  });

  it('activa la licencia y entrega la sesion cuando el pago se aprueba', async () => {
    const email = `aprobado.${marca}@prueba.local`;

    const respuesta = await comprar(cuerpoCompra(email));
    await anotarCreados(email);

    const datos = respuesta.json() as {
      estado: string;
      token: string;
      licencia: { finVigencia: string; codigoAcceso: string };
    };

    expect(respuesta.statusCode).toBe(201);
    expect(datos.estado).toBe('aprobado');
    expect(datos.token).toBeTruthy();
    expect(datos.licencia.codigoAcceso).toMatch(/^LIC-/);

    // La vigencia es de un año.
    const dias = Math.round(
      (new Date(datos.licencia.finVigencia).getTime() - Date.now()) / 86_400_000,
    );
    expect(dias).toBeGreaterThan(360);
    expect(dias).toBeLessThan(370);
  });

  it('usa una clave de idempotencia para que un reintento no cobre dos veces', async () => {
    const email = `idem.${marca}@prueba.local`;

    await comprar(cuerpoCompra(email));
    await anotarCreados(email);

    expect(clavesRecibidas).toHaveLength(1);
    expect(clavesRecibidas[0]).toMatch(/^lic-\d+-/);
  });

  it('no deja la cuenta creada si el pago se rechaza', async () => {
    respuestaSimulada = {
      id: 2222,
      status: 'rejected',
      statusDetail: 'cc_rejected_insufficient_amount',
    };
    const email = `rechazado.${marca}@prueba.local`;

    const respuesta = await comprar(cuerpoCompra(email));

    expect(respuesta.statusCode).toBe(402);
    // El mensaje explica qué pasó, no devuelve el código técnico a secas.
    expect(respuesta.json()).toMatchObject({
      mensaje: 'La tarjeta no tiene fondos suficientes.',
    });

    // Y lo importante: no queda cuenta ni institución huérfanas.
    const usuario = await app.prisma.user.findUnique({ where: { email } });
    expect(usuario).toBeNull();
  });

  it('deja la licencia esperando cuando el pago queda pendiente', async () => {
    // Es el caso de PSE y de pago en efectivo: tarda horas, no es un rechazo.
    respuestaSimulada = { id: 3333, status: 'pending', statusDetail: 'pending_waiting_transfer' };
    const email = `pendiente.${marca}@prueba.local`;

    const respuesta = await comprar(cuerpoCompra(email));
    await anotarCreados(email);

    expect(respuesta.statusCode).toBe(202);
    const datos = respuesta.json() as { estado: string; licenciaId: number };
    expect(datos.estado).toBe('pendiente');

    const licencia = await app.prisma.license.findUnique({ where: { id: datos.licenciaId } });
    expect(licencia?.estado).toBe('pendiente');
    // Sin licencia activa no se entrega el código de acceso.
    const consulta = await app.inject({
      method: 'GET',
      url: `/api/pagos/licencia/${datos.licenciaId}`,
    });
    expect((consulta.json() as { codigoAcceso: string | null }).codigoAcceso).toBeNull();
  });

  it('rechaza una compra de colegio sin los datos de la institucion', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/pagos/comprar',
      payload: {
        plan: 'escuela',
        cuenta: {
          nombre: 'Sin institucion',
          email: `sinint.${marca}@prueba.local`,
          password: 'clave-de-prueba-1234',
        },
        pago: { token: 'tok', paymentMethodId: 'visa', installments: 1 },
      },
    });

    expect(respuesta.statusCode).toBe(400);
  });

  it('no permite dos cuentas con el mismo correo', async () => {
    const email = `duplicado.${marca}@prueba.local`;

    await app.inject({ method: 'POST', url: '/api/pagos/comprar', payload: cuerpoCompra(email) });
    await anotarCreados(email);

    const segunda = await comprar(cuerpoCompra(email));

    expect(segunda.statusCode).toBe(409);
  });
});

describe('webhook de Mercado Pago', () => {
  it('activa una licencia pendiente al confirmarse el pago', async () => {
    respuestaSimulada = { id: 4444, status: 'pending', statusDetail: 'pending_waiting_transfer' };
    const email = `webhook.${marca}@prueba.local`;

    const compra = await comprar(cuerpoCompra(email));
    await anotarCreados(email);

    const licenciaId = (compra.json() as { licenciaId: number }).licenciaId;
    referenciaWebhook = licenciaId;

    // El banco confirma.
    respuestaSimulada = { id: 4444, status: 'approved', statusDetail: 'accredited' };
    const aviso = await app.inject({
      method: 'POST',
      url: '/api/pagos/webhook',
      payload: { type: 'payment', data: { id: 4444 } },
    });

    expect(aviso.statusCode).toBe(200);

    const licencia = await app.prisma.license.findUnique({ where: { id: licenciaId } });
    expect(licencia?.estado).toBe('activa');
    expect(licencia?.finVigencia).toBeTruthy();
  });

  it('recibir el mismo aviso dos veces no duplica la vigencia', async () => {
    respuestaSimulada = { id: 5555, status: 'pending', statusDetail: 'pending_waiting_transfer' };
    const email = `doble.${marca}@prueba.local`;

    const compra = await comprar(cuerpoCompra(email));
    await anotarCreados(email);

    const licenciaId = (compra.json() as { licenciaId: number }).licenciaId;
    referenciaWebhook = licenciaId;
    respuestaSimulada = { id: 5555, status: 'approved', statusDetail: 'accredited' };

    await app.inject({
      method: 'POST',
      url: '/api/pagos/webhook',
      payload: { type: 'payment', data: { id: 5555 } },
    });
    const primera = await app.prisma.license.findUnique({ where: { id: licenciaId } });

    // Mercado Pago reintenta el aviso.
    await app.inject({
      method: 'POST',
      url: '/api/pagos/webhook',
      payload: { type: 'payment', data: { id: 5555 } },
    });
    const segunda = await app.prisma.license.findUnique({ where: { id: licenciaId } });

    expect(segunda?.finVigencia?.getTime()).toBe(primera?.finVigencia?.getTime());
  });

  it('responde 200 a un aviso que no puede procesar, para que no se reintente en bucle', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/pagos/webhook',
      payload: { type: 'otra_cosa' },
    });

    expect(respuesta.statusCode).toBe(200);
  });
});
