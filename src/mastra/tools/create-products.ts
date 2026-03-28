import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const createProductsOdoo = createTool({
  id: 'create_products_odoo',
  description:
    'Crea productos en Odoo 18 via XML-RPC. Recibe un array de productos con nombre, descripción, precio costo y precio venta. Retorna el resultado de cada creación con el ID de Odoo o el error.',
  inputSchema: z.object({
    products: z
      .array(
        z.object({
          name: z.string().describe('Nombre del producto'),
          description: z.string().describe('Descripción del producto'),
          cost_price: z.number().describe('Precio de costo'),
          sale_price: z.number().describe('Precio de venta'),
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

    return {
      results,
      total: results.length,
      created,
      errors,
    };
  },
});
