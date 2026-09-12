/**
 * El motor que juega lo que el estudiante construyó.
 *
 * Recibe una `DefinicionJuego` —la misma que valida el servidor— y la convierte
 * en un juego arcade de verdad. No conoce la interfaz del constructor ni la API:
 * se le da una definición y un contenedor, y avisa por callbacks de lo que pasa.
 *
 * Tres decisiones que explican cómo está escrito:
 *
 *  1. **Las colisiones se calculan a mano**, con distancias entre círculos, en
 *     vez de usar la física de Phaser. En pantalla hay veinte objetos como mucho
 *     y así el comportamiento es exactamente el mismo en cualquier máquina: la
 *     física de un motor depende de los pasos por segundo, y un juego que se
 *     gana en un portátil y es imposible en una tableta de colegio no vale.
 *  2. **Todo se dibuja con primitivas**, como el Fuzz y el resto del juego. Un
 *     personaje elegido en un menú tiene que poder pintarse de doce colores sin
 *     generar doce imágenes.
 *  3. **Las reglas del niño son el único camino para ganar o perder.** El motor
 *     no da por hecho que tocar un obstáculo quita una vida: eso lo dice una
 *     regla que el estudiante puede cambiar. Si borra la regla, tocar un
 *     obstáculo no hace nada, y eso es exactamente lo que él programó.
 */
import Phaser from 'phaser';

import {
  MS_ENTRE_APARICIONES,
  PIXELES_POR_SEGUNDO,
  RADIO_POR_TAMANO,
  type DefinicionJuego,
  type ObstaculoJuego,
  type PremioJuego,
  type ReglaJuego,
  type Sonido,
} from '@codenest/shared';

export const ANCHO_JUEGO = 960;
export const ALTO_JUEGO = 540;

/** Lo que el motor cuenta hacia fuera. */
export interface EscuchasJuego {
  readonly alCambiarMarcador?: (marcador: Marcador) => void;
  readonly alGanar?: () => void;
  readonly alPerder?: () => void;
  readonly alSonar?: (sonido: Sonido) => void;
}

export interface Marcador {
  readonly puntos: number;
  readonly vidas: number;
  /** Segundos que quedan, solo si la meta es por tiempo. */
  readonly segundos: number | null;
  readonly meta: number;
  readonly terminado: 'ganado' | 'perdido' | null;
}

interface Movil {
  readonly contenedor: Phaser.GameObjects.Container;
  readonly radio: number;
  /** Velocidad en píxeles por segundo. */
  velocidadX: number;
  velocidadY: number;
  /** Para el zigzag y el flotar: por dónde va la onda. */
  fase: number;
  readonly amplitud: number;
  readonly baseY: number;
  readonly obstaculo?: ObstaculoJuego;
  readonly premio?: PremioJuego;
}

interface Bala {
  readonly figura: Phaser.GameObjects.Arc;
  readonly velocidad: number;
}

const COLOR_FONDO_POR_OMISION = 0x0f172a;

/** Lo que tarda el jugador en cruzar la pantalla, según su velocidad. */
const VELOCIDAD_JUGADOR: Record<string, number> = {
  lenta: 240,
  normal: 340,
  rapida: 470,
};

export class EscenaArcade extends Phaser.Scene {
  private definicion!: DefinicionJuego;
  private fondoUrl!: string | null;
  private escuchas: EscuchasJuego = {};

  private jugador!: Phaser.GameObjects.Container;
  private radioJugador = 22;
  private moviles: Movil[] = [];
  private balas: Bala[] = [];

  private puntos = 0;
  private vidas = 3;
  private msRestantes = 0;
  private factorVelocidad = 1;
  private terminado: 'ganado' | 'perdido' | null = null;

  /** Invulnerabilidad corta tras un golpe: sin ella un choque quita tres vidas. */
  private invulnerableHasta = 0;
  private proximoDisparo = 0;

  private teclas!: {
    arriba: Phaser.Input.Keyboard.Key;
    abajo: Phaser.Input.Keyboard.Key;
    izquierda: Phaser.Input.Keyboard.Key;
    derecha: Phaser.Input.Keyboard.Key;
    disparo: Phaser.Input.Keyboard.Key;
  };

  private textoPuntos!: Phaser.GameObjects.Text;
  private textoVidas!: Phaser.GameObjects.Text;
  private textoMeta!: Phaser.GameObjects.Text;

  private temporizadores: Phaser.Time.TimerEvent[] = [];

  constructor() {
    // `active: false` por la misma razón que en el renderizador isométrico:
    // Phaser arranca solo la escena declarada en la configuración, antes de que
    // se le haya entregado la definición, y `create` moriría sin datos.
    super({ key: 'arcade', active: false });
  }

  /**
   * Recibe la definicion antes de arrancar.
   *
   * Tolera que no llegue nada, y no es por prudencia abstracta: Phaser arranca
   * por su cuenta la escena declarada en la configuracion, durante el arranque
   * del juego y antes de que `cargar` pueda entregarle la definicion. Leer
   * `datos.definicion.jugador` aqui reventaba dentro del propio arranque de
   * Phaser, el lienzo se quedaba negro y la promesa de `cargar` no se resolvia
   * nunca. Es el mismo tropiezo que ya tenia el renderizador isometrico.
   */
  init(datos?: {
    definicion?: DefinicionJuego;
    fondoUrl?: string | null;
    escuchas?: EscuchasJuego;
  }): void {
    if (!datos?.definicion) return;

    this.definicion = datos.definicion;
    this.fondoUrl = datos.fondoUrl ?? null;
    this.escuchas = datos.escuchas ?? {};

    this.puntos = 0;
    this.vidas = datos.definicion.jugador.vidas;
    this.msRestantes = datos.definicion.meta.tipo === 'tiempo' ? datos.definicion.meta.valor * 1000 : 0;
    this.factorVelocidad = 1;
    this.terminado = null;
    this.moviles = [];
    this.balas = [];
    this.temporizadores = [];
  }

  /** La textura lleva el nombre del escenario, no un "fondo" generico. */
  private get claveFondo(): string {
    return `fondo-${this.definicion?.escenario ?? 'ninguno'}`;
  }

  preload(): void {
    if (!this.fondoUrl) return;

    // El fondo vive en S3, en otro dominio: sin `crossOrigin` el lienzo queda
    // "sucio" y la captura de la portada saldria en negro.
    this.load.crossOrigin = 'anonymous';

    // La clave lleva el escenario a proposito. Con una clave fija ("fondo"), al
    // cambiar de escenario Phaser veia que la textura ya existia, se saltaba la
    // carga y seguia pintando el fondo anterior para siempre.
    this.load.image(this.claveFondo, this.fondoUrl);
  }

  create(): void {
    // Red de seguridad de lo anterior: sin definicion no se dibuja nada, pero el
    // juego sigue en pie y `cargar` puede volver a arrancar la escena con datos.
    if (!this.definicion?.jugador) return;

    // Los limites del lienzo se recalculan aqui: el contenedor pudo cambiar de
    // tamano entre el arranque del juego y esta partida, y de esos limites
    // depende la posicion del raton.
    this.scale.refresh();

    this.dibujarFondo();
    this.crearJugador();
    this.crearMarcador();
    this.prepararEntrada();
    this.programarApariciones();

    this.aplicarReglas('empiezaElJuego');
    this.avisarMarcador();
  }

  // ───────────────────────────── Escenario ────────────────────────────────

  private dibujarFondo(): void {
    this.cameras.main.setBackgroundColor(COLOR_FONDO_POR_OMISION);

    if (this.textures.exists(this.claveFondo)) {
      const imagen = this.add.image(ANCHO_JUEGO / 2, ALTO_JUEGO / 2, this.claveFondo);
      imagen.setDisplaySize(ANCHO_JUEGO, ALTO_JUEGO);
      imagen.setDepth(-10);
      return;
    }

    // Sin imagen (sin S3 o sin red) el juego se juega igual, con un degradado.
    const degradado = this.add.graphics();
    degradado.fillGradientStyle(0x1e293b, 0x1e293b, 0x0ea5e9, 0x7b61ff, 1);
    degradado.fillRect(0, 0, ANCHO_JUEGO, ALTO_JUEGO);
    degradado.setDepth(-10);
  }

  // ────────────────────────────── El jugador ──────────────────────────────

  private crearJugador(): void {
    const { personaje, color } = this.definicion.jugador;
    const tinta = Phaser.Display.Color.HexStringToColor(color).color;

    this.jugador = this.add.container(120, ALTO_JUEGO / 2);
    this.jugador.setDepth(5);
    dibujarPersonaje(this, this.jugador, personaje, tinta);
    this.radioJugador = 24;

    // Un latido lento: hasta quieto, el personaje está vivo.
    this.tweens.add({
      targets: this.jugador,
      scale: 1.06,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private prepararEntrada(): void {
    if (this.definicion.control === 'teclado') {
      const teclado = this.input.keyboard;
      if (!teclado) return;
      this.teclas = {
        arriba: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        abajo: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        izquierda: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        derecha: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        disparo: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      };
      // Las flechas mueven el juego, no la página.
      teclado.addCapture([
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.SPACE,
      ]);
    } else {
      this.input.on('pointerdown', () => this.disparar());
    }
  }

  // ────────────────────────────── Marcador ────────────────────────────────

  private crearMarcador(): void {
    const estilo = {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f172a',
      strokeThickness: 5,
    } as const;

    this.textoPuntos = this.add.text(20, 16, '', estilo).setDepth(50);
    this.textoVidas = this.add.text(20, 50, '', estilo).setDepth(50);
    this.textoMeta = this.add.text(ANCHO_JUEGO - 20, 16, '', estilo).setDepth(50).setOrigin(1, 0);
    this.pintarMarcador();
  }

  private pintarMarcador(): void {
    this.textoPuntos.setText(`${this.puntos} puntos`);
    this.textoVidas.setText('❤'.repeat(Math.max(0, this.vidas)));

    const { meta } = this.definicion;
    if (meta.tipo === 'puntos') this.textoMeta.setText(`Meta: ${meta.valor}`);
    else if (meta.tipo === 'tiempo') {
      this.textoMeta.setText(`Aguanta: ${Math.ceil(this.msRestantes / 1000)}s`);
    } else this.textoMeta.setText('Sobrevive');
  }

  private avisarMarcador(): void {
    this.escuchas.alCambiarMarcador?.({
      puntos: this.puntos,
      vidas: this.vidas,
      segundos: this.definicion.meta.tipo === 'tiempo' ? Math.ceil(this.msRestantes / 1000) : null,
      meta: this.definicion.meta.valor,
      terminado: this.terminado,
    });
  }

  // ──────────────────────── Obstáculos y premios ──────────────────────────

  private programarApariciones(): void {
    for (const obstaculo of this.definicion.obstaculos) {
      this.temporizadores.push(
        this.time.addEvent({
          delay: MS_ENTRE_APARICIONES[obstaculo.frecuencia],
          loop: true,
          callback: () => this.aparecerObstaculo(obstaculo),
        }),
      );
    }
    for (const premio of this.definicion.premios) {
      this.temporizadores.push(
        this.time.addEvent({
          delay: MS_ENTRE_APARICIONES[premio.frecuencia],
          loop: true,
          callback: () => this.aparecerPremio(premio),
        }),
      );
    }
  }

  private aparecerObstaculo(obstaculo: ObstaculoJuego): void {
    if (this.terminado) return;

    const radio = RADIO_POR_TAMANO[obstaculo.tamano];
    const velocidad = PIXELES_POR_SEGUNDO[obstaculo.velocidad];
    const cae = obstaculo.movimiento === 'cae';

    const x = cae ? Phaser.Math.Between(radio * 2, ANCHO_JUEGO - radio) : ANCHO_JUEGO + radio;
    const y = cae ? -radio : Phaser.Math.Between(radio + 60, ALTO_JUEGO - radio - 20);

    const contenedor = this.add.container(x, y);
    contenedor.setDepth(3);
    dibujarObstaculo(this, contenedor, obstaculo, radio);

    this.moviles.push({
      contenedor,
      radio,
      velocidadX: cae ? 0 : -velocidad,
      velocidadY: cae ? velocidad : 0,
      fase: Math.random() * Math.PI * 2,
      amplitud: obstaculo.movimiento === 'zigzag' ? 120 : obstaculo.movimiento === 'flota' ? 45 : 0,
      baseY: y,
      obstaculo,
    });
  }

  private aparecerPremio(premio: PremioJuego): void {
    if (this.terminado) return;

    const radio = RADIO_POR_TAMANO[premio.tamano] * 0.8;
    const y = Phaser.Math.Between(radio + 60, ALTO_JUEGO - radio - 20);

    const contenedor = this.add.container(ANCHO_JUEGO + radio, y);
    contenedor.setDepth(3);
    dibujarPremio(this, contenedor, premio, radio);

    this.tweens.add({
      targets: contenedor,
      angle: 360,
      duration: 2600,
      repeat: -1,
    });

    this.moviles.push({
      contenedor,
      radio,
      velocidadX: -PIXELES_POR_SEGUNDO[premio.velocidad],
      velocidadY: 0,
      fase: Math.random() * Math.PI * 2,
      amplitud: 30,
      baseY: y,
      premio,
    });
  }

  // ─────────────────────────────── Disparo ────────────────────────────────

  private disparar(): void {
    if (this.terminado || !this.definicion.jugador.dispara) return;
    if (this.time.now < this.proximoDisparo) return;
    this.proximoDisparo = this.time.now + 280;

    const figura = this.add.circle(this.jugador.x + 26, this.jugador.y, 6, 0xffd93d);
    figura.setStrokeStyle(2, 0xff8a3d);
    figura.setDepth(4);
    this.balas.push({ figura, velocidad: 620 });
    this.escuchas.alSonar?.('salto');
  }

  // ─────────────────────────────── Bucle ──────────────────────────────────

  update(_tiempo: number, delta: number): void {
    if (!this.definicion || this.terminado) return;

    const segundos = (delta / 1000) * this.factorVelocidad;

    this.moverJugador(segundos);
    this.moverMoviles(segundos);
    this.moverBalas(segundos);
    this.comprobarChoques();
    this.contarTiempo(delta);
  }

  private moverJugador(segundos: number): void {
    const paso = VELOCIDAD_JUGADOR[this.definicion.jugador.velocidad]! * segundos;

    if (this.definicion.control === 'teclado') {
      if (!this.teclas) return;
      if (this.teclas.arriba.isDown) this.jugador.y -= paso;
      if (this.teclas.abajo.isDown) this.jugador.y += paso;
      if (this.teclas.izquierda.isDown) this.jugador.x -= paso;
      if (this.teclas.derecha.isDown) this.jugador.x += paso;
      if (this.teclas.disparo.isDown) this.disparar();
    } else {
      // Con el ratón (o el dedo) el personaje persigue al puntero en lugar de
      // pegarse a él: pegado, el juego no tendría ninguna dificultad.
      const puntero = this.input.activePointer;
      if (puntero.worldX || puntero.worldY) {
        const dx = puntero.worldX - this.jugador.x;
        const dy = puntero.worldY - this.jugador.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia > 4) {
          const avance = Math.min(paso, distancia);
          this.jugador.x += (dx / distancia) * avance;
          this.jugador.y += (dy / distancia) * avance;
        }
      }
    }

    this.jugador.x = Phaser.Math.Clamp(this.jugador.x, 40, ANCHO_JUEGO - 40);
    this.jugador.y = Phaser.Math.Clamp(this.jugador.y, 60, ALTO_JUEGO - 40);
  }

  private moverMoviles(segundos: number): void {
    for (const movil of [...this.moviles]) {
      movil.contenedor.x += movil.velocidadX * segundos;
      movil.contenedor.y += movil.velocidadY * segundos;

      if (movil.amplitud > 0) {
        movil.fase += segundos * (movil.premio ? 2 : 3);
        movil.contenedor.y = movil.baseY + Math.sin(movil.fase) * movil.amplitud;
      }

      const fuera =
        movil.contenedor.x < -movil.radio * 2 ||
        movil.contenedor.y > ALTO_JUEGO + movil.radio * 2 ||
        movil.contenedor.x > ANCHO_JUEGO + movil.radio * 4;

      if (fuera) this.retirar(movil);
    }
  }

  private moverBalas(segundos: number): void {
    for (const bala of [...this.balas]) {
      bala.figura.x += bala.velocidad * segundos;
      if (bala.figura.x > ANCHO_JUEGO + 20) {
        bala.figura.destroy();
        this.balas = this.balas.filter((b) => b !== bala);
      }
    }
  }

  private retirar(movil: Movil): void {
    movil.contenedor.destroy();
    this.moviles = this.moviles.filter((m) => m !== movil);
  }

  private comprobarChoques(): void {
    // Balas contra obstáculos que se pueden destruir.
    for (const bala of [...this.balas]) {
      for (const movil of [...this.moviles]) {
        if (!movil.obstaculo?.seDestruye) continue;
        const distancia = Phaser.Math.Distance.Between(
          bala.figura.x,
          bala.figura.y,
          movil.contenedor.x,
          movil.contenedor.y,
        );
        if (distancia > movil.radio + 8) continue;

        this.chispas(movil.contenedor.x, movil.contenedor.y, 0xff8a3d);
        this.retirar(movil);
        bala.figura.destroy();
        this.balas = this.balas.filter((b) => b !== bala);
        this.aplicarReglas('disparaObstaculo');
        break;
      }
    }

    // El jugador contra todo lo demás.
    for (const movil of [...this.moviles]) {
      const distancia = Phaser.Math.Distance.Between(
        this.jugador.x,
        this.jugador.y,
        movil.contenedor.x,
        movil.contenedor.y,
      );
      if (distancia > movil.radio + this.radioJugador * 0.8) continue;

      if (movil.premio) {
        this.chispas(movil.contenedor.x, movil.contenedor.y, 0xffd93d);
        this.retirar(movil);
        this.aplicarReglas('tocaPremio', movil.premio.puntos);
      } else if (this.time.now >= this.invulnerableHasta) {
        this.invulnerableHasta = this.time.now + 900;
        this.chispas(this.jugador.x, this.jugador.y, 0xef4444);
        this.parpadearJugador();
        this.retirar(movil);
        this.aplicarReglas('tocaObstaculo');
      }
    }
  }

  private contarTiempo(delta: number): void {
    if (this.definicion.meta.tipo !== 'tiempo') return;

    this.msRestantes -= delta;
    if (this.msRestantes <= 0) {
      this.msRestantes = 0;
      this.pintarMarcador();
      this.aplicarReglas('seAcabaElTiempo');
      return;
    }
    // El reloj se repinta una vez por segundo, no sesenta.
    if (Math.ceil(this.msRestantes / 1000) !== Math.ceil((this.msRestantes + delta) / 1000)) {
      this.pintarMarcador();
      this.avisarMarcador();
    }
  }

  // ─────────────────────────────── Reglas ─────────────────────────────────

  /**
   * Ejecuta lo que el estudiante programó para un suceso.
   *
   * `puntosDelPremio` es lo que valía el premio que acaba de tocar. Si la regla
   * no dice cuántos puntos suma, se usa ese: así el niño puede cambiar el valor
   * del premio sin tener que tocar además la regla.
   */
  private aplicarReglas(evento: ReglaJuego['cuando'], puntosDelPremio = 0): void {
    if (this.terminado) return;

    for (const regla of this.definicion.reglas) {
      if (regla.cuando !== evento) continue;
      this.ejecutar(regla, puntosDelPremio);
      if (this.terminado) break;
    }

    this.pintarMarcador();
    this.avisarMarcador();

    // Los umbrales se miran después de cada cambio de marcador.
    if (!this.terminado) this.comprobarUmbrales();
  }

  private ejecutar(regla: ReglaJuego, puntosDelPremio: number): void {
    if (regla.sonido) this.escuchas.alSonar?.(regla.sonido);

    switch (regla.entonces) {
      case 'sumarPuntos':
        this.puntos += regla.cantidad ?? puntosDelPremio ?? 0;
        break;
      case 'restarPuntos':
        this.puntos = Math.max(0, this.puntos - (regla.cantidad ?? 5));
        break;
      case 'quitarVida':
        this.vidas -= regla.cantidad ?? 1;
        break;
      case 'darVida':
        this.vidas += regla.cantidad ?? 1;
        break;
      case 'acelerar':
        this.factorVelocidad = Math.min(2.2, this.factorVelocidad + 0.15);
        break;
      case 'frenar':
        this.factorVelocidad = Math.max(0.45, this.factorVelocidad - 0.15);
        break;
      case 'sonar':
        // El sonido ya salió arriba; la regla no hace nada más.
        break;
      case 'ganar':
        this.acabar('ganado');
        break;
      case 'perder':
        this.acabar('perdido');
        break;
    }
  }

  private comprobarUmbrales(): void {
    if (this.vidas <= 0) {
      this.aplicarReglas('pierdeTodasLasVidas');
      // Si el estudiante borró la regla de perder, el juego no acaba por esto:
      // es lo que programó. Pero con cero vidas no se puede seguir chocando.
      if (!this.terminado) this.vidas = 0;
      return;
    }

    for (const regla of this.definicion.reglas) {
      if (regla.cuando !== 'puntosLleganA') continue;
      if (this.puntos < (regla.umbral ?? Number.POSITIVE_INFINITY)) continue;
      this.ejecutar(regla, 0);
      if (this.terminado) return;
    }
  }

  private acabar(como: 'ganado' | 'perdido'): void {
    if (this.terminado) return;
    this.terminado = como;

    for (const temporizador of this.temporizadores) temporizador.remove();
    this.temporizadores = [];

    const texto = como === 'ganado' ? '¡GANASTE!' : 'Fin del juego';
    const color = como === 'ganado' ? '#5AD35A' : '#EF4444';

    this.add
      .text(ANCHO_JUEGO / 2, ALTO_JUEGO / 2, texto, {
        fontFamily: 'Fredoka, Nunito, system-ui, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color,
        stroke: '#0f172a',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.escuchas.alSonar?.(como === 'ganado' ? 'victoria' : 'choque');
    this.avisarMarcador();

    if (como === 'ganado') this.escuchas.alGanar?.();
    else this.escuchas.alPerder?.();
  }

  // ──────────────────────────────── Adornos ───────────────────────────────

  private parpadearJugador(): void {
    this.tweens.add({
      targets: this.jugador,
      alpha: 0.3,
      duration: 120,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.jugador.setAlpha(1),
    });
  }

  private chispas(x: number, y: number, color: number): void {
    for (let i = 0; i < 8; i++) {
      const chispa = this.add.circle(x, y, 3 + Math.random() * 3, color);
      chispa.setDepth(60);
      const angulo = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: chispa,
        x: x + Math.cos(angulo) * (25 + Math.random() * 35),
        y: y + Math.sin(angulo) * (25 + Math.random() * 35),
        alpha: 0,
        scale: 0,
        duration: 450,
        onComplete: () => chispa.destroy(),
      });
    }
  }
}

// ──────────────────────────── Dibujo de las piezas ─────────────────────────

/**
 * Los personajes, dibujados con primitivas.
 *
 * Cada uno son cuatro o cinco figuras: lo justo para reconocerlo de un vistazo
 * a tamaño de juego. El color lo elige el niño, así que la silueta tiene que
 * funcionar en doce tonos distintos.
 */
function dibujarPersonaje(
  escena: Phaser.Scene,
  contenedor: Phaser.GameObjects.Container,
  personaje: string,
  color: number,
): void {
  const oscuro = Phaser.Display.Color.ValueToColor(color).darken(30).color;
  const g = escena.add.graphics();

  const triangulo = (puntos: readonly [number, number][], relleno: number): void => {
    g.fillStyle(relleno, 1);
    g.beginPath();
    g.moveTo(puntos[0]![0], puntos[0]![1]);
    for (const [x, y] of puntos.slice(1)) g.lineTo(x, y);
    g.closePath();
    g.fillPath();
  };

  switch (personaje) {
    case 'cohete':
      triangulo([[26, 0], [-8, -14], [-8, 14]], color);
      g.fillStyle(oscuro, 1);
      g.fillTriangle(-8, -14, -22, -22, -8, -4);
      g.fillTriangle(-8, 14, -22, 22, -8, 4);
      g.fillStyle(0x06b6d4, 1);
      g.fillCircle(6, 0, 6);
      g.fillStyle(0xff8a3d, 1);
      g.fillTriangle(-10, -6, -10, 6, -28, 0);
      break;

    case 'avion':
      g.fillStyle(color, 1);
      g.fillEllipse(0, 0, 54, 18);
      g.fillStyle(oscuro, 1);
      g.fillEllipse(-4, 0, 22, 40);
      g.fillStyle(0x1e293b, 1);
      g.fillCircle(14, 0, 5);
      break;

    case 'pez':
      g.fillStyle(color, 1);
      g.fillEllipse(0, 0, 52, 30);
      triangulo([[-24, 0], [-40, -14], [-40, 14]], oscuro);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(14, -5, 6);
      g.fillStyle(0x1e293b, 1);
      g.fillCircle(15, -5, 3);
      break;

    case 'dragon':
      g.fillStyle(color, 1);
      g.fillEllipse(-4, 0, 50, 32);
      g.fillCircle(20, -4, 14);
      triangulo([[10, -18], [16, -32], [22, -18]], oscuro);
      triangulo([[-20, -10], [-34, -26], [-10, -20]], oscuro);
      g.fillStyle(0x1e293b, 1);
      g.fillCircle(26, -6, 3);
      break;

    case 'robot':
      g.fillStyle(color, 1);
      g.fillRoundedRect(-20, -22, 40, 44, 8);
      g.fillStyle(0x1e293b, 1);
      g.fillRoundedRect(-12, -12, 24, 14, 4);
      g.fillStyle(0x22d3ee, 1);
      g.fillCircle(-5, -5, 3);
      g.fillCircle(5, -5, 3);
      g.fillStyle(oscuro, 1);
      g.fillRect(-2, -32, 4, 10);
      g.fillCircle(0, -34, 4);
      break;

    case 'gato':
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, 22);
      triangulo([[-16, -14], [-8, -30], [-2, -16]], color);
      triangulo([[16, -14], [8, -30], [2, -16]], color);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-8, -4, 6);
      g.fillCircle(8, -4, 6);
      g.fillStyle(0x1e293b, 1);
      g.fillCircle(-8, -4, 3);
      g.fillCircle(8, -4, 3);
      g.fillStyle(0xff3cac, 1);
      g.fillTriangle(-3, 6, 3, 6, 0, 10);
      break;

    case 'pinguino':
      g.fillStyle(0x1e293b, 1);
      g.fillEllipse(0, 0, 40, 50);
      g.fillStyle(color, 1);
      g.fillEllipse(0, 6, 26, 34);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-7, -14, 5);
      g.fillCircle(7, -14, 5);
      g.fillStyle(0x1e293b, 1);
      g.fillCircle(-7, -14, 2.5);
      g.fillCircle(7, -14, 2.5);
      g.fillStyle(0xff8a3d, 1);
      g.fillTriangle(-5, -6, 5, -6, 0, 2);
      break;

    case 'abeja':
    default:
      g.fillStyle(color, 1);
      g.fillEllipse(0, 0, 46, 30);
      g.fillStyle(0x1e293b, 1);
      g.fillRect(-6, -14, 6, 28);
      g.fillRect(8, -12, 6, 24);
      g.fillStyle(0xffffff, 0.75);
      g.fillEllipse(-4, -20, 26, 14);
      g.fillStyle(0x1e293b, 1);
      g.fillCircle(20, -4, 3);
      break;
  }

  contenedor.add(g);
}

function dibujarObstaculo(
  escena: Phaser.Scene,
  contenedor: Phaser.GameObjects.Container,
  obstaculo: ObstaculoJuego,
  radio: number,
): void {
  const color = Phaser.Display.Color.HexStringToColor(obstaculo.color).color;
  const oscuro = Phaser.Display.Color.ValueToColor(color).darken(35).color;
  const g = escena.add.graphics();

  switch (obstaculo.forma) {
    case 'asteroide': {
      g.fillStyle(color, 1);
      g.beginPath();
      for (let i = 0; i < 9; i++) {
        const angulo = (i / 9) * Math.PI * 2;
        const r = radio * (0.78 + ((i * 37) % 10) / 40);
        const x = Math.cos(angulo) * r;
        const y = Math.sin(angulo) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillPath();
      g.fillStyle(oscuro, 1);
      g.fillCircle(-radio * 0.3, -radio * 0.2, radio * 0.22);
      g.fillCircle(radio * 0.25, radio * 0.3, radio * 0.16);
      break;
    }
    case 'caja':
      g.fillStyle(color, 1);
      g.fillRoundedRect(-radio, -radio, radio * 2, radio * 2, radio * 0.2);
      g.lineStyle(3, oscuro, 1);
      g.strokeRoundedRect(-radio, -radio, radio * 2, radio * 2, radio * 0.2);
      g.lineBetween(-radio, 0, radio, 0);
      break;
    case 'pincho':
      g.fillStyle(color, 1);
      g.fillTriangle(0, -radio, radio, radio, -radio, radio);
      g.fillStyle(oscuro, 1);
      g.fillTriangle(0, -radio, radio * 0.3, radio, -radio * 0.3, radio);
      break;
    case 'nube':
      g.fillStyle(color, 1);
      g.fillCircle(-radio * 0.5, radio * 0.1, radio * 0.6);
      g.fillCircle(radio * 0.5, radio * 0.1, radio * 0.55);
      g.fillCircle(0, -radio * 0.3, radio * 0.7);
      break;
    case 'burbuja':
      g.fillStyle(color, 0.55);
      g.fillCircle(0, 0, radio);
      g.lineStyle(3, color, 1);
      g.strokeCircle(0, 0, radio);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(-radio * 0.35, -radio * 0.35, radio * 0.16);
      break;
    case 'rayo':
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(radio * 0.2, -radio);
      g.lineTo(-radio * 0.5, radio * 0.1);
      g.lineTo(0, radio * 0.1);
      g.lineTo(-radio * 0.25, radio);
      g.lineTo(radio * 0.6, -radio * 0.2);
      g.lineTo(radio * 0.05, -radio * 0.2);
      g.closePath();
      g.fillPath();
      break;
    case 'rueda':
      g.lineStyle(radio * 0.32, color, 1);
      g.strokeCircle(0, 0, radio * 0.72);
      g.fillStyle(oscuro, 1);
      for (let i = 0; i < 6; i++) {
        const angulo = (i / 6) * Math.PI * 2;
        g.fillCircle(Math.cos(angulo) * radio * 0.72, Math.sin(angulo) * radio * 0.72, radio * 0.16);
      }
      break;
    case 'hueso':
    default:
      g.fillStyle(color, 1);
      g.fillRoundedRect(-radio, -radio * 0.22, radio * 2, radio * 0.44, radio * 0.2);
      g.fillCircle(-radio, -radio * 0.35, radio * 0.32);
      g.fillCircle(-radio, radio * 0.35, radio * 0.32);
      g.fillCircle(radio, -radio * 0.35, radio * 0.32);
      g.fillCircle(radio, radio * 0.35, radio * 0.32);
      break;
  }

  contenedor.add(g);
}

function dibujarPremio(
  escena: Phaser.Scene,
  contenedor: Phaser.GameObjects.Container,
  premio: PremioJuego,
  radio: number,
): void {
  const color = Phaser.Display.Color.HexStringToColor(premio.color).color;
  const oscuro = Phaser.Display.Color.ValueToColor(color).darken(28).color;
  const g = escena.add.graphics();

  switch (premio.forma) {
    case 'estrella': {
      g.fillStyle(color, 1);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const angulo = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? radio : radio * 0.45;
        const x = Math.cos(angulo) * r;
        const y = Math.sin(angulo) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillPath();
      break;
    }
    case 'moneda':
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, radio);
      g.lineStyle(3, oscuro, 1);
      g.strokeCircle(0, 0, radio * 0.62);
      break;
    case 'gema':
      g.fillStyle(color, 1);
      g.fillTriangle(0, -radio, radio, -radio * 0.1, 0, radio);
      g.fillStyle(oscuro, 1);
      g.fillTriangle(0, -radio, -radio, -radio * 0.1, 0, radio);
      break;
    case 'corazon':
      g.fillStyle(color, 1);
      g.fillCircle(-radio * 0.4, -radio * 0.25, radio * 0.55);
      g.fillCircle(radio * 0.4, -radio * 0.25, radio * 0.55);
      g.fillTriangle(-radio * 0.9, 0, radio * 0.9, 0, 0, radio);
      break;
    case 'flor':
      g.fillStyle(color, 1);
      for (let i = 0; i < 6; i++) {
        const angulo = (i / 6) * Math.PI * 2;
        g.fillCircle(Math.cos(angulo) * radio * 0.55, Math.sin(angulo) * radio * 0.55, radio * 0.42);
      }
      g.fillStyle(0xffd93d, 1);
      g.fillCircle(0, 0, radio * 0.35);
      break;
    case 'llave':
    default:
      g.lineStyle(radio * 0.25, color, 1);
      g.strokeCircle(-radio * 0.45, 0, radio * 0.42);
      g.fillStyle(color, 1);
      g.fillRect(-radio * 0.1, -radio * 0.12, radio, radio * 0.24);
      g.fillRect(radio * 0.55, 0, radio * 0.16, radio * 0.45);
      break;
  }

  contenedor.add(g);
}

// ─────────────────────────────── Adaptador ──────────────────────────────────

/**
 * Envuelve Phaser para que las vistas no lo toquen.
 *
 * `preserveDrawingBuffer` no es un capricho: sin él, `toDataURL` sobre un lienzo
 * WebGL devuelve una imagen en negro, y la portada del juego —que es una captura
 * de la propia partida— saldría vacía.
 */
export class JuegoArcade {
  private juego: Phaser.Game | null = null;
  private escena: EscenaArcade | null = null;

  constructor(private readonly contenedor: HTMLElement) {}

  async cargar(
    definicion: DefinicionJuego,
    fondoUrl: string | null,
    escuchas: EscuchasJuego,
  ): Promise<void> {
    const datos = { definicion, fondoUrl, escuchas };

    if (this.juego) {
      this.juego.scene.stop('arcade');
      this.juego.scene.start('arcade', datos);
      this.escena = this.juego.scene.getScene('arcade') as EscenaArcade;
      return;
    }

    return new Promise((resolver) => {
      this.juego = new Phaser.Game({
        type: Phaser.AUTO,
        parent: this.contenedor,
        width: ANCHO_JUEGO,
        height: ALTO_JUEGO,
        transparent: false,
        backgroundColor: '#0f172a',
        audio: { noAudio: true },
        render: { preserveDrawingBuffer: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: EscenaArcade,
        callbacks: {
          postBoot: (juego) => {
            const escena = juego.scene.getScene('arcade') as EscenaArcade;
            this.escena = escena;
            escena.events.once(Phaser.Scenes.Events.CREATE, () => resolver());
            juego.scene.start('arcade', datos);
          },
        },
      });
    });
  }

  /** Vuelve a empezar la partida con la misma definición. */
  reiniciar(definicion: DefinicionJuego, fondoUrl: string | null, escuchas: EscuchasJuego): void {
    if (!this.juego) return;
    this.juego.scene.stop('arcade');
    this.juego.scene.start('arcade', { definicion, fondoUrl, escuchas });
    this.escena = this.juego.scene.getScene('arcade') as EscenaArcade;
  }

  /** Captura del lienzo, para la portada del juego. */
  capturar(): string | null {
    const lienzo = this.juego?.canvas;
    if (!lienzo) return null;
    try {
      // 640 de ancho es de sobra para una tarjeta y no pasa de 100 KB.
      const reducido = document.createElement('canvas');
      reducido.width = 640;
      reducido.height = 360;
      const pincel = reducido.getContext('2d');
      if (!pincel) return null;
      pincel.drawImage(lienzo, 0, 0, 640, 360);
      return reducido.toDataURL('image/jpeg', 0.82);
    } catch {
      // Un lienzo "sucio" (una imagen de otro dominio sin CORS) no se puede
      // leer. Se publica sin portada en lugar de no publicar.
      return null;
    }
  }

  destruir(): void {
    this.juego?.destroy(true);
    this.juego = null;
    this.escena = null;
  }
}
