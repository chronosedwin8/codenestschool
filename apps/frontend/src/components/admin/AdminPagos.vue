<script setup lang="ts">
/**
 * Todos los pagos: los de Mercado Pago y las transferencias registradas a mano.
 *
 * "Consultar en Mercado Pago" vuelve a pedir el estado y lo aplica con las
 * mismas reglas que el webhook: sirve cuando un aviso no llego. "Registrar
 * transferencia" es como pagan muchos colegios, contra factura.
 */
import { computed, onMounted, reactive, ref } from 'vue';

import { etiquetaMedio } from '@codenest/shared';

import { api } from '@/api/cliente';
import EstadoChip from '@/components/facturacion/EstadoChip.vue';
import { cop, fecha, fechaHora } from '@/components/facturacion/formato';

interface Pago {
  id: number;
  fecha: string;
  montoCop: number;
  estado: string;
  detalle: string | null;
  metodo: string | null;
  tipoMedio: string | null;
  cuotas: number | null;
  origen: string;
  mpPaymentId: string | null;
  referenciaManual: string | null;
  email: string;
  cliente: string | null;
  licencia: { id: number; plan: string; estado: string } | null;
  cotizacion: { id: number; numero: string } | null;
  factura: { id: number; numero: string } | null;
}

interface Licencia {
  id: number;
  estado: string;
  plan: string;
  titular: { nombre: string; email: string | null };
  institucion: string | null;
  finVigencia: string | null;
  esRenovacion: boolean;
}

const emitir = defineEmits<{ facturar: [borrador: unknown] }>();

const pagos = ref<Pago[]>([]);
const licencias = ref<Licencia[]>([]);
const cotizaciones = ref<{ id: number; numero: string; estado: string; totalCop: number; cliente: { nombre: string } }[]>([]);
const filtro = ref<string>('');
const mensaje = ref<{ tono: 'bien' | 'mal'; texto: string } | null>(null);
const ocupado = ref<number | null>(null);

const manual = reactive({
  abierto: false,
  destino: 'licencia' as 'licencia' | 'cotizacion',
  licenciaId: null as number | null,
  cotizacionId: null as number | null,
  montoCop: 0,
  metodo: 'transferencia',
  referencia: '',
  fecha: new Date().toISOString().slice(0, 10),
});

const licenciasPorPagar = computed(() => licencias.value.filter((l) => l.estado === 'pendiente'));
const cotizacionesAbiertas = computed(() =>
  cotizaciones.value.filter((c) => c.estado === 'enviada' || c.estado === 'aceptada'),
);

async function cargar(): Promise<void> {
  const q = filtro.value ? `?estado=${filtro.value}` : '';
  const [p, l, c] = await Promise.all([
    api.get<{ pagos: Pago[] }>(`/admin/pagos${q}`),
    api.get<{ licencias: Licencia[] }>('/admin/licencias'),
    api.get<{ cotizaciones: typeof cotizaciones.value }>('/admin/cotizaciones'),
  ]);
  pagos.value = p.pagos;
  licencias.value = l.licencias;
  cotizaciones.value = c.cotizaciones;
}

async function conciliar(pago: Pago): Promise<void> {
  ocupado.value = pago.id;
  mensaje.value = null;
  try {
    const r = await api.post<{ resultado: { estado: string; licenciaActivada: boolean } }>(
      `/admin/pagos/${pago.id}/conciliar`,
    );
    mensaje.value = {
      tono: 'bien',
      texto: r.resultado.licenciaActivada
        ? 'Mercado Pago confirmó el pago y la licencia quedó activa.'
        : `Mercado Pago dice: ${r.resultado.estado}. Nada más que hacer.`,
    };
    await cargar();
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo consultar' };
  } finally {
    ocupado.value = null;
  }
}

async function facturar(pago: Pago): Promise<void> {
  const r = await api.get<{ borrador: unknown }>(`/admin/pagos/${pago.id}/borrador-factura`);
  emitir('facturar', r.borrador);
}

async function registrarManual(): Promise<void> {
  mensaje.value = null;
  try {
    const r = await api.post<{ licenciaActivada: boolean; cotizacionPagada: boolean }>('/admin/pagos/manual', {
      licenciaId: manual.destino === 'licencia' ? manual.licenciaId : null,
      cotizacionId: manual.destino === 'cotizacion' ? manual.cotizacionId : null,
      montoCop: Math.round(Number(manual.montoCop)),
      metodo: manual.metodo,
      referencia: manual.referencia.trim(),
      fecha: manual.fecha,
    });
    mensaje.value = {
      tono: 'bien',
      texto: r.licenciaActivada
        ? 'Pago registrado. La licencia quedó activa.'
        : r.cotizacionPagada
          ? 'Pago registrado. La cotización quedó pagada.'
          : 'Pago registrado.',
    };
    manual.abierto = false;
    await cargar();
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo registrar' };
  }
}

function medio(p: Pago): string {
  const base = etiquetaMedio(p.metodo, p.tipoMedio);
  return p.cuotas && p.cuotas > 1 ? `${base} · ${p.cuotas} cuotas` : base;
}

onMounted(cargar);
</script>

<template>
  <section class="a-panel">
    <div class="a-fila-titulo">
      <h2>Pagos</h2>
      <div class="a-acciones">
        <label class="a-campo filtro">
          <span class="visualmente-oculto">Filtrar por estado</span>
          <select id="pagos-filtro" v-model="filtro" @change="cargar">
            <option value="">Todos</option>
            <option value="aprobado">Aprobados</option>
            <option value="pendiente">Pendientes</option>
            <option value="rechazado">Rechazados</option>
            <option value="reembolsado">Reembolsados</option>
          </select>
        </label>
        <button type="button" class="a-boton" @click="manual.abierto = !manual.abierto">
          Registrar transferencia
        </button>
      </div>
    </div>

    <p v-if="mensaje" class="a-aviso" :class="`a-aviso--${mensaje.tono}`" role="status">{{ mensaje.texto }}</p>

    <form v-if="manual.abierto" class="a-formulario manual" @submit.prevent="registrarManual">
      <label class="a-campo">
        <span>Qué se paga</span>
        <select id="manual-destino" v-model="manual.destino">
          <option value="licencia">Una licencia pendiente</option>
          <option value="cotizacion">Una cotización</option>
        </select>
      </label>
      <label v-if="manual.destino === 'licencia'" class="a-campo a-campo--ancho">
        <span>Licencia</span>
        <select id="manual-licencia" v-model="manual.licenciaId" required>
          <option :value="null" disabled>Elige…</option>
          <option v-for="l in licenciasPorPagar" :key="l.id" :value="l.id">
            #{{ l.id }} · {{ l.plan }} · {{ l.institucion ?? l.titular.nombre }} ({{ l.titular.email }})
            {{ l.esRenovacion ? '· renovación' : '' }}
          </option>
        </select>
        <small v-if="licenciasPorPagar.length === 0">No hay licencias pendientes de pago.</small>
      </label>
      <label v-else class="a-campo a-campo--ancho">
        <span>Cotización</span>
        <select id="manual-cotizacion" v-model="manual.cotizacionId" required>
          <option :value="null" disabled>Elige…</option>
          <option v-for="c in cotizacionesAbiertas" :key="c.id" :value="c.id">
            {{ c.numero }} · {{ c.cliente.nombre }} · {{ cop(c.totalCop) }}
          </option>
        </select>
        <small v-if="cotizacionesAbiertas.length === 0">No hay cotizaciones enviadas o aceptadas.</small>
      </label>
      <label class="a-campo">
        <span>Monto recibido (pesos)</span>
        <input id="manual-monto" v-model.number="manual.montoCop" type="number" min="1" step="1" required />
      </label>
      <label class="a-campo">
        <span>Medio</span>
        <select id="manual-metodo" v-model="manual.metodo">
          <option value="transferencia">Transferencia bancaria</option>
          <option value="consignacion">Consignación</option>
          <option value="efectivo">Efectivo</option>
        </select>
      </label>
      <label class="a-campo">
        <span>Referencia del banco</span>
        <input id="manual-referencia" v-model="manual.referencia" required minlength="2" maxlength="120" />
      </label>
      <label class="a-campo">
        <span>Fecha del pago</span>
        <input id="manual-fecha" v-model="manual.fecha" type="date" required />
      </label>
      <div class="a-acciones a-campo--ancho">
        <button class="a-boton a-boton--verde" type="submit">Registrar y aplicar</button>
        <button class="a-boton a-boton--fantasma" type="button" @click="manual.abierto = false">Cancelar</button>
        <small class="a-subtitulo">Activa la licencia o marca la cotización como pagada, igual que un pago en línea.</small>
      </div>
    </form>

    <p v-if="pagos.length === 0" class="a-vacio">No hay pagos con ese filtro.</p>
    <div v-else class="a-tabla-contenedor">
      <table class="a-tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Concepto</th>
            <th>Medio</th>
            <th class="a-num">Monto</th>
            <th>Estado</th>
            <th>Factura</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pagos" :key="p.id">
            <td>{{ fechaHora(p.fecha) }}</td>
            <td>
              {{ p.cliente ?? '—' }}
              <small>{{ p.email }}</small>
            </td>
            <td>
              <template v-if="p.licencia">Plan {{ p.licencia.plan }} <small>licencia #{{ p.licencia.id }}</small></template>
              <template v-else-if="p.cotizacion">{{ p.cotizacion.numero }}</template>
              <template v-else>—</template>
            </td>
            <td>
              {{ medio(p) }}
              <small>{{ p.mpPaymentId ? `MP ${p.mpPaymentId}` : `Ref. ${p.referenciaManual}` }}</small>
            </td>
            <td class="a-num">{{ cop(p.montoCop) }}</td>
            <td>
              <EstadoChip :estado="p.estado" tipo="pago" />
              <small v-if="p.detalle && p.estado !== 'aprobado'">{{ p.detalle }}</small>
            </td>
            <td>{{ p.factura?.numero ?? '—' }}</td>
            <td class="acciones-fila">
              <button
                v-if="p.mpPaymentId && p.estado !== 'aprobado'"
                type="button"
                class="a-boton a-boton--fantasma a-boton--pequeno"
                :disabled="ocupado === p.id"
                @click="conciliar(p)"
              >
                {{ ocupado === p.id ? 'Consultando…' : 'Consultar en Mercado Pago' }}
              </button>
              <button
                v-if="p.estado === 'aprobado' && !p.factura"
                type="button"
                class="a-boton a-boton--pequeno"
                @click="facturar(p)"
              >
                Facturar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="a-panel">
    <h2>Licencias</h2>
    <div class="a-tabla-contenedor">
      <table class="a-tabla">
        <thead>
          <tr><th>#</th><th>Titular</th><th>Plan</th><th>Estado</th><th>Vence</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in licencias" :key="l.id">
            <td>{{ l.id }}</td>
            <td>
              {{ l.institucion ?? l.titular.nombre }}
              <small>{{ l.titular.email }}</small>
            </td>
            <td>{{ l.plan }} <small v-if="l.esRenovacion">renovación</small></td>
            <td><EstadoChip :estado="l.estado" tipo="licencia" /></td>
            <td>{{ fecha(l.finVigencia) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.filtro {
  min-width: 10rem;
}

.manual {
  padding: 1rem;
  margin-bottom: 1.25rem;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
}

.acciones-fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.visualmente-oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
