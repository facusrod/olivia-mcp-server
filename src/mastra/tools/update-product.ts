import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const updateProduct = createTool({
  id: 'odoo_update_product',
  description:
    'Actualiza un producto existente en Odoo por su ID. Permite cambiar nombre, descripción, precios, código interno, barcode y categoría.',
  inputSchema: z.object({
    id: z.number().describe('ID del producto (product.template)'),
    name: z.string().optional().describe('Nuevo nombre'),
    description: z.string().optional().describe('Nueva descripción'),
    cost_price: z.number().optional().describe('Nuevo precio de costo'),
    sale_price: z.number().optional().describe('Nuevo precio de venta'),
    default_code: z.string().optional().describe('Nuevo código interno / SKU'),
    barcode: z.string().optional().describe('Nuevo código de barras'),
    categ_id: z.number().optional().describe('Nuevo ID de categoría'),
  }),
  outputSchema: z.object({
    id: z.number(),
    status: z.enum(['updated', 'error']),
    error: z.string().optional(),
  }),
  requireApproval: true,
  mcp: {
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  execute: async (input) => {
    const { id, ...values } = input;
    try {
      const odoo = getOdooClient();
      await odoo.updateProduct(id, values);
      return { id, status: 'updated' as const };
    } catch (error: any) {
      return { id, status: 'error' as const, error: error?.message || String(error) };
    }
  },
});
