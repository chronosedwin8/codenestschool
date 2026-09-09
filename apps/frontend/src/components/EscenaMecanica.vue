<script setup lang="ts">
/**
 * Escenas que enseñan una mecánica.
 *
 * Van aparte de las escenas de historia porque cumplen otra función: aquí no se
 * cuenta qué pasa, se muestra cómo funciona algo. Son las que aparecen cuando
 * Nube explica los colores del bosque, el bucle de la pradera o la caja de
 * Garfio.
 *
 * La regla de todas: enseñar la idea sin escribir la instrucción. En la escena
 * del bucle no pone "usa la ficha de repetir": se ven seis fichas iguales,
 * apagadas, y al lado una sola ficha con un seis. El niño saca la conclusión, que
 * es lo que hace que se le quede.
 */
const CONTORNO = 'var(--contorno)';
const GROSOR = 7;

defineProps<{ escena: string }>();

/** Oscurece un color para el bisel de la pieza. */
function oscurecer(hex: string, factor = 0.72): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r} ${g} ${b})`;
}

const COLORES_BOSQUE = ['#EF4444', '#3FC55F', '#EF4444', '#3FC55F'];
const FRUTAS = [
  { color: '#FFC93C', orden: 1 },
  { color: '#FF8A3D', orden: 2 },
  { color: '#EF4444', orden: 3 },
];
const PATRON = ['#29A9E0', '#9B5DE5'];
const PIEZAS_FINAL = [
  { cara: 'var(--pieza-azul)', bisel: 'var(--pieza-azul-bisel)' },
  { cara: 'var(--pieza-naranja)', bisel: 'var(--pieza-naranja-bisel)' },
  { cara: 'var(--pieza-magenta)', bisel: 'var(--pieza-magenta-bisel)' },
  { cara: 'var(--pieza-morado)', bisel: 'var(--pieza-morado-bisel)' },
];
</script>

<template>
  <svg viewBox="0 0 428 300" class="mecanica" role="img" :aria-label="`Escena: ${escena}`">
    <!-- ══ Los colores del bosque mandan ══ -->
    <template v-if="escena === 'colores'">
      <g
        v-for="(c, i) in COLORES_BOSQUE"
        :key="i"
        :transform="`translate(${106 + i * 74} 170)`"
        class="mecanica__pieza"
        :style="{ animationDelay: `${i * 120}ms` }"
      >
        <rect x="-30" y="-22" width="60" height="60" rx="14" :fill="oscurecer(c)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <rect x="-30" y="-30" width="60" height="60" rx="14" :fill="c" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <!-- En rojo se gira, en verde se sigue: la regla se ve, no se lee. -->
        <g v-if="c === '#EF4444'">
          <path d="M -10 -10 V 4 L 2 4" stroke="white" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M -3 -3 L 6 4 L -3 11 Z" fill="white" />
        </g>
        <path v-else d="M -14 0 H 5 M 0 -9 L 11 0 L 0 9" stroke="white" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </template>

    <!-- ══ Saltar los agujeros de la pradera ══ -->
    <template v-else-if="escena === 'saltos'">
      <g v-for="i in 7" :key="i" :transform="`translate(${62 + (i - 1) * 52} 206)`">
        <rect v-if="i % 2 === 0" x="-23" y="-20" width="46" height="54" rx="10" fill="#1E1233" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <template v-else>
          <rect x="-23" y="-16" width="46" height="46" rx="10" fill="#8FBB5E" :stroke="CONTORNO" :stroke-width="GROSOR" />
          <rect x="-23" y="-24" width="46" height="46" rx="10" fill="#C2EA92" :stroke="CONTORNO" :stroke-width="GROSOR" />
        </template>
      </g>
      <path
        d="M 62 176 Q 88 116 114 176"
        stroke="white"
        stroke-width="6"
        fill="none"
        stroke-dasharray="10 10"
        stroke-linecap="round"
        opacity="0.9"
      />
      <circle cx="88" cy="132" r="20" fill="var(--pieza-amarillo)" :stroke="CONTORNO" :stroke-width="GROSOR" class="mecanica__salta" />
    </template>

    <!-- ══ El bucle: seis fichas o una con un seis ══ -->
    <template v-else-if="escena === 'bucle'">
      <!-- La forma aburrida, apagada -->
      <g opacity="0.4">
        <g v-for="i in 6" :key="i" :transform="`translate(${86 + (i - 1) * 44} 88)`">
          <rect x="-17" y="-14" width="34" height="34" rx="9" fill="var(--pieza-verde-bisel)" :stroke="CONTORNO" stroke-width="5" />
          <rect x="-17" y="-20" width="34" height="34" rx="9" fill="var(--pieza-verde)" :stroke="CONTORNO" stroke-width="5" />
        </g>
      </g>

      <!-- La forma elegante, encendida -->
      <g transform="translate(214 200)" class="mecanica__pieza">
        <rect x="-48" y="-36" width="96" height="96" rx="22" fill="var(--pieza-naranja-bisel)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <rect x="-48" y="-46" width="96" height="96" rx="22" fill="var(--pieza-naranja)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <path d="M 20 -16 A 24 24 0 1 0 2 22" stroke="white" stroke-width="8" fill="none" stroke-linecap="round" />
        <path d="M 10 -34 L 26 -16 L 4 -10 Z" fill="white" />
        <circle cx="36" cy="36" r="21" fill="var(--pieza-amarillo)" :stroke="CONTORNO" stroke-width="5" />
        <text x="36" y="45" text-anchor="middle" font-size="27" :fill="CONTORNO" font-family="Fredoka, sans-serif">6</text>
      </g>
    </template>

    <!-- ══ El patrón que se repite ══ -->
    <template v-else-if="escena === 'patron'">
      <g
        v-for="i in 8"
        :key="i"
        :transform="`translate(${70 + ((i - 1) % 4) * 96} ${118 + Math.floor((i - 1) / 4) * 92})`"
        class="mecanica__pieza"
        :style="{ animationDelay: `${(i - 1) * 110}ms` }"
      >
        <rect x="-28" y="-22" width="56" height="56" rx="13" :fill="oscurecer(PATRON[(i - 1) % 2]!)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <rect x="-28" y="-30" width="56" height="56" rx="13" :fill="PATRON[(i - 1) % 2]" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <g :transform="`rotate(${(i - 1) % 2 === 0 ? 270 : 0})`">
          <path d="M -11 0 H 5 M 0 -8 L 10 0 L 0 8" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </template>

    <!-- ══ El eco devuelve algo que nadie dijo ══ -->
    <template v-else-if="escena === 'eco-extrano'">
      <path d="M 78 268 Q 78 108 214 108 Q 350 108 350 268 Z" fill="#1E1233" :stroke="CONTORNO" :stroke-width="GROSOR" />
      <g fill="none" stroke="#B98BF0" stroke-width="7" stroke-linecap="round">
        <path class="mecanica__onda" d="M 186 204 Q 214 178 242 204" />
        <path class="mecanica__onda mecanica__onda--2" d="M 160 216 Q 214 158 268 216" />
        <path class="mecanica__onda mecanica__onda--3" d="M 134 228 Q 214 138 294 228" />
      </g>
      <circle cx="214" cy="228" r="24" fill="#9B5DE5" :stroke="CONTORNO" :stroke-width="GROSOR" />
      <circle cx="206" cy="222" r="7" fill="white" />
      <circle cx="223" cy="222" r="7" fill="white" />
      <circle cx="207" cy="223" r="3.5" :fill="CONTORNO" />
      <circle cx="224" cy="223" r="3.5" :fill="CONTORNO" />
    </template>

    <!-- ══ El orden en que Mango come ══ -->
    <template v-else-if="escena === 'orden'">
      <g
        v-for="(f, i) in FRUTAS"
        :key="i"
        :transform="`translate(${112 + i * 102} 160)`"
        class="mecanica__pieza"
        :style="{ animationDelay: `${i * 180}ms` }"
      >
        <circle cy="9" r="36" :fill="oscurecer(f.color)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <circle r="36" :fill="f.color" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <ellipse cx="-12" cy="-13" rx="11" ry="8" fill="white" opacity="0.35" />
        <circle cx="26" cy="27" r="18" fill="white" :stroke="CONTORNO" stroke-width="5" />
        <text x="26" y="35" text-anchor="middle" font-size="22" :fill="CONTORNO" font-family="Fredoka, sans-serif">
          {{ f.orden }}
        </text>
      </g>
      <!-- Flechas de orden entre las frutas -->
      <g stroke="white" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.75">
        <path d="M 158 160 H 178 M 172 152 L 182 160 L 172 168" />
        <path d="M 260 160 H 280 M 274 152 L 284 160 L 274 168" />
      </g>
    </template>

    <!-- ══ Mirar antes de pisar ══ -->
    <template v-else-if="escena === 'decision'">
      <path
        d="M 214 258 L 214 186 M 214 186 L 122 126 M 214 186 L 306 126"
        stroke="white"
        stroke-width="9"
        fill="none"
        stroke-linecap="round"
        opacity="0.8"
      />
      <!-- Camino que sí existe -->
      <g transform="translate(306 112)">
        <rect x="-32" y="-22" width="64" height="64" rx="15" fill="var(--pieza-verde-bisel)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <rect x="-32" y="-30" width="64" height="64" rx="15" fill="var(--pieza-verde)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <path d="M -13 2 L -3 13 L 15 -9" stroke="white" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <!-- Camino que no existe: solo el hueco -->
      <g transform="translate(122 112)" opacity="0.55">
        <rect x="-32" y="-30" width="64" height="64" rx="15" fill="none" :stroke="CONTORNO" stroke-width="6" stroke-dasharray="10 10" />
      </g>
      <circle cx="214" cy="266" r="24" fill="#8ED3F5" :stroke="CONTORNO" :stroke-width="GROSOR" class="mecanica__mira" />
      <circle cx="206" cy="260" r="7" fill="white" />
      <circle cx="223" cy="260" r="7" fill="white" />
      <circle cx="207" cy="261" r="3.5" :fill="CONTORNO" />
      <circle cx="224" cy="261" r="3.5" :fill="CONTORNO" />
    </template>

    <!-- ══ La caja de Garfio ══ -->
    <template v-else-if="escena === 'caja'">
      <rect x="118" y="162" width="192" height="104" rx="18" fill="#8A5A2B" :stroke="CONTORNO" :stroke-width="GROSOR" />
      <rect x="118" y="150" width="192" height="104" rx="18" fill="#B07B3E" :stroke="CONTORNO" :stroke-width="GROSOR" />
      <rect x="196" y="184" width="36" height="42" rx="8" fill="var(--pieza-amarillo)" :stroke="CONTORNO" stroke-width="5" />

      <!-- Tres fichas cayendo dentro -->
      <g
        v-for="i in 3"
        :key="i"
        :transform="`translate(${152 + (i - 1) * 62} 88)`"
        class="mecanica__cae"
        :style="{ animationDelay: `${(i - 1) * 220}ms` }"
      >
        <rect x="-22" y="-18" width="44" height="44" rx="11" fill="var(--pieza-azul-bisel)" :stroke="CONTORNO" stroke-width="6" />
        <rect x="-22" y="-24" width="44" height="44" rx="11" fill="var(--pieza-azul)" :stroke="CONTORNO" stroke-width="6" />
        <path d="M -9 -2 H 3 M -1 -9 L 7 -2 L -1 5" stroke="white" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <text x="214" y="290" text-anchor="middle" font-size="22" fill="white" font-family="Fredoka, sans-serif">
        Super Salto
      </text>
    </template>

    <!-- ══ El programa con una ficha mal ══ -->
    <template v-else-if="escena === 'error'">
      <g
        v-for="i in 5"
        :key="i"
        :transform="`translate(${80 + (i - 1) * 68} 168)`"
        :class="{ 'mecanica__malo': i === 3 }"
      >
        <rect x="-26" y="-20" width="52" height="52" rx="13" :fill="i === 3 ? '#B03024' : 'var(--pieza-azul-bisel)'" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <rect x="-26" y="-28" width="52" height="52" rx="13" :fill="i === 3 ? '#EF4444' : 'var(--pieza-azul)'" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <g :transform="`rotate(${i === 3 ? 180 : 0})`">
          <path d="M -11 0 H 5 M 0 -8 L 10 0 L 0 8" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>

      <!-- La lupa recorre el programa y se para en la ficha equivocada -->
      <g class="mecanica__lupa">
        <circle r="42" fill="none" stroke="white" stroke-width="7" opacity="0.92" />
        <path d="M 30 30 L 56 56" stroke="white" stroke-width="10" stroke-linecap="round" opacity="0.92" />
      </g>
    </template>

    <!-- ══ Todo junto: el cohete ══ -->
    <template v-else-if="escena === 'integrador'">
      <g
        v-for="(p, i) in PIEZAS_FINAL"
        :key="i"
        :transform="`translate(${110 + i * 70} 108)`"
        class="mecanica__pieza"
        :style="{ animationDelay: `${i * 130}ms` }"
      >
        <rect x="-28" y="-20" width="56" height="56" rx="14" :fill="p.bisel" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <rect x="-28" y="-28" width="56" height="56" rx="14" :fill="p.cara" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <circle r="9" fill="white" opacity="0.9" />
      </g>

      <g transform="translate(214 226)">
        <path class="mecanica__llama" d="M -11 18 Q 0 52 11 18 Z" fill="var(--pieza-amarillo)" :stroke="CONTORNO" stroke-width="5" />
        <path d="M -20 14 L -34 34 L -9 27 Z" fill="var(--pieza-magenta)" :stroke="CONTORNO" stroke-width="5" />
        <path d="M 20 14 L 34 34 L 9 27 Z" fill="var(--pieza-magenta)" :stroke="CONTORNO" stroke-width="5" />
        <path d="M 0 -46 Q 20 -16 20 14 L -20 14 Q -20 -16 0 -46 Z" fill="var(--pieza-blanco)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <circle cy="-12" r="9" fill="var(--pieza-azul)" :stroke="CONTORNO" stroke-width="4" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.mecanica {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.mecanica__pieza {
  animation: entrar-pieza 480ms var(--rebote) backwards;
}

.mecanica__salta {
  animation: saltar-hueco 1.8s ease-in-out infinite;
}

@keyframes saltar-hueco {
  0%,
  100% {
    transform: translate(-26px, 74px);
  }
  50% {
    transform: translate(0, 0);
  }
}

/* Las ondas del eco salen de la cueva una tras otra. */
.mecanica__onda {
  animation: onda-eco 2.2s ease-out infinite;
  opacity: 0;
}
.mecanica__onda--2 {
  animation-delay: 380ms;
}
.mecanica__onda--3 {
  animation-delay: 760ms;
}

@keyframes onda-eco {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(0.7);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-32px) scale(1.3);
  }
}

/* La ficha equivocada tiembla: se ve cuál es sin que nadie lo diga. */
.mecanica__malo {
  animation: temblor 900ms ease-in-out infinite;
}

/* La lupa recorre el programa y se detiene sobre el fallo. */
.mecanica__lupa {
  animation: buscar-fallo 4s ease-in-out infinite;
}

@keyframes buscar-fallo {
  0% {
    transform: translate(80px, 168px);
  }
  30% {
    transform: translate(148px, 168px);
  }
  50%,
  70% {
    transform: translate(216px, 168px);
  }
  100% {
    transform: translate(80px, 168px);
  }
}

/* Las fichas caen dentro del cofre. */
.mecanica__cae {
  animation: caer-en-caja 2.6s ease-in infinite;
}

@keyframes caer-en-caja {
  0%,
  20% {
    transform: translateY(0);
    opacity: 1;
  }
  55%,
  100% {
    transform: translateY(90px) scale(0.5);
    opacity: 0;
  }
}

/* Nimbo asoma para mirar antes de pisar. */
.mecanica__mira {
  animation: rebote-suave 1.6s ease-in-out infinite;
}

.mecanica__llama {
  animation: pulso 240ms ease-in-out infinite;
  transform-origin: center top;
}
</style>
