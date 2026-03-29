import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const getSalesRanking = createTool({
  id: 'get_sales_ranking',
  description:
    'Obtiene el ranking de productos más vendidos en Odoo de los últimos N días. Combina ventas POS y eCommerce. Muestra cantidad vendida, ingresos y fuente (pos, ecommerce, both).',
  inputSchema: z.object({
    days: z.number().optional().default(30).describe('Período en días para analizar (default: 30)'),
    limit: z.number().optional().default(10).describe('Cantidad de productos en el ranking (default: 10)'),
    source: z.enum(['all', 'pos', 'ecommerce']).optional().default('all').describe('Fuente de ventas: all (POS + eCommerce), pos, ecommerce'),
  }),
  outputSchema: z.object({
    ranking: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        total_qty: z.number(),
        total_revenue: z.number(),
        source: z.string(),
      })
    ),
    period_days: z.number(),
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
    const days = input.days ?? 30;
    const ranking = await odoo.getSalesRanking(days, input.limit ?? 10, input.source ?? 'all');
    return { ranking, period_days: days, count: ranking.length };
  },
});
