import * as XLSX from 'xlsx';

export interface ParsedProduct {
  name: string;
  description: string;
  cost_price: number;
  sale_price: number;
}

export interface ParseResult {
  products: ParsedProduct[];
  warnings: string[];
  total_rows: number;
  parsed_rows: number;
}

/**
 * Parsea un archivo Excel (.xlsx) con formato fijo de productos.
 * Espera columnas: Nombre, Descripción, Precio Costo, Precio Venta
 * (en ese orden, la primera fila es el header).
 */
export function parseExcelBuffer(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { products: [], warnings: ['El archivo no contiene hojas'], total_rows: 0, parsed_rows: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 2) {
    return { products: [], warnings: ['El archivo no contiene datos (solo header o vacío)'], total_rows: 0, parsed_rows: 0 };
  }

  // Saltear header (primera fila)
  const dataRows = rows.slice(1);
  const products: ParsedProduct[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2; // +2 porque fila 1 es header y arrays empiezan en 0

    // Saltar filas vacías
    if (!row || row.length === 0 || !row[0]) {
      continue;
    }

    const name = String(row[0] || '').trim();
    const description = String(row[1] || '').trim();
    const costPrice = parseFloat(row[2]);
    const salePrice = parseFloat(row[3]);

    if (!name) {
      warnings.push(`Fila ${rowNum}: nombre vacío, se omite`);
      continue;
    }

    if (isNaN(costPrice) || costPrice < 0) {
      warnings.push(`Fila ${rowNum} (${name}): precio costo inválido "${row[2]}", se usa 0`);
    }

    if (isNaN(salePrice) || salePrice < 0) {
      warnings.push(`Fila ${rowNum} (${name}): precio venta inválido "${row[3]}", se usa 0`);
    }

    products.push({
      name,
      description,
      cost_price: isNaN(costPrice) || costPrice < 0 ? 0 : costPrice,
      sale_price: isNaN(salePrice) || salePrice < 0 ? 0 : salePrice,
    });
  }

  return {
    products,
    warnings,
    total_rows: dataRows.length,
    parsed_rows: products.length,
  };
}
