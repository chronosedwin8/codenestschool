<script setup lang="ts">
/**
 * Datos de facturacion del cliente: lo que sale en sus facturas.
 *
 * Los tipos de documento son los que acepta Mercado Pago en Colombia; un tipo
 * que no conoce hace fallar el cobro.
 */
import { onMounted, reactive, ref } from 'vue';

import { DOCUMENTO_MAX, DOCUMENTO_MIN, TIPOS_DOCUMENTO } from '@codenest/shared';

import { api } from '@/api/cliente';

const datos = reactive({
  tipoDocumento: 'CC',
  documento: '',
  razonSocial: '',
  direccion: '',
  ciudad: '',
  telefono: '',
});

const guardando = ref(false);
const mensaje = ref<{ tono: 'bien' | 'mal'; texto: string } | null>(null);

onMounted(async () => {
  const r = await api.get<{ perfil: Partial<typeof datos> | null }>('/portal/facturacion');
  if (r.perfil) {
    for (const [clave, valor] of Object.entries(r.perfil)) {
      (datos as Record<string, string>)[clave] = (valor as string | null) ?? '';
    }
  }
});

async function guardar(): Promise<void> {
  guardando.value = true;
  mensaje.value = null;
  try {
    await api.put('/portal/facturacion', { ...datos });
    mensaje.value = { tono: 'bien', texto: 'Datos de facturación guardados.' };
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudieron guardar' };
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <form class="a-formulario" @submit.prevent="guardar">
    <label class="a-campo">
      <span>Tipo de documento</span>
      <select id="fact-tipo" v-model="datos.tipoDocumento">
        <option v-for="t in TIPOS_DOCUMENTO" :key="t.clave" :value="t.clave">{{ t.nombre }}</option>
      </select>
    </label>
    <label class="a-campo">
      <span>Número de documento</span>
      <input
        id="fact-documento"
        v-model.trim="datos.documento"
        required
        :minlength="DOCUMENTO_MIN"
        :maxlength="DOCUMENTO_MAX"
        inputmode="numeric"
        autocomplete="off"
      />
      <small>Sin puntos. Si es NIT, con o sin dígito de verificación.</small>
    </label>
    <label class="a-campo a-campo--ancho">
      <span>Razón social o nombre en la factura</span>
      <input id="fact-razon" v-model.trim="datos.razonSocial" maxlength="200" autocomplete="organization" />
      <small>Si lo dejas vacío, la factura sale a nombre de tu cuenta.</small>
    </label>
    <label class="a-campo">
      <span>Dirección</span>
      <input id="fact-direccion" v-model.trim="datos.direccion" maxlength="250" autocomplete="street-address" />
    </label>
    <label class="a-campo">
      <span>Ciudad</span>
      <input id="fact-ciudad" v-model.trim="datos.ciudad" required maxlength="100" autocomplete="address-level2" />
    </label>
    <label class="a-campo">
      <span>Teléfono</span>
      <input id="fact-telefono" v-model.trim="datos.telefono" maxlength="40" inputmode="tel" autocomplete="tel" />
    </label>
    <div class="a-campo a-campo--ancho">
      <div class="a-acciones">
        <button class="a-boton" type="submit" :disabled="guardando">
          {{ guardando ? 'Guardando…' : 'Guardar datos de facturación' }}
        </button>
        <span v-if="mensaje" class="a-chip" :class="`a-chip--${mensaje.tono}`" role="status">{{ mensaje.texto }}</span>
      </div>
    </div>
  </form>
</template>
