/**
 * Mundo 12: Las Cuevas Mecánicas. Variables que cuentan.
 *
 * Una variable es difícil de justificar en un juego de movimiento, y conviene ser
 * honesto sobre eso al diseñar el mundo. Si el tramo mide cuatro casillas, poner
 * un cuatro y poner una variable que vale cuatro cuestan lo mismo, y la variable
 * encima obliga a crearla. Contada en piezas, la variable pierde.
 *
 * Gana en un solo caso, y de ahí sale este mundo entero: cuando el número tiene
 * que CAMBIAR mientras el programa corre. Un camino cuyos tramos crecen (uno, dos,
 * tres, cuatro) no se puede hacer con un bucle y un número, porque el número no es
 * el mismo cada vez. Con una variable que suma uno en cada vuelta son diez piezas;
 * escrito a mano, veinticuatro.
 *
 * Por eso el orden es este: primero la variable como nombre de un número, que es
 * fácil y todavía no sirve de nada, y el texto lo dice sin disimular. Después la
 * variable que crece, que es donde el niño ve para qué era. Y al final dos
 * variables a la vez.
 *
 * Un detalle de implementación que hizo falta para este mundo: el bloque de
 * repetir llevaba el número escrito dentro, así que ninguna variable podía
 * gobernarlo. Ahora el número va en un hueco, y ahí encaja un número, una variable
 * o una cuenta.
 *
 * Progresión:
 *   1-3    darle un nombre a un número. Cambiarlo en un sitio y que cambie en tres.
 *   4-6    cuentas con la variable: uno más, uno menos, el doble.
 *   7-11   la variable que crece. Espirales y escaleras que se abren.
 *   12-15  la variable que baja, y la que cuenta lo recogido.
 *   16-18  dos variables a la vez.
 *   19-20  las cuentas de Tuerca.
 */
import {
  actividadCreador,
  andar,
  avanzar,
  estrellaAqui,
  gira,
  girarDerecha,
  girarIzquierda,
  mas,
  menos,
  num,
  pon,
  repetir,
  suma,
  vble,
  type Bloque,
  type ContextoCreador,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const CON_VARIABLES = ['avanzar', 'girarDerecha', 'girarIzquierda', 'repetir', 'variable'];

/** Repite un trozo de camino. */
function ciclo(veces: number, ...pasos: PasoCamino[]): PasoCamino[] {
  const salida: PasoCamino[] = [];
  for (let i = 0; i < veces; i++) salida.push(...pasos);
  return salida;
}

/**
 * Un camino de tramos que cambian de largo, girando siempre al mismo lado.
 *
 * Es la geometría de este mundo: la que un bucle con un número fijo no puede
 * recorrer. `largos` dice cuánto mide cada tramo, en orden.
 */
function espiral(largos: readonly number[], lado: 'derecha' | 'izquierda' = 'derecha'): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  largos.forEach((largo, i) => {
    pasos.push(andar(largo));
    // El ultimo tramo no necesita giro: el Fuzz ya esta en la meta.
    if (i < largos.length - 1) pasos.push(gira(lado));
  });
  return pasos;
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly solucion: readonly Bloque[];
  readonly bloques?: readonly string[];
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Un nombre para un numero',
    instruccion:
      'Tuerca cuenta todo lo que ve y lo apunta. En estas cuevas hay una pieza nueva para eso: una caja con un nombre donde guardas un numero. Hoy vas a hacer algo que parece tonto: llamar largo al cuatro y usarlo. Manana veras para que era.',
    exito:
      'Ya esta. Y si, ha costado dos piezas mas que poner un cuatro. Aguanta tres actividades y lo entenderas.',
    pistas: [
      'Primero crea la caja y pon un cuatro dentro.',
      'Luego arrastra la caja al hueco del numero de la pieza de repetir.',
    ],
    camino: [andar(4)],
    solucion: [pon('largo', num(4)), repetir(vble('largo'), avanzar())],
  },
  {
    nombre: 'El mismo numero tres veces',
    instruccion:
      'Tres tramos y los tres miden lo mismo. Puedes escribir el tres en tres sitios, o escribirlo una vez en la caja y usar la caja tres veces. Fijate en la diferencia: si luego quieres cambiarlo, en un caso cambias tres numeros y en el otro cambias uno.',
    exito:
      'Un numero en un solo sitio. Eso no se nota hoy, se nota el dia que hay que cambiarlo.',
    pistas: ['Crea la caja con un tres dentro.', 'Usa la caja en los tres bucles.'],
    camino: espiral([3, 3, 3]),
    solucion: [
      pon('largo', num(3)),
      repetir(vble('largo'), avanzar()),
      girarDerecha(),
      repetir(vble('largo'), avanzar()),
      girarDerecha(),
      repetir(vble('largo'), avanzar()),
    ],
  },
  {
    nombre: 'Cuatro tramos iguales',
    instruccion:
      'Ahora son cuatro tramos, y aqui ya puedes ahorrar de verdad: mete el bucle del tramo y el giro dentro de otro bucle. La caja va dentro del bucle pequeno.',
    exito:
      'Una caja, dos bucles y cuatro tramos. Empieza a tener sentido.',
    pistas: [
      'El bucle de fuera se repite cuatro veces.',
      'Dentro van el bucle del tramo, con la caja en su numero, y el giro.',
    ],
    camino: [...ciclo(3, andar(2), gira('derecha')), andar(2)],
    solucion: [
      pon('largo', num(2)),
      repetir(4, repetir(vble('largo'), avanzar()), girarDerecha()),
    ],
  },
  {
    nombre: 'Uno mas',
    instruccion:
      'Aqui el segundo tramo mide uno mas que el primero. Con la caja no hace falta otro numero: se puede pedir la caja mas uno.',
    exito:
      'La caja mas uno. Una caja no solo guarda un numero: puedes hacer cuentas con ella.',
    pistas: ['El primer tramo usa la caja.', 'El segundo usa la caja mas uno.'],
    camino: espiral([3, 4]),
    solucion: [
      pon('largo', num(3)),
      repetir(vble('largo'), avanzar()),
      girarDerecha(),
      repetir(mas(vble('largo'), num(1)), avanzar()),
    ],
  },
  {
    nombre: 'Uno menos',
    instruccion: 'Y al contrario: este tramo mide uno menos. La misma idea con la resta.',
    exito: 'Mas uno y menos uno. Con una caja y dos cuentas has hecho tres tramos distintos.',
    pistas: ['El tramo del medio es la caja menos uno.', 'El ultimo vuelve a ser la caja.'],
    camino: espiral([4, 3, 4]),
    solucion: [
      pon('largo', num(4)),
      repetir(vble('largo'), avanzar()),
      girarDerecha(),
      repetir(menos(vble('largo'), num(1)), avanzar()),
      girarDerecha(),
      repetir(vble('largo'), avanzar()),
    ],
  },
  {
    nombre: 'Cambiar un numero y cambiarlo todo',
    instruccion:
      'Este camino tiene cuatro tramos que dependen todos de la caja: uno igual, uno mas uno, uno mas dos. Si la caja valiera otra cosa, el camino entero cambiaria. Eso es lo que hace util una caja.',
    exito:
      'Cuatro tramos gobernados por un solo numero. Tuerca dice que asi lleva ella las cuentas del Nido.',
    pistas: [
      'La caja vale dos. Los tramos son la caja, la caja mas uno y la caja mas dos.',
      'Ve tramo por tramo comprobando antes de seguir.',
    ],
    camino: espiral([2, 3, 4, 2]),
    solucion: [
      pon('largo', num(2)),
      repetir(vble('largo'), avanzar()),
      girarDerecha(),
      repetir(mas(vble('largo'), num(1)), avanzar()),
      girarDerecha(),
      repetir(mas(vble('largo'), num(2)), avanzar()),
      girarDerecha(),
      repetir(vble('largo'), avanzar()),
    ],
  },
  {
    nombre: 'La caja que crece',
    instruccion:
      'Mira bien este camino: uno, dos, tres, cuatro. Cada tramo mide uno mas que el anterior. Un bucle con un numero no puede hacerlo, porque el numero no es el mismo cada vez. Pero una caja si: se le suma uno en cada vuelta.',
    exito:
      'Ahi esta. Para esto era la caja. El numero cambia mientras el programa corre, y eso ningun bucle con un numero fijo lo puede hacer.',
    pistas: [
      'Dentro del bucle grande: el bucle del tramo con la caja, el giro, y sumarle uno a la caja.',
      'La caja empieza valiendo uno.',
    ],
    camino: espiral([1, 2, 3, 4]),
    solucion: [
      pon('largo', num(1)),
      repetir(
        4,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(1)),
      ),
    ],
  },
  {
    nombre: 'Seis tramos que crecen',
    instruccion:
      'El mismo truco, dos tramos mas. Y aqui esta lo bueno: tu programa no crece. Solo cambia el numero del bucle grande.',
    exito:
      'Seis tramos y el programa igual de largo. Escrito a mano habrian sido veinticuatro piezas.',
    pistas: ['Es el mismo programa de antes.', 'Cambia solo el numero del bucle de fuera: seis.'],
    camino: espiral([1, 2, 3, 4, 5, 6]),
    solucion: [
      pon('largo', num(1)),
      repetir(
        6,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(1)),
      ),
    ],
  },
  {
    nombre: 'De dos en dos',
    instruccion:
      'Ahora los tramos crecen de dos en dos: dos, cuatro, seis, ocho. Que numero le sumas a la caja en cada vuelta?',
    exito: 'Sumarle dos en vez de uno. La caja crece al ritmo que le digas.',
    pistas: ['La caja empieza en dos.', 'Y en cada vuelta le sumas dos, no uno.'],
    camino: espiral([2, 4, 6, 8]),
    solucion: [
      pon('largo', num(2)),
      repetir(
        4,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(2)),
      ),
    ],
  },
  {
    nombre: 'La espiral al otro lado',
    instruccion: 'La misma espiral girando al contrario. A la caja le da igual el lado.',
    exito: 'Girando al otro lado y con el mismo programa menos una pieza. La caja no sabe de lados.',
    pistas: ['Cambia el giro de la derecha por el de la izquierda.', 'Todo lo demas es igual.'],
    camino: espiral([1, 2, 3, 4, 5], 'izquierda'),
    solucion: [
      pon('largo', num(1)),
      repetir(
        5,
        repetir(vble('largo'), avanzar()),
        girarIzquierda(),
        suma('largo', num(1)),
      ),
    ],
  },
  {
    nombre: 'Gemas por el camino',
    instruccion:
      'Tuerca ha dejado gemas al final de cada tramo, y son justo las que estaba contando cuando llego la tormenta. Pasa por todas.',
    exito: 'Cinco gemas. Tuerca dice que le faltaban dos y que ahora ya no.',
    pistas: ['La espiral que crece de uno en uno.', 'Las gemas estan en las esquinas, asi que no hay que desviarse.'],
    camino: [
      andar(1),
      estrellaAqui(),
      gira('derecha'),
      andar(2),
      estrellaAqui(),
      gira('derecha'),
      andar(3),
      estrellaAqui(),
      gira('derecha'),
      andar(4),
      estrellaAqui(),
      gira('derecha'),
      andar(5),
      estrellaAqui(),
    ],
    solucion: [
      pon('largo', num(1)),
      repetir(
        5,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(1)),
      ),
    ],
  },
  {
    nombre: 'La caja que baja',
    instruccion:
      'Este camino va al contrario: cinco, cuatro, tres, dos, uno. Se cierra en vez de abrirse. Como se le quita uno a una caja?',
    exito:
      'Sumarle menos uno, o restarle uno: da igual como lo digas. La caja baja igual.',
    pistas: ['La caja empieza en cinco.', 'En cada vuelta le sumas menos uno.'],
    camino: espiral([5, 4, 3, 2, 1]),
    solucion: [
      pon('largo', num(5)),
      repetir(
        5,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(-1)),
      ),
    ],
  },
  {
    nombre: 'Abrir y cerrar',
    instruccion:
      'Dos mitades: la primera se abre y la segunda se cierra. Necesitas dos bucles grandes y la misma caja para los dos.',
    exito:
      'La misma caja creciendo y luego bajando. Una caja no se crea otra vez: se cambia.',
    pistas: [
      'El primer bucle grande suma uno en cada vuelta: uno, dos, tres, cuatro.',
      'Para el segundo hay que volver a poner la caja en dos, y entonces resta uno.',
    ],
    // La mitad que cierra no puede deshacer la que abre: una espiral con los
    // largos al espejo vuelve exactamente a la casilla de salida, y entonces la
    // meta cae encima del Fuzz y el nivel se gana sin hacer nada.
    camino: [
      andar(1),
      gira('derecha'),
      andar(2),
      gira('derecha'),
      andar(3),
      gira('derecha'),
      andar(4),
      gira('derecha'),
      andar(2),
      gira('derecha'),
      andar(1),
    ],
    solucion: [
      pon('largo', num(1)),
      repetir(
        4,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(1)),
      ),
      pon('largo', num(2)),
      repetir(
        2,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(-1)),
      ),
    ],
  },
  {
    nombre: 'Escalones que se alargan',
    instruccion:
      'Una escalera donde cada escalon es mas largo que el anterior. Los giros van alternos, uno a cada lado, y la caja crece igual que antes.',
    exito: 'Escalones que crecen. La caja funciona con cualquier forma de camino, no solo con espirales.',
    pistas: [
      'Dentro del bucle grande: el tramo, girar derecha, un paso, girar izquierda, y sumar a la caja.',
      'La caja empieza en uno.',
    ],
    camino: [
      ...ciclo(1, andar(1), gira('derecha'), andar(1), gira('izquierda')),
      ...ciclo(1, andar(2), gira('derecha'), andar(1), gira('izquierda')),
      ...ciclo(1, andar(3), gira('derecha'), andar(1), gira('izquierda')),
      andar(4),
    ],
    solucion: [
      pon('largo', num(1)),
      repetir(
        3,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        avanzar(),
        girarIzquierda(),
        suma('largo', num(1)),
      ),
      repetir(vble('largo'), avanzar()),
    ],
  },
  {
    nombre: 'La cuenta de las vueltas',
    instruccion:
      'Aqui hay dos cajas: una para el largo del tramo y otra que cuenta cuantas vueltas has dado. La segunda no mueve al Fuzz, solo cuenta. Tuerca dice que esas son sus favoritas.',
    exito:
      'Dos cajas a la vez, una que manda y otra que mira. Tuerca ha apuntado el numero final.',
    pistas: [
      'La caja del largo crece en cada vuelta.',
      'La caja de las vueltas empieza en cero y tambien crece, pero no se usa para moverse.',
    ],
    camino: espiral([1, 2, 3, 4]),
    solucion: [
      pon('largo', num(1)),
      pon('vueltas', num(0)),
      repetir(
        4,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(1)),
        suma('vueltas', num(1)),
      ),
    ],
  },
  {
    nombre: 'Una caja que depende de otra',
    instruccion:
      'La caja del ancho vale dos, y la del alto vale el ancho mas uno. Cambia el ancho y cambian las dos.',
    exito:
      'Una caja hecha con otra. Cuando cambies la primera, la segunda cambia sola.',
    pistas: [
      'Crea el ancho con un dos, y el alto con el ancho mas uno.',
      'Luego usa cada caja en su tramo.',
    ],
    camino: espiral([2, 3, 2, 3]),
    solucion: [
      pon('ancho', num(2)),
      pon('alto', mas(vble('ancho'), num(1))),
      repetir(
        2,
        repetir(vble('ancho'), avanzar()),
        girarDerecha(),
        repetir(vble('alto'), avanzar()),
        girarDerecha(),
      ),
    ],
  },
  {
    nombre: 'El rectangulo que se abre',
    instruccion:
      'Dos cajas que crecen a ritmos distintos: el ancho de uno en uno y el alto de dos en dos. Ve despacio y comprueba tramo a tramo.',
    exito: 'Dos cajas, dos ritmos, un solo programa. Este es de los que hay que contar en casa.',
    pistas: [
      'Dentro del bucle grande hay dos tramos y dos giros.',
      'Y al final de la vuelta, cada caja crece lo suyo.',
    ],
    camino: espiral([1, 2, 2, 4, 3, 6]),
    solucion: [
      pon('ancho', num(1)),
      pon('alto', num(2)),
      repetir(
        3,
        repetir(vble('ancho'), avanzar()),
        girarDerecha(),
        repetir(vble('alto'), avanzar()),
        girarDerecha(),
        suma('ancho', num(1)),
        suma('alto', num(2)),
      ),
    ],
  },
  {
    nombre: 'Una crece y otra baja',
    instruccion:
      'Lo mas retorcido de las cuevas: una caja crece y la otra baja, en el mismo bucle. Los tramos se cruzan a la mitad. Piensa cuanto vale cada caja en cada vuelta antes de darle a jugar.',
    exito:
      'Una subiendo y otra bajando a la vez. Si has acertado a la primera, Tuerca quiere hablar contigo.',
    pistas: [
      'El ancho empieza en uno y sube; el alto empieza en cuatro y baja.',
      'En la tercera vuelta las dos valen tres. Comprueba ahi.',
    ],
    camino: espiral([1, 4, 2, 3, 3, 2]),
    solucion: [
      pon('ancho', num(1)),
      pon('alto', num(4)),
      repetir(
        3,
        repetir(vble('ancho'), avanzar()),
        girarDerecha(),
        repetir(vble('alto'), avanzar()),
        girarDerecha(),
        suma('ancho', num(1)),
        suma('alto', num(-1)),
      ),
    ],
  },
  {
    nombre: 'La cuenta que no cuadra',
    instruccion:
      'Tuerca tiene un problema. Dice que conto las gemas del Nido la noche de la tormenta, que habia ciento cuatro, y que a la manana siguiente habia ciento cinco. Una mas. Ve a verla y te lo explica.',
    exito:
      'Ciento cinco, dijo. Y no es que se le colara una gema: es que aparecio algo que no estaba. Lo tiene guardado y no me lo quiso ensenar. Dijo que primero tenia que contar otra vez.',
    pistas: [
      'La espiral que crece de uno en uno, cinco vueltas.',
      'Y al final un tramo suelto que no depende de la caja.',
    ],
    camino: [...espiral([1, 2, 3, 4, 5]), gira('derecha'), andar(3)],
    solucion: [
      pon('largo', num(1)),
      repetir(
        5,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        suma('largo', num(1)),
      ),
      repetir(3, avanzar()),
    ],
  },
  {
    nombre: 'Donde esta Tuerca',
    instruccion:
      'Ultimo de las cuevas. Tuerca esta al fondo con su libreta, contando por decimoquinta vez. El camino usa dos cajas y las dos cambian. Ve a por ella.',
    exito:
      'Tuerca esta en casa, y ha traido la libreta. En la ultima pagina hay una cuenta que no entiendo: ciento cinco menos ciento cuatro igual a uno. Y debajo, subrayado: uno no es cero.',
    pistas: [
      'Dos cajas: una crece de uno en uno y la otra de dos en dos.',
      'Comprueba la primera vuelta entera antes de subir el numero del bucle.',
    ],
    camino: [...espiral([1, 2, 2, 4, 3, 6, 4]), estrellaAqui()],
    solucion: [
      pon('largo', num(1)),
      pon('alto', num(2)),
      repetir(
        3,
        repetir(vble('largo'), avanzar()),
        girarDerecha(),
        repetir(vble('alto'), avanzar()),
        girarDerecha(),
        suma('largo', num(1)),
        suma('alto', num(2)),
      ),
      repetir(vble('largo'), avanzar()),
    ],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoCreador = {
    mundo: 12,
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
    bloques: receta.bloques ?? CON_VARIABLES,
    solucion: receta.solucion,
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 85 : undefined,
  });
});

export const mundo12: WorldContentFile = {
  mundo: 12,
  slug: 'cuevas-mecanicas',
  nombre: 'Las Cuevas Mecanicas',
  introTexto:
    'Tuerca cuenta todo lo que ve y lo apunta en una libreta. En estas cuevas vas a aprender su truco: una caja con un nombre donde guardas un numero. Al principio parece que no sirve de nada, porque poner un cuatro es mas rapido que crear una caja que valga cuatro. Sirve para una cosa que ningun numero puede hacer: cambiar mientras el programa esta corriendo.',
  actividades,
};
