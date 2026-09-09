/**
 * Traduce el programa de una actividad al formato que carga Blockly.
 *
 * Hace falta para las actividades que empiezan con piezas ya puestas, y sobre
 * todo para el mundo 19, que entrega un programa con un fallo y pide arreglarlo.
 * Sin esto, "arregla la pieza que está mal" no se puede plantear: el niño abriría
 * un área de trabajo vacía y tendría que escribir el programa entero, que es otro
 * ejercicio y bastante más aburrido.
 *
 * El formato es el de `Blockly.serialization.workspaces.save`. Tiene tres cosas
 * que conviene saber antes de leer el código:
 *
 *  1. Las piezas que se apilan una debajo de otra se encadenan con `next`, no con
 *     una lista. Un programa de diez piezas son diez objetos anidados.
 *  2. Un hueco de valor y un hueco de sentencias son los dos `inputs`, y se
 *     distinguen solo por el nombre del hueco.
 *  3. Las variables no viven en los bloques: viven en una lista aparte del área de
 *     trabajo, y los bloques las citan por identificador. Si un bloque nombra una
 *     variable que no está en esa lista, Blockly la ignora y el bloque aparece
 *     roto.
 *
 * Solo se traduce lo que usan las actividades. Un bloque que no esté aquí y se
 * intente serializar levanta un error en la compilación del contenido, que es
 * mejor que un área de trabajo con piezas fantasma.
 */
import type { Bloque, Expresion } from './generadores-creadores.js';

/** Un bloque tal como lo guarda Blockly. */
interface BloqueSerializado {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BloqueSerializado; shadow?: BloqueSerializado }>;
  extraState?: Record<string, unknown>;
  next?: { block: BloqueSerializado };
}

export interface AreaBlockly {
  readonly blocks: {
    readonly languageVersion: 0;
    readonly blocks: readonly BloqueSerializado[];
  };
  readonly variables?: readonly { readonly name: string; readonly id: string }[];
}

/** Identificador estable para una variable: el mismo nombre, el mismo id. */
function idDeVariable(nombre: string): string {
  return `var_${nombre}`;
}

const COMPARADOR: Record<string, string> = {
  '==': 'EQ',
  '!=': 'NEQ',
  '<': 'LT',
  '<=': 'LTE',
  '>': 'GT',
  '>=': 'GTE',
};

const ARITMETICA: Record<string, string> = {
  '+': 'ADD',
  '-': 'MINUS',
  '*': 'MULTIPLY',
  '/': 'DIVIDE',
};

const MOVIMIENTO: Record<string, string> = {
  avanzar: 'fuzz_avanzar',
  girarDerecha: 'fuzz_girar_derecha',
  girarIzquierda: 'fuzz_girar_izquierda',
  saltar: 'fuzz_saltar',
  recoger: 'fuzz_recoger',
  repararPuente: 'fuzz_reparar',
};

/** Recoge los nombres de variable que usa un programa, en orden de aparición. */
function variablesDe(bloques: readonly Bloque[], vistas = new Set<string>()): Set<string> {
  const enExpresion = (e: Expresion): void => {
    if ('variable' in e) vistas.add(e.variable);
    else if ('aritmetica' in e || 'compara' in e) {
      enExpresion(e.a);
      enExpresion(e.b);
    } else if ('y' in e) {
      enExpresion(e.y[0]);
      enExpresion(e.y[1]);
    } else if ('o' in e) {
      enExpresion(e.o[0]);
      enExpresion(e.o[1]);
    } else if ('lista' in e) {
      for (const i of e.lista) enExpresion(i);
    } else if ('longitud' in e) enExpresion(e.longitud);
    else if ('elemento' in e) {
      enExpresion(e.elemento.de);
      enExpresion(e.elemento.en);
    }
  };

  for (const b of bloques) {
    if ('repetir' in b) {
      enExpresion(b.repetir);
      variablesDe(b.cuerpo, vistas);
    } else if ('si' in b) {
      enExpresion(b.si);
      variablesDe(b.entonces, vistas);
      variablesDe(b.sino ?? [], vistas);
    } else if ('mientras' in b) {
      enExpresion(b.mientras);
      variablesDe(b.cuerpo, vistas);
    } else if ('hasta' in b) {
      enExpresion(b.hasta);
      variablesDe(b.cuerpo, vistas);
    } else if ('define' in b) {
      for (const p of b.params ?? []) vistas.add(p);
      variablesDe(b.cuerpo, vistas);
    } else if ('usa' in b) {
      for (const a of b.con ?? []) enExpresion(a);
    } else if ('pon' in b) {
      vistas.add(b.pon);
      enExpresion(b.a);
    } else if ('suma' in b) {
      vistas.add(b.suma);
      enExpresion(b.cuanto);
    }
  }

  return vistas;
}

/** Campo de variable, tal como lo espera Blockly. */
function campoVariable(nombre: string): Record<string, unknown> {
  return { VAR: { id: idDeVariable(nombre), name: nombre, type: '' } };
}

function expresion(e: Expresion): BloqueSerializado {
  if ('numero' in e) return { type: 'math_number', fields: { NUM: e.numero } };
  if ('variable' in e) return { type: 'variables_get', fields: campoVariable(e.variable) };
  if ('puedeAvanzar' in e) return { type: 'fuzz_puede_avanzar' };
  if ('hayObstaculo' in e) return { type: 'fuzz_hay_obstaculo' };
  if ('esColor' in e) return { type: 'fuzz_color_casilla', fields: { COLOR: e.esColor } };
  if ('aritmetica' in e) {
    return {
      type: 'math_arithmetic',
      fields: { OP: ARITMETICA[e.aritmetica] },
      inputs: { A: { block: expresion(e.a) }, B: { block: expresion(e.b) } },
    };
  }
  if ('compara' in e) {
    return {
      type: 'logic_compare',
      fields: { OP: COMPARADOR[e.compara] },
      inputs: { A: { block: expresion(e.a) }, B: { block: expresion(e.b) } },
    };
  }
  if ('y' in e) {
    return {
      type: 'logic_operation',
      fields: { OP: 'AND' },
      inputs: { A: { block: expresion(e.y[0]) }, B: { block: expresion(e.y[1]) } },
    };
  }
  if ('o' in e) {
    return {
      type: 'logic_operation',
      fields: { OP: 'OR' },
      inputs: { A: { block: expresion(e.o[0]) }, B: { block: expresion(e.o[1]) } },
    };
  }
  if ('lista' in e) {
    const inputs: BloqueSerializado['inputs'] = {};
    e.lista.forEach((item, i) => {
      inputs[`ADD${i}`] = { block: expresion(item) };
    });
    return {
      type: 'lists_create_with',
      extraState: { itemCount: e.lista.length },
      inputs,
    };
  }
  if ('longitud' in e) {
    return { type: 'lists_length', inputs: { VALUE: { block: expresion(e.longitud) } } };
  }
  return {
    type: 'lists_getIndex',
    extraState: { isStatement: false },
    fields: { MODE: 'GET', WHERE: 'FROM_START' },
    inputs: {
      VALUE: { block: expresion(e.elemento.de) },
      AT: { block: expresion(e.elemento.en) },
    },
  };
}

/** Un bloque de sentencia, sin encadenar todavía con el siguiente. */
function sentencia(b: Bloque): BloqueSerializado {
  if ('hacer' in b) {
    const tipo = MOVIMIENTO[b.hacer];
    if (!tipo) throw new Error(`No se sabe serializar el movimiento "${b.hacer}".`);
    return { type: tipo };
  }

  if ('repetir' in b) {
    return {
      type: 'fuzz_repetir',
      inputs: {
        VECES: { block: expresion(b.repetir) },
        ...(b.cuerpo.length > 0 ? { CUERPO: { block: pila(b.cuerpo)! } } : {}),
      },
    };
  }

  if ('si' in b) {
    const tieneSino = (b.sino ?? []).length > 0;
    return {
      type: 'controls_if',
      ...(tieneSino ? { extraState: { hasElse: true } } : {}),
      inputs: {
        IF0: { block: expresion(b.si) },
        ...(b.entonces.length > 0 ? { DO0: { block: pila(b.entonces)! } } : {}),
        ...(tieneSino ? { ELSE: { block: pila(b.sino!)! } } : {}),
      },
    };
  }

  if ('mientras' in b || 'hasta' in b) {
    const esHasta = 'hasta' in b;
    const condicion = esHasta ? b.hasta : b.mientras;
    const cuerpo = b.cuerpo;
    return {
      type: 'controls_whileUntil',
      fields: { MODE: esHasta ? 'UNTIL' : 'WHILE' },
      inputs: {
        BOOL: { block: expresion(condicion) },
        ...(cuerpo.length > 0 ? { DO: { block: pila(cuerpo)! } } : {}),
      },
    };
  }

  if ('define' in b) {
    const params = (b.params ?? []).map((nombre) => ({
      name: nombre,
      id: idDeVariable(nombre),
    }));
    return {
      type: 'procedures_defnoreturn',
      fields: { NAME: b.define },
      ...(params.length > 0 ? { extraState: { params } } : {}),
      ...(b.cuerpo.length > 0 ? { inputs: { STACK: { block: pila(b.cuerpo)! } } } : {}),
    };
  }

  if ('usa' in b) {
    const argumentos = b.con ?? [];
    const inputs: BloqueSerializado['inputs'] = {};
    argumentos.forEach((arg, i) => {
      inputs[`ARG${i}`] = { block: expresion(arg) };
    });
    return {
      type: 'procedures_callnoreturn',
      extraState: {
        name: b.usa,
        // Blockly necesita saber que parametros espera la llamada. Los nombres no
        // los sabemos aqui, asi que se numeran: al cargar, el bloque de la
        // definicion los corrige.
        params: argumentos.map((_, i) => `p${i + 1}`),
      },
      ...(argumentos.length > 0 ? { inputs } : {}),
    };
  }

  if ('pon' in b) {
    return {
      type: 'variables_set',
      fields: campoVariable(b.pon),
      inputs: { VALUE: { block: expresion(b.a) } },
    };
  }

  return {
    type: 'math_change',
    fields: campoVariable(b.suma),
    inputs: { DELTA: { block: expresion(b.cuanto) } },
  };
}

/** Encadena una lista de sentencias con `next`, como las apila Blockly. */
function pila(bloques: readonly Bloque[]): BloqueSerializado | undefined {
  if (bloques.length === 0) return undefined;

  const primero = sentencia(bloques[0]!);
  let actual = primero;
  for (const b of bloques.slice(1)) {
    const siguiente = sentencia(b);
    actual.next = { block: siguiente };
    actual = siguiente;
  }
  return primero;
}

/**
 * Convierte un programa en el área de trabajo que carga el editor.
 *
 * Las definiciones de bloques propios salen como pilas independientes, porque en
 * Blockly una función no va enganchada al programa: vive suelta en el área.
 */
export function areaDeBloques(bloques: readonly Bloque[]): AreaBlockly {
  const definiciones = bloques.filter((b) => 'define' in b);
  const programa = bloques.filter((b) => !('define' in b));

  const raices: BloqueSerializado[] = [];
  let y = 20;

  for (const definicion of definiciones) {
    const serializado = sentencia(definicion);
    raices.push({ ...serializado, ...({ x: 20, y } as Record<string, number>) });
    y += 160;
  }

  const principal = pila(programa);
  if (principal) {
    raices.push({ ...principal, ...({ x: 320, y: 20 } as Record<string, number>) });
  }

  const nombres = [...variablesDe(bloques)];

  return {
    blocks: { languageVersion: 0, blocks: raices },
    ...(nombres.length > 0
      ? { variables: nombres.map((nombre) => ({ name: nombre, id: idDeVariable(nombre) })) }
      : {}),
  };
}
