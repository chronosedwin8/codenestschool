/**
 * Mundo 24: La Red Submarina. Datos con nombre.
 *
 * Los mundos 22 y 23 guardaban los datos en arreglos, y un arreglo tiene un
 * problema que el niño ya ha sufrido sin saber que era un problema: dos arreglos
 * en paralelo. `largos[3]` y `bajadas[3]` son el mismo nodo, y nada en el programa
 * dice que lo sean; si alguien reordena uno y no el otro, el fallo no se ve.
 *
 * Un objeto arregla eso poniendo los datos del mismo nodo juntos y con nombre:
 * `{ largo: 3, bajada: 1 }`. La actividad quinta hace justo la conversión, de dos
 * arreglos paralelos a una lista de objetos, y el texto lo dice: el programa ya no
 * puede confundir la posición de un nodo con la de otro, porque no hay posiciones
 * que emparejar.
 *
 * En JavaScript se lee con un punto, `nodo.largo`. En Python no existe el punto
 * para diccionarios y se lee con corchetes y la clave entre comillas,
 * `nodo["largo"]`. Es la diferencia más visible entre los dos lenguajes en todo el
 * currículo, y por eso este mundo pone las dos versiones lado a lado.
 *
 * Progresión:
 *   1-4    un objeto, sus claves, y leerlas.
 *   5-8    de dos arreglos paralelos a una lista de objetos.
 *   9-12   claves que no son números: direcciones y colores.
 *   13-16  objetos dentro de objetos, y funciones que los reciben.
 *   17-20  el mapa de la red.
 */
import { actividadHacker, type ContextoHacker } from '../src/generadores-hackers.js';
import { andar, estrellaAqui, gira, type PasoCamino } from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const API = ['avanzar', 'girarDerecha', 'girarIzquierda', 'puedeAvanzar', 'hayObstaculo'];

function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

function escalera(largos: readonly number[], bajadas?: readonly number[]): PasoCamino[] {
  return largos.flatMap((largo, i) => escalon(largo, bajadas?.[i] ?? 1));
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly javascript: string;
  readonly python: string;
  readonly arranqueJs?: string;
  readonly arranquePy?: string;
}

/** El recorrido de una lista de nodos, en los dos lenguajes. */
function recorrerNodos(nodos: readonly { largo: number; bajada: number }[]): {
  js: string;
  py: string;
} {
  const js = nodos.map((n) => `  { largo: ${n.largo}, bajada: ${n.bajada} },`).join('\n');
  const py = nodos
    .map((n) => `    { "largo": ${n.largo}, "bajada": ${n.bajada} },`)
    .join('\n');

  return {
    js: `const red = [
${js}
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
    py: `red = [
${py}
]
for nodo in red:
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  };
}

const RED_CORTA = [
  { largo: 2, bajada: 1 },
  { largo: 3, bajada: 2 },
  { largo: 1, bajada: 1 },
];

const RED_MEDIA = [
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 2 },
  { largo: 3, bajada: 1 },
  { largo: 2, bajada: 2 },
  { largo: 1, bajada: 1 },
];

const RED_LARGA = [
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 2 },
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 2 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 2 },
];

const RECETAS: readonly Receta[] = [
  {
    nombre: 'El primer objeto',
    instruccion:
      'La Red Submarina conecta el fondo del mar con cables, y cada nodo de la red guarda sus datos con nombre. Un objeto se escribe entre llaves, con la clave, dos puntos y el valor. Escribe un nodo con su largo y su bajada, y usalos.',
    exito:
      'Un objeto con dos datos con nombre. En un arreglo tendrias que acordarte de que la posicion cero era el largo; aqui lo dice el nombre.',
    pistas: [
      'En JavaScript el dato se lee con un punto: el nombre del objeto, un punto y la clave.',
      'En Python se lee con corchetes y la clave entre comillas.',
    ],
    camino: escalon(3, 2),
    javascript: `const nodo = { largo: 3, bajada: 2 };
for (let p = 0; p < nodo.largo; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let b = 0; b < nodo.bajada; b++) {
  fuzz.avanzar();
}
fuzz.girarIzquierda();`,
    python: `nodo = { "largo": 3, "bajada": 2 }
for p in range(nodo["largo"]):
    fuzz.avanzar()
fuzz.girarDerecha()
for b in range(nodo["bajada"]):
    fuzz.avanzar()
fuzz.girarIzquierda()`,
    arranqueJs: `const nodo = { largo: 3, bajada: 2 };
// Lee los datos del nodo por su nombre.
`,
    arranquePy: `nodo = { "largo": 3, "bajada": 2 }
# Lee los datos del nodo por su nombre.
`,
  },
  {
    nombre: 'Dos nodos',
    instruccion: 'Dos nodos, cada uno con sus datos. Dos objetos, y se leen igual.',
    exito: 'Dos objetos. Cada uno lleva sus datos consigo y no hay forma de mezclarlos.',
    pistas: ['Un objeto por nodo.', 'Se leen por el nombre de la clave, no por su posicion.'],
    camino: [...escalon(2, 1), ...escalon(3, 2)],
    javascript: `const primero = { largo: 2, bajada: 1 };
const segundo = { largo: 3, bajada: 2 };
for (let p = 0; p < primero.largo; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let b = 0; b < primero.bajada; b++) {
  fuzz.avanzar();
}
fuzz.girarIzquierda();
for (let p = 0; p < segundo.largo; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let b = 0; b < segundo.bajada; b++) {
  fuzz.avanzar();
}
fuzz.girarIzquierda();`,
    python: `primero = { "largo": 2, "bajada": 1 }
segundo = { "largo": 3, "bajada": 2 }
for p in range(primero["largo"]):
    fuzz.avanzar()
fuzz.girarDerecha()
for b in range(primero["bajada"]):
    fuzz.avanzar()
fuzz.girarIzquierda()
for p in range(segundo["largo"]):
    fuzz.avanzar()
fuzz.girarDerecha()
for b in range(segundo["bajada"]):
    fuzz.avanzar()
fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Cambiar un dato',
    instruccion:
      'Los datos de un objeto se cambian como los de una variable: el nombre, la clave y el igual. Este nodo trae el largo mal medido.',
    exito: 'Un dato cambiado por su nombre. No hace falta saber en que posicion estaba, porque no esta en ninguna.',
    pistas: ['Se escribe el objeto, la clave y el valor nuevo.', 'El largo bueno es cuatro.'],
    camino: escalon(4, 1),
    javascript: `const nodo = { largo: 9, bajada: 1 };
nodo.largo = 4;
for (let p = 0; p < nodo.largo; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let b = 0; b < nodo.bajada; b++) {
  fuzz.avanzar();
}
fuzz.girarIzquierda();`,
    python: `nodo = { "largo": 9, "bajada": 1 }
nodo["largo"] = 4
for p in range(nodo["largo"]):
    fuzz.avanzar()
fuzz.girarDerecha()
for b in range(nodo["bajada"]):
    fuzz.avanzar()
fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Una lista de nodos',
    instruccion:
      'Y ahora lo bueno: una lista de objetos. Cada elemento de la lista es un nodo con sus datos, y el bucle sin indice los saca de uno en uno.',
    exito:
      'Una lista de objetos recorrida sin indices. Compara esto con los dos arreglos paralelos del mundo 22: aqui no hay dos posiciones que emparejar.',
    pistas: ['La lista lleva objetos dentro, separados por comas.', 'El bucle sin indice saca cada nodo.'],
    camino: escalera(
      RED_CORTA.map((n) => n.largo),
      RED_CORTA.map((n) => n.bajada),
    ),
    javascript: recorrerNodos(RED_CORTA).js,
    python: recorrerNodos(RED_CORTA).py,
    arranqueJs: `const red = [
  { largo: 2, bajada: 1 },
];
// Anade los nodos que falten y recorrelos.
`,
    arranquePy: `red = [
    { "largo": 2, "bajada": 1 },
]
# Anade los nodos que falten y recorrelos.
`,
  },
  {
    nombre: 'Sin arreglos paralelos',
    instruccion:
      'Este es el tablero del mundo 22, el de los dos arreglos. Hazlo con una lista de objetos y compara los dos programas: en el de antes, si alguien cambia el orden de un arreglo y no del otro, el fallo no se ve en ningun sitio.',
    exito:
      'Los datos de cada nodo van juntos. Eso no ahorra ni una linea, y aun asi es mejor programa: hay una clase de error que ya no se puede cometer.',
    pistas: ['Un objeto por cada par de numeros.', 'Y el bucle sin indice.'],
    camino: escalera(
      RED_MEDIA.map((n) => n.largo),
      RED_MEDIA.map((n) => n.bajada),
    ),
    javascript: recorrerNodos(RED_MEDIA).js,
    python: recorrerNodos(RED_MEDIA).py,
  },
  {
    nombre: 'Datos de la red',
    instruccion: 'Hay datos sueltos en los nodos. Pasa por encima de todos.',
    exito: 'Los datos. En la Red Submarina los llaman paquetes y dicen que viajan solos.',
    pistas: ['La lista de objetos de siempre.', 'Los datos estan en el camino.'],
    camino: escalera(
      RED_CORTA.map((n) => n.largo),
      RED_CORTA.map((n) => n.bajada),
    ).flatMap((paso, i) => (i % 4 === 0 ? [paso, estrellaAqui()] : [paso])),
    javascript: recorrerNodos(RED_CORTA).js,
    python: recorrerNodos(RED_CORTA).py,
  },
  {
    nombre: 'Ocho nodos',
    instruccion: 'La red entera: ocho nodos con sus dos datos cada uno.',
    exito: 'Ocho nodos. La red completa en una lista y cinco lineas de logica.',
    pistas: ['Lee los ocho nodos del tablero.', 'El bucle no cambia.'],
    camino: escalera(
      RED_LARGA.map((n) => n.largo),
      RED_LARGA.map((n) => n.bajada),
    ),
    javascript: recorrerNodos(RED_LARGA).js,
    python: recorrerNodos(RED_LARGA).py,
  },
  {
    nombre: 'Una clave de mas',
    instruccion:
      'Los nodos de esta red traen tres datos: el largo, la bajada y un nombre. El nombre no se usa para nada y no molesta: un objeto puede llevar mas de lo que hace falta.',
    exito:
      'Un dato que no se usa. Eso en un arreglo seria una posicion que hay que saltarse y contar; aqui simplemente esta ahi, con su nombre, sin estorbar.',
    pistas: ['El nombre se escribe entre comillas, como texto.', 'El programa solo lee las dos claves que necesita.'],
    camino: escalera([2, 1, 3], [1, 2, 1]),
    javascript: `const red = [
  { nombre: "norte", largo: 2, bajada: 1 },
  { nombre: "centro", largo: 1, bajada: 2 },
  { nombre: "sur", largo: 3, bajada: 1 },
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
    { "nombre": "norte", "largo": 2, "bajada": 1 },
    { "nombre": "centro", "largo": 1, "bajada": 2 },
    { "nombre": "sur", "largo": 3, "bajada": 1 },
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
    nombre: 'El nodo apagado',
    instruccion:
      'Los nodos traen una clave que dice si estan encendidos. Los apagados se saltan: el cable pasa de largo.',
    exito:
      'Un dato que decide. Es la primera vez que un objeto no solo lleva numeros: lleva una respuesta a una pregunta.',
    pistas: ['Si el nodo no esta activo, continue.', 'En JavaScript se puede preguntar directamente por la clave.'],
    camino: escalera([2, 3], [1, 1]),
    javascript: `const red = [
  { largo: 2, bajada: 1, activo: true },
  { largo: 5, bajada: 2, activo: false },
  { largo: 3, bajada: 1, activo: true },
];
for (const nodo of red) {
  if (nodo.activo === false) {
    continue;
  }
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
    { "largo": 2, "bajada": 1, "activo": 1 },
    { "largo": 5, "bajada": 2, "activo": 0 },
    { "largo": 3, "bajada": 1, "activo": 1 },
]
for nodo in red:
    if nodo["activo"] == 0:
        continue
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Cinco nodos y dos apagados',
    instruccion: 'Cinco nodos y dos apagados. El programa no cambia.',
    exito: 'Dos nodos apagados y el cable sigue llegando. La red aguanta averias.',
    pistas: ['El mismo programa del nivel anterior.', 'Solo cambian los datos.'],
    camino: escalera([2, 1, 3], [1, 2, 1]),
    javascript: `const red = [
  { largo: 2, bajada: 1, activo: true },
  { largo: 4, bajada: 2, activo: false },
  { largo: 1, bajada: 2, activo: true },
  { largo: 6, bajada: 1, activo: false },
  { largo: 3, bajada: 1, activo: true },
];
for (const nodo of red) {
  if (nodo.activo === false) {
    continue;
  }
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
    { "largo": 2, "bajada": 1, "activo": 1 },
    { "largo": 4, "bajada": 2, "activo": 0 },
    { "largo": 1, "bajada": 2, "activo": 1 },
    { "largo": 6, "bajada": 1, "activo": 0 },
    { "largo": 3, "bajada": 1, "activo": 1 },
]
for nodo in red:
    if nodo["activo"] == 0:
        continue
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'La clave que dice el giro',
    instruccion:
      'Ahora el nodo dice tambien hacia donde girar, con la palabra derecha o izquierda. El programa compara ese texto y decide.',
    exito:
      'Un dato que no es un numero y decide el camino. Comparar textos se escribe igual que comparar numeros.',
    pistas: ['El texto se compara con el triple igual en JavaScript y con doble igual en Python.', 'Las comillas hacen falta en los dos.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(2),
      gira('derecha'),
      andar(2),
    ],
    javascript: `const red = [
  { largo: 2, giro: "derecha" },
  { largo: 2, giro: "izquierda" },
  { largo: 2, giro: "derecha" },
  { largo: 2, giro: "no" },
];
for (const nodo of red) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  if (nodo.giro === "derecha") {
    fuzz.girarDerecha();
  }
  if (nodo.giro === "izquierda") {
    fuzz.girarIzquierda();
  }
}`,
    python: `red = [
    { "largo": 2, "giro": "derecha" },
    { "largo": 2, "giro": "izquierda" },
    { "largo": 2, "giro": "derecha" },
    { "largo": 2, "giro": "no" },
]
for nodo in red:
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    if nodo["giro"] == "derecha":
        fuzz.girarDerecha()
    if nodo["giro"] == "izquierda":
        fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Seis nodos con giro',
    instruccion: 'Seis nodos y los giros mezclados. El programa no sabe el camino: lo lee.',
    exito: 'Seis giros leidos de los datos. Cambia una palabra en la lista y cambia el camino.',
    pistas: ['El programa es el mismo.', 'Lee los giros del tablero en orden.'],
    camino: [
      andar(2),
      gira('derecha'),
      andar(2),
      gira('derecha'),
      andar(2),
      gira('izquierda'),
      andar(2),
      gira('izquierda'),
      andar(2),
      gira('derecha'),
      andar(2),
    ],
    javascript: `const red = [
  { largo: 2, giro: "derecha" },
  { largo: 2, giro: "derecha" },
  { largo: 2, giro: "izquierda" },
  { largo: 2, giro: "izquierda" },
  { largo: 2, giro: "derecha" },
  { largo: 2, giro: "no" },
];
for (const nodo of red) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  if (nodo.giro === "derecha") {
    fuzz.girarDerecha();
  }
  if (nodo.giro === "izquierda") {
    fuzz.girarIzquierda();
  }
}`,
    python: `red = [
    { "largo": 2, "giro": "derecha" },
    { "largo": 2, "giro": "derecha" },
    { "largo": 2, "giro": "izquierda" },
    { "largo": 2, "giro": "izquierda" },
    { "largo": 2, "giro": "derecha" },
    { "largo": 2, "giro": "no" },
]
for nodo in red:
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    if nodo["giro"] == "derecha":
        fuzz.girarDerecha()
    if nodo["giro"] == "izquierda":
        fuzz.girarIzquierda()`,
  },
  {
    nombre: 'La funcion que recorre un nodo',
    instruccion:
      'Mete el recorrido de un nodo en una funcion que reciba el nodo entero. Fijate en lo que gana: la funcion recibe una cosa en vez de dos numeros, y si manana el nodo trae un dato mas, la funcion no cambia de forma.',
    exito:
      'Una funcion que recibe un objeto. Es la razon principal de que existan los objetos: pasar una cosa con nombre en vez de una lista de numeros sueltos.',
    pistas: ['La funcion recibe el nodo y lee sus claves dentro.', 'El programa de fuera solo recorre la lista.'],
    camino: escalera(
      RED_MEDIA.map((n) => n.largo),
      RED_MEDIA.map((n) => n.bajada),
    ),
    javascript: `function cruzar(nodo) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < nodo.bajada; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}

const red = [
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 2 },
  { largo: 3, bajada: 1 },
  { largo: 2, bajada: 2 },
  { largo: 1, bajada: 1 },
];
for (const nodo of red) {
  cruzar(nodo);
}`,
    python: `def cruzar(nodo):
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()

red = [
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 2 },
    { "largo": 3, "bajada": 1 },
    { "largo": 2, "bajada": 2 },
    { "largo": 1, "bajada": 1 },
]
for nodo in red:
    cruzar(nodo)`,
  },
  {
    nombre: 'Ocho nodos y una funcion',
    instruccion: 'La red larga con la funcion. El programa de fuera son dos lineas.',
    exito: 'Ocho nodos, una funcion y dos lineas. Asi se lee un programa que se entiende.',
    pistas: ['La funcion no cambia.', 'Solo crece la lista de nodos.'],
    camino: escalera(
      RED_LARGA.map((n) => n.largo),
      RED_LARGA.map((n) => n.bajada),
    ),
    javascript: `function cruzar(nodo) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < nodo.bajada; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}

${recorrerNodos(RED_LARGA).js.split('\n').slice(0, RED_LARGA.length + 2).join('\n')}
for (const nodo of red) {
  cruzar(nodo);
}`,
    python: `def cruzar(nodo):
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()

${recorrerNodos(RED_LARGA).py.split('\n').slice(0, RED_LARGA.length + 2).join('\n')}
for nodo in red:
    cruzar(nodo)`,
  },
  {
    nombre: 'Un objeto dentro de otro',
    instruccion:
      'Los nodos de esta parte de la red guardan su tramo en otro objeto: dentro de la clave tramo hay un objeto con el largo y la bajada. Se lee poniendo dos puntos seguidos, uno por nivel.',
    exito:
      'Un objeto dentro de otro. Se lee de fuera hacia dentro, y cada punto baja un nivel.',
    pistas: ['Primero el nodo, luego la clave tramo, y luego el largo.', 'En Python son dos corchetes seguidos.'],
    camino: escalera([2, 1, 3], [1, 2, 1]),
    javascript: `const red = [
  { nombre: "norte", tramo: { largo: 2, bajada: 1 } },
  { nombre: "centro", tramo: { largo: 1, bajada: 2 } },
  { nombre: "sur", tramo: { largo: 3, bajada: 1 } },
];
for (const nodo of red) {
  for (let p = 0; p < nodo.tramo.largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < nodo.tramo.bajada; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}`,
    python: `red = [
    { "nombre": "norte", "tramo": { "largo": 2, "bajada": 1 } },
    { "nombre": "centro", "tramo": { "largo": 1, "bajada": 2 } },
    { "nombre": "sur", "tramo": { "largo": 3, "bajada": 1 } },
]
for nodo in red:
    for p in range(nodo["tramo"]["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["tramo"]["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Una lista dentro de un objeto',
    instruccion:
      'Y al contrario: un objeto puede llevar una lista dentro. Este nodo tiene una clave pasos con la lista de sus tramos.',
    exito:
      'Una lista dentro de un objeto, dentro de una lista. Los datos se anidan como quieras, y se leen de fuera hacia dentro.',
    pistas: ['La clave pasos lleva una lista.', 'Hace falta un bucle mas para recorrerla.'],
    camino: escalera([1, 2, 2, 1], [1, 1, 1, 1]),
    javascript: `const red = [
  { nombre: "norte", pasos: [1, 2] },
  { nombre: "sur", pasos: [2, 1] },
];
for (const nodo of red) {
  for (const paso of nodo.pasos) {
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}`,
    python: `red = [
    { "nombre": "norte", "pasos": [1, 2] },
    { "nombre": "sur", "pasos": [2, 1] },
]
for nodo in red:
    for paso in nodo["pasos"]:
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Contar los nodos activos',
    instruccion: 'El pasillo mide cuantos nodos de la red estan encendidos. Cuentalos y anda esa cantidad.',
    exito: 'Contar por una clave. Es el mismo patron de siempre, y ahora la condicion pregunta por un nombre.',
    pistas: ['Una variable cuenta que empieza en cero.', 'Si el nodo esta activo, sumale uno.'],
    camino: [andar(4)],
    javascript: `const red = [
  { largo: 2, activo: true },
  { largo: 1, activo: false },
  { largo: 3, activo: true },
  { largo: 2, activo: true },
  { largo: 1, activo: false },
  { largo: 2, activo: true },
];
let encendidos = 0;
for (const nodo of red) {
  if (nodo.activo === true) {
    encendidos = encendidos + 1;
  }
}
for (let p = 0; p < encendidos; p++) {
  fuzz.avanzar();
}`,
    python: `red = [
    { "largo": 2, "activo": 1 },
    { "largo": 1, "activo": 0 },
    { "largo": 3, "activo": 1 },
    { "largo": 2, "activo": 1 },
    { "largo": 1, "activo": 0 },
    { "largo": 2, "activo": 1 },
]
encendidos = 0
for nodo in red:
    if nodo["activo"] == 1:
        encendidos = encendidos + 1
for p in range(encendidos):
    fuzz.avanzar()`,
  },
  {
    nombre: 'El nodo mas largo',
    instruccion: 'El pasillo mide lo que mide el tramo mas largo de la red. Busca el mayor por su clave.',
    exito: 'Buscar el mayor por una clave. El patron es el del mundo 22 y lo unico que cambia es de donde sale el numero.',
    pistas: ['Empieza con el primero como mayor.', 'Y compara la clave largo de cada nodo.'],
    camino: [andar(6)],
    javascript: `const red = [
  { largo: 2 },
  { largo: 6 },
  { largo: 3 },
  { largo: 5 },
];
let mayor = red[0].largo;
for (const nodo of red) {
  if (nodo.largo > mayor) {
    mayor = nodo.largo;
  }
}
for (let p = 0; p < mayor; p++) {
  fuzz.avanzar();
}`,
    python: `red = [
    { "largo": 2 },
    { "largo": 6 },
    { "largo": 3 },
    { "largo": 5 },
]
mayor = red[0]["largo"]
for nodo in red:
    if nodo["largo"] > mayor:
        mayor = nodo["largo"]
for p in range(mayor):
    fuzz.avanzar()`,
  },
  {
    nombre: 'El nodo que nadie puso',
    instruccion:
      'Coral lleva el mapa de la Red Submarina y dice que hay un nodo en la lista que ella no puso, y que no tiene nombre. Solo tiene una clave: una hora. Ve a verlo.',
    exito:
      'El nodo sin nombre tiene una sola clave y dice: hora, tres y catorce. Y una segunda clave que Coral no sabe leer, porque no es un numero ni un texto: es una direccion. Apunta al mundo treinta.',
    pistas: ['La funcion que recibe el nodo y la lista de nodos.', 'Siete nodos.'],
    camino: escalera([2, 1, 2, 1, 1, 2, 1], [1, 2, 1, 2, 1, 1, 2]),
    javascript: `function cruzar(nodo) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < nodo.bajada; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}

const red = [
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 2 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 2 },
  { largo: 1, bajada: 1 },
  { largo: 2, bajada: 1 },
  { largo: 1, bajada: 2 },
];
for (const nodo of red) {
  cruzar(nodo);
}`,
    python: `def cruzar(nodo):
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()

red = [
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 2 },
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 2 },
    { "largo": 1, "bajada": 1 },
    { "largo": 2, "bajada": 1 },
    { "largo": 1, "bajada": 2 },
]
for nodo in red:
    cruzar(nodo)`,
  },
  {
    nombre: 'Donde esta Coral',
    instruccion:
      'Ultimo de la red. Coral esta en el nodo mas profundo con el mapa desplegado, intentando averiguar a donde apunta la direccion del nodo sin nombre. Ve a por ella.',
    exito:
      'Coral esta en casa, y ha traido el mapa de la red. La direccion del nodo sin nombre apunta al mundo treinta, al Nucleo, y Coral dice que un nodo no puede apuntar a un sitio donde no hay red. Salvo que alguien la haya puesto.',
    pistas: [
      'La funcion que recibe el nodo, y la clave que dice si esta activo.',
      'Ocho nodos y dos apagados.',
    ],
    camino: escalera([1, 2, 1, 2, 1, 2], [1, 2, 1, 2, 1, 2]),
    javascript: `function cruzar(nodo) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < nodo.bajada; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}

const red = [
  { largo: 1, bajada: 1, activo: true },
  { largo: 2, bajada: 2, activo: true },
  { largo: 4, bajada: 1, activo: false },
  { largo: 1, bajada: 1, activo: true },
  { largo: 2, bajada: 2, activo: true },
  { largo: 5, bajada: 2, activo: false },
  { largo: 1, bajada: 1, activo: true },
  { largo: 2, bajada: 2, activo: true },
];
for (const nodo of red) {
  if (nodo.activo === false) {
    continue;
  }
  cruzar(nodo);
}`,
    python: `def cruzar(nodo):
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(nodo["bajada"]):
        fuzz.avanzar()
    fuzz.girarIzquierda()

red = [
    { "largo": 1, "bajada": 1, "activo": 1 },
    { "largo": 2, "bajada": 2, "activo": 1 },
    { "largo": 4, "bajada": 1, "activo": 0 },
    { "largo": 1, "bajada": 1, "activo": 1 },
    { "largo": 2, "bajada": 2, "activo": 1 },
    { "largo": 5, "bajada": 2, "activo": 0 },
    { "largo": 1, "bajada": 1, "activo": 1 },
    { "largo": 2, "bajada": 2, "activo": 1 },
]
for nodo in red:
    if nodo["activo"] == 0:
        continue
    cruzar(nodo)`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 24,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const arranque =
    receta.arranqueJs || receta.arranquePy
      ? {
          ...(receta.arranqueJs ? { javascript: receta.arranqueJs } : {}),
          ...(receta.arranquePy ? { python: receta.arranquePy } : {}),
        }
      : undefined;

  return actividadHacker(contexto, {
    camino: receta.camino,
    api: API,
    javascript: receta.javascript,
    python: receta.python,
    ...(arranque ? { arranque } : {}),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 140 : undefined,
  });
});

export const mundo24: WorldContentFile = {
  mundo: 24,
  slug: 'red-submarina',
  nombre: 'La Red Submarina',
  introTexto:
    'La Red Submarina conecta el fondo del mar con cables, y cada nodo guarda sus datos con nombre en vez de en una posicion. Eso arregla un problema que ya has sufrido sin saber que lo era: dos listas en paralelo, donde el tercer elemento de una y el tercero de la otra son el mismo nodo y nada en el programa lo dice. Aqui los datos de cada cosa van juntos, y si alguien cambia el orden no se rompe nada.',
  actividades,
};
