/**
 * Generadores de actividades.
 *
 * Escribir 600 actividades a mano son unas 150 horas de trabajo, y la mayor
 * parte serían variaciones mecánicas: el mismo concepto con un camino distinto.
 * Estos generadores producen la geometría y los criterios de estrellas a partir
 * de unos pocos parámetros, y dejan para la mano humana lo único que no se puede
 * automatizar: el texto que oirá el niño.
 *
 * Cada generador garantiza tres cosas:
 *  - el camino es transitable de principio a fin,
 *  - la solución de referencia existe y es la óptima,
 *  - la dificultad crece de forma monótona dentro del mundo.
 *
 * `validate-content` comprueba después que todo eso se cumple de verdad.
 */
import {
  claveInstruccion,
  clavePista,
  numeroGlobal,
  type ActivityDefinition,
  type Grid,
  type GrupoEdad,
  type ItemNivel,
  type LenguajeCodigo,
  type ModoMovimiento,
  type Objetivo,
  type PasoPrograma,
  type Spawn,
  type Tile,
  type TipoActividad,
  type TipoEditor,
} from '@codenest/shared';

/** Casilla de camino. */
const CAMINO: Tile = { t: 'camino' };
const VACIO: Tile = { t: 'vacio' };
const META: Tile = { t: 'meta' };

export interface TextosActividad {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly string[];
}

export interface ContextoGenerador {
  readonly mundo: number;
  readonly numeroEnMundo: number;
  readonly grupo: GrupoEdad;
  readonly editor: TipoEditor;
  readonly lenguajes: readonly LenguajeCodigo[];
  readonly textos: TextosActividad;
}

/** Construye una rejilla vacía del tamaño indicado. */
function rejillaVacia(cols: number, rows: number): Tile[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ...VACIO })));
}

/** Un tramo del recorrido: dirección y número de casillas. */
export interface Tramo {
  readonly dir: 'derecha' | 'izquierda' | 'arriba' | 'abajo';
  readonly casillas: number;
}

const DELTA = {
  derecha: { dx: 1, dy: 0 },
  izquierda: { dx: -1, dy: 0 },
  arriba: { dx: 0, dy: -1 },
  abajo: { dx: 0, dy: 1 },
} as const;

export interface CaminoTrazado {
  readonly grid: Grid;
  readonly spawn: Spawn;
  readonly celdas: readonly { x: number; y: number }[];
  readonly meta: { x: number; y: number };
}

/**
 * Traza un camino a partir de una serie de tramos y devuelve la rejilla.
 * El tamaño se calcula para que el recorrido quepa justo, con un margen de una
 * casilla: un mapa más grande de lo necesario dispersa la atención.
 */
export function trazarCamino(inicio: { x: number; y: number }, tramos: readonly Tramo[]): CaminoTrazado {
  // Primer paso: recorrer para conocer los límites.
  const celdas: { x: number; y: number }[] = [{ ...inicio }];
  let x = inicio.x;
  let y = inicio.y;

  for (const tramo of tramos) {
    const { dx, dy } = DELTA[tramo.dir];
    for (let paso = 0; paso < tramo.casillas; paso++) {
      x += dx;
      y += dy;
      celdas.push({ x, y });
    }
  }

  const minX = Math.min(...celdas.map((c) => c.x));
  const minY = Math.min(...celdas.map((c) => c.y));
  const maxX = Math.max(...celdas.map((c) => c.x));
  const maxY = Math.max(...celdas.map((c) => c.y));

  // Se desplaza todo para que empiece en (1,1), dejando un borde vacío.
  const desplazadas = celdas.map((c) => ({ x: c.x - minX + 1, y: c.y - minY + 1 }));

  const cols = maxX - minX + 3;
  const rows = maxY - minY + 3;
  const tiles = rejillaVacia(cols, rows);

  for (const celda of desplazadas) {
    const fila = tiles[celda.y];
    if (fila) fila[celda.x] = { ...CAMINO };
  }

  const meta = desplazadas.at(-1) ?? desplazadas[0]!;
  const filaMeta = tiles[meta.y];
  if (filaMeta) filaMeta[meta.x] = { ...META };

  const primera = desplazadas[0]!;

  return {
    grid: { cols, rows, tiles },
    spawn: { x: primera.x, y: primera.y, dir: tramos[0]?.dir ?? 'derecha' },
    celdas: desplazadas,
    meta,
  };
}

/**
 * Actividad de recorrido en modo rodar (mundos 1 al 10).
 *
 * En este modo una ficha lleva al Fuzz hasta el final del tramo, así que la
 * solución óptima tiene tantas fichas como tramos tenga el camino. Es lo que
 * hace que la tercera estrella sea alcanzable pero no trivial.
 */
export function actividadRodar(
  contexto: ContextoGenerador,
  opciones: {
    readonly tramos: readonly Tramo[];
    readonly estrellasEnCamino?: readonly number[];
    readonly dificultad?: number;
    readonly tipo?: TipoActividad;
    readonly monedas?: number;
    readonly demoAnimada?: string;
  },
): ActivityDefinition {
  const { mundo, numeroEnMundo, textos } = contexto;
  const trazado = trazarCamino({ x: 0, y: 0 }, opciones.tramos);

  // Las estrellas se colocan en posiciones del recorrido, nunca fuera de él:
  // un objeto inalcanzable frustra sin ensenar nada.
  const items: ItemNivel[] = (opciones.estrellasEnCamino ?? []).map((indice, i) => {
    const celda = trazado.celdas[Math.min(indice, trazado.celdas.length - 1)]!;
    return { id: `estrella${i + 1}`, tipo: 'estrella', x: celda.x, y: celda.y };
  });

  const objetivos: Objetivo[] = [
    { id: 'salida', tipo: 'alcanzar_celda', x: trazado.meta.x, y: trazado.meta.y, obligatorio: true },
  ];
  if (items.length > 0) {
    objetivos.push({ id: 'todas', tipo: 'recoger_todos', obligatorio: false });
  }

  const comandos = [...new Set(opciones.tramos.map((t) => t.dir))];
  const solucion: PasoPrograma[] = opciones.tramos.map((t) => ({ cmd: t.dir }));

  const criteriosDos = items.length > 0 ? ['salida', 'todas'] : ['salida'];

  return {
    numeroEnMundo,
    slug: `m${String(mundo).padStart(2, '0')}-a${String(numeroEnMundo).padStart(2, '0')}-${slug(textos.nombre)}`,
    nombre: textos.nombre,
    tipo: opciones.tipo ?? (items.length > 0 ? 'recoleccion' : 'recorrido'),
    dificultad: opciones.dificultad ?? Math.min(5, Math.ceil(numeroEnMundo / 4)),
    instruccionTexto: textos.instruccion,
    exitoTexto: textos.exito,
    pistas: textos.pistas,
    config: {
      version: 3,
      grupo: contexto.grupo,
      editor: contexto.editor,
      lenguajes: contexto.lenguajes,
      modoMovimiento: 'rodar',
      grid: trazado.grid,
      spawn: trazado.spawn,
      items,
      comandosPermitidos: comandos,
      bloquesDisponibles: [],
      objetivos,
      criteriosEstrella: {
        '1': { objetivos: ['salida'] },
        '2': { objetivos: criteriosDos },
        // Tantas fichas como tramos: la solución óptima y ni una más.
        '3': { objetivos: criteriosDos, maxFichas: opciones.tramos.length },
      },
      audio: {
        instruccion: claveInstruccion(mundo, numeroEnMundo),
        // El pool compartido evita 600 clips que dicen lo mismo.
        exito: `celebration_${((numeroGlobal(mundo, numeroEnMundo) - 1) % 15) + 1}`,
        pistas: textos.pistas.map((_, i) => clavePista(mundo, numeroEnMundo, i + 1)),
      },
      ...(opciones.demoAnimada ? { demoAnimada: opciones.demoAnimada } : {}),
      recompensa: { monedas: opciones.monedas ?? 10 + numeroEnMundo },
      topeEjecucion: 2000,
    },
    solucionReferencia: { comandos: solucion },
  };
}

/**
 * Actividad de paso a paso (mundos 11 en adelante).
 *
 * Aquí cada comando avanza una casilla, así que la solución óptima se mide en
 * instrucciones ejecutadas, y la tercera estrella premia usar un bucle: menos
 * bloques escritos para el mismo número de pasos.
 */
export function actividadPaso(
  contexto: ContextoGenerador,
  opciones: {
    readonly tramos: readonly Tramo[];
    readonly estrellasEnCamino?: readonly number[];
    readonly bloques: readonly string[];
    /** Bloques que la tercera estrella exige usar (por ejemplo, repetir). */
    readonly exigeEstructuras?: readonly string[];
    readonly maxBloques?: number;
    readonly dificultad?: number;
    readonly tipo?: TipoActividad;
    readonly monedas?: number;
    readonly codigoInicial?: Partial<Record<LenguajeCodigo, string>>;
  },
): ActivityDefinition {
  const { mundo, numeroEnMundo, textos } = contexto;
  const trazado = trazarCamino({ x: 0, y: 0 }, opciones.tramos);

  const items: ItemNivel[] = (opciones.estrellasEnCamino ?? []).map((indice, i) => {
    const celda = trazado.celdas[Math.min(indice, trazado.celdas.length - 1)]!;
    return { id: `estrella${i + 1}`, tipo: 'estrella', x: celda.x, y: celda.y };
  });

  const objetivos: Objetivo[] = [
    { id: 'salida', tipo: 'alcanzar_celda', x: trazado.meta.x, y: trazado.meta.y, obligatorio: true },
  ];
  if (items.length > 0) {
    objetivos.push({ id: 'todas', tipo: 'recoger_todos', obligatorio: false });
  }

  // Pasos totales: cada casilla del recorrido es un avance.
  const pasos = trazado.celdas.length - 1;
  const criteriosDos = items.length > 0 ? ['salida', 'todas'] : ['salida'];

  const solucionJs = generarJsPaso(opciones.tramos);

  return {
    numeroEnMundo,
    slug: `m${String(mundo).padStart(2, '0')}-a${String(numeroEnMundo).padStart(2, '0')}-${slug(textos.nombre)}`,
    nombre: textos.nombre,
    tipo: opciones.tipo ?? 'recorrido',
    dificultad: opciones.dificultad ?? Math.min(5, Math.ceil(numeroEnMundo / 4)),
    instruccionTexto: textos.instruccion,
    exitoTexto: textos.exito,
    pistas: textos.pistas,
    config: {
      version: 3,
      grupo: contexto.grupo,
      editor: contexto.editor,
      lenguajes: contexto.lenguajes,
      modoMovimiento: 'paso',
      grid: trazado.grid,
      spawn: trazado.spawn,
      items,
      comandosPermitidos: ['avanzar', 'girarDerecha', 'girarIzquierda'],
      bloquesDisponibles: opciones.bloques,
      ...(opciones.codigoInicial ? { codigoInicial: opciones.codigoInicial } : {}),
      objetivos,
      criteriosEstrella: {
        '1': { objetivos: ['salida'] },
        '2': { objetivos: criteriosDos, maxInstrucciones: pasos + 6 },
        '3': {
          objetivos: criteriosDos,
          maxInstrucciones: pasos + 2,
          ...(opciones.maxBloques ? { maxFichas: opciones.maxBloques } : {}),
          ...(opciones.exigeEstructuras ? { requiereEstructuras: opciones.exigeEstructuras } : {}),
        },
      },
      audio: {
        instruccion: claveInstruccion(mundo, numeroEnMundo),
        exito: `celebration_${((numeroGlobal(mundo, numeroEnMundo) - 1) % 15) + 1}`,
        pistas: textos.pistas.map((_, i) => clavePista(mundo, numeroEnMundo, i + 1)),
      },
      recompensa: { monedas: opciones.monedas ?? 12 + numeroEnMundo },
      topeEjecucion: 10_000,
    },
    solucionReferencia: { javascript: solucionJs },
  };
}

/**
 * Genera el JavaScript de referencia para un recorrido en modo paso.
 * Se usa `avanzar` y giros, que es la API de los mundos 11 en adelante.
 */
function generarJsPaso(tramos: readonly Tramo[]): string {
  const lineas: string[] = [];
  let direccionActual: Tramo['dir'] = tramos[0]?.dir ?? 'derecha';

  const orden: Tramo['dir'][] = ['derecha', 'abajo', 'izquierda', 'arriba'];

  for (const [indice, tramo] of tramos.entries()) {
    if (indice > 0) {
      // Giros necesarios para encarar la nueva dirección.
      const desde = orden.indexOf(direccionActual);
      const hasta = orden.indexOf(tramo.dir);
      const giros = (hasta - desde + 4) % 4;

      if (giros === 3) lineas.push('fuzz.girarIzquierda();');
      else for (let g = 0; g < giros; g++) lineas.push('fuzz.girarDerecha();');
    }

    // Más de dos casillas seguidas piden un bucle: es lo que ensena el mundo 11.
    if (tramo.casillas > 2) {
      lineas.push(`repetir(${tramo.casillas}, () => {`);
      lineas.push('  fuzz.avanzar();');
      lineas.push('});');
    } else {
      for (let paso = 0; paso < tramo.casillas; paso++) lineas.push('fuzz.avanzar();');
    }

    direccionActual = tramo.dir;
  }

  return lineas.join('\n');
}

/** Convierte un título en un slug apto para la base de datos. */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
