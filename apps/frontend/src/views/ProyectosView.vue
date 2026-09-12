<script setup lang="ts">
/**
 * Mis juegos: el taller del estudiante.
 *
 * Es la puerta de la sección. Lo primero que se ve es el botón de hacer un juego
 * nuevo, grande y con el robot: lo que un niño viene a hacer aquí no es
 * administrar una lista, es crear algo. La lista viene después.
 *
 * Cada tarjeta dice en qué estado está el juego con una palabra y un color, y no
 * con un icono a interpretar: "publicado" o "en tu taller".
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import BotonJuguete from '@/components/BotonJuguete.vue';
import { useAudioStore } from '@/stores/audio';
import { useProyectosStore } from '@/stores/proyectos';

const router = useRouter();
const audio = useAudioStore();
const tienda = useProyectosStore();

const creando = ref(false);
const aviso = ref<string | null>(null);
const borrandoId = ref<number | null>(null);

const publicados = computed(() => tienda.mios.filter((p) => p.estado === 'publicado').length);

async function nuevoJuego(): Promise<void> {
  if (creando.value) return;
  creando.value = true;
  aviso.value = null;
  try {
    const proyecto = await tienda.crear();
    audio.efecto('desbloqueo');
    await router.push(`/constructor/${proyecto.id}`);
  } catch (error) {
    aviso.value = error instanceof Error ? error.message : 'No se pudo crear el juego';
  } finally {
    creando.value = false;
  }
}

async function borrar(id: number): Promise<void> {
  // Doble toque en el mismo botón: el primero pregunta, el segundo borra. Es la
  // confirmación que entiende un niño sin leer una ventana de diálogo.
  if (borrandoId.value !== id) {
    borrandoId.value = id;
    window.setTimeout(() => {
      if (borrandoId.value === id) borrandoId.value = null;
    }, 4000);
    return;
  }
  borrandoId.value = null;
  await tienda.borrar(id);
  audio.efecto('ficha-quitada');
}

function fecha(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

onMounted(async () => {
  await tienda.cargarMios();
  void audio.narrar(
    'ui_constructor-bienvenida',
    'Bienvenido al constructor de juegos. Aqui tu haces el juego y los demas lo juegan.',
  );
});
</script>

<template>
  <main class="taller">
    <header class="taller__cabecera">
      <BotonJuguete
        etiqueta="Volver al mapa"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/mapa')"
      />
      <h1>Mis juegos</h1>
      <BotonJuguete
        etiqueta="Ver los juegos de todos"
        icono="🕹️"
        tono="morado"
        solo-icono
        @pulsar="router.push('/juegos')"
      />
    </header>

    <!-- Lo que se viene a hacer aquí, lo primero y lo más grande. -->
    <section class="hacer">
      <span class="hacer__robot" aria-hidden="true">🤖</span>
      <div class="hacer__texto">
        <h2>¿Hacemos un juego?</h2>
        <p>
          Eliges el escenario, tu personaje y los obstaculos, programas las reglas y lo publicas
          para que lo jueguen los demas.
        </p>
      </div>
      <BotonJuguete
        etiqueta="Hacer un juego"
        icono="🛠️"
        tono="verde"
        tamano="lg"
        :deshabilitado="creando"
        @pulsar="nuevoJuego"
      />
    </section>

    <p v-if="aviso" class="aviso">{{ aviso }}</p>
    <p v-if="tienda.error" class="aviso">{{ tienda.error }}</p>

    <section v-if="tienda.misDiplomas.length > 0" class="diplomas">
      <h2>Tus diplomas</h2>
      <ul>
        <li v-for="d in tienda.misDiplomas" :key="d.codigo">
          <button type="button" class="diploma" @click="router.push(`/diploma/${d.codigo}`)">
            <span aria-hidden="true">🎓</span>
            <span class="diploma__juego">{{ d.tituloJuego }}</span>
            <span class="diploma__codigo">{{ d.codigo }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section class="lista">
      <h2 v-if="tienda.mios.length > 0">
        Tu taller
        <small v-if="publicados > 0">· {{ publicados }} publicado(s)</small>
      </h2>

      <p v-else-if="!tienda.cargando" class="vacio">
        Todavia no has hecho ningun juego. El boton verde es por donde se empieza.
      </p>

      <div class="rejilla">
        <article v-for="p in tienda.mios" :key="p.id" class="carta">
          <button type="button" class="carta__portada" @click="router.push(`/constructor/${p.id}`)">
            <img
              v-if="p.portadaUrl"
              :src="p.portadaUrl"
              :alt="`Portada de ${p.titulo}`"
              crossorigin="anonymous"
            />
            <span v-else class="carta__sinportada" aria-hidden="true">🎮</span>
          </button>

          <h3 class="carta__titulo">{{ p.titulo }}</h3>

          <p class="carta__estado" :class="`carta__estado--${p.estado}`">
            {{ p.estado === 'publicado' ? 'Publicado' : 'En tu taller' }}
            <span v-if="p.estado === 'publicado'"> · {{ fecha(p.publicadoEn) }}</span>
          </p>

          <p v-if="p.estado === 'publicado'" class="carta__cifras">
            <span aria-hidden="true">🎮</span> {{ p.partidas }}
            <span aria-hidden="true">👍</span> {{ p.meGusta }}
          </p>
          <p v-else-if="!p.probado" class="carta__pista">Pruebalo y ganalo para publicarlo</p>
          <p v-else class="carta__pista carta__pista--listo">Listo para publicar</p>

          <div class="carta__botones">
            <BotonJuguete
              etiqueta="Seguir construyendo"
              icono="🛠️"
              tono="azul"
              tamano="sm"
              solo-icono
              @pulsar="router.push(`/constructor/${p.id}`)"
            />
            <BotonJuguete
              :etiqueta="borrandoId === p.id ? '¿Seguro? Toca otra vez' : 'Borrar este juego'"
              :icono="borrandoId === p.id ? '⚠️' : '🗑️'"
              :tono="borrandoId === p.id ? 'naranja' : 'neutro'"
              tamano="sm"
              :solo-icono="borrandoId !== p.id"
              @pulsar="borrar(p.id)"
            />
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.taller {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px 16px 64px;
}

.taller__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.taller__cabecera h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  text-align: center;
}

.hacer {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  justify-content: center;
  text-align: center;
  padding: 20px 24px;
  border-radius: 26px;
  background: linear-gradient(180deg, #eef8ff, #fff);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.hacer__robot {
  font-size: 56px;
  line-height: 1;
}

.hacer__texto {
  flex: 1 1 260px;
  text-align: left;
}

.hacer__texto h2 {
  margin: 0 0 4px;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-xl);
}

.hacer__texto p {
  margin: 0;
  color: #64748b;
  font-size: var(--texto-sm);
}

.diplomas {
  margin-bottom: 20px;
}

.diplomas h2,
.lista h2 {
  margin: 0 0 10px;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.diplomas ul {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.diploma {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #fff7db, #ffe9a8);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1);
  cursor: pointer;
  font: inherit;
}

.diploma__juego {
  font-family: var(--fuente-titulo);
}

.diploma__codigo {
  font-size: var(--texto-sm);
  color: #92400e;
  letter-spacing: 0.04em;
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.carta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
}

.carta__portada {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #1e293b, #7b61ff);
  cursor: pointer;
  padding: 0;
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

.carta__titulo {
  margin: 4px 0 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-base);
}

.carta__estado {
  margin: 0;
  font-size: var(--texto-sm);
  color: #64748b;
}

.carta__estado--publicado {
  color: var(--verde-cesped, #16a34a);
  font-weight: 700;
}

.carta__cifras {
  margin: 0;
  font-size: var(--texto-sm);
  color: #475569;
}

.carta__pista {
  margin: 0;
  font-size: var(--texto-sm);
  color: #94a3b8;
  min-height: 1.4em;
}

.carta__pista--listo {
  color: var(--verde-cesped, #16a34a);
}

.carta__botones {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
}

.aviso,
.vacio {
  text-align: center;
  color: #64748b;
}

@media (max-width: 520px) {
  .hacer__texto {
    text-align: center;
  }
}
</style>
