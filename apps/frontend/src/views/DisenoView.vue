<script setup lang="ts">
/**
 * Página de muestra del sistema de diseño.
 *
 * Sirve para revisar todos los componentes juntos, probar el arrastre en una
 * tableta real y comprobar el respaldo de voz sin tener que jugar una actividad.
 * No forma parte del producto: es la herramienta con la que se valida que la
 * interfaz funciona antes de montar el juego encima.
 */
import { ref } from 'vue';

import BarraPrograma from '@/components/BarraPrograma.vue';
import BotonEscuchar from '@/components/BotonEscuchar.vue';
import BotonJuguete from '@/components/BotonJuguete.vue';
import FichaComando, { type ClaseFicha } from '@/components/FichaComando.vue';
import type { PasoPrograma } from '@/game/tipos';
import FuzzAvatar from '@/components/FuzzAvatar.vue';
import PanelEstrellas from '@/components/PanelEstrellas.vue';
import { useAudioStore } from '@/stores/audio';

const audio = useAudioStore();

const programa = ref<PasoPrograma[]>([]);
const estrellas = ref(0);
const expresion = ref<'normal' | 'feliz' | 'confundido' | 'celebrando' | 'dormido'>('normal');
const colorFuzz = ref('#1FA2FF');
const sombrero = ref<string | null>(null);
const ejecutando = ref<number | null>(null);

const DISPONIBLES: ClaseFicha[] = ['derecha', 'izquierda', 'arriba', 'abajo', 'saltar', 'repetir', 'siColor'];
const COLORES = ['#1FA2FF', '#5AD35A', '#FF3CAC', '#FFD93D', '#FF8A3D', '#7B61FF'];
const SOMBREROS = [null, 'sombrero_mago', 'corona', 'gorro'];

/** Recorre el programa resaltando cada paso, como lo hará el juego. */
async function ejecutar(): Promise<void> {
  if (programa.value.length === 0) {
    void audio.narrar('ui_arrastra-ficha', 'Arrastra las fichas de flechas a la barra de abajo.');
    return;
  }

  expresion.value = 'normal';
  for (let i = 0; i < programa.value.length; i++) {
    ejecutando.value = i;
    audio.efecto('rodar');
    await new Promise((r) => setTimeout(r, 420));
  }
  ejecutando.value = null;

  expresion.value = 'celebrando';
  estrellas.value = 3;
  void audio.celebrar('Muy bien, lo lograste.');
  setTimeout(() => (expresion.value = 'feliz'), 2200);
}

function fallar(): void {
  expresion.value = 'confundido';
  audio.efecto('choque');
  void audio.narrar('ui_choque', 'Uy, el Fuzz choco. No pasa nada, prueba con otro camino.');
  setTimeout(() => (expresion.value = 'normal'), 1600);
}

function reiniciar(): void {
  programa.value = [];
  estrellas.value = 0;
  expresion.value = 'normal';
}

function probarInstruccion(): void {
  void audio.narrar(
    'instruction_world1_lvl1',
    'Tu Fuzz quiere llegar a la estrella. Arrastra la flecha que apunta a la derecha y toca el boton verde para verlo rodar.',
  );
}
</script>

<template>
  <main class="muestra">
    <header class="muestra__cabecera">
      <h1>Sistema de diseño</h1>
      <div class="muestra__estado">
        <span :class="['chip', audio.desbloqueado ? 'chip--ok' : 'chip--aviso']">
          audio {{ audio.desbloqueado ? 'activo' : 'esperando un toque' }}
        </span>
        <span :class="['chip', audio.hayManifest ? 'chip--ok' : 'chip--aviso']">
          {{ audio.hayManifest ? 'manifest cargado' : 'sin manifest (usará la voz del navegador)' }}
        </span>
        <BotonJuguete
          :etiqueta="audio.silenciado ? 'Activar sonido' : 'Silenciar'"
          :icono="audio.silenciado ? '🔇' : '🔊'"
          tono="neutro"
          tamano="sm"
          @pulsar="audio.alternarSilencio()"
        />
      </div>
    </header>

    <!-- El personaje -->
    <section class="tarjeta">
      <h2>El Fuzz</h2>
      <div class="fila fila--centrada">
        <FuzzAvatar
          :color="colorFuzz"
          :expresion="expresion"
          :sombrero="sombrero"
          :tamano="170"
        />
        <div class="columna">
          <p class="etiqueta">Expresión</p>
          <div class="fila">
            <BotonJuguete
              v-for="e in (['normal', 'feliz', 'confundido', 'celebrando', 'dormido'] as const)"
              :key="e"
              :etiqueta="e"
              tono="azul"
              tamano="sm"
              @pulsar="expresion = e"
            />
          </div>

          <p class="etiqueta">Color del pelaje</p>
          <div class="fila">
            <button
              v-for="c in COLORES"
              :key="c"
              type="button"
              class="pastilla"
              :style="{ background: c }"
              :aria-label="`Color ${c}`"
              @click="colorFuzz = c"
            />
          </div>

          <p class="etiqueta">Accesorio</p>
          <div class="fila">
            <BotonJuguete
              v-for="s in SOMBREROS"
              :key="s ?? 'ninguno'"
              :etiqueta="s ?? 'sin sombrero'"
              tono="morado"
              tamano="sm"
              @pulsar="sombrero = s"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Fichas -->
    <section class="tarjeta">
      <h2>Fichas de comando</h2>
      <p class="nota">
        Sin una palabra escrita. Cada comando tiene su color, constante en toda la aplicación.
      </p>
      <div class="fila fila--envuelve">
        <FichaComando comando="derecha" />
        <FichaComando comando="izquierda" />
        <FichaComando comando="arriba" />
        <FichaComando comando="abajo" />
        <FichaComando comando="saltar" />
        <FichaComando comando="recoger" />
        <FichaComando comando="repetir" :veces="3" />
        <FichaComando comando="siColor" color="rojo" />
        <FichaComando comando="siSino" />
        <FichaComando comando="funcion" />
      </div>
    </section>

    <!-- Barra de programa -->
    <section class="tarjeta">
      <h2>Barra de programa</h2>
      <p class="nota">
        Arrastra una ficha a un hueco, o tócala para que vaya al primer sitio libre. Toca una ficha
        colocada para quitarla.
      </p>
      <BarraPrograma
        v-model="programa"
        :disponibles="DISPONIBLES"
        :capacidad="8"
        :ejecutando="ejecutando"
      />
      <div class="fila fila--centrada acciones">
        <BotonJuguete etiqueta="Jugar" icono="▶" tono="verde" tamano="lg" destacado @pulsar="ejecutar" />
        <BotonJuguete etiqueta="Simular choque" icono="💥" tono="naranja" @pulsar="fallar" />
        <BotonJuguete etiqueta="Reiniciar" icono="↺" tono="neutro" @pulsar="reiniciar" />
      </div>
    </section>

    <!-- Audio y recompensas -->
    <section class="tarjeta">
      <h2>Voz y recompensa</h2>
      <div class="fila fila--centrada">
        <BotonJuguete etiqueta="Narrar la instrucción" icono="🗣" tono="azul" @pulsar="probarInstruccion" />
        <BotonEscuchar />
      </div>
      <p class="nota">
        Si el MP3 de ElevenLabs no está generado, se sintetiza con la voz del navegador. La actividad
        nunca se queda muda.
      </p>
      <div class="fila fila--centrada">
        <PanelEstrellas :conseguidas="estrellas" :tamano="64" />
      </div>
      <div class="fila fila--centrada">
        <BotonJuguete
          v-for="n in [0, 1, 2, 3]"
          :key="n"
          :etiqueta="`${n}`"
          tono="amarillo"
          tamano="sm"
          @pulsar="estrellas = n"
        />
      </div>
    </section>

    <!-- Botones -->
    <section class="tarjeta">
      <h2>Botones</h2>
      <div class="fila fila--envuelve">
        <BotonJuguete etiqueta="Verde" tono="verde" />
        <BotonJuguete etiqueta="Azul" tono="azul" />
        <BotonJuguete etiqueta="Magenta" tono="magenta" />
        <BotonJuguete etiqueta="Amarillo" tono="amarillo" />
        <BotonJuguete etiqueta="Naranja" tono="naranja" />
        <BotonJuguete etiqueta="Morado" tono="morado" />
        <BotonJuguete etiqueta="Deshabilitado" tono="verde" deshabilitado />
      </div>
      <div class="fila fila--envuelve">
        <BotonJuguete etiqueta="Pequeño" tono="azul" tamano="sm" />
        <BotonJuguete etiqueta="Normal" tono="azul" />
        <BotonJuguete etiqueta="Grande" tono="azul" tamano="lg" />
        <BotonJuguete etiqueta="Jugar" icono="▶" tono="verde" tamano="xl" solo-icono />
      </div>
    </section>
  </main>
</template>

<style scoped>
.muestra {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--espacio-5) var(--espacio-4) var(--espacio-8);
}

.muestra__cabecera {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-4);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--espacio-5);
}

.muestra__estado {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-2);
  align-items: center;
}

.chip {
  padding: var(--espacio-1) var(--espacio-3);
  font-size: var(--texto-xs);
  border-radius: var(--radio-total);
}

.chip--ok {
  background: rgb(90 211 90 / 0.25);
  color: #2f7a2f;
}

.chip--aviso {
  background: rgb(255 217 61 / 0.35);
  color: #8a6a00;
}

.tarjeta {
  padding: var(--espacio-5);
  margin-bottom: var(--espacio-5);
  background: rgb(255 255 255 / 0.72);
  border-radius: var(--radio-xl);
  box-shadow: var(--sombra-panel);
}

.fila {
  display: flex;
  gap: var(--espacio-3);
  align-items: center;
}

.fila--envuelve {
  flex-wrap: wrap;
}

.fila--centrada {
  flex-wrap: wrap;
  justify-content: center;
}

.columna {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.acciones {
  margin-top: var(--espacio-4);
}

.etiqueta {
  margin: var(--espacio-2) 0 0;
  font-size: var(--texto-xs);
  color: var(--gris-oscuro);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nota {
  margin: 0 0 var(--espacio-4);
  font-size: var(--texto-sm);
  font-weight: 600;
  color: var(--gris-oscuro);
}

.pastilla {
  width: 48px;
  height: 48px;
  border: 3px solid white;
  border-radius: var(--radio-total);
  box-shadow: var(--relieve);
}
</style>
