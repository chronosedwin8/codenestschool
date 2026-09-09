<script setup lang="ts">
/**
 * Botón con aspecto de pieza de plástico.
 *
 * El relieve no es decorativo: un niño que no lee reconoce que algo se puede
 * pulsar porque parece sobresalir. Al presionarlo, el botón baja de verdad (se
 * desplaza y pierde la sombra inferior), de modo que el gesto tiene respuesta
 * física inmediata, antes incluso de que ocurra nada en el juego.
 */
import { computed } from 'vue';

import { useAudioStore } from '@/stores/audio';

type Tono = 'verde' | 'azul' | 'magenta' | 'amarillo' | 'naranja' | 'morado' | 'neutro';
type Tamano = 'sm' | 'md' | 'lg' | 'xl';

const props = withDefaults(
  defineProps<{
    tono?: Tono;
    tamano?: Tamano;
    icono?: string;
    /** Texto accesible; obligatorio cuando el botón solo muestra un icono. */
    etiqueta: string;
    /** Oculta el texto y deja solo el icono (interfaz de prelectores). */
    soloIcono?: boolean;
    deshabilitado?: boolean;
    /** Llama la atención con un pulso, para guiar al niño. */
    destacado?: boolean;
  }>(),
  {
    tono: 'verde',
    tamano: 'md',
    icono: '',
    soloIcono: false,
    deshabilitado: false,
    destacado: false,
  },
);

const emit = defineEmits<{ pulsar: [] }>();
const audio = useAudioStore();

const clases = computed(() => [
  'boton',
  `boton--${props.tono}`,
  `boton--${props.tamano}`,
  { 'boton--icono': props.soloIcono, 'boton--destacado': props.destacado },
]);

function alPulsar(): void {
  if (props.deshabilitado) return;
  // El primer toque de la sesión es también el que habilita el audio.
  audio.desbloquear();
  audio.efecto('boton');
  emit('pulsar');
}
</script>

<template>
  <button
    type="button"
    :class="clases"
    :disabled="deshabilitado"
    :aria-label="soloIcono ? etiqueta : undefined"
    @click="alPulsar"
  >
    <span v-if="icono" class="boton__icono" aria-hidden="true">{{ icono }}</span>
    <span v-if="!soloIcono" class="boton__texto">{{ etiqueta }}</span>
  </button>
</template>

<style scoped>
.boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-2);

  min-width: var(--toque-min);
  min-height: var(--toque-min);
  padding: var(--espacio-3) var(--espacio-5);

  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
  color: white;
  text-shadow: 0 2px 3px rgb(0 0 0 / 0.25);

  background: var(--tono-claro);
  border: none;
  border-bottom: 4px solid var(--tono-oscuro);
  border-radius: var(--radio-lg);
  box-shadow: var(--relieve), var(--brillo-superior);

  transition:
    transform var(--rapido) ease,
    box-shadow var(--rapido) ease,
    filter var(--rapido) ease;
}

/* Al pulsar, la pieza se hunde: el canto inferior desaparece. */
.boton:active:not(:disabled) {
  transform: translateY(5px);
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.18), var(--relieve-hundido);
}

.boton:hover:not(:disabled) {
  filter: brightness(1.07);
}

.boton:disabled {
  filter: grayscale(0.7);
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  border-bottom-color: transparent;
}

/* ── Tonos ── */
.boton--verde {
  --tono-claro: var(--verde-cesped);
  --tono-oscuro: var(--verde-cesped-oscuro);
}
.boton--azul {
  --tono-claro: var(--azul-neon);
  --tono-oscuro: var(--azul-neon-oscuro);
}
.boton--magenta {
  --tono-claro: var(--magenta);
  --tono-oscuro: var(--magenta-oscuro);
}
.boton--amarillo {
  --tono-claro: var(--amarillo);
  --tono-oscuro: var(--amarillo-oscuro);
  color: var(--tinta);
  text-shadow: none;
}
.boton--naranja {
  --tono-claro: var(--naranja);
  --tono-oscuro: var(--naranja-oscuro);
}
.boton--morado {
  --tono-claro: var(--morado);
  --tono-oscuro: var(--morado-oscuro);
}
.boton--neutro {
  --tono-claro: var(--gris-medio);
  --tono-oscuro: var(--gris-oscuro);
}

/* ── Tamaños ── */
.boton--sm {
  min-width: 56px;
  min-height: 56px;
  padding: var(--espacio-2) var(--espacio-3);
  font-size: var(--texto-base);
}
.boton--lg {
  min-height: var(--toque-comodo);
  padding: var(--espacio-4) var(--espacio-6);
  font-size: var(--texto-xl);
}
.boton--xl {
  min-width: 120px;
  min-height: 120px;
  font-size: var(--texto-2xl);
  border-radius: var(--radio-xl);
}

/* Botón circular de un solo icono. */
.boton--icono {
  padding: 0;
  aspect-ratio: 1;
  border-radius: var(--radio-total);
}

.boton__icono {
  font-size: 1.5em;
  line-height: 1;
}

.boton--destacado {
  animation: pulso 1.4s ease-in-out infinite;
}
</style>
