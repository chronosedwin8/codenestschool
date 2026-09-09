/**
 * Mundo 11: El Reino de Cristal. El primer mundo de bloques.
 *
 * Este mundo tiene dos trabajos y el segundo es el difícil.
 *
 * El primero es presentar el bucle en bloques, que el niño ya conoce de las
 * fichas. Eso es casi gratis: la ficha de repetir y el bloque de repetir se
 * parecen a propósito.
 *
 * El segundo es cambiar la forma de moverse, y ahí hay un salto conceptual que
 * los adultos suelen no ver. Hasta el mundo 10 las flechas eran absolutas: la
 * flecha de la derecha llevaba al Fuzz a la derecha, siempre, mirara donde
 * mirara. Aquí hay una sola pieza de avanzar y dos de girar, así que el
 * significado de "avanzar" depende del estado del Fuzz. Es la primera vez que el
 * niño tiene que llevar en la cabeza algo que el tablero no le muestra.
 *
 * Por eso las nueve primeras actividades no llevan bucle. Se dedican entera y
 * exclusivamente a que girar se entienda, con caminos que giran a un lado y al
 * otro, y con dos giros seguidos que dan media vuelta. El bucle llega cuando
 * mover ya no cuesta.
 *
 * Progresión:
 *   1-3    avanzar. Un pasillo y un giro.
 *   4-6    girar a los dos lados, y dos giros seguidos.
 *   7-10   el bloque de repetir. Un camino largo con dos piezas.
 *   11-14  varios bloques dentro del bucle: la C, la escalera.
 *   15-17  un bucle dentro de otro.
 *   18-20  saltos, cristales que recoger, y el rescate de Prisma.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  brinca,
  estrellaAqui,
  gira,
  girarDerecha,
  girarIzquierda,
  repetir,
  saltar,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

/** Solo avanzar: el primer contacto con el movimiento relativo. */
const SOLO_ANDAR = ['avanzar'];
const CON_GIROS = ['avanzar', 'girarDerecha', 'girarIzquierda'];
const CON_BUCLE = [...CON_GIROS, 'repetir'];
const CON_SALTO = [...CON_BUCLE, 'saltar'];

/** Repite un trozo de camino: el patrón que el bucle va a resolver. */
function ciclo(veces: number, ...pasos: PasoCamino[]): PasoCamino[] {
  const salida: PasoCamino[] = [];
  for (let i = 0; i < veces; i++) salida.push(...pasos);
  return salida;
}

/** Avanzar varias veces sin bucle, para los primeros niveles. */
function pasos(veces: number): Bloque[] {
  return Array.from({ length: veces }, () => avanzar());
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly bloques: readonly string[];
  readonly solucion: readonly Bloque[];
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La pieza de avanzar',
    instruccion:
      'Bienvenido al Reino de Cristal. Aqui las fichas se acabaron: ahora tienes piezas que se enganchan unas debajo de otras. Y hay una diferencia importante, fijate: esta pieza no dice a la derecha. Dice avanzar, y el Fuzz avanza hacia donde este mirando.',
    exito:
      'Cuatro piezas enganchadas. Parecen fichas, pero no lo son: una ficha decia a donde ir y una pieza dice que hacer. La diferencia se va a notar en un momento.',
    pistas: [
      'Arrastra la pieza de avanzar y engancha otra debajo.',
      'Cuenta las casillas del camino: son cuatro.',
    ],
    camino: [andar(4)],
    bloques: SOLO_ANDAR,
    solucion: pasos(4),
  },
  {
    nombre: 'Aqui hay que girar',
    instruccion:
      'El camino gira. Y aqui viene lo nuevo: no existe una pieza para ir hacia abajo. Existe una pieza para GIRAR al Fuzz, y despues avanzar te lleva hacia donde acabe mirando.',
    exito:
      'Has girado al Fuzz y despues has avanzado. Ese es todo el truco de este mundo, y es el que cambia como piensas.',
    pistas: [
      'Avanza hasta la esquina, y ahi gira a la derecha.',
      'Despues de girar, avanzar ya lleva hacia abajo.',
    ],
    camino: [andar(3), gira('derecha'), andar(3)],
    bloques: CON_GIROS,
    solucion: [...pasos(3), girarDerecha(), ...pasos(3)],
  },
  {
    nombre: 'Y ahora al otro lado',
    instruccion: 'El mismo camino al espejo. Si el otro giraba a la derecha, este gira al otro lado.',
    exito: 'Los dos giros. Uno hacia cada lado, y el Fuzz no se ha quejado ni una vez.',
    pistas: ['Avanza hasta la esquina.', 'Ahi gira a la izquierda y sigue.'],
    camino: [andar(3), gira('izquierda'), andar(3)],
    bloques: CON_GIROS,
    solucion: [...pasos(3), girarIzquierda(), ...pasos(3)],
  },
  {
    nombre: 'Dos giros',
    instruccion:
      'Dos esquinas, y no van al mismo lado. Ve despacio: pon las piezas de tres en tres y comprueba antes de seguir.',
    exito: 'Dos esquinas seguidas sin liarte. Lo de girar ya no te frena.',
    pistas: ['La primera esquina gira a la derecha.', 'La segunda vuelve a la izquierda.'],
    camino: [andar(2), gira('derecha'), andar(2), gira('izquierda'), andar(2)],
    bloques: CON_GIROS,
    solucion: [
      ...pasos(2),
      girarDerecha(),
      ...pasos(2),
      girarIzquierda(),
      ...pasos(2),
    ],
  },
  {
    nombre: 'Media vuelta',
    instruccion:
      'Prueba una cosa: pon dos giros del mismo lado, uno detras del otro. El Fuzz acaba mirando justo al contrario de donde empezo. Eso es media vuelta, y aqui la necesitas.',
    exito:
      'Dos giros iguales son media vuelta. Un dato pequeno que vas a usar durante veinte mundos.',
    pistas: [
      'El camino baja y luego vuelve hacia la izquierda.',
      'Dos giros a la derecha dejan al Fuzz mirando al contrario.',
    ],
    camino: [andar(3), gira('derecha'), andar(2), gira('derecha'), andar(3)],
    bloques: CON_GIROS,
    solucion: [
      ...pasos(3),
      girarDerecha(),
      ...pasos(2),
      girarDerecha(),
      ...pasos(3),
    ],
  },
  {
    nombre: 'El zigzag de cristal',
    instruccion:
      'Cuatro esquinas. Con piezas sueltas te van a hacer falta doce. Mientras las pones, mira si ves algo que se repite: te va a servir dentro de un momento.',
    exito:
      'Doce piezas. Y seguro que has visto el patron: avanza, gira, avanza, gira al otro lado. Manana no vas a necesitar doce.',
    pistas: ['Ve esquina por esquina.', 'Cada esquina cambia de lado: derecha, izquierda, derecha.'],
    camino: ciclo(3, andar(1), gira('derecha'), andar(1), gira('izquierda')),
    bloques: CON_GIROS,
    // A proposito sin bucle: el patron se escribe entero para que el niño note
    // cuanto pesa, y en la actividad diez lo resuelve con cinco piezas.
    solucion: Array.from({ length: 3 }, () => [
      avanzar(),
      girarDerecha(),
      avanzar(),
      girarIzquierda(),
    ]).flat(),
  },
  {
    nombre: 'La pieza que repite',
    instruccion:
      'Mira esta pieza nueva: tiene una boca. Lo que metas dentro lo hace tantas veces como diga su numero. Este pasillo tiene seis casillas y tu programa va a tener dos piezas.',
    exito:
      'Dos piezas para seis casillas. Es la misma idea que la ficha de repetir de los pequenos, con otra forma.',
    pistas: [
      'Mete la pieza de avanzar DENTRO de la boca de la pieza de repetir.',
      'Y pon un seis en su numero.',
    ],
    camino: [andar(6)],
    bloques: CON_BUCLE,
    solucion: [repetir(6, avanzar())],
  },
  {
    nombre: 'Nueve casillas',
    instruccion: 'Mas largo, y el programa no crece. Solo cambia el numero.',
    exito: 'Nueve casillas, dos piezas. Cambiar un numero es mas rapido que enganchar nueve piezas.',
    pistas: ['El programa es el mismo de antes.', 'Cuenta las casillas: nueve.'],
    camino: [andar(9), estrellaAqui()],
    bloques: CON_BUCLE,
    solucion: [repetir(9, avanzar())],
  },
  {
    nombre: 'La C de cristal',
    instruccion:
      'Ahora dentro de la boca caben varias piezas. Este camino da tres vueltas iguales: avanza dos y gira. Metelo todo dentro.',
    exito:
      'Tres piezas dentro de la boca y una fuera. Nueve movimientos con cuatro piezas.',
    pistas: [
      'Dentro de la boca van: avanzar, avanzar y girar a la derecha.',
      'Y el numero de la pieza es tres.',
    ],
    camino: ciclo(3, andar(2), gira('derecha')),
    bloques: CON_BUCLE,
    solucion: [repetir(3, avanzar(), avanzar(), girarDerecha())],
  },
  {
    nombre: 'La escalera',
    instruccion:
      'El zigzag de antes, el de las doce piezas. Ahora mira el patron: avanza, gira a la derecha, avanza, gira a la izquierda. Cuatro piezas dentro de la boca y ya esta.',
    exito:
      'Cinco piezas donde antes hicieron falta doce. Esto es lo que hace un bucle: no ahorra movimientos, ahorra programa.',
    pistas: [
      'El patron son cuatro piezas: avanzar, girar derecha, avanzar, girar izquierda.',
      'Se repite tres veces.',
    ],
    camino: ciclo(3, andar(1), gira('derecha'), andar(1), gira('izquierda')),
    bloques: CON_BUCLE,
    solucion: [repetir(3, avanzar(), girarDerecha(), avanzar(), girarIzquierda())],
  },
  {
    nombre: 'Escalera larga',
    instruccion: 'La misma escalera, seis veces. Cuenta los escalones antes de escribir el numero.',
    exito: 'Seis escalones y cinco piezas. El programa no ha crecido nada.',
    pistas: ['El patron no cambia.', 'Cuenta los escalones: son seis.'],
    camino: ciclo(6, andar(1), gira('derecha'), andar(1), gira('izquierda')),
    bloques: CON_BUCLE,
    solucion: [repetir(6, avanzar(), girarDerecha(), avanzar(), girarIzquierda())],
  },
  {
    nombre: 'Cristales por el camino',
    instruccion:
      'Prisma ha dejado cristales sueltos por el camino. No hace falta ninguna pieza para cogerlos: se recogen al pisarlos. Pero tienes que pasar por encima de todos.',
    exito: 'Los tres cristales. Prisma dice que los habia pulido esta manana y que se le cayeron.',
    pistas: ['El patron es el de la C: avanzar dos veces y girar.', 'Cuatro vueltas.'],
    camino: [
      andar(2),
      estrellaAqui(),
      gira('derecha'),
      andar(2),
      estrellaAqui(),
      gira('derecha'),
      andar(2),
      estrellaAqui(),
      gira('derecha'),
      andar(2),
      gira('derecha'),
    ],
    bloques: CON_BUCLE,
    solucion: [repetir(4, avanzar(), avanzar(), girarDerecha())],
  },
  {
    nombre: 'La espiral',
    instruccion:
      'Este camino da la vuelta entera tres veces, y cada tramo mide cuatro. Podrias poner el avanzar cuatro veces dentro de la boca. O podrias poner otra pieza de repetir dentro. Prueba lo segundo.',
    exito:
      'Una pieza de repetir dentro de otra. La de dentro cuenta las casillas del tramo y la de fuera cuenta los tramos.',
    pistas: [
      'Dentro de la boca grande pon otra pieza de repetir con el avanzar dentro.',
      'La de dentro va a cuatro y la de fuera a tres.',
    ],
    camino: ciclo(3, andar(4), gira('derecha')),
    bloques: CON_BUCLE,
    solucion: [repetir(3, repetir(4, avanzar()), girarDerecha())],
  },
  {
    nombre: 'Cual va dentro',
    instruccion:
      'Otra vez dos bucles, uno dentro del otro, y los numeros cambian. Piensalo antes de tocar: cual cuenta las casillas y cual cuenta las esquinas?',
    exito: 'El de dentro cuenta casillas y el de fuera esquinas. Si los cambias de sitio, el Fuzz se estrella.',
    pistas: ['Cuenta las casillas de UN tramo: cinco.', 'Cuenta los tramos: tres.'],
    camino: ciclo(3, andar(5), gira('derecha')),
    bloques: CON_BUCLE,
    solucion: [repetir(3, repetir(5, avanzar()), girarDerecha())],
  },
  {
    nombre: 'Dos bucles dentro',
    instruccion:
      'Dentro de la boca grande caben dos bucles seguidos. Este camino avanza mucho, gira, avanza poco y vuelve a girar.',
    exito: 'Dos bucles dentro de uno. Tu programa tiene tres pisos y sigue cabiendo en la pantalla.',
    pistas: [
      'Un bucle para el tramo largo y otro para el corto, los dos dentro del grande.',
      'Entre cada dos, un giro.',
    ],
    camino: ciclo(2, andar(4), gira('derecha'), andar(2), gira('derecha')),
    bloques: CON_BUCLE,
    solucion: [
      repetir(
        2,
        repetir(4, avanzar()),
        girarDerecha(),
        repetir(2, avanzar()),
        girarDerecha(),
      ),
    ],
  },
  {
    nombre: 'El puente de cristal',
    instruccion:
      'Un cristal roto en el camino. La pieza de saltar pasa por encima, igual que la ficha de saltar de los pequenos: salta hacia donde mira el Fuzz.',
    exito: 'Saltando por encima del cristal roto. Prisma dice que ese lo pulio demasiado.',
    pistas: ['Avanza hasta el borde y usa la pieza de saltar.', 'Despues del salto sigue el camino.'],
    camino: [andar(2), brinca(), andar(2)],
    bloques: CON_SALTO,
    solucion: [...pasos(2), saltar(), ...pasos(2)],
  },
  {
    nombre: 'Cuatro cristales rotos',
    instruccion:
      'Cuatro huecos, todos a la misma distancia. Un bucle con dos piezas dentro resuelve los cuatro.',
    exito: 'Tres piezas para ocho movimientos. Prisma esta tomando notas.',
    pistas: ['Dentro del bucle: avanzar y saltar.', 'Cuatro veces.'],
    camino: ciclo(4, andar(1), brinca()),
    bloques: CON_SALTO,
    solucion: [repetir(4, avanzar(), saltar())],
  },
  {
    nombre: 'Saltos y esquinas',
    instruccion:
      'Huecos y giros en el mismo camino. El patron es mas largo, pero es un patron: buscalo entero antes de escribir nada.',
    exito: 'Saltos y giros en la misma boca. Ya no distingues entre tipos de pieza: solo ves el patron.',
    pistas: [
      'El patron es: avanzar, saltar, girar a la derecha.',
      'Se repite cuatro veces.',
    ],
    camino: ciclo(4, andar(1), brinca(), gira('derecha')),
    bloques: CON_SALTO,
    solucion: [repetir(4, avanzar(), saltar(), girarDerecha())],
  },
  {
    nombre: 'Lo que se ve en el cristal',
    instruccion:
      'Prisma pule los puentes de cristal hasta que se ve todo reflejado, y dice que desde la noche de la tormenta hay algo que se refleja y que no esta. Llega hasta ella y te lo ensena.',
    exito:
      'Nos pusimos las dos a mirar el cristal. Y ahi estaba: una luz alargada cruzando el cielo, muy arriba. Levante la cabeza y en el cielo no habia nada. El cristal refleja lo que paso, dice Prisma. Y lo repite hasta que sale perfecto.',
    pistas: [
      'La primera parte es una espiral: un bucle dentro de otro.',
      'La segunda son saltos: otro bucle con avanzar y saltar dentro.',
    ],
    camino: [...ciclo(2, andar(3), gira('derecha')), ...ciclo(3, andar(1), brinca())],
    bloques: CON_SALTO,
    solucion: [
      repetir(2, repetir(3, avanzar()), girarDerecha()),
      repetir(3, avanzar(), saltar()),
    ],
  },
  {
    nombre: 'Donde esta Prisma',
    instruccion:
      'Ultimo del reino. Prisma esta al fondo, puliendo el mismo cristal desde hace once dias porque dice que aun no esta perfecto. Ve a por ella. El camino tiene tres partes y las tres son cosas que ya sabes.',
    exito:
      'Prisma esta en casa, y se ha traido el cristal. Lo dejo apoyado en la pared del Nido, mirando al cielo. Por si acaso, dijo.',
    pistas: [
      'Primero dos vueltas de la espiral, y luego un tramo recto con su giro.',
      'Despues los saltos, y al final un tramo largo de una sola tirada.',
    ],
    // La espiral se queda en tres tramos y despues el camino se va en linea
    // recta: con un tramo mas volveria sobre la salida y el salto abriria un
    // agujero justo debajo del Fuzz.
    camino: [
      ...ciclo(2, andar(2), gira('derecha')),
      andar(2),
      gira('izquierda'),
      ...ciclo(2, andar(1), brinca()),
      gira('izquierda'),
      andar(4),
      estrellaAqui(),
    ],
    bloques: CON_SALTO,
    solucion: [
      repetir(2, repetir(2, avanzar()), girarDerecha()),
      repetir(2, avanzar()),
      girarIzquierda(),
      repetir(2, avanzar(), saltar()),
      girarIzquierda(),
      repetir(4, avanzar()),
    ],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 11,
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
    bloques: receta.bloques,
    solucion: receta.solucion,
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 80 : undefined,
  });
});

export const mundo11: WorldContentFile = {
  mundo: 11,
  slug: 'reino-de-cristal',
  nombre: 'El Reino de Cristal',
  introTexto:
    'En el Reino de Cristal se acaban las fichas y empiezan las piezas, que se enganchan unas debajo de otras. Y cambia algo mas importante: ya no hay una pieza para cada direccion. Hay una pieza de avanzar y dos de girar, asi que avanzar significa una cosa distinta segun donde este mirando el Fuzz. Prisma vive aqui puliendo los puentes hasta que se ven perfectos, y dice que en el cristal se refleja algo que ya no esta.',
  actividades,
};
