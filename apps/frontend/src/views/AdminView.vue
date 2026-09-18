<script setup lang="ts">
/**
 * Panel de administracion.
 *
 * Seis pestanas, cada una en su componente. Esta vista solo reparte: guarda la
 * pestana activa, carga los planes (que usan los editores de documentos) y
 * pasa el borrador de factura cuando "Facturar" se pulsa en Pagos o en
 * Cotizaciones.
 */
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { api, borrarToken } from '@/api/cliente';
import AdminCotizaciones from '@/components/admin/AdminCotizaciones.vue';
import AdminEmpresa from '@/components/admin/AdminEmpresa.vue';
import AdminFacturas from '@/components/admin/AdminFacturas.vue';
import AdminPagos from '@/components/admin/AdminPagos.vue';
import AdminPlanes from '@/components/admin/AdminPlanes.vue';
import AdminResumen from '@/components/admin/AdminResumen.vue';
import type { EntradaEditor } from '@/components/facturacion/EditorDocumento.vue';
import '@/styles/adultos.css';

type Pestana = 'resumen' | 'planes' | 'pagos' | 'facturas' | 'cotizaciones' | 'empresa';

const PESTANAS: readonly { clave: Pestana; nombre: string }[] = [
  { clave: 'resumen', nombre: 'Resumen' },
  { clave: 'planes', nombre: 'Precios' },
  { clave: 'pagos', nombre: 'Pagos y licencias' },
  { clave: 'facturas', nombre: 'Facturas' },
  { clave: 'cotizaciones', nombre: 'Cotizaciones' },
  { clave: 'empresa', nombre: 'Empresa' },
];

const router = useRouter();
const pestana = ref<Pestana>('resumen');
const planes = ref<{ id: number; nombre: string; precioCop: number }[]>([]);
const borradorFactura = ref<Partial<EntradaEditor> | null>(null);

async function cargarPlanes(): Promise<void> {
  const r = await api.get<{ planes: { id: number; nombre: string; precioCop: number; activo: boolean }[] }>('/admin/planes');
  planes.value = r.planes.filter((p) => p.activo);
}

function facturar(borrador: unknown): void {
  borradorFactura.value = borrador as Partial<EntradaEditor>;
  pestana.value = 'facturas';
}

function salir(): void {
  borrarToken();
  void router.push('/');
}

onMounted(cargarPlanes);
</script>

<template>
  <div class="a-pagina">
    <header class="a-cabecera">
      <div>
        <h1>Administración</h1>
        <p class="a-subtitulo">Precios, pagos, facturas y cotizaciones de CodeNest School.</p>
      </div>
      <div class="a-acciones">
        <RouterLink class="a-boton a-boton--fantasma" :to="{ name: 'portal' }">Portal</RouterLink>
        <button type="button" class="a-boton a-boton--fantasma" @click="salir">Cerrar sesión</button>
      </div>
    </header>

    <nav class="a-pestanas" aria-label="Secciones de administración">
      <button
        v-for="p in PESTANAS"
        :key="p.clave"
        type="button"
        class="a-pestana"
        :class="{ 'a-pestana--activa': pestana === p.clave }"
        :aria-current="pestana === p.clave ? 'page' : undefined"
        @click="pestana = p.clave"
      >
        {{ p.nombre }}
      </button>
    </nav>

    <AdminResumen v-if="pestana === 'resumen'" @ir="pestana = $event" />
    <AdminPlanes v-else-if="pestana === 'planes'" @cambiados="cargarPlanes" />
    <AdminPagos v-else-if="pestana === 'pagos'" @facturar="facturar" />
    <AdminFacturas
      v-else-if="pestana === 'facturas'"
      :planes="planes"
      :borrador="borradorFactura"
      @borrador-usado="borradorFactura = null"
    />
    <AdminCotizaciones v-else-if="pestana === 'cotizaciones'" :planes="planes" @facturar="facturar" />
    <AdminEmpresa v-else />
  </div>
</template>
