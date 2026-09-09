/**
 * Mundo 21: La Ciudad Ciberisométrica. Escribir en vez de arrastrar.
 *
 * Este es el mundo más delicado del currículo, y no por lo que enseña sino por lo
 * que quita. Hasta el 20, una pieza solo encaja donde puede encajar: el editor no
 * deja escribir un programa mal formado. Aquí un paréntesis olvidado ya es un
 * error, y un niño de diez años que se pelea con un punto y coma en su primera
 * hora abandona.
 *
 * Tres decisiones para que eso no pase:
 *
 *  1. El tablero es el de siempre. El Fuzz avanza y gira igual que en los
 *     Creadores, así que lo único nuevo es la forma de decirlo. Nada de estrenar
 *     mecánica y sintaxis a la vez.
 *  2. Todas las actividades traen código de arranque. Nunca hay un editor vacío:
 *     hay líneas escritas y un comentario que dice dónde escribir. El arranque va
 *     desapareciendo poco a poco a lo largo del mundo.
 *  3. Las primeras actividades son literalmente el programa del mundo 11 escrito
 *     en texto. El niño reconoce lo que hace y solo aprende a teclearlo.
 *
 * El mismo tablero se resuelve en JavaScript y en Python, y las dos soluciones se
 * escriben a mano. Traducir una a la otra automáticamente produciría código que
 * ningún humano escribiría, y aquí el objetivo es justo que el niño escriba.
 *
 * Progresión:
 *   1-4    una instrucción por línea. El punto y coma y los paréntesis.
 *   5-8    el bucle contado: for en JavaScript, for in range en Python.
 *   9-12   variables y cuentas.
 *   13-16  condicionales y el while.
 *   17-20  funciones propias, y la ciudad entera.
 */
import {
  actividadHacker,
  type ContextoHacker,
} from '../src/generadores-hackers.js';
import {
  andar,
  estrellaAqui,
  gira,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const API = ['avanzar', 'girarDerecha', 'girarIzquierda', 'puedeAvanzar', 'hayObstaculo'];

/** Un escalón: se anda `largo`, se baja uno y se sigue mirando al frente. */
function escalon(largo: number): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(1), gira('izquierda')];
}

function escalera(largos: readonly number[]): PasoCamino[] {
  return largos.flatMap(escalon);
}

/** Espiral que se abre, la forma segura cuando el programa usa sensores. */
function espiral(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
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

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La primera linea',
    instruccion:
      'Bienvenido a la Ciudad Ciberisometrica. Aqui se acabaron las piezas: ahora se escribe. Y fijate en una cosa antes de empezar: el tablero es el mismo de siempre, el Fuzz avanza y gira igual. Lo unico nuevo es como se lo dices. Escribe fuzz.avanzar() cuatro veces, una por linea.',
    exito:
      'Cuatro lineas. Cada una hace exactamente lo que hacia una pieza, y se lee igual de claro. El punto final de cada linea es el punto y coma en JavaScript, y en Python no hace falta.',
    pistas: [
      'Se escribe fuzz.avanzar() y en JavaScript se acaba con punto y coma.',
      'Una linea por paso: cuatro lineas.',
    ],
    camino: [andar(4)],
    javascript: `fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();`,
    python: `fuzz.avanzar()
fuzz.avanzar()
fuzz.avanzar()
fuzz.avanzar()`,
    arranqueJs: `// Escribe una linea por cada paso.
fuzz.avanzar();
`,
    arranquePy: `# Escribe una linea por cada paso.
fuzz.avanzar()
`,
  },
  {
    nombre: 'Girar escribiendo',
    instruccion:
      'El camino gira. La instruccion de girar se escribe igual que la de avanzar, cambiando el nombre: fuzz.girarDerecha().',
    exito: 'Girar y avanzar, escritos. Es el mismo programa del mundo 11 con otra ropa.',
    pistas: ['Tres avanzar, un girarDerecha, y tres avanzar mas.', 'Cuidado con las mayusculas: girarDerecha lleva la D grande.'],
    camino: [andar(3), gira('derecha'), andar(3)],
    javascript: `fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.avanzar();
fuzz.avanzar();`,
    python: `fuzz.avanzar()
fuzz.avanzar()
fuzz.avanzar()
fuzz.girarDerecha()
fuzz.avanzar()
fuzz.avanzar()
fuzz.avanzar()`,
    arranqueJs: `// Avanza hasta la esquina, gira, y sigue.
fuzz.avanzar();
`,
    arranquePy: `# Avanza hasta la esquina, gira, y sigue.
fuzz.avanzar()
`,
  },
  {
    nombre: 'Los dos giros',
    instruccion: 'Dos esquinas y hacia lados distintos. La otra instruccion es fuzz.girarIzquierda().',
    exito: 'Los dos giros escritos sin equivocarte en una letra. Eso es mas difficil que arrastrar y ya lo has hecho.',
    pistas: ['La primera esquina gira a la derecha y la segunda a la izquierda.', 'Cuenta los pasos de cada tramo.'],
    camino: [andar(2), gira('derecha'), andar(2), gira('izquierda'), andar(2)],
    javascript: `fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();`,
    python: `fuzz.avanzar()
fuzz.avanzar()
fuzz.girarDerecha()
fuzz.avanzar()
fuzz.avanzar()
fuzz.girarIzquierda()
fuzz.avanzar()
fuzz.avanzar()`,
    arranqueJs: `// Dos esquinas, y no van al mismo lado.
`,
    arranquePy: `# Dos esquinas, y no van al mismo lado.
`,
  },
  {
    nombre: 'El escalon escrito',
    instruccion:
      'Un escalon entero: andar, girar, bajar, girar. Ocho lineas y ni una pieza. Este es el ultimo que vas a escribir asi.',
    exito:
      'Ocho lineas para un escalon. Empieza a molestar, no? Manana esto son tres lineas.',
    pistas: ['El escalon es: avanzar tres veces, girar derecha, avanzar, girar izquierda.', 'Y luego el segundo escalon igual.'],
    camino: escalera([2, 2]),
    javascript: `fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();
fuzz.avanzar();
fuzz.avanzar();
fuzz.girarDerecha();
fuzz.avanzar();
fuzz.girarIzquierda();`,
    python: `fuzz.avanzar()
fuzz.avanzar()
fuzz.girarDerecha()
fuzz.avanzar()
fuzz.girarIzquierda()
fuzz.avanzar()
fuzz.avanzar()
fuzz.girarDerecha()
fuzz.avanzar()
fuzz.girarIzquierda()`,
    arranqueJs: `// Dos escalones. Escribelos enteros.
`,
    arranquePy: `# Dos escalones. Escribelos enteros.
`,
  },
  {
    nombre: 'El bucle escrito',
    instruccion:
      'Aqui esta el bucle. En JavaScript se escribe for con tres partes entre parentesis, y en Python se escribe for i in range. Los dos dicen lo mismo: haz esto tantas veces. Un pasillo de ocho casillas en tres lineas.',
    exito:
      'Tres lineas para ocho pasos. El bucle escrito hace exactamente lo mismo que la pieza de repetir, y ocupa lo mismo que dos avanzar.',
    pistas: [
      'En JavaScript el bucle empieza por for, con las tres partes entre parentesis: la i vale cero, la i es menor que ocho, y la i sube de uno en uno.',
      'En Python es mas corto: for i in range de ocho, y lo de dentro va con sangria.',
    ],
    camino: [andar(8)],
    javascript: `for (let i = 0; i < 8; i++) {
  fuzz.avanzar();
}`,
    python: `for i in range(8):
    fuzz.avanzar()`,
    arranqueJs: `// El pasillo mide ocho casillas.
for (let i = 0; i < 0; i++) {
  fuzz.avanzar();
}
`,
    arranquePy: `# El pasillo mide ocho casillas.
for i in range(0):
    fuzz.avanzar()
`,
  },
  {
    nombre: 'El bucle con el escalon dentro',
    instruccion: 'Cuatro escalones iguales. Mete el escalon entero dentro del bucle.',
    exito: 'Cuatro escalones en seis lineas. Sin el bucle habrian sido veinte.',
    pistas: ['El bucle se repite cuatro veces.', 'Dentro van las cuatro lineas del escalon.'],
    camino: escalera([2, 2, 2, 2]),
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
    arranqueJs: `// Cuatro escalones iguales.
for (let i = 0; i < 4; i++) {
  // escribe aqui el escalon
}
`,
    arranquePy: `# Cuatro escalones iguales.
for i in range(4):
    # escribe aqui el escalon
    pass
`,
  },
  {
    nombre: 'Un bucle dentro de otro',
    instruccion:
      'Los escalones miden cuatro casillas. Puedes escribir cuatro avanzar dentro, o poner otro bucle. Pon otro bucle: se anida igual que las piezas.',
    exito: 'Un bucle dentro de otro, escrito. La sangria es la que dice quien esta dentro de quien.',
    pistas: ['El bucle de dentro se repite cuatro veces y solo lleva avanzar.', 'Cuidado con la sangria en Python: es obligatoria.'],
    camino: escalera([4, 4, 4]),
    javascript: `for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 4; j++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for i in range(3):
    for j in range(4):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
    arranqueJs: `// Tres escalones de cuatro casillas.
for (let i = 0; i < 3; i++) {
  // el bucle de dentro va aqui
}
`,
    arranquePy: `# Tres escalones de cuatro casillas.
for i in range(3):
    # el bucle de dentro va aqui
    pass
`,
  },
  {
    nombre: 'Seis escalones',
    instruccion: 'Seis escalones de tres casillas. Ya sabes como.',
    exito: 'Seis escalones, ocho lineas. La ciudad es grande y tu programa no.',
    pistas: ['El de fuera se repite seis veces y el de dentro tres.', 'Comprueba con dos escalones antes de subir el numero.'],
    camino: escalera([3, 3, 3, 3, 3, 3]),
    javascript: `for (let i = 0; i < 6; i++) {
  for (let j = 0; j < 3; j++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for i in range(6):
    for j in range(3):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'La primera variable',
    instruccion:
      'Una variable escrita es un nombre, un igual y un valor. En JavaScript se pone let delante y en Python no se pone nada. Guarda el largo del tramo y usalo en el bucle.',
    exito:
      'Una variable escrita. Cambia el numero de arriba y cambia el programa entero: eso ya lo sabias, pero ahora se ve en una sola linea.',
    pistas: ['En JavaScript: let largo = 4;', 'Y en el bucle, en vez del cuatro, pon largo.'],
    camino: escalera([4, 4, 4]),
    javascript: `let largo = 4;
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < largo; j++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `largo = 4
for i in range(3):
    for j in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
    arranqueJs: `let largo = 0;
// Usa largo en el bucle de dentro.
`,
    arranquePy: `largo = 0
# Usa largo en el bucle de dentro.
`,
  },
  {
    nombre: 'La variable que crece',
    instruccion:
      'Los escalones crecen: uno, dos, tres, cuatro, cinco. Sumale uno a la variable al final de cada vuelta. Escrito es largo = largo + 1.',
    exito: 'Una variable que cambia mientras el programa corre, escrita en una linea. Es la del mundo 12 con otras letras.',
    pistas: ['La variable empieza en uno.', 'Al final de la vuelta: largo = largo + 1.'],
    camino: escalera([1, 2, 3, 4, 5]),
    javascript: `let largo = 1;
for (let i = 0; i < 5; i++) {
  for (let j = 0; j < largo; j++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
  largo = largo + 1;
}`,
    python: `largo = 1
for i in range(5):
    for j in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()
    largo = largo + 1`,
  },
  {
    nombre: 'La variable del bucle',
    instruccion:
      'Y ahora un truco que solo existe escribiendo: el bucle ya tiene una variable que va contando, la i. Si los escalones crecen de uno en uno, puedes usar la i directamente y ahorrarte la tuya.',
    exito:
      'La variable del bucle vale para contar y para medir. Los que arrastran piezas no tienen esto.',
    pistas: ['En la primera vuelta la i vale cero, asi que hace falta i mas uno.', 'Y ya no hace falta la variable de fuera.'],
    camino: escalera([1, 2, 3, 4, 5]),
    javascript: `for (let i = 0; i < 5; i++) {
  for (let j = 0; j < i + 1; j++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for i in range(5):
    for j in range(i + 1):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'Cristales de datos',
    instruccion: 'Cristales por los escalones. Pasa por encima de todos.',
    exito: 'Los cristales. En la Ciudad Ciberisometrica los llaman datos, y dicen que valen mas que el oro.',
    pistas: ['El programa es el de la variable del bucle.', 'Los cristales estan en el camino.'],
    camino: escalera([2, 3, 4, 5]).flatMap((paso, i) =>
      i % 4 === 0 ? [paso, estrellaAqui()] : [paso],
    ),
    javascript: `for (let i = 0; i < 4; i++) {
  for (let j = 0; j < i + 2; j++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}`,
    python: `for i in range(4):
    for j in range(i + 2):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()`,
  },
  {
    nombre: 'El si escrito',
    instruccion:
      'La condicion escrita es if con la pregunta entre parentesis. Aqui el Fuzz avanza si puede y gira si no puede: el else es la otra rama.',
    exito:
      'Un if con su else, escrito. Se lee casi igual que se dice, y por eso los programas se escriben en ingles.',
    pistas: [
      'En JavaScript la pregunta va entre parentesis detras de if, y la otra rama detras de else.',
      'En Python la pregunta va detras de if y acaba en dos puntos, y la otra rama es else con sus dos puntos.',
    ],
    camino: espiral(4),
    javascript: `for (let i = 0; i < 21; i++) {
  if (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  } else {
    fuzz.girarDerecha();
  }
}`,
    python: `for i in range(21):
    if fuzz.puedeAvanzar():
        fuzz.avanzar()
    else:
        fuzz.girarDerecha()`,
    arranqueJs: `// Si puede avanzar, avanza. Si no, gira.
for (let i = 0; i < 21; i++) {
  // el if va aqui
}
`,
    arranquePy: `# Si puede avanzar, avanza. Si no, gira.
for i in range(21):
    # el if va aqui
    pass
`,
  },
  {
    nombre: 'El while escrito',
    instruccion:
      'Y aqui esta el bucle sin numero del mundo 17, escrito: while con la pregunta entre parentesis. Mientras la respuesta sea verdad, repite.',
    exito:
      'Un while escrito. Igual que en los bloques, no hay ningun numero que contar, y eso sigue siendo lo mejor que sabes hacer.',
    pistas: [
      'En JavaScript se escribe while con la pregunta entre parentesis, y dentro va el avanzar.',
      'En Python es while con la pregunta y dos puntos, y el avanzar con sangria debajo.',
    ],
    camino: [andar(9)],
    javascript: `while (fuzz.puedeAvanzar()) {
  fuzz.avanzar();
}`,
    python: `while fuzz.puedeAvanzar():
    fuzz.avanzar()`,
  },
  {
    nombre: 'While y esquinas',
    instruccion: 'Cinco pasillos de largo desconocido. Un while para andar y un for para las esquinas.',
    exito: 'Un while dentro de un for. El de dentro no cuenta nada y el de fuera cuenta esquinas.',
    pistas: ['El while va dentro del for.', 'El for se repite tantas veces como pasillos hay.'],
    camino: espiral(5),
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
    nombre: 'Ocho pasillos',
    instruccion: 'Ocho pasillos. El mismo programa con otro numero.',
    exito: 'Ocho pasillos con cinco lineas. La ciudad entera cabe en la pantalla.',
    pistas: ['No cambies nada mas que el numero del for.', 'Cuenta los pasillos.'],
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
    nombre: 'La primera funcion',
    instruccion:
      'Una funcion escrita es la palabra function, un nombre, unos parentesis y las llaves. En Python es def y dos puntos. Dentro va lo de siempre, y luego se llama por su nombre.',
    exito:
      'Tu primera funcion escrita. Es el bloque propio del mundo 13, y ahora tiene el nombre que le has puesto tu en una linea de codigo.',
    pistas: [
      'En JavaScript se escribe function, el nombre, los parentesis vacios, y dentro lo que hace.',
      'En Python es def con el nombre y dos puntos. Y para usarla, se escribe su nombre con parentesis.',
    ],
    camino: espiral(6),
    javascript: `function tramo() {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}

for (let i = 0; i < 6; i++) {
  tramo();
}`,
    python: `def tramo():
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()

for i in range(6):
    tramo()`,
    arranqueJs: `function tramo() {
  // escribe aqui lo que hace un tramo
}

`,
    arranquePy: `def tramo():
    # escribe aqui lo que hace un tramo
    pass

`,
  },
  {
    nombre: 'La funcion con hueco',
    instruccion:
      'Los huecos de una funcion escrita van entre los parentesis, y se usan dentro como si fueran variables. Escribe una funcion escalon que reciba el largo.',
    exito:
      'Una funcion con parametro, escrita. Es el hueco del mundo 16, y en texto se ve mejor: el nombre del hueco esta ahi mismo, entre los parentesis.',
    pistas: [
      'El nombre del hueco va entre los parentesis al crear la funcion.',
      'Y al llamarla, entre los parentesis va el numero. Dentro, el bucle usa el hueco.',
    ],
    camino: escalera([2, 4, 1, 3]),
    javascript: `function escalon(largo) {
  for (let i = 0; i < largo; i++) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
  fuzz.avanzar();
  fuzz.girarIzquierda();
}

escalon(2);
escalon(4);
escalon(1);
escalon(3);`,
    python: `def escalon(largo):
    for i in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()

escalon(2)
escalon(4)
escalon(1)
escalon(3)`,
  },
  {
    nombre: 'La ciudad que se escribio sola',
    instruccion:
      'La Ciudad Ciberisometrica la construyeron los Fuzzes escribiendo, no arrastrando, y dicen que por eso es la mas grande. Aqui hay algo raro: un edificio que nadie recuerda haber escrito. Ve a verlo.',
    exito:
      'El edificio esta al final de la avenida y no tiene puerta. En la pared hay una linea de codigo grabada, y dice: mientras sea verdad, espera. Un bucle que espera para siempre, sin condicion de salida. Nadie sabe a que espera.',
    pistas: ['La funcion con hueco y siete llamadas.', 'Lee los largos del tablero en orden.'],
    camino: escalera([2, 1, 3, 2, 1, 2, 1]),
    javascript: `function escalon(largo) {
  for (let i = 0; i < largo; i++) {
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
escalon(2);
escalon(1);`,
    python: `def escalon(largo):
    for i in range(largo):
        fuzz.avanzar()
    fuzz.girarDerecha()
    fuzz.avanzar()
    fuzz.girarIzquierda()

escalon(2)
escalon(1)
escalon(3)
escalon(2)
escalon(1)
escalon(2)
escalon(1)`,
  },
  {
    nombre: 'Donde esta Byte',
    instruccion:
      'Ultimo de la ciudad. Byte esta al lado del edificio sin puerta, copiando la linea de codigo de la pared en un papel. Ve a por el. Nueve pasillos y ningun numero que medir.',
    exito:
      'Byte esta en casa, y ha traido el papel. Dice que el bucle de la pared no es un error: que alguien lo escribio a proposito para que algo esperara. Y que lo que espera lleva esperando desde la noche de la tormenta.',
    pistas: ['La funcion de tramo con el while dentro.', 'Nueve pasillos.'],
    camino: espiral(9),
    javascript: `function tramo() {
  while (fuzz.puedeAvanzar()) {
    fuzz.avanzar();
  }
  fuzz.girarDerecha();
}

for (let i = 0; i < 9; i++) {
  tramo();
}`,
    python: `def tramo():
    while fuzz.puedeAvanzar():
        fuzz.avanzar()
    fuzz.girarDerecha()

for i in range(9):
    tramo()`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 21,
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
    monedas: indice === 19 ? 125 : undefined,
  });
});

export const mundo21: WorldContentFile = {
  mundo: 21,
  slug: 'ciudad-ciberisometrica',
  nombre: 'La Ciudad Ciberisometrica',
  introTexto:
    'En la Ciudad Ciberisometrica se acabaron las piezas: aqui se escribe. Y hay una cosa que conviene mirar antes de empezar: el tablero es el mismo de siempre y el Fuzz avanza y gira igual. Lo unico nuevo es como se lo dices. Todo lo que sabias sigue valiendo, y lo vas a reconocer linea por linea: el bucle, la variable, la condicion y tu propio bloque, que aqui se llama funcion.',
  actividades,
};
