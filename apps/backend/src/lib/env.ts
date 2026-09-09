/**
 * Configuracion del servidor validada al arrancar.
 *
 * Si falta algo esencial el proceso no arranca: es preferible un fallo
 * inmediato y claro a un servidor en pie con un secreto de relleno. Codexia
 * tenia un JWT_SECRET por defecto en el codigo; aqui es obligatorio.
 */
import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres. Genera uno aleatorio.'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3001'),
  TZ: z.string().default('America/Bogota'),

  // Mercado Pago: opcionales en desarrollo, obligatorios para cobrar.
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_PUBLIC_KEY: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),

  // Precios en pesos colombianos. El servidor nunca confia en el cliente.
  PRECIO_PERSONAL_COP: z.coerce.number().int().positive().default(180_000),
  PRECIO_PADRES_COP: z.coerce.number().int().positive().default(480_000),
  PRECIO_ESCUELA_COP: z.coerce.number().int().positive().default(12_000_000),
});

export type Config = z.infer<typeof esquema>;

let cache: Config | null = null;

export function cargarConfig(): Config {
  if (cache) return cache;

  const resultado = esquema.safeParse(process.env);
  if (!resultado.success) {
    const detalles = Object.entries(resultado.error.flatten().fieldErrors)
      .map(([campo, errores]) => `  ${campo}: ${(errores ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`Configuracion invalida:\n${detalles}`);
  }

  cache = resultado.data;
  return cache;
}

/** Indica si la pasarela de pago esta configurada. */
export function pagosConfigurados(config: Config): boolean {
  return Boolean(config.MP_ACCESS_TOKEN && config.MP_PUBLIC_KEY);
}
