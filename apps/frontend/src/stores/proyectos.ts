/**
 * Los juegos del estudiante y el catálogo del constructor.
 *
 * El catálogo se pide una vez y se queda: son diez escenarios, ocho personajes y
 * unas listas de palabras que no cambian mientras el niño juega. Pedirlo en cada
 * pestaña del constructor serían seis peticiones para mover un desplegador.
 *
 * Guardar va con retardo (`autoguardar`). Un niño cambia un color, luego otro, y
 * luego el tamaño: sin retardo eso son tres peticiones y tres validaciones del
 * servidor para un solo gesto. Con medio segundo de espera es una.
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import type { DefinicionJuego } from '@codenest/shared';

import { api } from '@/api/cliente';

export interface OpcionCatalogo {
  readonly clave: string;
  readonly nombre: string;
  readonly pista?: string;
  readonly icono?: string;
}

export interface EscenarioCatalogo extends OpcionCatalogo {
  readonly imagenUrl: string | null;
  readonly musica: string;
}

export interface Catalogo {
  readonly escenarios: readonly EscenarioCatalogo[];
  readonly personajes: readonly OpcionCatalogo[];
  readonly obstaculos: readonly OpcionCatalogo[];
  readonly premios: readonly OpcionCatalogo[];
  readonly velocidades: readonly OpcionCatalogo[];
  readonly frecuencias: readonly OpcionCatalogo[];
  readonly tamanos: readonly OpcionCatalogo[];
  readonly movimientos: readonly OpcionCatalogo[];
  readonly controles: readonly OpcionCatalogo[];
  readonly metas: readonly OpcionCatalogo[];
  readonly eventos: readonly OpcionCatalogo[];
  readonly acciones: readonly OpcionCatalogo[];
  readonly colores: readonly string[];
  readonly limites: {
    readonly obstaculos: number;
    readonly premios: number;
    readonly reglas: number;
    readonly vidasMax: number;
    readonly puntosMeta: number;
    readonly segundosMeta: number;
    readonly puntosPorPremio: number;
  };
}

export interface ProyectoEnLista {
  readonly id: number;
  readonly titulo: string;
  readonly estado: 'borrador' | 'publicado';
  readonly portadaUrl: string | null;
  readonly partidas: number;
  readonly meGusta: number;
  readonly probado: boolean;
  readonly publicadoEn: string | null;
  readonly actualizadoEn: string;
}

export interface Aviso {
  readonly clave: string;
  readonly texto: string;
}

export interface ProyectoCompleto extends ProyectoEnLista {
  readonly definicion: DefinicionJuego;
  readonly autor: { readonly id: number; readonly nombre: string };
  readonly avisos: readonly Aviso[];
  readonly diploma: string | null;
}

export interface DiplomaPropio {
  readonly codigo: string;
  readonly tituloJuego: string;
  readonly emitidoEn: string;
  readonly proyectoId: number;
}

export interface JuegoPublicado {
  readonly id: number;
  readonly titulo: string;
  readonly portadaUrl: string | null;
  readonly partidas: number;
  readonly meGusta: number;
  readonly publicadoEn: string | null;
  readonly autor: string;
  readonly esMio: boolean;
  readonly leDiMeGusta: boolean;
}

export interface Insignia {
  readonly clave: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly icono: string;
  readonly rareza: string;
  /** Cierto solo la primera vez que se gana: es lo que se celebra. */
  readonly esNuevo?: boolean;
}

export interface ResultadoPublicacion {
  readonly proyecto: ProyectoEnLista;
  readonly diploma: {
    readonly codigo: string;
    readonly nombreAlumno: string;
    readonly tituloJuego: string;
    readonly emitidoEn: string;
    readonly esNuevo: boolean;
  };
  readonly insignias: readonly Insignia[];
}

const ESPERA_AUTOGUARDADO_MS = 600;

export const useProyectosStore = defineStore('proyectos', () => {
  const catalogo = ref<Catalogo | null>(null);
  const mios = ref<readonly ProyectoEnLista[]>([]);
  const misDiplomas = ref<readonly DiplomaPropio[]>([]);
  const publicados = ref<readonly JuegoPublicado[]>([]);

  /** El juego que está abierto en el constructor. */
  const actual = ref<ProyectoCompleto | null>(null);
  const definicion = ref<DefinicionJuego | null>(null);

  const cargando = ref(false);
  const guardando = ref(false);
  const error = ref<string | null>(null);

  let temporizador: number | null = null;

  const escenarioActual = computed<EscenarioCatalogo | null>(() => {
    const clave = definicion.value?.escenario;
    if (!clave) return null;
    return catalogo.value?.escenarios.find((e) => e.clave === clave) ?? null;
  });

  /** Nombre legible de una clave, para no repetir `find` en cada plantilla. */
  function nombreDe(lista: readonly OpcionCatalogo[] | undefined, clave: string): string {
    return lista?.find((o) => o.clave === clave)?.nombre ?? clave;
  }

  async function cargarCatalogo(): Promise<void> {
    if (catalogo.value) return;
    catalogo.value = await api.get<Catalogo>('/juegos/catalogo');
  }

  async function cargarMios(): Promise<void> {
    cargando.value = true;
    error.value = null;
    try {
      const datos = await api.get<{ proyectos: ProyectoEnLista[]; diplomas: DiplomaPropio[] }>(
        '/proyectos',
      );
      mios.value = datos.proyectos;
      misDiplomas.value = datos.diplomas;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudieron cargar tus juegos';
    } finally {
      cargando.value = false;
    }
  }

  async function crear(): Promise<ProyectoEnLista> {
    const { proyecto } = await api.post<{ proyecto: ProyectoEnLista }>('/proyectos', {});
    mios.value = [proyecto, ...mios.value];
    return proyecto;
  }

  async function abrir(id: number): Promise<void> {
    cargando.value = true;
    error.value = null;
    try {
      await cargarCatalogo();
      const { proyecto } = await api.get<{ proyecto: ProyectoCompleto }>(`/proyectos/${id}`);
      actual.value = proyecto;
      // Copia profunda: el constructor va a modificarla, y `actual` guarda lo
      // que dijo el servidor la ultima vez.
      definicion.value = JSON.parse(JSON.stringify(proyecto.definicion)) as DefinicionJuego;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudo abrir ese juego';
    } finally {
      cargando.value = false;
    }
  }

  function cerrar(): void {
    if (temporizador !== null) window.clearTimeout(temporizador);
    temporizador = null;
    actual.value = null;
    definicion.value = null;
  }

  /** Cambia la definición y programa el guardado. */
  function cambiar(nueva: DefinicionJuego): void {
    definicion.value = nueva;
    autoguardar();
  }

  function autoguardar(): void {
    if (temporizador !== null) window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => void guardar(), ESPERA_AUTOGUARDADO_MS);
  }

  async function guardar(): Promise<void> {
    const proyecto = actual.value;
    const def = definicion.value;
    if (!proyecto || !def || guardando.value) return;

    guardando.value = true;
    error.value = null;
    try {
      const { proyecto: guardado } = await api.put<{ proyecto: ProyectoEnLista }>(
        `/proyectos/${proyecto.id}`,
        { definicion: def },
      );
      actual.value = { ...proyecto, ...guardado, definicion: def };
      mios.value = mios.value.map((p) => (p.id === guardado.id ? guardado : p));
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudo guardar';
    } finally {
      guardando.value = false;
    }
  }

  async function otroTitulo(): Promise<void> {
    const proyecto = actual.value;
    if (!proyecto) return;
    const { titulo } = await api.post<{ titulo: string }>(`/proyectos/${proyecto.id}/titulo`, {});
    actual.value = { ...proyecto, titulo };
    mios.value = mios.value.map((p) => (p.id === proyecto.id ? { ...p, titulo } : p));
  }

  /** Se llama cuando el estudiante gana su propio juego probándolo. */
  async function marcarProbado(): Promise<void> {
    const proyecto = actual.value;
    if (!proyecto || proyecto.probado) return;
    await api.post(`/proyectos/${proyecto.id}/probado`, {});
    actual.value = { ...proyecto, probado: true };
    mios.value = mios.value.map((p) => (p.id === proyecto.id ? { ...p, probado: true } : p));
  }

  async function publicar(portada: string | null): Promise<ResultadoPublicacion> {
    const proyecto = actual.value;
    if (!proyecto) throw new Error('No hay ningun juego abierto');

    // Se guarda antes de publicar: publicar lo que está en pantalla, no lo que
    // había hace medio segundo.
    if (temporizador !== null) window.clearTimeout(temporizador);
    await guardar();

    const resultado = await api.post<ResultadoPublicacion>(
      `/proyectos/${proyecto.id}/publicar`,
      portada ? { portada } : {},
    );

    actual.value = { ...proyecto, ...resultado.proyecto, definicion: definicion.value! };
    mios.value = mios.value.map((p) => (p.id === proyecto.id ? resultado.proyecto : p));
    return resultado;
  }

  async function despublicar(): Promise<void> {
    const proyecto = actual.value;
    if (!proyecto) return;
    const { proyecto: nuevo } = await api.post<{ proyecto: ProyectoEnLista }>(
      `/proyectos/${proyecto.id}/despublicar`,
      {},
    );
    actual.value = { ...proyecto, ...nuevo, definicion: definicion.value! };
    mios.value = mios.value.map((p) => (p.id === proyecto.id ? nuevo : p));
  }

  async function borrar(id: number): Promise<void> {
    await api.delete(`/proyectos/${id}`);
    mios.value = mios.value.filter((p) => p.id !== id);
    if (actual.value?.id === id) cerrar();
  }

  // ───────────────────────── La zona publicada ─────────────────────────────

  async function cargarPublicados(orden: 'recientes' | 'populares' | 'jugados' = 'recientes'): Promise<void> {
    cargando.value = true;
    error.value = null;
    try {
      const datos = await api.get<{ juegos: JuegoPublicado[] }>(`/juegos?orden=${orden}`);
      publicados.value = datos.juegos;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudieron cargar los juegos';
    } finally {
      cargando.value = false;
    }
  }

  async function registrarPartida(id: number): Promise<void> {
    // Que no se pueda jugar porque el contador falló sería absurdo.
    await api.post(`/juegos/${id}/partida`, {}).catch(() => undefined);
  }

  async function alternarMeGusta(id: number): Promise<void> {
    const respuesta = await api.post<{ meGusta: number; leDiMeGusta: boolean }>(
      `/juegos/${id}/megusta`,
      {},
    );
    publicados.value = publicados.value.map((j) =>
      j.id === id ? { ...j, meGusta: respuesta.meGusta, leDiMeGusta: respuesta.leDiMeGusta } : j,
    );
  }

  return {
    catalogo,
    mios,
    misDiplomas,
    publicados,
    actual,
    definicion,
    escenarioActual,
    cargando,
    guardando,
    error,
    nombreDe,
    cargarCatalogo,
    cargarMios,
    crear,
    abrir,
    cerrar,
    cambiar,
    guardar,
    otroTitulo,
    marcarProbado,
    publicar,
    despublicar,
    borrar,
    cargarPublicados,
    registrarPartida,
    alternarMeGusta,
  };
});
