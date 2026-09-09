<script setup lang="ts">
/**
 * Botón de megáfono: "escúchalo otra vez".
 *
 * Imprescindible en la interfaz de prelectores. Un niño que no entendió la
 * instrucción no puede volver a leerla, así que tiene que poder volver a oírla
 * cuantas veces quiera, sin penalización y sin buscar dónde está.
 *
 * Mientras suena la voz, las ondas del icono se animan: así se entiende que el
 * sonido viene de ahí, incluso con el volumen bajo.
 */
import { useAudioStore } from '@/stores/audio';

const audio = useAudioStore();

function repetir(): void {
  audio.desbloquear();
  void audio.repetir();
}
</script>

<template>
  <button
    type="button"
    class="megafono"
    :class="{ 'megafono--sonando': audio.hablando }"
    aria-label="Escuchar de nuevo"
    :disabled="!audio.ultimaVoz"
    @click="repetir"
  >
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <!-- Cuerpo del megáfono -->
      <path
        d="M 8 20 L 18 20 L 30 10 L 30 38 L 18 28 L 8 28 Z"
        fill="white"
        stroke="white"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <!-- Ondas de sonido -->
      <path
        class="onda onda--1"
        d="M 35 18 Q 39 24 35 30"
        stroke="white"
        stroke-width="3.5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        class="onda onda--2"
        d="M 40 13 Q 47 24 40 35"
        stroke="white"
        stroke-width="3.5"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  </button>
</template>

<style scoped>
.megafono {
  display: grid;
  place-items: center;

  width: var(--toque-min);
  height: var(--toque-min);

  background: var(--morado);
  border: none;
  border-bottom: 5px solid var(--morado-oscuro);
  border-radius: var(--radio-total);
  box-shadow: var(--relieve), var(--brillo-superior);

  transition:
    transform var(--rapido) ease,
    box-shadow var(--rapido) ease;
}

.megafono svg {
  width: 60%;
  height: 60%;
}

.megafono:active:not(:disabled) {
  transform: translateY(5px);
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.18), var(--relieve-hundido);
}

.megafono:disabled {
  opacity: 0.45;
  box-shadow: none;
  border-bottom-color: transparent;
}

/* Las ondas laten mientras la voz suena. */
.megafono--sonando {
  animation: pulso 900ms ease-in-out infinite;
}

.megafono--sonando .onda {
  animation: onda-sale 900ms ease-in-out infinite;
}

.megafono--sonando .onda--2 {
  animation-delay: 180ms;
}

@keyframes onda-sale {
  0%,
  100% {
    opacity: 0.35;
    transform: translateX(0);
  }
  50% {
    opacity: 1;
    transform: translateX(2px);
  }
}
</style>
