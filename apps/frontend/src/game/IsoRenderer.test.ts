/**
 * Pruebas del arranque de la escena isométrica.
 *
 * Existen por un fallo que dejaba el juego entero sin tablero. Phaser arranca
 * por su cuenta la escena que se le declara en la configuración, y lo hace
 * durante el arranque del juego: la escena se creaba sin nivel, `create` moría
 * al leer la rejilla y la excepción tumbaba el arranque de Phaser antes de
 * llegar a `postBoot`. Como `postBoot` era quien resolvía la promesa de
 * `cargarNivel`, la actividad se quedaba cargando para siempre: tablero en
 * blanco, botón de jugar apagado y ni un error visible en la interfaz.
 *
 * Las dos cosas que hay que sostener son estas: la escena no se arranca sola, y
 * si alguien la arranca sin nivel no se lleva por delante al resto del juego.
 */
import { beforeAll, describe, expect, it } from 'vitest';

type Modulo = typeof import('./IsoRenderer');

let IsoScene: Modulo['IsoScene'];
let anguloDeDireccion: Modulo['anguloDeDireccion'];
let direccionEntre: Modulo['direccionEntre'];

beforeAll(async () => {
  // Phaser mide las capacidades del lienzo nada más importarse y jsdom no trae
  // contexto 2D. Se le da el mínimo que consulta: pintar un píxel, leerlo y
  // volver a escribirlo. No se dibuja nada de verdad en estas pruebas.
  const pixel = { data: new Uint8ClampedArray([10, 20, 30, 128]) };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      fillStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillRect: () => undefined,
      drawImage: () => undefined,
      getImageData: () => pixel,
      putImageData: () => undefined,
    }),
  });

  // La importación va aquí dentro a propósito: si fuese estática, Phaser se
  // evaluaría antes de que exista el sustituto.
  ({ IsoScene, anguloDeDireccion, direccionEntre } = await import('./IsoRenderer'));
});

describe('escena isometrica', () => {
  it('no se arranca sola: espera a que le den el nivel', () => {
    const escena = new IsoScene();

    expect(escena.sys.settings.active).toBe(false);
  });

  it('se anuncia con la clave que usa el renderizador', () => {
    const escena = new IsoScene();

    expect(escena.sys.settings.key).toBe('iso');
  });

  it('sin nivel no dibuja, pero tampoco lanza', () => {
    const escena = new IsoScene();
    escena.init({} as never);

    // La red de seguridad: un arranque sin datos deja el tablero vacio, que se
    // ve y se puede arreglar, en vez de romper el arranque de Phaser, que no.
    expect(() => escena.create()).not.toThrow();
  });
});

/**
 * Hacia donde mira el Fuzz.
 *
 * Estas pruebas existen por lo que conto un usuario probando el mundo 11: que
 * girar "no funcionaba ni con izquierda ni con derecha". El giro si ocurria en
 * el simulador, pero en pantalla no pasaba absolutamente nada, porque el Fuzz se
 * dibujaba siempre con la misma cara y el giro solo esperaba 140 milisegundos.
 * A partir del mundo 11 toda la mecanica es girar y avanzar, asi que sin ver la
 * direccion no hay forma de saber si hace falta un giro o tres.
 *
 * El angulo no se puede comprobar mirando una captura, y equivocarlo pondria al
 * Fuzz apuntando a cualquier parte con una animacion preciosa. Por eso se
 * comprueba contra la propia proyeccion, que es de donde sale.
 */
describe('hacia donde mira el Fuzz', () => {
  /** La misma proyeccion que dibuja el tablero: px = (x-y)*44, py = (x+y)*22. */
  const enPantalla = (dx: number, dy: number) => ({
    px: (dx - dy) * 44,
    py: (dx + dy) * 22,
  });

  const casos = [
    { dir: 'derecha', dx: 1, dy: 0 },
    { dir: 'izquierda', dx: -1, dy: 0 },
    { dir: 'abajo', dx: 0, dy: 1 },
    { dir: 'arriba', dx: 0, dy: -1 },
  ] as const;

  for (const { dir, dx, dy } of casos) {
    it(`"${dir}" apunta a la casilla de delante`, () => {
      const { px, py } = enPantalla(dx, dy);

      expect(anguloDeDireccion(dir)).toBeCloseTo(Math.atan2(py, px), 6);
    });
  }

  it('en isometrico "abajo" se dibuja hacia abajo y a la izquierda', () => {
    // Es la trampa de esta proyeccion y el motivo de que el angulo no se pueda
    // escribir a ojo: bajar en la rejilla no es bajar en la pantalla.
    const angulo = anguloDeDireccion('abajo');

    expect(Math.cos(angulo)).toBeLessThan(0);
    expect(Math.sin(angulo)).toBeGreaterThan(0);
  });

  it('las cuatro direcciones son distintas entre si', () => {
    const angulos = casos.map((c) => anguloDeDireccion(c.dir));

    expect(new Set(angulos).size).toBe(4);
  });

  it('girar dos veces deja mirando al lado contrario', () => {
    // Media vuelta son exactamente pi de diferencia, en las dos parejas.
    const media = Math.abs(anguloDeDireccion('derecha') - anguloDeDireccion('izquierda'));
    const otra = Math.abs(anguloDeDireccion('arriba') - anguloDeDireccion('abajo'));

    expect(media).toBeCloseTo(Math.PI, 6);
    expect(otra).toBeCloseTo(Math.PI, 6);
  });
});

describe('direccion de un desplazamiento', () => {
  it('deduce hacia donde se movio el Fuzz', () => {
    expect(direccionEntre({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe('derecha');
    expect(direccionEntre({ x: 2, y: 1 }, { x: 1, y: 1 })).toBe('izquierda');
    expect(direccionEntre({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe('abajo');
    expect(direccionEntre({ x: 1, y: 2 }, { x: 1, y: 1 })).toBe('arriba');
  });

  it('aguanta varias casillas de una vez, como el modo rodar', () => {
    expect(direccionEntre({ x: 1, y: 1 }, { x: 6, y: 1 })).toBe('derecha');
  });

  it('no inventa direccion si no hubo movimiento ni si fue en diagonal', () => {
    expect(direccionEntre({ x: 3, y: 3 }, { x: 3, y: 3 })).toBeNull();
    expect(direccionEntre({ x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
});
