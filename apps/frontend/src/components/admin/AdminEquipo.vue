<script setup lang="ts">
/**
 * El equipo: docentes y administradores.
 *
 * Crear un docente aqui es lo que faltaba para montar un colegio sin tocar la
 * base de datos. La contrasena temporal se muestra UNA vez y no se guarda en
 * claro en ningun sitio; si el colegio tiene SSO, el docente puede entrar
 * directamente con su correo de Microsoft y no necesitarla.
 *
 * Aqui se deciden ademas las dos cosas que un docente no puede darse a si mismo:
 *
 *  - **Su plan.** Se le otorga sin pasar por el carrito, que es como se cierran
 *    las ventas de verdad: transferencia, convenio o piloto.
 *  - **El permiso de Phidias.** Ese token abre el expediente de todos los
 *    menores matriculados, asi que se da uno a uno y apagado por defecto.
 *
 * Los estudiantes y las familias no salen aqui: nacen de una compra o del alta
 * que hace su docente en su grupo.
 */
import { computed, onMounted, reactive, ref } from 'vue';

import { api } from '@/api/cliente';
import { cop, fecha } from '@/components/facturacion/formato';

interface LicenciaMiembro {
  id: number;
  estado: string;
  plan: string;
  finVigencia: string | null;
  pagada: boolean;
}

interface Miembro {
  id: number;
  nombre: string;
  email: string | null;
  rol: 'docente' | 'admin_escuela' | 'admin';
  activo: boolean;
  phidiasHabilitado: boolean;
  entraCon: string;
  institucion: { id: number; nombre: string } | null;
  aulas: number;
  licencias: LicenciaMiembro[];
  creadoEn: string;
  ultimaActividad: string | null;
}

interface Institucion {
  id: number;
  nombre: string;
  ciudad: string | null;
}

interface Plan {
  id: number;
  nombre: string;
  precioCop: number;
  vigenciaDias: number;
  activo: boolean;
}

const ROLES = [
  { clave: 'docente', nombre: 'Docente', explica: 'Sus grupos, sus estudiantes y el seguimiento.' },
  { clave: 'admin_escuela', nombre: 'Administrador del colegio', explica: 'Todo lo del colegio: sedes, docentes y aulas.' },
  { clave: 'admin', nombre: 'Administrador de la plataforma', explica: 'Todo, incluidos precios, pagos y facturas.' },
] as const;

const miembros = ref<Miembro[]>([]);
const instituciones = ref<Institucion[]>([]);
const planes = ref<Plan[]>([]);
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

/** A quien se le esta dando un plan ahora mismo. */
const plan = reactive({
  miembro: null as Miembro | null,
  planId: null as number | null,
  dias: '' as string,
  error: null as string | null,
  guardando: false,
});

const docentes = computed(() => miembros.value.filter((m) => m.rol === 'docente').length);
const conPhidias = computed(() => miembros.value.filter((m) => m.phidiasHabilitado).length);

/** La licencia que de verdad vale hoy, si tiene alguna. */
const licenciaVigente = (m: Miembro): LicenciaMiembro | null =>
  m.licencias.find((l) => l.estado === 'activa') ?? null;

async function cargar(): Promise<void> {
  const [e, i, p] = await Promise.all([
    api.get<{ miembros: Miembro[] }>('/admin/equipo'),
    api.get<{ instituciones: Institucion[] }>('/admin/instituciones'),
    api.get<{ planes: Plan[] }>('/admin/planes'),
  ]);
  miembros.value = e.miembros;
  instituciones.value = i.instituciones;
  planes.value = p.planes.filter((x) => x.activo);
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

function abrirPlan(m: Miembro): void {
  plan.miembro = m;
  plan.planId = planes.value[0]?.id ?? null;
  plan.dias = '';
  plan.error = null;
}

async function darPlan(): Promise<void> {
  if (!plan.miembro || plan.planId === null) return;
  plan.guardando = true;
  plan.error = null;
  try {
    const dias = Number(plan.dias);
    const r = await api.post<{ licencia: { planNombre: string; finVigencia: string | null } }>(
      '/admin/licencias',
      {
        planId: plan.planId,
        titularId: plan.miembro.id,
        institucionId: plan.miembro.institucion?.id ?? null,
        ...(Number.isInteger(dias) && dias > 0 ? { dias } : {}),
      },
    );
    mensaje.value = {
      tono: 'bien',
      texto: `${plan.miembro.nombre} tiene ${r.licencia.planNombre}${
        r.licencia.finVigencia ? ` hasta el ${fecha(r.licencia.finVigencia)}` : ''
      }.`,
    };
    plan.miembro = null;
    await cargar();
  } catch (e) {
    plan.error = e instanceof Error ? e.message : 'No se pudo asignar el plan';
  } finally {
    plan.guardando = false;
  }
}

async function cancelarLicencia(m: Miembro, licencia: LicenciaMiembro): Promise<void> {
  if (!window.confirm(`Retirar ${licencia.plan} a ${m.nombre}. Su cuenta y sus grupos siguen.`)) return;
  ocupado.value = m.id;
  mensaje.value = null;
  try {
    await api.post(`/admin/licencias/${licencia.id}/cancelar`);
    await cargar();
  } catch (e) {
    mensaje.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo cancelar' };
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

  <!-- Dar un plan: se hace sobre una persona concreta, así que el formulario
       vive junto a ella y dice a quién se le está dando. -->
  <section v-if="plan.miembro" class="a-panel asignar" role="dialog" aria-label="Asignar plan">
    <h2>Plan para {{ plan.miembro.nombre }}</h2>
    <p class="a-subtitulo">
      Se le activa ahora mismo, sin pasar por el carrito. Si ya tiene uno vigente, este empieza
      cuando termine el otro: nadie pierde días por renovar antes de tiempo.
    </p>
    <form class="a-formulario" @submit.prevent="darPlan">
      <label class="a-campo">
        <span>Plan</span>
        <select id="plan-que" v-model.number="plan.planId">
          <option v-for="p in planes" :key="p.id" :value="p.id">
            {{ p.nombre }} · {{ cop(p.precioCop) }} · {{ p.vigenciaDias }} días
          </option>
        </select>
      </label>
      <label class="a-campo">
        <span>Días (opcional)</span>
        <input id="plan-dias" v-model="plan.dias" type="number" min="1" max="3650" placeholder="los del plan" />
        <small>Para un piloto que dura menos que un año.</small>
      </label>
      <p v-if="plan.error" class="a-aviso a-aviso--mal a-campo--ancho" role="alert">{{ plan.error }}</p>
      <div class="a-acciones a-campo--ancho">
        <button class="a-boton a-boton--verde" type="submit" :disabled="plan.guardando || plan.planId === null">
          {{ plan.guardando ? 'Asignando…' : 'Asignar plan' }}
        </button>
        <button class="a-boton a-boton--fantasma" type="button" @click="plan.miembro = null">Cancelar</button>
      </div>
    </form>
  </section>

  <section class="a-panel">
    <div class="a-fila-titulo">
      <h2>Equipo</h2>
      <button type="button" class="a-boton" @click="nuevo.abierto = !nuevo.abierto">Nuevo profesor</button>
    </div>
    <p class="a-subtitulo intro">
      {{ miembros.length }} personas · {{ docentes }} docentes · {{ conPhidias }} con acceso al sistema
      académico. Los estudiantes y las familias no salen aquí: a los estudiantes los da de alta su
      docente en su grupo.
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
            <th>Plan</th>
            <th>Phidias</th>
            <th class="a-num">Grupos</th>
            <th>Última vez</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in miembros" :key="m.id" :class="{ inactivo: !m.activo }">
            <td>
              {{ m.nombre }}
              <small>{{ m.email }} · {{ m.entraCon }}</small>
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
            <td class="celda-plan">
              <template v-if="licenciaVigente(m)">
                <span class="a-chip a-chip--bien">{{ licenciaVigente(m)!.plan }}</span>
                <small v-if="licenciaVigente(m)!.finVigencia">
                  hasta {{ fecha(licenciaVigente(m)!.finVigencia!) }}
                </small>
                <button
                  v-if="!licenciaVigente(m)!.pagada"
                  type="button"
                  class="a-boton a-boton--fantasma a-boton--pequeno"
                  :disabled="ocupado === m.id"
                  @click="cancelarLicencia(m, licenciaVigente(m)!)"
                >
                  Retirar
                </button>
              </template>
              <button
                v-else
                type="button"
                class="a-boton a-boton--pequeno"
                :disabled="ocupado === m.id || planes.length === 0"
                @click="abrirPlan(m)"
              >
                Dar plan
              </button>
            </td>
            <td>
              <!-- Un interruptor y no un menú: es sí o no, y se ve de un golpe
                   quién tiene abierta la puerta al expediente del colegio. -->
              <label class="interruptor">
                <input
                  :id="`phidias-${m.id}`"
                  type="checkbox"
                  :checked="m.rol === 'admin' || m.phidiasHabilitado"
                  :disabled="ocupado === m.id || m.rol === 'admin'"
                  :aria-label="`Importar del colegio: ${m.nombre}`"
                  @change="cambiar(m, { phidiasHabilitado: ($event.target as HTMLInputElement).checked })"
                />
                <span>{{ m.rol === 'admin' ? 'siempre' : m.phidiasHabilitado ? 'sí' : 'no' }}</span>
              </label>
            </td>
            <td class="a-num">{{ m.aulas }}</td>
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
      El permiso de Phidias se quita en el momento, sin esperar a que caduque su sesión.
    </p>
  </section>
</template>

<style scoped>
.intro {
  margin: -0.4rem 0 1rem;
  max-width: 72ch;
}

.nuevo,
.asignar .a-formulario {
  padding: 1rem;
  margin-bottom: 1.25rem;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
}

.asignar {
  border: 2px solid var(--azul, #1fa2ff);
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

.acciones-fila,
.celda-plan {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.celda-plan small {
  color: #64748b;
  font-size: 0.75rem;
}

.interruptor {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.interruptor input {
  width: 18px;
  height: 18px;
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
