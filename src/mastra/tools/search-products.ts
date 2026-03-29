import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';
import { OdooProductSchema, PaginationSchema } from '../../lib/schemas.js';

export const searchProducts = createTool({
  id: 'odoo_search_products',
  description:
    'Busca productos existentes en Odoo por nombre, código interno o barcode. Retorna ID, nombre, precios, stock, categoría, código interno y barcode. Soporta paginación.',
  inputSchema: z.object({
    query: z.string().describe('Texto de búsqueda (nombre, código o barcode)'),
    limit: z.number().optional().default(20).describe('Máximo de resultados (default: 20)'),
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
      const limit = input.limit ?? 20;
      const offset = input.offset ?? 0;
      const products = await odoo.searchProducts(input.query, limit + 1, offset);
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
