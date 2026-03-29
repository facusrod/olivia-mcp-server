import { z } from 'zod';

// Odoo devuelve [id, name] para many2one fields, o false si vacío
const OdooMany2One = z.union([z.tuple([z.number(), z.string()]), z.literal(false)]);

export const OdooProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  list_price: z.number(),
  standard_price: z.number(),
  qty_available: z.number(),
  categ_id: OdooMany2One,
  default_code: z.string().nullable(),
  barcode: z.string().nullable(),
  description_sale: z.string().nullable(),
  type: z.string(),
});

export const PosOrderSchema = z.object({
  id: z.number(),
  name: z.string(),
  date_order: z.string(),
  amount_total: z.number(),
  amount_tax: z.number(),
  partner_id: OdooMany2One,
  pos_reference: z.union([z.string(), z.literal(false)]),
});

export const EcomOrderSchema = z.object({
  id: z.number(),
  name: z.string(),
  date_order: z.string(),
  amount_total: z.number(),
  partner_id: OdooMany2One,
  state: z.string(),
});

export const SalesRankingItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  total_qty: z.number(),
  total_revenue: z.number(),
  source: z.string(),
});

export const PaginationSchema = z.object({
  has_more: z.boolean(),
  next_offset: z.number().nullable(),
});

export type OdooProduct = z.infer<typeof OdooProductSchema>;
