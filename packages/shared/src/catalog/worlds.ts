/**
 * Catalogo de los 30 mundos de CodeNest School.
 *
 * FUENTE UNICA DE VERDAD. La consumen:
 *  - apps/backend/prisma/seed.ts        (siembra la tabla `mundos`)
 *  - scripts/generate-voiceover.ts      (claves de audio y voces)
 *  - apps/frontend (mapa-mundo, paletas, biomas, carga diferida de editores)
 *  - packages/content (validacion de que cada JSON coincide con su mundo)
 *
 * El rango de actividades NO se guarda aqui como dato: se deriva de `numero`
 * (mundo = ceil(N/20)); ver `numeroGlobal()` en types/activity.ts.
 */
import { GRUPO_EDAD, type GrupoEdad } from '../types/age-group.js';
import {
  LENGUAJE_CODIGO,
  TIPO_EDITOR,
  type LenguajeCodigo,
  type TipoEditor,
} from '../types/editor.js';

export interface WorldDefinition {
  /** 1 a 30. */
  readonly numero: number;
  readonly slug: string;
  readonly nombre: string;
  readonly grupo: GrupoEdad;
  /** Concepto de programacion que ensena el mundo. */
  readonly concepto: string;
  readonly descripcion: string;
  /** Bioma visual: define tileset, paleta y musica. */
  readonly bioma: string;
  readonly editor: TipoEditor;
  readonly lenguajes: readonly LenguajeCodigo[];
  readonly icono: string;
  readonly colorPrimario: string;
  readonly colorSecundario: string;
  /** Comandos y estructuras que se desbloquean en este mundo (scaffolding). */
  readonly desbloquea: readonly string[];
}

const { comandos, javascript, python } = LENGUAJE_CODIGO;

export const MUNDOS: readonly WorldDefinition[] = [
  // GRUPO 1: EXPLORADORES (4-6 anos) - interfaz 100% grafica
  {
    numero: 1,
    slug: 'planeta-de-los-fuzzes',
    nombre: 'El Planeta de los Fuzzes',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Secuencias directas simples',
    descripcion: 'Caminos en linea recta y giros de 90 grados para recolectar estrellas.',
    bioma: 'espacio-pastel',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'planeta',
    colorPrimario: '#1FA2FF',
    colorSecundario: '#7B61FF',
    desbloquea: ['derecha', 'izquierda', 'arriba', 'abajo'],
  },
  {
    numero: 2,
    slug: 'bosque-arcoiris',
    nombre: 'El Bosque Arcoiris',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Condicionales de color visuales',
    descripcion: 'Si la casilla es roja, gira. Eleccion de caminos segun colores.',
    bioma: 'bosque-arcoiris',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'arcoiris',
    colorPrimario: '#5AD35A',
    colorSecundario: '#FF3CAC',
    desbloquea: ['siColor'],
  },
  {
    numero: 3,
    slug: 'pradera-de-los-saltos',
    nombre: 'La Pradera de los Saltos',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Bucles de repeticion visuales',
    descripcion: 'Tarjetas Repetir 2x y 3x para saltar agujeros y charcos.',
    bioma: 'pradera',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'salto',
    colorPrimario: '#5AD35A',
    colorSecundario: '#FFD93D',
    desbloquea: ['saltar', 'repetir'],
  },
  {
    numero: 4,
    slug: 'cueva-de-los-ecos',
    nombre: 'La Cueva de los Ecos',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Patrones de movimiento',
    descripcion: 'Identificacion de patrones repetitivos: arriba-derecha-arriba-derecha.',
    bioma: 'cueva-cristal',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'eco',
    colorPrimario: '#7B61FF',
    colorSecundario: '#06B6D4',
    desbloquea: [],
  },
  {
    numero: 5,
    slug: 'oasis-dulce',
    nombre: 'El Oasis Dulce',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Secuencias con recoleccion',
    descripcion: 'El orden en que recoges los objetos cambia el camino que debes seguir.',
    bioma: 'oasis-dulce',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'dulce',
    colorPrimario: '#FF8A3D',
    colorSecundario: '#FFD93D',
    desbloquea: ['recoger'],
  },
  {
    numero: 6,
    slug: 'castillo-de-nubes',
    nombre: 'El Castillo de Nubes',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Condicionales simples (si / sino)',
    descripcion: 'Decide izquierda o derecha segun haya viento o un obstaculo.',
    bioma: 'castillo-nubes',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'nube',
    colorPrimario: '#1FA2FF',
    colorSecundario: '#F8FAFC',
    desbloquea: ['siSino', 'hayObstaculo'],
  },
  {
    numero: 7,
    slug: 'bahia-de-los-piratas',
    nombre: 'La Bahia de los Piratas',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Subrutinas simples',
    descripcion: 'Agrupa 2 o 3 instrucciones en un bloque de Super Salto y reutilizalo.',
    bioma: 'bahia-pirata',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'pirata',
    colorPrimario: '#06B6D4',
    colorSecundario: '#FF8A3D',
    desbloquea: ['funcion'],
  },
  {
    numero: 8,
    slug: 'montana-neon',
    nombre: 'La Montana Neon',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Bucles finitos vs infinitos',
    descripcion: 'Deten a los rodadores aplicando bloques de conteo exacto.',
    bioma: 'montana-neon',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'montana',
    colorPrimario: '#FF3CAC',
    colorSecundario: '#1FA2FF',
    desbloquea: [],
  },
  {
    numero: 9,
    slug: 'valle-de-los-dinosaurios',
    nombre: 'El Valle de los Dinosaurios',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Depuracion visual basica',
    descripcion: 'Corrige el paso equivocado dentro de un camino ya programado.',
    bioma: 'valle-jurasico',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'dino',
    colorPrimario: '#5AD35A',
    colorSecundario: '#FF8A3D',
    desbloquea: [],
  },
  {
    numero: 10,
    slug: 'estacion-espacial-fuzz',
    nombre: 'Estacion Espacial Fuzz',
    grupo: GRUPO_EDAD.exploradores,
    concepto: 'Desafio integrador',
    descripcion: 'Combina secuencias, colores y bucles para que despegue el cohete.',
    bioma: 'estacion-espacial',
    editor: TIPO_EDITOR.comandos,
    lenguajes: [comandos],
    icono: 'cohete',
    colorPrimario: '#7B61FF',
    colorSecundario: '#FFD93D',
    desbloquea: [],
  },

  // GRUPO 2: CREADORES (7-9 anos) - Blockly con codigo visible
  {
    numero: 11,
    slug: 'reino-de-cristal',
    nombre: 'El Reino de Cristal',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Bucles Repeat X Times',
    descripcion: 'Optimiza con bucles contados para atravesar los puentes de cristal.',
    bioma: 'reino-cristal',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'cristal',
    colorPrimario: '#06B6D4',
    colorSecundario: '#7B61FF',
    desbloquea: ['avanzar', 'girarDerecha', 'girarIzquierda', 'repetir'],
  },
  {
    numero: 12,
    slug: 'cuevas-mecanicas',
    nombre: 'Las Cuevas Mecanicas',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Variables contadoras basicas',
    descripcion: 'Declara gemas = 0 y suma su valor al atravesar cada casilla.',
    bioma: 'cuevas-mecanicas',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'engranaje',
    colorPrimario: '#FF8A3D',
    colorSecundario: '#475569',
    desbloquea: ['variable'],
  },
  {
    numero: 13,
    slug: 'ciudad-de-los-engranajes',
    nombre: 'La Ciudad de los Engranajes',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Funciones sin parametros',
    descripcion: 'Crea funciones propias como repararPuente() y llamalas cuando haga falta.',
    bioma: 'ciudad-engranajes',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'ciudad',
    colorPrimario: '#FFD93D',
    colorSecundario: '#FF8A3D',
    desbloquea: ['funcion', 'repararPuente'],
  },
  {
    numero: 14,
    slug: 'templo-de-los-elementos',
    nombre: 'El Templo de los Elementos',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Condicionales avanzadas (if / else)',
    descripcion: 'Evalua condiciones como fuego == true para activar los hechizos.',
    bioma: 'templo-elementos',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'templo',
    colorPrimario: '#FF3CAC',
    colorSecundario: '#FF8A3D',
    desbloquea: ['siSino'],
  },
  {
    numero: 15,
    slug: 'laberinto-isometrico',
    nombre: 'El Laberinto Isometrico',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Operadores logicos (AND, OR)',
    descripcion: 'Cruza puertas que exigen dos llaves a la vez: llaveAzul AND llaveRoja.',
    bioma: 'laberinto-iso',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'laberinto',
    colorPrimario: '#7B61FF',
    colorSecundario: '#1FA2FF',
    desbloquea: [],
  },
  {
    numero: 16,
    slug: 'fabrica-de-baterias',
    nombre: 'La Fabrica de Baterias',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Funciones con parametros',
    descripcion: 'Pasa valores a tus funciones, como cargarBateria(nivel).',
    bioma: 'fabrica-baterias',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'bateria',
    colorPrimario: '#5AD35A',
    colorSecundario: '#FFD93D',
    desbloquea: [],
  },
  {
    numero: 17,
    slug: 'bioma-congelado',
    nombre: 'El Bioma Congelado',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Bucles condicionales (while / until)',
    descripcion: 'Avanza mientras el hielo no se rompa bajo las patas del Fuzz.',
    bioma: 'bioma-congelado',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'hielo',
    colorPrimario: '#06B6D4',
    colorSecundario: '#F8FAFC',
    desbloquea: ['mientras', 'hasta'],
  },
  {
    numero: 18,
    slug: 'archipielago-volcanico',
    nombre: 'El Archipielago Volcanico',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Introduccion a listas y arreglos',
    descripcion: 'Guarda secuencias de pasos en una lista de memoria y reproducelas.',
    bioma: 'archipielago-volcanico',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'volcan',
    colorPrimario: '#FF3CAC',
    colorSecundario: '#FF8A3D',
    desbloquea: ['lista'],
  },
  {
    numero: 19,
    slug: 'mision-de-reconocimiento',
    nombre: 'La Mision de Reconocimiento',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Depuracion de bloques compleja',
    descripcion: 'Arregla dos o mas errores en un programa que ya viene escrito.',
    bioma: 'mision-recon',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'radar',
    colorPrimario: '#1FA2FF',
    colorSecundario: '#5AD35A',
    desbloquea: [],
  },
  {
    numero: 20,
    slug: 'fortaleza-del-titan',
    nombre: 'La Fortaleza del Titan',
    grupo: GRUPO_EDAD.creadores,
    concepto: 'Desafio integrador',
    descripcion: 'Combina funciones, variables y bucles while para vencer al Titan.',
    bioma: 'fortaleza-titan',
    editor: TIPO_EDITOR.bloques,
    lenguajes: [javascript],
    icono: 'titan',
    colorPrimario: '#475569',
    colorSecundario: '#FF3CAC',
    desbloquea: [],
  },

  // GRUPO 3: HACKERS (10-12+ anos) - Monaco Editor
  {
    numero: 21,
    slug: 'ciudad-ciberisometrica',
    nombre: 'La Ciudad Ciberisometrica',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Sintaxis basica',
    descripcion: 'Escribe codigo real: let velocidad = 5; move(velocidad);',
    bioma: 'ciudad-ciber',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'terminal',
    colorPrimario: '#06B6D4',
    colorSecundario: '#FF3CAC',
    desbloquea: [],
  },
  {
    numero: 22,
    slug: 'servidor-olvidado',
    nombre: 'El Servidor Olvidado',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Arrays y arreglos indexados',
    descripcion: 'Manipula listas: puertas[0].unlock() e iteracion por indice.',
    bioma: 'servidor-olvidado',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'servidor',
    colorPrimario: '#5AD35A',
    colorSecundario: '#475569',
    desbloquea: [],
  },
  {
    numero: 23,
    slug: 'laboratorio-antivirus',
    nombre: 'El Laboratorio Antivirus',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Bucles for e iteradores',
    descripcion: 'Recorre matrices 2.5D eliminando virus casilla por casilla.',
    bioma: 'laboratorio',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'virus',
    colorPrimario: '#5AD35A',
    colorSecundario: '#1FA2FF',
    desbloquea: [],
  },
  {
    numero: 24,
    slug: 'red-submarina',
    nombre: 'La Red Submarina',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Estructuras de datos (diccionarios)',
    descripcion: 'Maneja objetos JSON: { x: 4, y: 12, estado: "activo" }.',
    bioma: 'red-submarina',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'submarino',
    colorPrimario: '#1FA2FF',
    colorSecundario: '#06B6D4',
    desbloquea: [],
  },
  {
    numero: 25,
    slug: 'reactor-nuclear',
    nombre: 'El Reactor Nuclear',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Eventos: responder en vez de decidir antes',
    /**
     * El plan original decia async/await, y no se puede ensenar aqui con
     * honestidad: la API del juego es sincrona y no hay nada que esperar, asi que
     * un await seria decorativo y el nino aprenderia a escribir una palabra que no
     * hace nada. Lo que si es la mitad de verdad de esa idea, y ademas la mitad
     * util, es dejar de decidir de antemano y responder a lo que llega: una tabla
     * que asocia cada aviso del reactor con la funcion que lo atiende.
     */
    descripcion:
      'Guarda funciones en un objeto y llama a la que toque segun el aviso que llegue.',
    bioma: 'reactor-nuclear',
    editor: TIPO_EDITOR.texto,
    // Solo JavaScript: en pylite una funcion no es un valor que se pueda guardar.
    lenguajes: [javascript],
    icono: 'reactor',
    colorPrimario: '#FFD93D',
    colorSecundario: '#FF3CAC',
    desbloquea: [],
  },
  {
    numero: 26,
    slug: 'desierto-de-algoritmos',
    nombre: 'El Desierto de Algoritmos',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Busqueda y ordenamiento',
    descripcion: 'Algoritmos simples de busqueda y orden sobre el inventario.',
    bioma: 'desierto-algoritmos',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'desierto',
    colorPrimario: '#FF8A3D',
    colorSecundario: '#FFD93D',
    desbloquea: [],
  },
  {
    numero: 27,
    slug: 'satelite-hackeado',
    nombre: 'El Satelite Hackeado',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Excepciones (try / catch)',
    descripcion: 'Maneja errores para evitar que el sistema colapse en pleno vuelo.',
    bioma: 'satelite',
    editor: TIPO_EDITOR.texto,
    // Solo JavaScript: pylite no implementa try/except.
    lenguajes: [javascript],
    icono: 'satelite',
    colorPrimario: '#7B61FF',
    colorSecundario: '#06B6D4',
    desbloquea: [],
  },
  {
    numero: 28,
    slug: 'centro-de-drones',
    nombre: 'El Centro de Drones',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Pathfinding (algoritmos de rutas)',
    descripcion: 'Programa un dron que esquive obstaculos de forma autonoma.',
    bioma: 'centro-drones',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'dron',
    colorPrimario: '#1FA2FF',
    colorSecundario: '#475569',
    desbloquea: [],
  },
  {
    numero: 29,
    slug: 'arena-cibersegura',
    nombre: 'La Arena Cibersegura',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Refactorizacion y eficiencia',
    descripcion: 'Reduce las lineas de codigo y optimiza el uso de CPU virtual.',
    bioma: 'arena-ciber',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'arena',
    colorPrimario: '#FF3CAC',
    colorSecundario: '#7B61FF',
    desbloquea: [],
  },
  {
    numero: 30,
    slug: 'nucleo-de-la-ia',
    nombre: 'El Nucleo de la IA',
    grupo: GRUPO_EDAD.hackers,
    concepto: 'Proyecto final',
    descripcion: 'Escribe el script completo del comportamiento de un ejercito robotico.',
    bioma: 'nucleo-ia',
    editor: TIPO_EDITOR.texto,
    lenguajes: [javascript, python],
    icono: 'ia',
    colorPrimario: '#7B61FF',
    colorSecundario: '#FFD93D',
    desbloquea: [],
  },
];

export const MUNDO_POR_NUMERO: ReadonlyMap<number, WorldDefinition> = new Map(
  MUNDOS.map((m) => [m.numero, m]),
);

export const MUNDO_POR_SLUG: ReadonlyMap<string, WorldDefinition> = new Map(
  MUNDOS.map((m) => [m.slug, m]),
);

export function mundosDeGrupo(grupo: GrupoEdad): readonly WorldDefinition[] {
  return MUNDOS.filter((m) => m.grupo === grupo);
}

export function mundoDe(numero: number): WorldDefinition {
  const mundo = MUNDO_POR_NUMERO.get(numero);
  if (!mundo) throw new Error(`No existe el mundo ${numero} (rango valido: 1-30)`);
  return mundo;
}

/**
 * Comandos y estructuras acumulados hasta un mundo (scaffolding progresivo).
 * El scaffolding se reinicia en cada grupo de edad: los Creadores no heredan
 * las fichas de los Exploradores, usan bloques equivalentes de Blockly.
 */
export function comandosAcumulados(hastaMundo: number): readonly string[] {
  const grupo = mundoDe(hastaMundo).grupo;
  const acumulado = new Set<string>();
  for (const m of MUNDOS) {
    if (m.numero > hastaMundo) break;
    if (m.grupo !== grupo) continue;
    for (const c of m.desbloquea) acumulado.add(c);
  }
  return [...acumulado];
}
