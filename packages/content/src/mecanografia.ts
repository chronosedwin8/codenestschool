/**
 * Mecanografía: el teclado español y las lecciones.
 *
 * El teclado es **español (Latinoamérica)** y no una traducción del inglés. Eso
 * no es un detalle de localización: cambia el contenido. La `ñ` está en el
 * meñique derecho, los acentos se escriben con una tecla muerta (`´` y después
 * la vocal), y existen `¿`, `¡` y `ü`. Un niño que aprende en un teclado inglés
 * y luego escribe "mañana" no encuentra la letra.
 *
 * De aquí salen dos cosas: el dibujo del teclado en pantalla y **qué dedo** toca
 * cada tecla. Las dos leen la misma tabla, así que no pueden discrepar.
 */

/** Los ocho dedos que escriben, más los pulgares. */
export const DEDOS = [
  'menique-izq',
  'anular-izq',
  'medio-izq',
  'indice-izq',
  'pulgar',
  'indice-der',
  'medio-der',
  'anular-der',
  'menique-der',
] as const;
export type Dedo = (typeof DEDOS)[number];

export interface DedoInfo {
  readonly clave: Dedo;
  readonly nombre: string;
  readonly mano: 'izquierda' | 'derecha' | 'ambas';
  /** Color con el que se pinta su zona del teclado. */
  readonly color: string;
}

/**
 * Un color por dedo.
 *
 * Los colores son los del resto del juego, y se reparten para que los dos
 * índices —los dedos que más se mueven y más se confunden— queden en tonos
 * claramente distintos.
 */
export const INFO_DEDOS: readonly DedoInfo[] = [
  { clave: 'menique-izq', nombre: 'menique izquierdo', mano: 'izquierda', color: '#7B61FF' },
  { clave: 'anular-izq', nombre: 'anular izquierdo', mano: 'izquierda', color: '#1FA2FF' },
  { clave: 'medio-izq', nombre: 'medio izquierdo', mano: 'izquierda', color: '#06B6D4' },
  { clave: 'indice-izq', nombre: 'indice izquierdo', mano: 'izquierda', color: '#5AD35A' },
  { clave: 'pulgar', nombre: 'pulgar', mano: 'ambas', color: '#94A3B8' },
  { clave: 'indice-der', nombre: 'indice derecho', mano: 'derecha', color: '#FFD93D' },
  { clave: 'medio-der', nombre: 'medio derecho', mano: 'derecha', color: '#FF8A3D' },
  { clave: 'anular-der', nombre: 'anular derecho', mano: 'derecha', color: '#FF3CAC' },
  { clave: 'menique-der', nombre: 'menique derecho', mano: 'derecha', color: '#EF4444' },
];

export interface Tecla {
  /** Lo que escribe sin mayúscula. Vacío en las teclas que no escriben. */
  readonly base: string;
  /** Lo que escribe con Mayús. */
  readonly alta?: string;
  /** Etiqueta a mostrar cuando no coincide con `base` (Mayús, Espacio...). */
  readonly etiqueta?: string;
  readonly dedo: Dedo;
  /** Ancho relativo: 1 es una tecla normal. */
  readonly ancho?: number;
  /** Tecla de reposo: la que lleva el relieve en un teclado de verdad. */
  readonly reposo?: boolean;
  /** Tecla muerta: espera la vocal siguiente para acentuarla. */
  readonly muerta?: boolean;
  /** Función especial en lugar de escribir. */
  readonly funcion?: 'mayus' | 'borrar' | 'entrar' | 'tab';
}

/**
 * El teclado español (Latinoamérica), fila por fila.
 *
 * Solo están las teclas que se usan para escribir texto: no hay teclas de
 * función ni flechas, porque en una lección de mecanografía sobran y en una
 * tableta cada tecla de más quita espacio a las que importan.
 */
export const TECLADO_ES: readonly (readonly Tecla[])[] = [
  [
    { base: '1', alta: '!', dedo: 'menique-izq' },
    { base: '2', alta: '"', dedo: 'anular-izq' },
    { base: '3', alta: '#', dedo: 'medio-izq' },
    { base: '4', alta: '$', dedo: 'indice-izq' },
    { base: '5', alta: '%', dedo: 'indice-izq' },
    { base: '6', alta: '&', dedo: 'indice-der' },
    { base: '7', alta: '/', dedo: 'indice-der' },
    { base: '8', alta: '(', dedo: 'medio-der' },
    { base: '9', alta: ')', dedo: 'anular-der' },
    { base: '0', alta: '=', dedo: 'menique-der' },
    { base: '?', alta: '¿', dedo: 'menique-der' },
    { base: '', etiqueta: '⌫', dedo: 'menique-der', ancho: 1.6, funcion: 'borrar' },
  ],
  [
    { base: '', etiqueta: 'tab', dedo: 'menique-izq', ancho: 1.4, funcion: 'tab' },
    { base: 'q', alta: 'Q', dedo: 'menique-izq' },
    { base: 'w', alta: 'W', dedo: 'anular-izq' },
    { base: 'e', alta: 'E', dedo: 'medio-izq' },
    { base: 'r', alta: 'R', dedo: 'indice-izq' },
    { base: 't', alta: 'T', dedo: 'indice-izq' },
    { base: 'y', alta: 'Y', dedo: 'indice-der' },
    { base: 'u', alta: 'U', dedo: 'indice-der' },
    { base: 'i', alta: 'I', dedo: 'medio-der' },
    { base: 'o', alta: 'O', dedo: 'anular-der' },
    { base: 'p', alta: 'P', dedo: 'menique-der' },
    { base: '´', alta: '¨', dedo: 'menique-der', muerta: true },
  ],
  [
    { base: '', etiqueta: 'bloq', dedo: 'menique-izq', ancho: 1.7 },
    { base: 'a', alta: 'A', dedo: 'menique-izq', reposo: true },
    { base: 's', alta: 'S', dedo: 'anular-izq', reposo: true },
    { base: 'd', alta: 'D', dedo: 'medio-izq', reposo: true },
    { base: 'f', alta: 'F', dedo: 'indice-izq', reposo: true },
    { base: 'g', alta: 'G', dedo: 'indice-izq' },
    { base: 'h', alta: 'H', dedo: 'indice-der' },
    { base: 'j', alta: 'J', dedo: 'indice-der', reposo: true },
    { base: 'k', alta: 'K', dedo: 'medio-der', reposo: true },
    { base: 'l', alta: 'L', dedo: 'anular-der', reposo: true },
    { base: 'ñ', alta: 'Ñ', dedo: 'menique-der', reposo: true },
    { base: '', etiqueta: '⏎', dedo: 'menique-der', ancho: 1.6, funcion: 'entrar' },
  ],
  [
    { base: '', etiqueta: 'Mayus', dedo: 'menique-izq', ancho: 2.2, funcion: 'mayus' },
    { base: 'z', alta: 'Z', dedo: 'menique-izq' },
    { base: 'x', alta: 'X', dedo: 'anular-izq' },
    { base: 'c', alta: 'C', dedo: 'medio-izq' },
    { base: 'v', alta: 'V', dedo: 'indice-izq' },
    { base: 'b', alta: 'B', dedo: 'indice-izq' },
    { base: 'n', alta: 'N', dedo: 'indice-der' },
    { base: 'm', alta: 'M', dedo: 'indice-der' },
    { base: ',', alta: ';', dedo: 'medio-der' },
    { base: '.', alta: ':', dedo: 'anular-der' },
    { base: '¡', alta: '¿', dedo: 'menique-der' },
    { base: '', etiqueta: 'Mayus', dedo: 'menique-der', ancho: 1.8, funcion: 'mayus' },
  ],
  [{ base: ' ', etiqueta: 'espacio', dedo: 'pulgar', ancho: 10 }],
];

/** Índice rápido de carácter -> tecla, para saber el dedo de cada letra. */
const INDICE = new Map<string, { tecla: Tecla; conMayus: boolean }>();
for (const fila of TECLADO_ES) {
  for (const tecla of fila) {
    if (tecla.base && !INDICE.has(tecla.base)) INDICE.set(tecla.base, { tecla, conMayus: false });
    if (tecla.alta && !INDICE.has(tecla.alta)) INDICE.set(tecla.alta, { tecla, conMayus: true });
  }
}

/** Las vocales acentuadas no tienen tecla: se escriben con `´` y la vocal. */
export const ACENTUADAS: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  Á: 'A',
  É: 'E',
  Í: 'I',
  Ó: 'O',
  Ú: 'U',
  ü: 'u',
  Ü: 'U',
};

export interface Pulsacion {
  /** La tecla que hay que pulsar. */
  readonly tecla: Tecla;
  readonly conMayus: boolean;
  /** Cierto si antes hay que pulsar la tecla muerta del acento. */
  readonly conAcento: boolean;
  readonly dedo: Dedo;
}

/**
 * Qué hay que pulsar para escribir un carácter.
 *
 * Devuelve null si el carácter no está en el teclado español, que es la forma de
 * detectar que una lección tiene un texto imposible de escribir.
 */
export function comoEscribir(caracter: string): Pulsacion | null {
  const acentuada = ACENTUADAS[caracter];
  if (acentuada) {
    const base = INDICE.get(acentuada);
    if (!base) return null;
    return {
      tecla: base.tecla,
      conMayus: base.conMayus,
      conAcento: true,
      dedo: base.tecla.dedo,
    };
  }

  const directa = INDICE.get(caracter);
  if (!directa) return null;
  return {
    tecla: directa.tecla,
    conMayus: directa.conMayus,
    conAcento: false,
    dedo: directa.tecla.dedo,
  };
}

export function dedoDe(caracter: string): DedoInfo | null {
  const pulsacion = comoEscribir(caracter);
  if (!pulsacion) return null;
  return INFO_DEDOS.find((d) => d.clave === pulsacion.dedo) ?? null;
}

// ───────────────────────────── Las lecciones ────────────────────────────────

export const ZONAS = ['playa', 'laguna', 'cima'] as const;
export type Zona = (typeof ZONAS)[number];

export interface InfoZona {
  readonly clave: Zona;
  readonly nombre: string;
  readonly grado: string;
  readonly descripcion: string;
  readonly icono: string;
  /** Color de la zona en el mapa. */
  readonly color: string;
}

export const INFO_ZONAS: readonly InfoZona[] = [
  {
    clave: 'playa',
    nombre: 'Playa de las Teclas',
    grado: '5.º',
    descripcion:
      'Aqui se aprende donde van los dedos. Fila de reposo, letras nuevas y la ñ, sin correr: primero bien, despues rapido.',
    icono: '🏖️',
    color: '#06B6D4',
  },
  {
    clave: 'laguna',
    nombre: 'Laguna de las Palabras',
    grado: '6.º',
    descripcion:
      'Palabras y frases de verdad, con mayusculas, acentos y puntuacion. Aqui aparecen la tilde y los signos de pregunta.',
    icono: '🌊',
    color: '#5AD35A',
  },
  {
    clave: 'cima',
    nombre: 'Cima de los Parrafos',
    grado: '7.º',
    descripcion:
      'Parrafos completos, numeros y simbolos. Se escribe sin mirar el teclado y se mide la velocidad de verdad.',
    icono: '🌋',
    color: '#FF8A3D',
  },
];

export interface Leccion {
  readonly clave: string;
  readonly zona: Zona;
  readonly orden: number;
  readonly nombre: string;
  /** Las teclas que esta lección estrena. */
  readonly teclasNuevas: readonly string[];
  /** Lo que hay que escribir. */
  readonly texto: string;
  /** Precisión mínima (porcentaje) para 1, 2 y 3 estrellas. */
  readonly precision: readonly [number, number, number];
  /** PPM mínimas para 1, 2 y 3 estrellas. */
  readonly ppm: readonly [number, number, number];
  /** Una línea de consejo, la que se lee antes de empezar. */
  readonly consejo: string;
}

/**
 * Veinticuatro lecciones.
 *
 * El orden no es alfabético ni por comodidad: se sigue el orden clásico de la
 * mecanografía —primero la fila de reposo con los ocho dedos en su sitio, luego
 * la de arriba, luego la de abajo— porque así cada letra nueva se practica
 * siempre con las que ya se saben, y nunca hay que mover la mano entera.
 *
 * Los mínimos de PPM crecen con el curso, y la precisión no baja de 90 % para la
 * tercera estrella en ninguna lección: escribir rápido con errores es el hábito
 * que después cuesta años quitar.
 */
export const LECCIONES: readonly Leccion[] = [
  // ── Playa de las Teclas (5.º): fila de reposo y letras ──
  {
    clave: 'playa-01',
    zona: 'playa',
    orden: 1,
    nombre: 'Los dedos en su casa',
    teclasNuevas: ['a', 's', 'd', 'f', 'j', 'k', 'l', 'ñ'],
    texto: 'asdf jklñ asdf jklñ fdsa ñlkj asdf jklñ',
    precision: [70, 85, 92],
    ppm: [5, 9, 14],
    consejo:
      'Pon los dedos sobre asdf y jklñ. Esas ocho teclas son la casa: los dedos siempre vuelven ahi.',
  },
  {
    clave: 'playa-02',
    zona: 'playa',
    orden: 2,
    nombre: 'Los indices se estiran',
    teclasNuevas: ['g', 'h'],
    texto: 'fg jh fgf jhj gf hj fgh jhg gafas hola haga',
    precision: [70, 85, 92],
    ppm: [6, 10, 15],
    consejo: 'La g y la h las alcanzan los indices sin mover los otros dedos.',
  },
  {
    clave: 'playa-03',
    zona: 'playa',
    orden: 3,
    nombre: 'Palabras de la casa',
    teclasNuevas: [],
    texto: 'sal las gafas falda hala salsa gala jaja dalas',
    precision: [75, 88, 93],
    ppm: [7, 12, 17],
    consejo: 'Sin mirar las manos. Si te pierdes, busca el relieve de la f y la j.',
  },
  {
    clave: 'playa-04',
    zona: 'playa',
    orden: 4,
    nombre: 'Arriba: e, i, r, u',
    teclasNuevas: ['e', 'i', 'r', 'u'],
    texto: 'de ki fr ju ded kik frf juj dire fruta juega idea',
    precision: [75, 88, 93],
    ppm: [7, 12, 18],
    consejo: 'Sube el dedo, escribe y vuelve a la casa. Un solo dedo se mueve cada vez.',
  },
  {
    clave: 'playa-05',
    zona: 'playa',
    orden: 5,
    nombre: 'Arriba: w, o, q, p',
    teclasNuevas: ['w', 'o', 'q', 'p'],
    texto: 'sw lo aq ñp swa lol quiso papel pesa quiere loro',
    precision: [75, 88, 93],
    ppm: [8, 13, 19],
    consejo: 'La q y la p son de los meniques. Cuestan al principio y luego salen solas.',
  },
  {
    clave: 'playa-06',
    zona: 'playa',
    orden: 6,
    nombre: 'Arriba: t, y',
    teclasNuevas: ['t', 'y'],
    texto: 'ft jy tft yjy taller yate tuyo total type estrella',
    precision: [78, 88, 93],
    ppm: [9, 14, 20],
    consejo: 'Otra vez los indices, que son los que mas trabajan.',
  },
  {
    clave: 'playa-07',
    zona: 'playa',
    orden: 7,
    nombre: 'Abajo: c, m, v, n',
    teclasNuevas: ['c', 'm', 'v', 'n'],
    texto: 'dc jm fv jn cdc mjm nube vaca camino niño nunca',
    precision: [78, 88, 93],
    ppm: [9, 14, 20],
    consejo: 'Baja el dedo sin sacar la mano de su sitio.',
  },
  {
    clave: 'playa-08',
    zona: 'playa',
    orden: 8,
    nombre: 'Abajo: x, z, b',
    teclasNuevas: ['x', 'z', 'b'],
    texto: 'sx az fb xsx zaz bfb zorro buzo caja examen brazo',
    precision: [78, 90, 94],
    ppm: [10, 15, 21],
    consejo: 'La z es del menique izquierdo. Es la letra que mas se olvida.',
  },
  {
    clave: 'playa-09',
    zona: 'playa',
    orden: 9,
    nombre: 'La ñ es nuestra',
    teclasNuevas: ['ñ'],
    texto: 'ñ ñoño niña añade mañana pequeño español montaña',
    precision: [80, 90, 94],
    ppm: [10, 15, 22],
    consejo: 'La ñ vive junto a la l, en el menique derecho. En otros teclados no existe.',
  },
  {
    clave: 'playa-10',
    zona: 'playa',
    orden: 10,
    nombre: 'Todo el abecedario',
    teclasNuevas: [],
    texto: 'el veloz murcielago hindu comia feliz cardillo y kiwi',
    precision: [80, 90, 94],
    ppm: [12, 18, 25],
    consejo: 'Esta frase lleva todas las letras. Si te sale, ya conoces el teclado.',
  },

  // ── Laguna de las Palabras (6.º): mayúsculas, acentos y puntuación ──
  {
    clave: 'laguna-01',
    zona: 'laguna',
    orden: 1,
    nombre: 'Mayusculas con Mayus',
    teclasNuevas: ['Mayus'],
    texto: 'Ana Barranquilla Colombia Daniel Elena Fernando',
    precision: [80, 90, 94],
    ppm: [12, 18, 25],
    consejo:
      'La mayuscula se hace con el menique de la mano CONTRARIA a la letra. Nunca con la misma mano.',
  },
  {
    clave: 'laguna-02',
    zona: 'laguna',
    orden: 2,
    nombre: 'El punto y la coma',
    teclasNuevas: [',', '.'],
    texto: 'Hoy es lunes. Manana, martes. Vamos a la playa, al mar y al rio.',
    precision: [82, 90, 94],
    ppm: [13, 19, 26],
    consejo: 'Despues de un punto va una mayuscula. Despues de una coma, un espacio.',
  },
  {
    clave: 'laguna-03',
    zona: 'laguna',
    orden: 3,
    nombre: 'La tilde: ´ y la vocal',
    teclasNuevas: ['´'],
    texto: 'mamá papá café música árbol rápido pájaro azúcar',
    precision: [82, 90, 94],
    ppm: [12, 18, 24],
    consejo:
      'Primero la tecla ´ (al lado de la p) y despues la vocal. La tecla sola no escribe nada: espera.',
  },
  {
    clave: 'laguna-04',
    zona: 'laguna',
    orden: 4,
    nombre: 'Palabras con tilde',
    teclasNuevas: [],
    texto: 'El pájaro cantó una canción y después voló hacia el jardín.',
    precision: [82, 92, 95],
    ppm: [14, 20, 27],
    consejo: 'La tilde no es un adorno: cambia la palabra. "Canto" y "cantó" no son lo mismo.',
  },
  {
    clave: 'laguna-05',
    zona: 'laguna',
    orden: 5,
    nombre: 'Preguntar en español',
    teclasNuevas: ['¿', '?'],
    texto: '¿Como estas? ¿Que hora es? ¿Donde vives? ¿Quien llego?',
    precision: [82, 92, 95],
    ppm: [13, 19, 26],
    consejo: 'En español la pregunta se abre y se cierra. El ¿ va con Mayus y la tecla del ?.',
  },
  {
    clave: 'laguna-06',
    zona: 'laguna',
    orden: 6,
    nombre: 'Exclamar en español',
    teclasNuevas: ['¡', '!'],
    texto: '¡Que alegria! ¡Vamos! ¡Cuidado con la ola! ¡Lo logramos!',
    precision: [82, 92, 95],
    ppm: [13, 19, 26],
    consejo: 'Igual que la pregunta: se abre con ¡ y se cierra con !.',
  },
  {
    clave: 'laguna-07',
    zona: 'laguna',
    orden: 7,
    nombre: 'Frases completas',
    teclasNuevas: [],
    texto:
      'Mi hermana pequeña juega en el patio. El niño come mango y bebe agua fría.',
    precision: [84, 92, 95],
    ppm: [16, 23, 30],
    consejo: 'Mira la pantalla, no las manos. Los dedos ya saben donde estan.',
  },
  {
    clave: 'laguna-08',
    zona: 'laguna',
    orden: 8,
    nombre: 'La diéresis: ü',
    teclasNuevas: ['ü'],
    texto: 'pingüino vergüenza cigüeña lingüista bilingüe agüita',
    precision: [84, 92, 95],
    ppm: [14, 20, 27],
    consejo: 'La ü se hace con Mayus y la tecla ´ (eso da ¨) y despues la u.',
  },
  {
    clave: 'laguna-09',
    zona: 'laguna',
    orden: 9,
    nombre: 'Escribir de corrido',
    teclasNuevas: [],
    texto:
      'Cuando el sol cae sobre el mar, la arena se pone tibia y el viento trae olor a sal.',
    precision: [85, 93, 96],
    ppm: [18, 25, 32],
    consejo: 'Ritmo constante. Mejor sin parones que muy rapido a saltos.',
  },
  {
    clave: 'laguna-10',
    zona: 'laguna',
    orden: 10,
    nombre: 'Prueba de la Laguna',
    teclasNuevas: [],
    texto:
      '¿Sabias que el pingüino no vuela? Nada rapidisimo, cuida a su cria y vive donde casi nadie más resiste.',
    precision: [85, 93, 96],
    ppm: [20, 27, 34],
    consejo: 'Todo lo de esta zona junto: mayusculas, tildes, dieresis y preguntas.',
  },

  // ── Cima de los Párrafos (7.º): números, símbolos y velocidad ──
  {
    clave: 'cima-01',
    zona: 'cima',
    orden: 1,
    nombre: 'Los numeros',
    teclasNuevas: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    texto: '1234 5678 90 12 de mayo de 2026 tengo 12 años y 3 hermanos',
    precision: [85, 92, 95],
    ppm: [16, 23, 30],
    consejo: 'Los numeros se alcanzan sin mirar, estirando el dedo que corresponde a su columna.',
  },
  {
    clave: 'cima-02',
    zona: 'cima',
    orden: 2,
    nombre: 'Simbolos que se usan',
    teclasNuevas: ['-', ':', ';', '/'],
    texto: 'correo: ana@colegio.edu.co 24/05/2026 nota: 9/10 lunes-viernes',
    precision: [85, 92, 95],
    ppm: [15, 22, 29],
    consejo: 'Estos son los simbolos de verdad: los de un correo, una fecha y una nota.',
  },
  {
    clave: 'cima-03',
    zona: 'cima',
    orden: 3,
    nombre: 'Un parrafo entero',
    teclasNuevas: [],
    texto:
      'El rio Magdalena nace en el sur y cruza el pais entero hasta el mar. Por el viajaron los primeros barcos de vapor, cargados de cafe y de historias.',
    precision: [86, 93, 96],
    ppm: [22, 30, 38],
    consejo: 'Un parrafo se escribe con ritmo. Respira en los puntos.',
  },
  {
    clave: 'cima-04',
    zona: 'cima',
    orden: 4,
    nombre: 'Copiar sin mirar',
    teclasNuevas: [],
    texto:
      'Escribir rapido no sirve de nada si hay que volver atras a corregir. La precision se entrena primero y la velocidad llega sola.',
    precision: [88, 94, 96],
    ppm: [24, 32, 40],
    consejo: 'Tapa las manos con una hoja si hace falta. En serio: funciona.',
  },
  {
    clave: 'cima-05',
    zona: 'cima',
    orden: 5,
    nombre: 'Codigo, como los grandes',
    teclasNuevas: ['(', ')', '=', '_'],
    texto: 'let puntos = 0; if (puntos > 10) { ganar(); } const nombre_del_juego = "ola";',
    precision: [86, 93, 96],
    ppm: [18, 26, 34],
    consejo: 'Esto es lo que escribiras en los mundos 21 al 30. Los parentesis van en pareja.',
  },
  {
    clave: 'cima-06',
    zona: 'cima',
    orden: 6,
    nombre: 'Prueba de la Cima',
    teclasNuevas: [],
    texto:
      'Aprender a escribir con los diez dedos es como aprender a montar en bicicleta: cuesta unos dias y despues no se olvida nunca. A partir de aqui, lo que escribas no depende de tus manos, sino de lo que tengas que decir.',
    precision: [88, 94, 97],
    ppm: [28, 36, 45],
    consejo: 'La ultima. Sin mirar el teclado y sin prisa: la velocidad ya la tienes.',
  },
];

/** Las lecciones de una zona, en orden. */
export function leccionesDe(zona: Zona): readonly Leccion[] {
  return LECCIONES.filter((l) => l.zona === zona).sort((a, b) => a.orden - b.orden);
}

export function leccionPorClave(clave: string): Leccion | null {
  return LECCIONES.find((l) => l.clave === clave) ?? null;
}

// ─────────────────────── Los minijuegos de práctica ────────────────────────

export const JUEGOS_PRACTICA = ['ola', 'pesca', 'carrera'] as const;
export type JuegoPractica = (typeof JUEGOS_PRACTICA)[number];

export interface InfoJuego {
  readonly clave: JuegoPractica;
  readonly nombre: string;
  readonly que: string;
  readonly entrena: string;
  readonly icono: string;
  /** Escenario del catálogo de juegos que se usa como fondo. */
  readonly escenario: string;
}

export const INFO_JUEGOS: readonly InfoJuego[] = [
  {
    clave: 'ola',
    nombre: 'La Ola',
    que: 'Escribe la palabra antes de que la ola te alcance.',
    entrena: 'Velocidad',
    icono: '🌊',
    escenario: 'oceano',
  },
  {
    clave: 'pesca',
    nombre: 'Pesca',
    que: 'Cada pez lleva una palabra. Escribela y lo pescas.',
    entrena: 'Palabras completas',
    icono: '🐠',
    escenario: 'oceano',
  },
  {
    clave: 'carrera',
    nombre: 'Carrera',
    que: 'Cada palabra que escribes te adelanta un puesto.',
    entrena: 'Resistencia',
    icono: '🏁',
    escenario: 'bosque',
  },
];

/**
 * Palabras para los minijuegos.
 *
 * Todas son palabras que un niño de diez años reconoce, y están escogidas para
 * que se repartan por todo el teclado: si solo hubiera palabras cortas de la
 * fila de reposo, el juego entrenaría cuatro dedos.
 */
export const PALABRAS_JUEGO: readonly string[] = [
  'sol', 'mar', 'ola', 'pez', 'red', 'sal', 'luz', 'paz', 'voz', 'pan',
  'casa', 'nube', 'lluvia', 'playa', 'arena', 'coco', 'palma', 'barco', 'viento', 'fuego',
  'niña', 'niño', 'mañana', 'sueño', 'pequeño', 'montaña', 'español', 'araña', 'puño', 'leña',
  'cafe', 'mango', 'guayaba', 'platano', 'sandia', 'limon', 'papaya', 'melon', 'uva', 'pera',
  'delfin', 'tortuga', 'cangrejo', 'pulpo', 'estrella', 'tiburon', 'ballena', 'gaviota', 'coral', 'concha',
  'jugar', 'correr', 'saltar', 'nadar', 'volar', 'cantar', 'bailar', 'pintar', 'leer', 'escribir',
  'teclado', 'pantalla', 'juego', 'puntos', 'nivel', 'premio', 'reto', 'equipo', 'amigo', 'clase',
];

// ───────────────────────────── Locuciones ──────────────────────────────────

export const FRASES_MECANOGRAFIA: readonly { slug: string; texto: string }[] = [
  {
    slug: 'teclado-bienvenida',
    texto:
      'Bienvenido a la Isla del Teclado. Aqui vas a aprender a escribir con los diez dedos, sin mirar. Empieza por la Playa de las Teclas.',
  },
  {
    slug: 'teclado-reposo',
    texto:
      'Pon los dedos sobre las teclas a, s, d, f y j, k, l, ñ. Esa es la fila de reposo: la casa de tus dedos.',
  },
  {
    slug: 'teclado-precision',
    texto:
      'Primero la precision y despues la velocidad. Escribir rapido con errores es un habito que cuesta anos quitar.',
  },
  {
    slug: 'teclado-tilde',
    texto:
      'Para la tilde, pulsa la tecla del acento y despues la vocal. La tecla sola no escribe nada: esta esperando.',
  },
  {
    slug: 'teclado-leccion-superada',
    texto: 'Muy bien. Lo lograste con buena precision. Sigue con la siguiente leccion.',
  },
  {
    slug: 'teclado-mas-despacio',
    texto: 'Vas rapido pero con muchos errores. Prueba mas despacio: la velocidad llega sola.',
  },
];
