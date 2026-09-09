/**
 * Dibuja el tablero de una actividad y ejecuta su solución de referencia.
 *
 * `validate-content` dice que una actividad falla, pero no por qué. Cuando hay
 * que escribir 600 tableros en modo rodar, la pregunta siempre es la misma: por
 * dónde iba el Fuzz cuando se quedó sin camino. Esto lo responde de un vistazo.
 *
 * Uso:
 *   npx tsx scripts/inspect-activity.ts 4 10
 */
import { cargarMundos } from '@codenest/content/loader';
import { GridSimulator, interpretarFichas } from '@codenest/shared';

const mundoPedido = Number(process.argv[2] ?? 1);
const actPedida = Number(process.argv[3] ?? 1);

/** Cómo se dibuja cada tipo de casilla en la consola. */
const SIMBOLO: Record<string, string> = {
  camino: '.',
  vacio: ' ',
  agujero: 'O',
  meta: 'M',
  hielo: '~',
  viento: '>',
  charco: 'o',
};

async function main(): Promise<void> {
  const archivos = await cargarMundos([mundoPedido]);
  const mundo = archivos.find((a) => a.contenido.mundo === mundoPedido)?.contenido;
  if (!mundo) {
    console.error(`No hay contenido del mundo ${mundoPedido}.`);
    process.exitCode = 1;
    return;
  }

  const act = mundo.actividades.find((a) => a.numeroEnMundo === actPedida);
  if (!act) {
    console.error(`El mundo ${mundoPedido} no tiene la actividad ${actPedida}.`);
    process.exitCode = 1;
    return;
  }

  const cfg = act.config;
  console.log(`${act.slug}   rejilla ${cfg.grid.cols}x${cfg.grid.rows}`);
  console.log(`S salida  M meta  . camino  O agujero  * objeto\n`);

  cfg.grid.tiles.forEach((fila, y) => {
    const linea = fila
      .map((tile, x) => {
        if (cfg.spawn.x === x && cfg.spawn.y === y) return 'S';
        if (cfg.items.some((i) => i.x === x && i.y === y)) return '*';
        return SIMBOLO[tile.t] ?? '?';
      })
      .join('');
    console.log(`${String(y).padStart(2)} ${linea}`);
  });

  const sim = new GridSimulator({
    grid: cfg.grid,
    spawn: cfg.spawn,
    items: cfg.items,
    modo: cfg.modoMovimiento,
    comandosPermitidos: cfg.comandosPermitidos,
    topeEjecucion: cfg.topeEjecucion,
  });

  const pasos = act.solucionReferencia.comandos ?? [];
  let fallo: string | null = null;
  try {
    interpretarFichas(sim, pasos);
  } catch (e) {
    fallo = (e as Error).message;
  }

  console.log('\nRecorrido de la solucion de referencia:');
  for (const accion of sim.accionesEjecutadas) {
    const hasta = accion.hasta ? `(${accion.hasta.x},${accion.hasta.y})` : '-';
    console.log(`  ${accion.cmd.padEnd(10)} -> ${hasta}`);
  }

  const meta = cfg.objetivos.find((o) => o.tipo === 'alcanzar_celda');
  console.log(`\nMeta: (${meta?.x},${meta?.y})   Fuzz: (${sim.estado.x},${sim.estado.y})`);
  console.log(`Recogido: ${sim.estado.recogidos.join(', ') || 'nada'}`);
  console.log(fallo ? `FALLA: ${fallo}` : 'La solucion llega al final sin choques.');
}

await main();
