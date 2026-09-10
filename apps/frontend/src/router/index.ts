import { createRouter, createWebHistory } from 'vue-router';

import { leerToken } from '@/api/cliente';

/**
 * Rutas de la aplicacion.
 *
 * Todo se carga de forma diferida: un explorador de cuatro anos no debe
 * descargar Blockly ni Monaco para jugar en el mundo 1.
 */
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'entrar',
      component: () => import('@/views/EntrarView.vue'),
    },
    {
      path: '/mapa',
      name: 'mapa',
      component: () => import('@/views/MapaView.vue'),
      meta: { requiereSesion: true },
    },
    {
      path: '/actividad/:id',
      name: 'actividad',
      component: () => import('@/views/ActividadView.vue'),
      meta: { requiereSesion: true },
    },
    {
      path: '/portal',
      name: 'portal',
      component: () => import('@/views/PortalView.vue'),
      meta: { requiereSesion: true },
    },
    {
      path: '/portal/docente',
      name: 'docente',
      component: () => import('@/views/DocenteView.vue'),
      meta: { requiereSesion: true },
    },
    {
      path: '/diseno',
      name: 'diseno',
      component: () => import('@/views/DisenoView.vue'),
    },
    { path: '/:resto(.*)*', redirect: '/' },
  ],
});

/** Sin sesion no se puede jugar: se vuelve a la pantalla de entrada. */
router.beforeEach((destino) => {
  if (destino.meta.requiereSesion && !leerToken()) {
    return { name: 'entrar', query: { volverA: destino.fullPath } };
  }
  return true;
});
