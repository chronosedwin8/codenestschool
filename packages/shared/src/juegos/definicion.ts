/**
 * La definición de un juego hecho por un estudiante (formato v1).
 *
 * Es el único formato que viaja entre el constructor, el servidor y el motor que
 * lo juega, así que vive aquí y no en ninguno de los tres. El servidor lo valida
 * con el esquema zod del final del archivo y **no se fía de nada más**: un juego
 * solo puede referirse a claves de este catálogo, nunca a una imagen cualquiera
 * de internet ni a un texto libre.
 *
 * Los límites son duros a propósito. No son una defensa contra un atacante
 * —para eso está la validación— sino contra un juego imposible: cuarenta tipos
 * de obstáculo cayendo a la vez no es un reto, es una pantalla ilegible en la
 * tableta de un niño de ocho años.
 */

/** Fondos del catálogo. Cada uno es una imagen en S3 y una música. */
export const ESCENARIOS = [
  'espacio',
  'bosque',
  'oceano',
  'ciudad',
  'nieve',
  'volcan',
  'desierto',
  'castillo',
  'laboratorio',
  'dulces',
] as const;
export type Escenario = (typeof ESCENARIOS)[number];

/** Personajes que puede llevar el jugador. Se dibujan con SVG, como el Fuzz. */
export const PERSONAJES = [
  'cohete',
  'avion',
  'pez',
  'dragon',
  'robot',
  'gato',
  'pinguino',
  'abeja',
] as const;
export type Personaje = (typeof PERSONAJES)[number];

export const FORMAS_OBSTACULO = [
  'asteroide',
  'caja',
  'pincho',
  'nube',
  'burbuja',
  'rayo',
  'rueda',
  'hueso',
] as const;
export type FormaObstaculo = (typeof FORMAS_OBSTACULO)[number];

export const FORMAS_PREMIO = ['estrella', 'moneda', 'gema', 'corazon', 'flor', 'llave'] as const;
export type FormaPremio = (typeof FORMAS_PREMIO)[number];

export const VELOCIDADES = ['lenta', 'normal', 'rapida'] as const;
export type Velocidad = (typeof VELOCIDADES)[number];

export const FRECUENCIAS = ['baja', 'media', 'alta'] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];

export const TAMANOS = ['pequeno', 'mediano', 'grande'] as const;
export type Tamano = (typeof TAMANOS)[number];

/** Cómo se mueve un obstáculo por la pantalla. */
export const MOVIMIENTOS = ['recto', 'zigzag', 'cae', 'flota'] as const;
export type Movimiento = (typeof MOVIMIENTOS)[number];

/** Con qué se juega. Es una sola decisión y cambia el motor entero. */
export const CONTROLES = ['teclado', 'raton'] as const;
export type Control = (typeof CONTROLES)[number];

/**
 * Los sucesos que el estudiante puede programar.
 *
 * Están en su idioma y en su mundo: "cuando toco un premio", no
 * "onCollisionEnter". Es la misma decisión que en los mundos de fichas.
 */
export const EVENTOS = [
  'tocaPremio',
  'tocaObstaculo',
  'disparaObstaculo',
  'puntosLleganA',
  'pierdeTodasLasVidas',
  'seAcabaElTiempo',
  'empiezaElJuego',
] as const;
export type Evento = (typeof EVENTOS)[number];

/** Lo que puede ocurrir como consecuencia. */
export const ACCIONES = [
  'sumarPuntos',
  'restarPuntos',
  'quitarVida',
  'darVida',
  'acelerar',
  'frenar',
  'sonar',
  'ganar',
  'perder',
] as const;
// `AccionJuego` y no `Accion`: ese nombre ya lo usa el simulador de rejilla de
// los mundos 1-30, y son dos cosas distintas.
export type AccionJuego = (typeof ACCIONES)[number];

export const SONIDOS = ['estrella', 'moneda', 'choque', 'salto', 'victoria', 'desbloqueo'] as const;
export type Sonido = (typeof SONIDOS)[number];

/** Cómo se gana. Sin meta, un juego no se acaba nunca y no se puede ganar. */
export const METAS = ['puntos', 'tiempo', 'sobrevivir'] as const;
export type Meta = (typeof METAS)[number];

export interface ReglaJuego {
  readonly id: string;
  readonly cuando: Evento;
  /** Umbral del evento, cuando lo necesita (`puntosLleganA`). */
  readonly umbral?: number;
  readonly entonces: AccionJuego;
  /** Cantidad de la acción: puntos que suma, vidas que quita, sonido que suena. */
  readonly cantidad?: number;
  readonly sonido?: Sonido;
}

export interface ObstaculoJuego {
  readonly id: string;
  readonly forma: FormaObstaculo;
  readonly color: string;
  readonly tamano: Tamano;
  readonly velocidad: Velocidad;
  readonly frecuencia: Frecuencia;
  readonly movimiento: Movimiento;
  /** Si se puede destruir disparándole (solo con `jugador.dispara`). */
  readonly seDestruye: boolean;
}

export interface PremioJuego {
  readonly id: string;
  readonly forma: FormaPremio;
  readonly color: string;
  readonly tamano: Tamano;
  readonly velocidad: Velocidad;
  readonly frecuencia: Frecuencia;
  readonly puntos: number;
}

export interface JugadorJuego {
  readonly personaje: Personaje;
  readonly color: string;
  readonly velocidad: Velocidad;
  readonly vidas: number;
  readonly dispara: boolean;
}

export interface DefinicionJuego {
  readonly version: 1;
  readonly escenario: Escenario;
  readonly control: Control;
  readonly jugador: JugadorJuego;
  readonly obstaculos: readonly ObstaculoJuego[];
  readonly premios: readonly PremioJuego[];
  readonly reglas: readonly ReglaJuego[];
  readonly meta: { readonly tipo: Meta; readonly valor: number };
  /** Música de fondo; por omisión, la del escenario. */
  readonly musica: boolean;
}

// ────────────────────────────── Límites ──────────────────────────────────

export const LIMITES = {
  obstaculos: 6,
  premios: 4,
  reglas: 20,
  vidasMax: 9,
  puntosMeta: 2000,
  segundosMeta: 300,
  puntosPorPremio: 100,
} as const;

/** Colores que puede elegir un estudiante. Cerrado: nada de texto libre. */
export const COLORES_JUEGO = [
  '#1FA2FF',
  '#5AD35A',
  '#FF3CAC',
  '#FFD93D',
  '#FF8A3D',
  '#7B61FF',
  '#EF4444',
  '#06B6D4',
  '#94A3B8',
  '#F8FAFC',
  '#1E293B',
  '#22C55E',
] as const;

// ─────────────────────── Valores de referencia ───────────────────────────

/**
 * Traducción de las palabras del niño a números del motor.
 *
 * Vive aquí, y no en el motor, porque el constructor necesita las mismas cifras
 * para avisar de que un juego es imposible: si el servidor y la pantalla no usan
 * la misma tabla, el aviso miente.
 */
export const PIXELES_POR_SEGUNDO: Record<Velocidad, number> = {
  lenta: 110,
  normal: 190,
  rapida: 300,
};

/** Cada cuántos milisegundos aparece uno nuevo. */
export const MS_ENTRE_APARICIONES: Record<Frecuencia, number> = {
  baja: 2600,
  media: 1500,
  alta: 800,
};

export const RADIO_POR_TAMANO: Record<Tamano, number> = {
  pequeno: 16,
  mediano: 26,
  grande: 38,
};

// ────────────────────── Juego de partida ─────────────────────────────────

/**
 * Un juego que ya funciona, para empezar.
 *
 * Al estudiante no se le entrega un lienzo vacío: se le entrega un juego que se
 * puede pulsar "Probar" y se juega. Cambiar algo que funciona es mucho más fácil
 * que inventarlo de cero, y es lo que hace Kodable con sus plantillas.
 */
export function juegoDePartida(): DefinicionJuego {
  return {
    version: 1,
    escenario: 'espacio',
    control: 'teclado',
    jugador: {
      personaje: 'cohete',
      color: '#1FA2FF',
      velocidad: 'normal',
      vidas: 3,
      dispara: true,
    },
    obstaculos: [
      {
        id: 'o1',
        forma: 'asteroide',
        color: '#94A3B8',
        tamano: 'mediano',
        velocidad: 'normal',
        frecuencia: 'media',
        movimiento: 'recto',
        seDestruye: true,
      },
    ],
    premios: [
      {
        id: 'p1',
        forma: 'estrella',
        color: '#FFD93D',
        tamano: 'pequeno',
        velocidad: 'normal',
        frecuencia: 'media',
        puntos: 10,
      },
    ],
    reglas: [
      { id: 'r1', cuando: 'tocaPremio', entonces: 'sumarPuntos', cantidad: 10, sonido: 'estrella' },
      { id: 'r2', cuando: 'tocaObstaculo', entonces: 'quitarVida', cantidad: 1, sonido: 'choque' },
      { id: 'r3', cuando: 'puntosLleganA', umbral: 100, entonces: 'ganar' },
      { id: 'r4', cuando: 'pierdeTodasLasVidas', entonces: 'perder' },
    ],
    meta: { tipo: 'puntos', valor: 100 },
    musica: true,
  };
}

// ───────────────────────── Sentido del juego ─────────────────────────────

export interface AvisoJuego {
  readonly clave: string;
  readonly texto: string;
}

/**
 * Avisos sobre si el juego se puede ganar y se puede perder.
 *
 * No bloquea nada: es el constructor el que se los muestra. Un juego sin forma
 * de ganar no está "mal", pero un niño que publica su juego y ve que nadie puede
 * terminarlo se lleva un chasco que se puede evitar con una frase.
 */
export function revisarJuego(def: DefinicionJuego): AvisoJuego[] {
  const avisos: AvisoJuego[] = [];
  const tiene = (evento: Evento): boolean => def.reglas.some((r) => r.cuando === evento);
  const hace = (accion: AccionJuego): boolean => def.reglas.some((r) => r.entonces === accion);

  if (def.meta.tipo === 'puntos') {
    const porVuelta = def.premios.reduce((suma, p) => suma + p.puntos, 0);
    if (def.premios.length === 0 || porVuelta === 0) {
      avisos.push({
        clave: 'sin-premios',
        texto: 'Tu meta son puntos, pero no hay ningun premio que dé puntos. Nadie podria ganar.',
      });
    }
    if (!tiene('tocaPremio')) {
      avisos.push({
        clave: 'sin-regla-premio',
        texto: 'Falta la regla "cuando toca un premio": los premios no harian nada.',
      });
    }
  }

  if (!hace('ganar') && def.meta.tipo !== 'sobrevivir') {
    avisos.push({
      clave: 'sin-victoria',
      texto: 'Ninguna regla dice cuando se gana, asi que el juego no se acaba nunca.',
    });
  }

  if (def.obstaculos.length === 0) {
    avisos.push({
      clave: 'sin-obstaculos',
      texto: 'No hay obstaculos: el juego se gana sin esfuerzo. Anade alguno para que sea un reto.',
    });
  }

  if (!hace('perder') && !hace('quitarVida')) {
    avisos.push({
      clave: 'sin-derrota',
      texto: 'No hay forma de perder. Un juego sin riesgo se aburre enseguida.',
    });
  }

  return avisos;
}
