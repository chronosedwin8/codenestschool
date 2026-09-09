/**
 * Freno de intentos por cuenta.
 *
 * Existe porque el límite de peticiones de Fastify solo puede mirar la dirección
 * IP: se aplica en el gancho `onRequest`, antes de que el cuerpo esté leído, así
 * que no hay forma de contar por nombre de usuario desde ahí.
 *
 * Y contar solo por IP no sirve para el acceso infantil: un aula de treinta niños
 * comparte la red del colegio y entra a la vez. Un tope bajo por IP los bloquea a
 * todos; un tope alto deja la puerta abierta a probar un PIN de cuatro dibujos por
 * fuerza bruta.
 *
 * La solución es separar las dos cosas: el límite por IP se deja generoso (cabe un
 * aula), y aquí se cuentan los intentos FALLIDOS por cuenta. Treinta niños
 * entrando bien no suman ni un intento; treinta intentos contra la misma cuenta se
 * bloquean.
 *
 * Los contadores viven en memoria a propósito. Si el servidor se reinicia se
 * pierden, y eso es aceptable: no es un registro de auditoría, es un freno. Si
 * algún día hay varias instancias detrás de un balanceador, esto tendrá que
 * mudarse a un almacén compartido.
 */

/** Intentos fallidos consecutivos antes de bloquear una cuenta. */
export const MAX_FALLOS = 6;
/** Cuánto dura el bloqueo. */
export const BLOQUEO_MS = 5 * 60 * 1000;
/** Tras cuánto tiempo sin fallos se olvida el contador. */
export const OLVIDO_MS = 15 * 60 * 1000;

interface Registro {
  fallos: number;
  ultimoFallo: number;
  bloqueadoHasta: number;
}

const registros = new Map<string, Registro>();

/** Limpieza perezosa: se hace al consultar, sin temporizadores de fondo. */
function limpiarSiToca(clave: string, ahora: number): Registro | undefined {
  const registro = registros.get(clave);
  if (!registro) return undefined;

  if (registro.bloqueadoHasta > ahora) return registro;

  // El bloqueo caducó o hace mucho que no falla: se olvida.
  if (ahora - registro.ultimoFallo > OLVIDO_MS) {
    registros.delete(clave);
    return undefined;
  }

  return registro;
}

export interface EstadoIntentos {
  readonly bloqueado: boolean;
  /** Segundos que faltan para poder volver a intentar. */
  readonly esperaSegundos: number;
  readonly fallos: number;
}

/** Consulta si una cuenta puede intentar entrar ahora mismo. */
export function comprobarIntentos(clave: string): EstadoIntentos {
  const ahora = Date.now();
  const registro = limpiarSiToca(clave.toLowerCase(), ahora);

  if (!registro) return { bloqueado: false, esperaSegundos: 0, fallos: 0 };

  const bloqueado = registro.bloqueadoHasta > ahora;
  return {
    bloqueado,
    esperaSegundos: bloqueado ? Math.ceil((registro.bloqueadoHasta - ahora) / 1000) : 0,
    fallos: registro.fallos,
  };
}

/** Anota un intento fallido y bloquea la cuenta si se pasa del tope. */
export function anotarFallo(clave: string): EstadoIntentos {
  const id = clave.toLowerCase();
  const ahora = Date.now();
  const registro = limpiarSiToca(id, ahora) ?? { fallos: 0, ultimoFallo: 0, bloqueadoHasta: 0 };

  registro.fallos += 1;
  registro.ultimoFallo = ahora;

  if (registro.fallos >= MAX_FALLOS) {
    registro.bloqueadoHasta = ahora + BLOQUEO_MS;
    // El contador se reinicia: al salir del bloqueo se dan otras oportunidades,
    // en lugar de quedar bloqueado para siempre tras seis errores.
    registro.fallos = 0;
  }

  registros.set(id, registro);

  const bloqueado = registro.bloqueadoHasta > ahora;
  return {
    bloqueado,
    esperaSegundos: bloqueado ? Math.ceil((registro.bloqueadoHasta - ahora) / 1000) : 0,
    fallos: registro.fallos,
  };
}

/** Borra el contador de una cuenta tras un acceso correcto. */
export function olvidarFallos(clave: string): void {
  registros.delete(clave.toLowerCase());
}

/** Vacía todos los contadores. Solo para las pruebas. */
export function reiniciarIntentos(): void {
  registros.clear();
}
