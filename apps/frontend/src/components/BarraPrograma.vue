<script setup lang="ts">
/**
 * La barra de programa: donde el niño construye su secuencia.
 *
 * Dos zonas. Arriba la paleta con las fichas disponibles en esta actividad;
 * abajo los huecos donde se colocan, de izquierda a derecha, en el orden en que
 * se ejecutarán. Los huecos son grandes (104 píxeles de alto) porque la
 * precisión de un dedo de cuatro años no da para más.
 *
 * Dos formas de colocar una ficha, porque a esa edad conviven las dos:
 *  - arrastrarla hasta el hueco,
 *  - tocarla, y va al primer hueco libre.
 */
import { computed, ref } from 'vue';

import FichaComando, { type ClaseFicha } from '@/components/FichaComando.vue';
import { useArrastreFicha } from '@/composables/useArrastreFicha';
import { useAudioStore } from '@/stores/audio';

export interface PasoPrograma {
  readonly id: string;
  readonly comando: ClaseFicha;
  readonly veces?: number;
  readonly color?: string;
}

const props = withDefaults(
  defineProps<{
    /** Fichas que esta actividad permite usar. */
    disponibles: readonly ClaseFicha[];
    /** Huecos de la barra. */
    capacidad?: number;
    /** Índice del paso que se está ejecutando, para resaltarlo. */
    ejecutando?: number | null;
    bloqueada?: boolean;
  }>(),
  { capacidad: 8, ejecutando: null, bloqueada: false },
);

const programa = defineModel<PasoPrograma[]>({ default: () => [] });

const audio = useAudioStore();
const { arrastrando, posicion, zonaActiva, registrarZona, comenzar } =
  useArrastreFicha<{ comando: ClaseFicha; veces?: number; color?: string }>();

const contador = ref(0);
function nuevoId(): string {
  contador.value += 1;
  return `p${contador.value}`;
}

const huecos = computed(() => Array.from({ length: props.capacidad }, (_, i) => i));
const lleno = computed(() => programa.value.length >= props.capacidad);

/** Inserta una ficha en la posición indicada (o al final). */
function insertar(
  ficha: { comando: ClaseFicha; veces?: number; color?: string },
  indice: number | null,
): void {
  if (lleno.value) {
    audio.efecto('choque');
    return;
  }
  const paso: PasoPrograma = { id: nuevoId(), ...ficha };
  const destino = indice === null ? programa.value.length : Math.min(indice, programa.value.length);
  programa.value = [
    ...programa.value.slice(0, destino),
    paso,
    ...programa.value.slice(destino),
  ];
  audio.efecto('ficha-colocada');
}

/** Arrastre desde la paleta. */
async function arrastrarDesdePaleta(evento: PointerEvent, comando: ClaseFicha): Promise<void> {
  if (props.bloqueada) return;
  audio.desbloquear();

  const resultado = await comenzar(evento, { datos: { comando }, origen: null });

  // Un toque sin desplazamiento también coloca la ficha: es lo que hace un niño.
  if (resultado.fueToque) {
    insertar({ comando }, null);
    return;
  }
  if (resultado.zona !== null) insertar({ comando }, resultado.zona);
}

/** Arrastre de una ficha ya colocada: reordena o la saca del programa. */
async function arrastrarColocada(evento: PointerEvent, indice: number): Promise<void> {
  if (props.bloqueada) return;
  const paso = programa.value[indice];
  if (!paso) return;

  const resultado = await comenzar(evento, {
    datos: { comando: paso.comando, veces: paso.veces, color: paso.color },
    origen: indice,
  });

  // Un toque quita la ficha: es el gesto que los niños descubren solos.
  if (resultado.fueToque) {
    quitar(indice);
    return;
  }

  if (resultado.zona === null) {
    // Soltada fuera de la barra: se saca del programa.
    quitar(indice);
    return;
  }

  // Reordenar: se quita de su sitio y se inserta en el nuevo.
  const sinElla = programa.value.filter((_, i) => i !== indice);
  const destino = Math.min(resultado.zona, sinElla.length);
  programa.value = [...sinElla.slice(0, destino), paso, ...sinElla.slice(destino)];
  audio.efecto('ficha-colocada');
}

function quitar(indice: number): void {
  if (props.bloqueada) return;
  programa.value = programa.value.filter((_, i) => i !== indice);
  audio.efecto('ficha-quitada');
}

function vaciar(): void {
  if (props.bloqueada) return;
  programa.value = [];
  audio.efecto('ficha-quitada');
}

defineExpose({ vaciar });
</script>

<template>
  <div class="barra">
    <!-- Paleta de fichas disponibles -->
    <div class="barra__paleta" role="group" aria-label="Fichas que puedes usar">
      <FichaComando
        v-for="comando in disponibles"
        :key="comando"
        :comando="comando"
        :tamano="84"
        @pointerdown="arrastrarDesdePaleta($event, comando)"
      />
    </div>

    <!-- Huecos del programa -->
    <div class="barra__programa">
      <div
        v-for="i in huecos"
        :key="i"
        :ref="(el) => registrarZona(i, el as HTMLElement | null)"
        class="hueco"
        :class="{
          'hueco--activo': zonaActiva === i,
          'hueco--ocupado': Boolean(programa[i]),
          'hueco--ejecutando': ejecutando === i,
        }"
      >
        <FichaComando
          v-if="programa[i]"
          :comando="programa[i]!.comando"
          :veces="programa[i]!.veces"
          :color="programa[i]!.color"
          :tamano="74"
          colocada
          :resaltada="ejecutando === i"
          @pointerdown="arrastrarColocada($event, i)"
        />
        <!-- El número de orden ayuda a entender que se ejecuta en secuencia. -->
        <span v-else class="hueco__orden" aria-hidden="true">{{ i + 1 }}</span>
      </div>

      <button
        v-if="programa.length > 0"
        type="button"
        class="barra__vaciar"
        aria-label="Quitar todas las fichas"
        @click="vaciar"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M 7 7 L 17 17 M 17 7 L 7 17"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <!-- Copia de la ficha que sigue al dedo -->
    <Teleport to="body">
      <FichaComando
        v-if="arrastrando"
        :comando="arrastrando.datos.comando"
        :veces="arrastrando.datos.veces"
        :color="arrastrando.datos.color"
        :tamano="88"
        fantasma
        :style="{ left: `${posicion.x}px`, top: `${posicion.y}px` }"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.barra {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}

.barra__paleta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-3);
  justify-content: center;
  padding: var(--espacio-4);

  background: rgb(255 255 255 / 0.55);
  border-radius: var(--radio-lg);
  box-shadow: var(--sombra-panel);
}

/* La barra del programa imita una bandeja de madera. */
.barra__programa {
  position: relative;
  display: flex;
  gap: var(--espacio-2);
  align-items: center;
  padding: var(--espacio-3) var(--espacio-4);
  overflow-x: auto;

  background: linear-gradient(180deg, #f6e7cf 0%, #e8d3b0 100%);
  border: 4px solid #c9a877;
  border-radius: var(--radio-xl);
  box-shadow: var(--relieve-hundido), 0 4px 12px rgb(0 0 0 / 0.12);
}

.hueco {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 88px;
  height: var(--dropzone-alto);

  background: rgb(255 255 255 / 0.4);
  border: 3px dashed #b8956a;
  border-radius: var(--radio-md);

  transition:
    background var(--rapido) ease,
    border-color var(--rapido) ease,
    transform var(--rapido) var(--rebote);
}

/* La zona bajo el dedo crece y se ilumina: el niño ve dónde va a caer. */
.hueco--activo {
  background: rgb(255 217 61 / 0.5);
  border-color: var(--amarillo-oscuro);
  border-style: solid;
  transform: scale(1.08);
}

.hueco--ocupado {
  background: transparent;
  border-style: solid;
  border-color: transparent;
}

.hueco--ejecutando {
  background: rgb(255 217 61 / 0.35);
}

.hueco__orden {
  font-family: var(--fuente-titulo);
  font-size: var(--texto-xl);
  color: #b8956a;
}

.barra__vaciar {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 56px;
  height: 56px;
  margin-left: var(--espacio-2);
  color: white;

  background: var(--rojo);
  border: none;
  border-bottom: 4px solid #c22;
  border-radius: var(--radio-total);
  box-shadow: var(--relieve);
}

.barra__vaciar svg {
  width: 26px;
  height: 26px;
}

.barra__vaciar:active {
  transform: translateY(4px);
  box-shadow: none;
}
</style>
