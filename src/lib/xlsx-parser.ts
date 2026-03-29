import * as XLSX from 'xlsx';

export interface ParsedProduct {
  name: string;
  description: string;
  cost_price: number;
  sale_price: number;
  default_code?: string;
  barcode?: string;
}

export interface ParseResult {
  products: ParsedProduct[];
  warnings: string[];
  detected_columns: Record<string, number>;
  total_rows: number;
  parsed_rows: number;
}

// Mapeo de variantes de nombres de columna a campo interno
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['nombre', 'name', 'producto', 'product', 'descripcion producto', 'nombre producto'],
  description: ['descripcion', 'description', 'detalle', 'detail', 'desc'],
  cost_price: ['precio costo', 'costo', 'cost', 'cost price', 'precio de costo', 'precio compra', 'purchase price'],
  sale_price: ['precio venta', 'venta', 'price', 'sale price', 'precio de venta', 'pvp', 'precio'],
  default_code: ['codigo', 'code', 'sku', 'referencia', 'ref', 'codigo interno', 'internal reference', 'default_code'],
  barcode: ['barcode', 'codigo de barras', 'ean', 'ean13', 'upc', 'codigo barras'],
};

function normalizeHeader(header: string): string {
  return header.toString().toLowerCase().trim().replace(/[_\-]/g, ' ');
}

function detectColumns(headers: any[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
    if (!headers[i]) continue;
    const normalized = normalizeHeader(String(headers[i]));

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized) && !(field in mapping)) {
        mapping[field] = i;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Parsea un archivo Excel (.xlsx) con lista de productos.
 * Detecta automáticamente las columnas por nombre del header.
 * Si no detecta headers, usa el orden fijo: Nombre, Descripción, Precio Costo, Precio Venta.
 */
export function parseExcelBuffer(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { products: [], warnings: ['El archivo no contiene hojas'], detected_columns: {}, total_rows: 0, parsed_rows: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 2) {
    return { products: [], warnings: ['El archivo no contiene datos (solo header o vacío)'], detected_columns: {}, total_rows: 0, parsed_rows: 0 };
  }

  const headers = rows[0];
  let columnMap = detectColumns(headers);
  const warnings: string[] = [];

  // Si no detectó la columna 'name', asumir orden fijo
  if (!('name' in columnMap)) {
    warnings.push('No se detectaron headers conocidos. Usando orden fijo: Nombre (col 1), Descripción (col 2), Precio Costo (col 3), Precio Venta (col 4)');
    columnMap = { name: 0, description: 1, cost_price: 2, sale_price: 3 };
  } else {
    const detected = Object.entries(columnMap).map(([field, idx]) => `${field}→col ${idx + 1} ("${headers[idx]}")`);
    warnings.push(`Columnas detectadas: ${detected.join(', ')}`);
  }

  const dataRows = rows.slice(1);
  const products: ParsedProduct[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    if (!row || row.length === 0) continue;

    const nameIdx = columnMap.name;
    const name = nameIdx !== undefined ? String(row[nameIdx] || '').trim() : '';

    if (!name) continue;

    const descIdx = columnMap.description;
    const costIdx = columnMap.cost_price;
    const saleIdx = columnMap.sale_price;
    const codeIdx = columnMap.default_code;
    const barcodeIdx = columnMap.barcode;

    const description = descIdx !== undefined ? String(row[descIdx] || '').trim() : '';
    const costPrice = costIdx !== undefined ? parseFloat(row[costIdx]) : 0;
    const salePrice = saleIdx !== undefined ? parseFloat(row[saleIdx]) : 0;
    const defaultCode = codeIdx !== undefined ? String(row[codeIdx] || '').trim() : undefined;
    const barcode = barcodeIdx !== undefined ? String(row[barcodeIdx] || '').trim() : undefined;

    if (costIdx !== undefined && (isNaN(costPrice) || costPrice < 0)) {
      warnings.push(`Fila ${rowNum} (${name}): precio costo inválido "${row[costIdx]}", se usa 0`);
    }
    if (saleIdx !== undefined && (isNaN(salePrice) || salePrice < 0)) {
      warnings.push(`Fila ${rowNum} (${name}): precio venta inválido "${row[saleIdx]}", se usa 0`);
    }

    const product: ParsedProduct = {
      name,
      description,
      cost_price: isNaN(costPrice) || costPrice < 0 ? 0 : costPrice,
      sale_price: isNaN(salePrice) || salePrice < 0 ? 0 : salePrice,
    };

    if (defaultCode) product.default_code = defaultCode;
    if (barcode) product.barcode = barcode;

    products.push(product);
  }

  return {
    products,
    warnings,
    detected_columns: columnMap,
    total_rows: dataRows.length,
    parsed_rows: products.length,
  };
}
