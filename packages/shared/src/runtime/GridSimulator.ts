/**
 * Simulador de rejilla: la unica semantica de juego de CodeNest School.
 *
 * Es codigo puro (sin DOM, sin Phaser, sin Prisma) para que lo usen los tres
 * lados sin divergir nunca:
 *   1. el Web Worker, mientras el nino juega,
 *   2. el renderizador de Phaser, para animar las acciones,
 *   3. el backend, que recalcula las estrellas re-simulando las acciones
 *      recibidas. El servidor NUNCA ejecuta el codigo del alumno.
 *
 * Dos modos de movimiento:
 *   - `rodar` (mundos 1-10, mecanica de Kodable): cada ficha lanza al Fuzz en
 *     una direccion y este avanza hasta que se le acaba el camino. Una sola
 *     ficha puede recorrer muchas casillas.
 *   - `paso`  (mundos 11-30): cada comando avanza exactamente una casilla.
 */
import type {
  Accion,
  Celda,
  ColorCasilla,
  Direccion,
  ErrorEjecucion,
  Grid,
  ItemNivel,
  ItemRecogido,
  ModoMovimiento,
  Spawn,
  Tile,
} from '../types/runtime.js';

/** Desplazamiento unitario de cada direccion. */
export const DELTA: Readonly<Record<Direccion, { dx: number; dy: number }>> = {
  derecha: { dx: 1, dy: 0 },
  izquierda: { dx: -1, dy: 0 },
  arriba: { dx: 0, dy: -1 },
  abajo: { dx: 0, dy: 1 },
};

/** Giro de 90 grados a la derecha. */
export const GIRO_DERECHA: Readonly<Record<Direccion, Direccion>> = {
  derecha: 'abajo',
  abajo: 'izquierda',
  izquierda: 'arriba',
  arriba: 'derecha',
};

/** Giro de 90 grados a la izquierda. */
export const GIRO_IZQUIERDA: Readonly<Record<Direccion, Direccion>> = {
  derecha: 'arriba',
  arriba: 'izquierda',
  izquierda: 'abajo',
  abajo: 'derecha',
};

/** Casillas por las que el Fuzz puede pasar. */
const TRANSITABLES: ReadonlySet<string> = new Set([
  'camino',
  'meta',
  'hielo',
  'viento',
  'charco',
]);

/** Casillas que hacen caer al Fuzz si no las salta. */
const PELIGROSAS: ReadonlySet<string> = new Set(['agujero']);

export interface EstadoFuzz {
  readonly x: number;
  readonly y: number;
  readonly dir: Direccion;
  /** Ids de los items ya recogidos, en el orden en que se recogieron. */
  readonly recogidos: readonly string[];
  readonly vivo: boolean;
}

export interface OpcionesSimulador {
  readonly grid: Grid;
  readonly spawn: Spawn;
  readonly items: readonly ItemNivel[];
  readonly modo: ModoMovimiento;
  /** Comandos que este nivel permite; cualquier otro es un error. */
  readonly comandosPermitidos: readonly string[];
  /** Tope de instrucciones para cortar bucles infinitos. */
  readonly topeEjecucion: number;
}

/** Error de juego con mensaje pensado para un nino, nunca una traza tecnica. */
export class ErrorJuego extends Error {
  constructor(
    message: string,
    readonly codigo: NonNullable<ErrorEjecucion['codigo']>,
  ) {
    super(message);
    this.name = 'ErrorJuego';
  }
}

/**
 * Estado mutable de una partida. Cada llamada a un comando encola una accion
 * y devuelve el resultado, igual dentro del worker que en el servidor.
 */
export class GridSimulator {
  private x: number;
  private y: number;
  private dir: Direccion;
  private readonly recogidos: string[] = [];
  /**
   * Puentes ya reparados, como "x,y".
   *
   * El tablero llega de solo lectura y no se toca: reparar un puente no cambia
   * la casilla, anade una excepcion. Asi el mismo tablero sirve para varios
   * intentos y el servidor puede reproducir las acciones desde cero sin
   * arrastrar el estado del intento anterior.
   */
  private readonly reparados = new Set<string>();
  private readonly acciones: Accion[] = [];
  private instrucciones = 0;
  private vivo = true;

  constructor(private readonly opciones: OpcionesSimulador) {
    this.x = opciones.spawn.x;
    this.y = opciones.spawn.y;
    this.dir = opciones.spawn.dir;
  }

  // ─────────────────────────── Consulta de estado ─────────────────────────

  get estado(): EstadoFuzz {
    return { x: this.x, y: this.y, dir: this.dir, recogidos: [...this.recogidos], vivo: this.vivo };
  }

  get accionesEjecutadas(): readonly Accion[] {
    return this.acciones;
  }

  get totalInstrucciones(): number {
    return this.instrucciones;
  }

  /** Casilla en unas coordenadas, o `undefined` si esta fuera del mapa. */
  tileEn(x: number, y: number): Tile | undefined {
    return this.opciones.grid.tiles[y]?.[x];
  }

  /** Indica si el Fuzz puede pisar esa casilla. */
  esTransitable(x: number, y: number): boolean {
    const tile = this.tileEn(x, y);
    if (tile === undefined) return false;
    if (tile.t === 'puente') return this.reparados.has(`${x},${y}`);
    return TRANSITABLES.has(tile.t);
  }

  /** Color de la casilla actual, para los condicionales del Mundo 2. */
  colorActual(): ColorCasilla | undefined {
    return this.tileEn(this.x, this.y)?.color;
  }

  // ──────────────────────────── Control interno ───────────────────────────

  private contar(): void {
    this.instrucciones++;
    if (this.instrucciones > this.opciones.topeEjecucion) {
      throw new ErrorJuego(
        'Tu programa se repite demasiadas veces. Prueba a contar cuantas veces necesitas repetir.',
        'limite',
      );
    }
  }

  private exigirPermitido(cmd: string): void {
    if (!this.opciones.comandosPermitidos.includes(cmd)) {
      throw new ErrorJuego(
        `En esta actividad todavia no puedes usar "${cmd}".`,
        'comando_no_permitido',
      );
    }
  }

  /** Recoge lo que haya en la casilla actual. */
  private recogerAqui(): string | undefined {
    const item = this.opciones.items.find(
      (i) => i.x === this.x && i.y === this.y && !this.recogidos.includes(i.id),
    );
    if (item) this.recogidos.push(item.id);
    return item?.id;
  }

  // ──────────────────────────────── Comandos ──────────────────────────────

  /**
   * Mueve al Fuzz en una direccion absoluta.
   * En modo `rodar` avanza hasta que se acaba el camino; en modo `paso`, una
   * sola casilla.
   */
  mover(dir: Direccion): Accion {
    this.contar();
    this.exigirPermitido(dir);
    if (!this.vivo) {
      throw new ErrorJuego('El Fuzz ya no puede moverse. Vuelve a intentarlo.', 'caida');
    }

    const desde: Celda = { x: this.x, y: this.y };
    const { dx, dy } = DELTA[dir];
    const recorridas: Celda[] = [];
    this.dir = dir;

    const pasosMaximos =
      this.opciones.modo === 'rodar'
        ? this.opciones.grid.cols + this.opciones.grid.rows
        : 1;

    let avanzo = false;
    // Lo que se recoge al pasar. Antes se descartaba y la estrella se quedaba
    // dibujada en el tablero aunque la actividad se diera por superada.
    const itemsRecogidos: ItemRecogido[] = [];

    for (let paso = 0; paso < pasosMaximos; paso++) {
      const nx = this.x + dx;
      const ny = this.y + dy;

      // Un agujero detiene al Fuzz: no cae, se queda al borde.
      const tile = this.tileEn(nx, ny);
      if (tile && PELIGROSAS.has(tile.t)) break;
      if (!this.esTransitable(nx, ny)) break;

      this.x = nx;
      this.y = ny;
      avanzo = true;
      recorridas.push({ x: nx, y: ny });
      const recogido = this.recogerAqui();
      if (recogido) itemsRecogidos.push({ id: recogido, x: nx, y: ny });

      // En modo paso solo se avanza una casilla.
      if (this.opciones.modo === 'paso') break;
    }

    if (!avanzo) {
      throw new ErrorJuego(
        'El Fuzz choco con el borde del camino. Prueba con otra direccion.',
        'choque',
      );
    }

    const accion: Accion = {
      cmd: dir,
      desde,
      hasta: { x: this.x, y: this.y },
      celdasRecorridas: recorridas,
      dir,
      ...(itemsRecogidos.length > 0 ? { itemsRecogidos } : {}),
    };
    this.acciones.push(accion);
    return accion;
  }

  /** Avanza en la direccion en que mira el Fuzz (mundos 11 en adelante). */
  avanzar(): Accion {
    this.contar();
    this.exigirPermitido('avanzar');
    const desde: Celda = { x: this.x, y: this.y };
    const { dx, dy } = DELTA[this.dir];
    const nx = this.x + dx;
    const ny = this.y + dy;

    if (!this.esTransitable(nx, ny)) {
      throw new ErrorJuego('El Fuzz choco con una pared. Revisa el camino.', 'choque');
    }

    this.x = nx;
    this.y = ny;
    const recogidoAlAvanzar = this.recogerAqui();

    const accion: Accion = {
      cmd: 'avanzar',
      desde,
      hasta: { x: nx, y: ny },
      celdasRecorridas: [{ x: nx, y: ny }],
      dir: this.dir,
      ...(recogidoAlAvanzar
        ? { itemsRecogidos: [{ id: recogidoAlAvanzar, x: nx, y: ny }] }
        : {}),
    };
    this.acciones.push(accion);
    return accion;
  }

  girarDerecha(): Accion {
    this.contar();
    this.exigirPermitido('girarDerecha');
    this.dir = GIRO_DERECHA[this.dir];
    const accion: Accion = { cmd: 'girarDerecha', dir: this.dir };
    this.acciones.push(accion);
    return accion;
  }

  girarIzquierda(): Accion {
    this.contar();
    this.exigirPermitido('girarIzquierda');
    this.dir = GIRO_IZQUIERDA[this.dir];
    const accion: Accion = { cmd: 'girarIzquierda', dir: this.dir };
    this.acciones.push(accion);
    return accion;
  }

  /** Salta por encima de la casilla siguiente (agujeros y charcos). */
  saltar(): Accion {
    this.contar();
    this.exigirPermitido('saltar');
    const desde: Celda = { x: this.x, y: this.y };
    const { dx, dy } = DELTA[this.dir];
    const destinoX = this.x + dx * 2;
    const destinoY = this.y + dy * 2;

    if (!this.esTransitable(destinoX, destinoY)) {
      throw new ErrorJuego(
        'El Fuzz no alcanza el otro lado. Busca un sitio mejor para saltar.',
        'choque',
      );
    }

    this.x = destinoX;
    this.y = destinoY;
    const recogidoAlSaltar = this.recogerAqui();

    const accion: Accion = {
      cmd: 'saltar',
      ...(recogidoAlSaltar
        ? { itemsRecogidos: [{ id: recogidoAlSaltar, x: destinoX, y: destinoY }] }
        : {}),
      desde,
      hasta: { x: destinoX, y: destinoY },
      celdasRecorridas: [{ x: destinoX, y: destinoY }],
      dir: this.dir,
    };
    this.acciones.push(accion);
    return accion;
  }

  /**
   * Repara el puente que hay justo delante (mundo 13).
   *
   * Es un solo comando, pero la actividad lo rodea de pasos: acercarse, girar,
   * repararlo y seguir. Ese grupo de pasos se repite en cada puente del tablero
   * y es lo que empuja a hacerse una funcion propia.
   */
  repararPuente(): Accion {
    this.contar();
    this.exigirPermitido('repararPuente');

    const { dx, dy } = DELTA[this.dir];
    const destino = { x: this.x + dx, y: this.y + dy };
    const tile = this.tileEn(destino.x, destino.y);

    if (tile?.t !== 'puente') {
      throw new ErrorJuego(
        'Aqui delante no hay ningun puente roto. Acercate a uno primero.',
        'comando_no_permitido',
      );
    }

    const clave = `${destino.x},${destino.y}`;
    if (this.reparados.has(clave)) {
      throw new ErrorJuego('Ese puente ya esta arreglado. Sigue adelante.', 'comando_no_permitido');
    }
    this.reparados.add(clave);

    const accion: Accion = {
      cmd: 'repararPuente',
      desde: { x: this.x, y: this.y },
      hasta: destino,
      dir: this.dir,
      exito: true,
    };
    this.acciones.push(accion);
    return accion;
  }

  /** Recoge de forma explicita el item de la casilla actual. */
  recoger(): Accion {
    this.contar();
    this.exigirPermitido('recoger');
    const itemId = this.recogerAqui();
    const accion: Accion = {
      cmd: 'recoger',
      desde: { x: this.x, y: this.y },
      hasta: { x: this.x, y: this.y },
      itemId,
      exito: itemId !== undefined,
    };
    this.acciones.push(accion);
    return accion;
  }

  /** Sensor: indica si el Fuzz puede seguir avanzando de frente. */
  puedeAvanzar(): boolean {
    this.contar();
    const { dx, dy } = DELTA[this.dir];
    return this.esTransitable(this.x + dx, this.y + dy);
  }

  /** Sensor: color de la casilla en que esta el Fuzz. */
  colorCasilla(): ColorCasilla | 'ninguno' {
    this.contar();
    return this.colorActual() ?? 'ninguno';
  }

  /** Sensor: indica si hay un obstaculo justo delante. */
  hayObstaculo(): boolean {
    this.contar();
    const { dx, dy } = DELTA[this.dir];
    return !this.esTransitable(this.x + dx, this.y + dy);
  }
}

/**
 * Re-simula una lista de acciones ya ejecutadas y devuelve el estado final.
 *
 * Lo usa el backend para verificar lo que el cliente afirma haber hecho, sin
 * ejecutar ni una linea de codigo del alumno. Si una accion es imposible sobre
 * el tablero real, la reproduccion se detiene y el resultado no cuadra.
 */
export function reproducirAcciones(
  opciones: OpcionesSimulador,
  acciones: readonly Accion[],
): { estado: EstadoFuzz; celdasVisitadas: readonly Celda[]; valida: boolean } {
  const sim = new GridSimulator({ ...opciones, topeEjecucion: Math.max(opciones.topeEjecucion, acciones.length + 1) });
  const visitadas: Celda[] = [{ x: opciones.spawn.x, y: opciones.spawn.y }];

  try {
    for (const accion of acciones) {
      switch (accion.cmd) {
        case 'derecha':
        case 'izquierda':
        case 'arriba':
        case 'abajo':
          sim.mover(accion.cmd);
          break;
        case 'avanzar':
          sim.avanzar();
          break;
        case 'girarDerecha':
          sim.girarDerecha();
          break;
        case 'girarIzquierda':
          sim.girarIzquierda();
          break;
        case 'saltar':
          sim.saltar();
          break;
        case 'recoger':
          sim.recoger();
          break;
        case 'repararPuente':
          sim.repararPuente();
          break;
        default:
          // Una accion desconocida invalida toda la reproduccion.
          return { estado: sim.estado, celdasVisitadas: visitadas, valida: false };
      }
      const ultima = sim.accionesEjecutadas.at(-1);
      for (const celda of ultima?.celdasRecorridas ?? []) visitadas.push(celda);
    }
  } catch {
    // Si la reproduccion choca, lo enviado no corresponde a este tablero.
    return { estado: sim.estado, celdasVisitadas: visitadas, valida: false };
  }

  return { estado: sim.estado, celdasVisitadas: visitadas, valida: true };
}
