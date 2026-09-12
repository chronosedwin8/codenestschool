/**
 * Mecanografía: el mapa, el teclado y los resultados.
 *
 * El teclado se pide una vez y se queda: son cinco filas de teclas y nueve dedos
 * que no cambian mientras el niño practica. Va en el servidor y no compilado en
 * el paquete del navegador porque de la misma tabla salen el dibujo y el dedo de
 * cada tecla, y tenerla en dos sitios es tenerla mal en uno de los dos.
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { api } from '@/api/cliente';

export interface TeclaApi {
  readonly base: string;
  readonly alta?: string;
  readonly etiqueta?: string;
  readonly dedo: string;
  readonly ancho?: number;
  readonly reposo?: boolean;
  readonly muerta?: boolean;
  readonly funcion?: 'mayus' | 'borrar' | 'entrar' | 'tab';
}

export interface DedoApi {
  readonly clave: string;
  readonly nombre: string;
  readonly mano: string;
  readonly color: string;
}

export interface JuegoApi {
  readonly clave: 'ola' | 'pesca' | 'carrera';
  readonly nombre: string;
  readonly que: string;
  readonly entrena: string;
  readonly icono: string;
  readonly escenario: string;
}

export interface Teclado {
  readonly filas: readonly (readonly TeclaApi[])[];
  readonly dedos: readonly DedoApi[];
  readonly acentuadas: Record<string, string>;
  readonly juegos: readonly JuegoApi[];
  readonly palabras: readonly string[];
}

export interface LeccionMapa {
  readonly clave: string;
  readonly zona: 'playa' | 'laguna' | 'cima';
  readonly orden: number;
  readonly nombre: string;
  readonly teclasNuevas: readonly string[];
  readonly consejo: string;
  readonly caracteres: number;
  readonly estrellas: number;
  readonly mejorPpm: number;
  readonly mejorPrecision: number;
  readonly completada: boolean;
  readonly desbloqueada: boolean;
}

export interface ZonaMapa {
  readonly clave: 'playa' | 'laguna' | 'cima';
  readonly nombre: string;
  readonly grado: string;
  readonly descripcion: string;
  readonly icono: string;
  readonly color: string;
  readonly lecciones: readonly LeccionMapa[];
  readonly completadas: number;
  readonly estrellas: number;
}

export interface ResumenTeclado {
  readonly mejorPpm: number;
  readonly ultimaPpm: number;
  readonly ultimaPrecision: number;
  readonly leccionesCompletadas: number;
  readonly leccionesTotales: number;
  readonly estrellas: number;
  readonly minutosPracticados: number;
  readonly teclasDificiles: readonly { readonly tecla: string; readonly errores: number }[];
}

export interface LeccionCompleta {
  readonly clave: string;
  readonly zona: 'playa' | 'laguna' | 'cima';
  readonly orden: number;
  readonly nombre: string;
  readonly teclasNuevas: readonly string[];
  readonly texto: string;
  readonly precision: readonly [number, number, number];
  readonly ppm: readonly [number, number, number];
  readonly consejo: string;
}

export interface ResultadoLeccion {
  readonly ppm: number;
  readonly precision: number;
  readonly estrellas: number;
  readonly mejorPpm: number;
  readonly esRecord: boolean;
  readonly falta: { readonly falta: 'precision' | 'velocidad' | 'nada'; readonly objetivo: number };
  readonly insignias: readonly { readonly clave: string; readonly nombre: string; readonly icono: string }[];
  readonly siguiente: string | null;
}

export const useMecanografiaStore = defineStore('mecanografia', () => {
  const teclado = ref<Teclado | null>(null);
  const zonas = ref<readonly ZonaMapa[]>([]);
  const resumen = ref<ResumenTeclado | null>(null);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  /**
   * Si se escribe con el teclado en pantalla.
   *
   * Se decide por si el aparato tiene pantalla táctil y poco ancho, no por el
   * "user agent": un portátil táctil tiene teclado de verdad y debe usarlo, y un
   * móvil grande no lo tiene aunque su pantalla mida mucho.
   */
  const esTactil = computed(() => {
    if (typeof window === 'undefined') return false;
    const tactil = window.matchMedia('(pointer: coarse)').matches;
    const sinTeclado = window.matchMedia('(hover: none)').matches;
    return tactil && sinTeclado;
  });

  const totalEstrellas = computed(() => zonas.value.reduce((suma, z) => suma + z.estrellas, 0));

  async function cargarTeclado(): Promise<void> {
    if (teclado.value) return;
    teclado.value = await api.get<Teclado>('/mecanografia/teclado');
  }

  async function cargarMapa(): Promise<void> {
    cargando.value = true;
    error.value = null;
    try {
      await cargarTeclado();
      const datos = await api.get<{ zonas: ZonaMapa[]; resumen: ResumenTeclado }>('/mecanografia');
      zonas.value = datos.zonas;
      resumen.value = datos.resumen;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudo cargar la mecanografia';
    } finally {
      cargando.value = false;
    }
  }

  async function cargarLeccion(clave: string): Promise<LeccionCompleta> {
    await cargarTeclado();
    const datos = await api.get<{ leccion: LeccionCompleta }>(`/mecanografia/leccion/${clave}`);
    return datos.leccion;
  }

  async function enviarResultado(
    clave: string,
    resultado: {
      correctos: number;
      errores: number;
      milisegundos: number;
      erroresPorTecla: Record<string, number>;
    },
  ): Promise<ResultadoLeccion> {
    return api.post<ResultadoLeccion>(`/mecanografia/leccion/${clave}`, resultado);
  }

  async function enviarPractica(datos: {
    juego: 'ola' | 'pesca' | 'carrera';
    palabras: number;
    correctos: number;
    errores: number;
    milisegundos: number;
    puntos: number;
  }): Promise<{ ppm: number; precision: number; mejorPpm: number }> {
    return api.post('/mecanografia/practica', datos);
  }

  return {
    teclado,
    zonas,
    resumen,
    cargando,
    error,
    esTactil,
    totalEstrellas,
    cargarTeclado,
    cargarMapa,
    cargarLeccion,
    enviarResultado,
    enviarPractica,
  };
});
