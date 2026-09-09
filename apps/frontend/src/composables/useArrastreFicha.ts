/**
 * Arrastrar y soltar para manos pequeñas.
 *
 * No se usa la API de arrastre de HTML5 por dos motivos: no funciona en pantallas
 * táctiles sin adaptadores, y no permite controlar la tolerancia del gesto. Un
 * niño de cuatro años no arrastra en línea recta ni suelta con precisión, así que
 * aquí se implementa con eventos de puntero y reglas más indulgentes:
 *
 *  - hay que desplazar 8 píxeles para que un toque cuente como arrastre, de modo
 *    que un dedo tembloroso siga pudiendo "tocar" una ficha,
 *  - la zona de soltado se detecta con un margen extra alrededor,
 *  - la ficha sigue al dedo con un ligero retraso, para que se vea qué se mueve,
 *  - si se suelta en cualquier sitio válido, la ficha entra; solo vuelve a su
 *    lugar si se suelta claramente fuera.
 */
import { onUnmounted, ref } from 'vue';

/** Margen extra alrededor de una zona de soltado, en píxeles. */
const TOLERANCIA_ZONA = 28;
/** Desplazamiento mínimo para considerar que hay arrastre y no un toque. */
const UMBRAL_ARRASTRE = 8;

export interface FichaArrastrada<T> {
  readonly datos: T;
  /** Índice de origen si la ficha ya estaba en el programa; null si viene de la paleta. */
  readonly origen: number | null;
}

export interface ZonaSoltado {
  readonly elemento: HTMLElement;
  readonly indice: number;
}

export function useArrastreFicha<T>() {
  const arrastrando = ref<FichaArrastrada<T> | null>(null);
  const posicion = ref({ x: 0, y: 0 });
  /** Zona sobre la que se soltaría ahora mismo; sirve para resaltarla. */
  const zonaActiva = ref<number | null>(null);

  const zonas = new Map<number, HTMLElement>();
  let inicio = { x: 0, y: 0 };
  let superoUmbral = false;
  let punteroId: number | null = null;

  /** Registra una zona de soltado; la llama cada hueco de la barra. */
  function registrarZona(indice: number, elemento: HTMLElement | null): void {
    if (elemento) zonas.set(indice, elemento);
    else zonas.delete(indice);
  }

  /** Zona bajo el puntero, con el margen de tolerancia aplicado. */
  function zonaEn(x: number, y: number): number | null {
    let mejor: { indice: number; distancia: number } | null = null;

    for (const [indice, elemento] of zonas) {
      const caja = elemento.getBoundingClientRect();
      const dentro =
        x >= caja.left - TOLERANCIA_ZONA &&
        x <= caja.right + TOLERANCIA_ZONA &&
        y >= caja.top - TOLERANCIA_ZONA &&
        y <= caja.bottom + TOLERANCIA_ZONA;

      if (!dentro) continue;

      // Si dos zonas se solapan por la tolerancia, gana la más cercana.
      const centroX = caja.left + caja.width / 2;
      const centroY = caja.top + caja.height / 2;
      const distancia = Math.hypot(x - centroX, y - centroY);
      if (!mejor || distancia < mejor.distancia) mejor = { indice, distancia };
    }

    return mejor?.indice ?? null;
  }

  function alMover(evento: PointerEvent): void {
    if (evento.pointerId !== punteroId) return;

    posicion.value = { x: evento.clientX, y: evento.clientY };

    if (!superoUmbral) {
      const recorrido = Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y);
      if (recorrido < UMBRAL_ARRASTRE) return;
      superoUmbral = true;
    }

    zonaActiva.value = zonaEn(evento.clientX, evento.clientY);
  }

  /** Empieza a arrastrar. Devuelve un promesa con el destino, o null si se canceló. */
  function comenzar(
    evento: PointerEvent,
    ficha: FichaArrastrada<T>,
  ): Promise<{ zona: number | null; fueToque: boolean }> {
    // Solo el botón principal o un dedo.
    if (evento.button !== 0) return Promise.resolve({ zona: null, fueToque: false });

    punteroId = evento.pointerId;
    inicio = { x: evento.clientX, y: evento.clientY };
    posicion.value = { ...inicio };
    superoUmbral = false;
    arrastrando.value = ficha;
    zonaActiva.value = null;

    return new Promise((resolver) => {
      const terminar = (fin: PointerEvent): void => {
        if (fin.pointerId !== punteroId) return;

        const zona = superoUmbral ? zonaEn(fin.clientX, fin.clientY) : null;
        const fueToque = !superoUmbral;

        window.removeEventListener('pointermove', alMover);
        window.removeEventListener('pointerup', terminar);
        window.removeEventListener('pointercancel', cancelar);

        arrastrando.value = null;
        zonaActiva.value = null;
        punteroId = null;

        resolver({ zona, fueToque });
      };

      const cancelar = (): void => {
        window.removeEventListener('pointermove', alMover);
        window.removeEventListener('pointerup', terminar);
        window.removeEventListener('pointercancel', cancelar);
        arrastrando.value = null;
        zonaActiva.value = null;
        punteroId = null;
        resolver({ zona: null, fueToque: false });
      };

      window.addEventListener('pointermove', alMover, { passive: true });
      window.addEventListener('pointerup', terminar);
      window.addEventListener('pointercancel', cancelar);
    });
  }

  onUnmounted(() => {
    window.removeEventListener('pointermove', alMover);
  });

  return { arrastrando, posicion, zonaActiva, registrarZona, comenzar };
}
