<script setup lang="ts">
/**
 * Una actividad jugable de principio a fin.
 *
 * Es la pantalla donde converge todo lo construido: el lienzo isométrico, la
 * barra de fichas, el sandbox, la voz y la puntuación del servidor.
 *
 * La secuencia está pensada para un niño que no lee:
 *  1. Al entrar se narra la instrucción sin que haya que pulsar nada.
 *  2. El botón verde de jugar es el único elemento que llama la atención.
 *  3. Si falla, el Fuzz choca de forma cómica y se le anima a probar otra vez.
 *     Nunca aparece un mensaje de error en rojo, ni la palabra "incorrecto".
 *  4. Si acierta, primero ve a su Fuzz llegar, y después las estrellas.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  ErrorSintaxisPython,
  transpilarPython,
  type ActivityConfigV3,
} from '@codenest/shared';
import {
  FUZZ_POR_MUNDO,
  HISTORIA_POR_MUNDO,
  TRANSICION_POR_MUNDO,
  retoDeActividad,
} from '@codenest/content';

import BotonEscuchar from '@/components/BotonEscuchar.vue';
import Cinematica from '@/components/Cinematica.vue';
import { claveRescate, claveTransicion, yaSeVio } from '@/composables/cinematicas';
import BotonJuguete from '@/components/BotonJuguete.vue';
import PanelEditor, { type ProgramaListo } from '@/components/PanelEditor.vue';
import PanelEstrellas from '@/components/PanelEstrellas.vue';
import { useEjecutor } from '@/composables/useEjecutor';
import { IsoRenderer } from '@/game/IsoRenderer';
import { api } from '@/api/cliente';
import { useAudioStore } from '@/stores/audio';

/** Lo que viene despues de esta actividad, tal y como lo manda el servidor. */
interface Siguiente {
  readonly id: number;
  readonly numeroEnMundo: number;
  readonly nombre: string;
  readonly mundo: { readonly numero: number; readonly nombre: string };
  readonly cambiaDeMundo: boolean;
}

interface Actividad {
  readonly id: number;
  readonly numeroGlobal: number;
  readonly nombre: string;
  readonly instruccionTexto: string;
  readonly exitoTexto: string;
  readonly siguiente: Siguiente | null;
  readonly config: ActivityConfigV3;
  readonly mundo: {
    readonly numero: number;
    readonly nombre: string;
    readonly bioma: string;
    readonly grupoEdad: 'exploradores' | 'creadores' | 'hackers';
    readonly editor: 'comandos' | 'bloques' | 'texto';
  };
  readonly audio: { readonly instruccion: string | null; readonly exito: string | null };
  readonly pistas: readonly { readonly orden: number; readonly texto: string }[];
}

const ruta = useRoute();
const router = useRouter();
const audio = useAudioStore();
const ejecutor = useEjecutor();

const actividad = shallowRef<Actividad | null>(null);
const cargando = ref(true);
const errorCarga = ref<string | null>(null);

const programa = ref<ProgramaListo>({ codigo: '', tamano: 0, estructuras: [], programa: null });
const sesionId = ref<number | null>(null);
const errorSintaxis = ref<{ linea: number; mensaje: string } | null>(null);

/**
 * Cinematicas pendientes de ver, en orden.
 *
 * Al terminar el ultimo nivel de un mundo pueden encadenarse dos: el rescate del
 * Fuzz, que cierra la historia de ese mundo, y el puente al mundo siguiente, que
 * la abre. Se guardan en cola porque tienen que verse una detras de otra y solo
 * al final se decide a donde va el niño.
 *
 * Se disparan al completar la ULTIMA actividad del mundo, nunca antes: si el
 * rescate apareciera a mitad, perderia todo su peso.
 */
interface CinematicaEnCola {
  readonly beats: readonly { escena: string; texto: string; audio: string; duracion: number }[];
  /** Con clave se recuerda y no se repite; sin ella se ve siempre. */
  readonly clave: string | null;
  readonly colorFuzz: string;
}

const colaCinematicas = ref<readonly CinematicaEnCola[]>([]);
const cinematicaActual = computed<CinematicaEnCola | null>(() => colaCinematicas.value[0] ?? null);

/** Cierto cuando la actividad recien resuelta era la ultima del mundo. */
const mundoTerminado = ref(false);
const panel = ref<InstanceType<typeof PanelEditor> | null>(null);
const estrellas = ref(0);
const completada = ref(false);
const monedasGanadas = ref(0);
const pistaVisible = ref<number | null>(null);

const lienzo = ref<HTMLElement | null>(null);

/** Comandos y estructuras que esta actividad ha desbloqueado. */
const disponibles = computed<readonly string[]>(() => {
  const config = actividad.value?.config;
  if (!config) return [];
  // Las fichas se sacan de los comandos; los bloques tienen su propia lista.
  return config.editor === 'comandos'
    ? config.comandosPermitidos
    : [...config.comandosPermitidos, ...config.bloquesDisponibles];
});

/** Lenguaje con el que se juega ahora mismo. */
const lenguaje = computed(() => actividad.value?.config.lenguajes[0] ?? 'javascript');

/**
 * El pique de Nube al cerrar la actividad.
 *
 * Va ligado al numero de la actividad y no al azar, para que el nivel que un
 * niño repite buscando la tercera estrella le diga siempre lo mismo.
 */
const reto = computed(() => (actividad.value ? retoDeActividad(actividad.value.numeroGlobal) : null));

/** Codigo de partida que ve el Hacker al abrir la actividad. */
const codigoInicial = computed(
  () => actividad.value?.config.codigoInicial?.[lenguaje.value] ?? '',
);

/** Piezas con las que arranca la actividad: el mundo 19 entrega un programa roto. */
const bloquesIniciales = computed(
  () => (actividad.value?.config.bloquesIniciales as Record<string, unknown> | undefined) ?? null,
);

/** Huecos de la barra: alguno más de los que exige la solución óptima. */
const capacidad = computed(() => {
  const maximo = actividad.value?.config.criteriosEstrella['3'].maxFichas ?? 6;
  return Math.max(6, maximo + 4);
});

const puedeJugar = computed(
  () => programa.value.tamano > 0 && !ejecutor.ejecutando.value && !cargando.value,
);

async function cargar(): Promise<void> {
  cargando.value = true;
  errorCarga.value = null;

  // Se entra aqui tambien al encadenar con la actividad siguiente, sin salir de
  // la pantalla. Sin limpiar, la nueva nacería celebrada, con las estrellas de
  // la anterior y con el Phaser viejo todavia montado debajo del nuevo.
  completada.value = false;
  estrellas.value = 0;
  monedasGanadas.value = 0;
  pistaVisible.value = null;
  errorSintaxis.value = null;
  programa.value = { codigo: '', tamano: 0, estructuras: [], programa: null };
  colaCinematicas.value = [];
  mundoTerminado.value = false;
  ejecutor.destruir();

  try {
    const id = Number(ruta.params.id);
    actividad.value = await api.get<Actividad>(`/curriculo/actividades/${id}`);

    const sesion = await api.post<{ sesion: { id: number } }>('/sesiones', {
      actividadId: id,
      editor: actividad.value.config.editor,
      lenguaje: actividad.value.config.lenguajes[0] ?? 'javascript',
    });
    sesionId.value = sesion.sesion.id;

    await montarLienzo();

    // La instrucción se narra sola: el niño no tiene que buscar cómo oírla.
    void audio.narrar(
      actividad.value.config.audio.instruccion,
      actividad.value.instruccionTexto,
    );
    audio.musica(actividad.value.mundo.bioma);
  } catch (error) {
    errorCarga.value = error instanceof Error ? error.message : 'No se pudo cargar la actividad';
  } finally {
    cargando.value = false;
  }
}

async function montarLienzo(): Promise<void> {
  const act = actividad.value;
  if (!act || !lienzo.value) return;

  const renderizador = new IsoRenderer(lienzo.value);
  await renderizador.cargarNivel({
    grid: act.config.grid,
    spawn: act.config.spawn,
    items: act.config.items,
    bioma: act.mundo.bioma,
    colorFuzz: '#1FA2FF',
  });
  ejecutor.renderizador.value = renderizador;
}

function alCambiarPrograma(listo: ProgramaListo): void {
  programa.value = listo;
  // Al editar desaparece la marca del error anterior.
  errorSintaxis.value = null;
}

/**
 * Ejecuta el programa y envía el resultado al servidor.
 *
 * Si el niño escribió Python, se traduce a JavaScript antes de ejecutarlo: los
 * dos lenguajes acaban en el mismo sandbox y en el mismo verificador.
 */
async function jugar(): Promise<void> {
  const act = actividad.value;
  if (!act || !sesionId.value || !puedeJugar.value) return;

  const original = programa.value;
  let codigoEjecutable = original.codigo;

  if (lenguaje.value === 'python') {
    try {
      codigoEjecutable = transpilarPython(original.codigo).codigo;
    } catch (error) {
      // Un error de sintaxis se marca en su línea, no se ejecuta nada.
      if (error instanceof ErrorSintaxisPython) {
        errorSintaxis.value = { linea: error.linea, mensaje: error.message };
        void audio.narrar('ui_intentalo-otra-vez', error.message);
        return;
      }
      throw error;
    }
  }

  const tirada = await ejecutor.jugar(codigoEjecutable, lenguaje.value, act.config);

  // Se envía siempre, acierte o falle: los intentos fallidos son el dato más
  // valioso para el panel del docente.
  const resultado = await api.post<{
    estrellas: number;
    monedasGanadas: number;
    verificado: boolean;
  }>(`/sesiones/${sesionId.value}/envio`, {
    codigo: original.codigo,
    programa: original.programa,
    acciones: tirada.acciones,
    tamanoPrograma: original.tamano,
    tiempoSegundos: 0,
    estructurasUsadas: original.estructuras,
    pistasUsadas: pistaVisible.value === null ? 0 : pistaVisible.value + 1,
  });

  estrellas.value = resultado.estrellas;
  monedasGanadas.value = resultado.monedasGanadas;

  if (resultado.estrellas > 0) {
    completada.value = true;
    await ejecutor.celebrar(resultado.estrellas, act.exitoTexto);

    // Y justo detras del "muy bien", el pique de lo que viene. Es lo que hace
    // que el dedo vaya al boton verde en vez de a la flecha de volver.
    const pique = reto.value;
    if (pique) void audio.narrar(pique.clave, pique.texto);

    await comprobarFinDeMundo(act);
  }
}

/**
 * Si esta era la ultima actividad del mundo, se cierra el mundo y se abre el
 * siguiente.
 *
 * Se encolan hasta dos cinematicas: el rescate del Fuzz, que solo existe en los
 * diez primeros mundos y se ve una unica vez, y el puente al mundo que viene,
 * que existe en los treinta. El puente tambien se recuerda: la primera vez es
 * una invitacion y la quinta seria un peaje.
 */
async function comprobarFinDeMundo(act: Actividad): Promise<void> {
  // Se pregunta al servidor si ya estan todas: el cliente no lleva esa cuenta.
  const datos = await api.get<{ actividades: { completada: boolean }[] }>(
    `/curriculo/mundos/${act.mundo.numero}/actividades`,
  );
  const todas = datos.actividades.length > 0 && datos.actividades.every((a) => a.completada);
  if (!todas) return;

  mundoTerminado.value = true;

  const fuzz = FUZZ_POR_MUNDO.get(act.mundo.numero);
  const cola: CinematicaEnCola[] = [];

  const historia = HISTORIA_POR_MUNDO.get(act.mundo.numero);
  if (historia && fuzz && !yaSeVio(claveRescate(act.mundo.numero))) {
    cola.push({
      beats: historia.rescate,
      clave: claveRescate(act.mundo.numero),
      colorFuzz: fuzz.color,
    });
  }

  const transicion = TRANSICION_POR_MUNDO.get(act.mundo.numero);
  if (transicion && !yaSeVio(claveTransicion(act.mundo.numero))) {
    cola.push({
      beats: transicion.beats,
      clave: claveTransicion(act.mundo.numero),
      colorFuzz: fuzz?.color ?? '#29A9E0',
    });
  }

  colaCinematicas.value = cola;
}

/**
 * Va a la actividad siguiente sin pasar por el mapa.
 *
 * Encadenar es la diferencia entre un niño que juega una actividad y uno que
 * juega diez: volver al mapa es una salida, y a los cinco años cualquier salida
 * se toma. Si no hay siguiente, es que se acabaron las seiscientas.
 */
function irASiguiente(): void {
  const sig = actividad.value?.siguiente;
  if (!sig) {
    volverAlMapa();
    return;
  }
  void router.push(`/actividad/${sig.id}`);
}

/** Al acabar una cinematica se pasa a la siguiente; con la ultima, se avanza. */
function alTerminarCinematica(): void {
  colaCinematicas.value = colaCinematicas.value.slice(1);
  if (colaCinematicas.value.length === 0) irASiguiente();
}

function reintentar(): void {
  ejecutor.reiniciar();
  estrellas.value = 0;
  completada.value = false;
  errorSintaxis.value = null;
}

function mostrarPista(): void {
  const pistas = actividad.value?.pistas ?? [];
  if (pistas.length === 0) return;

  const siguiente = pistaVisible.value === null ? 0 : Math.min(pistaVisible.value + 1, pistas.length - 1);
  pistaVisible.value = siguiente;

  const pista = pistas[siguiente];
  if (pista) {
    void audio.narrar(
      actividad.value?.config.audio.pistas[siguiente] ?? 'ui_pista',
      pista.texto,
    );
  }
}

function volverAlMapa(): void {
  void router.push('/mapa');
}

onMounted(cargar);

// Al encadenar con la siguiente actividad solo cambia el parametro de la ruta:
// el componente no se vuelve a montar, asi que hay que recargar a mano.
watch(
  () => ruta.params.id,
  (id) => {
    if (id !== undefined) void cargar();
  },
);

onBeforeUnmount(() => {
  ejecutor.destruir();
  audio.detenerMusica();
});
</script>

<template>
  <main class="actividad">
    <!--
      El rescate del Fuzz y el puente al mundo siguiente: solo al terminar el
      mundo entero, y encadenados. Al acabar el ultimo, se entra ya en el mundo
      que viene, sin pasar por el mapa.
    -->
    <Cinematica
      v-if="cinematicaActual"
      :key="cinematicaActual.beats[0]?.audio ?? 'cine'"
      :beats="cinematicaActual.beats"
      :color-fuzz="cinematicaActual.colorFuzz"
      :rescatados="actividad ? actividad.mundo.numero : 1"
      :recordar-como="cinematicaActual.clave"
      @terminada="alTerminarCinematica"
    />

    <!-- Cabecera mínima: volver, oír otra vez, pedir pista -->
    <header class="actividad__cabecera">
      <BotonJuguete
        etiqueta="Volver al mapa"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="volverAlMapa"
      />
      <h1 class="actividad__titulo">{{ actividad?.nombre ?? 'Cargando' }}</h1>
      <div class="actividad__acciones">
        <BotonEscuchar />
        <BotonJuguete
          v-if="(actividad?.pistas.length ?? 0) > 0"
          etiqueta="Pedir una pista"
          icono="💡"
          tono="amarillo"
          solo-icono
          @pulsar="mostrarPista"
        />
      </div>
    </header>

    <p v-if="errorCarga" class="aviso">{{ errorCarga }}</p>

    <!-- Lienzo del juego -->
    <div ref="lienzo" class="actividad__lienzo" />

    <!-- Pista, si se ha pedido -->
    <Transition name="subir">
      <p v-if="pistaVisible !== null && actividad" class="pista">
        <span aria-hidden="true">💡</span>
        {{ actividad.pistas[pistaVisible]?.texto }}
      </p>
    </Transition>

    <!-- Programa: fichas, bloques o texto segun el grupo de edad -->
    <PanelEditor
      v-if="actividad"
      ref="panel"
      :key="actividad.id"
      :editor="actividad.config.editor"
      :grupo="actividad.config.grupo"
      :lenguaje="lenguaje"
      :disponibles="disponibles"
      :capacidad="capacidad"
      :codigo-inicial="codigoInicial"
      :bloques-iniciales="bloquesIniciales"
      :ejecutando="ejecutor.ejecutando.value"
      :paso-actual="ejecutor.pasoActual.value"
      :error-linea="errorSintaxis?.linea ?? ejecutor.ultimoError.value?.linea ?? null"
      :error-mensaje="errorSintaxis?.mensaje ?? ejecutor.ultimoError.value?.mensaje ?? null"
      @cambio="alCambiarPrograma"
    />

    <div class="actividad__controles">
      <BotonJuguete
        etiqueta="Jugar"
        icono="▶"
        tono="verde"
        tamano="lg"
        :destacado="puedeJugar"
        :deshabilitado="!puedeJugar"
        @pulsar="jugar"
      />
      <BotonJuguete
        etiqueta="Empezar de nuevo"
        icono="↺"
        tono="neutro"
        :deshabilitado="ejecutor.ejecutando.value"
        @pulsar="reintentar"
      />
    </div>

    <!-- Celebración -->
    <Transition name="aparecer">
      <div v-if="completada" class="celebracion" role="dialog" aria-live="polite">
        <div class="celebracion__panel">
          <PanelEstrellas :conseguidas="estrellas" :tamano="72" />
          <p class="celebracion__texto">{{ actividad?.exitoTexto }}</p>
          <p v-if="monedasGanadas > 0" class="celebracion__monedas">
            <span aria-hidden="true">🪙</span> {{ monedasGanadas }}
          </p>

          <!-- El pique de Nube: lo mismo que se acaba de oir, para quien lea. -->
          <p v-if="reto && !mundoTerminado" class="celebracion__reto">{{ reto.texto }}</p>

          <div class="celebracion__botones">
            <BotonJuguete
              v-if="estrellas < 3"
              etiqueta="Intentar las 3 estrellas"
              tono="amarillo"
              @pulsar="reintentar"
            />
            <!--
              El boton grande lleva SIEMPRE hacia delante, y dice a donde va. Al
              cambiar de mundo lo nombra: un destino con nombre tira mas que un
              "siguiente".
            -->
            <BotonJuguete
              v-if="actividad?.siguiente"
              :etiqueta="
                actividad.siguiente.cambiaDeMundo
                  ? `Ir a ${actividad.siguiente.mundo.nombre}`
                  : 'Siguiente reto'
              "
              icono="→"
              tono="verde"
              tamano="lg"
              @pulsar="irASiguiente"
            />
            <BotonJuguete
              v-else
              etiqueta="Volver al mapa"
              icono="🗺"
              tono="verde"
              tamano="lg"
              @pulsar="volverAlMapa"
            />
            <BotonJuguete
              v-if="actividad?.siguiente"
              etiqueta="Al mapa"
              tono="neutro"
              @pulsar="volverAlMapa"
            />
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.actividad {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  max-width: 900px;
  min-height: 100vh;
  margin: 0 auto;
  padding: var(--espacio-4);
}

.actividad__cabecera {
  display: flex;
  gap: var(--espacio-3);
  align-items: center;
  justify-content: space-between;
}

.actividad__titulo {
  flex: 1;
  margin: 0;
  font-size: var(--texto-xl);
  text-align: center;
}

.actividad__acciones {
  display: flex;
  gap: var(--espacio-2);
}

.actividad__lienzo {
  display: grid;
  place-items: center;
  min-height: 460px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.45);
  border-radius: var(--radio-xl);
  box-shadow: var(--sombra-panel);
}

.actividad__controles {
  display: flex;
  gap: var(--espacio-4);
  justify-content: center;
}

.pista {
  display: flex;
  gap: var(--espacio-3);
  align-items: center;
  margin: 0;
  padding: var(--espacio-4);
  font-size: var(--texto-base);
  background: rgb(255 217 61 / 0.35);
  border-left: 6px solid var(--amarillo);
  border-radius: var(--radio-md);
}

.aviso {
  padding: var(--espacio-4);
  background: rgb(239 68 68 / 0.12);
  border-radius: var(--radio-md);
}

/* La celebración cubre la pantalla: es el momento importante. */
.celebracion {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--espacio-4);
  background: rgb(30 41 59 / 0.55);
  backdrop-filter: blur(4px);
}

.celebracion__panel {
  display: grid;
  gap: var(--espacio-4);
  justify-items: center;
  max-width: 420px;
  padding: var(--espacio-6);
  text-align: center;
  background: var(--crema);
  border-radius: var(--radio-xl);
  box-shadow: var(--relieve-alto);
}

.celebracion__texto {
  margin: 0;
  font-size: var(--texto-lg);
}

.celebracion__monedas {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  color: var(--naranja-oscuro);
}

/* El pique va en segundo plano respecto al "lo lograste": complementa, no compite. */
.celebracion__reto {
  margin: 0;
  max-width: 34ch;
  font-size: var(--texto-lg);
  font-style: italic;
  line-height: 1.4;
  color: var(--tinta-suave, #5b6472);
}

.celebracion__botones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-3);
  justify-content: center;
}

.aparecer-enter-active {
  transition: opacity var(--normal) ease;
}
.aparecer-enter-from {
  opacity: 0;
}

.subir-enter-active {
  transition:
    opacity var(--normal) ease,
    transform var(--normal) var(--rebote);
}
.subir-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
</style>
