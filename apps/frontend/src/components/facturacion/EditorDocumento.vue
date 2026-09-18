<script setup lang="ts">
/**
 * Editor de facturas y cotizaciones.
 *
 * El total que se ve mientras se escribe sale de `calcularTotales`, la misma
 * funcion que usa el servidor al guardar. El servidor no lee el total que envia
 * este formulario: lo vuelve a calcular. Asi lo que se ve es lo que se emite.
 */
import { computed, reactive, ref } from 'vue';

import {
  DOCUMENTO_MAX,
  DOCUMENTO_MIN,
  TARIFAS_IVA,
  TIPOS_DOCUMENTO,
  calcularTotales,
} from '@codenest/shared';

import { cop } from './formato';

interface Linea {
  descripcion: string;
  cantidad: number;
  valorUnitarioCop: number;
}

export interface EntradaEditor {
  cliente: {
    nombre: string;
    tipoDocumento: string;
    documento: string;
    email?: string;
    direccion?: string;
    ciudad?: string;
    telefono?: string;
    contacto?: string;
  };
  items: Linea[];
  descuentoCop: number;
  ivaPorcentaje: number;
  notas?: string;
  // Solo cotizacion
  validaHasta?: string;
  planId?: number | null;
  condiciones?: string;
  // Solo factura
  fechaVencimiento?: string;
  usuarioId?: number | null;
  pagoId?: number | null;
  cotizacionId?: number | null;
}

interface PlanResumen {
  readonly id: number;
  readonly nombre: string;
  readonly precioCop: number;
}

const props = defineProps<{
  tipo: 'factura' | 'cotizacion';
  inicial?: Partial<EntradaEditor> | null;
  planes: readonly PlanResumen[];
  guardando?: boolean;
  error?: string | null;
}>();

const emitir = defineEmits<{ guardar: [entrada: EntradaEditor]; cancelar: [] }>();

function enDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const CONDICIONES_POR_DEFECTO =
  'Valores en pesos colombianos. La licencia es anual y se cuenta desde su activación. ' +
  'Se puede pagar en línea (PSE o tarjeta, a través de Mercado Pago) o por transferencia bancaria.';

const i = props.inicial ?? {};
const doc = reactive<EntradaEditor>({
  cliente: {
    nombre: i.cliente?.nombre ?? '',
    tipoDocumento: i.cliente?.tipoDocumento ?? 'NIT',
    documento: i.cliente?.documento ?? '',
    email: i.cliente?.email ?? '',
    direccion: i.cliente?.direccion ?? '',
    ciudad: i.cliente?.ciudad ?? '',
    telefono: i.cliente?.telefono ?? '',
    contacto: i.cliente?.contacto ?? '',
  },
  items: i.items?.length
    ? i.items.map((l) => ({ ...l }))
    : [{ descripcion: '', cantidad: 1, valorUnitarioCop: 0 }],
  descuentoCop: i.descuentoCop ?? 0,
  ivaPorcentaje: i.ivaPorcentaje ?? 0,
  notas: i.notas ?? '',
  validaHasta: i.validaHasta ?? enDias(30),
  planId: i.planId ?? null,
  condiciones: i.condiciones ?? CONDICIONES_POR_DEFECTO,
  fechaVencimiento: i.fechaVencimiento ?? enDias(0),
  usuarioId: i.usuarioId ?? null,
  pagoId: i.pagoId ?? null,
  cotizacionId: i.cotizacionId ?? null,
});

const totales = computed(() =>
  calcularTotales({
    items: doc.items.map((l) => ({
      ...l,
      cantidad: Number(l.cantidad) || 0,
      valorUnitarioCop: Number(l.valorUnitarioCop) || 0,
    })),
    descuentoCop: Number(doc.descuentoCop) || 0,
    ivaPorcentaje: Number(doc.ivaPorcentaje) || 0,
  }),
);

const intentado = ref(false);

function anadirLinea(): void {
  doc.items.push({ descripcion: '', cantidad: 1, valorUnitarioCop: 0 });
}

function quitarLinea(indice: number): void {
  if (doc.items.length > 1) doc.items.splice(indice, 1);
}

/** Una linea con el plan y su precio vigente, para no teclearla. */
function anadirPlan(plan: PlanResumen): void {
  const vacia = doc.items.length === 1 && !doc.items[0]!.descripcion && !doc.items[0]!.valorUnitarioCop;
  const linea = {
    descripcion: `CodeNest School · Plan ${plan.nombre} · licencia anual`,
    cantidad: 1,
    valorUnitarioCop: plan.precioCop,
  };
  if (vacia) doc.items.splice(0, 1, linea);
  else doc.items.push(linea);
  if (props.tipo === 'cotizacion' && !doc.planId) doc.planId = plan.id;
}

function guardar(): void {
  intentado.value = true;
  const limpio = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : undefined);
  const entrada: EntradaEditor = {
    cliente: {
      nombre: doc.cliente.nombre.trim(),
      tipoDocumento: doc.cliente.tipoDocumento,
      documento: doc.cliente.documento.trim(),
      email: limpio(doc.cliente.email),
      direccion: limpio(doc.cliente.direccion),
      ciudad: limpio(doc.cliente.ciudad),
      telefono: limpio(doc.cliente.telefono),
      contacto: limpio(doc.cliente.contacto),
    },
    items: doc.items.map((l) => ({
      descripcion: l.descripcion.trim(),
      cantidad: Math.round(Number(l.cantidad)),
      valorUnitarioCop: Math.round(Number(l.valorUnitarioCop)),
    })),
    descuentoCop: Math.round(Number(doc.descuentoCop) || 0),
    ivaPorcentaje: Number(doc.ivaPorcentaje),
    notas: limpio(doc.notas),
  };
  if (props.tipo === 'cotizacion') {
    entrada.validaHasta = doc.validaHasta;
    entrada.planId = doc.planId ?? null;
    entrada.condiciones = limpio(doc.condiciones);
  } else {
    entrada.fechaVencimiento = doc.fechaVencimiento || undefined;
    entrada.usuarioId = doc.usuarioId ?? null;
    entrada.pagoId = doc.pagoId ?? null;
    entrada.cotizacionId = doc.cotizacionId ?? null;
  }
  emitir('guardar', entrada);
}

const faltaDocumento = computed(() => intentado.value && doc.cliente.documento.trim().length < DOCUMENTO_MIN);
</script>

<template>
  <form class="editor" @submit.prevent="guardar">
    <section>
      <h3>Cliente</h3>
      <div class="a-formulario">
        <label class="a-campo a-campo--ancho">
          <span>Nombre o razón social</span>
          <input id="doc-cliente-nombre" v-model="doc.cliente.nombre" required minlength="2" maxlength="200" />
        </label>
        <label class="a-campo">
          <span>Tipo de documento</span>
          <select id="doc-cliente-tipo" v-model="doc.cliente.tipoDocumento">
            <option v-for="t in TIPOS_DOCUMENTO" :key="t.clave" :value="t.clave">{{ t.nombre }}</option>
          </select>
        </label>
        <label class="a-campo" :class="{ 'a-campo--error': faltaDocumento }">
          <span>Número</span>
          <input
            id="doc-cliente-documento"
            v-model="doc.cliente.documento"
            required
            :minlength="DOCUMENTO_MIN"
            :maxlength="DOCUMENTO_MAX"
            autocomplete="off"
          />
          <small v-if="faltaDocumento">Sin número de documento no se puede emitir.</small>
        </label>
        <label class="a-campo">
          <span>Correo</span>
          <input id="doc-cliente-email" v-model="doc.cliente.email" type="email" maxlength="255" />
          <small>Si tiene cuenta con este correo, lo verá en su portal.</small>
        </label>
        <label v-if="tipo === 'cotizacion'" class="a-campo">
          <span>Persona de contacto</span>
          <input id="doc-cliente-contacto" v-model="doc.cliente.contacto" maxlength="150" />
        </label>
        <label class="a-campo">
          <span>Ciudad</span>
          <input id="doc-cliente-ciudad" v-model="doc.cliente.ciudad" maxlength="100" />
        </label>
        <label class="a-campo">
          <span>Dirección</span>
          <input id="doc-cliente-direccion" v-model="doc.cliente.direccion" maxlength="250" />
        </label>
        <label class="a-campo">
          <span>Teléfono</span>
          <input id="doc-cliente-telefono" v-model="doc.cliente.telefono" maxlength="40" />
        </label>
      </div>
    </section>

    <section>
      <div class="a-fila-titulo editor__titulo-lineas">
        <h3>Conceptos</h3>
        <div class="a-acciones">
          <button
            v-for="plan in planes"
            :key="plan.id"
            type="button"
            class="a-boton a-boton--fantasma a-boton--pequeno"
            @click="anadirPlan(plan)"
          >
            + Plan {{ plan.nombre }}
          </button>
        </div>
      </div>

      <div class="a-tabla-contenedor">
        <table class="a-tabla editor__lineas">
          <thead>
            <tr>
              <th>Descripción</th>
              <th class="a-num">Cant.</th>
              <th class="a-num">Valor unitario</th>
              <th class="a-num">Total</th>
              <th><span class="visualmente-oculto">Quitar</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(linea, n) in doc.items" :key="n">
              <td>
                <input
                  :id="`doc-linea-${n}-desc`"
                  v-model="linea.descripcion"
                  class="editor__input"
                  required
                  minlength="2"
                  maxlength="300"
                  aria-label="Descripción"
                />
              </td>
              <td class="a-num">
                <input
                  :id="`doc-linea-${n}-cant`"
                  v-model.number="linea.cantidad"
                  class="editor__input editor__input--corto"
                  type="number"
                  min="1"
                  max="10000"
                  required
                  aria-label="Cantidad"
                />
              </td>
              <td class="a-num">
                <input
                  :id="`doc-linea-${n}-valor`"
                  v-model.number="linea.valorUnitarioCop"
                  class="editor__input editor__input--dinero"
                  type="number"
                  min="0"
                  step="1"
                  required
                  aria-label="Valor unitario en pesos"
                />
              </td>
              <td class="a-num">{{ cop(totales.items[n]?.totalCop) }}</td>
              <td>
                <button
                  type="button"
                  class="a-boton a-boton--fantasma a-boton--pequeno"
                  :disabled="doc.items.length === 1"
                  :aria-label="`Quitar la línea ${n + 1}`"
                  @click="quitarLinea(n)"
                >
                  ×
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="a-enlace editor__anadir" @click="anadirLinea">+ Añadir línea</button>
    </section>

    <section class="editor__pie">
      <div class="a-formulario editor__condiciones">
        <label class="a-campo">
          <span>Descuento (pesos)</span>
          <input id="doc-descuento" v-model.number="doc.descuentoCop" type="number" min="0" step="1" />
        </label>
        <label class="a-campo">
          <span>IVA</span>
          <select id="doc-iva" v-model.number="doc.ivaPorcentaje">
            <option v-for="t in TARIFAS_IVA" :key="t" :value="t">{{ t }} %</option>
          </select>
          <small>Si aplica y a qué tarifa lo define tu contador.</small>
        </label>
        <template v-if="tipo === 'cotizacion'">
          <label class="a-campo">
            <span>Válida hasta</span>
            <input id="doc-valida" v-model="doc.validaHasta" type="date" required />
          </label>
          <label class="a-campo">
            <span>Plan que se vende</span>
            <select id="doc-plan" v-model="doc.planId">
              <option :value="null">Ninguno (solo servicios)</option>
              <option v-for="plan in planes" :key="plan.id" :value="plan.id">{{ plan.nombre }}</option>
            </select>
            <small>Al pagarse, permite activar la licencia con un clic.</small>
          </label>
          <label class="a-campo a-campo--ancho">
            <span>Condiciones</span>
            <textarea id="doc-condiciones" v-model="doc.condiciones" maxlength="2000" />
          </label>
        </template>
        <label v-else class="a-campo">
          <span>Vence</span>
          <input id="doc-vence" v-model="doc.fechaVencimiento" type="date" />
        </label>
        <label class="a-campo a-campo--ancho">
          <span>Notas</span>
          <textarea id="doc-notas" v-model="doc.notas" maxlength="2000" />
        </label>
      </div>

      <dl class="editor__totales" aria-live="polite">
        <dt>Subtotal</dt>
        <dd>{{ cop(totales.subtotalCop) }}</dd>
        <template v-if="totales.descuentoCop > 0">
          <dt>Descuento</dt>
          <dd>− {{ cop(totales.descuentoCop) }}</dd>
        </template>
        <template v-if="totales.ivaPorcentaje > 0">
          <dt>IVA {{ totales.ivaPorcentaje }} %</dt>
          <dd>{{ cop(totales.ivaCop) }}</dd>
        </template>
        <dt class="editor__total">Total</dt>
        <dd class="editor__total">{{ cop(totales.totalCop) }}</dd>
      </dl>
    </section>

    <p v-if="error" class="a-aviso a-aviso--mal" role="alert">{{ error }}</p>

    <div class="a-acciones editor__botones">
      <button class="a-boton" type="submit" :disabled="guardando">
        {{ guardando ? 'Guardando…' : tipo === 'factura' ? 'Emitir factura' : 'Guardar cotización' }}
      </button>
      <button class="a-boton a-boton--fantasma" type="button" @click="emitir('cancelar')">Cancelar</button>
      <small v-if="tipo === 'factura'" class="editor__advertencia">
        Una factura emitida no se edita: si hay un error, se anula y se emite otra.
      </small>
    </div>
  </form>
</template>

<style scoped>
.editor {
  display: grid;
  gap: 1.5rem;
}

.editor h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.editor__titulo-lineas h3 {
  margin: 0;
}

.editor__lineas td {
  vertical-align: middle;
}

.editor__input {
  width: 100%;
  min-height: 36px;
  padding: 0.35rem 0.55rem;
  font-family: inherit;
  font-size: 0.92rem;
  border: 1.5px solid #cfd8e3;
  border-radius: 8px;
}

.editor__input--corto {
  width: 5rem;
  text-align: right;
}

.editor__input--dinero {
  width: 9.5rem;
  text-align: right;
}

.editor__anadir {
  margin-top: 0.6rem;
}

.editor__pie {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  align-items: start;
}

.editor__totales {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.4rem 0;
  margin: 0;
  padding: 1rem 1.1rem;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
  font-variant-numeric: tabular-nums;
}

.editor__totales dt {
  color: var(--gris-oscuro);
}

.editor__totales dd {
  margin: 0;
  padding-left: 1rem;
  text-align: right;
  font-weight: 700;
}

.editor__total {
  padding-top: 0.4rem;
  margin-top: 0.2rem;
  border-top: 1px solid #cfd8e3;
  font-size: 1.1rem;
  color: var(--tinta) !important;
  font-weight: 800;
}

.editor__advertencia {
  color: var(--gris-oscuro);
}

.visualmente-oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 720px) {
  .editor__pie {
    grid-template-columns: 1fr;
  }
}
</style>
