/**
 * Memoria de las cinematicas ya vistas.
 *
 * Una cinematica se ve una vez. Volver a verla cada vez que se entra a un mundo
 * pasaria de ser un regalo a ser un peaje, y el nino aprenderia a saltarla sin
 * mirarla, que es justo lo contrario de lo que se busca.
 *
 * Se guarda en el dispositivo y no en el servidor a proposito: es una preferencia
 * de comodidad, no un dato del nino. Si se pierde, lo peor que pasa es que se ve
 * una historia otra vez.
 */
const CLAVE = 'codenest.cinematicas-vistas';

function leerVistas(): string[] {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return guardado ? (JSON.parse(guardado) as string[]) : [];
  } catch {
    // Modo privado o almacenamiento bloqueado: se vuelve a ver. Molesto, no roto.
    return [];
  }
}

export function yaSeVio(clave: string): boolean {
  return leerVistas().includes(clave);
}

export function marcarVista(clave: string): void {
  try {
    const vistas = leerVistas();
    if (!vistas.includes(clave)) {
      localStorage.setItem(CLAVE, JSON.stringify([...vistas, clave]));
    }
  } catch {
    // Sin almacenamiento no se recuerda.
  }
}

/** Olvida todas: la usa la vista de diseno para poder revisarlas. */
export function olvidarCinematicas(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que olvidar.
  }
}

/** Clave de la cinematica de entrada a un mundo. */
export const claveEntrada = (mundo: number): string => `mundo-${mundo}-entrada`;
/** Clave de la cinematica de rescate al completar un mundo. */
export const claveRescate = (mundo: number): string => `mundo-${mundo}-rescate`;
/** Clave del puente al mundo siguiente, que se ve al terminar el mundo `mundo`. */
export const claveTransicion = (mundo: number): string => `mundo-${mundo}-paso`;
/** Clave de la apertura general. */
export const CLAVE_APERTURA = 'apertura';
