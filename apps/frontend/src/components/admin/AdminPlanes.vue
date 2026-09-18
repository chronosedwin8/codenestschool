<script setup lang="ts">
/**
 * Las tarjetas de precios del home.
 *
 * Lo que se guarda aqui se ve en /planes.html al instante y es el precio que se
 * cobra desde ese momento. Las licencias ya pagadas no cambian, y una pagina de
 * pago ya abierta conserva el precio con el que se abrio.
 */
import { onMounted, reactive, ref } from 'vue';

import { PRECIO_MAXIMO_COP, PRECIO_MINIMO_COP } from '@codenest/shared';

import { api } from '@/api/cliente';
import { cop, fechaHora } from '@/components/facturacion/formato';

interface Plan {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string;
  precioCop: number;
  beneficios: string[];
  destacado: boolean;
  orden: number;
  activo: boolean;
  maxNinos: number | null;
  vigenciaDias: number;
  licenciasActivas: number;
  actualizadoEn: string;
}

const emitir = defineEmits<{ cambiados: [] }>();

const planes = ref<Plan[]>([]);
const editando = ref<number | null>(null);
const borrador = reactive({
  nombre: '',
  descripcion: '',
  precioCop: 0,
  beneficiosTexto: '',
  destacado: false,
  orden: 0,
  activo: true,
  maxNinos: null as number | null,
  sinLimite: false,
  vigenciaDias: 365,
});
const guardando = ref(false);
const error = ref<string | null>(null);
const aviso = ref<string | null>(null);

async function cargar(): Promise<void> {
  planes.value = (await api.get<{ planes: Plan[] }>('/admin/planes')).planes;
}

function editar(plan: Plan): void {
  editando.value = plan.id;
  error.value = null;
  aviso.value = null;
  Object.assign(borrador, {
    nombre: plan.nombre,
    descripcion: plan.descripcion,
    precioCop: plan.precioCop,
    beneficiosTexto: plan.beneficios.join('\n'),
    destacado: plan.destacado,
    orden: plan.orden,
    activo: plan.activo,
    maxNinos: plan.maxNinos,
    sinLimite: plan.maxNinos === null,
    vigenciaDias: plan.vigenciaDias,
  });
}

async function guardar(plan: Plan): Promise<void> {
  guardando.value = true;
  error.value = null;
  try {
    await api.put(`/admin/planes/${plan.id}`, {
      nombre: borrador.nombre.trim(),
      descripcion: borrador.descripcion.trim(),
      precioCop: Math.round(Number(borrador.precioCop)),
      beneficios: borrador.beneficiosTexto
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean),
      destacado: borrador.destacado,
      orden: Number(borrador.orden),
      activo: borrador.activo,
      maxNinos: borrador.sinLimite ? null : Number(borrador.maxNinos),
      vigenciaDias: Number(borrador.vigenciaDias),
    });
    aviso.value =
      plan.precioCop !== Math.round(Number(borrador.precioCop))
        ? `Guardado. Desde ahora el plan ${borrador.nombre} cuesta ${cop(Number(borrador.precioCop))}.`
        : 'Guardado.';
    editando.value = null;
    await cargar();
    emitir('cambiados');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar';
  } finally {
    guardando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <section class="a-panel">
    <div class="a-fila-titulo">
      <h2>Tarjetas de precios</h2>
      <a class="a-enlace" href="/planes.html" target="_blank" rel="noopener">Ver en el home ↗</a>
    </div>
    <p class="a-subtitulo intro">
      Lo que guardes aquí se ve en la página de planes al momento y es lo que se cobra desde entonces.
      Las licencias ya pagadas no cambian.
    </p>
    <p v-if="aviso" class="a-aviso a-aviso--bien" role="status">{{ aviso }}</p>

    <div class="planes">
      <article v-for="plan in planes" :key="plan.id" class="plan" :class="{ 'plan--inactivo': !plan.activo }">
        <template v-if="editando !== plan.id">
          <header class="plan__cabecera">
            <h3>{{ plan.nombre }}</h3>
            <span v-if="plan.destacado" class="a-chip a-chip--info">Destacado</span>
            <span v-if="!plan.activo" class="a-chip a-chip--mal">Oculto</span>
          </header>
          <p class="plan__precio">{{ cop(plan.precioCop) }} <small>COP / {{ plan.vigenciaDias }} días</small></p>
          <p class="plan__descripcion">{{ plan.descripcion }}</p>
          <ul class="plan__beneficios">
            <li v-for="b in plan.beneficios" :key="b">{{ b }}</li>
          </ul>
          <p class="a-subtitulo plan__meta">
            {{ plan.maxNinos === null ? 'Estudiantes ilimitados' : `${plan.maxNinos} perfiles` }} ·
            {{ plan.licenciasActivas }} licencias activas · cambiado {{ fechaHora(plan.actualizadoEn) }}
          </p>
          <button type="button" class="a-boton a-boton--fantasma" @click="editar(plan)">Editar</button>
        </template>

        <form v-else class="a-formulario plan__form" @submit.prevent="guardar(plan)">
          <label class="a-campo a-campo--ancho">
            <span>Nombre</span>
            <input :id="`plan-${plan.id}-nombre`" v-model="borrador.nombre" required maxlength="80" />
          </label>
          <label class="a-campo a-campo--ancho">
            <span>Precio anual (pesos)</span>
            <input
              :id="`plan-${plan.id}-precio`"
              v-model.number="borrador.precioCop"
              type="number"
              :min="PRECIO_MINIMO_COP"
              :max="PRECIO_MAXIMO_COP"
              step="1"
              required
            />
            <small>{{ cop(Number(borrador.precioCop) || 0) }} COP. Mínimo {{ cop(PRECIO_MINIMO_COP) }}, lo menos que cobra Mercado Pago.</small>
          </label>
          <label class="a-campo a-campo--ancho">
            <span>Descripción</span>
            <textarea :id="`plan-${plan.id}-desc`" v-model="borrador.descripcion" required maxlength="400" rows="2" />
          </label>
          <label class="a-campo a-campo--ancho">
            <span>Beneficios (uno por línea)</span>
            <textarea :id="`plan-${plan.id}-beneficios`" v-model="borrador.beneficiosTexto" required rows="6" />
          </label>
          <label class="a-campo">
            <span>Perfiles de niño</span>
            <input
              :id="`plan-${plan.id}-max`"
              v-model.number="borrador.maxNinos"
              type="number"
              min="1"
              :disabled="borrador.sinLimite"
            />
          </label>
          <label class="a-campo">
            <span>Vigencia (días)</span>
            <input :id="`plan-${plan.id}-vigencia`" v-model.number="borrador.vigenciaDias" type="number" min="1" max="1095" required />
          </label>
          <label class="a-campo">
            <span>Orden en la página</span>
            <input :id="`plan-${plan.id}-orden`" v-model.number="borrador.orden" type="number" min="0" max="99" />
          </label>
          <fieldset class="a-campo a-campo--ancho casillas">
            <label><input :id="`plan-${plan.id}-ilimitado`" v-model="borrador.sinLimite" type="checkbox" /> Estudiantes ilimitados</label>
            <label><input :id="`plan-${plan.id}-destacado`" v-model="borrador.destacado" type="checkbox" /> Destacar («El más elegido»)</label>
            <label><input :id="`plan-${plan.id}-activo`" v-model="borrador.activo" type="checkbox" /> Visible y a la venta</label>
          </fieldset>
          <p v-if="error" class="a-aviso a-aviso--mal a-campo--ancho" role="alert">{{ error }}</p>
          <div class="a-acciones a-campo--ancho">
            <button class="a-boton" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
            <button class="a-boton a-boton--fantasma" type="button" @click="editando = null">Cancelar</button>
          </div>
        </form>
      </article>
    </div>
  </section>
</template>

<style scoped>
.intro {
  margin: -0.4rem 0 1rem;
  max-width: 70ch;
}

.planes {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  align-items: start;
}

.plan {
  display: grid;
  gap: 0.6rem;
  padding: 1.2rem;
  border: 2px solid var(--gris-claro);
  border-radius: var(--radio-md);
}

.plan--inactivo {
  opacity: 0.7;
  border-style: dashed;
}

.plan__cabecera {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.plan__cabecera h3 {
  margin: 0 0.3rem 0 0;
  font-family: var(--fuente-titulo);
  font-size: 1.2rem;
}

.plan__precio {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--azul-neon-oscuro);
  font-variant-numeric: tabular-nums;
}

.plan__precio small {
  font-family: var(--fuente-texto);
  font-size: 0.85rem;
  color: var(--gris-oscuro);
}

.plan__descripcion {
  margin: 0;
}

.plan__beneficios {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.88rem;
}

.plan__meta {
  font-size: 0.8rem;
}

.plan__form {
  grid-template-columns: 1fr 1fr;
}

.casillas {
  display: grid;
  gap: 0.35rem;
  padding: 0;
  margin: 0;
  border: 0;
}

.casillas label {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-weight: 600;
}
</style>
