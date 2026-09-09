/**
 * Sandbox de ejecución.
 *
 * Corre en un Web Worker, que es el aislamiento real: no hay DOM, no hay
 * `window`, no hay acceso al almacenamiento ni a las cookies de sesión. Aunque
 * un niño (o alguien mirando la consola) escriba algo malicioso, no tiene nada
 * que tocar desde aquí.
 *
 * Capas de protección, de fuera a dentro:
 *  1. El worker en sí: sin DOM ni sesión.
 *  2. Se eliminan del ámbito global las APIs que un programa de juego no
 *     necesita: red, temporizadores, importación de código.
 *  3. La API del Fuzz es un Proxy que solo expone los comandos que la actividad
 *     ha desbloqueado, y avisa con un mensaje amable si se pide otro.
 *  4. Tope de instrucciones por actividad y tiempo máximo, para cortar bucles
 *     infinitos sin colgar la pestaña.
 *
 * El resultado no es "el estado final", sino la lista de ACCIONES. El
 * renderizador las anima y el servidor las reproduce para dar las estrellas.
 */
import {
  ErrorJuego,
  GridSimulator,
  type Accion,
  type ErrorEjecucion,
  type WorkerRequest,
  type WorkerResponse,
} from '@codenest/shared';

/** Tiempo máximo de una ejecución, aunque no se agote el tope de instrucciones. */
const TIEMPO_MAXIMO_MS = 5000;

/**
 * Retira del ámbito del worker todo lo que un programa de juego no necesita.
 * No es la única defensa (el worker ya está aislado), pero cierra la puerta a
 * que un programa saque datos o cargue código de fuera.
 */
function cerrarPuertas(): void {
  const prohibidas = [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'importScripts',
    'indexedDB',
    'caches',
    'crypto',
    'Notification',
    'BroadcastChannel',
    'SharedWorker',
    'Worker',
    'EventSource',
  ];

  for (const nombre of prohibidas) {
    try {
      Object.defineProperty(self, nombre, {
        value: undefined,
        writable: false,
        configurable: false,
      });
    } catch {
      // Alguna puede no ser redefinible según el navegador; el aislamiento del
      // worker sigue siendo la defensa principal.
    }
  }
}

cerrarPuertas();

/** Traduce un error a un mensaje que un niño pueda entender. */
function traducirError(error: unknown, instrucciones: number): ErrorEjecucion {
  if (error instanceof ErrorJuego) {
    return { mensaje: error.message, codigo: error.codigo };
  }

  if (error instanceof SyntaxError) {
    return {
      mensaje: 'Hay algo mal escrito en tu programa. Revisa los parentesis y los puntos.',
      codigo: 'sintaxis',
    };
  }

  if (error instanceof RangeError) {
    return {
      mensaje: 'Tu programa se llamo a si mismo demasiadas veces y se quedo sin espacio.',
      codigo: 'limite',
    };
  }

  const mensaje = error instanceof Error ? error.message : String(error);

  // Un nombre desconocido suele ser una función que la actividad no permite.
  if (/is not a function|is not defined/.test(mensaje)) {
    return {
      mensaje: 'Usaste una orden que el Fuzz todavia no conoce en esta actividad.',
      codigo: 'comando_no_permitido',
    };
  }

  return {
    mensaje: `Algo no salio bien despues de ${instrucciones} pasos. Revisa tu programa.`,
  };
}

/** Extrae el número de línea del error, para señalarlo en el editor. */
function lineaDelError(error: unknown): number | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  // El código del alumno se evalúa como función anónima.
  const coincidencia = /<anonymous>:(\d+):/.exec(error.stack);
  if (!coincidencia?.[1]) return undefined;
  // Se descuenta la línea que añade el constructor Function.
  const linea = Number.parseInt(coincidencia[1], 10) - 1;
  return linea > 0 ? linea : undefined;
}

self.onmessage = (evento: MessageEvent<WorkerRequest>): void => {
  const peticion = evento.data;

  if (peticion.lenguaje === 'python') {
    // El subconjunto de Python se traduce a JavaScript antes de llegar aquí
    // (packages/shared/runtime/pylite). Si llega Python sin traducir, es un
    // error de programación de la aplicación, no del niño.
    self.postMessage({
      ok: false,
      error: { mensaje: 'El programa debe llegar traducido a JavaScript.', codigo: 'sintaxis' },
    } satisfies WorkerResponse);
    return;
  }

  const simulador = new GridSimulator({
    grid: peticion.grid,
    spawn: peticion.spawn,
    items: peticion.items,
    modo: peticion.modoMovimiento,
    comandosPermitidos: peticion.apiPermitida,
    topeEjecucion: peticion.topeEjecucion,
  });

  const limite = Date.now() + TIEMPO_MAXIMO_MS;

  /** Cada comando comprueba el reloj: así un bucle largo no cuelga la pestaña. */
  function vigilarTiempo(): void {
    if (Date.now() > limite) {
      throw new ErrorJuego(
        'Tu programa tardo demasiado. Puede que se repita sin parar.',
        'timeout',
      );
    }
  }

  /** Envoltura de un comando del simulador con la vigilancia del reloj. */
  function comando<T>(fn: () => T): () => T {
    return () => {
      vigilarTiempo();
      return fn();
    };
  }

  // Superficie completa de la API. El Proxy decide qué se expone.
  const api: Record<string, unknown> = {
    derecha: comando(() => simulador.mover('derecha')),
    izquierda: comando(() => simulador.mover('izquierda')),
    arriba: comando(() => simulador.mover('arriba')),
    abajo: comando(() => simulador.mover('abajo')),
    avanzar: comando(() => simulador.avanzar()),
    girarDerecha: comando(() => simulador.girarDerecha()),
    girarIzquierda: comando(() => simulador.girarIzquierda()),
    saltar: comando(() => simulador.saltar()),
    recoger: comando(() => simulador.recoger()),
    puedeAvanzar: comando(() => simulador.puedeAvanzar()),
    colorCasilla: comando(() => simulador.colorCasilla()),
    hayObstaculo: comando(() => simulador.hayObstaculo()),
  };

  /**
   * Solo se ven los comandos permitidos por la actividad. Pedir otro no da un
   * error técnico, sino un aviso comprensible: es parte del andamiaje
   * pedagógico, no una barrera.
   */
  const fuzz = new Proxy(api, {
    get(objetivo, propiedad) {
      const nombre = String(propiedad);
      if (!peticion.apiPermitida.includes(nombre)) {
        throw new ErrorJuego(
          `El Fuzz todavia no sabe hacer "${nombre}" en esta actividad.`,
          'comando_no_permitido',
        );
      }
      return objetivo[nombre];
    },
    // Un programa no puede añadir ni cambiar la API.
    set() {
      return false;
    },
    has(_objetivo, propiedad) {
      return peticion.apiPermitida.includes(String(propiedad));
    },
  });

  /** Bucle contado: la forma en que los mundos 3 y 11 expresan la repetición. */
  function repetir(veces: number, cuerpo: () => void): void {
    const vueltas = Math.min(Math.max(0, Math.floor(veces)), 1000);
    for (let i = 0; i < vueltas; i++) {
      vigilarTiempo();
      cuerpo();
    }
  }

  try {
    // El código se evalúa con un ámbito acotado: solo recibe lo que se le pasa.
    const ejecutar = new Function('fuzz', 'repetir', `"use strict";\n${peticion.codigo}`);
    ejecutar(fuzz, repetir);

    self.postMessage({
      ok: true,
      acciones: [...simulador.accionesEjecutadas] as Accion[],
      instruccionesEjecutadas: simulador.totalInstrucciones,
    } satisfies WorkerResponse);
  } catch (error) {
    const detalle = traducirError(error, simulador.totalInstrucciones);
    const linea = lineaDelError(error);

    self.postMessage({
      ok: false,
      error: linea === undefined ? detalle : { ...detalle, linea },
      // Las acciones previas al fallo permiten animar hasta el punto del choque.
      accionesParciales: [...simulador.accionesEjecutadas] as Accion[],
      instruccionesEjecutadas: simulador.totalInstrucciones,
    } satisfies WorkerResponse);
  }
};
