<script setup lang="ts">
/**
 * Una actividad jugable de principio a fin.
 *
 * Es la pantalla donde converge todo lo construido: el lienzo isométrico, la
 * barra de fichas, el sandbox, la voz y la puntuación del servidor.
 *
 * La secuencia está pensada para un niño que no lee:
 *  1. Al entrar se narra la instrucción sin que haya que pulsar nada.
 *  2. El botón verde de jugar es el único elemento que llama la atención.
 *  3. Si falla, el Fuzz choca de forma cómica y se le anima a probar otra vez.
 *     Nunca aparece un mensaje de error en rojo, ni la palabra "incorrecto".
 *  4. Si acierta, primero ve a su Fuzz llegar, y después las estrellas.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { ActivityConfigV3 } from '@codenest/shared';

import BarraPrograma from '@/components/BarraPrograma.vue';
import BotonEscuchar from '@/components/BotonEscuchar.vue';
import BotonJuguete from '@/components/BotonJuguete.vue';
import PanelEstrellas from '@/components/PanelEstrellas.vue';
import type { ClaseFicha } from '@/components/FichaComando.vue';
import { useEjecutor } from '@/composables/useEjecutor';
import { compilarFichas } from '@/game/compilarFichas';
import { IsoRenderer } from '@/game/IsoRenderer';
import type { PasoPrograma } from '@/game/tipos';
import { api } from '@/api/cliente';
import { useAudioStore } from '@/stores/audio';

interface Actividad {
  readonly id: number;
  readonly nombre: string;
  readonly instruccionTexto: string;
  readonly exitoTexto: string;
  readonly config: ActivityConfigV3;
  readonly mundo: { readonly numero: number; readonly nombre: string; readonly bioma: string };
  readonly audio: { readonly instruccion: string | null; readonly exito: string | null };
  readonly pistas: readonly { readonly orden: number; readonly texto: string }[];
}

const ruta = useRoute();
const router = useRouter();
const audio = useAudioStore();
const ejecutor = useEjecutor();

const actividad = shallowRef<Actividad | null>(null);
const cargando = ref(true);
const errorCarga = ref<string | null>(null);

const programa = ref<PasoPrograma[]>([]);
const sesionId = ref<number | null>(null);
const estrellas = ref(0);
const completada = ref(false);
const monedasGanadas = ref(0);
const pistaVisible = ref<number | null>(null);

const lienzo = ref<HTMLElement | null>(null);

/** Fichas que esta actividad ha desbloqueado. */
const fichasDisponibles = computed<ClaseFicha[]>(
  () => (actividad.value?.config.comandosPermitidos ?? []) as ClaseFicha[],
);

/** Huecos de la barra: alguno más de los que exige la solución óptima. */
const capacidad = computed(() => {
  const maximo = actividad.value?.config.criteriosEstrella['3'].maxFichas ?? 6;
  return Math.max(6, maximo + 4);
});

const puedeJugar = computed(
  () => programa.value.length > 0 && !ejecutor.ejecutando.value && !cargando.value,
);

async function cargar(): Promise<void> {
  cargando.value = true;
  errorCarga.value = null;

  try {
    const id = Number(ruta.params.id);
    actividad.value = await api.get<Actividad>(`/curriculo/actividades/${id}`);

    const sesion = await api.post<{ sesion: { id: number } }>('/sesiones', {
      actividadId: id,
      editor: 'comandos',
      lenguaje: 'comandos',
    });
    sesionId.value = sesion.sesion.id;

    await montarLienzo();

    // La instrucción se narra sola: el niño no tiene que buscar cómo oírla.
    void audio.narrar(
      actividad.value.config.audio.instruccion,
      actividad.value.instruccionTexto,
    );
    audio.musica(actividad.value.mundo.bioma);
  } catch (error) {
    errorCarga.value = error instanceof Error ? error.message : 'No se pudo cargar la actividad';
  } finally {
    cargando.value = false;
  }
}

async function montarLienzo(): Promise<void> {
  const act = actividad.value;
  if (!act || !lienzo.value) return;

  const renderizador = new IsoRenderer(lienzo.value);
  await renderizador.cargarNivel({
    grid: act.config.grid,
    spawn: act.config.spawn,
    items: act.config.items,
    bioma: act.mundo.bioma,
    colorFuzz: '#1FA2FF',
  });
  ejecutor.renderizador.value = renderizador;
}

/** Ejecuta el programa y envía el resultado al servidor. */
async function jugar(): Promise<void> {
  const act = actividad.value;
  if (!act || !sesionId.value || !puedeJugar.value) return;

  const compilado = compilarFichas(programa.value);
  const tirada = await ejecutor.jugar(compilado.codigo, 'comandos', act.config);

  // Se envía siempre, acierte o falle: los intentos fallidos son el dato más
  // valioso para el panel del docente.
  const resultado = await api.post<{
    estrellas: number;
    monedasGanadas: number;
    verificado: boolean;
  }>(`/sesiones/${sesionId.value}/envio`, {
    codigo: compilado.codigo,
    programa: programa.value,
    acciones: tirada.acciones,
    tamanoPrograma: compilado.tamano,
    tiempoSegundos: 0,
    estructurasUsadas: compilado.estructuras,
    pistasUsadas: pistaVisible.value === null ? 0 : pistaVisible.value + 1,
  });

  estrellas.value = resultado.estrellas;
  monedasGanadas.value = resultado.monedasGanadas;

  if (resultado.estrellas > 0) {
    completada.value = true;
    await ejecutor.celebrar(resultado.estrellas, act.exitoTexto);
  }
}

function reintentar(): void {
  ejecutor.reiniciar();
  estrellas.value = 0;
  completada.value = false;
}

function mostrarPista(): void {
  const pistas = actividad.value?.pistas ?? [];
  if (pistas.length === 0) return;

  const siguiente = pistaVisible.value === null ? 0 : Math.min(pistaVisible.value + 1, pistas.length - 1);
  pistaVisible.value = siguiente;

  const pista = pistas[siguiente];
  if (pista) {
    void audio.narrar(
      actividad.value?.config.audio.pistas[siguiente] ?? 'ui_pista',
      pista.texto,
    );
  }
}

function volverAlMapa(): void {
  void router.push('/mapa');
}

onMounted(cargar);
onBeforeUnmount(() => {
  ejecutor.destruir();
  audio.detenerMusica();
});
</script>

<template>
  <main class="actividad">
    <!-- Cabecera mínima: volver, oír otra vez, pedir pista -->
    <header class="actividad__cabecera">
      <BotonJuguete
        etiqueta="Volver al mapa"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="volverAlMapa"
      />
      <h1 class="actividad__titulo">{{ actividad?.nombre ?? 'Cargando' }}</h1>
      <div class="actividad__acciones">
        <BotonEscuchar />
        <BotonJuguete
          v-if="(actividad?.pistas.length ?? 0) > 0"
          etiqueta="Pedir una pista"
          icono="💡"
          tono="amarillo"
          solo-icono
          @pulsar="mostrarPista"
        />
      </div>
    </header>

    <p v-if="errorCarga" class="aviso">{{ errorCarga }}</p>

    <!-- Lienzo del juego -->
    <div ref="lienzo" class="actividad__lienzo" />

    <!-- Pista, si se ha pedido -->
    <Transition name="subir">
      <p v-if="pistaVisible !== null && actividad" class="pista">
        <span aria-hidden="true">💡</span>
        {{ actividad.pistas[pistaVisible]?.texto }}
      </p>
    </Transition>

    <!-- Programa -->
    <BarraPrograma
      v-if="actividad"
      v-model="programa"
      :disponibles="fichasDisponibles"
      :capacidad="capacidad"
      :ejecutando="ejecutor.pasoActual.value"
      :bloqueada="ejecutor.ejecutando.value"
    />

    <div class="actividad__controles">
      <BotonJuguete
        etiqueta="Jugar"
        icono="▶"
        tono="verde"
        tamano="lg"
        :destacado="puedeJugar"
        :deshabilitado="!puedeJugar"
        @pulsar="jugar"
      />
      <BotonJuguete
        etiqueta="Empezar de nuevo"
        icono="↺"
        tono="neutro"
        :deshabilitado="ejecutor.ejecutando.value"
        @pulsar="reintentar"
      />
    </div>

    <!-- Celebración -->
    <Transition name="aparecer">
      <div v-if="completada" class="celebracion" role="dialog" aria-live="polite">
        <div class="celebracion__panel">
          <PanelEstrellas :conseguidas="estrellas" :tamano="72" />
          <p class="celebracion__texto">{{ actividad?.exitoTexto }}</p>
          <p v-if="monedasGanadas > 0" class="celebracion__monedas">
            <span aria-hidden="true">🪙</span> {{ monedasGanadas }}
          </p>
          <div class="celebracion__botones">
            <BotonJuguete
              v-if="estrellas < 3"
              etiqueta="Intentar las 3 estrellas"
              tono="amarillo"
              @pulsar="reintentar"
            />
            <BotonJuguete etiqueta="Seguir" icono="→" tono="verde" tamano="lg" @pulsar="volverAlMapa" />
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.actividad {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
  max-width: 900px;
  min-height: 100vh;
  margin: 0 auto;
  padding: var(--espacio-4);
}

.actividad__cabecera {
  display: flex;
  gap: var(--espacio-3);
  align-items: center;
  justify-content: space-between;
}

.actividad__titulo {
  flex: 1;
  margin: 0;
  font-size: var(--texto-xl);
  text-align: center;
}

.actividad__acciones {
  display: flex;
  gap: var(--espacio-2);
}

.actividad__lienzo {
  display: grid;
  place-items: center;
  min-height: 460px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.45);
  border-radius: var(--radio-xl);
  box-shadow: var(--sombra-panel);
}

.actividad__controles {
  display: flex;
  gap: var(--espacio-4);
  justify-content: center;
}

.pista {
  display: flex;
  gap: var(--espacio-3);
  align-items: center;
  margin: 0;
  padding: var(--espacio-4);
  font-size: var(--texto-base);
  background: rgb(255 217 61 / 0.35);
  border-left: 6px solid var(--amarillo);
  border-radius: var(--radio-md);
}

.aviso {
  padding: var(--espacio-4);
  background: rgb(239 68 68 / 0.12);
  border-radius: var(--radio-md);
}

/* La celebración cubre la pantalla: es el momento importante. */
.celebracion {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--espacio-4);
  background: rgb(30 41 59 / 0.55);
  backdrop-filter: blur(4px);
}

.celebracion__panel {
  display: grid;
  gap: var(--espacio-4);
  justify-items: center;
  max-width: 420px;
  padding: var(--espacio-6);
  text-align: center;
  background: var(--crema);
  border-radius: var(--radio-xl);
  box-shadow: var(--relieve-alto);
}

.celebracion__texto {
  margin: 0;
  font-size: var(--texto-lg);
}

.celebracion__monedas {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  color: var(--naranja-oscuro);
}

.celebracion__botones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-3);
  justify-content: center;
}

.aparecer-enter-active {
  transition: opacity var(--normal) ease;
}
.aparecer-enter-from {
  opacity: 0;
}

.subir-enter-active {
  transition:
    opacity var(--normal) ease,
    transform var(--normal) var(--rebote);
}
.subir-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
</style>
