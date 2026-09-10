<script setup lang="ts">
/**
 * Por donde va el grupo, y por donde va cada uno.
 *
 * La pregunta que hace un docente de verdad no es "cuantas estrellas tiene Juan"
 * sino "por donde va la clase y quien se ha quedado atras". Por eso lo primero
 * que se ve es el grupo por mundos, y la ficha individual esta un clic despues.
 *
 * En la ficha, lo que de verdad sirve no es la lista de completadas: es donde se
 * atasca. Una actividad sin terminar puede ser simplemente una a la que aun no ha
 * llegado; una con nueve intentos es una conversacion pendiente.
 */
import { onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';

const props = defineProps<{ aula: { id: number; nombre: string } }>();

interface FilaMundo {
  readonly mundo: number;
  readonly nombre: string;
  readonly actividades: number;
  readonly completadasTotales: number;
  readonly estudiantesQueLoTerminaron: number;
  readonly estrellasPromedio: number;
}

interface FilaEstudiante {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly estrellas: number;
  readonly actividadesCompletadas: number;
  readonly ultimaActividad: string | null;
}

interface Ficha {
  readonly estudiante: {
    readonly nombre: string;
    readonly usuario: string;
    readonly grupoEdad: string | null;
    readonly estrellas: number;
    readonly monedas: number;
    readonly rachaDias: number;
  };
  readonly porMundo: readonly {
    readonly mundo: number;
    readonly nombre: string;
    readonly actividades: number;
    readonly completadas: number;
    readonly estrellas: number;
  }[];
  readonly atascos: readonly {
    readonly mundo: number;
    readonly actividad: number;
    readonly nombre: string;
    readonly intentos: number;
    readonly estrellas: number;
    readonly completada: boolean;
  }[];
}

const mundos = ref<readonly FilaMundo[]>([]);
const estudiantes = ref<readonly FilaEstudiante[]>([]);
const ficha = ref<Ficha | null>(null);
const elegido = ref<number | null>(null);
const cargando = ref(true);
const error = ref<string | null>(null);

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  ficha.value = null;
  elegido.value = null;
  try {
    const datos = await api.get<{ mundos: FilaMundo[]; estudiantes: FilaEstudiante[] }>(
      `/docente/aulas/${props.aula.id}/avance`,
    );
    // Solo los mundos que el grupo ha tocado: treinta filas vacias no informan.
    mundos.value = datos.mundos.filter((m) => m.completadasTotales > 0);
    estudiantes.value = datos.estudiantes;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el avance';
  } finally {
    cargando.value = false;
  }
}

async function abrirFicha(id: number): Promise<void> {
  if (elegido.value === id) {
    elegido.value = null;
    ficha.value = null;
    return;
  }
  elegido.value = id;
  try {
    ficha.value = await api.get<Ficha>(`/docente/estudiantes/${id}/avance`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la ficha';
  }
}

const cuando = (valor: string | null): string =>
  valor ? new Date(valor).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : 'nunca';

watch(() => props.aula.id, () => void cargar());
onMounted(() => void cargar());
</script>

<template>
  <div>
    <p v-if="error" class="aviso aviso--grave">{{ error }}</p>

    <section class="panel">
      <h2>El grupo, mundo a mundo</h2>
      <p v-if="cargando" class="vacio">Cargando...</p>
      <p v-else-if="mundos.length === 0" class="vacio">
        El grupo todavia no ha completado ninguna actividad.
      </p>

      <table v-else class="tabla">
        <thead>
          <tr>
            <th>Mundo</th>
            <th class="num">Terminado por</th>
            <th class="num">Actividades hechas</th>
            <th class="num">Estrellas de media</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in mundos" :key="m.mundo">
            <td>{{ m.mundo }} · {{ m.nombre }}</td>
            <td class="num">{{ m.estudiantesQueLoTerminaron }} de {{ estudiantes.length }}</td>
            <td class="num">{{ m.completadasTotales }}</td>
            <td class="num">{{ m.estrellasPromedio.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Cada estudiante</h2>
      <p class="nota">Toca un nombre para ver su ficha.</p>

      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th class="num">Estrellas</th>
            <th class="num">Actividades</th>
            <th>Ultima vez</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="e in estudiantes" :key="e.id">
            <tr class="fila--clicable" :class="{ 'fila--abierta': elegido === e.id }" @click="abrirFicha(e.id)">
              <td>{{ e.nombre }}</td>
              <td class="num">{{ e.estrellas }}</td>
              <td class="num">{{ e.actividadesCompletadas }}</td>
              <td>{{ cuando(e.ultimaActividad) }}</td>
            </tr>

            <tr v-if="elegido === e.id && ficha" class="fila--ficha">
              <td colspan="4">
                <div class="ficha">
                  <div class="cifras">
                    <span><strong>{{ ficha.estudiante.estrellas }}</strong> estrellas</span>
                    <span><strong>{{ ficha.estudiante.monedas }}</strong> monedas</span>
                    <span><strong>{{ ficha.estudiante.rachaDias }}</strong> dias seguidos</span>
                    <span>{{ ficha.estudiante.grupoEdad ?? '—' }}</span>
                  </div>

                  <div class="ficha__cols">
                    <div>
                      <h3>Por mundo</h3>
                      <p v-if="ficha.porMundo.length === 0" class="vacio">Aun no ha empezado.</p>
                      <ul v-else class="lista">
                        <li v-for="m in ficha.porMundo" :key="m.mundo">
                          <span>{{ m.mundo }} · {{ m.nombre }}</span>
                          <span class="barra">
                            <span
                              class="barra__relleno"
                              :style="{ width: `${Math.round((m.completadas / m.actividades) * 100)}%` }"
                            />
                          </span>
                          <span class="lista__num">{{ m.completadas }}/{{ m.actividades }}</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3>Donde se atasca</h3>
                      <p v-if="ficha.atascos.length === 0" class="vacio">
                        Nada le esta costando de mas.
                      </p>
                      <ul v-else class="lista">
                        <li v-for="a in ficha.atascos" :key="`${a.mundo}-${a.actividad}`">
                          <span>M{{ a.mundo }}·A{{ a.actividad }} {{ a.nombre }}</span>
                          <span class="lista__num">
                            {{ a.intentos }} intentos{{ a.completada ? '' : ', sin resolver' }}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
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
.vacio { color: #94a3b8; margin: 0; font-size: 13px; }

.tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
.tabla th, .tabla td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
.tabla th { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
.num { text-align: right; }

.fila--clicable { cursor: pointer; }
.fila--clicable:hover { background: #f8fafc; }
.fila--abierta { background: #eff8ff; }
.fila--ficha td { background: #f8fafc; }

.ficha { padding: 6px 2px 12px; }

.cifras { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; color: #475569; }
.cifras strong { font-size: 17px; color: #1e293b; }

.ficha__cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.ficha h3 {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.lista { list-style: none; margin: 0; padding: 0; font-size: 13px; }

.lista li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}

.lista__num { color: #64748b; white-space: nowrap; }

.barra {
  width: 70px;
  height: 6px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.barra__relleno { display: block; height: 100%; background: #5ad35a; }

.aviso { padding: 9px 12px; border-radius: 10px; margin: 0 0 12px; background: #fee2e2; border: 1px solid #fca5a5; }

@media (max-width: 720px) {
  .ficha__cols { grid-template-columns: 1fr; }
}
</style>
