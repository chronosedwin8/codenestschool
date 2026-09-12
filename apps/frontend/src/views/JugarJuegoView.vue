<script setup lang="ts">
/**
 * Jugar el juego de otro.
 *
 * La pantalla es casi solo el juego: aquí no se configura nada, se juega. Se
 * suma una partida al abrir —no al terminar— porque lo que cuenta el contador es
 * cuánta gente lo ha probado, y a un juego difícil no se le van a restar las
 * partidas de quien no lo terminó.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BotonJuguete from '@/components/BotonJuguete.vue';
import { api } from '@/api/cliente';
import { JuegoArcade, type Marcador } from '@/game/ArcadeRuntime';
import { useAudioStore } from '@/stores/audio';
import { useProyectosStore, type ProyectoCompleto } from '@/stores/proyectos';

const ruta = useRoute();
const router = useRouter();
const audio = useAudioStore();
const tienda = useProyectosStore();

const juego = ref<ProyectoCompleto | null>(null);
const lienzo = ref<HTMLElement | null>(null);
const marcador = ref<Marcador | null>(null);
const error = ref<string | null>(null);

let motor: JuegoArcade | null = null;

function fondoDelJuego(): string | null {
  const clave = juego.value?.definicion.escenario;
  return tienda.catalogo?.escenarios.find((e) => e.clave === clave)?.imagenUrl ?? null;
}

const escuchas = {
  alCambiarMarcador: (m: Marcador) => (marcador.value = m),
  alSonar: (sonido: 'estrella' | 'moneda' | 'choque' | 'salto' | 'victoria' | 'desbloqueo') =>
    audio.efecto(sonido),
};

async function arrancar(): Promise<void> {
  if (!lienzo.value || !juego.value) return;
  motor ??= new JuegoArcade(lienzo.value);
  await motor.cargar(juego.value.definicion, fondoDelJuego(), escuchas);

  if (juego.value.definicion.musica) {
    const musica = tienda.catalogo?.escenarios.find(
      (e) => e.clave === juego.value!.definicion.escenario,
    )?.musica;
    if (musica) audio.musica(musica);
  }
}

function otraVez(): void {
  if (!juego.value) return;
  marcador.value = null;
  motor?.reiniciar(juego.value.definicion, fondoDelJuego(), escuchas);
}

onMounted(async () => {
  const id = Number(ruta.params.id);
  try {
    await tienda.cargarCatalogo();
    const { proyecto } = await api.get<{ proyecto: ProyectoCompleto }>(`/proyectos/${id}`);
    juego.value = proyecto;
    void tienda.registrarPartida(id);
    await arrancar();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo abrir ese juego';
  }
});

onBeforeUnmount(() => {
  motor?.destruir();
  motor = null;
});
</script>

<template>
  <main class="jugar">
    <header class="jugar__cabecera">
      <BotonJuguete
        etiqueta="Volver a los juegos"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/juegos')"
      />
      <div class="jugar__titulo">
        <h1>{{ juego?.titulo ?? 'Cargando' }}</h1>
        <p v-if="juego">un juego de {{ juego.autor.nombre.split(' ')[0] }}</p>
      </div>
      <BotonJuguete
        :etiqueta="audio.silenciado ? 'Activar sonido' : 'Silenciar'"
        :icono="audio.silenciado ? '🔇' : '🔊'"
        tono="neutro"
        solo-icono
        @pulsar="audio.alternarSilencio()"
      />
    </header>

    <p v-if="error" class="aviso">{{ error }}</p>

    <div ref="lienzo" class="lienzo" />

    <footer class="jugar__pie">
      <p v-if="marcador" class="marcador">
        {{ marcador.puntos }} puntos · {{ '❤'.repeat(Math.max(0, marcador.vidas)) }}
        <span v-if="marcador.segundos !== null"> · {{ marcador.segundos }}s</span>
      </p>
      <p v-else-if="juego" class="marcador">
        {{
          juego.definicion.control === 'teclado'
            ? 'Muevete con las flechas. Dispara con la barra espaciadora.'
            : 'Muevete con el raton. Haz clic para disparar.'
        }}
      </p>

      <BotonJuguete
        v-if="marcador?.terminado"
        etiqueta="Jugar otra vez"
        icono="↺"
        tono="verde"
        tamano="lg"
        @pulsar="otraVez"
      />
    </footer>
  </main>
</template>

<style scoped>
.jugar {
  max-width: 1100px;
  margin: 0 auto;
  padding: 14px 14px 40px;
}

.jugar__cabecera {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.jugar__titulo {
  flex: 1;
  text-align: center;
}

.jugar__titulo h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-xl);
}

.jugar__titulo p {
  margin: 0;
  font-size: var(--texto-sm);
  color: #64748b;
}

.lienzo {
  aspect-ratio: 16 / 9;
  border-radius: 18px;
  overflow: hidden;
  background: #0f172a;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.12);
}

/*
 * El tamano del lienzo lo pone Phaser (Scale.FIT) y aqui NO se toca.
 *
 * Forzarlo con `width: 100% !important` descuadraba el mapeo del puntero: Phaser
 * traduce la posicion del raton con los limites que el mismo habia fijado, asi
 * que el personaje se iba fuera de la pantalla al mover el raton y el juego era
 * injugable con ese control. Solo se centra.
 */
.lienzo :deep(canvas) {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 100%;
}

.jugar__pie {
  display: grid;
  gap: 10px;
  justify-items: center;
  margin-top: 12px;
  text-align: center;
}

.marcador {
  margin: 0;
  font-family: var(--fuente-titulo);
  color: #475569;
}

.aviso {
  text-align: center;
  color: #64748b;
}
</style>
