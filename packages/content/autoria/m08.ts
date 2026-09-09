/**
 * Mundo 8: La Montaña Neón. Saber cuándo parar.
 *
 * Chispa no sabe frenar. Lleva rodando desde la noche de la tormenta y ya ha
 * dado ochenta y siete vueltas, y el problema no es que ruede: es que no sabe
 * cuándo parar. Este mundo es sobre eso.
 *
 * El mundo 3 enseñó la ficha de repetir y el 4 a encontrar el patrón. Aquí lo que
 * se aprende es el número, que parece la parte tonta y es la que falla. Un bucle
 * con un número de menos deja al Fuzz a mitad de camino. Con uno de más lo manda
 * contra el borde, o al vacío. No hay término medio y no hay aviso.
 *
 * Y hay una regla del modo rodar que aquí se vuelve visible: dos rodadas
 * seguidas en la misma dirección no existen. El Fuzz ya llegó al final del tramo
 * la primera vez. Por eso los bucles anidados de este mundo llevan un salto entre
 * medias: el salto es lo que permite volver a empezar en la misma dirección. Sin
 * él, un bucle dentro de otro no tendría dónde encajar.
 *
 * Progresión:
 *   1-4    un bucle, un número, cuentas cada vez más largas. Hasta doce.
 *   5-9    trozos fuera del bucle: antes, después, y a los dos lados.
 *   10-14  un bucle dentro de otro. Dos números, y cada uno cuenta otra cosa.
 *   15-17  tres niveles. El programa tiene tres pisos y ocho fichas.
 *   18-20  la subida entera de la montaña.
 */
import {
  actividadExplorador,
  estrellasEn,
  repite,
  rueda,
  salta,
  tableroDePrograma,
  type ContextoExplorador,
  type Movimiento,
} from '../src/generadores-exploradores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const COMANDOS = ['derecha', 'izquierda', 'arriba', 'abajo', 'saltar', 'repetir'];

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly movimientos: readonly Movimiento[];
  readonly estrellas?: number;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Seis escalones de neon',
    instruccion:
      'Chispa esta rodando montana abajo y no piensa parar. Tu si vas a parar, y en el escalon exacto. Cuenta los escalones antes de escribir el numero.',
    exito: 'Seis. Chispa ha pasado tres veces por delante mientras contabas.',
    pistas: ['El patron es derecha y abajo, como siempre.', 'Cuenta los escalones: son seis.'],
    movimientos: [repite(6, rueda('derecha'), rueda('abajo'))],
  },
  {
    nombre: 'Ocho',
    instruccion: 'Ocho escalones. Uno de menos y te quedas a mitad. Uno de mas y Chispa se estrella.',
    exito: 'Ocho justos. Ni siete ni nueve, y la diferencia entre las tres cosas es un numero.',
    pistas: ['Cuenta despacio, escalon por escalon.', 'Son ocho.'],
    movimientos: [repite(8, rueda('derecha'), rueda('abajo'))],
    estrellas: 1,
  },
  {
    nombre: 'Diez',
    instruccion:
      'Diez. A partir de aqui contar de un vistazo ya no funciona, hay que ir senalando con el dedo.',
    exito: 'Diez. El dedo en la pantalla no es hacer trampa: es lo que hacemos todos.',
    pistas: ['Senala cada escalon con el dedo mientras cuentas.', 'Son diez.'],
    movimientos: [repite(10, rueda('derecha'), rueda('abajo'))],
    estrellas: 2,
  },
  {
    nombre: 'Doce',
    instruccion:
      'Doce escalones, y la ladera entera de la montana. Este es el numero mas grande que vas a escribir hoy.',
    exito: 'Doce. Veinticuatro movimientos con tres fichas. Chispa lleva noventa y una vueltas.',
    pistas: ['No cuentes los movimientos: cuenta los escalones.', 'Cada escalon son dos movimientos.'],
    movimientos: [repite(12, rueda('derecha'), rueda('abajo'))],
    estrellas: 2,
  },
  {
    nombre: 'Rodar y saltar cinco veces',
    instruccion: 'Cinco huecos en la ladera. Ya sabes el patron: rueda y salta. Solo hay que acertar el numero.',
    exito: 'Cinco. Aqui pasarse de uno significa saltar sin suelo al otro lado.',
    pistas: ['Cuenta los huecos, que son mas faciles de ver que las casillas.', 'Son cinco.'],
    movimientos: [repite(5, rueda('derecha'), salta())],
    estrellas: 1,
  },
  {
    nombre: 'La cuesta arriba',
    instruccion:
      'Ahora se sube. La montana es de neon y arriba es donde esta Chispa, dando vueltas. Seis escalones hacia arriba.',
    exito: 'Subiendo cuenta igual. La montana no sabe si subes o bajas.',
    pistas: ['El patron es subir y derecha.', 'Seis escalones.'],
    movimientos: [repite(6, rueda('arriba'), rueda('derecha'))],
    estrellas: 1,
  },
  {
    nombre: 'Un trozo antes',
    instruccion:
      'Cuidado con el principio: hay un tramo que no forma parte del patron. Ese va suelto, delante del bucle.',
    exito:
      'El trozo suelto delante y el bucle detras. Meterlo dentro habria repetido cinco veces algo que solo pasa una.',
    pistas: ['El primer tramo largo no se repite: va fuera.', 'Despues empieza el patron de cinco escalones.'],
    movimientos: [rueda('derecha', 3), repite(5, rueda('abajo'), rueda('derecha'))],
    estrellas: 1,
  },
  {
    nombre: 'Un trozo despues',
    instruccion: 'Y ahora el trozo suelto esta al final. Mira el tablero entero antes de decidir donde acaba el patron.',
    exito: 'El bucle primero y la cola despues. Saber donde acaba el patron es la mitad del trabajo.',
    pistas: ['Cuenta los escalones del patron: cinco.', 'El tramo largo del final va fuera del bucle.'],
    movimientos: [repite(5, rueda('derecha'), rueda('abajo')), rueda('derecha', 3)],
    estrellas: 2,
  },
  {
    nombre: 'Un trozo a cada lado',
    instruccion:
      'Un tramo suelto delante, el patron en medio, y otro tramo suelto detras. Tres partes. Y solo una lleva bucle.',
    exito: 'Tres partes bien separadas. Tu programa ya se lee como una frase.',
    pistas: ['Empieza por identificar donde arranca el patron y donde termina.', 'El patron son seis escalones.'],
    movimientos: [
      rueda('derecha', 2),
      repite(6, rueda('abajo'), rueda('derecha')),
      rueda('abajo', 3),
    ],
    estrellas: 2,
  },
  {
    nombre: 'Dos bucles distintos',
    instruccion:
      'Dos patrones seguidos: primero escalones lisos y luego escalones con hueco. Dos bucles, y cada uno con lo suyo.',
    exito: 'Dos bucles con numeros y contenidos distintos. Ya no confundes uno con otro.',
    pistas: ['El primer patron son cuatro escalones lisos.', 'El segundo es rodar y saltar, tres veces.'],
    movimientos: [
      repite(4, rueda('derecha'), rueda('abajo')),
      repite(3, rueda('derecha'), salta()),
    ],
    estrellas: 2,
  },
  {
    nombre: 'Un bucle dentro de otro',
    instruccion:
      'Dos huecos, un escalon, dos huecos, un escalon, tres veces. El bucle de dentro cuenta los huecos y el de fuera cuenta los escalones. No los mezcles.',
    exito: 'Dos numeros para dos cosas distintas. El de dentro son huecos y el de fuera escalones.',
    pistas: ['Dentro: rodar y saltar, dos veces.', 'Fuera: todo eso mas el escalon, tres veces.'],
    movimientos: [repite(3, repite(2, rueda('derecha'), salta()), rueda('abajo'))],
    estrellas: 2,
  },
  {
    nombre: 'El salto que separa',
    instruccion:
      'Fijate en una cosa rara: entre cada grupo de escalones hay un hueco. No es decoracion. Sin ese hueco el bucle de dentro no podria volver a empezar, porque el Fuzz ya habria rodado hasta el final.',
    exito:
      'El salto es lo que deja al Fuzz listo para volver a rodar. Dos rodadas seguidas en la misma direccion no existen: la primera ya llego al final.',
    pistas: ['Dentro del bucle pequeno van dos escalones.', 'El salto va fuera del bucle pequeno y dentro del grande.'],
    movimientos: [repite(3, repite(2, rueda('derecha'), rueda('abajo')), salta())],
    estrellas: 2,
  },
  {
    nombre: 'El bucle de dentro baja',
    instruccion: 'Ahora el bucle pequeno baja saltando y el grande avanza a la derecha. Cual va dentro?',
    exito: 'El que se repite mas veces seguidas va dentro. Siempre.',
    pistas: ['Dentro: bajar y saltar, dos veces.', 'Fuera: una rodada a la derecha y todo eso, tres veces.'],
    movimientos: [repite(3, rueda('derecha'), repite(2, rueda('abajo'), salta()))],
    estrellas: 2,
  },
  {
    nombre: 'Dos bucles dentro de uno',
    instruccion:
      'Dentro del bucle grande caben dos pequenos, uno detras del otro: tres saltos a la derecha y tres saltos hacia abajo. Y todo eso, dos veces.',
    exito: 'Tres pisos y siete fichas. Escribirlo entero habrian sido veinticuatro movimientos.',
    pistas: ['Un bucle para los saltos de la derecha y otro para los de abajo.', 'Los dos dentro del grande.'],
    movimientos: [
      repite(2, repite(3, rueda('derecha'), salta()), repite(3, rueda('abajo'), salta())),
    ],
    estrellas: 3,
  },
  {
    nombre: 'Tres pisos',
    instruccion:
      'Esto tiene tres niveles: un bucle, dentro otro bucle, y dentro otro. Empieza por el mas pequeno, el que se repite mas veces seguidas, y ve saliendo hacia fuera.',
    exito:
      'Tres bucles metidos uno dentro de otro. Siete fichas para veintiocho movimientos, y Chispa sigue sin frenar.',
    pistas: [
      'El mas pequeno son dos escalones: derecha y abajo.',
      'El del medio repite eso dos veces y anade un salto. El de fuera repite eso dos veces y anade otro.',
    ],
    movimientos: [
      repite(2, repite(2, repite(2, rueda('derecha'), rueda('abajo')), salta()), salta()),
    ],
    estrellas: 3,
  },
  {
    nombre: 'Tres pisos al reves',
    instruccion:
      'Los mismos tres niveles pero girados: ahora el escalon empieza bajando. Si entendiste el anterior, este es el mismo con otra cara.',
    exito: 'El mismo programa girado. Lo que aprendiste no era el tablero: era la forma.',
    pistas: ['El mas pequeno es bajar y derecha, dos veces.', 'Los saltos van hacia la derecha.'],
    movimientos: [
      repite(2, repite(2, repite(2, rueda('abajo'), rueda('derecha')), salta()), salta()),
    ],
    estrellas: 3,
  },
  {
    nombre: 'Nueve y dos colas',
    instruccion:
      'Nueve escalones y un tramo suelto a cada lado. Es el mas largo de contar de toda la montana. Cuenta dos veces antes de jugar.',
    exito: 'Nueve, con sus dos colas. Si te hubieras equivocado en uno, lo habrias visto en el ultimo escalon.',
    pistas: ['Los tramos largos de los extremos van fuera del bucle.', 'El patron del medio son nueve escalones.'],
    movimientos: [
      rueda('derecha', 2),
      repite(9, rueda('abajo'), rueda('derecha')),
      rueda('abajo', 2),
    ],
    estrellas: 3,
  },
  {
    nombre: 'La ladera partida',
    instruccion:
      'Dos bucles anidados, y despues un trozo que no se parece a nada. Ese ultimo trozo va suelto, y si intentas meterlo dentro te sobrara camino.',
    exito: 'El bucle hasta donde llega el patron, y el resto suelto. No todo lo que sobra es un error.',
    pistas: [
      'Dos saltos a la derecha, dos saltos abajo, dos veces.',
      'Y luego una rodada y un salto que van fuera de todo.',
    ],
    movimientos: [
      repite(2, repite(2, rueda('derecha'), salta()), repite(2, rueda('abajo'), salta())),
      rueda('derecha'),
      salta(),
    ],
    estrellas: 3,
  },
  {
    nombre: 'Lo que Chispa oyo',
    instruccion:
      'Chispa dice que puede seguir rodando y hablando a la vez, y es verdad. Dice que la noche de la tormenta oyo a alguien contando. Contando hacia atras. Sube a buscarla.',
    exito:
      'Contando hacia atras, dijo. Cinco, cuatro, tres. Y luego el ruido. Chispa cree que fue un sueno porque estaba rodando, pero Chispa siempre esta rodando.',
    pistas: ['Sube con el bucle grande y cuenta los escalones de subida.', 'El tramo del final va fuera del bucle.'],
    movimientos: [repite(7, rueda('arriba'), rueda('derecha')), rueda('arriba', 3)],
    estrellas: 3,
  },
  {
    nombre: 'Donde esta Chispa',
    instruccion:
      'Ultimo de la montana. Chispa rodo hasta abajo del todo y sigue dando vueltas al fondo del barranco. Baja por ella. El camino tiene tres partes y las tres son cosas que ya sabes hacer.',
    exito:
      'Chispa freno. Dice que es la primera vez en su vida y que le ha gustado, aunque no piensa repetirlo. Ocho Fuzzes en casa. Faltan dos.',
    pistas: [
      'La primera parte es un bucle dentro de otro: dos saltos abajo y una rodada, tres veces.',
      'Luego un tramo suelto y al final tres saltos a la derecha.',
    ],
    movimientos: [
      repite(3, repite(2, rueda('abajo'), salta()), rueda('derecha')),
      rueda('abajo', 2),
      repite(3, rueda('derecha'), salta()),
    ],
    estrellas: 3,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoExplorador = {
    mundo: 8,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const tablero = tableroDePrograma({ movimientos: receta.movimientos });

  return actividadExplorador(contexto, {
    plan: {
      tramos: tablero.tramos,
      agujeros: tablero.agujeros,
      estrellas: estrellasEn(tablero.firmes, receta.estrellas ?? 0),
    },
    comandos: COMANDOS,
    solucion: tablero.fichas,
    exigeEstructuras: ['repetir'],
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 70 : undefined,
  });
});

export const mundo8: WorldContentFile = {
  mundo: 8,
  slug: 'montana-neon',
  nombre: 'La Montana Neon',
  introTexto:
    'Chispa lleva rodando montana abajo desde la noche de la tormenta y ya ha dado ochenta y siete vueltas. Las he contado. El problema no es que ruede: es que no sabe cuando parar. Si le dices repite muchas veces se pasa, y si le dices pocas se queda corta. Aqui vas a aprender lo que parece la parte tonta de un bucle y es la que falla: el numero.',
  actividades,
};
