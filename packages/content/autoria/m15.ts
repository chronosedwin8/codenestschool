/**
 * Mundo 15: El Laberinto Isométrico. Dos condiciones a la vez.
 *
 * Un operador lógico no se entiende explicándolo: se entiende cuando hace falta.
 * Y para que haga falta, las dos mitades de la condición tienen que decidir cosas
 * distintas en sitios distintos del mismo tablero. Si una de las dos nunca cambia
 * nada, el niño la copia y no aprende nada.
 *
 * De ahí sale la pieza que hubo que añadir al generador para este mundo: los
 * señuelos. Un señuelo es un pasillo que sigue recto y no lleva a ninguna parte.
 * Sin señuelos, "¿puedes avanzar?" solo dice no en las esquinas, y entonces basta
 * con esa pregunta: la otra mitad de la condición sobra. Con un señuelo delante,
 * el Fuzz sí puede avanzar y aun así no debe, y para saberlo tiene que mirar
 * además el suelo.
 *
 * Así queda cada operador:
 *
 *   O   dos razones para girar. Hay pared delante, O el suelo es rojo. En el mismo
 *       laberinto hay esquinas de las dos clases, así que quitar cualquiera de las
 *       dos mitades deja al Fuzz perdido.
 *
 *   Y   dos condiciones para avanzar. Hay camino delante Y el suelo es verde. Los
 *       pasillos buenos están pintados de verde y las bifurcaciones no, así que
 *       una mitad detecta el final del pasillo y la otra detecta el desvío falso.
 *
 * En los dos casos cada vuelta del bucle mueve al Fuzz exactamente una casilla, así
 * que el número es la longitud del camino. Lo calcula el generador.
 *
 * Progresión:
 *   1-5    O: pared o suelo rojo. Aparecen los pasillos que no llevan a nada.
 *   6-10   Y: camino y suelo verde. El desvío falso está pintado de otra forma.
 *   11-14  laberintos largos con las dos clases de esquina mezcladas.
 *   15-17  O con dos colores: rojo o azul mandan lo mismo.
 *   18-20  el mapa de Dedalo.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  esColor,
  gira,
  girarDerecha,
  hayObstaculo,
  o,
  pinta,
  puedeAvanzar,
  repetir,
  senuelo,
  si,
  y,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const BLOQUES = ['avanzar', 'girarDerecha', 'girarIzquierda', 'repetir', 'siColor', 'siSino'];

/**
 * Un tramo del laberinto.
 *
 * `fin` dice cómo se anuncia la esquina: `pared` es que el pasillo se acaba, y
 * `senuelo` es que el pasillo sigue recto pero es mentira, y lo que avisa es el
 * color del suelo.
 */
interface Tramo {
  readonly casillas: number;
  readonly gira?: 'derecha';
  readonly fin?: 'pared' | 'senuelo';
}

const t = (casillas: number, fin?: 'pared' | 'senuelo'): Tramo =>
  fin ? { casillas, gira: 'derecha', fin } : { casillas };

/**
 * Un laberinto en espiral que se abre, con los finales que diga cada esquina.
 *
 * Los tramos crecen de uno en uno a proposito. El Fuzz de este mundo solo gira a
 * la derecha, asi que cualquier camino suyo es una espiral; y una espiral de
 * brazos parecidos se cierra sobre si misma, el camino se pisa, y entonces un
 * pasillo falso acaba siendo un atajo de verdad. Creciendo, la espiral se abre y
 * eso no puede pasar.
 */
function laberinto(finales: readonly ('pared' | 'senuelo')[]): Tramo[] {
  const tramos = finales.map((fin, i) => t(i + 2, fin));
  // El ultimo tramo no gira: acaba en la meta.
  return [...tramos, t(finales.length + 2)];
}

/** Casillas del recorrido: el número de vueltas del bucle. */
function celdas(tramos: readonly Tramo[]): number {
  return tramos.reduce((total, tramo) => total + tramo.casillas, 0);
}

/** Laberinto para el programa del O: las esquinas falsas van marcadas en rojo. */
function caminoO(tramos: readonly Tramo[]): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (const tramo of tramos) {
    pasos.push(andar(tramo.casillas));
    if (!tramo.gira) continue;
    if (tramo.fin === 'senuelo') {
      pasos.push(senuelo(1), pinta('rojo'));
    }
    pasos.push(gira(tramo.gira));
  }
  return pasos;
}

/**
 * Laberinto para el programa del Y: el pasillo bueno va pintado de verde.
 *
 * La casilla donde hay que girar por un señuelo se queda sin pintar, y esa es la
 * pista: el verde significa "por aquí se sigue recto".
 */
function caminoY(tramos: readonly Tramo[]): PasoCamino[] {
  const pasos: PasoCamino[] = [pinta('verde')];
  for (const tramo of tramos) {
    for (let i = 0; i < tramo.casillas; i++) {
      pasos.push(andar(1));
      const esUltima = i === tramo.casillas - 1;
      // La casilla de la bifurcacion no se pinta: es lo que la delata.
      if (!(esUltima && tramo.fin === 'senuelo')) pasos.push(pinta('verde'));
    }
    if (!tramo.gira) continue;
    if (tramo.fin === 'senuelo') pasos.push(senuelo(1));
    pasos.push(gira(tramo.gira));
  }
  return pasos;
}

/** Si hay pared delante O el suelo es rojo, gira. Si no, avanza. */
function programaO(tramos: readonly Tramo[]): Bloque[] {
  return [
    repetir(
      celdas(tramos),
      si(o(hayObstaculo, esColor('rojo')), [girarDerecha(), avanzar()], [avanzar()]),
    ),
  ];
}

/** Si hay camino delante Y el suelo es verde, avanza. Si no, gira y avanza. */
function programaY(tramos: readonly Tramo[]): Bloque[] {
  return [
    repetir(
      celdas(tramos),
      si(y(puedeAvanzar, esColor('verde')), [avanzar()], [girarDerecha(), avanzar()]),
    ),
  ];
}

/** El O con dos colores: rojo o azul mandan girar igual. */
function programaDosColores(tramos: readonly Tramo[]): Bloque[] {
  return [
    repetir(
      celdas(tramos),
      si(o(esColor('rojo'), esColor('azul')), [girarDerecha(), avanzar()], [avanzar()]),
    ),
  ];
}

/** Laberinto donde las esquinas alternan rojo y azul, y las dos mandan girar. */
function caminoDosColores(tramos: readonly Tramo[]): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  let alterna = 0;
  for (const tramo of tramos) {
    pasos.push(andar(tramo.casillas));
    if (!tramo.gira) continue;
    pasos.push(senuelo(1), pinta(alterna % 2 === 0 ? 'rojo' : 'azul'));
    alterna += 1;
    pasos.push(gira(tramo.gira));
  }
  return pasos;
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly tramos: readonly Tramo[];
  readonly modo: 'o' | 'y' | 'dosColores';
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Dos razones para girar',
    instruccion:
      'Dedalo dibujo el mapa de este laberinto y dice que nunca se ha perdido. Aqui hay esquinas de dos clases: unas donde el pasillo se acaba, y otras donde el pasillo sigue recto pero es mentira y el suelo esta rojo. La pieza de O sirve para eso: si hay pared O el suelo es rojo, gira.',
    exito:
      'Las dos razones en la misma condicion. Si le quitas la mitad de la pared, el Fuzz se estrella; si le quitas la del rojo, se mete por el pasillo falso.',
    pistas: [
      'La pieza de O tiene dos huecos: en uno va hay un obstaculo y en el otro la casilla es roja.',
      'El bucle da tantas vueltas como casillas tiene el camino bueno.',
    ],
    tramos: laberinto(['pared', 'senuelo']),
    modo: 'o',
  },
  {
    nombre: 'El pasillo que no lleva a nada',
    instruccion:
      'Fijate en el pasillo de la derecha: se puede andar por el y no va a ningun sitio. Lo unico que lo delata es que la casilla donde estas es roja.',
    exito:
      'El pasillo falso sigue ahi y el Fuzz no ha entrado. La pared no lo habria avisado, porque no habia pared.',
    pistas: ['El rojo avisa antes de meterse.', 'Cuenta solo las casillas del camino bueno.'],
    tramos: laberinto(['senuelo', 'senuelo']),
    modo: 'o',
  },
  {
    nombre: 'Paredes y mentiras',
    instruccion: 'Cuatro esquinas: dos de pared y dos de mentira. La misma condicion resuelve las cuatro.',
    exito: 'Cuatro esquinas de dos clases distintas con una sola condicion. Eso es lo que hace un O.',
    pistas: ['No cambies el programa.', 'Suma las casillas del camino bueno, sin contar los pasillos falsos.'],
    tramos: laberinto(['pared', 'senuelo', 'pared', 'senuelo']),
    modo: 'o',
  },
  {
    nombre: 'Seis esquinas',
    instruccion: 'Mas largo, mismas dos clases de esquina. Cuenta con cuidado.',
    exito: 'Seis esquinas. Dedalo dice que este lo dibujo el en una tarde y que le salio torcido.',
    pistas: ['Ve tramo a tramo del camino bueno.', 'Los pasillos falsos no se cuentan.'],
    tramos: laberinto(['senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared']),
    modo: 'o',
  },
  {
    nombre: 'Todo mentiras',
    instruccion:
      'En este laberinto no hay ni una pared: todas las esquinas siguen recto y todas son falsas. Tu condicion sigue siendo la misma, y la mitad de la pared no se usa ni una vez. Y aun asi hay que dejarla.',
    exito:
      'La mitad de la pared no ha hecho nada hoy. Manana si. Una condicion se escribe para todos los casos, no para el de hoy.',
    pistas: ['El programa no cambia.', 'Solo hay que contar las casillas del camino bueno.'],
    tramos: laberinto(['senuelo', 'senuelo', 'senuelo', 'senuelo']),
    modo: 'o',
  },
  {
    nombre: 'El verde es el bueno',
    instruccion:
      'Ahora al contrario. El pasillo bueno esta pintado de verde y los desvios falsos no. La regla es: si hay camino delante Y el suelo es verde, avanza. Si no se cumplen las dos cosas, gira.',
    exito:
      'Las dos cosas a la vez. El Y es mas exigente que el O: le tienen que decir si las dos mitades.',
    pistas: [
      'La pieza de Y tiene dos huecos: puedes avanzar, y la casilla es verde.',
      'En la otra boca de la decision van girar y avanzar.',
    ],
    tramos: laberinto(['pared', 'senuelo']),
    modo: 'y',
  },
  {
    nombre: 'Donde se acaba el verde',
    instruccion:
      'Fijate en las dos formas de fallar el Y: o se acaba el pasillo, o se acaba el verde. Las dos significan girar, y por eso caben en la misma condicion.',
    exito: 'Dos maneras de fallar y una sola condicion. Un Y falla si falla cualquiera de sus mitades.',
    pistas: ['El verde marca por donde se sigue recto.', 'Cuenta las casillas del camino verde mas la meta.'],
    tramos: laberinto(['senuelo', 'pared', 'senuelo']),
    modo: 'y',
  },
  {
    nombre: 'El laberinto verde',
    instruccion: 'Seis esquinas y el mismo programa de cinco piezas. Solo cambia el numero.',
    exito: 'Seis esquinas con cinco piezas. El programa no ha crecido nada.',
    pistas: ['No cambies la condicion.', 'Suma las casillas del camino.'],
    tramos: laberinto(['pared', 'senuelo', 'senuelo', 'pared', 'senuelo', 'pared']),
    modo: 'y',
  },
  {
    nombre: 'Verde hasta el final',
    instruccion:
      'Un laberinto largo donde casi todo es verde. Los desvios son pocos y estan escondidos.',
    exito: 'Encontrado. Cuando casi todo es verde, lo que no es verde salta a la vista. Eso lo sabia Dedalo.',
    pistas: ['El programa es el mismo.', 'Ve contando por tramos y no te dejes ninguno.'],
    tramos: laberinto(['pared', 'pared', 'senuelo', 'pared', 'pared']),
    modo: 'y',
  },
  {
    nombre: 'Sin ninguna pared',
    instruccion:
      'Este laberinto tampoco tiene paredes: todos los pasillos siguen. Aqui la mitad del puede avanzar no sirve nunca, y la del verde lo decide todo.',
    exito:
      'El mismo programa con la otra mitad haciendo el trabajo. Un Y no sabe cual de sus dos mitades va a fallar, y no le hace falta.',
    pistas: ['El programa no cambia.', 'Todas las esquinas son desvios falsos.'],
    tramos: laberinto(['senuelo', 'senuelo', 'senuelo', 'senuelo']),
    modo: 'y',
  },
  {
    nombre: 'Ocho esquinas rojas',
    instruccion: 'Vuelta al O, y ahora con ocho esquinas. Este es el laberinto grande de Dedalo.',
    exito: 'Ocho esquinas. Dedalo ha sacado el mapa para comprobar que no te has saltado ninguna.',
    pistas: ['El programa del O, el de cinco piezas.', 'Cuenta los tramos del camino bueno de uno en uno.'],
    tramos: laberinto(['senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared']),
    modo: 'o',
  },
  {
    nombre: 'El laberinto de los dos programas',
    instruccion:
      'Este se puede resolver con el O y con el Y, porque tiene el suelo pintado de las dos formas. Usa el del Y: es el que no depende de acordarse de que color significa que.',
    exito:
      'Con el Y. Los dos llegaban. El del verde dice por donde se va, y el del rojo dice por donde no: es mas facil equivocarse leyendo prohibiciones.',
    pistas: ['El programa del Y, el del verde.', 'Cuenta las casillas del camino.'],
    tramos: laberinto(['senuelo', 'pared', 'senuelo', 'pared']),
    modo: 'y',
  },
  {
    nombre: 'Diez esquinas',
    instruccion: 'El laberinto mas largo hasta ahora. Diez esquinas y el mismo programa de siempre.',
    exito: 'Diez esquinas con cinco piezas. Este es el tipo de programa que se escribe una vez y se usa toda la vida.',
    pistas: ['No toques la condicion.', 'Ve sumando tramo a tramo y apunta el total antes de escribirlo.'],
    tramos: laberinto(['pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo']),
    modo: 'y',
  },
  {
    nombre: 'La condicion incompleta',
    instruccion:
      'Prueba una cosa antes de resolverlo: quita la mitad del verde y deja solo puedes avanzar. Veras al Fuzz meterse en el primer pasillo falso. Luego pon la condicion entera. Saber por que falla algo vale mas que arreglarlo.',
    exito:
      'Con las dos mitades. Una condicion a la que le falta una parte no falla siempre: falla solo cuando llega el caso que esa parte cubria, y por eso es dificil de encontrar.',
    pistas: [
      'La condicion entera es: puedes avanzar Y la casilla es verde.',
      'Los pasillos falsos son los que delata el verde, no la pared.',
    ],
    tramos: laberinto(['senuelo', 'pared', 'senuelo', 'senuelo', 'pared']),
    modo: 'y',
  },
  {
    nombre: 'Rojo o azul',
    instruccion:
      'Dedalo ha pintado las esquinas de dos colores distintos, rojo y azul, y las dos significan lo mismo: gira. Con un O se dice en una sola condicion.',
    exito:
      'Dos colores y una sola condicion. Sin el O tendrias que poner dos decisiones seguidas, y serian dos piezas mas.',
    pistas: [
      'En los dos huecos del O van dos preguntas de color.',
      'Da igual el orden: rojo o azul es lo mismo que azul o rojo.',
    ],
    tramos: laberinto(['senuelo', 'senuelo', 'senuelo']),
    modo: 'dosColores',
  },
  {
    nombre: 'Seis esquinas de dos colores',
    instruccion: 'Los dos colores alternos, seis esquinas. El programa no cambia.',
    exito: 'Seis esquinas de dos colores. Ya no distingues entre colores: distingues entre girar y seguir.',
    pistas: ['El programa del O de colores.', 'Cuenta las casillas del camino.'],
    tramos: laberinto(['senuelo', 'senuelo', 'senuelo', 'senuelo', 'senuelo', 'senuelo']),
    modo: 'dosColores',
  },
  {
    nombre: 'El mapa de Dedalo',
    instruccion:
      'Dedalo dice que su mapa esta mal desde la noche de la tormenta. Que el laberinto tiene un pasillo que el no dibujo, y que sale hacia arriba. Ve a verlo.',
    exito:
      'Me lo ensenó. Es un pasillo estrecho que sube y se corta de golpe, y las paredes estan raspadas por dentro, como si algo hubiera pasado por ahi apretando. Dedalo dice que el laberinto no tenia salida por arriba. Ahora la tiene.',
    pistas: ['El programa del O de colores.', 'Ocho esquinas, todas marcadas.'],
    tramos: laberinto(['senuelo', 'senuelo', 'senuelo', 'senuelo', 'senuelo', 'senuelo', 'senuelo', 'senuelo']),
    modo: 'dosColores',
  },
  {
    nombre: 'El pasillo que sube',
    instruccion:
      'Este es el pasillo que Dedalo no dibujo. Mezcla las dos clases de esquina y es el mas largo del laberinto. Usa el programa del Y.',
    exito:
      'Al final del pasillo hay una marca en la pared: un circulo con tres rayas dentro. La misma que la placa de Garfio. Nadie de los Creadores ha estado nunca en la Bahia de los Piratas.',
    pistas: ['El programa del Y, el del verde.', 'Suma con calma: son muchos tramos.'],
    tramos: laberinto(['pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared']),
    modo: 'y',
  },
  {
    nombre: 'Doce esquinas',
    instruccion:
      'El laberinto entero de una vez, con las dos clases de esquina y doce giros. Si te sale a la primera, Dedalo quiere tu mapa.',
    exito: 'Doce esquinas. Dedalo dice que el necesito tres intentos y que no lo cuentes.',
    pistas: ['No cambies la condicion, solo cuenta bien.', 'Apunta el total en un papel antes de escribirlo.'],
    tramos: laberinto(['senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared']),
    modo: 'y',
  },
  {
    nombre: 'Donde esta Dedalo',
    instruccion:
      'Ultimo del laberinto. Dedalo esta en el centro con el mapa desplegado en el suelo, dibujando el pasillo nuevo. Ve a por el.',
    exito:
      'Dedalo esta en casa, y ha traido el mapa. Lo ha colgado en la pared del Nido, al lado de la antorcha de Llama. En el mapa, el pasillo nuevo esta dibujado con una linea de puntos, porque dice que las cosas que no entiende las dibuja asi.',
    pistas: [
      'El programa del O con las dos razones, pared o rojo.',
      'Diez esquinas mezcladas. Cuenta despacio.',
    ],
    tramos: laberinto(['pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo', 'pared', 'senuelo']),
    modo: 'o',
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 15,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const camino =
    receta.modo === 'y'
      ? caminoY(receta.tramos)
      : receta.modo === 'dosColores'
        ? caminoDosColores(receta.tramos)
        : caminoO(receta.tramos);

  const solucion =
    receta.modo === 'y'
      ? programaY(receta.tramos)
      : receta.modo === 'dosColores'
        ? programaDosColores(receta.tramos)
        : programaO(receta.tramos);

  return actividadCreador(contexto, {
    camino,
    bloques: BLOQUES,
    solucion,
    // Las dos mitades de la condicion son el objetivo del mundo, asi que la
    // tercera estrella exige que la condicion sea compuesta.
    exigeEstructuras: ['repetir', 'si', 'sino', 'logica', 'siColor'],
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 100 : undefined,
  });
});

export const mundo15: WorldContentFile = {
  mundo: 15,
  slug: 'laberinto-isometrico',
  nombre: 'El Laberinto Isometrico',
  introTexto:
    'Dedalo dibujo el mapa de este laberinto y dice que nunca se ha perdido. Aqui hay pasillos que siguen recto y no llevan a ninguna parte, asi que preguntar si puedes avanzar ya no basta: hace falta preguntar dos cosas a la vez. Si hay pared O el suelo es rojo, gira. Si hay camino Y el suelo es verde, avanza. Dos preguntas en una sola condicion, y las dos hacen falta.',
  actividades,
};
