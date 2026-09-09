<script setup lang="ts">
/**
 * Una pieza del estilo: forma plana con contorno grueso y bisel inferior.
 *
 * Es el ladrillo con el que se montan los paneles de recompensa y los carteles de
 * las cinemáticas. El bisel no es una sombra: es una copia de la misma forma en
 * un tono más oscuro, desplazada hacia abajo y dibujada detrás. Eso es lo que
 * hace que parezca una pieza con grosor y no un rectángulo con sombra.
 *
 * Se dibuja en SVG para que el contorno escale con la forma. Con CSS, un borde
 * grueso en una caja redondeada se deforma al cambiar de tamaño.
 */
import { computed } from 'vue';

type Tono = 'azul' | 'amarillo' | 'verde' | 'magenta' | 'naranja' | 'morado' | 'blanco';

const props = withDefaults(
  defineProps<{
    tono?: Tono;
    ancho?: number;
    alto?: number;
    /** Curvatura de las esquinas. */
    radio?: number;
    /** Grosor del bisel inferior, en unidades del lienzo. */
    bisel?: number;
    /** Entra con un rebote al aparecer. */
    animarEntrada?: boolean;
    retraso?: number;
  }>(),
  {
    tono: 'azul',
    ancho: 320,
    alto: 120,
    radio: 26,
    bisel: 12,
    animarEntrada: true,
    retraso: 0,
  },
);

const RELLENOS: Record<Tono, { cara: string; bisel: string }> = {
  azul: { cara: 'var(--pieza-azul)', bisel: 'var(--pieza-azul-bisel)' },
  amarillo: { cara: 'var(--pieza-amarillo)', bisel: 'var(--pieza-amarillo-bisel)' },
  verde: { cara: 'var(--pieza-verde)', bisel: 'var(--pieza-verde-bisel)' },
  magenta: { cara: 'var(--pieza-magenta)', bisel: 'var(--pieza-magenta-bisel)' },
  naranja: { cara: 'var(--pieza-naranja)', bisel: 'var(--pieza-naranja-bisel)' },
  morado: { cara: 'var(--pieza-morado)', bisel: 'var(--pieza-morado-bisel)' },
  blanco: { cara: 'var(--pieza-blanco)', bisel: 'var(--pieza-blanco-bisel)' },
};

const relleno = computed(() => RELLENOS[props.tono]);

/** El lienzo deja aire para el contorno y el bisel, que se salen de la forma. */
const margen = 8;
const vista = computed(
  () => `0 0 ${props.ancho + margen * 2} ${props.alto + margen * 2 + props.bisel}`,
);
</script>

<template>
  <div class="pieza" :class="{ 'pieza--entra': animarEntrada }" :style="{ animationDelay: `${retraso}ms` }">
    <svg :viewBox="vista" class="pieza__svg">
      <!-- Bisel: la misma forma, mas oscura y desplazada. Va detras. -->
      <rect
        :x="margen"
        :y="margen + bisel"
        :width="ancho"
        :height="alto"
        :rx="radio"
        :fill="relleno.bisel"
        stroke="var(--contorno)"
        :stroke-width="7"
      />
      <!-- Cara -->
      <rect
        :x="margen"
        :y="margen"
        :width="ancho"
        :height="alto"
        :rx="radio"
        :fill="relleno.cara"
        stroke="var(--contorno)"
        :stroke-width="7"
      />
      <!-- Brillo superior: una banda clara que sugiere una luz arriba. -->
      <rect
        :x="margen + radio * 0.5"
        :y="margen + 8"
        :width="ancho - radio"
        :height="alto * 0.22"
        :rx="radio * 0.5"
        fill="white"
        opacity="0.22"
      />
    </svg>

    <!-- El contenido va encima de la pieza, centrado. -->
    <div class="pieza__contenido" :style="{ paddingBottom: `${bisel}px` }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.pieza {
  position: relative;
  display: inline-block;
  width: 100%;
}

.pieza--entra {
  animation: entrar-pieza 520ms var(--rebote) backwards;
}

.pieza__svg {
  display: block;
  width: 100%;
  height: auto;
}

.pieza__contenido {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--espacio-3) var(--espacio-5);
  text-align: center;
}
</style>
