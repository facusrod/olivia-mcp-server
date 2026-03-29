import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const createProductsOdoo = createTool({
  id: 'create_products_odoo',
  description:
    'Crea productos en Odoo 18 via XML-RPC. Soporta todos los campos principales: nombre, descripción, precios, código interno (SKU), código de barras y categoría.',
  inputSchema: z.object({
    products: z
      .array(
        z.object({
          name: z.string().describe('Nombre del producto'),
          description: z.string().optional().describe('Descripción del producto'),
          cost_price: z.number().optional().describe('Precio de costo'),
          sale_price: z.number().optional().describe('Precio de venta'),
          default_code: z.string().optional().describe('Código interno / SKU / referencia interna'),
          barcode: z.string().optional().describe('Código de barras (EAN13, UPC, etc)'),
          categ_id: z.number().optional().describe('ID de categoría en Odoo'),
          type: z.enum(['consu', 'product', 'service']).optional().describe('Tipo: consu (consumible), product (almacenable), service (servicio). Default: consu'),
        })
      )
      .describe('Lista de productos a crear en Odoo'),
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
    const odoo = getOdooClient();
    const results = await odoo.createProducts(input.products);

    const created = results.filter((r) => r.status === 'created').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return { results, total: results.length, created, errors };
  },
});
