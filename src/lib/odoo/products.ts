import type { OdooProduct } from '../schemas.js';
import type { ExecuteKw } from './base.js';

export interface ProductInput {
  name: string;
  description?: string;
  cost_price?: number;
  sale_price?: number;
  default_code?: string;
  barcode?: string;
  categ_id?: number;
  type?: string;
  sale_ok?: boolean;
  purchase_ok?: boolean;
}

export interface CreateProductResult {
  name: string;
  odoo_id?: number;
  status: 'created' | 'error';
  error?: string;
}

/**
 * Odoo devuelve `false` en vez de null para campos vacíos.
 * Normaliza esos campos a null.
 */
export function cleanOdooProduct(p: Record<string, unknown>): OdooProduct {
  return {
    ...p,
    default_code: typeof p.default_code === 'string' ? p.default_code : null,
    barcode: typeof p.barcode === 'string' ? p.barcode : null,
    description_sale: typeof p.description_sale === 'string' ? p.description_sale : null,
  } as OdooProduct;
}

const PRODUCT_FIELDS = [
  'id', 'name', 'list_price', 'standard_price', 'qty_available',
  'categ_id', 'default_code', 'barcode', 'description_sale', 'type',
];

export function createProductService(executeKw: ExecuteKw) {
  return {
    async searchProducts(query: string, limit: number = 20, offset: number = 0): Promise<OdooProduct[]> {
      const raw = await executeKw('product.product', 'search_read', [
        ['|', '|', ['name', 'ilike', query], ['default_code', 'ilike', query], ['barcode', 'ilike', query]],
      ], { fields: PRODUCT_FIELDS, limit, offset });
      return (raw || []).map(cleanOdooProduct);
    },

    async getProductById(id: number): Promise<OdooProduct | null> {
      const products = await executeKw('product.product', 'search_read', [
        [['id', '=', id]],
      ], { fields: PRODUCT_FIELDS, limit: 1 });
      return products.length > 0 ? cleanOdooProduct(products[0]) : null;
    },

    async createProduct(product: ProductInput): Promise<number> {
      const vals: Record<string, any> = {
        name: product.name,
        type: product.type || 'consu',
        sale_ok: product.sale_ok ?? true,
        purchase_ok: product.purchase_ok ?? true,
      };
      if (product.description) vals.description_sale = product.description;
      if (product.cost_price !== undefined) vals.standard_price = product.cost_price;
      if (product.sale_price !== undefined) vals.list_price = product.sale_price;
      if (product.default_code) vals.default_code = product.default_code;
      if (product.barcode) vals.barcode = product.barcode;
      if (product.categ_id) vals.categ_id = product.categ_id;

      return executeKw('product.template', 'create', [vals]);
    },

    async createProducts(products: ProductInput[]): Promise<CreateProductResult[]> {
      const results: CreateProductResult[] = [];
      for (const product of products) {
        try {
          const odooId = await this.createProduct(product);
          results.push({ name: product.name, odoo_id: odooId, status: 'created' });
        } catch (error: any) {
          results.push({ name: product.name, status: 'error', error: error?.message || String(error) });
        }
      }
      return results;
    },

    async updateProduct(id: number, values: Partial<ProductInput>): Promise<void> {
      const vals: Record<string, any> = {};
      if (values.name) vals.name = values.name;
      if (values.description) vals.description_sale = values.description;
      if (values.cost_price !== undefined) vals.standard_price = values.cost_price;
      if (values.sale_price !== undefined) vals.list_price = values.sale_price;
      if (values.default_code) vals.default_code = values.default_code;
      if (values.barcode) vals.barcode = values.barcode;
      if (values.categ_id) vals.categ_id = values.categ_id;
      if (values.type) vals.type = values.type;

      await executeKw('product.template', 'write', [[id], vals]);
    },
  };
}
