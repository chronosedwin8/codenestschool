<script setup lang="ts">
/**
 * Fondo de escena con rayos y destellos.
 *
 * Es el marco visual del estilo: un color saturado, rayos que salen del centro y
 * destellos de cuatro puntas repartidos. Los rayos hacen dos cosas a la vez:
 * llevan la mirada al centro, que es donde ocurre lo importante, y dan sensación
 * de premio sin necesidad de una animación cara.
 *
 * Va en SVG y no en imagen porque así se tiñe por mundo con una sola variable, y
 * porque escala a cualquier pantalla sin pesar nada.
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Color base del fondo. Cada mundo trae el suyo. */
    color?: string;
    colorRayo?: string;
    /** Los rayos giran muy despacio; se puede desactivar. */
    girar?: boolean;
    destellos?: number;
  }>(),
  { color: '#7B3FD4', colorRayo: '#8B52E0', girar: true, destellos: 7 },
);

/** Rayos como sectores desde el centro, alternando uno sí y uno no. */
const rayos = computed(() => {
  const total = 24;
  return Array.from({ length: total }, (_, i) => {
    const desde = (i / total) * 360;
    const hasta = desde + 360 / total / 2;
    const punto = (grados: number): string => {
      const rad = ((grados - 90) * Math.PI) / 180;
      // Radio largo: los rayos deben salirse del lienzo por los cuatro lados.
      return `${50 + Math.cos(rad) * 90},${50 + Math.sin(rad) * 90}`;
    };
    return `M 50,50 L ${punto(desde)} L ${punto(hasta)} Z`;
  });
});

/**
 * Destellos repartidos con posiciones fijas.
 *
 * No se colocan al azar en cada carga: un niño que vuelve a la misma escena
 * espera verla igual, y una composición estable se lee mejor que una aleatoria.
 */
const POSICIONES = [
  { x: 12, y: 18, t: 1, r: 0 },
  { x: 86, y: 14, t: 1.3, r: 0.4 },
  { x: 22, y: 78, t: 0.8, r: 0.8 },
  { x: 92, y: 62, t: 1.1, r: 1.2 },
  { x: 44, y: 8, t: 0.7, r: 1.6 },
  { x: 68, y: 88, t: 1, r: 0.2 },
  { x: 6, y: 48, t: 0.9, r: 1 },
  { x: 78, y: 34, t: 0.6, r: 1.4 },
];

const brillos = computed(() => POSICIONES.slice(0, props.destellos));
</script>

<template>
  <svg
    class="fondo"
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <rect width="100" height="100" :fill="color" />

    <!-- Rayos: apenas más claros que el fondo, para insinuar y no gritar. -->
    <g :class="{ 'fondo__rayos': girar }" :style="{ transformOrigin: '50px 50px' }">
      <path v-for="(d, i) in rayos" :key="i" :d="d" :fill="colorRayo" opacity="0.55" />
    </g>

    <!-- Destellos de cuatro puntas, la forma clásica del brillo de juego. -->
    <g>
      <path
        v-for="(b, i) in brillos"
        :key="i"
        class="fondo__destello"
        :d="`M 0,-4 Q 0.7,-0.7 4,0 Q 0.7,0.7 0,4 Q -0.7,0.7 -4,0 Q -0.7,-0.7 0,-4 Z`"
        fill="white"
        :style="{
          transformOrigin: `${b.x}px ${b.y}px`,
          transform: `translate(${b.x}px, ${b.y}px) scale(${b.t})`,
          animationDelay: `${b.r}s`,
        }"
      />
    </g>
  </svg>
</template>

<style scoped>
.fondo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Un giro muy lento: se percibe como vida, no como movimiento. */
.fondo__rayos {
  animation: girar-rayos 60s linear infinite;
}

.fondo__destello {
  animation: destello 2.4s ease-in-out infinite;
}
</style>
