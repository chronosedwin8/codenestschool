<script setup lang="ts">
/**
 * Las credenciales del grupo.
 *
 * Es la pantalla que se imprime. Por eso tiene estilos de impresion propios: en
 * papel sobran los botones, el fondo y la navegacion, y hace falta que las filas
 * no se partan entre dos hojas.
 *
 * El PIN se muestra con las mismas imagenes que ve el niño al entrar. Escribirlo
 * como "gato, sol, luna, flor" obligaria al docente a traducir cada vez.
 *
 * Cambiar el PIN a todo el grupo es la operacion normal, no la excepcion: se
 * reparte el mismo el primer dia y se cambia cuando alguien lo aprende de
 * memoria y entra en la cuenta de otro.
 */
import { onMounted, ref, watch } from 'vue';

import { api } from '@/api/cliente';

const props = defineProps<{
  aula: { id: number; nombre: string };
  puedeVerPines: boolean;
}>();

interface Credencial {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly activo: boolean;
  readonly pin: readonly string[] | null;
}

const IMAGENES: Record<string, string> = {
  gato: '🐱', sol: '☀️', arbol: '🌳', luna: '🌙', pez: '🐟',
  flor: '🌸', nube: '☁️', tren: '🚂', pato: '🦆',
};
const OPCIONES = Object.keys(IMAGENES);

const credenciales = ref<readonly Credencial[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const trabajando = ref(false);

/** El PIN que se va a poner a todo el grupo, como cuatro imagenes elegidas. */
const nuevoPin = ref<string[]>([]);

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const datos = await api.get<{ credenciales: Credencial[] }>(
      `/docente/aulas/${props.aula.id}/credenciales`,
    );
    credenciales.value = datos.credenciales;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las credenciales';
  } finally {
    cargando.value = false;
  }
}

/** La plantilla no ve `window`, y esto es lo unico que necesita de el. */
function imprimir(): void {
  window.print();
}

function ponerImagen(img: string): void {
  if (nuevoPin.value.length >= 4) nuevoPin.value = [];
  nuevoPin.value = [...nuevoPin.value, img];
}

async function aplicar(mismo: boolean): Promise<void> {
  if (trabajando.value) return;
  if (mismo && nuevoPin.value.length !== 4) return;

  const aviso = mismo
    ? `Poner el mismo PIN a los ${credenciales.value.length} estudiantes de ${props.aula.nombre}.`
    : `Dar un PIN distinto y al azar a cada uno de los ${credenciales.value.length} estudiantes.`;
  if (!window.confirm(`${aviso}\n\nEl PIN anterior dejara de funcionar.`)) return;

  trabajando.value = true;
  error.value = null;
  try {
    await api.post(`/docente/aulas/${props.aula.id}/pines`, mismo ? { pin: nuevoPin.value } : {});
    nuevoPin.value = [];
    await cargar();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cambiar los PIN';
  } finally {
    trabajando.value = false;
  }
}

watch(() => props.aula.id, () => void cargar());
onMounted(() => void cargar());
</script>

<template>
  <div>
    <section class="panel">
      <div class="cabecera">
        <h2>Credenciales de {{ aula.nombre }}</h2>
        <button type="button" class="mini-boton no-imprimir" @click="imprimir">
          Imprimir
        </button>
      </div>

      <p v-if="error" class="aviso aviso--grave">{{ error }}</p>
      <p v-if="!puedeVerPines" class="aviso aviso--aviso no-imprimir">
        Este servidor no guarda los PIN de forma consultable. Para conocerlos, asigna
        uno nuevo abajo.
      </p>

      <p v-if="cargando" class="vacio">Cargando...</p>
      <p v-else-if="credenciales.length === 0" class="vacio">Este grupo no tiene estudiantes.</p>

      <table v-else class="tabla">
        <thead>
          <tr><th>Nombre</th><th>Usuario</th><th>PIN</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in credenciales" :key="c.id" :class="{ 'fila--inactiva': !c.activo }">
            <td>{{ c.nombre }}</td>
            <td class="mono">{{ c.usuario }}</td>
            <td class="pin">
              <template v-if="c.pin">
                <span v-for="(img, i) in c.pin" :key="i" :title="img">{{ IMAGENES[img] ?? img }}</span>
              </template>
              <span v-else class="sin-pin">no disponible</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel no-imprimir">
      <h2>Cambiar el PIN de todo el grupo</h2>
      <p class="nota">
        Elige cuatro imagenes en orden. Es lo que se escribe en la pizarra el primer
        dia; para eso esta pensado.
      </p>

      <div class="elegir">
        <button
          v-for="img in OPCIONES"
          :key="img"
          type="button"
          class="imagen"
          :title="img"
          @click="ponerImagen(img)"
        >
          {{ IMAGENES[img] }}
        </button>
      </div>

      <div class="elegido">
        <span v-for="i in 4" :key="i" class="hueco">
          {{ nuevoPin[i - 1] ? IMAGENES[nuevoPin[i - 1]!] : '' }}
        </span>
        <button type="button" class="mini-boton" @click="nuevoPin = []">Borrar</button>
      </div>

      <div class="acciones">
        <button
          type="button" class="boton"
          :disabled="trabajando || nuevoPin.length !== 4 || credenciales.length === 0"
          @click="aplicar(true)"
        >
          Poner este PIN a los {{ credenciales.length }}
        </button>
        <button
          type="button" class="boton boton--suave"
          :disabled="trabajando || credenciales.length === 0"
          @click="aplicar(false)"
        >
          Uno distinto al azar para cada uno
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 18px;
}

.cabecera { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.panel h2 { margin: 0 0 10px; font-family: var(--fuente-titulo); font-size: 18px; }
.nota { margin: 0 0 10px; color: #64748b; font-size: 13px; }
.vacio { color: #94a3b8; margin: 0; }

.tabla { width: 100%; border-collapse: collapse; font-size: 15px; }
.tabla th, .tabla td { text-align: left; padding: 8px; border-bottom: 1px solid #f1f5f9; }
.tabla th { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }

.mono { font-family: ui-monospace, monospace; }
.pin { font-size: 24px; letter-spacing: 4px; }
.sin-pin { font-size: 13px; color: #94a3b8; letter-spacing: normal; }
.fila--inactiva { opacity: 0.5; }

.elegir { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

.imagen {
  width: 46px;
  height: 46px;
  font-size: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
}

.elegido { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }

.hueco {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  font-size: 24px;
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
}

.acciones { display: flex; gap: 10px; flex-wrap: wrap; }

.boton {
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  background: #1fa2ff;
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.boton--suave { background: #64748b; }
.boton:disabled { background: #cbd5e1; cursor: not-allowed; }

.mini-boton {
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.aviso { padding: 9px 12px; border-radius: 10px; margin: 0 0 12px; }
.aviso--grave { background: #fee2e2; border: 1px solid #fca5a5; }
.aviso--aviso { background: #fef9c3; border: 1px solid #fde047; }

/*
 * En papel sobra todo lo que no sea la lista, y ninguna fila debe partirse entre
 * dos hojas: buscar la mitad de un nombre en la pagina siguiente es exactamente
 * lo que hace que un docente deje de usar una herramienta.
 */
@media print {
  .no-imprimir { display: none !important; }

  .panel {
    border: 0;
    padding: 0;
    margin: 0;
  }

  .tabla { font-size: 13pt; }
  .tabla tr { page-break-inside: avoid; }
  .pin { font-size: 20pt; }
}
</style>
