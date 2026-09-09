/**
 * Prueba de humo: juega actividades de verdad contra el servidor.
 *
 * `validate-content` simula las soluciones en memoria, pero eso no prueba que un
 * niño pueda jugarlas: falta el alta del tutor, el PIN, el token, la sesión y el
 * recálculo de estrellas en el servidor, que es quien decide. Este script recorre
 * el camino entero y lo hace con las actividades reales de la base de datos.
 *
 * Uso (con el servidor levantado):
 *   npx tsx scripts/smoke-play.ts
 *   npx tsx scripts/smoke-play.ts 1 4 6 7 9 10
 */
import {
  GridSimulator,
  estructurasDelCodigo,
  interpretarFichas,
  lineasDeCodigo,
} from '@codenest/shared';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:3001';
const MUNDOS = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= 30);
const PEDIDOS = MUNDOS.length > 0 ? MUNDOS : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Cada corrida usa un correo distinto: el alta rechaza los repetidos. */
const SELLO = Date.now();

interface Respuesta {
  readonly estado: number;
  readonly cuerpo: Record<string, unknown>;
}

async function pedir(
  ruta: string,
  opciones: { metodo?: string; token?: string; cuerpo?: unknown } = {},
): Promise<Respuesta> {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
    },
    ...(opciones.cuerpo ? { body: JSON.stringify(opciones.cuerpo) } : {}),
  });

  const texto = await respuesta.text();
  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  } catch {
    cuerpo = { crudo: texto.slice(0, 200) };
  }
  return { estado: respuesta.status, cuerpo };
}

/**
 * Ejecuta una solucion en JavaScript, como haria el sandbox del navegador.
 *
 * El tamano del programa lo dice la propia solucion (`bloques`) porque el editor
 * cuenta bloques y no lineas: es la unidad con la que se compara la tercera
 * estrella.
 */
function ejecutarJavaScript(
  sim: GridSimulator,
  solucion: { readonly javascript?: string; readonly bloques?: number },
): { tamano: number; estructuras: readonly string[] } {
  const codigo = solucion.javascript ?? '';
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
  new Function('fuzz', 'repetir', codigo)(fuzz, repetir);

  return {
    // La misma cuenta que hace el editor del nino. Si aqui se contara de otra
    // forma, esta prueba no estaria comprobando lo que va a pasar de verdad, y de
    // hecho fue asi como se encontro que no coincidian.
    tamano: solucion.bloques ?? lineasDeCodigo(codigo),
    estructuras: estructurasDelCodigo(codigo),
  };
}

function exigir(respuesta: Respuesta, que: string): Record<string, unknown> {
  if (respuesta.estado >= 400) {
    throw new Error(`${que}: ${respuesta.estado} ${JSON.stringify(respuesta.cuerpo)}`);
  }
  return respuesta.cuerpo;
}

async function main(): Promise<void> {
  console.log(`Servidor: ${BASE}\n`);

  // ── Alta del adulto y del niño ──
  const email = `smoke-${SELLO}@codenest.test`;
  const alta = exigir(
    await pedir('/api/auth/registro', {
      metodo: 'POST',
      cuerpo: { nombre: 'Tutor de prueba', email, password: 'ClaveDePrueba123', rol: 'tutor' },
    }),
    'alta del tutor',
  );
  let tokenTutor = alta.token as string;

  const creado = exigir(
    await pedir('/api/auth/ninos', {
      metodo: 'POST',
      token: tokenTutor,
      cuerpo: {
        nombre: 'Nino de prueba',
        fechaNacimiento: '2020-05-10',
        pin: ['sol', 'luna', 'estrella', 'nube'],
        parentesco: 'madre',
      },
    }),
    'alta del nino',
  );
  const nino = creado.nino as { id: number; usuario: string };
  tokenTutor = creado.token as string;

  exigir(
    await pedir('/api/auth/consentimiento', {
      metodo: 'POST',
      token: tokenTutor,
      cuerpo: { ninoId: nino.id, versionPolitica: '1.0', otorgado: true },
    }),
    'consentimiento',
  );

  const acceso = exigir(
    await pedir('/api/auth/login-nino', {
      metodo: 'POST',
      cuerpo: { usuario: nino.usuario, pin: ['sol', 'luna', 'estrella', 'nube'] },
    }),
    'acceso del nino',
  );
  const tokenNino = acceso.token as string;
  console.log(`Nino "${nino.usuario}" dentro del juego.\n`);

  // ── Jugar una actividad de cada mundo pedido ──
  let jugadas = 0;
  let fallos = 0;

  for (const mundo of PEDIDOS) {
    const lista = exigir(
      await pedir(`/api/curriculo/mundos/${mundo}/actividades`, { token: tokenNino }),
      `actividades del mundo ${mundo}`,
    );
    const actividades = lista.actividades as { id: number; numeroEnMundo: number }[];

    // Se juega la primera y la ultima: la mas facil y la integradora.
    const elegidas = [actividades[0]!, actividades[actividades.length - 1]!];

    for (const resumen of elegidas) {
      const detalle = exigir(
        await pedir(`/api/curriculo/actividades/${resumen.id}`, { token: tokenNino }),
        `actividad ${resumen.id}`,
      );
      const act = detalle as unknown as { nombre: string };
      const cfg = detalle.config as unknown as {
        grid: never;
        spawn: never;
        items: never[];
        modoMovimiento: never;
        comandosPermitidos: string[];
        topeEjecucion: number;
      };

      // El servidor no manda la solucion al cliente, y hace bien. Se lee del
      // JSON de contenido, que es lo que un nino resolveria por su cuenta.
      const contenido = await import('@codenest/content/loader');
      const archivos = await contenido.cargarMundos([mundo]);
      const mundoJson = archivos[0]!.contenido;
      const definicion = mundoJson.actividades.find(
        (a) => a.numeroEnMundo === resumen.numeroEnMundo,
      )!;
      const sim = new GridSimulator({
        grid: cfg.grid,
        spawn: cfg.spawn,
        items: cfg.items,
        modo: cfg.modoMovimiento,
        comandosPermitidos: cfg.comandosPermitidos,
        topeEjecucion: cfg.topeEjecucion,
      });

      // Fichas en los mundos 1 al 10, JavaScript de los bloques a partir del 11.
      const medida = definicion.solucionReferencia.comandos
        ? interpretarFichas(sim, definicion.solucionReferencia.comandos)
        : ejecutarJavaScript(sim, definicion.solucionReferencia);

      const sesion = exigir(
        await pedir('/api/sesiones', {
          metodo: 'POST',
          token: tokenNino,
          cuerpo: { actividadId: resumen.id, editor: 'comandos', lenguaje: 'comandos' },
        }),
        'abrir sesion',
      );
      const sesionId = (sesion.sesion as { id: number }).id;

      const envio = exigir(
        await pedir(`/api/sesiones/${sesionId}/envio`, {
          metodo: 'POST',
          token: tokenNino,
          cuerpo: {
            acciones: sim.accionesEjecutadas,
            tamanoPrograma: medida.tamano,
            estructurasUsadas: [...medida.estructuras],
            tiempoSegundos: 30,
            codigo: '',
          },
        }),
        'enviar intento',
      );

      const resultado = envio as unknown as { estrellas: number; verificado: boolean };
      const ok = resultado.estrellas === 3 && resultado.verificado;
      if (!ok) fallos += 1;
      jugadas += 1;

      console.log(
        `${ok ? 'OK  ' : 'MAL '} M${mundo}-A${resumen.numeroEnMundo} ${act.nombre}` +
          `  ->  ${resultado.estrellas} estrella(s), ${medida.tamano} fichas`,
      );
    }
  }

  console.log(`\n${jugadas} actividades jugadas contra el servidor, ${fallos} sin las 3 estrellas.`);
  if (fallos > 0) process.exitCode = 1;
}

await main();
