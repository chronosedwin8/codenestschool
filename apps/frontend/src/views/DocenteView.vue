<script setup lang="ts">
/**
 * Zona del docente.
 *
 * El usuario aqui no es un niño ni un padre: es alguien de pie delante de
 * treinta personas con veinte minutos de clase. Eso manda sobre el diseño:
 *
 *  - Todo lo caro se hace en lote. Dar de alta, cambiar PIN, asignar tarea:
 *    ninguna de esas tres cosas se hace de una en una en un aula de verdad.
 *  - La lista de credenciales esta pensada para imprimirse. Es papel que acaba
 *    pegado en la pared, y por eso tiene su propio estilo de impresion.
 *  - Nada se borra sin decir que pasa con el progreso. Un docente que retira a
 *    un estudiante de un grupo no espera perder su historial.
 */
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';

import PanelAvance from '@/components/docente/PanelAvance.vue';
import PanelCredenciales from '@/components/docente/PanelCredenciales.vue';
import PanelEstudiantes from '@/components/docente/PanelEstudiantes.vue';
import PanelTareas from '@/components/docente/PanelTareas.vue';
import PanelJuegos from '@/components/docente/PanelJuegos.vue';

export interface Aula {
  readonly id: number;
  readonly nombre: string;
  readonly grado: string | null;
  readonly codigoAcceso: string;
  readonly activa: boolean;
  readonly estudiantes: number;
  readonly tareas: number;
  readonly docente: { readonly id: number; readonly nombre: string };
}

type Pestana = 'estudiantes' | 'credenciales' | 'tareas' | 'avance' | 'juegos';

const PESTANAS: { clave: Pestana; etiqueta: string }[] = [
  { clave: 'estudiantes', etiqueta: 'Estudiantes' },
  { clave: 'credenciales', etiqueta: 'Credenciales' },
  { clave: 'tareas', etiqueta: 'Tareas' },
  { clave: 'avance', etiqueta: 'Avance' },
  { clave: 'juegos', etiqueta: 'Juegos' },
];

const aulas = ref<readonly Aula[]>([]);
const aulaId = ref<number | null>(null);
const pestana = ref<Pestana>('estudiantes');
const cargando = ref(true);
const error = ref<string | null>(null);
/** Falso si el servidor no tiene clave de cifrado: los PIN no se podran ver. */
const puedeVerPines = ref(true);

const nuevoNombre = ref('');
const nuevoGrado = ref('');
const creandoAula = ref(false);

const aula = computed(() => aulas.value.find((a) => a.id === aulaId.value) ?? null);

async function cargarAulas(seleccionar?: number): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const datos = await api.get<{ aulas: Aula[]; puedeVerPines: boolean }>('/docente/aulas');
    aulas.value = datos.aulas;
    puedeVerPines.value = datos.puedeVerPines;
    aulaId.value = seleccionar ?? aulaId.value ?? datos.aulas[0]?.id ?? null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los grupos';
  } finally {
    cargando.value = false;
  }
}

async function crearAula(): Promise<void> {
  if (nuevoNombre.value.trim().length < 2 || creandoAula.value) return;
  creandoAula.value = true;
  try {
    const { aula: creada } = await api.post<{ aula: Aula }>('/docente/aulas', {
      nombre: nuevoNombre.value.trim(),
      ...(nuevoGrado.value.trim() ? { grado: nuevoGrado.value.trim() } : {}),
    });
    nuevoNombre.value = '';
    nuevoGrado.value = '';
    await cargarAulas(creada.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo crear el grupo';
  } finally {
    creandoAula.value = false;
  }
}

// Al cambiar de grupo se vuelve a la primera pestaña: el contexto es otro.
watch(aulaId, () => {
  pestana.value = 'estudiantes';
});

onMounted(() => void cargarAulas());
</script>

<template>
  <main class="docente">
    <header class="docente__cabecera">
      <div>
        <h1>Mis grupos</h1>
        <p class="docente__sub">Estudiantes, credenciales, tareas y seguimiento.</p>
      </div>
      <RouterLink class="enlace" to="/portal">Ir al portal</RouterLink>
    </header>

    <p v-if="error" class="aviso aviso--grave">{{ error }}</p>

    <!-- Sin clave de cifrado el servidor no puede devolver los PIN. Se avisa
         aqui arriba porque cambia lo que el docente puede hacer, no es un
         detalle de una pantalla suelta. -->
    <p v-if="!puedeVerPines" class="aviso aviso--aviso">
      Este servidor no guarda los PIN de forma consultable, asi que solo se ven
      al crearlos o al cambiarlos. Para poder consultarlos despues hay que
      configurar <code>PIN_SECRET</code>.
    </p>

    <section class="panel">
      <h2>Grupos</h2>

      <p v-if="cargando" class="vacio">Cargando...</p>
      <p v-else-if="aulas.length === 0" class="vacio">
        Todavia no tienes ningun grupo. Crea el primero abajo.
      </p>

      <div v-else class="grupos">
        <button
          v-for="a in aulas"
          :key="a.id"
          type="button"
          class="grupo"
          :class="{ 'grupo--activo': a.id === aulaId, 'grupo--archivado': !a.activa }"
          @click="aulaId = a.id"
        >
          <strong>{{ a.nombre }}</strong>
          <span class="grupo__meta">
            {{ a.grado ? `${a.grado} · ` : '' }}{{ a.estudiantes }} estudiantes
          </span>
          <span class="grupo__codigo">{{ a.codigoAcceso }}</span>
        </button>
      </div>

      <form class="fila-form" @submit.prevent="crearAula">
        <label class="campo">
          <span>Nombre del grupo</span>
          <input v-model="nuevoNombre" type="text" placeholder="Tercero B" maxlength="150" />
        </label>
        <label class="campo campo--corto">
          <span>Grado</span>
          <input v-model="nuevoGrado" type="text" placeholder="3" maxlength="40" />
        </label>
        <button type="submit" class="boton" :disabled="creandoAula || nuevoNombre.trim().length < 2">
          Crear grupo
        </button>
      </form>
    </section>

    <template v-if="aula">
      <nav class="pestanas" aria-label="Secciones del grupo">
        <button
          v-for="p in PESTANAS"
          :key="p.clave"
          type="button"
          class="pestana"
          :class="{ 'pestana--activa': pestana === p.clave }"
          @click="pestana = p.clave"
        >
          {{ p.etiqueta }}
        </button>
      </nav>

      <PanelEstudiantes
        v-if="pestana === 'estudiantes'"
        :aula="aula"
        @cambio="cargarAulas(aula.id)"
      />
      <PanelCredenciales
        v-else-if="pestana === 'credenciales'"
        :aula="aula"
        :puede-ver-pines="puedeVerPines"
      />
      <PanelTareas v-else-if="pestana === 'tareas'" :aula="aula" @cambio="cargarAulas(aula.id)" />
      <!--
        Los juegos no dependen del grupo elegido: la lista es de todos sus
        grupos, porque lo que el docente quiere ver de un vistazo es quien ha
        construido algo y quien no ha empezado.
      -->
      <PanelJuegos v-else-if="pestana === 'juegos'" />
      <PanelAvance v-else :aula="aula" />
    </template>
  </main>
</template>

<style scoped>
.docente {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 64px;
  color: var(--tinta, #1e293b);
  font-size: 15px;
}

.docente__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.docente__cabecera h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 26px;
}

.docente__sub {
  margin: 4px 0 0;
  color: #64748b;
}

.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 18px;
}

.panel h2 {
  margin: 0 0 12px;
  font-family: var(--fuente-titulo);
  font-size: 18px;
}

.grupos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.grupo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.grupo--activo {
  border-color: #1fa2ff;
  background: #eff8ff;
  box-shadow: inset 0 0 0 1px #1fa2ff;
}

.grupo--archivado {
  opacity: 0.55;
}

.grupo__meta {
  color: #64748b;
  font-size: 13px;
}

.grupo__codigo {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: #94a3b8;
}

.fila-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  border-top: 1px solid #f1f5f9;
  padding-top: 14px;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 200px;
}

.campo--corto {
  flex: 0 0 90px;
}

.campo span {
  font-size: 13px;
  color: #475569;
}

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

.boton:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.pestanas {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pestana {
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  cursor: pointer;
  color: #475569;
}

.pestana--activa {
  background: #1e293b;
  border-color: #1e293b;
  color: #fff;
}

.aviso {
  padding: 10px 14px;
  border-radius: 10px;
  margin: 0 0 14px;
}

.aviso--aviso {
  background: #fef9c3;
  border: 1px solid #fde047;
}

.aviso--grave {
  background: #fee2e2;
  border: 1px solid #fca5a5;
}

.vacio {
  color: #94a3b8;
  margin: 0;
}

.enlace {
  color: #1fa2ff;
  text-decoration: none;
  font-weight: 600;
}

@media (max-width: 640px) {
  .docente {
    padding: 16px 12px 48px;
  }
}
</style>
