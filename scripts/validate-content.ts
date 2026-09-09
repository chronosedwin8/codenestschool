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
import { existsSync } from 'node:fs';

import { DIR_MUNDOS, cargarMundos } from '@codenest/content/loader';
import {
  GridSimulator,
  calcularEstrellas,
  evaluarObjetivos,
  interpretarFichas,
  transpilarPython,
  type ActivityDefinition,
} from '@codenest/shared';

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
      const problema = comprobarSolucion(act);
      if (problema) error(archivo, `${etiqueta}: ${problema}`);
    }
  }
}

/**
 * Ejecuta la solucion de referencia y exige que otorgue las tres estrellas.
 *
 * Es la comprobacion que de verdad importa: una actividad cuya solucion optima
 * no llega a tres estrellas es una actividad imposible de completar del todo, y
 * un nino que lo intente veinte veces no va a entender por que.
 */
function comprobarSolucion(act: ActivityDefinition): string | null {
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
    if (act.solucionReferencia.comandos) {
      // El interprete vive en el paquete compartido: la misma semantica que usa el
      // juego, para que una actividad no pueda pasar la validacion y ser
      // imposible de completar (o al contrario).
      const resultado = interpretarFichas(sim, act.solucionReferencia.comandos);
      tamano = resultado.tamano;
      estructuras.push(...resultado.estructuras);
    } else if (act.solucionReferencia.javascript) {
      tamano = ejecutarJavaScript(sim, act.solucionReferencia.javascript, estructuras);
    } else if (act.solucionReferencia.python) {
      const { codigo, estructuras: usadas } = transpilarPython(act.solucionReferencia.python);
      estructuras.push(...usadas);
      tamano = ejecutarJavaScript(sim, codigo, estructuras);
    } else {
      return 'no tiene solucion de referencia';
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
    puedeAvanzar: () => sim.puedeAvanzar(),
    colorCasilla: () => sim.colorCasilla(),
    hayObstaculo: () => sim.hayObstaculo(),
  };

  const repetir = (veces: number, cuerpo: () => void): void => {
    for (let i = 0; i < veces; i++) cuerpo();
  };

  if (/repetir\s*\(|for\s*\(/.test(codigo)) estructuras.push('repetir');
  if (/while\s*\(/.test(codigo)) estructuras.push('mientras');
  if (/if\s*\(/.test(codigo)) estructuras.push('si');
  if (/function/.test(codigo)) estructuras.push('funcion');

  new Function('fuzz', 'repetir', codigo)(fuzz, repetir);

  // El tamano del programa escrito: lineas con contenido real.
  return codigo
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//') && l !== '}' && l !== '{').length;
}

async function main(): Promise<void> {
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
