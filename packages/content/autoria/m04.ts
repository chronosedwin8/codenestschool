/**
 * Mundo 4: La Cueva de los Ecos. Patrones.
 *
 * El mundo 3 enseñó a repetir. Este enseña algo más difícil: mirar un camino
 * largo y ver dentro de él la parte que se repite. Es la primera vez que el niño
 * no tiene que ejecutar, sino reconocer.
 *
 * La diferencia con el mundo 3 está en el tamaño del patrón. Allí siempre era
 * "rueda y salta", dos fichas. Aquí el patrón puede ser de dos, de tres o de
 * cinco, y hay caminos donde el patrón contiene otro patrón dentro. Ese es el
 * eco del eco, y es el primer contacto con la idea de anidar.
 *
 * Progresión:
 *   1-2    el patrón más simple: gira, gira, gira. Dos fichas.
 *   3-6    patrones de tres fichas, con un salto dentro.
 *   7-9    patrones de cuatro y cinco fichas.
 *   10-12  dos patrones distintos en el mismo camino, y patrones con cola.
 *   13-16  un bucle dentro de otro bucle. El eco del eco.
 *   17-20  caminos largos donde encontrar el patrón es todo el trabajo.
 *
 * Y una cosa más: a partir de la actividad quince el eco de la cueva deja de
 * repetir lo que dices y empieza a repetir otra cosa. Los niños se dan cuenta
 * antes que los adultos.
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
  readonly segmentos: readonly SegmentoSaltos[];
  readonly estrellas?: number;
  readonly solucion: readonly PasoPrograma[];
  readonly exigeEstructuras?: readonly string[];
}

const COMANDOS = ['derecha', 'izquierda', 'arriba', 'abajo', 'saltar', 'repetir'];

/** Repite una lista de segmentos: el camino que corresponde a un patrón. */
function ciclo(veces: number, ...segmentos: SegmentoSaltos[]): SegmentoSaltos[] {
  const salida: SegmentoSaltos[] = [];
  for (let i = 0; i < veces; i++) salida.push(...segmentos);
  return salida;
}

/** Un tramo liso de una casilla: el giro del patrón. */
const giro = (dir: SegmentoSaltos['dir']): SegmentoSaltos => ({ dir, casillas: 1 });

/**
 * Un tramo liso de dos casillas.
 *
 * Hace falta cuando el camino baja y luego sube: con tramos de una casilla, la
 * escalera de subida queda pegada a la de bajada y el Fuzz, al rodar, se cuela
 * de una a otra. Dos casillas dejan el hueco que separa las dos escaleras.
 */
const giroAncho = (dir: SegmentoSaltos['dir']): SegmentoSaltos => ({ dir, casillas: 2 });

/** Un tramo con `n` huecos, para rodar y saltar `n` veces. */
const conSaltos = (dir: SegmentoSaltos['dir'], n: number): SegmentoSaltos => ({
  dir,
  saltos: n,
});

const RECETAS: readonly Receta[] = [
  {
    nombre: 'El eco de dos',
    instruccion:
      'Mira el camino antes de tocar nada. Derecha, abajo, derecha, abajo, derecha, abajo. Ves lo que se repite? Son solo dos fichas.',
    exito: 'Dos fichas y un cuatro. La cueva repite el eco cuatro veces y tu programa lo dice una.',
    pistas: [
      'El patron es derecha y abajo. Ponlo dentro de la ficha de repetir.',
      'Cuenta cuantas escaleras hay: cuatro.',
    ],
    segmentos: ciclo(4, giro('derecha'), giro('abajo')),
    solucion: [repetir(4, ir('derecha'), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Seis escalones',
    instruccion: 'El mismo eco, pero mas veces. Fijate: no cambia el patron, solo cambia el numero.',
    exito: 'Has cambiado un numero y ya esta. Eso es lo que hace un buen programa.',
    pistas: ['El patron sigue siendo derecha y abajo.', 'Cuenta los escalones: son seis.'],
    segmentos: ciclo(6, giro('derecha'), giro('abajo')),
    estrellas: 2,
    solucion: [repetir(6, ir('derecha'), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Un hueco en el patron',
    instruccion:
      'Ahora el patron tiene tres fichas: rueda, salta, baja. Y se repite tres veces. Escuchalo entero antes de escribirlo.',
    exito: 'Tres fichas dentro y un tres fuera. El patron ya no es una pareja y aun asi lo has visto.',
    pistas: ['Rueda a la derecha, salta el hueco, baja.', 'Ese grupo de tres se repite tres veces.'],
    segmentos: ciclo(3, conSaltos('derecha', 1), giro('abajo')),
    solucion: [repetir(3, ir('derecha'), saltar(), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Cuatro ecos',
    instruccion: 'El mismo patron de tres, una vez mas. Si ya sabes cual es, esto lo resuelves de memoria.',
    exito: 'De memoria. La cueva no te ha sorprendido esta vez.',
    pistas: ['Rueda, salta, baja.', 'Cuatro veces.'],
    segmentos: ciclo(4, conSaltos('derecha', 1), giro('abajo')),
    estrellas: 2,
    solucion: [repetir(4, ir('derecha'), saltar(), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El salto va al final',
    instruccion:
      'Cuidado. El patron lleva las mismas tres fichas que antes, pero en otro orden. El orden importa mas que las fichas.',
    exito: 'Mismas fichas, orden distinto, camino distinto. Ya sabes por que el orden importa.',
    pistas: ['Aqui primero se rueda, luego se baja, y el hueco esta abajo.', 'El patron es derecha, abajo, saltar.'],
    segmentos: ciclo(3, giro('derecha'), conSaltos('abajo', 1)),
    solucion: [repetir(3, ir('derecha'), ir('abajo'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Empezar bajando',
    instruccion: 'Eco esta abajo del todo. El patron es el mismo de siempre pero empieza por el otro lado.',
    exito: 'Empezar por otro lado no cambia el patron. Solo cambia por donde lo miras.',
    pistas: ['El patron es abajo y derecha, en ese orden.', 'Se repite cinco veces.'],
    segmentos: ciclo(5, giro('abajo'), giro('derecha')),
    estrellas: 2,
    solucion: [repetir(5, ir('abajo'), ir('derecha'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Dos huecos por escalon',
    instruccion:
      'Este patron tiene cuatro fichas: rueda, salta, baja, salta. Cuatro. Cuentalas mirando el camino, no adivinando.',
    exito: 'Cuatro fichas de patron y tres repeticiones. Doce movimientos con cinco fichas.',
    pistas: ['Hay un hueco a la derecha y otro abajo.', 'El patron es rueda, salta, baja, salta.'],
    segmentos: ciclo(3, conSaltos('derecha', 1), conSaltos('abajo', 1)),
    estrellas: 2,
    solucion: [repetir(3, ir('derecha'), saltar(), ir('abajo'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El patron de cinco',
    instruccion:
      'Este es largo: rueda, salta, rueda, salta, baja. Cinco fichas. Y se repite tres veces. Empieza contando los huecos de cada tramo.',
    exito: 'Cinco fichas de patron. Ya no lo ves de un vistazo, lo cuentas. Asi trabaja quien programa.',
    pistas: ['En cada tramo a la derecha hay DOS huecos.', 'Despues de los dos huecos, se baja una vez.'],
    segmentos: ciclo(3, conSaltos('derecha', 2), giro('abajo')),
    estrellas: 2,
    solucion: [repetir(3, ir('derecha'), saltar(), ir('derecha'), saltar(), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Ocho iguales',
    instruccion: 'Ocho escalones sin un solo hueco. Facil, pero cuenta bien: siete no llega y nueve se pasa.',
    exito: 'Ocho exactos. Contar es aburrido y es la mitad del trabajo.',
    pistas: ['El patron son dos fichas.', 'Cuenta los escalones despacio: ocho.'],
    segmentos: ciclo(8, giro('derecha'), giro('abajo')),
    estrellas: 3,
    solucion: [repetir(8, ir('derecha'), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Dos ecos distintos',
    instruccion:
      'Aqui hay dos patrones, no uno. El camino baja cuatro escalones y luego sube tres. Necesitas dos fichas de repetir.',
    exito: 'Dos bucles distintos en un programa. La cueva tiene dos ecos y los has separado.',
    pistas: ['Primero baja: derecha y abajo, cuatro veces.', 'Luego sube: derecha y arriba, tres veces.'],
    segmentos: [
      ...ciclo(4, giro('derecha'), giro('abajo')),
      ...ciclo(3, giroAncho('derecha'), giro('arriba')),
    ],
    estrellas: 2,
    solucion: [repetir(4, ir('derecha'), ir('abajo')), repetir(3, ir('derecha'), ir('arriba'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Cuatro veces cuatro',
    instruccion: 'El patron de cuatro fichas, cuatro veces. Dieciseis movimientos. Cinco fichas.',
    exito: 'Dieciseis movimientos con cinco fichas. Sin la ficha de repetir serian dieciseis.',
    pistas: ['Rueda, salta, baja, salta.', 'Cuatro veces.'],
    segmentos: ciclo(4, conSaltos('derecha', 1), conSaltos('abajo', 1)),
    estrellas: 3,
    solucion: [repetir(4, ir('derecha'), saltar(), ir('abajo'), saltar())],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El patron y la cola',
    instruccion:
      'Ojo con este. El patron se repite tres veces y despues queda un trozo que no encaja. Ese trozo va fuera del bucle.',
    exito: 'El trozo suelto fuera del bucle. No todo lo que sobra es un error: a veces es la cola.',
    pistas: ['Repite tres veces rueda, salta, baja.', 'Al final queda un tramo con un hueco. Ese va fuera.'],
    segmentos: [...ciclo(3, conSaltos('derecha', 1), giro('abajo')), conSaltos('derecha', 1)],
    estrellas: 2,
    solucion: [repetir(3, ir('derecha'), saltar(), ir('abajo')), ir('derecha'), saltar()],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Un bucle dentro de otro',
    instruccion:
      'Esto es nuevo. Dentro de una ficha de repetir puedes meter OTRA ficha de repetir. Mira el camino: dos huecos, un escalon, dos huecos, un escalon.',
    exito: 'Un bucle dentro de un bucle. Eco dice que eso es el eco del eco, y por una vez tiene razon.',
    pistas: [
      'El bucle de dentro hace los dos saltos: repite dos veces rueda y salta.',
      'El bucle de fuera repite tres veces todo eso mas el escalon.',
    ],
    segmentos: ciclo(3, conSaltos('derecha', 2), giro('abajo')),
    estrellas: 2,
    solucion: [repetir(3, repetir(2, ir('derecha'), saltar()), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Tres dentro de dos',
    instruccion: 'Otra vez un bucle dentro de otro, pero cambian los numeros. Cual va dentro y cual va fuera?',
    exito: 'El numero de dentro cuenta los saltos y el de fuera cuenta los escalones. No son intercambiables.',
    pistas: ['Cuenta los huecos de un tramo: tres.', 'Cuenta los escalones: dos.'],
    segmentos: ciclo(2, conSaltos('derecha', 3), giro('abajo')),
    estrellas: 2,
    solucion: [repetir(2, repetir(3, ir('derecha'), saltar()), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El eco raro',
    instruccion:
      'Espera. Escucha. La cueva ya no repite lo que dices. Repite una palabra que nadie ha dicho. Sigue el camino y no le hagas caso. Todavia.',
    exito:
      'Has oido lo que decia? Yo tambien. Decia despierta. Y no ha sido Eco, porque Eco estaba conmigo.',
    pistas: ['El bucle de dentro baja saltando dos veces.', 'El de fuera se repite tres veces con su giro.'],
    segmentos: ciclo(3, giro('derecha'), conSaltos('abajo', 2)),
    estrellas: 2,
    solucion: [repetir(3, ir('derecha'), repetir(2, ir('abajo'), saltar()))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Dos bucles dentro de uno',
    instruccion:
      'Dentro de la ficha de repetir caben dos bucles, uno detras del otro. Dos saltos a la derecha, dos saltos abajo, y otra vez.',
    exito: 'Dos bucles dentro de uno. Tu programa tiene tres pisos y sigue siendo mas corto que escribirlo todo.',
    pistas: ['Un bucle para los saltos de la derecha y otro para los de abajo.', 'Los dos van dentro del bucle grande.'],
    segmentos: ciclo(2, conSaltos('derecha', 2), conSaltos('abajo', 2)),
    estrellas: 3,
    solucion: [
      repetir(2, repetir(2, ir('derecha'), saltar()), repetir(2, ir('abajo'), saltar())),
    ],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Cinco veces tres',
    instruccion: 'El patron de tres fichas, cinco veces. Quince movimientos. La cueva se esta poniendo larga.',
    exito: 'Quince movimientos con cuatro fichas. La cueva es larga y tu programa no.',
    pistas: ['Rueda, salta, baja.', 'Cinco veces.'],
    segmentos: ciclo(5, conSaltos('derecha', 1), giro('abajo')),
    estrellas: 3,
    solucion: [repetir(5, ir('derecha'), saltar(), ir('abajo'))],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Antes y despues',
    instruccion:
      'Dos partes. La primera son seis escalones lisos. La segunda son cuatro escalones con hueco. Un bucle para cada parte.',
    exito: 'Dos bucles, dos numeros, dos patrones. Ya distingues donde acaba uno y empieza el otro.',
    pistas: ['La primera parte no tiene huecos: derecha y abajo, seis veces.', 'La segunda si: rueda, salta, baja, cuatro veces.'],
    segmentos: [
      ...ciclo(6, giro('derecha'), giro('abajo')),
      ...ciclo(4, conSaltos('derecha', 1), giro('abajo')),
    ],
    estrellas: 3,
    solucion: [
      repetir(6, ir('derecha'), ir('abajo')),
      repetir(4, ir('derecha'), saltar(), ir('abajo')),
    ],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'El eco del eco',
    instruccion:
      'El camino mas largo de la cueva. Tres saltos a la derecha, tres saltos abajo, y todo eso dos veces. Si lo escribes ficha a ficha no te caben en la barra.',
    exito: 'Nueve fichas para veinticuatro movimientos. Ese es el mejor trato que has hecho hoy.',
    pistas: [
      'Un bucle para los tres saltos de la derecha, otro para los tres de abajo.',
      'Los dos dentro de un bucle que se repite dos veces.',
    ],
    segmentos: ciclo(2, conSaltos('derecha', 3), conSaltos('abajo', 3)),
    estrellas: 3,
    solucion: [
      repetir(2, repetir(3, ir('derecha'), saltar()), repetir(3, ir('abajo'), saltar())),
    ],
    exigeEstructuras: ['repetir'],
  },
  {
    nombre: 'Donde esta Eco',
    instruccion:
      'Eco esta al fondo, y no repite nada. Esta callado, y eso en el nunca es buena senal. Ve a buscarlo. El camino tiene dos partes: fijate donde cambia.',
    exito:
      'Eco esta en casa, pero no ha dicho ni una palabra en todo el viaje. Cuando le pregunte que oyo esa noche, se puso a mirar el suelo.',
    pistas: [
      'La primera parte son dos saltos a la derecha. Un bucle.',
      'Luego un escalon, y despues rueda, salta y baja tres veces.',
    ],
    segmentos: [
      conSaltos('derecha', 2),
      giro('abajo'),
      ...ciclo(3, conSaltos('derecha', 1), giro('abajo')),
    ],
    estrellas: 3,
    solucion: [
      repetir(2, ir('derecha'), saltar()),
      ir('abajo'),
      repetir(3, ir('derecha'), saltar(), ir('abajo')),
    ],
    exigeEstructuras: ['repetir'],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 4,
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
    comandos: COMANDOS,
    solucion: receta.solucion,
    ...(receta.exigeEstructuras ? { exigeEstructuras: receta.exigeEstructuras } : {}),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 50 : undefined,
  });
});

export const mundo4: WorldContentFile = {
  mundo: 4,
  slug: 'cueva-de-los-ecos',
  nombre: 'La Cueva de los Ecos',
  introTexto:
    'En la Cueva de los Ecos todo vuelve. Lo que dices, lo que haces y sobre todo los caminos: se repiten en el mismo orden, una y otra vez. Aqui no vas a aprender una ficha nueva. Vas a aprender a mirar un camino largo y ver dentro de el la parte que se repite. Eso es un patron, y es lo que hace un programador antes de escribir nada.',
  actividades,
};
