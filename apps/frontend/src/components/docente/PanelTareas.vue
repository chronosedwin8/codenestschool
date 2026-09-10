<script setup lang="ts">
/**
 * Asignar trabajo al grupo.
 *
 * Se asigna un mundo entero o una actividad concreta. Un mundo son veinte
 * actividades y una semana de clase; una actividad suelta es el repaso de un
 * concepto que no quedo claro. No hace falta mas granularidad que esa.
 *
 * El catalogo de mundos se lee de la ruta publica, que no exige sesion y ya se
 * usa en la web: es la misma lista de treinta que ve todo el mundo.
 */
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';

const props = defineProps<{ aula: { id: number; nombre: string } }>();
const emit = defineEmits<{ cambio: [] }>();

interface Tarea {
  readonly id: number;
  readonly titulo: string | null;
  readonly instrucciones: string | null;
  readonly fechaLimite: string | null;
  readonly creadoEn: string;
  readonly mundo: { readonly numero: number; readonly nombre: string } | null;
  readonly actividad: { readonly id: number; readonly nombre: string; readonly numeroEnMundo: number } | null;
}

interface MundoCatalogo {
  readonly numero: number;
  readonly nombre: string;
  readonly grupo: string;
  readonly concepto: string;
}

const tareas = ref<readonly Tarea[]>([]);
const mundos = ref<readonly MundoCatalogo[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const trabajando = ref(false);

const mundoElegido = ref<number | null>(null);
const titulo = ref('');
const instrucciones = ref('');
const fechaLimite = ref('');

const mundoActual = computed(() => mundos.value.find((m) => m.numero === mundoElegido.value) ?? null);

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const [t, c] = await Promise.all([
      api.get<{ tareas: Tarea[] }>(`/docente/aulas/${props.aula.id}/tareas`),
      api.get<{ mundos: MundoCatalogo[] }>('/curriculo/catalogo'),
    ]);
    tareas.value = t.tareas;
    mundos.value = c.mundos;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las tareas';
  } finally {
    cargando.value = false;
  }
}

async function asignar(): Promise<void> {
  if (mundoElegido.value === null || trabajando.value) return;
  trabajando.value = true;
  error.value = null;
  try {
    await api.post(`/docente/aulas/${props.aula.id}/tareas`, {
      mundoNumero: mundoElegido.value,
      ...(titulo.value.trim() ? { titulo: titulo.value.trim() } : {}),
      ...(instrucciones.value.trim() ? { instrucciones: instrucciones.value.trim() } : {}),
      ...(fechaLimite.value ? { fechaLimite: fechaLimite.value } : {}),
    });
    titulo.value = '';
    instrucciones.value = '';
    fechaLimite.value = '';
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo asignar';
  } finally {
    trabajando.value = false;
  }
}

async function retirar(tarea: Tarea): Promise<void> {
  if (!window.confirm('Retirar esta tarea del grupo. Lo que ya hayan jugado se conserva.')) return;
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

watch(() => props.aula.id, () => void cargar());
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
          <tr><th>Que</th><th>Titulo</th><th>Entrega</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="t in tareas" :key="t.id">
            <td>
              <template v-if="t.mundo">Mundo {{ t.mundo.numero }} · {{ t.mundo.nombre }}</template>
              <template v-else-if="t.actividad">
                Actividad {{ t.actividad.numeroEnMundo }} · {{ t.actividad.nombre }}
              </template>
              <template v-else>—</template>
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
      <h2>Asignar un mundo</h2>

      <label class="campo">
        <span>Mundo</span>
        <select v-model.number="mundoElegido">
          <option :value="null">Elige un mundo...</option>
          <option v-for="m in mundos" :key="m.numero" :value="m.numero">
            {{ m.numero }} · {{ m.nombre }} ({{ m.grupo }})
          </option>
        </select>
      </label>

      <p v-if="mundoActual" class="nota">
        Concepto: <strong>{{ mundoActual.concepto }}</strong>. Son 20 actividades.
      </p>

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

      <button type="button" class="boton" :disabled="trabajando || mundoElegido === null" @click="asignar">
        Asignar al grupo
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

.fila-form { display: flex; gap: 10px; flex-wrap: wrap; }

.campo { display: flex; flex-direction: column; gap: 4px; flex: 1 1 200px; margin-bottom: 12px; }
.campo--corto { flex: 0 0 180px; }
.campo span { font-size: 13px; color: #475569; }

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
