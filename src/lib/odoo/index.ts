import { OdooBase } from './base.js';
import { createProductService } from './products.js';
import { createSalesService } from './sales.js';
import { createInventoryService } from './inventory.js';

export type { ProductInput, CreateProductResult } from './products.js';
export { cleanOdooProduct } from './products.js';

/**
 * Cliente Odoo que compone los servicios de dominio.
 * Cada servicio comparte la misma conexión XML-RPC.
 */
function createOdooClient() {
  const base = new OdooBase();
  const products = createProductService(base.executeKw);
  const sales = createSalesService(base.executeKw);
  const inventory = createInventoryService(base.executeKw);

  return {
    // Productos
    searchProducts: products.searchProducts,
    getProductById: products.getProductById,
    createProduct: products.createProduct,
    createProducts: products.createProducts,
    updateProduct: products.updateProduct,
    // Ventas
    getSalesRanking: sales.getSalesRanking,
    getSalesHistory: sales.getSalesHistory,
    // Inventario
    getLowStockProducts: inventory.getLowStockProducts,
    getExpiringProducts: inventory.getExpiringProducts,
  };
}

// Singleton
let odooClient: ReturnType<typeof createOdooClient> | null = null;

export function getOdooClient() {
  if (!odooClient) {
    odooClient = createOdooClient();
  }
  return odooClient;
}
