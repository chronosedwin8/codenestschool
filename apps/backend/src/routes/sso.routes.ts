/**
 * Entrar con la cuenta del colegio.
 *
 * Son rutas de navegador, no de API: el navegador sale hacia Microsoft y vuelve
 * aqui con un codigo. Por eso responden con redirecciones y no con JSON.
 *
 * La sesion vuelve al navegador en el FRAGMENTO de la URL (`#sso=...`), no en la
 * cadena de consulta. El fragmento no viaja al servidor ni queda en sus
 * registros, y la pantalla de entrada lo borra de la barra de direcciones en
 * cuanto lo guarda. Un token en `?token=` acaba en el historial, en el registro
 * del proxy y en la cabecera `Referer` de la siguiente peticion.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { cargarConfig, dominiosSso, ssoConfigurado } from '../lib/env.js';
import { LIMITE_ACCESO } from '../plugins/security.js';
import { construirToken } from '../services/auth.service.js';
import {
  ErrorSso,
  canjearCodigo,
  iniciarSso,
  recuperarPendiente,
  urlDeRetorno,
  verificarIdToken,
} from '../services/sso.service.js';

const retornoSchema = z.object({
  code: z.string().min(1).max(4000).optional(),
  state: z.string().min(1).max(200).optional(),
  error: z.string().max(200).optional(),
  error_description: z.string().max(1000).optional(),
});

/**
 * Solo se admite volver a una ruta de esta misma aplicacion.
 *
 * Sin esto, `/inicio?volverA=https://otro-sitio` convertiria la entrada del
 * colegio en un trampolin para llevar a un docente a una pagina ajena que se
 * parezca a esta. Se exige una barra inicial y se rechaza `//`, que el navegador
 * interpreta como otro dominio.
 */
function rutaInternaSegura(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  if (!valor.startsWith('/') || valor.startsWith('//')) return null;
  if (valor.length > 200) return null;
  return valor;
}

export const ssoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const config = cargarConfig();
  const baseApp = `${config.PUBLIC_BASE_URL.replace(/\/$/, '')}/app/`;

  const volverAlJuego = (fragmento: Record<string, string>): string =>
    `${baseApp}#${new URLSearchParams(fragmento).toString()}`;

  /** Si el boton del colegio debe aparecer, y para que dominios. */
  fastify.get('/estado', async (_request, reply) => {
    return reply.send({
      activo: ssoConfigurado(config),
      obligatorio: config.SSO_OBLIGATORIO,
      dominios: dominiosSso(config),
    });
  });

  /** Manda al navegador a Microsoft. */
  fastify.get('/inicio', { config: LIMITE_ACCESO }, async (request, reply) => {
    if (!ssoConfigurado(config)) {
      return reply.code(503).send({ error: 'El acceso con la cuenta del colegio no esta activo' });
    }

    try {
      const volverA = rutaInternaSegura((request.query as { volverA?: unknown }).volverA);
      return reply.redirect(iniciarSso(config, volverA), 302);
    } catch (error) {
      if (error instanceof ErrorSso) {
        return reply.redirect(volverAlJuego({ 'sso-error': error.codigo }), 302);
      }
      throw error;
    }
  });

  /** Microsoft devuelve aqui al usuario. */
  fastify.get('/retorno', { config: LIMITE_ACCESO }, async (request, reply) => {
    const datos = retornoSchema.safeParse(request.query);
    if (!datos.success) return reply.redirect(volverAlJuego({ 'sso-error': 'respuesta' }), 302);

    // El usuario cancelo en la pantalla de Microsoft, o el administrador no ha
    // dado consentimiento. No es un fallo nuestro: se vuelve sin ruido.
    if (datos.data.error) {
      fastify.log.warn(
        { error: datos.data.error },
        'Microsoft devolvio un error en la entrada con SSO',
      );
      return reply.redirect(volverAlJuego({ 'sso-error': 'cancelado' }), 302);
    }

    if (!datos.data.code || !datos.data.state) {
      return reply.redirect(volverAlJuego({ 'sso-error': 'respuesta' }), 302);
    }

    try {
      const pendiente = recuperarPendiente(datos.data.state);
      const idToken = await canjearCodigo(config, datos.data.code, pendiente.verificador);
      const identidad = await verificarIdToken(config, idToken, pendiente.nonce);

      // La cuenta se busca por correo, que es lo unico que las dos partes
      // comparten: aqui las cuentas se crean desde el portal o desde Phidias, no
      // desde Microsoft, asi que el `oid` todavia no esta guardado en ninguna.
      let cuenta = await fastify.prisma.user.findUnique({
        where: { email: identidad.email },
        select: { id: true, activo: true, rol: true, origenExterno: true },
      });

      if (!cuenta) {
        if (!config.SSO_ALTA_AUTOMATICA) {
          fastify.log.warn('Entrada con SSO de una cuenta que no existe en la plataforma');
          return reply.redirect(volverAlJuego({ 'sso-error': 'sin-cuenta' }), 302);
        }

        const creada = await fastify.prisma.user.create({
          data: {
            usuario: identidad.email,
            email: identidad.email,
            nombre: identidad.nombre,
            rol: config.SSO_ALTA_AUTOMATICA,
            origenExterno: 'entra',
            origenExternoId: identidad.oid,
          },
          select: { id: true, activo: true, rol: true, origenExterno: true },
        });
        cuenta = creada;
      }

      if (!cuenta.activo) {
        return reply.redirect(volverAlJuego({ 'sso-error': 'inactiva' }), 302);
      }

      /**
       * Contabilidad: el vinculo con Entra y la anotacion del acceso.
       *
       * Va en su propio `try` porque ninguna de las dos cosas puede impedir una
       * entrada que ya es valida. Un choque en el indice de origen externo o una
       * escritura de auditoria fallida dejarian al docente fuera de su clase por
       * un apunte que a el no le importa; se registra el fallo y se sigue.
       */
      try {
        // Sin pisar el de Phidias: asi se sabe despues quien entra por SSO.
        if (!cuenta.origenExterno) {
          await fastify.prisma.user.update({
            where: { id: cuenta.id },
            data: { origenExterno: 'entra', origenExternoId: identidad.oid },
          });
        }

        await fastify.prisma.accessAudit.create({
          data: {
            actorId: cuenta.id,
            accion: 'acceso_sso',
            recurso: 'entra_id',
            ip: request.ip,
          },
        });
      } catch (fallo) {
        fastify.log.warn({ err: fallo }, 'No se pudo anotar el acceso con SSO');
      }

      const token = fastify.jwt.sign(await construirToken(fastify.prisma, cuenta.id));
      const fragmento: Record<string, string> = { sso: token };
      if (pendiente.volverA) fragmento.volverA = pendiente.volverA;

      return reply.redirect(volverAlJuego(fragmento), 302);
    } catch (error) {
      if (error instanceof ErrorSso) {
        // El motivo se registra, pero al navegador solo le llega un codigo
        // corto: los detalles de un fallo de identidad no son para la pantalla.
        fastify.log.warn({ codigo: error.codigo }, `Entrada con SSO rechazada: ${error.message}`);
        return reply.redirect(volverAlJuego({ 'sso-error': error.codigo }), 302);
      }
      fastify.log.error({ err: error }, 'Fallo inesperado en la entrada con SSO');
      return reply.redirect(volverAlJuego({ 'sso-error': 'interno' }), 302);
    }
  });

  /**
   * La direccion exacta que hay que registrar en Entra ID.
   *
   * Existe porque es el error mas comun al montar esto: una barra de mas, un
   * dominio distinto, y Microsoft responde con un error que no dice cual de las
   * dos direcciones esperaba. Aqui se lee la que este servidor va a usar de
   * verdad. No devuelve ningun secreto, pero si la politica de acceso del
   * colegio, asi que la lee solo quien la administra.
   */
  fastify.get('/configuracion', { preHandler: fastify.exigirRol('admin_escuela') }, async (_request, reply) => {
    return reply.send({
      activo: ssoConfigurado(config),
      urlDeRetorno: urlDeRetorno(config),
      dominios: dominiosSso(config),
      altaAutomatica: config.SSO_ALTA_AUTOMATICA ?? null,
      obligatorio: config.SSO_OBLIGATORIO,
    });
  });
};
