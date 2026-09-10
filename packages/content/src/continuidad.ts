/**
 * Lo que pasa DESPUES de resolver.
 *
 * Un juego se sostiene por lo que ocurre entre una victoria y el siguiente
 * intento. Si al acertar la recompensa es volver a un menu, el niño ha
 * terminado; si al acertar aparece alguien retandole a lo siguiente, sigue. Aqui
 * viven esas dos cosas:
 *
 *  1. `RETOS`: lo que Nube dice al cerrar una actividad. No felicita otra vez
 *     (de eso ya se encarga el texto de exito): pica. Se elige uno distinto cada
 *     vez para que a la decima actividad siga sonando a alguien y no a un
 *     cartel.
 *  2. `TRANSICIONES`: el puente entre un mundo y el siguiente. Terminar veinte
 *     actividades merece algo mas que un numero: merece que le cuenten que ha
 *     ganado y que le dejen mirando al mundo que viene.
 *
 * Las reglas de escritura son las de `historia.ts`, y una mas propia: aqui nunca
 * se dice "sigue jugando". Se dice que hay algo esperando y se pone en duda que
 * pueda con ello. Un niño al que se le pide que continue obedece o no; un niño
 * al que se le dice que lo siguiente es dificil, va.
 *
 * Sobre los acentos: se escribe sin ellos, igual que en `historia.ts`, para que
 * todo el texto narrado del juego sea consistente.
 */
import type { Beat } from './historia.js';

/** Paletas de fondo, del mismo juego de tonos que las cinematicas de historia. */
const VERDE = { fondo: '#2F9E5E', fondoRayo: '#3CBD72' };
const MORADO = { fondo: '#7B3FD4', fondoRayo: '#8B52E0' };
const AMBAR = { fondo: '#D98A1F', fondoRayo: '#EDA43A' };

/**
 * Lo que Nube dice al cerrar una actividad, ademas del texto de exito.
 *
 * Son cortas a proposito: van encima de una pantalla que el niño ya quiere
 * cerrar. Si duran mas de lo que tarda en levantar el dedo, estorban.
 */
export interface Reto {
  readonly clave: string;
  readonly texto: string;
}

export const RETOS: readonly Reto[] = [
  { clave: 'reto_1', texto: 'Esa te ha salido facil. La siguiente no te la voy a poner tan comoda.' },
  { clave: 'reto_2', texto: 'Bien. Ahora quiero ver si lo repites cuando el camino se complique.' },
  { clave: 'reto_3', texto: 'Vale, sabes hacerlo. Pero lo de al lado lo ha resuelto muy poca gente a la primera.' },
  { clave: 'reto_4', texto: 'Uno menos. Te queda el que viene, y ese trae trampa.' },
  { clave: 'reto_5', texto: 'Me gusta como piensas. Vamos a ver si te dura.' },
  { clave: 'reto_6', texto: 'Ya lo tienes cogido. Justo por eso lo siguiente cambia un poco.' },
  { clave: 'reto_7', texto: 'Perfecto. Ahora la de verdad.' },
  { clave: 'reto_8', texto: 'Esa la has resuelto rapido. A ver que cara pones con la que viene.' },
  { clave: 'reto_9', texto: 'Sabia que podias. Lo que no se es si podras con dos seguidas.' },
  { clave: 'reto_10', texto: 'Otro resuelto. Te aviso: el siguiente lo he mirado y no es facil.' },
  { clave: 'reto_11', texto: 'Vas mas rapido de lo que esperaba. Vamos a subir un poco.' },
  { clave: 'reto_12', texto: 'Eso ha estado muy bien pensado. Guarda esa idea, que la vas a necesitar.' },
  { clave: 'reto_13', texto: 'Listo. Y ahora, si te atreves, el de al lado.' },
  { clave: 'reto_14', texto: 'Genial. Queda camino, y la parte buena empieza justo ahora.' },
];

/**
 * Elige el reto de una actividad.
 *
 * Se elige por el numero de la actividad y no al azar: asi el mismo nivel dice
 * siempre lo mismo, que es lo que espera un niño que repite para mejorar la
 * estrella, y aun asi dos actividades seguidas nunca coinciden.
 */
export function retoDeActividad(numeroGlobal: number): Reto {
  return RETOS[(numeroGlobal - 1) % RETOS.length]!;
}

/** El puente entre un mundo terminado y el que viene. */
export interface TransicionMundo {
  /** Mundo que se acaba de terminar. */
  readonly mundo: number;
  readonly beats: readonly Beat[];
}

const paso = (
  mundo: number,
  cierre: string,
  duracionCierre: number,
  invitacion: string,
  duracionInvitacion: number,
): TransicionMundo => ({
  mundo,
  beats: [
    {
      escena: 'nido-suma',
      texto: cierre,
      audio: `cine_m${mundo}_paso_1`,
      duracion: duracionCierre,
      ...VERDE,
    },
    {
      escena: 'mapa-mundos',
      texto: invitacion,
      audio: `cine_m${mundo}_paso_2`,
      duracion: duracionInvitacion,
      ...(mundo === 30 ? AMBAR : MORADO),
    },
  ],
});

/**
 * Una por mundo. La del 30 no invita a ninguna parte: cierra.
 *
 * El segundo momento nombra siempre el mundo que viene y al Fuzz que espera
 * alli. Un destino con nombre tira mucho mas que "el siguiente nivel".
 */
export const TRANSICIONES: readonly TransicionMundo[] = [
  paso(1, 'Pip esta en casa. El primero de treinta, y el que mas miedo daba, porque no sabias si serias capaz.', 6200,
    'Mira el mundo dos. Alli abajo todo tiene color, y hay una Fuzz llamada Iris que solo obedece al suelo que pisa. Vas a tener que mirar antes de mandar.', 8000),
  paso(2, 'Iris ya esta arriba, pintando otra vez. Dice que aprendiste los colores mas rapido que ella.', 6000,
    'Ahora la Pradera de los Saltos. Vive Brinco, que no sabe andar. Solo salta. Y saltar lo mismo veinte veces cansa hasta a un Fuzz: habra que buscar un atajo.', 8400),
  paso(3, 'Brinco rescatado. Y de paso descubriste algo que te va a servir siempre: repetir se dice una vez.', 6400,
    'La Cueva de los Ecos es lo siguiente. Alli dentro esta Eco, que repite todo dos veces, todo dos veces. Aunque hay un eco que a mi no me cuadra.', 8000),
  paso(4, 'Eco vuelve al Nido. Y con el, esa frase que repetia y que yo nunca dije. No la olvides.', 6400,
    'Vamos al Oasis Dulce. Mango lleva dias sin comer porque no encuentra el orden de su fruta. Lo dificil no sera llegar: sera llegar en el orden correcto.', 8200),
  paso(5, 'Mango en casa y con la despensa llena. Cinco de treinta. Ya no vas de visita, vas de rescate.', 6200,
    'El Castillo de Nubes te espera, y Nimbo con el. Nimbo duda de todo: si le mandas por un camino, pregunta que pasa si no puede. Vas a tener que responderle antes.', 8600),
  paso(6, 'Nimbo ya decide solo. Le enseñaste algo que no sabia: que se puede planear lo que aun no ha pasado.', 6600,
    'La Bahia de los Piratas. Garfio guarda su tesoro en cajas, y hay un salto tan largo que no cabe en una ficha. Habra que inventarse una nueva.', 8000),
  paso(7, 'Garfio rescatado, y tu con un truco nuevo: si algo se repite mucho, se le pone nombre y ya esta.', 6400,
    'La Montana Neon brilla desde aqui. Vive Chispa, que no sabe parar. Y ojo, porque un programa que no para tampoco para. Ese es el peligro de este mundo.', 8400),
  paso(8, 'Chispa por fin frena. Ocho Fuzzes en el Nido y el sitio empieza a notarse lleno.', 6000,
    'Ahora el Valle de los Dinosaurios. Fosil no necesita que le rescaten de un camino: necesita que alguien encuentre lo que esta mal. Y esta vez el error no es tuyo.', 8600),
  paso(9, 'Fosil arriba. Ya no solo sabes escribir un programa: sabes mirar uno roto y ver donde falla.', 6800,
    'Queda uno para cerrar el grupo. La Estacion Espacial, con Orbita, y alli hay que usarlo todo a la vez. Nadie del Nido lo ha pasado sin repetir.', 8400),
  paso(10, 'Diez. Los diez primeros. Orbita dice que su cohete ya puede despegar, y que lo tenia listo desde antes de la tormenta. Curioso.', 7400,
    'Se acaban las fichas. A partir de aqui vas a encajar piezas de verdad, y la primera es el Reino de Cristal, donde Prisma repite las cosas hasta que salen perfectas.', 8800),
  paso(11, 'Prisma esta en casa y sus puentes brillan otra vez. Y tu ya no arrastras flechas: montas programas.', 6600,
    'Las Cuevas Mecanicas. Tuerca lo cuenta todo, pero se le olvidan los numeros. Necesita un sitio donde guardarlos. Ya veras que idea tan util.', 8000),
  paso(12, 'Tuerca rescatada, y con ella algo que vas a usar hasta el mundo treinta: una caja con nombre donde guardar un numero.', 7200,
    'La Ciudad de los Engranajes. Engra repara puentes, y hace el mismo arreglo una y otra vez. Si le enseñas a darle nombre a ese arreglo, no vuelve a repetirlo.', 8600),
  paso(13, 'Engra en casa. Le diste algo mejor que un puente: le diste una forma de no repetirse nunca mas.', 6600,
    'El Templo de los Elementos. Llama decide rapido, pero alli hay puertas que solo se abren si eliges bien, y equivocarse cuesta. Piensa antes.', 8000),
  paso(14, 'Llama rescatada. Catorce. Y fijate en una cosa: ya no pruebas a ver si sale. Ahora decides.', 6400,
    'El Laberinto Isometrico, con Dedalo, que nunca se pierde. Alli una condicion no basta: hay puertas que piden dos cosas a la vez.', 7800),
  paso(15, 'Dedalo esta arriba dibujando el mapa del Nido. Quince Fuzzes. Vas por la mitad exacta.', 6200,
    'La Fabrica de Baterias. Voltio da energia a los demas, pero cada bateria necesita una cantidad distinta. Una funcion sola no llega: tendra que escuchar.', 8200),
  paso(16, 'Voltio en casa y la fabrica encendida. Aprendiste a que una misma orden sirva para cosas distintas.', 6600,
    'El Bioma Congelado. Copo aguanta lo que sea, pero alli el hielo no avisa de donde acaba. No sabras cuantos pasos dar: solo cuando parar.', 8400),
  paso(17, 'Copo rescatado del hielo. Ese mundo tumba a mucha gente, y tu has salido con las tres estrellas.', 6600,
    'El Archipielago Volcanico. Lava recuerda todos los caminos, y los guarda en fila. Vas a ver que comodo es tener las cosas en una lista.', 8000),
  paso(18, 'Lava en casa, con su lista de caminos intacta. Dieciocho.', 5600,
    'La Mision de Reconocimiento. Radar ve el error antes que nadie, pero esta vez los programas rotos son varios y ninguno avisa de donde falla.', 8200),
  paso(19, 'Radar rescatado. Y tu con el ojo hecho: encontrar el fallo de otro es lo mas dificil que hace un programador.', 7000,
    'Queda la Fortaleza del Titan para cerrar el grupo. Titan no se rinde jamas, y su fortaleza tampoco. Aqui entra todo lo que sabes.', 8000),
  paso(20, 'Veinte. Titan esta en el Nido y dice que nunca vio a nadie derribar su fortaleza tan pronto.', 6800,
    'Se acaban los bloques. A partir de ahora vas a escribir el programa tu, letra a letra, en la Ciudad Ciberisometrica. Byte te espera, y habla muy poco.', 8600),
  paso(21, 'Byte esta en casa. Dice tres palabras: lo hiciste bien. De el, eso es un discurso.', 6200,
    'El Servidor Olvidado. Indice lo ordena todo por numero, y alli las cosas no tienen nombre: tienen posicion. Contar desde cero cuesta al principio.', 8200),
  paso(22, 'Indice rescatado, y su servidor ordenado. Ya sabes guardar muchas cosas en un solo sitio.', 6400,
    'El Laboratorio Antivirus. Vacuna limpia lo que otros ensucian, y hay que recorrer cada rincon sin saltarse ninguno. Repetir a mano no va a servir.', 8200),
  paso(23, 'Vacuna en casa y el laboratorio limpio. Recorrer una lista entera ya no te da ningun miedo.', 6400,
    'La Red Submarina. Coral guarda cada cosa en su sitio, pero alli el sitio no es un numero: es un nombre. Vas a preguntarle a los datos por su nombre.', 8400),
  paso(24, 'Coral rescatada. Veinticuatro Fuzzes, y el Nido casi como era antes de aquella noche.', 6400,
    'El Reactor Nuclear. Fision hace mil cosas a la vez y no puede decidirlas todas de antemano. Alli hay que preparar respuestas para lo que aun no ha pasado.', 8600),
  paso(25, 'Fision en casa y el reactor estable. Aprendiste algo raro: a escribir lo que hay que hacer sin saber cuando pasara.', 7200,
    'El Desierto de Algoritmos. Duna encuentra cualquier cosa, y lo hace rapido. Buscar mirandolo todo funciona; buscar como Duna funciona mil veces mejor.', 8600),
  paso(26, 'Duna rescatada. Y tu con la idea mas potente hasta ahora: dos programas que hacen lo mismo no valen lo mismo.', 7200,
    'El Satelite Hackeado. Escudo siempre tiene un plan B, porque alli las cosas fallan de verdad. Tu programa tendra que aguantar el golpe sin caerse.', 8400),
  paso(27, 'Escudo esta arriba. Su satelite volvio a fallar tres veces mientras lo rescatabas, y ni te enteraste: tu programa lo aguanto solo.', 7400,
    'El Centro de Drones. Zumbi vuela sin chocar nunca, pero no ve mas alla de su nariz. Vas a tener que darle una regla que funcione a ciegas.', 8400),
  paso(28, 'Zumbi en casa, volando en circulos de pura alegria. Veintiocho.', 5800,
    'La Arena Cibersegura. Nitido quita todo lo que sobra. Alli no gana quien resuelve: gana quien resuelve con menos. Vas a tener que borrar lineas tuyas.', 8600),
  paso(29, 'Nitido rescatado. Y tu programa de ahora no se parece al del mundo veintiuno: dice lo mismo con la mitad.', 7200,
    'Queda uno. El Nucleo de la IA, y alli esta Alma, el primer Fuzz que existio. Ella sabe que paso la noche de la tormenta. Yo llevo treinta mundos queriendo preguntarselo.', 9000),
  paso(30, 'Treinta. Estan todos. Alma fue la ultima en subir y la primera en hablar: no fue una tormenta, fue ella pidiendo ayuda de la unica forma que sabia.', 8600,
    'El Nido esta lleno otra vez, y esta vez no lo llene yo. Mirate: empezaste arrastrando una flecha y has terminado escribiendo programas que se arreglan solos. Vuelve cuando quieras, que aqui hay treinta Fuzzes que ya saben tu nombre.', 10500),
];

export const TRANSICION_POR_MUNDO: ReadonlyMap<number, TransicionMundo> = new Map(
  TRANSICIONES.map((t) => [t.mundo, t]),
);

/**
 * Todos los textos que hay que llevar a voz, con su clave.
 *
 * El generador de locuciones lee de aqui: si se añade un reto o se reescribe una
 * transicion, aparece sola en el proximo `voice:generate` sin tocar el script.
 */
export function textosDeContinuidad(): { clave: string; texto: string }[] {
  const textos: { clave: string; texto: string }[] = RETOS.map((r) => ({
    clave: r.clave,
    texto: r.texto,
  }));

  for (const transicion of TRANSICIONES) {
    for (const beat of transicion.beats) {
      textos.push({ clave: beat.audio, texto: beat.texto });
    }
  }

  return textos;
}
