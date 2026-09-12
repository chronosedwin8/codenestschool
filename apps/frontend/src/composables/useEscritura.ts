/**
 * El motor de escritura: qué se ha escrito, qué falta y cómo va.
 *
 * Tres decisiones que explican la forma de esto:
 *
 *  1. **El texto no se corrige.** Una pulsación equivocada cuenta como error y el
 *     cursor avanza igual. Es lo que hacen las pruebas de mecanografía serias, y
 *     tiene un motivo pedagógico: si se pudiera borrar, la precisión medida sería
 *     la de un texto revisado, no la de los dedos, y el niño aprendería a
 *     corregir en vez de a acertar.
 *  2. **El reloj empieza en la primera tecla**, no al abrir la pantalla. Si
 *     empezara antes, leer el consejo costaría palabras por minuto.
 *  3. **Los acentos se componen.** `´` no escribe nada: queda armado y la vocal
 *     siguiente sale acentuada. Es cómo funciona el teclado español de verdad.
 *
 * De la entrada física se encarga quien lo usa: en escritorio, un `<input>`
 * invisible (para que `´`+`e` llegue ya como `é`); en táctil, el teclado en
 * pantalla. Aquí solo entran caracteres ya compuestos.
 */
import { computed, ref } from 'vue';

import { ACENTUADAS, comoEscribir } from '@codenest/content';
import { medir, type Medidas } from '@codenest/shared';

/**
 * La tabla al reves: vocal + tecla muerta -> vocal acentuada.
 *
 * Se deriva de `ACENTUADAS` para que no haya dos listas que se puedan
 * desincronizar. La diéresis va aparte porque `ü` y `ú` comparten la vocal: con
 * `´` sale `ú` y con `¨` sale `ü`.
 */
const CON_TILDE: Record<string, string> = {};
const CON_DIERESIS: Record<string, string> = {};
for (const [acentuada, vocal] of Object.entries(ACENTUADAS)) {
  if (acentuada === 'ü' || acentuada === 'Ü') CON_DIERESIS[vocal] = acentuada;
  else CON_TILDE[vocal] = acentuada;
}

export interface EstadoEscritura {
  readonly texto: string;
  readonly posicion: number;
  readonly terminado: boolean;
}

export function useEscritura() {
  const texto = ref('');
  const posicion = ref(0);
  const correctos = ref(0);
  const errores = ref(0);
  const erroresPorTecla = ref<Record<string, number>>({});
  /** Qué caracteres se acertaron y cuáles no, para pintar el texto. */
  const aciertos = ref<boolean[]>([]);

  const inicio = ref<number | null>(null);
  const fin = ref<number | null>(null);
  /** Qué acento espera vocal: `null`, la tilde de `´` o la diéresis de `¨`. */
  const acentoArmado = ref<'tilde' | 'dieresis' | null>(null);
  const teclaErrada = ref<string | null>(null);

  const terminado = computed(() => texto.value.length > 0 && posicion.value >= texto.value.length);

  /** El carácter que toca escribir ahora. */
  const objetivo = computed<string | null>(() =>
    posicion.value < texto.value.length ? (texto.value[posicion.value] ?? null) : null,
  );

  /** Cómo se escribe ese carácter: tecla, mayúscula, acento y dedo. */
  const pulsacion = computed(() => (objetivo.value ? comoEscribir(objetivo.value) : null));

  const medidas = computed<Medidas>(() => {
    const desde = inicio.value;
    if (desde === null) return medir({ correctos: 0, errores: 0, milisegundos: 0 });
    const hasta = fin.value ?? Date.now();
    return medir({
      correctos: correctos.value,
      errores: errores.value,
      milisegundos: Math.max(1, hasta - desde),
    });
  });

  function empezar(nuevoTexto: string): void {
    texto.value = nuevoTexto;
    posicion.value = 0;
    correctos.value = 0;
    errores.value = 0;
    erroresPorTecla.value = {};
    aciertos.value = [];
    inicio.value = null;
    fin.value = null;
    acentoArmado.value = null;
    teclaErrada.value = null;
  }

  function anotarError(esperado: string): void {
    errores.value += 1;
    // Se anota la tecla que SE ESPERABA, no la que se pulsó: lo que el docente
    // necesita saber es qué tecla le cuesta, no cuál apretó por equivocación.
    const clave = ACENTUADAS[esperado] ? esperado : esperado === ' ' ? 'espacio' : esperado;
    erroresPorTecla.value = {
      ...erroresPorTecla.value,
      [clave]: (erroresPorTecla.value[clave] ?? 0) + 1,
    };
    teclaErrada.value = esperado;
    window.setTimeout(() => {
      if (teclaErrada.value === esperado) teclaErrada.value = null;
    }, 260);
  }

  /**
   * Entra un carácter ya compuesto.
   *
   * Devuelve `true` si era el correcto, por si quien llama quiere sonar distinto.
   */
  function escribir(caracter: string): boolean {
    if (terminado.value) return false;

    const esperado = objetivo.value;
    if (esperado === null) return false;

    // El acento suelto no escribe: queda armado. Se trata aquí y no en el
    // teclado para que funcione igual viniendo del teclado físico.
    if (caracter === '´' || caracter === '¨') {
      acentoArmado.value = caracter === '¨' ? 'dieresis' : 'tilde';
      inicio.value ??= Date.now();
      return true;
    }

    inicio.value ??= Date.now();

    /*
     * Aquí se COMPONE la vocal, que es la mitad que faltaba.
     *
     * En un portátil el sistema ya junta `´`+`a` en `á` y al motor llega la
     * letra entera. Pero en el teclado de la pantalla —el que usan de verdad los
     * niños en tableta y móvil— no hay sistema operativo que lo haga: llegan dos
     * pulsaciones sueltas. Sin esto, cada palabra con tilde de las lecciones de
     * la Laguna contaba como error por mucho que el niño la escribiera bien.
     */
    const armado = acentoArmado.value;
    acentoArmado.value = null;
    const escrito =
      armado === null
        ? caracter
        : ((armado === 'dieresis' ? CON_DIERESIS[caracter] : CON_TILDE[caracter]) ?? caracter);

    const acertado = escrito === esperado;
    aciertos.value = [...aciertos.value, acertado];

    if (acertado) correctos.value += 1;
    else anotarError(esperado);

    posicion.value += 1;
    if (posicion.value >= texto.value.length) fin.value = Date.now();

    return acertado;
  }

  /**
   * Borrar.
   *
   * Retrocede el cursor pero **no devuelve el error**: lo escrito ya se contó. Es
   * deliberado y es lo que mide la precisión de los dedos y no la de la revisión.
   */
  function borrar(): void {
    if (posicion.value === 0 || terminado.value) return;
    posicion.value -= 1;
    const previos = [...aciertos.value];
    const ultimo = previos.pop();
    aciertos.value = previos;
    if (ultimo === true) correctos.value = Math.max(0, correctos.value - 1);
  }

  /** El texto partido en tres: lo escrito, el cursor y lo que falta. */
  const trozos = computed(() => ({
    hechos: texto.value.slice(0, posicion.value).split(''),
    estados: aciertos.value,
    actual: texto.value[posicion.value] ?? '',
    restante: texto.value.slice(posicion.value + 1),
  }));

  /** El resultado listo para mandar al servidor. */
  function resultado(): {
    correctos: number;
    errores: number;
    milisegundos: number;
    erroresPorTecla: Record<string, number>;
  } {
    const desde = inicio.value ?? Date.now();
    const hasta = fin.value ?? Date.now();
    return {
      correctos: correctos.value,
      errores: errores.value,
      milisegundos: Math.max(1, hasta - desde),
      erroresPorTecla: { ...erroresPorTecla.value },
    };
  }

  return {
    texto,
    posicion,
    objetivo,
    pulsacion,
    acentoArmado,
    teclaErrada,
    aciertos,
    trozos,
    medidas,
    terminado,
    empezar,
    escribir,
    borrar,
    resultado,
  };
}
