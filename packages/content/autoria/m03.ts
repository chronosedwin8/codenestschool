/**
 * Mundo 3: La Pradera de los Saltos. Bucles de repetición.
 *
 * La idea: decir una cosa una vez y cuántas veces, en lugar de decirla muchas
 * veces. Es el primer salto de abstracción real del currículo.
 *
 * Cómo se enseña sin decirlo: la pradera está llena de agujeros regulares. Al
 * principio son dos y ponerlos a mano es cómodo. Luego son cuatro, cinco. La
 * ficha de repetir aparece justo cuando poner diez fichas iguales se ha vuelto
 * insoportable, y entonces no es una instrucción del adulto sino un alivio.
 *
 * La tercera estrella lo cierra: a partir de la actividad diez exige usar el
 * bucle. Se puede terminar sin él, pero no se puede terminar bien.
 *
 * Una restricción que resultó ser buen diseño: la rejilla no puede pasar de 24
 * casillas de ancho, porque en una tableta un pasillo más largo sale ilegible.
 * Eso obliga a que los caminos largos giren, y girar los hace más interesantes
 * que una línea recta de treinta casillas.
 *
 * Progresión:
 *   1-4    saltar un agujero, luego dos. Sin bucle.
 *   5-9    tres, cuatro y cinco. Empieza a repetirse la misma pareja de fichas.
 *   10-15  aparece repetir. El mismo camino con una ficha en vez de diez.
 *   16-20  varios tramos, cada uno con su cuenta. Contar bien es el reto.
 */
import {
  actividadExplorador,
  caminoConSaltos,
  estrellasEn,
  ir,
  repetir,
  saltar,
  type ContextoExplorador,
  type SegmentoSaltos,
} from '../src/generadores-exploradores.js';
import type { ActivityDefinition, PasoPrograma, WorldContentFile } from '@codenest/shared';

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  /** El camino, tramo a tramo, diciendo cuántos agujeros lleva cada uno. */
  readonly segmentos: readonly SegmentoSaltos[];
  /** Cuántas estrellas repartir por el camino firme. */
  readonly estrellas?: number;
  readonly solucion: readonly PasoPrograma[];
  readonly comandos?: readonly string[];
  readonly exigeEstructuras?: readonly string[];
}

const BASICO = ['derecha', 'izquierda', 'arriba', 'abajo', 'saltar'];
const CON_BUCLE = [...BASICO, 'repetir'];

/** Rodar y saltar, escrito tantas veces como agujeros haya. */
function aMano(dir: 'derecha' | 'izquierda' | 'arriba' | 'abajo', veces: number): PasoPrograma[] {
  const pasos: PasoPrograma[] = [];
  for (let i = 0; i < veces; i++) pasos.push(ir(dir), saltar());
  return pasos;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'El primer agujero',
    instruccion:
      'Brinco rueda hasta el borde del agujero y ahi se planta. No sabe que hacer. Dale la ficha de saltar y veras.',
    exito: 'Volo por encima. Brinco dice que saltar es lo unico que sabe hacer bien, y no es verdad.',
    pistas: ['Primero rueda a la derecha hasta el borde.', 'Luego usa la ficha de saltar.'],
    segmentos: [{ dir: 'derecha', saltos: 1 }],
    solucion: [ir('derecha'), saltar()],
  },
  {
    nombre: 'Y otro mas',
    instruccion: 'Dos agujeros seguidos. Rueda, salta, rueda, salta. Lo mismo que antes, dos veces.',
    exito: 'Dos saltos. Y fijate en una cosa: has hecho exactamente lo mismo dos veces seguidas.',
    pistas: ['Es lo mismo que antes, repetido.', 'Rueda, salta, rueda, salta.'],
    segmentos: [{ dir: 'derecha', saltos: 2 }],
    estrellas: 1,
    solucion: aMano('derecha', 2),
  },
  {
    nombre: 'Saltar hacia abajo',
    instruccion: 'El agujero esta en el camino que baja. Brinco salta hacia donde va, no hacia donde tu miras.',
    exito: 'Salto hacia abajo sin que se lo dijeras. Brinco siempre salta en la direccion que lleva.',
    pistas: ['Primero baja hasta el borde.', 'La ficha de saltar te lleva al otro lado.'],
    segmentos: [
      { dir: 'abajo', saltos: 1 },
      { dir: 'abajo', casillas: 2 },
    ],
    solucion: [ir('abajo'), saltar(), ir('abajo')],
  },
  {
    nombre: 'Con un giro',
    instruccion: 'Un agujero, un giro, y otro agujero esperando. Ve por partes y no te adelantes.',
    exito: 'Saltos y giros mezclados sin liarte. Eso ya no lo hace cualquiera.',
    pistas: ['Salta el primero y luego el camino baja.', 'Abajo hay otro agujero.'],
    segmentos: [
      { dir: 'derecha', saltos: 1 },
      { dir: 'abajo', saltos: 1 },
    ],
    estrellas: 1,
    solucion: [ir('derecha'), saltar(), ir('abajo'), saltar()],
  },
  {
    nombre: 'Tres seguidos',
    instruccion: 'Tres agujeros en fila. Vas a necesitar seis fichas. Cuentalas cuando termines.',
    exito: 'Seis fichas para hacer tres veces lo mismo. Mira tu programa un segundo antes de seguir.',
    pistas: ['Rueda y salta, tres veces.', 'Son seis fichas en total.'],
    segmentos: [{ dir: 'derecha', saltos: 3 }],
    estrellas: 2,
    solucion: aMano('derecha', 3),
  },
  {
    nombre: 'Cuatro',
    instruccion:
      'Cuatro agujeros. Ocho fichas, y todas dicen lo mismo. Ya empieza a ser un poco absurdo, no?',
    exito: 'Ocho fichas identicas de dos en dos. Tiene que haber una forma mejor. La hay.',
    pistas: ['Rueda y salta, cuatro veces.', 'El patron es siempre igual.'],
    segmentos: [{ dir: 'derecha', saltos: 4 }],
    estrellas: 2,
    solucion: aMano('derecha', 4),
  },
  {
    nombre: 'La cuesta',
    instruccion: 'Los agujeros suben. Cambia la direccion, pero el gesto es exactamente el mismo.',
    exito: 'Rodar y saltar sirve igual hacia arriba. Es la misma idea girada.',
    pistas: ['Sube rodando hasta el borde.', 'Salta y sigue subiendo.'],
    segmentos: [
      { dir: 'arriba', saltos: 2 },
      { dir: 'arriba', casillas: 1 },
    ],
    estrellas: 1,
    solucion: [...aMano('arriba', 2), ir('arriba')],
  },
  {
    nombre: 'Ida y vuelta',
    instruccion: 'Dos tramos con dos agujeros cada uno. Cuidado con la direccion al girar.',
    exito: 'Cuatro saltos en dos direcciones distintas sin equivocarte ni una vez.',
    pistas: ['Primero los dos de la derecha.', 'Cuando bajes, hay dos mas esperando.'],
    segmentos: [
      { dir: 'derecha', saltos: 2 },
      { dir: 'abajo', saltos: 2 },
    ],
    estrellas: 2,
    solucion: [...aMano('derecha', 2), ...aMano('abajo', 2)],
  },
  {
    nombre: 'Cinco agujeros',
    instruccion:
      'Cinco. Diez fichas. Todas iguales. Esto es justo lo que Brinco odia de los caminos largos.',
    exito: 'Diez fichas. Manana no vas a necesitar ni dos. Mira lo que hay en la barra.',
    pistas: ['Rueda y salta, cinco veces.', 'Diez fichas. Paciencia, es la ultima vez.'],
    segmentos: [{ dir: 'derecha', saltos: 5 }],
    estrellas: 2,
    solucion: aMano('derecha', 5),
  },
  {
    nombre: 'La ficha que repite',
    instruccion:
      'Mira esta ficha nueva. Le metes cosas dentro y le pones un numero, y hace lo de dentro ese numero de veces. Cuatro agujeros, una sola ficha.',
    exito: 'Dos fichas dentro, un cuatro fuera, ocho movimientos hechos. Asi trabaja quien sabe.',
    pistas: [
      'Pon rodar y saltar DENTRO de la ficha de repetir.',
      'El numero de la ficha es cuantos agujeros hay: cuatro.',
    ],
    segmentos: [{ dir: 'derecha', saltos: 4 }],
    comandos: CON_BUCLE,
    estrellas: 2,
    solucion: [repetir(4, ir('derecha'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Seis de una vez',
    instruccion: 'Seis agujeros. Con fichas sueltas serian doce. Con la nueva sigue siendo una.',
    exito: 'Seis agujeros con una ficha. Cambia el numero, no el programa.',
    pistas: ['Cuenta los agujeros: son seis.', 'Ese numero va en la ficha de repetir.'],
    segmentos: [{ dir: 'derecha', saltos: 6 }],
    comandos: CON_BUCLE,
    estrellas: 2,
    solucion: [repetir(6, ir('derecha'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El numero justo',
    instruccion:
      'Siete agujeros. Prueba a poner seis y veras que Brinco se queda a medias. Aqui el numero lo es todo.',
    exito: 'Siete exactos. Ni seis ni ocho. Contar bien es la mitad del trabajo.',
    pistas: ['Cuenta despacio: son siete agujeros.', 'Un numero de menos deja a Brinco a mitad de camino.'],
    segmentos: [{ dir: 'derecha', saltos: 7 }],
    comandos: CON_BUCLE,
    estrellas: 3,
    solucion: [repetir(7, ir('derecha'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Repetir hacia abajo',
    instruccion: 'El mismo truco, pero bajando. A la ficha de repetir le da igual la direccion.',
    exito: 'La ficha repite lo que le pongas dentro, sea lo que sea. Por eso sirve para todo.',
    pistas: ['Dentro de la ficha van bajar y saltar.', 'Son cinco agujeros.'],
    segmentos: [{ dir: 'abajo', saltos: 5 }],
    comandos: CON_BUCLE,
    estrellas: 2,
    solucion: [repetir(5, ir('abajo'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Dos bucles',
    instruccion: 'Tres agujeros a la derecha y tres hacia abajo. Un bucle para cada tramo.',
    exito: 'Dos bucles seguidos, cada uno con su numero y su direccion. Tu programa ya tiene forma.',
    pistas: ['Un bucle para el tramo de la derecha.', 'Otro bucle distinto para el de abajo.'],
    segmentos: [
      { dir: 'derecha', saltos: 3 },
      { dir: 'abajo', saltos: 3 },
    ],
    comandos: CON_BUCLE,
    estrellas: 2,
    solucion: [repetir(3, ir('derecha'), saltar()), repetir(3, ir('abajo'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Numeros distintos',
    instruccion:
      'Dos tramos, pero con distinto numero de agujeros. Si pones el mismo numero en los dos, algo va a salir mal.',
    exito: 'Dos bucles con numeros distintos. Cada tramo tiene su cuenta.',
    pistas: ['Cuenta los agujeros de cada tramo por separado.', 'No son la misma cantidad.'],
    segmentos: [
      { dir: 'derecha', saltos: 4 },
      { dir: 'abajo', saltos: 2 },
    ],
    comandos: CON_BUCLE,
    estrellas: 2,
    solucion: [repetir(4, ir('derecha'), saltar()), repetir(2, ir('abajo'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'La escalera saltarina',
    instruccion: 'Sube saltando, gira, y sigue saltando. Dos bucles con un giro entre medias.',
    exito: 'Bucles y giros combinados. Esto ya es un programa de verdad.',
    pistas: ['Primer bucle: subir saltando.', 'Segundo bucle: seguir a la derecha.'],
    segmentos: [
      { dir: 'arriba', saltos: 2 },
      { dir: 'derecha', saltos: 3 },
    ],
    comandos: CON_BUCLE,
    estrellas: 2,
    solucion: [repetir(2, ir('arriba'), saltar()), repetir(3, ir('derecha'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El circuito',
    instruccion: 'Tres tramos, tres direcciones, tres bucles. Cuenta cada uno por separado.',
    exito: 'Tres bucles encadenados. Con fichas sueltas te habrian hecho falta doce.',
    pistas: ['Un bucle por cada tramo.', 'Los tres tramos tienen dos agujeros.'],
    segmentos: [
      { dir: 'derecha', saltos: 2 },
      { dir: 'abajo', saltos: 2 },
      { dir: 'izquierda', saltos: 2 },
    ],
    comandos: CON_BUCLE,
    estrellas: 3,
    solucion: [
      repetir(2, ir('derecha'), saltar()),
      repetir(2, ir('abajo'), saltar()),
      repetir(2, ir('izquierda'), saltar()),
    ],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'La vuelta entera',
    instruccion: 'Cuatro tramos formando un cuadrado. Doce agujeros en total, cuatro fichas.',
    exito: 'Doce agujeros con cuatro fichas. Hace tres actividades habrias necesitado veinticuatro.',
    pistas: ['Son cuatro tramos: derecha, abajo, izquierda y arriba.', 'Tres agujeros en cada uno.'],
    segmentos: [
      { dir: 'derecha', saltos: 3 },
      { dir: 'abajo', saltos: 3 },
      { dir: 'izquierda', saltos: 3 },
      { dir: 'arriba', saltos: 2 },
    ],
    comandos: CON_BUCLE,
    estrellas: 3,
    solucion: [
      repetir(3, ir('derecha'), saltar()),
      repetir(3, ir('abajo'), saltar()),
      repetir(3, ir('izquierda'), saltar()),
      repetir(2, ir('arriba'), saltar()),
    ],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El reto de Brinco',
    instruccion:
      'Brinco te reta. Dice que nadie resuelve este con menos de cuatro fichas. Demuestrale que se equivoca.',
    exito: 'Cuatro fichas. Brinco esta dando saltos, aunque eso lo hace siempre.',
    pistas: ['Cuatro tramos, cuatro bucles.', 'Cuenta bien los agujeros de cada uno.'],
    segmentos: [
      { dir: 'derecha', saltos: 4 },
      { dir: 'abajo', saltos: 2 },
      { dir: 'izquierda', saltos: 4 },
      { dir: 'abajo', saltos: 2 },
    ],
    comandos: CON_BUCLE,
    estrellas: 3,
    solucion: [
      repetir(4, ir('derecha'), saltar()),
      repetir(2, ir('abajo'), saltar()),
      repetir(4, ir('izquierda'), saltar()),
      repetir(2, ir('abajo'), saltar()),
    ],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Donde esta Brinco',
    instruccion:
      'Ultimo de la pradera. Brinco lleva saltando desde que llegaste y no ha parado. Ve a buscarlo antes de que se canse. Aunque el no se cansa nunca.',
    exito:
      'Brinco esta en casa. Dice que ha sido el mejor dia de su vida y que quiere repetirlo. Repetirlo, claro.',
    pistas: [
      'Cuenta los agujeros de cada tramo antes de empezar.',
      'Son cuatro tramos y cada uno tiene su numero.',
    ],
    segmentos: [
      { dir: 'derecha', saltos: 3 },
      { dir: 'arriba', saltos: 2 },
      { dir: 'derecha', saltos: 2 },
      { dir: 'abajo', saltos: 4 },
    ],
    comandos: CON_BUCLE,
    estrellas: 3,
    solucion: [
      repetir(3, ir('derecha'), saltar()),
      repetir(2, ir('arriba'), saltar()),
      repetir(2, ir('derecha'), saltar()),
      repetir(4, ir('abajo'), saltar()),
    ],
    exigeEstructuras: ['repetir'],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 3,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const camino = caminoConSaltos(receta.segmentos);

  return actividadExplorador(contexto, {
    plan: {
      tramos: camino.tramos,
      agujeros: camino.agujeros,
      estrellas: estrellasEn(camino.firmes, receta.estrellas ?? 0),
    },
    comandos: receta.comandos ?? BASICO,
    solucion: receta.solucion,
    ...(receta.exigeEstructuras ? { exigeEstructuras: receta.exigeEstructuras } : {}),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 45 : undefined,
  });
});

export const mundo3: WorldContentFile = {
  mundo: 3,
  slug: 'pradera-de-los-saltos',
  nombre: 'La Pradera de los Saltos',
  introTexto:
    'La Pradera de los Saltos esta llena de agujeros, y a Brinco eso le parece estupendo porque el no sabe andar, solo saltar. Aqui vas a aprender algo que lo cambia todo: decir una cosa una vez y cuantas veces, en lugar de decirla veinte.',
  actividades,
};
