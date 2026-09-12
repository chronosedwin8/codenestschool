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
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/actividad/:id',
      name: 'actividad',
      component: () => import('@/views/ActividadView.vue'),
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/mecanografia',
      name: 'mecanografia',
      component: () => import('@/views/MecanografiaView.vue'),
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/mecanografia/practica',
      name: 'practica-teclado',
      component: () => import('@/views/PracticaTecladoView.vue'),
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/mecanografia/leccion/:clave',
      name: 'leccion-teclado',
      component: () => import('@/views/LeccionTecladoView.vue'),
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/proyectos',
      name: 'proyectos',
      component: () => import('@/views/ProyectosView.vue'),
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/constructor/:id',
      name: 'constructor',
      component: () => import('@/views/ConstructorView.vue'),
      meta: { requiereSesion: true, soloEstudiantes: true },
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
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/mis-datos',
      name: 'mis-datos',
      component: () => import('@/views/MisDatosView.vue'),
      meta: { requiereSesion: true, soloEstudiantes: true },
    },
    {
      path: '/portal',
      name: 'portal',
      component: () => import('@/views/PortalView.vue'),
      meta: { requiereSesion: true, soloAdultos: true },
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

/**
 * Lee el rol del token sin verificarlo.
 *
 * Aqui no hace falta verificar nada: esto decide a que pantalla se navega, no a
 * que datos se accede. Manipular el token solo consigue llegar a una vista que
 * el servidor va a rechazar igual.
 */
function rolDelToken(): string | null {
  const token = leerToken();
  if (!token) return null;
  try {
    const carga = token.split('.')[1];
    if (!carga) return null;
    const json = atob(carga.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { rol?: string }).rol ?? null;
  } catch {
    return null;
  }
}

router.beforeEach((destino) => {
  if (destino.meta.requiereSesion && !leerToken()) {
    return { name: 'entrar', query: { volverA: destino.fullPath } };
  }

  const rol = rolDelToken();
  if (!rol) return true;

  const esAdulto = ROLES_ADULTOS.includes(rol);

  // Un adulto que pide el juego va a su panel; un estudiante que pide el panel
  // vuelve a su mapa. En los dos casos a algo util, no a un error.
  if (destino.meta.soloEstudiantes && esAdulto) {
    return { name: rol === 'tutor' ? 'portal' : 'docente' };
  }
  if (destino.meta.soloAdultos && !esAdulto) {
    return { name: 'mapa' };
  }

  return true;
});
