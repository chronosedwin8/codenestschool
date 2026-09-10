/**
 * Servicio de autenticacion.
 *
 * Concentra las reglas que no deben repetirse en las rutas: como se arma el
 * token, como se comprueba un PIN de imagenes y como se genera un nombre de
 * usuario para un nino que no tiene correo electronico.
 */
import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';

import type { TokenUsuario } from '../plugins/auth.js';

/** Coste de bcrypt para contrasenas de adulto. */
export const COSTE_PASSWORD = 12;
/**
 * Coste menor para el PIN de imagenes: se verifica en cada inicio de sesion de
 * un aula entera y su seguridad real viene del limite de intentos y del
 * contexto (hay que conocer el aula o el tutor), no de la fuerza del hash.
 */
export const COSTE_PIN = 8;

/** Numero de imagenes que forman el PIN de un prelector. */
export const LONGITUD_PIN = 4;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTE_PASSWORD);
}

export async function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * El PIN llega como una secuencia de identificadores de imagen (por ejemplo
 * ["gato", "sol", "gato", "arbol"]). Se normaliza antes de cifrar para que el
 * orden y el formato no dependan del cliente.
 */
export function normalizarPin(imagenes: readonly string[]): string {
  return imagenes.map((i) => i.trim().toLowerCase()).join('|');
}

export async function hashPin(imagenes: readonly string[]): Promise<string> {
  return bcrypt.hash(normalizarPin(imagenes), COSTE_PIN);
}

export async function verificarPin(imagenes: readonly string[], hash: string): Promise<boolean> {
  return bcrypt.compare(normalizarPin(imagenes), hash);
}

/**
 * Construye el contenido del token. Para un adulto incluye la lista de ninos a
 * su cargo, que es lo que despues acota cada consulta.
 */
export async function construirToken(
  prisma: PrismaClient,
  usuarioId: number,
): Promise<TokenUsuario> {
  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: usuarioId },
    select: {
      id: true,
      usuario: true,
      nombre: true,
      rol: true,
      institucionId: true,
      ninosACargo: { select: { ninoId: true } },
    },
  });

  return {
    id: usuario.id,
    usuario: usuario.usuario,
    nombre: usuario.nombre,
    rol: usuario.rol,
    institucionId: usuario.institucionId,
    ninos: usuario.ninosACargo.map((v) => v.ninoId),
  };
}

/**
 * Genera un nombre de usuario libre a partir del nombre del nino.
 * Ejemplo: "Sofia Ramirez" -> "sofia.r", "sofia.r2", "sofia.r3"...
 *
 * `reservados` son los nombres ya repartidos en este mismo lote pero todavia sin
 * crear. Hacen falta porque al dar de alta una clase entera hay dos "Ana Lopez"
 * y ninguna de las dos existe aun en la base cuando se consulta: sin esto las
 * dos pedirian el mismo nombre y el alta del grupo entero fallaria.
 */
export async function generarUsuarioLibre(
  prisma: PrismaClient,
  nombreCompleto: string,
  reservados: ReadonlySet<string> = new Set(),
): Promise<string> {
  const partes = nombreCompleto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const nombre = partes[0] ?? 'fuzz';
  const inicial = partes[1]?.[0] ?? '';
  const base = inicial ? `${nombre}.${inicial}` : nombre;

  for (let intento = 0; intento < 200; intento++) {
    const candidato = intento === 0 ? base : `${base}${intento + 1}`;
    if (reservados.has(candidato)) continue;
    const existe = await prisma.user.findUnique({ where: { usuario: candidato } });
    if (!existe) return candidato;
  }
  throw new Error('No se pudo generar un nombre de usuario libre');
}

/**
 * Codigo de acceso corto y legible para aulas y licencias.
 * Alfabeto sin caracteres que se confunden (0/O, 1/I/L).
 */
export function generarCodigoAcceso(prefijo: string): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let cuerpo = '';
  for (let i = 0; i < 6; i++) {
    cuerpo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return `${prefijo}-${cuerpo}`;
}

/** Deriva el grupo de edad a partir de la fecha de nacimiento. */
export function grupoPorFechaNacimiento(fecha: Date): 'exploradores' | 'creadores' | 'hackers' {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;

  if (edad <= 6) return 'exploradores';
  if (edad <= 9) return 'creadores';
  return 'hackers';
}
