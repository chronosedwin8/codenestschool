<script setup lang="ts">
/**
 * Portal del cliente.
 *
 * Aquí el usuario es un adulto, así que la interfaz cambia de registro por
 * completo: densidad alta, tablas, cifras y texto pequeño. Las reglas de diseño
 * del juego (botones de 72 píxeles, cero texto) resolvían un problema que aquí
 * no existe y estorbarían.
 *
 * Muestra lo que un tutor o un colegio necesita resolver sin escribir un correo:
 * cómo va cada niño, cuándo vence la licencia, cómo renovarla y qué pagos hay.
 */
import { computed, onMounted, ref } from 'vue';

import { formatearCop } from '@codenest/shared';

import { api, borrarToken } from '@/api/cliente';
import { useRouter } from 'vue-router';

interface Nino {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly grupoEdad: string | null;
  readonly monedas: number;
}

interface Perfil {
  readonly id: number;
  readonly nombre: string;
  readonly email: string | null;
  readonly rol: string;
  readonly ninosACargo: readonly Nino[];
}

interface Suscripcion {
  readonly licencia: {
    readonly id: number;
    readonly estado: string;
    readonly finVigencia: string | null;
    readonly codigoAcceso: string | null;
    readonly plan: { readonly nombre: string; readonly precioCop: number; readonly maxNinos: number | null };
  } | null;
  readonly pagos: readonly {
    readonly id: number;
    readonly montoCop: number;
    readonly estado: string;
    readonly metodo: string | null;
    readonly creadoEn: string;
  }[];
  readonly cupos: { readonly usados: number; readonly maximo: number | null };
}

interface Reporte {
  readonly nino: { readonly nombre: string; readonly grupoEdad: string | null };
  readonly resumen: {
    readonly actividadesJugadas: number;
    readonly estrellas: number;
    readonly intentosTotales: number;
  };
  readonly actividadDiaria: readonly {
    readonly fecha: string;
    readonly minutos: number;
    readonly actividades: number;
  }[];
  readonly porMundo: readonly {
    readonly numero: number;
    readonly nombre: string;
    readonly completadas: number;
    readonly estrellas: number;
  }[];
  readonly atascos: readonly {
    readonly actividad: string;
    readonly mundo: string;
    readonly intentos: number;
  }[];
}

const router = useRouter();

const perfil = ref<Perfil | null>(null);
const suscripcion = ref<Suscripcion | null>(null);
const reporte = ref<Reporte | null>(null);
const ninoSeleccionado = ref<number | null>(null);
const pestana = ref<'resumen' | 'ninos' | 'suscripcion'>('resumen');
const cargando = ref(true);
const error = ref<string | null>(null);

const diasRestantes = computed(() => {
  const fin = suscripcion.value?.licencia?.finVigencia;
  if (!fin) return null;
  const dias = Math.ceil((new Date(fin).getTime() - Date.now()) / 86_400_000);
  return dias;
});

/** Aviso de vencimiento a partir de 30 días: da margen para renovar. */
const avisoVencimiento = computed(() => {
  const dias = diasRestantes.value;
  if (dias === null) return null;
  if (dias < 0) return { tono: 'grave', texto: 'Tu licencia vencio. Renuevala para seguir jugando.' };
  if (dias <= 7) return { tono: 'grave', texto: `Tu licencia vence en ${dias} dia(s).` };
  if (dias <= 30) return { tono: 'aviso', texto: `Tu licencia vence en ${dias} dias.` };
  return null;
});

/** Máximo de minutos de un día, para escalar el gráfico. */
const maximoMinutos = computed(() => {
  const dias = reporte.value?.actividadDiaria ?? [];
  return Math.max(1, ...dias.map((d) => d.minutos));
});

async function cargar(): Promise<void> {
  cargando.value = true;
  try {
    perfil.value = await api.get<Perfil>('/auth/yo');
    suscripcion.value = await api.get<Suscripcion>('/portal/suscripcion');

    const primero = perfil.value.ninosACargo[0];
    if (primero) {
      ninoSeleccionado.value = primero.id;
      await cargarReporte(primero.id);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el portal';
  } finally {
    cargando.value = false;
  }
}

async function cargarReporte(ninoId: number): Promise<void> {
  ninoSeleccionado.value = ninoId;
  reporte.value = await api.get<Reporte>(`/telemetria/reporte/${ninoId}`);
}

function salir(): void {
  borrarToken();
  void router.push('/');
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

onMounted(cargar);
</script>

<template>
  <div class="portal">
    <header class="portal__cabecera">
      <div>
        <h1>Portal del cliente</h1>
        <p v-if="perfil" class="portal__usuario">
          {{ perfil.nombre }} · {{ perfil.email }}
        </p>
      </div>
      <button type="button" class="salir" @click="salir">Cerrar sesion</button>
    </header>

    <p v-if="error" class="aviso aviso--grave">{{ error }}</p>
    <p v-else-if="cargando" class="aviso">Cargando...</p>

    <template v-else>
      <!-- Aviso de vencimiento arriba: es lo que no puede pasar desapercibido -->
      <p
        v-if="avisoVencimiento"
        class="aviso"
        :class="`aviso--${avisoVencimiento.tono}`"
        role="status"
      >
        {{ avisoVencimiento.texto }}
        <a class="enlace" href="#suscripcion" @click="pestana = 'suscripcion'">Renovar</a>
      </p>

      <nav class="pestanas" aria-label="Secciones del portal">
        <button
          v-for="p in (['resumen', 'ninos', 'suscripcion'] as const)"
          :key="p"
          type="button"
          class="pestana"
          :class="{ 'pestana--activa': pestana === p }"
          @click="pestana = p"
        >
          {{ p === 'resumen' ? 'Resumen' : p === 'ninos' ? 'Mis estudiantes' : 'Suscripcion' }}
        </button>
      </nav>

      <!-- Resumen -->
      <section v-if="pestana === 'resumen'" class="panel">
        <div class="cifras">
          <div class="cifra">
            <span class="cifra__valor">{{ perfil?.ninosACargo.length ?? 0 }}</span>
            <span class="cifra__etiqueta">estudiantes</span>
          </div>
          <div class="cifra">
            <span class="cifra__valor">{{ reporte?.resumen.actividadesJugadas ?? 0 }}</span>
            <span class="cifra__etiqueta">actividades jugadas</span>
          </div>
          <div class="cifra">
            <span class="cifra__valor">{{ reporte?.resumen.estrellas ?? 0 }}</span>
            <span class="cifra__etiqueta">estrellas</span>
          </div>
          <div class="cifra">
            <span class="cifra__valor">
              {{ suscripcion?.licencia?.plan.nombre ?? 'sin plan' }}
            </span>
            <span class="cifra__etiqueta">plan actual</span>
          </div>
        </div>

        <template v-if="reporte">
          <h2>Actividad de los ultimos 30 dias</h2>
          <p v-if="reporte.actividadDiaria.length === 0" class="vacio">
            Todavia no hay actividad registrada.
          </p>
          <!-- Gráfico de barras en CSS: no justifica una librería de gráficos -->
          <div v-else class="grafico" role="img" aria-label="Minutos jugados por dia">
            <div
              v-for="dia in reporte.actividadDiaria"
              :key="dia.fecha"
              class="grafico__barra"
              :style="{ height: `${Math.max(4, (dia.minutos / maximoMinutos) * 100)}%` }"
              :title="`${formatearFecha(dia.fecha)}: ${dia.minutos} min`"
            />
          </div>

          <h2>Donde se atasca</h2>
          <p v-if="reporte.atascos.length === 0" class="vacio">
            Ninguna actividad le esta costando de mas ahora mismo.
          </p>
          <table v-else class="tabla">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Mundo</th>
                <th>Intentos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, i) in reporte.atascos" :key="i">
                <td>{{ a.actividad }}</td>
                <td>{{ a.mundo }}</td>
                <td>{{ a.intentos }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </section>

      <!-- Estudiantes -->
      <section v-else-if="pestana === 'ninos'" class="panel">
        <h2>Mis estudiantes</h2>
        <p v-if="(perfil?.ninosACargo.length ?? 0) === 0" class="vacio">
          Todavia no has creado ningun perfil.
        </p>

        <div v-else class="ninos">
          <button
            v-for="nino in perfil?.ninosACargo"
            :key="nino.id"
            type="button"
            class="nino"
            :class="{ 'nino--activo': ninoSeleccionado === nino.id }"
            @click="cargarReporte(nino.id)"
          >
            <span class="nino__nombre">{{ nino.nombre }}</span>
            <span class="nino__usuario">{{ nino.usuario }}</span>
            <span class="nino__grupo">{{ nino.grupoEdad }}</span>
          </button>
        </div>

        <template v-if="reporte">
          <h2>Progreso de {{ reporte.nino.nombre }} por mundo</h2>
          <p v-if="reporte.porMundo.length === 0" class="vacio">Aun no ha empezado ningun mundo.</p>
          <table v-else class="tabla">
            <thead>
              <tr>
                <th>Mundo</th>
                <th>Actividades completadas</th>
                <th>Estrellas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in reporte.porMundo" :key="m.numero">
                <td>{{ m.numero }}. {{ m.nombre }}</td>
                <td>{{ m.completadas }} de 20</td>
                <td>{{ m.estrellas }} de {{ m.completadas * 3 }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </section>

      <!-- Suscripción -->
      <section v-else id="suscripcion" class="panel">
        <h2>Tu suscripcion</h2>

        <p v-if="!suscripcion?.licencia" class="vacio">
          No tienes una licencia activa.
          <a class="enlace" href="/planes.html">Ver los planes</a>
        </p>

        <template v-else>
          <dl class="datos">
            <dt>Plan</dt>
            <dd>{{ suscripcion.licencia.plan.nombre }}</dd>

            <dt>Estado</dt>
            <dd>{{ suscripcion.licencia.estado }}</dd>

            <dt>Vence</dt>
            <dd>
              {{
                suscripcion.licencia.finVigencia
                  ? formatearFecha(suscripcion.licencia.finVigencia)
                  : 'sin definir'
              }}
              <span v-if="diasRestantes !== null"> ({{ diasRestantes }} dias)</span>
            </dd>

            <dt>Precio anual</dt>
            <dd>{{ formatearCop(suscripcion.licencia.plan.precioCop) }}</dd>

            <dt>Perfiles</dt>
            <dd>
              {{ suscripcion.cupos.usados }} de
              {{ suscripcion.cupos.maximo === null ? 'ilimitados' : suscripcion.cupos.maximo }}
            </dd>

            <dt v-if="suscripcion.licencia.codigoAcceso">Codigo de acceso</dt>
            <dd v-if="suscripcion.licencia.codigoAcceso">
              <code>{{ suscripcion.licencia.codigoAcceso }}</code>
            </dd>
          </dl>

          <h2>Historial de pagos</h2>
          <p v-if="suscripcion.pagos.length === 0" class="vacio">No hay pagos registrados.</p>
          <table v-else class="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Monto</th>
                <th>Metodo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pago in suscripcion.pagos" :key="pago.id">
                <td>{{ formatearFecha(pago.creadoEn) }}</td>
                <td>{{ formatearCop(pago.montoCop) }}</td>
                <td>{{ pago.metodo ?? '—' }}</td>
                <td>{{ pago.estado }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* El portal es para adultos: densidad alta y tipografía más pequeña que el juego. */
.portal {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
  font-size: 0.95rem;
  font-weight: 500;
}

.portal__cabecera {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.portal__cabecera h1 {
  margin: 0;
  font-size: 1.75rem;
}

.portal__usuario {
  margin: 0.25rem 0 0;
  color: var(--gris-oscuro);
}

.salir {
  padding: 0.5rem 1rem;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--gris-oscuro);
  background: white;
  border: 2px solid var(--gris-claro);
  border-radius: var(--radio-sm);
}

.pestanas {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--gris-claro);
}

.pestana {
  padding: 0.7rem 1.1rem;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--gris-oscuro);
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
}

.pestana--activa {
  color: var(--azul-neon-oscuro);
  border-bottom-color: var(--azul-neon);
}

.panel {
  padding: 1.5rem;
  background: white;
  border-radius: var(--radio-lg);
  box-shadow: var(--sombra-panel);
}

.panel h2 {
  margin: 1.75rem 0 0.75rem;
  font-size: 1.15rem;
}

.panel h2:first-child {
  margin-top: 0;
}

.cifras {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin-bottom: 1rem;
}

.cifra {
  padding: 1rem;
  text-align: center;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
}

.cifra__valor {
  display: block;
  font-family: var(--fuente-titulo);
  font-size: 1.9rem;
  color: var(--azul-neon-oscuro);
}

.cifra__etiqueta {
  font-size: 0.85rem;
  color: var(--gris-oscuro);
}

/* Gráfico de barras hecho con CSS: para 30 valores no hace falta más. */
.grafico {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 130px;
  padding: 0.5rem;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
}

.grafico__barra {
  flex: 1;
  min-width: 4px;
  background: var(--azul-neon);
  border-radius: 3px 3px 0 0;
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.tabla th,
.tabla td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--gris-claro);
}

.tabla th {
  font-size: 0.8rem;
  color: var(--gris-oscuro);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.datos {
  display: grid;
  gap: 0.5rem 1.5rem;
  grid-template-columns: auto 1fr;
  margin: 0;
}

.datos dt {
  font-size: 0.85rem;
  color: var(--gris-oscuro);
}

.datos dd {
  margin: 0;
  font-weight: 700;
}

.ninos {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.nino {
  display: grid;
  gap: 0.15rem;
  padding: 0.85rem;
  text-align: left;
  background: white;
  border: 2px solid var(--gris-claro);
  border-radius: var(--radio-md);
}

.nino--activo {
  border-color: var(--azul-neon);
  background: rgb(31 162 255 / 0.06);
}

.nino__nombre {
  font-weight: 800;
}

.nino__usuario,
.nino__grupo {
  font-size: 0.8rem;
  color: var(--gris-oscuro);
}

.aviso {
  padding: 0.85rem 1.1rem;
  margin-bottom: 1.25rem;
  background: var(--gris-claro);
  border-radius: var(--radio-md);
}

.aviso--aviso {
  background: rgb(255 217 61 / 0.28);
}

.aviso--grave {
  background: rgb(239 68 68 / 0.14);
}

.vacio {
  padding: 0.75rem 0;
  color: var(--gris-oscuro);
}

.enlace {
  color: var(--azul-neon-oscuro);
}

code {
  padding: 0.15rem 0.45rem;
  font-family: Consolas, monospace;
  background: var(--gris-claro);
  border-radius: 6px;
}
</style>
