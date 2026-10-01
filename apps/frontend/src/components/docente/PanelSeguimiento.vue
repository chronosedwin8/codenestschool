<script setup lang="ts">
/**
 * La matriz: cada estudiante por cada cosa asignada.
 *
 * Es la pantalla que se mira de pie, antes de entrar a clase, buscando una
 * columna roja (algo que no entendio nadie) o una fila roja (alguien a quien
 * hay que sentarse al lado). Por eso el color manda sobre el numero.
 *
 * Tres cosas que la tabla NO hace, a proposito:
 *
 *  - No confunde "no lo ha hecho" con "no era suyo": una celda vacia es una
 *    tarea que a ese estudiante no se le asigno.
 *  - No cuenta como "sin empezar" a quien entro y no termino. Esa es la senal
 *    que de verdad sirve, y tiene su propio color.
 *  - No cuenta en los totales a los estudiantes sin nada asignado: decir que
 *    veinte no han empezado cuando no se les ha pedido nada seria mentir.
 */
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';

const props = defineProps<{ aula: { id: number; nombre: string } }>();

interface Celda {
  readonly porcentaje: number;
  readonly completadas: number;
  readonly total: number;
  readonly estrellas: number;
  readonly intentos: number;
  readonly empezada: boolean;
}

interface Fila {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly celdas: Record<number, Celda>;
  readonly porcentaje: number;
}

interface Asignacion {
  readonly id: number;
  readonly titulo: string;
  readonly tipo: 'mundo' | 'actividad';
  readonly mundo: number | null;
  readonly actividad: number | null;
  readonly fechaLimite: string | null;
  readonly actividades: number;
  readonly alcance: 'grupo' | 'estudiantes';
  readonly destinatarios: number;
}

interface Resumen {
  readonly estudiantes: number;
  readonly terminaronTodo: number;
  readonly enProgreso: number;
  readonly iniciando: number;
  readonly sinEmpezar: number;
  readonly promedio: number;
}

const asignaciones = ref<readonly Asignacion[]>([]);
const filas = ref<readonly Fila[]>([]);
const resumen = ref<Resumen>({
  estudiantes: 0,
  terminaronTodo: 0,
  enProgreso: 0,
  iniciando: 0,
  sinEmpezar: 0,
  promedio: 0,
});
const cargando = ref(true);
const error = ref<string | null>(null);

const mundoFiltro = ref<number | null>(null);
const busqueda = ref('');

const mundosConTarea = computed(() =>
  [...new Set(asignaciones.value.map((a) => a.mundo).filter((n): n is number => n !== null))].sort(
    (a, b) => a - b,
  ),
);

const columnas = computed(() =>
  mundoFiltro.value === null
    ? asignaciones.value
    : asignaciones.value.filter((a) => a.mundo === mundoFiltro.value),
);

const visibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  const conFiltro = texto
    ? filas.value.filter((f) => f.nombre.toLowerCase().includes(texto))
    : filas.value;
  // Si se filtra por mundo, se esconde a quien no tiene ninguna de esas
  // columnas: una fila entera vacia no dice nada y estorba.
  return mundoFiltro.value === null
    ? conFiltro
    : conFiltro.filter((f) => columnas.value.some((a) => f.celdas[a.id] !== undefined));
});

/** El tramo de color. Cinco, los mismos de la leyenda. */
function tramo(celda: Celda | undefined): string {
  if (!celda) return 'nada';
  if (celda.porcentaje === 100) return 'lleno';
  if (celda.porcentaje >= 70) return 'alto';
  if (celda.porcentaje >= 40) return 'medio';
  if (celda.porcentaje > 0) return 'bajo';
  return celda.empezada ? 'empezado' : 'cero';
}

function detalle(a: Asignacion, celda: Celda | undefined): string {
  if (!celda) return `${a.titulo}: no asignada a esta persona`;
  const partes = [
    `${celda.completadas} de ${celda.total} actividades`,
    `${celda.estrellas} estrellas`,
    `${celda.intentos} intentos`,
  ];
  return `${a.titulo} — ${partes.join(' · ')}`;
}

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const datos = await api.get<{
      asignaciones: Asignacion[];
      filas: Fila[];
      resumen: Resumen;
    }>(`/docente/aulas/${props.aula.id}/seguimiento`);
    asignaciones.value = datos.asignaciones;
    filas.value = datos.filas;
    resumen.value = datos.resumen;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el seguimiento';
  } finally {
    cargando.value = false;
  }
}

const fecha = (valor: string | null): string =>
  valor ? new Date(valor).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '';

watch(
  () => props.aula.id,
  () => {
    mundoFiltro.value = null;
    busqueda.value = '';
    void cargar();
  },
);
onMounted(() => void cargar());
</script>

<template>
  <div>
    <p v-if="error" class="aviso aviso--grave">{{ error }}</p>

    <section class="panel">
      <div class="cabecera">
        <h2>Seguimiento de {{ aula.nombre }}</h2>
        <button type="button" class="mini-boton" :disabled="cargando" @click="cargar">
          {{ cargando ? 'Cargando...' : 'Actualizar' }}
        </button>
      </div>

      <div class="contadores">
        <div class="contador">
          <strong>{{ resumen.estudiantes }}</strong>
          <span>Estudiantes</span>
        </div>
        <div class="contador contador--verde">
          <strong>{{ resumen.terminaronTodo }}</strong>
          <span>Terminaron todo</span>
        </div>
        <div class="contador contador--azul">
          <strong>{{ resumen.enProgreso }}</strong>
          <span>En progreso</span>
        </div>
        <div class="contador contador--amarillo">
          <strong>{{ resumen.iniciando }}</strong>
          <span>Iniciando</span>
        </div>
        <div class="contador contador--gris">
          <strong>{{ resumen.sinEmpezar }}</strong>
          <span>Sin empezar</span>
        </div>
        <div class="contador contador--morado">
          <strong>{{ resumen.promedio }}%</strong>
          <span>Promedio del grupo</span>
        </div>
      </div>

      <div class="filtros">
        <label class="campo">
          <span>Mundo</span>
          <select v-model.number="mundoFiltro">
            <option :value="null">Todos</option>
            <option v-for="m in mundosConTarea" :key="m" :value="m">Mundo {{ m }}</option>
          </select>
        </label>
        <label class="campo campo--ancho">
          <span>Buscar estudiante</span>
          <input v-model="busqueda" type="search" placeholder="Apellido o nombre..." />
        </label>
        <ul class="leyenda">
          <li><i class="muestra muestra--cero" /> 0%</li>
          <li><i class="muestra muestra--empezado" /> empezó</li>
          <li><i class="muestra muestra--bajo" /> 1–39%</li>
          <li><i class="muestra muestra--medio" /> 40–69%</li>
          <li><i class="muestra muestra--alto" /> 70–99%</li>
          <li><i class="muestra muestra--lleno" /> 100%</li>
        </ul>
      </div>

      <p v-if="cargando" class="vacio">Cargando...</p>
      <p v-else-if="asignaciones.length === 0" class="vacio">
        Todavia no has asignado nada a este grupo. En la pestaña de Tareas puedes asignar un mundo
        entero o una actividad, al grupo o a unos pocos.
      </p>
      <p v-else-if="visibles.length === 0" class="vacio">
        Ningun estudiante coincide con lo que buscas.
      </p>

      <div v-else class="matriz-contenedor">
        <table class="matriz">
          <thead>
            <tr>
              <th class="esquina">Estudiante</th>
              <th v-for="a in columnas" :key="a.id" class="columna" :title="a.titulo">
                <span class="columna__que">
                  {{ a.tipo === 'actividad' ? `M${a.mundo}·A${a.actividad}` : `Mundo ${a.mundo}` }}
                </span>
                <span class="columna__titulo">{{ a.titulo }}</span>
                <span class="columna__pie">
                  {{ a.alcance === 'grupo' ? 'todo el grupo' : `${a.destinatarios} estudiantes` }}
                  <template v-if="a.fechaLimite"> · entrega {{ fecha(a.fechaLimite) }}</template>
                </span>
              </th>
              <th class="total">Suyo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in visibles" :key="f.id">
              <th class="nombre" scope="row">
                {{ f.nombre }}
                <small>{{ f.usuario }}</small>
              </th>
              <td
                v-for="a in columnas"
                :key="a.id"
                class="celda"
                :class="`celda--${tramo(f.celdas[a.id])}`"
                :title="detalle(a, f.celdas[a.id])"
              >
                <template v-if="f.celdas[a.id]">
                  {{ f.celdas[a.id]!.porcentaje }}<small>%</small>
                </template>
                <span v-else class="sin">·</span>
              </td>
              <td class="celda celda--propio">{{ f.porcentaje }}<small>%</small></td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="nota">
        Cada celda es cuanto lleva terminado de ESA asignacion, no de todo el juego. Una celda con
        un punto es una tarea que no se le asigno a esa persona. Pasa el raton por encima para ver
        actividades, estrellas e intentos.
      </p>
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

.cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.cabecera h2 { margin: 0; font-family: var(--fuente-titulo); font-size: 18px; }

.nota { margin: 12px 0 0; color: #64748b; font-size: 13px; max-width: 86ch; }
.vacio { color: #94a3b8; margin: 0; }

.contadores {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.contador {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.contador strong { font-size: 22px; line-height: 1; font-family: var(--fuente-titulo); }
.contador span { font-size: 12px; color: #64748b; }

.contador--verde { background: #f0fdf4; border-color: #86efac; }
.contador--azul { background: #eff6ff; border-color: #93c5fd; }
.contador--amarillo { background: #fefce8; border-color: #fde047; }
.contador--gris { background: #f8fafc; }
.contador--morado { background: #f5f3ff; border-color: #c4b5fd; }

.filtros {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.campo { display: flex; flex-direction: column; gap: 4px; flex: 0 0 160px; }
.campo--ancho { flex: 1 1 220px; }
.campo span { font-size: 13px; color: #475569; }

.campo input,
.campo select {
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  width: 100%;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: #64748b;
}

.leyenda li { display: inline-flex; align-items: center; gap: 4px; }

.muestra {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: inline-block;
}

.muestra--cero { background: #fee2e2; }
.muestra--empezado { background: #e2e8f0; }
.muestra--bajo { background: #fed7aa; }
.muestra--medio { background: #fef08a; }
.muestra--alto { background: #bbf7d0; }
.muestra--lleno { background: #22c55e; }

.matriz-contenedor {
  overflow: auto;
  max-height: 70vh;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.matriz { border-collapse: separate; border-spacing: 0; font-size: 13px; width: 100%; }

.matriz th,
.matriz td { border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; }

.esquina,
.nombre {
  position: sticky;
  left: 0;
  background: #fff;
  text-align: left;
  z-index: 2;
  min-width: 170px;
  padding: 6px 10px;
  font-weight: 600;
}

.nombre small { display: block; font-weight: 400; color: #94a3b8; font-size: 11px; }

.esquina {
  z-index: 3;
  top: 0;
  color: #64748b;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.matriz thead th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  z-index: 1;
}

.columna {
  min-width: 112px;
  max-width: 150px;
  padding: 6px 8px;
  text-align: left;
  vertical-align: bottom;
}

.columna__que { display: block; font-size: 11px; color: #0369a1; font-weight: 700; }

.columna__titulo {
  display: block;
  font-weight: 500;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.columna__pie { display: block; font-size: 10px; color: #94a3b8; font-weight: 400; }

.total { min-width: 64px; padding: 6px 8px; color: #64748b; font-size: 12px; }

.celda {
  text-align: center;
  font-weight: 600;
  padding: 7px 6px;
  font-variant-numeric: tabular-nums;
}

.celda small { font-size: 10px; font-weight: 400; opacity: 0.65; }

.celda--nada { background: #fff; color: #cbd5e1; }
.celda--cero { background: #fee2e2; color: #991b1b; }
.celda--empezado { background: #e2e8f0; color: #475569; }
.celda--bajo { background: #fed7aa; color: #9a3412; }
.celda--medio { background: #fef08a; color: #854d0e; }
.celda--alto { background: #bbf7d0; color: #166534; }
.celda--lleno { background: #22c55e; color: #fff; }
.celda--propio { background: #f5f3ff; color: #5b21b6; }

.sin { color: #cbd5e1; }

.mini-boton {
  padding: 5px 11px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.aviso { padding: 9px 12px; border-radius: 10px; margin: 0 0 12px; background: #fee2e2; border: 1px solid #fca5a5; }

@media print {
  .filtros, .mini-boton { display: none; }
  .matriz-contenedor { max-height: none; overflow: visible; }
}
</style>
