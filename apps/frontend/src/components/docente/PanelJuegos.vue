<script setup lang="ts">
/**
 * Los juegos que están construyendo sus estudiantes.
 *
 * Se muestran los borradores además de los publicados, y es deliberado: es su
 * clase, y un juego a medias es exactamente lo que el docente necesita ver para
 * saber a quién ayudar. Lo que no puede hacer es editarlos ni publicarlos: el
 * juego es del estudiante, y publicarlo es su decisión.
 *
 * La lista es de todos sus grupos y no del grupo seleccionado. Es lo que pidió
 * la práctica: un docente con cuatro cursos quiere ver de un vistazo quién ha
 * construido algo y quién no ha empezado.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { api } from '@/api/cliente';

interface ProyectoDeAula {
  readonly id: number;
  readonly titulo: string;
  readonly estado: 'borrador' | 'publicado';
  readonly portadaUrl: string | null;
  readonly partidas: number;
  readonly meGusta: number;
  readonly probado: boolean;
  readonly publicadoEn: string | null;
  readonly actualizadoEn: string;
  readonly autor: { readonly id: number; readonly nombre: string; readonly usuario: string };
  readonly aulas: readonly string[];
}

interface Resumen {
  readonly total: number;
  readonly publicados: number;
  readonly constructores: number;
}

const router = useRouter();

const proyectos = ref<readonly ProyectoDeAula[]>([]);
const resumen = ref<Resumen | null>(null);
const cargando = ref(true);
const error = ref<string | null>(null);
const filtro = ref<'todos' | 'publicado' | 'borrador'>('todos');

const visibles = computed(() =>
  filtro.value === 'todos'
    ? proyectos.value
    : proyectos.value.filter((p) => p.estado === filtro.value),
);

function fecha(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

onMounted(async () => {
  try {
    const datos = await api.get<{ proyectos: ProyectoDeAula[]; resumen: Resumen }>(
      '/docente/proyectos',
    );
    proyectos.value = datos.proyectos;
    resumen.value = datos.resumen;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los juegos';
  } finally {
    cargando.value = false;
  }
});
</script>

<template>
  <section class="panel">
    <header class="panel__cabecera">
      <div>
        <h2>Juegos de mis estudiantes</h2>
        <p v-if="resumen" class="resumen">
          {{ resumen.total }} juego(s) · {{ resumen.publicados }} publicado(s) ·
          {{ resumen.constructores }} estudiante(s) construyendo
        </p>
      </div>

      <div class="filtros">
        <button
          v-for="f in (['todos', 'publicado', 'borrador'] as const)"
          :key="f"
          type="button"
          class="filtro"
          :class="{ 'filtro--activo': filtro === f }"
          @click="filtro = f"
        >
          {{ f === 'todos' ? 'Todos' : f === 'publicado' ? 'Publicados' : 'En taller' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="aviso">{{ error }}</p>
    <p v-else-if="cargando" class="aviso">Cargando...</p>
    <p v-else-if="visibles.length === 0" class="aviso">
      Todavia no hay juegos aqui. Los estudiantes los crean desde "Mis juegos".
    </p>

    <table v-else class="tabla">
      <thead>
        <tr>
          <th>Juego</th>
          <th>Estudiante</th>
          <th>Grupo</th>
          <th>Estado</th>
          <th>Partidas</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in visibles" :key="p.id">
          <td class="celda-juego">
            <img
              v-if="p.portadaUrl"
              :src="p.portadaUrl"
              :alt="`Portada de ${p.titulo}`"
              class="miniatura"
              loading="lazy"
            />
            <span v-else class="miniatura miniatura--vacia" aria-hidden="true">🎮</span>
            <span>{{ p.titulo }}</span>
          </td>
          <td>
            {{ p.autor.nombre }}
            <small>{{ p.autor.usuario }}</small>
          </td>
          <td>{{ p.aulas.join(', ') }}</td>
          <td>
            <span class="etiqueta" :class="`etiqueta--${p.estado}`">
              {{ p.estado === 'publicado' ? `Publicado ${fecha(p.publicadoEn)}` : p.probado ? 'Listo, sin publicar' : 'En construccion' }}
            </span>
          </td>
          <td>{{ p.partidas }} · 👍 {{ p.meGusta }}</td>
          <td>
            <button
              v-if="p.estado === 'publicado'"
              type="button"
              class="ver"
              @click="router.push(`/jugar/${p.id}`)"
            >
              Jugarlo
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.panel {
  background: #fff;
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 2px 10px rgb(15 23 42 / 0.06);
}

.panel__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.panel__cabecera h2 {
  margin: 0;
  font-size: 1.15rem;
}

.resumen {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: #64748b;
}

.filtros {
  display: flex;
  gap: 6px;
}

.filtro {
  padding: 7px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 0.85rem;
  color: #475569;
  cursor: pointer;
}

.filtro--activo {
  background: #1e293b;
  border-color: #1e293b;
  color: #fff;
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.tabla th {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 2px solid #e2e8f0;
  color: #64748b;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tabla td {
  padding: 10px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.tabla small {
  display: block;
  color: #94a3b8;
}

.celda-juego {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.miniatura {
  width: 64px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  display: block;
  background: linear-gradient(135deg, #1e293b, #7b61ff);
}

.miniatura--vacia {
  display: grid;
  place-items: center;
  font-size: 18px;
}

.etiqueta {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  background: #f1f5f9;
  color: #475569;
}

.etiqueta--publicado {
  background: #dcfce7;
  color: #15803d;
}

.ver {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.aviso {
  color: #64748b;
}
</style>
