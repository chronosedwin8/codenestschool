/**
 * Copia recuperable del PIN de imagenes de un estudiante.
 *
 * POR QUE EXISTE. El PIN se guarda con bcrypt, que es de un solo sentido: ni el
 * servidor puede leerlo. Eso esta bien para una contrasena, pero rompe una
 * necesidad real del aula: el docente reparte los PIN en clase, los escribe en
 * la pizarra, y un nino de cinco anos los olvida entre el lunes y el martes. Sin
 * poder consultarlos, la unica salida seria reasignar el PIN de medio grupo cada
 * semana.
 *
 * QUE NO ES. No sustituye al hash. El acceso se sigue verificando contra
 * `pinHash`, asi que esta columna no es una via de entrada: quien se lleve la
 * base de datos no puede entrar con ella, y sin la clave del `.env` tampoco
 * puede leerla.
 *
 * LO QUE SE ACEPTA A CAMBIO. Es una credencial de un menor guardada de forma
 * recuperable, y eso hay que sostenerlo con tres cosas: cifrado autenticado
 * (AES-256-GCM, que ademas detecta manipulacion), acceso limitado al docente
 * dueno del aula, y una anotacion en `auditoria_accesos` cada vez que alguien
 * los mira. Un PIN de cuatro imagenes de nueve son 6.561 combinaciones: nunca
 * fue un secreto fuerte, y se publica en clase de todos modos.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Marca de version del formato, para poder rotar el cifrado mas adelante. */
const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';
const BYTES_IV = 12;

/**
 * Deriva la clave de 32 bytes a partir del secreto del entorno.
 *
 * Se admite un secreto de cualquier longitud y se normaliza con sha256, para que
 * configurar esto no obligue a generar exactamente 32 bytes en base64.
 */
function clave(secreto: string): Buffer {
  return createHash('sha256').update(secreto, 'utf8').digest();
}

/** Cierto si el entorno esta configurado para poder mostrar los PIN. */
export function hayClaveDePin(secreto: string | undefined): secreto is string {
  return typeof secreto === 'string' && secreto.length >= 16;
}

/**
 * Cifra un PIN ya normalizado (por ejemplo "gato|sol|luna|flor").
 *
 * El resultado es `v1:iv:tag:texto`, todo en base64url, que cabe de sobra en los
 * 255 caracteres de la columna.
 */
export function cifrarPin(pinNormalizado: string, secreto: string): string {
  const iv = randomBytes(BYTES_IV);
  const cifrador = createCipheriv(ALGORITMO, clave(secreto), iv);
  const texto = Buffer.concat([cifrador.update(pinNormalizado, 'utf8'), cifrador.final()]);
  const tag = cifrador.getAuthTag();

  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), texto.toString('base64url')].join(
    ':',
  );
}

/**
 * Descifra un PIN guardado. Devuelve null si el dato no es legible.
 *
 * Se prefiere null a lanzar: una fila vieja, cifrada con otro secreto o
 * manipulada, no debe tumbar la lista entera de una clase de treinta. El docente
 * vera ese estudiante sin PIN visible y podra asignarle uno nuevo.
 */
export function descifrarPin(guardado: string, secreto: string): string | null {
  try {
    const [version, ivB64, tagB64, textoB64] = guardado.split(':');
    if (version !== VERSION || !ivB64 || !tagB64 || !textoB64) return null;

    const descifrador = createDecipheriv(ALGORITMO, clave(secreto), Buffer.from(ivB64, 'base64url'));
    descifrador.setAuthTag(Buffer.from(tagB64, 'base64url'));

    return Buffer.concat([
      descifrador.update(Buffer.from(textoB64, 'base64url')),
      descifrador.final(),
    ]).toString('utf8');
  } catch {
    // Etiqueta que no cuadra, secreto cambiado o dato corrupto.
    return null;
  }
}

/** Convierte el PIN guardado a la lista de imagenes que entiende la interfaz. */
export function pinAImagenes(pinNormalizado: string): string[] {
  return pinNormalizado.split('|').filter((i) => i.length > 0);
}
