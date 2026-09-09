/**
 * Mundo 14: El Templo de los Elementos. Si una cosa, y si no, la otra.
 *
 * En los mundos anteriores el programa hacía siempre lo mismo. Aquí decide, y hay
 * dos formas de decidir que se enseñan por separado porque no se parecen tanto
 * como aparentan:
 *
 *   Mirar el suelo. La casilla en la que está el Fuzz tiene un color, y el color
 *   dice qué hacer. La información está en el sitio donde uno está.
 *
 *   Mirar hacia delante. El Fuzz pregunta si puede avanzar, y con eso recorre un
 *   camino cuya forma el programa no sabe. La información está en el sitio al que
 *   uno va, que es más difícil de imaginar para un niño de ocho años y por eso va
 *   después.
 *
 * La segunda es la que da el salto grande: `si puede avanzar, avanza; si no, gira`
 * son cuatro piezas que recorren una L, una U o una espiral sin cambiar nada. El
 * niño escribe un programa que no sabe por dónde va a ir.
 *
 * Sobre el número del bucle: no cuenta casillas, cuenta decisiones. Con el color
 * cada vuelta avanza una casilla, así que el número es la longitud del camino. Con
 * el sensor cada giro se come una vuelta sin moverse, así que el número es
 * casillas más giros. Los dos los calcula el generador, porque contarlos a mano
 * deja la actividad imposible sin que se note leyéndola.
 *
 * Y un cuidado que en modo paso solo hace falta aquí: los pasillos no pueden
 * quedar pegados. Si dos tramos se tocan, el Fuzz pregunta si puede avanzar, le
 * dicen que sí, y se mete por el pasillo de al lado en vez de girar.
 *
 * Progresión:
 *   1-4    el color de la casilla decide. Rojo gira, lo demás sigue.
 *   5-8    dos colores, cada uno con su decisión.
 *   9-13   preguntar hacia delante. La L, la U y la espiral con cuatro piezas.
 *   14-17  caminos que el programa no conoce, y el mismo programa para todos.
 *   18-20  las antorchas de Llama.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  esColor,
  gira,
  girarDerecha,
  girarIzquierda,
  pinta,
  puedeAvanzar,
  repetir,
  si,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, ColorCasilla, WorldContentFile } from '@codenest/shared';

const CON_COLOR = ['avanzar', 'girarDerecha', 'girarIzquierda', 'repetir', 'siColor', 'siSino'];

/** Un tramo recto y el giro que viene después, si viene alguno. */
interface Tramo {
  readonly casillas: number;
  readonly gira?: 'derecha' | 'izquierda';
}

const t = (casillas: number, gira?: 'derecha' | 'izquierda'): Tramo => ({
  casillas,
  ...(gira ? { gira } : {}),
});

/**
 * Camino con las esquinas pintadas del color que manda girar.
 *
 * El color va en la casilla donde el Fuzz está cuando tiene que decidir, que es
 * la última del tramo. Pintarlo en la siguiente sería tarde.
 */
function caminoDeColores(
  tramos: readonly Tramo[],
  colorPara: (lado: 'derecha' | 'izquierda') => ColorCasilla,
): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (const tramo of tramos) {
    pasos.push(andar(tramo.casillas));
    if (tramo.gira) {
      pasos.push(pinta(colorPara(tramo.gira)));
      pasos.push(gira(tramo.gira));
    }
  }
  return pasos;
}

/** Casillas que recorre un camino: es el número de vueltas del bucle de color. */
function celdas(tramos: readonly Tramo[]): number {
  return tramos.reduce((total, tramo) => total + tramo.casillas, 0);
}

/** Camino sin colores, para el programa que pregunta hacia delante. */
function caminoLiso(tramos: readonly Tramo[]): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (const tramo of tramos) {
    pasos.push(andar(tramo.casillas));
    if (tramo.gira) pasos.push(gira(tramo.gira));
  }
  return pasos;
}

/**
 * Decisiones que cuesta recorrer un camino preguntando hacia delante.
 *
 * Cada casilla es una vuelta, y cada giro es otra vuelta en la que el Fuzz no se
 * mueve: pregunta, le dicen que no hay camino, y gira.
 */
function decisiones(tramos: readonly Tramo[]): number {
  const giros = tramos.filter((tramo) => tramo.gira).length;
  return celdas(tramos) + giros;
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly tramos: readonly Tramo[];
  /** Cómo decide el programa: por el color del suelo o mirando hacia delante. */
  readonly modo: 'color' | 'sensor';
  /** Con dos colores, cada uno manda girar hacia un lado. */
  readonly dosColores?: boolean;
}

/** El programa que decide por el color del suelo. */
function programaDeColor(tramos: readonly Tramo[], dosColores: boolean): Bloque[] {
  if (!dosColores) {
    return [
      repetir(
        celdas(tramos),
        si(esColor('rojo'), [girarDerecha(), avanzar()], [avanzar()]),
      ),
    ];
  }
  return [
    repetir(
      celdas(tramos),
      si(esColor('rojo'), [girarDerecha()]),
      si(esColor('azul'), [girarIzquierda()]),
      avanzar(),
    ),
  ];
}

/** El programa que decide mirando hacia delante. */
function programaDeSensor(tramos: readonly Tramo[]): Bloque[] {
  return [repetir(decisiones(tramos), si(puedeAvanzar, [avanzar()], [girarDerecha()]))];
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La casilla roja manda',
    instruccion:
      'El Templo de los Elementos tiene el suelo pintado. Llama enciende las antorchas siguiendo los colores y dice que nunca se ha equivocado. La regla es facil: si la casilla es roja, gira a la derecha; si no es roja, sigue. La pieza nueva tiene dos bocas, una para cada caso.',
    exito:
      'Tu programa ha mirado el suelo y ha decidido. Cuatro piezas y no dice en ningun sitio donde esta la esquina.',
    pistas: [
      'En la boca de arriba de la pieza van girar y avanzar. En la de abajo, solo avanzar.',
      'El bucle da tantas vueltas como casillas tiene el camino: seis.',
    ],
    tramos: [t(3, 'derecha'), t(3)],
    modo: 'color',
  },
  {
    nombre: 'Dos esquinas rojas',
    instruccion: 'Dos esquinas, y el mismo programa de antes. Solo cambia el numero de vueltas.',
    exito: 'El mismo programa para dos esquinas. Con piezas sueltas habrian sido nueve.',
    pistas: ['No toques la pieza de decidir.', 'Cuenta las casillas del camino: son ocho.'],
    tramos: [t(3, 'derecha'), t(2, 'derecha'), t(3)],
    modo: 'color',
  },
  {
    nombre: 'Cuatro esquinas',
    instruccion:
      'Cuatro esquinas rojas. Y fijate en algo: tu programa no sabe donde estan. Se lo dice el suelo.',
    exito:
      'Cuatro esquinas y tu programa sin enterarse. Eso es lo que hace una decision: mueve el saber del programa al tablero.',
    pistas: ['El programa no cambia.', 'Cuenta las casillas tramo a tramo y sumalas.'],
    tramos: [t(2, 'derecha'), t(3, 'derecha'), t(4, 'derecha'), t(5, 'derecha'), t(3)],
    modo: 'color',
  },
  {
    nombre: 'El camino largo del templo',
    instruccion: 'Un camino largo con seis esquinas. Solo tienes que contar bien las casillas.',
    exito: 'Seis esquinas con cuatro piezas. Llama esta tomando notas y ella nunca toma notas.',
    pistas: ['Ve contando los tramos y sumando sus casillas.', 'No cuentes las esquinas dos veces.'],
    tramos: [
      t(2, 'derecha'),
      t(3, 'derecha'),
      t(4, 'derecha'),
      t(5, 'derecha'),
      t(6, 'derecha'),
      t(7, 'derecha'),
      t(4),
    ],
    modo: 'color',
  },
  {
    nombre: 'El azul gira al otro lado',
    instruccion:
      'Ahora hay dos colores. El rojo gira a la derecha y el azul a la izquierda. Necesitas dos piezas de decidir, una para cada color, y el avanzar detras de las dos.',
    exito:
      'Dos decisiones seguidas y un avanzar al final. El suelo lleva las instrucciones y tu programa solo las obedece.',
    pistas: [
      'Primero una pieza que mire el rojo, y luego otra que mire el azul.',
      'El avanzar va fuera de las dos, al final de la vuelta.',
    ],
    tramos: [t(2, 'derecha'), t(2, 'izquierda'), t(2)],
    modo: 'color',
    dosColores: true,
  },
  {
    nombre: 'Zigzag de colores',
    instruccion: 'Rojo, azul, rojo, azul. El camino serpentea y el programa no cambia nada.',
    exito: 'Un zigzag entero leyendo el suelo. Cuatro esquinas alternas y cinco piezas.',
    pistas: ['El programa es el mismo del nivel anterior.', 'Cuenta las casillas: son diez.'],
    tramos: [t(2, 'derecha'), t(2, 'izquierda'), t(2, 'derecha'), t(2, 'izquierda'), t(2)],
    modo: 'color',
    dosColores: true,
  },
  {
    nombre: 'El laberinto de colores',
    instruccion:
      'Ocho esquinas y los dos colores mezclados sin ningun orden. Aqui ya no se puede adivinar: hay que confiar en el programa.',
    exito:
      'Ocho esquinas sin saber cual venia. Tu programa funcionaria igual si Llama repintara el suelo esta noche.',
    pistas: ['No intentes seguir el camino con el dedo. Solo cuenta las casillas.', 'Son dieciseis.'],
    tramos: [
      t(2, 'derecha'),
      t(2, 'derecha'),
      t(2, 'izquierda'),
      t(2, 'izquierda'),
      t(2, 'derecha'),
      t(2, 'derecha'),
      t(2, 'izquierda'),
      t(2, 'izquierda'),
      t(2),
    ],
    modo: 'color',
    dosColores: true,
  },
  {
    nombre: 'Tramos de distinto largo',
    instruccion:
      'Los tramos ya no miden todos lo mismo. Da igual: el color esta en la esquina, no en el largo.',
    exito: 'Tramos de cuatro, de uno y de tres, y ni una pieza de mas. El color no sabe de distancias.',
    pistas: ['Suma los tramos uno por uno.', 'Cuidado con el tramo de una sola casilla.'],
    tramos: [t(4, 'derecha'), t(1, 'izquierda'), t(3, 'derecha'), t(2, 'izquierda'), t(3)],
    modo: 'color',
    dosColores: true,
  },
  {
    nombre: 'Preguntar hacia delante',
    instruccion:
      'Ahora algo distinto y mas potente. En vez de mirar el suelo, el Fuzz pregunta si puede avanzar. Si puede, avanza; y si no puede, gira a la derecha. Fijate en lo que eso significa: el suelo no lleva ninguna pista y el programa igual encuentra la esquina.',
    exito:
      'Cuatro piezas, ninguna pista en el suelo, y el Fuzz ha girado justo donde tocaba. Este programa no sabe por donde va a ir, y aun asi va bien.',
    pistas: [
      'En la boca de arriba va avanzar, y en la de abajo girar a la derecha.',
      'Cada giro gasta una vuelta sin moverse, asi que son casillas mas giros: seis.',
    ],
    tramos: [t(3, 'derecha'), t(2)],
    modo: 'sensor',
  },
  {
    nombre: 'La U',
    instruccion: 'El mismo programa en un camino con dos esquinas. No cambies nada mas que el numero.',
    exito: 'Dos esquinas y el mismo programa. Empieza a verse para que sirve preguntar.',
    pistas: ['Casillas mas giros.', 'Hay siete casillas y dos giros.'],
    tramos: [t(3, 'derecha'), t(2, 'derecha'), t(2)],
    modo: 'sensor',
  },
  {
    nombre: 'La espiral que se descubre',
    instruccion:
      'Una espiral de cuatro esquinas. Con el sensor no tienes que saber cuanto mide cada tramo: solo cuantas decisiones hay en total.',
    exito:
      'Una espiral entera con cuatro piezas. Si manana la espiral tuviera los tramos de otro largo, el programa seguiria funcionando y solo cambiaria el numero.',
    pistas: ['Suma primero las casillas de los cuatro tramos.', 'Y luego anade un uno por cada giro.'],
    tramos: [t(5, 'derecha'), t(4, 'derecha'), t(4, 'derecha'), t(2)],
    modo: 'sensor',
  },
  {
    nombre: 'El mismo programa, otro camino',
    instruccion:
      'Mira el tablero y luego mira tu programa anterior. Es el mismo, letra por letra, y el camino no se parece en nada. Solo cambia el numero.',
    exito:
      'Un programa que sirve para caminos que no has visto. Los mayores le llaman a esto un algoritmo, y ya has escrito dos.',
    pistas: ['No cambies ninguna pieza.', 'Cuenta las casillas y los giros del tablero nuevo.'],
    tramos: [t(4, 'derecha'), t(3, 'derecha'), t(3, 'derecha'), t(2)],
    modo: 'sensor',
  },
  {
    nombre: 'Tramos que no adivinas',
    instruccion:
      'Cinco esquinas y tramos de largos raros. Con el sensor esto es facil; sin el, tendrias que medir cada tramo con el dedo.',
    exito: 'Cinco esquinas medidas por el propio Fuzz. Tu solo has contado.',
    pistas: ['Suma primero las casillas y luego los giros.', 'Un giro cuenta como una vuelta aunque el Fuzz no se mueva.'],
    tramos: [t(9, 'derecha'), t(8, 'derecha'), t(6, 'derecha'), t(5, 'derecha'), t(3)],
    modo: 'sensor',
  },
  {
    nombre: 'La escalera de fuego',
    instruccion:
      'Una escalera de esquinas cortas. Cada tramo mide dos y hay muchos giros, asi que la mayor parte de las vueltas se van en girar.',
    exito:
      'Mas giros que avances. El numero de un bucle con sensor cuenta decisiones, y girar es decidir.',
    pistas: ['Cuenta los giros primero, que son los que se olvidan.', 'Y luego suma las casillas de cada tramo.'],
    tramos: [t(8, 'derecha'), t(7, 'derecha'), t(5, 'derecha'), t(4, 'derecha'), t(2)],
    modo: 'sensor',
  },
  {
    nombre: 'Uno mas de la cuenta',
    instruccion:
      'Cuidado con este. Si te pasas de una vuelta, el Fuzz gira al llegar al final y se queda mirando a la pared. No se estrella, pero no esta en la meta.',
    exito:
      'El numero justo. Pasarse con el sensor no rompe nada: solo deja al Fuzz mirando a otro lado, y eso es peor porque parece que funciona.',
    pistas: ['Cuenta dos veces antes de jugar.', 'Si te sobra una vuelta, el Fuzz gira y se queda mirando la pared.'],
    tramos: [t(7, 'derecha'), t(6, 'derecha'), t(4, 'derecha'), t(3)],
    modo: 'sensor',
  },
  {
    nombre: 'El pasillo doblado',
    instruccion: 'Un camino largo con seis esquinas, todas al mismo lado. Confia en el sensor.',
    exito: 'Seis esquinas. Llama dice que ella lo habria hecho a ojo, y que probablemente se habria equivocado.',
    pistas: ['Ve tramo a tramo sumando casillas.', 'Al final anade un uno por cada esquina.'],
    tramos: [
      t(10, 'derecha'),
      t(9, 'derecha'),
      t(7, 'derecha'),
      t(6, 'derecha'),
      t(4, 'derecha'),
      t(3),
    ],
    modo: 'sensor',
  },
  {
    nombre: 'Colores otra vez, con el camino largo',
    instruccion:
      'Volvemos al suelo pintado, pero ahora con un camino de los largos. Los dos colores y diez esquinas.',
    exito: 'Diez esquinas leyendo el suelo. Ya sabes decidir de las dos maneras.',
    pistas: ['El programa de los dos colores, el de cinco piezas.', 'Cuenta las casillas con calma.'],
    tramos: [
      t(3, 'derecha'),
      t(2, 'izquierda'),
      t(2, 'derecha'),
      t(2, 'izquierda'),
      t(3, 'derecha'),
      t(2, 'izquierda'),
      t(2, 'derecha'),
      t(2, 'izquierda'),
      t(2, 'derecha'),
      t(2, 'izquierda'),
      t(2),
    ],
    modo: 'color',
    dosColores: true,
  },
  {
    nombre: 'Los dos programas',
    instruccion:
      'Ultimo antes de subir a por Llama, y va de elegir. Este camino tiene el suelo pintado Y las esquinas donde el camino se corta. Se puede resolver de las dos maneras, con el color o con el sensor. Hazlo con el sensor: es el que funcionaria si manana Llama repintara el suelo.',
    exito:
      'Con el sensor. Los dos programas llegaban, pero uno depende de que alguien pinte bien el suelo y el otro no depende de nadie.',
    pistas: [
      'El programa del sensor tiene cuatro piezas y no mira el color.',
      'Cuenta las casillas y las esquinas por separado.',
    ],
    tramos: [t(8, 'derecha'), t(7, 'derecha'), t(5, 'derecha'), t(4, 'derecha'), t(2)],
    modo: 'sensor',
  },
  {
    nombre: 'La antorcha que no se apago',
    instruccion:
      'Llama enciende las antorchas del templo todas las noches y las cuenta al acabar. Dice que la noche de la tormenta se apagaron todas menos una, y que esa estaba en el sitio mas alto. Ve a verla.',
    exito:
      'La antorcha de arriba no se apago, dijo Llama, porque el viento no venia de arriba. Venia de abajo, y subia. Nimbo dijo lo mismo hace cuatro mundos y nadie le hizo caso.',
    pistas: ['El programa del sensor, el de cuatro piezas.', 'Cuenta las casillas y las esquinas por separado.'],
    tramos: [
      t(10, 'derecha'),
      t(9, 'derecha'),
      t(7, 'derecha'),
      t(6, 'derecha'),
      t(4, 'derecha'),
      t(3),
    ],
    modo: 'sensor',
  },
  {
    nombre: 'Donde esta Llama',
    instruccion:
      'Ultimo del templo. Llama esta arriba, al lado de la antorcha que no se apago, y no piensa bajar hasta que alguien le explique por que. El camino tiene ocho esquinas y ninguna pista en el suelo.',
    exito:
      'Llama esta en casa. Ha traido la antorcha encendida y la ha puesto al lado del tablon de Engra. Dice que la enciende cada noche por si acaso, y no dice por si acaso que.',
    pistas: [
      'Es el programa del sensor. No lo cambies.',
      'Cuenta las casillas y los giros por separado, y luego sumalos.',
    ],
    tramos: [
      t(11, 'derecha'),
      t(10, 'derecha'),
      t(8, 'derecha'),
      t(7, 'derecha'),
      t(5, 'derecha'),
      t(4, 'derecha'),
      t(2),
    ],
    modo: 'sensor',
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 14,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const esColorMundo = receta.modo === 'color';
  const camino = esColorMundo
    ? caminoDeColores(receta.tramos, (lado) => (lado === 'derecha' ? 'rojo' : 'azul'))
    : caminoLiso(receta.tramos);

  return actividadCreador(contexto, {
    camino,
    bloques: CON_COLOR,
    solucion: esColorMundo
      ? programaDeColor(receta.tramos, receta.dosColores ?? false)
      : programaDeSensor(receta.tramos),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 95 : undefined,
  });
});

export const mundo14: WorldContentFile = {
  mundo: 14,
  slug: 'templo-de-los-elementos',
  nombre: 'El Templo de los Elementos',
  introTexto:
    'En el Templo de los Elementos el suelo esta pintado y los colores dicen que hacer. Llama enciende las antorchas siguiendo esos colores y dice que nunca se equivoca. Aqui tu programa va a decidir por primera vez: si una cosa, y si no, la otra. Y despues vas a aprender algo mejor, que es preguntar hacia donde vas en vez de mirar donde estas. Con eso se recorre un camino cuya forma el programa no conoce.',
  actividades,
};
