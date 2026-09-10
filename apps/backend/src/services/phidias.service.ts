/**
 * Lectura del sistema academico del colegio (Phidias).
 *
 * De aqui salen los grupos y las matriculas reales, para que un docente no tenga
 * que teclear treinta nombres que ya estan escritos en otro sitio.
 *
 * TRES DECISIONES QUE CONVIENE ENTENDER.
 *
 * 1. Se llama desde el servidor y no desde el navegador. No es solo por CORS: el
 *    token de Phidias abre el expediente de mil ciento setenta y cinco menores,
 *    y un token que viaja al navegador es un token publicado. Vive en el `.env`
 *    y no sale de aqui.
 *
 * 2. Se guarda lo minimo. La respuesta trae direccion, telefono, numero de
 *    documento y hasta el hash de la contrasena de cada estudiante. De todo eso
 *    este juego solo necesita el nombre y la fecha de nacimiento (que decide el
 *    grupo de edad). `normalizar` recorta ahi mismo: lo que no se convierte, no
 *    llega a ninguna parte, ni a la memoria del servidor ni a un registro.
 *
 * 3. Se ordena por apellido. Es como esta escrita cualquier lista de clase, y
 *    buscar a un nino en una lista de treinta ordenada de otra forma es una
 *    tarea que el docente no deberia tener.
 *
 * La respuesta pesa dos megas y tarda; se guarda unos minutos en memoria porque
 * las matriculas no cambian dentro de una misma clase.
 */

/** Un estudiante tal y como lo usa CodeNest: sin nada que no haga falta. */
export interface EstudiantePhidias {
  /** Identificador en Phidias. Es lo que evita duplicar la cuenta al reimportar. */
  readonly id: number;
  readonly nombre: string;
  readonly apellidos: string;
  /** Nombre completo ya ordenado para mostrar: "APELLIDOS, Nombre". */
  readonly listado: string;
  readonly email: string | null;
  readonly fechaNacimiento: string | null;
  readonly nivel: string;
  readonly curso: string;
  readonly seccion: string;
  readonly seccionId: number;
}

export interface SeccionPhidias {
  readonly id: number;
  readonly nombre: string;
  readonly curso: string;
  readonly cursoId: number;
  readonly nivel: string;
  readonly estudiantes: number;
}

interface RespuestaCruda {
  readonly id: number;
  readonly name: string;
  readonly courses?: readonly {
    readonly id: number;
    readonly name: string;
    readonly sections?: readonly {
      readonly id: number;
      readonly name: string;
      readonly students?: readonly Record<string, unknown>[];
    }[];
  }[];
}

export class ErrorPhidias extends Error {
  constructor(
    readonly codigo: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorPhidias';
  }
}

/** Comparador en espanol: la enie y los acentos ordenan donde deben. */
const porApellido = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const texto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : typeof valor === 'number' ? String(valor) : '';

/**
 * Convierte una fecha de Phidias (segundos desde 1970) a YYYY-MM-DD.
 *
 * Se usa UTC a proposito: interpretarla en la zona local movería el dia a los
 * nacidos de madrugada, y de la fecha depende el grupo de edad.
 */
function fechaDe(valor: unknown): string | null {
  if (typeof valor !== 'number' || valor <= 0) return null;
  const fecha = new Date(valor * 1000);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10);
}

/** Aplana la jerarquia nivel -> curso -> seccion -> estudiantes. */
function normalizar(crudo: readonly RespuestaCruda[]): {
  secciones: SeccionPhidias[];
  estudiantes: EstudiantePhidias[];
} {
  const secciones: SeccionPhidias[] = [];
  const estudiantes: EstudiantePhidias[] = [];

  for (const nivel of crudo) {
    for (const curso of nivel.courses ?? []) {
      for (const seccion of curso.sections ?? []) {
        const alumnos = seccion.students ?? [];
        secciones.push({
          id: seccion.id,
          nombre: seccion.name,
          curso: curso.name,
          cursoId: curso.id,
          nivel: nivel.name,
          estudiantes: alumnos.length,
        });

        for (const bruto of alumnos) {
          const id = Number(bruto.id);
          if (!Number.isInteger(id)) continue;

          // `lastname1` y `lastname2` vienen separados; `lastname` es el
          // compuesto. Se prefiere el compuesto y se cae a los sueltos.
          const apellidos =
            texto(bruto.lastname) ||
            [texto(bruto.lastname1), texto(bruto.lastname2)].filter(Boolean).join(' ');
          const nombre = texto(bruto.firstname);
          const email = texto(bruto.email);

          estudiantes.push({
            id,
            nombre,
            apellidos,
            listado: apellidos ? `${apellidos}, ${nombre}`.trim() : nombre,
            email: email.length > 0 ? email : null,
            fechaNacimiento: fechaDe(bruto.birthday),
            nivel: nivel.name,
            curso: curso.name,
            seccion: seccion.name,
            seccionId: seccion.id,
          });
        }
      }
    }
  }

  estudiantes.sort(
    (a, b) =>
      porApellido.compare(a.apellidos, b.apellidos) || porApellido.compare(a.nombre, b.nombre),
  );
  secciones.sort(
    (a, b) =>
      porApellido.compare(a.nivel, b.nivel) ||
      porApellido.compare(a.curso, b.curso) ||
      porApellido.compare(a.nombre, b.nombre),
  );

  return { secciones, estudiantes };
}

export interface ConfigPhidias {
  readonly baseUrl: string | undefined;
  readonly token: string | undefined;
}

export function phidiasConfigurado(config: ConfigPhidias): boolean {
  return Boolean(config.baseUrl && config.token);
}

interface Cache {
  readonly momento: number;
  readonly datos: { secciones: SeccionPhidias[]; estudiantes: EstudiantePhidias[] };
}

let cache: Cache | null = null;
/** Cinco minutos: las matriculas no cambian a mitad de una clase. */
const VIDA_CACHE_MS = 5 * 60 * 1000;

export function olvidarCachePhidias(): void {
  cache = null;
}

/**
 * Trae las matriculas del colegio, ya recortadas y ordenadas por apellido.
 */
export async function matriculas(
  config: ConfigPhidias,
  opciones: { readonly refrescar?: boolean; readonly year?: number } = {},
): Promise<{ secciones: SeccionPhidias[]; estudiantes: EstudiantePhidias[] }> {
  if (!phidiasConfigurado(config)) {
    throw new ErrorPhidias(503, 'El colegio no tiene configurada la conexion con Phidias');
  }

  if (!opciones.refrescar && cache && Date.now() - cache.momento < VIDA_CACHE_MS) {
    return cache.datos;
  }

  const url = new URL(`${config.baseUrl}/1/course/consolidate`);
  if (opciones.year) url.searchParams.set('year', String(opciones.year));

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    // Sin red, con el colegio caido o por tiempo agotado: se distingue de un
    // rechazo de permisos, porque lo que hay que hacer no es lo mismo.
    throw new ErrorPhidias(
      504,
      `No se pudo hablar con Phidias: ${error instanceof Error ? error.message : 'error de red'}`,
    );
  }

  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new ErrorPhidias(502, 'Phidias rechazo el token del colegio. Puede haber caducado.');
  }
  if (!respuesta.ok) {
    throw new ErrorPhidias(502, `Phidias respondio ${respuesta.status}`);
  }

  const crudo = (await respuesta.json()) as unknown;
  if (!Array.isArray(crudo)) {
    throw new ErrorPhidias(502, 'Phidias devolvio algo que no es la lista de matriculas');
  }

  const datos = normalizar(crudo as RespuestaCruda[]);
  cache = { momento: Date.now(), datos };
  return datos;
}

/** Los estudiantes de unas secciones concretas, en orden de lista. */
export function filtrarPorSeccion(
  estudiantes: readonly EstudiantePhidias[],
  seccionIds: readonly number[],
): EstudiantePhidias[] {
  const buscadas = new Set(seccionIds);
  return estudiantes.filter((e) => buscadas.has(e.seccionId));
}
