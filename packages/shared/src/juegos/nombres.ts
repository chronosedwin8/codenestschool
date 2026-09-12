/**
 * El título de un juego no se escribe: se sortea.
 *
 * Esto no es pereza, es la decisión que hace posible la zona de juegos
 * publicados. En el momento en que un menor escribe texto libre que otros
 * menores van a leer, hace falta moderación humana; sin ella, un campo de texto
 * en una plataforma de niños es un problema esperando a ocurrir. Sorteando el
 * nombre, **nada de lo que se publica es texto libre**, y el niño conserva lo que
 * de verdad le importa: que el nombre sea suyo y le haga gracia. Puede volver a
 * tirar los dados tantas veces como quiera.
 *
 * Kodable hace exactamente esto ("Cool Mega Mash", "Starry Galactic Trove").
 */

const ADJETIVOS = [
  'Veloz', 'Brillante', 'Valiente', 'Loco', 'Feliz', 'Gigante', 'Magico', 'Salvaje',
  'Cosmico', 'Chispeante', 'Travieso', 'Colosal', 'Alegre', 'Misterioso', 'Turbo',
  'Dorado', 'Electrico', 'Saltarin', 'Increible', 'Supremo',
] as const;

const SUJETOS = [
  'Cohete', 'Dragon', 'Robot', 'Pingüino', 'Tiburon', 'Cometa', 'Gato', 'Abeja',
  'Volcan', 'Laberinto', 'Planeta', 'Castillo', 'Tornado', 'Pulpo', 'Rayo',
  'Bosque', 'Oceano', 'Asteroide', 'Fantasma', 'Caramelo',
] as const;

const REMATES = [
  'Espacial', 'del Nido', 'de Cristal', 'Perdido', 'Veloz', 'de Estrellas',
  'Secreto', 'Volador', 'de Fuego', 'Congelado', 'Arcoiris', 'Legendario',
  'Submarino', 'Nocturno', 'Saltarin', 'de Chocolate',
] as const;

function alAzar<T>(lista: readonly T[]): T {
  return lista[Math.floor(Math.random() * lista.length)]!;
}

/** Un título nuevo, de tres palabras. */
export function sortearTitulo(): string {
  return `${alAzar(ADJETIVOS)} ${alAzar(SUJETOS)} ${alAzar(REMATES)}`;
}

/**
 * Comprueba que un título es uno de los que este sorteo puede producir.
 *
 * El servidor lo usa para no guardar nada que no venga de aquí. Sin esta
 * comprobación, el sorteo sería una sugerencia del navegador y no una garantía:
 * bastaría con cambiar el campo antes de enviarlo.
 */
export function tituloValido(titulo: string): boolean {
  const partes = titulo.trim().split(/\s+/);
  if (partes.length < 3) return false;

  const [adjetivo, sujeto, ...resto] = partes;
  const remate = resto.join(' ');

  return (
    (ADJETIVOS as readonly string[]).includes(adjetivo!) &&
    (SUJETOS as readonly string[]).includes(sujeto!) &&
    (REMATES as readonly string[]).includes(remate)
  );
}

/** Cuántos nombres distintos puede dar el sorteo. Útil para las pruebas. */
export const COMBINACIONES = ADJETIVOS.length * SUJETOS.length * REMATES.length;
