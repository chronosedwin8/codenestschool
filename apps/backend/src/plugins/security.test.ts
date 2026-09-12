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

import { esArchivoDeTrabajador, origenesDeConexion, origenesDeImagen } from './security.js';

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

describe('de donde se pueden cargar imagenes', () => {
  it('anade el bucket de S3 cuando esta configurado', () => {
    const origenes = origenesDeImagen({
      S3_BUCKET: 'codexialabstorage',
      S3_REGION: 'us-east-1',
    } as never);

    // Sin esto, en produccion los escenarios de los juegos se bloquean por
    // politica de contenido y el juego sale con un degradado, sin un solo error
    // de red que lo explique.
    expect(origenes).toContain('https://codexialabstorage.s3.us-east-1.amazonaws.com');
    expect(origenes).toContain("'self'");
  });

  it('prefiere el dominio propio si algun dia hay una CDN delante', () => {
    const origenes = origenesDeImagen({
      S3_BUCKET: 'codexialabstorage',
      S3_REGION: 'us-east-1',
      S3_PUBLIC_URL: 'https://media.codenestschool.com/',
    } as never);

    expect(origenes).toContain('https://media.codenestschool.com');
    expect(origenes).not.toContain('https://codexialabstorage.s3.us-east-1.amazonaws.com');
  });

  it('sin almacenamiento no abre nada de fuera', () => {
    expect(origenesDeImagen({ S3_REGION: 'us-east-1' } as never)).toEqual([
      "'self'",
      'data:',
      'blob:',
    ]);
  });
});

describe('a donde se puede conectar el navegador', () => {
  it('incluye el almacen, porque Phaser pide las imagenes por XHR', () => {
    const origenes = origenesDeConexion({
      S3_BUCKET: 'codexialabstorage',
      S3_REGION: 'us-east-1',
    } as never);

    // Es el fallo que costo mas encontrar: con el almacen solo en `img-src`, las
    // miniaturas se veian y el fondo del juego no, porque el motor no usa una
    // etiqueta <img> sino XHR, y a XHR lo gobierna `connect-src`.
    expect(origenes).toContain('https://codexialabstorage.s3.us-east-1.amazonaws.com');
    expect(origenes).toContain('https://api.mercadopago.com');
  });

  it('sin almacenamiento se queda como estaba', () => {
    expect(origenesDeConexion({ S3_REGION: 'us-east-1' } as never)).toEqual([
      "'self'",
      'https://api.mercadopago.com',
    ]);
  });
});
