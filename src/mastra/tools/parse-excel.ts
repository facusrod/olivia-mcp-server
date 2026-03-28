import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { parseExcelBuffer } from '../../lib/xlsx-parser.js';

export const parseExcel = createTool({
  id: 'parse_excel',
  description:
    'Parsea un archivo Excel (.xlsx) con una lista de productos. El Excel debe tener columnas: Nombre, Descripción, Precio Costo, Precio Venta. Retorna los productos parseados para revisión antes de crearlos en Odoo.',
  inputSchema: z.object({
    fileBase64: z
      .string()
      .describe('Contenido del archivo .xlsx codificado en base64'),
  }),
  outputSchema: z.object({
    products: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        cost_price: z.number(),
        sale_price: z.number(),
      })
    ),
    warnings: z.array(z.string()),
    total_rows: z.number(),
    parsed_rows: z.number(),
  }),
  mcp: {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  execute: async (input) => {
    const buffer = Buffer.from(input.fileBase64, 'base64');
    const result = parseExcelBuffer(buffer);
    return result;
  },
});
