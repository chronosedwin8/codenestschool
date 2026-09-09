/**
 * Logica de juego pura (sin DOM, sin Phaser, sin Prisma).
 *
 * FASE 1.5 implementara aqui:
 *  - GridSimulator.ts : simulador de rejilla (modos `rodar` y `paso`), unica
 *    semantica compartida por el Web Worker, el renderizador y el backend.
 *  - stars.ts         : calculo de estrellas (objetivos + maxFichas + maxInstrucciones).
 *  - pylite/          : transpilador de un subconjunto de Python a JavaScript
 *    para los mundos 21-30 (sin Pyodide, sin dependencias nuevas).
 *
 * Se deja el modulo declarado para que las referencias de proyecto de
 * TypeScript y los `exports` del paquete existan desde la FASE 1.
 */
export const RUNTIME_VERSION = '0.1.0';
