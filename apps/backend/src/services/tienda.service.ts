/**
 * La tienda: catalogo, compras y lo que el nino lleva puesto.
 *
 * Tres reglas que estan en el codigo y no solo en el catalogo:
 *
 *  1. El precio y el saldo se leen y se descuentan DENTRO de la transaccion. Si
 *     el cliente mandara el precio, o si se comprobara el saldo antes de abrir
 *     la transaccion, dos toques seguidos en el mismo boton cobrarian dos veces.
 *  2. Comprar gasta `estrellas_disponibles` y nunca `estrellas_totales`: lo que
 *     consiguio no se deshace por gastarlo.
 *  3. Lo equipado se guarda como CLAVE del articulo, no como color ni forma. Asi
 *     un cambio de tono en el catalogo llega a todos los que lo llevan puesto, y
 *     se puede comprobar si de verdad lo tiene comprado.
 */
import type { Prisma, PrismaClient, TipoItemTienda } from '@prisma/client';

import {
  estadoDeMundos,
  mundosAbiertos,
  mundosCompletados,
  primerMundoCerrado,
} from './desbloqueo.service.js';

/** Tipos que se llevan puestos: uno de cada a la vez. */
const EQUIPABLES = ['color', 'sombrero', 'gafas', 'disfraz', 'accesorio'] as const;
export type TipoEquipable = (typeof EQUIPABLES)[number];

/** Tipos que se gastan: se pueden tener varios. */
const CONSUMIBLES: readonly TipoItemTienda[] = ['pocion', 'mundo'];

export function esEquipable(tipo: string): tipo is TipoEquipable {
  return (EQUIPABLES as readonly string[]).includes(tipo);
}

const COLOR_DE_FABRICA = '#1FA2FF';

/** Lo que el nino lleva puesto, en claves de articulo. */
export interface Aspecto {
  color: string | null;
  sombrero: string | null;
  gafas: string | null;
  disfraz: string | null;
  accesorio: string | null;
  /** Poderes encendidos (los tiene comprados y los quiere activos). */
  poderes: string[];
  /** Pocion en curso: vale para la actividad que este jugando. */
  pocion: string | null;
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

/**
 * Lee `avatar_config` sin fiarse de lo que hay dentro.
 *
 * Es una columna JSONB que existe desde antes de la tienda: las primeras cuentas
 * traen `{"fuzzColor":"azul"}`, que no es ni una clave ni un color. Un lector
 * tolerante evita una migracion de datos y, sobre todo, evita que una cuenta
 * antigua rompa la pantalla del avatar.
 */
export function leerAspecto(valor: unknown): Aspecto {
  if (typeof valor !== 'object' || valor === null) return { ...ASPECTO_VACIO };
  const bruto = valor as Record<string, unknown>;

  const texto = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 && v.length <= 60 ? v : null;

  const colorViejo = texto(bruto.fuzzColor);

  return {
    // `fuzzColor` es el nombre viejo, y solo sirve si parece una clave de la
    // tienda ("color-verde"); el "azul" de las cuentas antiguas se descarta.
    color: texto(bruto.color) ?? (colorViejo?.startsWith('color-') ? colorViejo : null),
    sombrero: texto(bruto.sombrero),
    gafas: texto(bruto.gafas),
    disfraz: texto(bruto.disfraz),
    accesorio: texto(bruto.accesorio),
    poderes: Array.isArray(bruto.poderes)
      ? bruto.poderes.filter((p): p is string => typeof p === 'string').slice(0, 10)
      : [],
    pocion: texto(bruto.pocion),
  };
}

export interface ArticuloConEstado {
  readonly clave: string;
  readonly nombre: string;
  readonly tipo: TipoItemTienda;
  readonly descripcion: string | null;
  readonly costoEstrellas: number;
  readonly datos: unknown;
  readonly mundosNecesarios: number | null;
  readonly tengo: boolean;
  readonly cantidad: number;
  readonly equipado: boolean;
  readonly puedoComprar: boolean;
  /** Por que no puede comprarlo, si no puede. Con palabras suyas. */
  readonly motivo: string | null;
}

export interface VistaTienda {
  readonly estrellasDisponibles: number;
  readonly estrellasTotales: number;
  readonly aspecto: Aspecto;
  /** El color resuelto a hexadecimal, que es lo que pinta el juego. */
  readonly colorFuzz: string;
  /** Efectos activos, ya resueltos: el juego no tiene que mirar el catalogo. */
  readonly efectos: {
    readonly poderes: readonly string[];
    readonly pocion: string | null;
  };
  readonly articulos: readonly ArticuloConEstado[];
}

type ArticuloCrudo = { clave: string; datos: Prisma.JsonValue; tipo: TipoItemTienda };

/** Catalogo completo con el estado de este nino en cada articulo. */
export async function verTienda(prisma: PrismaClient, usuarioId: number): Promise<VistaTienda> {
  const [usuario, articulos, inventario, mundos] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { estrellasDisponibles: true, estrellasTotales: true, avatarConfig: true },
    }),
    prisma.storeItem.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    }),
    prisma.userInventory.findMany({
      where: { usuarioId },
      select: { cantidad: true, item: { select: { clave: true } } },
    }),
    estadoDeMundos(prisma, usuarioId),
  ]);

  const aspecto = leerAspecto(usuario.avatarConfig);
  const mios = new Map(inventario.map((i) => [i.item.clave, i.cantidad]));
  const hechos = mundosCompletados(mundos);

  const conEstado = articulos.map<ArticuloConEstado>((item) => {
    const cantidad = mios.get(item.clave) ?? 0;
    const consumible = CONSUMIBLES.includes(item.tipo);
    const tengo = cantidad > 0;

    let motivo: string | null = null;
    if (item.mundosNecesarios !== null && hechos.size < item.mundosNecesarios) {
      motivo =
        item.mundosNecesarios === 1
          ? 'Se abre cuando termines un mundo entero'
          : `Se abre cuando termines ${item.mundosNecesarios} mundos`;
    } else if (tengo && !consumible) {
      motivo = 'Ya es tuyo';
    } else if (usuario.estrellasDisponibles < item.costoEstrellas) {
      const faltan = item.costoEstrellas - usuario.estrellasDisponibles;
      motivo = faltan === 1 ? 'Te falta 1 estrella' : `Te faltan ${faltan} estrellas`;
    }

    return {
      clave: item.clave,
      nombre: item.nombre,
      tipo: item.tipo,
      descripcion: item.descripcion,
      costoEstrellas: item.costoEstrellas,
      datos: item.datos,
      mundosNecesarios: item.mundosNecesarios,
      tengo,
      cantidad,
      equipado: estaEquipado(aspecto, item.tipo, item.clave),
      puedoComprar: motivo === null,
      motivo,
    };
  });

  return {
    estrellasDisponibles: usuario.estrellasDisponibles,
    estrellasTotales: usuario.estrellasTotales,
    aspecto,
    colorFuzz: resolverColor(aspecto.color, articulos),
    efectos: {
      poderes: efectosDe(aspecto.poderes, articulos),
      pocion: efectosDe(aspecto.pocion === null ? [] : [aspecto.pocion], articulos)[0] ?? null,
    },
    articulos: conEstado,
  };
}

function estaEquipado(aspecto: Aspecto, tipo: TipoItemTienda, clave: string): boolean {
  if (tipo === 'poder') return aspecto.poderes.includes(clave);
  if (tipo === 'pocion') return aspecto.pocion === clave;
  if (esEquipable(tipo)) return aspecto[tipo] === clave;
  return false;
}

function resolverColor(clave: string | null, articulos: readonly ArticuloCrudo[]): string {
  if (clave === null) return COLOR_DE_FABRICA;
  const item = articulos.find((a) => a.clave === clave);
  const datos = item?.datos as { hex?: unknown } | null;
  return typeof datos?.hex === 'string' ? datos.hex : COLOR_DE_FABRICA;
}

/** De claves de articulo a nombres de efecto ("camaraLenta", "gigante"...). */
function efectosDe(claves: readonly string[], articulos: readonly ArticuloCrudo[]): string[] {
  const efectos: string[] = [];
  for (const clave of claves) {
    const datos = articulos.find((a) => a.clave === clave)?.datos as { efecto?: unknown } | null;
    if (typeof datos?.efecto === 'string') efectos.push(datos.efecto);
  }
  return efectos;
}

export class ErrorTienda extends Error {
  constructor(
    message: string,
    readonly codigo: number = 400,
  ) {
    super(message);
    this.name = 'ErrorTienda';
  }
}

export interface ResultadoCompra {
  readonly clave: string;
  readonly nombre: string;
  readonly tipo: TipoItemTienda;
  readonly estrellasDisponibles: number;
  readonly aspecto: Aspecto;
}

/**
 * Compra un articulo.
 *
 * Todo ocurre en una transaccion y el saldo se vuelve a leer dentro: es la unica
 * forma de que dos toques seguidos en el mismo boton no cobren dos veces ni
 * dejen el saldo por debajo de cero.
 */
export async function comprar(
  prisma: PrismaClient,
  usuarioId: number,
  clave: string,
): Promise<ResultadoCompra> {
  const item = await prisma.storeItem.findUnique({ where: { clave } });
  if (!item?.activo) throw new ErrorTienda('Eso no esta en la tienda', 404);

  // El requisito se mira fuera de la transaccion porque hay que recorrer el
  // progreso entero, y no es una condicion de carrera: un mundo no se
  // "descompleta" mientras se compra.
  if (item.mundosNecesarios !== null) {
    const hechos = mundosCompletados(await estadoDeMundos(prisma, usuarioId));
    if (hechos.size < item.mundosNecesarios) {
      throw new ErrorTienda(
        `Eso se abre cuando termines ${item.mundosNecesarios} mundo(s)`,
        409,
      );
    }
  }

  const consumible = CONSUMIBLES.includes(item.tipo);

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { estrellasDisponibles: true, avatarConfig: true },
    });

    const yaTengo = await tx.userInventory.findUnique({
      where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
      select: { cantidad: true },
    });

    if (yaTengo && !consumible) throw new ErrorTienda('Ya tienes eso', 409);
    if (usuario.estrellasDisponibles < item.costoEstrellas) {
      throw new ErrorTienda('No te alcanzan las estrellas', 409);
    }

    await tx.userInventory.upsert({
      where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
      create: { usuarioId, itemId: item.id, cantidad: 1 },
      update: { cantidad: { increment: 1 } },
    });

    // Lo que se acaba de comprar se pone solo. Un nino de cinco anos no busca un
    // segundo boton para estrenar el gorro que acaba de pagar.
    const aspecto = leerAspecto(usuario.avatarConfig);
    if (esEquipable(item.tipo)) aspecto[item.tipo] = item.clave;
    else if (item.tipo === 'poder' && !aspecto.poderes.includes(item.clave)) {
      aspecto.poderes.push(item.clave);
    }

    await tx.user.update({
      where: { id: usuarioId },
      data: {
        estrellasDisponibles: { decrement: item.costoEstrellas },
        avatarConfig: aspecto as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      clave: item.clave,
      nombre: item.nombre,
      tipo: item.tipo,
      estrellasDisponibles: usuario.estrellasDisponibles - item.costoEstrellas,
      aspecto,
    };
  });
}

/** Pone o quita algo que se lleva puesto. `clave` nula lo quita. */
export async function equipar(
  prisma: PrismaClient,
  usuarioId: number,
  tipo: TipoEquipable,
  clave: string | null,
): Promise<Aspecto> {
  if (clave !== null) {
    const suyo = await prisma.userInventory.findFirst({
      where: { usuarioId, item: { clave, tipo, activo: true } },
      select: { id: true },
    });
    if (!suyo) throw new ErrorTienda('Eso no lo tienes comprado', 403);
  }

  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { avatarConfig: true },
  });
  const aspecto = leerAspecto(usuario.avatarConfig);
  aspecto[tipo] = clave;

  await prisma.user.update({
    where: { id: usuarioId },
    data: { avatarConfig: aspecto as unknown as Prisma.InputJsonValue },
  });
  return aspecto;
}

/** Enciende o apaga un poder comprado. */
export async function cambiarPoder(
  prisma: PrismaClient,
  usuarioId: number,
  clave: string,
  encendido: boolean,
): Promise<Aspecto> {
  if (encendido) {
    const suyo = await prisma.userInventory.findFirst({
      where: { usuarioId, item: { clave, tipo: 'poder', activo: true } },
      select: { id: true },
    });
    if (!suyo) throw new ErrorTienda('Ese poder no lo tienes comprado', 403);
  }

  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { avatarConfig: true },
  });
  const aspecto = leerAspecto(usuario.avatarConfig);

  if (encendido) {
    if (!aspecto.poderes.includes(clave)) aspecto.poderes.push(clave);
  } else {
    aspecto.poderes = aspecto.poderes.filter((p) => p !== clave);
  }

  await prisma.user.update({
    where: { id: usuarioId },
    data: { avatarConfig: aspecto as unknown as Prisma.InputJsonValue },
  });
  return aspecto;
}

export interface ResultadoUso {
  readonly clave: string;
  readonly tipo: TipoItemTienda;
  readonly quedan: number;
  readonly aspecto: Aspecto;
  /** Mundo que acaba de abrir un pase, si fue eso lo que uso. */
  readonly mundoAbierto: number | null;
}

/**
 * Gasta un consumible: una pocion o un Pase del Nido.
 *
 * La pocion sale del inventario y queda marcada como activa hasta que el nino
 * resuelva la actividad en la que la usa. El pase se gasta en el acto y, si no
 * queda ningun mundo por abrir, no se gasta: cobrarselo por nada seria robarle.
 */
export async function usar(
  prisma: PrismaClient,
  usuarioId: number,
  clave: string,
): Promise<ResultadoUso> {
  const item = await prisma.storeItem.findUnique({ where: { clave } });
  if (!item?.activo) throw new ErrorTienda('Eso no esta en la tienda', 404);
  if (!CONSUMIBLES.includes(item.tipo)) throw new ErrorTienda('Eso no se gasta', 400);

  const datos = item.datos as { efecto?: unknown } | null;
  const efecto = typeof datos?.efecto === 'string' ? datos.efecto : null;

  // El pase necesita saber cual es el siguiente mundo cerrado de su grupo.
  let mundoAAbrir: number | null = null;
  if (efecto === 'abrirSiguienteMundo') {
    const [usuario, mundos] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { grupoEdad: true, mundosExtra: true },
      }),
      estadoDeMundos(prisma, usuarioId),
    ]);
    if (!usuario.grupoEdad) throw new ErrorTienda('Todavia no tienes grupo de edad', 409);

    mundoAAbrir = primerMundoCerrado(mundos, usuario.grupoEdad, {
      mundosExtra: usuario.mundosExtra,
    });
    if (mundoAAbrir === null) throw new ErrorTienda('Ya tienes todos tus mundos abiertos', 409);
  }

  return prisma.$transaction(async (tx) => {
    const enMochila = await tx.userInventory.findUnique({
      where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
      select: { cantidad: true },
    });
    if (!enMochila || enMochila.cantidad < 1) throw new ErrorTienda('No te queda ninguna', 409);

    const quedan = enMochila.cantidad - 1;
    if (quedan === 0) {
      await tx.userInventory.delete({
        where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
      });
    } else {
      await tx.userInventory.update({
        where: { usuarioId_itemId: { usuarioId, itemId: item.id } },
        data: { cantidad: quedan },
      });
    }

    const usuario = await tx.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { avatarConfig: true },
    });
    const aspecto = leerAspecto(usuario.avatarConfig);

    const cambios: Prisma.UserUpdateInput = {};
    if (item.tipo === 'pocion') {
      aspecto.pocion = item.clave;
      cambios.avatarConfig = aspecto as unknown as Prisma.InputJsonValue;
    }
    if (mundoAAbrir !== null) cambios.mundosExtra = { push: mundoAAbrir };

    await tx.user.update({ where: { id: usuarioId }, data: cambios });

    return { clave: item.clave, tipo: item.tipo, quedan, aspecto, mundoAbierto: mundoAAbrir };
  });
}

/**
 * Apaga la pocion en curso. Se llama al resolver una actividad.
 *
 * La pocion dura "una actividad", y esa es la frase que entiende el nino: si se
 * quedara puesta hasta que la quite, no seria un consumible sino un cosmetico
 * gratis para siempre.
 */
export async function apagarPocion(prisma: PrismaClient, usuarioId: number): Promise<void> {
  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { avatarConfig: true },
  });
  if (!usuario) return;

  const aspecto = leerAspecto(usuario.avatarConfig);
  if (aspecto.pocion === null) return;

  aspecto.pocion = null;
  await prisma.user.update({
    where: { id: usuarioId },
    data: { avatarConfig: aspecto as unknown as Prisma.InputJsonValue },
  });
}

/** Los mundos que este nino tiene abiertos, contando los pases que gasto. */
export async function mundosDelNino(
  prisma: PrismaClient,
  usuarioId: number,
  esAdulto: boolean,
): Promise<ReadonlySet<number>> {
  const [usuario, mundos] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: usuarioId }, select: { mundosExtra: true } }),
    estadoDeMundos(prisma, usuarioId),
  ]);
  return mundosAbiertos(mundos, { esAdulto, mundosExtra: usuario.mundosExtra });
}
