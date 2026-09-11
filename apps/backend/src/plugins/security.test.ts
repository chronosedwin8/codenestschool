/**
 * La excepcion de la politica de seguridad para el sandbox.
 *
 * Existe por el fallo mas caro de este proyecto: el juego entero era injugable
 * en produccion y funcionaba en local. El sandbox ejecuta el programa del niño
 * con `new Function` dentro de un trabajador web, y la politica de seguridad de
 * contenidos —que solo se activa en produccion— lo bloqueaba. El sintoma no
 * mencionaba nada de esto: el trabajador devolvia un error generico y el juego
 * lo presentaba como un choque, asi que la primera actividad del primer mundo,
 * con su unica flecha puesta donde toca, respondia "casi lo logras".
 *
 * Lo que se protege aqui es el patron que decide a que archivos se les da la
 * excepcion. Si dejara de acertar, todas las actividades volverian a fallar como
 * si el niño se equivocara.
 */
import { describe, expect, it } from 'vitest';

import { esArchivoDeTrabajador } from './security.js';

describe('que archivos reciben la excepcion de la politica', () => {
  it('reconoce los tres trabajadores que compila Vite', () => {
    // El sandbox del juego y los dos de Monaco, con los nombres reales que
    // produce la compilacion.
    expect(esArchivoDeTrabajador('/app/assets/runner.worker-CGaSxCun.js')).toBe(true);
    expect(esArchivoDeTrabajador('/app/assets/ts.worker-DEm7CNMq.js')).toBe(true);
    expect(esArchivoDeTrabajador('/app/assets/editor.worker-Do-pUK2A.js')).toBe(true);
  });

  it('ignora la consulta al final de la ruta', () => {
    expect(esArchivoDeTrabajador('/app/assets/runner.worker-CGaSxCun.js?v=2')).toBe(true);
  });

  it('no se la da a nada mas', () => {
    // Es lo importante: la excepcion permite evaluar codigo, asi que cualquier
    // archivo de mas la estaria regalando.
    for (const ruta of [
      '/app/assets/index-CGKQRzFC.js',
      '/app/',
      '/app/index.html',
      '/api/curriculo/mundos',
      '/app/static/audio/musica/pradera.mp3',
      '/app/assets/worker.js',
      '/app/assets/runner.worker-CGaSxCun.js.map',
      '/app/assets/algo.worker-abc.js/otra-cosa',
    ]) {
      expect(esArchivoDeTrabajador(ruta), ruta).toBe(false);
    }
  });
});
