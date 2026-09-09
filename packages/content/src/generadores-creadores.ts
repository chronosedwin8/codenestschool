/**
 * Generadores de los Creadores (mundos 11 al 20), que trabajan con bloques.
 *
 * Dos cosas cambian respecto a los Exploradores y las dos cambian el diseño.
 *
 * La primera es el movimiento. Los pequeños ruedan hasta que se acaba el camino;
 * aquí el Fuzz avanza una casilla y gira, como una tortuga. Eso quita de golpe la
 * clase de error que dominó los mundos 1 al 10: en modo rodar, dos tramos que se
 * tocan hacen que el Fuzz se cuele de uno a otro, y había que separar los caminos
 * a mano. Aquí un pasillo pegado a otro no molesta a nadie, salvo cuando el
 * programa usa sensores, que es el único caso en que hay que volver a cuidarlo.
 *
 * La segunda es cómo se mide un programa. El editor de Blockly cuenta bloques y
 * el validador solo recibe JavaScript, donde contaría líneas. Un `repetir` con
 * dos bloques dentro son tres bloques y cuatro líneas de código, así que las dos
 * medidas no coinciden nunca. Por eso aquí el programa se escribe una vez en una
 * estructura y de ella salen las dos cosas: el JavaScript que ejecuta el
 * validador y el número exacto de bloques que vería el niño. Si se escribieran
 * por separado, el límite de la tercera estrella se aflojaría sin que nadie lo
 * notara.
 */
import {
  claveInstruccion,
  clavePista,
  numeroGlobal,
  type ActivityDefinition,
  type ColorCasilla,
  type Direccion,
  type Grid,
  type GrupoEdad,
  type ItemNivel,
  type Objetivo,
  type Spawn,
  type Tile,
  type TipoActividad,
} from '@codenest/shared';

import { slug, type TextosActividad } from './generadores.js';

const VACIO: Tile = { t: 'vacio' };

/** Contexto común a todas las actividades de los Creadores. */
export interface ContextoCreador {
  readonly mundo: number;
  readonly numeroEnMundo: number;
  readonly textos: TextosActividad;
}

// ───────────────────────────── Expresiones ─────────────────────────────────

/**
 * Una expresión de Blockly.
 *
 * Cada caso corresponde a un bloque real de la caja de herramientas, y de ahí
 * sale la cuenta: un `math_number` es un bloque, y una comparación es un bloque
 * más los dos que lleva enchufados.
 */
export type Expresion =
  | { readonly numero: number }
  | { readonly variable: string }
  | { readonly puedeAvanzar: true }
  | { readonly hayObstaculo: true }
  | { readonly esColor: ColorCasilla }
  | { readonly aritmetica: '+' | '-' | '*' | '/'; readonly a: Expresion; readonly b: Expresion }
  | {
      readonly compara: '==' | '!=' | '<' | '<=' | '>' | '>=';
      readonly a: Expresion;
      readonly b: Expresion;
    }
  | { readonly y: readonly [Expresion, Expresion] }
  | { readonly o: readonly [Expresion, Expresion] }
  | { readonly lista: readonly Expresion[] }
  | { readonly longitud: Expresion }
  | { readonly elemento: { readonly de: Expresion; readonly en: Expresion } };

export const num = (numero: number): Expresion => ({ numero });
export const vble = (variable: string): Expresion => ({ variable });
export const puedeAvanzar: Expresion = { puedeAvanzar: true };
export const hayObstaculo: Expresion = { hayObstaculo: true };
export const esColor = (color: ColorCasilla): Expresion => ({ esColor: color });
export const mas = (a: Expresion, b: Expresion): Expresion => ({ aritmetica: '+', a, b });
export const menos = (a: Expresion, b: Expresion): Expresion => ({ aritmetica: '-', a, b });
export const compara = (
  operador: '==' | '!=' | '<' | '<=' | '>' | '>=',
  a: Expresion,
  b: Expresion,
): Expresion => ({ compara: operador, a, b });
export const y = (a: Expresion, b: Expresion): Expresion => ({ y: [a, b] });
export const o = (a: Expresion, b: Expresion): Expresion => ({ o: [a, b] });
export const lista = (...items: Expresion[]): Expresion => ({ lista: items });
export const longitud = (de: Expresion): Expresion => ({ longitud: de });
export const elemento = (de: Expresion, en: Expresion): Expresion => ({ elemento: { de, en } });

/** JavaScript de una expresión, igual al que genera Blockly. */
function codigoExpresion(e: Expresion): string {
  if ('numero' in e) return String(e.numero);
  if ('variable' in e) return e.variable;
  if ('puedeAvanzar' in e) return 'fuzz.puedeAvanzar()';
  if ('hayObstaculo' in e) return 'fuzz.hayObstaculo()';
  if ('esColor' in e) return `fuzz.colorCasilla() === '${e.esColor}'`;
  if ('aritmetica' in e) {
    return `(${codigoExpresion(e.a)} ${e.aritmetica} ${codigoExpresion(e.b)})`;
  }
  if ('compara' in e) return `(${codigoExpresion(e.a)} ${e.compara} ${codigoExpresion(e.b)})`;
  if ('y' in e) return `(${codigoExpresion(e.y[0])} && ${codigoExpresion(e.y[1])})`;
  if ('o' in e) return `(${codigoExpresion(e.o[0])} || ${codigoExpresion(e.o[1])})`;
  if ('lista' in e) return `[${e.lista.map(codigoExpresion).join(', ')}]`;
  if ('longitud' in e) return `${codigoExpresion(e.longitud)}.length`;
  // Blockly numera las listas desde 1, no desde 0.
  return `${codigoExpresion(e.elemento.de)}[${codigoExpresion(e.elemento.en)} - 1]`;
}

/** Bloques que ocupa una expresión, contando los que lleva enchufados. */
function bloquesExpresion(e: Expresion): number {
  if ('aritmetica' in e) return 1 + bloquesExpresion(e.a) + bloquesExpresion(e.b);
  if ('compara' in e) return 1 + bloquesExpresion(e.a) + bloquesExpresion(e.b);
  if ('y' in e) return 1 + bloquesExpresion(e.y[0]) + bloquesExpresion(e.y[1]);
  if ('o' in e) return 1 + bloquesExpresion(e.o[0]) + bloquesExpresion(e.o[1]);
  if ('lista' in e) return 1 + e.lista.reduce((t, i) => t + bloquesExpresion(i), 0);
  if ('longitud' in e) return 1 + bloquesExpresion(e.longitud);
  if ('elemento' in e) {
    return 1 + bloquesExpresion(e.elemento.de) + bloquesExpresion(e.elemento.en);
  }
  return 1;
}

// ──────────────────────────────── Bloques ──────────────────────────────────

/** Un bloque de sentencia, de los que se apilan uno debajo de otro. */
export type Bloque =
  | { readonly hacer: 'avanzar' | 'girarDerecha' | 'girarIzquierda' | 'saltar' | 'recoger' | 'repararPuente' }
  | { readonly repetir: Expresion; readonly cuerpo: readonly Bloque[] }
  | {
      readonly si: Expresion;
      readonly entonces: readonly Bloque[];
      readonly sino?: readonly Bloque[];
    }
  | { readonly mientras: Expresion; readonly cuerpo: readonly Bloque[] }
  | { readonly hasta: Expresion; readonly cuerpo: readonly Bloque[] }
  | { readonly define: string; readonly params?: readonly string[]; readonly cuerpo: readonly Bloque[] }
  | { readonly usa: string; readonly con?: readonly Expresion[] }
  | { readonly pon: string; readonly a: Expresion }
  | { readonly suma: string; readonly cuanto: Expresion };

export const avanzar = (): Bloque => ({ hacer: 'avanzar' });
export const girarDerecha = (): Bloque => ({ hacer: 'girarDerecha' });
export const girarIzquierda = (): Bloque => ({ hacer: 'girarIzquierda' });
export const saltar = (): Bloque => ({ hacer: 'saltar' });
export const recoger = (): Bloque => ({ hacer: 'recoger' });
export const repararPuente = (): Bloque => ({ hacer: 'repararPuente' });

/**
 * Bucle contado. El número puede ser un número o una variable, porque en el
 * editor va en un hueco de valor: es lo que permite que el mundo 12 use una
 * variable para gobernar un bucle.
 */
export const repetir = (veces: number | Expresion, ...cuerpo: Bloque[]): Bloque => ({
  repetir: typeof veces === 'number' ? { numero: veces } : veces,
  cuerpo,
});
export const si = (cond: Expresion, entonces: Bloque[], sino?: Bloque[]): Bloque => ({
  si: cond,
  entonces,
  ...(sino ? { sino } : {}),
});
export const mientras = (cond: Expresion, ...cuerpo: Bloque[]): Bloque => ({
  mientras: cond,
  cuerpo,
});
export const hasta = (cond: Expresion, ...cuerpo: Bloque[]): Bloque => ({ hasta: cond, cuerpo });
export const define = (nombre: string, cuerpo: Bloque[], params?: readonly string[]): Bloque => ({
  define: nombre,
  ...(params ? { params } : {}),
  cuerpo,
});
export const usa = (nombre: string, ...con: Expresion[]): Bloque => ({
  usa: nombre,
  ...(con.length > 0 ? { con } : {}),
});
export const pon = (nombre: string, a: Expresion): Bloque => ({ pon: nombre, a });
export const suma = (nombre: string, cuanto: Expresion = { numero: 1 }): Bloque => ({
  suma: nombre,
  cuanto,
});

const METODO: Record<string, string> = {
  avanzar: 'fuzz.avanzar()',
  girarDerecha: 'fuzz.girarDerecha()',
  girarIzquierda: 'fuzz.girarIzquierda()',
  saltar: 'fuzz.saltar()',
  recoger: 'fuzz.recoger()',
  repararPuente: 'fuzz.repararPuente()',
};

/** JavaScript de una lista de bloques, con la sangría de Blockly. */
export function codigoDeBloques(bloques: readonly Bloque[], sangria = ''): string {
  const dentro = `${sangria}  `;
  let salida = '';

  for (const b of bloques) {
    if ('hacer' in b) {
      salida += `${sangria}${METODO[b.hacer]};\n`;
      continue;
    }
    if ('repetir' in b) {
      salida += `${sangria}repetir(${codigoExpresion(b.repetir)}, () => {\n`;
      salida += codigoDeBloques(b.cuerpo, dentro);
      salida += `${sangria}});\n`;
      continue;
    }
    if ('si' in b) {
      salida += `${sangria}if (${codigoExpresion(b.si)}) {\n`;
      salida += codigoDeBloques(b.entonces, dentro);
      if (b.sino && b.sino.length > 0) {
        salida += `${sangria}} else {\n`;
        salida += codigoDeBloques(b.sino, dentro);
      }
      salida += `${sangria}}\n`;
      continue;
    }
    if ('mientras' in b) {
      salida += `${sangria}while (${codigoExpresion(b.mientras)}) {\n`;
      salida += codigoDeBloques(b.cuerpo, dentro);
      salida += `${sangria}}\n`;
      continue;
    }
    if ('hasta' in b) {
      // El bloque de Blockly es el mismo con el desplegable en "hasta".
      salida += `${sangria}while (!(${codigoExpresion(b.hasta)})) {\n`;
      salida += codigoDeBloques(b.cuerpo, dentro);
      salida += `${sangria}}\n`;
      continue;
    }
    if ('define' in b) {
      salida += `${sangria}function ${b.define}(${(b.params ?? []).join(', ')}) {\n`;
      salida += codigoDeBloques(b.cuerpo, dentro);
      salida += `${sangria}}\n`;
      continue;
    }
    if ('usa' in b) {
      salida += `${sangria}${b.usa}(${(b.con ?? []).map(codigoExpresion).join(', ')});\n`;
      continue;
    }
    if ('pon' in b) {
      // `var` y no `let`: es lo que genera Blockly, y ademas asignar dos veces la
      // misma variable con `let` seria un error de sintaxis.
      salida += `${sangria}var ${b.pon} = ${codigoExpresion(b.a)};\n`;
      continue;
    }
    salida += `${sangria}${b.suma} = ${b.suma} + ${codigoExpresion(b.cuanto)};\n`;
  }

  return salida;
}

/**
 * Cuenta los bloques igual que los cuenta el editor.
 *
 * El editor hace `getAllBlocks()`, o sea todos los bloques del área, incluidos
 * los que van enchufados en un hueco de valor. Un `repetir` cuenta uno porque su
 * número es un campo del propio bloque, no un bloque aparte; una comparación
 * cuenta uno más los dos que compara.
 */
export function contarBloques(bloques: readonly Bloque[]): number {
  let total = 0;

  for (const b of bloques) {
    if ('hacer' in b) {
      total += 1;
      continue;
    }
    if ('repetir' in b) {
      // El numero del bucle es un bloque aparte, enchufado en su hueco.
      total += 1 + bloquesExpresion(b.repetir) + contarBloques(b.cuerpo);
      continue;
    }
    if ('si' in b) {
      total += 1 + bloquesExpresion(b.si) + contarBloques(b.entonces) + contarBloques(b.sino ?? []);
      continue;
    }
    if ('mientras' in b) {
      total += 1 + bloquesExpresion(b.mientras) + contarBloques(b.cuerpo);
      continue;
    }
    if ('hasta' in b) {
      total += 1 + bloquesExpresion(b.hasta) + contarBloques(b.cuerpo);
      continue;
    }
    if ('define' in b) {
      total += 1 + contarBloques(b.cuerpo);
      continue;
    }
    if ('usa' in b) {
      total += 1 + (b.con ?? []).reduce((t, e) => t + bloquesExpresion(e), 0);
      continue;
    }
    if ('pon' in b) {
      total += 1 + bloquesExpresion(b.a);
      continue;
    }
    total += 1 + bloquesExpresion(b.cuanto);
  }

  return total;
}

/** Estructuras que usa un programa, para lo que exige la tercera estrella. */
export function estructurasDe(bloques: readonly Bloque[]): string[] {
  const vistas = new Set<string>();

  const recorrer = (lista: readonly Bloque[]): void => {
    for (const b of lista) {
      if ('repetir' in b) {
        vistas.add('repetir');
        recorrer(b.cuerpo);
      } else if ('si' in b) {
        vistas.add('si');
        if (b.sino && b.sino.length > 0) vistas.add('sino');
        recorrer(b.entonces);
        recorrer(b.sino ?? []);
      } else if ('mientras' in b) {
        vistas.add('mientras');
        recorrer(b.cuerpo);
      } else if ('hasta' in b) {
        vistas.add('mientras');
        vistas.add('hasta');
        recorrer(b.cuerpo);
      } else if ('define' in b) {
        vistas.add('funcion');
        if ((b.params ?? []).length > 0) vistas.add('parametro');
        recorrer(b.cuerpo);
      } else if ('pon' in b || 'suma' in b) {
        vistas.add('variable');
      }
    }
  };

  recorrer(bloques);
  return [...vistas];
}

// ──────────────────────── El tablero, paso a paso ──────────────────────────

const DELTA: Record<Direccion, { dx: number; dy: number }> = {
  derecha: { dx: 1, dy: 0 },
  izquierda: { dx: -1, dy: 0 },
  arriba: { dx: 0, dy: -1 },
  abajo: { dx: 0, dy: 1 },
};

const GIRO_DERECHA: Record<Direccion, Direccion> = {
  derecha: 'abajo',
  abajo: 'izquierda',
  izquierda: 'arriba',
  arriba: 'derecha',
};

/**
 * Un paso del camino previsto.
 *
 * Describe por dónde tiene que pasar el Fuzz, no el programa que lo consigue.
 * De aquí sale el tablero; el programa se escribe aparte y el validador
 * comprueba que los dos encajan. Es a propósito: en los mundos con sensores el
 * programa no sabe de antemano lo que va a hacer, así que no se puede deducir un
 * tablero de él.
 */
export type PasoCamino =
  | { readonly andar: number }
  | { readonly gira: 'derecha' | 'izquierda' }
  | { readonly salta: true }
  | { readonly puente: true }
  | { readonly estrella: true }
  | { readonly pinta: ColorCasilla }
  /**
   * Un pasillo falso: sigue recto y no lleva a ninguna parte.
   *
   * Hace falta para que un sensor tenga algo que decidir. Sin señuelos, "¿puedes
   * avanzar?" solo dice no en las esquinas, y entonces una condición con dos
   * partes no tiene sentido: la mitad nunca cambia nada. Con un señuelo delante,
   * el Fuzz sí puede avanzar y aun así no debe, y ahí empieza a hacer falta mirar
   * también el color del suelo.
   */
  | { readonly senuelo: number };

export const andar = (casillas = 1): PasoCamino => ({ andar: casillas });
export const gira = (lado: 'derecha' | 'izquierda'): PasoCamino => ({ gira: lado });
export const brinca = (): PasoCamino => ({ salta: true });
export const puenteRoto = (): PasoCamino => ({ puente: true });
export const estrellaAqui = (): PasoCamino => ({ estrella: true });
export const pinta = (color: ColorCasilla): PasoCamino => ({ pinta: color });
export const senuelo = (largo = 2): PasoCamino => ({ senuelo: largo });

export interface TableroCreador {
  readonly grid: Grid;
  readonly spawn: Spawn;
  readonly meta: { x: number; y: number };
  readonly items: ItemNivel[];
  /** Casillas del recorrido, en orden, ya trasladadas a la rejilla. */
  readonly celdas: readonly { x: number; y: number }[];
}

/**
 * Dibuja el tablero que recorre un camino.
 *
 * Todo lo que no se pinta queda vacío, y una casilla vacía no se puede pisar: así
 * las paredes del laberinto salen gratis y `puedeAvanzar` funciona sin declarar
 * nada. Al final se recorta a su tamaño con un borde de una casilla.
 */
export function tableroDeCamino(
  pasos: readonly PasoCamino[],
  dirInicial: Direccion = 'derecha',
  /** De que actividad es, para que los errores digan donde mirar. */
  etiqueta = 'una actividad',
): TableroCreador {
  const casillas = new Map<string, Tile>();
  const recorrido: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const estrellas: { x: number; y: number }[] = [];
  const senuelos: { x: number; y: number }[] = [];

  let x = 0;
  let y = 0;
  let dir = dirInicial;
  casillas.set('0,0', { t: 'camino' });

  const poner = (cx: number, cy: number, tile: Tile): void => {
    casillas.set(`${cx},${cy}`, tile);
  };

  /**
   * Exige que una casilla esté libre antes de romperla.
   *
   * Un camino que da la vuelta puede volver a pasar por donde ya estuvo, y eso no
   * molesta a nadie. Pero abrir un agujero o poner un puente roto encima de una
   * casilla por la que el Fuzz ya paso deja la actividad imposible, y a veces de
   * forma muy escondida: si cae sobre la casilla de salida, el Fuzz aparece dentro
   * del agujero. Es mejor que reviente al compilar y con el sitio exacto.
   */
  const libre = (cx: number, cy: number, que: string): void => {
    if (casillas.has(`${cx},${cy}`)) {
      throw new Error(
        `${etiqueta}: el camino pone ${que} en (${cx},${cy}), donde ya hay camino. ` +
          'Separa los tramos o cambia el orden de los pasos.',
      );
    }
  };

  for (const paso of pasos) {
    if ('gira' in paso) {
      dir = paso.gira === 'derecha' ? GIRO_DERECHA[dir] : GIRO_DERECHA[GIRO_DERECHA[GIRO_DERECHA[dir]]];
      continue;
    }
    if ('estrella' in paso) {
      estrellas.push({ x, y });
      continue;
    }
    if ('pinta' in paso) {
      poner(x, y, { t: 'camino', color: paso.pinta });
      continue;
    }
    if ('senuelo' in paso) {
      // Se pinta hacia delante sin mover al Fuzz: es un pasillo que no lleva a
      // ningun sitio.
      const { dx, dy } = DELTA[dir];
      for (let i = 1; i <= paso.senuelo; i++) {
        const sx = x + dx * i;
        const sy = y + dy * i;
        if (!casillas.has(`${sx},${sy}`)) {
          poner(sx, sy, { t: 'camino' });
          senuelos.push({ x: sx, y: sy });
        }
      }
      continue;
    }
    if ('salta' in paso) {
      const { dx, dy } = DELTA[dir];
      libre(x + dx, y + dy, 'un agujero');
      poner(x + dx, y + dy, { t: 'agujero' });
      x += dx * 2;
      y += dy * 2;
      poner(x, y, { t: 'camino' });
      recorrido.push({ x, y });
      continue;
    }
    if ('puente' in paso) {
      const { dx, dy } = DELTA[dir];
      x += dx;
      y += dy;
      libre(x, y, 'un puente roto');
      poner(x, y, { t: 'puente' });
      recorrido.push({ x, y });
      continue;
    }
    const { dx, dy } = DELTA[dir];
    for (let i = 0; i < paso.andar; i++) {
      x += dx;
      y += dy;
      // Un tramo puede volver sobre sus pasos; no se repinta lo que ya hay.
      if (!casillas.has(`${x},${y}`)) poner(x, y, { t: 'camino' });
      recorrido.push({ x, y });
    }
  }

  const meta = { x, y };
  poner(meta.x, meta.y, { t: 'meta' });

  /**
   * Un señuelo que cae sobre el camino de verdad no es un señuelo: es un atajo.
   * El Fuzz llegaria a la meta por donde no toca, o el sensor veria camino donde
   * la actividad supone que hay pared. Se comprueba al final porque el señuelo se
   * pinta antes de que el camino haya pasado por ahi.
   */
  const enElCamino = new Set(recorrido.map((c) => `${c.x},${c.y}`));
  for (const falso of senuelos) {
    if (enElCamino.has(`${falso.x},${falso.y}`)) {
      throw new Error(
        `${etiqueta}: el senuelo de (${falso.x},${falso.y}) cae sobre el camino ` +
          'de verdad. Acortalo o cambialo de sitio.',
      );
    }
  }

  // Recorte con un borde de una casilla alrededor.
  const xs = [...casillas.keys()].map((c) => Number(c.split(',')[0]));
  const ys = [...casillas.keys()].map((c) => Number(c.split(',')[1]));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const cols = Math.max(...xs) - minX + 3;
  const rows = Math.max(...ys) - minY + 3;

  const tiles: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ...VACIO })),
  );
  for (const [clave, tile] of casillas) {
    const partes = clave.split(',');
    const cx = Number(partes[0]) - minX + 1;
    const cy = Number(partes[1]) - minY + 1;
    const fila = tiles[cy];
    if (fila) fila[cx] = tile;
  }

  const mover = (c: { x: number; y: number }) => ({ x: c.x - minX + 1, y: c.y - minY + 1 });

  return {
    grid: { cols, rows, tiles },
    spawn: { ...mover({ x: 0, y: 0 }), dir: dirInicial },
    meta: mover(meta),
    items: estrellas.map((celda, i) => ({
      id: `estrella${i + 1}`,
      tipo: 'estrella' as const,
      ...mover(celda),
    })),
    celdas: recorrido.map(mover),
  };
}

// ──────────────────────────── La actividad ─────────────────────────────────

export interface OpcionesCreador {
  readonly camino: readonly PasoCamino[];
  readonly dirInicial?: Direccion;
  /** Bloques que la caja de herramientas ofrece en esta actividad. */
  readonly bloques: readonly string[];
  readonly solucion: readonly Bloque[];
  /** Bloques máximos para la tercera estrella. Por defecto, los de la solución. */
  readonly maxBloques?: number;
  /** Estructuras que exige la tercera estrella. Por defecto, las de la solución. */
  readonly exigeEstructuras?: readonly string[];
  readonly objetivosExtra?: readonly Objetivo[];
  readonly tipo?: TipoActividad;
  readonly dificultad?: number;
  readonly monedas?: number;
  /** Programa con un fallo que el niño debe corregir (mundo 19). */
  readonly programaPrefijado?: readonly Bloque[];
}

/**
 * Crea una actividad de Creadores.
 *
 * El editor, el lenguaje y el modo de movimiento son iguales en los diez mundos:
 * lo que cambia es la geometría del tablero y los bloques que la caja ofrece. Ese
 * filtro es el andamiaje: un niño del mundo 11 no debe ver el bloque de listas
 * del 18, porque la mitad de aprender una idea es que aparezca cuando toca.
 */
export function actividadCreador(
  contexto: ContextoCreador,
  opciones: OpcionesCreador,
): ActivityDefinition {
  const { mundo, numeroEnMundo, textos } = contexto;
  const tablero = tableroDeCamino(
    opciones.camino,
    opciones.dirInicial,
    `M${mundo}-A${numeroEnMundo} "${textos.nombre}"`,
  );

  const objetivos: Objetivo[] = [
    {
      id: 'salida',
      tipo: 'alcanzar_celda',
      x: tablero.meta.x,
      y: tablero.meta.y,
      obligatorio: true,
    },
  ];
  if (tablero.items.length > 0) {
    objetivos.push({ id: 'todas', tipo: 'recoger_todos', obligatorio: false });
  }
  for (const extra of opciones.objetivosExtra ?? []) objetivos.push(extra);

  const conEstrellas = [
    'salida',
    ...(tablero.items.length > 0 ? ['todas'] : []),
    ...(opciones.objetivosExtra ?? []).map((o) => o.id),
  ];

  const codigo = codigoDeBloques(opciones.solucion);
  const bloques = contarBloques(opciones.solucion);
  const estructuras = opciones.exigeEstructuras ?? estructurasDe(opciones.solucion);

  // Los sensores no son bloques de movimiento, pero el sandbox los pide por el
  // mismo canal, asi que tienen que estar en la lista de permitidos.
  const apiExtra = ['puedeAvanzar', 'hayObstaculo', 'colorCasilla'];
  const comandos = [...new Set([...opciones.bloques, ...apiExtra])];

  return {
    numeroEnMundo,
    slug: `m${String(mundo).padStart(2, '0')}-a${String(numeroEnMundo).padStart(2, '0')}-${slug(textos.nombre)}`,
    nombre: textos.nombre,
    tipo: opciones.tipo ?? (tablero.items.length > 0 ? 'recoleccion' : 'recorrido'),
    dificultad: opciones.dificultad ?? Math.min(5, Math.ceil(numeroEnMundo / 4)),
    instruccionTexto: textos.instruccion,
    exitoTexto: textos.exito,
    pistas: textos.pistas,
    config: {
      version: 3,
      grupo: 'creadores' as GrupoEdad,
      editor: 'bloques',
      lenguajes: ['javascript'],
      modoMovimiento: 'paso',
      grid: tablero.grid,
      spawn: tablero.spawn,
      items: tablero.items,
      comandosPermitidos: comandos,
      bloquesDisponibles: [...opciones.bloques],
      ...(opciones.programaPrefijado
        ? { codigoInicial: { javascript: codigoDeBloques(opciones.programaPrefijado) } }
        : {}),
      objetivos,
      criteriosEstrella: {
        '1': { objetivos: ['salida'] },
        '2': { objetivos: conEstrellas },
        '3': {
          objetivos: conEstrellas,
          maxFichas: opciones.maxBloques ?? bloques,
          ...(estructuras.length > 0 ? { requiereEstructuras: estructuras } : {}),
        },
      },
      audio: {
        instruccion: claveInstruccion(mundo, numeroEnMundo),
        exito: `celebration_${((numeroGlobal(mundo, numeroEnMundo) - 1) % 15) + 1}`,
        pistas: textos.pistas.map((_, i) => clavePista(mundo, numeroEnMundo, i + 1)),
      },
      recompensa: { monedas: opciones.monedas ?? 12 + numeroEnMundo },
      topeEjecucion: 6000,
    },
    solucionReferencia: { javascript: codigo, bloques },
  };
}
