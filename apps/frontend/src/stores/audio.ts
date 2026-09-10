/**
 * Motor de audio.
 *
 * Para un niño que no lee, el audio no es un adorno: es la interfaz. De ahí
 * tres decisiones:
 *
 *  1. Tres canales separados. La voz es única (una instrucción interrumpe a la
 *     anterior, nunca se solapan dos), los efectos son polifónicos y la música
 *     va en bucle de fondo con volumen bajo.
 *  2. Solo voz grabada. Toda la narración es MP3 pre-renderizado con ElevenLabs,
 *     y no hay síntesis del navegador. La voz del navegador lee los signos, se
 *     equivoca con los nombres de los Fuzzes y cambia de un aparato a otro: para
 *     un niño que no lee, esa voz no es un respaldo, es otra experiencia. Se
 *     prefiere que falte un clip y se vea, a que suene mal y no se vea.
 *  3. Por eso, un clip que falta es un error de contenido, no una degradación.
 *     Se anota en `clipsQueFaltan` y se avisa por consola, y `validate-content`
 *     comprueba en cada compilación que el manifest cubre todas las claves que
 *     el currículo menciona. Ese es el sustituto del respaldo.
 *  4. Desbloqueo por gesto. Los navegadores no dejan sonar nada hasta que el
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
  /** Locuciones que se pidieron y no existen. Sin respaldo, son un error visible. */
  const clipsQueFaltan = ref<readonly string[]>([]);

  // Caché de sonidos ya cargados: un efecto no se descarga dos veces.
  const cache = new Map<string, Howl>();
  let vozActual: Howl | null = null;
  /** Bioma pedido antes de que el navegador diera permiso para sonar. */
  let musicaEnEspera: string | null = null;
  let musicaActual: Howl | null = null;
  /** Bioma que suena ahora, para no reiniciar la pista al cambiar de actividad. */
  let biomaActual: string | null = null;
  /** Narración pendiente mientras el navegador no da permiso. */
  let enEspera: { clave: string; texto: string } | null = null;

  const hayManifest = computed(() => manifest.value !== null);

  /** Comprueba si un clip existe según el manifest. */
  function existeClip(clave: string): boolean {
    // Sin manifest se intenta igual: si el archivo esta, suena, y si no, el
    // error de carga lo anota. Es mejor que dar por perdido un clip que existe.
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
    // La musica se pide al abrir la actividad, o sea antes de que el nino haya
    // tocado nada, asi que la primera vez siempre llega sin permiso. Si no se
    // guardara aqui, la primera actividad de cada sesion se jugaria en silencio
    // y la musica no aparecería hasta la segunda.
    if (musicaEnEspera) {
      const bioma = musicaEnEspera;
      musicaEnEspera = null;
      musica(bioma);
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

  /**
   * Anota un clip que no se pudo reproducir.
   *
   * No hay nada que hacer en tiempo de ejecución: sin voz grabada, esta pantalla
   * se queda sin narración. Lo que sí se puede es dejar constancia, para que el
   * hueco se arregle en el contenido y no se quede escondido.
   */
  function avisarFalta(clave: string, motivo: string): void {
    if (clipsQueFaltan.value.includes(clave)) return;
    clipsQueFaltan.value = [...clipsQueFaltan.value, clave];
    console.warn(`[audio] falta la locucion "${clave}" (${motivo}).`);
  }

  /**
   * Narra una instrucción con su clip grabado.
   *
   * `texto` no se sintetiza: se guarda porque el botón del megáfono repite la
   * última narración y porque las pantallas muestran ese mismo texto escrito.
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
      avisarFalta(clave, 'no esta en el manifest');
      return;
    }

    const sonido = obtener(clave, 'voz');
    hablando.value = true;

    sonido.once('end', () => {
      hablando.value = false;
    });
    sonido.once('loaderror', () => {
      hablando.value = false;
      avisarFalta(clave, 'el archivo no carga');
    });
    sonido.once('playerror', () => {
      hablando.value = false;
      avisarFalta(clave, 'el navegador no lo reproduce');
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
    hablando.value = false;
  }

  /** Efecto de sonido. No interrumpe la narración. */
  function efecto(nombre: string): void {
    if (silenciado.value || !desbloqueado.value) return;
    obtener(nombre, 'sfx', '/sfx').play();
  }

  /** Celebración: elige un clip del grupo compartido para no repetir siempre. */
  async function celebrar(texto = 'Muy bien, lo lograste'): Promise<void> {
    efecto('victoria');
    const n = 1 + Math.floor(Math.random() * POOL_CELEBRACIONES);
    await narrar(`celebration_${n}`, texto);
  }

  /** Música de fondo del bioma, con transición suave entre mundos. */
  function musica(bioma: string): void {
    // Si ya suena la de este bioma, se deja seguir. Las actividades se encadenan
    // una detrás de otra dentro del mismo mundo, y sin esto la música volvería a
    // empezar desde el principio cada minuto: se notaría mucho más que el propio
    // bucle, y delataría que has cambiado de pantalla justo cuando lo que se
    // busca es que no se note.
    if (musicaActual && biomaActual === bioma && musicaActual.playing()) return;

    if (musicaActual) {
      musicaActual.fade(musicaActual.volume(), 0, 600);
      const anterior = musicaActual;
      setTimeout(() => anterior.stop(), 650);
    }

    if (!desbloqueado.value) {
      // Se guarda para arrancarla en cuanto el navegador de permiso.
      musicaEnEspera = bioma;
      return;
    }
    if (silenciado.value) return;

    const nueva = obtener(bioma, 'musica', '/musica');
    nueva.volume(0);
    nueva.play();
    nueva.fade(0, VOLUMEN.musica, 900);
    musicaActual = nueva;
    biomaActual = bioma;
  }

  function detenerMusica(): void {
    musicaActual?.fade(musicaActual.volume(), 0, 400);
    const anterior = musicaActual;
    musicaActual = null;
    biomaActual = null;
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
    clipsQueFaltan,
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
