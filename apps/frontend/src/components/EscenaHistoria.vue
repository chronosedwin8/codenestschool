<script setup lang="ts">
/**
 * Las ilustraciones de la historia.
 *
 * Cada escena es SVG dibujado a mano con el lenguaje del estilo: relleno plano y
 * saturado, contorno grueso en violeta oscuro, bisel inferior y destellos. Nada
 * de degradados ni de sombras difusas, porque lo que un niño reconoce de lejos es
 * la silueta.
 *
 * Se hace así y no con Lottie por una razón práctica: un archivo Lottie sale de
 * After Effects, y aquí las escenas se pueden escribir, versionar y cambiar como
 * código. Cuando haya un diseñador de movimiento, el reproductor acepta un `.json`
 * sin que cambie nada más.
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    escena: string;
    /** Color del Fuzz protagonista de la escena. */
    colorFuzz?: string;
    /** Cuántos Fuzzes hay ya en el Nido, para la escena de la colección. */
    rescatados?: number;
  }>(),
  { colorFuzz: '#29A9E0', rescatados: 1 },
);

const CONTORNO = 'var(--contorno)';
const GROSOR = 7;

/** Oscurece un color para el bisel, sin depender de CSS. */
function oscurecer(hex: string, factor = 0.72): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r} ${g} ${b})`;
}

const biselFuzz = computed(() => oscurecer(props.colorFuzz));

/** Fuzzes del Nido: posiciones fijas para que la escena sea siempre la misma. */
const HUECOS_NIDO = [
  { x: 130, y: 186 },
  { x: 172, y: 178 },
  { x: 214, y: 174 },
  { x: 256, y: 178 },
  { x: 298, y: 186 },
  { x: 152, y: 208 },
  { x: 200, y: 204 },
  { x: 248, y: 208 },
];

const nidoVisible = computed(() => HUECOS_NIDO.slice(0, Math.min(props.rescatados, 8)));
</script>

<template>
  <svg viewBox="0 0 428 300" class="escena" role="img" :aria-label="`Escena: ${escena}`">
    <defs>
      <!-- Un Fuzz reutilizable: cuerpo, pelaje, ojos y boca. -->
      <g id="fuzz-base">
        <g :stroke="biselFuzz" stroke-width="5" stroke-linecap="round">
          <line x1="-20" y1="-12" x2="-27" y2="-19" />
          <line x1="20" y1="-12" x2="27" y2="-19" />
          <line x1="0" y1="-24" x2="0" y2="-33" />
          <line x1="-15" y1="-19" x2="-21" y2="-27" />
          <line x1="15" y1="-19" x2="21" y2="-27" />
          <line x1="-24" y1="4" x2="-32" y2="4" />
          <line x1="24" y1="4" x2="32" y2="4" />
        </g>
        <circle cx="0" cy="6" r="24" :fill="biselFuzz" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <circle cx="0" cy="0" r="24" :fill="colorFuzz" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <ellipse cx="-8" cy="-10" rx="9" ry="6" fill="white" opacity="0.32" />
        <circle cx="-8" cy="-2" r="8" fill="white" :stroke="CONTORNO" stroke-width="3" />
        <circle cx="9" cy="-2" r="8" fill="white" :stroke="CONTORNO" stroke-width="3" />
        <circle cx="-7" cy="-1" r="4" :fill="CONTORNO" />
        <circle cx="10" cy="-1" r="4" :fill="CONTORNO" />
        <path d="M -7 12 Q 1 19 9 12" :stroke="CONTORNO" stroke-width="4" fill="none" stroke-linecap="round" />
      </g>

      <!-- Nube, la guia: una nube con cara amable. -->
      <g id="nube-base">
        <path
          d="M -46 12 Q -58 12 -58 0 Q -58 -12 -44 -13 Q -40 -30 -22 -30 Q -8 -38 8 -30 Q 26 -32 32 -16 Q 48 -14 48 0 Q 48 12 36 12 Z"
          fill="#E8EEFF"
          :stroke="CONTORNO"
          :stroke-width="GROSOR"
          stroke-linejoin="round"
        />
        <circle cx="-14" cy="-8" r="6" fill="white" :stroke="CONTORNO" stroke-width="3" />
        <circle cx="8" cy="-8" r="6" fill="white" :stroke="CONTORNO" stroke-width="3" />
        <circle cx="-13" cy="-7" r="3" :fill="CONTORNO" />
        <circle cx="9" cy="-7" r="3" :fill="CONTORNO" />
        <path d="M -8 2 Q -2 8 4 2" :stroke="CONTORNO" stroke-width="4" fill="none" stroke-linecap="round" />
        <circle cx="-22" cy="1" r="4" fill="#FF9BC4" opacity="0.7" />
        <circle cx="17" cy="1" r="4" fill="#FF9BC4" opacity="0.7" />
      </g>
    </defs>

    <!-- ══ El Nido lleno de Fuzzes ══ -->
    <template v-if="escena === 'nido-lleno' || escena === 'nido-suma' || escena === 'nido-vacio'">
      <!-- Rama sobre la que se apoya el Nido -->
      <path
        d="M 60 250 Q 214 230 368 250"
        stroke="#6B4423"
        stroke-width="14"
        fill="none"
        stroke-linecap="round"
      />
      <!-- Cuenco del Nido, con su bisel -->
      <path
        d="M 108 200 Q 214 260 320 200 Q 316 254 214 262 Q 112 254 108 200 Z"
        fill="#8A5A2B"
        :stroke="CONTORNO"
        :stroke-width="GROSOR"
        stroke-linejoin="round"
      />
      <path
        d="M 108 196 Q 214 250 320 196 Q 314 240 214 248 Q 114 240 108 196 Z"
        fill="#B07B3E"
        :stroke="CONTORNO"
        :stroke-width="GROSOR"
        stroke-linejoin="round"
      />
      <!-- Ramitas del borde -->
      <g stroke="#8A5A2B" stroke-width="6" stroke-linecap="round">
        <line x1="120" y1="200" x2="104" y2="188" />
        <line x1="308" y1="200" x2="324" y2="188" />
        <line x1="170" y1="196" x2="162" y2="182" />
        <line x1="258" y1="196" x2="266" y2="182" />
      </g>

      <!-- Fuzzes dentro. En la escena del Nido vacio no hay ninguno. -->
      <g v-if="escena !== 'nido-vacio'">
        <g
          v-for="(hueco, i) in escena === 'nido-lleno' ? HUECOS_NIDO : nidoVisible"
          :key="i"
          :transform="`translate(${hueco.x} ${hueco.y}) scale(0.52)`"
          class="escena__fuzz-nido"
          :style="{ animationDelay: `${i * 90}ms` }"
        >
          <use href="#fuzz-base" />
        </g>
      </g>

      <!-- El Nido vacio: solo el eco de donde estaban -->
      <g v-else opacity="0.28">
        <circle v-for="(h, i) in HUECOS_NIDO" :key="i" :cx="h.x" :cy="h.y" r="12" fill="white" />
      </g>

      <!-- Nube, siempre presente -->
      <g transform="translate(214 90)" class="escena__nube">
        <use href="#nube-base" />
      </g>
    </template>

    <!-- ══ La tormenta que se los lleva ══ -->
    <template v-else-if="escena === 'tormenta'">
      <!-- Nubarrones -->
      <g opacity="0.9">
        <ellipse cx="120" cy="70" rx="72" ry="34" fill="#3A4A7D" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <ellipse cx="300" cy="58" rx="86" ry="38" fill="#31407090" :stroke="CONTORNO" :stroke-width="GROSOR" />
      </g>
      <!-- Rayos -->
      <path d="M 150 100 L 138 140 L 158 138 L 142 178" stroke="#FFC93C" stroke-width="9" fill="none" stroke-linejoin="round" class="escena__rayo" />
      <path d="M 292 92 L 280 128 L 300 126 L 284 164" stroke="#FFC93C" stroke-width="9" fill="none" stroke-linejoin="round" class="escena__rayo escena__rayo--2" />
      <!-- Fuzzes saliendo despedidos -->
      <g transform="translate(90 210) scale(0.6)" class="escena__vuela escena__vuela--1"><use href="#fuzz-base" /></g>
      <g transform="translate(214 240) scale(0.55)" class="escena__vuela escena__vuela--2"><use href="#fuzz-base" /></g>
      <g transform="translate(340 205) scale(0.62)" class="escena__vuela escena__vuela--3"><use href="#fuzz-base" /></g>
      <!-- Nube, sin poder hacer nada -->
      <g transform="translate(214 140) scale(0.9)" class="escena__nube-agitada">
        <use href="#nube-base" />
      </g>
    </template>

    <!-- ══ Los treinta mundos ══ -->
    <template v-else-if="escena === 'mapa-mundos'">
      <g
        v-for="i in 12"
        :key="i"
        :transform="`translate(${50 + ((i - 1) % 6) * 66} ${110 + Math.floor((i - 1) / 6) * 84})`"
        class="escena__planeta"
        :style="{ animationDelay: `${i * 70}ms` }"
      >
        <circle cy="6" r="22" :fill="oscurecer(['#29A9E0','#3FC55F','#FFC93C','#FF4D9D','#FF8A3D','#9B5DE5'][(i - 1) % 6]!)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <circle r="22" :fill="['#29A9E0','#3FC55F','#FFC93C','#FF4D9D','#FF8A3D','#9B5DE5'][(i - 1) % 6]" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <ellipse cx="-7" cy="-8" rx="7" ry="5" fill="white" opacity="0.3" />
      </g>
      <g transform="translate(214 44) scale(0.8)"><use href="#nube-base" /></g>
    </template>

    <!-- ══ El Fuzz cayendo en su mundo ══ -->
    <template v-else-if="escena === 'caida-fuzz'">
      <!-- Planeta abajo -->
      <circle cx="214" cy="330" r="150" :fill="oscurecer('#29A9E0', 0.8)" :stroke="CONTORNO" :stroke-width="GROSOR" />
      <circle cx="214" cy="322" r="150" fill="#4FC3F7" :stroke="CONTORNO" :stroke-width="GROSOR" />
      <ellipse cx="150" cy="230" rx="34" ry="16" fill="white" opacity="0.25" />
      <!-- Estela de la caida -->
      <path d="M 300 30 Q 260 90 214 150" stroke="white" stroke-width="5" fill="none" stroke-dasharray="10 12" opacity="0.6" stroke-linecap="round" />
      <!-- El Fuzz cayendo -->
      <g transform="translate(214 160) scale(0.9)" class="escena__cae">
        <use href="#fuzz-base" />
      </g>
    </template>

    <!-- ══ Presentacion del Fuzz: no sabe parar ══ -->
    <template v-else-if="escena === 'pip-presentacion'">
      <!-- Camino de casillas -->
      <g>
        <g v-for="i in 5" :key="i" :transform="`translate(${76 + (i - 1) * 62} 190)`">
          <rect x="-26" y="-18" width="52" height="52" rx="12" fill="#B07B3E" :stroke="CONTORNO" :stroke-width="GROSOR" />
          <rect x="-26" y="-26" width="52" height="52" rx="12" fill="#E8C88A" :stroke="CONTORNO" :stroke-width="GROSOR" />
        </g>
      </g>
      <!-- El Fuzz rodando por el camino -->
      <g transform="translate(76 178)" class="escena__rueda">
        <use href="#fuzz-base" />
      </g>
      <!-- Flechitas de movimiento -->
      <g stroke="white" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8">
        <path d="M 300 178 L 330 178 M 320 168 L 332 178 L 320 188" />
      </g>
      <g transform="translate(214 66) scale(0.75)"><use href="#nube-base" /></g>
    </template>

    <!-- ══ Las flechas que el nino usa ══ -->
    <template v-else-if="escena === 'flechas'">
      <g
        v-for="(giro, i) in [0, 90, 180, 270]"
        :key="i"
        :transform="`translate(${94 + i * 80} 160)`"
        class="escena__ficha"
        :style="{ animationDelay: `${i * 130}ms` }"
      >
        <rect x="-34" y="-26" width="68" height="68" rx="18" fill="var(--pieza-azul-bisel)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <rect x="-34" y="-34" width="68" height="68" rx="18" fill="var(--pieza-azul)" :stroke="CONTORNO" :stroke-width="GROSOR" />
        <g :transform="`rotate(${giro})`">
          <path d="M -14 0 H 8 M 3 -11 L 16 0 L 3 11" stroke="white" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
      <g transform="translate(214 62) scale(0.75)"><use href="#nube-base" /></g>
      <g transform="translate(214 252) scale(0.7)"><use href="#fuzz-base" /></g>
    </template>

    <!-- ══ El Fuzz rescatado ══ -->
    <template v-else-if="escena === 'fuzz-rescatado'">
      <!-- Destellos de celebracion -->
      <g>
        <path
          v-for="i in 10"
          :key="i"
          class="escena__chispa"
          :style="{ animationDelay: `${i * 80}ms` }"
          :transform="`translate(${214 + Math.cos((i / 10) * 6.28) * 110} ${150 + Math.sin((i / 10) * 6.28) * 80})`"
          d="M 0,-12 Q 2,-2 12,0 Q 2,2 0,12 Q -2,2 -12,0 Q -2,-2 0,-12 Z"
          fill="#FFC93C"
          :stroke="CONTORNO"
          stroke-width="3"
        />
      </g>
      <g transform="translate(214 150) scale(1.5)" class="escena__salta">
        <use href="#fuzz-base" />
      </g>
      <g transform="translate(214 264) scale(0.7)"><use href="#nube-base" /></g>
    </template>

    <!-- Escena desconocida: se dibuja el Fuzz, nunca un hueco vacio. -->
    <template v-else>
      <g transform="translate(214 150) scale(1.4)"><use href="#fuzz-base" /></g>
    </template>
  </svg>
</template>

<style scoped>
.escena {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.escena__nube {
  animation: flotar 4s ease-in-out infinite;
}

.escena__nube-agitada {
  animation: temblor 500ms ease-in-out infinite;
}

.escena__fuzz-nido {
  animation: entrar-pieza 480ms var(--rebote) backwards;
}

.escena__planeta {
  animation: entrar-pieza 420ms var(--rebote) backwards;
}

.escena__ficha {
  animation: entrar-pieza 460ms var(--rebote) backwards;
}

.escena__chispa {
  animation: destello 1.4s ease-in-out infinite;
}

/* El rayo aparece a golpes, como un relampago de verdad. */
.escena__rayo {
  animation: relampago 2.2s steps(1) infinite;
}
.escena__rayo--2 {
  animation-delay: 700ms;
}

@keyframes relampago {
  0%,
  8%,
  16%,
  100% {
    opacity: 1;
  }
  4%,
  12%,
  20% {
    opacity: 0.1;
  }
}

/* Los Fuzzes salen despedidos por la tormenta. */
.escena__vuela {
  animation: salir-despedido 2.6s ease-in-out infinite;
}
.escena__vuela--2 {
  animation-delay: 300ms;
}
.escena__vuela--3 {
  animation-delay: 600ms;
}

@keyframes salir-despedido {
  0% {
    transform: translate(var(--x, 0), 0) scale(0.6) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate(0, -120px) scale(0.2) rotate(320deg);
    opacity: 0;
  }
}

.escena__cae {
  animation: caer 2.4s ease-in infinite;
}

@keyframes caer {
  0% {
    transform: translate(300px, 30px) scale(0.4) rotate(0deg);
    opacity: 0;
  }
  25% {
    opacity: 1;
  }
  100% {
    transform: translate(214px, 160px) scale(0.9) rotate(380deg);
    opacity: 1;
  }
}

/* Rueda de un lado a otro sin parar: es justo lo que Nube esta contando. */
.escena__rueda {
  animation: rodar-camino 3s ease-in-out infinite;
}

@keyframes rodar-camino {
  0% {
    transform: translate(76px, 178px) rotate(0deg);
  }
  100% {
    transform: translate(324px, 178px) rotate(720deg);
  }
}

.escena__salta {
  animation: rebote-suave 700ms ease-in-out infinite;
}
</style>
