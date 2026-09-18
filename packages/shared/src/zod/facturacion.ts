/**
 * Validacion de lo que llega del panel de administracion y del checkout.
 *
 * Los limites no son decorativos: un total de 12 cifras o 500 lineas en una
 * cotizacion es un error de tecleo o un abuso, y es mas barato pararlo aqui que
 * descubrirlo impreso.
 */
import { z } from 'zod';

import {
  DOCUMENTO_MAX,
  DOCUMENTO_MIN,
  PRECIO_MAXIMO_COP,
  PRECIO_MINIMO_COP,
  TARIFAS_IVA,
  TIPOS_DOCUMENTO,
} from '../facturacion/index.js';


const texto = (max: number) => z.string().trim().max(max);
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === '' ? undefined : v));

export const tipoDocumentoSchema = z.enum(
  TIPOS_DOCUMENTO.map((t) => t.clave) as [string, ...string[]],
);

export const lineaSchema = z.object({
  descripcion: texto(300).min(2),
  cantidad: z.number().int().min(1).max(10_000),
  valorUnitarioCop: z.number().int().min(0).max(PRECIO_MAXIMO_COP),
});

export const clienteSchema = z.object({
  nombre: texto(200).min(2),
  tipoDocumento: tipoDocumentoSchema,
  documento: z.string().trim().regex(/^[0-9A-Za-z.-]+$/, "Solo numeros, letras, punto y guion").min(DOCUMENTO_MIN).max(DOCUMENTO_MAX),
  email: z.string().trim().email().max(255).optional().or(z.literal('').transform(() => undefined)),
  direccion: textoOpcional(250),
  ciudad: textoOpcional(100),
  telefono: textoOpcional(40),
  contacto: textoOpcional(150),
});

export const emisorSchema = z.object({
  razonSocial: texto(200).min(2),
  nit: texto(40).min(3),
  direccion: texto(250).min(3),
  ciudad: texto(100).min(2),
  telefono: textoOpcional(40),
  email: z.string().trim().email().max(255),
  regimen: textoOpcional(120),
  sitioWeb: textoOpcional(200),
  notaPie: textoOpcional(1000),
});

const ivaSchema = z
  .number()
  .int()
  .refine((v) => (TARIFAS_IVA as readonly number[]).includes(v), 'Tarifa de IVA no valida');

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha con formato AAAA-MM-DD');

export const cotizacionSchema = z.object({
  cliente: clienteSchema,
  items: z.array(lineaSchema).min(1).max(30),
  descuentoCop: z.number().int().min(0).max(PRECIO_MAXIMO_COP).default(0),
  ivaPorcentaje: ivaSchema.default(0),
  validaHasta: fechaSchema,
  planId: z.number().int().positive().nullable().optional(),
  notas: textoOpcional(2000),
  condiciones: textoOpcional(2000),
});

export const facturaSchema = z.object({
  cliente: clienteSchema,
  items: z.array(lineaSchema).min(1).max(30),
  descuentoCop: z.number().int().min(0).max(PRECIO_MAXIMO_COP).default(0),
  ivaPorcentaje: ivaSchema.default(0),
  fechaVencimiento: fechaSchema.optional(),
  notas: textoOpcional(2000),
  usuarioId: z.number().int().positive().nullable().optional(),
  pagoId: z.number().int().positive().nullable().optional(),
  cotizacionId: z.number().int().positive().nullable().optional(),
});

/** Lo que el administrador puede cambiar de una tarjeta de precios. */
export const planEditableSchema = z.object({
  nombre: texto(80).min(2),
  descripcion: texto(400).min(5),
  precioCop: z.number().int().min(PRECIO_MINIMO_COP).max(PRECIO_MAXIMO_COP),
  beneficios: z.array(texto(160).min(2)).min(1).max(12),
  destacado: z.boolean(),
  orden: z.number().int().min(0).max(99),
  activo: z.boolean(),
  maxNinos: z.number().int().min(1).max(100_000).nullable(),
  vigenciaDias: z.number().int().min(1).max(1_095),
});

export const datosFacturacionSchema = z.object({
  tipoDocumento: tipoDocumentoSchema,
  documento: z.string().trim().regex(/^[0-9A-Za-z.-]+$/, "Solo numeros, letras, punto y guion").min(DOCUMENTO_MIN).max(DOCUMENTO_MAX),
  razonSocial: textoOpcional(200),
  direccion: textoOpcional(250),
  ciudad: texto(100).min(2),
  telefono: textoOpcional(40),
});

export type Cliente = z.infer<typeof clienteSchema>;
export type Emisor = z.infer<typeof emisorSchema>;
export type EntradaCotizacion = z.infer<typeof cotizacionSchema>;
export type EntradaFactura = z.infer<typeof facturaSchema>;
export type PlanEditable = z.infer<typeof planEditableSchema>;
