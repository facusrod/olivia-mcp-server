import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const searchProducts = createTool({
  id: 'search_products',
  description:
    'Busca productos existentes en Odoo por nombre o código interno. Retorna nombre, precios, stock disponible y categoría.',
  inputSchema: z.object({
    query: z.string().describe('Texto de búsqueda (nombre o código del producto)'),
    limit: z.number().optional().default(20).describe('Cantidad máxima de resultados'),
  }),
  outputSchema: z.object({
    products: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        list_price: z.number(),
        standard_price: z.number(),
        qty_available: z.number(),
        categ_id: z.array(z.any()),
        default_code: z.string().nullable(),
        barcode: z.string().nullable(),
      })
    ),
    count: z.number(),
  }),
  mcp: {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  execute: async (input) => {
    const odoo = getOdooClient();
    const products = await odoo.searchProducts(input.query, input.limit ?? 20);
    return { products, count: products.length };
  },
});
