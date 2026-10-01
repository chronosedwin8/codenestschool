/**
 * Poner algo a pantalla completa, y saber cuando lo esta.
 *
 * Se pide sobre un elemento NUESTRO —el que envuelve al juego y a sus botones—
 * y no sobre el lienzo de Phaser. Con el lienzo solo, el marcador y el boton de
 * "jugar otra vez" se quedan fuera de la pantalla, y un nino que pierde en
 * pantalla completa no tiene forma de volver a empezar sin salir.
 *
 * Tres cosas que el navegador impone y que explican la forma de este archivo:
 *
 *  1. **Solo durante un gesto.** La peticion tiene que salir dentro del clic. Si
 *     hay un `await` por delante, el navegador ya no la concede, asi que aqui no
 *     se espera a nada antes de pedirla.
 *  2. **Se puede salir sin pulsar nada.** La tecla ESC sale de pantalla completa
 *     y no pasa por nuestro boton: el estado se lee del `fullscreenchange` del
 *     documento, nunca de lo que creemos haber pedido.
 *  3. **Safari lleva su propio nombre.** En iPad las funciones van con prefijo
 *     `webkit`; en iPhone no existen para elementos que no sean un video, y por
 *     eso `disponible` puede ser falso y el boton no se dibuja.
 *
 * En tableta se intenta ademas fijar el giro a horizontal: el juego es 16:9 y
 * en vertical se queda en una franja. Si el navegador no deja, no pasa nada.
 */
import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue';

/** Lo que anaden los Safari viejos, que no esta en los tipos estandar. */
interface ElementoConWebkit extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface DocumentoConWebkit extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface OrientacionBloqueable extends ScreenOrientation {
  lock?: (orientacion: string) => Promise<void>;
}

export interface PantallaCompleta {
  /** Si este navegador deja pantalla completa. Si no, el boton no se enseña. */
  readonly disponible: Readonly<Ref<boolean>>;
  readonly activa: Readonly<Ref<boolean>>;
  /** Entra o sale. Debe llamarse DENTRO del manejador del clic. */
  alternar: () => void;
}

export function usePantallaCompleta(
  elemento: Ref<HTMLElement | null>,
  /** Se llama al entrar y al salir: el juego tiene que recalcular su tamaño. */
  alCambiar?: (activa: boolean) => void,
): PantallaCompleta {
  const disponible = ref(false);
  const activa = ref(false);

  const documento = (): DocumentoConWebkit => document as DocumentoConWebkit;

  const elementoActual = (): Element | null =>
    documento().fullscreenElement ?? documento().webkitFullscreenElement ?? null;

  function sincronizar(): void {
    const antes = activa.value;
    activa.value = elementoActual() !== null;
    if (antes !== activa.value) alCambiar?.(activa.value);
  }

  function alternar(): void {
    const destino = elemento.value as ElementoConWebkit | null;
    if (!destino) return;

    if (elementoActual()) {
      const salir = documento().exitFullscreen ?? documento().webkitExitFullscreen;
      void Promise.resolve(salir?.call(document)).catch(() => undefined);
      // Se suelta el giro al salir: fuera del juego el telefono manda.
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Hay navegadores donde ni siquiera existe. No es un problema.
      }
      return;
    }

    const pedir = destino.requestFullscreen ?? destino.webkitRequestFullscreen;
    if (!pedir) return;
    // Sin `await`: la peticion sale dentro del gesto, que es la unica forma de
    // que el navegador la conceda.
    void Promise.resolve(pedir.call(destino))
      .then(() => {
        const orientacion = screen.orientation as OrientacionBloqueable | undefined;
        return orientacion?.lock?.('landscape')?.catch(() => undefined);
      })
      .catch(() => undefined);
  }

  onMounted(() => {
    disponible.value =
      Boolean(document.fullscreenEnabled) ||
      typeof (document.documentElement as ElementoConWebkit).webkitRequestFullscreen === 'function';
    document.addEventListener('fullscreenchange', sincronizar);
    document.addEventListener('webkitfullscreenchange', sincronizar);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', sincronizar);
    document.removeEventListener('webkitfullscreenchange', sincronizar);
    // Salir de la vista con la pantalla tomada dejaria el navegador en un estado
    // que el usuario no pidio.
    if (elementoActual()) {
      const salir = documento().exitFullscreen ?? documento().webkitExitFullscreen;
      void Promise.resolve(salir?.call(document)).catch(() => undefined);
    }
  });

  return { disponible: readonly(disponible), activa: readonly(activa), alternar };
}
