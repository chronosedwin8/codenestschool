/**
 * Logica de juego pura: sin DOM, sin Phaser, sin Prisma.
 *
 * La comparten el Web Worker (mientras el nino juega), el renderizador de
 * Phaser (para animar) y el backend (para recalcular estrellas sin ejecutar
 * codigo del alumno).
 *
 * Pendiente de la fase 4: pylite/, el transpilador de un subconjunto de Python
 * a JavaScript para los mundos 21-30.
 */
export * from './GridSimulator.js';
export * from './stars.js';

export const RUNTIME_VERSION = '0.2.0';
