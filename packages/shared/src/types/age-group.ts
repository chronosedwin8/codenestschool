/**
 * Grupos de edad de CodeNest School.
 *
 * Se declaran como objetos `as const` (no `enum` de TypeScript) para que el
 * paquete siga siendo "type-strippable": no genera codigo en tiempo de
 * ejecucion y puede importarse igual desde Vite, tsx y el backend.
 * Los valores coinciden exactamente con el enum `GrupoEdad` de Prisma.
 */
export const GRUPO_EDAD = {
  /** 4 a 6 anos. Prelectores: interfaz 100% grafica, audio obligatorio. */
  exploradores: 'exploradores',
  /** 7 a 9 anos. Programacion por bloques (Blockly) con codigo visible. */
  creadores: 'creadores',
  /** 10 a 12+ anos. Editor de texto real (Monaco). */
  hackers: 'hackers',
} as const;

export type GrupoEdad = (typeof GRUPO_EDAD)[keyof typeof GRUPO_EDAD];

export const GRUPOS_EDAD_ORDEN: readonly GrupoEdad[] = [
  GRUPO_EDAD.exploradores,
  GRUPO_EDAD.creadores,
  GRUPO_EDAD.hackers,
];

export interface RangoEdad {
  readonly min: number;
  readonly max: number;
}

/** Rango de edad recomendado por grupo (usado en la UI y en la homepage). */
export const RANGO_EDAD: Readonly<Record<GrupoEdad, RangoEdad>> = {
  exploradores: { min: 4, max: 6 },
  creadores: { min: 7, max: 9 },
  hackers: { min: 10, max: 12 },
};

/** Etiquetas para la interfaz (espanol de Colombia). */
export const GRUPO_EDAD_LABEL: Readonly<Record<GrupoEdad, string>> = {
  exploradores: 'Exploradores',
  creadores: 'Creadores',
  hackers: 'Hackers',
};

/** Deriva el grupo de edad a partir de la fecha de nacimiento. */
export function grupoPorEdad(edadAnios: number): GrupoEdad {
  if (edadAnios <= RANGO_EDAD.exploradores.max) return GRUPO_EDAD.exploradores;
  if (edadAnios <= RANGO_EDAD.creadores.max) return GRUPO_EDAD.creadores;
  return GRUPO_EDAD.hackers;
}

/** Edad en anios cumplidos a partir de la fecha de nacimiento. */
export function edadEnAnios(fechaNacimiento: Date, referencia: Date = new Date()): number {
  let edad = referencia.getFullYear() - fechaNacimiento.getFullYear();
  const mes = referencia.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < fechaNacimiento.getDate())) edad -= 1;
  return edad;
}
