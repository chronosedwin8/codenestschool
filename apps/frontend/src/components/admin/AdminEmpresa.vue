<script setup lang="ts">
/**
 * Los datos de la empresa que emite facturas y cotizaciones.
 *
 * Se copian dentro de cada documento en el momento de emitirlo: cambiarlos
 * aqui afecta a los proximos documentos, nunca a los ya emitidos.
 */
import { onMounted, reactive, ref } from 'vue';

import { api } from '@/api/cliente';

const emisor = reactive({
  razonSocial: '',
  nit: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  email: '',
  regimen: '',
  sitioWeb: '',
  notaPie: '',
});
const guardando = ref(false);
const mensaje = ref<{ tono: 'bien' | 'mal'; texto: string } | null>(null);

onMounted(async () => {
  const r = await api.get<{ emisor: Partial<typeof emisor> | null }>('/admin/emisor');
  if (r.emisor) Object.assign(emisor, r.emisor);
});

async function guardar(): Promise<void> {
  guardando.value = true;
  mensaje.value = null;
  try {
    await api.put('/admin/emisor', { ...emisor });
    mensaje.value = { tono: 'bien', texto: 'Guardado. Se usará en los próximos documentos.' };
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo guardar' };
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <section class="a-panel">
    <h2>Datos de la empresa</h2>
    <p class="a-subtitulo intro">
      Salen en el encabezado de cada factura y cotización. Cambiarlos afecta a los documentos nuevos, no a
      los ya emitidos.
    </p>
    <form class="a-formulario" @submit.prevent="guardar">
      <label class="a-campo a-campo--ancho">
        <span>Razón social</span>
        <input id="emisor-razon" v-model.trim="emisor.razonSocial" required maxlength="200" />
      </label>
      <label class="a-campo">
        <span>NIT</span>
        <input id="emisor-nit" v-model.trim="emisor.nit" required maxlength="40" placeholder="901234567-8" />
      </label>
      <label class="a-campo">
        <span>Régimen</span>
        <input id="emisor-regimen" v-model.trim="emisor.regimen" maxlength="120" placeholder="Responsable de IVA" />
        <small>Lo que indique tu contador.</small>
      </label>
      <label class="a-campo a-campo--ancho">
        <span>Dirección</span>
        <input id="emisor-direccion" v-model.trim="emisor.direccion" required maxlength="250" />
      </label>
      <label class="a-campo">
        <span>Ciudad</span>
        <input id="emisor-ciudad" v-model.trim="emisor.ciudad" required maxlength="100" />
      </label>
      <label class="a-campo">
        <span>Teléfono</span>
        <input id="emisor-telefono" v-model.trim="emisor.telefono" maxlength="40" />
      </label>
      <label class="a-campo">
        <span>Correo de facturación</span>
        <input id="emisor-email" v-model.trim="emisor.email" type="email" required maxlength="255" />
      </label>
      <label class="a-campo">
        <span>Sitio web</span>
        <input id="emisor-web" v-model.trim="emisor.sitioWeb" maxlength="200" placeholder="codenestschool.com" />
      </label>
      <label class="a-campo a-campo--ancho">
        <span>Nota al pie</span>
        <textarea
          id="emisor-nota"
          v-model.trim="emisor.notaPie"
          maxlength="1000"
          placeholder="Cuenta para transferencias: Bancolombia ahorros 000-000000-00 a nombre de…"
        />
        <small>Por ejemplo, la cuenta para pagos por transferencia.</small>
      </label>
      <div class="a-acciones a-campo--ancho">
        <button class="a-boton" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
        <span v-if="mensaje" class="a-chip" :class="`a-chip--${mensaje.tono}`" role="status">{{ mensaje.texto }}</span>
      </div>
    </form>
  </section>
</template>

<style scoped>
.intro {
  margin: -0.4rem 0 1rem;
  max-width: 70ch;
}
</style>
