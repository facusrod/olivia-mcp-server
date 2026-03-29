import axios from 'axios';
import { Readable } from 'stream';
import { createRequire } from 'module';
import type { OdooProduct, SalesRankingItem, PosOrder, EcomOrder } from './schemas.js';

const require = createRequire(import.meta.url);
const Serializer = require('xmlrpc/lib/serializer');
const Deserializer = require('xmlrpc/lib/deserializer');

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

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
 * Esta función normaliza esos campos a null.
 */
export function cleanOdooProduct(p: Record<string, unknown>): OdooProduct {
  return {
    ...p,
    default_code: typeof p.default_code === 'string' ? p.default_code : null,
    barcode: typeof p.barcode === 'string' ? p.barcode : null,
    description_sale: typeof p.description_sale === 'string' ? p.description_sale : null,
  } as OdooProduct;
}

class OdooClient {
  private config: OdooConfig;
  private uid: number | null = null;
  private authPromise: Promise<number> | null = null;
  private cfHeaders: Record<string, string> = {};

  constructor() {
    this.config = {
      url: process.env.ODOO_URL || '',
      db: process.env.ODOO_DB || '',
      username: process.env.ODOO_USERNAME || '',
      password: process.env.ODOO_PASSWORD || '',
    };

    if (!this.config.url || !this.config.db || !this.config.username || !this.config.password) {
      throw new Error(
        'Missing required env vars: ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD. ' +
        'Set them in claude_desktop_config.json → mcpServers → env.'
      );
    }

    const cfClientId = process.env.CF_ACCESS_CLIENT_ID;
    const cfClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
    if (cfClientId && cfClientSecret) {
      this.cfHeaders = {
        'CF-Access-Client-Id': cfClientId,
        'CF-Access-Client-Secret': cfClientSecret,
      };
    }
  }

  private async callXmlRpc(path: string, method: string, params: any[]): Promise<any> {
    const xml = Serializer.serializeMethodCall(method, params);
    const url = `${this.config.url}/xmlrpc/2/${path}`;

    const response = await axios.post(url, xml, {
      headers: {
        'Content-Type': 'text/xml',
        ...this.cfHeaders,
      },
      responseType: 'text',
      timeout: 60000,
    });

    return new Promise((resolve, reject) => {
      const deserializer = new Deserializer();
      const stream = Readable.from([response.data]);
      deserializer.deserializeMethodResponse(stream, (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    if (!this.authPromise) {
      this.authPromise = this.doAuthenticate();
    }
    return this.authPromise;
  }

  private async doAuthenticate(): Promise<number> {
    try {
      const uid = await this.callXmlRpc('common', 'authenticate', [
        this.config.db,
        this.config.username,
        this.config.password,
        {},
      ]);

      if (!uid) {
        throw new Error('Credenciales inválidas');
      }

      this.uid = uid;
      return uid;
    } catch (error: any) {
      this.authPromise = null;
      throw new Error(`Autenticación con Odoo falló: ${error?.message || error}`);
    }
  }

  private async executeKw(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {}
  ): Promise<any> {
    const uid = await this.authenticate();

    try {
      return await this.callXmlRpc('object', 'execute_kw', [
        this.config.db,
        uid,
        this.config.password,
        model,
        method,
        args,
        kwargs,
      ]);
    } catch (error: any) {
      throw new Error(`Odoo ${method} falló: ${error?.message || error}`);
    }
  }

  // ========== LECTURA ==========

  private static readonly PRODUCT_FIELDS = [
    'id', 'name', 'list_price', 'standard_price', 'qty_available',
    'categ_id', 'default_code', 'barcode', 'description_sale', 'type',
  ];

  async searchProducts(query: string, limit: number = 20, offset: number = 0): Promise<OdooProduct[]> {
    const raw = await this.executeKw('product.product', 'search_read', [
      ['|', '|', ['name', 'ilike', query], ['default_code', 'ilike', query], ['barcode', 'ilike', query]],
    ], {
      fields: OdooClient.PRODUCT_FIELDS,
      limit,
      offset,
    });
    return (raw || []).map(cleanOdooProduct);
  }

  async getProductById(id: number): Promise<OdooProduct | null> {
    const products = await this.executeKw('product.product', 'search_read', [
      [['id', '=', id]],
    ], {
      fields: OdooClient.PRODUCT_FIELDS,
      limit: 1,
    });
    return products.length > 0 ? cleanOdooProduct(products[0]) : null;
  }

  async getLowStockProducts(threshold: number = 10, limit: number = 50, offset: number = 0): Promise<OdooProduct[]> {
    const raw = await this.executeKw('product.product', 'search_read', [
      [['qty_available', '<=', threshold], ['qty_available', '>', 0]],
    ], {
      fields: OdooClient.PRODUCT_FIELDS,
      limit,
      offset,
    });
    return (raw || []).map(cleanOdooProduct);
  }

  async getSalesRanking(days: number = 30, limit: number = 10, source: 'all' | 'pos' | 'ecommerce' = 'all'): Promise<SalesRankingItem[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().split('T')[0];

    const productSales: Record<number, { id: number; name: string; total_qty: number; total_revenue: number; source: string }> = {};

    if (source === 'all' || source === 'pos') {
      const posLines = await this.executeKw('pos.order.line', 'search_read', [
        [['order_id.date_order', '>=', dateStr], ['order_id.state', 'in', ['paid', 'done', 'invoiced']]],
      ], {
        fields: ['product_id', 'qty', 'price_subtotal_incl'],
      });

      for (const line of posLines || []) {
        const productId = line.product_id[0];
        const productName = line.product_id[1];
        if (!productSales[productId]) {
          productSales[productId] = { id: productId, name: productName, total_qty: 0, total_revenue: 0, source: 'pos' };
        }
        productSales[productId].total_qty += line.qty || 0;
        productSales[productId].total_revenue += line.price_subtotal_incl || 0;
      }
    }

    if (source === 'all' || source === 'ecommerce') {
      try {
        const ecomLines = await this.executeKw('sale.order.line', 'search_read', [
          [
            ['order_id.date_order', '>=', dateStr],
            ['order_id.state', 'in', ['sale', 'done']],
            ['order_id.website_id', '!=', false],
          ],
        ], {
          fields: ['product_id', 'product_uom_qty', 'price_subtotal'],
        });

        for (const line of ecomLines || []) {
          const productId = line.product_id[0];
          const productName = line.product_id[1];
          if (!productSales[productId]) {
            productSales[productId] = { id: productId, name: productName, total_qty: 0, total_revenue: 0, source: 'ecommerce' };
          } else if (productSales[productId].source === 'pos') {
            productSales[productId].source = 'both';
          }
          productSales[productId].total_qty += line.product_uom_qty || 0;
          productSales[productId].total_revenue += line.price_subtotal || 0;
        }
      } catch {
        // eCommerce module might not be installed
      }
    }

    return Object.values(productSales)
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, limit);
  }

  async getSalesHistory(options: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
    source?: 'all' | 'pos' | 'ecommerce';
  } = {}): Promise<{ pos_orders: PosOrder[]; ecom_orders: EcomOrder[] }> {
    const source = options.source || 'all';
    const limit = options.limit || 500;
    const offset = options.offset || 0;
    let posOrders: any[] = [];
    let ecomOrders: any[] = [];

    if (source === 'all' || source === 'pos') {
      const filters: any[] = [['state', 'in', ['paid', 'done', 'invoiced']]];
      if (options.dateFrom) filters.push(['date_order', '>=', options.dateFrom]);
      if (options.dateTo) filters.push(['date_order', '<=', options.dateTo]);

      posOrders = await this.executeKw('pos.order', 'search_read', [filters], {
        fields: ['id', 'name', 'date_order', 'amount_total', 'amount_tax', 'partner_id', 'pos_reference'],
        limit,
        offset,
        order: 'date_order desc',
      });
    }

    if (source === 'all' || source === 'ecommerce') {
      try {
        const filters: any[] = [['website_id', '!=', false], ['state', 'in', ['sale', 'done']]];
        if (options.dateFrom) filters.push(['date_order', '>=', options.dateFrom]);
        if (options.dateTo) filters.push(['date_order', '<=', options.dateTo]);

        ecomOrders = await this.executeKw('sale.order', 'search_read', [filters], {
          fields: ['id', 'name', 'date_order', 'amount_total', 'partner_id', 'state'],
          limit,
          offset,
          order: 'date_order desc',
        });
      } catch {
        // eCommerce module might not be installed
      }
    }

    return { pos_orders: posOrders || [], ecom_orders: ecomOrders || [] };
  }

  // ========== ESCRITURA ==========

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

    return this.executeKw('product.template', 'create', [vals]);
  }

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
  }

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

    await this.executeKw('product.template', 'write', [[id], vals]);
  }
}

// Singleton
let odooClient: OdooClient | null = null;

export function getOdooClient(): OdooClient {
  if (!odooClient) {
    odooClient = new OdooClient();
  }
  return odooClient;
}
