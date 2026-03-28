import { Mastra } from '@mastra/core';
import { MCPServer } from '@mastra/mcp';

// Tools de lectura
import { searchProducts } from './tools/search-products.js';
import { getLowStock } from './tools/low-stock.js';
import { getSalesRanking } from './tools/sales-ranking.js';
import { getSalesHistory } from './tools/sales-history.js';

// Tools de escritura
import { parseExcel } from './tools/parse-excel.js';
import { createProductsOdoo } from './tools/create-products.js';

const tools = {
  // Lectura
  searchProducts,
  getLowStock,
  getSalesRanking,
  getSalesHistory,
  // Escritura
  parseExcel,
  createProductsOdoo,
};

export const mcpServer = new MCPServer({
  id: 'olivia-products',
  name: 'Olivia Products MCP Server',
  version: '1.0.0',
  description: 'Tools para consultar productos/ventas y crear productos en Odoo 18 desde Excel',
  tools,
});

export const mastra = new Mastra({
  tools,
  mcpServers: { 'olivia-products': mcpServer },
});
