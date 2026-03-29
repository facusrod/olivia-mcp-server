import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const getSalesHistory = createTool({
  id: 'get_sales_history',
  description:
    'Obtiene el historial de ventas de Odoo con fecha, hora y monto de cada orden. Combina POS y eCommerce. Útil para analizar patrones temporales: qué días se vende más, horarios pico, comparar mañana vs tarde, etc. Las fechas están en UTC.',
  inputSchema: z.object({
    date_from: z.string().optional().describe('Fecha inicio YYYY-MM-DD'),
    date_to: z.string().optional().describe('Fecha fin YYYY-MM-DD'),
    source: z.enum(['all', 'pos', 'ecommerce']).optional().default('all').describe('Fuente: all, pos, ecommerce'),
    limit: z.number().optional().default(500).describe('Cantidad máxima de registros por fuente (default: 500)'),
  }),
  outputSchema: z.object({
    pos_orders: z.array(z.any()),
    ecom_orders: z.array(z.any()),
    pos_count: z.number(),
    ecom_count: z.number(),
    total_count: z.number(),
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
    const result = await odoo.getSalesHistory({
      dateFrom: input.date_from,
      dateTo: input.date_to,
      limit: input.limit ?? 500,
      source: input.source ?? 'all',
    });

    return {
      pos_orders: result.pos_orders,
      ecom_orders: result.ecom_orders,
      pos_count: result.pos_orders.length,
      ecom_count: result.ecom_orders.length,
      total_count: result.pos_orders.length + result.ecom_orders.length,
    };
  },
});
