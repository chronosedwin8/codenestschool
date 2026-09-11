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
 *
 * Lo que se compra en la tienda se dibuja aquí, y llega como FORMA ("mago",
 * "buceo", "capa"), no como clave de artículo: el avatar no sabe de precios ni
 * de inventarios, solo de qué tiene que pintar. Lo que va detrás del cuerpo
 * (capa, alas, mochila, crestas) se dibuja antes que el cuerpo; si estuviera al
 * final, una capa taparía al personaje entero.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';

type Expresion = 'normal' | 'feliz' | 'confundido' | 'celebrando' | 'dormido';

const props = withDefaults(
  defineProps<{
    color?: string;
    tamano?: number;
    expresion?: Expresion;
    /** gorro | fiesta | pirata | mago | casco | corona */
    sombrero?: string | null;
    /** redondas | sol | buceo | ciber */
    gafas?: string | null;
    /** bufanda | capa | mochila | alas */
    accesorio?: string | null;
    /** buzo | robot | dino */
    disfraz?: string | null;
    /** Aura de la poción de brillo. */
    brillo?: boolean;
    /** Si los ojos siguen el puntero (se desactiva en listas largas). */
    mirar?: boolean;
  }>(),
  {
    color: '#1FA2FF',
    tamano: 120,
    expresion: 'normal',
    sombrero: null,
    gafas: null,
    accesorio: null,
    disfraz: null,
    brillo: false,
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

/**
 * Un casco de burbuja tapa los ojos si se dibuja opaco, y los ojos son lo que
 * hace simpático al personaje: los cascos van translúcidos y por encima.
 */
const conBurbuja = computed(() => props.sombrero === 'casco' || props.disfraz === 'buzo');
</script>

<template>
  <svg
    ref="raiz"
    :width="tamano"
    :height="tamano"
    viewBox="0 0 100 100"
    class="fuzz"
    :class="[`fuzz--${expresion}`, { 'fuzz--brillo': brillo }]"
    role="img"
    :aria-label="`Fuzz de color ${color}`"
  >
    <!-- Sombra en el suelo: ancla al personaje en el escenario. -->
    <ellipse cx="50" cy="92" rx="26" ry="5" fill="rgb(0 0 0 / 0.18)" />

    <!-- Aura de la poción de brillo: va debajo de todo para no velar la cara. -->
    <circle v-if="brillo" cx="50" cy="50" r="42" fill="#FFD93D" opacity="0.22" class="fuzz__aura" />

    <!-- Lo que va DETRÁS del cuerpo: capa, alas, mochila, crestas. -->
    <g v-if="accesorio === 'capa'">
      <path d="M 30 34 Q 16 66 24 86 Q 50 78 76 86 Q 84 66 70 34 Z" fill="#EF4444" />
      <path d="M 30 34 Q 50 42 70 34 Q 50 30 30 34 Z" fill="#B91C1C" />
    </g>
    <g v-else-if="accesorio === 'alas'" class="fuzz__alas">
      <path d="M 26 42 Q 2 30 6 54 Q 10 68 30 60 Z" fill="#FFFFFF" opacity="0.92" />
      <path d="M 74 42 Q 98 30 94 54 Q 90 68 70 60 Z" fill="#FFFFFF" opacity="0.92" />
      <path d="M 26 46 Q 12 42 10 54" stroke="#CBD5E1" stroke-width="2" fill="none" />
      <path d="M 74 46 Q 88 42 90 54" stroke="#CBD5E1" stroke-width="2" fill="none" />
    </g>
    <g v-else-if="accesorio === 'mochila'">
      <rect x="62" y="40" width="26" height="30" rx="8" fill="#7B61FF" />
      <rect x="66" y="46" width="18" height="9" rx="4" fill="#5A3FE0" />
    </g>

    <g v-if="disfraz === 'dino'">
      <path
        d="M 78 40 L 90 34 L 84 48 L 94 46 L 84 60 L 92 62 L 78 70 Z"
        fill="#22C55E"
      />
    </g>

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

    <!-- Disfraces que cubren el cuerpo. Van antes de la cara. -->
    <g v-if="disfraz === 'robot'">
      <path d="M 18 56 A 34 34 0 0 0 82 56 Z" fill="#94A3B8" />
      <rect x="40" y="62" width="20" height="10" rx="3" fill="#64748B" />
      <circle cx="34" cy="66" r="2.6" fill="#EF4444" />
      <circle cx="66" cy="66" r="2.6" fill="#22C55E" />
      <line x1="50" y1="16" x2="50" y2="4" stroke="#94A3B8" stroke-width="3" />
      <circle cx="50" cy="3" r="4" fill="#EF4444" />
    </g>
    <g v-else-if="disfraz === 'dino'">
      <path d="M 26 62 A 26 26 0 0 0 74 62 Z" fill="#BBF7D0" />
    </g>
    <g v-else-if="disfraz === 'buzo'">
      <rect x="28" y="72" width="44" height="9" rx="4" fill="#F59E0B" />
      <circle cx="34" cy="76" r="2" fill="#B45309" />
      <circle cx="66" cy="76" r="2" fill="#B45309" />
    </g>

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

    <!-- Gafas -->
    <g v-if="gafas === 'sol'">
      <rect x="25" y="38" width="50" height="13" rx="6" fill="#1E293B" opacity="0.85" />
      <rect x="28" y="40" width="18" height="8" rx="4" fill="#06B6D4" opacity="0.6" />
      <rect x="54" y="40" width="18" height="8" rx="4" fill="#06B6D4" opacity="0.6" />
    </g>
    <g v-else-if="gafas === 'redondas'" stroke="#1E293B" stroke-width="2.6" fill="none">
      <circle cx="38" cy="44" r="12" fill="#FFFFFF" fill-opacity="0.25" />
      <circle cx="62" cy="44" r="12" fill="#FFFFFF" fill-opacity="0.25" />
      <line x1="50" y1="44" x2="50" y2="44" />
      <path d="M 50 43 L 50 45" />
      <path d="M 26 42 L 18 40" />
      <path d="M 74 42 L 82 40" />
    </g>
    <g v-else-if="gafas === 'buceo'">
      <rect x="22" y="34" width="56" height="22" rx="10" fill="#06B6D4" opacity="0.35" />
      <rect x="22" y="34" width="56" height="22" rx="10" fill="none" stroke="#0E7490" stroke-width="3" />
      <path d="M 22 40 L 8 36" stroke="#0E7490" stroke-width="3" fill="none" />
      <path d="M 78 40 L 92 36" stroke="#0E7490" stroke-width="3" fill="none" />
    </g>
    <g v-else-if="gafas === 'ciber'">
      <rect x="20" y="39" width="60" height="10" rx="5" fill="#1E293B" />
      <rect x="24" y="42" width="52" height="3" rx="1.5" fill="#22D3EE" class="fuzz__visor" />
    </g>

    <!-- Bufanda: se dibuja delante, sobre la parte baja del cuerpo. -->
    <g v-if="accesorio === 'bufanda'">
      <path d="M 24 68 Q 50 80 76 68 L 76 76 Q 50 88 24 76 Z" fill="#FF8A3D" />
      <path d="M 70 74 Q 82 80 78 92 L 68 86 Z" fill="#EA580C" class="fuzz__cola" />
    </g>
    <g v-else-if="accesorio === 'mochila'">
      <path d="M 40 34 Q 50 44 62 42" stroke="#5A3FE0" stroke-width="4" fill="none" />
      <path d="M 40 60 Q 52 62 64 58" stroke="#5A3FE0" stroke-width="4" fill="none" />
    </g>

    <!-- Sombreros -->
    <g v-if="sombrero === 'mago'">
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
    <g v-else-if="sombrero === 'fiesta'">
      <path d="M 36 26 L 50 -2 L 64 26 Z" fill="#FFD93D" />
      <path d="M 41 14 L 59 14" stroke="#FF3CAC" stroke-width="3" />
      <path d="M 38 21 L 62 21" stroke="#06B6D4" stroke-width="3" />
      <circle cx="50" cy="-4" r="4" fill="#FF3CAC" />
    </g>
    <g v-else-if="sombrero === 'pirata'">
      <path d="M 22 24 Q 50 -2 78 24 Q 50 32 22 24 Z" fill="#1E293B" />
      <circle cx="50" cy="16" r="5" fill="#F8FAFC" />
      <circle cx="48" cy="15" r="1.2" fill="#1E293B" />
      <circle cx="52" cy="15" r="1.2" fill="#1E293B" />
      <path d="M 47 20 L 53 20" stroke="#1E293B" stroke-width="1.4" />
    </g>

    <!-- Burbujas: translúcidas y al final, para que la cara se siga viendo. -->
    <g v-if="conBurbuja">
      <circle cx="50" cy="46" r="40" fill="#BAE6FD" opacity="0.24" />
      <circle cx="50" cy="46" r="40" fill="none" stroke="#38BDF8" stroke-width="2.4" opacity="0.8" />
      <ellipse cx="34" cy="24" rx="9" ry="6" fill="white" opacity="0.45" />
      <template v-if="disfraz === 'buzo'">
        <circle cx="14" cy="58" r="3" fill="#94A3B8" />
        <circle cx="86" cy="58" r="3" fill="#94A3B8" />
      </template>
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

/* El aura late; el resto del personaje no se toca. */
.fuzz__aura {
  animation: latido-aura 1.6s ease-in-out infinite;
  transform-origin: 50px 50px;
}

.fuzz__alas {
  animation: aleteo 1.5s ease-in-out infinite;
  transform-origin: 50px 50px;
}

.fuzz__cola {
  animation: ondear 2.4s ease-in-out infinite;
  transform-origin: 70px 74px;
}

.fuzz__visor {
  animation: barrido 2.2s linear infinite;
}

@keyframes latido-aura {
  0%, 100% { opacity: 0.18; transform: scale(1); }
  50% { opacity: 0.34; transform: scale(1.06); }
}

@keyframes aleteo {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.82); }
}

@keyframes ondear {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(7deg); }
}

@keyframes barrido {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

/* Nada de esto se mueve si el sistema pide menos animación. */
@media (prefers-reduced-motion: reduce) {
  .fuzz,
  .fuzz__aura,
  .fuzz__alas,
  .fuzz__cola,
  .fuzz__visor {
    animation: none;
  }
}
</style>
