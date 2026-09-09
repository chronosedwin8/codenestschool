<script setup lang="ts">
/**
 * Editor de texto para los Hackers (mundos 21 al 30).
 *
 * Es Monaco, el editor de Visual Studio Code. Para un niño de once años que ya
 * ha visto a un adulto programar, escribir en un editor de verdad forma parte de
 * la motivación: no es un juguete, es la herramienta.
 *
 * Lo que se adapta a la edad:
 *  - Cuerpo de letra 16 y línea holgada, no los 12 de un editor profesional.
 *  - Autocompletado de la API del Fuzz con explicación en español.
 *  - Los errores se marcan en su línea con un mensaje comprensible, nunca con la
 *    traza de la excepción.
 *  - Sin minimapa ni pliegues: menos cosas que distraigan.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import type { LenguajeCodigo } from '@codenest/shared';

const props = withDefaults(
  defineProps<{
    lenguaje: LenguajeCodigo;
    /** Comandos que la actividad permite: alimentan el autocompletado. */
    disponibles: readonly string[];
    codigoInicial?: string;
    /** Error a marcar tras un intento fallido. */
    errorLinea?: number | null;
    errorMensaje?: string | null;
  }>(),
  { codigoInicial: '', errorLinea: null, errorMensaje: null },
);

const emit = defineEmits<{ cambio: [{ codigo: string; lineas: number }] }>();

const contenedor = ref<HTMLElement | null>(null);
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null);

/** Los trabajadores de Monaco se registran una sola vez por página. */
let entornoListo = false;
function prepararEntorno(): void {
  if (entornoListo) return;
  entornoListo = true;

  self.MonacoEnvironment = {
    getWorker(_id: string, etiqueta: string) {
      if (etiqueta === 'typescript' || etiqueta === 'javascript') return new tsWorker();
      return new editorWorker();
    },
  };
}

/** Documentación de cada comando, en español y con ejemplo. */
const DOCUMENTACION: Record<string, { firma: string; explicacion: string }> = {
  avanzar: { firma: 'fuzz.avanzar()', explicacion: 'Da un paso hacia donde mira el Fuzz.' },
  girarDerecha: { firma: 'fuzz.girarDerecha()', explicacion: 'Gira 90 grados a la derecha.' },
  girarIzquierda: { firma: 'fuzz.girarIzquierda()', explicacion: 'Gira 90 grados a la izquierda.' },
  saltar: { firma: 'fuzz.saltar()', explicacion: 'Salta por encima de la casilla siguiente.' },
  recoger: { firma: 'fuzz.recoger()', explicacion: 'Recoge lo que haya en esta casilla.' },
  repararPuente: {
    firma: 'fuzz.repararPuente()',
    explicacion: 'Arregla el puente roto que hay justo delante.',
  },
  derecha: { firma: 'fuzz.derecha()', explicacion: 'Rueda hacia la derecha hasta que se acabe el camino.' },
  izquierda: { firma: 'fuzz.izquierda()', explicacion: 'Rueda hacia la izquierda hasta que se acabe el camino.' },
  arriba: { firma: 'fuzz.arriba()', explicacion: 'Rueda hacia arriba hasta que se acabe el camino.' },
  abajo: { firma: 'fuzz.abajo()', explicacion: 'Rueda hacia abajo hasta que se acabe el camino.' },
  puedeAvanzar: {
    firma: 'fuzz.puedeAvanzar(): boolean',
    explicacion: 'Devuelve verdadero si el Fuzz puede dar un paso mas.',
  },
  hayObstaculo: {
    firma: 'fuzz.hayObstaculo(): boolean',
    explicacion: 'Devuelve verdadero si hay algo justo delante.',
  },
  colorCasilla: {
    firma: 'fuzz.colorCasilla(): string',
    explicacion: "Devuelve el color de la casilla: 'rojo', 'azul', 'verde'...",
  },
};

/** Declaración de tipos para que Monaco conozca la API y avise de errores. */
function declaracionTipos(disponibles: readonly string[]): string {
  const metodos = disponibles
    .map((cmd) => {
      const doc = DOCUMENTACION[cmd];
      if (!doc) return null;
      const devuelve = doc.firma.includes(': boolean')
        ? 'boolean'
        : doc.firma.includes(': string')
          ? 'string'
          : 'void';
      return `  /** ${doc.explicacion} */\n  ${cmd}(): ${devuelve};`;
    })
    .filter(Boolean)
    .join('\n');

  return [
    'declare const fuzz: {',
    metodos,
    '};',
    '/** Repite el cuerpo el numero de veces indicado. */',
    'declare function repetir(veces: number, cuerpo: () => void): void;',
  ].join('\n');
}

let proveedorRegistrado: monaco.IDisposable | null = null;

/** Autocompletado con los comandos que la actividad permite. */
function registrarAutocompletado(): void {
  proveedorRegistrado?.dispose();

  proveedorRegistrado = monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.'],
    provideCompletionItems(modelo, posicion) {
      const palabra = modelo.getWordUntilPosition(posicion);
      const rango = {
        startLineNumber: posicion.lineNumber,
        endLineNumber: posicion.lineNumber,
        startColumn: palabra.startColumn,
        endColumn: palabra.endColumn,
      };

      const sugerencias: monaco.languages.CompletionItem[] = props.disponibles
        .filter((cmd) => DOCUMENTACION[cmd])
        .map((cmd) => {
          const doc = DOCUMENTACION[cmd]!;
          return {
            label: cmd,
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: `${cmd}()`,
            detail: doc.firma,
            documentation: { value: doc.explicacion },
            range: rango,
          };
        });

      // Estructuras: se ofrecen como plantillas ya montadas.
      sugerencias.push({
        label: 'repetir',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'repetir(${1:3}, () => {\n  $0\n});',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'repetir(veces, cuerpo)',
        documentation: { value: 'Repite las instrucciones el numero de veces que digas.' },
        range: rango,
      });

      sugerencias.push({
        label: 'for',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'for (let i = 0; i < ${1:5}; i++) {\n  $0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'bucle for',
        documentation: { value: 'Repite contando: i vale 0, luego 1, luego 2...' },
        range: rango,
      });

      return { suggestions: sugerencias };
    },
  });
}

/** Tema legible, con buen contraste para pantallas de colegio. */
function definirTema(): void {
  monaco.editor.defineTheme('codenest-oscuro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7d8fb3', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff8ad8' },
      { token: 'number', foreground: 'ffd93d' },
      { token: 'string', foreground: '8ee68e' },
      { token: 'identifier', foreground: 'e8eeff' },
    ],
    colors: {
      'editor.background': '#141d33',
      'editor.foreground': '#e8eeff',
      'editorCursor.foreground': '#1FA2FF',
      'editor.lineHighlightBackground': '#1c2745',
      'editorLineNumber.foreground': '#5a6b91',
      'editorLineNumber.activeForeground': '#1FA2FF',
    },
  });
}

onMounted(() => {
  if (!contenedor.value) return;

  prepararEntorno();
  definirTema();

  // Monaco no conoce la API del juego: se le declara para que avise de errores
  // reales y no marque `fuzz` como variable inexistente.
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    noLib: false,
    strict: false,
  });
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    declaracionTipos(props.disponibles),
    'file:///fuzz.d.ts',
  );

  registrarAutocompletado();

  const instancia = monaco.editor.create(contenedor.value, {
    value: props.codigoInicial,
    // pylite traduce el Python antes de ejecutarlo, pero Monaco lo resalta como
    // Python para que el niño vea su propio lenguaje.
    language: props.lenguaje === 'python' ? 'python' : 'javascript',
    theme: 'codenest-oscuro',
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
    minimap: { enabled: false },
    folding: false,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    renderWhitespace: 'none',
    padding: { top: 14, bottom: 14 },
    // Los paréntesis y las llaves se cierran solos: una fuente de frustración menos.
    autoClosingBrackets: 'always',
    suggestOnTriggerCharacters: true,
    quickSuggestions: { other: true, comments: false, strings: false },
  });

  editor.value = instancia;

  instancia.onDidChangeModelContent(() => {
    const codigo = instancia.getValue();
    emit('cambio', {
      codigo,
      lineas: codigo
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('#')).length,
    });
  });
});

/** Marca el error en su línea tras un intento fallido. */
watch(
  () => [props.errorLinea, props.errorMensaje] as const,
  ([linea, mensaje]) => {
    const instancia = editor.value;
    const modelo = instancia?.getModel();
    if (!instancia || !modelo) return;

    if (linea === null || linea === undefined || !mensaje) {
      monaco.editor.setModelMarkers(modelo, 'juego', []);
      return;
    }

    monaco.editor.setModelMarkers(modelo, 'juego', [
      {
        severity: monaco.MarkerSeverity.Warning,
        message: mensaje,
        startLineNumber: linea,
        endLineNumber: linea,
        startColumn: 1,
        endColumn: modelo.getLineMaxColumn(linea),
      },
    ]);

    // Se lleva la vista al error: en un programa largo puede quedar fuera.
    instancia.revealLineInCenter(linea);
  },
);

/** Cambia el lenguaje sin recrear el editor, para no perder lo escrito. */
watch(
  () => props.lenguaje,
  (nuevo) => {
    const modelo = editor.value?.getModel();
    if (modelo) monaco.editor.setModelLanguage(modelo, nuevo === 'python' ? 'python' : 'javascript');
  },
);

onBeforeUnmount(() => {
  proveedorRegistrado?.dispose();
  editor.value?.dispose();
  editor.value = null;
});

defineExpose({
  obtenerCodigo: (): string => editor.value?.getValue() ?? '',
  establecerCodigo: (codigo: string): void => editor.value?.setValue(codigo),
});
</script>

<template>
  <div ref="contenedor" class="editor-texto" />
</template>

<style scoped>
.editor-texto {
  width: 100%;
  height: 440px;
  overflow: hidden;
  border-radius: var(--radio-lg);
  box-shadow: var(--sombra-panel);
}
</style>
