/**
 * La tienda del Nido.
 *
 * Todo se paga con estrellas, que es lo único que el niño gana jugando. Dos
 * reglas atraviesan el catálogo:
 *
 *  1. Nada de lo que se compra da ventaja sobre otro niño. Aquí no se compite:
 *     los cosméticos son para verse y los poderes son para ENTENDER mejor lo que
 *     pasó, no para resolver por ti. Una cámara lenta que te deja ver dónde se
 *     torció tu programa enseña; un botón que lo resuelve, no.
 *  2. Los precios suben con la edad del contenido, no con lo llamativo. Un gorro
 *     cuesta poco porque el primer premio tiene que llegar pronto: un niño de
 *     cinco años que junta tres estrellas quiere gastarlas hoy.
 *
 * Un dato para calibrar: una actividad perfecta da 3 estrellas, un mundo entero
 * da 60. El catálogo está pensado para que algo se pueda comprar en la primera
 * sesión y lo más caro cueste aproximadamente un mundo.
 */

export type TipoItem =
  | 'color'
  | 'sombrero'
  | 'gafas'
  | 'accesorio'
  | 'disfraz'
  | 'poder'
  | 'pocion'
  | 'mundo';

export interface ItemTienda {
  readonly clave: string;
  readonly nombre: string;
  readonly tipo: TipoItem;
  readonly descripcion: string;
  readonly costoEstrellas: number;
  /** Datos propios del artículo: color en hexadecimal, efecto de un poder... */
  readonly datos?: Readonly<Record<string, unknown>>;
  /**
   * Cuantos mundos hay que haber terminado para poder comprarlo.
   *
   * Es una CUENTA y no un mundo concreto a proposito. Atado al mundo 7, el
   * sombrero pirata era inalcanzable para un nino de diez anos, que empieza en el
   * 21 y nunca va a jugar los mundos de los pequenos. Contando mundos, el mismo
   * requisito significa lo mismo para los tres grupos de edad.
   */
  readonly requiereMundos?: number;
  readonly orden: number;
}

/** Los colores del Fuzz. El primero es el de fábrica y no se compra. */
const COLORES: ItemTienda[] = [
  { clave: 'color-verde', nombre: 'Verde hierba', tipo: 'color', descripcion: 'Tu Fuzz se vuelve verde.', costoEstrellas: 6, datos: { hex: '#5AD35A' }, orden: 10 },
  { clave: 'color-rosa', nombre: 'Rosa chicle', tipo: 'color', descripcion: 'Tu Fuzz se vuelve rosa.', costoEstrellas: 6, datos: { hex: '#FF3CAC' }, orden: 11 },
  { clave: 'color-naranja', nombre: 'Naranja fuego', tipo: 'color', descripcion: 'Tu Fuzz se vuelve naranja.', costoEstrellas: 6, datos: { hex: '#FF8A3D' }, orden: 12 },
  { clave: 'color-morado', nombre: 'Morado noche', tipo: 'color', descripcion: 'Tu Fuzz se vuelve morado.', costoEstrellas: 9, datos: { hex: '#7B61FF' }, orden: 13 },
  { clave: 'color-amarillo', nombre: 'Amarillo sol', tipo: 'color', descripcion: 'Tu Fuzz se vuelve amarillo.', costoEstrellas: 9, datos: { hex: '#FFD93D' }, orden: 14 },
  { clave: 'color-turquesa', nombre: 'Turquesa mar', tipo: 'color', descripcion: 'Tu Fuzz se vuelve turquesa.', costoEstrellas: 12, datos: { hex: '#06B6D4' }, orden: 15 },
  { clave: 'color-rojo', nombre: 'Rojo volcan', tipo: 'color', descripcion: 'Tu Fuzz se vuelve rojo.', costoEstrellas: 12, datos: { hex: '#EF4444' }, orden: 16 },
  {
    clave: 'color-arcoiris',
    nombre: 'Arcoiris',
    tipo: 'color',
    descripcion: 'Tu Fuzz cambia de color solo. Para quien ya termino un mundo entero.',
    costoEstrellas: 45,
    datos: { hex: '#FF3CAC', animado: true },
    requiereMundos: 1,
    orden: 17,
  },
];

const SOMBREROS: ItemTienda[] = [
  { clave: 'gorro-lana', nombre: 'Gorro de lana', tipo: 'sombrero', descripcion: 'Para el Bioma Congelado y para presumir.', costoEstrellas: 8, datos: { forma: 'gorro' }, orden: 20 },
  { clave: 'gorro-fiesta', nombre: 'Cono de fiesta', tipo: 'sombrero', descripcion: 'Porque si.', costoEstrellas: 8, datos: { forma: 'fiesta' }, orden: 21 },
  { clave: 'gorro-pirata', nombre: 'Sombrero pirata', tipo: 'sombrero', descripcion: 'Con su calavera. Garfio lo aprobaria.', costoEstrellas: 15, datos: { forma: 'pirata' }, requiereMundos: 3, orden: 22 },
  { clave: 'gorro-mago', nombre: 'Sombrero de mago', tipo: 'sombrero', descripcion: 'Con estrellas de verdad.', costoEstrellas: 18, datos: { forma: 'mago' }, orden: 23 },
  { clave: 'gorro-casco', nombre: 'Casco espacial', tipo: 'sombrero', descripcion: 'Una burbuja para respirar en el espacio.', costoEstrellas: 24, datos: { forma: 'casco' }, requiereMundos: 5, orden: 24 },
  { clave: 'gorro-corona', nombre: 'Corona', tipo: 'sombrero', descripcion: 'Para quien ya termino diez mundos.', costoEstrellas: 40, datos: { forma: 'corona' }, requiereMundos: 10, orden: 25 },
];

const GAFAS: ItemTienda[] = [
  { clave: 'gafas-redondas', nombre: 'Gafas redondas', tipo: 'gafas', descripcion: 'De las de leer mucho.', costoEstrellas: 7, datos: { forma: 'redondas' }, orden: 30 },
  { clave: 'gafas-sol', nombre: 'Gafas de sol', tipo: 'gafas', descripcion: 'Para el Desierto de Algoritmos.', costoEstrellas: 10, datos: { forma: 'sol' }, orden: 31 },
  { clave: 'gafas-buceo', nombre: 'Gafas de buceo', tipo: 'gafas', descripcion: 'Para la Red Submarina.', costoEstrellas: 14, datos: { forma: 'buceo' }, requiereMundos: 2, orden: 32 },
  { clave: 'gafas-ciber', nombre: 'Visor ciber', tipo: 'gafas', descripcion: 'Una linea de luz que cruza la cara.', costoEstrellas: 22, datos: { forma: 'ciber' }, requiereMundos: 8, orden: 33 },
];

const ACCESORIOS: ItemTienda[] = [
  { clave: 'acc-bufanda', nombre: 'Bufanda', tipo: 'accesorio', descripcion: 'Ondea cuando el Fuzz rueda.', costoEstrellas: 9, datos: { forma: 'bufanda' }, orden: 40 },
  { clave: 'acc-capa', nombre: 'Capa', tipo: 'accesorio', descripcion: 'Toda historia mejora con una capa.', costoEstrellas: 16, datos: { forma: 'capa' }, orden: 41 },
  { clave: 'acc-mochila', nombre: 'Mochila', tipo: 'accesorio', descripcion: 'Para guardar las estrellas.', costoEstrellas: 12, datos: { forma: 'mochila' }, orden: 42 },
  { clave: 'acc-alas', nombre: 'Alas', tipo: 'accesorio', descripcion: 'No vuelan, pero se mueven.', costoEstrellas: 30, datos: { forma: 'alas' }, requiereMundos: 3, orden: 43 },
];

/** Disfraces: cubren el cuerpo entero, asi que van con un solo puesto. */
const DISFRACES: ItemTienda[] = [
  { clave: 'disfraz-buzo', nombre: 'Traje de buzo', tipo: 'disfraz', descripcion: 'Con su escafandra y sus burbujas.', costoEstrellas: 20, datos: { forma: 'buzo' }, requiereMundos: 2, orden: 45 },
  { clave: 'disfraz-robot', nombre: 'Traje de robot', tipo: 'disfraz', descripcion: 'Placas de metal y una antena.', costoEstrellas: 20, datos: { forma: 'robot' }, requiereMundos: 5, orden: 46 },
  { clave: 'disfraz-dino', nombre: 'Traje de dinosaurio', tipo: 'disfraz', descripcion: 'Con crestas en la espalda.', costoEstrellas: 26, datos: { forma: 'dino' }, requiereMundos: 4, orden: 47 },
];

/**
 * Poderes: permanentes, se encienden y se apagan, y ninguno resuelve nada.
 *
 * Es la linea que no se cruza. Un poder que da la respuesta convierte las
 * estrellas en una forma de saltarse el aprendizaje; estos tres sirven para VER
 * mejor lo que ya paso, que es justo lo que le falta a quien se atasca: el
 * programa corre demasiado rapido para saber en que orden hizo las cosas.
 */
const PODERES: ItemTienda[] = [
  {
    clave: 'poder-camara-lenta',
    nombre: 'Camara lenta',
    tipo: 'poder',
    descripcion: 'Tu Fuzz se mueve despacio para que veas cada paso. Se enciende y se apaga cuando quieras.',
    costoEstrellas: 20,
    datos: { efecto: 'camaraLenta' },
    orden: 50,
  },
  {
    clave: 'poder-huellas',
    nombre: 'Huellas',
    tipo: 'poder',
    descripcion: 'El Fuzz va dejando el rastro de por donde paso. Para ver donde se torcio tu programa.',
    costoEstrellas: 25,
    datos: { efecto: 'huellas' },
    orden: 51,
  },
  {
    clave: 'poder-repeticion',
    nombre: 'Repeticion',
    tipo: 'poder',
    descripcion: 'Un boton para volver a ver tu ultimo intento tantas veces como quieras.',
    costoEstrellas: 30,
    datos: { efecto: 'repeticion' },
    orden: 52,
  },
];

/**
 * Pociones: se gastan al usarlas y duran una actividad.
 *
 * Son puro disfrute: cambian como se ve el Fuzz mientras juega esa actividad y
 * no tocan las reglas. Se quedaron asi por lo mismo que los poderes; y ademas
 * son las mas baratas de la tienda, porque son el primer premio al que puede
 * llegar un nino de cinco anos con las estrellas de su primer dia.
 */
const POCIONES: ItemTienda[] = [
  {
    clave: 'pocion-gigante',
    nombre: 'Pocion gigante',
    tipo: 'pocion',
    descripcion: 'Tu Fuzz se pone enorme durante una actividad.',
    costoEstrellas: 3,
    datos: { efecto: 'gigante' },
    orden: 60,
  },
  {
    clave: 'pocion-brillo',
    nombre: 'Pocion de brillo',
    tipo: 'pocion',
    descripcion: 'Tu Fuzz brilla como una luciernaga durante una actividad.',
    costoEstrellas: 3,
    datos: { efecto: 'brillo' },
    orden: 61,
  },
  {
    clave: 'pocion-arcoiris',
    nombre: 'Pocion arcoiris',
    tipo: 'pocion',
    descripcion: 'Tu Fuzz deja un rastro de colores por donde pasa, durante una actividad.',
    costoEstrellas: 4,
    datos: { efecto: 'arcoiris' },
    orden: 62,
  },
];

/**
 * Mundos.
 *
 * De momento solo hay uno y es honesto sobre lo que hace: abre el siguiente
 * mundo antes de terminar el actual. No inventa contenido nuevo; da acceso al
 * que ya existe, para el niño que va rapido y se aburre esperando.
 */
const MUNDOS: ItemTienda[] = [
  {
    clave: 'mundo-pase',
    nombre: 'Pase del Nido',
    tipo: 'mundo',
    descripcion: 'Abre el siguiente mundo sin tener que terminar el de ahora. Se gasta al usarlo.',
    costoEstrellas: 30,
    datos: { efecto: 'abrirSiguienteMundo' },
    requiereMundos: 1,
    orden: 70,
  },
];

export const CATALOGO_TIENDA: readonly ItemTienda[] = [
  ...COLORES,
  ...SOMBREROS,
  ...GAFAS,
  ...ACCESORIOS,
  ...DISFRACES,
  ...PODERES,
  ...POCIONES,
  ...MUNDOS,
];

/** Los tipos que se llevan puestos y por tanto se equipan de uno en uno. */
export const TIPOS_EQUIPABLES: readonly TipoItem[] = ['color', 'sombrero', 'gafas', 'accesorio', 'disfraz'];

/** Los que se gastan: se pueden comprar varias veces. */
export const TIPOS_CONSUMIBLES: readonly TipoItem[] = ['pocion', 'mundo'];

export const ITEM_POR_CLAVE: ReadonlyMap<string, ItemTienda> = new Map(
  CATALOGO_TIENDA.map((i) => [i.clave, i]),
);
