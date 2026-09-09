/**
 * Mundo 29: La Arena Cibersegura. El mismo programa, mejor escrito.
 *
 * Todos los mundos anteriores piden que el programa funcione. Este da por hecho que
 * funciona y pide que además esté bien, que es otra cosa y se mide de dos maneras
 * distintas que conviene no confundir:
 *
 *   Escribir menos. El programa entregado hace lo correcto con veinte líneas donde
 *   caben seis. Eso se mide con el límite de líneas de la tercera estrella.
 *
 *   Hacer menos. Un programa puede ser cortísimo de escribir y dar el triple de
 *   pasos de los necesarios. Eso se mide con el límite de acciones ejecutadas, que
 *   este es el primer mundo del currículo que lo usa.
 *
 * Las dos cosas tiran a veces en direcciones contrarias, y hay una actividad
 * dedicada a eso: la versión más corta de escribir da más pasos que la larga. No hay
 * una respuesta buena para siempre, y decirlo es parte de la lección.
 *
 * Cada actividad entrega en el editor un programa que ya funciona. El niño no
 * empieza de cero: empieza de algo que anda mal escrito, que es como se empieza casi
 * siempre en la vida real.
 *
 * Progresión:
 *   1-4    líneas repetidas que son un bucle.
 *   5-8    trozos repetidos que son una función.
 *   9-12   condiciones que sobran y nombres que faltan.
 *   13-16  hacer menos pasos: el mismo camino con menos acciones.
 *   17-20  las dos medidas a la vez, y cuando se contradicen.
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

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  /** El programa que ya funciona y esta mal escrito. */
  readonly entregado: string;
  /** La version a la que hay que llegar. */
  readonly javascript: string;
  readonly python?: string;
  /** Cuando la actividad se mide en pasos y no en lineas. */
  readonly maxInstrucciones?: number;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Ocho lineas iguales',
    instruccion:
      'En la Arena Cibersegura los programas no se puntuan por funcionar: se puntuan por como estan escritos. Este funciona. Mira las ocho lineas primeras y dime si hace falta que sean ocho.',
    exito:
      'Ocho lineas en tres. El programa hace exactamente lo mismo, y ahora se puede cambiar el ocho por un nueve sin anadir una linea.',
    pistas: ['Ocho lineas iguales son un bucle.', 'El numero del bucle es cuantas veces se repetia.'],
    camino: [andar(8)],
    entregado: `fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();`,
    javascript: `for (let i = 0; i < 8; i++) {
  fuzz.avanzar();
}`,
    python: `for i in range(8):
    fuzz.avanzar()`,
  },
  {
    nombre: 'El escalon repetido',
    instruccion: 'Este programa hace cuatro escalones y los escribe cuatro veces. Veinte lineas para cinco.',
    exito: 'Veinte lineas en seis. Y el escalon esta escrito una sola vez, asi que si cambia, cambia en un sitio.',
    pistas: ['El escalon son cinco lineas que se repiten cuatro veces.', 'Metelas en un bucle.'],
    camino: escalera([2, 2, 2, 2]),
    entregado: `fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();`,
    javascript: `for (let i = 0; i < 4; i++) {
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for i in range(4):
    fuzz.avanzar()
    fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Dos bucles que son uno',
    instruccion:
      'Este programa tiene dos bucles seguidos que hacen lo mismo con numeros distintos. Se pueden juntar en uno.',
    exito: 'Dos bucles en uno. Cuando dos bucles seguidos repiten lo mismo, la suma de sus numeros es el numero del bueno.',
    pistas: ['Los dos bucles llevan dentro exactamente lo mismo.', 'Suma sus numeros.'],
    camino: [andar(9)],
    entregado: `for (let i = 0; i < 4; i++) {
  fuzz.avanzar();
}
for (let i = 0; i < 5; i++) {
  fuzz.avanzar();
}`,
    javascript: `for (let i = 0; i < 9; i++) {
  fuzz.avanzar();
}`,
    python: `for i in range(9):
    fuzz.avanzar()`,
  },
  {
    nombre: 'El bucle dentro del bucle',
    instruccion:
      'Aqui el bucle repite cinco veces un trozo que ya tiene cuatro lineas de avanzar seguidas. Otro bucle dentro y quedan cuatro lineas.',
    exito: 'Un bucle dentro de otro. Cada vez que veas lineas iguales seguidas, ahi cabe un bucle.',
    pistas: ['Los cuatro avanzar seguidos son un bucle.', 'Y el bucle de fuera no cambia.'],
    camino: escalera([4, 4, 4, 4, 4]),
    entregado: `for (let i = 0; i < 5; i++) {
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    javascript: `for (let i = 0; i < 5; i++) {
  for (let p = 0; p < 4; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for i in range(5):
    for p in range(4):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'El trozo que no se repite seguido',
    instruccion:
      'Este programa hace el mismo escalon en tres sitios, pero no seguidos: entre ellos hay tramos distintos. Un bucle no vale aqui. Que vale?',
    exito:
      'Una funcion. Cuando lo repetido no esta seguido, un bucle no llega y una funcion si: la puedes llamar donde te haga falta.',
    pistas: ['Lo repetido va en una funcion.', 'Y entre las llamadas, lo que no se repite.'],
    camino: [...escalon(2), andar(3), ...escalon(2), andar(1), ...escalon(2)],
    entregado: `fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();`,
    javascript: `function escalon() {
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

escalon();
for (let i = 0; i < 3; i++) {
  fuzz.avanzar();
}
escalon();
fuzz.avanzar();
escalon();`,
    python: `def escalon():
    fuzz.avanzar()
    fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()

escalon()
for i in range(3):
    fuzz.avanzar()
escalon()
fuzz.avanzar()
escalon()`,
  },
  {
    nombre: 'Tres funciones que son una',
    instruccion:
      'Este programa tiene tres funciones que se parecen en todo menos en un numero. Con un parametro sobran dos.',
    exito:
      'Tres funciones en una con un hueco. Cuando dos funciones se parecen tanto, casi siempre falta un parametro.',
    pistas: ['Las tres funciones solo difieren en cuantas veces avanzan.', 'Ese numero pasa a ser un parametro.'],
    camino: escalera([2, 3, 4]),
    entregado: `function escalonDos() {
  for (let p = 0; p < 2; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

function escalonTres() {
  for (let p = 0; p < 3; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

function escalonCuatro() {
  for (let p = 0; p < 4; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

escalonDos();
escalonTres();
escalonCuatro();`,
    javascript: `function escalon(largo) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

escalon(2);
escalon(3);
escalon(4);`,
    python: `def escalon(largo):
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()

escalon(2)
escalon(3)
escalon(4)`,
  },
  {
    nombre: 'Los numeros en una lista',
    instruccion:
      'Seis llamadas a la misma funcion con seis numeros. Los numeros son datos: ponlos en una lista y recorrela.',
    exito: 'Seis llamadas en tres lineas. Y anadir un tramo ya no es anadir una linea de programa: es anadir un numero.',
    pistas: ['Los seis numeros van en una lista.', 'Y un bucle sin indice llama a la funcion con cada uno.'],
    camino: escalera([2, 1, 3, 2, 1, 2]),
    entregado: `function escalon(largo) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

escalon(2);
escalon(1);
escalon(3);
escalon(2);
escalon(1);
escalon(2);`,
    javascript: `function escalon(largo) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

for (const largo of [2, 1, 3, 2, 1, 2]) {
  escalon(largo);
}`,
    python: `def escalon(largo):
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()

for largo in [2, 1, 3, 2, 1, 2]:
    escalon(largo)`,
  },
  {
    nombre: 'Trofeos de la arena',
    instruccion: 'Hay trofeos por el camino. Pasa por encima de todos, y con el programa bien escrito.',
    exito: 'Los trofeos. En la arena se los dan a quien escribe mas corto, no a quien llega antes.',
    pistas: ['La funcion con parametro y la lista.', 'Los trofeos estan en el camino.'],
    camino: escalera([2, 3, 2]).flatMap((paso, i) => (i % 4 === 0 ? [paso, estrellaAqui()] : [paso])),
    entregado: `function escalonDos() {
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

escalonDos();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
escalonDos();`,
    javascript: `function escalon(largo) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

for (const largo of [2, 3, 2]) {
  escalon(largo);
}`,
    python: `def escalon(largo):
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()

for largo in [2, 3, 2]:
    escalon(largo)`,
  },
  {
    nombre: 'La condicion que sobra',
    instruccion:
      'Este programa pregunta dos veces lo mismo, una en el if y otra en el else. La segunda pregunta ya tiene respuesta.',
    exito:
      'Una condicion que sobra. Si la primera pregunta ya dijo que no, preguntar lo contrario no anade nada: eso es el else.',
    pistas: ['El segundo if pregunta justo lo contrario del primero.', 'Ese caso ya es el else del primero.'],
    camino: espiral(4),
    entregado: `for (let i = 0; i < ${casillas(4) + 3}; i++) {
  if (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  if (fuzz.puedeAvanzar() === false) {
    fuzz.girarDerecha();
  }
}`,
    javascript: `for (let i = 0; i < ${casillas(4) + 3}; i++) {
  if (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  } else {
    fuzz.girarDerecha();
  }
}`,
    python: `for i in range(${casillas(4) + 3}):
    if fuzz.puedeAvanzar():
        fuzz.avanzar()
    else:
        fuzz.girarDerecha()`,
  },
  {
    nombre: 'El numero sin nombre',
    instruccion:
      'Este programa tiene el mismo numero escrito en cuatro sitios y nadie sabe que significa. Ponle un nombre.',
    exito:
      'Un numero con nombre. Ahora se puede cambiar en un sitio, y ademas el programa dice lo que ese numero era.',
    pistas: ['El cuatro esta en cuatro sitios.', 'Dale un nombre y usalo en los cuatro.'],
    camino: escalera([4, 4, 4, 4]),
    entregado: `for (let i = 0; i < 4; i++) {
  for (let p = 0; p < 4; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    javascript: `const largo = 4;
const tramos = 4;
for (let i = 0; i < tramos; i++) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `largo = 4
tramos = 4
for i in range(tramos):
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Salir antes en vez de anidar',
    instruccion:
      'Este programa mete todo dentro de un if y queda un escalon de sangria por cada condicion. Se puede dar la vuelta: si el caso raro se atiende y se sale, lo demas queda plano.',
    exito:
      'Salir antes en vez de anidar. El programa hace lo mismo y se lee de arriba abajo sin ir contando llaves.',
    pistas: ['Si el paso es cero, sal de la vuelta con continue.', 'Y lo demas se queda sin sangria de mas.'],
    camino: escalera([2, 3, 1]),
    entregado: `for (const largo of [2, 0, 3, 0, 1]) {
  if (largo > 0) {
    for (let p = 0; p < largo; p++) {
      fuzz.avanzar();
    }
    fuzz.girarDerecha();
    fuzz.avanzar();
    fuzz.girarIzquierda();
  }
}`,
    javascript: `for (const largo of [2, 0, 3, 0, 1]) {
  if (largo === 0) {
    continue;
  }
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for largo in [2, 0, 3, 0, 1]:
    if largo == 0:
        continue
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Contar sin contar',
    instruccion:
      'Este programa cuenta las casillas de cada pasillo para saber cuanto avanzar, y ya sabes que hay una forma de no contar nada.',
    exito:
      'El bucle sin numero. Es mas corto y ademas seguiria funcionando si alguien cambiara el tablero, que es la clase de programa que se busca.',
    pistas: ['Mientras puedas avanzar, avanza.', 'El numero de fuera cuenta esquinas, no casillas.'],
    camino: espiral(5),
    entregado: `for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 4; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 5; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 6; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 7; p++) {
  fuzz.avanzar();
}`,
    javascript: `for (let i = 0; i < 5; i++) {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}`,
    python: `for i in range(5):
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()`,
  },
  {
    nombre: 'Girar tres veces para nada',
    instruccion:
      'Este programa funciona y da vueltas de mas: gira tres veces a la derecha donde bastaba una a la izquierda. Aqui no se mide lo que escribes: se mide lo que hace el Fuzz.',
    exito:
      'Nueve giros menos. Un programa puede ser corto de escribir y hacer el triple de trabajo, y esta es la primera vez que eso te cuesta la estrella.',
    pistas: ['Tres giros a la derecha son uno a la izquierda.', 'La estrella mide los pasos, no las lineas.'],
    camino: [andar(3), gira('izquierda'), andar(3), gira('izquierda'), andar(3)],
    entregado: `for (let i = 0; i < 2; i++) {
  for (let p = 0; p < 3; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.girarDerecha();
  fuzz.girarDerecha();
}
for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}`,
    javascript: `for (let i = 0; i < 2; i++) {
  for (let p = 0; p < 3; p++) {
    fuzz.avanzar();
  }
  fuzz.girarIzquierda();
}
for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}`,
    python: `for i in range(2):
    for p in range(3):
        fuzz.avanzar()
    fuzz.girarIzquierda()
for p in range(3):
    fuzz.avanzar()`,
    maxInstrucciones: 11,
  },
  {
    nombre: 'Preguntar de mas',
    instruccion:
      'Este programa pregunta si puede avanzar dos veces por cada paso, y preguntar tambien cuesta. Pregunta una sola vez.',
    exito:
      'La mitad de preguntas. Cada llamada al sensor es trabajo, y en un robot de verdad es bateria.',
    pistas: ['Guarda la respuesta en una variable y usala dos veces.', 'O reordena el programa para preguntar una sola vez.'],
    camino: espiral(4),
    entregado: `for (let i = 0; i < ${casillas(4) + 3}; i++) {
  if (fuzz.puedeAvanzar() === true) {
    fuzz.avanzar();
  }
  if (fuzz.puedeAvanzar() === false) {
    fuzz.girarDerecha();
  }
}`,
    javascript: `for (let i = 0; i < ${casillas(4) + 3}; i++) {
  if (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  } else {
    fuzz.girarDerecha();
  }
}`,
    python: `for i in range(${casillas(4) + 3}):
    if fuzz.puedeAvanzar():
        fuzz.avanzar()
    else:
        fuzz.girarDerecha()`,
  },
  {
    nombre: 'Ir y volver',
    instruccion:
      'Este programa llega a la meta despues de darse un paseo que no hacia falta: entra en un pasillo, vuelve, y sigue. Ve derecho.',
    exito: 'Sin el paseo. El camino corto y el camino que funciona no son el mismo camino.',
    pistas: ['El programa entra y sale de un tramo sin motivo.', 'Quitalo y sigue derecho.'],
    camino: [andar(4), gira('derecha'), andar(3)],
    entregado: `for (let p = 0; p < 4; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
fuzz.girarDerecha();
fuzz.girarDerecha();
fuzz.girarDerecha();
for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}`,
    javascript: `for (let p = 0; p < 4; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}`,
    python: `for p in range(4):
    fuzz.avanzar()
fuzz.girarDerecha()
for p in range(3):
    fuzz.avanzar()`,
    maxInstrucciones: 8,
  },
  {
    nombre: 'La burbuja que sabe parar',
    instruccion:
      'Este programa ordena bien y da todas las pasadas aunque la lista ya este ordenada. Que pare cuando no haya cambiado nada.',
    exito:
      'Parar cuando ya esta ordenado. El algoritmo es el mismo y en una lista casi ordenada hace una decima parte del trabajo.',
    pistas: ['Una variable que dice si hubo algun cambio en la pasada.', 'Si no hubo ninguno, sal del bucle.'],
    camino: escalera([1, 2, 3, 4]),
    entregado: `const ruta = [1, 2, 4, 3];
for (let vuelta = 0; vuelta < ruta.length; vuelta++) {
  for (let i = 0; i < ruta.length - 1; i++) {
    if (ruta[i] > ruta[i + 1]) {
      const auxiliar = ruta[i];
      ruta[i] = ruta[i + 1];
      ruta[i + 1] = auxiliar;
    }
  }
}
for (const paso of ruta) {
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    javascript: `const ruta = [1, 2, 4, 3];
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
for (const paso of ruta) {
  for (let p = 0; p < paso; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
  },
  {
    nombre: 'Cuando lo corto hace mas',
    instruccion:
      'Atencion a este, que es el mas interesante del mundo. El programa entregado es largo de escribir y da los pasos justos. Hay una version de tres lineas que da bastantes mas pasos. Aqui la estrella mide los pasos, asi que la version corta no vale. No siempre gana lo corto.',
    exito:
      'Escribir menos y hacer menos son dos cosas distintas y a veces tiran en direcciones contrarias. Cual importa depende de para que sea el programa, y eso no lo decide una regla: lo decides tu.',
    pistas: [
      'La version corta con el sensor gasta un giro fallido en cada esquina.',
      'Aqui hay que escribir los tramos con sus numeros para no gastar pasos.',
    ],
    camino: espiral(4),
    entregado: `for (let i = 0; i < ${casillas(4) + 3}; i++) {
  if (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  } else {
    fuzz.girarDerecha();
  }
}`,
    javascript: `const tramos = [3, 4, 5, 6];
for (let i = 0; i < tramos.length; i++) {
  for (let p = 0; p < tramos[i]; p++) {
    fuzz.avanzar();
  }
  if (i < tramos.length - 1) {
    fuzz.girarDerecha();
  }
}`,
    python: `tramos = [3, 4, 5, 6]
for i in range(len(tramos)):
    for p in range(tramos[i]):
        fuzz.avanzar()
    if i < len(tramos) - 1:
        fuzz.girarDerecha()`,
    maxInstrucciones: casillas(4) + 3,
  },
  {
    nombre: 'Las dos medidas a la vez',
    instruccion:
      'Y ahora las dos: corto de escribir Y corto de ejecutar. Hay una version que cumple las dos, y hay que pensarla.',
    exito:
      'Las dos medidas cumplidas. Cuando se puede, se puede; y cuando no, hay que elegir sabiendo lo que se pierde.',
    pistas: ['La lista de tramos y el bucle sin indice.', 'El giro va dentro del bucle salvo en el ultimo tramo.'],
    camino: escalera([2, 3, 2, 3]),
    entregado: `fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();`,
    javascript: `for (const largo of [2, 3, 2, 3]) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for largo in [2, 3, 2, 3]:
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
    maxInstrucciones: 22,
  },
  {
    nombre: 'El programa de la arena',
    instruccion:
      'Arena guarda los programas que han ganado en esta arena, y dice que hay uno que gano hace mucho y que nadie ha conseguido mejorar. Mejoralo tu y te lo ensena.',
    exito:
      'El programa que nadie habia mejorado tiene una firma al final, en un comentario: un circulo con tres rayas. La misma marca de la placa de Garfio, del laberinto de Dedalo y de la puerta del Titan.',
    pistas: ['La funcion con parametro y la lista de largos.', 'Y el bucle sin indice.'],
    camino: escalera([2, 1, 3, 2, 1, 2, 1]),
    entregado: `function escalonDos() {
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

function escalonUno() {
  fuzz.avanzar();
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

function escalonTres() {
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.avanzar();
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

escalonDos();
escalonUno();
escalonTres();
escalonDos();
escalonUno();
escalonDos();
escalonUno();`,
    javascript: `function escalon(largo) {
  for (let p = 0; p < largo; p++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

for (const largo of [2, 1, 3, 2, 1, 2, 1]) {
  escalon(largo);
}`,
    python: `def escalon(largo):
    for p in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()

for largo in [2, 1, 3, 2, 1, 2, 1]:
    escalon(largo)`,
  },
  {
    nombre: 'Donde esta Arena',
    instruccion:
      'Ultimo de la arena. Arena esta en la sala de los programas ganadores, con el que tiene la firma abierto en la pantalla. Ve a por ella con el programa mas corto que sepas escribir.',
    exito:
      'Arena esta en casa, y ha traido el programa firmado. Dice que la firma es de un Fuzz que ya no esta, y que nadie se acuerda de su nombre. Manana es el Nucleo.',
    pistas: [
      'El bucle sin numero para los pasillos y un for para las esquinas.',
      'Nueve esquinas.',
    ],
    camino: espiral(9),
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
    entregado: `for (let p = 0; p < 3; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 4; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 5; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 6; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 7; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 8; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 9; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 10; p++) {
  fuzz.avanzar();
}
fuzz.girarDerecha();
for (let p = 0; p < 11; p++) {
  fuzz.avanzar();
}`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 29,
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
    // El programa que ya funciona y esta mal escrito llega en el editor: aqui no
    // se empieza de cero, se empieza de algo que anda mal hecho.
    arranque: {
      javascript: receta.entregado,
      ...(receta.python ? { python: receta.entregado } : {}),
    },
    ...(receta.maxInstrucciones ? { maxInstrucciones: receta.maxInstrucciones } : {}),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 165 : undefined,
  });
});

export const mundo29: WorldContentFile = {
  mundo: 29,
  slug: 'arena-cibersegura',
  nombre: 'La Arena Cibersegura',
  introTexto:
    'En la Arena Cibersegura los programas no se puntuan por funcionar: eso se da por hecho. Se puntuan por como estan escritos. Cada actividad te entrega un programa que ya anda y esta mal hecho, y hay que dejarlo bien. Y hay dos formas de estar bien que no son la misma: escribir menos lineas y hacer menos pasos. A veces tiran en direcciones contrarias, y entonces hay que elegir sabiendo lo que se pierde.',
  actividades,
};
