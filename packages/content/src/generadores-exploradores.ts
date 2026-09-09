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

// ───────────── Pasillos con huecos irregulares (mundo 6: mirar antes) ───────

export interface PasilloIrregular extends CaminoConSaltos {
  /**
   * Veces que hay que preguntar "hay camino?" para cruzarlo entero.
   *
   * Se calcula aquí y no a mano porque es el número que va dentro del bucle, y
   * equivocarse deja la actividad imposible sin que se note leyéndola.
   */
  readonly decisiones: number;
}

/**
 * Un pasillo con huecos a distancias distintas.
 *
 * Es la diferencia entre el mundo 3 y el mundo 6. Allí los huecos estaban cada
 * tres casillas, así que "rueda y salta" repetido funcionaba sin mirar. Aquí no
 * hay patrón: un tramo mide cuatro casillas y el siguiente una. La única forma
 * de cruzarlo con un solo programa es preguntar antes de cada paso.
 *
 * `tramos` son las casillas firmes seguidas, contando el punto de partida en la
 * primera. Entre cada dos hay un hueco.
 */
export function pasilloIrregular(
  dir: Tramo['dir'],
  firmesPorTramo: readonly number[],
): PasilloIrregular {
  const agujeros: number[] = [];
  const firmes: number[] = [0];
  let indice = 0;
  let casillas = 0;
  let decisiones = 0;

  firmesPorTramo.forEach((largo, tramo) => {
    // Una casilla del tramo ya esta puesta: la de partida en el primero, la de
    // aterrizaje en los demas.
    const nuevas = largo - 1;

    if (tramo > 0) {
      // El hueco que separa este tramo del anterior.
      indice += 1;
      casillas += 1;
      agujeros.push(indice);
      // La casilla donde se aterriza.
      indice += 1;
      casillas += 1;
      firmes.push(indice);
      decisiones += 1; // el salto
    }

    for (let i = 0; i < nuevas; i++) {
      indice += 1;
      casillas += 1;
      firmes.push(indice);
    }

    // Rodar solo cuenta si queda camino firme por delante.
    if (nuevas > 0) decisiones += 1;
  });

  return { tramos: [{ dir, casillas }], agujeros, firmes, decisiones };
}
