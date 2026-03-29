import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

// Odoo devuelve `false` en vez de null para campos vacíos
function cleanOdooProduct(p: any) {
  return {
    ...p,
    default_code: p.default_code || null,
    barcode: p.barcode || null,
    description_sale: p.description_sale || null,
  };
}

export const searchProducts = createTool({
  id: 'search_products',
  description:
    'Busca productos existentes en Odoo por nombre, código interno o barcode. Retorna ID, nombre, precios, stock disponible, categoría, código interno y barcode.',
  inputSchema: z.object({
    query: z.string().describe('Texto de búsqueda (nombre, código o barcode del producto)'),
    limit: z.number().optional().default(20).describe('Cantidad máxima de resultados'),
  }),
  outputSchema: z.object({
    products: z.array(z.any()),
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
    const raw = await odoo.searchProducts(input.query, input.limit ?? 20);
    const products = raw.map(cleanOdooProduct);
    return { products, count: products.length };
  },
});
