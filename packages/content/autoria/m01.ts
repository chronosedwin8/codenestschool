/**
 * Mundo 1: El Planeta de los Fuzzes. Secuencias directas simples.
 *
 * Progresión de las 20 actividades, pensada para un niño de cuatro años que
 * nunca ha programado:
 *
 *   1-4    una sola flecha. Aprender qué hace una ficha y que hay que pulsar
 *          jugar. Sin giros todavía.
 *   5-9    dos tramos. Aparece la idea de que el orden importa.
 *   10-14  tres tramos y estrellas por el camino.
 *   15-18  cuatro tramos, recorridos que hay que leer completos antes de actuar.
 *   19-20  cinco tramos. El de cierre pide planificar de verdad.
 *
 * Los textos son lo único escrito a mano, porque son lo que el niño oirá. La
 * geometría la produce el generador, que garantiza que el camino sea transitable
 * y que la solución de referencia sea la óptima.
 */
import { actividadRodar, type ContextoGenerador, type Tramo } from '../src/generadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const BASE = {
  mundo: 1,
  grupo: 'exploradores',
  editor: 'comandos',
  lenguajes: ['comandos'],
} as const satisfies Omit<ContextoGenerador, 'numeroEnMundo' | 'textos'>;

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly tramos: readonly Tramo[];
  readonly estrellas?: readonly number[];
}

/** Las 20 actividades del mundo, en orden de dificultad. */
const RECETAS: readonly Receta[] = [
  {
    nombre: 'El primer paso',
    instruccion:
      'Tu Fuzz quiere llegar a la estrella. Arrastra la flecha que apunta a la derecha y toca el boton verde para verlo rodar.',
    exito: 'Lo lograste. Tu Fuzz rodo hasta la estrella siguiendo tu flecha.',
    pistas: [
      'Busca la flecha que apunta hacia la derecha y ponla en la barra de abajo.',
      'El Fuzz rueda solo hasta que se acaba el camino. Con una flecha basta.',
    ],
    tramos: [{ dir: 'derecha', casillas: 3 }],
  },
  {
    nombre: 'Hacia abajo',
    instruccion:
      'Ahora el camino baja. Busca la flecha que apunta hacia abajo y colocala en la barra.',
    exito: 'Muy bien. Las flechas apuntan a donde quieres que vaya tu Fuzz.',
    pistas: [
      'La flecha de abajo apunta hacia el suelo.',
      'Solo necesitas una flecha, el Fuzz rueda hasta el final.',
    ],
    tramos: [{ dir: 'abajo', casillas: 3 }],
  },
  {
    nombre: 'A la izquierda',
    instruccion: 'Este camino va hacia el otro lado. Usa la flecha que apunta a la izquierda.',
    exito: 'Perfecto. Ya sabes mandar a tu Fuzz en cualquier direccion.',
    pistas: ['La flecha de la izquierda apunta al lado contrario.', 'Una sola flecha es suficiente.'],
    tramos: [{ dir: 'izquierda', casillas: 3 }],
  },
  {
    nombre: 'Hacia arriba',
    instruccion: 'La estrella esta arriba. Ya sabes cual es la flecha que te lleva alli.',
    exito: 'Genial. Con cuatro flechas puedes ir a donde quieras.',
    pistas: ['La flecha de arriba apunta al cielo.', 'Coloca una sola flecha y toca jugar.'],
    tramos: [{ dir: 'arriba', casillas: 3 }],
  },
  {
    nombre: 'La primera esquina',
    instruccion:
      'El camino dobla. Primero manda al Fuzz a la derecha y despues hacia abajo. El orden importa.',
    exito: 'Muy bien. Juntaste dos flechas en el orden correcto y eso es una secuencia.',
    pistas: [
      'Primero la flecha de la derecha, para llegar a la esquina.',
      'Despues la flecha de abajo, para bajar hasta la estrella.',
    ],
    tramos: [
      { dir: 'derecha', casillas: 3 },
      { dir: 'abajo', casillas: 2 },
    ],
  },
  {
    nombre: 'Bajar y girar',
    instruccion: 'Ahora el camino baja primero y luego dobla a la derecha. Fijate bien.',
    exito: 'Lo tenias claro. Cambiar el orden cambia el camino.',
    pistas: ['Empieza con la flecha de abajo.', 'Cuando llegue al fondo, manda al Fuzz a la derecha.'],
    tramos: [
      { dir: 'abajo', casillas: 3 },
      { dir: 'derecha', casillas: 2 },
    ],
  },
  {
    nombre: 'La estrella del camino',
    instruccion:
      'Hay una estrella en el camino. El Fuzz la recoge al pasar por encima, no tienes que hacer nada especial.',
    exito: 'Recogiste la estrella sin desviarte. Asi se planea un buen recorrido.',
    pistas: ['Sigue el camino y la estrella caera sola.', 'Derecha primero, luego abajo.'],
    tramos: [
      { dir: 'derecha', casillas: 4 },
      { dir: 'abajo', casillas: 2 },
    ],
    estrellas: [2],
  },
  {
    nombre: 'Subir a por ella',
    instruccion: 'La estrella esta arriba del todo. Sube y despues dobla hacia la derecha.',
    exito: 'Excelente. Ya lees el camino antes de programarlo.',
    pistas: ['Primero sube con la flecha de arriba.', 'Luego ve a la derecha hasta la meta.'],
    tramos: [
      { dir: 'arriba', casillas: 3 },
      { dir: 'derecha', casillas: 3 },
    ],
    estrellas: [3],
  },
  {
    nombre: 'Dos estrellas',
    instruccion: 'Esta vez hay dos estrellas, y las dos estan en tu camino. Recogelas de paso.',
    exito: 'Las dos estrellas y la meta. Que buen recorrido.',
    pistas: ['No te desvies, las estrellas estan en el camino.', 'Derecha y despues abajo.'],
    tramos: [
      { dir: 'derecha', casillas: 4 },
      { dir: 'abajo', casillas: 3 },
    ],
    estrellas: [2, 6],
  },
  {
    nombre: 'El zigzag',
    instruccion:
      'Este camino zigzaguea como una serpiente. Mira todo el recorrido antes de poner las flechas.',
    exito: 'Perfecto. Planeaste el camino entero antes de empezar, igual que los programadores.',
    pistas: [
      'El camino va a la derecha, luego abajo y otra vez a la derecha.',
      'Cuenta los giros: necesitas tres flechas.',
    ],
    tramos: [
      { dir: 'derecha', casillas: 2 },
      { dir: 'abajo', casillas: 2 },
      { dir: 'derecha', casillas: 3 },
    ],
    estrellas: [2, 6],
  },
  {
    nombre: 'La escalera',
    instruccion: 'El camino sube como una escalera. Tres tramos, tres flechas.',
    exito: 'Subiste la escalera entera. Cada tramo es una flecha.',
    pistas: ['Empieza a la derecha.', 'Luego arriba y otra vez a la derecha.'],
    tramos: [
      { dir: 'derecha', casillas: 2 },
      { dir: 'arriba', casillas: 2 },
      { dir: 'derecha', casillas: 2 },
    ],
    estrellas: [4],
  },
  {
    nombre: 'Volver atras',
    instruccion:
      'Ojo con este: el camino te hace volver hacia atras. Sigue las casillas con la mirada.',
    exito: 'Muy bien. A veces hay que retroceder para avanzar.',
    pistas: ['Baja primero.', 'Luego ve a la izquierda y despues baja otra vez.'],
    tramos: [
      { dir: 'abajo', casillas: 2 },
      { dir: 'izquierda', casillas: 3 },
      { dir: 'abajo', casillas: 2 },
    ],
    estrellas: [3],
  },
  {
    nombre: 'La U',
    instruccion: 'El camino dibuja una U. Baja, cruza y vuelve a subir.',
    exito: 'Una U perfecta. Tres flechas bien puestas.',
    pistas: ['Primero baja hasta el fondo.', 'Cruza a la derecha y luego sube.'],
    tramos: [
      { dir: 'abajo', casillas: 3 },
      { dir: 'derecha', casillas: 3 },
      { dir: 'arriba', casillas: 3 },
    ],
    estrellas: [4],
  },
  {
    nombre: 'Tres estrellas en fila',
    instruccion: 'Hay tres estrellas repartidas por el camino. Recoge todas sin salirte.',
    exito: 'Las tres estrellas. Tu Fuzz esta muy contento.',
    pistas: ['Las tres estan sobre el camino.', 'Derecha, abajo y derecha otra vez.'],
    tramos: [
      { dir: 'derecha', casillas: 3 },
      { dir: 'abajo', casillas: 2 },
      { dir: 'derecha', casillas: 3 },
    ],
    estrellas: [2, 4, 7],
  },
  {
    nombre: 'El caracol',
    instruccion: 'Este camino da la vuelta como un caracol. Cuatro tramos, cuatro flechas.',
    exito: 'Diste toda la vuelta. Recorridos largos, mismas reglas.',
    pistas: ['Cuenta los giros del camino antes de empezar.', 'Derecha, abajo, izquierda y abajo.'],
    tramos: [
      { dir: 'derecha', casillas: 3 },
      { dir: 'abajo', casillas: 2 },
      { dir: 'izquierda', casillas: 2 },
      { dir: 'abajo', casillas: 2 },
    ],
    estrellas: [3, 7],
  },
  {
    nombre: 'La montana',
    instruccion: 'Sube por un lado y baja por el otro, como una montana.',
    exito: 'Cruzaste la montana. Ya dominas las cuatro direcciones.',
    pistas: ['Sube primero.', 'Cruza arriba, baja y termina a la derecha.'],
    tramos: [
      { dir: 'arriba', casillas: 2 },
      { dir: 'derecha', casillas: 3 },
      { dir: 'abajo', casillas: 2 },
      { dir: 'derecha', casillas: 2 },
    ],
    estrellas: [2, 6],
  },
  {
    nombre: 'El laberinto pequeno',
    instruccion:
      'Cuatro giros seguidos. Recorre el camino con el dedo antes de poner las flechas.',
    exito: 'Un laberinto resuelto a la primera. Eso es planear bien.',
    pistas: ['Sigue el camino con el dedo primero.', 'Son cuatro tramos: cuenta cada giro.'],
    tramos: [
      { dir: 'derecha', casillas: 2 },
      { dir: 'arriba', casillas: 2 },
      { dir: 'derecha', casillas: 2 },
      { dir: 'abajo', casillas: 3 },
    ],
    estrellas: [3, 8],
  },
  {
    nombre: 'El camino largo',
    instruccion: 'Este es mas largo de lo que parece. Tomate tu tiempo y recogelo todo.',
    exito: 'Un recorrido largo y sin fallos. Que bien lo haces.',
    pistas: ['No hay prisa, mira el camino entero.', 'Cuatro tramos y dos estrellas.'],
    tramos: [
      { dir: 'abajo', casillas: 2 },
      { dir: 'derecha', casillas: 4 },
      { dir: 'arriba', casillas: 3 },
      { dir: 'derecha', casillas: 2 },
    ],
    estrellas: [4, 8],
  },
  {
    nombre: 'La gran vuelta',
    instruccion:
      'Cinco tramos. Es el camino mas largo del planeta de los Fuzzes. Tu puedes con el.',
    exito: 'Increible. Cinco flechas seguidas en el orden correcto.',
    pistas: [
      'Divide el camino en trozos y cuenta los giros.',
      'Son cinco tramos: derecha, abajo, izquierda, abajo y derecha.',
    ],
    tramos: [
      { dir: 'derecha', casillas: 3 },
      { dir: 'abajo', casillas: 2 },
      { dir: 'izquierda', casillas: 2 },
      { dir: 'abajo', casillas: 2 },
      { dir: 'derecha', casillas: 3 },
    ],
    estrellas: [3, 7, 10],
  },
  {
    nombre: 'El despegue',
    instruccion:
      'Ultimo reto del planeta. Lleva al Fuzz hasta el cohete recogiendo todas las estrellas.',
    exito: 'Terminaste el planeta de los Fuzzes. Eres todo un programador. A por el bosque arcoiris.',
    pistas: [
      'Usa todo lo que has aprendido en este planeta.',
      'Cinco tramos y tres estrellas: planea antes de empezar.',
    ],
    tramos: [
      { dir: 'arriba', casillas: 2 },
      { dir: 'derecha', casillas: 3 },
      { dir: 'abajo', casillas: 3 },
      { dir: 'derecha', casillas: 2 },
      { dir: 'arriba', casillas: 2 },
    ],
    estrellas: [2, 6, 10],
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) =>
  actividadRodar(
    {
      ...BASE,
      numeroEnMundo: indice + 1,
      textos: {
        nombre: receta.nombre,
        instruccion: receta.instruccion,
        exito: receta.exito,
        pistas: receta.pistas,
      },
    },
    {
      tramos: receta.tramos,
      ...(receta.estrellas ? { estrellasEnCamino: receta.estrellas } : {}),
      // La primera actividad lleva demostración animada: el niño no sabe todavía
      // qué es arrastrar una ficha.
      ...(indice === 0 ? { demoAnimada: 'demo_m1_l1' } : {}),
      tipo: indice === 19 ? 'integrador' : undefined,
      monedas: indice === 19 ? 40 : undefined,
    },
  ),
);

export const mundo1: WorldContentFile = {
  mundo: 1,
  slug: 'planeta-de-los-fuzzes',
  nombre: 'El Planeta de los Fuzzes',
  introTexto:
    'Bienvenido al Planeta de los Fuzzes. Aqui viven unas bolitas peludas muy curiosas. Tu trabajo es guiarlas por los caminos para que recojan las estrellas. Arrastra las flechas y mira como rueda tu Fuzz.',
  actividades,
};
