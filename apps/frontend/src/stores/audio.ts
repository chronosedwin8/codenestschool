/**
 * Motor de audio.
 *
 * Para un niño que no lee, el audio no es un adorno: es la interfaz. De ahí
 * tres decisiones:
 *
 *  1. Tres canales separados. La voz es única (una instrucción interrumpe a la
 *     anterior, nunca se solapan dos), los efectos son polifónicos y la música
 *     va en bucle de fondo con volumen bajo.
 *  2. Respaldo automático. Si falta el MP3 de ElevenLabs, se sintetiza con la
 *     voz del navegador. Es peor, pero la actividad sigue siendo jugable.
 *  3. Desbloqueo por gesto. Los navegadores no dejan sonar nada hasta que el
 *     usuario toca la pantalla; hasta entonces la voz queda en espera y se
 *     reproduce en cuanto haya permiso.
 */
import { Howl, Howler } from 'howler';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { AUDIO_BASE_PATH, POOL_CELEBRACIONES } from '@codenest/shared';

/** Entrada del manifest generado por scripts/generate-voiceover.ts. */
interface EntradaManifest {
  readonly clave: string;
  readonly archivo: string;
  readonly duracionMs?: number;
}

interface Manifest {
  readonly entradas: Record<string, EntradaManifest>;
}

type Canal = 'voz' | 'sfx' | 'musica';

const VOLUMEN: Record<Canal, number> = { voz: 1, sfx: 0.55, musica: 0.22 };

/** Resuelve la ruta de un archivo respetando la base del despliegue. */
function rutaDe(clave: string, carpeta = ''): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefijo = base.endsWith('/') ? base : `${base}/`;
  const ruta = `${AUDIO_BASE_PATH}${carpeta}/${clave}.mp3`.replace(/^\/+/, '');
  return `${prefijo}${ruta}`;
}

export const useAudioStore = defineStore('audio', () => {
  const silenciado = ref(false);
  const desbloqueado = ref(false);
  const hablando = ref(false);
  /** Última clave narrada, para el botón "escuchar de nuevo". */
  const ultimaVoz = ref<{ clave: string; texto: string } | null>(null);
  const manifest = ref<Manifest | null>(null);

  // Caché de sonidos ya cargados: un efecto no se descarga dos veces.
  const cache = new Map<string, Howl>();
  let vozActual: Howl | null = null;
  let musicaActual: Howl | null = null;
  /** Narración pendiente mientras el navegador no da permiso. */
  let enEspera: { clave: string; texto: string } | null = null;

  const hayManifest = computed(() => manifest.value !== null);

  /** Comprueba si un clip existe según el manifest. */
  function existeClip(clave: string): boolean {
    // Sin manifest se intenta de todos modos: el respaldo cubre el fallo.
    if (!manifest.value) return true;
    return clave in manifest.value.entradas;
  }

  async function cargarManifest(): Promise<void> {
    if (manifest.value) return;
    try {
      const respuesta = await fetch(rutaDe('manifest').replace('.mp3', '.json'));
      if (respuesta.ok) manifest.value = (await respuesta.json()) as Manifest;
    } catch {
      // Sin manifest se sigue funcionando; solo se pierde la comprobación previa.
      manifest.value = { entradas: {} };
    }
  }

  /**
   * Habilita el audio tras el primer gesto del usuario y lanza lo que hubiera
   * quedado en espera.
   */
  function desbloquear(): void {
    if (desbloqueado.value) return;
    desbloqueado.value = true;
    Howler.mute(silenciado.value);
    if (enEspera) {
      const pendiente = enEspera;
      enEspera = null;
      void narrar(pendiente.clave, pendiente.texto);
    }
  }

  function obtener(clave: string, canal: Canal, carpeta = ''): Howl {
    const idCache = `${carpeta}/${clave}`;
    const existente = cache.get(idCache);
    if (existente) return existente;

    const sonido = new Howl({
      src: [rutaDe(clave, carpeta)],
      volume: VOLUMEN[canal],
      loop: canal === 'musica',
      html5: canal === 'musica', // la música se transmite, no se precarga entera
    });
    cache.set(idCache, sonido);
    return sonido;
  }

  /** Voz del navegador: peor calidad, pero mejor que el silencio. */
  function sintetizar(texto: string): void {
    if (silenciado.value || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const locucion = new SpeechSynthesisUtterance(texto);
    locucion.lang = 'es-CO';
    locucion.rate = 0.9; // más despacio: son niños
    locucion.pitch = 1.15; // algo más agudo, resulta más amable
    locucion.volume = 0.95;

    const voces = window.speechSynthesis.getVoices();
    const enEspanol =
      voces.find((v) => v.lang.startsWith('es') && /google|microsoft/i.test(v.name)) ??
      voces.find((v) => v.lang.startsWith('es'));
    if (enEspanol) locucion.voice = enEspanol;

    locucion.onstart = () => {
      hablando.value = true;
    };
    locucion.onend = () => {
      hablando.value = false;
    };

    window.speechSynthesis.speak(locucion);
  }

  /**
   * Narra una instrucción. `texto` es el respaldo si el MP3 no está disponible.
   * Siempre se pasan los dos: la app no debe quedarse muda nunca.
   */
  async function narrar(clave: string, texto: string): Promise<void> {
    ultimaVoz.value = { clave, texto };

    if (silenciado.value) return;
    if (!desbloqueado.value) {
      // Se guarda para lanzarla en cuanto el usuario toque la pantalla.
      enEspera = { clave, texto };
      return;
    }

    detenerVoz();

    if (!existeClip(clave)) {
      sintetizar(texto);
      return;
    }

    const sonido = obtener(clave, 'voz');
    hablando.value = true;

    sonido.once('end', () => {
      hablando.value = false;
    });
    // Si el archivo no carga, se recurre a la voz del navegador.
    sonido.once('loaderror', () => {
      hablando.value = false;
      sintetizar(texto);
    });
    sonido.once('playerror', () => {
      hablando.value = false;
      sintetizar(texto);
    });

    sonido.play();
    vozActual = sonido;
  }

  /** Repite la última narración: el botón del megáfono. */
  async function repetir(): Promise<void> {
    const ultima = ultimaVoz.value;
    if (!ultima) return;
    await narrar(ultima.clave, ultima.texto);
  }

  function detenerVoz(): void {
    vozActual?.stop();
    vozActual = null;
    window.speechSynthesis?.cancel();
    hablando.value = false;
  }

  /** Efecto de sonido. No interrumpe la narración. */
  function efecto(nombre: string): void {
    if (silenciado.value || !desbloqueado.value) return;
    obtener(nombre, 'sfx', '/sfx').play();
  }

  /** Celebración: elige un clip del grupo compartido para no repetir siempre. */
  async function celebrar(textoRespaldo = 'Muy bien, lo lograste'): Promise<void> {
    efecto('victoria');
    const n = 1 + Math.floor(Math.random() * POOL_CELEBRACIONES);
    await narrar(`celebration_${n}`, textoRespaldo);
  }

  /** Música de fondo del bioma, con transición suave entre mundos. */
  function musica(bioma: string): void {
    if (musicaActual) {
      musicaActual.fade(musicaActual.volume(), 0, 600);
      const anterior = musicaActual;
      setTimeout(() => anterior.stop(), 650);
    }
    if (silenciado.value || !desbloqueado.value) return;

    const nueva = obtener(bioma, 'musica', '/musica');
    nueva.volume(0);
    nueva.play();
    nueva.fade(0, VOLUMEN.musica, 900);
    musicaActual = nueva;
  }

  function detenerMusica(): void {
    musicaActual?.fade(musicaActual.volume(), 0, 400);
    const anterior = musicaActual;
    musicaActual = null;
    setTimeout(() => anterior?.stop(), 450);
  }

  function alternarSilencio(): boolean {
    silenciado.value = !silenciado.value;
    Howler.mute(silenciado.value);
    if (silenciado.value) {
      detenerVoz();
      detenerMusica();
    }
    try {
      localStorage.setItem('codenest.silenciado', String(silenciado.value));
    } catch {
      // Modo privado o almacenamiento bloqueado: la preferencia dura la sesión.
    }
    return silenciado.value;
  }

  /** Recupera la preferencia de silencio guardada. */
  function restaurarPreferencias(): void {
    try {
      silenciado.value = localStorage.getItem('codenest.silenciado') === 'true';
      Howler.mute(silenciado.value);
    } catch {
      silenciado.value = false;
    }
  }

  /** Precarga los clips de un mundo para que no haya esperas al jugar. */
  function precargar(claves: readonly string[]): void {
    for (const clave of claves) {
      if (existeClip(clave)) obtener(clave, 'voz');
    }
  }

  return {
    silenciado,
    desbloqueado,
    hablando,
    ultimaVoz,
    hayManifest,
    cargarManifest,
    desbloquear,
    narrar,
    repetir,
    detenerVoz,
    efecto,
    celebrar,
    musica,
    detenerMusica,
    alternarSilencio,
    restaurarPreferencias,
    precargar,
  };
});
