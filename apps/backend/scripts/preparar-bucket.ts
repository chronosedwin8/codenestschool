/**
 * Crea el bucket de Codexia y deja escrita su estructura de carpetas.
 *
 * Se ejecuta a mano, una vez. El servidor nunca crea buckets: si lo hiciera,
 * una variable mal escrita en produccion crearia un bucket nuevo y vacio en
 * lugar de fallar, y nadie se enteraria hasta que faltaran las imagenes.
 *
 *   npx tsx apps/backend/scripts/preparar-bucket.ts
 */
import { cargarConfig, almacenConfigurado } from '../src/lib/env.js';
import { ClienteS3 } from '../src/lib/s3.js';

/**
 * Las carpetas de S3 no existen de verdad: son prefijos de los nombres. Se deja
 * un `.estructura` en cada una para que el arbol se vea en la consola de AWS y
 * para dejar escrito, dentro del propio bucket, que va en cada sitio.
 */
const CARPETAS: readonly { prefijo: string; para: string }[] = [
  { prefijo: 'catalogo/escenarios/', para: 'Fondos de los juegos, 16:9. Iguales para todos y con cache de un ano.' },
  { prefijo: 'catalogo/musica/', para: 'Musica de fondo por escenario.' },
  { prefijo: 'proyectos/', para: 'Portada de cada juego publicado: proyectos/{id}/portada.png' },
  { prefijo: 'diplomas/', para: 'Copia del diploma emitido: diplomas/{codigo}.png' },
];

async function main(): Promise<void> {
  const config = cargarConfig();
  if (!almacenConfigurado(config)) {
    throw new Error('Faltan S3_BUCKET, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY en el .env');
  }

  const s3 = new ClienteS3({
    bucket: config.S3_BUCKET!,
    region: config.S3_REGION,
    accessKeyId: config.S3_ACCESS_KEY_ID!,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
  });

  console.log(`Bucket: ${config.S3_BUCKET} (${config.S3_REGION})`);
  const resultado = await s3.crearBucket();
  console.log(`  ${resultado === 'creado' ? 'creado ahora' : 'ya existia'}`);

  // Lectura publica solo de lo que el navegador tiene que poder pedir.
  await s3.permitirPoliticasPublicas();
  await s3.permitirLecturaDe(['catalogo/*', 'proyectos/*', 'diplomas/*']);
  console.log('  lectura publica: catalogo/, proyectos/, diplomas/');

  // El motor del juego carga los fondos con `crossOrigin`, asi que hacen falta
  // cabeceras CORS: sin ellas la imagen no carga y no hay ni un error visible.
  await s3.permitirCorsDesde([
    'https://codenestschool.com',
    'http://127.0.0.1:4300',
    'http://localhost:4300',
    'http://localhost:5173',
    'http://localhost:3001',
  ]);
  console.log('  CORS para el dominio y los puertos de desarrollo');

  for (const carpeta of CARPETAS) {
    await s3.subir(
      `${carpeta.prefijo}.estructura`,
      Buffer.from(`${carpeta.para}\n`, 'utf8'),
      'text/plain; charset=utf-8',
      'no-store',
    );
    console.log(`  ${carpeta.prefijo}`);
  }

  const claves = await s3.listar('');
  console.log(`\nEl bucket responde y tiene ${claves.length} objeto(s).`);
  // La comprobacion que importa: pedir un objeto SIN credenciales, como hara el
  // navegador de un nino. Que AWS acepte la politica no significa que funcione.
  const prueba = 'catalogo/.prueba-publica.txt';
  await s3.subir(prueba, Buffer.from('hola\n', 'utf8'), 'text/plain; charset=utf-8', 'no-store');
  const publica = await fetch(s3.urlDe(prueba));
  console.log(`Lectura anonima: ${publica.status} ${publica.ok ? '(bien)' : '(NO es publica)'}`);
  await s3.borrar(prueba);

  console.log('Ejemplo de URL publica:', s3.urlDe('catalogo/escenarios/espacio.jpg'));
}

main().catch((error: unknown) => {
  console.error('No se pudo preparar el bucket:', error instanceof Error ? error.message : error);
  process.exit(1);
});
