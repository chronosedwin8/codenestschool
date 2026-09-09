/**
 * Mundo 28: El Centro de Drones. Salir de un laberinto que no conoces.
 *
 * Este mundo tenía un problema de diseño serio. Un algoritmo de rutas de verdad
 * (los que calculan el camino más corto) necesita ver el mapa entero, y la API del
 * Fuzz solo ve la casilla de delante. Escribir uno aquí sería mentira: haría falta
 * darle al programa un mapa que el Fuzz no tiene forma de conocer.
 *
 * Pero hay un algoritmo de rutas que funciona exactamente con lo que el Fuzz sí
 * tiene, y es el que se usa de verdad cuando un robot no tiene mapa: seguir la
 * pared. Se resume en tres líneas y sale de cualquier laberinto cuyas paredes
 * estén todas conectadas:
 *
 *     gira a la derecha
 *     mientras no puedas avanzar, gira a la izquierda
 *     avanza
 *
 * Que eso funcione no es evidente, y la actividad quinta lo hace ver: el dron
 * entra en un pasillo sin salida, da la vuelta él solo y sigue. Nadie le ha dicho
 * que ese pasillo no llevaba a ninguna parte.
 *
 * Lo que hizo falta construir para este mundo: las vueltas del bucle no se pueden
 * contar a mano, porque el recorrido del algoritmo incluye los pasillos falsos que
 * explora y de los que vuelve. Se calculan simulando el propio algoritmo sobre el
 * tablero, con el mismo simulador que usa el juego. Es la primera vez en todo el
 * currículo que el generador tiene que ejecutar la solución para saber un número
 * de la actividad.
 *
 * Progresión:
 *   1-4    seguir la pared por la derecha, en laberintos sin trampas.
 *   5-9    pasillos sin salida: el dron entra, vuelve y sigue.
 *   10-13  seguir la pared por el otro lado, y por qué a veces cambia el resultado.
 *   14-17  el algoritmo en una función, y contar lo que ha explorado.
 *   18-20  el mapa del centro de drones.
 */
import { GridSimulator } from '@codenest/shared';
import { actividadHacker, type ContextoHacker } from '../src/generadores-hackers.js';
import {
  andar,
  estrellaAqui,
  gira,
  senuelo,
  tableroDeCamino,
  type PasoCamino,
} from '../src/generadores-creadores.js';
import type { ActivityDefinition, WorldContentFile } from '@codenest/shared';

const API = ['avanzar', 'girarDerecha', 'girarIzquierda', 'puedeAvanzar', 'hayObstaculo'];

/**
 * Cuántas vueltas necesita el seguidor de pared para llegar a la meta.
 *
 * Se ejecuta el algoritmo sobre el tablero de verdad, con el simulador del juego,
 * y se cuentan las vueltas hasta que el Fuzz pisa la meta. No hay forma de contarlo
 * leyendo el tablero: el recorrido depende de los pasillos sin salida en los que
 * entra y de los que vuelve, y eso solo se sabe recorriéndolo.
 *
 * Si el algoritmo no llegara, esto revienta al compilar el contenido, que es
 * exactamente cuando se quiere saber.
 */
function vueltasDelSeguidor(
  camino: readonly PasoCamino[],
  lado: 'derecha' | 'izquierda',
  etiqueta: string,
): number {
  const tablero = tableroDeCamino(camino, 'derecha', etiqueta);
  const sim = new GridSimulator({
    grid: tablero.grid,
    spawn: tablero.spawn,
    items: tablero.items,
    modo: 'paso',
    comandosPermitidos: API,
    topeEjecucion: 20000,
  });

  const haciaLaPared = lado === 'derecha' ? () => sim.girarDerecha() : () => sim.girarIzquierda();
  const alOtroLado = lado === 'derecha' ? () => sim.girarIzquierda() : () => sim.girarDerecha();

  for (let vueltas = 1; vueltas <= 400; vueltas++) {
    haciaLaPared();
    let giros = 0;
    while (!sim.puedeAvanzar()) {
      alOtroLado();
      giros += 1;
      if (giros > 4) {
        throw new Error(`${etiqueta}: el seguidor de pared se ha quedado encerrado.`);
      }
    }
    sim.avanzar();
    if (sim.estado.x === tablero.meta.x && sim.estado.y === tablero.meta.y) return vueltas;
  }

  throw new Error(`${etiqueta}: el seguidor de pared no llega a la meta en 400 vueltas.`);
}

/** Laberinto en espiral que se abre, sin pasillos sin salida. */
function laberinto(brazos: number, primero = 4): PasoCamino[] {
  const pasos: PasoCamino[] = [];
  for (let i = 0; i < brazos; i++) {
    pasos.push(andar(primero + i));
    if (i < brazos - 1) pasos.push(gira('derecha'));
  }
  return pasos;
}

/**
 * Laberinto de peine: un pasillo recto con dientes que no llevan a ninguna parte.
 *
 * Esta forma existe por un fallo que costo encontrar. El primer intento ponia los
 * pasillos sin salida en una espiral, y en una espiral apretada los brazos
 * paralelos quedan a dos casillas, asi que un diente de una casilla se mete justo
 * en el hueco y toca los dos pasillos. Eso convierte el laberinto en uno con
 * ciclos, y seguir la pared es exactamente el algoritmo que en un laberinto con
 * ciclos se queda dando vueltas para siempre: el dron recorria el mismo tramo doce
 * veces y no llegaba nunca.
 *
 * Un peine no puede tener ciclos: los dientes cuelgan del pasillo y no se tocan
 * entre ellos. Y ademas es la forma donde mejor se ve lo que hace el algoritmo,
 * porque entra en cada diente y sale.
 */
function peine(dientes: number, opciones: { tramo?: number; hondo?: number } = {}): PasoCamino[] {
  const tramo = opciones.tramo ?? 2;
  const hondo = opciones.hondo ?? 2;
  const pasos: PasoCamino[] = [];

  for (let i = 0; i < dientes; i++) {
    pasos.push(andar(tramo));
    // Girar no mueve al Fuzz, asi que esto pinta el diente hacia abajo y vuelve
    // a mirar al frente sin haberse movido de la casilla.
    pasos.push(gira('derecha'), senuelo(hondo), gira('izquierda'));
  }
  pasos.push(andar(tramo));
  return pasos;
}

interface Receta {
  readonly nombre: string;
  readonly instruccion: string;
  readonly exito: string;
  readonly pistas: readonly [string, string];
  readonly camino: readonly PasoCamino[];
  readonly lado?: 'derecha' | 'izquierda';
  /** El programa, que recibe las vueltas ya calculadas. */
  readonly programa: (vueltas: number) => string;
  /**
   * Si la actividad se ofrece tambien en Python.
   *
   * Se declara a mano y no se deduce: las actividades cuyo programa lleva una
   * funcion con un parametro de texto se quedan en JavaScript, porque escribir la
   * misma cosa en Python no anade nada y alarga la actividad.
   */
  readonly conPython?: boolean;
  readonly arranqueJs?: string;
}

/** El seguidor de pared, escrito. */
function seguidor(vueltas: number, lado: 'derecha' | 'izquierda' = 'derecha'): string {
  const haciaLaPared = lado === 'derecha' ? 'girarDerecha' : 'girarIzquierda';
  const alOtroLado = lado === 'derecha' ? 'girarIzquierda' : 'girarDerecha';
  return `for (let i = 0; i < ${vueltas}; i++) {
  fuzz.${haciaLaPared}();
  while (fuzz.puedeAvanzar() === false) {
    fuzz.${alOtroLado}();
  }
  fuzz.avanzar();
}`;
}

/** El mismo seguidor, en Python. */
function seguidorPy(vueltas: number, lado: 'derecha' | 'izquierda' = 'derecha'): string {
  const haciaLaPared = lado === 'derecha' ? 'girarDerecha' : 'girarIzquierda';
  const alOtroLado = lado === 'derecha' ? 'girarIzquierda' : 'girarDerecha';
  return `for i in range(${vueltas}):
    fuzz.${haciaLaPared}()
    while fuzz.puedeAvanzar() == False:
        fuzz.${alOtroLado}()
    fuzz.avanzar()`;
}

const RECETAS: readonly Receta[] = [
  {
    nombre: 'Seguir la pared',
    instruccion:
      'El Centro de Drones manda drones a sitios que nadie ha visto, y un dron no lleva mapa. Existe un algoritmo para eso y son tres lineas: gira hacia la pared, mientras no puedas avanzar gira al otro lado, y avanza. Con eso se sale de cualquier laberinto.',
    exito:
      'Tres lineas y el dron ha salido de un laberinto que no conocia. Se llama seguir la pared, y es lo que hacen los robots de verdad cuando no tienen mapa.',
    pistas: [
      'Primero gira a la derecha, siempre, aunque parezca que no toca.',
      'Y luego, mientras no puedas avanzar, gira a la izquierda.',
    ],
    camino: laberinto(3),
    conPython: true,
    programa: (v) => seguidor(v),
    arranqueJs: `for (let i = 0; i < 20; i++) {
  // gira hacia la pared
  // mientras no puedas avanzar, gira al otro lado
  // avanza
}
`,
  },
  {
    nombre: 'Cinco esquinas',
    instruccion: 'Cinco esquinas y el mismo programa. El dron no sabe cuantas hay.',
    exito: 'Cinco esquinas sin saber que existian. Lo unico que hay que acertar es el numero de vueltas.',
    pistas: ['El programa no cambia.', 'Cada vuelta adelanta una casilla.'],
    camino: laberinto(5),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'Siete esquinas',
    instruccion: 'Siete esquinas. El programa sigue teniendo tres lineas.',
    exito: 'Siete esquinas. El programa no ha crecido y el laberinto si.',
    pistas: ['Cuenta las casillas del camino.', 'Cada vuelta es una casilla.'],
    camino: laberinto(7),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'Sensores de los drones',
    instruccion: 'Hay sensores por el laberinto. Pasa por encima de todos.',
    exito: 'Los sensores. Los drones los dejan caer para saber por donde han pasado.',
    pistas: ['El seguidor de pared de siempre.', 'Los sensores estan en las esquinas.'],
    camino: laberinto(5).flatMap((paso) => ('gira' in paso ? [estrellaAqui(), paso] : [paso])),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'El pasillo sin salida',
    instruccion:
      'Aqui esta lo bueno del algoritmo. Este laberinto tiene un pasillo que no lleva a ninguna parte, y el dron va a entrar en el. Y va a salir solo, sin que le digas nada. Mira lo que pasa.',
    exito:
      'El dron ha entrado, ha llegado al fondo, ha dado la vuelta y ha seguido. Nadie le ha dicho que ese pasillo no valia: lo ha descubierto y ha vuelto. Eso es lo que hace que seguir la pared sea un algoritmo y no un truco.',
    pistas: [
      'No cambies el programa: el algoritmo se encarga.',
      'Cuenta las vueltas contando tambien las que se gastan entrando y saliendo del pasillo falso.',
    ],
    camino: peine(1, { hondo: 3 }),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'Dos pasillos sin salida',
    instruccion: 'Dos pasillos falsos. El dron entra en los dos y sale de los dos.',
    exito: 'Dos pasillos explorados y abandonados. El dron gasta pasos y no se pierde, que es el trato.',
    pistas: ['El programa es el mismo.', 'Las vueltas suben por lo que se explora de mas.'],
    camino: peine(2, { hondo: 2 }),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'Tres pasillos sin salida',
    instruccion: 'Tres. El dron va a recorrer bastante mas que el camino bueno.',
    exito:
      'Seguir la pared no encuentra el camino mas corto: encuentra un camino. Que no es lo mismo, y a veces es suficiente.',
    pistas: ['El programa no cambia.', 'Piensa cuantas casillas de mas gasta cada pasillo falso.'],
    camino: peine(3, { hondo: 2 }),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'Pasillos largos sin salida',
    instruccion: 'Los pasillos falsos son mas largos. El dron los recorre enteros de ida y de vuelta.',
    exito:
      'Ida y vuelta por cada pasillo falso. Eso es el precio de no tener mapa, y es exactamente lo que se ahorra teniendolo.',
    pistas: ['El algoritmo es el mismo.', 'Cada pasillo falso cuesta el doble de su largo.'],
    camino: peine(2, { hondo: 4 }),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'Nueve esquinas y dos trampas',
    instruccion: 'Nueve esquinas, dos pasillos falsos, y tres lineas de programa.',
    exito: 'Nueve esquinas y dos trampas con tres lineas. El Centro de Drones te ha fichado.',
    pistas: ['No cambies nada.', 'Solo el numero de vueltas.'],
    camino: peine(4, { hondo: 2 }),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'Seguir la pared del otro lado',
    instruccion:
      'El mismo algoritmo se puede hacer con la pared de la izquierda: gira a la izquierda y, mientras no puedas, gira a la derecha. En este laberinto los dos llegan.',
    exito:
      'Los dos lados funcionan. En un laberinto con todas las paredes conectadas, da igual que pared sigas: siempre hay salida.',
    pistas: ['Cambia los dos giros de sitio.', 'El resto del programa es igual.'],
    camino: laberinto(4),
    lado: 'izquierda',
    programa: (v) => seguidor(v, 'izquierda'),
  },
  {
    nombre: 'Cuando un lado es mejor',
    instruccion:
      'Aqui los dos lados llegan y uno gasta muchos menos pasos, porque los pasillos falsos estan todos a un lado. Usa el de la izquierda y compara.',
    exito:
      'El mismo algoritmo, la mitad de pasos. Cual es mejor depende del laberinto, y sin mapa no hay forma de saberlo antes de entrar.',
    pistas: ['El de la izquierda evita los pasillos falsos de la derecha.', 'El programa es el mismo con los giros cambiados.'],
    camino: peine(3, { hondo: 3 }),
    lado: 'izquierda',
    programa: (v) => seguidor(v, 'izquierda'),
  },
  {
    nombre: 'El algoritmo en una funcion',
    instruccion:
      'Mete el algoritmo en una funcion que reciba cuantos pasos dar. El programa de fuera queda en una linea y se lee como lo que hace.',
    exito:
      'Una funcion que sale de laberintos. Le pasas los pasos y no le importa el laberinto: eso es lo que hace util un algoritmo con nombre.',
    pistas: ['La funcion recibe los pasos.', 'Y dentro va el bucle de tres lineas.'],
    camino: peine(2, { hondo: 3 }),
    programa: (v) => `function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

seguirPared(${v});`,
  },
  {
    nombre: 'La funcion con el lado como parametro',
    instruccion:
      'Y ahora que la funcion reciba tambien por que lado seguir. Dentro decide con un if que giro usar.',
    exito:
      'Un algoritmo con dos parametros: cuanto y por donde. Ya no es codigo escrito para un tablero: es una herramienta.',
    pistas: ['El segundo parametro es el lado, escrito como texto.', 'Dentro, un if elige que giro hacer.'],
    camino: peine(2, { hondo: 2 }),
    lado: 'izquierda',
    programa: (v) => `function seguirPared(pasos, lado) {
  for (let i = 0; i < pasos; i++) {
    if (lado === "derecha") {
      fuzz.girarDerecha();
    } else {
      fuzz.girarIzquierda();
    }
    while (fuzz.puedeAvanzar() === false) {
      if (lado === "derecha") {
        fuzz.girarIzquierda();
      } else {
        fuzz.girarDerecha();
      }
    }
    fuzz.avanzar();
  }
}

seguirPared(${v}, "izquierda");`,
  },
  {
    nombre: 'Contar los giros',
    instruccion:
      'Cuenta cuantos giros ha hecho el dron en total. Ese numero dice lo retorcido que era el laberinto, y no se sabia antes de entrar.',
    exito:
      'El dron ha medido lo retorcido del laberinto mientras salia. Los algoritmos sin mapa aprenden el mapa recorriendolo.',
    pistas: ['Una variable que sube en cada giro.', 'Cuidado: hay giros en dos sitios del programa.'],
    camino: peine(3, { hondo: 2 }),
    programa: (v) => `let giros = 0;
for (let i = 0; i < ${v}; i++) {
  fuzz.girarDerecha();
  giros = giros + 1;
  while (fuzz.puedeAvanzar() === false) {
    fuzz.girarIzquierda();
    giros = giros + 1;
  }
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Contar los pasillos falsos',
    instruccion:
      'Cada vez que el dron da media vuelta entera, es que estaba en un pasillo sin salida. Cuenta cuantas veces pasa: son los pasillos falsos del laberinto.',
    exito:
      'Dos medias vueltas, dos pasillos falsos. El dron ha contado las trampas del laberinto sin verlas, solo por como se ha tenido que mover.',
    pistas: ['Una media vuelta son dos giros seguidos al otro lado.', 'Cuenta cuantas veces el while gira dos veces o mas.'],
    camino: peine(3, { hondo: 3 }),
    programa: (v) => `let callejones = 0;
for (let i = 0; i < ${v}; i++) {
  fuzz.girarDerecha();
  let giros = 0;
  while (fuzz.puedeAvanzar() === false) {
    fuzz.girarIzquierda();
    giros = giros + 1;
  }
  if (giros >= 2) {
    callejones = callejones + 1;
  }
  fuzz.avanzar();
}`,
  },
  {
    nombre: 'Once esquinas',
    instruccion: 'Once esquinas y tres pasillos falsos. Es el laberinto grande del centro.',
    exito: 'Once esquinas. El dron ha salido y no ha tenido que preguntar a nadie.',
    pistas: ['La funcion del seguidor.', 'Cuenta bien las vueltas: los pasillos falsos suman.'],
    camino: peine(6, { hondo: 2 }),
    programa: (v) => `function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

seguirPared(${v});`,
  },
  {
    nombre: 'El laberinto en Python',
    instruccion: 'El mismo algoritmo en Python. La sangria hace el trabajo de las llaves.',
    exito: 'Tres lineas en Python. El algoritmo es el mismo y en los dos lenguajes se lee igual de claro.',
    pistas: ['El while se escribe con dos puntos y sangria.', 'Y la comparacion con False lleva mayuscula.'],
    camino: peine(2, { hondo: 2 }),
    conPython: true,
    programa: (v) => seguidor(v),
  },
  {
    nombre: 'El dron que no volvio',
    instruccion:
      'Dron dice que la noche de la tormenta mando un dron a mirar el cielo y que no volvio. Y que hace una semana el dron aparecio en el hangar, apagado, con la bateria llena. Ve a verlo.',
    exito:
      'El dron tiene el registro de vuelo intacto. Subio, y a las tres y catorce grabo algo que salia del Nucleo hacia arriba. Y despues el registro se corta cuatro semanas, hasta que aparecio en el hangar. Nadie sabe donde estuvo.',
    pistas: ['La funcion del seguidor de pared.', 'Ocho esquinas y dos pasillos falsos.'],
    camino: peine(5, { hondo: 3 }),
    programa: (v) => `function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

seguirPared(${v});`,
  },
  {
    nombre: 'El hangar',
    instruccion:
      'El hangar del centro es el laberinto mas grande que has visto, con cuatro pasillos falsos. El dron sale igual.',
    exito: 'El hangar entero. Y el dron que volvio sigue en su sitio, apagado, con la bateria llena.',
    pistas: ['El seguidor de pared por la derecha.', 'Cuenta las vueltas con calma.'],
    camino: peine(7, { hondo: 2 }),
    programa: (v) => `function seguirPared(pasos) {
  for (let i = 0; i < pasos; i++) {
    fuzz.girarDerecha();
    while (fuzz.puedeAvanzar() === false) {
      fuzz.girarIzquierda();
    }
    fuzz.avanzar();
  }
}

seguirPared(${v});`,
  },
  {
    nombre: 'Donde esta Dron',
    instruccion:
      'Ultimo del centro. Dron esta en el hangar con el dron que volvio encima de la mesa, mirando el registro de las cuatro semanas que faltan. Ve a por el.',
    exito:
      'Dron esta en casa, y ha traido el dron que volvio. Lo ha puesto en la pared del Nido con todo lo demas. Manana es el ultimo mundo: el Nucleo de la IA. Y ya sabes lo que vas a encontrar alli, porque llevas veintinueve mundos encontrando pistas de lo mismo.',
    pistas: [
      'La funcion con el lado como parametro, si quieres.',
      'Nueve esquinas y tres pasillos falsos.',
    ],
    camino: peine(6, { hondo: 3 }),
    programa: (v) => `function seguirPared(pasos, lado) {
  for (let i = 0; i < pasos; i++) {
    if (lado === "derecha") {
      fuzz.girarDerecha();
    } else {
      fuzz.girarIzquierda();
    }
    while (fuzz.puedeAvanzar() === false) {
      if (lado === "derecha") {
        fuzz.girarIzquierda();
      } else {
        fuzz.girarDerecha();
      }
    }
    fuzz.avanzar();
  }
}

seguirPared(${v}, "derecha");`,
  },
];

const actividades: ActivityDefinition[] = RECETAS.map((receta, indice) => {
  const contexto: ContextoHacker = {
    mundo: 28,
    numeroEnMundo: indice + 1,
    textos: {
      nombre: receta.nombre,
      instruccion: receta.instruccion,
      exito: receta.exito,
      pistas: receta.pistas,
    },
  };

  const etiqueta = `M28-A${indice + 1} "${receta.nombre}"`;
  const vueltas = vueltasDelSeguidor(receta.camino, receta.lado ?? 'derecha', etiqueta);

  return actividadHacker(contexto, {
    camino: receta.camino,
    api: API,
    javascript: receta.programa(vueltas),
    ...(receta.conPython ? { python: seguidorPy(vueltas, receta.lado ?? 'derecha') } : {}),
    ...(receta.arranqueJs ? { arranque: { javascript: receta.arranqueJs } } : {}),
    tipo: indice === 19 ? 'integrador' : undefined,
    monedas: indice === 19 ? 160 : undefined,
  });
});

export const mundo28: WorldContentFile = {
  mundo: 28,
  slug: 'centro-de-drones',
  nombre: 'El Centro de Drones',
  introTexto:
    'El Centro de Drones manda drones a sitios que nadie ha visto, y un dron no lleva mapa. Para eso existe un algoritmo que cabe en tres lineas y sale de cualquier laberinto: seguir la pared. Gira hacia la pared, mientras no puedas avanzar gira al otro lado, y avanza. Lo mejor es lo que pasa cuando entra en un pasillo sin salida: da la vuelta el solo, y nadie le ha dicho que ese pasillo no llevaba a ninguna parte.',
  actividades,
};
