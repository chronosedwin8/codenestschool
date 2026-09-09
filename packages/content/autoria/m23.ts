/**
 * Mundo 23: El Laboratorio Antivirus. Recorrer sin índices.
 *
 * El mundo 22 recorría un arreglo con un índice: `ruta[i]`, y la i subiendo. Este
 * mundo enseña la forma que no necesita índice, `for (const paso of ruta)` en
 * JavaScript y `for paso in ruta` en Python, y sobre todo enseña cuándo usar cada
 * una, que es la parte que casi nunca se explica:
 *
 *   Sin índice cuando solo importan los valores. Es más corto, se lee mejor y no
 *   se puede equivocar en el rango, que es el error más común del mundo 22.
 *
 *   Con índice cuando hace falta saber la posición: para mirar dos arreglos a la
 *   vez, para comparar un elemento con el siguiente, o para recorrer al revés.
 *
 * La progresión está montada sobre esa distinción. Las primeras actividades se
 * hacen sin índice y quedan visiblemente más limpias; luego llega una que no se
 * puede hacer sin índice, y ahí se entiende que la forma corta no es la mejor
 * siempre, solo casi siempre.
 *
 * Y como es el laboratorio antivirus, la mitad de los arreglos tienen elementos
 * que hay que saltarse: `continue` y `break` aparecen aquí, que son las dos formas
 * de romper un bucle por dentro.
 *
 * Progresión:
 *   1-4    el bucle sin índice. El mismo programa del mundo 22, más corto.
 *   5-8    saltarse elementos con continue, y cortar el bucle con break.
 *   9-12   cuándo hace falta el índice: dos arreglos, y comparar con el siguiente.
 *   13-16  bucles anidados sobre arreglos.
 *   17-20  el virus del laboratorio.
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

/** El escalón, con la expresión que da el largo. */
const CUERPO_JS = `  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();`;

const RECETAS: readonly Receta[] = [
  {
    nombre: 'El bucle sin indice',
    instruccion:
      'En el Laboratorio Antivirus todo se mide en listas de numeros. Y hay una forma de recorrer una lista que no necesita indice: en vez de pedir la posicion i, se pide directamente cada elemento. En JavaScript es for con la palabra of, y en Python es for con la palabra in.',
    exito:
      'Sin indice y sin longitud. Compara este programa con el del mundo 22: hace lo mismo y no hay ni un corchete.',
    pistas: [
      'En JavaScript: for con const paso of ruta.',
      'En Python: for paso in ruta. Y dentro, paso ya es el numero.',
    ],
    camino: escalera([2, 3, 1, 4]),
    javascript: `const ruta = [2, 3, 1, 4];
for (const paso of ruta) {
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [2, 3, 1, 4]
for paso in ruta:
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
    arranqueJs: `const ruta = [2, 3, 1, 4];
// Recorre la lista sin usar ningun indice.
`,
    arranquePy: `ruta = [2, 3, 1, 4]
# Recorre la lista sin usar ningun indice.
`,
  },
  {
    nombre: 'Sin indice, ocho tramos',
    instruccion: 'Ocho tramos y el mismo programa. Fijate en que no hay ningun numero que pueda salirse de rango.',
    exito:
      'Ocho tramos y ni un rango que equivocar. Esa es la ventaja de verdad del bucle sin indice: quita una clase entera de errores.',
    pistas: ['El programa no cambia.', 'Solo crece la lista.'],
    camino: escalera([1, 2, 1, 3, 2, 1, 2, 1]),
    javascript: `const ruta = [1, 2, 1, 3, 2, 1, 2, 1];
for (const paso of ruta) {
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [1, 2, 1, 3, 2, 1, 2, 1]
for paso in ruta:
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Muestras del laboratorio',
    instruccion: 'Hay muestras por los tramos. Pasa por encima de todas.',
    exito: 'Las muestras. En el laboratorio las guardan en tubos numerados y nadie sabe de que son.',
    pistas: ['El bucle sin indice.', 'Las muestras estan en el camino.'],
    camino: escalera([2, 3, 2, 4]).flatMap((paso, i) => (i % 4 === 0 ? [paso, estrellaAqui()] : [paso])),
    javascript: `const ruta = [2, 3, 2, 4];
for (const paso of ruta) {
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [2, 3, 2, 4]
for paso in ruta:
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'La suma sin indice',
    instruccion:
      'El pasillo mide lo que suman los numeros de la lista. Suma sin usar indices: recorre los valores y ve acumulando.',
    exito: 'Una suma en tres lineas. Con indices habrian sido las mismas tres, pero con dos sitios donde equivocarse.',
    pistas: ['Una variable total que empieza en cero.', 'Y dentro del bucle, total es total mas paso.'],
    camino: [andar(11)],
    javascript: `const ruta = [3, 5, 2, 1];
let total = 0;
for (const paso of ruta) {
  total = total + paso;
}
for (let p = 0; p < total; p++) {
  fuzz.avanzar();
}`,
    python: `ruta = [3, 5, 2, 1]
total = 0
for paso in ruta:
    total = total + paso
for p in range(total):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Saltarse un elemento',
    instruccion:
      'La lista tiene ceros, y un tramo de cero casillas no existe: hay que saltarselo sin girar. La palabra continue salta a la vuelta siguiente del bucle sin hacer lo que queda.',
    exito:
      'Continue salta el resto de la vuelta. Sin el harian falta un if y una sangria mas, y se lee peor.',
    pistas: [
      'Si el paso vale cero, usa continue.',
      'Continue va antes de todo lo que no hay que hacer.',
    ],
    camino: escalera([2, 3, 1]),
    javascript: `const ruta = [2, 0, 3, 0, 1];
for (const paso of ruta) {
  if (paso === 0) {
    continue;
  }
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [2, 0, 3, 0, 1]
for paso in ruta:
    if paso == 0:
        continue
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
    arranqueJs: `const ruta = [2, 0, 3, 0, 1];
// Los ceros hay que saltarselos.
`,
    arranquePy: `ruta = [2, 0, 3, 0, 1]
# Los ceros hay que saltarselos.
`,
  },
  {
    nombre: 'Muchos ceros',
    instruccion: 'La mitad de la lista son ceros. El mismo programa los ignora todos.',
    exito: 'Seis ceros ignorados. Un continue vale para uno y para cien.',
    pistas: ['El programa es el mismo.', 'Los ceros no cuentan como tramo.'],
    camino: escalera([1, 2, 1, 3]),
    javascript: `const ruta = [0, 1, 0, 2, 0, 1, 0, 3, 0, 0];
for (const paso of ruta) {
  if (paso === 0) {
    continue;
  }
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [0, 1, 0, 2, 0, 1, 0, 3, 0, 0]
for paso in ruta:
    if paso == 0:
        continue
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Cortar el bucle',
    instruccion:
      'En esta lista hay un menos uno, y significa fin del registro: lo que venga despues no se lee. La palabra break sale del bucle entero, no solo de la vuelta.',
    exito:
      'Break sale del bucle. Continue salta una vuelta y break se va del todo: se parecen en el nombre y no en lo que hacen.',
    pistas: ['Si el paso vale menos uno, usa break.', 'Lo que hay despues del menos uno no se recorre.'],
    camino: escalera([2, 3, 1]),
    javascript: `const ruta = [2, 3, 1, -1, 4, 2];
for (const paso of ruta) {
  if (paso === -1) {
    break;
  }
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [2, 3, 1, -1, 4, 2]
for paso in ruta:
    if paso == -1:
        break
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Ceros y fin de registro',
    instruccion: 'La lista tiene ceros que se saltan y un fin de registro que corta. Las dos palabras en el mismo bucle.',
    exito: 'Continue y break juntos. El orden de los dos ifs no cambia nada aqui, pero conviene pensarlo.',
    pistas: ['Primero mira si es fin de registro y luego si es cero.', 'O al contrario: aqui da igual, pero piensa por que.'],
    camino: escalera([2, 1, 3]),
    javascript: `const ruta = [2, 0, 1, 0, 3, -1, 5, 5];
for (const paso of ruta) {
  if (paso === -1) {
    break;
  }
  if (paso === 0) {
    continue;
  }
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [2, 0, 1, 0, 3, -1, 5, 5]
for paso in ruta:
    if paso == -1:
        break
    if paso == 0:
        continue
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Aqui hace falta el indice',
    instruccion:
      'Dos listas en paralelo: los largos y las bajadas. Y aqui el bucle sin indice no sirve, porque hace falta saber la posicion para sacar el dato de la segunda lista. Vuelve al indice.',
    exito:
      'El bucle sin indice es mejor casi siempre, y este es el casi. Cuando hay que mirar dos listas a la vez, hace falta la posicion.',
    pistas: ['Con dos listas hay que recorrer por posicion.', 'El mismo i saca de las dos.'],
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
    nombre: 'Comparar con el siguiente',
    instruccion:
      'Otro caso donde hace falta el indice: aqui el tramo mide la diferencia entre un numero y el siguiente. Para mirar el siguiente hay que saber donde estas.',
    exito:
      'Mirar el siguiente obliga a saber la posicion, y obliga a parar una vuelta antes: si no, se pide un elemento que no existe.',
    pistas: [
      'El bucle llega hasta la longitud menos uno.',
      'Y el largo es el elemento de la posicion siguiente menos el de esta.',
    ],
    camino: escalera([2, 3, 1]),
    javascript: `const marcas = [1, 3, 6, 7];
for (let i = 0; i < marcas.length - 1; i++) {
  const paso = marcas[i + 1] - marcas[i];
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `marcas = [1, 3, 6, 7]
for i in range(len(marcas) - 1):
    paso = marcas[i + 1] - marcas[i]
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Al reves tambien pide indice',
    instruccion: 'Recorrer la lista de atras hacia delante tampoco se puede sin indice. Hazlo con uno que baje.',
    exito: 'Tres casos ya donde el indice es imprescindible: dos listas, mirar el siguiente, y recorrer al reves.',
    pistas: ['El indice empieza en la longitud menos uno.', 'Y baja hasta cero.'],
    camino: escalera([4, 1, 3, 2]),
    javascript: `const ruta = [2, 3, 1, 4];
for (let i = ruta.length - 1; i >= 0; i--) {
  for (let p = 0; p < ruta[i]; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [2, 3, 1, 4]
i = len(ruta) - 1
while i >= 0:
    for p in range(ruta[i]):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()
    i = i - 1`,
  },
  {
    nombre: 'Solo los que pasan el filtro',
    instruccion:
      'La lista tiene numeros grandes que son virus: cualquiera mayor que cinco. Saltatelos y recorre solo los buenos.',
    exito: 'Un filtro dentro del bucle. Es continue otra vez, con una condicion mas interesante.',
    pistas: ['Si el paso es mayor que cinco, continue.', 'El bucle sin indice vale aqui.'],
    camino: escalera([2, 1, 3, 2]),
    javascript: `const ruta = [2, 9, 1, 7, 3, 8, 2];
for (const paso of ruta) {
  if (paso > 5) {
    continue;
  }
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
${CUERPO_JS}
}`,
    python: `ruta = [2, 9, 1, 7, 3, 8, 2]
for paso in ruta:
    if paso > 5:
        continue
    for p in range(paso):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Contar los virus',
    instruccion: 'El pasillo mide cuantos virus hay en la muestra, es decir cuantos numeros pasan de cinco.',
    exito: 'Contar los que cumplen algo. Con el bucle sin indice se lee casi como la frase que lo describe.',
    pistas: ['Una variable cuenta que empieza en cero.', 'Si el paso es mayor que cinco, sumale uno.'],
    camino: [andar(4)],
    javascript: `const muestra = [2, 9, 1, 7, 3, 8, 2, 6];
let virus = 0;
for (const dato of muestra) {
  if (dato > 5) {
    virus = virus + 1;
  }
}
for (let p = 0; p < virus; p++) {
  fuzz.avanzar();
}`,
    python: `muestra = [2, 9, 1, 7, 3, 8, 2, 6]
virus = 0
for dato in muestra:
    if dato > 5:
        virus = virus + 1
for p in range(virus):
    fuzz.avanzar()`,
  },
  {
    nombre: 'Una lista dentro de otra',
    instruccion:
      'El laboratorio guarda las muestras por bandejas: una lista de listas. Para recorrerla hacen falta dos bucles, uno dentro del otro, y el de dentro recorre cada bandeja.',
    exito:
      'Dos bucles sin indice, uno dentro del otro. El de fuera saca bandejas y el de dentro saca numeros de la bandeja.',
    pistas: ['El bucle de fuera recorre las bandejas.', 'Y el de dentro recorre los numeros de esa bandeja.'],
    camino: escalera([1, 2, 3, 1, 2]),
    javascript: `const bandejas = [[1, 2], [3], [1, 2]];
for (const bandeja of bandejas) {
  for (const paso of bandeja) {
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}`,
    python: `bandejas = [[1, 2], [3], [1, 2]]
for bandeja in bandejas:
    for paso in bandeja:
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Cuatro bandejas',
    instruccion: 'Cuatro bandejas con numeros distintos en cada una. El mismo programa.',
    exito: 'Cuatro bandejas. El programa no sabe cuantas hay ni cuantos numeros tiene cada una.',
    pistas: ['No cambies los bucles.', 'Solo cambia la lista de listas.'],
    camino: escalera([2, 1, 1, 3, 2, 1, 2]),
    javascript: `const bandejas = [[2, 1], [1, 3], [2], [1, 2]];
for (const bandeja of bandejas) {
  for (const paso of bandeja) {
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}`,
    python: `bandejas = [[2, 1], [1, 3], [2], [1, 2]]
for bandeja in bandejas:
    for paso in bandeja:
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()`,
  },
  {
    nombre: 'La bandeja contaminada',
    instruccion:
      'Una de las bandejas esta contaminada: tiene un menos uno dentro. En cuanto lo encuentres, sal de esa bandeja y pasa a la siguiente. Cuidado: break sale del bucle de dentro, no de los dos.',
    exito:
      'Break sale de un solo bucle, el mas cercano. Eso es exactamente lo que hacia falta aqui, y es la clase de detalle que solo se aprende probando.',
    pistas: ['El break va en el bucle de dentro.', 'Y sale solo de la bandeja, no del recorrido entero.'],
    camino: escalera([1, 2, 2, 1, 2]),
    javascript: `const bandejas = [[1, 2], [2, -1, 5], [1, 2]];
for (const bandeja of bandejas) {
  for (const paso of bandeja) {
    if (paso === -1) {
      break;
    }
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}`,
    python: `bandejas = [[1, 2], [2, -1, 5], [1, 2]]
for bandeja in bandejas:
    for paso in bandeja:
        if paso == -1:
            break
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()`,
  },
  {
    nombre: 'La funcion que limpia',
    instruccion:
      'Mete el recorrido de una bandeja en una funcion que reciba la bandeja. El programa de fuera solo dice: para cada bandeja, limpiala.',
    exito:
      'Una funcion que recibe una lista. El programa de fuera son dos lineas y se lee como la frase que lo describe.',
    pistas: ['La funcion recibe la bandeja como parametro.', 'Y dentro hace el bucle sin indice.'],
    camino: escalera([2, 1, 1, 2, 3]),
    javascript: `function limpiar(bandeja) {
  for (const paso of bandeja) {
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

for (const bandeja of [[2, 1], [1, 2], [3]]) {
  limpiar(bandeja);
}`,
    python: `def limpiar(bandeja):
    for paso in bandeja:
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()

for bandeja in [[2, 1], [1, 2], [3]]:
    limpiar(bandeja)`,
  },
  {
    nombre: 'Ocho bandejas',
    instruccion: 'Ocho bandejas y la funcion de limpiar. Es el laboratorio entero.',
    exito: 'Ocho bandejas con una funcion y dos bucles. El laboratorio esta limpio.',
    pistas: ['La funcion no cambia.', 'Solo crece la lista de bandejas.'],
    camino: escalera([1, 1, 2, 1, 1, 2, 1, 1, 2, 1]),
    javascript: `function limpiar(bandeja) {
  for (const paso of bandeja) {
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

const bandejas = [[1, 1], [2, 1], [1, 2], [1, 1], [2, 1]];
for (const bandeja of bandejas) {
  limpiar(bandeja);
}`,
    python: `def limpiar(bandeja):
    for paso in bandeja:
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()

bandejas = [[1, 1], [2, 1], [1, 2], [1, 1], [2, 1]]
for bandeja in bandejas:
    limpiar(bandeja)`,
  },
  {
    nombre: 'La muestra que no se deja leer',
    instruccion:
      'Hay una bandeja en el laboratorio que nadie consigue leer entera: el programa siempre se corta a la mitad. Ve a verla y te cuentan por que.',
    exito:
      'La bandeja tiene un menos uno en el medio, y por eso todos los programas se cortan ahi. Pero el numero de despues no es un numero: es una hora. Las tres y catorce. Ya van cuatro sitios distintos donde aparece esa hora.',
    pistas: ['La funcion de limpiar y un break en la bandeja.', 'Seis bandejas.'],
    camino: escalera([1, 2, 1, 1, 2, 1, 2]),
    javascript: `function limpiar(bandeja) {
  for (const paso of bandeja) {
    if (paso === -1) {
      break;
    }
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

const bandejas = [[1, 2], [1, 1, -1, 9], [2, 1], [2]];
for (const bandeja of bandejas) {
  limpiar(bandeja);
}`,
    python: `def limpiar(bandeja):
    for paso in bandeja:
        if paso == -1:
            break
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()

bandejas = [[1, 2], [1, 1, -1, 9], [2, 1], [2]]
for bandeja in bandejas:
    limpiar(bandeja)`,
  },
  {
    nombre: 'Donde esta Nucleo',
    instruccion:
      'Ultimo del laboratorio. Nucleo, el Fuzz, no la maquina, esta en la sala de muestras con la bandeja que no se deja leer. Ve a por ella. Bandejas, filtro y funcion: todo lo del mundo junto.',
    exito:
      'Nucleo esta en casa. Y se llama asi desde siempre, dice, mucho antes de que existiera el Nucleo de la IA. Nadie sabe quien le puso el nombre.',
    pistas: [
      'La funcion recibe la bandeja, salta los ceros y corta con el menos uno.',
      'Cinco bandejas.',
    ],
    camino: escalera([2, 1, 2, 1, 1, 2, 1]),
    javascript: `function limpiar(bandeja) {
  for (const paso of bandeja) {
    if (paso === -1) {
      break;
    }
    if (paso === 0) {
      continue;
    }
    for (let p = 0; p < paso; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}

const bandejas = [[2, 0, 1], [2, 1], [0, 1, 2], [1, -1, 4]];
for (const bandeja of bandejas) {
  limpiar(bandeja);
}`,
    python: `def limpiar(bandeja):
    for paso in bandeja:
        if paso == -1:
            break
        if paso == 0:
            continue
        for p in range(paso):
            fuzz.avanzar()
        fuzz.girarDerecha()
        fuzz.avanzar()
        fuzz.girarIzquierda()

bandejas = [[2, 0, 1], [2, 1], [0, 1, 2], [1, -1, 4]]
for bandeja in bandejas:
    limpiar(bandeja)`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 23,
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
    exigeEstructuras: ['repetir', 'lista'],
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 135 : undefined,
  });
});

export const mundo23: WorldContentFile = {
  mundo: 23,
  slug: 'laboratorio-antivirus',
  nombre: 'El Laboratorio Antivirus',
  introTexto:
    'En el Laboratorio Antivirus todo se mide en listas, y aqui vas a aprender la forma de recorrerlas que no necesita indice. Es mas corta, se lee mejor y quita de golpe el error mas comun del mundo anterior: pasarse de rango. Pero no sirve siempre, y saber cuando no sirve es la mitad de la leccion. Ademas, la mitad de las muestras estan contaminadas, asi que hay que aprender a saltarse elementos y a cortar un bucle por dentro.',
  actividades,
};
