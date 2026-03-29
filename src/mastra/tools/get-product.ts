import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo/index.js';
import { OdooProductSchema } from '../../lib/schemas.js';

export const getProductById = createTool({
  id: 'odoo_get_product_by_id',
  description:
    'Obtiene un producto específico de Odoo por su ID. Retorna todos los campos del producto.',
  inputSchema: z.object({
    id: z.number().describe('ID del producto en Odoo'),
  }),
  outputSchema: z.object({
    product: OdooProductSchema.nullable(),
    found: z.boolean(),
    error: z.string().optional(),
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
    try {
      const odoo = getOdooClient();
      const product = await odoo.getProductById(input.id);
      return { product, found: product !== null };
    } catch (error: any) {
      return { product: null, found: false, error: error?.message || String(error) };
    }
  },
});
