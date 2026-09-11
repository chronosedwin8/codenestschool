<script setup lang="ts">
/**
 * La tienda del Nido.
 *
 * Se paga con estrellas, que es lo único que el niño gana jugando, y está
 * pensada para que la use alguien que todavía no lee:
 *
 *  - Arriba, siempre visible, su Fuzz con lo que lleva puesto y cuántas
 *    estrellas le quedan. Es la única forma de que entienda que comprar gasta:
 *    ve el número bajar y ve al Fuzz cambiar en el mismo gesto.
 *  - Cada artículo es una tarjeta grande con su dibujo, su nombre y su precio.
 *    Lo que no puede comprar no se esconde ni se tacha: se dice por qué, y eso
 *    es la mitad de la motivación ("se abre al terminar el mundo 7").
 *  - Nada de ventanas de confirmación. Un toque compra, el Fuzz se lo pone y se
 *    oye. Si se equivoca, se lo quita con otro toque y no ha perdido nada, salvo
 *    las estrellas, que es justo lo que tiene que aprender a administrar.
 *
 * Todo lo decide el servidor: precios, si le alcanza y si lo tiene comprado. Esta
 * vista solo pinta lo que le llega.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import BotonJuguete from '@/components/BotonJuguete.vue';
import FuzzAvatar from '@/components/FuzzAvatar.vue';
import { useAudioStore } from '@/stores/audio';
import {
  ORDEN_TIPOS,
  useTiendaStore,
  type Articulo,
  type TipoArticulo,
  type TipoEquipable,
} from '@/stores/tienda';

const router = useRouter();
const audio = useAudioStore();
const tienda = useTiendaStore();

const seccion = ref<TipoArticulo>('color');
const trabajando = ref<string | null>(null);
const aviso = ref<string | null>(null);
/** Lo último comprado, para celebrarlo sin una ventana que haya que cerrar. */
const estrenando = ref<Articulo | null>(null);

const EQUIPABLES: readonly TipoArticulo[] = ['color', 'sombrero', 'gafas', 'accesorio', 'disfraz'];

const secciones = computed(() =>
  ORDEN_TIPOS.filter((s) => tienda.articulos.some((a) => a.tipo === s.tipo)),
);

/**
 * Las tarjetas de la seccion, con su boton ya decidido.
 *
 * Se calcula aqui y no en la plantilla porque cada tarjeta necesita la accion
 * tres veces (etiqueta, icono y tono) y llamar a la funcion en cada sitio la
 * ejecutaba tres veces por articulo en cada repintado.
 */
const deLaSeccion = computed(() =>
  tienda.articulos
    .filter((a) => a.tipo === seccion.value)
    .map((articulo) => ({ articulo, accion: accionDe(articulo) })),
);

/** Los que ya tiene y se gastan: su mochila. */
const mochila = computed(() =>
  tienda.articulos.filter((a) => (a.tipo === 'pocion' || a.tipo === 'mundo') && a.cantidad > 0),
);

function esEquipable(tipo: TipoArticulo): tipo is TipoEquipable {
  return EQUIPABLES.includes(tipo);
}

/** Color con el que se dibuja la muestra de un artículo de color. */
function muestraDe(articulo: Articulo): string {
  return articulo.datos?.hex ?? '#94A3B8';
}

async function conAviso(clave: string, accion: () => Promise<void>): Promise<void> {
  if (trabajando.value !== null) return;
  trabajando.value = clave;
  aviso.value = null;
  try {
    await accion();
  } catch (error) {
    aviso.value = error instanceof Error ? error.message : 'No se pudo hacer eso';
    // Se narra con el clip de "te faltan estrellas" porque es el fallo real en
    // una tienda; el resto de errores son de red y ahi el texto ya se lee.
    void audio.narrar('ui_sin-estrellas', aviso.value);
  } finally {
    trabajando.value = null;
  }
}

async function comprar(articulo: Articulo): Promise<void> {
  await conAviso(articulo.clave, async () => {
    await tienda.comprar(articulo.clave);
    estrenando.value = articulo;
    audio.efecto('compra');
    void audio.narrar('ui_compra-hecha', `Ya es tuyo: ${articulo.nombre}`);
    // El estreno se apaga solo: el niño no tiene que cerrar nada.
    window.setTimeout(() => {
      if (estrenando.value?.clave === articulo.clave) estrenando.value = null;
    }, 2600);
  });
}

async function ponerse(articulo: Articulo): Promise<void> {
  if (!esEquipable(articulo.tipo)) return;
  const quitar = articulo.equipado;
  await conAviso(articulo.clave, async () => {
    await tienda.equipar(articulo.tipo as TipoEquipable, quitar ? null : articulo.clave);
    audio.efecto('ficha-colocada');
  });
}

async function alternarPoder(articulo: Articulo): Promise<void> {
  await conAviso(articulo.clave, async () => {
    await tienda.cambiarPoder(articulo.clave, !articulo.equipado);
    audio.efecto('ficha-colocada');
  });
}

async function usar(articulo: Articulo): Promise<void> {
  await conAviso(articulo.clave, async () => {
    const resultado = await tienda.usar(articulo.clave);
    if (resultado.mundoAbierto !== null) {
      audio.efecto('desbloqueo');
      aviso.value = `Se abrio el mundo ${resultado.mundoAbierto}. Ya puedes jugarlo.`;
      void audio.narrar('ui_mundo-nuevo', aviso.value);
    } else {
      void audio.narrar('ui_pocion-lista', 'Listo. La pocion hara efecto en tu proxima actividad.');
    }
  });
}

/** Qué botón toca para cada artículo. Un solo botón por tarjeta, nunca dos. */
function accionDe(articulo: Articulo): {
  etiqueta: string;
  icono: string;
  tono: 'verde' | 'azul' | 'morado' | 'neutro';
  hacer: () => Promise<void>;
  activo: boolean;
} | null {
  if (articulo.tipo === 'poder' && articulo.tengo) {
    return articulo.equipado
      ? { etiqueta: 'Apagar', icono: '🌙', tono: 'neutro', hacer: () => alternarPoder(articulo), activo: true }
      : { etiqueta: 'Encender', icono: '✨', tono: 'morado', hacer: () => alternarPoder(articulo), activo: true };
  }
  if ((articulo.tipo === 'pocion' || articulo.tipo === 'mundo') && articulo.cantidad > 0) {
    return { etiqueta: 'Usar', icono: '🧪', tono: 'morado', hacer: () => usar(articulo), activo: true };
  }
  if (esEquipable(articulo.tipo) && articulo.tengo) {
    return articulo.equipado
      ? { etiqueta: 'Quitar', icono: '✓', tono: 'neutro', hacer: () => ponerse(articulo), activo: true }
      : { etiqueta: 'Ponerse', icono: '👕', tono: 'azul', hacer: () => ponerse(articulo), activo: true };
  }
  if (articulo.puedoComprar) {
    return { etiqueta: 'Comprar', icono: '⭐', tono: 'verde', hacer: () => comprar(articulo), activo: true };
  }
  return null;
}

onMounted(async () => {
  await tienda.cargar(true);
  void audio.narrar('ui_tienda', 'Gasta tus estrellas en lo que quieras.');
});
</script>

<template>
  <main class="tienda">
    <header class="tienda__cabecera">
      <BotonJuguete
        etiqueta="Volver al mapa"
        icono="←"
        tono="neutro"
        solo-icono
        @pulsar="router.push('/mapa')"
      />
      <h1>La tienda del Nido</h1>
      <span class="tienda__hueco" aria-hidden="true" />
    </header>

    <!-- Su Fuzz y su saldo: lo que compra se ve aquí en el mismo momento. -->
    <section class="escaparate">
      <div class="escaparate__fuzz" :class="{ 'escaparate__fuzz--estreno': estrenando }">
        <FuzzAvatar
          :color="tienda.colorFuzz"
          :sombrero="tienda.adornos.sombrero"
          :gafas="tienda.adornos.gafas"
          :accesorio="tienda.adornos.accesorio"
          :disfraz="tienda.adornos.disfraz"
          :expresion="estrenando ? 'celebrando' : 'feliz'"
          :tamano="150"
        />
      </div>
      <div class="escaparate__saldo">
        <p class="saldo">
          <span aria-hidden="true">⭐</span>
          <strong>{{ tienda.estrellasDisponibles }}</strong>
        </p>
        <p class="saldo__que">estrellas para gastar</p>
        <p class="saldo__historia">
          Has ganado {{ tienda.estrellasTotales }} en total. Lo que gastas no te las quita.
        </p>
        <p v-if="estrenando" class="saldo__estreno">¡{{ estrenando.nombre }} es tuyo!</p>
      </div>
    </section>

    <p v-if="aviso" class="aviso">{{ aviso }}</p>
    <p v-if="tienda.error" class="aviso">{{ tienda.error }}</p>
    <p v-else-if="tienda.cargando && !tienda.cargada" class="aviso">Abriendo la tienda...</p>

    <!-- Su mochila: lo que tiene guardado y puede gastar. -->
    <section v-if="mochila.length > 0" class="mochila">
      <h2>Tu mochila</h2>
      <ul class="mochila__lista">
        <li v-for="item in mochila" :key="item.clave">
          <span class="mochila__nombre">{{ item.nombre }}</span>
          <span class="mochila__cuenta">x{{ item.cantidad }}</span>
        </li>
      </ul>
    </section>

    <!-- Secciones. Pestañas grandes, con icono, sin texto pequeño. -->
    <nav class="pestanas" aria-label="Secciones de la tienda">
      <button
        v-for="s in secciones"
        :key="s.tipo"
        type="button"
        class="pestana"
        :class="{ 'pestana--activa': seccion === s.tipo }"
        :aria-pressed="seccion === s.tipo"
        @click="seccion = s.tipo"
      >
        <span class="pestana__icono" aria-hidden="true">{{ s.icono }}</span>
        <span class="pestana__texto">{{ s.titulo }}</span>
      </button>
    </nav>

    <section class="rejilla">
      <article
        v-for="{ articulo, accion } in deLaSeccion"
        :key="articulo.clave"
        class="carta"
        :class="{ 'carta--mia': articulo.tengo, 'carta--puesta': articulo.equipado }"
      >
        <!-- El dibujo: el color se ve, y el resto se prueba en un Fuzz. -->
        <div class="carta__muestra">
          <span
            v-if="articulo.tipo === 'color'"
            class="mancha"
            :style="{ background: muestraDe(articulo) }"
          />
          <FuzzAvatar
            v-else-if="esEquipable(articulo.tipo)"
            :color="tienda.colorFuzz"
            :sombrero="articulo.tipo === 'sombrero' ? (articulo.datos?.forma ?? null) : null"
            :gafas="articulo.tipo === 'gafas' ? (articulo.datos?.forma ?? null) : null"
            :accesorio="articulo.tipo === 'accesorio' ? (articulo.datos?.forma ?? null) : null"
            :disfraz="articulo.tipo === 'disfraz' ? (articulo.datos?.forma ?? null) : null"
            :tamano="84"
            :mirar="false"
            expresion="feliz"
          />
          <span v-else class="carta__icono" aria-hidden="true">
            {{ articulo.tipo === 'poder' ? '✨' : articulo.tipo === 'pocion' ? '🧪' : '🌍' }}
          </span>
        </div>

        <h3 class="carta__nombre">{{ articulo.nombre }}</h3>
        <p class="carta__que">{{ articulo.descripcion }}</p>

        <p class="carta__precio">
          <span aria-hidden="true">⭐</span> {{ articulo.costoEstrellas }}
        </p>

        <p v-if="articulo.tipo === 'pocion' && articulo.cantidad > 0" class="carta__tienes">
          Tienes {{ articulo.cantidad }}
        </p>

        <BotonJuguete
          v-if="accion"
          :etiqueta="accion.etiqueta"
          :icono="accion.icono"
          :tono="accion.tono"
          tamano="sm"
          :deshabilitado="trabajando === articulo.clave"
          @pulsar="accion.hacer()"
        />
        <p v-else class="carta__motivo">{{ articulo.motivo }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.tienda {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px 16px 64px;
}

.tienda__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.tienda__cabecera h1 {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-2xl);
  text-align: center;
}

.tienda__hueco {
  width: 56px;
}

.escaparate {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 18px 22px;
  border-radius: 26px;
  background: linear-gradient(180deg, #fffbea, #fff);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.08);
  margin-bottom: 18px;
}

.escaparate__fuzz--estreno {
  animation: rebote-suave 520ms var(--rebote) 3;
}

.saldo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 34px;
}

.saldo strong {
  font-family: var(--fuente-titulo);
  font-size: 44px;
  line-height: 1;
}

.saldo__que {
  margin: 0;
  font-size: var(--texto-lg);
  color: #64748b;
}

.saldo__historia {
  margin: 6px 0 0;
  font-size: var(--texto-sm);
  color: #94a3b8;
  max-width: 34ch;
}

.saldo__estreno {
  margin: 8px 0 0;
  font-family: var(--fuente-titulo);
  color: var(--verde-cesped, #5ad35a);
}

.mochila {
  background: #fff;
  border-radius: 18px;
  padding: 12px 18px;
  margin-bottom: 16px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.06);
}

.mochila h2 {
  margin: 0 0 8px;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.mochila__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.mochila__lista li {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: #f1f5f9;
}

.mochila__cuenta {
  font-family: var(--fuente-titulo);
}

.pestanas {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 2px 10px;
  margin-bottom: 10px;
}

.pestana {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 88px;
  min-height: 74px;
  padding: 10px 12px;
  border: 0;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
  cursor: pointer;
  font: inherit;
  color: #475569;
}

.pestana__icono {
  font-size: 26px;
  line-height: 1;
}

.pestana__texto {
  font-size: var(--texto-sm);
}

.pestana--activa {
  background: var(--azul-neon, #1fa2ff);
  color: #fff;
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
}

.carta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 12px 16px;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
  text-align: center;
}

.carta--mia {
  background: #f8fafc;
}

.carta--puesta {
  outline: 3px solid var(--verde-cesped, #5ad35a);
  outline-offset: -3px;
}

.carta__muestra {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 92px;
}

.mancha {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.18);
}

.carta__icono {
  font-size: 52px;
}

.carta__nombre {
  margin: 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-base);
}

.carta__que {
  margin: 0;
  font-size: var(--texto-sm);
  color: #64748b;
  min-height: 2.6em;
}

.carta__precio {
  margin: 2px 0 0;
  font-family: var(--fuente-titulo);
  font-size: var(--texto-lg);
}

.carta__tienes {
  margin: 0;
  font-size: var(--texto-sm);
  color: var(--verde-cesped, #5ad35a);
}

/* El "no puedes todavía" se dice, no se tacha: es lo que da la meta. */
.carta__motivo {
  margin: 4px 0 0;
  font-size: var(--texto-sm);
  color: #94a3b8;
  min-height: 2.4em;
}

.aviso {
  text-align: center;
  color: #64748b;
}

@media (max-width: 480px) {
  .rejilla {
    grid-template-columns: repeat(auto-fill, minmax(144px, 1fr));
  }
}
</style>
