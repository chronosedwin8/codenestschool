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
/** Si el colegio tiene montado el acceso con Microsoft. */
const sso = ref<{ activo: boolean; obligatorio: boolean; dominios: string[] }>({
  activo: false,
  obligatorio: false,
  dominios: [],
});
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

/**
 * Por que un correo del colegio no pudo entrar.
 *
 * Los codigos vienen del servidor y son cortos a proposito: un fallo de
 * identidad no cuenta sus detalles en pantalla. Aqui se traducen a algo que un
 * docente pueda leer y sepa que hacer con ello.
 */
const MOTIVOS_SSO: Record<string, string> = {
  'sin-cuenta': 'Tu correo del colegio todavia no tiene cuenta aqui. Pidesela al administrador.',
  dominio: 'Esa cuenta no es del colegio.',
  inquilino: 'Esa cuenta no es del colegio.',
  'sin-correo': 'Esa cuenta de Microsoft no tiene correo.',
  inactiva: 'Tu cuenta esta desactivada. Habla con el administrador.',
  cancelado: 'Se cancelo la entrada con Microsoft.',
  state: 'La entrada tardo demasiado. Intentalo otra vez.',
  nonce: 'La entrada no coincidio. Intentalo otra vez.',
  'no-configurado': 'El acceso con la cuenta del colegio no esta activo.',
};

/** Lee el rol del token sin verificarlo: solo decide a que pantalla se va. */
function rolDelToken(token: string): string | undefined {
  try {
    const carga = token.split('.')[1];
    if (!carga) return undefined;
    const json = atob(carga.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { rol?: string }).rol;
  } catch {
    return undefined;
  }
}

/**
 * Recoge la sesion que deja Microsoft en el fragmento de la URL.
 *
 * Viene en `#sso=...` y no en `?token=...` porque el fragmento no viaja al
 * servidor ni queda en sus registros. Lo primero que se hace despues de leerlo
 * es borrarlo de la barra de direcciones: un token en el historial del navegador
 * de una sala de profesores es un token compartido.
 */
async function recogerRetornoSso(): Promise<boolean> {
  const bruto = window.location.hash.replace(/^#/, '');
  if (!bruto) return false;

  const datos = new URLSearchParams(bruto);
  const token = datos.get('sso');
  const fallo = datos.get('sso-error');
  if (!token && !fallo) return false;

  history.replaceState(null, '', window.location.pathname + window.location.search);

  if (fallo) {
    error.value = MOTIVOS_SSO[fallo] ?? 'No se pudo entrar con la cuenta del colegio.';
    modo.value = 'adulto';
    return false;
  }
  if (!token) return false;

  // Un token que ni siquiera se puede leer no se guarda. Guardarlo dejaba al
  // docente "dentro" con una sesion rota: el portal le pedia entrar otra vez sin
  // explicar nada, que es peor que decirle que la entrada fallo.
  const rol = rolDelToken(token);
  if (!rol) {
    error.value = 'No se pudo entrar con la cuenta del colegio.';
    modo.value = 'adulto';
    return false;
  }

  guardarToken(token);
  await router.push(datos.get('volverA') ?? inicioSegunRol(rol));
  return true;
}

function entrarConElColegio(): void {
  const volverA = (ruta.query.volverA as string) || '';
  const parametros = volverA ? `?volverA=${encodeURIComponent(volverA)}` : '';
  // Es una navegacion de verdad, no una peticion: el navegador tiene que salir
  // hacia Microsoft y volver. Con fetch no habria pantalla donde autenticarse.
  window.location.assign(`/api/auth/sso/inicio${parametros}`);
}

onMounted(async () => {
  cargarRecordados();

  // Si venimos de Microsoft, esto navega y lo demas ya da igual.
  if (await recogerRetornoSso()) return;

  try {
    sso.value = await api.get<{ activo: boolean; obligatorio: boolean; dominios: string[] }>(
      '/auth/sso/estado',
    );
  } catch {
    // Sin respuesta se asume que no hay SSO: se entra con contrasena, como antes.
  }

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
      <!--
        El acceso del colegio va PRIMERO: en el Colegio Aleman es el camino de
        casi todos, y ponerlo debajo del formulario invita a teclear una
        contrasena que la mitad de los docentes ni siquiera tiene.
      -->
      <template v-if="sso.activo">
        <BotonJuguete
          etiqueta="Entrar con el correo del colegio"
          icono="🏫"
          tono="azul"
          tamano="lg"
          @pulsar="entrarConElColegio"
        />
        <p class="dominio">
          Con tu cuenta
          <strong>@{{ sso.dominios[0] }}</strong>
          de Microsoft.
        </p>
      </template>

      <template v-if="!sso.obligatorio">
        <p v-if="sso.activo" class="separador"><span>o con tu contrasena</span></p>

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
      </template>
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

.dominio {
  margin: 0;
  font-size: var(--texto-sm);
  color: var(--gris-texto, #64748b);
}

/* Una linea con el "o" en medio: separa dos formas de entrar, no dos secciones. */
.separador {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  width: 100%;
  margin: 0;
  color: var(--gris-texto, #94a3b8);
  font-size: var(--texto-sm);
}

.separador::before,
.separador::after {
  content: '';
  flex: 1;
  height: 2px;
  background: var(--gris-claro, #e2e8f0);
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
