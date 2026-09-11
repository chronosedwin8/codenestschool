<script setup lang="ts">
/**
 * Pantalla de entrada.
 *
 * Un niño de cuatro años no escribe una contraseña. Tampoco tiene correo. Así
 * que hay dos accesos distintos:
 *
 *  - Niños: eligen su nombre de una lista si el tutor lo dejó recordado, o lo
 *    teclea el adulto una vez, y después toca cuatro dibujos en orden. Un PIN de
 *    imágenes se recuerda igual que una contraseña, pero se puede usar sin leer.
 *  - Adultos: correo y contraseña, como en cualquier sitio.
 *
 * La seguridad del PIN no está en su longitud, sino en que hay que conocer el
 * nombre de usuario del niño y en que el servidor limita los intentos.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BotonJuguete from '@/components/BotonJuguete.vue';
import FuzzAvatar from '@/components/FuzzAvatar.vue';
import { api, guardarToken } from '@/api/cliente';
import { useAudioStore } from '@/stores/audio';

/** Los dibujos del PIN. Son objetos que un niño de cuatro años reconoce y nombra. */
const DIBUJOS = [
  { id: 'gato', emoji: '🐱', nombre: 'gato' },
  { id: 'sol', emoji: '☀️', nombre: 'sol' },
  { id: 'arbol', emoji: '🌳', nombre: 'arbol' },
  { id: 'luna', emoji: '🌙', nombre: 'luna' },
  { id: 'pez', emoji: '🐟', nombre: 'pez' },
  { id: 'flor', emoji: '🌸', nombre: 'flor' },
  { id: 'nube', emoji: '☁️', nombre: 'nube' },
  { id: 'tren', emoji: '🚂', nombre: 'tren' },
  { id: 'pato', emoji: '🦆', nombre: 'pato' },
] as const;

const LONGITUD_PIN = 4;
const CLAVE_RECORDADOS = 'codenest.ninos-recordados';

const ruta = useRoute();
const router = useRouter();
const audio = useAudioStore();

const modo = ref<'nino' | 'adulto'>('nino');
const usuario = ref('');
const pin = ref<string[]>([]);
const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const enviando = ref(false);

/** Niños que ya han entrado en este dispositivo: evita teclear el usuario. */
const recordados = ref<string[]>([]);

const pinCompleto = computed(() => pin.value.length === LONGITUD_PIN);

function cargarRecordados(): void {
  try {
    const guardado = localStorage.getItem(CLAVE_RECORDADOS);
    recordados.value = guardado ? (JSON.parse(guardado) as string[]) : [];
  } catch {
    recordados.value = [];
  }
}

function recordar(nombreUsuario: string): void {
  try {
    const lista = [...new Set([nombreUsuario, ...recordados.value])].slice(0, 6);
    localStorage.setItem(CLAVE_RECORDADOS, JSON.stringify(lista));
    recordados.value = lista;
  } catch {
    // Sin almacenamiento no se recuerda; el acceso sigue funcionando.
  }
}

function tocarDibujo(id: string): void {
  if (pin.value.length >= LONGITUD_PIN) return;
  audio.desbloquear();
  audio.efecto('boton');
  pin.value = [...pin.value, id];
  // Al completar los cuatro dibujos se entra sin pulsar nada más.
  if (pin.value.length === LONGITUD_PIN) void entrarComoNino();
}

function borrarUltimo(): void {
  pin.value = pin.value.slice(0, -1);
  audio.efecto('ficha-quitada');
}

async function entrarComoNino(): Promise<void> {
  if (!usuario.value.trim() || !pinCompleto.value || enviando.value) return;

  enviando.value = true;
  error.value = null;

  try {
    const respuesta = await api.post<{ token: string; usuario: { nombre: string } }>(
      '/auth/login-nino',
      { usuario: usuario.value.trim(), pin: pin.value },
    );

    guardarToken(respuesta.token);
    recordar(usuario.value.trim());
    audio.efecto('victoria');
    await router.push((ruta.query.volverA as string) || '/mapa');
  } catch {
    // Nunca se dice si el fallo fue el nombre o los dibujos.
    error.value = 'Esos dibujos no son. Intentalo otra vez.';
    pin.value = [];
    audio.efecto('choque');
    void audio.narrar('ui_intentalo-otra-vez', 'Esos dibujos no son. Intentalo otra vez.');
  } finally {
    enviando.value = false;
  }
}

/**
 * Donde aterriza cada adulto al entrar.
 *
 * Antes todos caian en el mapa del juego, que es la pantalla de un niño: un
 * docente entraba y se encontraba treinta mundos que no puede jugar, sin una
 * sola pista de que existiera una zona para el. La zona estaba construida y no
 * habia forma de llegar salvo escribiendo la direccion a mano.
 */
function inicioSegunRol(rol: string | undefined): string {
  if (rol === 'docente' || rol === 'admin_escuela' || rol === 'admin') return '/portal/docente';
  return '/portal';
}

async function entrarComoAdulto(): Promise<void> {
  if (!email.value || !password.value || enviando.value) return;

  enviando.value = true;
  error.value = null;

  try {
    const respuesta = await api.post<{ token: string; usuario: { rol: string } }>('/auth/login', {
      email: email.value,
      password: password.value,
    });
    guardarToken(respuesta.token);
    await router.push((ruta.query.volverA as string) || inicioSegunRol(respuesta.usuario?.rol));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo entrar';
  } finally {
    enviando.value = false;
  }
}

onMounted(() => {
  cargarRecordados();
  void audio.narrar('ui_bienvenida', 'Hola, soy Nube. Bienvenido a CodeNest. Vamos a jugar y a programar.');
});
</script>

<template>
  <main class="entrar">
    <FuzzAvatar :tamano="150" expresion="feliz" />
    <h1>CodeNest School</h1>

    <!-- Acceso de niños -->
    <section v-if="modo === 'nino'" class="tarjeta">
      <!-- Si ya entró antes en esta tableta, basta con tocar su nombre. -->
      <div v-if="recordados.length > 0 && !usuario" class="conocidos">
        <p class="etiqueta">¿Quien juega?</p>
        <div class="fila">
          <BotonJuguete
            v-for="nombre in recordados"
            :key="nombre"
            :etiqueta="nombre"
            tono="azul"
            @pulsar="usuario = nombre"
          />
        </div>
      </div>

      <label v-else class="campo">
        <span class="etiqueta">Tu nombre de jugador</span>
        <input
          v-model="usuario"
          type="text"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          placeholder="sofia.g"
        />
      </label>

      <template v-if="usuario">
        <p class="instruccion">Toca tus cuatro dibujos</p>

        <!-- Huecos del PIN: se ve cuántos faltan sin necesidad de leer. -->
        <div class="pin" role="status" :aria-label="`${pin.length} de ${LONGITUD_PIN} dibujos`">
          <span
            v-for="i in LONGITUD_PIN"
            :key="i"
            class="pin__hueco"
            :class="{ 'pin__hueco--lleno': pin[i - 1] }"
          >
            {{ pin[i - 1] ? DIBUJOS.find((d) => d.id === pin[i - 1])?.emoji : '' }}
          </span>
        </div>

        <div class="dibujos">
          <button
            v-for="dibujo in DIBUJOS"
            :key="dibujo.id"
            type="button"
            class="dibujo"
            :aria-label="dibujo.nombre"
            :disabled="enviando"
            @click="tocarDibujo(dibujo.id)"
          >
            {{ dibujo.emoji }}
          </button>
        </div>

        <div class="fila fila--centrada">
          <BotonJuguete
            v-if="pin.length > 0"
            etiqueta="Borrar el ultimo"
            icono="⌫"
            tono="neutro"
            solo-icono
            @pulsar="borrarUltimo"
          />
          <BotonJuguete etiqueta="Cambiar de jugador" tono="neutro" tamano="sm" @pulsar="usuario = ''" />
        </div>
      </template>
    </section>

    <!-- Acceso de adultos -->
    <section v-else class="tarjeta">
      <label class="campo">
        <span class="etiqueta">Correo</span>
        <input v-model="email" type="email" autocomplete="email" />
      </label>
      <label class="campo">
        <span class="etiqueta">Contrasena</span>
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <BotonJuguete
        etiqueta="Entrar"
        tono="verde"
        tamano="lg"
        :deshabilitado="enviando"
        @pulsar="entrarComoAdulto"
      />
    </section>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <button type="button" class="cambiar" @click="modo = modo === 'nino' ? 'adulto' : 'nino'">
      {{ modo === 'nino' ? 'Soy un adulto' : 'Soy un nino' }}
    </button>
  </main>
</template>

<style scoped>
.entrar {
  display: grid;
  gap: var(--espacio-4);
  justify-items: center;
  min-height: 100vh;
  padding: var(--espacio-5) var(--espacio-4);
  text-align: center;
}

.entrar h1 {
  margin: 0;
}

.tarjeta {
  display: grid;
  gap: var(--espacio-4);
  justify-items: center;
  width: 100%;
  max-width: 460px;
  padding: var(--espacio-5);
  background: rgb(255 255 255 / 0.78);
  border-radius: var(--radio-xl);
  box-shadow: var(--sombra-panel);
}

.campo {
  display: grid;
  gap: var(--espacio-2);
  width: 100%;
  text-align: left;
}

.campo input {
  min-height: 56px;
  padding: 0 var(--espacio-4);
  font-family: var(--fuente-texto);
  font-size: var(--texto-base);
  font-weight: 700;
  background: white;
  border: 3px solid var(--gris-claro);
  border-radius: var(--radio-md);
}

.campo input:focus {
  border-color: var(--azul-neon);
  outline: none;
}

.etiqueta {
  font-size: var(--texto-xs);
  color: var(--gris-oscuro);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.instruccion {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

/* Huecos del PIN: cuatro casillas que se van llenando. */
.pin {
  display: flex;
  gap: var(--espacio-3);
}

.pin__hueco {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  font-size: 30px;
  background: var(--gris-claro);
  border: 3px dashed var(--gris-medio);
  border-radius: var(--radio-md);
}

.pin__hueco--lleno {
  background: rgb(90 211 90 / 0.25);
  border-style: solid;
  border-color: var(--verde-cesped);
}

/* Los dibujos: nueve objetos grandes, en cuadrícula de tres por tres. */
.dibujos {
  display: grid;
  gap: var(--espacio-3);
  grid-template-columns: repeat(3, 1fr);
}

.dibujo {
  display: grid;
  place-items: center;
  width: var(--toque-comodo);
  height: var(--toque-comodo);
  font-size: 40px;
  background: white;
  border: none;
  border-bottom: 5px solid var(--gris-claro);
  border-radius: var(--radio-lg);
  box-shadow: var(--relieve);
  transition: transform var(--rapido) var(--rebote);
}

.dibujo:active {
  transform: translateY(5px);
  box-shadow: none;
}

.dibujo:disabled {
  opacity: 0.5;
}

.fila {
  display: flex;
  flex-wrap: wrap;
  gap: var(--espacio-3);
}

.fila--centrada {
  justify-content: center;
}

.conocidos {
  display: grid;
  gap: var(--espacio-3);
  justify-items: center;
}

.error {
  max-width: 30ch;
  margin: 0;
  padding: var(--espacio-3) var(--espacio-4);
  color: #8a2020;
  background: rgb(239 68 68 / 0.15);
  border-radius: var(--radio-md);
}

.cambiar {
  padding: var(--espacio-2) var(--espacio-4);
  font-family: var(--fuente-texto);
  font-size: var(--texto-sm);
  color: var(--gris-oscuro);
  background: none;
  border: none;
  text-decoration: underline;
}
</style>
