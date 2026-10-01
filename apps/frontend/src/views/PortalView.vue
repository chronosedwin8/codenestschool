<script setup lang="ts">
/**
 * Portal del cliente.
 *
 * Aquí el usuario es un adulto, así que la interfaz cambia de registro por
 * completo: densidad alta, tablas, cifras y texto pequeño. Las reglas de diseño
 * del juego (botones de 72 píxeles, cero texto) resolvían un problema que aquí
 * no existe y estorbarían.
 *
 * Responde a lo que un padre o un colegio necesita resolver sin escribir un
 * correo: cómo va cada niño, cuándo vence el plan, cómo pagarlo o renovarlo,
 * qué pagos hay y dónde están sus facturas.
 *
 * Es también adonde vuelve el comprador desde Mercado Pago
 * (`?licencia=12&pago=exito`). Al volver no se espera al aviso del webhook: se
 * pregunta a Mercado Pago en ese momento, y la licencia se activa ahí mismo.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { etiquetaMedio } from '@codenest/shared';

import { api, borrarToken } from '@/api/cliente';
import EstadoChip from '@/components/facturacion/EstadoChip.vue';
import FormFacturacion from '@/components/facturacion/FormFacturacion.vue';
import { AVISO_JURISDICCION } from '@/components/facturacion/aviso';
import { cop, fecha } from '@/components/facturacion/formato';
import '@/styles/adultos.css';

interface Nino {
  readonly id: number;
  readonly nombre: string;
  readonly usuario: string;
  readonly grupoEdad: string | null;
}

interface Perfil {
  readonly id: number;
  readonly nombre: string;
  readonly email: string | null;
  readonly rol: string;
  readonly ninosACargo: readonly Nino[];
}

interface Licencia {
  readonly id: number;
  readonly estado: string;
  readonly inicioVigencia: string | null;
  readonly finVigencia: string | null;
  readonly codigoAcceso: string | null;
  readonly plan: { readonly nombre: string; readonly precioCop: number; readonly maxNinos: number | null; readonly activo: boolean };
  readonly renovacion: {
    readonly id: number;
    readonly estado: string;
    readonly inicioVigencia: string | null;
    readonly finVigencia: string | null;
  } | null;
}

interface Suscripcion {
  readonly licencia: Licencia | null;
  readonly cupos: { readonly usados: number; readonly maximo: number | null };
}

interface Pago {
  readonly id: number;
  readonly fecha: string;
  readonly montoCop: number;
  readonly estado: string;
  readonly motivo: string | null;
  readonly metodo: string | null;
  readonly tipoMedio: string | null;
  readonly cuotas: number | null;
  readonly concepto: string;
  readonly factura: { readonly numero: string; readonly token: string } | null;
}

interface Factura {
  readonly id: number;
  readonly numero: string;
  readonly fechaEmision: string;
  readonly totalCop: number;
  readonly estado: string;
  readonly token: string;
}

interface Cotizacion {
  readonly id: number;
  readonly numero: string;
  readonly fechaEmision: string;
  readonly validaHasta: string;
  readonly totalCop: number;
  readonly estado: string;
  readonly token: string;
}

interface Reporte {
  readonly nino: { readonly nombre: string; readonly grupoEdad: string | null };
  readonly resumen: { readonly actividadesJugadas: number; readonly estrellas: number; readonly intentosTotales: number };
  readonly actividadDiaria: readonly { readonly fecha: string; readonly minutos: number; readonly actividades: number }[];
  readonly porMundo: readonly { readonly numero: number; readonly nombre: string; readonly completadas: number; readonly estrellas: number }[];
  readonly atascos: readonly { readonly actividad: string; readonly mundo: string; readonly intentos: number }[];
}

type Pestana = 'resumen' | 'ninos' | 'plan' | 'pagos' | 'facturacion';

const PESTANAS: readonly { clave: Pestana; nombre: string }[] = [
  { clave: 'resumen', nombre: 'Resumen' },
  { clave: 'ninos', nombre: 'Mis estudiantes' },
  { clave: 'plan', nombre: 'Mi plan' },
  { clave: 'pagos', nombre: 'Pagos y facturas' },
  { clave: 'facturacion', nombre: 'Datos de facturación' },
];

const route = useRoute();
const router = useRouter();

const perfil = ref<Perfil | null>(null);
const suscripcion = ref<Suscripcion | null>(null);
const pagos = ref<readonly Pago[]>([]);
const facturas = ref<readonly Factura[]>([]);
const cotizaciones = ref<readonly Cotizacion[]>([]);
const reporte = ref<Reporte | null>(null);
const ninoSeleccionado = ref<number | null>(null);
const pestana = ref<Pestana>('resumen');
const cargando = ref(true);
const error = ref<string | null>(null);

/** Lo que pasó al volver de Mercado Pago, o al pulsar "Comprobar". */
const resultadoPago = ref<{ tono: 'bien' | 'espera' | 'mal'; texto: string } | null>(null);
const pagando = ref(false);
const comprobando = ref(false);

const licencia = computed(() => suscripcion.value?.licencia ?? null);

const diasRestantes = computed(() => {
  const fin = licencia.value?.finVigencia;
  if (!fin || licencia.value?.estado !== 'activa') return null;
  return Math.ceil((new Date(fin).getTime() - Date.now()) / 86_400_000);
});

/** Aviso arriba de todo: lo que no puede pasar desapercibido. */
const avisoPlan = computed(() => {
  const l = licencia.value;
  if (!l) return null;
  if (l.estado === 'pendiente') {
    return { tono: 'espera', texto: `Tu plan ${l.plan.nombre} está pendiente de pago.` };
  }
  if (l.estado === 'vencida') return { tono: 'mal', texto: 'Tu plan venció. Renuévalo para seguir jugando.' };
  if (l.renovacion?.estado === 'activa') return null;
  const dias = diasRestantes.value;
  if (dias !== null && dias <= 7) return { tono: 'mal', texto: `Tu plan vence en ${dias} día(s).` };
  if (dias !== null && dias <= 30) return { tono: 'espera', texto: `Tu plan vence en ${dias} días.` };
  return null;
});

const maximoMinutos = computed(() => Math.max(1, ...(reporte.value?.actividadDiaria ?? []).map((d) => d.minutos)));

const esDocente = computed(() => ['docente', 'admin_escuela', 'admin'].includes(perfil.value?.rol ?? ''));
const esAdmin = computed(() => perfil.value?.rol === 'admin');

async function cargarAdministrativo(): Promise<void> {
  const [s, p, f, c] = await Promise.all([
    api.get<Suscripcion>('/portal/suscripcion'),
    api.get<{ pagos: Pago[] }>('/portal/pagos'),
    api.get<{ facturas: Factura[] }>('/portal/facturas'),
    api.get<{ cotizaciones: Cotizacion[] }>('/portal/cotizaciones'),
  ]);
  suscripcion.value = s;
  pagos.value = p.pagos;
  facturas.value = f.facturas;
  cotizaciones.value = c.cotizaciones;
}

async function cargar(): Promise<void> {
  cargando.value = true;
  try {
    perfil.value = await api.get<Perfil>('/auth/yo');
    await cargarAdministrativo();

    const primero = perfil.value.ninosACargo[0];
    if (primero) await cargarReporte(primero.id);

    // Sin plan activo, lo primero que hay que ver es el plan.
    if (!licencia.value || licencia.value.estado !== 'activa') pestana.value = 'plan';

    await atenderRegresoDePago();
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

/** El comprador vuelve de Mercado Pago con `?licencia=12&pago=exito|pendiente|fallo`. */
async function atenderRegresoDePago(): Promise<void> {
  const id = Number(route.query.licencia);
  const vuelta = route.query.pago;
  if (!Number.isInteger(id) || id <= 0 || typeof vuelta !== 'string') return;

  pestana.value = 'plan';
  await comprobar(id, vuelta);
  // Se limpia la URL: recargar la página no debe repetir el mensaje.
  void router.replace({ query: {} });
}

async function comprobar(licenciaId: number, vuelta?: string): Promise<void> {
  comprobando.value = true;
  try {
    const r = await api.post<{
      estado: string;
      finVigencia: string | null;
      ultimoPago: { estado: string } | null;
    }>('/pagos/verificar', { licenciaId });
    // Primero se recarga: el motivo del rechazo sale del historial actualizado.
    await cargarAdministrativo();

    if (r.estado === 'activa') {
      resultadoPago.value = {
        tono: 'bien',
        texto: `¡Pago recibido! Tu plan está activo hasta el ${fecha(r.finVigencia)}.`,
      };
    } else if (r.ultimoPago?.estado === 'rechazado' || vuelta === 'fallo') {
      const motivo = pagos.value.find((p) => p.estado === 'rechazado')?.motivo;
      resultadoPago.value = {
        tono: 'mal',
        texto: `El pago no se completó. ${motivo ?? 'Puedes intentarlo de nuevo con otro medio de pago.'}`,
      };
    } else {
      resultadoPago.value = {
        tono: 'espera',
        texto:
          'Tu pago está en proceso. Con PSE o Efecty puede tardar desde unos minutos hasta un día hábil; lo verás confirmado aquí.',
      };
    }
  } catch (e) {
    resultadoPago.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo comprobar el pago' };
  } finally {
    comprobando.value = false;
  }
}

/** Paga una licencia pendiente o renueva la vigente: el servidor sabe cuál es. */
async function pagar(licenciaId: number): Promise<void> {
  pagando.value = true;
  resultadoPago.value = null;
  try {
    const r = await api.post<{ urlPago: string }>('/pagos/pagar', { licenciaId });
    window.location.href = r.urlPago;
  } catch (e) {
    resultadoPago.value = { tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo abrir el pago' };
    pagando.value = false;
  }
}

function medio(p: Pago): string {
  const base = etiquetaMedio(p.metodo, p.tipoMedio);
  return p.cuotas && p.cuotas > 1 ? `${base} · ${p.cuotas} cuotas` : base;
}

function documento(tipo: 'factura' | 'cotizacion', token: string) {
  return { name: 'documento', params: { tipo, token } };
}

function salir(): void {
  borrarToken();
  void router.push('/');
}

onMounted(cargar);
</script>

<template>
  <div class="a-pagina">
    <header class="a-cabecera">
      <div>
        <h1>Portal del cliente</h1>
        <p v-if="perfil" class="a-subtitulo">{{ perfil.nombre }} · {{ perfil.email }}</p>
      </div>
      <div class="a-acciones">
        <RouterLink v-if="esAdmin" class="a-boton" :to="{ name: 'admin' }">Administración</RouterLink>
        <RouterLink v-if="esDocente" class="a-boton a-boton--fantasma" to="/portal/docente">Mis grupos</RouterLink>
        <RouterLink v-if="esDocente" class="a-boton a-boton--fantasma" to="/mapa">Entrar al juego</RouterLink>
        <button type="button" class="a-boton a-boton--fantasma" @click="salir">Cerrar sesión</button>
      </div>
    </header>

    <p v-if="error" class="a-aviso a-aviso--mal" role="alert">{{ error }}</p>
    <p v-else-if="cargando" class="a-aviso">Cargando…</p>

    <template v-else>
      <p v-if="resultadoPago" class="a-aviso" :class="`a-aviso--${resultadoPago.tono}`" role="status">
        <span>{{ resultadoPago.texto }}</span>
        <button
          v-if="resultadoPago.tono === 'espera' && licencia"
          type="button"
          class="a-boton a-boton--fantasma a-boton--pequeno"
          :disabled="comprobando"
          @click="comprobar(licencia.renovacion?.estado === 'pendiente' ? licencia.renovacion.id : licencia.id)"
        >
          {{ comprobando ? 'Comprobando…' : 'Comprobar de nuevo' }}
        </button>
      </p>

      <p v-else-if="avisoPlan" class="a-aviso" :class="`a-aviso--${avisoPlan.tono}`" role="status">
        <span>{{ avisoPlan.texto }}</span>
        <button type="button" class="a-boton a-boton--pequeno" @click="pestana = 'plan'">Ver mi plan</button>
      </p>

      <nav class="a-pestanas" aria-label="Secciones del portal">
        <button
          v-for="p in PESTANAS"
          :key="p.clave"
          type="button"
          class="a-pestana"
          :class="{ 'a-pestana--activa': pestana === p.clave }"
          :aria-current="pestana === p.clave ? 'page' : undefined"
          @click="pestana = p.clave"
        >
          {{ p.nombre }}
        </button>
      </nav>

      <!-- ─────────────── Resumen ─────────────── -->
      <section v-if="pestana === 'resumen'" class="a-panel">
        <div class="a-cifras">
          <div class="a-cifra">
            <span class="a-cifra__valor">{{ perfil?.ninosACargo.length ?? 0 }}</span>
            <span class="a-cifra__etiqueta">estudiantes</span>
          </div>
          <div class="a-cifra">
            <span class="a-cifra__valor">{{ reporte?.resumen.actividadesJugadas ?? 0 }}</span>
            <span class="a-cifra__etiqueta">actividades jugadas</span>
          </div>
          <div class="a-cifra">
            <span class="a-cifra__valor">{{ reporte?.resumen.estrellas ?? 0 }}</span>
            <span class="a-cifra__etiqueta">estrellas</span>
          </div>
          <div class="a-cifra">
            <span class="a-cifra__valor">{{ licencia?.plan.nombre ?? 'Sin plan' }}</span>
            <span class="a-cifra__etiqueta">plan actual</span>
          </div>
        </div>

        <template v-if="reporte">
          <h3>Actividad de los últimos 30 días</h3>
          <p v-if="reporte.actividadDiaria.length === 0" class="a-vacio">Todavía no hay actividad registrada.</p>
          <div v-else class="grafico" role="img" aria-label="Minutos jugados por día">
            <div
              v-for="dia in reporte.actividadDiaria"
              :key="dia.fecha"
              class="grafico__barra"
              :style="{ height: `${Math.max(4, (dia.minutos / maximoMinutos) * 100)}%` }"
              :title="`${fecha(dia.fecha)}: ${dia.minutos} min`"
            />
          </div>

          <h3>Dónde se atasca</h3>
          <p v-if="reporte.atascos.length === 0" class="a-vacio">Ninguna actividad le está costando de más ahora mismo.</p>
          <div v-else class="a-tabla-contenedor">
            <table class="a-tabla">
              <thead>
                <tr><th>Actividad</th><th>Mundo</th><th class="a-num">Intentos</th></tr>
              </thead>
              <tbody>
                <tr v-for="(a, i) in reporte.atascos" :key="i">
                  <td>{{ a.actividad }}</td>
                  <td>{{ a.mundo }}</td>
                  <td class="a-num">{{ a.intentos }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <!-- ─────────────── Estudiantes ─────────────── -->
      <section v-else-if="pestana === 'ninos'" class="a-panel">
        <h2>Mis estudiantes</h2>
        <p v-if="(perfil?.ninosACargo.length ?? 0) === 0" class="a-vacio">Todavía no has creado ningún perfil.</p>

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
            <span class="nino__dato">{{ nino.usuario }}</span>
            <span class="nino__dato">{{ nino.grupoEdad }}</span>
          </button>
        </div>

        <template v-if="reporte">
          <h3>Progreso de {{ reporte.nino.nombre }} por mundo</h3>
          <p v-if="reporte.porMundo.length === 0" class="a-vacio">Aún no ha empezado ningún mundo.</p>
          <div v-else class="a-tabla-contenedor">
            <table class="a-tabla">
              <thead>
                <tr><th>Mundo</th><th class="a-num">Completadas</th><th class="a-num">Estrellas</th></tr>
              </thead>
              <tbody>
                <tr v-for="m in reporte.porMundo" :key="m.numero">
                  <td>{{ m.numero }}. {{ m.nombre }}</td>
                  <td class="a-num">{{ m.completadas }} de 20</td>
                  <td class="a-num">{{ m.estrellas }} de {{ m.completadas * 3 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <!-- ─────────────── Mi plan ─────────────── -->
      <template v-else-if="pestana === 'plan'">
        <section class="a-panel">
          <h2>Mi plan</h2>

          <div v-if="!licencia" class="a-vacio">
            <p>Todavía no tienes un plan.</p>
            <a class="a-boton" href="/planes.html">Ver los planes</a>
          </div>

          <template v-else>
            <dl class="a-datos">
              <dt>Plan</dt>
              <dd>{{ licencia.plan.nombre }}</dd>

              <dt>Estado</dt>
              <dd><EstadoChip :estado="licencia.estado" tipo="licencia" /></dd>

              <template v-if="licencia.estado === 'activa' || licencia.estado === 'vencida'">
                <dt>Vigencia</dt>
                <dd>
                  {{ fecha(licencia.inicioVigencia) }} a {{ fecha(licencia.finVigencia) }}
                  <span v-if="diasRestantes !== null" class="a-subtitulo">({{ diasRestantes }} días)</span>
                </dd>
              </template>

              <dt>Precio anual</dt>
              <dd>{{ cop(licencia.plan.precioCop) }} COP</dd>

              <dt>Perfiles</dt>
              <dd>
                {{ suscripcion?.cupos.usados }} de
                {{ suscripcion?.cupos.maximo === null ? 'ilimitados' : suscripcion?.cupos.maximo }}
              </dd>

              <template v-if="licencia.codigoAcceso">
                <dt>Código de acceso</dt>
                <dd><code class="a-codigo">{{ licencia.codigoAcceso }}</code></dd>
              </template>
            </dl>

            <!-- Pendiente de pago: comprar sin terminar, o PSE en curso -->
            <div v-if="licencia.estado === 'pendiente'" class="bloque-pago">
              <p>
                Tu cuenta está lista; falta el pago. Puedes pagar con tarjeta, PSE o Efecty en la página
                segura de Mercado Pago.
              </p>
              <div class="a-acciones">
                <button type="button" class="a-boton a-boton--verde" :disabled="pagando" @click="pagar(licencia.id)">
                  {{ pagando ? 'Abriendo Mercado Pago…' : `Pagar ${cop(licencia.plan.precioCop)}` }}
                </button>
                <button type="button" class="a-boton a-boton--fantasma" :disabled="comprobando" @click="comprobar(licencia.id)">
                  {{ comprobando ? 'Comprobando…' : 'Ya pagué: comprobar' }}
                </button>
              </div>
            </div>

            <!-- Activa o vencida: renovar -->
            <div v-else-if="licencia.estado === 'activa' || licencia.estado === 'vencida'" class="bloque-pago">
              <template v-if="licencia.renovacion?.estado === 'activa'">
                <p>
                  <EstadoChip estado="activa" tipo="licencia" />
                  Ya renovaste: tu plan sigue hasta el {{ fecha(licencia.renovacion.finVigencia) }}.
                </p>
              </template>
              <template v-else-if="licencia.renovacion?.estado === 'pendiente'">
                <p>Tienes una renovación pendiente de pago.</p>
                <div class="a-acciones">
                  <button type="button" class="a-boton a-boton--verde" :disabled="pagando" @click="pagar(licencia.id)">
                    {{ pagando ? 'Abriendo Mercado Pago…' : 'Completar el pago' }}
                  </button>
                  <button
                    type="button"
                    class="a-boton a-boton--fantasma"
                    :disabled="comprobando"
                    @click="comprobar(licencia.renovacion.id)"
                  >
                    {{ comprobando ? 'Comprobando…' : 'Ya pagué: comprobar' }}
                  </button>
                </div>
              </template>
              <template v-else-if="licencia.plan.activo">
                <p v-if="licencia.estado === 'activa'">
                  Si renuevas ahora, el nuevo año empieza el {{ fecha(licencia.finVigencia) }}: no pierdes ningún día.
                </p>
                <button type="button" class="a-boton a-boton--verde" :disabled="pagando" @click="pagar(licencia.id)">
                  {{ pagando ? 'Abriendo Mercado Pago…' : `Renovar por ${cop(licencia.plan.precioCop)}` }}
                </button>
              </template>
              <p v-else class="a-vacio">
                Este plan ya no se vende. Escríbenos y te ayudamos a pasar a otro.
              </p>
            </div>
          </template>
        </section>

        <section v-if="cotizaciones.length > 0" class="a-panel">
          <h2>Cotizaciones</h2>
          <div class="a-tabla-contenedor">
            <table class="a-tabla">
              <thead>
                <tr><th>Número</th><th>Fecha</th><th>Válida hasta</th><th class="a-num">Total</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                <tr v-for="c in cotizaciones" :key="c.id">
                  <td>{{ c.numero }}</td>
                  <td>{{ fecha(c.fechaEmision) }}</td>
                  <td>{{ fecha(c.validaHasta) }}</td>
                  <td class="a-num">{{ cop(c.totalCop) }}</td>
                  <td><EstadoChip :estado="c.estado" tipo="cotizacion" /></td>
                  <td><RouterLink class="a-enlace" :to="documento('cotizacion', c.token)">Ver</RouterLink></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- ─────────────── Pagos y facturas ─────────────── -->
      <template v-else-if="pestana === 'pagos'">
        <section class="a-panel">
          <h2>Pagos</h2>
          <p v-if="pagos.length === 0" class="a-vacio">No hay pagos registrados.</p>
          <div v-else class="a-tabla-contenedor">
            <table class="a-tabla">
              <thead>
                <tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th class="a-num">Monto</th><th>Estado</th><th>Factura</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in pagos" :key="p.id">
                  <td>{{ fecha(p.fecha) }}</td>
                  <td>{{ p.concepto }}</td>
                  <td>{{ medio(p) }}</td>
                  <td class="a-num">{{ cop(p.montoCop) }}</td>
                  <td>
                    <EstadoChip :estado="p.estado" tipo="pago" />
                    <small v-if="p.motivo">{{ p.motivo }}</small>
                  </td>
                  <td>
                    <RouterLink v-if="p.factura" class="a-enlace" :to="documento('factura', p.factura.token)">
                      {{ p.factura.numero }}
                    </RouterLink>
                    <span v-else class="a-subtitulo">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="a-panel">
          <h2>Facturas</h2>
          <p class="aviso-legal" role="note">
            <strong>Sobre nuestras facturas.</strong> {{ AVISO_JURISDICCION }}
          </p>
          <p v-if="facturas.length === 0" class="a-vacio">
            Todavía no tienes facturas. Las emitimos después de cada pago aprobado.
          </p>
          <div v-else class="a-tabla-contenedor">
            <table class="a-tabla">
              <thead>
                <tr><th>Número</th><th>Fecha</th><th class="a-num">Total</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                <tr v-for="f in facturas" :key="f.id">
                  <td>{{ f.numero }}</td>
                  <td>{{ fecha(f.fechaEmision) }}</td>
                  <td class="a-num">{{ cop(f.totalCop) }}</td>
                  <td><EstadoChip :estado="f.estado" tipo="factura" /></td>
                  <td>
                    <RouterLink class="a-enlace" :to="documento('factura', f.token)">Ver y descargar</RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- ─────────────── Datos de facturación ─────────────── -->
      <section v-else class="a-panel">
        <h2>Datos de facturación</h2>
        <p class="a-subtitulo parrafo">Es lo que sale en tus facturas. Si cambias algo, afecta a las próximas, no a las ya emitidas.</p>
        <p class="aviso-legal" role="note">{{ AVISO_JURISDICCION }}</p>
        <FormFacturacion />
      </section>
    </template>
  </div>
</template>

<style scoped>
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

.ninos {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.nino {
  display: grid;
  gap: 0.15rem;
  padding: 0.85rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
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

.nino__dato {
  font-size: 0.8rem;
  color: var(--gris-oscuro);
}

.bloque-pago {
  display: grid;
  gap: 0.75rem;
  padding-top: 1.1rem;
  margin-top: 1.25rem;
  border-top: 1px solid var(--gris-claro);
}

.bloque-pago p {
  margin: 0;
  max-width: 62ch;
}

.parrafo {
  margin: -0.4rem 0 1rem;
  max-width: 62ch;
}

/* Un aviso para leer, no una alerta: fondo neutro y texto del tamano del resto. */
.aviso-legal {
  max-width: 72ch;
  padding: 0.8rem 1rem;
  margin: 0 0 1rem;
  font-size: 0.88rem;
  color: var(--tinta-suave);
  background: var(--gris-claro);
  border-left: 4px solid var(--azul-neon);
  border-radius: 0 10px 10px 0;
}
</style>
