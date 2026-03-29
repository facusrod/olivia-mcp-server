import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';
import { ExpiringLotSchema, PaginationSchema } from '../../lib/schemas.js';

export const getExpiringProducts = createTool({
  id: 'odoo_get_expiring_products',
  description:
    'Obtiene productos próximos a vencer en Odoo consultando lotes (stock.lot) con fecha de vencimiento. ' +
    'Requiere que el módulo de fechas de vencimiento esté habilitado en Odoo (Inventario → Configuración → Trazabilidad → Fechas de vencimiento). ' +
    'Retorna lote, producto, cantidad en stock, y todas las fechas: vencimiento, best before, remoción y alerta. ' +
    'Las fechas están en UTC. Soporta paginación.',
  inputSchema: z.object({
    days: z.number().optional().default(30).describe('Días hacia adelante para buscar vencimientos (default: 30)'),
    limit: z.number().optional().default(50).describe('Máximo de resultados (default: 50)'),
    offset: z.number().optional().default(0).describe('Desde qué posición empezar (para paginación)'),
  }),
  outputSchema: z.object({
    lots: z.array(ExpiringLotSchema),
    count: z.number(),
    days_ahead: z.number(),
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
      const days = input.days ?? 30;
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;
      const lots = await odoo.getExpiringProducts({ days, limit: limit + 1, offset });
      const hasMore = lots.length > limit;
      const result = hasMore ? lots.slice(0, limit) : lots;
      return {
        lots: result,
        count: result.length,
        days_ahead: days,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
      };
    } catch (error: any) {
      return {
        lots: [], count: 0, days_ahead: input.days ?? 30,
        has_more: false, next_offset: null,
        error: error?.message || String(error),
      };
    }
  },
});
