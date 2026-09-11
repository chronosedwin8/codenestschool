/**
 * Renderizador isométrico 2.5D con Phaser.
 *
 * Se dibuja con primitivas y no con imágenes. Es una decisión deliberada:
 * permite tener los 30 biomas desde el primer día variando la paleta, no exige
 * un pipeline de arte para empezar a jugar, y pesa una fracción de lo que
 * pesarían treinta atlas de sprites en la tableta de un colegio. Cuando haya
 * arte definitivo, se sustituye el dibujo de cada pieza sin tocar la lógica,
 * porque todo pasa por la interfaz `IRenderer`.
 *
 * La proyección es la clásica 2:1, la de los juegos isométricos de consola: una
 * casilla mide el doble de ancho que de alto, y el orden de dibujado va de
 * arriba abajo para que las piezas de delante tapen a las de detrás.
 */
import Phaser from 'phaser';

import type { Accion, Direccion, Grid, IRenderer, ItemNivel, Spawn, Tile } from '@codenest/shared';

/** Mitad del ancho y del alto de una casilla: de aquí sale la proyección 2:1. */
const MEDIO_ANCHO = 44;
const MEDIO_ALTO = 22;
/** Grosor del canto de la casilla, lo que da la sensación de bloque. */
const ALTURA_TILE = 14;

export interface PaletaBioma {
  readonly suelo: number;
  readonly sueloAlterno: number;
  readonly canto: number;
  readonly borde: number;
  readonly fondo: number;
}

/** Paletas por bioma. La clave es el campo `bioma` del catálogo de mundos. */
const PALETAS: Record<string, PaletaBioma> = {
  'espacio-pastel': { suelo: 0xc9e7ff, sueloAlterno: 0xb5dcfb, canto: 0x7fb2d9, borde: 0xffffff, fondo: 0xe8f4ff },
  'bosque-arcoiris': { suelo: 0xbdf0c4, sueloAlterno: 0xa8e6b0, canto: 0x6cb377, borde: 0xffffff, fondo: 0xe6fbe9 },
  pradera: { suelo: 0xd4f5a8, sueloAlterno: 0xc2ea92, canto: 0x8fbb5e, borde: 0xffffff, fondo: 0xeffbdc },
  'cueva-cristal': { suelo: 0xd8ccff, sueloAlterno: 0xc7b8fa, canto: 0x8f7fd0, borde: 0xffffff, fondo: 0xf0ebff },
  'oasis-dulce': { suelo: 0xffe0b8, sueloAlterno: 0xffd0a0, canto: 0xd9a466, borde: 0xffffff, fondo: 0xfff2e2 },
  'castillo-nubes': { suelo: 0xe8f4ff, sueloAlterno: 0xd6ecff, canto: 0xa8c8e8, borde: 0xffffff, fondo: 0xf5fbff },
  'bahia-pirata': { suelo: 0xffe8b0, sueloAlterno: 0xf5d998, canto: 0xc9a45e, borde: 0xffffff, fondo: 0xdff4fb },
  'montana-neon': { suelo: 0xffc4e8, sueloAlterno: 0xf9b0dd, canto: 0xd070a8, borde: 0xffffff, fondo: 0xffeaf7 },
  'valle-jurasico': { suelo: 0xc8e8a8, sueloAlterno: 0xb6dc94, canto: 0x84ab60, borde: 0xffffff, fondo: 0xeaf7dc },
  'estacion-espacial': { suelo: 0xd0d8ff, sueloAlterno: 0xbcc6f7, canto: 0x8290cc, borde: 0xffffff, fondo: 0xecefff },
};

const PALETA_POR_DEFECTO: PaletaBioma = {
  suelo: 0xdfe7f2,
  sueloAlterno: 0xcfd9e8,
  canto: 0x92a1b8,
  borde: 0xffffff,
  fondo: 0xeff3f9,
};

const COLORES_CASILLA: Record<string, number> = {
  rojo: 0xef4444,
  azul: 0x1fa2ff,
  verde: 0x5ad35a,
  amarillo: 0xffd93d,
  magenta: 0xff3cac,
  naranja: 0xff8a3d,
};

/** Duración de la animación de cada acción, en milisegundos. */
const DURACION_PASO = 260;
/** El modo rodar recorre varias casillas: se anima algo más rápido por casilla. */
const DURACION_RODAR_CASILLA = 130;
/** Lo que tarda un giro. Se ve, asi que necesita durar lo justo para verse. */
const DURACION_GIRO = 240;

/**
 * Angulo en pantalla al que apunta una direccion de la rejilla.
 *
 * Sale de derivar la propia proyeccion: avanzar una casilla en `x` mueve
 * (+MEDIO_ANCHO, +MEDIO_ALTO) en pantalla y una en `y` mueve
 * (-MEDIO_ANCHO, +MEDIO_ALTO). Por eso la flecha apunta de verdad a la casilla
 * de delante y no a un norte imaginario que en isometrico no existe: en esta
 * proyeccion "abajo" en la rejilla se dibuja hacia abajo y a la IZQUIERDA.
 *
 * Se exporta para poder comprobarlo: el angulo no se puede juzgar mirando una
 * captura, y equivocarlo pondria al Fuzz mirando a cualquier parte.
 */
export function anguloDeDireccion(dir: Direccion): number {
  const paso: Record<Direccion, { dx: number; dy: number }> = {
    derecha: { dx: 1, dy: 0 },
    izquierda: { dx: -1, dy: 0 },
    abajo: { dx: 0, dy: 1 },
    arriba: { dx: 0, dy: -1 },
  };
  const { dx, dy } = paso[dir];
  return Math.atan2((dx + dy) * MEDIO_ALTO, (dx - dy) * MEDIO_ANCHO);
}

/**
 * Direccion de un desplazamiento entre dos casillas.
 *
 * Devuelve null si no se movio o si el salto fue en diagonal, que no ocurre con
 * los comandos del juego pero si podria llegar de una accion mal formada.
 */
export function direccionEntre(
  desde: { readonly x: number; readonly y: number },
  hasta: { readonly x: number; readonly y: number },
): Direccion | null {
  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;
  if (dx !== 0 && dy !== 0) return null;
  if (dx > 0) return 'derecha';
  if (dx < 0) return 'izquierda';
  if (dy > 0) return 'abajo';
  if (dy < 0) return 'arriba';
  return null;
}

/**
 * Hace desaparecer las estrellas que la accion recogio en esa casilla.
 *
 * Existe porque recoger no siempre lleva una ficha de recoger: rodando o
 * saltando se recogen al pasar por encima, y esos casos se quedaban sin efecto
 * en pantalla. La actividad se superaba y la estrella seguia ahi dibujada.
 */
function recogerEn(escena: IsoScene, accion: Accion, celda: { x: number; y: number }): void {
  for (const item of accion.itemsRecogidos ?? []) {
    if (item.x === celda.x && item.y === celda.y) escena.recogerItem(item.id);
  }
}

/**
 * Lo que el niño compró en la tienda y lleva puesto.
 *
 * Se dibuja también aquí, y no solo en el avatar del mapa, porque es donde el
 * niño mira: un gorro que solo se ve en la pantalla de inicio no es el gorro que
 * creía estar comprando. Llegan como FORMA ("mago", "capa"), no como clave de
 * artículo: el motor no sabe de precios ni de inventarios.
 */
export interface Atuendo {
  readonly sombrero?: string | null;
  readonly gafas?: string | null;
  readonly accesorio?: string | null;
  readonly disfraz?: string | null;
}

/** Poderes y pociones activos, ya resueltos por el servidor. */
export interface EfectosEscena {
  /** Anima más despacio para que se vea cada paso. */
  readonly camaraLenta?: boolean;
  /** Deja marcas en las casillas por las que paso. */
  readonly huellas?: boolean;
  /** Poción: el Fuzz se ve enorme. */
  readonly gigante?: boolean;
  /** Poción: aura luminosa alrededor. */
  readonly brillo?: boolean;
  /** Poción: rastro de colores al moverse. */
  readonly arcoiris?: boolean;
}

export interface ConfiguracionEscena {
  readonly grid: Grid;
  readonly spawn: Spawn;
  readonly items: readonly ItemNivel[];
  readonly bioma: string;
  readonly colorFuzz: string;
  readonly atuendo?: Atuendo;
  readonly efectos?: EfectosEscena;
}

/** Cuánto se alarga cada animación con la cámara lenta encendida. */
const FACTOR_CAMARA_LENTA = 2.4;

/** Colores del rastro de la poción arcoíris, en orden. */
const ARCOIRIS = [0xff3cac, 0xff8a3d, 0xffd93d, 0x5ad35a, 0x1fa2ff, 0x7b61ff];

/**
 * Escena de Phaser que dibuja la rejilla isométrica y anima al Fuzz.
 * No conoce reglas de juego: solo recibe acciones ya validadas y las representa.
 */
export class IsoScene extends Phaser.Scene {
  private configuracion!: ConfiguracionEscena;
  private paleta: PaletaBioma = PALETA_POR_DEFECTO;

  private capaSuelo!: Phaser.GameObjects.Container;
  private capaItems!: Phaser.GameObjects.Container;
  private fuzz!: Phaser.GameObjects.Container;
  private cuerpoFuzz!: Phaser.GameObjects.Arc;
  private mirada!: Phaser.GameObjects.Graphics;
  private pupilaIzq!: Phaser.GameObjects.Arc;
  private pupilaDer!: Phaser.GameObjects.Arc;
  /** Hacia donde mira ahora mismo. */
  private direccion: Direccion = 'derecha';

  private itemsVivos = new Map<string, Phaser.GameObjects.Container>();
  /** Grafico de cada puente roto, para poder repararlo en pantalla. */
  private graficosPuente = new Map<string, Phaser.GameObjects.Graphics>();
  private origen = { x: 0, y: 0 };

  /** Marcas del poder de huellas y del rastro arcoiris, para poder borrarlas. */
  private marcas: Phaser.GameObjects.GameObject[] = [];
  private pasoArcoiris = 0;

  constructor() {
    // `active: false` no es un detalle: Phaser arranca por su cuenta la escena
    // que se le declara en la configuración, y lo hace durante el arranque del
    // juego, o sea antes de que `cargarNivel` pueda entregarle el nivel. La
    // escena se creaba entonces sin datos y `create` moría al leer la rejilla,
    // dentro del propio arranque de Phaser: el juego no llegaba a `postBoot`,
    // la promesa de `cargarNivel` no se resolvía nunca y la actividad se
    // quedaba con el tablero en blanco y el botón de jugar apagado.
    super({ key: 'iso', active: false });
  }

  /** Recibe la configuración antes de arrancar la escena. */
  init(datos: ConfiguracionEscena): void {
    this.configuracion = datos;
    this.paleta = PALETAS[datos.bioma] ?? PALETA_POR_DEFECTO;
  }

  create(): void {
    // Red de seguridad para lo anterior: si algo vuelve a arrancar la escena
    // sin nivel, el tablero se queda vacío pero el juego sigue en pie.
    if (!this.configuracion?.grid) return;

    this.cameras.main.setBackgroundColor(this.paleta.fondo);
    this.capaSuelo = this.add.container(0, 0);
    this.capaItems = this.add.container(0, 0);
    this.dibujarRejilla();
    this.crearItems();
    this.crearFuzz();
  }

  /** Convierte coordenadas de rejilla a pantalla (proyección 2:1). */
  private aPantalla(x: number, y: number): { px: number; py: number } {
    return {
      px: this.origen.x + (x - y) * MEDIO_ANCHO,
      py: this.origen.y + (x + y) * MEDIO_ALTO,
    };
  }

  /**
   * Centra el rombo del mapa en el lienzo.
   *
   * En proyeccion isometrica el mapa es un rombo cuyo alto total es
   * (cols + rows) * MEDIO_ALTO. El termino (rows - cols) compensa que la casilla
   * (0,0) cae en el vertice superior del rombo y no en una esquina.
   */
  private calcularOrigen(): void {
    const { cols, rows } = this.configuracion.grid;
    const altoMapa = (cols + rows) * MEDIO_ALTO;

    this.origen = {
      x: this.scale.width / 2 + ((rows - cols) * MEDIO_ANCHO) / 2,
      y: this.scale.height / 2 - altoMapa / 2 + MEDIO_ALTO * 2,
    };
  }

  private dibujarRejilla(): void {
    this.calcularOrigen();
    const { tiles, rows, cols } = this.configuracion.grid;

    // De arriba abajo y de izquierda a derecha: así las piezas de delante
    // tapan correctamente a las de detrás.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || tile.t === 'vacio') continue;
        this.dibujarTile(x, y, tile);
      }
    }
  }

  private dibujarTile(x: number, y: number, tile: Tile): void {
    const { px, py } = this.aPantalla(x, y);

    // Un ajedrezado suave ayuda a contar casillas, que es justo lo que un niño
    // necesita para planear su recorrido.
    const esAlterno = (x + y) % 2 === 1;
    let colorSuelo = esAlterno ? this.paleta.sueloAlterno : this.paleta.suelo;

    // Las casillas de color son la mecánica del mundo 2: manda el color.
    if (tile.color) colorSuelo = COLORES_CASILLA[tile.color] ?? colorSuelo;
    if (tile.t === 'meta') colorSuelo = 0xffd93d;
    if (tile.t === 'hielo') colorSuelo = 0xd6f4ff;
    if (tile.t === 'charco') colorSuelo = 0x7cc4e8;

    const grafico = this.add.graphics();

    // Canto del bloque: es lo que convierte un rombo plano en un volumen.
    grafico.fillStyle(this.paleta.canto, 1);
    grafico.beginPath();
    grafico.moveTo(px - MEDIO_ANCHO, py);
    grafico.lineTo(px - MEDIO_ANCHO, py + ALTURA_TILE);
    grafico.lineTo(px, py + MEDIO_ALTO + ALTURA_TILE);
    grafico.lineTo(px + MEDIO_ANCHO, py + ALTURA_TILE);
    grafico.lineTo(px + MEDIO_ANCHO, py);
    grafico.lineTo(px, py + MEDIO_ALTO);
    grafico.closePath();
    grafico.fillPath();

    // Cara superior.
    grafico.fillStyle(colorSuelo, 1);
    grafico.lineStyle(2, this.paleta.borde, 0.75);
    grafico.beginPath();
    grafico.moveTo(px, py - MEDIO_ALTO);
    grafico.lineTo(px + MEDIO_ANCHO, py);
    grafico.lineTo(px, py + MEDIO_ALTO);
    grafico.lineTo(px - MEDIO_ANCHO, py);
    grafico.closePath();
    grafico.fillPath();
    grafico.strokePath();

    // Un puente roto: tablones sueltos sobre el hueco. Tiene que leerse como
    // "aqui falta algo y se puede arreglar", distinto del agujero, que es "no
    // pases". De ahi los tablones en vez de la mancha oscura.
    if (tile.t === 'puente') {
      grafico.fillStyle(0x1e293b, 0.6);
      grafico.beginPath();
      grafico.moveTo(px, py - MEDIO_ALTO + 4);
      grafico.lineTo(px + MEDIO_ANCHO - 6, py);
      grafico.lineTo(px, py + MEDIO_ALTO - 4);
      grafico.lineTo(px - MEDIO_ANCHO + 6, py);
      grafico.closePath();
      grafico.fillPath();

      grafico.fillStyle(0xb07a43, 1);
      grafico.lineStyle(2, 0x6d4823, 1);
      for (const desplazamiento of [-10, 6]) {
        grafico.beginPath();
        grafico.moveTo(px - MEDIO_ANCHO + 8, py + desplazamiento);
        grafico.lineTo(px, py + desplazamiento - MEDIO_ALTO + 6);
        grafico.lineTo(px + MEDIO_ANCHO - 8, py + desplazamiento);
        grafico.lineTo(px, py + desplazamiento + MEDIO_ALTO - 6);
        grafico.closePath();
        grafico.fillPath();
        grafico.strokePath();
      }

      this.graficosPuente.set(`${x},${y}`, grafico);
    }

    // Un agujero se dibuja como un hueco oscuro, sin cara superior.
    if (tile.t === 'agujero') {
      grafico.fillStyle(0x1e293b, 0.75);
      grafico.beginPath();
      grafico.moveTo(px, py - MEDIO_ALTO + 4);
      grafico.lineTo(px + MEDIO_ANCHO - 6, py);
      grafico.lineTo(px, py + MEDIO_ALTO - 4);
      grafico.lineTo(px - MEDIO_ANCHO + 6, py);
      grafico.closePath();
      grafico.fillPath();
    }

    grafico.setDepth(this.profundidad(x, y));
    this.capaSuelo.add(grafico);
  }

  /**
   * Repara un puente en pantalla: los tablones se juntan y queda camino firme.
   *
   * Se redibuja la cara superior encima del grafico roto en lugar de rehacer la
   * casilla, porque el orden de dibujado del suelo ya esta resuelto y volver a
   * insertarla lo desordenaria.
   */
  async repararPuenteEn(x: number, y: number): Promise<void> {
    const roto = this.graficosPuente.get(`${x},${y}`);
    if (!roto) return;

    const { px, py } = this.aPantalla(x, y);
    const arreglado = this.add.graphics();
    arreglado.fillStyle(0xb07a43, 1);
    arreglado.lineStyle(2, 0x6d4823, 1);
    arreglado.beginPath();
    arreglado.moveTo(px, py - MEDIO_ALTO);
    arreglado.lineTo(px + MEDIO_ANCHO, py);
    arreglado.lineTo(px, py + MEDIO_ALTO);
    arreglado.lineTo(px - MEDIO_ANCHO, py);
    arreglado.closePath();
    arreglado.fillPath();
    arreglado.strokePath();
    arreglado.setDepth(this.profundidad(x, y) + 1);
    arreglado.setAlpha(0);
    this.capaSuelo.add(arreglado);

    await new Promise<void>((resolver) => {
      this.tweens.add({
        targets: arreglado,
        alpha: 1,
        duration: 260,
        onComplete: () => {
          roto.destroy();
          this.graficosPuente.delete(`${x},${y}`);
          resolver();
        },
      });
    });
  }

  /** Profundidad de dibujado: cuanto más al frente, mayor valor. */
  private profundidad(x: number, y: number): number {
    return (x + y) * 10;
  }

  private crearItems(): void {
    for (const item of this.configuracion.items) {
      const { px, py } = this.aPantalla(item.x, item.y);
      const contenedor = this.add.container(px, py - 18);
      contenedor.setDepth(this.profundidad(item.x, item.y) + 5);

      if (item.tipo === 'estrella') {
        const estrella = this.add.star(0, 0, 5, 9, 19, 0xffd93d);
        estrella.setStrokeStyle(3, 0xe0b81c);
        contenedor.add(estrella);
        // El brillo intermitente atrae la mirada al objetivo.
        this.tweens.add({
          targets: estrella,
          scale: { from: 0.9, to: 1.12 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        const moneda = this.add.circle(0, 0, 13, 0xffd93d);
        moneda.setStrokeStyle(3, 0xe0b81c);
        contenedor.add(moneda);
      }

      // Sombra flotante: ancla el objeto sobre la casilla.
      const sombra = this.add.ellipse(0, 22, 22, 9, 0x000000, 0.2);
      contenedor.addAt(sombra, 0);

      this.tweens.add({
        targets: contenedor,
        y: py - 26,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.itemsVivos.set(item.id, contenedor);
      this.capaItems.add(contenedor);
    }
  }

  private crearFuzz(): void {
    const { spawn, colorFuzz } = this.configuracion;
    const { px, py } = this.aPantalla(spawn.x, spawn.y);
    const color = Phaser.Display.Color.HexStringToColor(colorFuzz).color;

    this.fuzz = this.add.container(px, py - 20);
    this.fuzz.setDepth(this.profundidad(spawn.x, spawn.y) + 8);

    const sombra = this.add.ellipse(0, 24, 34, 13, 0x000000, 0.24);
    this.cuerpoFuzz = this.add.circle(0, 0, 20, color);

    // Pelaje: pequeñas puntas alrededor del cuerpo.
    const pelaje = this.add.graphics();
    pelaje.lineStyle(3, Phaser.Display.Color.ValueToColor(color).darken(25).color, 1);
    for (let i = 0; i < 16; i++) {
      const angulo = (i / 16) * Math.PI * 2;
      pelaje.beginPath();
      pelaje.moveTo(Math.cos(angulo) * 19, Math.sin(angulo) * 19);
      pelaje.lineTo(Math.cos(angulo) * 25, Math.sin(angulo) * 25);
      pelaje.strokePath();
    }

    const ojoIzq = this.add.circle(-7, -4, 6.5, 0xffffff);
    const ojoDer = this.add.circle(7, -4, 6.5, 0xffffff);
    this.pupilaIzq = this.add.circle(-7, -4, 3.2, 0x1e293b);
    this.pupilaDer = this.add.circle(7, -4, 3.2, 0x1e293b);

    // Hacia donde mira. A partir del mundo 11 el niño programa giros, y hasta
    // ahora el giro no se veia: ocurria en el simulador y en pantalla no pasaba
    // nada, asi que girar parecia una orden rota. Esta flecha y la mirada de las
    // pupilas son lo unico que cuenta si hace falta girar una vez o tres.
    // Va detras del cuerpo y sobresale bien: el pelaje llega al radio 25, asi
    // que una punta que acabase en 30 apenas asomaria y no serviria de nada.
    this.mirada = this.add.graphics();
    this.mirada.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(45).color, 1);
    this.mirada.beginPath();
    this.mirada.moveTo(44, 0);
    this.mirada.lineTo(20, -12);
    this.mirada.lineTo(20, 12);
    this.mirada.closePath();
    this.mirada.fillPath();

    this.fuzz.add([
      sombra,
      pelaje,
      this.mirada,
      this.cuerpoFuzz,
      ojoIzq,
      ojoDer,
      this.pupilaIzq,
      this.pupilaDer,
    ]);

    // El Fuzz empieza mirando a donde diga la actividad, no siempre igual.
    this.colocarMirada(this.configuracion.spawn.dir ?? 'derecha');

    // Lo comprado en la tienda, y lo que esté haciendo una poción.
    this.vestirFuzz();
    this.aplicarEfectosAlFuzz();

    // Respiración: el personaje nunca está del todo quieto.
    this.tweens.add({
      targets: this.cuerpoFuzz,
      scaleY: 0.94,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Dibuja lo que el nino lleva puesto sobre el Fuzz del tablero.
   *
   * Son primitivas y no sprites, igual que el resto del motor: asi un color
   * nuevo del catalogo no obliga a generar imagenes. Las formas son las mismas
   * que dibuja `FuzzAvatar.vue` para que el gorro del mapa y el del tablero sean
   * reconociblemente el mismo gorro.
   *
   * Se dibuja con `Graphics` y no con las formas de Phaser (`add.triangle`,
   * `add.rectangle`) por una razon concreta: esas formas se colocan por el centro
   * de su caja, no por las coordenadas que se les pasan, asi que el gorro salia
   * flotando arriba a la izquierda de la cabeza. Graphics dibuja exactamente
   * donde se le dice, que es lo que ya hacia la flecha de la mirada.
   */
  private vestirFuzz(): void {
    const atuendo = this.configuracion.atuendo;
    if (!atuendo) return;

    // Dos lienzos: uno detras del cuerpo (capa, alas, mochila, cresta) y otro
    // delante (gorros, gafas, bufanda). Si todo fuera delante, una capa taparia
    // al personaje entero.
    const detras = this.add.graphics();
    const delante = this.add.graphics();

    const triangulo = (
      g: Phaser.GameObjects.Graphics,
      color: number,
      puntos: readonly [number, number][],
      alfa = 1,
    ): void => {
      g.fillStyle(color, alfa);
      g.beginPath();
      g.moveTo(puntos[0]![0], puntos[0]![1]);
      for (const [x, y] of puntos.slice(1)) g.lineTo(x, y);
      g.closePath();
      g.fillPath();
    };

    switch (atuendo.accesorio) {
      case 'capa':
        // Acampanada y no en punta: el cuerpo mide 20 de radio y el pelaje llega
        // a 25, asi que una capa que acabe en el centro queda escondida entera
        // detras del Fuzz. Solo se ve si sobresale por los lados.
        triangulo(detras, 0xef4444, [[-14, -14], [14, -14], [34, 16], [-34, 16]]);
        triangulo(detras, 0xb91c1c, [[-14, -14], [14, -14], [11, -6], [-11, -6]]);
        break;
      case 'alas':
        triangulo(detras, 0xffffff, [[-14, -10], [-14, 8], [-32, -2]]);
        triangulo(detras, 0xffffff, [[14, -10], [14, 8], [32, -2]]);
        break;
      case 'mochila':
        detras.fillStyle(0x7b61ff, 1);
        detras.fillRoundedRect(8, -10, 20, 22, 6);
        break;
      case 'bufanda':
        delante.fillStyle(0xff8a3d, 1);
        delante.fillRoundedRect(-17, 8, 34, 8, 4);
        delante.fillStyle(0xea580c, 1);
        delante.fillRoundedRect(9, 14, 9, 14, 4);
        break;
      default:
        break;
    }

    switch (atuendo.disfraz) {
      case 'robot':
        delante.fillStyle(0x94a3b8, 1);
        delante.fillRoundedRect(-16, 6, 32, 13, 4);
        delante.fillStyle(0x64748b, 1);
        delante.fillRoundedRect(-7, 10, 14, 6, 2);
        delante.fillStyle(0x94a3b8, 1);
        delante.fillRect(-1.5, -34, 3, 12);
        delante.fillStyle(0xef4444, 1);
        delante.fillCircle(0, -36, 3.5);
        break;
      case 'dino':
        triangulo(detras, 0x22c55e, [[10, -14], [10, 2], [26, -8]]);
        triangulo(detras, 0x22c55e, [[12, 2], [12, 16], [26, 8]]);
        delante.fillStyle(0xbbf7d0, 1);
        delante.fillEllipse(0, 11, 28, 14);
        break;
      case 'buzo':
        delante.fillStyle(0xf59e0b, 1);
        delante.fillRoundedRect(-16, 14, 32, 7, 3);
        break;
      default:
        break;
    }

    switch (atuendo.gafas) {
      case 'sol':
        delante.fillStyle(0x1e293b, 1);
        delante.fillRoundedRect(-16, -9, 32, 9, 4);
        delante.fillStyle(0x06b6d4, 0.6);
        delante.fillRoundedRect(-14, -7.5, 12, 6, 3);
        delante.fillRoundedRect(2, -7.5, 12, 6, 3);
        break;
      case 'redondas':
        delante.lineStyle(2, 0x1e293b, 1);
        delante.strokeCircle(-7, -4, 8);
        delante.strokeCircle(7, -4, 8);
        delante.lineBetween(1, -4, -1, -4);
        break;
      case 'buceo':
        delante.fillStyle(0x06b6d4, 0.4);
        delante.fillRoundedRect(-17, -12, 34, 15, 7);
        delante.lineStyle(2.5, 0x0e7490, 1);
        delante.strokeRoundedRect(-17, -12, 34, 15, 7);
        break;
      case 'ciber':
        delante.fillStyle(0x1e293b, 1);
        delante.fillRoundedRect(-17, -8, 34, 7, 3);
        delante.fillStyle(0x22d3ee, 1);
        delante.fillRect(-14, -6, 28, 2);
        break;
      default:
        break;
    }

    switch (atuendo.sombrero) {
      case 'gorro':
        triangulo(delante, 0xff3cac, [[-15, -14], [15, -14], [0, -34]]);
        delante.fillStyle(0xd81b8c, 1);
        delante.fillRoundedRect(-17, -17, 34, 6, 3);
        delante.fillStyle(0xffffff, 1);
        delante.fillCircle(0, -36, 3.5);
        break;
      case 'fiesta':
        triangulo(delante, 0xffd93d, [[-10, -14], [10, -14], [0, -40]]);
        delante.lineStyle(2.5, 0xff3cac, 1);
        delante.lineBetween(-6, -24, 6, -24);
        delante.lineStyle(2.5, 0x06b6d4, 1);
        delante.lineBetween(-8, -18, 8, -18);
        delante.fillStyle(0xff3cac, 1);
        delante.fillCircle(0, -42, 3);
        break;
      case 'pirata':
        triangulo(delante, 0x1e293b, [[-17, -16], [17, -16], [0, -32]]);
        delante.fillStyle(0x1e293b, 1);
        delante.fillEllipse(0, -16, 44, 11);
        delante.fillStyle(0xf8fafc, 1);
        delante.fillCircle(0, -22, 4);
        break;
      case 'mago':
        triangulo(delante, 0x7b61ff, [[-13, -18], [13, -18], [0, -46]]);
        delante.fillStyle(0x5a3fe0, 1);
        delante.fillEllipse(0, -18, 44, 10);
        delante.fillStyle(0xffd93d, 1);
        delante.fillCircle(0, -33, 2.6);
        break;
      case 'corona':
        delante.fillStyle(0xffd93d, 1);
        delante.beginPath();
        delante.moveTo(-15, -16);
        for (const [x, y] of [[-13, -29], [-6, -21], [0, -34], [6, -21], [13, -29], [15, -16]] as const) {
          delante.lineTo(x, y);
        }
        delante.closePath();
        delante.fillPath();
        delante.fillStyle(0xe0b81c, 1);
        delante.fillRoundedRect(-15, -17, 30, 5, 2);
        break;
      default:
        break;
    }

    // La burbuja va al final y translucida: si tapara la cara, se perderia lo
    // unico que hace simpatico al personaje.
    if (atuendo.sombrero === 'casco' || atuendo.disfraz === 'buzo') {
      delante.fillStyle(0xbae6fd, 0.22);
      delante.fillCircle(0, -2, 29);
      delante.lineStyle(2, 0x38bdf8, 0.8);
      delante.strokeCircle(0, -2, 29);
    }

    this.fuzz.addAt(detras, 0);
    this.fuzz.add(delante);
  }

  /** Poderes y pociones que cambian como se ve el Fuzz. */
  private aplicarEfectosAlFuzz(): void {
    const efectos = this.configuracion.efectos;
    if (!efectos) return;

    if (efectos.gigante === true) this.fuzz.setScale(1.5);

    if (efectos.brillo === true) {
      const aura = this.add.circle(0, 0, 34, 0xffd93d, 0.3);
      this.fuzz.addAt(aura, 0);
      this.tweens.add({
        targets: aura,
        scale: 1.2,
        alpha: 0.12,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /**
   * Deja constancia de que el Fuzz paso por una casilla.
   *
   * El poder de huellas es la unica forma de ver el recorrido cuando el programa
   * ya termino, que es justo el momento en el que el nino se pregunta por donde
   * se fue. El rastro de la pocion arcoiris es lo mismo pero para divertirse.
   */
  private marcarPaso(x: number, y: number): void {
    const efectos = this.configuracion.efectos;
    if (!efectos?.huellas && !efectos?.arcoiris) return;

    const { px, py } = this.aPantalla(x, y);

    if (efectos.huellas === true) {
      const huella = this.add.ellipse(px, py, 24, 12, 0x1e293b, 0.26);
      huella.setDepth(this.profundidad(x, y) + 1);
      this.marcas.push(huella);
    }

    if (efectos.arcoiris === true) {
      const color = ARCOIRIS[this.pasoArcoiris % ARCOIRIS.length] ?? ARCOIRIS[0]!;
      this.pasoArcoiris += 1;
      const mancha = this.add.ellipse(px, py, 42, 21, color, 0.5);
      mancha.setDepth(this.profundidad(x, y) + 1);
      this.marcas.push(mancha);
      this.tweens.add({ targets: mancha, alpha: 0, duration: 2600, ease: 'Cubic.easeIn' });
    }
  }

  /** Pone la mirada en una direccion sin animarla (al crear o al reiniciar). */
  private colocarMirada(dir: Direccion): void {
    this.direccion = dir;
    const angulo = anguloDeDireccion(dir);
    this.mirada.setRotation(angulo);
    this.pupilaIzq.setPosition(-7 + Math.cos(angulo) * 2.6, -4 + Math.sin(angulo) * 2.6);
    this.pupilaDer.setPosition(7 + Math.cos(angulo) * 2.6, -4 + Math.sin(angulo) * 2.6);
  }

  /**
   * Gira al Fuzz hasta mirar en la direccion dada.
   *
   * Se gira siempre por el lado corto: dar la vuelta larga para acabar en el
   * mismo sitio se lee como dos giros y confunde la cuenta, que es justo lo que
   * el niño esta intentando aprender.
   */
  async orientar(dir: Direccion, duracion = DURACION_GIRO): Promise<void> {
    if (this.direccion === dir) {
      await new Promise((r) => setTimeout(r, 90));
      return;
    }
    this.direccion = dir;

    const objetivo = this.mirada.rotation + Phaser.Math.Angle.Wrap(anguloDeDireccion(dir) - this.mirada.rotation);
    const destinoIzq = { x: -7 + Math.cos(objetivo) * 2.6, y: -4 + Math.sin(objetivo) * 2.6 };
    const destinoDer = { x: 7 + Math.cos(objetivo) * 2.6, y: -4 + Math.sin(objetivo) * 2.6 };

    this.tweens.add({ targets: this.pupilaIzq, ...destinoIzq, duration: duracion, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.pupilaDer, ...destinoDer, duration: duracion, ease: 'Sine.easeInOut' });

    return new Promise((resolver) => {
      this.tweens.add({
        targets: this.mirada,
        rotation: objetivo,
        duration: duracion,
        ease: 'Back.easeOut',
        onComplete: () => resolver(),
      });
    });
  }

  /** Mueve el Fuzz a una casilla, animando el recorrido. */
  async moverA(x: number, y: number, duracion: number): Promise<void> {
    const { px, py } = this.aPantalla(x, y);
    this.fuzz.setDepth(this.profundidad(x, y) + 8);
    this.marcarPaso(x, y);

    return new Promise((resolver) => {
      this.tweens.add({
        targets: this.fuzz,
        x: px,
        y: py - 20,
        duration: duracion,
        ease: 'Sine.easeInOut',
        onComplete: () => resolver(),
      });
    });
  }

  /** Salto con arco: se eleva y vuelve a bajar. */
  async saltarA(x: number, y: number): Promise<void> {
    const { px, py } = this.aPantalla(x, y);
    this.fuzz.setDepth(this.profundidad(x, y) + 8);

    return new Promise((resolver) => {
      this.tweens.chain({
        targets: this.fuzz,
        tweens: [
          { x: (px + this.fuzz.x) / 2, y: py - 70, duration: 180, ease: 'Sine.easeOut' },
          { x: px, y: py - 20, duration: 180, ease: 'Sine.easeIn' },
        ],
        onComplete: () => resolver(),
      });
    });
  }

  /** Recoge un objeto: sube, gira y desaparece con partículas. */
  recogerItem(itemId: string): void {
    const item = this.itemsVivos.get(itemId);
    if (!item) return;
    this.itemsVivos.delete(itemId);

    this.tweens.add({
      targets: item,
      y: item.y - 46,
      scale: 0,
      angle: 220,
      duration: 380,
      ease: 'Back.easeIn',
      onComplete: () => item.destroy(),
    });

    this.chispas(item.x, item.y, 0xffd93d, 10);
  }

  /** Animación de choque: rebote hacia atrás y temblor cómico. */
  async animarChoque(): Promise<void> {
    return new Promise((resolver) => {
      const xOriginal = this.fuzz.x;
      this.tweens.chain({
        targets: this.fuzz,
        tweens: [
          { x: xOriginal + 12, duration: 70 },
          { x: xOriginal - 8, duration: 70 },
          { x: xOriginal + 5, duration: 70 },
          { x: xOriginal, duration: 70 },
        ],
        onComplete: () => resolver(),
      });
      // Se achata al golpear: es el recurso clásico de dibujos animados.
      this.tweens.add({
        targets: this.cuerpoFuzz,
        scaleX: 1.25,
        scaleY: 0.75,
        duration: 110,
        yoyo: true,
      });
      this.chispas(this.fuzz.x, this.fuzz.y, 0xff8a3d, 6);
    });
  }

  /** Celebración: saltitos y una lluvia de estrellas. */
  async celebrar(estrellas: number): Promise<void> {
    for (let i = 0; i < Math.max(1, estrellas); i++) {
      this.chispas(
        this.fuzz.x + (Math.random() - 0.5) * 90,
        this.fuzz.y - 30 - Math.random() * 40,
        0xffd93d,
        12,
      );
    }

    return new Promise((resolver) => {
      this.tweens.add({
        targets: this.fuzz,
        y: this.fuzz.y - 26,
        duration: 240,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeOut',
        onComplete: () => resolver(),
      });
    });
  }

  /** Partículas sencillas: círculos que salen despedidos y se apagan. */
  private chispas(x: number, y: number, color: number, cantidad: number): void {
    for (let i = 0; i < cantidad; i++) {
      const chispa = this.add.circle(x, y, 3 + Math.random() * 3, color);
      chispa.setDepth(9999);
      const angulo = Math.random() * Math.PI * 2;
      const distancia = 30 + Math.random() * 45;

      this.tweens.add({
        targets: chispa,
        x: x + Math.cos(angulo) * distancia,
        y: y + Math.sin(angulo) * distancia,
        alpha: 0,
        scale: 0,
        duration: 550 + Math.random() * 250,
        ease: 'Cubic.easeOut',
        onComplete: () => chispa.destroy(),
      });
    }
  }

  /**
   * Cuanto hay que alargar cada animacion.
   *
   * La camara lenta no cambia ni una regla del juego: solo estira el tiempo de
   * las animaciones para que se pueda seguir con el ojo lo que el programa hizo.
   */
  get factorDeTiempo(): number {
    return this.configuracion.efectos?.camaraLenta === true ? FACTOR_CAMARA_LENTA : 1;
  }

  /** Devuelve al Fuzz a su casilla de salida y repone los objetos. */
  reiniciarEscena(): void {
    this.tweens.killAll();
    for (const item of this.itemsVivos.values()) item.destroy();
    this.itemsVivos.clear();

    // Las huellas y el rastro son del intento anterior: dejarlas haria creer al
    // nino que su programa nuevo paso por donde paso el viejo.
    for (const marca of this.marcas) marca.destroy();
    this.marcas = [];
    this.pasoArcoiris = 0;

    const { spawn } = this.configuracion;
    const { px, py } = this.aPantalla(spawn.x, spawn.y);
    this.fuzz.setPosition(px, py - 20);
    this.fuzz.setDepth(this.profundidad(spawn.x, spawn.y) + 8);
    this.cuerpoFuzz.setScale(1);
    // Tambien la mirada vuelve a su sitio: reintentar con el Fuzz girado de la
    // vez anterior haria que el mismo programa diera dos resultados distintos.
    this.colocarMirada(spawn.dir ?? 'derecha');

    this.crearItems();
    this.tweens.add({
      targets: this.cuerpoFuzz,
      scaleY: 0.94,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/**
 * Adaptador entre el juego y Phaser. Implementa `IRenderer`, así que la lógica
 * del juego no sabe que por debajo hay Phaser y podría cambiarse de motor.
 */
export class IsoRenderer implements IRenderer {
  private juego: Phaser.Game | null = null;
  private escena: IsoScene | null = null;

  constructor(
    private readonly contenedor: HTMLElement,
    private readonly ancho = 800,
    private readonly alto = 460,
  ) {}

  async cargarNivel(configuracion: unknown): Promise<void> {
    const datos = configuracion as ConfiguracionEscena;

    // Reiniciar es más barato que recrear el juego entero.
    if (this.juego && this.escena) {
      this.juego.scene.stop('iso');
      this.juego.scene.start('iso', datos);
      this.escena = this.juego.scene.getScene('iso') as IsoScene;
      return;
    }

    return new Promise((resolver) => {
      this.juego = new Phaser.Game({
        type: Phaser.AUTO,
        parent: this.contenedor,
        width: this.ancho,
        height: this.alto,
        transparent: true,
        // El audio lo gestiona Howler: Phaser no debe abrir su propio contexto.
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: IsoScene,
        callbacks: {
          postBoot: (juego) => {
            const escena = juego.scene.getScene('iso') as IsoScene;
            this.escena = escena;
            // Se espera a que la escena haya dibujado de verdad. Resolver antes
            // devolvería un renderizador que todavía no puede animar nada.
            escena.events.once(Phaser.Scenes.Events.CREATE, () => resolver());
            juego.scene.start('iso', datos);
          },
        },
      });
    });
  }

  /** Anima una acción. Las acciones llegan ya validadas por el simulador. */
  async reproducirAccion(accion: Accion): Promise<void> {
    const escena = this.escena;
    if (!escena) return;

    const destino = accion.hasta;
    // Con la camara lenta comprada y encendida, todo dura mas. El factor lo
    // decide la escena porque es ella la que sabe que poderes trae el nivel.
    const lento = escena.factorDeTiempo;

    switch (accion.cmd) {
      case 'saltar':
        if (destino) {
          await escena.saltarA(destino.x, destino.y);
          recogerEn(escena, accion, destino);
        }
        break;

      case 'recoger':
        if (accion.itemId) escena.recogerItem(accion.itemId);
        break;

      case 'repararPuente':
        // El destino de la accion es la casilla del puente, no la del Fuzz.
        if (destino) await escena.repararPuenteEn(destino.x, destino.y);
        break;

      case 'girarDerecha':
      case 'girarIzquierda':
        // El giro no cambia de casilla, asi que si no se ve girar no se ve
        // nada: para el nino la orden habria fallado. La accion trae ya la
        // direccion resultante, calculada por el simulador.
        if (accion.dir) await escena.orientar(accion.dir, DURACION_GIRO * lento);
        break;

      default: {
        if (!destino) break;
        // Se mira primero hacia donde se va. En los mundos de fichas no hay
        // orden de girar, pero el Fuzz igualmente rueda en una direccion, y
        // verlo mirar hacia alli antes de arrancar es lo que hace que el
        // movimiento parezca suyo y no un empujon.
        const desde = accion.desde;
        const direccion =
          accion.dir ?? (desde ? direccionEntre(desde, destino) : null);
        if (direccion) await escena.orientar(direccion, (DURACION_GIRO / 2) * lento);

        // En modo rodar se atraviesan varias casillas de una vez: se anima cada
        // una para que el niño vea el recorrido, no un salto instantáneo.
        const recorrido = accion.celdasRecorridas ?? [destino];
        for (const celda of recorrido) {
          await escena.moverA(
            celda.x,
            celda.y,
            (recorrido.length > 1 ? DURACION_RODAR_CASILLA : DURACION_PASO) * lento,
          );
          // La estrella desaparece en la casilla donde estaba, no al final del
          // recorrido: rodando se atraviesan varias de una vez, y ver cada una
          // apagarse al pasar por encima es lo que explica lo que acaba de
          // ocurrir. Antes no desaparecia ninguna.
          recogerEn(escena, accion, celda);
        }
        break;
      }
    }
  }

  reiniciar(): void {
    this.escena?.reiniciarEscena();
  }

  resaltarObjetivo(_id: string): void {
    // Las estrellas ya laten por sí solas; se reserva para las pistas visuales.
  }

  async celebrar(estrellas: number): Promise<void> {
    await this.escena?.celebrar(estrellas);
  }

  async animarChoque(): Promise<void> {
    await this.escena?.animarChoque();
  }

  destruir(): void {
    this.juego?.destroy(true);
    this.juego = null;
    this.escena = null;
  }
}
