<script setup lang="ts">
/**
 * El Fuzz: una bola peluda con ojos grandes.
 *
 * Es SVG en línea y no una imagen, por tres razones: se tiñe con cualquier
 * color sin generar variantes, escala sin perder nitidez y las expresiones se
 * animan con CSS. Además evita cargar decenas de sprites solo para el avatar.
 *
 * Los ojos siguen al puntero. Es un detalle pequeño que hace que un niño de
 * cuatro años sienta que el personaje está vivo y le presta atención.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';

type Expresion = 'normal' | 'feliz' | 'confundido' | 'celebrando' | 'dormido';

const props = withDefaults(
  defineProps<{
    color?: string;
    tamano?: number;
    expresion?: Expresion;
    sombrero?: string | null;
    gafas?: string | null;
    /** Si los ojos siguen el puntero (se desactiva en listas largas). */
    mirar?: boolean;
  }>(),
  {
    color: '#1FA2FF',
    tamano: 120,
    expresion: 'normal',
    sombrero: null,
    gafas: null,
    mirar: true,
  },
);

const raiz = ref<SVGSVGElement | null>(null);
const pupila = ref({ x: 0, y: 0 });

/** Desplazamiento de las pupilas hacia el puntero, con un tope pequeño. */
function seguirPuntero(evento: PointerEvent): void {
  if (!props.mirar || !raiz.value) return;
  const caja = raiz.value.getBoundingClientRect();
  const centroX = caja.left + caja.width / 2;
  const centroY = caja.top + caja.height / 2;
  const dx = evento.clientX - centroX;
  const dy = evento.clientY - centroY;
  const distancia = Math.hypot(dx, dy) || 1;
  const tope = 3.2;
  pupila.value = {
    x: (dx / distancia) * Math.min(tope, distancia / 40),
    y: (dy / distancia) * Math.min(tope, distancia / 40),
  };
}

onMounted(() => {
  if (props.mirar) window.addEventListener('pointermove', seguirPuntero, { passive: true });
});
onUnmounted(() => window.removeEventListener('pointermove', seguirPuntero));

/** Color del pelaje algo más oscuro, para el sombreado inferior. */
const colorSombra = computed(() => {
  const hex = props.color.replace('#', '');
  const n = Number.parseInt(hex, 16);
  const oscurecer = (c: number): number => Math.max(0, Math.round(c * 0.75));
  const r = oscurecer((n >> 16) & 255);
  const g = oscurecer((n >> 8) & 255);
  const b = oscurecer(n & 255);
  return `rgb(${r} ${g} ${b})`;
});

/** Mechones del pelaje: se generan una vez y no cambian. */
const mechones = Array.from({ length: 28 }, (_, i) => {
  const angulo = (i / 28) * Math.PI * 2;
  const largo = 6 + (i % 3) * 2.5;
  return {
    x1: 50 + Math.cos(angulo) * 33,
    y1: 50 + Math.sin(angulo) * 33,
    x2: 50 + Math.cos(angulo) * (33 + largo),
    y2: 50 + Math.sin(angulo) * (33 + largo),
  };
});

const ojoAbierto = computed(() => props.expresion !== 'dormido');
const boca = computed(() => {
  switch (props.expresion) {
    case 'feliz':
    case 'celebrando':
      // Sonrisa amplia.
      return 'M 38 62 Q 50 74 62 62';
    case 'confundido':
      // Boca ondulada de desconcierto, nunca de tristeza.
      return 'M 40 66 Q 45 62 50 66 Q 55 70 60 66';
    case 'dormido':
      return 'M 44 66 Q 50 70 56 66';
    default:
      return 'M 41 64 Q 50 70 59 64';
  }
});
</script>

<template>
  <svg
    ref="raiz"
    :width="tamano"
    :height="tamano"
    viewBox="0 0 100 100"
    class="fuzz"
    :class="[`fuzz--${expresion}`]"
    role="img"
    :aria-label="`Fuzz de color ${color}`"
  >
    <!-- Sombra en el suelo: ancla al personaje en el escenario. -->
    <ellipse cx="50" cy="92" rx="26" ry="5" fill="rgb(0 0 0 / 0.18)" />

    <!-- Pelaje: los mechones van detrás del cuerpo. -->
    <g :stroke="colorSombra" stroke-width="4" stroke-linecap="round">
      <line v-for="(m, i) in mechones" :key="i" :x1="m.x1" :y1="m.y1" :x2="m.x2" :y2="m.y2" />
    </g>

    <!-- Cuerpo -->
    <circle cx="50" cy="50" r="34" :fill="color" />
    <!-- Sombreado inferior, para que la bola parezca esférica. -->
    <path d="M 16 50 A 34 34 0 0 0 84 50 Z" :fill="colorSombra" opacity="0.28" />
    <!-- Brillo superior: sugiere una fuente de luz y da volumen. -->
    <ellipse cx="40" cy="34" rx="13" ry="9" fill="white" opacity="0.32" />

    <!-- Ojos, muy grandes: es lo que hace simpático al personaje. -->
    <template v-if="ojoAbierto">
      <circle cx="38" cy="44" r="11" fill="white" />
      <circle cx="62" cy="44" r="11" fill="white" />
      <circle :cx="38 + pupila.x" :cy="44 + pupila.y" r="5.5" fill="#1E293B" />
      <circle :cx="62 + pupila.x" :cy="44 + pupila.y" r="5.5" fill="#1E293B" />
      <!-- Reflejo: mirada viva. -->
      <circle :cx="36 + pupila.x" :cy="42 + pupila.y" r="1.9" fill="white" />
      <circle :cx="60 + pupila.x" :cy="42 + pupila.y" r="1.9" fill="white" />
    </template>
    <template v-else>
      <path d="M 30 44 Q 38 50 46 44" stroke="#1E293B" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M 54 44 Q 62 50 70 44" stroke="#1E293B" stroke-width="3" fill="none" stroke-linecap="round" />
    </template>

    <!-- Boca -->
    <path :d="boca" stroke="#1E293B" stroke-width="3" fill="none" stroke-linecap="round" />

    <!-- Mejillas sonrosadas al celebrar. -->
    <template v-if="expresion === 'celebrando' || expresion === 'feliz'">
      <circle cx="26" cy="56" r="5" fill="#FF3CAC" opacity="0.35" />
      <circle cx="74" cy="56" r="5" fill="#FF3CAC" opacity="0.35" />
    </template>

    <!-- Accesorios comprados en la tienda. -->
    <g v-if="gafas === 'gafas_sol'">
      <rect x="25" y="38" width="50" height="13" rx="6" fill="#1E293B" opacity="0.85" />
      <rect x="28" y="40" width="18" height="8" rx="4" fill="#06B6D4" opacity="0.6" />
      <rect x="54" y="40" width="18" height="8" rx="4" fill="#06B6D4" opacity="0.6" />
    </g>

    <g v-if="sombrero === 'sombrero_mago'">
      <path d="M 30 24 L 50 -4 L 70 24 Z" fill="#7B61FF" />
      <ellipse cx="50" cy="24" rx="24" ry="5" fill="#5A3FE0" />
      <circle cx="50" cy="10" r="3" fill="#FFD93D" />
    </g>
    <g v-else-if="sombrero === 'corona'">
      <path d="M 32 22 L 36 8 L 44 18 L 50 4 L 56 18 L 64 8 L 68 22 Z" fill="#FFD93D" />
      <rect x="32" y="22" width="36" height="5" rx="2" fill="#E0B81C" />
    </g>
    <g v-else-if="sombrero === 'gorro'">
      <path d="M 30 26 Q 50 2 70 26 Z" fill="#FF3CAC" />
      <rect x="27" y="24" width="46" height="7" rx="3" fill="#D81B8C" />
      <circle cx="50" cy="4" r="4" fill="white" />
    </g>
  </svg>
</template>

<style scoped>
.fuzz {
  display: block;
  overflow: visible;
}

/* La expresión no depende solo de la cara: también del movimiento. */
.fuzz--celebrando {
  animation: rebote-suave 500ms var(--rebote) infinite;
}

.fuzz--confundido {
  animation: temblor 380ms ease-in-out 2;
}

.fuzz--normal {
  animation: flotar 3.4s ease-in-out infinite;
}
</style>
