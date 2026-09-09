/**
 * Mundo 19: La Misión de Reconocimiento. Encontrar la pieza mala.
 *
 * El mundo 9 hizo esto con fichas y era el mundo más difícil de los Exploradores.
 * Aquí es más difícil todavía, porque los programas que hay que leer usan las ocho
 * ideas de los Creadores y el fallo puede estar dentro de un bloque propio, dentro
 * de un bucle sin número o en una de las dos mitades de una condición.
 *
 * El programa llega montado en el área de trabajo, con las piezas puestas. Eso hizo
 * falta construirlo: hay que traducir el programa al formato que carga Blockly y
 * guardarlo en la actividad. Sin eso, "arregla la pieza que está mal" no se puede
 * plantear, porque el niño abriría un área vacía y tendría que escribir el programa
 * entero, que es otro ejercicio y bastante más aburrido.
 *
 * El fallo no se escribe a mano: se declara (una flecha girada, un número cambiado,
 * las dos ramas del si al revés) y se aplica sobre el programa bueno. Así el
 * arreglo es siempre una sola pieza, que es lo que promete la actividad. Y
 * `validate-content` comprueba que el programa entregado falla de verdad: uno que
 * ya funcionara dejaría la actividad sin nada que hacer.
 *
 * Los tipos de fallo, que son el temario real del mundo:
 *
 *   giro       una pieza de girar apunta al otro lado
 *   cuenta     el número de un bucle, de menos o de más
 *   falta      una pieza que no está
 *   sobra      una pieza que no toca
 *   orden      dos piezas cambiadas de sitio
 *   ramas      las dos bocas del si, al revés
 *   modo       mientras donde tenía que decir hasta
 *   condicion  la pregunta mira el sensor equivocado
 *
 * Progresión:
 *   1-4    fallos en un programa de piezas sueltas y bucles.
 *   5-9    el fallo dentro de un bloque propio, que rompe todos sus usos.
 *   10-14  fallos en condiciones y en bucles sin número.
 *   15-18  fallos en listas y en huecos de bloques.
 *   19-20  el informe de Radar.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  define,
  elemento,
  esColor,
  gira,
  girarDerecha,
  girarIzquierda,
  hasta,
  hayObstaculo,
  lista,
  longitud,
  mientras,
  num,
  pinta,
  pon,
  puedeAvanzar,
  repetir,
  suma,
  usa,
  vble,
  y,
  type Bloque,
  type ContextoCreador,
  type Expresion,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const BLOQUES = [
  'avanzar',
  'girarDerecha',
  'girarIzquierda',
  'repetir',
  'mientras',
  'hasta',
  'siColor',
  'siSino',
  'variable',
  'lista',
  'funcion',
];

// ─────────────────────────── El fallo que se mete ──────────────────────────

/** Camino hasta una pieza: cada número entra un nivel. */
type Ruta = readonly number[];

type Fallo =
  | { readonly tipo: 'giro'; readonly ruta: Ruta }
  | { readonly tipo: 'cuenta'; readonly ruta: Ruta; readonly veces: number }
  | { readonly tipo: 'falta'; readonly ruta: Ruta }
  | { readonly tipo: 'sobra'; readonly ruta: Ruta; readonly pieza: Bloque }
  | { readonly tipo: 'orden'; readonly ruta: Ruta }
  | { readonly tipo: 'ramas'; readonly ruta: Ruta }
  | { readonly tipo: 'modo'; readonly ruta: Ruta }
  | { readonly tipo: 'condicion'; readonly ruta: Ruta; readonly nueva: Expresion };

/** Una pieza mientras se la manipula: la misma forma, pero editable. */
type Editable = Record<string, unknown>;

/**
 * La lista de piezas que contiene la posición a la que apunta la ruta.
 *
 * Un contenedor puede llamarse de tres maneras según la pieza: `cuerpo` en los
 * bucles y en los bloques propios, y `entonces` en los condicionales.
 */
function contenedor(programa: Editable[], ruta: Ruta): Editable[] {
  let lista_ = programa;
  for (const i of ruta.slice(0, -1)) {
    const paso = lista_[i];
    const dentro = (paso?.cuerpo ?? paso?.entonces) as Editable[] | undefined;
    if (!dentro) {
      throw new Error(`La ruta ${ruta.join('.')} no lleva a ninguna pieza con contenido.`);
    }
    lista_ = dentro;
  }
  return lista_;
}

/** Aplica el fallo sobre una copia del programa bueno. */
function romper(programa: readonly Bloque[], fallo: Fallo): Bloque[] {
  const copia = JSON.parse(JSON.stringify(programa)) as Editable[];
  const lista_ = contenedor(copia, fallo.ruta);
  const i = fallo.ruta[fallo.ruta.length - 1]!;
  const pieza = lista_[i];

  if (!pieza && fallo.tipo !== 'sobra') {
    throw new Error(`La ruta ${fallo.ruta.join('.')} no apunta a ninguna pieza.`);
  }

  switch (fallo.tipo) {
    case 'giro':
      pieza!.hacer = pieza!.hacer === 'girarDerecha' ? 'girarIzquierda' : 'girarDerecha';
      break;
    case 'cuenta':
      pieza!.repetir = { numero: fallo.veces };
      break;
    case 'falta':
      lista_.splice(i, 1);
      break;
    case 'sobra':
      lista_.splice(i, 0, JSON.parse(JSON.stringify(fallo.pieza)) as Editable);
      break;
    case 'orden': {
      const siguiente = lista_[i + 1];
      if (!siguiente) throw new Error('No hay pieza siguiente con la que cambiar el orden.');
      lista_[i] = siguiente;
      lista_[i + 1] = pieza!;
      break;
    }
    case 'ramas': {
      const entonces = pieza!.entonces;
      pieza!.entonces = pieza!.sino ?? [];
      pieza!.sino = entonces;
      break;
    }
    case 'modo': {
      // Cambiar mientras por hasta: la condicion se queda, la palabra cambia.
      if ('mientras' in pieza!) {
        pieza!.hasta = pieza!.mientras;
        delete pieza!.mientras;
      } else {
        pieza!.mientras = pieza!.hasta;
        delete pieza!.hasta;
      }
      break;
    }
    case 'condicion': {
      const nueva = JSON.parse(JSON.stringify(fallo.nueva)) as Editable;
      if ('si' in pieza!) pieza!.si = nueva;
      else if ('mientras' in pieza!) pieza!.mientras = nueva;
      else pieza!.hasta = nueva;
      break;
    }
  }

  return copia as unknown as Bloque[];
}

// ──────────────────────────── Formas de tablero ────────────────────────────

function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

function escalera(largos: readonly number[]): PasoCamino[] {
  return largos.flatMap((largo) => escalon(largo));
}

/** El escalon entero escrito a mano, incluida la bajada del final. */
function escalonSuelto(largo: number): Bloque[] {
  return [repetir(largo, avanzar()), girarDerecha(), avanzar(), girarIzquierda()];
}

/**
 * Decisiones que cuesta recorrer una espiral preguntando hacia delante.
 *
 * Cada casilla es una vuelta y cada giro es otra vuelta en la que el Fuzz no se
 * mueve. Se calcula porque escribirlo a mano falla: la primera version de este
 * mundo decia veintiseis donde eran veintiuna.
 */
function decisionesEspiral(brazos: number, primero = 3): number {
  let casillas = 0;
  for (let i = 0; i < brazos; i++) casillas += primero + i;
  return casillas + (brazos - 1);
}

/** Casillas de una espiral: las vueltas del bucle que lee el suelo. */
function casillasEspiral(brazos: number, primero = 3): number {
  let casillas = 0;
  for (let i = 0; i < brazos; i++) casillas += primero + i;
  return casillas;
}

/** Espiral que se abre: la unica forma segura cuando el programa usa sensores. */
function espiral(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

/** Espiral con el camino bueno pintado de verde salvo el final de cada brazo. */
function espiralVerde(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [pinta('verde')];
  for (let i = 0; i < brazos; i++) {
    const largo = primero + i;
    for (let c = 0; c < largo; c++) {
      pasos.push(andar(1));
      if (c < largo - 1) pasos.push(pinta('verde'));
    }
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

/** Camino con las esquinas marcadas en rojo, para el programa que lee el suelo. */
function caminoRojo(tramos: readonly number[]): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  tramos.forEach((largo, i) => {
    pasos.push(andar(largo));
    if (i < tramos.length - 1) {
      pasos.push(pinta('rojo'), gira('derecha'));
    }
  });
  return pasos;
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly bueno: readonly Bloque[];
  readonly fallo: Fallo;
}

/** El bloque de escalón con hueco, que aparece en varias actividades. */
const ISLA = define(
  'isla',
  [repetir(vble('largo'), avanzar()), girarDerecha(), avanzar(), girarIzquierda()],
  ['largo'],
);

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La pieza que gira al reves',
    instruccion:
      'Radar ve el error antes que nadie y dice que es porque no busca el error: busca donde el programa deja de parecerse al tablero. Este programa ya esta montado y tiene una pieza mal. Solo una.',
    exito: 'Una pieza de girar apuntando al otro lado. El primer escalon ya salia torcido.',
    pistas: [
      'Sigue el programa con el dedo por el tablero, pieza a pieza.',
      'Mira los giros del primer escalon.',
    ],
    camino: escalera([3, 2, 3]),
    bueno: [...escalonSuelto(3), ...escalonSuelto(2), ...escalonSuelto(3)],
    fallo: { tipo: 'giro', ruta: [1] },
  },
  {
    nombre: 'El numero de menos',
    instruccion:
      'Este programa hace todo bien y se queda corto. No falta ninguna pieza y no hay ninguna al reves.',
    exito: 'Un numero de menos en un bucle. El Fuzz se paraba a mitad del primer tramo.',
    pistas: ['El Fuzz se para antes de llegar, no se estrella.', 'Cuenta las casillas del primer tramo.'],
    camino: escalera([4, 2, 3]),
    bueno: [...escalonSuelto(4), ...escalonSuelto(2), ...escalonSuelto(3)],
    fallo: { tipo: 'cuenta', ruta: [0], veces: 2 },
  },
  {
    nombre: 'La pieza que falta',
    instruccion:
      'Aqui falta una pieza dentro de un escalon. El Fuzz llega al borde y no baja.',
    exito: 'Faltaba la pieza de bajar. Un escalon son cuatro piezas y habia tres.',
    pistas: ['Compara el primer escalon con el segundo, pieza por pieza.', 'Deberian ser iguales.'],
    camino: escalera([3, 3, 3]),
    bueno: [...escalonSuelto(3), ...escalonSuelto(3), ...escalonSuelto(3)],
    fallo: { tipo: 'falta', ruta: [2] },
  },
  {
    nombre: 'Dos piezas cambiadas',
    instruccion:
      'Estan todas las piezas y todas son las que hacen falta. Lo que esta mal es el orden: dos piezas seguidas estan cambiadas de sitio.',
    exito: 'Estaban las dos, pero al reves. El orden es parte de la pieza aunque no se vea.',
    pistas: ['El giro y el avanzar del primer escalon.', 'Cual de los dos va antes?'],
    camino: escalera([2, 3, 2]),
    bueno: [...escalonSuelto(2), ...escalonSuelto(3), ...escalonSuelto(2)],
    fallo: { tipo: 'orden', ruta: [1] },
  },
  {
    nombre: 'El fallo esta dentro del bloque',
    instruccion:
      'Este programa usa un bloque propio cuatro veces, y el bloque esta mal. Fijate en lo bueno que tiene: arreglas una pieza y se arreglan las cuatro.',
    exito: 'Una pieza dentro del bloque. Cuatro escalones arreglados de golpe.',
    pistas: ['Mira dentro del bloque, no las llamadas.', 'Uno de los dos giros del bloque apunta mal.'],
    camino: escalera([2, 3, 1, 4]),
    bueno: [
      ISLA,
      usa('isla', num(2)),
      usa('isla', num(3)),
      usa('isla', num(1)),
      usa('isla', num(4)),
    ],
    fallo: { tipo: 'giro', ruta: [0, 1] },
  },
  {
    nombre: 'El hueco equivocado',
    instruccion:
      'El bloque esta bien y las llamadas casi. Una de las cuatro le pasa un numero que no toca.',
    exito: 'Un numero mal en una sola llamada. El bloque no tenia culpa de nada.',
    pistas: ['Compara los numeros de las llamadas con los largos del tablero.', 'Fijate en la tercera.'],
    camino: escalera([2, 3, 1, 4]),
    bueno: [
      ISLA,
      usa('isla', num(2)),
      usa('isla', num(3)),
      usa('isla', num(1)),
      usa('isla', num(4)),
    ],
    fallo: { tipo: 'sobra', ruta: [3], pieza: usa('isla', num(3)) },
  },
  {
    nombre: 'Una llamada de menos',
    instruccion: 'El bloque esta perfecto. Lo que falta esta fuera: el programa lo usa menos veces.',
    exito: 'Una llamada de menos. No siempre el fallo esta dentro.',
    pistas: ['Cuenta los escalones del tablero y las llamadas del programa.', 'Mira el programa, no el bloque.'],
    camino: escalera([2, 3, 1, 4, 2]),
    bueno: [
      ISLA,
      usa('isla', num(2)),
      usa('isla', num(3)),
      usa('isla', num(1)),
      usa('isla', num(4)),
      usa('isla', num(2)),
    ],
    fallo: { tipo: 'falta', ruta: [4] },
  },
  {
    nombre: 'El bucle que llama al bloque',
    instruccion:
      'Aqui todos los escalones miden lo mismo y hay un bucle alrededor de la llamada. El numero del bucle esta mal.',
    exito: 'El numero del bucle. Contaba escalones y contaba mal.',
    pistas: ['Cuenta los escalones del tablero.', 'El numero del bucle tiene que ser ese.'],
    camino: escalera([2, 2, 2, 2, 2]),
    bueno: [ISLA, repetir(5, usa('isla', num(2)))],
    fallo: { tipo: 'cuenta', ruta: [1], veces: 3 },
  },
  {
    nombre: 'La pieza que sobra dentro del bloque',
    instruccion: 'El bloque tiene una pieza de mas, y como se usa cuatro veces, sobra cuatro veces.',
    exito: 'Una pieza de mas dentro del bloque. Quitar tambien es arreglar.',
    pistas: ['Cuenta las piezas del bloque: deberian ser cuatro.', 'Compara con el primer escalon del tablero.'],
    camino: escalera([3, 2, 3, 2]),
    bueno: [
      ISLA,
      usa('isla', num(3)),
      usa('isla', num(2)),
      usa('isla', num(3)),
      usa('isla', num(2)),
    ],
    fallo: { tipo: 'sobra', ruta: [0, 2], pieza: avanzar() },
  },
  {
    nombre: 'Las dos ramas al reves',
    instruccion:
      'Este es el favorito de Radar. La pieza de decidir esta bien puesta y las dos bocas estan cambiadas: avanza cuando no puede y gira cuando si puede. Justo al contrario.',
    exito:
      'Al reves. Leelo en voz alta y se oye solo: si puedes avanzar, gira. Nadie escribiria eso a proposito.',
    pistas: [
      'Lee la pieza en voz alta: si puedes avanzar, que hace?',
      'Tiene que avanzar cuando puede y girar cuando no.',
    ],
    camino: espiral(4),
    bueno: [repetir(decisionesEspiral(4), { si: puedeAvanzar, entonces: [avanzar()], sino: [girarDerecha()] })],
    fallo: { tipo: 'ramas', ruta: [0, 0] },
  },
  {
    nombre: 'El sensor equivocado',
    instruccion:
      'La pieza de decidir tiene las bocas bien y la pregunta mal: pregunta por lo contrario de lo que hace falta.',
    exito:
      'La pregunta era hay un obstaculo donde tenia que ser puedes avanzar. Son contrarias, asi que el programa hacia todo al reves.',
    pistas: ['Mira la pregunta de la pieza, no las bocas.', 'Que tiene que ser verdad para avanzar?'],
    camino: espiral(4),
    bueno: [repetir(decisionesEspiral(4), { si: puedeAvanzar, entonces: [avanzar()], sino: [girarDerecha()] })],
    fallo: { tipo: 'condicion', ruta: [0, 0], nueva: hayObstaculo },
  },
  {
    nombre: 'Mientras donde iba hasta',
    instruccion:
      'El bucle sin numero esta bien montado y el desplegable dice la palabra equivocada. Con la otra palabra, la misma pregunta significa lo contrario.',
    exito:
      'Mientras y hasta son contrarios. La pregunta era la misma y el bucle hacia justo lo otro.',
    pistas: [
      'Lee el bucle: mientras haya un obstaculo, avanza. Tiene sentido?',
      'Cambia el desplegable, no la pregunta.',
    ],
    camino: espiral(4),
    bueno: [repetir(4, hasta(hayObstaculo, avanzar()), girarDerecha())],
    fallo: { tipo: 'modo', ruta: [0, 0] },
  },
  {
    nombre: 'El bucle sin numero y el de fuera',
    instruccion:
      'Hay dos bucles: uno sin numero que anda el pasillo y otro con numero que cuenta las esquinas. Uno de los dos esta mal, y no es el que no tiene numero.',
    exito: 'El numero de fuera contaba esquinas y contaba mal. El de dentro no tenia nada que contar.',
    pistas: ['Cuenta las esquinas del tablero.', 'El bucle sin numero no puede estar mal contado: no cuenta.'],
    camino: espiral(6),
    bueno: [repetir(6, mientras(puedeAvanzar, avanzar()), girarDerecha())],
    fallo: { tipo: 'cuenta', ruta: [0], veces: 4 },
  },
  {
    nombre: 'La mitad que falta',
    instruccion:
      'La condicion tenia dos mitades y ahora solo tiene una. El Fuzz se mete en el primer pasillo que no debe.',
    exito:
      'Le faltaba la mitad del color. Una condicion incompleta no falla siempre: falla cuando llega el caso que esa mitad cubria.',
    pistas: [
      'El pasillo bueno esta pintado de verde.',
      'La condicion tiene que mirar las dos cosas: que haya camino y que sea verde.',
    ],
    camino: espiralVerde(4),
    bueno: [
      define('tramo', [mientras(y(puedeAvanzar, esColor('verde')), avanzar())]),
      repetir(3, usa('tramo'), girarDerecha(), avanzar()),
      usa('tramo'),
    ],
    fallo: { tipo: 'condicion', ruta: [0, 0], nueva: puedeAvanzar },
  },
  {
    nombre: 'El paso que falta despues del giro',
    instruccion:
      'Este es el fallo mas fino del mundo. El bucle se para por el color de la casilla donde esta el Fuzz, asi que despues de girar sigue mirando esa misma casilla y no arranca. Falta una pieza.',
    exito:
      'Faltaba el paso suelto despues del giro. Sin el, el Fuzz gira sobre si mismo para siempre y el programa parece colgado.',
    pistas: [
      'El Fuzz llega a la primera esquina y se queda ahi girando.',
      'Que hace falta para salir de la casilla que paro el bucle?',
    ],
    camino: espiralVerde(4),
    bueno: [
      define('tramo', [mientras(y(puedeAvanzar, esColor('verde')), avanzar())]),
      repetir(3, usa('tramo'), girarDerecha(), avanzar()),
      usa('tramo'),
    ],
    fallo: { tipo: 'falta', ruta: [1, 2] },
  },
  {
    nombre: 'El indice que no sube',
    instruccion:
      'El programa lee la ruta de una lista y siempre saca el mismo numero. La lista esta bien y el bucle esta bien.',
    exito:
      'Faltaba sumarle uno al indice. Sin eso, el bucle lee el primer numero de la lista todas las veces.',
    pistas: ['El Fuzz hace todos los tramos del mismo largo.', 'Mira la ultima pieza de dentro del bucle.'],
    camino: escalera([2, 3, 1, 4]),
    bueno: [
      pon('ruta', lista(num(2), num(3), num(1), num(4))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        repetir(elemento(vble('ruta'), vble('i')), avanzar()),
        girarDerecha(),
        avanzar(),
        girarIzquierda(),
        suma('i', num(1)),
      ),
    ],
    fallo: { tipo: 'falta', ruta: [2, 4] },
  },
  {
    nombre: 'El indice que empieza mal',
    instruccion:
      'La lista esta bien, el bucle esta bien y el indice sube bien. Lo que esta mal es de donde empieza.',
    exito:
      'El indice empezaba en cero y las listas de Blockly empiezan en uno. Un sitio clasico para equivocarse.',
    pistas: ['El primer tramo sale de un largo que no esta en el tablero.', 'Por que numero empieza una lista?'],
    camino: escalera([2, 3, 1, 4]),
    bueno: [
      pon('ruta', lista(num(2), num(3), num(1), num(4))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        repetir(elemento(vble('ruta'), vble('i')), avanzar()),
        girarDerecha(),
        avanzar(),
        girarIzquierda(),
        suma('i', num(1)),
      ),
    ],
    fallo: { tipo: 'sobra', ruta: [1], pieza: pon('i', num(0)) },
  },
  {
    nombre: 'La esquina que no gira',
    instruccion:
      'El programa lee el suelo: cuando la casilla es roja, gira. Y hay una pieza mal en la parte del giro.',
    exito: 'El giro apuntaba al otro lado, y en un programa que lee el suelo eso se nota en la primera esquina.',
    pistas: ['Las esquinas estan pintadas de rojo.', 'Mira lo que hace el programa cuando encuentra rojo.'],
    camino: caminoRojo([3, 2, 3, 2]),
    bueno: [
      repetir(casillasEspiral(0) + 10, {
        si: esColor('rojo'),
        entonces: [girarDerecha(), avanzar()],
        sino: [avanzar()],
      }),
    ],
    fallo: { tipo: 'giro', ruta: [0, 0] },
  },
  {
    nombre: 'El informe de Radar',
    instruccion:
      'Radar revisa los planos de todas las misiones y dice que el de la noche de la tormenta lo revisó él mismo. Que estaba bien. Y que a la mañana siguiente tenía una línea de más que él no escribió. Arregla este programa y te lo cuenta.',
    exito:
      'Radar me dejo ver el plano. La linea de mas dice una hora, las tres y catorce, y tres palabras: objeto sale Nucleo. Es la misma hora que el registro del cohete de Orbita, y Orbita esta a diez mundos de aqui.',
    pistas: [
      'El programa usa un bloque propio con hueco y una lista.',
      'Mira dentro del bloque antes de mirar la lista.',
    ],
    camino: escalera([2, 3, 1, 4, 2, 3]),
    bueno: [
      ISLA,
      pon('ruta', lista(num(2), num(3), num(1), num(4), num(2), num(3))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
    fallo: { tipo: 'giro', ruta: [0, 3] },
  },
  {
    nombre: 'Donde esta Radar',
    instruccion:
      'Ultimo de la mision. Radar esta en la torre de reconocimiento con el plano encima de la mesa y una lupa. Este programa tiene el fallo mas escondido de los veinte: esta dentro de un bloque, dentro de un bucle, y solo se nota en la ultima vuelta.',
    exito:
      'Radar esta en casa, y ha traido el plano con la linea de mas. Lo ha puesto con todo lo demas. Ocho Fuzzes de los Creadores en el Nido, y ocho cosas que nadie sabe explicar. Manana empiezan los Hackers.',
    pistas: [
      'Empieza comprobando el bloque con un solo escalon.',
      'Si el bloque esta bien, el fallo esta en el numero o en la lista.',
    ],
    camino: escalera([2, 2, 3, 1, 2, 4, 2]),
    bueno: [
      ISLA,
      pon('ruta', lista(num(2), num(2), num(3), num(1), num(2), num(4), num(2))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
    fallo: { tipo: 'cuenta', ruta: [0, 0], veces: 2 },
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 19,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  return actividadCreador(contexto, {
    camino: receta.camino,
    bloques: BLOQUES,
    solucion: receta.bueno,
    programaPrefijado: romper(receta.bueno, receta.fallo),
    tipo: indice === 19 ? 'integrador' : 'debug',
    monedas: indice === 19 ? 120 : undefined,
  });
});

export const mundo19: WorldContentFile = {
  mundo: 19,
  slug: 'mision-de-reconocimiento',
  nombre: 'La Mision de Reconocimiento',
  introTexto:
    'Radar ve el error antes que nadie, y dice que es porque no busca el error: busca donde el programa deja de parecerse al tablero. Aqui los programas llegan montados y en cada uno hay una pieza mal, solo una. Leer el programa de otro y encontrar donde falla es mas dificil que escribirlo, y es lo que hacen los programadores casi todo el tiempo.',
  actividades,
};
