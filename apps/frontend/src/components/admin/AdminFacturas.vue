<script setup lang="ts">
/**
 * Facturas: emitir, ver y anular. Nunca editar ni borrar.
 *
 * Una factura emitida es un documento contable: si tiene un error, se anula
 * (con motivo, que queda en el documento) y se emite otra.
 */
import { onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';
import EditorDocumento, { type EntradaEditor } from '@/components/facturacion/EditorDocumento.vue';
import EstadoChip from '@/components/facturacion/EstadoChip.vue';
import { cop, fecha } from '@/components/facturacion/formato';

interface Factura {
  id: number;
  numero: string;
  estado: string;
  fechaEmision: string;
  cliente: string;
  totalCop: number;
  pagoId: number | null;
  motivoAnulacion: string | null;
  enlacePublico: string;
}

const props = defineProps<{
  planes: readonly { id: number; nombre: string; precioCop: number }[];
  /** Borrador que llega de "Facturar" en Pagos o en Cotizaciones. */
  borrador?: Partial<EntradaEditor> | null;
}>();
const emitir = defineEmits<{ borradorUsado: [] }>();

const facturas = ref<Factura[]>([]);
const editor = ref<{ inicial: Partial<EntradaEditor> | null } | null>(null);
const guardando = ref(false);
const error = ref<string | null>(null);
const mensaje = ref<{ tono: 'bien' | 'mal'; texto: string } | null>(null);

async function cargar(): Promise<void> {
  facturas.value = (await api.get<{ facturas: Factura[] }>('/admin/facturas')).facturas;
}

function abrirEditor(inicial: Partial<EntradaEditor> | null): void {
  error.value = null;
  mensaje.value = null;
  editor.value = { inicial };
}

watch(
  () => props.borrador,
  (b) => {
    if (b) {
      abrirEditor(b);
      emitir('borradorUsado');
    }
  },
  { immediate: true },
);

async function emitirFactura(entrada: EntradaEditor): Promise<void> {
  guardando.value = true;
  error.value = null;
  try {
    const r = await api.post<{ factura: { numero: string; enlacePublico: string } }>('/admin/facturas', entrada);
    mensaje.value = { tono: 'bien', texto: `Factura ${r.factura.numero} emitida.` };
    editor.value = null;
    await cargar();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo emitir';
  } finally {
    guardando.value = false;
  }
}

async function anular(f: Factura): Promise<void> {
  const motivo = window.prompt(`Motivo para anular ${f.numero} (queda escrito en la factura):`);
  if (!motivo || motivo.trim().length < 5) return;
  try {
    await api.post(`/admin/facturas/${f.id}/anular`, { motivo: motivo.trim() });
    mensaje.value = { tono: 'bien', texto: `${f.numero} anulada. Si tenía un pago, ya se puede volver a facturar.` };
    await cargar();
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo anular' };
  }
}

onMounted(cargar);
</script>

<template>
  <section v-if="editor" class="a-panel">
    <h2>Nueva factura</h2>
    <EditorDocumento
      tipo="factura"
      :inicial="editor.inicial"
      :planes="planes"
      :guardando="guardando"
      :error="error"
      @guardar="emitirFactura"
      @cancelar="editor = null"
    />
  </section>

  <section class="a-panel">
    <div class="a-fila-titulo">
      <h2>Facturas</h2>
      <button v-if="!editor" type="button" class="a-boton" @click="abrirEditor(null)">Nueva factura</button>
    </div>
    <p class="a-subtitulo nota">
      Comprobantes comerciales con numeración propia, emitidos por Grupo Logic SAS Latinoamérica: no son facturas
      electrónicas de la DIAN, y así se lo dice el portal a cada cliente.
    </p>
    <p v-if="mensaje" class="a-aviso" :class="`a-aviso--${mensaje.tono}`" role="status">{{ mensaje.texto }}</p>

    <p v-if="facturas.length === 0" class="a-vacio">Todavía no hay facturas.</p>
    <div v-else class="a-tabla-contenedor">
      <table class="a-tabla">
        <thead>
          <tr><th>Número</th><th>Fecha</th><th>Cliente</th><th class="a-num">Total</th><th>Estado</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="f in facturas" :key="f.id">
            <td>{{ f.numero }}</td>
            <td>{{ fecha(f.fechaEmision) }}</td>
            <td>{{ f.cliente }}</td>
            <td class="a-num">{{ cop(f.totalCop) }}</td>
            <td>
              <EstadoChip :estado="f.estado" tipo="factura" />
              <small v-if="f.motivoAnulacion">{{ f.motivoAnulacion }}</small>
            </td>
            <td class="acciones-fila">
              <a class="a-boton a-boton--fantasma a-boton--pequeno" :href="f.enlacePublico" target="_blank" rel="noopener">
                Ver
              </a>
              <button
                v-if="f.estado === 'emitida'"
                type="button"
                class="a-boton a-boton--peligro a-boton--pequeno"
                @click="anular(f)"
              >
                Anular
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.nota {
  margin: -0.4rem 0 1rem;
  max-width: 70ch;
  font-size: 0.85rem;
}

.acciones-fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
</style>
