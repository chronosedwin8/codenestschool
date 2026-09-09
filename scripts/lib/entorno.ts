/**
 * Carga el archivo .env de la raiz del repositorio.
 *
 * Node 24 trae `process.loadEnvFile`, asi que no hace falta la dependencia
 * `dotenv` solo para esto. Los scripts se ejecutan desde cualquier directorio, de
 * modo que la ruta se resuelve desde la ubicacion del propio script y no desde el
 * directorio de trabajo.
 *
 * Es idempotente y silencioso si el archivo no existe: en integracion continua las
 * variables vienen del entorno, no de un archivo.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let cargado = false;

/** Ruta del .env de la raiz del monorepo. */
export const RUTA_ENV = resolve(import.meta.dirname, '..', '..', '.env');

export function cargarEntorno(): void {
  if (cargado) return;
  cargado = true;

  if (!existsSync(RUTA_ENV)) return;

  try {
    process.loadEnvFile(RUTA_ENV);
  } catch (error) {
    // Un .env mal formado no debe tumbar el script sin explicacion.
    console.warn(
      `Aviso: no se pudo leer ${RUTA_ENV}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
