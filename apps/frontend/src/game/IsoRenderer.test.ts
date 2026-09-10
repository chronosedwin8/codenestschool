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

type ClaseEscena = typeof import('./IsoRenderer').IsoScene;

let IsoScene: ClaseEscena;

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
  ({ IsoScene } = await import('./IsoRenderer'));
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
