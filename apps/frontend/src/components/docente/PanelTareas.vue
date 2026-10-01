<script setup lang="ts">
/**
 * Asignar trabajo.
 *
 * Dos decisiones y en este orden, porque es el orden en que se piensa:
 *
 *  1. **Que**: un mundo entero (una semana de clase) o una actividad concreta
 *     (el repaso de un concepto que no quedo claro).
 *  2. **A quien**: a todo el grupo, o a unos pocos. Lo segundo hace falta de
 *     verdad: tres estudiantes que faltaron el martes necesitan esa actividad y
 *     los otros veintisiete ya la hicieron.
 *
 * El catalogo de mundos se lee de la ruta publica, que no exige sesion y ya se
 * usa en la web: es la misma lista de treinta que ve todo el mundo. Las
 * actividades de un mundo se piden solo cuando se elige uno.
 */
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';

const props = defineProps<{ aula: { id: number; nombre: string } }>();
const emit = defineEmits<{ cambio: [] }>();

interface Persona {
  readonly id: number;
  readonly nombre: string;
}

interface Tarea {
  readonly id: number;
  readonly titulo: string | null;
  readonly instrucciones: string | null;
  readonly fechaLimite: string | null;
  readonly creadoEn: string;
  readonly mundo: { readonly numero: number; readonly nombre: string } | null;
  readonly actividad: { readonly id: number; readonly nombre: string; readonly numeroEnMundo: number } | null;
  readonly alcance: 'grupo' | 'estudiantes';
  readonly destinatarios: readonly Persona[];
}

interface MundoCatalogo {
  readonly numero: number;
  readonly nombre: string;
  readonly grupo: string;
  readonly concepto: string;
}

interface ActividadMundo {
  readonly id: number;
  readonly numeroEnMundo: number;
  readonly nombre: string;
  readonly tipo: string;
}

const tareas = ref<readonly Tarea[]>([]);
const mundos = ref<readonly MundoCatalogo[]>([]);
const estudiantes = ref<readonly Persona[]>([]);
const actividades = ref<readonly ActividadMundo[]>([]);
const cargando = ref(true);
const cargandoActividades = ref(false);
const error = ref<string | null>(null);
const trabajando = ref(false);

const mundoElegido = ref<number | null>(null);
/** Null = el mundo entero. */
const actividadElegida = ref<number | null>(null);
const paraTodos = ref(true);
const elegidos = ref<number[]>([]);
const titulo = ref('');
const instrucciones = ref('');
const fechaLimite = ref('');

const mundoActual = computed(() => mundos.value.find((m) => m.numero === mundoElegido.value) ?? null);
const puedeAsignar = computed(
  () => mundoElegido.value !== null && (paraTodos.value || elegidos.value.length > 0),
);

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const [t, c, e] = await Promise.all([
      api.get<{ tareas: Tarea[] }>(`/docente/aulas/${props.aula.id}/tareas`),
      api.get<{ mundos: MundoCatalogo[] }>('/curriculo/catalogo'),
      api.get<{ estudiantes: Persona[] }>(`/docente/aulas/${props.aula.id}/estudiantes`),
    ]);
    tareas.value = t.tareas;
    mundos.value = c.mundos;
    estudiantes.value = e.estudiantes;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las tareas';
  } finally {
    cargando.value = false;
  }
}

/** Las actividades del mundo elegido, para poder asignar una sola. */
async function cargarActividades(numero: number): Promise<void> {
  cargandoActividades.value = true;
  actividades.value = [];
  actividadElegida.value = null;
  try {
    const r = await api.get<{ actividades: ActividadMundo[] }>(
      `/docente/mundos/${numero}/actividades`,
    );
    actividades.value = r.actividades;
  } catch {
    // Que no se pueda listar no impide asignar el mundo entero, que es lo
    // habitual: se deja el selector vacio y no se grita.
    actividades.value = [];
  } finally {
    cargandoActividades.value = false;
  }
}

function alternar(ninoId: number): void {
  elegidos.value = elegidos.value.includes(ninoId)
    ? elegidos.value.filter((v) => v !== ninoId)
    : [...elegidos.value, ninoId];
}

async function asignar(): Promise<void> {
  if (!puedeAsignar.value || trabajando.value) return;
  trabajando.value = true;
  error.value = null;
  try {
    // Se exige un entero y no "distinto de null": un selector devuelve cadena
    // vacia cuando se vuelve a "el mundo entero", y mandar eso como id de
    // actividad es un 400 que el docente no sabria explicar.
    const actividadId = Number.isInteger(actividadElegida.value) ? actividadElegida.value : null;
    await api.post(`/docente/aulas/${props.aula.id}/tareas`, {
      ...(actividadId !== null ? { actividadId } : { mundoNumero: mundoElegido.value }),
      ...(paraTodos.value ? {} : { ninoIds: elegidos.value }),
      ...(titulo.value.trim() ? { titulo: titulo.value.trim() } : {}),
      ...(instrucciones.value.trim() ? { instrucciones: instrucciones.value.trim() } : {}),
      ...(fechaLimite.value ? { fechaLimite: fechaLimite.value } : {}),
    });
    titulo.value = '';
    instrucciones.value = '';
    fechaLimite.value = '';
    elegidos.value = [];
    paraTodos.value = true;
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo asignar';
  } finally {
    trabajando.value = false;
  }
}

async function retirar(tarea: Tarea): Promise<void> {
  if (!window.confirm('Retirar esta tarea. Lo que ya hayan jugado se conserva.')) return;
  trabajando.value = true;
  try {
    await api.delete(`/docente/tareas/${tarea.id}`);
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo retirar';
  } finally {
    trabajando.value = false;
  }
}

const fecha = (valor: string | null): string =>
  valor ? new Date(valor).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';

watch(mundoElegido, (numero) => {
  if (numero === null) {
    actividades.value = [];
    actividadElegida.value = null;
    return;
  }
  void cargarActividades(numero);
});

watch(
  () => props.aula.id,
  () => {
    elegidos.value = [];
    paraTodos.value = true;
    void cargar();
  },
);
onMounted(() => void cargar());
</script>

<template>
  <div>
    <section class="panel">
      <h2>Tareas de {{ aula.nombre }}</h2>
      <p v-if="error" class="aviso aviso--grave">{{ error }}</p>

      <p v-if="cargando" class="vacio">Cargando...</p>
      <p v-else-if="tareas.length === 0" class="vacio">
        Todavia no has asignado nada. Los estudiantes pueden jugar igualmente: una
        tarea solo marca por donde quieres que vayan.
      </p>

      <table v-else class="tabla">
        <thead>
          <tr><th>Que</th><th>A quien</th><th>Titulo</th><th>Entrega</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="t in tareas" :key="t.id">
            <td>
              <template v-if="t.actividad">
                Actividad {{ t.actividad.numeroEnMundo }} · {{ t.actividad.nombre }}
              </template>
              <template v-else-if="t.mundo">Mundo {{ t.mundo.numero }} · {{ t.mundo.nombre }}</template>
              <template v-else>—</template>
            </td>
            <td>
              <span v-if="t.alcance === 'grupo'" class="pastilla">todo el grupo</span>
              <span v-else :title="t.destinatarios.map((d) => d.nombre).join(', ')" class="pastilla pastilla--pocos">
                {{ t.destinatarios.length }}
                {{ t.destinatarios.length === 1 ? 'estudiante' : 'estudiantes' }}
              </span>
            </td>
            <td>{{ t.titulo ?? '—' }}</td>
            <td>{{ fecha(t.fechaLimite) }}</td>
            <td class="acciones">
              <button type="button" class="mini-boton mini-boton--rojo" @click="retirar(t)">
                Retirar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Asignar trabajo</h2>

      <div class="fila-form">
        <label class="campo">
          <span>Mundo</span>
          <select v-model.number="mundoElegido">
            <option :value="null">Elige un mundo...</option>
            <option v-for="m in mundos" :key="m.numero" :value="m.numero">
              {{ m.numero }} · {{ m.nombre }} ({{ m.grupo }})
            </option>
          </select>
        </label>

        <label class="campo">
          <span>Actividad</span>
          <select v-model.number="actividadElegida" :disabled="mundoElegido === null || cargandoActividades">
            <option :value="null">
              {{ cargandoActividades ? 'Cargando...' : 'El mundo entero' }}
            </option>
            <option v-for="a in actividades" :key="a.id" :value="a.id">
              {{ a.numeroEnMundo }} · {{ a.nombre }}
            </option>
          </select>
          <small>Una actividad suelta es el repaso de un concepto.</small>
        </label>
      </div>

      <p v-if="mundoActual" class="nota">
        Concepto: <strong>{{ mundoActual.concepto }}</strong>.
        {{ actividadElegida === null ? `Son ${actividades.length || 20} actividades.` : 'Una actividad.' }}
      </p>

      <!-- A quien. Es una decision de dos, y las dos se ven a la vez. -->
      <fieldset class="destinatarios">
        <legend>A quien</legend>
        <label class="radio">
          <input v-model="paraTodos" type="radio" :value="true" />
          <span>A todo el grupo ({{ estudiantes.length }})</span>
        </label>
        <label class="radio">
          <input v-model="paraTodos" type="radio" :value="false" />
          <span>Solo a algunos</span>
        </label>

        <div v-if="!paraTodos" class="lista-ninos">
          <p v-if="estudiantes.length === 0" class="vacio">
            Este grupo todavia no tiene estudiantes.
          </p>
          <label v-for="e in estudiantes" :key="e.id" class="nino">
            <input type="checkbox" :checked="elegidos.includes(e.id)" @change="alternar(e.id)" />
            <span>{{ e.nombre }}</span>
          </label>
        </div>
        <p v-if="!paraTodos" class="nota">
          {{ elegidos.length }} elegidos. Los demas no veran esta tarea, y en el seguimiento su
          celda queda vacia: no es que no la hayan hecho, es que no era suya.
        </p>
      </fieldset>

      <div class="fila-form">
        <label class="campo">
          <span>Titulo (opcional)</span>
          <input v-model="titulo" type="text" placeholder="Trabajo de la semana" maxlength="200" />
        </label>
        <label class="campo campo--corto">
          <span>Fecha de entrega</span>
          <input v-model="fechaLimite" type="date" />
        </label>
      </div>

      <label class="campo">
        <span>Instrucciones (opcional)</span>
        <textarea v-model="instrucciones" class="area" rows="3" maxlength="2000"></textarea>
      </label>

      <button type="button" class="boton" :disabled="trabajando || !puedeAsignar" @click="asignar">
        {{ paraTodos ? 'Asignar al grupo' : `Asignar a ${elegidos.length}` }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 18px;
}

.panel h2 { margin: 0 0 10px; font-family: var(--fuente-titulo); font-size: 18px; }
.nota { margin: 0 0 10px; color: #64748b; font-size: 13px; }
.vacio { color: #94a3b8; margin: 0; }

.tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
.tabla th, .tabla td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
.tabla th { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
.acciones { text-align: right; }

.pastilla {
  padding: 1px 8px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 11px;
  white-space: nowrap;
}

.pastilla--pocos { background: #fef3c7; color: #92400e; cursor: help; }

.fila-form { display: flex; gap: 10px; flex-wrap: wrap; }

.campo { display: flex; flex-direction: column; gap: 4px; flex: 1 1 200px; margin-bottom: 12px; }
.campo--corto { flex: 0 0 180px; }
.campo span { font-size: 13px; color: #475569; }
.campo small { color: #94a3b8; font-size: 12px; }

.campo input,
.campo select,
.area {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  width: 100%;
}

.area { resize: vertical; }

.destinatarios {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 14px 4px;
  margin: 0 0 14px;
}

.destinatarios legend { font-size: 13px; color: #475569; padding: 0 6px; }

.radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 16px;
  font-size: 14px;
  cursor: pointer;
}

.lista-ninos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 4px 10px;
  margin: 10px 0;
  max-height: 260px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  background: #f8fafc;
}

.nino {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  cursor: pointer;
}

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

.boton:disabled { background: #cbd5e1; cursor: not-allowed; }

.mini-boton {
  padding: 4px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.mini-boton--rojo { color: #b91c1c; border-color: #fecaca; }

.aviso { padding: 9px 12px; border-radius: 10px; margin: 0 0 12px; background: #fee2e2; border: 1px solid #fca5a5; }
</style>
