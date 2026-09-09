/**
 * Frases fijas de interfaz y pool de celebraciones.
 *
 * Los prelectores no leen: cada boton, cada estado y cada felicitacion tienen
 * su clip. El pool de celebraciones evita generar 600 MP3 distintos que dicen
 * lo mismo: la actividad usa `celebration_N` salvo que su texto de exito sea
 * especifico de la leccion.
 */

export interface FraseUi {
  readonly slug: string;
  readonly texto: string;
}

/** Textos de interfaz. La clave final sera `ui_<slug>`. */
export const FRASES_UI: readonly FraseUi[] = [
  { slug: 'bienvenida', texto: 'Hola, soy Nube. Bienvenido a CodeNest. Vamos a jugar y a programar.' },
  { slug: 'elige-mundo', texto: 'Toca un mundo para empezar tu aventura.' },
  { slug: 'mundo-bloqueado', texto: 'Este mundo todavia esta cerrado. Termina el anterior para abrirlo.' },
  { slug: 'arrastra-ficha', texto: 'Arrastra las fichas de flechas a la barra de abajo.' },
  { slug: 'toca-jugar', texto: 'Cuando estes listo, toca el boton verde de jugar.' },
  { slug: 'escuchar-de-nuevo', texto: 'Toca el megafono para escuchar otra vez.' },
  { slug: 'intentalo-otra-vez', texto: 'Casi lo logras. Mira bien el camino e intentalo otra vez.' },
  { slug: 'choque', texto: 'Uy, el Fuzz choco. No pasa nada, prueba con otro camino.' },
  { slug: 'bucle-infinito', texto: 'Tu programa se repite para siempre. Prueba a contar cuantas veces necesitas repetir.' },
  { slug: 'muy-bien', texto: 'Muy bien. Lo lograste.' },
  { slug: 'tres-estrellas', texto: 'Increible. Ganaste las tres estrellas.' },
  { slug: 'nueva-ficha', texto: 'Mira, tienes una ficha nueva para usar.' },
  { slug: 'tienda', texto: 'Con tus monedas puedes vestir a tu Fuzz. Elige un sombrero o unas gafas.' },
  { slug: 'compra-hecha', texto: 'Listo. Tu Fuzz se ve genial.' },
  { slug: 'sin-monedas', texto: 'Todavia no tienes monedas suficientes. Juega otra actividad para ganar mas.' },
  { slug: 'pista', texto: 'Te doy una pista.' },
  { slug: 'mundo-completo', texto: 'Terminaste el mundo entero. Eres todo un programador.' },
  { slug: 'hasta-pronto', texto: 'Hasta pronto. Vuelve cuando quieras seguir jugando.' },
];

/** Celebraciones genericas reutilizadas por cientos de actividades. */
export const CELEBRACIONES: readonly string[] = [
  'Lo lograste. Ese es el camino correcto.',
  'Perfecto. Programaste como todo un experto.',
  'Genial. El Fuzz llego justo donde querias.',
  'Excelente trabajo. Cada paso estuvo en su lugar.',
  'Muy bien pensado. Asi se resuelve.',
  'Increible. Tu programa funciono a la primera.',
  'Fantastico. Ya dominas este reto.',
  'Bravo. El Fuzz esta muy contento contigo.',
  'Lo hiciste. Tu plan era el correcto.',
  'Buenisimo. Cada ficha en su sitio.',
  'Asi se hace. Tu Fuzz esta orgulloso.',
  'Estupendo. Resolviste el camino completo.',
  'Que bien. Lo tenias clarisimo.',
  'Sensacional. Ese si era el orden correcto.',
  'Lo conseguiste. A por el siguiente reto.',
];
