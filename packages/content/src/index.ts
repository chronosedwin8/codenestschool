/**
 * Contenido de CodeNest School.
 *
 * Este punto de entrada es isomorfo: funciona igual en el navegador y en Node. El
 * frontend importa de aqui la historia, las voces y los textos.
 *
 * El cargador de archivos de mundo NO esta aqui a proposito: usa `node:fs` y al
 * incluirlo el empaquetador del navegador fallaba al no encontrar `resolve`. Vive
 * en `@codenest/content/loader`, que solo importan el seed y los scripts.
 */
export * from './voices.js';
export * from './ui-phrases.js';
export * from './generadores.js';
export * from './historia.js';
export * from './continuidad.js';
