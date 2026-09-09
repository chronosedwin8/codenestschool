/**
 * Esquemas zod del formato de actividad v3.
 *
 * Es la puerta de entrada de todo el contenido: `validate-content.ts` los usa
 * para verificar los 30 JSON de mundos antes de sembrar, y el backend los
 * reutiliza para validar cuerpos de peticion relacionados con actividades.
 */
import { z } from 'zod';

import { GRUPO_EDAD } from '../types/age-group.js';
import { LENGUAJE_CODIGO, TIPO_EDITOR } from '../types/editor.js';
import {
  ACTIVIDADES_POR_MUNDO,
  TIPO_ACTIVIDAD,
  TOTAL_MUNDOS,
  type PasoPrograma,
} from '../types/activity.js';

export const grupoEdadSchema = z.enum([
  GRUPO_EDAD.exploradores,
  GRUPO_EDAD.creadores,
  GRUPO_EDAD.hackers,
]);

export const tipoEditorSchema = z.enum([
  TIPO_EDITOR.comandos,
  TIPO_EDITOR.bloques,
  TIPO_EDITOR.texto,
]);

export const lenguajeSchema = z.enum([
  LENGUAJE_CODIGO.comandos,
  LENGUAJE_CODIGO.javascript,
  LENGUAJE_CODIGO.python,
]);

export const tipoActividadSchema = z.enum([
  TIPO_ACTIVIDAD.recorrido,
  TIPO_ACTIVIDAD.recoleccion,
  TIPO_ACTIVIDAD.debug,
  TIPO_ACTIVIDAD.integrador,
  TIPO_ACTIVIDAD.jefe,
]);

export const direccionSchema = z.enum(['arriba', 'abajo', 'izquierda', 'derecha']);

export const colorCasillaSchema = z.enum([
  'rojo',
  'azul',
  'verde',
  'amarillo',
  'magenta',
  'naranja',
]);

export const tileSchema = z.object({
  t: z.enum(['camino', 'vacio', 'pared', 'agujero', 'charco', 'hielo', 'viento', 'meta']),
  color: colorCasillaSchema.optional(),
  dir: direccionSchema.optional(),
});

export const gridSchema = z
  .object({
    cols: z.number().int().min(2).max(24),
    rows: z.number().int().min(2).max(24),
    tiles: z.array(z.array(tileSchema)),
  })
  .superRefine((grid, ctx) => {
    if (grid.tiles.length !== grid.rows) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `tiles tiene ${grid.tiles.length} filas pero rows dice ${grid.rows}`,
      });
    }
    grid.tiles.forEach((fila, i) => {
      if (fila.length !== grid.cols) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `la fila ${i} tiene ${fila.length} casillas pero cols dice ${grid.cols}`,
        });
      }
    });
  });

export const celdaSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

export const spawnSchema = celdaSchema.extend({ dir: direccionSchema });

export const itemSchema = celdaSchema.extend({
  id: z.string().min(1),
  tipo: z.enum(['estrella', 'moneda', 'gema', 'llave', 'bateria', 'pieza']),
  color: colorCasillaSchema.optional(),
});

export const actorSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(['rodador', 'enemigo', 'dron']),
  ruta: z.array(z.tuple([z.number().int(), z.number().int()])).min(2),
  periodo: z.number().int().min(1),
});

export const objetivoSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum([
    'alcanzar_celda',
    'recoger_item',
    'recoger_todos',
    'activar_palanca',
    'evitar_choque',
    'orden_recoleccion',
  ]),
  x: z.number().int().min(0).optional(),
  y: z.number().int().min(0).optional(),
  itemId: z.string().optional(),
  orden: z.array(z.string()).optional(),
  obligatorio: z.boolean(),
});

export const criterioEstrellaSchema = z.object({
  objetivos: z.array(z.string()),
  maxFichas: z.number().int().min(1).optional(),
  maxInstrucciones: z.number().int().min(1).optional(),
  tiempoMaxSeg: z.number().int().min(1).optional(),
  requiereEstructuras: z.array(z.string()).optional(),
});

export const criteriosEstrellaSchema = z.object({
  '1': criterioEstrellaSchema,
  '2': criterioEstrellaSchema,
  '3': criterioEstrellaSchema,
});

/**
 * Esquema recursivo de un paso de programa.
 *
 * Se anota con el tipo real de `PasoPrograma` (y no con una forma inferida) para
 * que zod no deduzca `unknown[]` en las ramas anidadas: sin la anotacion, el
 * contenido validado no encajaria con el tipo que consume el resto del codigo.
 */
export const pasoProgramaSchema: z.ZodType<PasoPrograma> = z.lazy(() =>
  z.object({
    cmd: z.string().min(1),
    veces: z.number().int().min(1).max(20).optional(),
    hijos: z.array(pasoProgramaSchema).optional(),
    sino: z.array(pasoProgramaSchema).optional(),
    color: colorCasillaSchema.optional(),
    nombre: z.string().max(40).optional(),
  }),
);

export const audioActividadSchema = z.object({
  instruccion: z.string().min(1),
  exito: z.string().min(1),
  pistas: z.array(z.string()),
});

export const activityConfigSchema = z.object({
  version: z.literal(3),
  grupo: grupoEdadSchema,
  editor: tipoEditorSchema,
  lenguajes: z.array(lenguajeSchema).min(1),
  modoMovimiento: z.enum(['rodar', 'paso']),
  grid: gridSchema,
  spawn: spawnSchema,
  items: z.array(itemSchema),
  actores: z.array(actorSchema).optional(),
  comandosPermitidos: z.array(z.string()).min(1),
  bloquesDisponibles: z.array(z.string()),
  codigoInicial: z.record(lenguajeSchema, z.string()).optional(),
  programaPrefijado: z.array(pasoProgramaSchema).optional(),
  objetivos: z.array(objetivoSchema).min(1),
  criteriosEstrella: criteriosEstrellaSchema,
  audio: audioActividadSchema,
  demoAnimada: z.string().optional(),
  recompensa: z.object({
    monedas: z.number().int().min(0).max(500),
    gemas: z.number().int().min(0).max(10).optional(),
  }),
  topeEjecucion: z.number().int().min(100).max(1_000_000),
});

export const solucionReferenciaSchema = z
  .object({
    comandos: z.array(pasoProgramaSchema).optional(),
    javascript: z.string().optional(),
    python: z.string().optional(),
  })
  .refine((s) => Boolean(s.comandos ?? s.javascript ?? s.python), {
    message: 'La solucion de referencia debe traer comandos, javascript o python',
  });

/** El texto narrado no admite plantillas: el audio esta pre-renderizado. */
const textoNarrable = z
  .string()
  .min(3)
  .max(600)
  .refine((t) => !t.includes('{') && !t.includes('}'), {
    message: 'El texto narrado no puede contener {placeholders}: el audio es pre-renderizado',
  });

export const activityDefinitionSchema = z
  .object({
    numeroEnMundo: z.number().int().min(1).max(ACTIVIDADES_POR_MUNDO),
    slug: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9-]+$/, 'El slug solo admite minusculas, digitos y guiones'),
    nombre: z.string().min(3).max(120),
    tipo: tipoActividadSchema,
    dificultad: z.number().int().min(1).max(5),
    instruccionTexto: textoNarrable,
    exitoTexto: textoNarrable,
    pistas: z.array(textoNarrable).max(4),
    config: activityConfigSchema,
    solucionReferencia: solucionReferenciaSchema,
  })
  .superRefine((act, ctx) => {
    // Los objetivos citados en los criterios deben existir en la actividad.
    const ids = new Set(act.config.objetivos.map((o) => o.id));
    for (const nivel of ['1', '2', '3'] as const) {
      for (const objId of act.config.criteriosEstrella[nivel].objetivos) {
        if (!ids.has(objId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['config', 'criteriosEstrella', nivel],
            message: `El criterio de ${nivel} estrella(s) cita el objetivo "${objId}", que no existe`,
          });
        }
      }
    }
    // Debe haber una pista por clave de audio de pista y viceversa.
    if (act.pistas.length !== act.config.audio.pistas.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config', 'audio', 'pistas'],
        message: `Hay ${act.pistas.length} pistas pero ${act.config.audio.pistas.length} claves de audio`,
      });
    }
    // El editor de texto exige solucion en el lenguaje que ofrece.
    if (act.config.editor === TIPO_EDITOR.texto && !act.solucionReferencia.javascript) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['solucionReferencia', 'javascript'],
        message: 'Las actividades de texto necesitan solucion de referencia en JavaScript',
      });
    }
    if (act.config.editor === TIPO_EDITOR.comandos && !act.solucionReferencia.comandos) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['solucionReferencia', 'comandos'],
        message: 'Las actividades de fichas necesitan solucion de referencia en comandos',
      });
    }
  });

export const worldContentFileSchema = z
  .object({
    mundo: z.number().int().min(1).max(TOTAL_MUNDOS),
    slug: z.string().min(3),
    nombre: z.string().min(3),
    introTexto: textoNarrable,
    actividades: z.array(activityDefinitionSchema),
  })
  .superRefine((file, ctx) => {
    const vistos = new Set<number>();
    for (const act of file.actividades) {
      if (vistos.has(act.numeroEnMundo)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `La actividad ${act.numeroEnMundo} esta duplicada en el mundo ${file.mundo}`,
        });
      }
      vistos.add(act.numeroEnMundo);
    }
  });

export type ActivityConfigInput = z.infer<typeof activityConfigSchema>;
export type ActivityDefinitionInput = z.infer<typeof activityDefinitionSchema>;
export type WorldContentFileInput = z.infer<typeof worldContentFileSchema>;
