<script setup lang="ts">
/**
 * Lo primero que ve el administrador: cuanto entro este mes, que esta
 * pendiente, y sobre todo que falta configurar antes de poder cobrar.
 */
import { onMounted, ref } from 'vue';

import { api } from '@/api/cliente';
import { cop } from '@/components/facturacion/formato';

interface Resumen {
  readonly ingresosMesCop: number;
  readonly pagosMes: number;
  readonly pagosPendientes: number;
  readonly licenciasActivas: number;
  readonly cotizacionesAbiertas: number;
  readonly configuracion: {
    readonly pagos: boolean;
    readonly firmaWebhook: boolean;
    readonly emisor: boolean;
    readonly urlWebhook: string;
  };
}

const emitir = defineEmits<{ ir: [pestana: 'empresa' | 'pagos' | 'cotizaciones'] }>();

const resumen = ref<Resumen | null>(null);
const copiado = ref(false);

onMounted(async () => {
  resumen.value = await api.get<Resumen>('/admin/resumen');
});

async function copiarWebhook(): Promise<void> {
  if (!resumen.value) return;
  try {
    await navigator.clipboard.writeText(resumen.value.configuracion.urlWebhook);
    copiado.value = true;
    setTimeout(() => (copiado.value = false), 2000);
  } catch {
    // Sin permiso de portapapeles, la URL sigue a la vista para copiarla a mano.
  }
}
</script>

<template>
  <div v-if="resumen">
    <section class="a-panel">
      <h2>Este mes</h2>
      <div class="a-cifras">
        <div class="a-cifra">
          <span class="a-cifra__valor">{{ cop(resumen.ingresosMesCop) }}</span>
          <span class="a-cifra__etiqueta">ingresos aprobados ({{ resumen.pagosMes }} pagos)</span>
        </div>
        <button type="button" class="a-cifra cifra-boton" @click="emitir('ir', 'pagos')">
          <span class="a-cifra__valor">{{ resumen.pagosPendientes }}</span>
          <span class="a-cifra__etiqueta">pagos pendientes de confirmar</span>
        </button>
        <div class="a-cifra">
          <span class="a-cifra__valor">{{ resumen.licenciasActivas }}</span>
          <span class="a-cifra__etiqueta">licencias activas</span>
        </div>
        <button type="button" class="a-cifra cifra-boton" @click="emitir('ir', 'cotizaciones')">
          <span class="a-cifra__valor">{{ resumen.cotizacionesAbiertas }}</span>
          <span class="a-cifra__etiqueta">cotizaciones abiertas</span>
        </button>
      </div>
    </section>

    <section class="a-panel">
      <h2>Configuración para cobrar</h2>
      <ul class="lista-config">
        <li>
          <span class="a-chip" :class="resumen.configuracion.pagos ? 'a-chip--bien' : 'a-chip--mal'">
            {{ resumen.configuracion.pagos ? 'Listo' : 'Falta' }}
          </span>
          <div>
            <strong>Credenciales de Mercado Pago</strong>
            <p>Token de acceso y clave pública en el servidor.</p>
          </div>
        </li>
        <li>
          <span class="a-chip" :class="resumen.configuracion.firmaWebhook ? 'a-chip--bien' : 'a-chip--espera'">
            {{ resumen.configuracion.firmaWebhook ? 'Listo' : 'Recomendado' }}
          </span>
          <div>
            <strong>Aviso de pagos (webhook)</strong>
            <p>
              Regístralo en Mercado Pago → Tus integraciones → Webhooks, evento <em>Pagos</em>, y copia la
              clave secreta que te da en la variable <code class="a-codigo">MP_WEBHOOK_SECRET</code>.
            </p>
            <div class="url-webhook">
              <code class="a-codigo">{{ resumen.configuracion.urlWebhook }}</code>
              <button type="button" class="a-boton a-boton--fantasma a-boton--pequeno" @click="copiarWebhook">
                {{ copiado ? 'Copiada' : 'Copiar' }}
              </button>
            </div>
          </div>
        </li>
        <li>
          <span class="a-chip" :class="resumen.configuracion.emisor ? 'a-chip--bien' : 'a-chip--mal'">
            {{ resumen.configuracion.emisor ? 'Listo' : 'Falta' }}
          </span>
          <div>
            <strong>Datos de la empresa</strong>
            <p>Razón social, NIT y dirección: sin ellos no se emiten facturas ni cotizaciones.</p>
            <button
              v-if="!resumen.configuracion.emisor"
              type="button"
              class="a-boton a-boton--pequeno"
              @click="emitir('ir', 'empresa')"
            >
              Completar ahora
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
  <p v-else class="a-aviso">Cargando…</p>
</template>

<style scoped>
.cifra-boton {
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  border: 0;
}

.cifra-boton:hover {
  outline: 2px solid var(--azul-neon);
}

.lista-config {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista-config li {
  display: grid;
  grid-template-columns: 7.5rem 1fr;
  gap: 0.75rem;
  align-items: start;
}

.lista-config p {
  margin: 0.2rem 0 0.5rem;
  color: var(--gris-oscuro);
  max-width: 64ch;
}

.url-webhook {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.url-webhook code {
  overflow-wrap: anywhere;
}

@media (max-width: 560px) {
  .lista-config li {
    grid-template-columns: 1fr;
  }
}
</style>
