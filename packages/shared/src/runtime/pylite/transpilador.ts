/**
 * Traduce el subconjunto de Python a JavaScript.
 *
 * Va directo de testigos a código, sin construir un árbol intermedio. Para este
 * subconjunto (sentencias simples, tres estructuras de control y funciones) el
 * árbol no aportaría nada y sí bastante complejidad; si algún día hiciera falta
 * analizar el programa en lugar de solo traducirlo, ese sería el momento de
 * añadirlo.
 *
 * Lo que se admite, que es lo que piden los mundos 21 al 30:
 *   asignación, aritmética y comparaciones, and/or/not, listas e índices,
 *   for i in range(...), while, if/elif/else, def con parámetros y return,
 *   len(), llamadas a métodos del objeto del juego, break y continue.
 *
 * Lo que no, y por qué: async/await (mundo 25) y try/except (mundo 27) tienen
 * semántica propia que no se traduce fielmente, así que esos dos mundos se
 * juegan solo en JavaScript. El catálogo lo declara en el campo `lenguajes`.
 */
import {
  ErrorSintaxisPython,
  tokenizar,
  type Token,
} from './tokenizador.js';

export { ErrorSintaxisPython };

/** Equivalencias de operadores y valores literales. */
const TRADUCCION: Record<string, string> = {
  and: '&&',
  or: '||',
  not: '!',
  True: 'true',
  False: 'false',
  None: 'null',
  '//': '/', // se envuelve con Math.floor al generar
  '**': '**',
};

export interface ResultadoTranspilacion {
  readonly codigo: string;
  /** Estructuras usadas, para los criterios de eficiencia. */
  readonly estructuras: readonly string[];
}

class Transpilador {
  private posicion = 0;
  private readonly salida: string[] = [];
  private readonly estructuras = new Set<string>();
  /** Variables ya declaradas, para poner `let` solo la primera vez. */
  private readonly declaradas = new Set<string>();

  constructor(private readonly tokens: Token[]) {}

  /**
   * Token en el que esta el analizador.
   *
   * Es un metodo y no un descriptor de acceso a proposito: TypeScript estrecha
   * el tipo de un descriptor y mantiene ese estrechamiento entre sentencias, sin
   * saber que `avanzar()` cambia el token. Con un metodo, cada llamada se evalua
   * de nuevo.
   */
  private actual(): Token {
    return this.tokens[this.posicion] ?? { tipo: 'fin', valor: '', linea: 0, columna: 0 };
  }

  private siguiente(desplazamiento = 1): Token {
    return (
      this.tokens[this.posicion + desplazamiento] ?? {
        tipo: 'fin',
        valor: '',
        linea: 0,
        columna: 0,
      }
    );
  }

  private avanzar(): Token {
    const token = this.actual();
    this.posicion += 1;
    return token;
  }

  private esperar(tipo: Token['tipo'], valor?: string): Token {
    const token = this.actual();
    if (token.tipo !== tipo || (valor !== undefined && token.valor !== valor)) {
      throw new ErrorSintaxisPython(
        `En la linea ${token.linea} esperaba ${valor ?? tipo} y encontre "${token.valor || token.tipo}".`,
        token.linea,
      );
    }
    return this.avanzar();
  }

  private saltarNuevasLineas(): void {
    while (this.actual().tipo === 'nuevaLinea') this.avanzar();
  }

  /** Traduce el programa completo. */
  transpilar(): ResultadoTranspilacion {
    this.bloqueSentencias('');
    return { codigo: this.salida.join('\n'), estructuras: [...this.estructuras] };
  }

  /** Sentencias hasta un DEDENT o el fin del archivo. */
  private bloqueSentencias(sangria: string): void {
    for (;;) {
      this.saltarNuevasLineas();
      if (this.actual().tipo === 'dedent' || this.actual().tipo === 'fin') return;
      this.sentencia(sangria);
    }
  }

  /** Cuerpo sangrado de una estructura: dos puntos, salto y bloque. */
  private cuerpo(sangria: string): void {
    this.esperar('delimitador', ':');
    this.saltarNuevasLineas();

    // `if x: hazAlgo()` en una sola línea también es Python válido.
    if (this.actual().tipo !== 'indent') {
      this.sentencia(`${sangria}  `);
      return;
    }

    this.esperar('indent');
    this.bloqueSentencias(`${sangria}  `);
    if (this.actual().tipo === 'dedent') this.avanzar();
  }

  private sentencia(sangria: string): void {
    const token = this.actual();

    if (token.tipo === 'palabraClave') {
      switch (token.valor) {
        case 'if':
          this.sentenciaSi(sangria);
          return;
        case 'for':
          this.sentenciaPara(sangria);
          return;
        case 'while':
          this.sentenciaMientras(sangria);
          return;
        case 'def':
          this.sentenciaFuncion(sangria);
          return;
        case 'return': {
          this.avanzar();
          if (this.actual().tipo === 'nuevaLinea' || this.actual().tipo === 'fin') {
            this.salida.push(`${sangria}return;`);
          } else {
            this.salida.push(`${sangria}return ${this.expresion()};`);
          }
          return;
        }
        case 'break':
          this.avanzar();
          this.salida.push(`${sangria}break;`);
          return;
        case 'continue':
          this.avanzar();
          this.salida.push(`${sangria}continue;`);
          return;
        case 'pass':
          this.avanzar();
          this.salida.push(`${sangria}// pass`);
          return;
        default:
          break;
      }
    }

    // Asignación: un nombre seguido de = (o de +=, -=...).
    if (token.tipo === 'nombre') {
      const siguiente = this.siguiente();
      const esAsignacion =
        siguiente.tipo === 'operador' &&
        ['=', '+=', '-=', '*=', '/='].includes(siguiente.valor);

      // Asignación a un elemento de lista: puertas[0] = ...
      const esAsignacionIndexada =
        siguiente.tipo === 'delimitador' && siguiente.valor === '[';

      if (esAsignacion) {
        const nombre = this.avanzar().valor;
        const operador = this.avanzar().valor;
        const valor = this.expresion();

        if (operador === '=') {
          // `let` solo la primera vez que aparece la variable.
          const prefijo = this.declaradas.has(nombre) ? '' : 'let ';
          this.declaradas.add(nombre);
          this.salida.push(`${sangria}${prefijo}${nombre} = ${valor};`);
        } else {
          this.salida.push(`${sangria}${nombre} ${operador} ${valor};`);
        }
        return;
      }

      if (esAsignacionIndexada) {
        // Se deja que la expresión resuelva el acceso y luego se busca el `=`.
        const destino = this.expresion();
        if (this.actual().tipo === 'operador' && this.actual().valor === '=') {
          this.avanzar();
          this.salida.push(`${sangria}${destino} = ${this.expresion()};`);
        } else {
          this.salida.push(`${sangria}${destino};`);
        }
        return;
      }
    }

    // Cualquier otra cosa es una expresión suelta: una llamada, normalmente.
    const expresion = this.expresion();
    this.salida.push(`${sangria}${expresion};`);
  }

  private sentenciaSi(sangria: string): void {
    this.estructuras.add('si');
    this.esperar('palabraClave', 'if');
    const condicion = this.expresion();
    this.salida.push(`${sangria}if (${condicion}) {`);
    this.cuerpo(sangria);
    this.salida.push(`${sangria}}`);

    for (;;) {
      this.saltarNuevasLineas();
      if (this.actual().tipo !== 'palabraClave') return;

      if (this.actual().valor === 'elif') {
        this.avanzar();
        const otraCondicion = this.expresion();
        // Se cierra el anterior y se abre el siguiente en la misma línea.
        this.salida[this.salida.length - 1] = `${sangria}} else if (${otraCondicion}) {`;
        this.cuerpo(sangria);
        this.salida.push(`${sangria}}`);
        continue;
      }

      if (this.actual().valor === 'else') {
        this.avanzar();
        this.salida[this.salida.length - 1] = `${sangria}} else {`;
        this.cuerpo(sangria);
        this.salida.push(`${sangria}}`);
        return;
      }

      return;
    }
  }

  /**
   * `for i in range(...)` y `for x in lista`.
   * range se traduce a un for clásico en lugar de crear el array: un programa
   * con range(100000) no debe reservar memoria para nada.
   */
  private sentenciaPara(sangria: string): void {
    this.estructuras.add('para');
    this.esperar('palabraClave', 'for');
    const variable = this.esperar('nombre').valor;
    this.esperar('palabraClave', 'in');
    this.declaradas.add(variable);

    const esRange = this.actual().tipo === 'palabraClave' && this.actual().valor === 'range';

    if (esRange) {
      this.avanzar();
      this.esperar('delimitador', '(');
      const argumentos: string[] = [this.expresion()];
      while (this.actual().tipo === 'delimitador' && this.actual().valor === ',') {
        this.avanzar();
        argumentos.push(this.expresion());
      }
      this.esperar('delimitador', ')');

      const [primero, segundo, tercero] = argumentos;
      const inicio = segundo === undefined ? '0' : primero;
      const fin = segundo === undefined ? primero : segundo;
      const paso = tercero ?? '1';

      // El paso puede ser negativo: la comparación tiene que adaptarse.
      const comparacion =
        tercero === undefined || !tercero.startsWith('-')
          ? `${variable} < ${fin}`
          : `${variable} > ${fin}`;

      this.salida.push(
        `${sangria}for (let ${variable} = ${inicio}; ${comparacion}; ${variable} += ${paso}) {`,
      );
    } else {
      const iterable = this.expresion();
      this.salida.push(`${sangria}for (const ${variable} of ${iterable}) {`);
    }

    this.cuerpo(sangria);
    this.salida.push(`${sangria}}`);
  }

  private sentenciaMientras(sangria: string): void {
    this.estructuras.add('mientras');
    this.esperar('palabraClave', 'while');
    const condicion = this.expresion();
    this.salida.push(`${sangria}while (${condicion}) {`);
    this.cuerpo(sangria);
    this.salida.push(`${sangria}}`);
  }

  private sentenciaFuncion(sangria: string): void {
    this.estructuras.add('funcion');
    this.esperar('palabraClave', 'def');
    const nombre = this.esperar('nombre').valor;
    this.esperar('delimitador', '(');

    const parametros: string[] = [];
    while (!(this.actual().tipo === 'delimitador' && this.actual().valor === ')')) {
      const parametro = this.esperar('nombre').valor;
      parametros.push(parametro);
      this.declaradas.add(parametro);
      if (this.actual().tipo === 'delimitador' && this.actual().valor === ',') this.avanzar();
    }
    this.esperar('delimitador', ')');

    this.declaradas.add(nombre);
    this.salida.push(`${sangria}function ${nombre}(${parametros.join(', ')}) {`);
    this.cuerpo(sangria);
    this.salida.push(`${sangria}}`);
  }

  // ── Expresiones, por precedencia ──

  private expresion(): string {
    return this.expresionO();
  }

  private expresionO(): string {
    let izquierda = this.expresionY();
    while (this.actual().tipo === 'palabraClave' && this.actual().valor === 'or') {
      this.avanzar();
      izquierda = `${izquierda} || ${this.expresionY()}`;
    }
    return izquierda;
  }

  private expresionY(): string {
    let izquierda = this.expresionNo();
    while (this.actual().tipo === 'palabraClave' && this.actual().valor === 'and') {
      this.avanzar();
      izquierda = `${izquierda} && ${this.expresionNo()}`;
    }
    return izquierda;
  }

  private expresionNo(): string {
    if (this.actual().tipo === 'palabraClave' && this.actual().valor === 'not') {
      this.avanzar();
      return `!(${this.expresionNo()})`;
    }
    return this.comparacion();
  }

  private comparacion(): string {
    let izquierda = this.suma();
    while (
      this.actual().tipo === 'operador' &&
      ['==', '!=', '<', '>', '<=', '>='].includes(this.actual().valor)
    ) {
      const operador = this.avanzar().valor;
      // Python compara por valor; en JavaScript se usa la forma estricta.
      const equivalente = operador === '==' ? '===' : operador === '!=' ? '!==' : operador;
      izquierda = `${izquierda} ${equivalente} ${this.suma()}`;
    }
    return izquierda;
  }

  private suma(): string {
    let izquierda = this.producto();
    while (this.actual().tipo === 'operador' && ['+', '-'].includes(this.actual().valor)) {
      const operador = this.avanzar().valor;
      izquierda = `${izquierda} ${operador} ${this.producto()}`;
    }
    return izquierda;
  }

  private producto(): string {
    let izquierda = this.unario();
    while (
      this.actual().tipo === 'operador' &&
      ['*', '/', '%', '//', '**'].includes(this.actual().valor)
    ) {
      const operador = this.avanzar().valor;
      const derecha = this.unario();

      // La división entera de Python trunca hacia abajo.
      if (operador === '//') izquierda = `Math.floor(${izquierda} / ${derecha})`;
      else if (operador === '**') izquierda = `(${izquierda} ** ${derecha})`;
      else izquierda = `${izquierda} ${operador} ${derecha}`;
    }
    return izquierda;
  }

  private unario(): string {
    if (this.actual().tipo === 'operador' && this.actual().valor === '-') {
      this.avanzar();
      return `-${this.unario()}`;
    }
    return this.postfijo();
  }

  /** Accesos, índices y llamadas encadenadas: puertas[0].unlock(). */
  private postfijo(): string {
    let expresion = this.primaria();

    for (;;) {
      const token = this.actual();

      if (token.tipo === 'delimitador' && token.valor === '.') {
        this.avanzar();
        const propiedad = this.esperar('nombre').valor;
        expresion = `${expresion}.${propiedad}`;
        continue;
      }

      if (token.tipo === 'delimitador' && token.valor === '[') {
        this.avanzar();
        const indice = this.expresion();
        this.esperar('delimitador', ']');
        expresion = `${expresion}[${indice}]`;
        continue;
      }

      if (token.tipo === 'delimitador' && token.valor === '(') {
        this.avanzar();
        const argumentos: string[] = [];
        while (!(this.actual().tipo === 'delimitador' && this.actual().valor === ')')) {
          argumentos.push(this.expresion());
          if (this.actual().tipo === 'delimitador' && this.actual().valor === ',') this.avanzar();
        }
        this.esperar('delimitador', ')');
        expresion = `${expresion}(${argumentos.join(', ')})`;
        continue;
      }

      return expresion;
    }
  }

  private primaria(): string {
    const token = this.avanzar();

    switch (token.tipo) {
      case 'numero':
        return token.valor;

      case 'texto':
        // Se normaliza a comillas simples, escapando las que hubiera dentro.
        return `'${token.valor.replace(/'/g, "\\'")}'`;

      case 'nombre':
        return token.valor;

      case 'palabraClave': {
        if (token.valor === 'len') {
          this.esperar('delimitador', '(');
          const argumento = this.expresion();
          this.esperar('delimitador', ')');
          return `${argumento}.length`;
        }
        if (token.valor === 'range') {
          // range fuera de un for: se materializa el array.
          this.esperar('delimitador', '(');
          const argumentos: string[] = [this.expresion()];
          while (this.actual().tipo === 'delimitador' && this.actual().valor === ',') {
            this.avanzar();
            argumentos.push(this.expresion());
          }
          this.esperar('delimitador', ')');
          const [primero, segundo] = argumentos;
          const inicio = segundo === undefined ? '0' : primero;
          const fin = segundo === undefined ? primero : segundo;
          return `Array.from({ length: ${fin} - ${inicio} }, (_, i) => i + ${inicio})`;
        }
        const traducido = TRADUCCION[token.valor];
        if (traducido) return traducido;
        throw new ErrorSintaxisPython(
          `No puedo usar "${token.valor}" aqui (linea ${token.linea}).`,
          token.linea,
        );
      }

      case 'delimitador': {
        if (token.valor === '(') {
          const dentro = this.expresion();
          this.esperar('delimitador', ')');
          return `(${dentro})`;
        }
        if (token.valor === '[') {
          const elementos: string[] = [];
          while (!(this.actual().tipo === 'delimitador' && this.actual().valor === ']')) {
            elementos.push(this.expresion());
            if (this.actual().tipo === 'delimitador' && this.actual().valor === ',') this.avanzar();
          }
          this.esperar('delimitador', ']');
          return `[${elementos.join(', ')}]`;
        }
        if (token.valor === '{') {
          // Diccionario: mundo 24.
          const pares: string[] = [];
          while (!(this.actual().tipo === 'delimitador' && this.actual().valor === '}')) {
            const clave = this.expresion();
            this.esperar('delimitador', ':');
            const valor = this.expresion();
            pares.push(`${clave}: ${valor}`);
            if (this.actual().tipo === 'delimitador' && this.actual().valor === ',') this.avanzar();
          }
          this.esperar('delimitador', '}');
          return `{ ${pares.join(', ')} }`;
        }
        break;
      }

      default:
        break;
    }

    throw new ErrorSintaxisPython(
      `No entiendo "${token.valor || token.tipo}" en la linea ${token.linea}.`,
      token.linea,
    );
  }
}

/**
 * Traduce Python a JavaScript. Lanza `ErrorSintaxisPython` con el número de
 * línea si el programa usa algo fuera del subconjunto admitido, de modo que el
 * editor pueda marcar exactamente dónde.
 */
export function transpilarPython(codigo: string): ResultadoTranspilacion {
  const tokens = tokenizar(codigo);
  return new Transpilador(tokens).transpilar();
}
