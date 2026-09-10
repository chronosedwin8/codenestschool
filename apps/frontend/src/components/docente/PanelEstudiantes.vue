<script setup lang="ts">
/**
 * La lista del grupo y las tres formas de llenarla.
 *
 * Las tres existen porque responden a momentos distintos de un curso:
 *
 *  - Importar del colegio es lo que se hace el primer dia: los nombres ya estan
 *    escritos en el sistema academico y volver a teclearlos es trabajo tirado.
 *  - Pegar una lista sirve cuando no hay sistema academico, o para el grupo de
 *    refuerzo que el docente arma de memoria.
 *  - Uno a uno es para el que llega en octubre.
 *
 * Retirar a alguien del grupo no borra su cuenta ni su progreso, y se dice en la
 * propia pantalla: es la duda que frena a cualquiera antes de pulsar.
 */
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';
import ImportarPhidias from '@/components/docente/ImportarPhidias.vue';

const props = defineProps<{
  aula: { id: number; nombre: string; estudiantes: number };
}>();
const emit = defineEmits<{ cambio: [] }>();

interface Estudiante {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly grupoEdad: string | null;
  readonly activo: boolean;
  readonly consentimiento: string;
  readonly estrellas: number;
  readonly actividadesCompletadas: number;
}

interface Credencial {
  readonly nombre: string;
  readonly usuario: string;
  readonly pin: readonly string[];
}

const estudiantes = ref<readonly Estudiante[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const trabajando = ref(false);

/** Credenciales recien generadas: se enseñan una vez, para poder anotarlas. */
const recienCreados = ref<readonly Credencial[]>([]);

const forma = ref<'colegio' | 'lista' | 'uno'>('colegio');

// Alta pegando una lista.
const listaPegada = ref('');
const fechaLista = ref('');
const pinComun = ref('');

// Alta de uno.
const unNombre = ref('');
const unaFecha = ref('');

const editando = ref<number | null>(null);
const nombreEditado = ref('');
const usuarioEditado = ref('');

const nombresPegados = computed(() =>
  listaPegada.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 2),
);

const IMAGENES: Record<string, string> = {
  gato: '🐱', sol: '☀️', arbol: '🌳', luna: '🌙', pez: '🐟',
  flor: '🌸', nube: '☁️', tren: '🚂', pato: '🦆',
};

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const datos = await api.get<{ estudiantes: Estudiante[] }>(
      `/docente/aulas/${props.aula.id}/estudiantes`,
    );
    estudiantes.value = datos.estudiantes;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la lista';
  } finally {
    cargando.value = false;
  }
}

/** El PIN escrito como "gato sol luna flor" se convierte en la lista que espera la API. */
function pinDeTexto(valor: string): string[] | undefined {
  const partes = valor.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  return partes.length === 4 && partes.every((p) => p in IMAGENES) ? partes : undefined;
}

async function crear(nuevos: { nombre: string; fechaNacimiento: string }[]): Promise<void> {
  if (nuevos.length === 0 || trabajando.value) return;
  trabajando.value = true;
  error.value = null;
  try {
    const pin = pinDeTexto(pinComun.value);
    const datos = await api.post<{ estudiantes: Credencial[] }>(
      `/docente/aulas/${props.aula.id}/estudiantes`,
      { estudiantes: nuevos, ...(pin ? { pinComun: pin } : {}) },
    );
    recienCreados.value = datos.estudiantes;
    listaPegada.value = '';
    unNombre.value = '';
    await cargar();
    emit('cambio');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron crear los estudiantes';
  } finally {
    trabajando.value = false;
  }
}

function crearDeLista(): void {
  if (!fechaLista.value) {
    error.value = 'Indica la fecha de nacimiento: de ella depende con que editor juegan';
    return;
  }
  void crear(nombresPegados.value.map((nombre) => ({ nombre, fechaNacimiento: fechaLista.value })));
}

function crearUno(): void {
  if (!unaFecha.value || unNombre.value.trim().length < 2) return;
  void crear([{ nombre: unNombre.value.trim(), fechaNacimiento: unaFecha.value }]);
}

function empezarEdicion(e: Estudiante): void {
  editando.value = e.id;
  nombreEditado.value = e.nombre;
  usuarioEditado.value = e.usuario;
}

async function guardarEdicion(): Promise<void> {
  if (editando.value === null) return;
  trabajando.value = true;
  try {
    await api.put(`/docente/estudiantes/${editando.value}`, {
      nombre: nombreEditado.value.trim(),
      usuario: usuarioEditado.value.trim().toLowerCase(),
    });
    editando.value = null;
    await cargar();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar';
  } finally {
    trabajando.value = false;
  }
}

async function retirar(e: Estudiante): Promise<void> {
  const seguro = window.confirm(
    `Retirar a ${e.nombre} de ${props.aula.nombre}.\n\n` +
      'Su cuenta y su progreso se conservan: solo deja de aparecer en este grupo.',
  );
  if (!seguro) return;

  trabajando.value = true;
  try {
    await api.delete(`/docente/aulas/${props.aula.id}/estudiantes/${e.id}`);
    await cargar();
    emit('cambio');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo retirar';
  } finally {
    trabajando.value = false;
  }
}

watch(() => props.aula.id, () => {
  recienCreados.value = [];
  void cargar();
});
onMounted(() => void cargar());
</script>

<template>
  <div>
    <section class="panel">
      <h2>Estudiantes de {{ aula.nombre }}</h2>
      <p v-if="error" class="aviso aviso--grave">{{ error }}</p>

      <p v-if="cargando" class="vacio">Cargando...</p>
      <p v-else-if="estudiantes.length === 0" class="vacio">
        Este grupo todavia no tiene estudiantes.
      </p>

      <table v-else class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Grupo</th>
            <th class="num">Estrellas</th>
            <th class="num">Actividades</th>
            <th>Permiso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in estudiantes" :key="e.id" :class="{ 'fila--inactiva': !e.activo }">
            <td>
              <template v-if="editando === e.id">
                <input v-model="nombreEditado" class="mini" type="text" />
              </template>
              <template v-else>{{ e.nombre }}</template>
            </td>
            <td class="mono">
              <template v-if="editando === e.id">
                <input v-model="usuarioEditado" class="mini" type="text" />
              </template>
              <template v-else>{{ e.usuario }}</template>
            </td>
            <td>{{ e.grupoEdad ?? '—' }}</td>
            <td class="num">{{ e.estrellas }}</td>
            <td class="num">{{ e.actividadesCompletadas }}</td>
            <td>
              <span :class="e.consentimiento === 'otorgado' ? 'pastilla pastilla--ok' : 'pastilla'">
                {{ e.consentimiento }}
              </span>
            </td>
            <td class="acciones">
              <template v-if="editando === e.id">
                <button type="button" class="mini-boton" :disabled="trabajando" @click="guardarEdicion">
                  Guardar
                </button>
                <button type="button" class="mini-boton" @click="editando = null">Cancelar</button>
              </template>
              <template v-else>
                <button type="button" class="mini-boton" @click="empezarEdicion(e)">Editar</button>
                <button type="button" class="mini-boton mini-boton--rojo" @click="retirar(e)">
                  Retirar
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Credenciales recien generadas. Se enseñan una sola vez y por eso avisa. -->
    <section v-if="recienCreados.length > 0" class="panel panel--destacado">
      <h2>Anota estas credenciales</h2>
      <p class="nota">
        Se muestran ahora porque acabas de crearlas. Tambien las tienes siempre en la
        pestaña <strong>Credenciales</strong>.
      </p>
      <table class="tabla">
        <thead>
          <tr><th>Nombre</th><th>Usuario</th><th>PIN</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in recienCreados" :key="c.usuario">
            <td>{{ c.nombre }}</td>
            <td class="mono">{{ c.usuario }}</td>
            <td class="pin">
              <span v-for="(img, i) in c.pin" :key="i" :title="img">{{ IMAGENES[img] ?? img }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Añadir estudiantes</h2>

      <nav class="pestanas pestanas--sub">
        <button
          type="button" class="pestana" :class="{ 'pestana--activa': forma === 'colegio' }"
          @click="forma = 'colegio'"
        >Desde el colegio</button>
        <button
          type="button" class="pestana" :class="{ 'pestana--activa': forma === 'lista' }"
          @click="forma = 'lista'"
        >Pegar una lista</button>
        <button
          type="button" class="pestana" :class="{ 'pestana--activa': forma === 'uno' }"
          @click="forma = 'uno'"
        >Uno a uno</button>
      </nav>

      <ImportarPhidias
        v-if="forma === 'colegio'"
        :aula="aula"
        @importado="cargar(); emit('cambio')"
      />

      <template v-else-if="forma === 'lista'">
        <p class="nota">Un nombre completo por linea. Se crean todos o ninguno.</p>
        <textarea
          v-model="listaPegada"
          class="area"
          rows="8"
          placeholder="Ana Lopez Garcia&#10;Bruno Diaz Ruiz&#10;Carla Ruiz Mena"
        ></textarea>
        <div class="fila-form">
          <label class="campo campo--corto">
            <span>Fecha de nacimiento</span>
            <input v-model="fechaLista" type="date" />
          </label>
          <label class="campo">
            <span>Mismo PIN para todos (opcional)</span>
            <input v-model="pinComun" type="text" placeholder="gato sol luna flor" />
          </label>
          <button type="button" class="boton" :disabled="trabajando || nombresPegados.length === 0"
            @click="crearDeLista">
            Crear {{ nombresPegados.length }} estudiantes
          </button>
        </div>
      </template>

      <template v-else>
        <div class="fila-form">
          <label class="campo">
            <span>Nombre completo</span>
            <input v-model="unNombre" type="text" placeholder="Diego Mora Sanz" />
          </label>
          <label class="campo campo--corto">
            <span>Fecha de nacimiento</span>
            <input v-model="unaFecha" type="date" />
          </label>
          <button type="button" class="boton" :disabled="trabajando || !unaFecha" @click="crearUno">
            Crear
          </button>
        </div>
      </template>
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

.panel--destacado {
  border-color: #86efac;
  background: #f0fdf4;
}

.panel h2 {
  margin: 0 0 10px;
  font-family: var(--fuente-titulo);
  font-size: 18px;
}

.nota {
  margin: 0 0 10px;
  color: #64748b;
  font-size: 13px;
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.tabla th,
.tabla td {
  text-align: left;
  padding: 7px 8px;
  border-bottom: 1px solid #f1f5f9;
}

.tabla th {
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.num { text-align: right; }
.mono { font-family: ui-monospace, monospace; font-size: 13px; }
.pin { font-size: 20px; letter-spacing: 2px; }

.fila--inactiva { opacity: 0.5; }

.pastilla {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: #fef9c3;
  font-size: 12px;
}

.pastilla--ok { background: #dcfce7; }

.acciones { text-align: right; white-space: nowrap; }

.mini-boton {
  padding: 4px 9px;
  margin-left: 4px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.mini-boton--rojo { color: #b91c1c; border-color: #fecaca; }

.mini {
  width: 100%;
  padding: 3px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
}

.area {
  width: 100%;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font: inherit;
  resize: vertical;
  margin-bottom: 10px;
}

.fila-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.campo { display: flex; flex-direction: column; gap: 4px; flex: 1 1 200px; }
.campo--corto { flex: 0 0 180px; }
.campo span { font-size: 13px; color: #475569; }
.campo input {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
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

.pestanas { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }

.pestana {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  color: #475569;
}

.pestana--activa { background: #e0f2fe; border-color: #7dd3fc; color: #0369a1; }

.aviso {
  padding: 9px 12px;
  border-radius: 10px;
  margin: 0 0 12px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
}

.vacio { color: #94a3b8; margin: 0; }

@media (max-width: 720px) {
  .tabla { display: block; overflow-x: auto; }
}
</style>
