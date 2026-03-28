import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const getLowStock = createTool({
  id: 'get_low_stock',
  description:
    'Obtiene productos con stock bajo en Odoo. Útil para identificar productos que necesitan reposición.',
  inputSchema: z.object({
    threshold: z.number().optional().default(10).describe('Umbral de stock bajo (default: 10 unidades)'),
  }),
  outputSchema: z.object({
    products: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        list_price: z.number(),
        qty_available: z.number(),
        categ_id: z.array(z.any()),
        default_code: z.string().nullable(),
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
    const products = await odoo.getLowStockProducts(input.threshold ?? 10);
    return { products, count: products.length };
  },
});
