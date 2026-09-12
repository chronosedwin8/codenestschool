/**
 * Cliente de S3 con firma SigV4, escrito a mano.
 *
 * No se trae `@aws-sdk/client-s3` por dos razones, y las dos son de este
 * proyecto en concreto:
 *
 *  1. **Tamano.** El SDK arrastra decenas de megabytes a una imagen que ya se
 *     construye fuera del servidor porque alli no hay memoria para compilar.
 *  2. **Alcance.** Aqui hacen falta cuatro operaciones —subir, borrar, listar y
 *     comprobar— y la firma de AWS esta especificada al detalle.
 *
 * Es un puerto del cliente de BookStudio, el proyecto hermano, donde llevaba
 * meses funcionando contra este mismo S3.
 *
 * Referencia: AWS Signature Version 4, "Authenticating Requests".
 */
import { createHash, createHmac } from 'node:crypto';

const SERVICIO = 's3';
const ALGORITMO = 'AWS4-HMAC-SHA256';

const sha256 = (dato: Buffer | string): string => createHash('sha256').update(dato).digest('hex');
const hmac = (clave: Buffer | string, dato: string): Buffer =>
  createHmac('sha256', clave).update(dato, 'utf8').digest();

export interface ConfigS3 {
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** Dominio propio o CDN por delante del bucket. Vacio: el de AWS. */
  readonly urlPublica?: string;
}

/**
 * Codifica cada segmento de la clave sin tocar las barras.
 *
 * `encodeURIComponent` escapa la barra, y AWS espera la ruta con sus separadores
 * intactos pero el resto de caracteres codificados.
 */
const rutaCanonica = (clave: string): string =>
  '/' + clave.split('/').map((parte) => encodeURIComponent(parte)).join('/');

/**
 * Los parametros van ordenados por nombre y codificados; AWS es estricto.
 *
 * Los de valor VACIO se quedan: `?policy` y `?publicAccessBlock` son
 * subrecursos y se firman como `policy=`. Descartarlos convertia una peticion de
 * politica en una de "crear bucket", que respondia con un error de XML
 * malformado y mandaba a buscar el fallo al sitio equivocado.
 */
function consultaCanonica(parametros: Record<string, string | undefined>): string {
  return Object.entries(parametros)
    .filter(([, valor]) => valor !== undefined)
    .map(([nombre, valor]) => [encodeURIComponent(nombre), encodeURIComponent(valor!)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([nombre, valor]) => `${nombre}=${valor}`)
    .join('&');
}

interface Peticion {
  readonly metodo: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  readonly clave: string;
  readonly parametros?: Record<string, string | undefined>;
  readonly cuerpo?: Buffer;
  readonly contentType?: string;
  readonly cabecerasExtra?: Record<string, string>;
}

export class ClienteS3 {
  constructor(private readonly cfg: ConfigS3) {}

  /** Estilo host virtual: el bucket va en el nombre de dominio. */
  private get host(): string {
    return `${this.cfg.bucket}.s3.${this.cfg.region}.amazonaws.com`;
  }

  /** La direccion con la que el navegador pedira el archivo. */
  urlDe(clave: string): string {
    const base = this.cfg.urlPublica?.replace(/\/+$/, '') ?? `https://${this.host}`;
    return `${base}${rutaCanonica(clave)}`;
  }

  private firmar({ metodo, clave, parametros = {}, cuerpo, contentType, cabecerasExtra = {} }: Peticion): {
    url: string;
    cabeceras: Record<string, string>;
  } {
    const marca = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20260912T101530Z
    const dia = marca.slice(0, 8);
    const ambito = `${dia}/${this.cfg.region}/${SERVICIO}/aws4_request`;
    const hashCuerpo = sha256(cuerpo ?? Buffer.alloc(0));

    const cabeceras: Record<string, string> = {
      host: this.host,
      'x-amz-content-sha256': hashCuerpo,
      'x-amz-date': marca,
      ...(contentType ? { 'content-type': contentType } : {}),
      ...Object.fromEntries(
        Object.entries(cabecerasExtra).map(([k, v]) => [k.toLowerCase(), v] as const),
      ),
    };

    const nombres = Object.keys(cabeceras).sort();
    const cabecerasCanonicas = nombres.map((n) => `${n}:${cabeceras[n]!.trim()}\n`).join('');
    const firmadas = nombres.join(';');
    const consulta = consultaCanonica(parametros);

    const peticionCanonica = [
      metodo,
      rutaCanonica(clave),
      consulta,
      cabecerasCanonicas,
      firmadas,
      hashCuerpo,
    ].join('\n');

    const porFirmar = [ALGORITMO, marca, ambito, sha256(peticionCanonica)].join('\n');

    // Cadena de derivacion: secreto -> dia -> region -> servicio -> peticion.
    const claveFirma = hmac(
      hmac(hmac(hmac(`AWS4${this.cfg.secretAccessKey}`, dia), this.cfg.region), SERVICIO),
      'aws4_request',
    );
    const firma = createHmac('sha256', claveFirma).update(porFirmar, 'utf8').digest('hex');

    return {
      url: `https://${this.host}${rutaCanonica(clave)}${consulta ? `?${consulta}` : ''}`,
      cabeceras: {
        ...cabeceras,
        Authorization: `${ALGORITMO} Credential=${this.cfg.accessKeyId}/${ambito}, SignedHeaders=${firmadas}, Signature=${firma}`,
      },
    };
  }

  private async enviar(peticion: Peticion): Promise<Response> {
    const { url, cabeceras } = this.firmar(peticion);

    const respuesta = await fetch(url, {
      method: peticion.metodo,
      headers: cabeceras,
      body: peticion.cuerpo,
      signal: AbortSignal.timeout(30_000),
    });

    if (!respuesta.ok && respuesta.status !== 404) {
      const detalle = await respuesta.text().catch(() => '');
      // El XML de error de AWS trae el motivo real dentro de <Message>.
      const mensaje = /<Message>([^<]+)<\/Message>/.exec(detalle)?.[1] ?? respuesta.statusText;
      throw new Error(`S3 ${peticion.metodo} ${peticion.clave || '(bucket)'}: ${respuesta.status} ${mensaje}`);
    }

    return respuesta;
  }

  async subir(
    clave: string,
    cuerpo: Buffer,
    contentType: string,
    cacheControl = 'public, max-age=31536000, immutable',
  ): Promise<string> {
    await this.enviar({
      metodo: 'PUT',
      clave,
      cuerpo,
      contentType,
      cabecerasExtra: { 'cache-control': cacheControl },
    });
    return this.urlDe(clave);
  }

  async borrar(clave: string): Promise<void> {
    await this.enviar({ metodo: 'DELETE', clave });
  }

  async existe(clave: string): Promise<boolean> {
    const respuesta = await this.enviar({ metodo: 'HEAD', clave });
    return respuesta.ok;
  }

  /** Todas las claves bajo un prefijo, siguiendo la paginacion de AWS. */
  async listar(prefijo: string): Promise<string[]> {
    const claves: string[] = [];
    let continuacion: string | undefined;

    do {
      const respuesta = await this.enviar({
        metodo: 'GET',
        clave: '',
        parametros: { 'list-type': '2', prefix: prefijo, 'continuation-token': continuacion },
      });
      const xml = await respuesta.text();

      for (const coincidencia of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        claves.push(coincidencia[1]!);
      }

      continuacion = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1]
        : undefined;
    } while (continuacion);

    return claves;
  }

  /** Comprueba que el bucket existe y que estas credenciales llegan a el. */
  async comprobar(): Promise<boolean> {
    const respuesta = await this.enviar({
      metodo: 'GET',
      clave: '',
      parametros: { 'list-type': '2', 'max-keys': '1' },
    });
    return respuesta.ok;
  }

  /**
   * Levanta el bloqueo de politicas publicas del bucket.
   *
   * AWS crea los buckets nuevos con "Block Public Access" completo, asi que una
   * politica de lectura publica se acepta pero no surte efecto: las imagenes
   * seguirian dando 403 en el navegador sin un solo error por nuestro lado. Solo
   * se desactiva lo de las politicas; las ACL siguen deshabilitadas.
   */
  async permitirPoliticasPublicas(): Promise<void> {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<PublicAccessBlockConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
      '<BlockPublicAcls>true</BlockPublicAcls>' +
      '<IgnorePublicAcls>true</IgnorePublicAcls>' +
      '<BlockPublicPolicy>false</BlockPublicPolicy>' +
      '<RestrictPublicBuckets>false</RestrictPublicBuckets>' +
      '</PublicAccessBlockConfiguration>';
    const cuerpo = Buffer.from(xml, 'utf8');

    await this.enviar({
      metodo: 'PUT',
      clave: '',
      parametros: { publicAccessBlock: '' },
      cuerpo,
      contentType: 'application/xml',
      cabecerasExtra: { 'content-md5': createHash('md5').update(cuerpo).digest('base64') },
    });
  }

  /**
   * Permite que el navegador lea estas imagenes desde nuestro dominio.
   *
   * Sin CORS, un `<img crossOrigin="anonymous">` —que es como las carga el motor
   * del juego— falla en silencio: no hay error de red visible, simplemente la
   * textura no existe y el fondo sale en degradado. Y el `crossOrigin` no es
   * opcional: sin el, la imagen "mancha" el lienzo y la captura de la portada
   * del juego sale negra.
   */
  async permitirCorsDesde(origenes: readonly string[]): Promise<void> {
    const reglas = origenes
      .map(
        (origen) =>
          `<CORSRule><AllowedOrigin>${origen}</AllowedOrigin>` +
          '<AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>' +
          '<AllowedHeader>*</AllowedHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule>',
      )
      .join('');
    const cuerpo = Buffer.from(`<CORSConfiguration>${reglas}</CORSConfiguration>`, 'utf8');

    await this.enviar({
      metodo: 'PUT',
      clave: '',
      parametros: { cors: '' },
      cuerpo,
      contentType: 'application/xml',
      // AWS exige la suma MD5 en esta llamada.
      cabecerasExtra: { 'content-md5': createHash('md5').update(cuerpo).digest('base64') },
    });
  }

  /** Deja en solo-lectura publica los prefijos indicados, y nada mas. */
  async permitirLecturaDe(prefijos: readonly string[]): Promise<void> {
    const politica = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'LecturaPublicaDelCatalogo',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: prefijos.map((p) => `arn:aws:s3:::${this.cfg.bucket}/${p}`),
        },
      ],
    };

    await this.enviar({
      metodo: 'PUT',
      clave: '',
      parametros: { policy: '' },
      cuerpo: Buffer.from(JSON.stringify(politica), 'utf8'),
      contentType: 'application/json',
    });
  }

  /**
   * Crea el bucket. Solo lo usa el script de preparacion, nunca el servidor.
   *
   * En `us-east-1` NO se manda `CreateBucketConfiguration`: es la region por
   * omision y AWS rechaza la peticion si se la declara.
   */
  async crearBucket(): Promise<'creado' | 'ya-existia'> {
    const cuerpo =
      this.cfg.region === 'us-east-1'
        ? undefined
        : Buffer.from(
            `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${this.cfg.region}</LocationConstraint></CreateBucketConfiguration>`,
          );

    try {
      await this.enviar({ metodo: 'PUT', clave: '', cuerpo, contentType: 'application/xml' });
      return 'creado';
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      // AWS responde "you already own it" en us-east-1 y "BucketAlreadyOwnedByYou"
      // en el resto: las dos significan que no hay nada que hacer.
      if (/BucketAlreadyOwnedByYou|already own|already exists/i.test(mensaje)) return 'ya-existia';
      throw error;
    }
  }
}
