/**
 * Tipos del cliente que no pertenecen al paquete compartido.
 *
 * `PasoPrograma` describe una ficha colocada en la barra. Es del cliente porque
 * el servidor nunca ve fichas: recibe acciones ya ejecutadas.
 */
import type { ClaseFicha } from '@/components/FichaComando.vue';

export interface PasoPrograma {
  readonly id: string;
  readonly comando: ClaseFicha;
  /** Repeticiones de un bucle. */
  readonly veces?: number;
  /** Color que dispara un condicional. */
  readonly color?: string;
  /** Fichas anidadas dentro de un bucle, un condicional o una función. */
  readonly hijos?: readonly PasoPrograma[];
  /** Rama alternativa de un condicional si / si no. */
  readonly sino?: readonly PasoPrograma[];
}
