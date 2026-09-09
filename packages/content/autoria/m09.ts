/**
 * Mundo 9: El Valle de los Dinosaurios. Arreglar lo que casi funciona.
 *
 * Los ocho mundos anteriores piden escribir. Este pide leer, que es más difícil y
 * es lo que de verdad se hace cuando uno programa. El programa ya está puesto en
 * la barra, casi funciona, y hay exactamente una ficha mal.
 *
 * El diseño de este mundo es una lista de tipos de error, no una lista de
 * tableros, porque lo que se aprende es a reconocer la forma del fallo:
 *
 *   - una flecha que apunta al otro lado,
 *   - un número de repeticiones de menos, que deja al Fuzz a mitad,
 *   - un número de más, que lo tira por el borde,
 *   - una ficha que falta,
 *   - una ficha que sobra,
 *   - dos fichas cambiadas de orden,
 *   - una ficha mal dentro de una caja, que rompe los cuatro sitios donde se usa,
 *   - y el favorito de todos: las dos ramas del "si" al revés.
 *
 * Los programas roto y bueno no se escriben por separado: el bueno se escribe una
 * vez y el roto se saca de él aplicando el fallo. Así el arreglo es siempre una
 * sola ficha, que es lo que promete la actividad. Y el validador comprueba que el
 * programa entregado falla de verdad: uno que ya funcionara dejaría la actividad
 * sin nada que hacer, y todo lo demás validaría bien.
 *
 * Progresión:
 *   1-2    una flecha al revés. El error más fácil de ver.
 *   3-4    el número del bucle: de menos y de más.
 *   5-7    fichas que faltan, que sobran y que están cambiadas de sitio.
 *   8-13   el fallo dentro de un bucle, y dentro de un bucle dentro de otro.
 *   14-16  el fallo dentro de una caja: se arregla una vez y se arregla en todas.
 *   17-19  el fallo en la ficha que mira. Las dos ramas al revés.
 *   20     el nido de Fosil.
 */
import {
  actividadExplorador,
  caminoDeNubes,
  estrellasEn,
  ir,
  programaDeNubes,
  repite,
  rueda,
  salta,
  saltar,
  tableroDePrograma,
  type Cajas,
  type ContextoExplorador,
  type Movimiento,
  type SegmentoNubes,
} from '../src/generadores-exploradores.js';
import type { Tramo } from '../src/generadores.js';
import type {
  ActivityDefinition,
  ColorCasilla,
  PasoPrograma,
  WorldContentFile,
} from '@codenest/shared';

const COMANDOS = [
  'derecha',
  'izquierda',
  'arriba',
  'abajo',
  'saltar',
  'repetir',
  'siSino',
  'funcion',
  'llamar',
];

type Dir = Tramo['dir'];

/**
 * Ruta hasta una ficha del programa.
 *
 * Cada número entra un nivel: `[0]` es la primera ficha del programa y `[0, 1]`
 * la segunda de las que hay dentro de ella. El último número es la posición
 * dentro de la lista que la contiene.
 */
type Ruta = readonly number[];

/** El fallo que se le mete al programa que ve el niño. */
type Fallo =
  | { readonly tipo: 'direccion'; readonly ruta: Ruta; readonly dir: Dir }
  | { readonly tipo: 'cuenta'; readonly ruta: Ruta; readonly veces: number }
  | { readonly tipo: 'falta'; readonly ruta: Ruta }
  | { readonly tipo: 'sobra'; readonly ruta: Ruta; readonly ficha: PasoPrograma }
  | { readonly tipo: 'cambiada'; readonly ruta: Ruta; readonly ficha: PasoPrograma }
  | { readonly tipo: 'intercambio'; readonly ruta: Ruta }
  | { readonly tipo: 'invertida'; readonly ruta: Ruta };

/** Una ficha mientras se la manipula: igual que PasoPrograma pero editable. */
interface Editable {
  cmd: string;
  veces?: number;
  hijos?: Editable[];
  sino?: Editable[];
  color?: ColorCasilla;
  nombre?: string;
}

/** La lista de fichas que contiene la posición a la que apunta la ruta. */
function contenedor(pasos: Editable[], ruta: Ruta): Editable[] {
  let lista = pasos;
  for (const i of ruta.slice(0, -1)) {
    const paso = lista[i];
    if (!paso?.hijos) {
      throw new Error(`La ruta ${ruta.join('.')} no lleva a ninguna ficha con contenido.`);
    }
    lista = paso.hijos;
  }
  return lista;
}

/**
 * Aplica el fallo a una copia del programa bueno.
 *
 * Trabaja sobre una copia profunda porque el programa bueno se usa además como
 * solución de referencia: romper el original dejaría la actividad sin respuesta
 * correcta, y el validador lo diría, pero solo después de perder un rato.
 */
function romper(fichas: readonly PasoPrograma[], fallo: Fallo): PasoPrograma[] {
  const copia = JSON.parse(JSON.stringify(fichas)) as Editable[];
  const lista = contenedor(copia, fallo.ruta);
  const i = fallo.ruta[fallo.ruta.length - 1]!;
  const paso = lista[i];

  if (!paso && fallo.tipo !== 'sobra') {
    throw new Error(`La ruta ${fallo.ruta.join('.')} no apunta a ninguna ficha.`);
  }

  switch (fallo.tipo) {
    case 'direccion':
      paso!.cmd = fallo.dir;
      break;
    case 'cuenta':
      paso!.veces = fallo.veces;
      break;
    case 'falta':
      lista.splice(i, 1);
      break;
    case 'sobra':
      lista.splice(i, 0, JSON.parse(JSON.stringify(fallo.ficha)) as Editable);
      break;
    case 'cambiada':
      lista[i] = JSON.parse(JSON.stringify(fallo.ficha)) as Editable;
      break;
    case 'intercambio': {
      const siguiente = lista[i + 1];
      if (!siguiente) throw new Error('No hay ficha siguiente con la que intercambiar.');
      lista[i] = siguiente;
      lista[i + 1] = paso!;
      break;
    }
    case 'invertida': {
      const entonces = paso!.hijos;
      paso!.hijos = paso!.sino;
      paso!.sino = entonces;
      break;
    }
  }

  return copia as PasoPrograma[];
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  /** Tablero deducido de un programa de movimientos. */
  readonly movimientos?: readonly Movimiento[];
  readonly cajas?: Cajas;
  /** Tablero de nubes con huecos irregulares, para la ficha que mira. */
  readonly nubes?: readonly SegmentoNubes[];
  readonly fallo: Fallo;
  readonly exigeEstructuras?: readonly string[];
  readonly estrellas?: number;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'La flecha al reves',
    instruccion:
      'Fosil se pasa el dia desenterrando cosas rotas y arreglandolas, y hoy vas a hacer lo mismo. Este programa ya esta escrito y casi funciona. Casi. Hay una ficha mal, y solo una. Buscala.',
    exito: 'Una flecha apuntaba al otro lado. Arreglar es mas rapido que escribir, cuando sabes mirar.',
    pistas: [
      'Sigue el programa con el dedo, ficha a ficha, y mira donde deja de encajar.',
      'Una de las flechas apunta al lado contrario del camino.',
    ],
    movimientos: [rueda('derecha'), rueda('abajo'), rueda('derecha'), rueda('abajo')],
    fallo: { tipo: 'direccion', ruta: [2], dir: 'izquierda' },
  },
  {
    nombre: 'Seis fichas, una mal',
    instruccion:
      'Seis fichas y una que no encaja. Fosil dice que hay que empezar por el principio y no por donde parece: el fallo casi nunca esta donde se rompe.',
    exito: 'El fallo no estaba en la ultima ficha. Nunca esta ahi, esta antes.',
    pistas: ['Ve ficha a ficha desde el principio comparando con el camino.', 'Mira la quinta con cuidado.'],
    movimientos: [
      rueda('derecha'),
      rueda('abajo'),
      rueda('derecha'),
      rueda('abajo'),
      rueda('derecha'),
      rueda('abajo'),
    ],
    fallo: { tipo: 'direccion', ruta: [4], dir: 'arriba' },
    estrellas: 1,
  },
  {
    nombre: 'Se queda a medias',
    instruccion:
      'Este programa hace todo bien y se para antes de llegar. No falta ninguna ficha y no hay ninguna al reves. Entonces que le pasa?',
    exito: 'Le faltaban repeticiones. Un bucle que no llega no esta roto: esta mal contado.',
    pistas: ['El programa se para antes del final, no se estrella.', 'Cuenta los escalones del camino y mira el numero del bucle.'],
    movimientos: [repite(6, rueda('derecha'), rueda('abajo'))],
    fallo: { tipo: 'cuenta', ruta: [0], veces: 4 },
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Se pasa',
    instruccion:
      'Y este hace lo contrario: llega al final y sigue. Fosil dice que este error es el mas facil de arreglar y el mas dificil de ver venir.',
    exito: 'Se pasaba de dos. Un bucle no sabe donde acaba el camino: solo sabe contar.',
    pistas: ['El Fuzz llega al final y se estrella contra el borde.', 'Cuenta los escalones que hay de verdad.'],
    movimientos: [repite(5, rueda('derecha'), rueda('abajo'))],
    fallo: { tipo: 'cuenta', ruta: [0], veces: 7 },
    exigeEstructuras: ['repetir'],
    estrellas: 1,
  },
  {
    nombre: 'Falta una ficha',
    instruccion:
      'Dentro del bucle hay algo que falta. El Fuzz llega al borde del primer hueco y se queda ahi, sin saber que hacer.',
    exito: 'Faltaba el salto. Un bucle repite lo que tiene dentro, y si dentro falta algo, lo repite mal cuatro veces.',
    pistas: ['El Fuzz se para en el primer hueco. Que le falta para pasarlo?', 'Mira lo que hay DENTRO del bucle.'],
    movimientos: [repite(4, rueda('derecha'), salta())],
    fallo: { tipo: 'falta', ruta: [0, 1] },
    exigeEstructuras: ['repetir'],
    estrellas: 1,
  },
  {
    nombre: 'Sobra una ficha',
    instruccion:
      'Aqui no falta nada: sobra. Hay una ficha de mas al final y el Fuzz intenta seguir cuando ya no hay camino.',
    exito: 'Sobraba una ficha. Quitar es arreglar, aunque no lo parezca.',
    pistas: ['El programa funciona hasta el final y luego hace un movimiento mas.', 'Mira las dos ultimas fichas.'],
    movimientos: [repite(3, rueda('derecha'), salta()), rueda('abajo')],
    fallo: { tipo: 'sobra', ruta: [2], ficha: ir('abajo') },
    exigeEstructuras: ['repetir'],
    estrellas: 1,
  },
  {
    nombre: 'Cambiadas de sitio',
    instruccion:
      'Las fichas estan todas y todas apuntan bien. Lo que esta mal es el orden: dos de ellas estan cambiadas.',
    exito: 'Estaban las dos, pero al reves. El orden es parte de la ficha, aunque no se vea.',
    pistas: ['Compara el orden del programa con el orden del camino.', 'Fijate en la segunda y la tercera.'],
    movimientos: [rueda('derecha'), salta(), rueda('abajo'), salta()],
    fallo: { tipo: 'intercambio', ruta: [1] },
    estrellas: 1,
  },
  {
    nombre: 'Dentro del bucle',
    instruccion:
      'El fallo esta dentro del bucle, asi que pasa cinco veces. Arreglalo una vez y se arregla las cinco.',
    exito: 'Una ficha dentro de un bucle vale por cinco. Para bien y para mal.',
    pistas: ['El primer escalon ya sale mal, asi que el fallo esta al principio del bucle.', 'Una de las dos fichas de dentro apunta mal.'],
    movimientos: [repite(5, rueda('derecha'), rueda('abajo'))],
    fallo: { tipo: 'direccion', ruta: [0, 1], dir: 'arriba' },
    exigeEstructuras: ['repetir'],
    estrellas: 2,
  },
  {
    nombre: 'El numero de dentro',
    instruccion:
      'Hay dos bucles, uno dentro del otro, y dos numeros. Uno de los dos esta mal. Cual?',
    exito: 'El numero de dentro contaba los saltos, y habia uno de mas. Cada numero cuenta lo suyo.',
    pistas: ['Cuenta los huecos de un solo tramo y comparalo con el numero de dentro.', 'El numero de fuera cuenta escalones, no huecos.'],
    movimientos: [repite(3, repite(2, rueda('derecha'), salta()), rueda('abajo'))],
    fallo: { tipo: 'cuenta', ruta: [0, 0], veces: 3 },
    exigeEstructuras: ['repetir'],
    estrellas: 2,
  },
  {
    nombre: 'El numero de fuera',
    instruccion: 'El mismo tablero y el mismo programa, y esta vez el numero malo es el otro.',
    exito: 'El de fuera. Si el de dentro estuviera mal, el fallo saldria en el primer tramo, y salia despues.',
    pistas: [
      'Si el primer tramo sale bien, el numero de dentro esta bien.',
      'Entonces el que sobra o falta es el de fuera.',
    ],
    movimientos: [repite(3, repite(2, rueda('derecha'), salta()), rueda('abajo'))],
    fallo: { tipo: 'cuenta', ruta: [0], veces: 2 },
    exigeEstructuras: ['repetir'],
    estrellas: 2,
  },
  {
    nombre: 'Falta dentro de dentro',
    instruccion:
      'Tres niveles de fichas y una que falta en el mas hondo. Fosil dice que estas son las que le gustan.',
    exito: 'En el bucle de dentro del bucle. Cuanto mas hondo esta el fallo, mas veces pasa.',
    pistas: ['El Fuzz se para en el primer hueco: le falta como pasarlo.', 'Mira dentro del bucle pequeno.'],
    movimientos: [repite(3, repite(2, rueda('derecha'), salta()), rueda('abajo'))],
    fallo: { tipo: 'falta', ruta: [0, 0, 1] },
    exigeEstructuras: ['repetir'],
    estrellas: 2,
  },
  {
    nombre: 'Sobra dentro',
    instruccion:
      'Este programa hace un movimiento de mas en cada vuelta del bucle grande. Un movimiento de mas, tres veces.',
    exito: 'Un salto de mas dentro del bucle. Tres vueltas, tres saltos que no tocaban.',
    pistas: ['El primer tramo ya se pasa de largo.', 'Cuenta las fichas de dentro del bucle grande y comparalas con el camino.'],
    movimientos: [repite(3, repite(2, rueda('derecha'), salta()), rueda('abajo'))],
    fallo: { tipo: 'sobra', ruta: [0, 1], ficha: saltar() },
    exigeEstructuras: ['repetir'],
    estrellas: 2,
  },
  {
    nombre: 'La ficha equivocada',
    instruccion:
      'Aqui hay una ficha que no es la que toca: alguien puso un salto donde iba una rodada. Se parecen poco, pero en un bucle no se ven.',
    exito: 'Un salto donde iba una rodada. Mirar dentro de los bucles es lo que casi nadie hace.',
    pistas: ['Fijate en la primera ficha de dentro del bucle.', 'El camino no empieza con un hueco.'],
    movimientos: [repite(4, rueda('derecha'), salta())],
    fallo: { tipo: 'cambiada', ruta: [0, 0], ficha: saltar() },
    exigeEstructuras: ['repetir'],
    estrellas: 2,
  },
  {
    nombre: 'El fallo esta en la caja',
    instruccion:
      'Este programa usa una caja tres veces, y la caja esta mal. Fijate en lo bueno que tiene eso: arreglas una ficha y se arreglan los tres sitios de golpe.',
    exito:
      'Una ficha, tres arreglos. Por eso Garfio guarda las cosas en cajas: cuando algo esta mal, esta mal en un solo sitio.',
    pistas: ['Mira lo que hay dentro de la caja, no las llamadas.', 'Una de las tres fichas de dentro apunta mal.'],
    cajas: { superSalto: [salta(), rueda('abajo'), salta()] },
    movimientos: [{ usa: 'superSalto' }, rueda('derecha'), { usa: 'superSalto' }, rueda('derecha'), { usa: 'superSalto' }],
    fallo: { tipo: 'direccion', ruta: [0, 1], dir: 'arriba' },
    exigeEstructuras: ['funcion'],
    estrellas: 2,
  },
  {
    nombre: 'La caja incompleta',
    instruccion: 'Otra vez la caja, y esta vez le falta una ficha dentro. El Fuzz se queda corto tres veces.',
    exito: 'La caja tenia dos fichas y necesitaba tres. Una caja mal hecha se repite mal en todas partes.',
    pistas: ['Cuenta los movimientos que hace falta hacer en un tramo y las fichas que hay en la caja.', 'Falta la ultima.'],
    cajas: { superSalto: [salta(), rueda('abajo'), salta()] },
    movimientos: [{ usa: 'superSalto' }, rueda('derecha'), { usa: 'superSalto' }, rueda('derecha'), { usa: 'superSalto' }],
    fallo: { tipo: 'falta', ruta: [0, 2] },
    exigeEstructuras: ['funcion'],
    estrellas: 2,
  },
  {
    nombre: 'Una llamada de menos',
    instruccion:
      'La caja esta perfecta. Lo que falta esta fuera: el programa la usa menos veces de las que hace falta.',
    exito: 'La caja estaba bien y el programa la llamaba poco. No siempre el fallo esta dentro.',
    pistas: ['Cuenta los tramos del tablero y las veces que se llama a la caja.', 'Mira el programa, no la caja.'],
    cajas: { superSalto: [salta(), rueda('abajo'), salta()] },
    movimientos: [
      { usa: 'superSalto' },
      rueda('derecha'),
      { usa: 'superSalto' },
      rueda('derecha'),
      { usa: 'superSalto' },
      rueda('derecha'),
      { usa: 'superSalto' },
    ],
    fallo: { tipo: 'falta', ruta: [3] },
    exigeEstructuras: ['funcion'],
    estrellas: 3,
  },
  {
    nombre: 'Las dos ramas al reves',
    instruccion:
      'Este es el favorito de Fosil. La ficha que mira esta bien puesta pero tiene las dos ramas cambiadas: salta cuando hay camino y rueda cuando hay hueco. Justo al contrario.',
    exito:
      'Al reves. Este fallo es el que mas veces has visto sin darte cuenta: la ficha estaba, la pregunta estaba, y la respuesta iba cambiada.',
    pistas: [
      'Lee la ficha en voz alta: si hay camino, que hace?',
      'Tiene que rodar cuando hay camino y saltar cuando no lo hay.',
    ],
    nubes: [{ dir: 'derecha', nubes: [3, 1, 3] }],
    fallo: { tipo: 'invertida', ruta: [0, 0] },
    exigeEstructuras: ['siSino'],
    estrellas: 2,
  },
  {
    nombre: 'Una decision de mas',
    instruccion:
      'La ficha que mira esta bien, las dos ramas estan bien, y el numero no. El Fuzz cruza el pasillo entero y luego intenta saltar donde ya no hay nada.',
    exito: 'Una decision de mas. Al final del camino la ficha pregunta, ve que no hay nube, y salta al vacio.',
    pistas: ['El Fuzz llega al final y hace un movimiento mas.', 'Cuenta las decisiones del pasillo: rodadas y saltos.'],
    nubes: [{ dir: 'derecha', nubes: [2, 1, 3, 1, 2] }],
    fallo: { tipo: 'cuenta', ruta: [0], veces: 9 },
    exigeEstructuras: ['siSino'],
    estrellas: 2,
  },
  {
    nombre: 'Falta el giro',
    instruccion:
      'Dos pasillos con una esquina, y el programa salta hacia la derecha cuando tendria que bajar. Acuerdate del castillo: la ficha de saltar salta hacia donde mira el Fuzz.',
    exito:
      'Faltaba la ficha de girar entre los dos bucles. Sin ella el Fuzz llega a la esquina mirando a la derecha y salta hacia el vacio.',
    pistas: [
      'El Fuzz llega bien a la esquina y ahi se rompe.',
      'Entre los dos bucles tiene que haber una ficha de direccion.',
    ],
    nubes: [
      { dir: 'derecha', nubes: [2, 1, 3, 2] },
      { dir: 'abajo', nubes: [3, 1, 3, 2] },
    ],
    fallo: { tipo: 'falta', ruta: [1] },
    exigeEstructuras: ['siSino'],
    estrellas: 3,
  },
  {
    nombre: 'Donde esta Fosil',
    instruccion:
      'Ultimo del valle. Fosil esta al fondo, y me ha dicho que este programa lo escribio el mismo la semana pasada y que no consigue ver que tiene. Tres pisos de fichas y un fallo. Encuentralo tu.',
    exito:
      'Fosil no se lo cree. Dice que lo miro treinta veces. Y luego me dijo una cosa: que lleva dias desenterrando trozos de metal con el mismo dibujo que la placa de Garfio, y que estan mucho mas abajo de lo que deberian. Como si llevaran ahi mucho tiempo.',
    pistas: [
      'Empieza comprobando el bucle mas pequeno con el primer tramo del camino.',
      'Si el primer tramo sale bien, el fallo esta mas afuera.',
    ],
    movimientos: [
      repite(2, repite(2, rueda('derecha'), rueda('abajo')), salta()),
      rueda('abajo', 2),
      repite(3, rueda('derecha'), salta()),
    ],
    fallo: { tipo: 'cuenta', ruta: [2], veces: 5 },
    exigeEstructuras: ['repetir'],
    estrellas: 3,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 9,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  // Dos formas de tablero: deducido del programa, o de nubes irregulares.
  const tablero = receta.nubes
    ? (() => {
        const camino = caminoDeNubes(receta.nubes!);
        return { ...camino, fichas: programaDeNubes(receta.nubes!, camino.decisiones) };
      })()
    : tableroDePrograma({
        ...(receta.cajas ? { cajas: receta.cajas } : {}),
        movimientos: receta.movimientos ?? [],
      });

  return actividadExplorador(contexto, {
    plan: {
      tramos: tablero.tramos,
      agujeros: tablero.agujeros,
      estrellas: estrellasEn(tablero.firmes, receta.estrellas ?? 0),
    },
    comandos: COMANDOS,
    solucion: tablero.fichas,
    programaPrefijado: romper(tablero.fichas, receta.fallo),
    ...(receta.exigeEstructuras ? { exigeEstructuras: receta.exigeEstructuras } : {}),
    tipo: indice === 19 ? 'integrador' : 'debug',
    monedas: indice === 19 ? 75 : undefined,
  });
});

export const mundo9: WorldContentFile = {
  mundo: 9,
  slug: 'valle-de-los-dinosaurios',
  nombre: 'El Valle de los Dinosaurios',
  introTexto:
    'Fosil se pasa el dia desenterrando cosas rotas y arreglandolas, y hoy vas a hacer lo mismo. Aqui los programas ya estan escritos y casi funcionan. Casi. En cada uno hay una ficha que esta mal, y solo una. Leer un programa de otro y encontrar donde falla es mas dificil que escribirlo, y es lo que hacen los programadores casi todo el tiempo.',
  actividades,
};
