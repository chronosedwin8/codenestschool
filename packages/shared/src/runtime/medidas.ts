/**
 * Cómo se mide el tamaño de un programa escrito.
 *
 * Vive en el paquete compartido porque cuatro sitios tienen que dar exactamente el
 * mismo número, y cuando no lo daban la tercera estrella de los mundos de texto era
 * imposible de conseguir:
 *
 *   - el editor del niño, que informa de cuántas líneas ha escrito,
 *   - el generador de contenido, que fija el límite a partir de la solución,
 *   - `validate-content`, que comprueba que la solución cabe en su propio límite,
 *   - y el servidor, que recalcula las estrellas y no se cree al cliente.
 *
 * La regla es la de abajo y tiene dos decisiones dentro:
 *
 *   Los comentarios no cuentan. Un programa comentado no debe salir más caro que el
 *   mismo programa sin explicar, porque entonces el límite castigaría justo lo que
 *   se quiere enseñar.
 *
 *   Las llaves solas tampoco. Python no las tiene, así que contarlas haría que el
 *   mismo programa midiera más en JavaScript y la misma actividad fuera más difícil
 *   de puntuar en un lenguaje que en el otro. Y eso no es lo que se está evaluando.
 *
 * El fallo original: el editor filtraba los comentarios y no las llaves, y el
 * generador filtraba las dos cosas. Todo programa de JavaScript con una llave de
 * cierre en su línea (o sea, todos) medía más de lo que su propia actividad
 * permitía, así que ningún niño podía sacar tres estrellas de los mundos 21 al 30.
 * Lo encontró la prueba que juega las actividades contra el servidor de verdad, no
 * el validador: el validador usaba la misma cuenta que el generador y los dos
 * estaban de acuerdo en el número equivocado.
 */

/** Líneas con contenido real de un programa. */
export function lineasDeCodigo(codigo: string): number {
  return codigo
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(
      (linea) =>
        linea.length > 0 &&
        !linea.startsWith('//') &&
        !linea.startsWith('#') &&
        linea !== '{' &&
        linea !== '}' &&
        linea !== '});' &&
        linea !== '};',
    ).length;
}
