/**
 * Rutas de autenticacion.
 *
 * Dos caminos distintos por diseno:
 *   - Adultos (tutor, docente, administrador): usuario o correo y contrasena.
 *   - Ninos: nombre de usuario y PIN de imagenes, siempre bajo el paraguas de
 *     un adulto. Sin correo, sin contrasena escrita, sin recuperacion por mail.
 *
 * Codexia tenia una cuenta invitada compartida que cualquiera podia usar
 * conociendo la ruta. Aqui no existe: todo nino pertenece a un tutor o a un aula.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { LIMITE_ACCESO } from '../plugins/security.js';
import { comprobarAccesoANino } from '../services/guardian.service.js';
import {
  anotarFallo,
  anotarFalloIp,
  comprobarIntentos,
  comprobarIntentosIp,
  olvidarFallos,
} from '../services/intentos.service.js';
import {
  construirToken,
  generarUsuarioLibre,
  grupoPorFechaNacimiento,
  hashPassword,
  hashPin,
  verificarPassword,
  verificarPin,
  LONGITUD_PIN,
} from '../services/auth.service.js';

const registroAdultoSchema = z.object({
  nombre: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').max(200),
  rol: z.enum(['tutor', 'docente']).default('tutor'),
});

const loginAdultoSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

const loginNinoSchema = z.object({
  usuario: z.string().min(2).max(60),
  pin: z.array(z.string().min(1).max(30)).length(LONGITUD_PIN),
});

const crearNinoSchema = z.object({
  nombre: z.string().min(2).max(150),
  fechaNacimiento: z.coerce.date(),
  pin: z.array(z.string().min(1).max(30)).length(LONGITUD_PIN),
  parentesco: z.string().max(50).optional(),
});

const consentimientoSchema = z.object({
  ninoId: z.number().int().positive(),
  versionPolitica: z.string().min(1).max(20),
  otorgado: z.boolean(),
});

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** Alta de un adulto responsable. */
  fastify.post('/registro', { config: LIMITE_ACCESO }, async (request, reply) => {
    const datos = registroAdultoSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }
    const { nombre, email, password, rol } = datos.data;

    const existe = await fastify.prisma.user.findUnique({ where: { email } });
    if (existe) {
      return reply.code(409).send({ error: 'Ese correo ya tiene una cuenta' });
    }

    const usuario = await fastify.prisma.user.create({
      data: {
        usuario: email,
        email,
        passwordHash: await hashPassword(password),
        nombre,
        rol,
      },
    });

    const token = fastify.jwt.sign(await construirToken(fastify.prisma, usuario.id));
    return reply.code(201).send({ token, usuario: { id: usuario.id, nombre, email, rol } });
  });

  /** Inicio de sesion de un adulto. */
  fastify.post('/login', { config: LIMITE_ACCESO }, async (request, reply) => {
    const datos = loginAdultoSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    const identificador = datos.data.email;

    // Los docentes de un colegio tambien comparten la red, asi que aqui vale el
    // mismo criterio: se cuentan los fallos, no los accesos correctos.
    const estadoCuenta = comprobarIntentos(identificador);
    const estadoRed = comprobarIntentosIp(request.ip);
    if (estadoCuenta.bloqueado || estadoRed.bloqueado) {
      const espera = Math.max(estadoCuenta.esperaSegundos, estadoRed.esperaSegundos);
      return reply.code(429).send({
        error: 'Demasiados intentos',
        mensaje: `Espera ${Math.ceil(espera / 60)} minuto(s) y vuelve a intentarlo.`,
      });
    }

    const cuenta = await fastify.prisma.user.findFirst({
      where: {
        OR: [{ email: identificador }, { usuario: identificador }],
        rol: { not: 'nino' },
      },
    });

    // Mismo mensaje para usuario inexistente y contrasena erronea: no se
    // revela si un correo esta registrado.
    if (!cuenta?.passwordHash || !cuenta.activo) {
      anotarFallo(identificador);
      anotarFalloIp(request.ip);
      return reply.code(401).send({ error: 'Usuario o contrasena incorrectos' });
    }
    if (!(await verificarPassword(datos.data.password, cuenta.passwordHash))) {
      anotarFallo(identificador);
      anotarFalloIp(request.ip);
      return reply.code(401).send({ error: 'Usuario o contrasena incorrectos' });
    }

    olvidarFallos(identificador);
    const token = fastify.jwt.sign(await construirToken(fastify.prisma, cuenta.id));
    return reply.send({
      token,
      usuario: { id: cuenta.id, nombre: cuenta.nombre, email: cuenta.email, rol: cuenta.rol },
    });
  });

  /**
   * Inicio de sesion de un nino con su PIN de imagenes.
   *
   * La proteccion tiene dos capas, porque una sola no sirve:
   *  - un limite generoso por IP (en el plugin), para que un aula entera pueda
   *    entrar a la vez desde la red del colegio,
   *  - un contador de fallos por cuenta (aqui), para que no se pueda adivinar el
   *    PIN de un nino concreto a base de intentos.
   */
  fastify.post('/login-nino', { config: LIMITE_ACCESO }, async (request, reply) => {
    const datos = loginNinoSchema.safeParse(request.body);
    if (!datos.success) {
      return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
    }

    const cuenta = datos.data.usuario;

    // Cuenta frenada por intentos fallidos: se avisa cuanto falta.
    const estado = comprobarIntentos(cuenta);
    if (estado.bloqueado) {
      return reply.code(429).send({
        error: 'Demasiados intentos',
        mensaje: `Espera ${Math.ceil(estado.esperaSegundos / 60)} minuto(s) y vuelve a intentarlo.`,
      });
    }

    // Y la red frenada por acumular fallos con muchas cuentas distintas. Solo
    // cuentan los fallos, asi que un colegio entero entrando bien nunca lo activa.
    const estadoRed = comprobarIntentosIp(request.ip);
    if (estadoRed.bloqueado) {
      return reply.code(429).send({
        error: 'Demasiados intentos desde esta red',
        mensaje: 'Pide ayuda a tu profe o a un adulto.',
      });
    }

    const nino = await fastify.prisma.user.findUnique({
      where: { usuario: cuenta },
      include: { tutores: { select: { tutorId: true } } },
    });

    // Mismo mensaje si el usuario no existe o si el PIN no coincide: no se
    // revela que cuentas existen.
    if (!nino?.pinHash || nino.rol !== 'nino' || !nino.activo) {
      anotarFallo(cuenta);
      anotarFalloIp(request.ip);
      return reply.code(401).send({ error: 'Ese usuario o esas imagenes no coinciden' });
    }
    if (!(await verificarPin(datos.data.pin, nino.pinHash))) {
      const tras = anotarFallo(cuenta);
      anotarFalloIp(request.ip);
      if (tras.bloqueado) {
        return reply.code(429).send({
          error: 'Demasiados intentos',
          mensaje: 'Pide ayuda a un adulto para recordar tus dibujos.',
        });
      }
      return reply.code(401).send({ error: 'Ese usuario o esas imagenes no coinciden' });
    }

    // Acceso correcto: se olvidan los fallos anteriores.
    olvidarFallos(cuenta);
    // Un nino sin adulto responsable no puede entrar.
    if (nino.tutores.length === 0) {
      return reply.code(403).send({
        error: 'Cuenta sin adulto responsable',
        mensaje: 'Pide a tu familia o a tu profe que active tu cuenta',
      });
    }

    await fastify.prisma.user.update({
      where: { id: nino.id },
      data: { ultimaActividad: new Date() },
    });

    const token = fastify.jwt.sign(await construirToken(fastify.prisma, nino.id));
    return reply.send({
      token,
      usuario: {
        id: nino.id,
        nombre: nino.nombre,
        usuario: nino.usuario,
        rol: nino.rol,
        grupoEdad: nino.grupoEdad,
        avatarConfig: nino.avatarConfig,
        monedas: nino.monedas,
      },
    });
  });

  /** Un adulto crea el perfil de un nino a su cargo. */
  fastify.post(
    '/ninos',
    { preHandler: fastify.exigirRol('tutor', 'docente', 'admin_escuela') },
    async (request, reply) => {
      const datos = crearNinoSchema.safeParse(request.body);
      if (!datos.success) {
        return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
      }
      const { nombre, fechaNacimiento, pin, parentesco } = datos.data;
      const adulto = request.user;

      const grupoEdad = grupoPorFechaNacimiento(fechaNacimiento);
      const usuario = await generarUsuarioLibre(fastify.prisma, nombre);

      const nino = await fastify.prisma.$transaction(async (tx) => {
        const creado = await tx.user.create({
          data: {
            usuario,
            nombre,
            rol: 'nino',
            grupoEdad,
            fechaNacimiento,
            pinHash: await hashPin(pin),
            institucionId: adulto.institucionId ?? null,
          },
        });

        await tx.guardianLink.create({
          data: { tutorId: adulto.id, ninoId: creado.id, parentesco },
        });

        // El consentimiento nace pendiente: el adulto debe otorgarlo aparte,
        // dejando constancia de la version de la politica que acepto.
        await tx.parentalConsent.create({
          data: {
            ninoId: creado.id,
            tutorId: adulto.id,
            estado: 'pendiente',
            versionPolitica: '1.0',
          },
        });

        return creado;
      });

      // Se devuelve un token nuevo: el anterior no incluia a este nino.
      const token = fastify.jwt.sign(await construirToken(fastify.prisma, adulto.id));

      return reply.code(201).send({
        nino: {
          id: nino.id,
          nombre: nino.nombre,
          usuario: nino.usuario,
          grupoEdad: nino.grupoEdad,
        },
        token,
        mensaje: 'Recuerda registrar el consentimiento para activar la cuenta',
      });
    },
  );

  /** Registro del consentimiento del tutor (Ley 1581). */
  fastify.post(
    '/consentimiento',
    { preHandler: fastify.exigirRol('tutor', 'docente', 'admin_escuela') },
    async (request, reply) => {
      const datos = consentimientoSchema.safeParse(request.body);
      if (!datos.success) {
        return reply.code(400).send({ error: 'Datos invalidos', detalles: datos.error.flatten() });
      }
      const { ninoId, versionPolitica, otorgado } = datos.data;

      // Se confirma en la base: el token puede ser anterior al alta del nino.
      const acceso = await comprobarAccesoANino(fastify.prisma, request.user, ninoId);
      if (!acceso.permitido) {
        return reply.code(403).send({ error: 'Ese estudiante no esta a tu cargo' });
      }

      const consentimiento = await fastify.prisma.parentalConsent.create({
        data: {
          ninoId,
          tutorId: request.user.id,
          estado: otorgado ? 'otorgado' : 'revocado',
          versionPolitica,
          otorgadoEn: otorgado ? new Date() : null,
          revocadoEn: otorgado ? null : new Date(),
          ip: request.ip,
        },
      });

      return reply.code(201).send({ consentimiento });
    },
  );

  /** Perfil del usuario autenticado. */
  fastify.get('/yo', { preHandler: fastify.autenticar }, async (request, reply) => {
    const usuario = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        usuario: true,
        email: true,
        nombre: true,
        rol: true,
        grupoEdad: true,
        avatarConfig: true,
        monedas: true,
        estrellasTotales: true,
        rachaDias: true,
        institucionId: true,
        ninosACargo: {
          select: {
            nino: {
              select: { id: true, nombre: true, usuario: true, grupoEdad: true, monedas: true },
            },
          },
        },
      },
    });

    if (!usuario) return reply.code(404).send({ error: 'Cuenta no encontrada' });

    return reply.send({
      ...usuario,
      ninosACargo: usuario.ninosACargo.map((v) => v.nino),
    });
  });
};
