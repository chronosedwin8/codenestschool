<script setup lang="ts">
/**
 * El mapa de mundos.
 *
 * Es la pantalla a la que el niño vuelve después de cada actividad, así que
 * tiene que responder a una pregunta de un vistazo: qué puedo jugar ahora.
 *
 * Los mundos cerrados se ven, pero con candado. Mostrarlos en lugar de
 * esconderlos es intencional: saber que hay diez mundos más adelante es parte de
 * lo que motiva a terminar el actual.
 */
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { GRUPO_EDAD_LABEL, type GrupoEdad } from '@codenest/shared';
import { APERTURA, FUZZ_POR_MUNDO, HISTORIA_POR_MUNDO } from '@codenest/content';

import BotonEscuchar from '@/components/BotonEscuchar.vue';
import BotonJuguete from '@/components/BotonJuguete.vue';
import Cinematica from '@/components/Cinematica.vue';
import FuzzAvatar from '@/components/FuzzAvatar.vue';
import { CLAVE_APERTURA, claveEntrada, yaSeVio } from '@/composables/cinematicas';
import { api } from '@/api/cliente';
import { useAudioStore } from '@/stores/audio';
import { useTiendaStore } from '@/stores/tienda';

interface Mundo {
  readonly numero: number;
  readonly nombre: string;
  readonly grupoEdad: GrupoEdad;
  readonly concepto: string;
  readonly icono: string;
  readonly colorPrimario: string;
  readonly colorSecundario: string;
  readonly totalActividades: number;
  readonly actividadesCompletadas: number;
  readonly estrellas: number;
  readonly estrellasMaximas: number;
  readonly desbloqueado: boolean;
}

interface Actividad {
  readonly id: number;
  readonly numeroEnMundo: number;
  readonly nombre: string;
  readonly estrellas: number;
  readonly completada: boolean;
  readonly desbloqueada: boolean;
}

const audio = useAudioStore();
const tienda = useTiendaStore();

const mundos = ref<Mundo[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);

const mundoAbierto = ref<number | null>(null);
const actividades = ref<Actividad[]>([]);
const cargandoActividades = ref(false);

/**
 * Cinematica en curso.
 *
 * La historia es lo que da sentido al mapa: cada mundo tiene un Fuzz perdido, y
 * el Nido se llena a medida que se rescatan. Sin ella, el mapa es una lista de
 * niveles; con ella, es un viaje.
 */
const cinematica = ref<{
  beats: readonly typeof APERTURA.beats[number][];
  clave: string;
  colorFuzz: string;
} | null>(null);

/** Cuantos Fuzzes se han rescatado ya: es lo que se ve en el Nido. */
const fuzzesRescatados = computed(
  () =>
    mundos.value.filter(
      (m) => m.totalActividades > 0 && m.actividadesCompletadas === m.totalActividades,
    ).length,
);

/** Mundos agrupados por edad, en el orden del catálogo. */
const porGrupo = computed(() => {
  const grupos = new Map<GrupoEdad, Mundo[]>();
  for (const mundo of mundos.value) {
    const lista = grupos.get(mundo.grupoEdad) ?? [];
    lista.push(mundo);
    grupos.set(mundo.grupoEdad, lista);
  }
  return [...grupos.entries()];
});

const estrellasTotales = computed(() =>
  mundos.value.reduce((suma, m) => suma + m.estrellas, 0),
);

async function cargar(): Promise<void> {
  cargando.value = true;
  // Lo comprado en la tienda se dibuja aqui tambien: el mapa es la primera cosa
  // que ve al entrar, y es donde quiere reconocer a su Fuzz.
  void tienda.cargar();
  try {
    const datos = await api.get<{ mundos: Mundo[] }>('/curriculo/mundos');
    mundos.value = datos.mundos;

    // La apertura solo la primera vez: explica por que el Nido esta vacio.
    if (!yaSeVio(CLAVE_APERTURA)) {
      cinematica.value = {
        beats: APERTURA.beats,
        clave: CLAVE_APERTURA,
        colorFuzz: '#29A9E0',
      };
      return;
    }

    void audio.narrar('ui_elige-mundo', 'Toca un mundo para empezar tu aventura.');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el mapa';
  } finally {
    cargando.value = false;
  }
}

async function abrirMundo(mundo: Mundo): Promise<void> {
  if (!mundo.desbloqueado) {
    void audio.narrar(
      'ui_mundo-bloqueado',
      'Este mundo todavia esta cerrado. Termina el anterior para abrirlo.',
    );
    audio.efecto('choque');
    return;
  }

  // Volver a tocar el mismo mundo lo cierra.
  if (mundoAbierto.value === mundo.numero) {
    mundoAbierto.value = null;
    return;
  }

  // La cinematica de entrada presenta al Fuzz perdido de ese mundo y su
  // mecanica, sin decir una sola instruccion tecnica.
  const historia = HISTORIA_POR_MUNDO.get(mundo.numero);
  const fuzz = FUZZ_POR_MUNDO.get(mundo.numero);
  if (historia && fuzz && !yaSeVio(claveEntrada(mundo.numero))) {
    cinematica.value = {
      beats: historia.entrada,
      clave: claveEntrada(mundo.numero),
      colorFuzz: fuzz.color,
    };
  }

  mundoAbierto.value = mundo.numero;
  cargandoActividades.value = true;
  actividades.value = [];

  try {
    const datos = await api.get<{ actividades: Actividad[] }>(
      `/curriculo/mundos/${mundo.numero}/actividades`,
    );
    actividades.value = datos.actividades;
  } finally {
    cargandoActividades.value = false;
  }
}

function alTerminarCinematica(): void {
  cinematica.value = null;
}

onMounted(cargar);
</script>

<template>
  <main class="mapa">
    <!-- La historia va por encima del mapa y se ve una sola vez. -->
    <Cinematica
      v-if="cinematica"
      :key="cinematica.clave"
      :beats="cinematica.beats"
      :color-fuzz="cinematica.colorFuzz"
      :rescatados="fuzzesRescatados"
      :recordar-como="cinematica.clave"
      @terminada="alTerminarCinematica"
    />

    <header class="mapa__cabecera">
      <FuzzAvatar
        :tamano="80"
        expresion="feliz"
        :mirar="false"
        :color="tienda.colorFuzz"
        :sombrero="tienda.adornos.sombrero"
        :gafas="tienda.adornos.gafas"
        :accesorio="tienda.adornos.accesorio"
        :disfraz="tienda.adornos.disfraz"
      />
      <div>
        <h1>Elige tu aventura</h1>
        <p class="mapa__resumen">
          <span aria-hidden="true">⭐</span> {{ estrellasTotales }} estrellas
          <span v-if="tienda.cargada" class="mapa__gastables">
            · {{ tienda.estrellasDisponibles }} para gastar
          </span>
        </p>
      </div>
      <div class="mapa__acciones">
        <!-- El taller de juegos: crear es lo que mas engancha, va primero. -->
        <BotonJuguete
          etiqueta="Hacer mis juegos"
          icono="🛠️"
          tono="verde"
          solo-icono
          @pulsar="$router.push('/proyectos')"
        />
        <BotonJuguete
          etiqueta="Jugar los juegos de todos"
          icono="🕹️"
          tono="morado"
          solo-icono
          @pulsar="$router.push('/juegos')"
        />
        <!-- La tienda. Va junto a las estrellas porque es donde se gastan. -->
        <BotonJuguete
          etiqueta="Ir a la tienda"
          icono="🛒"
          tono="magenta"
          solo-icono
          @pulsar="$router.push('/tienda')"
        />
        <!-- Sus datos. Va aqui porque el mapa es su casa dentro del juego. -->
        <BotonJuguete
          etiqueta="Ver lo que llevas hecho"
          icono="📊"
          tono="amarillo"
          solo-icono
          @pulsar="$router.push('/mis-datos')"
        />
        <BotonEscuchar />
        <BotonJuguete
          :etiqueta="audio.silenciado ? 'Activar sonido' : 'Silenciar'"
          :icono="audio.silenciado ? '🔇' : '🔊'"
          tono="neutro"
          solo-icono
          @pulsar="audio.alternarSilencio()"
        />
      </div>
    </header>

    <p v-if="error" class="aviso">{{ error }}</p>
    <p v-else-if="cargando" class="aviso">Cargando tus mundos...</p>

    <section v-for="[grupo, lista] in porGrupo" :key="grupo" class="grupo">
      <h2 class="grupo__titulo">{{ GRUPO_EDAD_LABEL[grupo] }}</h2>

      <div class="senda">
        <template v-for="(mundo, i) in lista" :key="mundo.numero">
          <!-- El camino entre nodos se ilumina si el siguiente está abierto. -->
          <span
            v-if="i > 0"
            class="senda__tramo"
            :class="{ 'senda__tramo--abierto': mundo.desbloqueado }"
            aria-hidden="true"
          />

          <button
            type="button"
            class="nodo"
            :class="{
              'nodo--cerrado': !mundo.desbloqueado,
              'nodo--abierto': mundoAbierto === mundo.numero,
              'nodo--completo': mundo.totalActividades > 0 && mundo.actividadesCompletadas === mundo.totalActividades,
            }"
            :style="{ '--nodo-color': mundo.colorPrimario, '--nodo-color2': mundo.colorSecundario }"
            :aria-label="`Mundo ${mundo.numero}: ${mundo.nombre}. ${mundo.desbloqueado ? 'Abierto' : 'Cerrado'}`"
            @click="abrirMundo(mundo)"
          >
            <span class="nodo__numero">{{ mundo.numero }}</span>
            <span v-if="!mundo.desbloqueado" class="nodo__candado" aria-hidden="true">🔒</span>
            <span v-else-if="mundo.estrellas > 0" class="nodo__estrellas">
              {{ mundo.estrellas }}<span aria-hidden="true">⭐</span>
            </span>
          </button>
        </template>
      </div>

      <!-- Panel de actividades del mundo abierto -->
      <Transition name="desplegar">
        <div v-if="mundoAbierto && lista.some((m) => m.numero === mundoAbierto)" class="panel">
          <h3 class="panel__titulo">
            {{ lista.find((m) => m.numero === mundoAbierto)?.nombre }}
          </h3>
          <p class="panel__concepto">
            {{ lista.find((m) => m.numero === mundoAbierto)?.concepto }}
          </p>

          <p v-if="cargandoActividades" class="aviso">Cargando actividades...</p>
          <p v-else-if="actividades.length === 0" class="aviso">
            Las actividades de este mundo estan en preparacion.
          </p>

          <div v-else class="panel__actividades">
            <RouterLink
              v-for="act in actividades"
              :key="act.id"
              :to="act.desbloqueada ? `/actividad/${act.id}` : ''"
              class="tarjeta-act"
              :class="{ 'tarjeta-act--cerrada': !act.desbloqueada }"
              :aria-disabled="!act.desbloqueada"
            >
              <span class="tarjeta-act__numero">{{ act.numeroEnMundo }}</span>
              <span class="tarjeta-act__nombre">{{ act.nombre }}</span>
              <span v-if="!act.desbloqueada" aria-hidden="true">🔒</span>
              <span v-else-if="act.estrellas > 0" class="tarjeta-act__estrellas">
                {{ '⭐'.repeat(act.estrellas) }}
              </span>
            </RouterLink>
          </div>
        </div>
      </Transition>
    </section>
  </main>
</template>

<style scoped>
.mapa {
  max-width: 980px;
  margin: 0 auto;
  padding: var(--espacio-5) var(--espacio-4) var(--espacio-8);
}

.mapa__cabecera {
  display: flex;
  gap: var(--espacio-4);
  align-items: center;
  margin-bottom: var(--espacio-6);
}

.mapa__cabecera h1 {
  margin: 0;
  font-size: var(--texto-2xl);
}

.mapa__gastables {
  color: var(--magenta, #ff3cac);
  white-space: nowrap;
}

.mapa__resumen {
  margin: 0;
  font-size: var(--texto-lg);
  color: var(--naranja-oscuro);
}

.mapa__acciones {
  display: flex;
  gap: var(--espacio-2);
  margin-left: auto;
}

.grupo {
  margin-bottom: var(--espacio-8);
}

.grupo__titulo {
  margin-bottom: var(--espacio-4);
  font-size: var(--texto-xl);
  color: var(--gris-oscuro);
}

/* La senda: nodos unidos por tramos, como un mapa de aventuras. */
.senda {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-1);
  align-items: center;
}

.senda__tramo {
  width: 26px;
  height: 8px;
  background: rgb(148 163 184 / 0.4);
  border-radius: var(--radio-total);
}

.senda__tramo--abierto {
  background: var(--amarillo);
}

.nodo {
  position: relative;
  display: grid;
  place-items: center;

  width: 84px;
  height: 84px;

  background: linear-gradient(150deg, var(--nodo-color), var(--nodo-color2));
  border: 4px solid white;
  border-radius: var(--radio-total);
  box-shadow: var(--relieve);

  transition:
    transform var(--rapido) var(--rebote),
    box-shadow var(--rapido) ease;
}

.nodo:hover:not(.nodo--cerrado) {
  transform: translateY(-4px) scale(1.06);
}

.nodo:active {
  transform: translateY(4px);
  box-shadow: none;
}

.nodo--cerrado {
  filter: grayscale(0.85);
  opacity: 0.6;
}

.nodo--abierto {
  box-shadow:
    0 0 0 5px var(--amarillo),
    var(--relieve);
}

.nodo--completo::after {
  content: '👑';
  position: absolute;
  top: -14px;
  font-size: 22px;
}

.nodo__numero {
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  color: white;
  text-shadow: 0 2px 4px rgb(0 0 0 / 0.3);
}

.nodo__candado {
  position: absolute;
  bottom: -6px;
  font-size: 20px;
}

.nodo__estrellas {
  position: absolute;
  right: -8px;
  bottom: -8px;
  padding: 2px 8px;
  font-size: var(--texto-xs);
  color: var(--tinta);
  background: var(--amarillo);
  border: 3px solid white;
  border-radius: var(--radio-total);
}

.panel {
  margin-top: var(--espacio-5);
  padding: var(--espacio-5);
  background: rgb(255 255 255 / 0.72);
  border-radius: var(--radio-xl);
  box-shadow: var(--sombra-panel);
}

.panel__titulo {
  margin: 0;
}

.panel__concepto {
  margin: 0 0 var(--espacio-4);
  color: var(--gris-oscuro);
}

.panel__actividades {
  display: grid;
  gap: var(--espacio-3);
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
}

.tarjeta-act {
  display: flex;
  gap: var(--espacio-3);
  align-items: center;
  min-height: var(--toque-min);
  padding: var(--espacio-3);

  font-size: var(--texto-sm);
  color: var(--tinta);
  text-decoration: none;

  background: white;
  border-bottom: 4px solid var(--gris-claro);
  border-radius: var(--radio-md);
  box-shadow: 0 3px 8px rgb(0 0 0 / 0.08);
}

.tarjeta-act:hover:not(.tarjeta-act--cerrada) {
  border-bottom-color: var(--verde-cesped);
}

.tarjeta-act--cerrada {
  pointer-events: none;
  filter: grayscale(0.7);
  opacity: 0.6;
}

.tarjeta-act__numero {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  font-family: var(--fuente-titulo);
  color: white;
  background: var(--azul-neon);
  border-radius: var(--radio-total);
}

.tarjeta-act__nombre {
  flex: 1;
}

.tarjeta-act__estrellas {
  font-size: var(--texto-xs);
}

.aviso {
  padding: var(--espacio-4);
  color: var(--gris-oscuro);
}

.desplegar-enter-active,
.desplegar-leave-active {
  transition:
    opacity var(--normal) ease,
    transform var(--normal) var(--rebote);
}
.desplegar-enter-from,
.desplegar-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
