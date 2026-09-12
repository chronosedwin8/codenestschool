/**
 * Los nombres que lee el niño en el constructor de juegos.
 *
 * La definición del juego (`@codenest/shared`) usa claves en código —`espacio`,
 * `tocaPremio`—; aquí viven las palabras. Están separadas por dos razones: la
 * definición la valida el servidor y no debería cambiar porque alguien mejore una
 * frase, y el día que haya una segunda lengua se traduce este archivo y nada más.
 *
 * Las frases de las reglas están escritas para leerse de corrido:
 *
 *   «Cuando *toco un premio* entonces *sumo puntos*.»
 *
 * Es la misma idea que las fichas de los mundos 1 al 10: la programación se lee
 * como una frase, no como una llamada a una función.
 */
import type {
  AccionJuego,
  Control,
  Escenario,
  Evento,
  FormaObstaculo,
  FormaPremio,
  Frecuencia,
  Meta,
  Movimiento,
  Personaje,
  Tamano,
  Velocidad,
} from '@codenest/shared';

export interface OpcionCatalogo<T extends string> {
  readonly clave: T;
  readonly nombre: string;
  /** Una línea que explica qué hace, para el niño que sí lee. */
  readonly pista?: string;
  readonly icono?: string;
}

export const ESCENARIOS_CATALOGO: readonly OpcionCatalogo<Escenario>[] = [
  { clave: 'espacio', nombre: 'Espacio', icono: '🪐', pista: 'Nebulosa, estrellas y planetas' },
  { clave: 'bosque', nombre: 'Bosque', icono: '🌳', pista: 'Claro del bosque con rayos de sol' },
  { clave: 'oceano', nombre: 'Oceano', icono: '🐠', pista: 'Bajo el agua, con corales' },
  { clave: 'ciudad', nombre: 'Ciudad', icono: '🏙️', pista: 'Edificios y nubes' },
  { clave: 'nieve', nombre: 'Nieve', icono: '❄️', pista: 'Montanas nevadas' },
  { clave: 'volcan', nombre: 'Volcan', icono: '🌋', pista: 'Roca y lava al atardecer' },
  { clave: 'desierto', nombre: 'Desierto', icono: '🏜️', pista: 'Dunas y piramides' },
  { clave: 'castillo', nombre: 'Castillo', icono: '🏰', pista: 'Torres sobre las nubes' },
  { clave: 'laboratorio', nombre: 'Laboratorio', icono: '🧪', pista: 'Frascos de colores' },
  { clave: 'dulces', nombre: 'Dulces', icono: '🍭', pista: 'Chocolate y piruletas' },
];

export const PERSONAJES_CATALOGO: readonly OpcionCatalogo<Personaje>[] = [
  { clave: 'cohete', nombre: 'Cohete', icono: '🚀' },
  { clave: 'avion', nombre: 'Avion', icono: '✈️' },
  { clave: 'pez', nombre: 'Pez', icono: '🐟' },
  { clave: 'dragon', nombre: 'Dragon', icono: '🐉' },
  { clave: 'robot', nombre: 'Robot', icono: '🤖' },
  { clave: 'gato', nombre: 'Gato', icono: '🐱' },
  { clave: 'pinguino', nombre: 'Pingüino', icono: '🐧' },
  { clave: 'abeja', nombre: 'Abeja', icono: '🐝' },
];

export const OBSTACULOS_CATALOGO: readonly OpcionCatalogo<FormaObstaculo>[] = [
  { clave: 'asteroide', nombre: 'Asteroide', icono: '☄️' },
  { clave: 'caja', nombre: 'Caja', icono: '📦' },
  { clave: 'pincho', nombre: 'Pincho', icono: '🔻' },
  { clave: 'nube', nombre: 'Nube', icono: '☁️' },
  { clave: 'burbuja', nombre: 'Burbuja', icono: '🫧' },
  { clave: 'rayo', nombre: 'Rayo', icono: '⚡' },
  { clave: 'rueda', nombre: 'Rueda', icono: '⚙️' },
  { clave: 'hueso', nombre: 'Hueso', icono: '🦴' },
];

export const PREMIOS_CATALOGO: readonly OpcionCatalogo<FormaPremio>[] = [
  { clave: 'estrella', nombre: 'Estrella', icono: '⭐' },
  { clave: 'moneda', nombre: 'Moneda', icono: '🪙' },
  { clave: 'gema', nombre: 'Gema', icono: '💎' },
  { clave: 'corazon', nombre: 'Corazon', icono: '❤️' },
  { clave: 'flor', nombre: 'Flor', icono: '🌸' },
  { clave: 'llave', nombre: 'Llave', icono: '🔑' },
];

export const VELOCIDADES_CATALOGO: readonly OpcionCatalogo<Velocidad>[] = [
  { clave: 'lenta', nombre: 'Lenta' },
  { clave: 'normal', nombre: 'Normal' },
  { clave: 'rapida', nombre: 'Rapida' },
];

export const FRECUENCIAS_CATALOGO: readonly OpcionCatalogo<Frecuencia>[] = [
  { clave: 'baja', nombre: 'Pocos', pista: 'Aparece uno de vez en cuando' },
  { clave: 'media', nombre: 'Normal', pista: 'Aparece cada poco' },
  { clave: 'alta', nombre: 'Muchos', pista: 'Aparecen sin parar' },
];

export const TAMANOS_CATALOGO: readonly OpcionCatalogo<Tamano>[] = [
  { clave: 'pequeno', nombre: 'Pequeno' },
  { clave: 'mediano', nombre: 'Mediano' },
  { clave: 'grande', nombre: 'Grande' },
];

export const MOVIMIENTOS_CATALOGO: readonly OpcionCatalogo<Movimiento>[] = [
  { clave: 'recto', nombre: 'Derecho', pista: 'Viene en linea recta' },
  { clave: 'zigzag', nombre: 'Zigzag', pista: 'Va de arriba a abajo mientras viene' },
  { clave: 'cae', nombre: 'Cayendo', pista: 'Cae desde arriba' },
  { clave: 'flota', nombre: 'Flotando', pista: 'Sube y baja despacio' },
];

export const CONTROLES_CATALOGO: readonly OpcionCatalogo<Control>[] = [
  { clave: 'teclado', nombre: 'Con las flechas', icono: '⌨️', pista: 'Se mueve con las flechas del teclado' },
  { clave: 'raton', nombre: 'Con el raton', icono: '🖱️', pista: 'Sigue al raton o al dedo' },
];

export const METAS_CATALOGO: readonly OpcionCatalogo<Meta>[] = [
  { clave: 'puntos', nombre: 'Llegar a X puntos', icono: '🎯' },
  { clave: 'tiempo', nombre: 'Aguantar X segundos', icono: '⏱️' },
  { clave: 'sobrevivir', nombre: 'Sobrevivir sin fin', icono: '♾️' },
];

/** «Cuando …» */
export const EVENTOS_CATALOGO: readonly OpcionCatalogo<Evento>[] = [
  { clave: 'tocaPremio', nombre: 'toco un premio', icono: '⭐' },
  { clave: 'tocaObstaculo', nombre: 'choco con un obstaculo', icono: '💥' },
  { clave: 'disparaObstaculo', nombre: 'le doy a un obstaculo', icono: '🎯' },
  { clave: 'puntosLleganA', nombre: 'llego a tantos puntos', icono: '🔢' },
  { clave: 'pierdeTodasLasVidas', nombre: 'me quedo sin vidas', icono: '💔' },
  { clave: 'seAcabaElTiempo', nombre: 'se acaba el tiempo', icono: '⏰' },
  { clave: 'empiezaElJuego', nombre: 'empieza el juego', icono: '🎬' },
];

/** «… entonces …» */
export const ACCIONES_CATALOGO: readonly OpcionCatalogo<AccionJuego>[] = [
  { clave: 'sumarPuntos', nombre: 'sumo puntos', icono: '➕' },
  { clave: 'restarPuntos', nombre: 'resto puntos', icono: '➖' },
  { clave: 'quitarVida', nombre: 'pierdo una vida', icono: '💔' },
  { clave: 'darVida', nombre: 'gano una vida', icono: '💗' },
  { clave: 'acelerar', nombre: 'todo va mas rapido', icono: '💨' },
  { clave: 'frenar', nombre: 'todo va mas despacio', icono: '🐢' },
  { clave: 'sonar', nombre: 'suena un sonido', icono: '🔊' },
  { clave: 'ganar', nombre: 'gano el juego', icono: '🏆' },
  { clave: 'perder', nombre: 'pierdo el juego', icono: '🙈' },
];

/** Música de cada escenario. Son las que ya se grabaron para los 30 mundos. */
export const MUSICA_POR_ESCENARIO: Record<Escenario, string> = {
  espacio: 'espacio-pastel',
  bosque: 'bosque-arcoiris',
  oceano: 'red-submarina',
  ciudad: 'ciudad-ciber',
  nieve: 'bioma-congelado',
  volcan: 'archipielago-volcanico',
  desierto: 'desierto-algoritmos',
  castillo: 'castillo-nubes',
  laboratorio: 'laboratorio',
  dulces: 'oasis-dulce',
};

/**
 * Frases del constructor, para narrar.
 *
 * Toda la voz del proyecto es MP3 grabado con ElevenLabs; estas claves son las
 * que el generador de locuciones convierte en archivos.
 */
export const FRASES_CONSTRUCTOR: readonly { slug: string; texto: string }[] = [
  {
    slug: 'constructor-bienvenida',
    texto:
      'Bienvenido al constructor de juegos. Aqui tu haces el juego y los demas lo juegan. Empieza eligiendo tu escenario.',
  },
  {
    slug: 'constructor-probar',
    texto: 'Pulsa probar para jugar tu juego. Tienes que ganarlo antes de publicarlo.',
  },
  {
    slug: 'constructor-ganado',
    texto: 'Ganaste tu propio juego. Ya lo puedes publicar para que lo jueguen los demas.',
  },
  {
    slug: 'constructor-publicado',
    texto:
      'Tu juego ya esta publicado. Te ganaste el diploma de constructor de juegos de Codexia. Felicidades.',
  },
  {
    slug: 'constructor-aviso',
    texto: 'Revisa tu juego: hay algo que conviene arreglar antes de publicarlo.',
  },
];
