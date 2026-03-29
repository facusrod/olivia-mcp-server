import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';
import { OdooProductSchema, PaginationSchema } from '../../lib/schemas.js';

export const getLowStock = createTool({
  id: 'odoo_get_low_stock',
  description:
    'Obtiene productos con stock bajo en Odoo. Útil para identificar productos que necesitan reposición. Soporta paginación.',
  inputSchema: z.object({
    threshold: z.number().optional().default(10).describe('Umbral de stock bajo (default: 10)'),
    limit: z.number().optional().default(50).describe('Máximo de resultados (default: 50)'),
    offset: z.number().optional().default(0).describe('Desde qué posición empezar (para paginación)'),
  }),
  outputSchema: z.object({
    products: z.array(OdooProductSchema),
    count: z.number(),
    error: z.string().optional(),
  }).merge(PaginationSchema),
  mcp: {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  execute: async (input) => {
    try {
      const odoo = getOdooClient();
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;
      const products = await odoo.getLowStockProducts(input.threshold ?? 10, limit + 1, offset);
      const hasMore = products.length > limit;
      const result = hasMore ? products.slice(0, limit) : products;
      return {
        products: result,
        count: result.length,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
      };
    } catch (error: any) {
      return { products: [], count: 0, has_more: false, next_offset: null, error: error?.message || String(error) };
    }
  },
});
