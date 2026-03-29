import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const getProductById = createTool({
  id: 'get_product_by_id',
  description:
    'Obtiene un producto específico de Odoo por su ID. Retorna todos los campos: nombre, precios, stock, categoría, código interno y barcode.',
  inputSchema: z.object({
    id: z.number().describe('ID del producto en Odoo'),
  }),
  outputSchema: z.object({
    product: z.any().nullable(),
    found: z.boolean(),
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
    const product = await odoo.getProductById(input.id);
    return { product, found: product !== null };
  },
});
