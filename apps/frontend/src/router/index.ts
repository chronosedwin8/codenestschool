import { createRouter, createWebHistory } from 'vue-router';

import { leerToken, rolDelToken } from '@/api/cliente';

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
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/actividad/:id',
      name: 'actividad',
      component: () => import('@/views/ActividadView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/mecanografia',
      name: 'mecanografia',
      component: () => import('@/views/MecanografiaView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/mecanografia/practica',
      name: 'practica-teclado',
      component: () => import('@/views/PracticaTecladoView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/mecanografia/leccion/:clave',
      name: 'leccion-teclado',
      component: () => import('@/views/LeccionTecladoView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/proyectos',
      name: 'proyectos',
      component: () => import('@/views/ProyectosView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/constructor/:id',
      name: 'constructor',
      component: () => import('@/views/ConstructorView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      // La zona de juegos la ven los estudiantes y tambien el docente: es su
      // clase la que publica, y quiere poder jugar lo que hacen.
      path: '/juegos',
      name: 'juegos',
      component: () => import('@/views/JuegosView.vue'),
      meta: { requiereSesion: true },
    },
    {
      path: '/jugar/:id',
      name: 'jugar',
      component: () => import('@/views/JugarJuegoView.vue'),
      meta: { requiereSesion: true },
    },
    {
      // El diploma es publico a proposito: se abre con el codigo y sin sesion,
      // para que la familia pueda comprobarlo desde su telefono.
      path: '/diploma/:codigo',
      name: 'diploma',
      component: () => import('@/views/DiplomaView.vue'),
    },
    {
      path: '/tienda',
      name: 'tienda',
      component: () => import('@/views/TiendaView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/mis-datos',
      name: 'mis-datos',
      component: () => import('@/views/MisDatosView.vue'),
      meta: { requiereSesion: true, soloJugadores: true },
    },
    {
      path: '/portal',
      name: 'portal',
      component: () => import('@/views/PortalView.vue'),
      meta: { requiereSesion: true, soloAdultos: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiereSesion: true, soloAdmin: true },
    },
    {
      // Publica a proposito: la abre compras de un colegio, sin cuenta. El token
      // de 64 caracteres es lo que la protege, no la sesion.
      path: '/documento/:tipo(factura|cotizacion)/:token',
      name: 'documento',
      component: () => import('@/views/DocumentoView.vue'),
    },
    {
      path: '/portal/docente',
      name: 'docente',
      component: () => import('@/views/DocenteView.vue'),
      meta: { requiereSesion: true, soloAdultos: true },
    },
    {
      path: '/diseno',
      name: 'diseno',
      component: () => import('@/views/DisenoView.vue'),
    },
    { path: '/:resto(.*)*', redirect: '/' },
  ],
});

/**
 * Cada rol en su sitio.
 *
 * El juego es de los estudiantes y el panel es de los adultos. No es solo una
 * cuestion de orden: un adulto que abre una actividad y la resuelve genera
 * progreso, estrellas y monedas en su propia cuenta, y ese ruido acaba en los
 * agregados del aula. La puerta de verdad esta en el servidor (`exigirJugador`);
 * esto evita que alguien llegue a una pantalla que no le va a funcionar.
 */
const ROLES_ADULTOS = ['tutor', 'docente', 'admin_escuela', 'admin'];

router.beforeEach((destino) => {
  if (destino.meta.requiereSesion && !leerToken()) {
    return { name: 'entrar', query: { volverA: destino.fullPath } };
  }

  const rol = rolDelToken();
  if (!rol) return true;

  const esAdulto = ROLES_ADULTOS.includes(rol);

  /*
   * Al juego entran los estudiantes y los adultos del colegio: un docente no
   * puede explicar el lunes un mundo que no ha jugado, y un administrador tiene
   * que poder ver lo que compra. Su progreso es suyo y no cuenta para ningun
   * aula (las estadisticas se calculan sobre los estudiantes inscritos).
   *
   * La familia no: su cuenta sirve para acompanar y pagar, y jugar con ella
   * mezclaria su progreso con el de su hijo en el mismo portal.
   */
  if (destino.meta.soloJugadores && rol === 'tutor') {
    return { name: 'portal' };
  }
  if (destino.meta.soloAdultos && !esAdulto) {
    return { name: 'mapa' };
  }
  if (destino.meta.soloAdmin && rol !== 'admin') {
    return esAdulto ? { name: 'portal' } : { name: 'mapa' };
  }

  return true;
});
