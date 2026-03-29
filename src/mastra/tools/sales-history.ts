import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo/index.js';
import { PosOrderSchema, EcomOrderSchema, PaginationSchema } from '../../lib/schemas.js';

export const getSalesHistory = createTool({
  id: 'odoo_get_sales_history',
  description:
    'Obtiene el historial de ventas de Odoo con fecha, hora y monto. Combina POS y eCommerce. Útil para analizar patrones temporales: días pico, horarios, mañana vs tarde. Las fechas están en UTC. Soporta paginación.',
  inputSchema: z.object({
    date_from: z.string().optional().describe('Fecha inicio YYYY-MM-DD'),
    date_to: z.string().optional().describe('Fecha fin YYYY-MM-DD'),
    source: z.enum(['all', 'pos', 'ecommerce']).optional().default('all').describe('Fuente: all, pos, ecommerce'),
    limit: z.number().optional().default(500).describe('Máximo de registros por fuente (default: 500)'),
    offset: z.number().optional().default(0).describe('Desde qué posición empezar (para paginación)'),
  }),
  outputSchema: z.object({
    pos_orders: z.array(PosOrderSchema),
    ecom_orders: z.array(EcomOrderSchema),
    pos_count: z.number(),
    ecom_count: z.number(),
    total_count: z.number(),
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
      const limit = input.limit ?? 500;
      const result = await odoo.getSalesHistory({
        dateFrom: input.date_from,
        dateTo: input.date_to,
        limit,
        offset: input.offset ?? 0,
        source: input.source ?? 'all',
      });

      const totalCount = result.pos_orders.length + result.ecom_orders.length;
      const hasMore = result.pos_orders.length >= limit || result.ecom_orders.length >= limit;

      return {
        pos_orders: result.pos_orders,
        ecom_orders: result.ecom_orders,
        pos_count: result.pos_orders.length,
        ecom_count: result.ecom_orders.length,
        total_count: totalCount,
        has_more: hasMore,
        next_offset: hasMore ? (input.offset ?? 0) + limit : null,
      };
    } catch (error: any) {
      return {
        pos_orders: [], ecom_orders: [],
        pos_count: 0, ecom_count: 0, total_count: 0,
        has_more: false, next_offset: null,
        error: error?.message || String(error),
      };
    }
  },
});
