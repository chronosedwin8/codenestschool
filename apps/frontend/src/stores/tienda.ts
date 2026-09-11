/**
 * La tienda y lo que el Fuzz lleva puesto.
 *
 * Es un store y no una llamada dentro de la vista porque tres pantallas
 * necesitan lo mismo: la tienda para comprar, el mapa para dibujar el avatar y
 * la actividad para pintar al Fuzz de su color y aplicar sus poderes. Si cada
 * una lo pidiera por su cuenta, el niño compraría un gorro rosa y su Fuzz
 * seguiría azul dentro del juego hasta recargar la página.
 *
 * El servidor manda: aquí no se calcula ningún precio ni se decide si algo se
 * puede comprar. Lo que llega ya viene resuelto (`colorFuzz`, `efectos`), así
 * que el juego no tiene que conocer el catálogo.
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { api } from '@/api/cliente';

export type TipoArticulo =
  | 'color'
  | 'sombrero'
  | 'gafas'
  | 'disfraz'
  | 'accesorio'
  | 'poder'
  | 'pocion'
  | 'mundo';

export type TipoEquipable = 'color' | 'sombrero' | 'gafas' | 'disfraz' | 'accesorio';

export interface Articulo {
  readonly clave: string;
  readonly nombre: string;
  readonly tipo: TipoArticulo;
  readonly descripcion: string | null;
  readonly costoEstrellas: number;
  readonly datos: { readonly hex?: string; readonly forma?: string; readonly efecto?: string } | null;
  readonly mundosNecesarios: number | null;
  readonly tengo: boolean;
  readonly cantidad: number;
  readonly equipado: boolean;
  readonly puedoComprar: boolean;
  readonly motivo: string | null;
}

export interface Aspecto {
  readonly color: string | null;
  readonly sombrero: string | null;
  readonly gafas: string | null;
  readonly disfraz: string | null;
  readonly accesorio: string | null;
  readonly poderes: readonly string[];
  readonly pocion: string | null;
}

interface VistaTienda {
  readonly estrellasDisponibles: number;
  readonly estrellasTotales: number;
  readonly aspecto: Aspecto;
  readonly colorFuzz: string;
  readonly efectos: { readonly poderes: readonly string[]; readonly pocion: string | null };
  readonly articulos: readonly Articulo[];
}

const ASPECTO_VACIO: Aspecto = {
  color: null,
  sombrero: null,
  gafas: null,
  disfraz: null,
  accesorio: null,
  poderes: [],
  pocion: null,
};

export const COLOR_DE_FABRICA = '#1FA2FF';

/** Orden en que se muestran las secciones: primero lo barato y lo visible. */
export const ORDEN_TIPOS: readonly { tipo: TipoArticulo; titulo: string; icono: string }[] = [
  { tipo: 'color', titulo: 'Colores', icono: '🎨' },
  { tipo: 'sombrero', titulo: 'Gorros', icono: '🎩' },
  { tipo: 'gafas', titulo: 'Gafas', icono: '👓' },
  { tipo: 'accesorio', titulo: 'Accesorios', icono: '🧣' },
  { tipo: 'disfraz', titulo: 'Disfraces', icono: '🦖' },
  { tipo: 'poder', titulo: 'Poderes', icono: '✨' },
  { tipo: 'pocion', titulo: 'Pociones', icono: '🧪' },
  { tipo: 'mundo', titulo: 'Mundos', icono: '🌍' },
];

export const useTiendaStore = defineStore('tienda', () => {
  const articulos = ref<readonly Articulo[]>([]);
  const aspecto = ref<Aspecto>(ASPECTO_VACIO);
  const colorFuzz = ref(COLOR_DE_FABRICA);
  const efectos = ref<{ poderes: readonly string[]; pocion: string | null }>({
    poderes: [],
    pocion: null,
  });
  const estrellasDisponibles = ref(0);
  const estrellasTotales = ref(0);

  const cargada = ref(false);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  /** Lo que el juego necesita para dibujar al Fuzz con sus cosas puestas. */
  const adornos = computed(() => ({
    color: colorFuzz.value,
    sombrero: formaDe('sombrero'),
    gafas: formaDe('gafas'),
    accesorio: formaDe('accesorio'),
    disfraz: formaDe('disfraz'),
  }));

  /** Del hueco equipado a la forma que sabe dibujar el avatar. */
  function formaDe(tipo: TipoEquipable): string | null {
    const clave = aspecto.value[tipo];
    if (!clave) return null;
    const item = articulos.value.find((a) => a.clave === clave);
    return item?.datos?.forma ?? null;
  }

  function aplicar(vista: VistaTienda): void {
    articulos.value = vista.articulos;
    aspecto.value = vista.aspecto;
    colorFuzz.value = vista.colorFuzz;
    efectos.value = { poderes: vista.efectos.poderes, pocion: vista.efectos.pocion };
    estrellasDisponibles.value = vista.estrellasDisponibles;
    estrellasTotales.value = vista.estrellasTotales;
    cargada.value = true;
  }

  async function cargar(forzar = false): Promise<void> {
    if (cargando.value) return;
    if (cargada.value && !forzar) return;
    cargando.value = true;
    error.value = null;
    try {
      aplicar(await api.get<VistaTienda>('/tienda'));
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No se pudo abrir la tienda';
    } finally {
      cargando.value = false;
    }
  }

  /**
   * Compra.
   *
   * Devuelve el artículo comprado para que la vista pueda celebrarlo. Después se
   * recarga todo: al gastar estrellas cambian los motivos de la mitad del
   * catálogo ("te faltan 3 estrellas" ya no es verdad), y calcularlo aquí sería
   * repetir en el navegador una cuenta que el servidor ya hizo.
   */
  async function comprar(clave: string): Promise<Articulo | null> {
    const comprado = articulos.value.find((a) => a.clave === clave) ?? null;
    await api.post('/tienda/comprar', { clave });
    await cargar(true);
    return comprado;
  }

  async function equipar(tipo: TipoEquipable, clave: string | null): Promise<void> {
    await api.post('/tienda/equipar', { tipo, clave });
    await cargar(true);
  }

  async function cambiarPoder(clave: string, encendido: boolean): Promise<void> {
    await api.post('/tienda/poder', { clave, encendido });
    await cargar(true);
  }

  async function usar(clave: string): Promise<{ mundoAbierto: number | null }> {
    const respuesta = await api.post<{ mundoAbierto: number | null }>('/tienda/usar', { clave });
    await cargar(true);
    return respuesta;
  }

  /**
   * Lo que sabemos sin haber abierto la tienda.
   *
   * La actividad no puede esperar a que cargue el catálogo para pintar al Fuzz,
   * así que se le pasa lo puesto en cuanto llega y, mientras no llegue, el color
   * de fábrica. Nunca se queda sin dibujar por esto.
   */
  const listoParaJugar = computed(() => cargada.value);

  return {
    articulos,
    aspecto,
    colorFuzz,
    efectos,
    estrellasDisponibles,
    estrellasTotales,
    adornos,
    cargada,
    cargando,
    error,
    listoParaJugar,
    cargar,
    comprar,
    equipar,
    cambiarPoder,
    usar,
  };
});
