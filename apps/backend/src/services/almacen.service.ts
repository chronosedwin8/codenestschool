/**
 * Donde se guarda la multimedia de los juegos.
 *
 * Un único sitio para construir el cliente de S3, por dos razones:
 *
 *  1. **Sin credenciales la aplicación tiene que seguir funcionando.** En un
 *     portátil de desarrollo nadie debería necesitar una cuenta de AWS para
 *     abrir el constructor: sin S3, los escenarios se pintan con un degradado y
 *     las portadas no se guardan. Eso se decide aquí y no en cada llamada.
 *  2. Las rutas del bucket viven en un solo archivo. Un prefijo escrito a mano
 *     en tres sitios acaba siendo tres prefijos distintos.
 */
import { cargarConfig, almacenConfigurado, type Config } from '../lib/env.js';
import { ClienteS3 } from '../lib/s3.js';

let cliente: ClienteS3 | null = null;
let intentado = false;

/** El cliente, o null si este despliegue no tiene almacenamiento. */
export function almacen(config: Config = cargarConfig()): ClienteS3 | null {
  if (intentado) return cliente;
  intentado = true;

  if (!almacenConfigurado(config)) return null;

  cliente = new ClienteS3({
    bucket: config.S3_BUCKET!,
    region: config.S3_REGION,
    accessKeyId: config.S3_ACCESS_KEY_ID!,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
    urlPublica: config.S3_PUBLIC_URL,
  });
  return cliente;
}

/** Solo para las pruebas: olvida el cliente construido. */
export function olvidarAlmacen(): void {
  cliente = null;
  intentado = false;
}

// ───────────────────────── Rutas dentro del bucket ────────────────────────

export const RUTAS = {
  escenario: (clave: string): string => `catalogo/escenarios/${clave}.jpg`,
  musica: (clave: string): string => `catalogo/musica/${clave}.mp3`,
  portada: (proyectoId: number): string => `proyectos/${proyectoId}/portada.jpg`,
  diploma: (codigo: string): string => `diplomas/${codigo}.png`,
} as const;

/** La dirección pública de un escenario, o null si no hay almacenamiento. */
export function urlEscenario(clave: string): string | null {
  return almacen()?.urlDe(RUTAS.escenario(clave)) ?? null;
}

export function urlMusica(clave: string): string | null {
  return almacen()?.urlDe(RUTAS.musica(clave)) ?? null;
}

/** Tamaño máximo de una portada. Una captura de 640x360 en JPEG no llega a 100 KB. */
const MAX_PORTADA_BYTES = 400_000;

export class ErrorAlmacen extends Error {
  constructor(
    message: string,
    readonly codigo: number = 400,
  ) {
    super(message);
    this.name = 'ErrorAlmacen';
  }
}

/**
 * Guarda la portada de un juego a partir de la captura que manda el navegador.
 *
 * Llega como `data:image/jpeg;base64,…` porque el navegador la saca del propio
 * lienzo del juego con `toDataURL`. Se comprueban el tipo y el tamaño **antes**
 * de descodificar: una cadena de veinte megas en base64 no debe llegar a
 * convertirse en un búfer de quince.
 */
export async function guardarPortada(proyectoId: number, dataUrl: string): Promise<string | null> {
  const s3 = almacen();
  if (!s3) return null;

  const coincidencia = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!coincidencia) throw new ErrorAlmacen('La portada no es una imagen valida');

  const [, formato, base64] = coincidencia;
  // 4 caracteres de base64 son 3 bytes: se estima antes de descodificar.
  if ((base64!.length * 3) / 4 > MAX_PORTADA_BYTES) {
    throw new ErrorAlmacen('La portada es demasiado grande');
  }

  const bytes = Buffer.from(base64!, 'base64');
  if (bytes.length > MAX_PORTADA_BYTES) {
    throw new ErrorAlmacen('La portada es demasiado grande');
  }

  // Siempre con el mismo nombre: al volver a publicar se sustituye, y no se
  // acumulan portadas viejas que nadie va a mirar.
  return s3.subir(
    RUTAS.portada(proyectoId),
    bytes,
    `image/${formato === 'png' ? 'png' : 'jpeg'}`,
    // Corta: la portada cambia cuando el estudiante cambia su juego.
    'public, max-age=300',
  );
}

/** Borra la multimedia de un proyecto. Se llama al borrar el proyecto. */
export async function borrarMultimediaDe(proyectoId: number): Promise<void> {
  const s3 = almacen();
  if (!s3) return;
  // Un fallo aqui no puede impedir que el estudiante borre su juego.
  await s3.borrar(RUTAS.portada(proyectoId)).catch(() => undefined);
}
