/**
 * Autenticacion y autorizacion.
 *
 * Reglas propias de una plataforma infantil:
 *  - Los ninos no tienen correo. Entran con un nombre de usuario y un PIN de
 *    imagenes, siempre dentro del contexto de su tutor o de su aula.
 *  - El token de un adulto lleva la lista de ninos a su cargo, de modo que
 *    ninguna consulta pueda salirse de ese conjunto.
 *  - Todo acceso de un adulto a los datos de un menor queda auditado.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';

import { cargarConfig } from '../lib/env.js';
import { auditarAcceso, comprobarAccesoANino } from '../services/guardian.service.js';

/** Contenido del token. Se mantiene pequeno: los permisos se revalidan. */
export interface TokenUsuario {
  readonly id: number;
  readonly usuario: string;
  readonly rol: 'nino' | 'tutor' | 'docente' | 'admin_escuela' | 'admin';
  readonly nombre: string;
  /** Ninos a cargo del adulto. Vacio para el propio nino. */
  readonly ninos: readonly number[];
  readonly institucionId?: number | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenUsuario;
    user: TokenUsuario;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Exige un token valido. */
    autenticar: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Exige uno de los roles indicados. */
    exigirRol: (
      ...roles: TokenUsuario['rol'][]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /**
     * Exige que quien llama sea un nino, sin excepcion para el administrador.
     *
     * `exigirRol` deja pasar siempre al admin, y para las rutas administrativas
     * esta bien. Para jugar no: un adulto que abre una sesion y envia un
     * programa crea progreso, estrellas y monedas en su propia cuenta, y ese
     * ruido acaba en los agregados del aula. Jugar es de los ninos.
     */
    exigirJugador: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Exige que el usuario pueda ver los datos del nino de la ruta. */
    exigirAccesoANino: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Un admin de la plataforma pasa por encima de las comprobaciones de rol. */
const ES_ADMIN = (rol: TokenUsuario['rol']): boolean => rol === 'admin';

async function plugin(fastify: FastifyInstance): Promise<void> {
  const config = cargarConfig();

  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  fastify.decorate('autenticar', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: 'No autenticado', mensaje: 'Inicia sesion para continuar' });
    }
  });

  fastify.decorate('exigirJugador', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: 'No autenticado' });
      return;
    }
    // Sin excepcion para el admin, a diferencia de `exigirRol`: el objetivo aqui
    // no es el permiso sino que el progreso pertenezca a quien juega de verdad.
    if (request.user.rol !== 'nino') {
      await reply.code(403).send({
        error: 'Sin permiso',
        mensaje: 'Las actividades son para las cuentas de estudiante',
      });
    }
  });

  fastify.decorate(
    'exigirRol',
    (...roles: TokenUsuario['rol'][]) =>
      async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
          await request.jwtVerify();
        } catch {
          await reply.code(401).send({ error: 'No autenticado' });
          return;
        }
        const { rol } = request.user;
        if (!ES_ADMIN(rol) && !roles.includes(rol)) {
          await reply.code(403).send({
            error: 'Sin permiso',
            mensaje: 'Tu cuenta no puede realizar esta accion',
          });
        }
      },
  );

  /**
   * Comprueba que el solicitante puede ver a ese nino y deja constancia.
   * La decision se confirma en la base de datos, porque el token puede ser
   * anterior al alta del nino y no incluirlo todavia.
   */
  fastify.decorate('exigirAccesoANino', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: 'No autenticado' });
      return;
    }

    const params = request.params as { ninoId?: string };
    const ninoId = Number(params.ninoId);
    if (!Number.isInteger(ninoId)) {
      await reply.code(400).send({ error: 'Identificador de nino invalido' });
      return;
    }

    const acceso = await comprobarAccesoANino(request.server.prisma, request.user, ninoId);

    if (!acceso.permitido) {
      await reply.code(403).send({
        error: 'Sin permiso',
        mensaje: 'No tienes acceso a los datos de este estudiante',
      });
      return;
    }

    // Auditoria exigible por la Ley 1581: quien miro que datos y cuando.
    if (!acceso.esElMismo) {
      await auditarAcceso(request.server.prisma, {
        actorId: request.user.id,
        ninoId,
        accion: request.method,
        recurso: request.url,
        ip: request.ip,
      });
    }
  });
}

export const authPlugin = fp(plugin, { name: 'auth', dependencies: ['prisma'] });
