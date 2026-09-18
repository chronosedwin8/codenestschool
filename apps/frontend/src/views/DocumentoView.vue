<script setup lang="ts">
/**
 * Una factura o una cotizacion, lista para leer, imprimir o guardar en PDF.
 *
 * Se abre sin iniciar sesion, con un enlace que lleva un token de 64
 * caracteres: es lo que se le manda a compras de un colegio. "Descargar PDF"
 * usa la impresion del navegador (Guardar como PDF): no hace falta una
 * libreria de PDF, y el resultado es el mismo documento que se ve.
 *
 * Una cotizacion enviada y en fecha se puede pagar desde aqui con Mercado
 * Pago. Al volver (`?pago=exito`) se pregunta a Mercado Pago en ese momento, sin
 * esperar al aviso del webhook.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { etiquetaMedio } from '@codenest/shared';

import { api } from '@/api/cliente';
import { AVISO_JURISDICCION_CORTO } from '@/components/facturacion/aviso';
import { cop, fecha } from '@/components/facturacion/formato';

interface Linea {
  readonly descripcion: string;
  readonly cantidad: number;
  readonly valorUnitarioCop: number;
  readonly totalCop: number;
}

interface Documento {
  readonly tipo: 'factura' | 'cotizacion';
  readonly numero: string;
  readonly estado: string;
  readonly fechaEmision: string;
  readonly validaHasta?: string;
  readonly fechaVencimiento?: string | null;
  readonly emisor: {
    readonly razonSocial: string;
    readonly nit: string;
    readonly direccion: string;
    readonly ciudad: string;
    readonly telefono?: string;
    readonly email: string;
    readonly regimen?: string;
    readonly sitioWeb?: string;
    readonly notaPie?: string;
  };
  readonly cliente: {
    readonly nombre: string;
    readonly tipoDocumento: string;
    readonly documento: string;
    readonly email?: string;
    readonly direccion?: string;
    readonly ciudad?: string;
    readonly telefono?: string;
    readonly contacto?: string;
  };
  readonly items: readonly Linea[];
  readonly subtotalCop: number;
  readonly descuentoCop: number;
  readonly ivaPorcentaje: number;
  readonly ivaCop: number;
  readonly totalCop: number;
  readonly notas: string | null;
  readonly condiciones?: string | null;
  readonly motivoAnulacion: string | null;
  readonly pagadaEn?: string | null;
  readonly pagable?: boolean;
  readonly pago?: { metodo: string | null; tipoMedio: string | null; fecha: string | null; operacion: string | null } | null;
}

const route = useRoute();
const router = useRouter();

const tipo = computed(() => (route.params.tipo === 'factura' ? 'factura' : 'cotizacion'));
const token = computed(() => String(route.params.token ?? ''));

const doc = ref<Documento | null>(null);
const error = ref<string | null>(null);
const pagando = ref(false);
const aviso = ref<{ tono: 'bien' | 'espera' | 'mal'; texto: string } | null>(null);

/** El sello que se ve (y se imprime) cuando el documento no esta vigente. */
const sello = computed(() => {
  switch (doc.value?.estado) {
    case 'anulada':
      return 'ANULADA';
    case 'borrador':
      return 'BORRADOR';
    case 'vencida':
      return 'VENCIDA';
    case 'pagada':
      return 'PAGADA';
    default:
      return null;
  }
});

async function cargar(): Promise<void> {
  try {
    doc.value = await api.get<Documento>(`/documentos/${tipo.value}/${token.value}`);
    document.title = `${doc.value.numero} · CodeNest School`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se encontró el documento';
  }
}

async function atenderRegreso(): Promise<void> {
  const vuelta = route.query.pago;
  if (tipo.value !== 'cotizacion' || typeof vuelta !== 'string') return;
  try {
    const r = await api.post<{ estado: string }>(`/documentos/cotizacion/${token.value}/verificar`);
    aviso.value =
      r.estado === 'pagada'
        ? { tono: 'bien', texto: '¡Pago recibido! Esta cotización quedó pagada. Te enviaremos la factura.' }
        : vuelta === 'fallo'
          ? { tono: 'mal', texto: 'El pago no se completó. Puedes intentarlo de nuevo con otro medio de pago.' }
          : {
              tono: 'espera',
              texto: 'Tu pago está en proceso. Con PSE puede tardar unos minutos; recarga esta página para verlo confirmado.',
            };
    await cargar();
  } finally {
    void router.replace({ query: {} });
  }
}

async function pagar(): Promise<void> {
  pagando.value = true;
  aviso.value = null;
  try {
    const r = await api.post<{ urlPago: string }>(`/documentos/cotizacion/${token.value}/pagar`);
    window.location.href = r.urlPago;
  } catch (e) {
    aviso.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo abrir el pago' };
    pagando.value = false;
  }
}

function imprimir(): void {
  window.print();
}

onMounted(async () => {
  await cargar();
  await atenderRegreso();
});
</script>

<template>
  <div class="hoja-fondo">
    <p v-if="error" class="estado-carga" role="alert">{{ error }}</p>
    <p v-else-if="!doc" class="estado-carga">Cargando…</p>

    <template v-else>
      <div class="barra no-imprimir">
        <RouterLink class="barra__volver" :to="{ name: 'portal' }">← Portal</RouterLink>
        <div class="barra__acciones">
          <button
            v-if="doc.pagable"
            type="button"
            class="boton boton--pagar"
            :disabled="pagando"
            @click="pagar"
          >
            {{ pagando ? 'Abriendo Mercado Pago…' : `Pagar ${cop(doc.totalCop)} en línea` }}
          </button>
          <button type="button" class="boton" @click="imprimir">Descargar PDF</button>
        </div>
      </div>

      <p v-if="aviso" class="aviso no-imprimir" :class="`aviso--${aviso.tono}`" role="status">{{ aviso.texto }}</p>

      <article class="hoja" :aria-label="`${tipo === 'factura' ? 'Factura' : 'Cotización'} ${doc.numero}`">
        <div v-if="sello" class="sello" :class="`sello--${doc.estado}`" aria-hidden="true">{{ sello }}</div>

        <header class="membrete">
          <div class="emisor">
            <svg class="emisor__logo" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="38" fill="#1FA2FF" />
              <circle cx="38" cy="44" r="11" fill="white" />
              <circle cx="62" cy="44" r="11" fill="white" />
              <circle cx="38" cy="45" r="5" fill="#1E293B" />
              <circle cx="62" cy="45" r="5" fill="#1E293B" />
            </svg>
            <div>
              <p class="emisor__nombre">{{ doc.emisor.razonSocial }}</p>
              <p>NIT {{ doc.emisor.nit }}<template v-if="doc.emisor.regimen"> · {{ doc.emisor.regimen }}</template></p>
              <p>{{ doc.emisor.direccion }}, {{ doc.emisor.ciudad }}</p>
              <p>
                {{ doc.emisor.email }}<template v-if="doc.emisor.telefono"> · {{ doc.emisor.telefono }}</template>
                <template v-if="doc.emisor.sitioWeb"> · {{ doc.emisor.sitioWeb }}</template>
              </p>
            </div>
          </div>
          <div class="titulo-doc">
            <p class="titulo-doc__tipo">{{ tipo === 'factura' ? 'Factura' : 'Cotización' }}</p>
            <p class="titulo-doc__numero">{{ doc.numero }}</p>
            <dl class="fechas">
              <dt>Fecha</dt>
              <dd>{{ fecha(doc.fechaEmision) }}</dd>
              <template v-if="doc.validaHasta">
                <dt>Válida hasta</dt>
                <dd>{{ fecha(doc.validaHasta) }}</dd>
              </template>
              <template v-if="doc.fechaVencimiento">
                <dt>Vence</dt>
                <dd>{{ fecha(doc.fechaVencimiento) }}</dd>
              </template>
            </dl>
          </div>
        </header>

        <section class="cliente" aria-label="Cliente">
          <p class="etiqueta">{{ tipo === 'factura' ? 'Facturado a' : 'Para' }}</p>
          <p class="cliente__nombre">{{ doc.cliente.nombre }}</p>
          <p>{{ doc.cliente.tipoDocumento }} {{ doc.cliente.documento }}</p>
          <p v-if="doc.cliente.contacto">Atención: {{ doc.cliente.contacto }}</p>
          <p v-if="doc.cliente.direccion || doc.cliente.ciudad">
            {{ [doc.cliente.direccion, doc.cliente.ciudad].filter(Boolean).join(', ') }}
          </p>
          <p v-if="doc.cliente.email || doc.cliente.telefono">
            {{ [doc.cliente.email, doc.cliente.telefono].filter(Boolean).join(' · ') }}
          </p>
        </section>

        <table class="lineas">
          <thead>
            <tr>
              <th>Descripción</th>
              <th class="num">Cant.</th>
              <th class="num">Valor unitario</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in doc.items" :key="i">
              <td>{{ l.descripcion }}</td>
              <td class="num">{{ l.cantidad }}</td>
              <td class="num">{{ cop(l.valorUnitarioCop) }}</td>
              <td class="num">{{ cop(l.totalCop) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="cierre">
          <div class="textos">
            <template v-if="doc.condiciones">
              <p class="etiqueta">Condiciones</p>
              <p class="texto-largo">{{ doc.condiciones }}</p>
            </template>
            <template v-if="doc.notas">
              <p class="etiqueta">Notas</p>
              <p class="texto-largo">{{ doc.notas }}</p>
            </template>
            <template v-if="doc.pago">
              <p class="etiqueta">Pago</p>
              <p>
                {{ etiquetaMedio(doc.pago.metodo, doc.pago.tipoMedio) }} · {{ fecha(doc.pago.fecha) }}
                <template v-if="doc.pago.operacion"> · operación {{ doc.pago.operacion }}</template>
              </p>
            </template>
            <template v-if="doc.motivoAnulacion">
              <p class="etiqueta">Motivo de anulación</p>
              <p>{{ doc.motivoAnulacion }}</p>
            </template>
          </div>

          <dl class="totales">
            <dt>Subtotal</dt>
            <dd>{{ cop(doc.subtotalCop) }}</dd>
            <template v-if="doc.descuentoCop > 0">
              <dt>Descuento</dt>
              <dd>− {{ cop(doc.descuentoCop) }}</dd>
            </template>
            <template v-if="doc.ivaPorcentaje > 0">
              <dt>IVA {{ doc.ivaPorcentaje }} %</dt>
              <dd>{{ cop(doc.ivaCop) }}</dd>
            </template>
            <dt class="totales__final">Total COP</dt>
            <dd class="totales__final">{{ cop(doc.totalCop) }}</dd>
          </dl>
        </div>

        <footer class="pie">
          <p v-if="doc.emisor.notaPie" class="texto-largo">{{ doc.emisor.notaPie }}</p>
          <p v-if="tipo === 'factura'" class="pie__legal">{{ AVISO_JURISDICCION_CORTO }}</p>
          <p v-else class="pie__legal">
            Cotización válida hasta la fecha indicada. Los precios están en pesos colombianos.
          </p>
        </footer>
      </article>
    </template>
  </div>
</template>

<style scoped>
.hoja-fondo {
  min-height: 100vh;
  padding: 1.5rem 1rem 3rem;
  background: #eef2f6;
  font-family: var(--fuente-texto);
  font-weight: 500;
  color: #1e293b;
}

.estado-carga {
  max-width: 820px;
  margin: 3rem auto;
  text-align: center;
}

.barra {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  max-width: 820px;
  margin: 0 auto 1rem;
}

.barra__volver {
  font-weight: 700;
  color: var(--azul-neon-oscuro);
  text-decoration: none;
}

.barra__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.boton {
  min-height: 40px;
  padding: 0.5rem 1.1rem;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--tinta);
  cursor: pointer;
  background: white;
  border: 2px solid #cfd8e3;
  border-radius: 10px;
}

.boton--pagar {
  color: white;
  background: #009ee3;
  border-color: #009ee3;
}

.boton:disabled {
  opacity: 0.6;
  cursor: wait;
}

.aviso {
  max-width: 820px;
  margin: 0 auto 1rem;
  padding: 0.85rem 1.1rem;
  border-radius: 12px;
}

.aviso--bien {
  background: #dcfce7;
}

.aviso--espera {
  background: #fef3c7;
}

.aviso--mal {
  background: #fee2e2;
}

/* ── La hoja: proporciones de un A4 en pantalla ── */
.hoja {
  position: relative;
  max-width: 820px;
  margin: 0 auto;
  padding: 3rem 3.25rem;
  overflow: hidden;
  font-size: 0.92rem;
  line-height: 1.5;
  background: white;
  border-radius: 4px;
  box-shadow: 0 10px 40px rgb(30 41 59 / 0.12);
}

.hoja p {
  margin: 0;
}

.sello {
  position: absolute;
  top: 42%;
  left: 50%;
  padding: 0.4rem 2rem;
  font-family: var(--fuente-titulo);
  font-size: 4.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgb(220 38 38 / 0.16);
  pointer-events: none;
  border: 6px solid rgb(220 38 38 / 0.16);
  border-radius: 12px;
  transform: translate(-50%, -50%) rotate(-18deg);
}

.sello--pagada {
  color: rgb(22 163 74 / 0.18);
  border-color: rgb(22 163 74 / 0.18);
}

.sello--borrador {
  color: rgb(71 85 105 / 0.14);
  border-color: rgb(71 85 105 / 0.14);
}

.membrete {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: space-between;
  padding-bottom: 1.5rem;
  border-bottom: 3px solid #1fa2ff;
}

.emisor {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  max-width: 26rem;
  font-size: 0.85rem;
  color: #475569;
}

.emisor__logo {
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
}

.emisor__nombre {
  font-family: var(--fuente-titulo);
  font-size: 1.15rem;
  font-weight: 600;
  color: #1e293b;
}

.titulo-doc {
  text-align: right;
}

.titulo-doc__tipo {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0d7fd4;
}

.titulo-doc__numero {
  font-family: var(--fuente-titulo);
  font-size: 1.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.fechas {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.1rem 0.75rem;
  justify-content: end;
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
}

.fechas dt {
  color: #64748b;
}

.fechas dd {
  margin: 0;
  font-weight: 700;
}

.etiqueta {
  margin-bottom: 0.2rem !important;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #64748b;
}

.cliente {
  padding: 1.25rem 0;
}

.cliente__nombre {
  font-size: 1.05rem;
  font-weight: 800;
}

.lineas {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.lineas th {
  padding: 0.55rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
  color: #475569;
  background: #f1f5f9;
}

.lineas td {
  padding: 0.65rem 0.6rem;
  vertical-align: top;
  border-bottom: 1px solid #e2e8f0;
}

.num {
  text-align: right !important;
  white-space: nowrap;
}

.cierre {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 260px);
  gap: 2rem;
  margin-top: 1.25rem;
}

.textos {
  display: grid;
  gap: 0.2rem;
  align-content: start;
}

.textos .etiqueta:not(:first-child) {
  margin-top: 0.75rem !important;
}

.texto-largo {
  white-space: pre-line;
}

.totales {
  display: grid;
  grid-template-columns: 1fr auto;
  /* Sin hueco entre columnas: la raya del total tiene que ser una sola. */
  gap: 0.35rem 0;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.totales dt {
  color: #64748b;
}

.totales dd {
  margin: 0;
  padding-left: 1rem;
  text-align: right;
  font-weight: 700;
}

.totales__final {
  padding-top: 0.5rem;
  margin-top: 0.25rem;
  border-top: 2px solid #1e293b;
  font-size: 1.15rem;
  font-weight: 800 !important;
  color: #1e293b !important;
}

.pie {
  display: grid;
  gap: 0.5rem;
  padding-top: 1.25rem;
  margin-top: 2rem;
  font-size: 0.8rem;
  color: #475569;
  border-top: 1px solid #e2e8f0;
}

.pie__legal {
  font-size: 0.75rem;
  color: #94a3b8;
}

@media (max-width: 640px) {
  .hoja {
    padding: 1.5rem 1.1rem;
  }

  .titulo-doc {
    text-align: left;
  }

  .fechas {
    justify-content: start;
  }

  .cierre {
    grid-template-columns: 1fr;
  }

  .lineas th:nth-child(3),
  .lineas td:nth-child(3) {
    display: none;
  }
}

/* ── Impresion: solo la hoja, a tamano A4 ── */
@media print {
  @page {
    size: A4;
    margin: 14mm;
  }

  .hoja-fondo {
    padding: 0;
    background: white;
  }

  .no-imprimir {
    display: none !important;
  }

  .hoja {
    max-width: none;
    padding: 0;
    box-shadow: none;
  }

  .lineas th {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
