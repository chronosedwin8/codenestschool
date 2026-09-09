/**
 * Mundo 26: El Desierto de Algoritmos. Buscar y ordenar.
 *
 * Los mundos anteriores usaban los datos tal como llegaban. Este los trabaja, y
 * ahí está el problema de diseño que tuvo: un algoritmo de ordenación no mueve al
 * Fuzz, así que ¿cómo se ve que funcionó?
 *
 * La respuesta es lo que hace este mundo jugable: el tablero se dibuja con la ruta
 * YA ORDENADA, y al niño se le da la ruta desordenada. Si no ordena, no llega. El
 * resultado del algoritmo es la única forma de recorrer el camino, y se ve en la
 * pantalla en cuanto se ejecuta. Lo mismo con buscar: el pasillo mide lo que hay
 * que encontrar.
 *
 * Los algoritmos que aparecen son los cuatro de siempre, en el orden en que se
 * entienden:
 *
 *   recorrer y quedarse con el mejor    el máximo y el mínimo
 *   recorrer y contar                   cuántos cumplen algo
 *   buscar hasta encontrar              la búsqueda lineal, y por qué para
 *   comparar y cambiar de sitio         la ordenación por burbuja
 *
 * La burbuja no es el mejor algoritmo de ordenación y se enseña de todas formas,
 * porque es el único que se puede seguir con el dedo. Que sea lento se dice, y se
 * mide en el mundo 29, que va de eso.
 *
 * Progresión:
 *   1-4    el máximo, el mínimo, la suma y la cuenta.
 *   5-8    buscar: la posición de un valor, y salir en cuanto se encuentra.
 *   9-14   ordenar por burbuja, y el tablero dibujado con la ruta ordenada.
 *   15-18  ordenar de mayor a menor, y ordenar objetos por una clave.
 *   19-20  el mapa del desierto.
 */
import { actividadHacker, type ContextoHacker } from '../src/generadores-hackers.js';
import { andar, estrellaAqui, gira, type PasoCamino } from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const API = ['avanzar', 'girarDerecha', 'girarIzquierda', 'puedeAvanzar', 'hayObstaculo'];

function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

function escalera(largos: readonly number[]): PasoCamino[] {
  return largos.flatMap((largo) => escalon(largo));
}

/** La misma ruta, ordenada: es la que dibuja el tablero. */
function ordenada(ruta: readonly number[]): number[] {
  return [...ruta].sort((a, b) => a - b);
}

/** La ruta ordenada de mayor a menor. */
function ordenadaAlReves(ruta: readonly number[]): number[] {
  return [...ruta].sort((a, b) => b - a);
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly javascript: string;
  readonly python?: string;
  readonly arranqueJs?: string;
  readonly arranquePy?: string;
}

/** El recorrido de una ruta ya ordenada, que va detras de todo algoritmo aqui. */
const RECORRER_JS = `for (const paso of ruta) {
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`;

const RECORRER_PY = `for paso in ruta:
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`;

const RECETAS: readonly Receta[] = [
  {
    nombre: 'El mayor de la lista',
    instruccion:
      'El Desierto de Algoritmos no tiene caminos: tiene datos, y hay que trabajarlos para saber por donde ir. Este pasillo mide lo que mide el numero mas grande de la lista. Recorre la lista quedandote con el mayor que hayas visto.',
    exito:
      'Buscar el mayor es el algoritmo mas simple que existe: una variable con lo mejor visto hasta ahora, y un bucle que la va mejorando.',
    pistas: [
      'Empieza con el primer elemento como mayor.',
      'Y si encuentras uno mas grande, cambialo.',
    ],
    camino: [andar(8)],
    javascript: `const datos = [3, 8, 5, 2, 7];
let mayor = datos[0];
for (const dato of datos) {
  if (dato > mayor) {
    mayor = dato;
  }
}
for (let p = 0; p < mayor; p++) {
  fuzz.avanzar();
}`,
    python: `datos = [3, 8, 5, 2, 7]
mayor = datos[0]
for dato in datos:
    if dato > mayor:
        mayor = dato
for p in range(mayor):
    fuzz.avanzar()`,
    arranqueJs: `const datos = [3, 8, 5, 2, 7];
let mayor = datos[0];
// Recorre la lista y quedate con el mayor.
`,
    arranquePy: `datos = [3, 8, 5, 2, 7]
mayor = datos[0]
# Recorre la lista y quedate con el mayor.
`,
  },
  {
    nombre: 'El menor',
    instruccion: 'Y ahora el pasillo mide el numero mas pequeno. Es el mismo algoritmo con la comparacion al reves.',
    exito:
      'El mismo algoritmo con el signo cambiado. Los dos son el mismo patron: recorrer y quedarse con el mejor segun un criterio.',
    pistas: ['Empieza con el primero como menor.', 'Y compara con menor que, no con mayor que.'],
    camino: [andar(2)],
    javascript: `const datos = [6, 4, 2, 9, 5];
let menor = datos[0];
for (const dato of datos) {
  if (dato < menor) {
    menor = dato;
  }
}
for (let p = 0; p < menor; p++) {
  fuzz.avanzar();
}`,
    python: `datos = [6, 4, 2, 9, 5]
menor = datos[0]
for dato in datos:
    if dato < menor:
        menor = dato
for p in range(menor):
    fuzz.avanzar()`,
  },
  {
    nombre: 'La diferencia',
    instruccion: 'El pasillo mide la diferencia entre el mayor y el menor. Dos algoritmos y una resta.',
    exito: 'Dos recorridos y una resta. Se podia hacer en un solo bucle: pruebalo si quieres.',
    pistas: ['Busca el mayor y el menor por separado.', 'Y anda la diferencia.'],
    camino: [andar(7)],
    javascript: `const datos = [3, 9, 5, 2, 6];
let mayor = datos[0];
let menor = datos[0];
for (const dato of datos) {
  if (dato > mayor) {
    mayor = dato;
  }
  if (dato < menor) {
    menor = dato;
  }
}
for (let p = 0; p < mayor - menor; p++) {
  fuzz.avanzar();
}`,
    python: `datos = [3, 9, 5, 2, 6]
mayor = datos[0]
menor = datos[0]
for dato in datos:
    if dato > mayor:
        mayor = dato
    if dato < menor:
        menor = dato
for p in range(mayor - menor):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Marcas del desierto',
    instruccion: 'Hay marcas por el camino. Pasa por encima de todas. El camino es la lista ordenada.',
    exito: 'Las marcas. En el desierto las dejan para no perderse, y aun asi todo el mundo se pierde.',
    pistas: ['Ordena la lista de menor a mayor.', 'Y recorrela.'],
    camino: escalera(ordenada([3, 1, 2])).flatMap((paso, i) =>
      i % 4 === 0 ? [paso, estrellaAqui()] : [paso],
    ),
    javascript: `const ruta = [1, 2, 3];
${RECORRER_JS}`,
    python: `ruta = [1, 2, 3]
${RECORRER_PY}`,
  },
  {
    nombre: 'Buscar una posicion',
    instruccion:
      'El pasillo mide la posicion donde esta el numero siete en la lista. Recorre la lista comparando, y cuando lo encuentres, guarda la posicion.',
    exito:
      'La busqueda lineal: mirar uno por uno hasta encontrarlo. Es el algoritmo mas usado del mundo y el mas facil de escribir.',
    pistas: ['Hace falta el indice para saber la posicion.', 'Cuando el elemento sea siete, guarda la i.'],
    camino: [andar(3)],
    javascript: `const datos = [4, 2, 9, 7, 1];
let donde = 0;
for (let i = 0; i < datos.length; i++) {
  if (datos[i] === 7) {
    donde = i;
  }
}
for (let p = 0; p < donde; p++) {
  fuzz.avanzar();
}`,
    python: `datos = [4, 2, 9, 7, 1]
donde = 0
for i in range(len(datos)):
    if datos[i] == 7:
        donde = i
for p in range(donde):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Parar al encontrarlo',
    instruccion:
      'El programa anterior sigue mirando la lista entera aunque ya lo haya encontrado. Con break sale en cuanto lo tiene, y en una lista de mil datos eso es la diferencia entre mil comparaciones y cuatro.',
    exito:
      'Salir al encontrarlo. El resultado es el mismo y el trabajo no: eso es lo que se mide cuando se habla de que un algoritmo es rapido.',
    pistas: ['El break va justo despues de guardar la posicion.', 'Y hay que quedarse con la primera aparicion, no con la ultima.'],
    camino: [andar(2)],
    javascript: `const datos = [4, 2, 7, 1, 7];
let donde = 0;
for (let i = 0; i < datos.length; i++) {
  if (datos[i] === 7) {
    donde = i;
    break;
  }
}
for (let p = 0; p < donde; p++) {
  fuzz.avanzar();
}`,
    python: `datos = [4, 2, 7, 1, 7]
donde = 0
for i in range(len(datos)):
    if datos[i] == 7:
        donde = i
        break
for p in range(donde):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Cuantos pasan de cinco',
    instruccion: 'El pasillo mide cuantos numeros de la lista pasan de cinco.',
    exito: 'Contar los que cumplen algo. Tercer patron del mundo y el mas corto de los tres.',
    pistas: ['Una variable que empieza en cero.', 'Y una condicion dentro del bucle.'],
    camino: [andar(4)],
    javascript: `const datos = [2, 8, 5, 9, 1, 6, 7, 3];
let cuantos = 0;
for (const dato of datos) {
  if (dato > 5) {
    cuantos = cuantos + 1;
  }
}
for (let p = 0; p < cuantos; p++) {
  fuzz.avanzar();
}`,
    python: `datos = [2, 8, 5, 9, 1, 6, 7, 3]
cuantos = 0
for dato in datos:
    if dato > 5:
        cuantos = cuantos + 1
for p in range(cuantos):
    fuzz.avanzar()`,
  },
  {
    nombre: 'La suma de los pares',
    instruccion:
      'El pasillo mide la suma de los numeros pares de la lista. Un numero es par si al dividirlo entre dos no sobra nada, y eso se pregunta con el resto.',
    exito:
      'El resto de dividir es el operador que casi nadie recuerda y que aparece en todos los algoritmos. Se escribe con el signo de porcentaje.',
    pistas: ['Un numero es par si el resto de dividirlo entre dos es cero.', 'Suma solo esos.'],
    camino: [andar(12)],
    javascript: `const datos = [3, 4, 7, 2, 6, 5];
let total = 0;
for (const dato of datos) {
  if (dato % 2 === 0) {
    total = total + dato;
  }
}
for (let p = 0; p < total; p++) {
  fuzz.avanzar();
}`,
    python: `datos = [3, 4, 7, 2, 6, 5]
total = 0
for dato in datos:
    if dato % 2 == 0:
        total = total + dato
for p in range(total):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Intercambiar dos elementos',
    instruccion:
      'Para ordenar hay que aprender antes a cambiar dos elementos de sitio, y eso tiene un truco: hace falta una variable de mas para no perder uno de los dos. Cambia el primero por el segundo y recorre.',
    exito:
      'Cambiar dos cosas de sitio necesita un sitio de mas. Si asignas directamente, el primero se pierde y acabas con el segundo dos veces.',
    pistas: [
      'Guarda el primero en una variable auxiliar.',
      'Luego pon el segundo en el primero, y el auxiliar en el segundo.',
    ],
    camino: escalera([1, 2, 3]),
    javascript: `const ruta = [2, 1, 3];
const auxiliar = ruta[0];
ruta[0] = ruta[1];
ruta[1] = auxiliar;
${RECORRER_JS}`,
    python: `ruta = [2, 1, 3]
auxiliar = ruta[0]
ruta[0] = ruta[1]
ruta[1] = auxiliar
${RECORRER_PY}`,
  },
  {
    nombre: 'La primera burbuja',
    instruccion:
      'Ahora el tablero esta dibujado con la ruta ORDENADA de menor a mayor, y la lista que tienes esta desordenada. Si no la ordenas, no llegas. Empieza con una sola pasada: recorre la lista comparando cada elemento con el siguiente y cambialos si estan al reves.',
    exito:
      'Una pasada de la burbuja. Con una sola pasada el mayor ya ha subido al final, y por eso el algoritmo se llama asi: los grandes flotan.',
    pistas: [
      'El bucle llega hasta la longitud menos uno para poder mirar el siguiente.',
      'Si el elemento es mayor que el siguiente, cambialos de sitio.',
    ],
    camino: escalera(ordenada([2, 1, 3])),
    javascript: `const ruta = [2, 1, 3];
for (let i = 0; i < ruta.length - 1; i++) {
  if (ruta[i] > ruta[i + 1]) {
    const auxiliar = ruta[i];
    ruta[i] = ruta[i + 1];
    ruta[i + 1] = auxiliar;
  }
}
${RECORRER_JS}`,
    python: `ruta = [2, 1, 3]
for i in range(len(ruta) - 1):
    if ruta[i] > ruta[i + 1]:
        auxiliar = ruta[i]
        ruta[i] = ruta[i + 1]
        ruta[i + 1] = auxiliar
${RECORRER_PY}`,
    arranqueJs: `const ruta = [2, 1, 3];
// Una pasada: compara cada elemento con el siguiente.
`,
    arranquePy: `ruta = [2, 1, 3]
# Una pasada: compara cada elemento con el siguiente.
`,
  },
  {
    nombre: 'Una pasada no basta',
    instruccion:
      'Prueba el programa anterior con esta lista y veras que no queda ordenada: una pasada sube el mayor al final, pero los demas siguen revueltos. Hacen falta tantas pasadas como elementos.',
    exito:
      'La burbuja entera son dos bucles: uno que cuenta pasadas y otro que compara vecinos. Con eso queda ordenada seguro.',
    pistas: ['Mete la pasada dentro de otro bucle.', 'Con tantas pasadas como elementos tiene la lista, sobra.'],
    camino: escalera(ordenada([3, 1, 4, 2])),
    javascript: `const ruta = [3, 1, 4, 2];
for (let vuelta = 0; vuelta < ruta.length; vuelta++) {
  for (let i = 0; i < ruta.length - 1; i++) {
    if (ruta[i] > ruta[i + 1]) {
      const auxiliar = ruta[i];
      ruta[i] = ruta[i + 1];
      ruta[i + 1] = auxiliar;
    }
  }
}
${RECORRER_JS}`,
    python: `ruta = [3, 1, 4, 2]
for vuelta in range(len(ruta)):
    for i in range(len(ruta) - 1):
        if ruta[i] > ruta[i + 1]:
            auxiliar = ruta[i]
            ruta[i] = ruta[i + 1]
            ruta[i + 1] = auxiliar
${RECORRER_PY}`,
  },
  {
    nombre: 'Seis desordenados',
    instruccion: 'Seis numeros bien revueltos. El mismo algoritmo los ordena todos.',
    exito: 'Seis ordenados. El algoritmo no sabe cuantos hay: lo dice la longitud.',
    pistas: ['El programa es el mismo.', 'Solo cambia la lista.'],
    camino: escalera(ordenada([3, 1, 4, 2, 5, 2])),
    javascript: `const ruta = [3, 1, 4, 2, 5, 2];
for (let vuelta = 0; vuelta < ruta.length; vuelta++) {
  for (let i = 0; i < ruta.length - 1; i++) {
    if (ruta[i] > ruta[i + 1]) {
      const auxiliar = ruta[i];
      ruta[i] = ruta[i + 1];
      ruta[i + 1] = auxiliar;
    }
  }
}
${RECORRER_JS}`,
    python: `ruta = [3, 1, 4, 2, 5, 2]
for vuelta in range(len(ruta)):
    for i in range(len(ruta) - 1):
        if ruta[i] > ruta[i + 1]:
            auxiliar = ruta[i]
            ruta[i] = ruta[i + 1]
            ruta[i + 1] = auxiliar
${RECORRER_PY}`,
  },
  {
    nombre: 'La burbuja en una funcion',
    instruccion:
      'Mete la ordenacion en una funcion que reciba la lista. El programa de fuera queda en tres lineas y se lee como lo que hace.',
    exito:
      'Una funcion que ordena. Fijate en algo importante: la funcion cambia la lista que le pasas, no una copia. Eso se llama modificar en el sitio.',
    pistas: ['La funcion recibe la lista y la ordena.', 'No hace falta devolver nada.'],
    camino: escalera(ordenada([4, 1, 3, 2, 5])),
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

const ruta = [4, 1, 3, 2, 5];
ordenar(ruta);
${RECORRER_JS}`,
    python: `def ordenar(lista):
    for vuelta in range(len(lista)):
        for i in range(len(lista) - 1):
            if lista[i] > lista[i + 1]:
                auxiliar = lista[i]
                lista[i] = lista[i + 1]
                lista[i + 1] = auxiliar

ruta = [4, 1, 3, 2, 5]
ordenar(ruta)
${RECORRER_PY}`,
  },
  {
    nombre: 'Ocho desordenados',
    instruccion: 'Ocho numeros y la funcion de ordenar. Es la ruta mas larga del desierto.',
    exito: 'Ocho ordenados con una funcion de siete lineas. El desierto ya tiene camino.',
    pistas: ['La funcion no cambia.', 'Lee los ocho numeros del arranque.'],
    camino: escalera(ordenada([2, 1, 3, 1, 2, 1, 2, 1])),
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

const ruta = [2, 1, 3, 1, 2, 1, 2, 1];
ordenar(ruta);
${RECORRER_JS}`,
    python: `def ordenar(lista):
    for vuelta in range(len(lista)):
        for i in range(len(lista) - 1):
            if lista[i] > lista[i + 1]:
                auxiliar = lista[i]
                lista[i] = lista[i + 1]
                lista[i + 1] = auxiliar

ruta = [2, 1, 3, 1, 2, 1, 2, 1]
ordenar(ruta)
${RECORRER_PY}`,
  },
  {
    nombre: 'De mayor a menor',
    instruccion:
      'El tablero esta dibujado con la ruta ordenada de MAYOR a menor. Cambia una sola cosa del algoritmo.',
    exito:
      'El signo de la comparacion. Un algoritmo de ordenacion no sabe que es estar ordenado: se lo dice la comparacion que le pongas.',
    pistas: ['Solo hay que cambiar el mayor que por un menor que.', 'Todo lo demas se queda igual.'],
    camino: escalera(ordenadaAlReves([2, 4, 1, 3])),
    javascript: `function ordenar(lista) {
  for (let vuelta = 0; vuelta < lista.length; vuelta++) {
    for (let i = 0; i < lista.length - 1; i++) {
      if (lista[i] < lista[i + 1]) {
        const auxiliar = lista[i];
        lista[i] = lista[i + 1];
        lista[i + 1] = auxiliar;
      }
    }
  }
}

const ruta = [2, 4, 1, 3];
ordenar(ruta);
${RECORRER_JS}`,
    python: `def ordenar(lista):
    for vuelta in range(len(lista)):
        for i in range(len(lista) - 1):
            if lista[i] < lista[i + 1]:
                auxiliar = lista[i]
                lista[i] = lista[i + 1]
                lista[i + 1] = auxiliar

ruta = [2, 4, 1, 3]
ordenar(ruta)
${RECORRER_PY}`,
  },
  {
    nombre: 'La comparacion como parametro',
    instruccion:
      'Y ahora las dos ordenaciones en una: pasale a la funcion la comparacion que tiene que usar. Es la idea del mundo 25 aplicada a un algoritmo.',
    exito:
      'Un algoritmo al que se le dice como comparar. Asi funcionan todas las funciones de ordenar que vas a usar en tu vida.',
    pistas: ['El segundo parametro es una funcion que recibe dos numeros.', 'Y devuelve si el primero va antes que el segundo.'],
    camino: escalera(ordenada([3, 1, 4, 2])),
    javascript: `function ordenar(lista, vaAntes) {
  for (let vuelta = 0; vuelta < lista.length; vuelta++) {
    for (let i = 0; i < lista.length - 1; i++) {
      if (vaAntes(lista[i + 1], lista[i])) {
        const auxiliar = lista[i];
        lista[i] = lista[i + 1];
        lista[i + 1] = auxiliar;
      }
    }
  }
}

const ruta = [3, 1, 4, 2];
ordenar(ruta, function (a, b) {
  return a < b;
});
${RECORRER_JS}`,
  },
  {
    nombre: 'Ordenar objetos',
    instruccion:
      'La ruta viene en objetos con nombre y largo, y hay que ordenarlos por el largo. El algoritmo es el mismo: lo unico que cambia es lo que se compara.',
    exito:
      'Ordenar objetos por una de sus claves. El algoritmo no sabe que son objetos: solo sabe comparar lo que le digas.',
    pistas: ['La comparacion mira la clave largo de los dos.', 'El intercambio cambia los objetos enteros.'],
    camino: escalera(ordenada([3, 1, 2])),
    javascript: `const ruta = [
  { nombre: "duna", largo: 3 },
  { nombre: "oasis", largo: 1 },
  { nombre: "roca", largo: 2 },
];
for (let vuelta = 0; vuelta < ruta.length; vuelta++) {
  for (let i = 0; i < ruta.length - 1; i++) {
    if (ruta[i].largo > ruta[i + 1].largo) {
      const auxiliar = ruta[i];
      ruta[i] = ruta[i + 1];
      ruta[i + 1] = auxiliar;
    }
  }
}
for (const nodo of ruta) {
  for (let p = 0; p < nodo.largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `ruta = [
    { "nombre": "duna", "largo": 3 },
    { "nombre": "oasis", "largo": 1 },
    { "nombre": "roca", "largo": 2 },
]
for vuelta in range(len(ruta)):
    for i in range(len(ruta) - 1):
        if ruta[i]["largo"] > ruta[i + 1]["largo"]:
            auxiliar = ruta[i]
            ruta[i] = ruta[i + 1]
            ruta[i + 1] = auxiliar
for nodo in ruta:
    for p in range(nodo["largo"]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Buscar en la lista ordenada',
    instruccion:
      'En una lista ordenada se puede buscar mucho mas rapido: se mira el del medio, y si el que buscas es menor, la mitad de arriba ya no hace falta mirarla. Eso es la busqueda binaria. El pasillo mide la posicion donde esta el seis.',
    exito:
      'La busqueda binaria parte el problema por la mitad cada vez. En una lista de mil, la lineal mira mil y esta mira diez.',
    pistas: [
      'Dos variables, una para el principio y otra para el final del trozo que queda.',
      'El del medio es la suma de las dos partido por dos, redondeado hacia abajo.',
    ],
    camino: [andar(4)],
    javascript: `const datos = [1, 2, 4, 5, 6, 8, 9];
let inicio = 0;
let fin = datos.length - 1;
let donde = 0;
while (inicio <= fin) {
  const medio = Math.floor((inicio + fin) / 2);
  if (datos[medio] === 6) {
    donde = medio;
    break;
  }
  if (datos[medio] < 6) {
    inicio = medio + 1;
  } else {
    fin = medio - 1;
  }
}
for (let p = 0; p < donde; p++) {
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'El mapa que estaba desordenado',
    instruccion:
      'Duna guarda el mapa del desierto y dice que la noche de la tormenta se le desordeno solo: que las marcas cambiaron de sitio. Ordenalo y ve a verla.',
    exito:
      'El mapa ordenado tiene una marca que sobra al final, la mas grande de todas, y Duna dice que esa marca no es una duna. Es un crater. Y esta en el sitio donde no habia nada.',
    pistas: ['La funcion de ordenar y el recorrido.', 'Siete numeros desordenados.'],
    camino: escalera(ordenada([2, 1, 3, 1, 2, 1, 2])),
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

const ruta = [2, 1, 3, 1, 2, 1, 2];
ordenar(ruta);
${RECORRER_JS}`,
    python: `def ordenar(lista):
    for vuelta in range(len(lista)):
        for i in range(len(lista) - 1):
            if lista[i] > lista[i + 1]:
                auxiliar = lista[i]
                lista[i] = lista[i + 1]
                lista[i + 1] = auxiliar

ruta = [2, 1, 3, 1, 2, 1, 2]
ordenar(ruta)
${RECORRER_PY}`,
  },
  {
    nombre: 'Donde esta Duna',
    instruccion:
      'Ultimo del desierto. Duna esta en el borde del crater con el mapa ordenado en las manos, midiendolo. Ve a por ella. Ordena, busca el mayor, y recorre.',
    exito:
      'Duna esta en casa, y ha traido el mapa con el crater dibujado. Dice que el crater tiene la forma de algo que salio, no de algo que entro. La tierra esta levantada hacia arriba en los bordes.',
    pistas: [
      'Primero ordena la lista, y luego recorrela.',
      'Ocho numeros: comprueba con cuatro antes de poner los ocho.',
    ],
    camino: escalera(ordenada([1, 2, 1, 2, 1, 2, 1, 2])),
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

const ruta = [2, 1, 2, 1, 2, 1, 2, 1];
ordenar(ruta);
${RECORRER_JS}`,
    python: `def ordenar(lista):
    for vuelta in range(len(lista)):
        for i in range(len(lista) - 1):
            if lista[i] > lista[i + 1]:
                auxiliar = lista[i]
                lista[i] = lista[i + 1]
                lista[i + 1] = auxiliar

ruta = [2, 1, 2, 1, 2, 1, 2, 1]
ordenar(ruta)
${RECORRER_PY}`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 26,
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
    ...(receta.python ? { python: receta.python } : {}),
    ...(arranque ? { arranque } : {}),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 150 : undefined,
  });
});

export const mundo26: WorldContentFile = {
  mundo: 26,
  slug: 'desierto-de-algoritmos',
  nombre: 'El Desierto de Algoritmos',
  introTexto:
    'El Desierto de Algoritmos no tiene caminos: tiene datos, y hay que trabajarlos para saber por donde ir. Aqui los tableros estan dibujados con la ruta ya ordenada y la lista que te dan esta revuelta, asi que si no la ordenas no llegas. El resultado del algoritmo es la unica forma de recorrer el camino, y se ve en la pantalla en cuanto le das a jugar.',
  actividades,
};
