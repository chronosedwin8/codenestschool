<script setup lang="ts">
/**
 * La Isla del Teclado: el mapa de la mecanografía.
 *
 * Tres zonas, una por curso, y dentro de cada una las lecciones en el orden en
 * que se aprende a escribir. El orden dentro de la zona sí importa —la
 * mecanografía se aprende por filas de teclas— pero las zonas están abiertas
 * desde el principio: un estudiante de 7.º no tiene que pasar por las lecciones
 * de 5.º para llegar a la suya.
 *
 * Arriba, siempre visible, lo que de verdad le interesa a un chico de doce años:
 * cuántas palabras por minuto hace. Y debajo, sin dramatismo, las teclas que más
 * falla, que es la información que le hace mejorar.
 */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import BotonJuguete from '@/components/BotonJuguete.vue';
import { useAudioStore } from '@/stores/audio';
import { useMecanografiaStore } from '@/stores/mecanografia';

const router = useRouter();
const audio = useAudioStore();
const teclado = useMecanografiaStore();

const resumen = computed(() => teclado.resumen);
const zonasVacias = computed(() => teclado.zonas.length === 0);

onMounted(async () => {
  await teclado.cargarMapa();
  void audio.narrar(
    'ui_teclado-bienvenida',
    'Bienvenido a la Isla del Teclado. Aqui vas a aprender a escribir con los diez dedos, sin mirar.',
  );
});
</script>

<template>
  <main class="isla">
    <header class="isla__cabecera">
      <BotonJuguete
        etiqueta="Volver al mapa"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/mapa')"
      />
      <h1>Isla del Teclado</h1>
      <BotonJuguete
        etiqueta="Jugar a practicar"
        icono="🎮"
        tono="morado"
        solo-icono
        @pulsar="router.push('/mecanografia/practica')"
      />
    </header>

    <!-- El marcador: lo primero que quiere ver quien practica. -->
    <section v-if="resumen" class="marcador">
      <div class="marcador__grande">
        <strong>{{ resumen.mejorPpm }}</strong>
        <span>palabras por minuto<br /><small>tu mejor marca</small></span>
      </div>

      <ul class="marcador__cifras">
        <li>
          <strong>{{ resumen.ultimaPrecision }} %</strong>
          <span>precision del ultimo intento</span>
        </li>
        <li>
          <strong>{{ resumen.leccionesCompletadas }} / {{ resumen.leccionesTotales }}</strong>
          <span>lecciones</span>
        </li>
        <li>
          <strong>⭐ {{ resumen.estrellas }}</strong>
          <span>estrellas</span>
        </li>
        <li>
          <strong>{{ resumen.minutosPracticados }} min</strong>
          <span>practicados</span>
        </li>
      </ul>

      <!--
        Las teclas que más falla. No es un castigo: es lo único de esta pantalla
        que le dice qué practicar mañana.
      -->
      <div v-if="resumen.teclasDificiles.length > 0" class="dificiles">
        <span>Se te atraviesan:</span>
        <span v-for="t in resumen.teclasDificiles" :key="t.tecla" class="dificiles__tecla">
          {{ t.tecla }}
        </span>
      </div>
    </section>

    <p v-if="teclado.error" class="aviso">{{ teclado.error }}</p>
    <p v-else-if="teclado.cargando && zonasVacias" class="aviso">Cargando la isla...</p>

    <!-- Las tres zonas -->
    <section v-for="zona in teclado.zonas" :key="zona.clave" class="zona">
      <header class="zona__cabecera" :style="{ '--color-zona': zona.color }">
        <span class="zona__icono" aria-hidden="true">{{ zona.icono }}</span>
        <div>
          <h2>{{ zona.nombre }}</h2>
          <p>
            <strong>{{ zona.grado }}</strong> · {{ zona.completadas }} de
            {{ zona.lecciones.length }} lecciones · ⭐ {{ zona.estrellas }}
          </p>
        </div>
      </header>

      <p class="zona__que">{{ zona.descripcion }}</p>

      <ol class="lecciones">
        <li v-for="leccion in zona.lecciones" :key="leccion.clave">
          <button
            type="button"
            class="leccion"
            :class="{
              'leccion--hecha': leccion.completada,
              'leccion--cerrada': !leccion.desbloqueada,
            }"
            :style="{ '--color-zona': zona.color }"
            :disabled="!leccion.desbloqueada"
            @click="router.push(`/mecanografia/leccion/${leccion.clave}`)"
          >
            <span class="leccion__numero">{{ leccion.orden }}</span>
            <span class="leccion__cuerpo">
              <strong>{{ leccion.nombre }}</strong>
              <small v-if="leccion.teclasNuevas.length > 0">
                teclas nuevas:
                <code v-for="t in leccion.teclasNuevas" :key="t">{{ t }}</code>
              </small>
              <small v-else>practica de lo aprendido</small>
            </span>
            <span class="leccion__estado">
              <span class="leccion__estrellas" aria-hidden="true">
                {{ '⭐'.repeat(leccion.estrellas) }}{{ '·'.repeat(3 - leccion.estrellas) }}
              </span>
              <small v-if="leccion.mejorPpm > 0">{{ leccion.mejorPpm }} ppm</small>
              <small v-else-if="!leccion.desbloqueada">🔒</small>
            </span>
          </button>
        </li>
      </ol>
    </section>
  </main>
</template>


<style scoped>
.isla {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 16px 64px;
}

.isla__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.isla__cabecera h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  text-align: center;
}

/* ── Marcador ── */

.marcador {
  display: grid;
  gap: 12px;
  padding: 18px 20px;
  margin-bottom: 22px;
  border-radius: 24px;
  background: linear-gradient(160deg, #e8f6ff, #fff);
  box-shadow: 0 4px 0 rgb(0 0 0 / 0.08);
}

.marcador__grande {
  display: flex;
  align-items: center;
  gap: 14px;
}

.marcador__grande strong {
  font-family: var(--fuente-titulo);
  font-size: 56px;
  line-height: 1;
  color: var(--azul-neon, #1fa2ff);
}

.marcador__grande span {
  font-size: var(--texto-sm);
  color: #475569;
}

.marcador__cifras {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.marcador__cifras li {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 14px;
  background: #fff;
}

.marcador__cifras strong {
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.marcador__cifras span {
  font-size: 11px;
  color: #64748b;
}

.dificiles {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: var(--texto-sm);
  color: #64748b;
}

.dificiles__tecla {
  display: grid;
  place-items: center;
  min-width: 28px;
  padding: 4px 8px;
  border-radius: 8px;
  background: #fee2e2;
  color: #b91c1c;
  font-weight: 800;
  font-family: ui-monospace, monospace;
}

/* ── Zonas ── */

.zona {
  margin-bottom: 26px;
}

.zona__cabecera {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 18px 18px 0 0;
  background: var(--color-zona);
  color: #fff;
}

.zona__icono {
  font-size: 34px;
}

.zona__cabecera h2 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.zona__cabecera p {
  margin: 0;
  font-size: var(--texto-sm);
  opacity: 0.95;
}

.zona__que {
  margin: 0;
  padding: 10px 16px;
  background: #f8fafc;
  font-size: var(--texto-sm);
  color: #475569;
}

.lecciones {
  display: grid;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 8px;
  background: #f8fafc;
  border-radius: 0 0 18px 18px;
}

.leccion {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-left: 5px solid var(--color-zona);
  border-radius: 12px;
  background: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 2px 0 rgb(0 0 0 / 0.06);
}

.leccion--hecha {
  background: #f0fdf4;
}

.leccion--cerrada {
  opacity: 0.55;
  cursor: not-allowed;
}

.leccion__numero {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 50%;
  background: var(--color-zona);
  color: #fff;
  font-family: var(--fuente-titulo);
}

.leccion__cuerpo {
  flex: 1;
  display: grid;
  gap: 2px;
}

.leccion__cuerpo small {
  font-size: 11px;
  color: #64748b;
}

.leccion__cuerpo code {
  display: inline-block;
  margin-right: 3px;
  padding: 0 4px;
  border-radius: 4px;
  background: #e2e8f0;
  font-family: ui-monospace, monospace;
}

.leccion__estado {
  display: grid;
  justify-items: end;
  gap: 2px;
  flex: none;
}

.leccion__estrellas {
  letter-spacing: 1px;
  font-size: 13px;
}

.leccion__estado small {
  font-size: 11px;
  color: #64748b;
}

.aviso {
  text-align: center;
  color: #64748b;
}
</style>
