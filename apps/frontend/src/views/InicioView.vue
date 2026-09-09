<script setup lang="ts">
/**
 * Pantalla de entrada.
 *
 * Provisional: en la fase 3 la sustituye el mapa de mundos. Sirve de acceso al
 * sistema de diseño mientras se construye el juego.
 */
import { RouterLink } from 'vue-router';

import FuzzAvatar from '@/components/FuzzAvatar.vue';
</script>

<template>
  <main class="inicio">
    <FuzzAvatar :tamano="200" expresion="feliz" />
    <h1>CodeNest School</h1>
    <p>Aprende a programar jugando, desde los cuatro anos.</p>
    <RouterLink to="/diseno" class="enlace">Ver el sistema de diseno</RouterLink>
  </main>
</template>

<style scoped>
.inicio {
  display: grid;
  place-items: center;
  gap: var(--espacio-4);
  min-height: 100vh;
  padding: var(--espacio-6);
  text-align: center;
}

.inicio p {
  max-width: 30ch;
  margin: 0;
  color: var(--gris-oscuro);
}

.enlace {
  padding: var(--espacio-3) var(--espacio-5);
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
  color: white;
  text-decoration: none;
  background: var(--azul-neon);
  border-bottom: 4px solid var(--azul-neon-oscuro);
  border-radius: var(--radio-lg);
  box-shadow: var(--relieve);
}
</style>
