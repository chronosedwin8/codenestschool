<script setup lang="ts">
/**
 * Los colegios.
 *
 * Un colegio aqui es lo que agrupa a sus docentes, sus grupos y sus
 * estudiantes, y lo que una licencia cubre. Sin esta pantalla habia que crearlo
 * a mano en la base de datos, que es exactamente lo que no puede pasar cuando
 * se cierra una venta un viernes por la tarde.
 *
 * Tres datos y no quince: nombre, NIT y ciudad. Lo demas (sedes, grupos) lo
 * monta el colegio desde su propia cuenta, y pedirlo aqui seria pedir dos veces
 * lo mismo.
 *
 * El **codigo de acceso** se genera al crearlo y es lo que se le da al colegio
 * para vincularse. Se puede copiar de un clic porque se dicta por telefono.
 */
import { computed, onMounted, reactive, ref } from 'vue';

import { api } from '@/api/cliente';
import { fecha } from '@/components/facturacion/formato';

interface LicenciaColegio {
  id: number;
  estado: string;
  plan: string;
  titular: { id: number; nombre: string; email: string | null };
  finVigencia: string | null;
}

interface Colegio {
  id: number;
  nombre: string;
  nit: string | null;
  ciudad: string | null;
  pais: string;
  codigoAcceso: string | null;
  maxEstudiantes: number | null;
  activa: boolean;
  creadoEn: string;
  personas: number;
  estudiantes: number;
  adultos: number;
  grupos: number;
  sedes: number;
  licencias: LicenciaColegio[];
}

const colegios = ref<Colegio[]>([]);
const cargando = ref(true);
const mensaje = ref<{ tono: 'bien' | 'mal'; texto: string } | null>(null);
const ocupado = ref<number | null>(null);

const formulario = reactive({
  abierto: false,
  /** Null = se esta creando uno nuevo. */
  editando: null as number | null,
  nombre: '',
  nit: '',
  ciudad: '',
  pais: 'Colombia',
  /**
   * Vacio o un numero. Son los dos tipos de verdad: `v-model` sobre un
   * `type="number"` guarda un NUMERO cuando hay algo escrito y la cadena vacia
   * cuando no, asi que tratarlo siempre como texto revienta al guardar.
   */
  maxEstudiantes: '' as string | number,
  error: null as string | null,
  guardando: false,
});

/** El cupo escrito, o null si no hay ninguno valido. */
function cupoEscrito(): number | null {
  const valor = formulario.maxEstudiantes;
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

const activos = computed(() => colegios.value.filter((c) => c.activa).length);
const estudiantes = computed(() => colegios.value.reduce((t, c) => t + c.estudiantes, 0));

const licenciaVigente = (c: Colegio): LicenciaColegio | null =>
  c.licencias.find((l) => l.estado === 'activa') ?? null;

/** Cuanto del cupo contratado esta usado. Sin cupo no hay nada que medir. */
const ocupacion = (c: Colegio): number | null =>
  c.maxEstudiantes ? Math.round((c.estudiantes / c.maxEstudiantes) * 100) : null;

async function cargar(): Promise<void> {
  cargando.value = true;
  try {
    const r = await api.get<{ instituciones: Colegio[] }>('/admin/instituciones');
    colegios.value = r.instituciones;
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo cargar' };
  } finally {
    cargando.value = false;
  }
}

function abrirNuevo(): void {
  formulario.abierto = true;
  formulario.editando = null;
  formulario.nombre = '';
  formulario.nit = '';
  formulario.ciudad = '';
  formulario.pais = 'Colombia';
  formulario.maxEstudiantes = '';
  formulario.error = null;
}

function abrirEdicion(c: Colegio): void {
  formulario.abierto = true;
  formulario.editando = c.id;
  formulario.nombre = c.nombre;
  formulario.nit = c.nit ?? '';
  formulario.ciudad = c.ciudad ?? '';
  formulario.pais = c.pais;
  formulario.maxEstudiantes = c.maxEstudiantes ?? '';
  formulario.error = null;
}

async function guardar(): Promise<void> {
  formulario.guardando = true;
  formulario.error = null;
  const cuerpo = {
    nombre: formulario.nombre.trim(),
    nit: formulario.nit.trim() || null,
    ciudad: formulario.ciudad.trim() || null,
    pais: formulario.pais.trim() || 'Colombia',
    maxEstudiantes: cupoEscrito(),
  };
  try {
    if (formulario.editando === null) {
      const r = await api.post<{ colegio: Colegio }>('/admin/instituciones', cuerpo);
      mensaje.value = {
        tono: 'bien',
        texto: `${r.colegio.nombre} creado. Su código de acceso es ${r.colegio.codigoAcceso}.`,
      };
    } else {
      await api.patch(`/admin/instituciones/${formulario.editando}`, cuerpo);
      mensaje.value = { tono: 'bien', texto: 'Colegio actualizado.' };
    }
    formulario.abierto = false;
    await cargar();
  } catch (e) {
    formulario.error = e instanceof Error ? e.message : 'No se pudo guardar';
  } finally {
    formulario.guardando = false;
  }
}

async function alternarActiva(c: Colegio): Promise<void> {
  if (
    c.activa &&
    !window.confirm(
      `Archivar ${c.nombre}. Nadie pierde su cuenta ni su progreso; deja de salir en las listas.`,
    )
  ) {
    return;
  }
  ocupado.value = c.id;
  try {
    await api.patch(`/admin/instituciones/${c.id}`, { activa: !c.activa });
    await cargar();
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo cambiar' };
  } finally {
    ocupado.value = null;
  }
}

async function copiarCodigo(c: Colegio): Promise<void> {
  if (!c.codigoAcceso) return;
  try {
    await navigator.clipboard.writeText(c.codigoAcceso);
    mensaje.value = { tono: 'bien', texto: `Código de ${c.nombre} copiado.` };
  } catch {
    window.prompt('Copia el código:', c.codigoAcceso);
  }
}

onMounted(cargar);
</script>

<template>
  <section class="a-panel">
    <div class="a-fila-titulo">
      <h2>Colegios</h2>
      <button type="button" class="a-boton" @click="abrirNuevo">Nuevo colegio</button>
    </div>
    <p class="a-subtitulo intro">
      {{ colegios.length }} colegios · {{ activos }} activos · {{ estudiantes }} estudiantes en total.
      El código de acceso es lo que se le da al colegio para vincular sus cuentas.
    </p>

    <p v-if="mensaje" class="a-aviso" :class="`a-aviso--${mensaje.tono}`" role="status">{{ mensaje.texto }}</p>

    <form v-if="formulario.abierto" class="a-formulario nuevo" @submit.prevent="guardar">
      <label class="a-campo a-campo--ancho">
        <span>Nombre del colegio</span>
        <input id="colegio-nombre" v-model="formulario.nombre" required minlength="2" maxlength="200" />
      </label>
      <label class="a-campo">
        <span>NIT (opcional)</span>
        <input id="colegio-nit" v-model="formulario.nit" maxlength="40" placeholder="900.123.456-7" />
      </label>
      <label class="a-campo">
        <span>Ciudad</span>
        <input id="colegio-ciudad" v-model="formulario.ciudad" maxlength="100" />
      </label>
      <label class="a-campo">
        <span>País</span>
        <input id="colegio-pais" v-model="formulario.pais" maxlength="100" />
      </label>
      <label class="a-campo">
        <span>Cupo de estudiantes</span>
        <input id="colegio-cupo" v-model="formulario.maxEstudiantes" type="number" min="1" placeholder="sin límite" />
        <small>Lo contratado. Vacío = sin límite.</small>
      </label>
      <p v-if="formulario.error" class="a-aviso a-aviso--mal a-campo--ancho" role="alert">
        {{ formulario.error }}
      </p>
      <div class="a-acciones a-campo--ancho">
        <button class="a-boton a-boton--verde" type="submit" :disabled="formulario.guardando">
          {{ formulario.guardando ? 'Guardando…' : formulario.editando === null ? 'Crear colegio' : 'Guardar cambios' }}
        </button>
        <button class="a-boton a-boton--fantasma" type="button" @click="formulario.abierto = false">
          Cancelar
        </button>
      </div>
    </form>

    <p v-if="cargando" class="a-subtitulo">Cargando…</p>
    <p v-else-if="colegios.length === 0" class="a-subtitulo">
      Todavía no hay colegios. El primero se crea con el botón de arriba.
    </p>

    <div v-else class="a-tabla-contenedor">
      <table class="a-tabla">
        <thead>
          <tr>
            <th>Colegio</th>
            <th>Código</th>
            <th class="a-num">Estudiantes</th>
            <th class="a-num">Adultos</th>
            <th class="a-num">Grupos</th>
            <th>Licencia</th>
            <th>Desde</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in colegios" :key="c.id" :class="{ inactivo: !c.activa }">
            <td>
              {{ c.nombre }}
              <small>{{ [c.ciudad, c.pais].filter(Boolean).join(' · ') }}{{ c.nit ? ` · NIT ${c.nit}` : '' }}</small>
            </td>
            <td>
              <button
                v-if="c.codigoAcceso"
                type="button"
                class="codigo"
                :title="`Copiar el código de ${c.nombre}`"
                @click="copiarCodigo(c)"
              >
                {{ c.codigoAcceso }}
              </button>
              <span v-else>—</span>
            </td>
            <td class="a-num">
              {{ c.estudiantes }}
              <small v-if="ocupacion(c) !== null">de {{ c.maxEstudiantes }} ({{ ocupacion(c) }}%)</small>
            </td>
            <td class="a-num">{{ c.adultos }}</td>
            <td class="a-num">{{ c.grupos }}</td>
            <td>
              <template v-if="licenciaVigente(c)">
                <span class="a-chip a-chip--bien">{{ licenciaVigente(c)!.plan }}</span>
                <small v-if="licenciaVigente(c)!.finVigencia">
                  hasta {{ fecha(licenciaVigente(c)!.finVigencia!) }}
                </small>
                <small>{{ licenciaVigente(c)!.titular.nombre }}</small>
              </template>
              <span v-else class="a-chip">sin licencia</span>
            </td>
            <td>{{ fecha(c.creadoEn) }}</td>
            <td class="acciones-fila">
              <button
                type="button"
                class="a-boton a-boton--fantasma a-boton--pequeno"
                :disabled="ocupado === c.id"
                @click="abrirEdicion(c)"
              >
                Editar
              </button>
              <button
                type="button"
                class="a-boton a-boton--pequeno"
                :class="c.activa ? 'a-boton--peligro' : ''"
                :disabled="ocupado === c.id"
                @click="alternarActiva(c)"
              >
                {{ c.activa ? 'Archivar' : 'Reactivar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="a-subtitulo pie">
      La licencia de un colegio se le da a la persona que responde por él (normalmente su
      administrador) desde la pestaña <strong>Equipo</strong>. Archivar un colegio no borra nada.
    </p>
  </section>
</template>

<style scoped>
.intro {
  margin: -0.4rem 0 1rem;
  max-width: 72ch;
}

.nuevo {
  padding: 1rem;
  margin-bottom: 1.25rem;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
}

.inactivo {
  opacity: 0.55;
}

.acciones-fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.codigo {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  padding: 0.2rem 0.45rem;
  border: 1.5px dashed #cfd8e3;
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
}

.codigo:hover {
  border-color: #1fa2ff;
  color: #0b6fb0;
}

.pie {
  margin: 1rem 0 0;
  font-size: 0.82rem;
  max-width: 72ch;
}
</style>
