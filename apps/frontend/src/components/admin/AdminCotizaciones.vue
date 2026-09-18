<script setup lang="ts">
/**
 * Cotizaciones: lo que pide compras de un colegio antes de aprobar un gasto.
 *
 * Vida de una cotizacion: borrador (se edita) → enviada (ya no se edita; se
 * comparte el enlace) → pagada (por el enlace o por transferencia) → licencia
 * activada. Se puede anular en cualquier momento antes de pagarse, y eso cierra
 * tambien su pagina de pago en Mercado Pago.
 */
import { onMounted, ref } from 'vue';

import { api } from '@/api/cliente';
import EditorDocumento, { type EntradaEditor } from '@/components/facturacion/EditorDocumento.vue';
import EstadoChip from '@/components/facturacion/EstadoChip.vue';
import { cop, fecha } from '@/components/facturacion/formato';

interface Cotizacion {
  id: number;
  numero: string;
  estado: string;
  estadoGuardado: string;
  fechaEmision: string;
  validaHasta: string;
  cliente: EntradaEditor['cliente'];
  items: EntradaEditor['items'];
  descuentoCop: number;
  ivaPorcentaje: number;
  totalCop: number;
  notas: string | null;
  condiciones: string | null;
  plan: { id: number; nombre: string } | null;
  licenciaId: number | null;
  pagadaEn: string | null;
  motivoAnulacion: string | null;
  enlacePublico: string;
  urlPago: string | null;
}

defineProps<{ planes: readonly { id: number; nombre: string; precioCop: number }[] }>();
const emitir = defineEmits<{ facturar: [borrador: unknown] }>();

const cotizaciones = ref<Cotizacion[]>([]);
const editor = ref<{ id: number | null; inicial: Partial<EntradaEditor> | null } | null>(null);
const guardando = ref(false);
const error = ref<string | null>(null);
const mensaje = ref<{ tono: 'bien' | 'mal' | 'espera'; texto: string } | null>(null);
/** La contrasena temporal se muestra una vez y no se guarda en ningun sitio. */
const credenciales = ref<{ email: string; passwordTemporal: string; codigoInstitucion: string | null } | null>(null);
const ocupado = ref<number | null>(null);

async function cargar(): Promise<void> {
  cotizaciones.value = (await api.get<{ cotizaciones: Cotizacion[] }>('/admin/cotizaciones')).cotizaciones;
}

function nueva(): void {
  error.value = null;
  editor.value = { id: null, inicial: null };
}

function editar(c: Cotizacion): void {
  error.value = null;
  editor.value = {
    id: c.id,
    inicial: {
      cliente: c.cliente,
      items: c.items.map(({ descripcion, cantidad, valorUnitarioCop }) => ({ descripcion, cantidad, valorUnitarioCop })),
      descuentoCop: c.descuentoCop,
      ivaPorcentaje: c.ivaPorcentaje,
      validaHasta: c.validaHasta,
      planId: c.plan?.id ?? null,
      notas: c.notas ?? undefined,
      condiciones: c.condiciones ?? undefined,
    },
  };
}

async function guardar(entrada: EntradaEditor): Promise<void> {
  guardando.value = true;
  error.value = null;
  try {
    const id = editor.value?.id;
    const r = id
      ? await api.put<{ cotizacion: Cotizacion }>(`/admin/cotizaciones/${id}`, entrada)
      : await api.post<{ cotizacion: Cotizacion }>('/admin/cotizaciones', entrada);
    mensaje.value = {
      tono: 'bien',
      texto: `${r.cotizacion.numero} guardada como borrador. Revísala y márcala como enviada para compartirla.`,
    };
    editor.value = null;
    await cargar();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar';
  } finally {
    guardando.value = false;
  }
}

async function accion(c: Cotizacion, hacer: () => Promise<string>): Promise<void> {
  ocupado.value = c.id;
  mensaje.value = null;
  try {
    mensaje.value = { tono: 'bien', texto: await hacer() };
    await cargar();
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo completar' };
  } finally {
    ocupado.value = null;
  }
}

const cambiarEstado = (c: Cotizacion, estado: 'enviada' | 'aceptada') =>
  accion(c, async () => {
    await api.post(`/admin/cotizaciones/${c.id}/estado`, { estado });
    return estado === 'enviada'
      ? `${c.numero} enviada. Ya no se puede editar; comparte el enlace con el cliente.`
      : `${c.numero} marcada como aceptada.`;
  });

const anular = (c: Cotizacion) => {
  const motivo = window.prompt(`Motivo para anular ${c.numero}:`);
  if (!motivo || motivo.trim().length < 5) return;
  void accion(c, async () => {
    await api.post(`/admin/cotizaciones/${c.id}/estado`, { estado: 'anulada', motivo: motivo.trim() });
    return `${c.numero} anulada. Su página de pago en Mercado Pago quedó cerrada.`;
  });
};

async function copiar(texto: string, que: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    mensaje.value = { tono: 'bien', texto: `${que} copiado.` };
  } catch {
    window.prompt(`Copia ${que.toLowerCase()}:`, texto);
  }
}

const enlacePago = (c: Cotizacion) =>
  accion(c, async () => {
    const r = await api.post<{ urlPago: string }>(`/admin/cotizaciones/${c.id}/enlace-pago`);
    await copiar(r.urlPago, 'Enlace de pago de Mercado Pago');
    return 'Enlace de pago de Mercado Pago copiado. También puede pagar desde el enlace de la cotización.';
  });

const conciliar = (c: Cotizacion) =>
  accion(c, async () => {
    const r = await api.post<{ encontrados: number }>(`/admin/cotizaciones/${c.id}/conciliar`);
    return r.encontrados === 0 ? 'Mercado Pago no tiene pagos para esta cotización.' : `Revisados ${r.encontrados} pagos.`;
  });

const activarLicencia = (c: Cotizacion) =>
  accion(c, async () => {
    const r = await api.post<{
      licenciaId: number;
      cuentaNueva: { email: string; passwordTemporal: string } | null;
      codigoInstitucion: string | null;
    }>(`/admin/cotizaciones/${c.id}/activar-licencia`);
    if (r.cuentaNueva) {
      credenciales.value = { ...r.cuentaNueva, codigoInstitucion: r.codigoInstitucion };
      return `Licencia activada y cuenta creada para ${r.cuentaNueva.email}.`;
    }
    return 'Licencia activada en la cuenta que ya tenía el cliente.';
  });

async function facturar(c: Cotizacion): Promise<void> {
  const r = await api.get<{ borrador: unknown }>(`/admin/cotizaciones/${c.id}/borrador-factura`);
  emitir('facturar', r.borrador);
}

onMounted(cargar);
</script>

<template>
  <section v-if="credenciales" class="a-panel credenciales" role="alert">
    <h2>Credenciales de la cuenta nueva</h2>
    <p>
      Se muestran <strong>solo esta vez</strong>: no se guardan en ningún sitio. Envíalas al cliente y pídele
      que cambie la contraseña al entrar.
    </p>
    <dl class="a-datos">
      <dt>Correo</dt>
      <dd>{{ credenciales.email }}</dd>
      <dt>Contraseña temporal</dt>
      <dd><code class="a-codigo">{{ credenciales.passwordTemporal }}</code></dd>
      <template v-if="credenciales.codigoInstitucion">
        <dt>Código del colegio</dt>
        <dd><code class="a-codigo">{{ credenciales.codigoInstitucion }}</code></dd>
      </template>
    </dl>
    <div class="a-acciones">
      <button
        type="button"
        class="a-boton a-boton--fantasma"
        @click="copiar(`Correo: ${credenciales.email}\nContraseña temporal: ${credenciales.passwordTemporal}`, 'Credenciales')"
      >
        Copiar
      </button>
      <button type="button" class="a-boton" @click="credenciales = null">Ya las guardé</button>
    </div>
  </section>

  <section v-if="editor" class="a-panel">
    <h2>{{ editor.id ? 'Editar borrador' : 'Nueva cotización' }}</h2>
    <EditorDocumento
      tipo="cotizacion"
      :inicial="editor.inicial"
      :planes="planes"
      :guardando="guardando"
      :error="error"
      @guardar="guardar"
      @cancelar="editor = null"
    />
  </section>

  <section class="a-panel">
    <div class="a-fila-titulo">
      <h2>Cotizaciones</h2>
      <button v-if="!editor" type="button" class="a-boton" @click="nueva">Nueva cotización</button>
    </div>
    <p v-if="mensaje" class="a-aviso" :class="`a-aviso--${mensaje.tono}`" role="status">{{ mensaje.texto }}</p>

    <p v-if="cotizaciones.length === 0" class="a-vacio">Todavía no hay cotizaciones.</p>
    <div v-else class="a-tabla-contenedor">
      <table class="a-tabla">
        <thead>
          <tr><th>Número</th><th>Cliente</th><th>Válida hasta</th><th class="a-num">Total</th><th>Estado</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="c in cotizaciones" :key="c.id">
            <td>{{ c.numero }}</td>
            <td>
              {{ c.cliente.nombre }}
              <small>{{ c.cliente.email ?? 'sin correo' }}</small>
            </td>
            <td>{{ fecha(c.validaHasta) }}</td>
            <td class="a-num">{{ cop(c.totalCop) }}</td>
            <td>
              <EstadoChip :estado="c.estado" tipo="cotizacion" />
              <small v-if="c.motivoAnulacion">{{ c.motivoAnulacion }}</small>
              <small v-if="c.licenciaId">licencia #{{ c.licenciaId }} activa</small>
            </td>
            <td class="acciones-fila">
              <a class="a-boton a-boton--fantasma a-boton--pequeno" :href="c.enlacePublico" target="_blank" rel="noopener">Ver</a>
              <template v-if="c.estado === 'borrador'">
                <button type="button" class="a-boton a-boton--fantasma a-boton--pequeno" @click="editar(c)">Editar</button>
                <button type="button" class="a-boton a-boton--pequeno" :disabled="ocupado === c.id" @click="cambiarEstado(c, 'enviada')">
                  Marcar enviada
                </button>
              </template>
              <template v-if="c.estado === 'enviada' || c.estado === 'aceptada'">
                <button type="button" class="a-boton a-boton--fantasma a-boton--pequeno" @click="copiar(c.enlacePublico, 'Enlace de la cotización')">
                  Copiar enlace
                </button>
                <button type="button" class="a-boton a-boton--fantasma a-boton--pequeno" :disabled="ocupado === c.id" @click="enlacePago(c)">
                  Enlace de pago
                </button>
                <button type="button" class="a-boton a-boton--fantasma a-boton--pequeno" :disabled="ocupado === c.id" @click="conciliar(c)">
                  ¿Ya pagó?
                </button>
                <button
                  v-if="c.estado === 'enviada'"
                  type="button"
                  class="a-boton a-boton--fantasma a-boton--pequeno"
                  :disabled="ocupado === c.id"
                  @click="cambiarEstado(c, 'aceptada')"
                >
                  Aceptada
                </button>
              </template>
              <template v-if="c.estado === 'pagada'">
                <button
                  v-if="c.plan && !c.licenciaId"
                  type="button"
                  class="a-boton a-boton--verde a-boton--pequeno"
                  :disabled="ocupado === c.id"
                  @click="activarLicencia(c)"
                >
                  Activar licencia {{ c.plan.nombre }}
                </button>
                <button type="button" class="a-boton a-boton--pequeno" @click="facturar(c)">Facturar</button>
              </template>
              <button
                v-if="c.estado !== 'pagada' && c.estado !== 'anulada'"
                type="button"
                class="a-boton a-boton--peligro a-boton--pequeno"
                :disabled="ocupado === c.id"
                @click="anular(c)"
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
.acciones-fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 14rem;
}

.credenciales {
  border: 2px solid var(--amarillo-oscuro);
}

.credenciales p {
  max-width: 64ch;
}
</style>
