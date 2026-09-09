/**
 * Mundo 10: La Estación Espacial Fuzz. Todo junto.
 *
 * Un mundo integrador no es un mundo difícil: es un mundo donde por primera vez
 * nadie dice qué ficha usar. En los nueve anteriores la actividad presentaba una
 * idea y el tablero estaba hecho para que esa idea fuera la cómoda. Aquí el
 * tablero no avisa, y elegir la herramienta es el ejercicio.
 *
 * Las cinco ideas que se juntan, y de dónde viene cada una:
 *
 *   flechas y colores     mundos 1 y 2
 *   bucles contados       mundos 3, 4 y 8
 *   la ficha que mira     mundo 6
 *   cajas con nombre      mundo 7
 *   leer antes de escribir mundo 9
 *
 * Lo que aquí es nuevo son las combinaciones, y hay tres que no habían aparecido
 * nunca: una caja dentro de un bucle, un bucle dentro de una caja, y un bucle que
 * lleva dentro la ficha de color. Las tres son el mismo descubrimiento: las
 * fichas no son categorías separadas, se meten unas dentro de otras.
 *
 * Progresión:
 *   1-4    un repaso de cada idea, una por actividad.
 *   5-7    dos ideas por tablero. Las combinaciones nuevas.
 *   8-12   tres ideas, y tableros que ya no caben de un vistazo.
 *   13-17  los tableros grandes de la estación.
 *   18-20  el cohete, el registro de vuelo, y lo que Orbita vio esa noche.
 */
import {
  actividadExplorador,
  caminoConSaltos,
  caminoDeNubes,
  estrellasEn,
  ir,
  programaDeNubes,
  repetir,
  repite,
  rueda,
  salta,
  saltar,
  siColor,
  tableroDePrograma,
  type Cajas,
  type ContextoExplorador,
  type Movimiento,
  type SegmentoNubes,
  type SegmentoSaltos,
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
  'siColor',
  'siSino',
  'funcion',
  'llamar',
];

type Dir = Tramo['dir'];

/** Tramo liso, para los tableros de color. */
const liso = (dir: Dir, casillas = 2): SegmentoSaltos => ({ dir, casillas });
/** Tramo con `n` huecos que hay que rodar y saltar. */
const conHuecos = (dir: Dir, n: number): SegmentoSaltos => ({ dir, saltos: n });

/** Repite una lista de tramos: el camino de un patrón. */
function ciclo(veces: number, ...segmentos: SegmentoSaltos[]): SegmentoSaltos[] {
  const salida: SegmentoSaltos[] = [];
  for (let i = 0; i < veces; i++) salida.push(...segmentos);
  return salida;
}

/** Repite una lista de colores tantas veces como el ciclo de tramos. */
function coloresCiclo(
  veces: number,
  ...colores: (ColorCasilla | undefined)[]
): (ColorCasilla | undefined)[] {
  const salida: (ColorCasilla | undefined)[] = [];
  for (let i = 0; i < veces; i++) salida.push(...colores);
  return salida;
}

/** La caja de Garfio, que en la estacion se sigue llamando igual. */
const SUPER_SALTO: readonly Movimiento[] = [salta(), rueda('abajo'), salta()];
const DOBLE: readonly Movimiento[] = [salta(), salta()];

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  /** Tablero deducido de un programa: bucles, saltos y cajas. */
  readonly movimientos?: readonly Movimiento[];
  readonly cajas?: Cajas;
  /** Tablero de nubes con huecos irregulares: la ficha que mira. */
  readonly nubes?: readonly SegmentoNubes[];
  /** Tablero con casillas de color, con la solucion escrita a mano. */
  readonly segmentos?: readonly SegmentoSaltos[];
  readonly colores?: readonly (ColorCasilla | undefined)[];
  readonly solucion?: readonly PasoPrograma[];
  readonly exigeEstructuras?: readonly string[];
  readonly estrellas?: number;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Otra vez el rojo',
    instruccion:
      'La estacion tiene las paredes pintadas igual que el bosque de Iris: rojo donde hay que girar. Orbita dice que lo copio ella. Empieza suave.',
    exito: 'El rojo sigue significando gira, nueve mundos despues. Las reglas buenas no cambian.',
    pistas: ['Ve a la derecha hasta el rojo.', 'Y en el rojo, baja.'],
    segmentos: [liso('derecha', 3), liso('abajo', 2)],
    colores: ['rojo', undefined],
    solucion: [ir('derecha'), siColor('rojo', [ir('abajo')])],
    exigeEstructuras: ['siColor'],
  },
  {
    nombre: 'Otra vez el bucle',
    instruccion: 'Cinco huecos en el pasillo de carga. Ya sabes lo que hay que hacer y con cuantas fichas.',
    exito: 'Cuatro fichas. Esto hace ocho mundos te habria costado diez.',
    pistas: ['Rueda y salta, dentro de la ficha de repetir.', 'Cinco veces.'],
    movimientos: [repite(5, rueda('derecha'), salta())],
    exigeEstructuras: ['repetir'],
    estrellas: 1,
  },
  {
    nombre: 'Otra vez la ficha que mira',
    instruccion:
      'El suelo de la estacion tiene tramos abiertos al espacio, y no estan a distancias regulares. Ya sabes que ficha pide esto.',
    exito: 'La ficha que mira sigue funcionando en el espacio. No dependia del castillo: dependia de la idea.',
    pistas: ['Si hay suelo rueda, y si no salta.', 'Cuenta las decisiones, no las casillas.'],
    nubes: [{ dir: 'derecha', nubes: [3, 1, 3] }],
    exigeEstructuras: ['siSino'],
  },
  {
    nombre: 'Otra vez la caja',
    instruccion: 'Y la caja de Garfio, que Orbita tiene guardada en el cohete porque dice que un dia hara falta.',
    exito: 'Tres llamadas. Garfio te manda saludos desde la bahia.',
    pistas: ['Dentro de la caja: saltar, bajar, saltar.', 'Llamala tres veces.'],
    cajas: { superSalto: SUPER_SALTO },
    movimientos: [{ usa: 'superSalto' }, rueda('derecha'), { usa: 'superSalto' }, rueda('derecha'), { usa: 'superSalto' }],
    exigeEstructuras: ['funcion'],
    estrellas: 1,
  },
  {
    nombre: 'El color dentro del bucle',
    instruccion:
      'Esto es nuevo. La ficha de color puede ir DENTRO de la ficha de repetir. Cuatro giros iguales, cuatro casillas rojas, y un programa de cuatro fichas que sirve para los cuatro.',
    exito:
      'La ficha de color dentro del bucle. Las fichas no son cajones separados: se meten unas dentro de otras, y ahi esta todo.',
    pistas: [
      'Dentro del bucle van dos cosas: la flecha de la derecha y la ficha de color.',
      'La ficha de color lleva dentro la flecha de bajar. Cuatro repeticiones.',
    ],
    segmentos: ciclo(4, liso('derecha', 2), liso('abajo', 2)),
    colores: coloresCiclo(4, 'rojo', undefined),
    solucion: [repetir(4, ir('derecha'), siColor('rojo', [ir('abajo')]))],
    exigeEstructuras: ['siColor', 'repetir'],
    estrellas: 2,
  },
  {
    nombre: 'La caja dentro del bucle',
    instruccion:
      'Y esto tambien es nuevo: una caja dentro de un bucle. La caja hace tres movimientos y el bucle la llama tres veces. Siete fichas para doce movimientos.',
    exito:
      'Una caja dentro de un bucle. Garfio y Chispa juntos, y ninguno de los dos lo habia visto.',
    pistas: [
      'Primero haz la caja: saltar, bajar, saltar.',
      'Luego mete la llamada y una rodada dentro de la ficha de repetir.',
    ],
    cajas: { superSalto: SUPER_SALTO },
    movimientos: [repite(3, { usa: 'superSalto' }, rueda('derecha'))],
    exigeEstructuras: ['funcion', 'repetir'],
    estrellas: 2,
  },
  {
    nombre: 'El bucle dentro de la caja',
    instruccion:
      'Y al reves: un bucle metido DENTRO de la caja. La caja lleva un bucle dentro, y tu la llamas tres veces sin volver a pensar en el.',
    exito:
      'Un bucle dentro de una caja. Cuando algo funciona, se guarda con nombre y se deja de mirar. Eso es todo el oficio.',
    pistas: [
      'Dentro de la caja va la ficha de repetir, con rodar y saltar dentro.',
      'La caja se llama tres veces, con una bajada entre cada dos.',
    ],
    cajas: { tramo: [repite(2, rueda('derecha'), salta())] },
    movimientos: [{ usa: 'tramo' }, rueda('abajo'), { usa: 'tramo' }, rueda('abajo'), { usa: 'tramo' }],
    exigeEstructuras: ['funcion', 'repetir'],
    estrellas: 2,
  },
  {
    nombre: 'La esquina de la esclusa',
    instruccion: 'Dos pasillos con suelo irregular y una esquina en medio. Acuerdate de la ficha de girar.',
    exito: 'Dos bucles y un giro entre ellos. Si te olvidas del giro, el Fuzz salta al espacio.',
    pistas: ['Un bucle por pasillo.', 'Entre los dos, una ficha de direccion.'],
    nubes: [
      { dir: 'derecha', nubes: [2, 1, 3, 2] },
      { dir: 'abajo', nubes: [3, 1, 3, 2] },
    ],
    exigeEstructuras: ['siSino'],
    estrellas: 2,
  },
  {
    nombre: 'Seis giros rojos',
    instruccion: 'Seis giros, todos marcados. El mismo programa de cuatro fichas y un numero mas grande.',
    exito: 'Seis giros con cuatro fichas. Cambiar un numero es mas barato que escribir doce flechas.',
    pistas: ['Cuenta las casillas rojas: son seis.', 'El programa es el mismo, solo cambia el numero.'],
    segmentos: ciclo(6, liso('derecha', 2), liso('abajo', 2)),
    colores: coloresCiclo(6, 'rojo', undefined),
    solucion: [repetir(6, ir('derecha'), siColor('rojo', [ir('abajo')]))],
    exigeEstructuras: ['siColor', 'repetir'],
    estrellas: 2,
  },
  {
    nombre: 'Color y huecos',
    instruccion:
      'Ahora hay las dos cosas: huecos que saltar y casillas rojas que dicen donde girar. Dentro del bucle van las tres fichas.',
    exito: 'Saltos y colores en el mismo bucle. Ya no piensas en fichas: piensas en lo que hace falta.',
    pistas: [
      'Dentro del bucle: rodar, saltar, y la ficha de color.',
      'La ficha de color lleva dentro la flecha de bajar.',
    ],
    segmentos: ciclo(4, conHuecos('derecha', 1), liso('abajo', 2)),
    colores: coloresCiclo(4, 'rojo', undefined),
    solucion: [repetir(4, ir('derecha'), saltar(), siColor('rojo', [ir('abajo')]))],
    exigeEstructuras: ['siColor', 'repetir'],
    estrellas: 2,
  },
  {
    nombre: 'Tres pasillos',
    instruccion: 'Tres pasillos de suelo irregular, con dos esquinas. Cuenta las decisiones de cada uno por separado.',
    exito: 'Tres bucles y dos giros sin equivocarte en ningun numero. La esclusa esta abierta.',
    pistas: ['Haz un pasillo, comprueba, y pasa al siguiente.', 'Cada giro gasta la primera decision del pasillo que empieza.'],
    nubes: [
      { dir: 'derecha', nubes: [2, 1, 3] },
      { dir: 'abajo', nubes: [3, 1, 2, 2] },
      { dir: 'derecha', nubes: [2, 1, 3] },
    ],
    exigeEstructuras: ['siSino'],
    estrellas: 3,
  },
  {
    nombre: 'Dos cajas y un bucle',
    instruccion:
      'Dos cajas distintas, las dos dentro del mismo bucle. Mira que hace cada una antes de decidir el orden.',
    exito: 'Dos cajas dentro de un bucle, ocho fichas, veinte movimientos. Este es de los buenos.',
    pistas: [
      'Una caja salta dos veces y la otra salta, baja y salta.',
      'Las dos van dentro del bucle, con sus rodadas entre medias.',
    ],
    cajas: { doble: DOBLE },
    movimientos: [repite(2, { usa: 'doble' }, rueda('abajo'), { usa: 'doble' }, rueda('derecha'))],
    exigeEstructuras: ['funcion', 'repetir'],
    estrellas: 3,
  },
  {
    nombre: 'El bucle de dentro y el de fuera',
    instruccion:
      'Un bucle dentro de otro y una caja al final del de dentro. Empieza por lo pequeno y ve saliendo.',
    exito: 'Tres pisos de fichas y una caja. Tu programa ya no se lee de un vistazo, y aun asi cabe en la barra.',
    pistas: ['El bucle pequeno hace dos veces rodar y saltar.', 'Despues del bucle pequeno va la llamada a la caja.'],
    cajas: { doble: DOBLE },
    movimientos: [repite(2, repite(2, rueda('derecha'), salta()), { usa: 'doble' })],
    exigeEstructuras: ['funcion', 'repetir'],
    estrellas: 3,
  },
  {
    nombre: 'El pasillo de los ocho giros',
    instruccion: 'Ocho giros rojos. El numero mas grande del mundo diez, y el programa mas corto.',
    exito: 'Ocho giros, dieciseis movimientos, cuatro fichas. Recuerda esto cuando alguien te pregunte para que sirve un bucle.',
    pistas: ['Cuenta las rojas con el dedo.', 'Ocho.'],
    segmentos: ciclo(8, liso('derecha', 1), liso('abajo', 1)),
    colores: coloresCiclo(8, 'rojo', undefined),
    solucion: [repetir(8, ir('derecha'), siColor('rojo', [ir('abajo')]))],
    exigeEstructuras: ['siColor', 'repetir'],
    estrellas: 3,
  },
  {
    nombre: 'Dos huecos por tramo',
    instruccion:
      'Cada tramo tiene dos huecos y acaba en rojo. Un bucle dentro de otro, y la ficha de color en el de fuera.',
    exito: 'Un bucle dentro de otro con la ficha de color de acompanante. Ni una ficha de sobra.',
    pistas: [
      'El bucle de dentro hace los dos saltos del tramo.',
      'El de fuera lleva ese bucle y la ficha de color con la bajada.',
    ],
    segmentos: ciclo(3, conHuecos('derecha', 2), liso('abajo', 2)),
    colores: coloresCiclo(3, 'rojo', undefined),
    solucion: [
      repetir(3, repetir(2, ir('derecha'), saltar()), siColor('rojo', [ir('abajo')])),
    ],
    exigeEstructuras: ['siColor', 'repetir'],
    estrellas: 3,
  },
  {
    nombre: 'La bodega',
    instruccion:
      'La bodega de carga es larga y tiene el suelo peor de la estacion. Cuatro pasillos y tres esquinas.',
    exito: 'La bodega entera. Orbita dice que ella nunca baja aqui porque le da respeto.',
    pistas: ['Uno por uno, comprobando cada pasillo antes del siguiente.', 'Cuatro bucles y tres giros.'],
    nubes: [
      { dir: 'derecha', nubes: [2, 1, 3] },
      { dir: 'abajo', nubes: [3, 2, 2] },
      { dir: 'derecha', nubes: [2, 1, 3] },
      { dir: 'abajo', nubes: [3, 1, 2] },
    ],
    exigeEstructuras: ['siSino'],
    estrellas: 3,
  },
  {
    nombre: 'La rampa del cohete',
    instruccion:
      'La rampa sube hasta la escotilla. Una caja dentro de un bucle, cuatro veces, y arriba esta el cohete.',
    exito: 'Arriba. Desde aqui se ve el Nido entero, y se ve lo pequeno que es.',
    pistas: ['La caja hace dos saltos seguidos.', 'El bucle la llama cuatro veces con una subida entre medias.'],
    cajas: { doble: DOBLE },
    movimientos: [repite(4, { usa: 'doble' }, rueda('arriba'))],
    exigeEstructuras: ['funcion', 'repetir'],
    estrellas: 3,
  },
  {
    nombre: 'El registro de vuelo',
    instruccion:
      'Orbita quiere ensenarte una cosa. Dice que el cohete guarda un registro de todo lo que pasa cerca, y que el registro de esa noche no esta borrado. Llega hasta la cabina.',
    exito:
      'El registro dice esto: a las tres y catorce, un objeto salio del Nucleo. No entro. Salio. Y el Nucleo esta a treinta mundos de aqui.',
    pistas: ['Tres tramos con huecos y dos esquinas.', 'Ve tramo a tramo, sin prisa.'],
    nubes: [
      { dir: 'arriba', nubes: [2, 1, 3] },
      { dir: 'derecha', nubes: [3, 1, 2, 2] },
      { dir: 'arriba', nubes: [2, 2, 3] },
    ],
    exigeEstructuras: ['siSino'],
    estrellas: 3,
  },
  {
    nombre: 'Lo que Orbita vio',
    instruccion:
      'Orbita fue la unica que la vio venir, y ahora sabes por que: estaba mirando hacia arriba, como siempre. Dice que la tormenta no hacia ruido de tormenta. Hacia ruido de motor. Sube a por ella.',
    exito:
      'Ruido de motor, dijo. Y ahora encaja todo: el eco que repetia despierta, la placa de metal de Garfio, los trozos que Fosil desenterraba demasiado abajo, y la cuenta atras que oyo Chispa. Cinco, cuatro, tres.',
    pistas: [
      'Un bucle dentro de otro para la subida, y la caja para el tramo final.',
      'Comprueba la primera parte antes de escribir la segunda.',
    ],
    cajas: { doble: DOBLE },
    movimientos: [
      repite(3, repite(2, rueda('arriba'), salta()), rueda('derecha')),
      { usa: 'doble' },
    ],
    exigeEstructuras: ['funcion', 'repetir'],
    estrellas: 3,
  },
  {
    nombre: 'Los diez del Nido',
    instruccion:
      'Ultimo de los Exploradores. Al final de este camino estan los diez, esperandote: Pip, Iris, Brinco, Eco, Mango, Nimbo, Garfio, Chispa, Fosil y Orbita. Este tablero lleva de todo, porque tu ya sabes de todo.',
    exito:
      'Los diez en casa. Y esta noche, cuando se apaguen las luces del Nido, Orbita va a mirar hacia arriba otra vez, porque lo que salio del Nucleo sigue ahi fuera. Pero eso es el mundo treinta, y hasta alli quedan veinte. Manana empiezan los Creadores.',
    pistas: [
      'Primero el bucle con la ficha de color, y luego la parte de los saltos.',
      'Ve por partes: cada una es algo que ya has hecho veinte veces.',
    ],
    segmentos: [
      ...ciclo(4, conHuecos('derecha', 1), liso('abajo', 2)),
      ...ciclo(3, liso('derecha', 2), liso('abajo', 2)),
    ],
    colores: [...coloresCiclo(4, 'rojo', undefined), ...coloresCiclo(3, 'rojo', undefined)],
    solucion: [
      repetir(4, ir('derecha'), saltar(), siColor('rojo', [ir('abajo')])),
      repetir(3, ir('derecha'), siColor('rojo', [ir('abajo')])),
    ],
    exigeEstructuras: ['siColor', 'repetir'],
    estrellas: 3,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 10,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  // Tres formas de tablero, segun la mecanica que toque repasar.
  let tramos: readonly Tramo[];
  let agujeros: readonly number[];
  let firmes: readonly number[];
  let solucion: readonly PasoPrograma[];
  let colores: readonly (ColorCasilla | undefined)[] | undefined;

  if (receta.nubes) {
    const camino = caminoDeNubes(receta.nubes);
    ({ tramos, agujeros, firmes } = camino);
    solucion = programaDeNubes(receta.nubes, camino.decisiones);
  } else if (receta.segmentos) {
    const camino = caminoConSaltos(receta.segmentos);
    ({ tramos, agujeros, firmes } = camino);
    solucion = receta.solucion ?? [];
    colores = receta.colores;
  } else {
    const camino = tableroDePrograma({
      ...(receta.cajas ? { cajas: receta.cajas } : {}),
      movimientos: receta.movimientos ?? [],
    });
    ({ tramos, agujeros, firmes } = camino);
    solucion = camino.fichas;
  }

  return actividadExplorador(contexto, {
    plan: {
      tramos,
      agujeros,
      ...(colores ? { coloresDeGiro: colores } : {}),
      estrellas: estrellasEn(firmes, receta.estrellas ?? 0),
    },
    comandos: COMANDOS,
    solucion,
    ...(receta.exigeEstructuras ? { exigeEstructuras: receta.exigeEstructuras } : {}),
    tipo: indice === 19 ? 'jefe' : indice >= 17 ? 'integrador' : undefined,
    monedas: indice === 19 ? 120 : undefined,
  });
});

export const mundo10: WorldContentFile = {
  mundo: 10,
  slug: 'estacion-espacial-fuzz',
  nombre: 'Estacion Espacial Fuzz',
  introTexto:
    'La Estacion Espacial Fuzz es lo mas alto del Nido, y Orbita estaba aqui la noche de la tormenta preparando el cohete. Es la unica que la vio venir. Aqui va todo junto: flechas, colores, repeticiones, cajas y la ficha que mira. Todo lo que has aprendido en nueve mundos, en un solo tablero, y esta vez nadie te va a decir cual usar.',
  actividades,
};
