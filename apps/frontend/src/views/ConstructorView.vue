<script setup lang="ts">
/**
 * El constructor de juegos.
 *
 * La pantalla está partida en dos y siempre igual: a la izquierda, el juego de
 * verdad; a la derecha, lo que se puede cambiar. El niño no "configura" y luego
 * "prueba": ve su juego todo el tiempo y cada cambio se nota en el acto.
 *
 * Las pestañas siguen el orden en que se piensa un juego —dónde pasa, quién eres,
 * qué te estorba, qué recoges, qué reglas hay, cómo se juega— y no el orden en
 * que está escrita la definición.
 *
 * Publicar exige haber ganado. El botón está apagado hasta entonces y dice por
 * qué: es la única forma de que la zona de juegos no se llene de juegos que nadie
 * puede terminar, ni siquiera su autor.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { DefinicionJuego, ObstaculoJuego, PremioJuego, ReglaJuego } from '@codenest/shared';

import BotonJuguete from '@/components/BotonJuguete.vue';
import { JuegoArcade, type Marcador } from '@/game/ArcadeRuntime';
import { useAudioStore } from '@/stores/audio';
import { useProyectosStore } from '@/stores/proyectos';

type Pestana = 'escenario' | 'personaje' | 'obstaculos' | 'premios' | 'reglas' | 'juego';

const ruta = useRoute();
const router = useRouter();
const audio = useAudioStore();
const tienda = useProyectosStore();

const pestana = ref<Pestana>('escenario');
const lienzo = ref<HTMLElement | null>(null);
const jugando = ref(false);
const marcador = ref<Marcador | null>(null);
const publicando = ref(false);
const aviso = ref<string | null>(null);
const celebracion = ref<{ codigo: string; insignias: string[] } | null>(null);

let motor: JuegoArcade | null = null;

const PESTANAS: readonly { clave: Pestana; nombre: string; icono: string }[] = [
  { clave: 'escenario', nombre: 'Escenario', icono: '🖼️' },
  { clave: 'personaje', nombre: 'Personaje', icono: '🚀' },
  { clave: 'obstaculos', nombre: 'Obstaculos', icono: '☄️' },
  { clave: 'premios', nombre: 'Premios', icono: '⭐' },
  { clave: 'reglas', nombre: 'Reglas', icono: '🧩' },
  { clave: 'juego', nombre: 'Como se juega', icono: '🎮' },
];

const def = computed(() => tienda.definicion);
const catalogo = computed(() => tienda.catalogo);
const proyecto = computed(() => tienda.actual);

/** Cambia un trozo de la definición y lo manda a guardar. */
function editar(cambio: Partial<DefinicionJuego>): void {
  if (!def.value) return;
  tienda.cambiar({ ...def.value, ...cambio });
}

// ─────────────────────────────── El juego ──────────────────────────────────

async function montar(): Promise<void> {
  if (!lienzo.value || !def.value) return;

  motor ??= new JuegoArcade(lienzo.value);
  await motor.cargar(def.value, tienda.escenarioActual?.imagenUrl ?? null, {
    alCambiarMarcador: (m) => (marcador.value = m),
    alSonar: (sonido) => audio.efecto(sonido),
    alGanar: () => void alGanar(),
    alPerder: () => (jugando.value = false),
  });
}

async function probar(): Promise<void> {
  if (!def.value) return;
  // Se guarda lo que hay antes de probar: se prueba el juego de la pantalla.
  await tienda.guardar();

  jugando.value = true;
  marcador.value = null;
  aviso.value = null;

  await montar();
  motor?.reiniciar(def.value, tienda.escenarioActual?.imagenUrl ?? null, {
    alCambiarMarcador: (m) => (marcador.value = m),
    alSonar: (sonido) => audio.efecto(sonido),
    alGanar: () => void alGanar(),
    alPerder: () => (jugando.value = false),
  });

  if (def.value.musica && tienda.escenarioActual) audio.musica(tienda.escenarioActual.musica);
  void audio.narrar('ui_constructor-probar', 'Pulsa probar para jugar tu juego.');
}

async function alGanar(): Promise<void> {
  jugando.value = false;
  try {
    await tienda.marcarProbado();
    void audio.narrar(
      'ui_constructor-ganado',
      'Ganaste tu propio juego. Ya lo puedes publicar para que lo jueguen los demas.',
    );
  } catch {
    // Que el servidor no anote la prueba no debe estropear la celebración.
  }
}

const avisos = computed(() => proyecto.value?.avisos ?? []);
const puedePublicar = computed(() => proyecto.value?.probado === true);

const razonParaNoPublicar = computed(() => {
  if (puedePublicar.value) return null;
  return 'Prueba tu juego y ganalo: asi sabes que los demas tambien pueden.';
});

async function publicar(): Promise<void> {
  if (!puedePublicar.value || publicando.value) return;
  publicando.value = true;
  aviso.value = null;
  try {
    const portada = motor?.capturar() ?? null;
    const resultado = await tienda.publicar(portada);
    audio.efecto('victoria');
    void audio.narrar(
      'ui_constructor-publicado',
      'Tu juego ya esta publicado. Te ganaste el diploma de constructor de juegos de Codexia.',
    );
    celebracion.value = {
      codigo: resultado.diploma.codigo,
      // Solo las que se acaban de ganar: repetir "insignia nueva" en cada
      // publicacion la convertiria en un aviso que no significa nada.
      insignias: resultado.insignias.filter((i) => i.esNuevo === true).map((i) => i.nombre),
    };
  } catch (error) {
    aviso.value = error instanceof Error ? error.message : 'No se pudo publicar';
  } finally {
    publicando.value = false;
  }
}

// ──────────────────────── Obstáculos, premios, reglas ───────────────────────

let contador = Date.now() % 100000;
const nuevoId = (prefijo: string): string => `${prefijo}${(contador++).toString(36)}`;

function anadirObstaculo(): void {
  if (!def.value || !catalogo.value) return;
  if (def.value.obstaculos.length >= catalogo.value.limites.obstaculos) return;

  const nuevo: ObstaculoJuego = {
    id: nuevoId('o'),
    forma: 'caja',
    color: '#FF8A3D',
    tamano: 'mediano',
    velocidad: 'normal',
    frecuencia: 'media',
    movimiento: 'recto',
    seDestruye: true,
  };
  editar({ obstaculos: [...def.value.obstaculos, nuevo] });
  audio.efecto('ficha-colocada');
}

function cambiarObstaculo(id: string, cambio: Partial<ObstaculoJuego>): void {
  if (!def.value) return;
  editar({
    obstaculos: def.value.obstaculos.map((o) => (o.id === id ? { ...o, ...cambio } : o)),
  });
}

function quitarObstaculo(id: string): void {
  if (!def.value) return;
  editar({ obstaculos: def.value.obstaculos.filter((o) => o.id !== id) });
  audio.efecto('ficha-quitada');
}

function anadirPremio(): void {
  if (!def.value || !catalogo.value) return;
  if (def.value.premios.length >= catalogo.value.limites.premios) return;

  const nuevo: PremioJuego = {
    id: nuevoId('p'),
    forma: 'moneda',
    color: '#FFD93D',
    tamano: 'pequeno',
    velocidad: 'normal',
    frecuencia: 'media',
    puntos: 10,
  };
  editar({ premios: [...def.value.premios, nuevo] });
  audio.efecto('ficha-colocada');
}

function cambiarPremio(id: string, cambio: Partial<PremioJuego>): void {
  if (!def.value) return;
  editar({ premios: def.value.premios.map((p) => (p.id === id ? { ...p, ...cambio } : p)) });
}

function quitarPremio(id: string): void {
  if (!def.value) return;
  editar({ premios: def.value.premios.filter((p) => p.id !== id) });
  audio.efecto('ficha-quitada');
}

function anadirRegla(): void {
  if (!def.value || !catalogo.value) return;
  if (def.value.reglas.length >= catalogo.value.limites.reglas) return;

  const nueva: ReglaJuego = {
    id: nuevoId('r'),
    cuando: 'tocaPremio',
    entonces: 'sumarPuntos',
    cantidad: 10,
  };
  editar({ reglas: [...def.value.reglas, nueva] });
  audio.efecto('ficha-colocada');
}

function cambiarRegla(id: string, cambio: Partial<ReglaJuego>): void {
  if (!def.value) return;
  editar({ reglas: def.value.reglas.map((r) => (r.id === id ? { ...r, ...cambio } : r)) });
}

function quitarRegla(id: string): void {
  if (!def.value) return;
  editar({ reglas: def.value.reglas.filter((r) => r.id !== id) });
  audio.efecto('ficha-quitada');
}

/** Si la regla necesita un número, y qué número es. */
function reglaNecesitaUmbral(regla: ReglaJuego): boolean {
  return regla.cuando === 'puntosLleganA';
}

function reglaNecesitaCantidad(regla: ReglaJuego): boolean {
  return ['sumarPuntos', 'restarPuntos', 'quitarVida', 'darVida'].includes(regla.entonces);
}

// ──────────────────────────── Meta y control ────────────────────────────────

/**
 * Cambiar la meta ajusta también la regla de ganar por puntos.
 *
 * Sin esto, el niño sube la meta a 200, el marcador dice "Meta: 200" y el juego
 * se gana a los 100 porque la regla no se movió. Dos números para la misma idea
 * es una trampa; se mantienen en el mismo sitio.
 */
function cambiarMeta(valor: number): void {
  if (!def.value) return;
  const meta = { ...def.value.meta, valor };
  const reglas = def.value.reglas.map((r) =>
    r.cuando === 'puntosLleganA' && def.value!.meta.tipo === 'puntos' ? { ...r, umbral: valor } : r,
  );
  editar({ meta, reglas });
}

function cambiarTipoMeta(tipo: 'puntos' | 'tiempo' | 'sobrevivir'): void {
  if (!def.value) return;
  const valor = tipo === 'tiempo' ? 60 : tipo === 'puntos' ? 100 : 1;
  const reglas = def.value.reglas.map((r) =>
    r.cuando === 'puntosLleganA' ? { ...r, umbral: valor } : r,
  );
  editar({ meta: { tipo, valor }, reglas });
}

// ─────────────────────────────── Ciclo de vida ──────────────────────────────

watch(
  () => [def.value?.escenario, def.value?.jugador.personaje, def.value?.jugador.color],
  () => {
    // El lienzo se vuelve a montar al cambiar lo que se ve, pero no mientras se
    // está jugando: reiniciar la partida por tocar un color sería una tortura.
    if (!jugando.value) void montar();
  },
);

onMounted(async () => {
  const id = Number(ruta.params.id);
  await tienda.abrir(id);
  if (tienda.definicion) await montar();
});

onBeforeUnmount(() => {
  motor?.destruir();
  motor = null;
  tienda.cerrar();
});
</script>

<template>
  <main class="constructor">
    <header class="constructor__cabecera">
      <BotonJuguete
        etiqueta="Volver a mis juegos"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/proyectos')"
      />

      <div class="titulo">
        <h1>{{ proyecto?.titulo ?? 'Cargando' }}</h1>
        <button type="button" class="titulo__otro" @click="tienda.otroTitulo()">
          🎲 otro nombre
        </button>
      </div>

      <span class="constructor__guardado">
        {{ tienda.guardando ? 'Guardando...' : 'Guardado' }}
      </span>
    </header>

    <p v-if="tienda.error" class="aviso">{{ tienda.error }}</p>
    <p v-if="aviso" class="aviso">{{ aviso }}</p>

    <div v-if="def && catalogo" class="tablero">
      <!-- El juego -->
      <section class="tablero__juego">
        <div ref="lienzo" class="lienzo" />

        <div class="controles">
          <BotonJuguete
            :etiqueta="jugando ? 'Jugando...' : 'Probar mi juego'"
            icono="▶"
            tono="verde"
            tamano="lg"
            :deshabilitado="jugando"
            @pulsar="probar"
          />
          <p v-if="marcador" class="marcador">
            {{ marcador.puntos }} puntos · {{ '❤'.repeat(Math.max(0, marcador.vidas)) }}
            <span v-if="marcador.terminado === 'ganado'" class="marcador__gano">¡ganaste!</span>
            <span v-else-if="marcador.terminado === 'perdido'">fin del juego</span>
          </p>
          <p v-else class="marcador">
            {{ def.control === 'teclado' ? 'Se juega con las flechas y la barra espaciadora' : 'Se juega con el raton' }}
          </p>
        </div>

        <!-- Publicar: el final del camino, siempre visible. -->
        <div class="publicar">
          <BotonJuguete
            etiqueta="Publicar mi juego"
            icono="🏆"
            tono="magenta"
            tamano="lg"
            :deshabilitado="!puedePublicar || publicando"
            @pulsar="publicar"
          />
          <p v-if="razonParaNoPublicar" class="publicar__razon">{{ razonParaNoPublicar }}</p>
          <p v-else-if="proyecto?.estado === 'publicado'" class="publicar__razon publicar__razon--ok">
            Ya esta publicado. Puedes volver a publicar para actualizarlo.
          </p>

          <ul v-if="avisos.length > 0" class="avisos">
            <li v-for="a in avisos" :key="a.clave">⚠️ {{ a.texto }}</li>
          </ul>
        </div>
      </section>

      <!-- Los mandos -->
      <section class="tablero__mandos">
        <nav class="pestanas" aria-label="Partes del juego">
          <button
            v-for="p in PESTANAS"
            :key="p.clave"
            type="button"
            class="pestana"
            :class="{ 'pestana--activa': pestana === p.clave }"
            :aria-pressed="pestana === p.clave"
            @click="pestana = p.clave"
          >
            <span aria-hidden="true">{{ p.icono }}</span>
            <span class="pestana__texto">{{ p.nombre }}</span>
          </button>
        </nav>

        <!-- ESCENARIO -->
        <div v-if="pestana === 'escenario'" class="panel">
          <h2>¿Donde pasa tu juego?</h2>
          <div class="opciones opciones--fondos">
            <button
              v-for="e in catalogo.escenarios"
              :key="e.clave"
              type="button"
              class="fondo"
              :class="{ 'fondo--elegido': def.escenario === e.clave }"
              @click="editar({ escenario: e.clave as DefinicionJuego['escenario'] })"
            >
              <!--
                `crossorigin` no es decorativo: el motor del juego pide estas
                mismas imagenes con CORS, y si el navegador ya tiene en cache la
                respuesta de una peticion SIN CORS, reutiliza esa y la textura
                falla en silencio. El fondo salia en degradado.
              -->
              <img
                v-if="e.imagenUrl"
                :src="e.imagenUrl"
                :alt="e.nombre"
                crossorigin="anonymous"
                loading="lazy"
              />
              <span v-else class="fondo__sinimagen" aria-hidden="true">{{ e.icono }}</span>
              <span class="fondo__nombre">{{ e.nombre }}</span>
            </button>
          </div>

          <label class="interruptor">
            <input
              type="checkbox"
              :checked="def.musica"
              @change="editar({ musica: ($event.target as HTMLInputElement).checked })"
            />
            <span>Con musica</span>
          </label>
        </div>

        <!-- PERSONAJE -->
        <div v-else-if="pestana === 'personaje'" class="panel">
          <h2>¿Quien eres?</h2>
          <div class="opciones">
            <button
              v-for="p in catalogo.personajes"
              :key="p.clave"
              type="button"
              class="ficha"
              :class="{ 'ficha--elegida': def.jugador.personaje === p.clave }"
              @click="editar({ jugador: { ...def.jugador, personaje: p.clave as DefinicionJuego['jugador']['personaje'] } })"
            >
              <span class="ficha__icono" aria-hidden="true">{{ p.icono }}</span>
              <span>{{ p.nombre }}</span>
            </button>
          </div>

          <h3>Tu color</h3>
          <div class="colores">
            <button
              v-for="c in catalogo.colores"
              :key="c"
              type="button"
              class="color"
              :class="{ 'color--elegido': def.jugador.color === c }"
              :style="{ background: c }"
              :aria-label="`Color ${c}`"
              @click="editar({ jugador: { ...def.jugador, color: c } })"
            />
          </div>

          <h3>Que tan rapido te mueves</h3>
          <div class="opciones opciones--linea">
            <button
              v-for="v in catalogo.velocidades"
              :key="v.clave"
              type="button"
              class="pastilla"
              :class="{ 'pastilla--elegida': def.jugador.velocidad === v.clave }"
              @click="editar({ jugador: { ...def.jugador, velocidad: v.clave as DefinicionJuego['jugador']['velocidad'] } })"
            >
              {{ v.nombre }}
            </button>
          </div>

          <h3>Vidas: {{ def.jugador.vidas }}</h3>
          <input
            type="range"
            min="1"
            :max="catalogo.limites.vidasMax"
            :value="def.jugador.vidas"
            @input="editar({ jugador: { ...def.jugador, vidas: Number(($event.target as HTMLInputElement).value) } })"
          />

          <label class="interruptor">
            <input
              type="checkbox"
              :checked="def.jugador.dispara"
              @change="editar({ jugador: { ...def.jugador, dispara: ($event.target as HTMLInputElement).checked } })"
            />
            <span>Puedo disparar</span>
          </label>
        </div>

        <!-- OBSTACULOS -->
        <div v-else-if="pestana === 'obstaculos'" class="panel">
          <h2>¿Que te estorba?</h2>

          <article v-for="o in def.obstaculos" :key="o.id" class="bloque">
            <header class="bloque__cabecera">
              <strong>{{ tienda.nombreDe(catalogo.obstaculos, o.forma) }}</strong>
              <button type="button" class="quitar" @click="quitarObstaculo(o.id)">🗑️</button>
            </header>

            <div class="opciones opciones--linea">
              <button
                v-for="f in catalogo.obstaculos"
                :key="f.clave"
                type="button"
                class="mini"
                :class="{ 'mini--elegida': o.forma === f.clave }"
                :title="f.nombre"
                @click="cambiarObstaculo(o.id, { forma: f.clave as ObstaculoJuego['forma'] })"
              >
                {{ f.icono }}
              </button>
            </div>

            <div class="colores colores--mini">
              <button
                v-for="c in catalogo.colores"
                :key="c"
                type="button"
                class="color color--mini"
                :class="{ 'color--elegido': o.color === c }"
                :style="{ background: c }"
                :aria-label="`Color ${c}`"
                @click="cambiarObstaculo(o.id, { color: c })"
              />
            </div>

            <div class="filas">
              <label>
                <span>Tamano</span>
                <select
                  :value="o.tamano"
                  @change="cambiarObstaculo(o.id, { tamano: ($event.target as HTMLSelectElement).value as ObstaculoJuego['tamano'] })"
                >
                  <option v-for="t in catalogo.tamanos" :key="t.clave" :value="t.clave">{{ t.nombre }}</option>
                </select>
              </label>
              <label>
                <span>Velocidad</span>
                <select
                  :value="o.velocidad"
                  @change="cambiarObstaculo(o.id, { velocidad: ($event.target as HTMLSelectElement).value as ObstaculoJuego['velocidad'] })"
                >
                  <option v-for="v in catalogo.velocidades" :key="v.clave" :value="v.clave">{{ v.nombre }}</option>
                </select>
              </label>
              <label>
                <span>Cuantos</span>
                <select
                  :value="o.frecuencia"
                  @change="cambiarObstaculo(o.id, { frecuencia: ($event.target as HTMLSelectElement).value as ObstaculoJuego['frecuencia'] })"
                >
                  <option v-for="f in catalogo.frecuencias" :key="f.clave" :value="f.clave">{{ f.nombre }}</option>
                </select>
              </label>
              <label>
                <span>Como viene</span>
                <select
                  :value="o.movimiento"
                  @change="cambiarObstaculo(o.id, { movimiento: ($event.target as HTMLSelectElement).value as ObstaculoJuego['movimiento'] })"
                >
                  <option v-for="m in catalogo.movimientos" :key="m.clave" :value="m.clave">{{ m.nombre }}</option>
                </select>
              </label>
            </div>

            <label class="interruptor">
              <input
                type="checkbox"
                :checked="o.seDestruye"
                @change="cambiarObstaculo(o.id, { seDestruye: ($event.target as HTMLInputElement).checked })"
              />
              <span>Se puede destruir disparando</span>
            </label>
          </article>

          <BotonJuguete
            v-if="def.obstaculos.length < catalogo.limites.obstaculos"
            etiqueta="Anadir obstaculo"
            icono="＋"
            tono="azul"
            @pulsar="anadirObstaculo"
          />
          <p v-else class="tope">Ya tienes {{ catalogo.limites.obstaculos }}: son los que caben sin marear.</p>
        </div>

        <!-- PREMIOS -->
        <div v-else-if="pestana === 'premios'" class="panel">
          <h2>¿Que recoges?</h2>

          <article v-for="p in def.premios" :key="p.id" class="bloque">
            <header class="bloque__cabecera">
              <strong>{{ tienda.nombreDe(catalogo.premios, p.forma) }} · {{ p.puntos }} puntos</strong>
              <button type="button" class="quitar" @click="quitarPremio(p.id)">🗑️</button>
            </header>

            <div class="opciones opciones--linea">
              <button
                v-for="f in catalogo.premios"
                :key="f.clave"
                type="button"
                class="mini"
                :class="{ 'mini--elegida': p.forma === f.clave }"
                :title="f.nombre"
                @click="cambiarPremio(p.id, { forma: f.clave as PremioJuego['forma'] })"
              >
                {{ f.icono }}
              </button>
            </div>

            <div class="colores colores--mini">
              <button
                v-for="c in catalogo.colores"
                :key="c"
                type="button"
                class="color color--mini"
                :class="{ 'color--elegido': p.color === c }"
                :style="{ background: c }"
                :aria-label="`Color ${c}`"
                @click="cambiarPremio(p.id, { color: c })"
              />
            </div>

            <div class="filas">
              <label>
                <span>Cuantos</span>
                <select
                  :value="p.frecuencia"
                  @change="cambiarPremio(p.id, { frecuencia: ($event.target as HTMLSelectElement).value as PremioJuego['frecuencia'] })"
                >
                  <option v-for="f in catalogo.frecuencias" :key="f.clave" :value="f.clave">{{ f.nombre }}</option>
                </select>
              </label>
              <label>
                <span>Puntos: {{ p.puntos }}</span>
                <input
                  type="range"
                  min="1"
                  :max="catalogo.limites.puntosPorPremio"
                  :value="p.puntos"
                  @input="cambiarPremio(p.id, { puntos: Number(($event.target as HTMLInputElement).value) })"
                />
              </label>
            </div>
          </article>

          <BotonJuguete
            v-if="def.premios.length < catalogo.limites.premios"
            etiqueta="Anadir premio"
            icono="＋"
            tono="amarillo"
            @pulsar="anadirPremio"
          />
        </div>

        <!-- REGLAS -->
        <div v-else-if="pestana === 'reglas'" class="panel">
          <h2>Las reglas de tu juego</h2>
          <p class="explicacion">
            Cada regla se lee como una frase: <em>cuando</em> pasa algo, <em>entonces</em> ocurre
            otra cosa. Esto es programar.
          </p>

          <article v-for="r in def.reglas" :key="r.id" class="regla">
            <div class="regla__linea">
              <span class="regla__palabra">Cuando</span>
              <select
                :value="r.cuando"
                @change="cambiarRegla(r.id, { cuando: ($event.target as HTMLSelectElement).value as ReglaJuego['cuando'] })"
              >
                <option v-for="e in catalogo.eventos" :key="e.clave" :value="e.clave">
                  {{ e.icono }} {{ e.nombre }}
                </option>
              </select>
            </div>

            <div v-if="reglaNecesitaUmbral(r)" class="regla__linea">
              <span class="regla__palabra">y son</span>
              <input
                type="number"
                min="1"
                :max="catalogo.limites.puntosMeta"
                :value="r.umbral ?? 100"
                @change="cambiarRegla(r.id, { umbral: Number(($event.target as HTMLInputElement).value) })"
              />
              <span class="regla__palabra">puntos</span>
            </div>

            <div class="regla__linea">
              <span class="regla__palabra">entonces</span>
              <select
                :value="r.entonces"
                @change="cambiarRegla(r.id, { entonces: ($event.target as HTMLSelectElement).value as ReglaJuego['entonces'] })"
              >
                <option v-for="a in catalogo.acciones" :key="a.clave" :value="a.clave">
                  {{ a.icono }} {{ a.nombre }}
                </option>
              </select>
              <input
                v-if="reglaNecesitaCantidad(r)"
                type="number"
                min="1"
                :max="catalogo.limites.puntosPorPremio"
                :value="r.cantidad ?? 10"
                @change="cambiarRegla(r.id, { cantidad: Number(($event.target as HTMLInputElement).value) })"
              />
              <button type="button" class="quitar" @click="quitarRegla(r.id)">🗑️</button>
            </div>
          </article>

          <BotonJuguete
            v-if="def.reglas.length < catalogo.limites.reglas"
            etiqueta="Anadir regla"
            icono="＋"
            tono="morado"
            @pulsar="anadirRegla"
          />
        </div>

        <!-- COMO SE JUEGA -->
        <div v-else class="panel">
          <h2>¿Como se juega?</h2>
          <div class="opciones">
            <button
              v-for="c in catalogo.controles"
              :key="c.clave"
              type="button"
              class="ficha ficha--ancha"
              :class="{ 'ficha--elegida': def.control === c.clave }"
              @click="editar({ control: c.clave as DefinicionJuego['control'] })"
            >
              <span class="ficha__icono" aria-hidden="true">{{ c.icono }}</span>
              <span>
                <strong>{{ c.nombre }}</strong>
                <small>{{ c.pista }}</small>
              </span>
            </button>
          </div>

          <h3>¿Como se gana?</h3>
          <div class="opciones">
            <button
              v-for="m in catalogo.metas"
              :key="m.clave"
              type="button"
              class="ficha ficha--ancha"
              :class="{ 'ficha--elegida': def.meta.tipo === m.clave }"
              @click="cambiarTipoMeta(m.clave as 'puntos' | 'tiempo' | 'sobrevivir')"
            >
              <span class="ficha__icono" aria-hidden="true">{{ m.icono }}</span>
              <span>{{ m.nombre }}</span>
            </button>
          </div>

          <template v-if="def.meta.tipo !== 'sobrevivir'">
            <h3>
              {{ def.meta.tipo === 'puntos' ? `Puntos para ganar: ${def.meta.valor}` : `Segundos: ${def.meta.valor}` }}
            </h3>
            <input
              type="range"
              :min="def.meta.tipo === 'puntos' ? 10 : 10"
              :max="def.meta.tipo === 'puntos' ? 500 : catalogo.limites.segundosMeta"
              :step="10"
              :value="def.meta.valor"
              @input="cambiarMeta(Number(($event.target as HTMLInputElement).value))"
            />
          </template>
        </div>
      </section>
    </div>

    <p v-else class="aviso">Abriendo tu juego...</p>

    <!-- Celebración de la publicación: diploma e insignia -->
    <div v-if="celebracion" class="celebracion" role="dialog" aria-label="Juego publicado">
      <div class="celebracion__caja">
        <span class="celebracion__sello" aria-hidden="true">🏆</span>
        <h2>¡Publicado!</h2>
        <p>Tu juego ya esta en la zona de juegos y te ganaste tu diploma.</p>
        <p v-if="celebracion.insignias.length > 0" class="celebracion__insignia">
          Insignia nueva: <strong>{{ celebracion.insignias.join(', ') }}</strong>
        </p>
        <div class="celebracion__botones">
          <BotonJuguete
            etiqueta="Ver mi diploma"
            icono="🎓"
            tono="amarillo"
            tamano="lg"
            @pulsar="router.push(`/diploma/${celebracion.codigo}`)"
          />
          <BotonJuguete
            etiqueta="Seguir aqui"
            icono="✓"
            tono="neutro"
            @pulsar="celebracion = null"
          />
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.constructor {
  max-width: 1400px;
  margin: 0 auto;
  padding: 14px 14px 40px;
}

.constructor__cabecera {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.titulo {
  flex: 1;
  text-align: center;
}

.titulo h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-xl);
}

.titulo__otro {
  border: 0;
  background: none;
  color: #64748b;
  font: inherit;
  font-size: var(--texto-sm);
  cursor: pointer;
  text-decoration: underline;
}

.constructor__guardado {
  font-size: var(--texto-sm);
  color: #94a3b8;
  min-width: 90px;
  text-align: right;
}

.tablero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 16px;
  align-items: start;
}

.tablero__juego {
  display: grid;
  gap: 12px;
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

.controles,
.publicar {
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
}

.marcador {
  margin: 0;
  font-family: var(--fuente-titulo);
  color: #475569;
}

.marcador__gano {
  color: var(--verde-cesped, #16a34a);
}

.publicar__razon {
  margin: 0;
  font-size: var(--texto-sm);
  color: #94a3b8;
  max-width: 42ch;
}

.publicar__razon--ok {
  color: var(--verde-cesped, #16a34a);
}

.avisos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
  font-size: var(--texto-sm);
  color: #b45309;
  text-align: left;
}

/* ── Mandos ── */

.tablero__mandos {
  background: #fff;
  border-radius: 20px;
  padding: 12px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
}

.pestanas {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.pestana {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 74px;
  padding: 8px 6px;
  border: 0;
  border-radius: 14px;
  background: #f1f5f9;
  font: inherit;
  font-size: 20px;
  color: #475569;
  cursor: pointer;
}

.pestana__texto {
  font-size: 11px;
}

.pestana--activa {
  background: var(--azul-neon, #1fa2ff);
  color: #fff;
}

.panel {
  display: grid;
  gap: 10px;
  max-height: 62vh;
  overflow-y: auto;
  padding: 4px 2px;
}

.panel h2 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.panel h3 {
  margin: 6px 0 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-base);
  color: #475569;
}

.explicacion {
  margin: 0;
  font-size: var(--texto-sm);
  color: #64748b;
}

.opciones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
}

.opciones--fondos {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.opciones--linea {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fondo {
  position: relative;
  border: 3px solid transparent;
  border-radius: 14px;
  overflow: hidden;
  padding: 0;
  background: #e2e8f0;
  cursor: pointer;
  aspect-ratio: 16 / 9;
}

.fondo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fondo__sinimagen {
  font-size: 30px;
}

.fondo__nombre {
  position: absolute;
  inset: auto 0 0 0;
  background: rgb(15 23 42 / 0.65);
  color: #fff;
  font-size: 11px;
  padding: 2px 0;
}

.fondo--elegido {
  border-color: var(--verde-cesped, #5ad35a);
}

.ficha {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border: 3px solid transparent;
  border-radius: 14px;
  background: #f8fafc;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.ficha--ancha {
  flex-direction: row;
  gap: 10px;
  text-align: left;
  grid-column: 1 / -1;
  padding: 10px 12px;
}

.ficha--ancha small {
  display: block;
  color: #64748b;
  font-size: 11px;
}

.ficha__icono {
  font-size: 26px;
}

.ficha--elegida {
  border-color: var(--azul-neon, #1fa2ff);
  background: #eff8ff;
}

.mini {
  width: 42px;
  height: 42px;
  border: 3px solid transparent;
  border-radius: 12px;
  background: #f1f5f9;
  font-size: 20px;
  cursor: pointer;
}

.mini--elegida {
  border-color: var(--azul-neon, #1fa2ff);
}

.colores {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.color {
  width: 34px;
  height: 34px;
  border: 3px solid #e2e8f0;
  border-radius: 50%;
  cursor: pointer;
}

.color--mini {
  width: 24px;
  height: 24px;
}

.color--elegido {
  border-color: #1e293b;
  transform: scale(1.12);
}

.pastilla {
  padding: 8px 14px;
  border: 0;
  border-radius: 999px;
  background: #f1f5f9;
  font: inherit;
  cursor: pointer;
}

.pastilla--elegida {
  background: var(--azul-neon, #1fa2ff);
  color: #fff;
}

.bloque,
.regla {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  background: #f8fafc;
}

.bloque__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--fuente-titulo);
}

.quitar {
  border: 0;
  background: none;
  font-size: 18px;
  cursor: pointer;
}

.filas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
}

.filas label,
.interruptor {
  display: grid;
  gap: 2px;
  font-size: var(--texto-sm);
  color: #475569;
}

.interruptor {
  display: flex;
  align-items: center;
  gap: 8px;
}

select,
input[type='number'] {
  min-height: 40px;
  padding: 0 8px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font: inherit;
  background: #fff;
}

input[type='number'] {
  width: 84px;
}

input[type='range'] {
  width: 100%;
}

.regla__linea {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.regla__palabra {
  font-family: var(--fuente-titulo);
  color: #7b61ff;
}

.tope {
  margin: 0;
  font-size: var(--texto-sm);
  color: #94a3b8;
}

/* ── Celebración ── */

.celebracion {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 0.55);
  z-index: 50;
  padding: 20px;
}

.celebracion__caja {
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  max-width: 460px;
  padding: 28px 24px;
  border-radius: 26px;
  background: #fffdf5;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.15);
}

.celebracion__sello {
  font-size: 60px;
}

.celebracion__caja h2 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
}

.celebracion__insignia {
  margin: 0;
  color: #7b61ff;
}

.celebracion__botones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 6px;
}

.aviso {
  text-align: center;
  color: #64748b;
}

@media (max-width: 1000px) {
  .tablero {
    grid-template-columns: 1fr;
  }

  .panel {
    max-height: none;
  }
}
</style>
