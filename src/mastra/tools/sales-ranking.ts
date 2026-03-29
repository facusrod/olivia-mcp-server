import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo/index.js';
import { SalesRankingItemSchema } from '../../lib/schemas.js';

export const getSalesRanking = createTool({
  id: 'odoo_get_sales_ranking',
  description:
    'Obtiene el ranking de productos más vendidos en Odoo de los últimos N días. Combina POS y eCommerce. Muestra cantidad vendida, ingresos y fuente (pos, ecommerce, both).',
  inputSchema: z.object({
    days: z.number().optional().default(30).describe('Período en días (default: 30)'),
    limit: z.number().optional().default(10).describe('Cantidad en el ranking (default: 10)'),
    source: z.enum(['all', 'pos', 'ecommerce']).optional().default('all').describe('Fuente: all, pos, ecommerce'),
  }),
  outputSchema: z.object({
    ranking: z.array(SalesRankingItemSchema),
    period_days: z.number(),
    count: z.number(),
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
      const days = input.days ?? 30;
      const ranking = await odoo.getSalesRanking(days, input.limit ?? 10, input.source ?? 'all');
      return { ranking, period_days: days, count: ranking.length };
    } catch (error: any) {
      return { ranking: [], period_days: input.days ?? 30, count: 0, error: error?.message || String(error) };
    }
  },
});
