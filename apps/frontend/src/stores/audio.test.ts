/**
 * Pruebas del motor de audio.
 *
 * Lo que se protege aquí es la promesa de que la aplicación nunca se queda muda:
 * si el MP3 falta, tiene que hablar el navegador. Para un niño que no lee, un
 * clip ausente sin respaldo equivale a una actividad imposible de entender.
 *
 * Las pruebas cargan el manifest por la vía real (una petición de red simulada)
 * en lugar de manipular el estado interno del almacén, para que ejerciten el
 * mismo camino que la aplicación.
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Sonidos creados durante la prueba, para inspeccionarlos y disparar eventos. */
interface SonidoFalso {
  src: string[];
  reproducido: boolean;
  dispararError: () => void;
}

const sonidos: SonidoFalso[] = [];

vi.mock('howler', () => {
  class HowlFalso {
    private manejadores = new Map<string, (() => void)[]>();
    reproducido = false;
    src: string[];
    private vol: number;

    constructor(opciones: { src: string[]; volume: number }) {
      this.src = opciones.src;
      this.vol = opciones.volume;
      sonidos.push(this as unknown as SonidoFalso);
    }

    once(evento: string, manejador: () => void): void {
      const lista = this.manejadores.get(evento) ?? [];
      lista.push(manejador);
      this.manejadores.set(evento, lista);
    }

    play(): void {
      this.reproducido = true;
    }
    stop(): void {}
    volume(v?: number): number {
      if (v !== undefined) this.vol = v;
      return this.vol;
    }
    fade(): void {}

    /** Simula que el navegador no pudo cargar el archivo. */
    dispararError(): void {
      for (const m of this.manejadores.get('loaderror') ?? []) m();
    }
  }

  return { Howl: HowlFalso, Howler: { mute: vi.fn() } };
});

// Se importa después del simulacro para que el almacén reciba el doble.
const { useAudioStore } = await import('./audio');

let hablado: string[] = [];

/** Prepara un manifest simulado con las claves indicadas. */
function conManifest(claves: readonly string[]): void {
  const entradas = Object.fromEntries(
    claves.map((c) => [c, { clave: c, archivo: `${c}.mp3` }]),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ entradas }) } as Response),
    ),
  );
}

beforeEach(() => {
  setActivePinia(createPinia());
  sonidos.length = 0;
  hablado = [];

  vi.stubGlobal('speechSynthesis', {
    speak: (locucion: { text: string }) => hablado.push(locucion.text),
    cancel: vi.fn(),
    getVoices: () => [{ lang: 'es-CO', name: 'Google español' }],
  });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});

describe('desbloqueo por gesto del usuario', () => {
  it('no suena nada antes del primer toque', async () => {
    conManifest(['instruction_world1_lvl1']);
    const audio = useAudioStore();
    await audio.cargarManifest();

    await audio.narrar('instruction_world1_lvl1', 'Lleva al Fuzz a la estrella');

    expect(audio.desbloqueado).toBe(false);
    expect(sonidos).toHaveLength(0);
    expect(hablado).toHaveLength(0);
  });

  it('lanza la narración pendiente en cuanto llega el permiso', async () => {
    conManifest(['instruction_world1_lvl1']);
    const audio = useAudioStore();
    await audio.cargarManifest();

    await audio.narrar('instruction_world1_lvl1', 'Lleva al Fuzz a la estrella');
    audio.desbloquear();
    // El desbloqueo dispara la narración en espera de forma asíncrona.
    await new Promise((r) => setTimeout(r, 0));

    expect(audio.desbloqueado).toBe(true);
    expect(sonidos.at(-1)?.reproducido).toBe(true);
  });
});

describe('respaldo cuando falta el audio grabado', () => {
  it('usa la voz del navegador si el clip no está en el manifest', async () => {
    conManifest(['instruction_world1_lvl1']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    // Esta clave no está entre las generadas.
    await audio.narrar('instruction_world9_lvl4', 'Corrige el paso equivocado');

    expect(sonidos).toHaveLength(0);
    expect(hablado).toEqual(['Corrige el paso equivocado']);
  });

  it('usa la voz del navegador si el archivo falla al cargar', async () => {
    conManifest(['instruction_world1_lvl1']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    await audio.narrar('instruction_world1_lvl1', 'Texto de respaldo');

    const sonido = sonidos.at(-1);
    expect(sonido?.reproducido).toBe(true);
    expect(hablado).toHaveLength(0);

    // El archivo no está en el servidor pese a figurar en el manifest.
    sonido?.dispararError();

    expect(hablado).toEqual(['Texto de respaldo']);
  });

  it('reproduce el MP3 cuando sí existe, sin recurrir a la síntesis', async () => {
    conManifest(['ui_bienvenida']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    await audio.narrar('ui_bienvenida', 'Hola, soy Nube');

    expect(sonidos.at(-1)?.src[0]).toContain('ui_bienvenida.mp3');
    expect(hablado).toHaveLength(0);
  });
});

describe('memoria de la última narración', () => {
  it('permite repetir la instrucción con el botón del megáfono', async () => {
    conManifest([]);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    await audio.narrar('instruction_world2_lvl3', 'Si la casilla es roja, gira');
    expect(audio.ultimaVoz?.clave).toBe('instruction_world2_lvl3');

    hablado = [];
    await audio.repetir();

    expect(hablado).toEqual(['Si la casilla es roja, gira']);
  });

  it('recuerda la narración aunque esté silenciado, para poder repetirla luego', async () => {
    conManifest([]);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.alternarSilencio();

    await audio.narrar('ui_bienvenida', 'Hola, soy Nube');

    expect(audio.silenciado).toBe(true);
    expect(hablado).toHaveLength(0);
    expect(audio.ultimaVoz?.texto).toBe('Hola, soy Nube');
  });
});

describe('silencio', () => {
  it('no reproduce nada mientras está silenciado', async () => {
    conManifest(['ui_bienvenida']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();
    audio.alternarSilencio();

    await audio.narrar('ui_bienvenida', 'Hola, soy Nube');
    audio.efecto('boton');

    expect(sonidos).toHaveLength(0);
    expect(hablado).toHaveLength(0);
  });
});

describe('efectos de sonido', () => {
  it('busca los efectos en su propia carpeta', async () => {
    conManifest([]);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    audio.efecto('ficha-colocada');

    expect(sonidos.at(-1)?.src[0]).toContain('/sfx/ficha-colocada.mp3');
  });
});
