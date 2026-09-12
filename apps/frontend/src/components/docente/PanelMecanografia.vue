<script setup lang="ts">
/**
 * Cómo va de mecanografía un grupo.
 *
 * La columna que hace útil esta tabla no es la de palabras por minuto: es la de
 * **teclas que se atraviesan**. "76 % de precisión" no le dice a un docente qué
 * hacer el lunes; "a estos cuatro se les atraviesa la ñ y la p" sí.
 *
 * Aparecen también los estudiantes que no han empezado, con ceros: la lista
 * existe para saber a quién hay que animar, y quien no aparece no se ve.
 */
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';

const props = defineProps<{ aula: { id: number; nombre: string } }>();

interface Fila {
  readonly alumno: { readonly id: number; readonly nombre: string; readonly usuario: string };
  readonly leccionesCompletadas: number;
  readonly estrellas: number;
  readonly mejorPpm: number;
  readonly ultimaPrecision: number;
  readonly minutos: number;
  readonly teclasDificiles: readonly string[];
}

const filas = ref<readonly Fila[]>([]);
const totalLecciones = ref(0);
const cargando = ref(true);
const error = ref<string | null>(null);

const resumen = computed(() => {
  const empezaron = filas.value.filter((f) => f.leccionesCompletadas > 0);
  const ppm = empezaron.map((f) => f.mejorPpm).filter((p) => p > 0);

  // Las teclas que más se repiten entre los estudiantes que han practicado: es
  // lo que conviene repasar con la clase entera, no con uno.
  const cuenta = new Map<string, number>();
  for (const fila of filas.value) {
    for (const tecla of fila.teclasDificiles) cuenta.set(tecla, (cuenta.get(tecla) ?? 0) + 1);
  }

  return {
    empezaron: empezaron.length,
    total: filas.value.length,
    ppmMedio: ppm.length > 0 ? Math.round(ppm.reduce((a, b) => a + b, 0) / ppm.length) : 0,
    teclasDeLaClase: [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tecla, veces]) => ({ tecla, veces })),
  };
});

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const datos = await api.get<{ filas: Fila[]; leccionesTotales: number }>(
      `/docente/aulas/${props.aula.id}/mecanografia`,
    );
    filas.value = datos.filas;
    totalLecciones.value = datos.leccionesTotales;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la mecanografia';
  } finally {
    cargando.value = false;
  }
}

watch(() => props.aula.id, cargar);
onMounted(cargar);
</script>

<template>
  <section class="panel">
    <header class="panel__cabecera">
      <div>
        <h2>Mecanografia de {{ aula.nombre }}</h2>
        <p class="resumen">
          {{ resumen.empezaron }} de {{ resumen.total }} han practicado ·
          {{ resumen.ppmMedio }} ppm de media
        </p>
      </div>

      <!-- Lo que conviene repasar con la clase entera. -->
      <div v-if="resumen.teclasDeLaClase.length > 0" class="clase">
        <span>Se atraviesan en el grupo:</span>
        <span v-for="t in resumen.teclasDeLaClase" :key="t.tecla" class="clase__tecla">
          {{ t.tecla }} <small>×{{ t.veces }}</small>
        </span>
      </div>
    </header>

    <p v-if="error" class="aviso">{{ error }}</p>
    <p v-else-if="cargando" class="aviso">Cargando...</p>
    <p v-else-if="filas.length === 0" class="aviso">Este grupo todavia no tiene estudiantes.</p>

    <table v-else class="tabla">
      <thead>
        <tr>
          <th>Estudiante</th>
          <th>Lecciones</th>
          <th>⭐</th>
          <th>Mejor ppm</th>
          <th>Precision</th>
          <th>Practica</th>
          <th>Se le atraviesa</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="f in filas" :key="f.alumno.id" :class="{ 'sin-empezar': f.leccionesCompletadas === 0 }">
          <td>
            {{ f.alumno.nombre }}
            <small>{{ f.alumno.usuario }}</small>
          </td>
          <td>{{ f.leccionesCompletadas }} / {{ totalLecciones }}</td>
          <td>{{ f.estrellas }}</td>
          <td>
            <strong>{{ f.mejorPpm || '—' }}</strong>
          </td>
          <td>{{ f.ultimaPrecision > 0 ? `${f.ultimaPrecision} %` : '—' }}</td>
          <td>{{ f.minutos > 0 ? `${f.minutos} min` : '—' }}</td>
          <td class="celda-teclas">
            <span v-for="t in f.teclasDificiles" :key="t" class="tecla">{{ t }}</span>
            <span v-if="f.teclasDificiles.length === 0" class="sin">—</span>
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

.clase {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #64748b;
}

.clase__tecla {
  padding: 3px 8px;
  border-radius: 6px;
  background: #fef3c7;
  color: #92400e;
  font-family: ui-monospace, monospace;
  font-weight: 700;
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
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tabla td {
  padding: 9px 10px;
  border-bottom: 1px solid #f1f5f9;
}

.tabla small {
  display: block;
  color: #94a3b8;
}

.sin-empezar {
  color: #94a3b8;
}

.celda-teclas {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tecla {
  padding: 2px 7px;
  border-radius: 5px;
  background: #fee2e2;
  color: #b91c1c;
  font-family: ui-monospace, monospace;
  font-weight: 700;
}

.sin {
  color: #cbd5e1;
}

.aviso {
  color: #64748b;
}
</style>
