<script setup lang="ts">
/**
 * Editor de bloques para los Creadores (mundos 11 al 20).
 *
 * Tres decisiones que importan:
 *
 *  1. Se importan las partes de Blockly que se usan, no el paquete entero. El
 *     `import * as Blockly from 'blockly'` habitual arrastra también los mensajes
 *     en inglés y bloques que aquí no aparecen nunca.
 *  2. El renderizador es `zelos`, el de Scratch: bloques gruesos, con esquinas
 *     redondeadas y objetivos grandes. Los otros están pensados para ratón.
 *  3. La caja de herramientas se construye desde `bloquesDisponibles` de la
 *     actividad. Un niño del mundo 11 no debe ver el bloque de listas del 18:
 *     el andamiaje consiste precisamente en ir mostrando piezas nuevas.
 *
 * El código generado se muestra al lado. Es el puente hacia el editor de texto:
 * el niño ve que sus bloques son código antes de tener que escribirlo.
 */
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { javascriptGenerator, Order } from 'blockly/javascript';
import * as Es from 'blockly/msg/es';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

const props = defineProps<{
  /** Bloques que esta actividad ha desbloqueado. */
  disponibles: readonly string[];
  /** Programa guardado de un intento anterior. */
  estadoInicial?: object | null;
}>();

const emit = defineEmits<{
  /** Cada cambio emite el código y cuántos bloques lo componen. */
  cambio: [{ codigo: string; bloques: number; estado: object }];
}>();

const contenedor = ref<HTMLElement | null>(null);
const espacio = shallowRef<Blockly.WorkspaceSvg | null>(null);

/** Colores por familia de bloque, los mismos que las fichas de los pequeños. */
const COLOR = {
  movimiento: '#1FA2FF',
  bucle: '#FF8A3D',
  condicional: '#FF3CAC',
  variable: '#5AD35A',
  funcion: '#7B61FF',
  sensor: '#06B6D4',
  lista: '#FFD93D',
} as const;

/** Define un bloque de sentencia y su traducción a JavaScript. */
function bloqueSentencia(
  nombre: string,
  etiqueta: string,
  color: string,
  codigo: string,
): void {
  Blockly.Blocks[nombre] = {
    init() {
      this.appendDummyInput().appendField(etiqueta);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(color);
      this.setTooltip(etiqueta);
    },
  };
  // Un generador de sentencia devuelve una cadena, no una tupla. Confundirlo con
  // el de expresión es el error clásico de Blockly y produce codigo vacio.
  javascriptGenerator.forBlock[nombre] = () => codigo;
}

/** Define un bloque que devuelve un valor. */
function bloqueValor(nombre: string, etiqueta: string, color: string, codigo: string): void {
  Blockly.Blocks[nombre] = {
    init() {
      this.appendDummyInput().appendField(etiqueta);
      this.setOutput(true, 'Boolean');
      this.setColour(color);
    },
  };
  javascriptGenerator.forBlock[nombre] = () => [codigo, Order.FUNCTION_CALL];
}

let bloquesDefinidos = false;

function definirBloques(): void {
  if (bloquesDefinidos) return;
  bloquesDefinidos = true;

  // Movimiento
  bloqueSentencia('fuzz_avanzar', '▶ avanzar', COLOR.movimiento, 'fuzz.avanzar();\n');
  bloqueSentencia('fuzz_girar_derecha', '↻ girar a la derecha', COLOR.movimiento, 'fuzz.girarDerecha();\n');
  bloqueSentencia('fuzz_girar_izquierda', '↺ girar a la izquierda', COLOR.movimiento, 'fuzz.girarIzquierda();\n');
  bloqueSentencia('fuzz_saltar', '⤒ saltar', COLOR.movimiento, 'fuzz.saltar();\n');
  bloqueSentencia('fuzz_recoger', '★ recoger', COLOR.movimiento, 'fuzz.recoger();\n');
  bloqueSentencia('fuzz_reparar', '🔧 reparar el puente', COLOR.movimiento, 'fuzz.repararPuente();\n');

  // Sensores
  bloqueValor('fuzz_puede_avanzar', '¿puede avanzar?', COLOR.sensor, 'fuzz.puedeAvanzar()');
  bloqueValor('fuzz_hay_obstaculo', '¿hay un obstaculo?', COLOR.sensor, 'fuzz.hayObstaculo()');

  // Color de la casilla, para comparar con un desplegable.
  Blockly.Blocks.fuzz_color_casilla = {
    init() {
      this.appendDummyInput()
        .appendField('¿la casilla es')
        .appendField(
          new Blockly.FieldDropdown([
            ['roja', 'rojo'],
            ['azul', 'azul'],
            ['verde', 'verde'],
            ['amarilla', 'amarillo'],
          ]),
          'COLOR',
        )
        .appendField('?');
      this.setOutput(true, 'Boolean');
      this.setColour(COLOR.sensor);
    },
  };
  javascriptGenerator.forBlock.fuzz_color_casilla = (bloque) => [
    `fuzz.colorCasilla() === '${bloque.getFieldValue('COLOR')}'`,
    Order.RELATIONAL,
  ];

  /**
   * Bucle contado: el mismo `repetir` que usa la barra de fichas, para que el
   * niño que sube de grupo reconozca la estructura.
   *
   * El número va en un hueco de valor y no escrito dentro del propio bloque. Con
   * el número dentro, un bucle no puede depender de una variable, y entonces el
   * mundo 12 no tiene nada que enseñar: una variable que no gobierna nada es un
   * adorno. Con el hueco ahí encaja un número, una variable o una cuenta. El tres
   * de por defecto viene como bloque en la sombra, así que quien solo quiera
   * escribir un número no nota la diferencia.
   */
  Blockly.Blocks.fuzz_repetir = {
    init() {
      this.appendValueInput('VECES').setCheck('Number').appendField('repetir');
      this.appendDummyInput().appendField('veces');
      this.appendStatementInput('CUERPO').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR.bucle);
      this.setInputsInline(true);
    },
  };
  javascriptGenerator.forBlock.fuzz_repetir = (bloque, generador) => {
    const veces = generador.valueToCode(bloque, 'VECES', Order.NONE) || '0';
    const cuerpo = generador.statementToCode(bloque, 'CUERPO');
    return `repetir(${veces}, () => {\n${cuerpo}});\n`;
  };
}

/** Caja de herramientas filtrada por lo que la actividad permite. */
function construirToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  const permitido = (nombre: string): boolean => props.disponibles.includes(nombre);

  const categorias: Blockly.utils.toolbox.ToolboxItemInfo[] = [];

  const movimiento = [
    'avanzar',
    'girarDerecha',
    'girarIzquierda',
    'saltar',
    'recoger',
    'repararPuente',
  ]
    .filter(permitido)
    .map((cmd) => ({
      kind: 'block' as const,
      type: `fuzz_${cmd.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
    }));

  if (movimiento.length > 0) {
    categorias.push({
      kind: 'category',
      name: 'Mover',
      colour: COLOR.movimiento,
      contents: movimiento,
    });
  }

  if (permitido('repetir') || permitido('mientras') || permitido('hasta')) {
    const contenido: Blockly.utils.toolbox.ToolboxItemInfo[] = [];
    if (permitido('repetir')) {
      // El numero viene puesto en la sombra: quien solo quiera escribir un tres
      // no tiene que ir a buscar el bloque de numero a otra categoria.
      contenido.push({
        kind: 'block',
        type: 'fuzz_repetir',
        inputs: { VECES: { shadow: { type: 'math_number', fields: { NUM: 3 } } } },
      });
    }
    if (permitido('mientras') || permitido('hasta')) {
      contenido.push({ kind: 'block', type: 'controls_whileUntil' });
    }
    categorias.push({ kind: 'category', name: 'Repetir', colour: COLOR.bucle, contents: contenido });
  }

  if (permitido('siSino') || permitido('siColor')) {
    const contenido: Blockly.utils.toolbox.ToolboxItemInfo[] = [
      { kind: 'block', type: 'controls_if' },
    ];
    if (permitido('siColor')) contenido.push({ kind: 'block', type: 'fuzz_color_casilla' });
    contenido.push({ kind: 'block', type: 'fuzz_puede_avanzar' });
    contenido.push({ kind: 'block', type: 'fuzz_hay_obstaculo' });
    contenido.push({ kind: 'block', type: 'logic_compare' });
    contenido.push({ kind: 'block', type: 'logic_operation' });
    categorias.push({
      kind: 'category',
      name: 'Decidir',
      colour: COLOR.condicional,
      contents: contenido,
    });
  }

  if (permitido('variable')) {
    categorias.push({
      kind: 'category',
      name: 'Variables',
      colour: COLOR.variable,
      custom: 'VARIABLE',
      contents: [],
    });
    categorias.push({
      kind: 'category',
      name: 'Numeros',
      colour: COLOR.variable,
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
      ],
    });
  }

  if (permitido('funcion')) {
    categorias.push({
      kind: 'category',
      name: 'Mis bloques',
      colour: COLOR.funcion,
      custom: 'PROCEDURE',
      contents: [],
    });
  }

  if (permitido('lista')) {
    categorias.push({
      kind: 'category',
      name: 'Listas',
      colour: COLOR.lista,
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_length' },
      ],
    });
  }

  return { kind: 'categoryToolbox', contents: categorias };
}

/** Tema con los colores y el tamaño del sistema de diseño. */
const tema = Blockly.Theme.defineTheme('codenest', {
  name: 'codenest',
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: '#f7fbff',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#1e293b',
    flyoutBackgroundColour: '#eef5fb',
    scrollbarColour: '#94a3b8',
  },
  fontStyle: { family: 'Nunito, sans-serif', weight: '700', size: 13 },
});

/** Cuenta los bloques del programa: es la medida que exige la tercera estrella. */
function contarBloques(area: Blockly.WorkspaceSvg): number {
  // Solo los bloques reales, sin contar los huérfanos de la papelera.
  return area.getAllBlocks(false).filter((b) => !b.isInsertionMarker()).length;
}

function emitirCambio(): void {
  const area = espacio.value;
  if (!area) return;

  const codigo = javascriptGenerator.workspaceToCode(area);
  emit('cambio', {
    codigo,
    bloques: contarBloques(area),
    estado: Blockly.serialization.workspaces.save(area),
  });
}

onMounted(() => {
  if (!contenedor.value) return;

  Blockly.setLocale(Es as unknown as Record<string, string>);
  definirBloques();

  const area = Blockly.inject(contenedor.value, {
    toolbox: construirToolbox(),
    theme: tema,
    // Sin esto, Blockly pide sus iconos a `blockly-demo.appspot.com`, un
    // servidor de demostracion de Google. Son dos problemas: en produccion la
    // politica de seguridad bloquea la peticion y los iconos no aparecen, y en
    // cualquier otro sitio la peticion SI sale, de modo que un producto para
    // niños llamaba a un tercero en cada partida. Los archivos estan copiados.
    media: `${import.meta.env.BASE_URL || '/'}blockly/`.replace('//blockly/', '/blockly/'),
    renderer: 'zelos',
    grid: { spacing: 24, length: 3, colour: '#dbe9f5', snap: true },
    zoom: { controls: true, wheel: false, startScale: 0.95, minScale: 0.6, maxScale: 1.5 },
    trashcan: true,
    move: { scrollbars: true, drag: true, wheel: false },
    sounds: false, // el audio lo gestiona Howler
  });

  espacio.value = area;

  if (props.estadoInicial) {
    Blockly.serialization.workspaces.load(props.estadoInicial, area);
  }

  // Los eventos de vista no cambian el programa: filtrarlos evita regenerar el
  // código en cada desplazamiento del lienzo.
  const IGNORAR = new Set<string>([
    Blockly.Events.VIEWPORT_CHANGE,
    Blockly.Events.SELECTED,
    Blockly.Events.CLICK,
    Blockly.Events.TOOLBOX_ITEM_SELECT,
    Blockly.Events.BUBBLE_OPEN,
  ]);

  area.addChangeListener((evento: Blockly.Events.Abstract) => {
    if (evento.type && IGNORAR.has(evento.type)) return;
    emitirCambio();
  });

  emitirCambio();
});

/** Si cambia la actividad, cambia también la caja de herramientas. */
watch(
  () => props.disponibles,
  () => {
    espacio.value?.updateToolbox(construirToolbox());
  },
  { deep: true },
);

onBeforeUnmount(() => {
  espacio.value?.dispose();
  espacio.value = null;
});

/** El contenedor cambia de tamaño al mostrar u ocultar el panel de código. */
function redimensionar(): void {
  const area = espacio.value;
  if (area) Blockly.svgResize(area);
}

defineExpose({ redimensionar });
</script>

<template>
  <div ref="contenedor" class="editor-bloques" />
</template>

<style scoped>
.editor-bloques {
  width: 100%;
  height: 440px;
  overflow: hidden;
  border-radius: var(--radio-lg);
  box-shadow: var(--sombra-panel);
}
</style>
