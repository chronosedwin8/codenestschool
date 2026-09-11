/**
 * Toda ficha que el currículo pida tiene que saber dibujarse.
 *
 * Existe por un fallo que dejó sesenta actividades sin poder jugarse. El comando
 * `llamar` (usar el Super salto, en los mundos 7, 9 y 10) no estaba en la tabla
 * de colores, así que `tono.fondo` leía de `undefined` y reventaba el montaje
 * del componente. No se caía una ficha: se caía el editor entero, y con él la
 * actividad.
 *
 * Ni `validate-content` ni `smoke-play` podían verlo. El primero simula la
 * solución en memoria y el segundo la juega contra el servidor; ninguno de los
 * dos monta la interfaz, que es donde estaba el fallo.
 *
 * La prueba no mira una ficha concreta: recorre los diez mundos de fichas y
 * exige que cada comando que aparece en el contenido tenga color. Así cubre
 * también el que se añada mañana.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { TONOS_FICHA } from './fichas';

const DIR_MUNDOS = resolve(import.meta.dirname, '../../../../packages/content/worlds');

/** Todos los comandos que el currículo pide a la barra de fichas. */
function comandosDelCurriculo(): Map<string, string[]> {
  const usos = new Map<string, string[]>();

  for (const archivo of readdirSync(DIR_MUNDOS).filter((f) => f.endsWith('.json'))) {
    const mundo = JSON.parse(readFileSync(resolve(DIR_MUNDOS, archivo), 'utf8')) as {
      mundo: number;
      actividades: { numeroEnMundo: number; config: { editor: string; comandosPermitidos: string[] } }[];
    };

    for (const act of mundo.actividades) {
      // Solo el editor de fichas: los bloques y el texto no usan este componente.
      if (act.config.editor !== 'comandos') continue;
      for (const comando of act.config.comandosPermitidos ?? []) {
        const donde = usos.get(comando) ?? [];
        donde.push(`M${mundo.mundo}-A${act.numeroEnMundo}`);
        usos.set(comando, donde);
      }
    }
  }

  return usos;
}

describe('las fichas que pide el curriculo', () => {
  it('todas tienen color, o su actividad no se puede jugar', () => {
    const sinColor: string[] = [];

    for (const [comando, donde] of comandosDelCurriculo()) {
      if (!(comando in TONOS_FICHA)) {
        sinColor.push(`"${comando}" (${donde.length} actividades, p. ej. ${donde[0]})`);
      }
    }

    expect(sinColor).toEqual([]);
  });

  it('encuentra comandos de verdad, no una lista vacia', () => {
    // Si el currículo se moviera de sitio, la comprobación de arriba pasaría
    // sin mirar nada. Esto lo impide.
    const usos = comandosDelCurriculo();

    expect(usos.size).toBeGreaterThan(5);
    expect(usos.has('derecha')).toBe(true);
  });
});
