/**
 * Valida el contenido curricular antes de sembrarlo.
 *
 * En la FASE 1 comprueba lo que no necesita simulador:
 *   - esquema zod v3 de cada archivo de mundo,
 *   - coherencia con el catalogo (numero, slug, grupo, editor),
 *   - numeracion 1..20 sin huecos ni duplicados,
 *   - que las claves de audio sigan la convencion y apunten a la actividad,
 *   - que el punto de partida y los objetivos caigan sobre casillas transitables.
 *
 * En la FASE 5, cuando exista GridSimulator, se anadira la comprobacion clave:
 * que cada `solucionReferencia` otorgue las 3 estrellas.
 *
 * Uso:
 *   npm run content:validate
 *   npm run content:validate -- --schema-only
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DIR_MUNDOS, cargarMundos } from '@codenest/content/loader';
import {
  GridSimulator,
  calcularEstrellas,
  evaluarObjetivos,
  estructurasDelCodigo,
  interpretarFichas,
  lineasDeCodigo,
  transpilarPython,
  type ActivityDefinition,
} from '@codenest/shared';

import {
  TRANSICION_POR_MUNDO,
  retoDeActividad,
  textosDeContinuidad,
} from '@codenest/content';
import {
  ACTIVIDADES_POR_MUNDO,
  MUNDOS,
  claveInstruccion,
  clavePista,
  numeroGlobal,
  type WorldContentFileInput,
} from './lib/shared.js';

const soloEsquema = process.argv.includes('--schema-only');

interface Problema {
  readonly archivo: string;
  readonly detalle: string;
}

const problemas: Problema[] = [];
const avisos: Problema[] = [];

function error(archivo: string, detalle: string): void {
  problemas.push({ archivo, detalle });
}

function aviso(archivo: string, detalle: string): void {
  avisos.push({ archivo, detalle });
}

/** Casillas por las que el Fuzz puede pasar. */
const TRANSITABLES = new Set(['camino', 'meta', 'hielo', 'viento', 'charco']);

/**
 * Claves de audio que ya existen como MP3, segun el manifest del generador.
 *
 * Esta comprobacion es el sustituto del respaldo que habia antes. Mientras la
 * aplicacion sintetizaba con la voz del navegador, un clip que faltaba era una
 * molestia; ahora que toda la voz es grabada, es una pantalla muda, y para un
 * nino que no lee eso es una actividad imposible de entender. Asi que el hueco
 * tiene que aparecer aqui y no en una tableta.
 *
 * Si no hay manifest todavia (nadie ha generado voz aun) no se exige nada: seria
 * ruido en una instalacion nueva.
 */
const RUTA_MANIFEST = resolve(
  import.meta.dirname,
  '..',
  'apps',
  'frontend',
  'public',
  'static',
  'audio',
  'manifest.json',
);

function cargarClavesDeAudio(): Set<string> | null {
  if (!existsSync(RUTA_MANIFEST)) return null;
  try {
    const crudo = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8')) as {
      entradas?: Record<string, unknown>;
    };
    return new Set(Object.keys(crudo.entradas ?? {}));
  } catch {
    return null;
  }
}

const clavesGeneradas = cargarClavesDeAudio();

function validarMundo(archivo: string, contenido: WorldContentFileInput): void {
  const mundo = MUNDOS.find((m) => m.numero === contenido.mundo);
  if (!mundo) {
    error(archivo, `Declara el mundo ${contenido.mundo}, que no existe en el catalogo`);
    return;
  }

  if (contenido.slug !== mundo.slug) {
    error(archivo, `El slug es "${contenido.slug}" y el catalogo dice "${mundo.slug}"`);
  }
  if (contenido.nombre !== mundo.nombre) {
    aviso(archivo, `El nombre difiere del catalogo ("${contenido.nombre}" vs "${mundo.nombre}")`);
  }

  const numeros = contenido.actividades.map((a) => a.numeroEnMundo).sort((a, b) => a - b);

  if (numeros.length !== ACTIVIDADES_POR_MUNDO) {
    aviso(
      archivo,
      `Tiene ${numeros.length} actividades de las ${ACTIVIDADES_POR_MUNDO} previstas (contenido en curso)`,
    );
  }
  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] === numeros[i - 1]) {
      error(archivo, `La actividad ${numeros[i]} esta duplicada`);
    }
  }

  for (const act of contenido.actividades) {
    const etiqueta = `M${mundo.numero}-A${act.numeroEnMundo}`;
    const cfg = act.config;

    // El contenido debe respetar el grupo y el editor del catalogo.
    if (cfg.grupo !== mundo.grupo) {
      error(archivo, `${etiqueta}: grupo "${cfg.grupo}" pero el mundo es de "${mundo.grupo}"`);
    }
    if (cfg.editor !== mundo.editor) {
      error(archivo, `${etiqueta}: editor "${cfg.editor}" pero el mundo usa "${mundo.editor}"`);
    }
    for (const lenguaje of cfg.lenguajes) {
      if (!mundo.lenguajes.includes(lenguaje)) {
        error(
          archivo,
          `${etiqueta}: ofrece "${lenguaje}", que el mundo ${mundo.numero} no admite (${mundo.lenguajes.join(', ')})`,
        );
      }
    }

    // El slug debe empezar por el prefijo del mundo, para poder ordenar.
    const prefijo = `m${String(mundo.numero).padStart(2, '0')}-`;
    if (!act.slug.startsWith(prefijo)) {
      aviso(archivo, `${etiqueta}: el slug "${act.slug}" no empieza por "${prefijo}"`);
    }

    // Claves de audio segun la convencion.
    const esperadaInstr = claveInstruccion(mundo.numero, act.numeroEnMundo);
    if (cfg.audio.instruccion !== esperadaInstr) {
      error(
        archivo,
        `${etiqueta}: la clave de instruccion es "${cfg.audio.instruccion}" y deberia ser "${esperadaInstr}"`,
      );
    }
    cfg.audio.pistas.forEach((clave, i) => {
      const esperada = clavePista(mundo.numero, act.numeroEnMundo, i + 1);
      if (clave !== esperada) {
        error(archivo, `${etiqueta}: la pista ${i + 1} usa "${clave}" y deberia usar "${esperada}"`);
      }
    });

    // Toda la voz es grabada, asi que una clave sin MP3 es una pantalla muda.
    if (clavesGeneradas) {
      const usadas = [cfg.audio.instruccion, cfg.audio.exito, ...cfg.audio.pistas];
      for (const clave of usadas) {
        if (clave && !clavesGeneradas.has(clave)) {
          error(
            archivo,
            `${etiqueta}: la locucion "${clave}" no esta generada. ` +
              `Ejecuta: npm run voice:generate -- --worlds ${mundo.numero}`,
          );
        }
      }
    }

    // Geometria: spawn, objetivos e items sobre casillas transitables.
    const tile = (x: number, y: number): string | undefined => cfg.grid.tiles[y]?.[x]?.t;

    const tSpawn = tile(cfg.spawn.x, cfg.spawn.y);
    if (!tSpawn || !TRANSITABLES.has(tSpawn)) {
      error(
        archivo,
        `${etiqueta}: el Fuzz aparece en (${cfg.spawn.x},${cfg.spawn.y}), que es "${tSpawn ?? 'fuera del mapa'}"`,
      );
    }

    for (const item of cfg.items) {
      const t = tile(item.x, item.y);
      if (!t || !TRANSITABLES.has(t)) {
        error(
          archivo,
          `${etiqueta}: el item "${item.id}" esta en (${item.x},${item.y}), que es "${t ?? 'fuera del mapa'}"`,
        );
      }
    }

    for (const obj of cfg.objetivos) {
      if (obj.tipo === 'alcanzar_celda') {
        if (obj.x === undefined || obj.y === undefined) {
          error(archivo, `${etiqueta}: el objetivo "${obj.id}" no indica casilla`);
          continue;
        }
        const t = tile(obj.x, obj.y);
        if (!t || !TRANSITABLES.has(t)) {
          error(
            archivo,
            `${etiqueta}: el objetivo "${obj.id}" apunta a (${obj.x},${obj.y}), que es "${t ?? 'fuera del mapa'}"`,
          );
        }
      }
      if (obj.tipo === 'recoger_item' && obj.itemId) {
        if (!cfg.items.some((i) => i.id === obj.itemId)) {
          error(archivo, `${etiqueta}: el objetivo "${obj.id}" cita el item "${obj.itemId}", que no existe`);
        }
      }
    }

    // Los comandos permitidos deben estar desbloqueados en el mundo o antes.
    if (cfg.comandosPermitidos.length === 0) {
      error(archivo, `${etiqueta}: no permite ningun comando`);
    }

    // El numero global debe caber en el rango del mundo.
    const global = numeroGlobal(mundo.numero, act.numeroEnMundo);
    if (global < 1 || global > 600) {
      error(archivo, `${etiqueta}: numero global ${global} fuera de 1..600`);
    }

    if (!soloEsquema) {
      const problema = comprobarSoluciones(act);
      if (problema) error(archivo, `${etiqueta}: ${problema}`);

      const roto = comprobarProgramaRoto(act);
      if (roto) error(archivo, `${etiqueta}: ${roto}`);
    }
  }
}

/**
 * Comprueba TODAS las soluciones de referencia que trae la actividad.
 *
 * Una actividad de los Hackers puede venir en JavaScript y en Python, y las dos
 * tienen que llegar a la meta: el nino elige el lenguaje. Comprobar solo la
 * primera dejaba pasar una solucion de Python rota sin que nadie se enterara,
 * porque el validador se paraba en el JavaScript.
 */
function comprobarSoluciones(act: ActivityDefinition): string | null {
  const sol = act.solucionReferencia;
  const lenguajes: ('comandos' | 'javascript' | 'python')[] = [];
  if (sol.comandos) lenguajes.push('comandos');
  if (sol.javascript) lenguajes.push('javascript');
  if (sol.python) lenguajes.push('python');

  if (lenguajes.length === 0) return 'no tiene solucion de referencia';

  for (const lenguaje of lenguajes) {
    const problema = comprobarSolucion(act, lenguaje);
    if (problema) {
      return lenguajes.length > 1 ? `en ${lenguaje}, ${problema}` : problema;
    }
  }
  return null;
}

/**
 * Ejecuta una solucion de referencia y exige que otorgue las tres estrellas.
 *
 * Es la comprobacion que de verdad importa: una actividad cuya solucion optima
 * no llega a tres estrellas es una actividad imposible de completar del todo, y
 * un nino que lo intente veinte veces no va a entender por que.
 */
function comprobarSolucion(
  act: ActivityDefinition,
  lenguaje: 'comandos' | 'javascript' | 'python',
): string | null {
  const cfg = act.config;
  const opciones = {
    grid: cfg.grid,
    spawn: cfg.spawn,
    items: cfg.items,
    modo: cfg.modoMovimiento,
    comandosPermitidos: cfg.comandosPermitidos,
    topeEjecucion: cfg.topeEjecucion,
  };

  const sim = new GridSimulator(opciones);
  let tamano = 0;
  const estructuras: string[] = [];

  try {
    if (lenguaje === 'comandos') {
      // El interprete vive en el paquete compartido: la misma semantica que usa el
      // juego, para que una actividad no pueda pasar la validacion y ser
      // imposible de completar (o al contrario).
      const resultado = interpretarFichas(sim, act.solucionReferencia.comandos!);
      tamano = resultado.tamano;
      estructuras.push(...resultado.estructuras);
    } else if (lenguaje === 'javascript') {
      const lineas = ejecutarJavaScript(sim, act.solucionReferencia.javascript!, estructuras);
      // En los mundos de bloques manda el numero de bloques: es lo que cuenta el
      // editor del nino, y por tanto lo que compara la tercera estrella.
      tamano = act.solucionReferencia.bloques ?? lineas;
    } else {
      const { codigo, estructuras: usadas } = transpilarPython(act.solucionReferencia.python!);
      estructuras.push(...usadas);
      // Se cuentan las lineas de Python, no las del JavaScript traducido: es lo
      // que el nino tiene delante.
      tamano = lineasDeCodigo(act.solucionReferencia.python!);
      ejecutarJavaScript(sim, codigo, estructuras);
    }
  } catch (e) {
    return `la solucion de referencia falla: ${(e as Error).message}`;
  }

  const acciones = [...sim.accionesEjecutadas];
  const resultado = evaluarObjetivos(opciones, acciones, cfg.objetivos, cfg.items);

  if (!resultado.valida) {
    return 'la solucion de referencia no se pudo reproducir sobre el tablero';
  }

  const estrellas = calcularEstrellas(cfg.criteriosEstrella, resultado.cumplidos, {
    tamanoPrograma: tamano,
    instruccionesEjecutadas: acciones.length,
    estructurasUsadas: estructuras,
  });

  if (estrellas < 3) {
    const faltan = Object.entries(resultado.cumplidos)
      .filter(([, ok]) => !ok)
      .map(([id]) => id);
    return (
      `la solucion de referencia solo consigue ${estrellas} estrella(s)` +
      (faltan.length > 0 ? ` (objetivos sin cumplir: ${faltan.join(', ')})` : '') +
      ` con ${tamano} instruccion(es) escritas y ${acciones.length} ejecutadas`
    );
  }

  return null;
}

/**
 * En las actividades de depurar, comprueba que el programa que se le da al nino
 * esta de verdad roto.
 *
 * Los mundos 9 y 19 entregan un programa con un fallo y piden arreglarlo. Si ese
 * programa funcionara, la actividad no tendria nada que hacer: el nino le daria a
 * jugar, le saldrian tres estrellas y no habria aprendido nada. Es un fallo
 * silencioso, porque todo lo demas valida bien.
 */
function comprobarProgramaRoto(act: ActivityDefinition): string | null {
  const cfg = act.config;
  const prefijado = cfg.programaPrefijado;
  if (!prefijado || prefijado.length === 0) return null;

  const opciones = {
    grid: cfg.grid,
    spawn: cfg.spawn,
    items: cfg.items,
    modo: cfg.modoMovimiento,
    comandosPermitidos: cfg.comandosPermitidos,
    topeEjecucion: cfg.topeEjecucion,
  };

  const sim = new GridSimulator(opciones);
  let tamano = 0;
  const estructuras: string[] = [];

  try {
    const resultado = interpretarFichas(sim, prefijado);
    tamano = resultado.tamano;
    estructuras.push(...resultado.estructuras);
  } catch {
    // Choca o se sale del camino: es exactamente lo que se espera de el.
    return null;
  }

  const acciones = [...sim.accionesEjecutadas];
  const resultado = evaluarObjetivos(opciones, acciones, cfg.objetivos, cfg.items);
  const estrellas = calcularEstrellas(cfg.criteriosEstrella, resultado.cumplidos, {
    tamanoPrograma: tamano,
    instruccionesEjecutadas: acciones.length,
    estructurasUsadas: estructuras,
  });

  if (estrellas >= 3) {
    return 'el programa prefijado ya consigue las 3 estrellas, asi que no hay nada que arreglar';
  }

  return null;
}

/** Ejecuta una solucion escrita en JavaScript contra el simulador. */
function ejecutarJavaScript(
  sim: GridSimulator,
  codigo: string,
  estructuras: string[],
): number {
  const fuzz = {
    derecha: () => sim.mover('derecha'),
    izquierda: () => sim.mover('izquierda'),
    arriba: () => sim.mover('arriba'),
    abajo: () => sim.mover('abajo'),
    avanzar: () => sim.avanzar(),
    girarDerecha: () => sim.girarDerecha(),
    girarIzquierda: () => sim.girarIzquierda(),
    saltar: () => sim.saltar(),
    recoger: () => sim.recoger(),
    repararPuente: () => sim.repararPuente(),
    puedeAvanzar: () => sim.puedeAvanzar(),
    colorCasilla: () => sim.colorCasilla(),
    hayObstaculo: () => sim.hayObstaculo(),
  };

  const repetir = (veces: number, cuerpo: () => void): void => {
    for (let i = 0; i < veces; i++) cuerpo();
  };


  // La deteccion vive en el paquete compartido: es la misma que usa el editor
  // del nino y la misma con la que el servidor decide las estrellas. Tenerla
  // por duplicado era lo que dejaba pasar por funcion el cuerpo de un bucle.
  estructuras.push(...estructurasDelCodigo(codigo));

  new Function('fuzz', 'repetir', codigo)(fuzz, repetir);

  return lineasDeCodigo(codigo);
}

/**
 * Comprueba lo que sostiene la continuidad entre actividades y entre mundos.
 *
 * Va aqui y no en una prueba unitaria porque es contenido, y el contenido se
 * rompe igual que el resto: en silencio. Un mundo sin puente deja al niño en el
 * mapa al terminarlo, y una clave sin MP3 deja una cinematica muda, que sin
 * respaldo de voz del navegador es una pantalla que no dice nada.
 */
function validarContinuidad(): void {
  const archivo = 'packages/content/src/continuidad.ts';

  for (const mundo of MUNDOS) {
    if (!TRANSICION_POR_MUNDO.has(mundo.numero)) {
      error(archivo, `el mundo ${mundo.numero} no tiene puente al siguiente`);
    }
  }

  // El reto se elige por el numero de actividad: dos seguidas nunca deben
  // repetirlo, que es justo lo que lo hace sonar a persona y no a cartel.
  for (let n = 1; n < ACTIVIDADES_POR_MUNDO * MUNDOS.length; n++) {
    if (retoDeActividad(n).clave === retoDeActividad(n + 1).clave) {
      error(archivo, `las actividades ${n} y ${n + 1} repiten el mismo reto`);
    }
  }

  const vistas = new Set<string>();
  for (const { clave, texto } of textosDeContinuidad()) {
    if (vistas.has(clave)) error(archivo, `la clave de audio "${clave}" esta repetida`);
    vistas.add(clave);

    if (texto.trim().length === 0) error(archivo, `la clave "${clave}" no tiene texto`);

    if (clavesGeneradas && !clavesGeneradas.has(clave)) {
      error(archivo, `falta el MP3 de "${clave}": esa narracion seria muda`);
    }
  }
}

/**
 * Comprueba que cada mundo tiene su musica de fondo.
 *
 * La musica se pide por el nombre del bioma, asi que renombrar un bioma en el
 * catalogo deja el mundo en silencio sin que nada mas se rompa. Es un aviso y
 * no un error: se puede jugar sin musica, y en una instalacion recien clonada
 * puede que aun no se haya generado.
 */
function validarMusica(): void {
  const dirMusica = resolve(
    import.meta.dirname,
    '..',
    'apps',
    'frontend',
    'public',
    'static',
    'audio',
    'musica',
  );
  if (!existsSync(dirMusica)) return;

  for (const mundo of MUNDOS) {
    if (!existsSync(resolve(dirMusica, `${mundo.bioma}.mp3`))) {
      aviso(
        'apps/frontend/public/static/audio/musica',
        `el mundo ${mundo.numero} suena en silencio: falta ${mundo.bioma}.mp3. ` +
          `Ejecuta: npm run voice:music -- --worlds ${mundo.numero}`,
      );
    }
  }
}

async function main(): Promise<void> {
  validarContinuidad();
  validarMusica();

  if (!existsSync(DIR_MUNDOS)) {
    console.log(`No existe ${DIR_MUNDOS}. Nada que validar.`);
    return;
  }

  // cargarMundos aplica el esquema zod y falla con el detalle si no se cumple.
  const mundos = await cargarMundos();

  if (mundos.length === 0) {
    console.log('No hay archivos de contenido todavia.');
    return;
  }

  console.log(
    `Validando ${mundos.length} archivo(s) de contenido${soloEsquema ? ' (solo esquema)' : ''}
`,
  );

  let actividadesTotales = 0;

  for (const { archivo, contenido } of mundos) {
    validarMundo(archivo, contenido);
    actividadesTotales += contenido.actividades.length;

    const propios = problemas.filter((p) => p.archivo === archivo).length;
    console.log(
      `${propios === 0 ? 'OK   ' : 'FALLA'} ${archivo}  (${contenido.actividades.length} actividades)`,
    );
  }

  console.log('');
  if (avisos.length > 0) {
    console.log(`Avisos (${avisos.length}):`);
    for (const a of avisos) console.log(`  - ${a.archivo}: ${a.detalle}`);
    console.log('');
  }

  if (problemas.length > 0) {
    console.log(`Errores (${problemas.length}):`);
    for (const p of problemas) console.log(`  - ${p.archivo}: ${p.detalle}`);
    console.log('');
    console.log('Contenido NO valido.');
    process.exitCode = 1;
    return;
  }

  console.log(`Contenido valido: ${actividadesTotales} actividades en ${mundos.length} mundo(s).`);
  if (soloEsquema) {
    console.log('Nota: no se simularon las soluciones de referencia (--schema-only).');
  } else {
    console.log('Cada solucion de referencia se simulo y otorga las 3 estrellas.');
  }
}

main().catch((error_: unknown) => {
  console.error('FALLO al validar:', error_);
  process.exit(1);
});
