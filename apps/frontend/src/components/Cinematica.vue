<script setup lang="ts">
/**
 * Reproductor de cinemáticas.
 *
 * Encadena momentos: cada uno muestra una escena, narra una frase y avanza. La
 * duración de cada momento la marca la voz, no un temporizador fijo, porque una
 * frase larga con la voz cortada a la mitad rompe la ilusión por completo.
 *
 * Cuatro reglas que vienen de para quién es esto:
 *
 *  1. Se puede saltar siempre. Un niño que ya la vio no debe volver a verla
 *     entera para llegar a jugar, y un adulto revisando el material tampoco.
 *  2. Se ve una vez. Se recuerda en el dispositivo qué cinemáticas ya se vieron.
 *  3. El texto aparece escrito además de narrado. Los prelectores no lo leen,
 *     pero el niño de nueve sí, y en un aula con el sonido bajo es lo único que
 *     hay.
 *  4. Con movimiento reducido no hay animación, pero la historia se cuenta igual.
 *
 * Cuando exista un `.json` de Lottie para una escena, entra por aquí sin que
 * cambie nada más: el reproductor solo pide "dame la escena de este momento".
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import BotonJuguete from '@/components/BotonJuguete.vue';
import EscenaHistoria from '@/components/EscenaHistoria.vue';
import { marcarVista } from '@/composables/cinematicas';
import FondoEscena from '@/components/FondoEscena.vue';
import { useAudioStore } from '@/stores/audio';

export interface BeatCinematica {
  readonly escena: string;
  readonly texto: string;
  readonly audio: string;
  readonly duracion: number;
  readonly fondo?: string;
  readonly fondoRayo?: string;
}

const props = withDefaults(
  defineProps<{
    beats: readonly BeatCinematica[];
    colorFuzz?: string;
    rescatados?: number;
    /** Clave para recordar que ya se vio. Si no se pasa, se ve siempre. */
    recordarComo?: string | null;
  }>(),
  { colorFuzz: '#29A9E0', rescatados: 1, recordarComo: null },
);

const emit = defineEmits<{ terminada: [] }>();

const indice = ref(0);
const visible = ref(true);
/** Bloquea el botón de avanzar un instante, para que no se salte sin querer. */
const puedeAvanzar = ref(false);

const audio = useAudioStore();
let temporizador: ReturnType<typeof setTimeout> | null = null;
let desbloqueo: ReturnType<typeof setTimeout> | null = null;

const beat = computed(() => props.beats[indice.value]);
const esUltimo = computed(() => indice.value >= props.beats.length - 1);

/** Narra el momento actual y programa el paso al siguiente. */
function reproducirBeat(): void {
  const actual = beat.value;
  if (!actual) return;

  puedeAvanzar.value = false;
  // Un segundo de gracia: evita que un toque rápido salte dos momentos.
  desbloqueo = setTimeout(() => (puedeAvanzar.value = true), 700);

  void audio.narrar(actual.audio, actual.texto);

  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(avanzar, actual.duracion);
}

function avanzar(): void {
  if (temporizador) clearTimeout(temporizador);

  if (esUltimo.value) {
    terminar();
    return;
  }
  indice.value += 1;
}

function saltar(): void {
  terminar();
}

function terminar(): void {
  if (temporizador) clearTimeout(temporizador);
  if (desbloqueo) clearTimeout(desbloqueo);
  audio.detenerVoz();
  visible.value = false;

  if (props.recordarComo) marcarVista(props.recordarComo);
  emit('terminada');
}

watch(indice, reproducirBeat);

onMounted(() => {
  audio.desbloquear();
  reproducirBeat();
});

onBeforeUnmount(() => {
  if (temporizador) clearTimeout(temporizador);
  if (desbloqueo) clearTimeout(desbloqueo);
});
</script>

<template>
  <Transition name="cine">
    <div v-if="visible" class="cine" role="dialog" aria-live="polite">
      <FondoEscena :color="beat?.fondo" :color-rayo="beat?.fondoRayo" />

      <div class="cine__contenido">
        <!-- La escena cambia con una transición suave entre momentos. -->
        <Transition name="escena" mode="out-in">
          <EscenaHistoria
            :key="`${indice}-${beat?.escena}`"
            :escena="beat?.escena ?? ''"
            :color-fuzz="colorFuzz"
            :rescatados="rescatados"
            class="cine__escena"
          />
        </Transition>

        <!-- Cartel con lo que Nube está diciendo. -->
        <div class="cine__cartel">
          <Transition name="texto" mode="out-in">
            <p :key="indice" class="cine__texto">{{ beat?.texto }}</p>
          </Transition>
        </div>

        <!-- Puntos de progreso: se ve cuánto queda. -->
        <div class="cine__puntos" aria-hidden="true">
          <span
            v-for="(_, i) in beats"
            :key="i"
            class="punto"
            :class="{ 'punto--activo': i === indice, 'punto--visto': i < indice }"
          />
        </div>

        <div class="cine__acciones">
          <BotonJuguete
            :etiqueta="esUltimo ? 'Vamos alla' : 'Sigue'"
            :icono="esUltimo ? '▶' : '→'"
            tono="verde"
            tamano="lg"
            :deshabilitado="!puedeAvanzar"
            destacado
            @pulsar="avanzar"
          />
          <button type="button" class="cine__saltar" @click="saltar">Saltar</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cine {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.cine__contenido {
  position: relative;
  display: grid;
  gap: var(--espacio-4);
  justify-items: center;
  width: min(560px, 92vw);
  padding: var(--espacio-4);
}

.cine__escena {
  width: 100%;
  max-height: 42vh;
}

/* El cartel del texto: una pieza del estilo, con contorno grueso. */
.cine__cartel {
  width: 100%;
  padding: var(--espacio-4) var(--espacio-5);
  background: var(--pieza-blanco);
  border: 6px solid var(--contorno);
  border-bottom-width: 12px;
  border-radius: var(--radio-xl);
}

.cine__texto {
  margin: 0;
  font-family: var(--fuente-texto);
  font-size: var(--texto-lg);
  font-weight: 700;
  line-height: 1.45;
  color: var(--contorno);
  text-align: center;
}

.cine__puntos {
  display: flex;
  gap: var(--espacio-2);
}

.punto {
  width: 12px;
  height: 12px;
  background: rgb(255 255 255 / 0.35);
  border: 3px solid var(--contorno);
  border-radius: var(--radio-total);
  transition: background var(--normal) ease;
}

.punto--visto {
  background: rgb(255 255 255 / 0.7);
}

.punto--activo {
  background: var(--pieza-amarillo);
  transform: scale(1.25);
}

.cine__acciones {
  display: flex;
  gap: var(--espacio-4);
  align-items: center;
}

/* Saltar existe siempre, pero discreto: no compite con seguir viendo. */
.cine__saltar {
  padding: var(--espacio-2) var(--espacio-4);
  font-family: var(--fuente-texto);
  font-size: var(--texto-sm);
  font-weight: 700;
  color: white;
  background: rgb(0 0 0 / 0.22);
  border: 3px solid rgb(255 255 255 / 0.3);
  border-radius: var(--radio-total);
}

/* ── Transiciones ── */
.cine-leave-active {
  transition: opacity var(--lento) ease;
}
.cine-leave-to {
  opacity: 0;
}

.escena-enter-active,
.escena-leave-active {
  transition:
    opacity 260ms ease,
    transform 260ms var(--rebote);
}
.escena-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.escena-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.texto-enter-active,
.texto-leave-active {
  transition: opacity 200ms ease;
}
.texto-enter-from,
.texto-leave-to {
  opacity: 0;
}
</style>
