import axios from 'axios';
import { Readable } from 'stream';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Serializer = require('xmlrpc/lib/serializer');
const Deserializer = require('xmlrpc/lib/deserializer');

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

export interface CreateProductResult {
  name: string;
  odoo_id?: number;
  status: 'created' | 'error';
  error?: string;
}

class OdooClient {
  private config: OdooConfig;
  private uid: number | null = null;
  private authPromise: Promise<number> | null = null;
  private cfHeaders: Record<string, string> = {};

  constructor() {
    this.config = {
      url: process.env.ODOO_URL || 'http://localhost:8069',
      db: process.env.ODOO_DB || '',
      username: process.env.ODOO_USERNAME || '',
      password: process.env.ODOO_PASSWORD || '',
    };

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

  /**
   * Busca productos por nombre o código interno.
   */
  async searchProducts(query: string, limit: number = 20): Promise<any[]> {
    return this.executeKw('product.product', 'search_read', [
      ['|', ['name', 'ilike', query], ['default_code', 'ilike', query]],
    ], {
      fields: ['id', 'name', 'list_price', 'standard_price', 'qty_available', 'categ_id', 'default_code', 'barcode'],
      limit,
    });
  }

  /**
   * Obtiene productos con stock bajo.
   */
  async getLowStockProducts(threshold: number = 10): Promise<any[]> {
    return this.executeKw('product.product', 'search_read', [
      [['qty_available', '<=', threshold], ['qty_available', '>', 0]],
    ], {
      fields: ['id', 'name', 'list_price', 'qty_available', 'categ_id', 'default_code'],
      limit: 50,
    });
  }

  /**
   * Obtiene el ranking de ventas (top sellers) de los últimos N días via pos.order.line.
   */
  async getSalesRanking(days: number = 30, limit: number = 10): Promise<any[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().split('T')[0];

    const orderLines = await this.executeKw('pos.order.line', 'search_read', [
      [['order_id.date_order', '>=', dateStr], ['order_id.state', 'in', ['paid', 'done', 'invoiced']]],
    ], {
      fields: ['product_id', 'qty', 'price_subtotal_incl'],
    });

    if (!orderLines || orderLines.length === 0) return [];

    const productSales: Record<number, { id: number; name: string; total_qty: number; total_revenue: number }> = {};

    for (const line of orderLines) {
      const productId = line.product_id[0];
      const productName = line.product_id[1];
      if (!productSales[productId]) {
        productSales[productId] = { id: productId, name: productName, total_qty: 0, total_revenue: 0 };
      }
      productSales[productId].total_qty += line.qty || 0;
      productSales[productId].total_revenue += line.price_subtotal_incl || 0;
    }

    return Object.values(productSales)
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, limit);
  }

  /**
   * Obtiene el historial de ventas POS con fecha/hora y monto.
   * Permite a Claude analizar patrones temporales (día de semana, horario, etc).
   */
  async getSalesHistory(options: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const filters: any[] = [
      ['state', 'in', ['paid', 'done', 'invoiced']],
    ];

    if (options.dateFrom) {
      filters.push(['date_order', '>=', options.dateFrom]);
    }
    if (options.dateTo) {
      filters.push(['date_order', '<=', options.dateTo]);
    }

    const orders = await this.executeKw('pos.order', 'search_read', [filters], {
      fields: ['id', 'name', 'date_order', 'amount_total', 'amount_tax', 'partner_id', 'session_id', 'pos_reference'],
      limit: options.limit || 500,
      order: 'date_order desc',
    });

    return orders;
  }

  /**
   * Obtiene el detalle de líneas de órdenes POS con fecha de la orden.
   * Incluye producto, cantidad, precio y fecha para análisis granular.
   */
  async getSalesDetailHistory(options: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const filters: any[] = [
      ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
    ];

    if (options.dateFrom) {
      filters.push(['order_id.date_order', '>=', options.dateFrom]);
    }
    if (options.dateTo) {
      filters.push(['order_id.date_order', '<=', options.dateTo]);
    }

    const lines = await this.executeKw('pos.order.line', 'search_read', [filters], {
      fields: ['order_id', 'product_id', 'qty', 'price_subtotal_incl', 'create_date'],
      limit: options.limit || 1000,
      order: 'create_date desc',
    });

    return lines;
  }

  // ========== ESCRITURA ==========

  /**
   * Crea un producto en Odoo usando product.template.
   */
  async createProduct(product: {
    name: string;
    description: string;
    cost_price: number;
    sale_price: number;
  }): Promise<number> {
    return this.executeKw('product.template', 'create', [{
      name: product.name,
      description_sale: product.description,
      standard_price: product.cost_price,
      list_price: product.sale_price,
      type: 'consu',
      sale_ok: true,
      purchase_ok: true,
    }]);
  }

  /**
   * Crea múltiples productos y retorna el resultado de cada uno.
   */
  async createProducts(products: {
    name: string;
    description: string;
    cost_price: number;
    sale_price: number;
  }[]): Promise<CreateProductResult[]> {
    const results: CreateProductResult[] = [];

    for (const product of products) {
      try {
        const odooId = await this.createProduct(product);
        results.push({
          name: product.name,
          odoo_id: odooId,
          status: 'created',
        });
      } catch (error: any) {
        results.push({
          name: product.name,
          status: 'error',
          error: error?.message || String(error),
        });
      }
    }

    return results;
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
