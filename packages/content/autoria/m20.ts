/**
 * Mundo 20: La Fortaleza del Titán. Todo lo de los Creadores junto.
 *
 * Como el mundo 10, este no es más difícil: es un mundo donde nadie dice qué
 * herramienta usar. Y a diferencia del 10, aquí las herramientas son ocho y varias
 * se parecen lo suficiente para confundirse, así que el ejercicio real es elegir:
 *
 *   bucle contado          cuando se sabe cuántas veces
 *   bucle sin número       cuando no se sabe, y es casi siempre mejor
 *   bloque propio          cuando lo mismo aparece en sitios separados
 *   hueco del bloque       cuando lo mismo aparece con números distintos
 *   variable               cuando el número cambia mientras el programa corre
 *   lista                  cuando los números son datos y no lógica
 *   condición              cuando el tablero sabe algo que el programa no
 *   dos condiciones        cuando hay dos motivos distintos para lo mismo
 *
 * Las cuatro primeras actividades repasan una idea cada una, y a partir de la
 * quinta cada tablero admite más de una solución. Los textos dicen cuál se espera
 * y por qué, porque la razón por la que una es mejor que otra es justo lo que hay
 * que aprender: casi siempre es que una no depende de contar y la otra sí.
 *
 * Progresión:
 *   1-4    un repaso de cada idea grande.
 *   5-9    dos ideas por tablero.
 *   10-14  tres ideas, y tableros que ya no caben de un vistazo.
 *   15-18  la fortaleza entera.
 *   19-20  el Titán, y lo que se sabe al acabar los Creadores.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  define,
  elemento,
  esColor,
  estrellaAqui,
  gira,
  girarDerecha,
  girarIzquierda,
  hayObstaculo,
  lista,
  longitud,
  mas,
  mientras,
  num,
  o,
  pinta,
  pon,
  puedeAvanzar,
  repetir,
  senuelo,
  si,
  suma,
  usa,
  vble,
  y,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

/** En la fortaleza esta todo desbloqueado: elegir es el ejercicio. */
const TODO = [
  'avanzar',
  'girarDerecha',
  'girarIzquierda',
  'saltar',
  'repetir',
  'mientras',
  'hasta',
  'siColor',
  'siSino',
  'variable',
  'lista',
  'funcion',
];

// ──────────────────────────── Formas de tablero ────────────────────────────

function escalon(largo: number, bajada = 1): PasoCamino[] {
  return [andar(largo), gira('derecha'), andar(bajada), gira('izquierda')];
}

function escalera(largos: readonly number[], bajadas?: readonly number[]): PasoCamino[] {
  return largos.flatMap((largo, i) => escalon(largo, bajadas?.[i] ?? 1));
}

/** Espiral que se abre: la forma segura cuando el programa usa sensores. */
function espiral(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

function casillasEspiral(brazos: number, primero = 3): number {
  let total = 0;
  for (let i = 0; i < brazos; i++) total += primero + i;
  return total;
}

function decisionesEspiral(brazos: number, primero = 3): number {
  return casillasEspiral(brazos, primero) + (brazos - 1);
}

/** Espiral con el camino bueno en verde salvo el final de cada brazo. */
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

/** Espiral con esquinas falsas marcadas en rojo y pasillos que no llevan a nada. */
function espiralConSenuelos(brazos: number, primero = 3): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) {
      // Las esquinas impares se anuncian con un pasillo falso y el suelo rojo.
      if (i % 2 === 1) pasos.push(senuelo(1), pinta('rojo'));
      pasos.push(gira('derecha'));
    }
  }
  return pasos;
}

// ─────────────────────────── Programas de siempre ──────────────────────────

/** El bloque de escalón con hueco, de la fábrica de Voltio. */
const ISLA = define(
  'isla',
  [repetir(vble('largo'), avanzar()), girarDerecha(), avanzar(), girarIzquierda()],
  ['largo'],
);

/** Andar el pasillo entero sin contar, del bioma de Copo. */
const TRAMO_SIN_CONTAR = define('tramo', [mientras(puedeAvanzar, avanzar()), girarDerecha()]);

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly solucion: readonly Bloque[];
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Otra vez el bucle sin numero',
    instruccion:
      'La Fortaleza del Titan es lo mas grande que hay en el mapa de los Creadores, y aqui nadie te va a decir que pieza usar. Empieza suave: cinco pasillos que no sabes cuanto miden. Que herramienta pide eso?',
    exito: 'El bucle sin numero. Cuando no sabes cuanto mide algo, no lo cuentes: preguntalo.',
    pistas: ['Mientras puedas avanzar, avanza.', 'Y un bucle de fuera que cuente las esquinas.'],
    camino: espiral(5),
    solucion: [repetir(5, mientras(puedeAvanzar, avanzar()), girarDerecha())],
  },
  {
    nombre: 'Otra vez el hueco',
    instruccion: 'Seis escalones de largos distintos y sin ninguna regla. Que herramienta pide eso?',
    exito: 'Un bloque con hueco. Cuando lo mismo aparece con numeros distintos, el numero va por fuera.',
    pistas: ['Un bloque propio con un hueco para el largo.', 'Y seis llamadas, cada una con su numero.'],
    camino: escalera([2, 4, 1, 3, 2, 4]),
    solucion: [ISLA, ...[2, 4, 1, 3, 2, 4].map((largo) => usa('isla', num(largo)))],
  },
  {
    nombre: 'Otra vez la lista',
    instruccion:
      'Ocho escalones. Con ocho llamadas sueltas caben, pero fijate en que son ocho numeros y ninguna logica nueva. Que herramienta pide eso?',
    exito: 'Una lista. Cuando lo unico que cambia son los numeros, los numeros son datos.',
    pistas: ['Guarda los ocho largos en una lista.', 'Y recorrela con un indice que sube.'],
    camino: escalera([1, 2, 1, 3, 2, 1, 2, 1]),
    solucion: [
      ISLA,
      pon('ruta', lista(num(1), num(2), num(1), num(3), num(2), num(1), num(2), num(1))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Otra vez la variable',
    instruccion:
      'Seis escalones que crecen de uno en uno: uno, dos, tres, cuatro, cinco, seis. Aqui una lista sobra. Que herramienta pide eso?',
    exito: 'Una variable que suma uno. Cuando los numeros siguen una regla, la regla es mas corta que la lista.',
    pistas: ['Una caja que empieza en uno y sube en cada vuelta.', 'El bloque con hueco recibe la caja.'],
    camino: escalera([1, 2, 3, 4, 5]),
    solucion: [
      ISLA,
      pon('largo', num(1)),
      repetir(5, usa('isla', vble('largo')), suma('largo', num(1))),
    ],
  },
  {
    nombre: 'El bloque sin contar',
    instruccion:
      'Siete pasillos de largo desconocido. Mete el bucle sin numero en un bloque propio y el programa se lee como una frase.',
    exito: 'Un bloque propio con un bucle sin numero dentro. Repite siete veces el tramo: eso es todo el programa.',
    pistas: ['Dentro del bloque: el bucle sin numero y el giro.', 'Fuera: un repetir con la llamada.'],
    camino: espiral(7),
    solucion: [TRAMO_SIN_CONTAR, repetir(7, usa('tramo'))],
  },
  {
    nombre: 'Contar esquinas tampoco',
    instruccion:
      'Y ahora quitale tambien ese numero. Si el bucle de fuera cuenta esquinas, puede preguntar en vez de contar: mientras se pueda seguir, sigue. Al final del ultimo pasillo ya no hay a donde girar.',
    exito:
      'Ni un numero en todo el programa. El Fuzz recorre la fortaleza sin que nadie le haya dicho cuanto mide ni cuantas esquinas tiene.',
    pistas: [
      'El bucle de fuera tambien puede ser un mientras.',
      'Despues de girar, si no hay camino, se ha acabado.',
    ],
    camino: espiral(6),
    solucion: [
      mientras(puedeAvanzar, avanzar()),
      repetir(5, girarDerecha(), mientras(puedeAvanzar, avanzar())),
    ],
  },
  {
    nombre: 'Pasillos falsos',
    instruccion:
      'La fortaleza tiene pasillos que no llevan a ninguna parte, y estan marcados en rojo. Ahora preguntar si puedes avanzar no basta.',
    exito: 'Dos razones para girar en una sola condicion. La fortaleza no te va a enganar con eso otra vez.',
    pistas: ['Si hay pared O el suelo es rojo, gira.', 'El bucle cuenta casillas del camino bueno.'],
    camino: espiralConSenuelos(5),
    solucion: [
      repetir(
        casillasEspiral(5),
        si(o(hayObstaculo, esColor('rojo')), [girarDerecha(), avanzar()], [avanzar()]),
      ),
    ],
  },
  {
    nombre: 'El suelo bueno',
    instruccion:
      'Al contrario: aqui el camino bueno esta pintado y lo demas no. Sigue mientras haya camino Y el suelo sea el bueno.',
    exito:
      'Dos condiciones para avanzar. Y acuerdate del paso suelto despues del giro: sin el, el Fuzz se queda girando sobre la misma casilla.',
    pistas: ['La condicion doble dentro del bucle sin numero.', 'Y el ultimo tramo va fuera del bucle grande.'],
    camino: espiralVerde(4),
    solucion: [
      define('tramo', [mientras(y(puedeAvanzar, esColor('verde')), avanzar())]),
      repetir(3, usa('tramo'), girarDerecha(), avanzar()),
      usa('tramo'),
    ],
  },
  {
    nombre: 'Piedras del Titan',
    instruccion: 'El Titan ha dejado piedras por los pasillos. Pasa por encima de todas.',
    exito: 'Las piedras. El Titan dice que son de la muralla y que le sobran.',
    pistas: ['El bloque de tramo sin contar.', 'Las piedras estan en las esquinas.'],
    camino: espiral(6).flatMap((paso) => ('gira' in paso ? [estrellaAqui(), paso] : [paso])),
    solucion: [TRAMO_SIN_CONTAR, repetir(6, usa('tramo'))],
  },
  {
    nombre: 'Lista y bloque',
    instruccion:
      'Diez escalones con largos que no siguen ninguna regla. Junta la lista y el bloque con hueco: uno guarda los datos y el otro hace el trabajo.',
    exito: 'La lista da y el bloque hace. Ninguno de los dos sabe nada del otro.',
    pistas: ['La lista con los diez largos.', 'Y el bloque con hueco dentro del bucle.'],
    camino: escalera([1, 2, 1, 3, 1, 2, 1, 2, 1, 2]),
    solucion: [
      ISLA,
      pon(
        'ruta',
        lista(num(1), num(2), num(1), num(3), num(1), num(2), num(1), num(2), num(1), num(2)),
      ),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'La lista que se estira',
    instruccion:
      'Los largos de la fortaleza son los de la lista MAS uno, porque la muralla ha crecido. No cambies la lista: cambia lo que haces con ella.',
    exito: 'Una cuenta sobre el dato. Los datos se dejan como estan y se ajusta lo que se hace con ellos.',
    pistas: ['Saca el elemento y sumale uno antes de pasarlo al bloque.', 'La lista se queda igual.'],
    camino: escalera([2, 3, 2, 4, 3, 2]),
    solucion: [
      ISLA,
      pon('ruta', lista(num(1), num(2), num(1), num(3), num(2), num(1))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', mas(elemento(vble('ruta'), vble('i')), num(1))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Dos huecos y una lista',
    instruccion:
      'Cada tramo tiene dos datos: lo que se anda y lo que se baja. Dos listas, un indice y un bloque de dos huecos.',
    exito: 'Dos listas y un solo indice. El mismo numero de vuelta saca el dato de las dos.',
    pistas: ['Las dos listas tienen la misma longitud.', 'El bloque recibe los dos numeros en orden.'],
    camino: escalera([2, 1, 3, 2, 1], [1, 2, 1, 2, 1]),
    solucion: [
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
      pon('ruta', lista(num(2), num(1), num(3), num(2), num(1))),
      pon('bajadas', lista(num(1), num(2), num(1), num(2), num(1))),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i')), elemento(vble('bajadas'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Ocho pasillos sin contar',
    instruccion: 'Ocho pasillos y ni un numero en el programa. Ya sabes como.',
    exito: 'Ocho pasillos sin contar nada. Es el programa mas corto que se puede escribir para esto.',
    pistas: ['Un mientras para andar y otro para las esquinas.', 'El primero va antes del bucle grande.'],
    camino: espiral(8),
    solucion: [
      mientras(puedeAvanzar, avanzar()),
      repetir(7, girarDerecha(), mientras(puedeAvanzar, avanzar())),
    ],
  },
  {
    nombre: 'La muralla larga',
    instruccion:
      'Doce escalones con dos datos cada uno. Es la muralla entera de la fortaleza. Con listas cabe.',
    exito: 'La muralla entera. El Titan dice que la construyo el solo y que tardo mas.',
    pistas: ['Ve escribiendo las dos listas mirando el tablero columna a columna.', 'Comprueba a mitad.'],
    camino: escalera([1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2], [1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2]),
    solucion: [
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
      pon(
        'ruta',
        lista(
          num(1),
          num(2),
          num(1),
          num(1),
          num(2),
          num(1),
          num(2),
          num(1),
          num(1),
          num(2),
          num(1),
          num(2),
        ),
      ),
      pon(
        'bajadas',
        lista(
          num(1),
          num(1),
          num(2),
          num(1),
          num(1),
          num(2),
          num(1),
          num(1),
          num(2),
          num(1),
          num(1),
          num(2),
        ),
      ),
      pon('i', num(1)),
      repetir(
        longitud(vble('ruta')),
        usa('isla', elemento(vble('ruta'), vble('i')), elemento(vble('bajadas'), vble('i'))),
        suma('i', num(1)),
      ),
    ],
  },
  {
    nombre: 'Siete esquinas falsas',
    instruccion:
      'Siete esquinas y la mitad son mentira. Aqui hace falta la condicion de dos razones y un bucle que cuente casillas.',
    exito: 'Siete esquinas, cuatro de ellas falsas, y una sola condicion para todas.',
    pistas: ['Si hay pared O el suelo es rojo, gira.', 'El numero cuenta las casillas del camino bueno.'],
    camino: espiralConSenuelos(7),
    solucion: [
      repetir(
        casillasEspiral(7),
        si(o(hayObstaculo, esColor('rojo')), [girarDerecha(), avanzar()], [avanzar()]),
      ),
    ],
  },
  {
    nombre: 'El suelo bueno, seis tramos',
    instruccion: 'Seis tramos con el suelo bueno marcado. Y el paso suelto despues del giro.',
    exito: 'Seis tramos leyendo el suelo. La fortaleza ya no tiene nada que ensenarte sobre condiciones.',
    pistas: ['La condicion doble en el bucle sin numero.', 'El ultimo tramo, fuera del bucle grande.'],
    camino: espiralVerde(6),
    solucion: [
      define('tramo', [mientras(y(puedeAvanzar, esColor('verde')), avanzar())]),
      repetir(5, usa('tramo'), girarDerecha(), avanzar()),
      usa('tramo'),
    ],
  },
  {
    nombre: 'La torre de vigilancia',
    instruccion:
      'Nueve pasillos que suben en espiral hasta la torre. Sin numeros, sin listas: solo preguntar.',
    exito: 'La torre. Desde aqui se ve el Nido, muy pequeno y muy lejos, y detras el Nucleo.',
    pistas: ['Un mientras para andar y un bucle para las esquinas.', 'O dos mientras, si te atreves.'],
    camino: espiral(9),
    solucion: [
      mientras(puedeAvanzar, avanzar()),
      repetir(8, girarDerecha(), mientras(puedeAvanzar, avanzar())),
    ],
  },
  {
    nombre: 'La eleccion',
    instruccion:
      'Este tablero se puede resolver de cuatro maneras y las cuatro llegan: contando casillas, con una lista, con una variable o sin numeros. Hazlo sin numeros. Y piensa por que es la mejor: porque es la unica que seguiria funcionando si el Titan moviera una pared esta noche.',
    exito:
      'Sin numeros. Un programa que no depende de medir nada es un programa que sigue funcionando cuando el mundo cambia. Eso es lo que has aprendido en diez mundos.',
    pistas: ['Mientras puedas avanzar, avanza. Y otra vez.', 'Ni un numero en toda la logica.'],
    camino: espiral(7, 4),
    solucion: [
      mientras(puedeAvanzar, avanzar()),
      repetir(6, girarDerecha(), mientras(puedeAvanzar, avanzar())),
    ],
  },
  {
    nombre: 'Lo que sostiene el Titan',
    instruccion:
      'El Titan sostiene la puerta de la fortaleza y no se rinde jamas. Dice que la noche de la tormenta algo intento entrar por arriba, y que aguanto. Y que le dejo una marca. Ve a verla.',
    exito:
      'La marca esta en el techo de la puerta, hundida hacia dentro. Es un circulo con tres rayas. La misma que la placa de Garfio y la misma que la pared del laberinto de Dedalo. El Titan dice que lo que dejo esa marca pesaba mas que el.',
    pistas: ['El bucle sin numero y ocho esquinas falsas.', 'La condicion de dos razones.'],
    camino: espiralConSenuelos(8),
    solucion: [
      repetir(
        casillasEspiral(8),
        si(o(hayObstaculo, esColor('rojo')), [girarDerecha(), avanzar()], [avanzar()]),
      ),
    ],
  },
  {
    nombre: 'Donde esta el Titan',
    instruccion:
      'Ultimo de los Creadores. El Titan sigue sosteniendo la puerta, cuatro semanas despues, porque dice que si la suelta se cae. Ve a por el: la fortaleza tiene diez tramos y no vas a usar ni un numero para medirlos.',
    exito:
      'El Titan solto la puerta y no se cayo. Veinte Fuzzes en el Nido, veinte cosas raras en la pared, y una marca que aparece en tres mundos que no se conocen entre ellos. Manana empiezan los Hackers, y alli ya no hay piezas: hay que escribir. En el mundo treinta esta el Nucleo, y ahora sabes que algo salio de el.',
    pistas: [
      'Un mientras para el primer pasillo y un bucle para las nueve esquinas.',
      'Ni un numero que mida casillas.',
    ],
    camino: espiral(10, 3),
    solucion: [
      mientras(puedeAvanzar, avanzar()),
      repetir(9, girarDerecha(), mientras(puedeAvanzar, avanzar())),
    ],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 20,
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
    bloques: TODO,
    solucion: receta.solucion,
    tipo: indice === 19 ? 'jefe' : indice >= 17 ? 'integrador' : undefined,
    monedas: indice === 19 ? 200 : undefined,
  });
});

export const mundo20: WorldContentFile = {
  mundo: 20,
  slug: 'fortaleza-del-titan',
  nombre: 'La Fortaleza del Titan',
  introTexto:
    'La Fortaleza del Titan es lo mas grande del mapa de los Creadores, y aqui nadie te va a decir que pieza usar. Tienes ocho herramientas y varias se parecen lo suficiente para confundirse: bucles con numero y sin numero, bloques con hueco y sin hueco, variables, listas y condiciones de una o de dos partes. El ejercicio no es resolver los tableros: es elegir. Y casi siempre la mejor eleccion es la que no depende de contar nada.',
  actividades,
};
