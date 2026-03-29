import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { parseExcelBuffer } from '../../lib/xlsx-parser.js';

export const parseExcel = createTool({
  id: 'parse_excel',
  description:
    'Parsea un archivo Excel (.xlsx) con una lista de productos. Detecta automáticamente las columnas por nombre del header (soporta español e inglés, variantes como "Precio Costo", "Cost Price", "SKU", "Codigo", etc). Si no detecta headers, usa orden fijo. Retorna productos con nombre, descripción, precios, código interno y barcode.',
  inputSchema: z.object({
    fileBase64: z.string().describe('Contenido del archivo .xlsx codificado en base64'),
  }),
  outputSchema: z.object({
    products: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        cost_price: z.number(),
        sale_price: z.number(),
        default_code: z.string().optional(),
        barcode: z.string().optional(),
      })
    ),
    warnings: z.array(z.string()),
    detected_columns: z.record(z.number()),
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
    return parseExcelBuffer(buffer);
  },
});
