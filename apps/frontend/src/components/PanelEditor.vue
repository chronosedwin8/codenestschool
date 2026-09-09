<script setup lang="ts">
/**
 * Selector del editor según el grupo de edad.
 *
 * Es el componente que decide con qué programa el niño, y el que sostiene la
 * progresión completa del producto:
 *
 *   Exploradores  fichas             sin una palabra escrita
 *   Creadores     bloques + código   ve el código que generan sus bloques
 *   Hackers       texto              escribe el código directamente
 *
 * Los Creadores tienen el panel de código al lado, en modo lectura. Ese panel es
 * la bisagra de todo el currículo: el niño de ocho años no lo necesita para
 * jugar, pero lo ve cambiar cada vez que mueve un bloque, y cuando llegue al
 * mundo 21 ya sabrá lo que significa.
 *
 * Los editores se cargan de forma diferida: Blockly y Monaco pesan más de un
 * megabyte cada uno y no deben descargarse en los mundos que no los usan.
 */
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue';

import { estructurasDelCodigo } from '@codenest/shared';
import type { GrupoEdad, LenguajeCodigo, TipoEditor } from '@codenest/shared';

import BarraPrograma from '@/components/BarraPrograma.vue';
import type { ClaseFicha } from '@/components/FichaComando.vue';
import { compilarFichas } from '@/game/compilarFichas';
import type { PasoPrograma } from '@/game/tipos';

const EditorBloques = defineAsyncComponent(() => import('@/components/EditorBloques.vue'));
const EditorTexto = defineAsyncComponent(() => import('@/components/EditorTexto.vue'));

const props = withDefaults(
  defineProps<{
    editor: TipoEditor;
    grupo: GrupoEdad;
    lenguaje: LenguajeCodigo;
    disponibles: readonly string[];
    capacidad?: number;
    codigoInicial?: string;
    /** Area de Blockly con la que arranca la actividad (mundo 19). */
    bloquesIniciales?: Record<string, unknown> | null;
    ejecutando?: boolean;
    pasoActual?: number | null;
    errorLinea?: number | null;
    errorMensaje?: string | null;
  }>(),
  {
    capacidad: 8,
    codigoInicial: '',
    bloquesIniciales: null,
    ejecutando: false,
    pasoActual: null,
    errorLinea: null,
    errorMensaje: null,
  },
);

/** Lo que el componente entrega al padre para ejecutar y puntuar. */
export interface ProgramaListo {
  readonly codigo: string;
  readonly tamano: number;
  readonly estructuras: readonly string[];
  readonly programa: unknown;
}

const emit = defineEmits<{ cambio: [ProgramaListo] }>();

const fichas = ref<PasoPrograma[]>([]);
const codigoTexto = ref(props.codigoInicial);
const codigoBloques = ref('');
const estadoBloques = shallowRef<object | null>(null);
const numeroBloques = ref(0);
const lineasTexto = ref(0);

/** El panel de código solo aparece con bloques, donde tiene sentido. */
const mostrarCodigo = computed(() => props.editor === 'bloques');

const fichasDisponibles = computed(() => props.disponibles as ClaseFicha[]);

/** Recalcula y emite el programa cada vez que el niño cambia algo. */
function emitir(): void {
  switch (props.editor) {
    case 'comandos': {
      const compilado = compilarFichas(fichas.value);
      emit('cambio', {
        codigo: compilado.codigo,
        tamano: compilado.tamano,
        estructuras: compilado.estructuras,
        programa: fichas.value,
      });
      break;
    }

    case 'bloques':
      emit('cambio', {
        codigo: codigoBloques.value,
        // Se cuentan los bloques, no las líneas: es lo que premia usar un bucle
        // en lugar de repetir el mismo bloque cinco veces.
        tamano: numeroBloques.value,
        estructuras: estructurasDelCodigo(codigoBloques.value),
        programa: estadoBloques.value,
      });
      break;

    case 'texto':
      emit('cambio', {
        codigo: codigoTexto.value,
        tamano: lineasTexto.value,
        estructuras: estructurasDelCodigo(codigoTexto.value),
        programa: { texto: codigoTexto.value },
      });
      break;
  }
}

watch(fichas, emitir, { deep: true });

function alCambiarBloques(datos: { codigo: string; bloques: number; estado: object }): void {
  codigoBloques.value = datos.codigo;
  numeroBloques.value = datos.bloques;
  estadoBloques.value = datos.estado;
  emitir();
}

function alCambiarTexto(datos: { codigo: string; lineas: number }): void {
  codigoTexto.value = datos.codigo;
  lineasTexto.value = datos.lineas;
  emitir();
}

/** Vacía el programa: lo usa el botón de empezar de nuevo. */
function limpiar(): void {
  if (props.editor === 'comandos') fichas.value = [];
  if (props.editor === 'texto') codigoTexto.value = props.codigoInicial;
  emitir();
}

defineExpose({ limpiar });
</script>

<template>
  <div class="panel-editor" :class="{ 'panel-editor--doble': mostrarCodigo }">
    <!-- Exploradores: fichas -->
    <BarraPrograma
      v-if="editor === 'comandos'"
      v-model="fichas"
      :disponibles="fichasDisponibles"
      :capacidad="capacidad"
      :ejecutando="pasoActual"
      :bloqueada="ejecutando"
    />

    <!-- Creadores: bloques y el código que generan -->
    <template v-else-if="editor === 'bloques'">
      <EditorBloques
        :disponibles="disponibles"
        :estado-inicial="bloquesIniciales"
        @cambio="alCambiarBloques"
      />

      <aside class="codigo">
        <h3 class="codigo__titulo">Tu programa en codigo</h3>
        <p class="codigo__nota">Esto es lo que dicen tus bloques.</p>
        <pre class="codigo__cuerpo"><code>{{ codigoBloques || '// arrastra bloques para empezar' }}</code></pre>
      </aside>
    </template>

    <!-- Hackers: texto -->
    <EditorTexto
      v-else
      :lenguaje="lenguaje"
      :disponibles="disponibles"
      :codigo-inicial="codigoInicial"
      :error-linea="errorLinea"
      :error-mensaje="errorMensaje"
      @cambio="alCambiarTexto"
    />
  </div>
</template>

<style scoped>
.panel-editor {
  display: grid;
  gap: var(--espacio-4);
}

/* Bloques y código, uno al lado del otro. */
.panel-editor--doble {
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
}

@media (max-width: 900px) {
  .panel-editor--doble {
    grid-template-columns: 1fr;
  }
}

.codigo {
  display: flex;
  flex-direction: column;
  padding: var(--espacio-4);
  overflow: hidden;
  background: #141d33;
  border-radius: var(--radio-lg);
  box-shadow: var(--sombra-panel);
}

.codigo__titulo {
  margin: 0;
  font-size: var(--texto-base);
  color: #e8eeff;
}

.codigo__nota {
  margin: 0 0 var(--espacio-3);
  font-size: var(--texto-xs);
  color: #7d8fb3;
}

.codigo__cuerpo {
  flex: 1;
  margin: 0;
  overflow: auto;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 14px;
  line-height: 1.7;
  color: #8ee68e;
  white-space: pre-wrap;
}
</style>
