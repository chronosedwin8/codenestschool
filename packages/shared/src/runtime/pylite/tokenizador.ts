/**
 * Tokenizador de un subconjunto de Python.
 *
 * Python no delimita los bloques con llaves sino con sangría, y eso es lo único
 * que un tokenizador corriente no sabe hacer. Aquí se resuelve como lo hace
 * CPython: se lleva una pila de niveles de sangría y se emiten testigos INDENT y
 * DEDENT cuando cambia. Con eso, el analizador que viene después puede trabajar
 * igual que con un lenguaje de llaves.
 *
 * Se cubre lo que necesitan los mundos 21 al 30, sin más: asignaciones, for con
 * range, while, if/elif/else, def, listas, aritmética y comparaciones. Nada de
 * clases, decoradores, generadores ni importaciones. Es deliberado: un
 * transpilador pequeño y comprensible vale más aquí que uno completo y opaco.
 */

export type TipoToken =
  | 'numero'
  | 'texto'
  | 'nombre'
  | 'palabraClave'
  | 'operador'
  | 'delimitador'
  | 'nuevaLinea'
  | 'indent'
  | 'dedent'
  | 'fin';

export interface Token {
  readonly tipo: TipoToken;
  readonly valor: string;
  readonly linea: number;
  readonly columna: number;
}

/** Palabras reservadas del subconjunto admitido. */
export const PALABRAS_CLAVE = new Set([
  'if',
  'elif',
  'else',
  'for',
  'in',
  'while',
  'def',
  'return',
  'and',
  'or',
  'not',
  'True',
  'False',
  'None',
  'break',
  'continue',
  'range',
  'len',
  'pass',
]);

/** Operadores, de más largo a más corto para no partir los de dos caracteres. */
const OPERADORES = [
  '**',
  '//',
  '==',
  '!=',
  '<=',
  '>=',
  '+=',
  '-=',
  '*=',
  '/=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '=',
];

const DELIMITADORES = new Set(['(', ')', '[', ']', '{', '}', ',', ':', '.']);

/** Error de sintaxis con la línea, para poder señalarla en el editor. */
export class ErrorSintaxisPython extends Error {
  constructor(
    message: string,
    readonly linea: number,
  ) {
    super(message);
    this.name = 'ErrorSintaxisPython';
  }
}

export function tokenizar(codigo: string): Token[] {
  const tokens: Token[] = [];
  const pilaSangria: number[] = [0];
  const lineas = codigo.replace(/\r\n?/g, '\n').split('\n');

  /** Paréntesis abiertos: dentro de ellos la sangría no cuenta. */
  let profundidad = 0;

  for (const [indice, textoLinea] of lineas.entries()) {
    const numeroLinea = indice + 1;

    // Líneas vacías o de solo comentario no afectan a la sangría.
    const sinComentario = textoLinea.replace(/#.*$/, '');
    if (sinComentario.trim() === '') continue;

    let posicion = 0;

    // La sangría solo se mide al principio de una línea lógica.
    if (profundidad === 0) {
      let sangria = 0;
      while (posicion < sinComentario.length) {
        const caracter = sinComentario[posicion];
        if (caracter === ' ') sangria += 1;
        else if (caracter === '\t') sangria += 4;
        else break;
        posicion += 1;
      }

      const nivelActual = pilaSangria.at(-1) ?? 0;

      if (sangria > nivelActual) {
        pilaSangria.push(sangria);
        tokens.push({ tipo: 'indent', valor: '', linea: numeroLinea, columna: 0 });
      } else if (sangria < nivelActual) {
        // Puede cerrarse más de un nivel de golpe.
        while ((pilaSangria.at(-1) ?? 0) > sangria) {
          pilaSangria.pop();
          tokens.push({ tipo: 'dedent', valor: '', linea: numeroLinea, columna: 0 });
        }
        if ((pilaSangria.at(-1) ?? 0) !== sangria) {
          throw new ErrorSintaxisPython(
            `La sangria de la linea ${numeroLinea} no coincide con ningun bloque abierto.`,
            numeroLinea,
          );
        }
      }
    }

    // Cuerpo de la línea.
    while (posicion < sinComentario.length) {
      const caracter = sinComentario[posicion];
      if (caracter === undefined) break;

      if (caracter === ' ' || caracter === '\t') {
        posicion += 1;
        continue;
      }

      // Números.
      if (/[0-9]/.test(caracter)) {
        let numero = '';
        while (posicion < sinComentario.length && /[0-9.]/.test(sinComentario[posicion] ?? '')) {
          numero += sinComentario[posicion];
          posicion += 1;
        }
        tokens.push({ tipo: 'numero', valor: numero, linea: numeroLinea, columna: posicion });
        continue;
      }

      // Cadenas: comillas simples o dobles, sin saltos de línea dentro.
      if (caracter === '"' || caracter === "'") {
        const comilla = caracter;
        posicion += 1;
        let texto = '';
        while (posicion < sinComentario.length && sinComentario[posicion] !== comilla) {
          // Se admite el escape básico para no romper con \' o \".
          if (sinComentario[posicion] === '\\') {
            texto += sinComentario[posicion];
            posicion += 1;
          }
          texto += sinComentario[posicion];
          posicion += 1;
        }
        if (sinComentario[posicion] !== comilla) {
          throw new ErrorSintaxisPython(
            `Falta cerrar la comilla en la linea ${numeroLinea}.`,
            numeroLinea,
          );
        }
        posicion += 1;
        tokens.push({ tipo: 'texto', valor: texto, linea: numeroLinea, columna: posicion });
        continue;
      }

      // Nombres y palabras clave.
      if (/[A-Za-z_]/.test(caracter)) {
        let nombre = '';
        while (posicion < sinComentario.length && /[A-Za-z0-9_]/.test(sinComentario[posicion] ?? '')) {
          nombre += sinComentario[posicion];
          posicion += 1;
        }
        tokens.push({
          tipo: PALABRAS_CLAVE.has(nombre) ? 'palabraClave' : 'nombre',
          valor: nombre,
          linea: numeroLinea,
          columna: posicion,
        });
        continue;
      }

      // Operadores de dos caracteres antes que los de uno.
      const dos = sinComentario.slice(posicion, posicion + 2);
      const operador = OPERADORES.find((op) => op.length === 2 && op === dos)
        ?? OPERADORES.find((op) => op.length === 1 && op === caracter);

      if (operador) {
        tokens.push({ tipo: 'operador', valor: operador, linea: numeroLinea, columna: posicion });
        posicion += operador.length;
        continue;
      }

      if (DELIMITADORES.has(caracter)) {
        if (caracter === '(' || caracter === '[' || caracter === '{') profundidad += 1;
        if (caracter === ')' || caracter === ']' || caracter === '}') {
          profundidad = Math.max(0, profundidad - 1);
        }
        tokens.push({ tipo: 'delimitador', valor: caracter, linea: numeroLinea, columna: posicion });
        posicion += 1;
        continue;
      }

      throw new ErrorSintaxisPython(
        `No entiendo el caracter "${caracter}" de la linea ${numeroLinea}.`,
        numeroLinea,
      );
    }

    // Fin de línea lógica: solo si no quedan paréntesis abiertos.
    if (profundidad === 0) {
      tokens.push({ tipo: 'nuevaLinea', valor: '', linea: numeroLinea, columna: posicion });
    }
  }

  // Se cierran los bloques que queden abiertos al final del archivo.
  while (pilaSangria.length > 1) {
    pilaSangria.pop();
    tokens.push({ tipo: 'dedent', valor: '', linea: lineas.length, columna: 0 });
  }

  tokens.push({ tipo: 'fin', valor: '', linea: lineas.length, columna: 0 });
  return tokens;
}
