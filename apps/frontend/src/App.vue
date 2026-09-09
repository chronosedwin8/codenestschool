<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="desvanecer" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.desvanecer-enter-active,
.desvanecer-leave-active {
  transition: opacity var(--normal) ease;
}
.desvanecer-enter-from,
.desvanecer-leave-to {
  opacity: 0;
}
</style>
