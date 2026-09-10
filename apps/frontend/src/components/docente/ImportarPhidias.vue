<script setup lang="ts">
/**
 * Traer estudiantes desde el sistema academico del colegio.
 *
 * Dos formas de armar el grupo, porque son dos necesidades distintas:
 *
 *  - Secciones enteras: "quiero a todo KIN1". Un clic.
 *  - Estudiantes sueltos: el grupo de refuerzo, que junta a seis niños de tres
 *    cursos distintos. Se buscan por apellido y se marcan uno a uno.
 *
 * Las dos se pueden combinar en el mismo envio.
 *
 * La lista va SIEMPRE ordenada por apellido, que es como esta escrita cualquier
 * lista de clase: buscar un nombre en una lista de mil ordenada de otra forma no
 * es una tarea que deba tener un docente.
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
}

const disponible = ref(true);
const cargando = ref(true);
const trabajando = ref(false);
const error = ref<string | null>(null);
const resultado = ref<Resultado | null>(null);

const secciones = ref<readonly Seccion[]>([]);
const seccionesElegidas = ref<number[]>([]);

/** Seccion abierta para escoger nombre a nombre. */
const explorando = ref<number | null>(null);
const listado = ref<readonly EstudianteExterno[]>([]);
const sueltosElegidos = ref<number[]>([]);
const busqueda = ref('');
const pinComun = ref('');

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

const visibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase();
  if (!texto) return listado.value;
  return listado.value.filter((e) => e.listado.toLowerCase().includes(texto));
});

const totalElegido = computed(
  () =>
    seccionesElegidas.value.reduce(
      (suma, id) => suma + (secciones.value.find((s) => s.id === id)?.estudiantes ?? 0),
      0,
    ) + sueltosElegidos.value.length,
);

async function cargarCursos(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const datos = await api.get<{ disponible: boolean; secciones: Seccion[] }>(
      '/docente/phidias/cursos',
    );
    disponible.value = datos.disponible;
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
  try {
    const datos = await api.get<{ estudiantes: EstudianteExterno[] }>(
      `/docente/phidias/estudiantes?secciones=${seccionId}`,
    );
    listado.value = datos.estudiantes;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la seccion';
  }
}

function alternar(lista: number[], valor: number): number[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
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
      ...(sueltosElegidos.value.length ? { estudianteIds: sueltosElegidos.value } : {}),
      ...(pin ? { pinComun: pin } : {}),
    });
    seccionesElegidas.value = [];
    sueltosElegidos.value = [];
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

    <template v-else>
      <p class="nota">
        Marca secciones enteras, o abre una para elegir nombre a nombre y armar un
        grupo mixto. Puedes combinar las dos cosas.
      </p>

      <div v-for="[nivel, lista] in porNivel" :key="nivel" class="nivel">
        <h3>{{ nivel }}</h3>
        <div class="secciones">
          <div
            v-for="s in lista"
            :key="s.id"
            class="seccion"
            :class="{ 'seccion--elegida': seccionesElegidas.includes(s.id) }"
          >
            <label class="seccion__marca">
              <input
                type="checkbox"
                :checked="seccionesElegidas.includes(s.id)"
                @change="seccionesElegidas = alternar(seccionesElegidas, s.id)"
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

        <!-- Escoger nombre a nombre dentro de una seccion -->
        <div v-if="explorando !== null && lista.some((s) => s.id === explorando)" class="detalle">
          <input v-model="busqueda" class="buscar" type="search" placeholder="Buscar por apellido..." />
          <p class="nota">Ordenados por apellido. {{ visibles.length }} de {{ listado.length }}.</p>
          <ul class="alumnos">
            <li v-for="e in visibles" :key="e.id">
              <label :class="{ 'ya': e.yaImportado }">
                <input
                  type="checkbox"
                  :checked="sueltosElegidos.includes(e.id)"
                  @change="sueltosElegidos = alternar(sueltosElegidos, e.id)"
                />
                <span class="alumno__nombre">{{ e.listado }}</span>
                <span class="alumno__meta">{{ e.email ?? 'sin correo' }}</span>
                <span class="alumno__meta">{{ e.fechaNacimiento ?? 'sin fecha' }}</span>
                <span v-if="e.yaImportado" class="pastilla">ya tiene cuenta</span>
              </label>
            </li>
          </ul>
        </div>
      </div>

      <div class="fila-form">
        <label class="campo">
          <span>Mismo PIN para todos (opcional)</span>
          <input v-model="pinComun" type="text" placeholder="gato sol luna flor" />
        </label>
        <button type="button" class="boton" :disabled="trabajando || totalElegido === 0" @click="importar">
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

.seccion__marca { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.seccion__marca span { display: flex; flex-direction: column; }
.seccion__marca em { font-style: normal; font-size: 12px; color: #64748b; }

.detalle {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}

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

.fila-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
}

.campo { display: flex; flex-direction: column; gap: 4px; flex: 1 1 220px; }
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
