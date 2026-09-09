import { createRouter, createWebHistory } from 'vue-router';

/**
 * Rutas de la aplicacion. Todo se carga de forma diferida: un explorador de
 * cuatro anos no debe descargar Blockly ni Monaco para jugar en el mundo 1.
 */
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'inicio',
      component: () => import('@/views/InicioView.vue'),
    },
    {
      path: '/diseno',
      name: 'diseno',
      component: () => import('@/views/DisenoView.vue'),
    },
  ],
});
