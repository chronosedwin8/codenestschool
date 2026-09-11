<script setup lang="ts">
/**
 * Los datos del niño, para el niño.
 *
 * No es el panel del docente en pequeño. Cambia quién mira y por tanto cambia
 * todo:
 *
 *  - Números grandes y pocos. Un niño de seis años no lee una tabla, lee una
 *    cifra enorme con un icono al lado.
 *  - Todo lo que se enseña es algo que él hizo. Nada de lo que le falta
 *    presentado como deuda: las actividades que no ha tocado no son un fallo
 *    suyo, son el camino que le queda.
 *  - Los porcentajes y el puesto en el grupo solo aparecen a partir de los siete
 *    años. A un prelector "12,5 %" no le dice nada, y "vas el último de
 *    veinticinco" le dice algo que no necesita saber.
 *
 * La página se narra igual que el resto del juego, porque el más pequeño de los
 * que llegan aquí todavía no lee.
 */
import { computed, onMounted, ref } from 'vue';

import { api } from '@/api/cliente';
import BotonJuguete from '@/components/BotonJuguete.vue';
import { useAudioStore } from '@/stores/audio';
import { useRouter } from 'vue-router';

interface MisDatos {
  readonly actividades: {
    readonly completadas: number;
    readonly empezadasSinTerminar: number;
    readonly totales: number;
    readonly porcentajeCompletado: number;
  };
  readonly mundos: {
    readonly completados: number;
    readonly totales: number;
    readonly enCurso: {
      readonly numero: number;
      readonly nombre: string;
      readonly completadas: number;
      readonly actividades: number;
    } | null;
  };
  readonly estrellas: {
    readonly ganadas: number;
    readonly posiblesDeLoJugado: number;
    readonly perfectas: number;
  };
  readonly monedas: number;
  readonly rachaDias: number;
  readonly tiempo: {
    readonly totalMinutos: number;
    readonly medioPorActividadSegundos: number;
  };
  readonly grupo: {
    readonly nombre: string;
    readonly posicion: number;
    readonly companeros: number;
  } | null;
}

const router = useRouter();
const audio = useAudioStore();

const datos = ref<MisDatos | null>(null);
const cargando = ref(true);
const error = ref<string | null>(null);
/** El grupo de edad decide cuánto detalle se enseña. */
const grupoEdad = ref<string>('exploradores');

const esPrelector = computed(() => grupoEdad.value === 'exploradores');

/** Cuánto de lo jugado salió perfecto. Se mide contra lo suyo, no contra 600. */
const porcentajeDeExcelencia = computed(() => {
  const e = datos.value?.estrellas;
  if (!e || e.posiblesDeLoJugado === 0) return 0;
  return Math.round((e.ganadas / e.posiblesDeLoJugado) * 100);
});

const tiempoLegible = computed(() => {
  const m = datos.value?.tiempo.totalMinutos ?? 0;
  if (m === 1) return '1 minuto';
  if (m < 60) return `${m} minutos`;
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  if (resto === 0) return horas === 1 ? '1 hora' : `${horas} horas`;
  return `${horas} h ${resto} min`;
});

/**
 * La media por actividad, en la unidad que toca.
 *
 * Redondear siempre a minutos convertia cuarenta segundos en "0 min", que es
 * decirle a un nino que lo que hizo no duro nada.
 */
const mediaLegible = computed(() => {
  const s = datos.value?.tiempo.medioPorActividadSegundos ?? 0;
  if (s < 60) return `${s} segundos`;
  const min = Math.round(s / 60);
  return min === 1 ? '1 minuto' : `${min} minutos`;
});

/**
 * Frase que resume el puesto, o nada si todavía no significa nada.
 *
 * A quien aún no ha resuelto ninguna actividad no se le dice que va el último:
 * no es que vaya perdiendo, es que no ha empezado, y son dos cosas distintas.
 * Aparece en cuanto tiene algo hecho, que es cuando el puesto informa de verdad.
 */
const fraseDelGrupo = computed(() => {
  const g = datos.value?.grupo;
  const hechas = datos.value?.actividades.completadas ?? 0;
  if (!g || g.companeros < 2 || hechas === 0) return null;
  if (g.posicion === 1) return `Vas el primero de ${g.companeros} en ${g.nombre}`;
  return `Vas el ${g.posicion}.º de ${g.companeros} en ${g.nombre}`;
});

async function cargar(): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    const [mios, yo] = await Promise.all([
      api.get<MisDatos>('/progreso/mio'),
      api.get<{ grupoEdad?: string }>('/auth/yo'),
    ]);
    datos.value = mios;
    grupoEdad.value = yo.grupoEdad ?? 'exploradores';

    // Se narra al entrar: el que menos lee es el que más lo necesita. La frase
    // es fija y no lleva números porque la voz es grabada, no sintetizada: un
    // texto con cifras variables no tendría clip que reproducir.
    void audio.narrar('ui_mis-datos', 'Mira todo lo que llevas hecho.');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar tus datos';
  } finally {
    cargando.value = false;
  }
}

onMounted(() => void cargar());
</script>

<template>
  <main class="datos">
    <header class="datos__cabecera">
      <BotonJuguete
        etiqueta="Volver al mapa"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/mapa')"
      />
      <h1>Lo que llevas hecho</h1>
      <span class="datos__hueco" aria-hidden="true" />
    </header>

    <p v-if="error" class="aviso">{{ error }}</p>
    <p v-else-if="cargando" class="cargando">Un momento...</p>

    <template v-else-if="datos">
      <!-- Lo grande: lo que consiguió. Un icono y una cifra, nada más. -->
      <section class="tarjetas">
        <div class="tarjeta tarjeta--estrellas">
          <span class="tarjeta__icono" aria-hidden="true">⭐</span>
          <strong class="tarjeta__cifra">{{ datos.estrellas.ganadas }}</strong>
          <span class="tarjeta__que">estrellas</span>
        </div>

        <div class="tarjeta tarjeta--actividades">
          <span class="tarjeta__icono" aria-hidden="true">🧩</span>
          <strong class="tarjeta__cifra">{{ datos.actividades.completadas }}</strong>
          <span class="tarjeta__que">actividades resueltas</span>
        </div>

        <div class="tarjeta tarjeta--mundos">
          <span class="tarjeta__icono" aria-hidden="true">🌍</span>
          <strong class="tarjeta__cifra">{{ datos.mundos.completados }}</strong>
          <span class="tarjeta__que">mundos terminados</span>
        </div>

        <div class="tarjeta tarjeta--monedas">
          <span class="tarjeta__icono" aria-hidden="true">🪙</span>
          <strong class="tarjeta__cifra">{{ datos.monedas }}</strong>
          <span class="tarjeta__que">monedas</span>
        </div>
      </section>

      <!-- Dónde está ahora. Es lo que más le interesa: qué sigue. -->
      <section v-if="datos.mundos.enCurso" class="panel">
        <h2>Ahora estás en</h2>
        <p class="enCurso">
          <strong>{{ datos.mundos.enCurso.nombre }}</strong>
          <span class="enCurso__cuenta">
            {{ datos.mundos.enCurso.completadas }} de {{ datos.mundos.enCurso.actividades }}
          </span>
        </p>
        <div class="barra">
          <span
            class="barra__relleno"
            :style="{
              width: `${Math.round((datos.mundos.enCurso.completadas / datos.mundos.enCurso.actividades) * 100)}%`,
            }"
          />
        </div>
      </section>

      <!-- El detalle solo para quien ya lee y entiende un porcentaje. -->
      <section v-if="!esPrelector" class="panel">
        <h2>Tus números</h2>
        <ul class="detalle">
          <li>
            <span>Del juego entero llevas</span>
            <strong>{{ datos.actividades.porcentajeCompletado }} %</strong>
          </li>
          <li>
            <span>De lo que jugaste, con las tres estrellas</span>
            <strong>{{ porcentajeDeExcelencia }} %</strong>
          </li>
          <li>
            <span>Actividades perfectas</span>
            <strong>{{ datos.estrellas.perfectas }}</strong>
          </li>
          <li v-if="datos.actividades.empezadasSinTerminar > 0">
            <span>Empezadas y aún sin resolver</span>
            <strong>{{ datos.actividades.empezadasSinTerminar }}</strong>
          </li>
          <li>
            <span>Tiempo jugado</span>
            <strong>{{ tiempoLegible }}</strong>
          </li>
          <li v-if="datos.tiempo.medioPorActividadSegundos > 0">
            <span>Media por actividad</span>
            <strong>{{ mediaLegible }}</strong>
          </li>
          <li v-if="datos.rachaDias > 1">
            <span>Días seguidos jugando</span>
            <strong>{{ datos.rachaDias }}</strong>
          </li>
        </ul>
      </section>

      <!--
        El puesto en el grupo, solo a partir de los siete años. A un prelector no
        le aporta nada y a cualquiera le puede doler: por eso va al final, en
        pequeño, y sin decir quién va delante.
      -->
      <section v-if="!esPrelector && fraseDelGrupo" class="panel panel--grupo">
        <h2>En tu grupo</h2>
        <p class="grupo">{{ fraseDelGrupo }}</p>
        <p class="grupo__nota">
          Lo que cuenta es cuánto has avanzado tú, no contra quién.
        </p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.datos {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 16px 56px;
}

.datos__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.datos__cabecera h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  text-align: center;
}

/* Hueco del mismo tamaño que el botón, para que el título quede centrado. */
.datos__hueco {
  width: 56px;
}

.tarjetas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.tarjeta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 18px 12px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
}

.tarjeta__icono {
  font-size: 34px;
  line-height: 1;
}

.tarjeta__cifra {
  font-family: var(--fuente-titulo);
  font-size: 40px;
  line-height: 1.1;
  color: var(--tinta);
}

.tarjeta__que {
  font-size: var(--texto-sm);
  color: #64748b;
  text-align: center;
}

.tarjeta--estrellas { background: #fffbea; }
.tarjeta--actividades { background: #eff8ff; }
.tarjeta--mundos { background: #f0fdf4; }
.tarjeta--monedas { background: #fff4e6; }

.panel {
  background: #fff;
  border-radius: 18px;
  padding: 16px 20px;
  margin-bottom: 14px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.06);
}

.panel h2 {
  margin: 0 0 10px;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.enCurso {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 8px;
  font-size: var(--texto-lg);
}

.enCurso__cuenta {
  color: #64748b;
  font-size: var(--texto-base);
  white-space: nowrap;
}

.barra {
  height: 14px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.barra__relleno {
  display: block;
  height: 100%;
  background: var(--verde-cesped, #5ad35a);
  transition: width 600ms ease;
}

.detalle {
  list-style: none;
  margin: 0;
  padding: 0;
}

.detalle li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid #f1f5f9;
}

.detalle li:last-child { border-bottom: 0; }

.detalle strong {
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.panel--grupo { background: #f8fafc; }

.grupo {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.grupo__nota {
  margin: 6px 0 0;
  font-size: var(--texto-sm);
  color: #64748b;
}

.aviso,
.cargando {
  text-align: center;
  color: #64748b;
}

@media (max-width: 480px) {
  .tarjeta__cifra { font-size: 32px; }
}
</style>
