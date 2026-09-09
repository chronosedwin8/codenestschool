/**
 * Planes comerciales, licencias y pagos.
 * El precio SIEMPRE lo decide el servidor a partir de estas claves y de las
 * variables de entorno; nunca se confia en el monto que envia el cliente.
 */

export const ROL_USUARIO = {
  nino: 'nino',
  tutor: 'tutor',
  docente: 'docente',
  admin_escuela: 'admin_escuela',
  admin: 'admin',
} as const;

export type RolUsuario = (typeof ROL_USUARIO)[keyof typeof ROL_USUARIO];

export const TIPO_PLAN = {
  /** Un solo perfil de nino. */
  personal: 'personal',
  /** Familia: varios ninos bajo un mismo tutor. */
  padres: 'padres',
  /** Institucion: sedes, docentes, aulas y alta masiva de estudiantes. */
  escuela: 'escuela',
} as const;

export type TipoPlan = (typeof TIPO_PLAN)[keyof typeof TIPO_PLAN];

export const ESTADO_LICENCIA = {
  pendiente: 'pendiente',
  activa: 'activa',
  vencida: 'vencida',
  cancelada: 'cancelada',
} as const;

export type EstadoLicencia = (typeof ESTADO_LICENCIA)[keyof typeof ESTADO_LICENCIA];

export const ESTADO_PAGO = {
  pendiente: 'pendiente',
  aprobado: 'aprobado',
  rechazado: 'rechazado',
  reembolsado: 'reembolsado',
  cancelado: 'cancelado',
} as const;

export type EstadoPago = (typeof ESTADO_PAGO)[keyof typeof ESTADO_PAGO];

export interface PlanDefinicion {
  readonly clave: TipoPlan;
  readonly nombre: string;
  readonly descripcion: string;
  /** Variable de entorno que fija el precio en pesos colombianos. */
  readonly envPrecio: string;
  readonly precioPorDefectoCop: number;
  readonly vigenciaDias: number;
  /** Perfiles de nino incluidos; `null` = sin limite (plan Escuela). */
  readonly maxNinos: number | null;
  readonly maxDocentes: number | null;
  readonly rolTitular: RolUsuario;
  readonly beneficios: readonly string[];
  readonly destacado: boolean;
  readonly orden: number;
}

/**
 * Catalogo de planes. El plan Escuela cuesta 12.000.000 COP al ano
 * (dato confirmado por el cliente); los otros dos precios son configurables.
 */
export const PLANES: readonly PlanDefinicion[] = [
  {
    clave: TIPO_PLAN.personal,
    nombre: 'Personal',
    descripcion: 'Para un nino o nina que aprende en casa, con acompanamiento de su tutor.',
    envPrecio: 'PRECIO_PERSONAL_COP',
    precioPorDefectoCop: 180_000,
    vigenciaDias: 365,
    maxNinos: 1,
    maxDocentes: null,
    rolTitular: ROL_USUARIO.tutor,
    beneficios: [
      '1 perfil de nino con avatar personalizable',
      'Los 30 mundos y las 600 actividades',
      'Instrucciones narradas con voz humana',
      'Tienda de accesorios para el Fuzz',
      'Reporte de progreso para el tutor',
      'Vigencia de 1 ano',
    ],
    destacado: false,
    orden: 1,
  },
  {
    clave: TIPO_PLAN.padres,
    nombre: 'Padres',
    descripcion: 'Para familias con varios hijos: un solo pago, hasta 4 perfiles.',
    envPrecio: 'PRECIO_PADRES_COP',
    precioPorDefectoCop: 480_000,
    vigenciaDias: 365,
    maxNinos: 4,
    maxDocentes: null,
    rolTitular: ROL_USUARIO.tutor,
    beneficios: [
      'Hasta 4 perfiles de ninos',
      'Todo lo del plan Personal para cada hijo',
      'Reportes comparativos por hijo',
      'Control de tiempo de juego',
      'Notificaciones de logros',
      'Vigencia de 1 ano',
    ],
    destacado: true,
    orden: 2,
  },
  {
    clave: TIPO_PLAN.escuela,
    nombre: 'Escuela',
    descripcion: 'Para colegios: sedes, docentes, aulas y seguimiento pedagogico completo.',
    envPrecio: 'PRECIO_ESCUELA_COP',
    precioPorDefectoCop: 12_000_000,
    vigenciaDias: 365,
    maxNinos: null,
    maxDocentes: null,
    rolTitular: ROL_USUARIO.admin_escuela,
    beneficios: [
      'Estudiantes ilimitados',
      'Multiples sedes y aulas con codigo de acceso',
      'Docentes ilimitados con panel propio',
      'Alta masiva de estudiantes',
      'Asignacion de mundos y actividades por aula',
      'Matriz de seguimiento y estadisticas por grupo',
      'Auditoria de accesos y cumplimiento Ley 1581',
      'Capacitacion inicial y soporte prioritario',
      'Vigencia de 1 ano',
    ],
    destacado: false,
    orden: 3,
  },
];

export const PLAN_POR_CLAVE: Readonly<Record<TipoPlan, PlanDefinicion>> = Object.freeze(
  Object.fromEntries(PLANES.map((p) => [p.clave, p])) as Record<TipoPlan, PlanDefinicion>,
);

/** Formatea un monto en pesos colombianos: 12000000 -> "$12.000.000 COP". */
export function formatearCop(monto: number): string {
  return `$${monto.toLocaleString('es-CO')} COP`;
}

/** Calcula el fin de vigencia de una licencia. */
export function finVigencia(plan: PlanDefinicion, desde: Date): Date {
  const fin = new Date(desde);
  fin.setDate(fin.getDate() + plan.vigenciaDias);
  return fin;
}
