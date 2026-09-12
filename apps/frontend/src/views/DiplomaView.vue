<script setup lang="ts">
/**
 * El diploma de Constructor de Juegos de Codexia.
 *
 * Tres cosas lo hacen un diploma y no un dibujo:
 *
 *  1. **Se puede comprobar sin sesión.** Esta pantalla se abre con el código y
 *     nada más, así que la familia puede verificarlo desde su teléfono sin tener
 *     cuenta. Es la razón de que la ruta sea pública.
 *  2. **Se puede imprimir.** Hay hojas de estilo de impresión: en papel sale el
 *     diploma solo, sin botones ni menús, en horizontal. Los diplomas de colegio
 *     acaban en la pared de una habitación.
 *  3. **Dice exactamente lo que pasó**: quién, qué juego y cuándo. Si el
 *     estudiante retira el juego después, el diploma sigue siendo cierto.
 *
 * El dibujo está hecho con SVG y CSS, no con una imagen: escala a cualquier
 * tamaño, imprime nítido y no hay que generar un PNG por alumno.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BotonJuguete from '@/components/BotonJuguete.vue';
import { api } from '@/api/cliente';
import { leerToken } from '@/api/cliente';
import { useAudioStore } from '@/stores/audio';

interface Diploma {
  readonly codigo: string;
  readonly nombreAlumno: string;
  readonly tituloJuego: string;
  readonly emitidoEn: string;
  readonly proyectoId: number | null;
}

const ruta = useRoute();
const router = useRouter();
const audio = useAudioStore();

const diploma = ref<Diploma | null>(null);
const error = ref<string | null>(null);
const conSesion = computed(() => leerToken() !== null);

const fechaLarga = computed(() => {
  if (!diploma.value) return '';
  return new Date(diploma.value.emitidoEn).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

/** Las estrellas del marco: se calculan una vez y no cambian. */
const estrellasMarco = Array.from({ length: 14 }, (_, i) => ({
  x: 6 + (i % 7) * 14.7,
  y: i < 7 ? 5 : 95,
}));

function imprimir(): void {
  window.print();
}

onMounted(async () => {
  const codigo = String(ruta.params.codigo ?? '');
  try {
    const datos = await api.get<{ diploma: Diploma }>(`/juegos/diploma/${codigo}`);
    diploma.value = datos.diploma;
    void audio.narrar(
      'ui_constructor-publicado',
      'Te ganaste el diploma de constructor de juegos de Codexia. Felicidades.',
    );
    audio.efecto('tres-estrellas');
  } catch {
    error.value = 'No encontramos ese diploma. Revisa el codigo.';
  }
});
</script>

<template>
  <main class="pagina">
    <header v-if="diploma" class="barra">
      <BotonJuguete
        v-if="conSesion"
        etiqueta="Volver a mis juegos"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/proyectos')"
      />
      <BotonJuguete etiqueta="Imprimir" icono="🖨️" tono="azul" @pulsar="imprimir" />
      <BotonJuguete
        v-if="diploma.proyectoId"
        etiqueta="Jugar el juego"
        icono="🎮"
        tono="verde"
        @pulsar="router.push(`/jugar/${diploma.proyectoId}`)"
      />
    </header>

    <p v-if="error" class="aviso">{{ error }}</p>

    <!-- El diploma -->
    <article v-if="diploma" class="diploma">
      <!-- Marco dibujado: dos rectángulos, esquinas y estrellas. -->
      <svg class="diploma__marco" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="1.2" y="1.8" width="97.6" height="96.4" fill="none" stroke="#C8A234" stroke-width="0.7" />
        <rect x="2.6" y="3.6" width="94.8" height="92.8" fill="none" stroke="#C8A234" stroke-width="0.25" />
        <g fill="#C8A234" opacity="0.85">
          <circle v-for="(e, i) in estrellasMarco" :key="i" :cx="e.x" :cy="e.y" r="0.5" />
        </g>
      </svg>

      <p class="diploma__institucion">Codexia · CodeNest School</p>
      <h1 class="diploma__titulo">Diploma de<br /><strong>Constructor de Juegos</strong></h1>

      <p class="diploma__formula">Se otorga a</p>
      <p class="diploma__nombre">{{ diploma.nombreAlumno }}</p>

      <p class="diploma__texto">
        por haber imaginado, programado y publicado su propio videojuego,
        <em>{{ diploma.tituloJuego }}</em
        >, eligiendo su escenario, sus obstaculos y las reglas que lo gobiernan, y por haberlo
        llevado hasta el final: hasta ganarlo.
      </p>

      <div class="diploma__sello">
        <div class="sello">
          <span class="sello__robot" aria-hidden="true">🤖</span>
          <span class="sello__texto">CONSTRUCTOR<br />DE JUEGOS</span>
        </div>
        <div class="diploma__firma">
          <span class="firma__raya" aria-hidden="true"></span>
          <span class="firma__nombre">Nube</span>
          <span class="firma__cargo">Guia de CodeNest School</span>
        </div>
      </div>

      <footer class="diploma__pie">
        <span>{{ fechaLarga }}</span>
        <span class="diploma__codigo">
          Codigo <strong>{{ diploma.codigo }}</strong>
        </span>
      </footer>

      <p class="diploma__verificacion">
        Este diploma se puede comprobar en codenestschool.com/app/diploma/{{ diploma.codigo }}
      </p>
    </article>
  </main>
</template>

<style scoped>
.pagina {
  max-width: 1000px;
  margin: 0 auto;
  padding: 18px 16px 60px;
}

.barra {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

/* ── El diploma ── */

.diploma {
  position: relative;
  aspect-ratio: 297 / 210; /* A4 horizontal */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 5% 8%;
  text-align: center;
  color: #3b2d0f;
  background:
    radial-gradient(circle at 20% 15%, rgb(255 217 61 / 0.22), transparent 45%),
    radial-gradient(circle at 82% 80%, rgb(123 97 255 / 0.16), transparent 45%),
    linear-gradient(160deg, #fffdf3, #fff7e0);
  border-radius: 10px;
  box-shadow: 0 10px 0 rgb(0 0 0 / 0.1);
  overflow: hidden;
}

.diploma__marco {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.diploma__institucion {
  margin: 0;
  font-size: clamp(10px, 1.4vw, 15px);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a37b16;
}

.diploma__titulo {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-weight: 400;
  line-height: 1.1;
  font-size: clamp(18px, 3.2vw, 34px);
}

.diploma__titulo strong {
  display: block;
  font-size: clamp(24px, 4.6vw, 50px);
  color: #8b5cf6;
}

.diploma__formula {
  margin: 4px 0 0;
  font-size: clamp(11px, 1.5vw, 16px);
  color: #7a6a3e;
}

.diploma__nombre {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: clamp(22px, 4.2vw, 46px);
  color: #1e293b;
  border-bottom: 2px solid rgb(200 162 52 / 0.5);
  padding: 0 clamp(10px, 4vw, 40px) 4px;
}

.diploma__texto {
  margin: 6px 0 0;
  max-width: 62ch;
  font-size: clamp(10px, 1.5vw, 16px);
  line-height: 1.5;
  color: #4b3f22;
}

.diploma__texto em {
  font-family: var(--fuente-titulo);
  font-style: normal;
  color: #8b5cf6;
}

.diploma__sello {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(20px, 8vw, 90px);
  margin-top: auto;
  padding-top: 10px;
}

.sello {
  display: grid;
  place-items: center;
  gap: 0;
  width: clamp(64px, 11vw, 116px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe9a8, #e0b81c 70%, #c8a234);
  box-shadow: 0 3px 0 rgb(0 0 0 / 0.15), inset 0 0 0 3px rgb(255 255 255 / 0.4);
  transform: rotate(-8deg);
}

.sello__robot {
  font-size: clamp(20px, 3.4vw, 38px);
  line-height: 1;
}

.sello__texto {
  font-family: var(--fuente-titulo);
  font-size: clamp(6px, 0.85vw, 9px);
  line-height: 1.1;
  letter-spacing: 0.06em;
  color: #5b4305;
}

.diploma__firma {
  display: grid;
  justify-items: center;
}

.firma__raya {
  display: block;
  width: clamp(90px, 16vw, 170px);
  height: 2px;
  background: #3b2d0f;
  opacity: 0.5;
}

.firma__nombre {
  font-family: var(--fuente-titulo);
  font-size: clamp(12px, 1.8vw, 20px);
}

.firma__cargo {
  font-size: clamp(8px, 1.1vw, 12px);
  color: #7a6a3e;
}

.diploma__pie {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 8px;
  font-size: clamp(8px, 1.2vw, 13px);
  color: #7a6a3e;
}

.diploma__codigo strong {
  letter-spacing: 0.1em;
  color: #3b2d0f;
}

.diploma__verificacion {
  margin: 2px 0 0;
  font-size: clamp(7px, 1vw, 11px);
  color: #a39270;
}

.aviso {
  text-align: center;
  color: #64748b;
}

/*
 * En papel va el diploma y nada más: sin botones, sin fondo de la aplicación y
 * en horizontal, que es como está diseñado.
 */
@media print {
  .barra {
    display: none;
  }

  .pagina {
    padding: 0;
    max-width: none;
  }

  .diploma {
    box-shadow: none;
    border-radius: 0;
    width: 100%;
    aspect-ratio: 297 / 210;
    page-break-inside: avoid;
  }
}
</style>
