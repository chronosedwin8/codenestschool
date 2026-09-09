<script setup lang="ts">
/**
 * Una ficha de comando: la unidad con la que programan los prelectores.
 *
 * Sin una palabra escrita. Una flecha gruesa con el borde redondeado dice
 * "muévete hacia allá" a cualquier niño de cuatro años, en cualquier idioma.
 * Las estructuras (repetir, condicional) usan símbolos igualmente reconocibles:
 * una flecha circular para el bucle, una ficha de color para el condicional.
 */
import { computed } from 'vue';

export type ClaseFicha =
  | 'derecha'
  | 'izquierda'
  | 'arriba'
  | 'abajo'
  | 'saltar'
  | 'recoger'
  | 'repetir'
  | 'siColor'
  | 'siSino'
  | 'funcion';

const props = withDefaults(
  defineProps<{
    comando: ClaseFicha;
    /** Número de repeticiones, solo en la ficha de bucle. */
    veces?: number;
    /** Color que dispara el condicional. */
    color?: string;
    tamano?: number;
    /** La ficha ya colocada en el programa se ve algo distinta. */
    colocada?: boolean;
    fantasma?: boolean;
    resaltada?: boolean;
  }>(),
  { veces: 2, color: 'rojo', tamano: 84, colocada: false, fantasma: false, resaltada: false },
);

/** Cada comando tiene su color propio, constante en toda la aplicación. */
const TONOS: Record<ClaseFicha, { fondo: string; borde: string }> = {
  derecha: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  izquierda: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  arriba: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  abajo: { fondo: 'var(--azul-neon)', borde: 'var(--azul-neon-oscuro)' },
  saltar: { fondo: 'var(--verde-cesped)', borde: 'var(--verde-cesped-oscuro)' },
  recoger: { fondo: 'var(--amarillo)', borde: 'var(--amarillo-oscuro)' },
  repetir: { fondo: 'var(--naranja)', borde: 'var(--naranja-oscuro)' },
  siColor: { fondo: 'var(--magenta)', borde: 'var(--magenta-oscuro)' },
  siSino: { fondo: 'var(--magenta)', borde: 'var(--magenta-oscuro)' },
  funcion: { fondo: 'var(--morado)', borde: 'var(--morado-oscuro)' },
};

/** Giro de la flecha según la dirección. */
const GIRO: Partial<Record<ClaseFicha, number>> = {
  derecha: 0,
  abajo: 90,
  izquierda: 180,
  arriba: 270,
};

const COLORES_CASILLA: Record<string, string> = {
  rojo: '#EF4444',
  azul: '#1FA2FF',
  verde: '#5AD35A',
  amarillo: '#FFD93D',
  magenta: '#FF3CAC',
  naranja: '#FF8A3D',
};

const esFlecha = computed(() => props.comando in GIRO);
const tono = computed(() => TONOS[props.comando]);
const giro = computed(() => GIRO[props.comando] ?? 0);

/** Descripción para lectores de pantalla y para el modo de accesibilidad. */
const descripcion = computed(() => {
  switch (props.comando) {
    case 'derecha':
      return 'Ir a la derecha';
    case 'izquierda':
      return 'Ir a la izquierda';
    case 'arriba':
      return 'Ir hacia arriba';
    case 'abajo':
      return 'Ir hacia abajo';
    case 'saltar':
      return 'Saltar';
    case 'recoger':
      return 'Recoger';
    case 'repetir':
      return `Repetir ${props.veces} veces`;
    case 'siColor':
      return `Si la casilla es de color ${props.color}`;
    case 'siSino':
      return 'Si pasa esto, si no lo otro';
    case 'funcion':
      return 'Super salto';
    default:
      return 'Ficha';
  }
});
</script>

<template>
  <div
    class="ficha"
    :class="{
      'ficha--colocada': colocada,
      'ficha--fantasma': fantasma,
      'ficha--resaltada': resaltada,
    }"
    :style="{
      '--ficha-fondo': tono.fondo,
      '--ficha-borde': tono.borde,
      '--ficha-tam': `${tamano}px`,
    }"
    role="img"
    :aria-label="descripcion"
  >
    <!-- Flechas de dirección -->
    <svg
      v-if="esFlecha"
      viewBox="0 0 48 48"
      class="ficha__svg"
      :style="{ transform: `rotate(${giro}deg)` }"
      aria-hidden="true"
    >
      <path
        d="M 10 24 H 28 M 24 14 L 34 24 L 24 34"
        stroke="white"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>

    <!-- Salto: arco con impulso -->
    <svg v-else-if="comando === 'saltar'" viewBox="0 0 48 48" class="ficha__svg" aria-hidden="true">
      <path
        d="M 10 34 Q 24 6 38 34"
        stroke="white"
        stroke-width="6"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="10" cy="34" r="4" fill="white" />
      <circle cx="38" cy="34" r="4" fill="white" />
    </svg>

    <!-- Recoger: estrella -->
    <svg v-else-if="comando === 'recoger'" viewBox="0 0 48 48" class="ficha__svg" aria-hidden="true">
      <path
        d="M 24 8 L 29 19 L 41 20 L 32 28 L 35 40 L 24 34 L 13 40 L 16 28 L 7 20 L 19 19 Z"
        fill="var(--tinta)"
      />
    </svg>

    <!-- Repetir: flecha circular con el número de vueltas -->
    <template v-else-if="comando === 'repetir'">
      <svg viewBox="0 0 48 48" class="ficha__svg" aria-hidden="true">
        <path
          d="M 36 20 A 14 14 0 1 0 24 38"
          stroke="white"
          stroke-width="6"
          stroke-linecap="round"
          fill="none"
        />
        <path d="M 30 8 L 38 18 L 27 21 Z" fill="white" />
      </svg>
      <span class="ficha__contador">{{ veces }}</span>
    </template>

    <!-- Condicional de color: la ficha muestra el color que hay que detectar -->
    <template v-else-if="comando === 'siColor'">
      <svg viewBox="0 0 48 48" class="ficha__svg" aria-hidden="true">
        <path
          d="M 24 8 L 24 22 M 24 22 L 12 34 M 24 22 L 36 34"
          stroke="white"
          stroke-width="6"
          stroke-linecap="round"
          fill="none"
        />
      </svg>
      <span
        class="ficha__muestra"
        :style="{ background: COLORES_CASILLA[color] ?? color }"
        aria-hidden="true"
      />
    </template>

    <!-- Si / si no: el camino se bifurca -->
    <svg v-else-if="comando === 'siSino'" viewBox="0 0 48 48" class="ficha__svg" aria-hidden="true">
      <path
        d="M 24 6 L 24 20 M 24 20 L 10 36 M 24 20 L 38 36"
        stroke="white"
        stroke-width="6"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="10" cy="38" r="4" fill="white" />
      <circle cx="38" cy="38" r="4" fill="white" />
    </svg>

    <!-- Función: paquete de instrucciones -->
    <svg v-else viewBox="0 0 48 48" class="ficha__svg" aria-hidden="true">
      <rect x="9" y="12" width="30" height="24" rx="5" stroke="white" stroke-width="5" fill="none" />
      <path d="M 16 24 H 32" stroke="white" stroke-width="5" stroke-linecap="round" />
      <path d="M 24 12 V 36" stroke="white" stroke-width="5" stroke-linecap="round" />
    </svg>
  </div>
</template>

<style scoped>
.ficha {
  position: relative;
  display: grid;
  place-items: center;

  width: var(--ficha-tam);
  height: var(--ficha-tam);

  background: var(--ficha-fondo);
  border-bottom: 5px solid var(--ficha-borde);
  border-radius: var(--radio-lg);
  box-shadow: var(--relieve), var(--brillo-superior);

  touch-action: none; /* el gesto lo gestiona useArrastreFicha */
  user-select: none;
  cursor: grab;

  transition:
    transform var(--rapido) var(--rebote),
    box-shadow var(--rapido) ease;
}

.ficha:active {
  cursor: grabbing;
}

.ficha:hover {
  transform: translateY(-3px) scale(1.04);
}

.ficha__svg {
  width: 70%;
  height: 70%;
}

/* Ya colocada en el programa: un poco más pequeña y sin tanto realce. */
.ficha--colocada {
  box-shadow: 0 3px 0 var(--ficha-borde), 0 4px 8px rgb(0 0 0 / 0.12);
  border-bottom-width: 3px;
}

/* Copia que sigue al dedo mientras se arrastra. */
.ficha--fantasma {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(1.12) rotate(-4deg);
  box-shadow: 0 16px 28px rgb(0 0 0 / 0.3);
  opacity: 0.94;
}

/* La ficha que se está ejecutando ahora mismo. */
.ficha--resaltada {
  animation: pulso 600ms ease-in-out infinite;
  box-shadow:
    0 0 0 5px var(--amarillo),
    var(--relieve);
}

.ficha__contador {
  position: absolute;
  right: -6px;
  bottom: -6px;

  display: grid;
  place-items: center;
  min-width: 32px;
  height: 32px;
  padding: 0 var(--espacio-1);

  font-family: var(--fuente-titulo);
  font-size: var(--texto-base);
  color: var(--tinta);

  background: var(--amarillo);
  border: 3px solid white;
  border-radius: var(--radio-total);
}

.ficha__muestra {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 30px;
  height: 30px;
  border: 3px solid white;
  border-radius: var(--radio-total);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.2);
}
</style>
