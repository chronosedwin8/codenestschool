<script setup lang="ts">
/**
 * Las estrellas de una actividad.
 *
 * Aparecen de una en una, con retraso entre ellas: la espera es lo que hace que
 * ganar la tercera se sienta como un logro. Las que no se consiguen quedan
 * dibujadas en gris, para que el niño vea que hay algo más por conseguir y
 * quiera repetir.
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    conseguidas: number;
    total?: number;
    tamano?: number;
    animar?: boolean;
  }>(),
  { total: 3, tamano: 52, animar: true },
);

const estrellas = computed(() =>
  Array.from({ length: props.total }, (_, i) => ({
    llena: i < props.conseguidas,
    retraso: i * 220,
  })),
);
</script>

<template>
  <div
    class="estrellas"
    role="img"
    :aria-label="`${conseguidas} de ${total} estrellas`"
  >
    <svg
      v-for="(e, i) in estrellas"
      :key="i"
      viewBox="0 0 48 48"
      :width="tamano"
      :height="tamano"
      class="estrella"
      :class="{ 'estrella--llena': e.llena, 'estrella--animada': animar && e.llena }"
      :style="{ animationDelay: `${e.retraso}ms` }"
      aria-hidden="true"
    >
      <path
        d="M 24 4 L 30 18 L 45 20 L 34 30 L 37 45 L 24 38 L 11 45 L 14 30 L 3 20 L 18 18 Z"
      />
    </svg>
  </div>
</template>

<style scoped>
.estrellas {
  display: flex;
  gap: var(--espacio-2);
  justify-content: center;
}

.estrella path {
  fill: rgb(148 163 184 / 0.35);
  stroke: rgb(100 116 139 / 0.5);
  stroke-width: 2;
  transition: fill var(--normal) ease;
}

.estrella--llena path {
  fill: var(--amarillo);
  stroke: var(--amarillo-oscuro);
  filter: drop-shadow(0 3px 6px rgb(255 217 61 / 0.55));
}

.estrella--animada {
  animation: aparecer-estrella 520ms var(--rebote) backwards;
}
</style>
