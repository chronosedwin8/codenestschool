<script setup lang="ts">
/**
 * La zona de juegos publicados.
 *
 * Es la recompensa de haber construido: aquí están los juegos de todos, con su
 * portada de verdad —una captura de la propia partida— y el nombre de quien lo
 * hizo. Nada de esto es texto libre: los títulos salen de un sorteo y del autor
 * solo aparece el nombre de pila.
 *
 * La misma pantalla vale para el docente, que entra a ver lo que hace su clase.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import BotonJuguete from '@/components/BotonJuguete.vue';
import { useAudioStore } from '@/stores/audio';
import { useProyectosStore } from '@/stores/proyectos';

type Orden = 'recientes' | 'populares' | 'jugados';

const router = useRouter();
const audio = useAudioStore();
const tienda = useProyectosStore();

const orden = ref<Orden>('recientes');

const ORDENES: readonly { clave: Orden; nombre: string; icono: string }[] = [
  { clave: 'recientes', nombre: 'Los ultimos', icono: '🆕' },
  { clave: 'populares', nombre: 'Los que mas gustan', icono: '👍' },
  { clave: 'jugados', nombre: 'Los mas jugados', icono: '🎮' },
];

const hayJuegos = computed(() => tienda.publicados.length > 0);

async function cambiarOrden(nuevo: Orden): Promise<void> {
  orden.value = nuevo;
  await tienda.cargarPublicados(nuevo);
}

async function meGusta(id: number): Promise<void> {
  audio.efecto('boton');
  await tienda.alternarMeGusta(id);
}

onMounted(async () => {
  await tienda.cargarPublicados('recientes');
});
</script>

<template>
  <main class="juegos">
    <header class="juegos__cabecera">
      <BotonJuguete
        etiqueta="Volver al mapa"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/mapa')"
      />
      <h1>Juegos de Codexia</h1>
      <BotonJuguete
        etiqueta="Mis juegos"
        icono="🛠️"
        tono="verde"
        solo-icono
        @pulsar="router.push('/proyectos')"
      />
    </header>

    <nav class="ordenes" aria-label="Como ordenar">
      <button
        v-for="o in ORDENES"
        :key="o.clave"
        type="button"
        class="orden"
        :class="{ 'orden--activo': orden === o.clave }"
        :aria-pressed="orden === o.clave"
        @click="cambiarOrden(o.clave)"
      >
        <span aria-hidden="true">{{ o.icono }}</span> {{ o.nombre }}
      </button>
    </nav>

    <p v-if="tienda.error" class="aviso">{{ tienda.error }}</p>
    <p v-else-if="tienda.cargando && !hayJuegos" class="aviso">Buscando juegos...</p>
    <p v-else-if="!hayJuegos" class="aviso">
      Todavia no hay juegos publicados. ¡Puedes ser el primero!
    </p>

    <section class="rejilla">
      <article v-for="j in tienda.publicados" :key="j.id" class="carta">
        <button type="button" class="carta__portada" @click="router.push(`/jugar/${j.id}`)">
          <img
            v-if="j.portadaUrl"
            :src="j.portadaUrl"
            :alt="`Portada de ${j.titulo}`"
            crossorigin="anonymous"
            loading="lazy"
          />
          <span v-else class="carta__sinportada" aria-hidden="true">🎮</span>
          <span class="carta__jugar">▶ Jugar</span>
        </button>

        <h2 class="carta__titulo">{{ j.titulo }}</h2>
        <p class="carta__autor">
          de <strong>{{ j.autor }}</strong>
          <span v-if="j.esMio" class="carta__tuyo">· tuyo</span>
        </p>

        <div class="carta__pie">
          <span class="cifra"><span aria-hidden="true">🎮</span> {{ j.partidas }}</span>
          <button
            type="button"
            class="megusta"
            :class="{ 'megusta--dado': j.leDiMeGusta }"
            :aria-pressed="j.leDiMeGusta"
            @click="meGusta(j.id)"
          >
            <span aria-hidden="true">👍</span> {{ j.meGusta }}
          </button>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.juegos {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 16px 64px;
}

.juegos__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.juegos__cabecera h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  text-align: center;
}

.ordenes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 16px;
}

.orden {
  padding: 10px 16px;
  border: 0;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
  font: inherit;
  color: #475569;
  cursor: pointer;
}

.orden--activo {
  background: var(--morado, #7b61ff);
  color: #fff;
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

.carta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
}

.carta__portada {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  background: linear-gradient(135deg, #1e293b, #7b61ff);
  cursor: pointer;
}

.carta__portada img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.carta__sinportada {
  font-size: 44px;
}

.carta__jugar {
  position: absolute;
  inset: auto 0 0 0;
  background: rgb(15 23 42 / 0.7);
  color: #fff;
  font-family: var(--fuente-titulo);
  padding: 6px 0;
}

.carta__titulo {
  margin: 6px 0 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-base);
}

.carta__autor {
  margin: 0;
  font-size: var(--texto-sm);
  color: #64748b;
}

.carta__tuyo {
  color: var(--verde-cesped, #16a34a);
}

.carta__pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
}

.cifra {
  font-size: var(--texto-sm);
  color: #475569;
}

.megusta {
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  background: #f1f5f9;
  font: inherit;
  font-size: var(--texto-sm);
  cursor: pointer;
}

.megusta--dado {
  background: var(--magenta, #ff3cac);
  color: #fff;
}

.aviso {
  text-align: center;
  color: #64748b;
}
</style>
