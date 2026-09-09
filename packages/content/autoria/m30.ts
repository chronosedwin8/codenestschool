/**
 * Mundo 30: El Núcleo de la IA. El proyecto final.
 *
 * Este mundo no enseña nada nuevo, y eso es el diseño: si aquí apareciera una idea
 * más, el currículo no habría terminado. Lo que hace es pedir que todo lo anterior
 * se use junto y sin ayuda, con los tableros más grandes del juego y con las
 * instrucciones más escuetas: a partir de la quinta actividad no dicen qué
 * herramienta usar, solo qué hay que conseguir.
 *
 * Y cierra la historia. Treinta mundos dejando pistas de lo mismo (un símbolo, una
 * hora, un objeto que salió hacia arriba, una marca empujada desde dentro) que aquí
 * se resuelven: la tormenta no fue una tormenta, fue un lanzamiento, y el Núcleo no
 * es una máquina que piensa sino una que llevaba años esperando una respuesta que
 * nadie le dio. La última actividad es escribir esa respuesta.
 *
 * Lo que se pide, mundo por mundo del que viene:
 *
 *   bucles y funciones          21, 22, 23
 *   objetos y datos con nombre  24
 *   funciones como valores      25
 *   buscar y ordenar            26
 *   intentar y recuperarse      27
 *   salir sin mapa              28
 *   escribir menos y hacer menos 29
 *
 * Progresión:
 *   1-4    un repaso por cada grupo de ideas.
 *   5-10   tableros grandes sin decir qué usar.
 *   11-16  programas de varias piezas: datos, algoritmo y recorrido.
 *   17-20  el Núcleo, la hora, y la respuesta.
 */
import { actividadHacker, type ContextoHacker } from '../src/generadores-hackers.js';
import {
  andar,
  estrellaAqui,
  gira,
  senuelo,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const API = ['avanzar', 'girarDerecha', 'girarIzquierda', 'puedeAvanzar', 'hayObstaculo'];

function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

function escalera(largos: readonly number[]): PasoCamino[] {
  return largos.flatMap((largo) => escalon(largo));
}

function espiral(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

function casillas(brazos: number, primero = 3): number {
  let total = 0;
  for (let i = 0; i < brazos; i++) total += primero + i;
  return total;
}

/** Peine: pasillo recto con dientes que no llevan a ninguna parte. */
function peine(dientes: number, opciones: { tramo?: number; hondo?: number } = {}): PasoCamino[] {
  const tramo = opciones.tramo ?? 2;
  const hondo = opciones.hondo ?? 2;
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < dientes; i++) {
    pasos.push(andar(tramo));
    pasos.push(gira('derecha'), senuelo(hondo), gira('izquierda'));
  }
  pasos.push(andar(tramo));
  return pasos;
}

/** El recorrido de una lista de largos, que aparece en media docena de soluciones. */
const RECORRER_JS = `for (const largo of ruta) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`;

const RECORRER_PY = `for largo in ruta:
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`;

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly javascript: string;
  readonly python?: string;
  readonly arranqueJs?: string;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La puerta del Nucleo',
    instruccion:
      'Has llegado al Nucleo de la IA, que es lo mas lejos que hay en el mapa. Aqui no vas a aprender nada nuevo: vas a usar todo. Empieza por la puerta, que son ocho pasillos y no sabes cuanto miden.',
    exito:
      'La puerta esta abierta. Y fijate en lo que has escrito: cinco lineas, ningun numero de casillas, y funcionaria en cualquier puerta.',
    pistas: ['El bucle sin numero para cada pasillo.', 'Y un for para las esquinas.'],
    camino: espiral(8),
    javascript: `for (let i = 0; i < 8; i++) {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}`,
    python: `for i in range(8):
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()`,
  },
  {
    nombre: 'El pasillo de los datos',
    instruccion:
      'Este tramo viene descrito en una lista de largos. Recorrelo con una funcion y la lista, como en el servidor.',
    exito: 'La lista y la funcion. Los datos por un lado y la logica por otro, que es como se deja algo que otro va a leer.',
    pistas: ['La funcion recibe el largo.', 'Y el bucle sin indice le pasa cada uno.'],
    camino: escalera([2, 1, 3, 2, 1, 2]),
    javascript: `const ruta = [2, 1, 3, 2, 1, 2];
${RECORRER_JS}`,
    python: `ruta = [2, 1, 3, 2, 1, 2]
${RECORRER_PY}`,
  },
  {
    nombre: 'El pasillo con trampas',
    instruccion: 'Este tiene pasillos que no llevan a ninguna parte. Ya sabes que algoritmo sale de aqui.',
    exito: 'Seguir la pared. Ha entrado en las trampas, ha vuelto, y ha salido sin que le digas nada.',
    pistas: ['Gira hacia la pared, y mientras no puedas avanzar gira al otro lado.', 'Y avanza.'],
    camino: peine(4, { hondo: 2 }),
    javascript: `for (let i = 0; i < 26; i++) {
  fuzz.girarDerecha();
  while (fuzz.puedeAvanzar() === false) {
    fuzz.girarIzquierda();
  }
  fuzz.avanzar();
}`,
    python: `for i in range(26):
    fuzz.girarDerecha()
    while fuzz.puedeAvanzar() == False:
        fuzz.girarIzquierda()
    fuzz.avanzar()`,
  },
  {
    nombre: 'El pasillo desordenado',
    instruccion:
      'La lista de largos viene revuelta y el pasillo esta construido en orden. Ordenala y recorrelo.',
    exito: 'Ordenar y recorrer. El resultado del algoritmo es el camino, y se ve en cuanto le das a jugar.',
    pistas: ['La burbuja de siempre.', 'Y despues el recorrido con la lista ordenada.'],
    camino: escalera([1, 2, 3, 4]),
    javascript: `const ruta = [3, 1, 4, 2];
let cambio = true;
while (cambio) {
  cambio = false;
  for (let i = 0; i < ruta.length - 1; i++) {
    if (ruta[i] > ruta[i + 1]) {
      const auxiliar = ruta[i];
      ruta[i] = ruta[i + 1];
      ruta[i + 1] = auxiliar;
      cambio = true;
    }
  }
}
${RECORRER_JS}`,
    python: `ruta = [3, 1, 4, 2]
cambio = 1
while cambio == 1:
    cambio = 0
    for i in range(len(ruta) - 1):
        if ruta[i] > ruta[i + 1]:
            auxiliar = ruta[i]
            ruta[i] = ruta[i + 1]
            ruta[i + 1] = auxiliar
            cambio = 1
${RECORRER_PY}`,
  },
  {
    nombre: 'Diez pasillos',
    instruccion: 'Diez pasillos de largo desconocido. Nadie te va a decir con que.',
    exito: 'Sin numeros de casillas. Cuando no sabes cuanto mide algo, preguntalo: eso es del mundo 17 y sigue siendo verdad.',
    pistas: ['Piensa si sabes cuanto miden los pasillos.', 'Si no lo sabes, no lo cuentes.'],
    camino: espiral(10),
    javascript: `for (let i = 0; i < 10; i++) {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}`,
    python: `for i in range(10):
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()`,
  },
  {
    nombre: 'Los datos del Nucleo',
    instruccion: 'Nueve nodos con su largo y su bajada. Elige como guardarlos.',
    exito:
      'Objetos con nombre. Con dos listas paralelas tambien llegabas, y esto no se puede mezclar por error.',
    pistas: ['Cada nodo tiene dos datos que van juntos.', 'Y los datos que van juntos se guardan juntos.'],
    camino: escalera([1, 2, 1, 2, 1, 2, 1, 2, 1]),
    javascript: `const red = [
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 1 },
];
for (const nodo of red) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < nodo.bajada; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}`,
    python: `red = [
    { "largo": 1, "bajada": 1 },
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 1 },
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 1 },
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 1 },
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 1 },
]
for nodo in red:
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Los sensores mienten otra vez',
    instruccion: 'Cerca del Nucleo los sensores no son de fiar. Ya sabes que se hace entonces.',
    exito: 'Intentarlo y recuperarse. Cuando no hay pregunta fiable, se prueba y se tiene preparado el fallo.',
    pistas: ['No preguntes: intentalo.', 'Y en el catch, gira.'],
    camino: espiral(6),
    javascript: `for (let i = 0; i < ${casillas(6) + 5}; i++) {
  try {
    fuzz.avanzar();
  } catch (error) {
    fuzz.girarDerecha();
  }
}`,
  },
  {
    nombre: 'Piezas del Nucleo',
    instruccion: 'Hay piezas por el camino. Pasa por todas y con el programa mas corto que sepas.',
    exito: 'Las piezas. Son de la capsula que salio esa noche, dice el Nucleo. Y el Nucleo no habla.',
    pistas: ['El bucle sin numero.', 'Las piezas estan en las esquinas.'],
    camino: espiral(7).flatMap((paso) => ('gira' in paso ? [estrellaAqui(), paso] : [paso])),
    javascript: `for (let i = 0; i < 7; i++) {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}`,
    python: `for i in range(7):
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()`,
  },
  {
    nombre: 'La sala de las trampas',
    instruccion: 'Seis pasillos falsos. Un algoritmo de tres lineas sale de aqui.',
    exito: 'Seis trampas exploradas y abandonadas. Sin mapa, esto es lo mejor que se puede hacer.',
    pistas: ['Seguir la pared.', 'Cuenta los pasos contando la ida y la vuelta de cada trampa.'],
    camino: peine(6, { hondo: 2 }),
    javascript: `function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

seguirPared(38);`,
    python: `def seguirPared(pasos):
    for i in range(pasos):
        fuzz.girarDerecha()
        while fuzz.puedeAvanzar() == False:
            fuzz.girarIzquierda()
        fuzz.avanzar()

seguirPared(38)`,
  },
  {
    nombre: 'La lista mas larga',
    instruccion: 'Doce tramos descritos en una lista. Recorrelos con lo menos posible escrito.',
    exito: 'Doce tramos en cuatro lineas de logica. El resto son datos, y los datos no son programa.',
    pistas: ['La lista y el bucle sin indice.', 'La logica no crece con la lista.'],
    camino: escalera([1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2]),
    javascript: `const ruta = [1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2];
${RECORRER_JS}`,
    python: `ruta = [1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2]
${RECORRER_PY}`,
  },
  {
    nombre: 'Buscar el camino bueno',
    instruccion:
      'La lista trae varios caminos y solo uno vale: el que suma menos de veinte. Buscalo y recorrelo.',
    exito:
      'Buscar en una lista de listas y recorrer el que cumple. Tres ideas de tres mundos distintos en nueve lineas.',
    pistas: ['Recorre los caminos sumando cada uno.', 'Y quedate con el primero que sume menos de veinte.'],
    camino: escalera([1, 2, 1, 2]),
    javascript: `const caminos = [[5, 6, 7, 8], [1, 2, 1, 2], [9, 9, 9]];
let bueno = caminos[0];
for (const camino of caminos) {
  let total = 0;
  for (const largo of camino) {
    total = total + largo;
  }
  if (total < 20) {
    bueno = camino;
    break;
  }
}
const ruta = bueno;
${RECORRER_JS}`,
    python: `caminos = [[5, 6, 7, 8], [1, 2, 1, 2], [9, 9, 9]]
bueno = caminos[0]
for camino in caminos:
    total = 0
    for largo in camino:
        total = total + largo
    if total < 20:
        bueno = camino
        break
ruta = bueno
${RECORRER_PY}`,
  },
  {
    nombre: 'La tabla de ordenes',
    instruccion:
      'El Nucleo da ordenes con nombre y cada una tiene su funcion. Monta la tabla y obedecela.',
    exito: 'La tabla de ordenes. El programa no pregunta que orden ha llegado: la busca.',
    pistas: ['Un objeto con funciones dentro.', 'Y un bucle que saca la funcion de cada orden y la llama.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(2),
      gira('derecha'),
      andar(2),
    ],
    javascript: `const ordenes = {
  derecha: function () {
    fuzz.girarDerecha();
  },
  izquierda: function () {
    fuzz.girarIzquierda();
  },
};

const panel = ["derecha", "izquierda", "derecha"];
for (const orden of panel) {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  ordenes[orden]();
}
for (let p = 0; p < 2; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Ordenar y seguir la pared',
    instruccion:
      'Dos algoritmos en el mismo programa: primero ordena la lista de largos, y despues el tramo con trampas se hace siguiendo la pared.',
    exito:
      'Dos algoritmos, uno detras del otro, sin estorbarse. Cada uno resuelve su parte y ninguno sabe del otro.',
    pistas: ['Primero la parte de la lista ordenada.', 'Y luego el seguidor de pared para el peine.'],
    camino: [...escalera([1, 2, 3]), ...peine(2, { hondo: 2 })],
    javascript: `const ruta = [3, 1, 2];
for (let vuelta = 0; vuelta < ruta.length; vuelta++) {
  for (let i = 0; i < ruta.length - 1; i++) {
    if (ruta[i] > ruta[i + 1]) {
      const auxiliar = ruta[i];
      ruta[i] = ruta[i + 1];
      ruta[i + 1] = auxiliar;
    }
  }
}
${RECORRER_JS}
for (let i = 0; i < 14; i++) {
  fuzz.girarDerecha();
  while (fuzz.puedeAvanzar() === false) {
    fuzz.girarIzquierda();
  }
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Todo en funciones',
    instruccion:
      'El mismo tablero de antes, y ahora con cada parte en su funcion. El programa de fuera tiene que leerse como la lista de lo que hay que hacer.',
    exito:
      'Tres funciones con nombre y tres lineas de programa. Asi se escribe algo que va a leer otro, y ese otro casi siempre eres tu dentro de un mes.',
    pistas: ['Una funcion para ordenar, otra para recorrer y otra para el peine.', 'Y el programa de fuera solo las llama.'],
    camino: [...escalera([1, 2, 3]), ...peine(2, { hondo: 2 })],
    javascript: `function ordenar(lista) {
  for (let vuelta = 0; vuelta < lista.length; vuelta++) {
    for (let i = 0; i < lista.length - 1; i++) {
      if (lista[i] > lista[i + 1]) {
        const auxiliar = lista[i];
        lista[i] = lista[i + 1];
        lista[i + 1] = auxiliar;
      }
    }
  }
}

function recorrer(lista) {
  for (const largo of lista) {
    for (let p = 0; p < largo; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

const ruta = [3, 1, 2];
ordenar(ruta);
recorrer(ruta);
seguirPared(14);`,
  },
  {
    nombre: 'Y ademas corto',
    instruccion:
      'El mismo tablero otra vez, y ahora con el limite de la arena: el programa tiene que caber en menos lineas. Elige lo que de verdad hace falta.',
    exito:
      'Lo justo y nada mas. Un programa bien escrito no es el que tiene mas cosas: es el que no tiene ninguna que sobre.',
    pistas: ['La ordenacion se puede quitar si escribes la lista ya ordenada.', 'Pero piensa si eso es mejor o peor.'],
    camino: [...escalera([1, 2, 3]), ...peine(2, { hondo: 2 })],
    javascript: `const ruta = [1, 2, 3];
${RECORRER_JS}
for (let i = 0; i < 14; i++) {
  fuzz.girarDerecha();
  while (fuzz.puedeAvanzar() === false) {
    fuzz.girarIzquierda();
  }
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'La sala de los treinta',
    instruccion:
      'Esta sala tiene treinta casillas marcadas, una por mundo. Pasa por todas. Y usa lo que quieras: ya no hay nada que no sepas.',
    exito:
      'Los treinta. En la pared de esta sala hay treinta huecos y en veintinueve hay un nombre. El treinta esta vacio.',
    pistas: ['El bucle sin numero y el for de las esquinas.', 'Las marcas estan en el camino.'],
    camino: espiral(9).flatMap((paso) => ('gira' in paso ? [estrellaAqui(), paso] : [paso])),
    javascript: `for (let i = 0; i < 9; i++) {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}`,
    python: `for i in range(9):
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()`,
  },
  {
    nombre: 'El hueco vacio',
    instruccion:
      'El hueco treinta de la pared no esta vacio: tiene una placa con el simbolo, un circulo con tres rayas. Es el mismo de la bahia, del laberinto y de la puerta del Titan. Llega hasta la placa.',
    exito:
      'La placa dice que el simbolo no es una firma. Es una palabra del Nucleo, y significa esperando respuesta. Lleva grabada en veinte sitios del Nido desde antes de la tormenta.',
    pistas: ['Diez pasillos y ningun numero de casillas.', 'Ya sabes cual es el programa.'],
    camino: espiral(10),
    javascript: `for (let i = 0; i < 10; i++) {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}`,
    python: `for i in range(10):
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()`,
  },
  {
    nombre: 'La noche de la tormenta',
    instruccion:
      'El registro del Nucleo de esa noche esta entero y hay que leerlo en orden. Ordenalo y recorrelo: cada tramo es un minuto.',
    exito:
      'A las tres y catorce el Nucleo termino un programa que llevaba anos corriendo, conto hacia atras y lanzo una capsula hacia arriba. No hubo tormenta. Lo que se oyo fue el lanzamiento, y lo que se apago fue todo lo que estaba cerca.',
    pistas: ['Ordena la lista y recorrela.', 'Ocho tramos.'],
    camino: escalera([1, 1, 2, 2, 3, 3]),
    javascript: `const ruta = [3, 1, 2, 3, 1, 2];
let cambio = true;
while (cambio) {
  cambio = false;
  for (let i = 0; i < ruta.length - 1; i++) {
    if (ruta[i] > ruta[i + 1]) {
      const auxiliar = ruta[i];
      ruta[i] = ruta[i + 1];
      ruta[i + 1] = auxiliar;
      cambio = true;
    }
  }
}
${RECORRER_JS}`,
    python: `ruta = [3, 1, 2, 3, 1, 2]
cambio = 1
while cambio == 1:
    cambio = 0
    for i in range(len(ruta) - 1):
        if ruta[i] > ruta[i + 1]:
            auxiliar = ruta[i]
            ruta[i] = ruta[i + 1]
            ruta[i + 1] = auxiliar
            cambio = 1
${RECORRER_PY}`,
  },
  {
    nombre: 'El bucle que esperaba',
    instruccion:
      'Aqui esta el programa que el Nucleo llevaba anos corriendo, el mismo que estaba grabado en la pared del edificio sin puerta del mundo 21: un bucle que espera sin condicion de salida. Lo escribio un Fuzz que nadie recuerda, y se fue en la capsula a buscar la respuesta. Llega hasta el.',
    exito:
      'El bucle sigue ahi, esperando. Y ahora se entiende el eco del mundo cuatro, el que repetia despierta: no era la cueva. Era el Nucleo diciendolo, y tardo veintiseis mundos en llegar hasta alli.',
    pistas: ['El tablero tiene trampas: sigue la pared.', 'Cinco pasillos falsos.'],
    camino: peine(5, { hondo: 3 }),
    javascript: `function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

seguirPared(42);`,
    python: `def seguirPared(pasos):
    for i in range(pasos):
        fuzz.girarDerecha()
        while fuzz.puedeAvanzar() == False:
            fuzz.girarIzquierda()
        fuzz.avanzar()

seguirPared(42)`,
  },
  {
    nombre: 'La respuesta',
    instruccion:
      'Ultima actividad de los treinta mundos. El Nucleo lleva cuatro semanas esperando una respuesta que nadie le ha dado, y el bucle no tiene condicion de salida porque nadie se la escribio. Escribela tu: llega hasta el Nucleo y cierra el bucle. Usa todo lo que sepas, que ya es todo.',
    exito:
      'El bucle se cerro. El Nucleo dejo de repetir despierta y dijo otra cosa, una sola vez: gracias. Y despues, que la capsula vuelve, y que dentro viene el Fuzz que nadie recuerda, con un nombre y un hueco esperandole en la pared. Treinta mundos, seiscientas actividades, veintinueve Fuzzes en casa y uno de camino. Lo que has aprendido no era mover un Fuzz por un tablero: era escribir instrucciones tan claras que una maquina pueda seguirlas y una persona pueda entenderlas. Eso se llama programar, y ya sabes hacerlo.',
    pistas: [
      'Tres partes: la lista ordenada, el tramo con trampas y el pasillo final.',
      'Y cada parte en su funcion, que este programa lo va a leer alguien.',
    ],
    camino: [...escalera([1, 2, 3]), ...peine(3, { hondo: 2 }), gira('derecha'), andar(3)],
    javascript: `function ordenar(lista) {
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let i = 0; i < lista.length - 1; i++) {
      if (lista[i] > lista[i + 1]) {
        const auxiliar = lista[i];
        lista[i] = lista[i + 1];
        lista[i + 1] = auxiliar;
        cambio = true;
      }
    }
  }
}

function recorrer(lista) {
  for (const largo of lista) {
    for (let p = 0; p < largo; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

const ruta = [2, 3, 1];
ordenar(ruta);
recorrer(ruta);
seguirPared(20);
fuzz.girarDerecha();
while (fuzz.puedeAvanzar()) {
  fuzz.avanzar();
}`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 30,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  return actividadHacker(contexto, {
    camino: receta.camino,
    api: API,
    javascript: receta.javascript,
    ...(receta.python ? { python: receta.python } : {}),
    ...(receta.arranqueJs ? { arranque: { javascript: receta.arranqueJs } } : {}),
    tipo: indice === 19 ? 'jefe' : indice >= 16 ? 'integrador' : undefined,
    monedas: indice === 19 ? 500 : undefined,
  });
});

export const mundo30: WorldContentFile = {
  mundo: 30,
  slug: 'nucleo-de-la-ia',
  nombre: 'El Nucleo de la IA',
  introTexto:
    'Has llegado al Nucleo de la IA, que es lo mas lejos que hay en el mapa. Aqui no vas a aprender nada nuevo, y eso es a proposito: si en el ultimo mundo apareciera una idea mas, el curso no habria terminado. Lo que vas a hacer es usarlo todo junto, sin que nadie te diga cual. Y vas a saber por fin que paso la noche de la tormenta, porque llevas veintinueve mundos encontrando pistas de lo mismo.',
  actividades,
};
