<script setup lang="ts">
/**
 * El estado de un pago, una licencia o un documento, como una pastilla.
 *
 * Siempre con la palabra: el color ayuda a leer rapido una tabla larga, pero
 * nunca es lo unico que dice el estado.
 */
import { computed } from 'vue';

import {
  ETIQUETA_ESTADO_COTIZACION,
  ETIQUETA_ESTADO_FACTURA,
  ETIQUETA_ESTADO_LICENCIA,
  ETIQUETA_ESTADO_PAGO,
} from '@codenest/shared';

import { tonoEstado } from './formato';

const props = defineProps<{
  estado: string;
  tipo: 'pago' | 'licencia' | 'cotizacion' | 'factura';
}>();

const etiqueta = computed(() => {
  const tabla =
    props.tipo === 'pago'
      ? ETIQUETA_ESTADO_PAGO
      : props.tipo === 'licencia'
        ? ETIQUETA_ESTADO_LICENCIA
        : props.tipo === 'cotizacion'
          ? ETIQUETA_ESTADO_COTIZACION
          : ETIQUETA_ESTADO_FACTURA;
  return tabla[props.estado] ?? props.estado;
});

const tono = computed(() => tonoEstado(props.estado));
</script>

<template>
  <span class="a-chip" :class="tono ? `a-chip--${tono}` : ''">{{ etiqueta }}</span>
</template>
