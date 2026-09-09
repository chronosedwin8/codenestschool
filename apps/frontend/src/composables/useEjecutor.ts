/**
 * Orquesta una tirada completa: compilar, ejecutar, animar y puntuar.
 *
 * El orden importa y no es negociable:
 *   1. Las fichas (o los bloques, o el texto) se traducen a JavaScript.
 *   2. El worker lo ejecuta aislado y devuelve la lista de ACCIONES.
 *   3. El renderizador anima esas acciones, una a una.
 *   4. Se envían al servidor, que las reproduce y decide las estrellas.
 *
 * El paso 3 va antes del 4 a propósito: el niño ve lo que hizo su programa antes
 * de saber cuántas estrellas ganó. Si el orden fuera el inverso, la celebración
 * llegaría antes que la causa y se perdería la relación entre una cosa y la otra.
 */
import { ref, shallowRef } from 'vue';

import type {
  Accion,
  ActivityConfigV3,
  IRenderer,
  LenguajeCodigo,
  WorkerResponse,
} from '@codenest/shared';

import { useAudioStore } from '@/stores/audio';

/** Margen sobre el tiempo del worker, para no cortar una ejecución legítima. */
const TIEMPO_ESPERA_MS = 7000;

export interface ResultadoTirada {
  readonly ok: boolean;
  readonly acciones: readonly Accion[];
  readonly error?: WorkerResponse['error'];
}

export function useEjecutor() {
  const ejecutando = ref(false);
  /** Índice del paso que se está animando, para resaltar la ficha. */
  const pasoActual = ref<number | null>(null);
  const ultimoError = ref<WorkerResponse['error'] | null>(null);
  const renderizador = shallowRef<IRenderer | null>(null);

  const audio = useAudioStore();
  let worker: Worker | null = null;

  function crearWorker(): Worker {
    return new Worker(new URL('../workers/runner.worker.ts', import.meta.url), {
      type: 'module',
    });
  }

  /**
   * Ejecuta el código en el sandbox y devuelve las acciones.
   * Cada tirada usa un worker nuevo: así una ejecución anterior colgada no
   * contamina la siguiente, y terminarlo es la forma segura de cortar un bucle.
   */
  async function ejecutarEnSandbox(
    codigo: string,
    lenguaje: LenguajeCodigo,
    config: ActivityConfigV3,
  ): Promise<WorkerResponse> {
    worker?.terminate();
    worker = crearWorker();
    const actual = worker;

    return new Promise((resolver) => {
      const temporizador = setTimeout(() => {
        actual.terminate();
        resolver({
          ok: false,
          error: {
            mensaje: 'Tu programa tardo demasiado. Puede que se repita sin parar.',
            codigo: 'timeout',
          },
        });
      }, TIEMPO_ESPERA_MS);

      actual.onmessage = (evento: MessageEvent<WorkerResponse>) => {
        clearTimeout(temporizador);
        resolver(evento.data);
      };

      actual.onerror = () => {
        clearTimeout(temporizador);
        resolver({
          ok: false,
          error: { mensaje: 'Algo no salio bien al ejecutar tu programa.' },
        });
      };

      // Los objetos reactivos de Vue no se pueden clonar para el worker.
      actual.postMessage({
        codigo,
        lenguaje,
        apiPermitida: [...config.comandosPermitidos],
        topeEjecucion: config.topeEjecucion,
        modoMovimiento: config.modoMovimiento,
        grid: JSON.parse(JSON.stringify(config.grid)),
        spawn: { ...config.spawn },
        items: JSON.parse(JSON.stringify(config.items)),
      });
    });
  }

  /** Anima las acciones en el orden en que ocurrieron. */
  async function animar(acciones: readonly Accion[]): Promise<void> {
    const render = renderizador.value;
    if (!render) return;

    for (const [indice, accion] of acciones.entries()) {
      pasoActual.value = indice;

      // El sonido acompaña al movimiento, no lo precede.
      if (accion.cmd === 'saltar') audio.efecto('salto');
      else if (accion.cmd === 'recoger') audio.efecto('estrella');
      else audio.efecto('rodar');

      await render.reproducirAccion(accion);

      // Recoger un objeto suena aunque no haya ficha de recoger: en modo rodar
      // los objetos se recogen al pasar por encima.
      if (accion.celdasRecorridas && accion.celdasRecorridas.length > 1) {
        audio.efecto('estrella');
      }
    }

    pasoActual.value = null;
  }

  /** Tirada completa: sandbox, animación y aviso amable si algo falla. */
  async function jugar(
    codigo: string,
    lenguaje: LenguajeCodigo,
    config: ActivityConfigV3,
  ): Promise<ResultadoTirada> {
    if (ejecutando.value) {
      return { ok: false, acciones: [] };
    }

    ejecutando.value = true;
    ultimoError.value = null;
    renderizador.value?.reiniciar();

    try {
      const respuesta = await ejecutarEnSandbox(codigo, lenguaje, config);

      // Se anima siempre lo que sí llegó a ocurrir, incluso si luego falla:
      // el niño necesita ver dónde se torció su programa.
      const acciones = respuesta.ok ? (respuesta.acciones ?? []) : (respuesta.accionesParciales ?? []);
      await animar(acciones);

      if (!respuesta.ok) {
        ultimoError.value = respuesta.error ?? null;
        audio.efecto('choque');
        await renderizador.value?.animarChoque();
        // El mensaje de error también se narra: un prelector no puede leerlo.
        if (respuesta.error) {
          void audio.narrar('ui_intentalo-otra-vez', respuesta.error.mensaje);
        }
        return { ok: false, acciones, error: respuesta.error };
      }

      return { ok: true, acciones };
    } finally {
      ejecutando.value = false;
    }
  }

  /** Celebración tras conocer las estrellas que otorgó el servidor. */
  async function celebrar(estrellas: number, textoExito: string): Promise<void> {
    if (estrellas <= 0) return;
    await renderizador.value?.celebrar(estrellas);
    if (estrellas === 3) audio.efecto('tres-estrellas');
    void audio.celebrar(textoExito);
  }

  function reiniciar(): void {
    renderizador.value?.reiniciar();
    ultimoError.value = null;
    pasoActual.value = null;
  }

  function destruir(): void {
    worker?.terminate();
    worker = null;
    renderizador.value?.destruir();
    renderizador.value = null;
  }

  return {
    ejecutando,
    pasoActual,
    ultimoError,
    renderizador,
    jugar,
    celebrar,
    reiniciar,
    destruir,
  };
}
