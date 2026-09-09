/**
 * Generadores de las mecánicas de los Exploradores (mundos 1 al 10).
 *
 * Cada mundo introduce una idea nueva, y cada idea necesita una geometría que la
 * haga inevitable. No basta con permitir el bucle: el camino tiene que ser tan
 * largo que poner quince fichas sea insoportable y repetir sea el descubrimiento
 * del niño, no una instrucción del adulto.
 *
 * Ese es el criterio de todos estos generadores: diseñar el tablero para que la
 * solución elegante sea también la más cómoda.
 */
import {
  claveInstruccion,
  clavePista,
  numeroGlobal,
  type ActivityDefinition,
  type ColorCasilla,
  type Grid,
  type GrupoEdad,
  type ItemNivel,
  type Objetivo,
  type PasoPrograma,
  type Spawn,
  type Tile,
  type TipoActividad,
} from '@codenest/shared';

import { slug, type TextosActividad, type Tramo } from './generadores.js';

const VACIO: Tile = { t: 'vacio' };

/** Contexto común a todas las actividades de los Exploradores. */
export interface ContextoExplorador {
  readonly mundo: number;
  readonly numeroEnMundo: number;
  readonly textos: TextosActividad;
}

const DELTA = {
  derecha: { dx: 1, dy: 0 },
  izquierda: { dx: -1, dy: 0 },
  arriba: { dx: 0, dy: -1 },
  abajo: { dx: 0, dy: 1 },
} as const;

interface Celda {
  x: number;
  y: number;
}

/** Lienzo de trabajo: se pinta y al final se recorta a su tamaño mínimo. */
class Lienzo {
  private readonly casillas = new Map<string, Tile>();

  poner(x: number, y: number, tile: Tile): void {
    this.casillas.set(`${x},${y}`, tile);
  }

  tiene(x: number, y: number): boolean {
    return this.casillas.has(`${x},${y}`);
  }

  /**
   * Convierte lo pintado en una rejilla, desplazando todo para que empiece en
   * (1,1) y dejando un borde vacío alrededor. El borde importa: sin él, el Fuzz
   * al rodar se saldría del lienzo visible.
   */
  aRejilla(celdas: readonly Celda[]): { grid: Grid; mover: (c: Celda) => Celda } {
    const xs = celdas.map((c) => c.x);
    const ys = celdas.map((c) => c.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const cols = Math.max(...xs) - minX + 3;
    const rows = Math.max(...ys) - minY + 3;

    const tiles: Tile[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ ...VACIO })),
    );

    for (const [clave, tile] of this.casillas) {
      const partes = clave.split(',');
      const x = Number(partes[0]) - minX + 1;
      const y = Number(partes[1]) - minY + 1;
      const fila = tiles[y];
      if (fila && x >= 0 && x < cols) fila[x] = tile;
    }

    return {
      grid: { cols, rows, tiles },
      mover: (c) => ({ x: c.x - minX + 1, y: c.y - minY + 1 }),
    };
  }
}

/** Descripción de un camino: tramos, y qué hay en cada casilla. */
export interface PlanCamino {
  readonly tramos: readonly Tramo[];
  /** Color de la casilla donde termina cada tramo (mundo 2). */
  readonly coloresDeGiro?: readonly (ColorCasilla | undefined)[];
  /** Índices del recorrido donde hay un agujero que saltar (mundo 3). */
  readonly agujeros?: readonly number[];
  /** Índices del recorrido donde hay una estrella. */
  readonly estrellas?: readonly number[];
  /** Objetos con nombre propio, cuando el orden de recogida importa (mundo 5). */
  readonly objetos?: readonly ObjetoEnCamino[];
}

/**
 * Un objeto colocado en una casilla concreta del recorrido.
 *
 * A diferencia de las estrellas, aquí el identificador lo elige el autor, porque
 * el mundo 5 necesita nombrarlos para exigir un orden de recogida.
 */
export interface ObjetoEnCamino {
  readonly indice: number;
  readonly id: string;
  readonly tipo: ItemNivel['tipo'];
  readonly color?: ColorCasilla;
}

interface CaminoConstruido {
  readonly grid: Grid;
  readonly spawn: Spawn;
  readonly celdas: readonly Celda[];
  readonly meta: Celda;
  readonly items: ItemNivel[];
}

/**
 * Construye el tablero de un plan de camino.
 *
 * Los agujeros se colocan SOBRE el recorrido: el Fuzz llega rodando, se para al
 * borde y hay que saltarlos. Un agujero fuera del camino sería decorado.
 */
function construir(plan: PlanCamino): CaminoConstruido {
  const lienzo = new Lienzo();
  const celdas: Celda[] = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;

  lienzo.poner(0, 0, { t: 'camino' });

  const agujeros = new Set(plan.agujeros ?? []);

  for (const [iTramo, tramo] of plan.tramos.entries()) {
    const { dx, dy } = DELTA[tramo.dir];

    for (let paso = 0; paso < tramo.casillas; paso++) {
      x += dx;
      y += dy;
      celdas.push({ x, y });

      const indice = celdas.length - 1;
      // Un agujero interrumpe el camino: el Fuzz se para justo antes.
      lienzo.poner(x, y, agujeros.has(indice) ? { t: 'agujero' } : { t: 'camino' });
    }

    // El final de cada tramo puede llevar color: es la pista visual del giro.
    const color = plan.coloresDeGiro?.[iTramo];
    if (color) lienzo.poner(x, y, { t: 'camino', color });
  }

  const meta = { x, y };
  lienzo.poner(meta.x, meta.y, { t: 'meta' });

  const { grid, mover } = lienzo.aRejilla(celdas);
  const movidas = celdas.map(mover);

  // Una estrella sobre un agujero es inalcanzable, asi que se desplaza a la
  // casilla firme mas cercana. Es preferible corregirlo aqui a que el autor
  // tenga que llevar la cuenta de donde cae cada hueco.
  const esAgujero = new Set(plan.agujeros ?? []);
  const firme = (indice: number): Celda => {
    let destino = Math.min(indice, celdas.length - 1);
    while (destino > 0 && esAgujero.has(destino)) destino -= 1;
    return movidas[destino]!;
  };

  const items: ItemNivel[] = (plan.estrellas ?? []).map((indice, i) => ({
    id: `estrella${i + 1}`,
    tipo: 'estrella',
    ...firme(indice),
  }));

  for (const objeto of plan.objetos ?? []) {
    items.push({
      id: objeto.id,
      tipo: objeto.tipo,
      ...firme(objeto.indice),
      ...(objeto.color ? { color: objeto.color } : {}),
    });
  }

  return {
    grid,
    spawn: { ...movidas[0]!, dir: plan.tramos[0]?.dir ?? 'derecha' },
    celdas: movidas,
    meta: mover(meta),
    items,
  };
}

/** Opciones comunes de todas las actividades de Exploradores. */
export interface OpcionesExplorador {
  readonly plan: PlanCamino;
  readonly comandos: readonly string[];
  readonly solucion: readonly PasoPrograma[];
  /** Fichas máximas para la tercera estrella. Por defecto, las de la solución. */
  readonly maxFichas?: number;
  /** Estructuras que la tercera estrella exige usar. */
  readonly exigeEstructuras?: readonly string[];
  /**
   * Objetivos que se suman a los de siempre (llegar y recoger).
   *
   * Cuentan desde la segunda estrella: la primera se conforma con llegar, para
   * que un niño que se equivoca de orden no se quede sin nada.
   */
  readonly objetivosExtra?: readonly Objetivo[];
  /**
   * Objetivos que solo pide la tercera estrella.
   *
   * El mundo 5 los usa para el orden de recogida: un niño que recoge las tres
   * frutas en el orden equivocado se lleva dos estrellas, no cero. La tercera se
   * gana haciéndolo bien, que es distinto de hacerlo.
   */
  readonly objetivosTercera?: readonly Objetivo[];
  readonly tipo?: TipoActividad;
  readonly dificultad?: number;
  readonly monedas?: number;
  readonly demoAnimada?: string;
  /** Programa con errores que el niño debe corregir (mundos 9 y 19). */
  readonly programaPrefijado?: readonly PasoPrograma[];
}

/** Cuenta las fichas de un programa, incluidas las anidadas. */
function contarFichas(pasos: readonly PasoPrograma[]): number {
  return pasos.reduce(
    (t, p) => t + 1 + contarFichas(p.hijos ?? []) + contarFichas(p.sino ?? []),
    0,
  );
}

/**
 * Crea una actividad de Exploradores.
 *
 * Todas comparten grupo, editor y modo de movimiento: las diferencias entre
 * mundos están en la geometría del tablero y en los comandos disponibles, no en
 * la forma de la actividad.
 */
export function actividadExplorador(
  contexto: ContextoExplorador,
  opciones: OpcionesExplorador,
): ActivityDefinition {
  const { mundo, numeroEnMundo, textos } = contexto;
  const tablero = construir(opciones.plan);

  const objetivos: Objetivo[] = [
    { id: 'salida', tipo: 'alcanzar_celda', x: tablero.meta.x, y: tablero.meta.y, obligatorio: true },
  ];
  if (tablero.items.length > 0) {
    objetivos.push({ id: 'todas', tipo: 'recoger_todos', obligatorio: false });
  }
  for (const extra of opciones.objetivosExtra ?? []) objetivos.push(extra);
  for (const extra of opciones.objetivosTercera ?? []) objetivos.push(extra);

  const conEstrellas = [
    'salida',
    ...(tablero.items.length > 0 ? ['todas'] : []),
    ...(opciones.objetivosExtra ?? []).map((o) => o.id),
  ];
  const paraTercera = [...conEstrellas, ...(opciones.objetivosTercera ?? []).map((o) => o.id)];
  const maxFichas = opciones.maxFichas ?? contarFichas(opciones.solucion);

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
      grupo: 'exploradores' as GrupoEdad,
      editor: 'comandos',
      lenguajes: ['comandos'],
      modoMovimiento: 'rodar',
      grid: tablero.grid,
      spawn: tablero.spawn,
      items: tablero.items,
      comandosPermitidos: opciones.comandos,
      bloquesDisponibles: [],
      ...(opciones.programaPrefijado ? { programaPrefijado: opciones.programaPrefijado } : {}),
      objetivos,
      criteriosEstrella: {
        '1': { objetivos: ['salida'] },
        '2': { objetivos: conEstrellas },
        '3': {
          objetivos: paraTercera,
          maxFichas,
          ...(opciones.exigeEstructuras ? { requiereEstructuras: opciones.exigeEstructuras } : {}),
        },
      },
      audio: {
        instruccion: claveInstruccion(mundo, numeroEnMundo),
        exito: `celebration_${((numeroGlobal(mundo, numeroEnMundo) - 1) % 15) + 1}`,
        pistas: textos.pistas.map((_, i) => clavePista(mundo, numeroEnMundo, i + 1)),
      },
      ...(opciones.demoAnimada ? { demoAnimada: opciones.demoAnimada } : {}),
      recompensa: { monedas: opciones.monedas ?? 10 + numeroEnMundo },
      topeEjecucion: 4000,
    },
    solucionReferencia: { comandos: opciones.solucion },
  };
}

// ─────────────────────── Atajos para escribir soluciones ───────────────────

/** Una ficha de dirección. */
export const ir = (dir: Tramo['dir']): PasoPrograma => ({ cmd: dir });

/** Ficha de salto. */
export const saltar = (): PasoPrograma => ({ cmd: 'saltar' });

/** Ficha de bucle contado. */
export const repetir = (veces: number, ...hijos: PasoPrograma[]): PasoPrograma => ({
  cmd: 'repetir',
  veces,
  hijos,
});

/** Ficha de condicional por color. */
export const siColor = (
  color: ColorCasilla,
  entonces: PasoPrograma[],
  sino: PasoPrograma[] = [],
): PasoPrograma => ({ cmd: 'siColor', color, hijos: entonces, sino });

/** Ficha de condicional por camino libre. */
export const siSino = (
  entonces: PasoPrograma[],
  sino: PasoPrograma[] = [],
): PasoPrograma => ({ cmd: 'siSino', hijos: entonces, sino });

/** Declaración de un grupo de fichas con nombre. */
export const definir = (nombre: string, ...hijos: PasoPrograma[]): PasoPrograma => ({
  cmd: 'funcion',
  nombre,
  hijos,
});

/** Llamada a un grupo declarado. */
export const llamar = (nombre = 'superSalto'): PasoPrograma => ({ cmd: 'llamar', nombre });

/** Tramo de camino, para escribir planes de forma compacta. */
export const t = (dir: Tramo['dir'], casillas: number): Tramo => ({ dir, casillas });

// ─────────────────── Caminos con agujeros que hay que saltar ───────────────

/**
 * Un tramo de camino con agujeros regulares.
 *
 * La separacion entre agujeros no es libre: el Fuzz rueda hasta el borde, salta
 * dos casillas y aterriza. Para que pueda volver a rodar antes del siguiente
 * agujero hace falta una casilla de margen. Con agujeros cada dos casillas, el
 * Fuzz aterriza pegado al siguiente y no puede ni moverse.
 *
 * De ahi el tres: rodar una, saltar el hueco, aterrizar. Ese ritmo se repite.
 */
export interface SegmentoSaltos {
  readonly dir: Tramo['dir'];
  /** Numero de agujeros a saltar en este tramo. */
  readonly saltos?: number;
  /** Casillas lisas, si el tramo no tiene agujeros. */
  readonly casillas?: number;
}

export interface CaminoConSaltos {
  readonly tramos: Tramo[];
  readonly agujeros: number[];
  /** Indices del recorrido que son camino firme, para colocar estrellas. */
  readonly firmes: number[];
}

/** Casillas que ocupa un tramo con n agujeros: rodar, saltar, aterrizar. */
export const CASILLAS_POR_SALTO = 3;

/**
 * Construye un camino a partir de segmentos, calculando donde caen los agujeros.
 *
 * Devuelve tambien los indices firmes, porque una estrella sobre un agujero es
 * inalcanzable y el validador la rechaza con razon.
 */
export function caminoConSaltos(segmentos: readonly SegmentoSaltos[]): CaminoConSaltos {
  const tramos: Tramo[] = [];
  const agujeros: number[] = [];
  const firmes: number[] = [0];

  // Indice de la ultima casilla colocada; el 0 es el punto de partida.
  let indice = 0;

  for (const segmento of segmentos) {
    if (segmento.saltos && segmento.saltos > 0) {
      const casillas = segmento.saltos * CASILLAS_POR_SALTO;
      tramos.push({ dir: segmento.dir, casillas });

      for (let i = 0; i < casillas; i++) {
        indice += 1;
        // Dentro de cada grupo de tres, el hueco es el segundo.
        const esAgujero = i % CASILLAS_POR_SALTO === 1;
        if (esAgujero) agujeros.push(indice);
        else firmes.push(indice);
      }
    } else {
      const casillas = segmento.casillas ?? 1;
      tramos.push({ dir: segmento.dir, casillas });
      for (let i = 0; i < casillas; i++) {
        indice += 1;
        firmes.push(indice);
      }
    }
  }

  return { tramos, agujeros, firmes };
}

/**
 * Elige indices firmes bien repartidos para colocar estrellas.
 *
 * Se evita el primero y el ultimo: una estrella sobre la casilla de salida se
 * recoge sin hacer nada, y sobre la meta no anade ningun reto.
 */
export function estrellasEn(firmes: readonly number[], cuantas: number): number[] {
  const disponibles = firmes.slice(1, -1);
  if (disponibles.length === 0 || cuantas <= 0) return [];

  const elegidas: number[] = [];
  for (let i = 0; i < cuantas; i++) {
    const posicion = Math.floor(((i + 1) * disponibles.length) / (cuantas + 1));
    const indice = disponibles[Math.min(posicion, disponibles.length - 1)];
    if (indice !== undefined && !elegidas.includes(indice)) elegidas.push(indice);
  }
  return elegidas;
}

// ───────────────────────── Caminos cerrados (mundo 5) ──────────────────────

/**
 * Índice del recorrido donde acaba cada tramo, es decir, cada esquina.
 *
 * En el modo rodar sólo se puede parar en una esquina: el Fuzz avanza hasta que
 * el camino se corta. Por eso las esquinas son los únicos sitios donde tiene
 * sentido poner algo que haya que recoger en un orden concreto.
 */
export function esquinas(tramos: readonly Tramo[]): number[] {
  const indices: number[] = [];
  let indice = 0;
  for (const tramo of tramos) {
    indice += tramo.casillas;
    indices.push(indice);
  }
  return indices;
}

// ─────────────────── Saltos encadenados (mundo 7: Super Salto) ─────────────

/**
 * Un camino de piedras y huecos alternos: solo se puede cruzar saltando.
 *
 * Es la geometría que en el mundo 3 era un error. Allí el niño rodaba y saltaba,
 * y un hueco cada dos casillas lo dejaba sin sitio para rodar. Aquí es justo lo
 * que se busca: rodar no sirve, hay que saltar, saltar, saltar. De ahí sale la
 * caja de Garfio, el Super Salto.
 */
export function caminoSaltosSeguidos(
  segmentos: readonly SegmentoSaltos[],
): CaminoConSaltos {
  const tramos: Tramo[] = [];
  const agujeros: number[] = [];
  const firmes: number[] = [0];
  let indice = 0;

  for (const segmento of segmentos) {
    if (segmento.saltos && segmento.saltos > 0) {
      // Cada salto son dos casillas: el hueco y la piedra donde se aterriza.
      const casillas = segmento.saltos * 2;
      tramos.push({ dir: segmento.dir, casillas });

      for (let i = 0; i < casillas; i++) {
        indice += 1;
        if (i % 2 === 0) agujeros.push(indice);
        else firmes.push(indice);
      }
    } else {
      const casillas = segmento.casillas ?? 1;
      tramos.push({ dir: segmento.dir, casillas });
      for (let i = 0; i < casillas; i++) {
        indice += 1;
        firmes.push(indice);
      }
    }
  }

  return { tramos, agujeros, firmes };
}

// ───────────── Caminos de nubes con huecos irregulares (mundo 6) ───────────

/**
 * Un tramo del castillo: una dirección, y la longitud de cada trozo de nube.
 *
 * Entre cada dos trozos hay exactamente un hueco. El primer trozo del segmento
 * incluye la casilla donde el Fuzz ya está: la de salida en el primer segmento,
 * la esquina en los demás.
 */
export interface SegmentoNubes {
  readonly dir: Tramo['dir'];
  readonly nubes: readonly number[];
}

export interface CaminoNubes extends CaminoConSaltos {
  /**
   * Decisiones que cuesta cruzar cada segmento, contando la rodada inicial.
   *
   * Es el número que va dentro del bucle, y se calcula aquí porque contarlo a
   * mano deja la actividad imposible sin que se note leyendo el código.
   */
  readonly decisiones: number[];
}

/**
 * Un camino con los huecos a distancias distintas.
 *
 * Es la diferencia entre el mundo 3 y el mundo 6. Allí los huecos estaban cada
 * tres casillas, así que "rueda y salta" repetido cruzaba el tablero sin mirar.
 * Aquí un trozo mide cuatro casillas y el siguiente una, y no hay ningún patrón
 * que valga para los dos: la única forma de cruzarlo con un programa corto es
 * preguntar antes de cada paso.
 *
 * Una decisión es una pregunta del bucle: o rueda hasta el borde, o salta el
 * hueco. Rodar solo cuenta si por delante queda nube; un trozo de una sola
 * casilla no se rueda, se salta y ya está.
 */
export function caminoDeNubes(segmentos: readonly SegmentoNubes[]): CaminoNubes {
  const tramos: Tramo[] = [];
  const agujeros: number[] = [];
  const firmes: number[] = [0];
  const decisiones: number[] = [];
  let indice = 0;

  for (const segmento of segmentos) {
    let casillas = 0;
    let cuenta = 0;

    segmento.nubes.forEach((largo, trozo) => {
      if (trozo > 0) {
        // El hueco que separa este trozo del anterior.
        indice += 1;
        casillas += 1;
        agujeros.push(indice);
        // La nube donde se aterriza.
        indice += 1;
        casillas += 1;
        firmes.push(indice);
        cuenta += 1;
      }

      for (let i = 0; i < largo - 1; i++) {
        indice += 1;
        casillas += 1;
        firmes.push(indice);
      }

      if (largo > 1) cuenta += 1;
    });

    tramos.push({ dir: segmento.dir, casillas });
    decisiones.push(cuenta);
  }

  return { tramos, agujeros, firmes, decisiones };
}

/** El bucle que pregunta: si hay nube rueda, y si no salta. */
export function bucleQueMira(dir: Tramo['dir'], veces: number): PasoPrograma {
  const decision = siSino([ir(dir)], [saltar()]);
  return veces > 1 ? repetir(veces, decision) : decision;
}

/**
 * El programa canónico de un camino de nubes: un bucle por segmento.
 *
 * En los segmentos que no son el primero hace falta una ficha de dirección antes
 * del bucle, porque el Fuzz llega a la esquina mirando hacia donde venía y la
 * ficha de saltar salta hacia donde mira. Sin girar primero, saltaría al vacío.
 */
export function programaDeNubes(
  segmentos: readonly SegmentoNubes[],
  decisiones: readonly number[],
): PasoPrograma[] {
  const pasos: PasoPrograma[] = [];

  segmentos.forEach((segmento, i) => {
    const cuenta = decisiones[i]!;
    if (i === 0) {
      pasos.push(bucleQueMira(segmento.dir, cuenta));
      return;
    }
    // La ficha de dirección gasta la primera decisión del segmento.
    pasos.push(ir(segmento.dir));
    if (cuenta > 1) pasos.push(bucleQueMira(segmento.dir, cuenta - 1));
  });

  return pasos;
}

// ─────────────── Tableros deducidos del programa (mundos 7 al 10) ──────────

/**
 * Un movimiento del Fuzz, en el nivel en que se piensa una actividad.
 *
 * No son fichas todavía: son lo que el Fuzz hace. De aquí salen dos cosas a la
 * vez, el tablero y el programa, y esa es la razón de que exista este tipo.
 *
 * En los mundos avanzados el tablero es demasiado difícil de escribir a mano.
 * Una actividad con cajas y bucles anidados tiene veinte huecos, y si uno cae
 * una casilla más allá de donde el autor creía, la actividad es imposible y el
 * validador solo dice "el Fuzz choco". Deducir el tablero del programa quita esa
 * clase de error entera: el camino es, por construcción, el que recorre la
 * solución.
 */
export type Movimiento =
  | { readonly salta: true }
  | { readonly rueda: Tramo['dir']; readonly casillas: number }
  | { readonly repite: number; readonly cuerpo: readonly Movimiento[] }
  | { readonly usa: string };

/** Un salto: por encima del hueco que tiene delante, hacia donde mira. */
export const salta = (): Movimiento => ({ salta: true });

/** Una rodada: en modo rodar el Fuzz recorre el tramo entero de una vez. */
export const rueda = (dir: Tramo['dir'], casillas = 1): Movimiento => ({
  rueda: dir,
  casillas,
});

/** Un bucle contado, que puede llevar otros bucles dentro. */
export const repite = (veces: number, ...cuerpo: Movimiento[]): Movimiento => ({
  repite: veces,
  cuerpo,
});

/** Una llamada a una caja con nombre. */
export const usa = (nombre = 'superSalto'): Movimiento => ({ usa: nombre });

/** Cajas de una actividad: nombre y lo que hay dentro. */
export type Cajas = Readonly<Record<string, readonly Movimiento[]>>;

export interface PlanPrograma {
  /** Hacia dónde mira el Fuzz al empezar. Importa porque el salto es relativo. */
  readonly dirInicial?: Tramo['dir'];
  readonly cajas?: Cajas;
  readonly movimientos: readonly Movimiento[];
}

export interface TableroPrograma extends CaminoConSaltos {
  /** El programa en fichas, listo para ser la solución de referencia. */
  readonly fichas: PasoPrograma[];
}

/**
 * Construye el tablero que recorre un programa, y el programa en fichas.
 *
 * Cada salto pone un hueco y la piedra donde se aterriza. Cada rodada pone
 * camino firme. Al ir en el mismo orden que el programa, el camino resultante es
 * exactamente el que la solución sabe recorrer.
 */
export function tableroDePrograma(plan: PlanPrograma): TableroPrograma {
  const cajas = plan.cajas ?? {};
  const segmentos: SegmentoSaltos[] = [];
  let dir = plan.dirInicial ?? 'derecha';

  const recorrer = (movimientos: readonly Movimiento[], profundidad: number): void => {
    if (profundidad > 8) {
      throw new Error('El programa de la actividad se anida demasiado.');
    }

    for (const movimiento of movimientos) {
      if ('salta' in movimiento) {
        // Dos casillas: el hueco y la piedra del otro lado.
        segmentos.push({ dir, saltos: 1 });
        continue;
      }
      if ('rueda' in movimiento) {
        dir = movimiento.rueda;
        segmentos.push({ dir, casillas: movimiento.casillas });
        continue;
      }
      if ('repite' in movimiento) {
        for (let i = 0; i < movimiento.repite; i++) {
          recorrer(movimiento.cuerpo, profundidad + 1);
        }
        continue;
      }
      const cuerpo = cajas[movimiento.usa];
      if (!cuerpo) throw new Error(`No hay ninguna caja llamada "${movimiento.usa}".`);
      recorrer(cuerpo, profundidad + 1);
    }
  };

  recorrer(plan.movimientos, 0);

  const camino = caminoSaltosSeguidos(segmentos);
  return { ...camino, fichas: fichasDePrograma(plan) };
}

/** Traduce un plan de movimientos a fichas, cajas incluidas. */
export function fichasDePrograma(plan: PlanPrograma): PasoPrograma[] {
  const enFicha = (movimiento: Movimiento): PasoPrograma => {
    if ('salta' in movimiento) return saltar();
    if ('rueda' in movimiento) return ir(movimiento.rueda);
    if ('repite' in movimiento) {
      return repetir(movimiento.repite, ...movimiento.cuerpo.map(enFicha));
    }
    return llamar(movimiento.usa);
  };

  const pasos: PasoPrograma[] = [];
  // Declarar una caja no mueve al Fuzz, así que todas van al principio.
  for (const [nombre, cuerpo] of Object.entries(plan.cajas ?? {})) {
    pasos.push(definir(nombre, ...cuerpo.map(enFicha)));
  }
  for (const movimiento of plan.movimientos) pasos.push(enFicha(movimiento));
  return pasos;
}
