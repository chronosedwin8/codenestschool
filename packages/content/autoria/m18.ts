/**
 * Mundo 18: El Archipiélago Volcánico. La ruta escrita en una lista.
 *
 * Una lista es la primera estructura de datos del currículo, y como todas las
 * ideas de este grupo, cuesta piezas antes de ahorrarlas. Escribir la ruta en una
 * lista y recorrerla con un índice son unas veinte piezas; escribir cuatro tramos
 * a mano son veinticuatro. A partir de seis tramos la lista gana, y a partir de
 * diez gana por mucho, así que este mundo empieza con rutas de seis.
 *
 * Pero el motivo de verdad no es ahorrar. Es que el camino deja de estar en el
 * programa y pasa a estar en los datos: el mismo programa recorre cualquier ruta,
 * y cambiar la ruta es cambiar una lista de números sin tocar una sola pieza de la
 * lógica. Los textos dicen esto sin rodeos, porque es la idea entera del mundo.
 *
 * Dos detalles de implementación que se notan al jugar:
 *
 *   Blockly cuenta los elementos de una lista desde uno, no desde cero. Es una
 *   decisión suya y para un niño de nueve años es la correcta.
 *
 *   La geometría es de escalera y no de espiral, porque los largos de la ruta son
 *   arbitrarios: una espiral con tramos de largo cualquiera se cruza consigo misma
 *   y el tablero queda roto. La escalera siempre progresa.
 *
 * Progresión:
 *   1-4    la lista y el índice. Leer el primer número, el segundo, el tercero.
 *   5-8    el bucle recorre la lista entera usando su longitud.
 *   9-12   rutas largas: el mismo programa con otra lista.
 *   13-16  dos listas a la vez, y una lista con un bloque propio.
 *   17-20  la ruta de Lava.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  define,
  elemento,
  estrellaAqui,
  gira,
  girarDerecha,
  girarIzquierda,
  lista,
  longitud,
  num,
  pon,
  repetir,
  suma,
  usa,
  vble,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const BLOQUES = [
  'avanzar',
  'girarDerecha',
  'girarIzquierda',
  'repetir',
  'variable',
  'lista',
  'funcion',
];

/** Un escalón de la escalera: se anda `largo`, se baja `bajada`, y se sigue igual. */
function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

function escalera(ruta: readonly number[], bajadas?: readonly number[]): PasoCamino[] {
  return ruta.flatMap((largo, i) => escalon(largo, bajadas?.[i] ?? 1));
}

/** Las piezas de un escalón, para escribirlo a mano. */
function escalonSuelto(largo: number): Bloque[] {
  return [repetir(largo, avanzar()), girarDerecha(), avanzar(), girarIzquierda()];
}

/**
 * El programa que recorre una ruta guardada en una lista.
 *
 * `pasos` es el índice, y empieza en uno porque Blockly numera las listas desde
 * uno. El bucle no lleva un número escrito: lleva la longitud de la lista, así que
 * añadir una isla a la ruta no obliga a tocar nada más.
 */
function programaDeLista(ruta: readonly number[]): Bloque[] {
  return [
    pon('ruta', lista(...ruta.map((largo) => num(largo)))),
    pon('i', num(1)),
    repetir(
      longitud(vble('ruta')),
      repetir(elemento(vble('ruta'), vble('i')), avanzar()),
      girarDerecha(),
      avanzar(),
      girarIzquierda(),
      suma('i', num(1)),
    ),
  ];
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly ruta: readonly number[];
  readonly como: 'mano' | 'lista' | ((ruta: readonly number[]) => Bloque[]);
  readonly bajadas?: readonly number[];
  readonly premios?: boolean;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Cuatro islas a mano',
    instruccion:
      'Lava se acuerda de todos los caminos del archipielago y dice que no necesita mapa. Estas cuatro islas estan a dos, cuatro, uno y tres casillas. Escribe los cuatro tramos a mano, una ultima vez.',
    exito:
      'Veinticuatro piezas para cuatro numeros. Fijate en cuanto de tu programa es logica y cuanto son solo los numeros de la ruta.',
    pistas: ['Cada isla es un escalon: andar, girar, bajar, girar.', 'Los largos son dos, cuatro, uno y tres.'],
    ruta: [2, 4, 1, 3],
    como: (ruta) => ruta.flatMap(escalonSuelto),
  },
  {
    nombre: 'La lista de la ruta',
    instruccion:
      'Mira la categoria de listas. Puedes guardar varios numeros en una sola caja, en orden. Guarda ahi los cuatro largos de la ruta. Todavia no la vamos a recorrer: solo guardarla y sacar el primero.',
    exito:
      'La ruta esta guardada en un sitio y la logica en otro. Eso es lo que va a cambiarlo todo en el proximo nivel.',
    pistas: [
      'Crea la lista con los cuatro numeros dentro.',
      'Para sacar un numero de la lista se usa el bloque de coger el elemento, y el primero es el uno.',
    ],
    ruta: [2, 4, 1, 3],
    como: (ruta) => [
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      repetir(elemento(vble('ruta'), num(1)), avanzar()),
      girarDerecha(),
      avanzar(),
      girarIzquierda(),
      repetir(elemento(vble('ruta'), num(2)), avanzar()),
      girarDerecha(),
      avanzar(),
      girarIzquierda(),
      repetir(elemento(vble('ruta'), num(3)), avanzar()),
      girarDerecha(),
      avanzar(),
      girarIzquierda(),
      repetir(elemento(vble('ruta'), num(4)), avanzar()),
      girarDerecha(),
      avanzar(),
      girarIzquierda(),
    ],
  },
  {
    nombre: 'El indice que avanza',
    instruccion:
      'En vez de escribir uno, dos, tres y cuatro a mano, usa una caja que valga uno y sumale uno en cada vuelta. Asi el bucle saca cada vez el siguiente numero de la lista.',
    exito:
      'Un bucle, una lista y un indice. El programa ya no sabe cuanto mide cada isla: se lo dice la lista.',
    pistas: [
      'Crea una caja que se llame i y que valga uno.',
      'Dentro del bucle, saca el elemento numero i, y al final sumale uno a i.',
    ],
    ruta: [2, 4, 1, 3],
    como: (ruta) => [
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon('i', num(1)),
      repetir(
        ruta.length,
        repetir(elemento(vble('ruta'), vble('i')), avanzar()),
        girarDerecha(),
        avanzar(),
        girarIzquierda(),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Cuantas islas hay',
    instruccion:
      'Todavia hay un cuatro escrito a mano: el numero de vueltas. Cambialo por el bloque que dice cuantos elementos tiene la lista. Asi si manana la ruta tiene seis islas, no hay que tocar nada.',
    exito:
      'Ni un numero escrito a mano en toda la logica. La ruta manda del todo, y el programa se adapta.',
    pistas: [
      'El bloque de longitud de lista va en el hueco del numero del bucle.',
      'Todo lo demas se queda igual.',
    ],
    ruta: [2, 4, 1, 3],
    como: 'lista',
  },
  {
    nombre: 'Seis islas',
    instruccion:
      'Y ahora la prueba: la misma logica con seis islas. Solo tienes que anadir dos numeros a la lista.',
    exito:
      'Dos numeros mas en la lista y ni una pieza de logica tocada. Aqui la lista ya ha empezado a ahorrar.',
    pistas: ['El programa es el mismo del nivel anterior.', 'Solo cambia la lista: seis numeros.'],
    ruta: [2, 3, 1, 4, 2, 3],
    como: 'lista',
  },
  {
    nombre: 'Ocho islas',
    instruccion: 'Ocho islas. Escrito a mano serian cuarenta y ocho piezas.',
    exito: 'Ocho islas y el mismo programa. Escrito a mano habrian sido cuarenta y ocho piezas.',
    pistas: ['Lee los ocho largos del tablero.', 'La logica no cambia.'],
    ruta: [1, 3, 2, 1, 3, 2, 1, 2],
    como: 'lista',
  },
  {
    nombre: 'Islas con gemas',
    instruccion: 'Lava ha dejado piedras de lava al final de tres islas. Pasa por todas.',
    exito: 'Las tres piedras. Lava dice que aun estan calientes y que las guarda de recuerdo.',
    pistas: ['El programa de la lista.', 'Las piedras estan en el camino.'],
    ruta: [2, 3, 1, 3, 2],
    como: 'lista',
    premios: true,
  },
  {
    nombre: 'La ruta al reves',
    instruccion:
      'La misma logica, pero la lista lleva los numeros en otro orden. Es un camino distinto sin cambiar una pieza.',
    exito:
      'Otro camino con el mismo programa. Cuando el camino esta en los datos, cambiar de camino es cambiar de datos.',
    pistas: ['Copia el programa del nivel anterior.', 'Y lee la lista de este tablero.'],
    ruta: [3, 1, 4, 2, 1, 3],
    como: 'lista',
  },
  {
    nombre: 'Diez islas',
    instruccion: 'Diez islas. Es el archipielago entero de una tirada.',
    exito: 'Diez islas con veinte piezas. Escrito a mano, sesenta.',
    pistas: ['Ve leyendo los largos en orden.', 'Comprueba a mitad de la lista.'],
    ruta: [1, 2, 1, 3, 2, 1, 2, 1, 3, 2],
    como: 'lista',
  },
  {
    nombre: 'Una isla de una casilla',
    instruccion: 'Cuidado con las islas de una sola casilla: son faciles de saltar al leer.',
    exito: 'Los unos tambien cuentan. Una lista no perdona un numero olvidado.',
    pistas: ['Hay cuatro islas de una casilla.', 'Cuentalas dos veces antes de escribir la lista.'],
    ruta: [1, 2, 1, 1, 3, 1, 2],
    como: 'lista',
  },
  {
    nombre: 'Dos listas',
    instruccion:
      'Ahora las bajadas tampoco son todas iguales. Necesitas dos listas: una para lo que se anda y otra para lo que se baja, y el mismo indice sirve para las dos.',
    exito:
      'Dos listas y un indice. El mismo numero de vuelta saca el dato correcto de las dos, y por eso el orden de las listas importa tanto.',
    pistas: [
      'Crea dos listas: ruta y bajadas.',
      'Dentro del bucle, saca el elemento i de las dos.',
    ],
    ruta: [3, 2, 4, 1, 3],
    bajadas: [1, 2, 1, 2, 1],
    como: (ruta) => [
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon('bajadas', lista(num(1), num(2), num(1), num(2), num(1))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        repetir(elemento(vble('ruta'), vble('i')), avanzar()),
        girarDerecha(),
        repetir(elemento(vble('bajadas'), vble('i')), avanzar()),
        girarIzquierda(),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Dos listas mas largas',
    instruccion: 'Las dos listas con siete numeros cada una. Leelas con cuidado, columna a columna.',
    exito: 'Siete islas con dos datos cada una. Lava dice que ella se lo acuerda todo asi, en dos listas.',
    pistas: ['Primero escribe la lista de los largos entera.', 'Y luego la de las bajadas, mirando el tablero otra vez.'],
    ruta: [2, 1, 3, 2, 1, 2, 1],
    bajadas: [1, 2, 1, 1, 2, 1, 2],
    como: (ruta) => [
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon('bajadas', lista(num(1), num(2), num(1), num(1), num(2), num(1), num(2))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        repetir(elemento(vble('ruta'), vble('i')), avanzar()),
        girarDerecha(),
        repetir(elemento(vble('bajadas'), vble('i')), avanzar()),
        girarIzquierda(),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'La lista y el bloque con hueco',
    instruccion:
      'Junta las dos ideas de la semana: un bloque propio con un hueco, y una lista que le va pasando los numeros. El bloque no sabe que existe una lista.',
    exito:
      'La lista da los numeros y el bloque hace el trabajo. Ninguno de los dos sabe nada del otro, y eso es exactamente lo que se busca.',
    pistas: [
      'El bloque tiene un hueco y hace el escalon entero.',
      'Dentro del bucle, llamalo pasandole el elemento i de la lista.',
    ],
    ruta: [2, 3, 1, 4, 2, 3],
    como: (ruta) => [
      define(
        'isla',
        [repetir(vble('largo'), avanzar()), girarDerecha(), avanzar(), girarIzquierda()],
        ['largo'],
      ),
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Nueve islas con bloque',
    instruccion: 'La misma pareja de ideas con nueve islas. El programa mas corto del mundo.',
    exito: 'Nueve islas con dieciseis piezas. Ni el bloque ni el bucle saben cuantas islas hay.',
    pistas: ['El bloque con hueco no cambia.', 'Solo crece la lista.'],
    ruta: [1, 2, 1, 3, 1, 2, 1, 2, 1],
    como: (ruta) => [
      define(
        'isla',
        [repetir(vble('largo'), avanzar()), girarDerecha(), avanzar(), girarIzquierda()],
        ['largo'],
      ),
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Sumar dos de la lista',
    instruccion:
      'Aqui cada isla mide lo que dice la lista MAS uno, porque el mar ha subido. No hace falta cambiar la lista: se le suma uno al sacarlo.',
    exito:
      'Una cuenta sobre un dato de la lista. Los datos no se tocan; lo que cambia es lo que se hace con ellos.',
    pistas: [
      'Saca el elemento i y sumale uno antes de meterlo en el bucle.',
      'La lista se queda tal cual.',
    ],
    ruta: [2, 3, 2, 4, 3],
    como: (ruta) => [
      pon('ruta', lista(...ruta.map((largo) => num(largo - 1)))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        repetir({ aritmetica: '+', a: elemento(vble('ruta'), vble('i')), b: num(1) }, avanzar()),
        girarDerecha(),
        avanzar(),
        girarIzquierda(),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Doce islas',
    instruccion: 'Doce islas. El archipielago completo, de norte a sur.',
    exito: 'Doce islas. Lava dice que este es el camino que hacia todos los dias antes de la tormenta.',
    pistas: ['Ve de cuatro en cuatro comprobando.', 'Un numero mal deja al Fuzz en el agua.'],
    ruta: [1, 2, 1, 2, 1, 3, 1, 2, 1, 2, 1, 2],
    como: 'lista',
  },
  {
    nombre: 'La isla que no estaba',
    instruccion:
      'Lava dice que en su ruta hay una isla que ella no recuerda. Que se la sabe de memoria desde siempre y que esa no estaba. Ve a verla.',
    exito:
      'La isla nueva es pequena y esta redonda, y en el centro tiene un hueco. Lava dice que las islas de aqui las hace el volcan y salen picudas. Esta no la ha hecho el volcan. Algo cayo.',
    pistas: ['El programa de la lista.', 'Son ocho islas y una de ellas es la nueva.'],
    ruta: [2, 1, 3, 1, 2, 1, 3, 1],
    como: 'lista',
    premios: true,
  },
  {
    nombre: 'La ruta larga',
    instruccion:
      'La ruta entera de Lava, con las bajadas distintas y el bloque con hueco. Todo lo del mundo junto.',
    exito: 'La ruta entera. Lava ha dicho que se la vas a tener que ensenar a los demas.',
    pistas: [
      'Dos listas y un bloque con dos huecos.',
      'El mismo indice saca el dato de las dos listas.',
    ],
    ruta: [2, 1, 3, 1, 2, 2, 1],
    bajadas: [1, 2, 1, 2, 1, 1, 2],
    como: (ruta) => [
      define(
        'isla',
        [
          repetir(vble('largo'), avanzar()),
          girarDerecha(),
          repetir(vble('bajada'), avanzar()),
          girarIzquierda(),
        ],
        ['largo', 'bajada'],
      ),
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon('bajadas', lista(num(1), num(2), num(1), num(2), num(1), num(1), num(2))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i')), elemento(vble('bajadas'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'El mapa que no hace falta',
    instruccion:
      'Lava nunca ha usado un mapa porque se acuerda de todo. Y hoy vas a hacer lo mismo que hace ella: guardar la ruta en una lista y dejar que el programa la lea. Diez islas.',
    exito:
      'La ruta de Lava, guardada. Ella dice que no le hace falta escribirla, pero se ha quedado mirando la lista un rato largo.',
    pistas: ['El programa de la lista con el bloque de hueco.', 'Diez numeros.'],
    ruta: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
    como: (ruta) => [
      define(
        'isla',
        [repetir(vble('largo'), avanzar()), girarDerecha(), avanzar(), girarIzquierda()],
        ['largo'],
      ),
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Donde esta Lava',
    instruccion:
      'Ultimo del archipielago. Lava esta en la isla nueva, la redonda, sentada en el borde del hueco del centro. Ve a por ella. La ruta tiene once islas y dos listas.',
    exito:
      'Lava esta en casa, y ha traido un puñado de arena de la isla nueva. La arena tiene trocitos de metal. En el Nido ya hay un cristal, una libreta, un tablon, una antorcha, un mapa, una bateria, un trozo de hielo y ahora arena con metal. Manana empiezan los Hackers, y en el mundo treinta esta el Nucleo.',
    pistas: [
      'Dos listas, un indice y el bloque de dos huecos.',
      'Once islas: cuenta la lista dos veces antes de jugar.',
    ],
    ruta: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
    bajadas: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
    como: (ruta) => [
      define(
        'isla',
        [
          repetir(vble('largo'), avanzar()),
          girarDerecha(),
          repetir(vble('bajada'), avanzar()),
          girarIzquierda(),
        ],
        ['largo', 'bajada'],
      ),
      pon('ruta', lista(...ruta.map((largo) => num(largo)))),
      pon(
        'bajadas',
        lista(num(1), num(2), num(1), num(2), num(1), num(2), num(1), num(2), num(1), num(2), num(1)),
      ),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i')), elemento(vble('bajadas'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 18,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  let camino = escalera(receta.ruta, receta.bajadas);
  if (receta.premios) {
    camino = receta.ruta.flatMap((largo, i) => {
      const bajada = receta.bajadas?.[i] ?? 1;
      const trozo = escalon(largo, bajada);
      // La piedra de lava, al final del tramo recto de cada isla.
      return [trozo[0]!, estrellaAqui(), ...trozo.slice(1)];
    });
  }

  return actividadCreador(contexto, {
    camino,
    bloques: BLOQUES,
    solucion:
      typeof receta.como === 'function' ? receta.como(receta.ruta) : programaDeLista(receta.ruta),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 115 : undefined,
  });
});

export const mundo18: WorldContentFile = {
  mundo: 18,
  slug: 'archipielago-volcanico',
  nombre: 'El Archipielago Volcanico',
  introTexto:
    'Lava se acuerda de todos los caminos del archipielago y dice que no necesita mapa. Aqui vas a aprender su truco: guardar varios numeros en una sola caja, en orden, y dejar que el programa los lea uno a uno. Lo importante no es que ahorre piezas, aunque las ahorra. Es que el camino deja de estar en el programa y pasa a estar en los datos, y entonces cambiar de camino es cambiar una lista sin tocar la logica.',
  actividades,
};
