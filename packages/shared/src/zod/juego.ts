/**
 * Esquema zod de la definición de un juego.
 *
 * Es la frontera del servidor. Lo que entra por aquí viene del navegador de un
 * niño, y un navegador se puede manipular: no se acepta ni una clave que no esté
 * en el catálogo, ni un color que no sea de la paleta, ni un título que no salga
 * del sorteo. Lo que no pase por aquí, no se guarda.
 */
import { z } from 'zod';

import {
  ACCIONES,
  COLORES_JUEGO,
  CONTROLES,
  ESCENARIOS,
  EVENTOS,
  FORMAS_OBSTACULO,
  FORMAS_PREMIO,
  FRECUENCIAS,
  LIMITES,
  METAS,
  MOVIMIENTOS,
  PERSONAJES,
  SONIDOS,
  TAMANOS,
  VELOCIDADES,
  type DefinicionJuego,
} from '../juegos/definicion.js';

const identificador = z
  .string()
  .min(1)
  .max(12)
  .regex(/^[a-z0-9]+$/, 'Los identificadores son letras minusculas y numeros');

const colorSchema = z.enum(COLORES_JUEGO as unknown as [string, ...string[]]);
const velocidadSchema = z.enum(VELOCIDADES as unknown as [string, ...string[]]);
const frecuenciaSchema = z.enum(FRECUENCIAS as unknown as [string, ...string[]]);
const tamanoSchema = z.enum(TAMANOS as unknown as [string, ...string[]]);

export const reglaJuegoSchema = z.object({
  id: identificador,
  cuando: z.enum(EVENTOS as unknown as [string, ...string[]]),
  umbral: z.number().int().min(1).max(LIMITES.puntosMeta).optional(),
  entonces: z.enum(ACCIONES as unknown as [string, ...string[]]),
  cantidad: z.number().int().min(1).max(LIMITES.puntosPorPremio).optional(),
  sonido: z.enum(SONIDOS as unknown as [string, ...string[]]).optional(),
});

export const obstaculoJuegoSchema = z.object({
  id: identificador,
  forma: z.enum(FORMAS_OBSTACULO as unknown as [string, ...string[]]),
  color: colorSchema,
  tamano: tamanoSchema,
  velocidad: velocidadSchema,
  frecuencia: frecuenciaSchema,
  movimiento: z.enum(MOVIMIENTOS as unknown as [string, ...string[]]),
  seDestruye: z.boolean(),
});

export const premioJuegoSchema = z.object({
  id: identificador,
  forma: z.enum(FORMAS_PREMIO as unknown as [string, ...string[]]),
  color: colorSchema,
  tamano: tamanoSchema,
  velocidad: velocidadSchema,
  frecuencia: frecuenciaSchema,
  puntos: z.number().int().min(1).max(LIMITES.puntosPorPremio),
});

export const definicionJuegoSchema = z
  .object({
    version: z.literal(1),
    escenario: z.enum(ESCENARIOS as unknown as [string, ...string[]]),
    control: z.enum(CONTROLES as unknown as [string, ...string[]]),
    jugador: z.object({
      personaje: z.enum(PERSONAJES as unknown as [string, ...string[]]),
      color: colorSchema,
      velocidad: velocidadSchema,
      vidas: z.number().int().min(1).max(LIMITES.vidasMax),
      dispara: z.boolean(),
    }),
    obstaculos: z.array(obstaculoJuegoSchema).max(LIMITES.obstaculos),
    premios: z.array(premioJuegoSchema).max(LIMITES.premios),
    reglas: z.array(reglaJuegoSchema).max(LIMITES.reglas),
    meta: z.object({
      tipo: z.enum(METAS as unknown as [string, ...string[]]),
      valor: z.number().int().min(1).max(LIMITES.puntosMeta),
    }),
    musica: z.boolean(),
  })
  // Los identificadores repetidos no rompen el motor, pero hacen que borrar un
  // obstaculo en el constructor se lleve dos: mejor rechazarlos al guardar.
  .refine(
    (def) => new Set(def.obstaculos.map((o) => o.id)).size === def.obstaculos.length,
    { message: 'Hay dos obstaculos con el mismo identificador' },
  )
  .refine((def) => new Set(def.premios.map((p) => p.id)).size === def.premios.length, {
    message: 'Hay dos premios con el mismo identificador',
  })
  .refine((def) => new Set(def.reglas.map((r) => r.id)).size === def.reglas.length, {
    message: 'Hay dos reglas con el mismo identificador',
  })
  .refine(
    (def) => def.meta.tipo !== 'tiempo' || def.meta.valor <= LIMITES.segundosMeta,
    { message: 'Una partida por tiempo no puede pasar de cinco minutos' },
  );

export type DefinicionJuegoEntrada = z.infer<typeof definicionJuegoSchema>;

/**
 * Valida y devuelve la definición ya tipada.
 *
 * El doble casteo es deliberado: zod garantiza que cada cadena es una de las del
 * catálogo, pero infiere `string` para los `z.enum` construidos desde una tupla
 * `as const`. La garantía la da el esquema, no el tipo.
 */
export function leerDefinicionJuego(valor: unknown): DefinicionJuego {
  return definicionJuegoSchema.parse(valor) as unknown as DefinicionJuego;
}
