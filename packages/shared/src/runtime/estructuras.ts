/**
 * Qué estructuras usa un programa escrito en JavaScript.
 *
 * La tercera estrella de muchas actividades no pide llegar a la meta: pide
 * llegar usando cierta herramienta. El mundo 13 pide una función propia, el 17
 * un bucle condicional, el 14 un si con su rama contraria. Para concederla hay
 * que saber qué usó el programa, y eso se decide sobre el código.
 *
 * Vive aquí, en el paquete compartido, porque tres sitios necesitan exactamente
 * la misma respuesta:
 *
 *   - el editor, que informa de lo que ha usado el niño,
 *   - el servidor, que recalcula las estrellas y no se cree al cliente,
 *   - y `validate-content`, que comprueba que la solución de referencia cumple
 *     lo que su propia actividad exige.
 *
 * Estaba duplicada en el editor y en el validador, y las dos copias no decían lo
 * mismo. El editor daba por buena una función en cualquier programa que llevara
 * un `repetir`, porque el bucle se genera como `repetir(3, () => { ... })` y esa
 * flecha parecía una función del niño. El resultado era que la tercera estrella
 * del mundo de las funciones se conseguía sin escribir ninguna, y como el
 * servidor confía en la lista que le manda el editor, se concedía de verdad.
 */

/** Detecta las estructuras de un programa en JavaScript. */
export function estructurasDelCodigo(codigo: string): string[] {
  const encontradas = new Set<string>();

  // Bucle contado: `repetir(n, () => {...})` de los bloques, o un `for` escrito.
  if (/\brepetir\s*\(|\bfor\s*\(/.test(codigo)) encontradas.add('repetir');

  // Bucle condicional. Blockly genera el "hasta" como un while con la condicion
  // negada, asi que la negacion es lo que los distingue.
  if (/\bwhile\s*\(/.test(codigo)) {
    encontradas.add('mientras');
    if (/\bwhile\s*\(\s*!/.test(codigo)) encontradas.add('hasta');
  }
  if (/\bdo\s*\{/.test(codigo)) encontradas.add('mientras');

  // Condicionales, y de que sensor dependen.
  if (/\bif\s*\(/.test(codigo)) {
    encontradas.add('si');
    if (/\belse\b/.test(codigo)) encontradas.add('sino');
    if (/fuzz\.colorCasilla\s*\(\s*\)/.test(codigo)) encontradas.add('siColor');
    if (/fuzz\.(puedeAvanzar|hayObstaculo)\s*\(\s*\)/.test(codigo)) encontradas.add('siSino');
  }

  // Operadores logicos: el mundo 15 los exige.
  if (/&&|\|\|/.test(codigo)) encontradas.add('logica');

  /**
   * Funcion propia del nino.
   *
   * Cuenta la palabra `function` en cualquiera de sus formas, porque en el mundo 25
   * una funcion se guarda en una variable o dentro de un objeto y sigue siendo una
   * funcion suya.
   *
   * Lo que NO cuenta es la flecha suelta que va como argumento: el bucle de los
   * bloques se genera como `repetir(3, () => ...)`, y esa flecha es del generador y
   * no del nino. Darla por buena hacia que la tercera estrella del mundo de las
   * funciones se consiguiera sin escribir ninguna. Una flecha guardada detras de un
   * igual o de dos puntos si cuenta: eso lo ha escrito alguien.
   */
  const flechaGuardada = /[=:]\s*(?:async\s*)?\([^)]*\)\s*=>/.test(codigo);
  if (/\bfunction\b/.test(codigo) || flechaGuardada) {
    encontradas.add('funcion');

    const conParametros =
      /\bfunction\s*[A-Za-z_$][\w$]*\s*\(\s*[A-Za-z_$][^)]*\)/.test(codigo) ||
      /\bfunction\s*\(\s*[A-Za-z_$][^)]*\)/.test(codigo) ||
      /[=:]\s*\(\s*[A-Za-z_$][^)]*\)\s*=>/.test(codigo);
    if (conParametros) encontradas.add('parametro');
  }

  /**
   * Variables declaradas por el nino.
   *
   * No se exige el igual en la misma linea: Blockly declara arriba (`var pasos;`)
   * y asigna despues (`pasos = 4;`). Pedir `var pasos = 4` dejaba sin la tercera
   * estrella al mundo 12 entero, porque ningun programa real de Blockly tiene esa
   * forma.
   */
  if (/\b(let|var|const)\s+[A-Za-z_$][\w$]*/.test(codigo)) encontradas.add('variable');

  // Listas: un literal con corchetes, no un acceso por indice.
  if (/=\s*\[|\[\s*\d+\s*,/.test(codigo)) encontradas.add('lista');

  return [...encontradas];
}
