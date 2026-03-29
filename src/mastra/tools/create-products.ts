import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo/index.js';

export const createProductsOdoo = createTool({
  id: 'odoo_create_products',
  description:
    'Crea productos en Odoo 18 via XML-RPC. Soporta nombre, descripción, precios, código interno (SKU), barcode y categoría.',
  inputSchema: z.object({
    products: z.array(
      z.object({
        name: z.string().describe('Nombre del producto'),
        description: z.string().optional().describe('Descripción'),
        cost_price: z.number().optional().describe('Precio de costo'),
        sale_price: z.number().optional().describe('Precio de venta'),
        default_code: z.string().optional().describe('Código interno / SKU'),
        barcode: z.string().optional().describe('Código de barras'),
        categ_id: z.number().optional().describe('ID de categoría'),
        type: z.enum(['consu', 'product', 'service']).optional().describe('Tipo (default: consu)'),
      })
    ).describe('Lista de productos a crear'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        name: z.string(),
        odoo_id: z.number().optional(),
        status: z.enum(['created', 'error']),
        error: z.string().optional(),
      })
    ),
    total: z.number(),
    created: z.number(),
    errors: z.number(),
    error: z.string().optional(),
  }),
  requireApproval: true,
  mcp: {
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  execute: async (input) => {
    try {
      const odoo = getOdooClient();
      const results = await odoo.createProducts(input.products);
      const created = results.filter((r) => r.status === 'created').length;
      const errors = results.filter((r) => r.status === 'error').length;
      return { results, total: results.length, created, errors };
    } catch (error: any) {
      return { results: [], total: 0, created: 0, errors: 0, error: error?.message || String(error) };
    }
  },
});
