/**
 * Siembra la base de datos de CodeNest School.
 *
 * Orden y responsabilidades:
 *   1. Planes comerciales (Personal, Padres, Escuela).
 *   2. Perfiles de voz de ElevenLabs.
 *   3. Los 30 mundos (desde packages/shared/catalog).
 *   4. Frases de interfaz y celebraciones -> filas `audios` en estado pendiente.
 *   5. Actividades disponibles en packages/content/worlds/*.json, con sus
 *      pistas y sus `audios` pendientes.
 *
 * Clave del diseno: el seed crea las filas de `audios` en estado `pendiente`,
 * asi las claves foraneas de mundos, actividades y pistas son validas desde el
 * primer momento. `generate-voiceover.ts` produce los MP3 y `sync-audio.ts`
 * marca las filas como `generado`. No hay dependencia de orden.
 *
 * Es idempotente: se puede ejecutar tantas veces como haga falta.
 */
import { createHash } from 'node:crypto';

import { PrismaClient, type Prisma } from '@prisma/client';

import { hashPassword } from '../src/services/auth.service.js';

import {
  CELEBRACIONES,
  FRASES_UI,
  VOCES,
  VOZ_UI,
  textosDeHistoria,
  vozPara,
} from '@codenest/content';
import { cargarMundos } from '@codenest/content/loader';
import {
  MUNDOS,
  PLANES,
  POOL_CELEBRACIONES,
  claveCelebracion,
  claveExito,
  claveInstruccion,
  claveMundoIntro,
  clavePista,
  claveUi,
  numeroGlobal,
} from '@codenest/shared';

const prisma = new PrismaClient();

/** Debe coincidir con `hashDe()` de generate-voiceover.ts. */
function hashAudio(texto: string, voz: (typeof VOCES)[number]): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        texto,
        voz: voz.elevenVoiceId,
        modelo: voz.modelo,
        settings: voz.settings,
        formato: 'mp3_44100_64',
      }),
    )
    .digest('hex');
}

/** Lee el precio de una variable de entorno con respaldo del catalogo. */
function precioDe(envVar: string, porDefecto: number): number {
  const crudo = process.env[envVar];
  const valor = crudo ? Number.parseInt(crudo, 10) : Number.NaN;
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

async function sembrarPlanes(): Promise<void> {
  for (const plan of PLANES) {
    const precioCop = precioDe(plan.envPrecio, plan.precioPorDefectoCop);
    await prisma.plan.upsert({
      where: { clave: plan.clave },
      update: {
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precioCop,
        vigenciaDias: plan.vigenciaDias,
        maxNinos: plan.maxNinos,
        maxDocentes: plan.maxDocentes,
        beneficios: plan.beneficios as unknown as Prisma.InputJsonValue,
        destacado: plan.destacado,
        orden: plan.orden,
        activo: true,
      },
      create: {
        clave: plan.clave,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precioCop,
        vigenciaDias: plan.vigenciaDias,
        maxNinos: plan.maxNinos,
        maxDocentes: plan.maxDocentes,
        beneficios: plan.beneficios as unknown as Prisma.InputJsonValue,
        destacado: plan.destacado,
        orden: plan.orden,
      },
    });
    console.log(`  plan ${plan.nombre.padEnd(9)} $${precioCop.toLocaleString('es-CO')} COP / ${plan.vigenciaDias} dias`);
  }
}

async function sembrarVoces(): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const voz of VOCES) {
    const fila = await prisma.voiceProfile.upsert({
      where: { clave: voz.clave },
      update: {
        nombre: voz.nombre,
        elevenVoiceId: voz.elevenVoiceId,
        modelo: voz.modelo,
        settings: voz.settings as unknown as Prisma.InputJsonValue,
        rolPersonaje: voz.rolPersonaje,
      },
      create: {
        clave: voz.clave,
        nombre: voz.nombre,
        elevenVoiceId: voz.elevenVoiceId,
        modelo: voz.modelo,
        settings: voz.settings as unknown as Prisma.InputJsonValue,
        rolPersonaje: voz.rolPersonaje,
      },
    });
    ids.set(voz.clave, fila.id);
  }
  console.log(`  ${ids.size} perfiles de voz`);
  return ids;
}

/** Crea (o actualiza) una fila de audio en estado pendiente. */
async function upsertAudio(opciones: {
  clave: string;
  tipo: 'instruccion' | 'exito' | 'pista' | 'ui' | 'mundo_intro' | 'celebracion';
  texto: string;
  vozClave: string;
  vozId: number;
}): Promise<number> {
  const voz = VOCES.find((v) => v.clave === opciones.vozClave);
  if (!voz) throw new Error(`Voz desconocida: ${opciones.vozClave}`);
  const hash = hashAudio(opciones.texto, voz);

  const existente = await prisma.audioAsset.findUnique({ where: { clave: opciones.clave } });

  // Si el texto cambio, el MP3 que hubiera queda obsoleto y hay que regenerarlo.
  const estado =
    existente && existente.textoHash !== hash && existente.estado === 'generado'
      ? ('obsoleto' as const)
      : (existente?.estado ?? ('pendiente' as const));

  const fila = await prisma.audioAsset.upsert({
    where: { clave: opciones.clave },
    update: { texto: opciones.texto, textoHash: hash, vozId: opciones.vozId, tipo: opciones.tipo, estado },
    create: {
      clave: opciones.clave,
      tipo: opciones.tipo,
      texto: opciones.texto,
      textoHash: hash,
      vozId: opciones.vozId,
    },
  });
  return fila.id;
}

async function sembrarAudiosFijos(voces: Map<string, number>): Promise<void> {
  const vozUiId = voces.get(VOZ_UI.clave);
  if (!vozUiId) throw new Error('Falta la voz de interfaz');

  for (const frase of FRASES_UI) {
    await upsertAudio({
      clave: claveUi(frase.slug),
      tipo: 'ui',
      texto: frase.texto,
      vozClave: VOZ_UI.clave,
      vozId: vozUiId,
    });
  }

  const celebraciones = CELEBRACIONES.slice(0, POOL_CELEBRACIONES);
  for (const [i, texto] of celebraciones.entries()) {
    await upsertAudio({
      clave: claveCelebracion(i + 1),
      tipo: 'celebracion',
      texto,
      vozClave: VOZ_UI.clave,
      vozId: vozUiId,
    });
  }

  // Narracion de las cinematicas. Va con la voz de Nube, la misma guia.
  const historia = textosDeHistoria();
  for (const { clave, texto } of historia) {
    await upsertAudio({
      clave,
      tipo: 'ui',
      texto,
      vozClave: VOZ_UI.clave,
      vozId: vozUiId,
    });
  }

  console.log(
    `  ${FRASES_UI.length} frases de interfaz, ${celebraciones.length} celebraciones y ${historia.length} de la historia`,
  );
}

async function sembrarMundos(voces: Map<string, number>): Promise<Map<number, number>> {
  const ids = new Map<number, number>();

  for (const mundo of MUNDOS) {
    const datos = {
      slug: mundo.slug,
      nombre: mundo.nombre,
      grupoEdad: mundo.grupo,
      concepto: mundo.concepto,
      descripcion: mundo.descripcion,
      bioma: mundo.bioma,
      editor: mundo.editor,
      lenguajes: [...mundo.lenguajes],
      icono: mundo.icono,
      colorPrimario: mundo.colorPrimario,
      colorSecundario: mundo.colorSecundario,
    };

    const fila = await prisma.world.upsert({
      where: { numero: mundo.numero },
      update: datos,
      create: { numero: mundo.numero, ...datos },
    });
    ids.set(mundo.numero, fila.id);
  }

  console.log(`  ${ids.size} mundos`);
  return ids;
}

async function sembrarActividades(
  mundoIds: Map<number, number>,
  voces: Map<string, number>,
): Promise<void> {
  const archivos = await cargarMundos();
  if (archivos.length === 0) {
    console.log('  (todavia no hay archivos de contenido; se sembraran en la fase 5)');
    return;
  }

  let total = 0;

  for (const { contenido: archivo } of archivos) {
    const mundo = MUNDOS.find((m) => m.numero === archivo.mundo);
    if (!mundo) throw new Error(`El archivo declara el mundo ${archivo.mundo}, que no existe`);
    const mundoId = mundoIds.get(mundo.numero);
    if (!mundoId) throw new Error(`Falta sembrar el mundo ${mundo.numero}`);

    // Intro hablada del mundo.
    const vozIntro = vozPara(mundo.grupo, 'mundo_intro');
    const vozIntroId = voces.get(vozIntro.clave);
    if (!vozIntroId) throw new Error(`Falta la voz ${vozIntro.clave}`);

    const audioIntroId = await upsertAudio({
      clave: claveMundoIntro(mundo.numero),
      tipo: 'mundo_intro',
      texto: archivo.introTexto,
      vozClave: vozIntro.clave,
      vozId: vozIntroId,
    });
    await prisma.world.update({ where: { id: mundoId }, data: { audioIntroId } });

    for (const act of archivo.actividades) {
      const global = numeroGlobal(mundo.numero, act.numeroEnMundo);

      // Audio de instruccion.
      const vozInstr = vozPara(mundo.grupo, 'instruccion');
      const vozInstrId = voces.get(vozInstr.clave);
      if (!vozInstrId) throw new Error(`Falta la voz ${vozInstr.clave}`);
      const audioInstruccionId = await upsertAudio({
        clave: claveInstruccion(mundo.numero, act.numeroEnMundo),
        tipo: 'instruccion',
        texto: act.instruccionTexto,
        vozClave: vozInstr.clave,
        vozId: vozInstrId,
      });

      // Audio de exito: propio, o del pool compartido de celebraciones.
      const usaPool = act.config.audio.exito.startsWith('celebration_');
      let audioExitoId: number;
      if (usaPool) {
        const fila = await prisma.audioAsset.findUnique({
          where: { clave: act.config.audio.exito },
        });
        if (!fila) throw new Error(`No existe la celebracion ${act.config.audio.exito}`);
        audioExitoId = fila.id;
      } else {
        const vozExito = vozPara(mundo.grupo, 'exito');
        const vozExitoId = voces.get(vozExito.clave);
        if (!vozExitoId) throw new Error(`Falta la voz ${vozExito.clave}`);
        audioExitoId = await upsertAudio({
          clave: claveExito(mundo.numero, act.numeroEnMundo),
          tipo: 'exito',
          texto: act.exitoTexto,
          vozClave: vozExito.clave,
          vozId: vozExitoId,
        });
      }

      const datosActividad = {
        numeroGlobal: global,
        numeroEnMundo: act.numeroEnMundo,
        slug: act.slug,
        nombre: act.nombre,
        tipo: act.tipo,
        dificultad: act.dificultad,
        config: act.config as unknown as Prisma.InputJsonValue,
        instruccionTexto: act.instruccionTexto,
        exitoTexto: act.exitoTexto,
        audioInstruccionId,
        audioExitoId,
        solucionReferencia: act.solucionReferencia as unknown as Prisma.InputJsonValue,
      };

      const actividad = await prisma.activity.upsert({
        where: { mundoId_numeroEnMundo: { mundoId, numeroEnMundo: act.numeroEnMundo } },
        update: datosActividad,
        create: { mundoId, ...datosActividad },
      });

      // Pistas con su audio.
      const vozPista = vozPara(mundo.grupo, 'pista');
      const vozPistaId = voces.get(vozPista.clave);
      if (!vozPistaId) throw new Error(`Falta la voz ${vozPista.clave}`);

      for (const [i, texto] of act.pistas.entries()) {
        const orden = i + 1;
        const audioId = await upsertAudio({
          clave: clavePista(mundo.numero, act.numeroEnMundo, orden),
          tipo: 'pista',
          texto,
          vozClave: vozPista.clave,
          vozId: vozPistaId,
        });
        await prisma.hint.upsert({
          where: { actividadId_orden: { actividadId: actividad.id, orden } },
          update: { texto, audioId },
          create: { actividadId: actividad.id, orden, texto, audioId },
        });
      }

      total++;
    }
  }

  console.log(`  ${total} actividades con sus pistas y audios`);
}

/** Verifica que numeroGlobal siga la formula del catalogo. */
async function verificarCoherencia(): Promise<void> {
  const actividades = await prisma.activity.findMany({
    select: { numeroGlobal: true, numeroEnMundo: true, mundo: { select: { numero: true } } },
  });

  for (const act of actividades) {
    const esperado = numeroGlobal(act.mundo.numero, act.numeroEnMundo);
    if (act.numeroGlobal !== esperado) {
      throw new Error(
        `Incoherencia: la actividad ${act.numeroEnMundo} del mundo ${act.mundo.numero} ` +
          `tiene numero_global ${act.numeroGlobal} y deberia ser ${esperado}`,
      );
    }
  }
  console.log(`  coherencia de numero_global verificada en ${actividades.length} actividades`);
}

/**
 * Crea la cuenta de administrador si no existe.
 *
 * No hay ruta publica para dar de alta un administrador, y con razon, asi que un
 * despliegue nuevo se quedaria sin nadie que pueda entrar. Se toma de
 * `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
 *
 * NUNCA sobrescribe una cuenta que ya existe. Asi la contrasena se puede cambiar
 * despues desde el portal sin que el siguiente reinicio la devuelva al valor del
 * entorno, y esas dos variables se pueden borrar en cuanto la cuenta este creada.
 */
async function asegurarAdministrador(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('Sin ADMIN_EMAIL/ADMIN_PASSWORD: no se toca ninguna cuenta.');
    return;
  }

  const existente = await prisma.user.findFirst({
    where: { OR: [{ email }, { usuario: email }] },
    select: { id: true, rol: true },
  });

  if (existente) {
    console.log(`La cuenta ${email} ya existe (rol ${existente.rol}): no se toca.`);
    return;
  }

  await prisma.user.create({
    data: {
      usuario: email,
      email,
      nombre: process.env.ADMIN_NOMBRE?.trim() || 'Administrador',
      rol: 'admin',
      passwordHash: await hashPassword(password),
      activo: true,
    },
  });
  console.log(`Administrador creado: ${email}`);
}

async function main(): Promise<void> {
  // Paso suelto para el arranque del contenedor: es barato y corre siempre.
  if (process.argv.includes('--asegurar-admin')) {
    await asegurarAdministrador();
    return;
  }

  /**
   * En el arranque de un contenedor solo interesa sembrar una base recien
   * creada. Todo aqui son upserts, asi que repetirlo no rompe nada, pero
   * recorrer seiscientas actividades en cada reinicio son casi dos minutos de
   * arranque que no hacen falta.
   */
  if (process.argv.includes('--solo-si-vacio')) {
    const mundos = await prisma.world.count();
    if (mundos > 0) {
      console.log(`Ya hay ${mundos} mundos sembrados: no se toca nada.`);
      return;
    }
    console.log('Base vacia: se siembra el curriculo completo.\n');
  }

  console.log('Sembrando CodeNest School\n');

  console.log('Planes comerciales:');
  await sembrarPlanes();

  console.log('\nVoces:');
  const voces = await sembrarVoces();

  console.log('\nAudios fijos:');
  await sembrarAudiosFijos(voces);

  console.log('\nCurriculo:');
  const mundoIds = await sembrarMundos(voces);
  await sembrarActividades(mundoIds, voces);

  console.log('\nVerificaciones:');
  await verificarCoherencia();

  const [mundos, actividades, audios, pendientes, planes] = await Promise.all([
    prisma.world.count(),
    prisma.activity.count(),
    prisma.audioAsset.count(),
    prisma.audioAsset.count({ where: { estado: 'pendiente' } }),
    prisma.plan.count(),
  ]);

  console.log('\nResumen');
  console.log(`  mundos             : ${mundos}`);
  console.log(`  actividades        : ${actividades}`);
  console.log(`  audios             : ${audios} (${pendientes} pendientes de generar)`);
  console.log(`  planes             : ${planes}`);
  console.log('\nSiguiente paso: npm run voice:generate -- --worlds 1');
}

main()
  .catch((error: unknown) => {
    console.error('\nFALLO en el seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
