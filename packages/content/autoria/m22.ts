/**
 * Mundo 22: El Servidor Olvidado. Arreglos y posiciones.
 *
 * El mundo 18 enseñó listas con bloques, y allí la lista era una caja con números
 * dentro y un índice que subía. Escribiendo, la misma idea trae dos cosas nuevas
 * que en bloques no se veían:
 *
 *   El corchete. Sacar el elemento de una posición es `ruta[2]`, y eso obliga a
 *   enfrentarse a algo que en Blockly estaba disimulado: en JavaScript y en Python
 *   las posiciones empiezan en cero, no en uno. Blockly numeraba desde uno para no
 *   confundir a un niño de nueve años; a los diez toca aprender la verdad, y este
 *   mundo la enseña de frente, con una actividad dedicada al error de contar desde
 *   uno.
 *
 *   La longitud. `ruta.length` en JavaScript y `len(ruta)` en Python. Es lo que
 *   permite que el bucle no lleve un número escrito.
 *
 * La progresión de este mundo es, en el fondo, la historia de un error: primero se
 * escriben los índices a mano, luego se descubre que uno de ellos está mal por
 * empezar a contar en el sitio equivocado, y al final el bucle los genera solo.
 *
 * Progresión:
 *   1-4    declarar el arreglo y sacar elementos por su posición.
 *   5-8    el cero. La posición del primer elemento y el error clásico.
 *   9-12   el bucle con el índice, y la longitud en lugar de un número.
 *   13-16  dos arreglos en paralelo, y cuentas sobre lo que se saca.
 *   17-20  el registro del servidor.
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

/** El escalón escrito en JavaScript, con el largo que se le pase. */
function escalonJs(expresion: string): string {
  return `  for (let p = 0; p < ${expresion}; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();`;
}

/** El mismo escalón en Python. */
function escalonPy(expresion: string, sangria = '    '): string {
  return `${sangria}for p in range(${expresion}):
${sangria}    fuzz.avanzar()
${sangria}fuzz.girarDerecha()
${sangria}fuzz.avanzar()
${sangria}fuzz.girarIzquierda()`;
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

/** El programa que recorre un arreglo con un indice contado. */
function conIndice(ruta: readonly number[]): { js: string; py: string } {
  return {
    js: `const ruta = [${ruta.join(', ')}];
for (let i = 0; i < ruta.length; i++) {
${escalonJs('ruta[i]')}
}`,
    py: `ruta = [${ruta.join(', ')}]
for i in range(len(ruta)):
${escalonPy('ruta[i]')}`,
  };
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'El primer arreglo',
    instruccion:
      'El Servidor Olvidado lleva apagado desde antes de la tormenta y todavia guarda registros. Byte dice que dentro hay listas de numeros por todas partes. Escribe una: se ponen entre corchetes y separados por comas. Guarda los tres largos del camino y saca el primero.',
    exito:
      'Un arreglo escrito. Los corchetes lo abren y lo cierran, y las comas separan. Dentro caben tantos numeros como quieras.',
    pistas: [
      'En JavaScript se escribe const ruta y el igual, y los numeros entre corchetes.',
      'En Python es igual pero sin el const.',
    ],
    camino: escalera([3, 2, 4]),
    javascript: `const ruta = [3, 2, 4];
for (let p = 0; p < ruta[0]; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
for (let p = 0; p < ruta[1]; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
for (let p = 0; p < ruta[2]; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();`,
    python: `ruta = [3, 2, 4]
for p in range(ruta[0]):
    fuzz.avanzar()
fuzz.girarDerecha()
fuzz.avanzar()
fuzz.girarIzquierda()
for p in range(ruta[1]):
    fuzz.avanzar()
fuzz.girarDerecha()
fuzz.avanzar()
fuzz.girarIzquierda()
for p in range(ruta[2]):
    fuzz.avanzar()
fuzz.girarDerecha()
fuzz.avanzar()
fuzz.girarIzquierda()`,
    arranqueJs: `const ruta = [3, 2, 4];
// Saca cada largo con ruta y su posicion entre corchetes.
`,
    arranquePy: `ruta = [3, 2, 4]
# Saca cada largo con ruta y su posicion entre corchetes.
`,
  },
  {
    nombre: 'La posicion cero',
    instruccion:
      'Y aqui viene la cosa mas rara de programar, asi que se dice de frente: el primer elemento de un arreglo esta en la posicion CERO, no en la uno. En los bloques del mundo 18 empezaba en uno porque era mas facil, pero la verdad es cero. Cuatro largos, cuatro posiciones: cero, uno, dos y tres.',
    exito:
      'Cero, uno, dos y tres para cuatro elementos. Suena mal la primera vez y despues ya no se te olvida.',
    pistas: [
      'El primer largo esta en la posicion cero.',
      'Y el ultimo de cuatro elementos esta en la posicion tres, no en la cuatro.',
    ],
    camino: escalera([2, 3, 1, 4]),
    javascript: conIndice([2, 3, 1, 4]).js,
    python: conIndice([2, 3, 1, 4]).py,
    arranqueJs: `const ruta = [2, 3, 1, 4];
// Recuerda: el primero esta en la posicion cero.
`,
    arranquePy: `ruta = [2, 3, 1, 4]
# Recuerda: el primero esta en la posicion cero.
`,
  },
  {
    nombre: 'La longitud',
    instruccion:
      'Todavia hay un numero escrito a mano en el bucle. Preguntale al arreglo cuantos elementos tiene: en JavaScript es punto length y en Python es len con el arreglo dentro.',
    exito:
      'Ni un numero escrito. Si manana el registro trae dos largos mas, el programa los recorre sin que le digas nada.',
    pistas: ['En JavaScript: ruta.length', 'En Python: len de ruta.'],
    camino: escalera([2, 3, 1, 4, 2]),
    javascript: conIndice([2, 3, 1, 4, 2]).js,
    python: conIndice([2, 3, 1, 4, 2]).py,
  },
  {
    nombre: 'Ocho posiciones',
    instruccion: 'Ocho largos en el arreglo y el mismo programa. Solo crece la primera linea.',
    exito: 'Ocho largos y cinco lineas de logica. El registro del servidor cabe en una linea.',
    pistas: ['Lee los ocho largos del tablero.', 'La logica no cambia.'],
    camino: escalera([1, 2, 1, 3, 2, 1, 2, 1]),
    javascript: conIndice([1, 2, 1, 3, 2, 1, 2, 1]).js,
    python: conIndice([1, 2, 1, 3, 2, 1, 2, 1]).py,
  },
  {
    nombre: 'El ultimo elemento',
    instruccion:
      'Para sacar el ultimo elemento de un arreglo no vale poner su posicion a mano si no sabes cuantos hay. Se pide la longitud y se le resta uno. Aqui el ultimo tramo mide lo que dice el ultimo numero.',
    exito:
      'La longitud menos uno es el ultimo. Esa resta es la consecuencia de que las posiciones empiecen en cero, y sale en todos los programas del mundo.',
    pistas: ['La ultima posicion es la longitud menos uno.', 'Sirve aunque no sepas cuantos elementos hay.'],
    camino: escalera([2, 3, 1, 4]),
    javascript: `const ruta = [2, 3, 1, 4];
for (let i = 0; i < ruta.length - 1; i++) {
${escalonJs('ruta[i]')}
}
${escalonJs('ruta[ruta.length - 1]')}`,
    python: `ruta = [2, 3, 1, 4]
for i in range(len(ruta) - 1):
${escalonPy('ruta[i]')}
${escalonPy('ruta[len(ruta) - 1]', '')}`,
  },
  {
    nombre: 'Datos en el registro',
    instruccion: 'Byte ha marcado tres posiciones del registro. Pasa por encima de todas.',
    exito: 'Los tres datos. Byte dice que son los unicos que quedan legibles.',
    pistas: ['El programa del arreglo con la longitud.', 'Los datos estan en el camino.'],
    camino: escalera([2, 3, 2, 4]).flatMap((paso, i) => (i % 4 === 0 ? [paso, estrellaAqui()] : [paso])),
    javascript: conIndice([2, 3, 2, 4]).js,
    python: conIndice([2, 3, 2, 4]).py,
  },
  {
    nombre: 'Dos arreglos',
    instruccion:
      'El registro tiene dos columnas: lo que se anda y lo que se baja. Dos arreglos, y el mismo indice saca de los dos.',
    exito:
      'Dos arreglos y un indice. Se llaman paralelos porque van a la par: la posicion tres de uno corresponde a la posicion tres del otro.',
    pistas: ['Los dos arreglos tienen la misma longitud.', 'El mismo i saca de los dos.'],
    camino: escalera([2, 1, 3, 2], [1, 2, 1, 2]),
    javascript: `const largos = [2, 1, 3, 2];
const bajadas = [1, 2, 1, 2];
for (let i = 0; i < largos.length; i++) {
  for (let p = 0; p < largos[i]; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < bajadas[i]; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}`,
    python: `largos = [2, 1, 3, 2]
bajadas = [1, 2, 1, 2]
for i in range(len(largos)):
    for p in range(largos[i]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(bajadas[i]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Seis pares',
    instruccion: 'Los dos arreglos con seis numeros cada uno. Leelos del tablero por columnas.',
    exito: 'Seis pares. Si te equivocas de columna, el Fuzz baja donde tenia que andar.',
    pistas: ['Primero el arreglo de los largos entero.', 'Y luego el de las bajadas, mirando otra vez.'],
    camino: escalera([2, 1, 3, 1, 2, 1], [1, 2, 1, 1, 2, 1]),
    javascript: `const largos = [2, 1, 3, 1, 2, 1];
const bajadas = [1, 2, 1, 1, 2, 1];
for (let i = 0; i < largos.length; i++) {
  for (let p = 0; p < largos[i]; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < bajadas[i]; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}`,
    python: `largos = [2, 1, 3, 1, 2, 1]
bajadas = [1, 2, 1, 1, 2, 1]
for i in range(len(largos)):
    for p in range(largos[i]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(bajadas[i]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Cuentas sobre el dato',
    instruccion:
      'El registro esta comprimido: cada largo de verdad es el numero del arreglo mas uno. No cambies el arreglo, cambia la cuenta.',
    exito: 'Una cuenta sobre el dato. Los datos se dejan como llegan y se ajusta lo que se hace con ellos.',
    pistas: ['Sacas el elemento y le sumas uno.', 'El arreglo se queda tal cual.'],
    camino: escalera([2, 3, 2, 4, 3]),
    javascript: `const ruta = [1, 2, 1, 3, 2];
for (let i = 0; i < ruta.length; i++) {
${escalonJs('ruta[i] + 1')}
}`,
    python: `ruta = [1, 2, 1, 3, 2]
for i in range(len(ruta)):
${escalonPy('ruta[i] + 1')}`,
  },
  {
    nombre: 'El doble',
    instruccion: 'Y ahora cada largo es el doble del numero del registro. La misma idea con otra cuenta.',
    exito: 'El doble. Un arreglo guarda numeros; lo que significan lo decide el programa.',
    pistas: ['Multiplicar se escribe con el asterisco.', 'El arreglo no cambia.'],
    camino: escalera([2, 4, 2, 6]),
    javascript: `const ruta = [1, 2, 1, 3];
for (let i = 0; i < ruta.length; i++) {
${escalonJs('ruta[i] * 2')}
}`,
    python: `ruta = [1, 2, 1, 3]
for i in range(len(ruta)):
${escalonPy('ruta[i] * 2')}`,
  },
  {
    nombre: 'Cambiar un elemento',
    instruccion:
      'Un arreglo no es de piedra: se puede cambiar un elemento poniendo su posicion a la izquierda del igual. El registro trae un dato mal y hay que corregirlo antes de usarlo.',
    exito:
      'Un elemento cambiado en su sitio. El arreglo es el mismo objeto: no se ha copiado, se ha modificado.',
    pistas: ['Se escribe el nombre, la posicion entre corchetes, el igual y el valor nuevo.', 'El dato malo es el de la posicion dos.'],
    camino: escalera([2, 3, 4, 1]),
    javascript: `const ruta = [2, 3, 9, 1];
ruta[2] = 4;
for (let i = 0; i < ruta.length; i++) {
${escalonJs('ruta[i]')}
}`,
    python: `ruta = [2, 3, 9, 1]
ruta[2] = 4
for i in range(len(ruta)):
${escalonPy('ruta[i]')}`,
  },
  {
    nombre: 'La suma del registro',
    instruccion:
      'Aqui el pasillo mide lo que suman todos los numeros del registro. Recorre el arreglo sumando en una variable y despues anda esa cantidad.',
    exito:
      'Una variable que acumula. Es el patron mas usado de la programacion: empezar en cero e ir sumando lo que se encuentra.',
    pistas: ['Crea una variable total que empiece en cero.', 'Dentro del bucle, total es total mas el elemento.'],
    camino: [andar(12)],
    javascript: `const ruta = [3, 4, 2, 3];
let total = 0;
for (let i = 0; i < ruta.length; i++) {
  total = total + ruta[i];
}
for (let p = 0; p < total; p++) {
  fuzz.avanzar();
}`,
    python: `ruta = [3, 4, 2, 3]
total = 0
for i in range(len(ruta)):
    total = total + ruta[i]
for p in range(total):
    fuzz.avanzar()`,
  },
  {
    nombre: 'El mayor del registro',
    instruccion:
      'El pasillo mide lo que mide el numero mas grande del registro. Recorre el arreglo quedandote con el mayor que hayas visto.',
    exito:
      'Buscar el mayor es el mismo patron que sumar: una variable que se va quedando con lo mejor de lo visto hasta ahora.',
    pistas: [
      'Empieza con el primer elemento como mayor.',
      'Y en cada vuelta, si el elemento es mas grande, cambia el mayor.',
    ],
    camino: [andar(7)],
    javascript: `const ruta = [3, 7, 2, 5];
let mayor = ruta[0];
for (let i = 1; i < ruta.length; i++) {
  if (ruta[i] > mayor) {
    mayor = ruta[i];
  }
}
for (let p = 0; p < mayor; p++) {
  fuzz.avanzar();
}`,
    python: `ruta = [3, 7, 2, 5]
mayor = ruta[0]
for i in range(1, len(ruta)):
    if ruta[i] > mayor:
        mayor = ruta[i]
for p in range(mayor):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Cuantos hay de dos',
    instruccion:
      'El pasillo mide cuantos doses hay en el registro. Recorre el arreglo contando los que valen dos.',
    exito: 'Contar los que cumplen algo: la tercera version del mismo patron. Una variable, un bucle y una condicion.',
    pistas: ['Una variable cuenta que empieza en cero.', 'Si el elemento vale dos, sumale uno a la cuenta.'],
    camino: [andar(4)],
    javascript: `const ruta = [2, 5, 2, 3, 2, 7, 2];
let cuenta = 0;
for (let i = 0; i < ruta.length; i++) {
  if (ruta[i] === 2) {
    cuenta = cuenta + 1;
  }
}
for (let p = 0; p < cuenta; p++) {
  fuzz.avanzar();
}`,
    python: `ruta = [2, 5, 2, 3, 2, 7, 2]
cuenta = 0
for i in range(len(ruta)):
    if ruta[i] == 2:
        cuenta = cuenta + 1
for p in range(cuenta):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Diez posiciones',
    instruccion: 'El registro entero: diez largos. Con el arreglo cabe en dos lineas y un bucle.',
    exito: 'Diez largos. El servidor lleva veinte anos apagado y su registro sigue siendo legible.',
    pistas: ['Lee los diez largos en orden.', 'La logica es la de siempre.'],
    camino: escalera([1, 2, 1, 2, 1, 3, 1, 2, 1, 2]),
    javascript: conIndice([1, 2, 1, 2, 1, 3, 1, 2, 1, 2]).js,
    python: conIndice([1, 2, 1, 2, 1, 3, 1, 2, 1, 2]).py,
  },
  {
    nombre: 'El registro al reves',
    instruccion:
      'Recorre el registro de atras hacia delante: empieza en la ultima posicion y baja hasta cero.',
    exito:
      'Un bucle que baja. La i empieza en la longitud menos uno, la condicion es mayor o igual que cero, y en vez de subir, resta.',
    pistas: ['La i empieza en la longitud menos uno.', 'Y en cada vuelta la i baja de uno en uno.'],
    camino: escalera([4, 1, 3, 2]),
    javascript: `const ruta = [2, 3, 1, 4];
for (let i = ruta.length - 1; i >= 0; i--) {
${escalonJs('ruta[i]')}
}`,
    python: `ruta = [2, 3, 1, 4]
i = len(ruta) - 1
while i >= 0:
${escalonPy('ruta[i]')}
    i = i - 1`,
  },
  {
    nombre: 'Dos registros a la vez',
    instruccion:
      'Dos arreglos y ocho pares. Es el registro completo del servidor, con las dos columnas.',
    exito: 'Ocho pares sin equivocarte de columna. Byte dice que el servidor no habia arrancado desde antes de la tormenta.',
    pistas: ['Escribe los dos arreglos y comprueba que tienen la misma longitud.', 'Comprueba con cuatro pares antes de poner los ocho.'],
    camino: escalera([2, 1, 2, 1, 3, 1, 2, 1], [1, 2, 1, 2, 1, 2, 1, 2]),
    javascript: `const largos = [2, 1, 2, 1, 3, 1, 2, 1];
const bajadas = [1, 2, 1, 2, 1, 2, 1, 2];
for (let i = 0; i < largos.length; i++) {
  for (let p = 0; p < largos[i]; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < bajadas[i]; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}`,
    python: `largos = [2, 1, 2, 1, 3, 1, 2, 1]
bajadas = [1, 2, 1, 2, 1, 2, 1, 2]
for i in range(len(largos)):
    for p in range(largos[i]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(bajadas[i]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'La funcion que recorre',
    instruccion:
      'Mete el recorrido en una funcion que reciba el arreglo. Asi el mismo codigo sirve para cualquier registro que le pases.',
    exito:
      'Una funcion que recibe un arreglo. Es la primera vez que le pasas a una funcion algo que no es un numero.',
    pistas: ['La funcion recibe el arreglo como parametro.', 'Y dentro hace el bucle de siempre.'],
    camino: escalera([2, 3, 1, 2, 4]),
    javascript: `function recorrer(ruta) {
  for (let i = 0; i < ruta.length; i++) {
    for (let p = 0; p < ruta[i]; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

recorrer([2, 3, 1, 2, 4]);`,
    python: `def recorrer(ruta):
    for i in range(len(ruta)):
        for p in range(ruta[i]):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()

recorrer([2, 3, 1, 2, 4])`,
  },
  {
    nombre: 'El registro de esa noche',
    instruccion:
      'Byte ha conseguido leer un registro del servidor con la fecha de la tormenta. Dice que tiene una posicion que no deberia existir, la numero cero, y que en los registros del servidor la cero siempre esta vacia. En esta hay algo. Ve a verla.',
    exito:
      'La posicion cero del registro de esa noche tiene una hora: las tres y catorce. Y un numero: treinta. El mundo treinta es el Nucleo. Byte se ha quedado mirando la pantalla sin decir nada.',
    pistas: ['La funcion que recibe el arreglo.', 'Siete largos.'],
    camino: escalera([2, 1, 3, 1, 2, 1, 2]),
    javascript: `function recorrer(ruta) {
  for (let i = 0; i < ruta.length; i++) {
    for (let p = 0; p < ruta[i]; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

recorrer([2, 1, 3, 1, 2, 1, 2]);`,
    python: `def recorrer(ruta):
    for i in range(len(ruta)):
        for p in range(ruta[i]):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()

recorrer([2, 1, 3, 1, 2, 1, 2])`,
  },
  {
    nombre: 'Donde esta Bit',
    instruccion:
      'Ultimo del servidor. Bit esta en la sala de discos, copiando el registro de esa noche en otro sitio por si se borra. Ve a por ella. Dos arreglos y nueve pares.',
    exito:
      'Bit esta en casa, y ha traido una copia del registro. Dice que lo ha guardado en tres sitios distintos porque no se fia. En el Nido ya hay veintiuna cosas raras, y todas apuntan a la misma noche.',
    pistas: ['Dos arreglos paralelos y el bucle con la longitud.', 'Nueve pares: comprueba a mitad.'],
    camino: escalera([1, 2, 1, 2, 1, 2, 1, 2, 1], [1, 2, 1, 2, 1, 2, 1, 2, 1]),
    javascript: `const largos = [1, 2, 1, 2, 1, 2, 1, 2, 1];
const bajadas = [1, 2, 1, 2, 1, 2, 1, 2, 1];
for (let i = 0; i < largos.length; i++) {
  for (let p = 0; p < largos[i]; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  for (let b = 0; b < bajadas[i]; b++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}`,
    python: `largos = [1, 2, 1, 2, 1, 2, 1, 2, 1]
bajadas = [1, 2, 1, 2, 1, 2, 1, 2, 1]
for i in range(len(largos)):
    for p in range(largos[i]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    for b in range(bajadas[i]):
        fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 22,
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
    exigeEstructuras: ['lista'],
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 130 : undefined,
  });
});

export const mundo22: WorldContentFile = {
  mundo: 22,
  slug: 'servidor-olvidado',
  nombre: 'El Servidor Olvidado',
  introTexto:
    'El Servidor Olvidado lleva apagado desde antes de la tormenta y todavia guarda registros: listas de numeros por todas partes. Aqui vas a aprender a leerlas escribiendo, y con eso llega la cosa mas rara de programar: las posiciones empiezan en cero. En los bloques del mundo 18 empezaban en uno porque era mas facil, pero la verdad es cero, y este mundo la cuenta de frente.',
  actividades,
};
