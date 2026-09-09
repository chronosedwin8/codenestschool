/**
 * Logica de juego pura: sin DOM, sin Phaser, sin Prisma.
 *
 * La comparten el Web Worker (mientras el nino juega), el renderizador de
 * Phaser (para animar) y el backend (para recalcular estrellas sin ejecutar
 * codigo del alumno).
 *
 * pylite traduce un subconjunto de Python a JavaScript para los mundos 21-30,
 * de modo que los dos lenguajes acaben en el mismo sandbox.
 */
export * from './GridSimulator.js';
export * from './stars.js';
export * from './interpretarFichas.js';
export * from './estructuras.js';
export * from './pylite/index.js';

export const RUNTIME_VERSION = '0.3.0';
