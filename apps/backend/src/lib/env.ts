/**
 * Configuracion del servidor validada al arrancar.
 *
 * Si falta algo esencial el proceso no arranca: es preferible un fallo
 * inmediato y claro a un servidor en pie con un secreto de relleno. Codexia
 * tenia un JWT_SECRET por defecto en el codigo; aqui es obligatorio.
 */
import { z } from 'zod';

/**
 * Opcional de verdad: una variable vacia es una variable sin poner.
 *
 * En un `.env` lo normal es dejar `PIN_SECRET=` escrito y sin valor, y eso llega
 * aqui como cadena vacia, no como ausente: `z.string().min(16).optional()` la
 * daba por presente y el servidor no arrancaba con un mensaje que no explicaba
 * nada. Quien copie `.env.example` tiene que poder arrancar.
 */
function opcional<T extends z.ZodTypeAny>(esquema: T) {
  return z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    esquema.optional(),
  );
}

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

  /**
   * Clave con la que se cifra la copia recuperable del PIN de los estudiantes.
   *
   * Es opcional: sin ella el juego funciona igual y el portal del docente
   * muestra los PIN como "no disponible" en vez de fallar. Solo hace falta en un
   * despliegue de colegio, donde el docente necesita poder consultarlos.
   */
  PIN_SECRET: opcional(z.string().min(16, 'PIN_SECRET debe tener al menos 16 caracteres')),

  /**
   * Sistema academico del colegio. Solo el servidor lo usa.
   *
   * El token abre el expediente de mas de mil menores, asi que no baja nunca al
   * navegador: si falta, la importacion simplemente no aparece en el portal.
   */
  PHIDIAS_BASE_URL: opcional(z.string().url()),
  PHIDIAS_TOKEN: opcional(z.string().min(20)),

  /**
   * Entra ID (Microsoft 365) del colegio, para entrar con la cuenta corporativa.
   *
   * Los tres van juntos: si falta uno, el boton de "entrar con el correo del
   * colegio" simplemente no aparece y se sigue entrando con contrasena. Es
   * deliberado: un despliegue sin Microsoft detras tiene que funcionar igual.
   */
  ENTRA_TENANT_ID: opcional(z.string().uuid()),
  ENTRA_CLIENT_ID: opcional(z.string().uuid()),
  ENTRA_CLIENT_SECRET: opcional(z.string().min(10)),

  /**
   * Dominios de correo admitidos, separados por comas.
   *
   * Es la frontera de verdad: el inquilino es del colegio, pero un invitado
   * externo dentro de ese inquilino tambien recibiria un token valido. Sin esta
   * lista, cualquier cuenta invitada entraria a una plataforma de menores.
   */
  SSO_DOMINIOS: z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    z.string().default('colegioaleman.edu.co'),
  ),

  /**
   * Que rol se le da a quien entra por SSO y todavia no tiene cuenta.
   *
   * Vacio (lo normal) = no se crea nada: quien no tenga cuenta recibe un aviso y
   * el administrador se la crea. Crear cuentas solas es comodo hasta que un
   * estudiante con correo del colegio se convierte en docente sin que nadie lo
   * decida.
   */
  SSO_ALTA_AUTOMATICA: opcional(z.enum(['tutor', 'docente'])),

  /**
   * Si las cuentas del dominio DEBEN entrar por SSO.
   *
   * Con esto en `true`, a un correo @colegioaleman.edu.co se le rechaza la
   * contrasena y se le manda a Microsoft: la validacion del colegio (segundo
   * factor incluido) pasa a ser obligatoria y no una alternativa.
   */
  SSO_OBLIGATORIO: z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  ),

  // Mercado Pago: opcionales en desarrollo, obligatorios para cobrar.
  MP_ACCESS_TOKEN: opcional(z.string()),
  MP_PUBLIC_KEY: opcional(z.string()),
  MP_WEBHOOK_SECRET: opcional(z.string()),

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

/** Indica si se puede entrar con la cuenta del colegio. */
export function ssoConfigurado(config: Config): boolean {
  return Boolean(config.ENTRA_TENANT_ID && config.ENTRA_CLIENT_ID && config.ENTRA_CLIENT_SECRET);
}

/** Dominios de correo admitidos por el SSO, ya normalizados. */
export function dominiosSso(config: Config): string[] {
  return config.SSO_DOMINIOS.split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter((d) => d.length > 0);
}

/** Indica si la pasarela de pago esta configurada. */
export function pagosConfigurados(config: Config): boolean {
  return Boolean(config.MP_ACCESS_TOKEN && config.MP_PUBLIC_KEY);
}
