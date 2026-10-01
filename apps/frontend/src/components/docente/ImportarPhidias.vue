<script setup lang="ts">
/**
 * Traer estudiantes desde el sistema academico del colegio.
 *
 * Tres formas de armar el grupo, porque son tres necesidades distintas:
 *
 *  - Secciones enteras: "quiero a todo KIN1". Un clic.
 *  - Nombre a nombre: el grupo de refuerzo, que junta a seis niños de tres
 *    cursos distintos. Se abre una seccion, se marcan, se abre otra, se marcan.
 *  - Por codigo: el que llega tarde y viene con su codigo en un papel. Se
 *    pegan de uno en uno o de veinte en veinte.
 *
 * Las tres se pueden combinar en el mismo envio.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * LO QUE ESTABA ROTO (y por que se arregla asi)
 *
 * Antes se guardaban solo los IDENTIFICADORES de los marcados y el listado se
 * reemplazaba entero al abrir otra seccion. Dos consecuencias, las dos malas:
 *
 *  1. El panel abierto estaba dentro del bucle de niveles, asi que al abrir una
 *     seccion de otro nivel desaparecia de golpe. Parecia que la ventana se
 *     cerrara sola.
 *  2. Los ya marcados de la seccion anterior dejaban de verse (sus nombres ya
 *     no estaban en el listado), y nadie confia en un numero que no puede
 *     comprobar. Si encima se cambiaba de pestaña, se perdian de verdad.
 *
 * Ahora hay una BANDEJA: un mapa de identificador a estudiante, con su nombre y
 * su curso, que sobrevive a cambiar de seccion y se ve siempre. De ella se
 * puede sacar a alguien uno a uno. Los listados ya consultados se guardan, asi
 * que volver a una seccion es inmediato y lo marcado sigue marcado.
 *
 * La lista va SIEMPRE ordenada por apellido, que es como esta escrita cualquier
 * lista de clase.
 *
 * Quien ya tiene cuenta aqui aparece marcado. Volver a importarlo no lo duplica:
 * se le añade a este grupo conservando su progreso.
 */
import { computed, onMounted, ref } from 'vue';

import { api } from '@/api/cliente';

const props = defineProps<{ aula: { id: number; nombre: string } }>();
const emit = defineEmits<{ importado: [] }>();

interface Seccion {
  readonly id: number;
  readonly nombre: string;
  readonly curso: string;
  readonly nivel: string;
  readonly estudiantes: number;
}

interface EstudianteExterno {
  readonly id: number;
  readonly listado: string;
  readonly email: string | null;
  readonly fechaNacimiento: string | null;
  readonly curso: string;
  readonly seccion: string;
  readonly yaImportado: boolean;
}

interface Resultado {
  readonly creados: readonly unknown[];
  readonly reutilizados: readonly unknown[];
  readonly omitidos: readonly { origenId: string; nombre: string; motivo: string }[];
  readonly codigosSinEncontrar?: readonly string[];
}

const disponible = ref(true);
/** Este docente tiene permiso. Es distinto de que el servidor no lo tenga. */
const habilitado = ref(true);
const avisoPermiso = ref<string | null>(null);
const cargando = ref(true);
const trabajando = ref(false);
const error = ref<string | null>(null);
const resultado = ref<Resultado | null>(null);

const secciones = ref<readonly Seccion[]>([]);
const seccionesElegidas = ref<number[]>([]);

/** Seccion abierta para escoger nombre a nombre. */
const explorando = ref<number | null>(null);
/** Listados ya consultados, por seccion: volver atras no vuelve a preguntar. */
const listados = ref(new Map<number, readonly EstudianteExterno[]>());
const cargandoSeccion = ref(false);

/**
 * La bandeja: los estudiantes sueltos elegidos, con sus datos.
 *
 * Guarda el estudiante entero y no solo su identificador justamente para poder
 * ensenar la lista de quien va a entrar aunque su seccion ya no este abierta.
 */
const bandeja = ref(new Map<number, EstudianteExterno>());

const busqueda = ref('');
const pinComun = ref('');

// Alta por codigo.
const codigosTexto = ref('');
const buscandoCodigos = ref(false);
const codigosSinEncontrar = ref<readonly string[]>([]);

const IMAGENES = ['gato', 'sol', 'arbol', 'luna', 'pez', 'flor', 'nube', 'tren', 'pato'];

const porNivel = computed(() => {
  const grupos = new Map<string, Seccion[]>();
  for (const s of secciones.value) {
    const lista = grupos.get(s.nivel) ?? [];
    lista.push(s);
    grupos.set(s.nivel, lista);
  }
  return [...grupos.entries()];
});

const seccionAbierta = computed(
  () => secciones.value.find((s) => s.id === explorando.value) ?? null,
);

const listadoAbierto = computed<readonly EstudianteExterno[]>(() =>
  explorando.value === null ? [] : (listados.value.get(explorando.value) ?? []),
);

const visibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  if (!texto) return listadoAbierto.value;
  return listadoAbierto.value.filter((e) => e.listado.toLowerCase().includes(texto));
});

const enBandeja = computed(() =>
  [...bandeja.value.values()].sort((a, b) => a.listado.localeCompare(b.listado, 'es')),
);

const deSecciones = computed(() =>
  seccionesElegidas.value.reduce(
    (suma, id) => suma + (secciones.value.find((s) => s.id === id)?.estudiantes ?? 0),
    0,
  ),
);

const totalElegido = computed(() => deSecciones.value + bandeja.value.size);

async function cargarCursos(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const datos = await api.get<{
      disponible: boolean;
      habilitado: boolean;
      secciones: Seccion[];
      mensaje?: string;
    }>('/docente/phidias/cursos');
    disponible.value = datos.disponible;
    habilitado.value = datos.habilitado;
    avisoPermiso.value = datos.mensaje ?? null;
    secciones.value = datos.secciones;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo consultar el colegio';
  } finally {
    cargando.value = false;
  }
}

async function explorar(seccionId: number): Promise<void> {
  if (explorando.value === seccionId) {
    explorando.value = null;
    return;
  }
  explorando.value = seccionId;
  busqueda.value = '';
  if (listados.value.has(seccionId)) return;

  cargandoSeccion.value = true;
  error.value = null;
  try {
    const datos = await api.get<{ estudiantes: EstudianteExterno[] }>(
      `/docente/phidias/estudiantes?secciones=${seccionId}`,
    );
    listados.value.set(seccionId, datos.estudiantes);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la seccion';
    explorando.value = null;
  } finally {
    cargandoSeccion.value = false;
  }
}

function alternarSeccion(seccionId: number): void {
  seccionesElegidas.value = seccionesElegidas.value.includes(seccionId)
    ? seccionesElegidas.value.filter((v) => v !== seccionId)
    : [...seccionesElegidas.value, seccionId];
}

function alternarEstudiante(e: EstudianteExterno): void {
  if (bandeja.value.has(e.id)) bandeja.value.delete(e.id);
  else bandeja.value.set(e.id, e);
}

function quitar(id: number): void {
  bandeja.value.delete(id);
}

function vaciar(): void {
  bandeja.value.clear();
  seccionesElegidas.value = [];
}

/** Los codigos tecleados, separados por comas, espacios o saltos de linea. */
const codigos = computed(() =>
  codigosTexto.value
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2),
);

async function buscarPorCodigo(): Promise<void> {
  if (codigos.value.length === 0 || buscandoCodigos.value) return;
  buscandoCodigos.value = true;
  error.value = null;
  codigosSinEncontrar.value = [];
  try {
    const datos = await api.post<{
      encontrados: EstudianteExterno[];
      noEncontrados: string[];
    }>('/docente/phidias/buscar', { codigos: codigos.value });

    for (const e of datos.encontrados) bandeja.value.set(e.id, e);
    codigosSinEncontrar.value = datos.noEncontrados;
    // Lo que se encontro se borra de la caja y lo que no se queda escrito: asi
    // el docente ve exactamente que codigo tiene que revisar.
    codigosTexto.value = datos.noEncontrados.join('\n');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo buscar por codigo';
  } finally {
    buscandoCodigos.value = false;
  }
}

function pinDeTexto(valor: string): string[] | undefined {
  const partes = valor.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  return partes.length === 4 && partes.every((p) => IMAGENES.includes(p)) ? partes : undefined;
}

async function importar(): Promise<void> {
  if (totalElegido.value === 0 || trabajando.value) return;
  trabajando.value = true;
  error.value = null;
  resultado.value = null;
  try {
    const pin = pinDeTexto(pinComun.value);
    resultado.value = await api.post<Resultado>(`/docente/aulas/${props.aula.id}/importar`, {
      ...(seccionesElegidas.value.length ? { seccionIds: seccionesElegidas.value } : {}),
      ...(bandeja.value.size ? { estudianteIds: [...bandeja.value.keys()] } : {}),
      ...(pin ? { pinComun: pin } : {}),
    });
    vaciar();
    emit('importado');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo importar';
  } finally {
    trabajando.value = false;
  }
}

onMounted(() => void cargarCursos());
</script>

<template>
  <div>
    <p v-if="error" class="aviso aviso--grave">{{ error }}</p>

    <p v-if="cargando" class="vacio">Consultando el colegio...</p>

    <p v-else-if="!disponible" class="aviso aviso--aviso">
      Este servidor no tiene configurada la conexion con el sistema academico del
      colegio. Puedes añadir estudiantes pegando una lista o uno a uno.
    </p>

    <p v-else-if="!habilitado" class="aviso aviso--aviso">
      {{ avisoPermiso ?? 'Tu cuenta no tiene habilitada la importacion desde el colegio.' }}
    </p>

    <template v-else>
      <p class="nota">
        Marca secciones enteras, abre una para elegir nombre a nombre, o pega codigos.
        Lo que elijas se va guardando abajo aunque cambies de curso.
      </p>

      <!-- Alta por codigo: arriba, porque es la forma mas rapida cuando se sabe
           a quien se busca, y no obliga a recorrer veinte cursos. -->
      <div class="por-codigo">
        <label class="campo campo--ancho">
          <span>Codigos de los estudiantes</span>
          <textarea
            id="phidias-codigos"
            v-model="codigosTexto"
            rows="2"
            placeholder="1234567, 7654321&#10;uno por linea o separados por comas"
          ></textarea>
        </label>
        <button
          type="button"
          class="boton boton--claro"
          :disabled="buscandoCodigos || codigos.length === 0"
          @click="buscarPorCodigo"
        >
          {{ buscandoCodigos ? 'Buscando...' : `Añadir ${codigos.length || ''}`.trim() }}
        </button>
      </div>

      <p v-if="codigosSinEncontrar.length > 0" class="aviso aviso--aviso">
        No se encontro a nadie con {{ codigosSinEncontrar.length === 1 ? 'el codigo' : 'los codigos' }}
        <strong>{{ codigosSinEncontrar.join(', ') }}</strong>. Revisalo en la lista de matricula del
        colegio: puede estar en otro año academico.
      </p>

      <div v-for="[nivel, lista] in porNivel" :key="nivel" class="nivel">
        <h3>{{ nivel }}</h3>
        <div class="secciones">
          <div
            v-for="s in lista"
            :key="s.id"
            class="seccion"
            :class="{
              'seccion--elegida': seccionesElegidas.includes(s.id),
              'seccion--abierta': explorando === s.id,
            }"
          >
            <label class="seccion__marca">
              <input
                type="checkbox"
                :checked="seccionesElegidas.includes(s.id)"
                @change="alternarSeccion(s.id)"
              />
              <span>
                <strong>{{ s.curso }} · {{ s.nombre }}</strong>
                <em>{{ s.estudiantes }} matriculados</em>
              </span>
            </label>
            <button type="button" class="mini-boton" @click="explorar(s.id)">
              {{ explorando === s.id ? 'Cerrar' : 'Ver nombres' }}
            </button>
          </div>
        </div>
      </div>

      <!--
        El panel de nombres vive AQUI, fuera del bucle de niveles. Antes estaba
        dentro y al abrir una seccion de otro nivel se cerraba solo.
      -->
      <div v-if="seccionAbierta" class="detalle">
        <div class="detalle__cabecera">
          <h3>{{ seccionAbierta.curso }} · {{ seccionAbierta.nombre }}</h3>
          <button type="button" class="mini-boton" @click="explorando = null">Cerrar</button>
        </div>
        <p v-if="cargandoSeccion" class="vacio">Cargando la lista...</p>
        <template v-else>
          <input
            v-model="busqueda"
            class="buscar"
            type="search"
            placeholder="Buscar por apellido..."
          />
          <p class="nota">
            Ordenados por apellido. {{ visibles.length }} de {{ listadoAbierto.length }}.
          </p>
          <ul class="alumnos">
            <li v-for="e in visibles" :key="e.id">
              <label :class="{ ya: e.yaImportado, elegido: bandeja.has(e.id) }">
                <input
                  type="checkbox"
                  :checked="bandeja.has(e.id)"
                  @change="alternarEstudiante(e)"
                />
                <span class="alumno__nombre">{{ e.listado }}</span>
                <span class="alumno__meta">{{ e.email ?? 'sin correo' }}</span>
                <span class="alumno__meta">{{ e.fechaNacimiento ?? 'sin fecha' }}</span>
                <span v-if="e.yaImportado" class="pastilla">ya tiene cuenta</span>
              </label>
            </li>
          </ul>
        </template>
      </div>

      <!-- La bandeja. Es lo que de verdad se va a importar, y por eso se ve. -->
      <div v-if="totalElegido > 0" class="bandeja">
        <div class="bandeja__cabecera">
          <strong>
            Van a entrar {{ totalElegido }}
            <span v-if="deSecciones > 0 && bandeja.size > 0">
              ({{ deSecciones }} de secciones completas y {{ bandeja.size }} elegidos uno a uno)
            </span>
          </strong>
          <button type="button" class="mini-boton" @click="vaciar">Vaciar</button>
        </div>

        <ul v-if="seccionesElegidas.length > 0" class="fichas">
          <li v-for="id in seccionesElegidas" :key="`s${id}`" class="ficha ficha--seccion">
            {{ secciones.find((s) => s.id === id)?.curso }} ·
            {{ secciones.find((s) => s.id === id)?.nombre }}
            <button type="button" :aria-label="`Quitar la seccion`" @click="alternarSeccion(id)">
              ×
            </button>
          </li>
        </ul>

        <ul v-if="enBandeja.length > 0" class="fichas">
          <li v-for="e in enBandeja" :key="e.id" class="ficha">
            {{ e.listado }}
            <em>{{ e.curso }}</em>
            <button type="button" :aria-label="`Quitar a ${e.listado}`" @click="quitar(e.id)">×</button>
          </li>
        </ul>
      </div>

      <div class="fila-form">
        <label class="campo">
          <span>Mismo PIN para todos (opcional)</span>
          <input v-model="pinComun" type="text" placeholder="gato sol luna flor" />
        </label>
        <button
          type="button"
          class="boton"
          :disabled="trabajando || totalElegido === 0"
          @click="importar"
        >
          Traer {{ totalElegido }} al grupo
        </button>
      </div>

      <div v-if="resultado" class="resumen">
        <p>
          <strong>{{ resultado.creados.length }}</strong> cuentas nuevas,
          <strong>{{ resultado.reutilizados.length }}</strong> ya existian y se han
          añadido a este grupo conservando su progreso.
        </p>
        <details v-if="resultado.omitidos.length > 0">
          <summary>{{ resultado.omitidos.length }} sin importar</summary>
          <ul>
            <li v-for="o in resultado.omitidos" :key="o.origenId">
              {{ o.nombre }} — {{ o.motivo }}
            </li>
          </ul>
        </details>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nota { margin: 0 0 10px; color: #64748b; font-size: 13px; }
.vacio { color: #94a3b8; margin: 0; }

.nivel { margin-bottom: 18px; }

.nivel h3 {
  margin: 0 0 8px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.secciones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 8px;
}

.seccion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.seccion--elegida { border-color: #1fa2ff; background: #eff8ff; }
.seccion--abierta { box-shadow: 0 0 0 2px #bfdbfe inset; }

.seccion__marca { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.seccion__marca span { display: flex; flex-direction: column; }
.seccion__marca em { font-style: normal; font-size: 12px; color: #64748b; }

.por-codigo {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.por-codigo textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}

.detalle {
  margin: 10px 0 16px;
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #fff;
}

.detalle__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.detalle__cabecera h3 { margin: 0; font-size: 14px; }

.buscar {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  margin-bottom: 8px;
}

.alumnos {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.alumnos li { border-bottom: 1px solid #f1f5f9; }

.alumnos label {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  cursor: pointer;
  font-size: 13px;
}

.alumnos label.elegido { background: #eff8ff; }

.alumno__nombre { font-weight: 500; }
.alumno__meta { color: #94a3b8; font-size: 12px; }

.ya .alumno__nombre { color: #64748b; }

.pastilla {
  padding: 1px 7px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 11px;
  white-space: nowrap;
}

.bandeja {
  margin: 12px 0;
  padding: 10px 12px;
  border: 1px solid #86efac;
  border-radius: 10px;
  background: #f0fdf4;
}

.bandeja__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  margin-bottom: 8px;
}

.bandeja__cabecera span { font-weight: 400; color: #15803d; }

.fichas {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 6px;
  padding: 0;
}

.ficha {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px 3px 9px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #cbd5e1;
  font-size: 12px;
}

.ficha em { font-style: normal; color: #94a3b8; }

.ficha--seccion { border-color: #1fa2ff; background: #eff8ff; }

.ficha button {
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.ficha button:hover { color: #b91c1c; }

.fila-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
}

.campo { display: flex; flex-direction: column; gap: 4px; flex: 1 1 220px; }
.campo--ancho { flex: 1 1 320px; }
.campo span { font-size: 13px; color: #475569; }
.campo input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }

.boton {
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  background: #1fa2ff;
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.boton--claro { background: #0ea5e9; }

.boton:disabled { background: #cbd5e1; cursor: not-allowed; }

.mini-boton {
  padding: 4px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.resumen {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  font-size: 14px;
}

.resumen p { margin: 0; }
.resumen ul { margin: 6px 0 0; padding-left: 20px; font-size: 13px; color: #64748b; }

.aviso { padding: 9px 12px; border-radius: 10px; margin: 0 0 12px; }
.aviso--grave { background: #fee2e2; border: 1px solid #fca5a5; }
.aviso--aviso { background: #fef9c3; border: 1px solid #fde047; }

@media (max-width: 640px) {
  .alumnos label { grid-template-columns: auto 1fr; }
  .alumno__meta { display: none; }
}
</style>
