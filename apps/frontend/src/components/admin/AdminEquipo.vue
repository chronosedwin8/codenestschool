<script setup lang="ts">
/**
 * El equipo: docentes y administradores.
 *
 * Crear un docente aqui es lo que faltaba para montar un colegio sin tocar la
 * base de datos. La contrasena temporal se muestra UNA vez y no se guarda en
 * claro en ningun sitio; si el colegio tiene SSO, el docente puede entrar
 * directamente con su correo de Microsoft y no necesitarla.
 *
 * Los estudiantes y las familias no salen aqui: nacen de una compra o del alta
 * que hace su docente en su grupo.
 */
import { computed, onMounted, reactive, ref } from 'vue';

import { api } from '@/api/cliente';
import { fecha } from '@/components/facturacion/formato';

interface Miembro {
  id: number;
  nombre: string;
  email: string | null;
  rol: 'docente' | 'admin_escuela' | 'admin';
  activo: boolean;
  entraCon: string;
  institucion: { id: number; nombre: string } | null;
  aulas: number;
  creadoEn: string;
  ultimaActividad: string | null;
}

interface Institucion {
  id: number;
  nombre: string;
  ciudad: string | null;
  personas: number;
}

const ROLES = [
  { clave: 'docente', nombre: 'Docente', explica: 'Sus grupos, sus estudiantes y el seguimiento.' },
  { clave: 'admin_escuela', nombre: 'Administrador del colegio', explica: 'Todo lo del colegio: sedes, docentes y aulas.' },
  { clave: 'admin', nombre: 'Administrador de la plataforma', explica: 'Todo, incluidos precios, pagos y facturas.' },
] as const;

const miembros = ref<Miembro[]>([]);
const instituciones = ref<Institucion[]>([]);
const mensaje = ref<{ tono: 'bien' | 'mal'; texto: string } | null>(null);
const ocupado = ref<number | null>(null);
const creando = ref(false);
const error = ref<string | null>(null);

/** Se muestra una sola vez y desaparece al cerrarla. */
const credenciales = ref<{ nombre: string; email: string; passwordTemporal: string } | null>(null);

const nuevo = reactive({
  abierto: false,
  nombre: '',
  email: '',
  rol: 'docente' as Miembro['rol'],
  institucionId: null as number | null,
});

const docentes = computed(() => miembros.value.filter((m) => m.rol === 'docente').length);

async function cargar(): Promise<void> {
  const [e, i] = await Promise.all([
    api.get<{ miembros: Miembro[] }>('/admin/equipo'),
    api.get<{ instituciones: Institucion[] }>('/admin/instituciones'),
  ]);
  miembros.value = e.miembros;
  instituciones.value = i.instituciones;
}

function etiquetaRol(rol: string): string {
  return ROLES.find((r) => r.clave === rol)?.nombre ?? rol;
}

async function crear(): Promise<void> {
  creando.value = true;
  error.value = null;
  try {
    const r = await api.post<{ miembro: Miembro; passwordTemporal: string }>('/admin/equipo', {
      nombre: nuevo.nombre.trim(),
      email: nuevo.email.trim().toLowerCase(),
      rol: nuevo.rol,
      institucionId: nuevo.institucionId,
    });
    credenciales.value = {
      nombre: r.miembro.nombre,
      email: r.miembro.email ?? nuevo.email,
      passwordTemporal: r.passwordTemporal,
    };
    nuevo.abierto = false;
    nuevo.nombre = '';
    nuevo.email = '';
    await cargar();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo crear';
  } finally {
    creando.value = false;
  }
}

async function cambiar(m: Miembro, cambios: Record<string, unknown>): Promise<void> {
  ocupado.value = m.id;
  mensaje.value = null;
  try {
    await api.patch(`/admin/equipo/${m.id}`, cambios);
    await cargar();
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo cambiar' };
  } finally {
    ocupado.value = null;
  }
}

async function nuevaClave(m: Miembro): Promise<void> {
  ocupado.value = m.id;
  mensaje.value = null;
  try {
    const r = await api.post<{ email: string; passwordTemporal: string }>(`/admin/equipo/${m.id}/clave`);
    credenciales.value = { nombre: m.nombre, email: r.email, passwordTemporal: r.passwordTemporal };
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo restablecer' };
  } finally {
    ocupado.value = null;
  }
}

async function copiar(): Promise<void> {
  if (!credenciales.value) return;
  const c = credenciales.value;
  const texto = `CodeNest School\nCorreo: ${c.email}\nContraseña temporal: ${c.passwordTemporal}\nEntra en https://codenestschool.com/app/`;
  try {
    await navigator.clipboard.writeText(texto);
    mensaje.value = { tono: 'bien', texto: 'Credenciales copiadas.' };
  } catch {
    window.prompt('Copia las credenciales:', texto);
  }
}

onMounted(cargar);
</script>

<template>
  <section v-if="credenciales" class="a-panel credenciales" role="alert">
    <h2>Cuenta lista para {{ credenciales.nombre }}</h2>
    <p>
      La contraseña se muestra <strong>solo esta vez</strong>: no se guarda en ningún sitio. Si el colegio
      usa la cuenta de Microsoft, puede entrar con ella y no necesita esta contraseña.
    </p>
    <dl class="a-datos">
      <dt>Correo</dt>
      <dd>{{ credenciales.email }}</dd>
      <dt>Contraseña temporal</dt>
      <dd><code class="a-codigo">{{ credenciales.passwordTemporal }}</code></dd>
    </dl>
    <div class="a-acciones">
      <button type="button" class="a-boton a-boton--fantasma" @click="copiar">Copiar</button>
      <button type="button" class="a-boton" @click="credenciales = null">Ya las guardé</button>
    </div>
  </section>

  <section class="a-panel">
    <div class="a-fila-titulo">
      <h2>Equipo</h2>
      <button type="button" class="a-boton" @click="nuevo.abierto = !nuevo.abierto">Nuevo profesor</button>
    </div>
    <p class="a-subtitulo intro">
      {{ miembros.length }} personas · {{ docentes }} docentes. Los estudiantes y las familias no salen
      aquí: a los estudiantes los da de alta su docente en su grupo.
    </p>

    <p v-if="mensaje" class="a-aviso" :class="`a-aviso--${mensaje.tono}`" role="status">{{ mensaje.texto }}</p>

    <form v-if="nuevo.abierto" class="a-formulario nuevo" @submit.prevent="crear">
      <label class="a-campo">
        <span>Nombre y apellidos</span>
        <input id="equipo-nombre" v-model="nuevo.nombre" required minlength="2" maxlength="150" autocomplete="name" />
      </label>
      <label class="a-campo">
        <span>Correo</span>
        <input id="equipo-email" v-model="nuevo.email" type="email" required maxlength="255" autocomplete="email" />
        <small>Con el correo del colegio podrá entrar con Microsoft.</small>
      </label>
      <label class="a-campo">
        <span>Rol</span>
        <select id="equipo-rol" v-model="nuevo.rol">
          <option v-for="r in ROLES" :key="r.clave" :value="r.clave">{{ r.nombre }}</option>
        </select>
        <small>{{ ROLES.find((r) => r.clave === nuevo.rol)?.explica }}</small>
      </label>
      <label class="a-campo">
        <span>Colegio</span>
        <select id="equipo-institucion" v-model="nuevo.institucionId">
          <option :value="null">Sin colegio (equipo de CodeNest)</option>
          <option v-for="i in instituciones" :key="i.id" :value="i.id">
            {{ i.nombre }}{{ i.ciudad ? ` · ${i.ciudad}` : '' }}
          </option>
        </select>
      </label>
      <p v-if="error" class="a-aviso a-aviso--mal a-campo--ancho" role="alert">{{ error }}</p>
      <div class="a-acciones a-campo--ancho">
        <button class="a-boton a-boton--verde" type="submit" :disabled="creando">
          {{ creando ? 'Creando…' : 'Crear cuenta' }}
        </button>
        <button class="a-boton a-boton--fantasma" type="button" @click="nuevo.abierto = false">Cancelar</button>
      </div>
    </form>

    <div class="a-tabla-contenedor">
      <table class="a-tabla">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Rol</th>
            <th>Colegio</th>
            <th class="a-num">Grupos</th>
            <th>Entra con</th>
            <th>Última vez</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in miembros" :key="m.id" :class="{ inactivo: !m.activo }">
            <td>
              {{ m.nombre }}
              <small>{{ m.email }}</small>
            </td>
            <td>
              <select
                :id="`rol-${m.id}`"
                class="rol"
                :value="m.rol"
                :disabled="ocupado === m.id"
                :aria-label="`Rol de ${m.nombre}`"
                @change="cambiar(m, { rol: ($event.target as HTMLSelectElement).value })"
              >
                <option v-for="r in ROLES" :key="r.clave" :value="r.clave">{{ r.nombre }}</option>
              </select>
            </td>
            <td>{{ m.institucion?.nombre ?? '—' }}</td>
            <td class="a-num">{{ m.aulas }}</td>
            <td>{{ m.entraCon }}</td>
            <td>{{ m.ultimaActividad ? fecha(m.ultimaActividad) : 'nunca' }}</td>
            <td class="acciones-fila">
              <span v-if="!m.activo" class="a-chip a-chip--mal">Inactiva</span>
              <button
                type="button"
                class="a-boton a-boton--fantasma a-boton--pequeno"
                :disabled="ocupado === m.id"
                @click="nuevaClave(m)"
              >
                Nueva contraseña
              </button>
              <button
                type="button"
                class="a-boton a-boton--pequeno"
                :class="m.activo ? 'a-boton--peligro' : ''"
                :disabled="ocupado === m.id"
                @click="cambiar(m, { activo: !m.activo })"
              >
                {{ m.activo ? 'Desactivar' : 'Reactivar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="a-subtitulo pie">
      Desactivar una cuenta le quita el acceso sin borrar nada: sus grupos y el trabajo de sus
      estudiantes siguen ahí. {{ etiquetaRol('admin') }}: hace falta siempre al menos uno activo.
    </p>
  </section>
</template>

<style scoped>
.intro {
  margin: -0.4rem 0 1rem;
  max-width: 72ch;
}

.nuevo {
  padding: 1rem;
  margin-bottom: 1.25rem;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
}

.rol {
  min-height: 32px;
  padding: 0.2rem 0.4rem;
  font-family: inherit;
  font-size: 0.85rem;
  border: 1.5px solid #cfd8e3;
  border-radius: 8px;
  background: white;
}

.inactivo {
  opacity: 0.55;
}

.acciones-fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.credenciales {
  border: 2px solid var(--amarillo-oscuro);
}

.credenciales p {
  max-width: 64ch;
}

.pie {
  margin: 1rem 0 0;
  font-size: 0.82rem;
  max-width: 72ch;
}
</style>
