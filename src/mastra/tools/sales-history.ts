import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getOdooClient } from '../../lib/odoo-client.js';

export const getSalesHistory = createTool({
  id: 'get_sales_history',
  description:
    'Obtiene el historial de ventas POS de Odoo con fecha, hora y monto de cada orden. Útil para analizar patrones temporales: qué días se vende más, horarios pico, comparar mañana vs tarde, días de semana vs fines de semana, etc. Las fechas están en UTC.',
  inputSchema: z.object({
    date_from: z
      .string()
      .optional()
      .describe('Fecha inicio en formato YYYY-MM-DD (ej: "2026-03-01")'),
    date_to: z
      .string()
      .optional()
      .describe('Fecha fin en formato YYYY-MM-DD (ej: "2026-03-28")'),
    include_detail: z
      .boolean()
      .optional()
      .default(false)
      .describe('Si es true, incluye el detalle por producto de cada venta (más datos pero más lento)'),
    limit: z
      .number()
      .optional()
      .default(500)
      .describe('Cantidad máxima de registros (default: 500)'),
  }),
  outputSchema: z.object({
    orders: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        date_order: z.string(),
        amount_total: z.number(),
        amount_tax: z.number(),
        partner_id: z.any(),
        session_id: z.any(),
        pos_reference: z.any(),
      })
    ),
    detail_lines: z
      .array(
        z.object({
          order_id: z.any(),
          product_id: z.any(),
          qty: z.number(),
          price_subtotal_incl: z.number(),
          create_date: z.string(),
        })
      )
      .optional(),
    count: z.number(),
    detail_count: z.number().optional(),
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
    const queryOptions = {
      dateFrom: input.date_from,
      dateTo: input.date_to,
      limit: input.limit ?? 500,
    };

    const orders = await odoo.getSalesHistory(queryOptions);

    let detailLines: any[] | undefined;
    if (input.include_detail) {
      detailLines = await odoo.getSalesDetailHistory(queryOptions);
    }

    return {
      orders,
      count: orders.length,
      ...(detailLines
        ? { detail_lines: detailLines, detail_count: detailLines.length }
        : {}),
    };
  },
});
