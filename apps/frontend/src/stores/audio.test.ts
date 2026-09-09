/**
 * Pruebas del motor de audio.
 *
 * Lo que se protege aquí es que toda la voz sea grabada. No hay síntesis del
 * navegador: la voz del navegador lee los signos, se equivoca con los nombres de
 * los Fuzzes y suena distinta en cada aparato, así que para un niño que no lee no
 * es un respaldo sino otra experiencia. Se prefiere que falte un clip y quede
 * anotado, a que suene mal y nadie se entere.
 *
 * Por eso estas pruebas comprueban dos cosas contrarias a la vez: que un clip
 * ausente no produce ningún sonido, y que sí deja constancia de que falta.
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
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('desbloqueo por gesto del usuario', () => {
  it('no suena nada antes del primer toque', async () => {
    conManifest(['instruction_world1_lvl1']);
    const audio = useAudioStore();
    await audio.cargarManifest();

    await audio.narrar('instruction_world1_lvl1', 'Lleva al Fuzz a la estrella');

    expect(audio.desbloqueado).toBe(false);
    expect(sonidos).toHaveLength(0);
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

describe('toda la voz es grabada', () => {
  it('no hay sintesis del navegador en el almacen', async () => {
    // Si alguien vuelve a meter speechSynthesis, esta prueba lo caza: el objeto
    // no existe en el entorno de prueba, asi que usarlo reventaria la narracion.
    conManifest([]);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    expect('speechSynthesis' in globalThis).toBe(false);
    await expect(audio.narrar('instruction_world9_lvl4', 'Corrige el paso')).resolves
      .toBeUndefined();
  });

  it('reproduce el MP3 cuando existe', async () => {
    conManifest(['ui_bienvenida']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    await audio.narrar('ui_bienvenida', 'Hola, soy Nube');

    expect(sonidos.at(-1)?.src[0]).toContain('ui_bienvenida.mp3');
    expect(sonidos.at(-1)?.reproducido).toBe(true);
  });
});

describe('un clip que falta es un error visible', () => {
  it('no inventa voz si la clave no esta en el manifest, y la anota', async () => {
    conManifest(['instruction_world1_lvl1']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    // Esta clave no está entre las generadas.
    await audio.narrar('instruction_world9_lvl4', 'Corrige el paso equivocado');

    expect(sonidos).toHaveLength(0);
    expect(audio.clipsQueFaltan).toEqual(['instruction_world9_lvl4']);
    expect(console.warn).toHaveBeenCalled();
  });

  it('anota tambien el clip que figura en el manifest y no carga', async () => {
    conManifest(['instruction_world1_lvl1']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    await audio.narrar('instruction_world1_lvl1', 'Lleva al Fuzz a la estrella');
    const sonido = sonidos.at(-1);
    expect(sonido?.reproducido).toBe(true);
    expect(audio.clipsQueFaltan).toEqual([]);

    // El archivo no está en el servidor pese a figurar en el manifest.
    sonido?.dispararError();

    expect(audio.clipsQueFaltan).toEqual(['instruction_world1_lvl1']);
    expect(audio.hablando).toBe(false);
  });

  it('no repite el aviso de la misma clave', async () => {
    conManifest(['ui_bienvenida']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    await audio.narrar('ui_falta', 'Texto');
    await audio.narrar('ui_falta', 'Texto');

    expect(audio.clipsQueFaltan).toEqual(['ui_falta']);
  });
});

describe('memoria de la última narración', () => {
  it('permite repetir la instrucción con el botón del megáfono', async () => {
    conManifest(['instruction_world2_lvl3']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.desbloquear();

    await audio.narrar('instruction_world2_lvl3', 'Si la casilla es roja, gira');
    expect(audio.ultimaVoz?.clave).toBe('instruction_world2_lvl3');

    // El clip ya cargado se reutiliza, asi que se vuelve a reproducir el mismo
    // sonido en lugar de crear otro: se comprueba sobre ese.
    const sonido = sonidos.at(-1)!;
    expect(sonido.src[0]).toContain('instruction_world2_lvl3.mp3');
    sonido.reproducido = false;

    await audio.repetir();

    expect(sonido.reproducido).toBe(true);
    expect(sonidos).toHaveLength(1);
  });

  it('recuerda la narración aunque esté silenciado, para poder repetirla luego', async () => {
    conManifest(['ui_bienvenida']);
    const audio = useAudioStore();
    await audio.cargarManifest();
    audio.alternarSilencio();

    await audio.narrar('ui_bienvenida', 'Hola, soy Nube');

    expect(audio.silenciado).toBe(true);
    expect(sonidos).toHaveLength(0);
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
