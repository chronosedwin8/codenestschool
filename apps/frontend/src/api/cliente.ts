/**
 * Cliente de la API.
 *
 * Es `fetch` envuelto, sin librería de por medio: lo único que hacía falta era
 * añadir el token, resolver el JSON y dar un error legible. Traer axios para eso
 * habría sumado peso al paquete que descarga la tableta de un colegio.
 */
const BASE = '/api';
const CLAVE_TOKEN = 'codenest.token';

/** Error de la API con el código de estado, para poder distinguir un 401. */
export class ErrorApi extends Error {
  constructor(
    message: string,
    readonly estado: number,
    readonly detalles?: unknown,
  ) {
    super(message);
    this.name = 'ErrorApi';
  }
}

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    // Modo privado o almacenamiento bloqueado: la sesión dura lo que la pestaña.
    return null;
  }
}

export function guardarToken(token: string): void {
  try {
    localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento, el token vive en memoria hasta recargar.
  }
}

export function borrarToken(): void {
  try {
    localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Nada que borrar.
  }
}

/**
 * El rol que lleva el token, sin verificarlo.
 *
 * Sirve para decidir que se muestra, nunca a que datos se accede: eso lo decide
 * el servidor. Manipular el token solo consigue ver una pantalla que la API va
 * a rechazar igual.
 */
export function rolDelToken(): string | null {
  const token = leerToken();
  if (!token) return null;
  try {
    const carga = token.split('.')[1];
    if (!carga) return null;
    const json = atob(carga.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { rol?: string }).rol ?? null;
  } catch {
    return null;
  }
}

interface RespuestaError {
  readonly error?: string;
  readonly mensaje?: string;
  readonly detalles?: unknown;
}

async function peticion<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: unknown,
): Promise<T> {
  const token = leerToken();

  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  if (respuesta.status === 204) return undefined as T;

  const datos = (await respuesta.json().catch(() => ({}))) as T & RespuestaError;

  if (!respuesta.ok) {
    // Un token caducado no debe dejar al niño en una pantalla rota.
    if (respuesta.status === 401 && token) borrarToken();

    throw new ErrorApi(
      datos.mensaje ?? datos.error ?? 'No se pudo completar la operacion',
      respuesta.status,
      datos.detalles,
    );
  }

  return datos;
}

export const api = {
  get: <T>(ruta: string): Promise<T> => peticion<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo?: unknown): Promise<T> => peticion<T>('POST', ruta, cuerpo),
  put: <T>(ruta: string, cuerpo?: unknown): Promise<T> => peticion<T>('PUT', ruta, cuerpo),
  patch: <T>(ruta: string, cuerpo?: unknown): Promise<T> => peticion<T>('PATCH', ruta, cuerpo),
  delete: <T>(ruta: string): Promise<T> => peticion<T>('DELETE', ruta),
};
