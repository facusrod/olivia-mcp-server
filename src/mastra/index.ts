import { createRequire } from 'module';
import { Mastra } from '@mastra/core';
import { MCPServer } from '@mastra/mcp';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

// Tools de lectura
import { searchProducts } from './tools/search-products.js';
import { getProductById } from './tools/get-product.js';
import { getLowStock } from './tools/low-stock.js';
import { getSalesRanking } from './tools/sales-ranking.js';
import { getSalesHistory } from './tools/sales-history.js';

// Tools de escritura
import { parseExcel } from './tools/parse-excel.js';
import { createProductsOdoo } from './tools/create-products.js';
import { updateProduct } from './tools/update-product.js';

const tools = {
  // Lectura
  searchProducts,
  getProductById,
  getLowStock,
  getSalesRanking,
  getSalesHistory,
  // Parseo
  parseExcel,
  // Escritura
  createProductsOdoo,
  updateProduct,
};

export const mcpServer = new MCPServer({
  id: 'odoo-mcp-server',
  name: 'Olivia Products MCP Server',
  version,
  description: 'Tools para consultar productos/ventas (POS + eCommerce) y crear/actualizar productos en Odoo 18',
  tools,
});

export const mastra = new Mastra({
  tools,
  mcpServers: { 'odoo-mcp-server': mcpServer },
});
