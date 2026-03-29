import type { OdooProduct, ExpiringLot } from '../schemas.js';
import type { ExecuteKw } from './base.js';
import { cleanOdooProduct } from './products.js';

const PRODUCT_FIELDS = [
  'id', 'name', 'list_price', 'standard_price', 'qty_available',
  'categ_id', 'default_code', 'barcode', 'description_sale', 'type',
];

const LOT_EXPIRY_FIELDS = [
  'id', 'name', 'product_id', 'expiration_date', 'use_date',
  'removal_date', 'alert_date', 'product_qty',
];

export function createInventoryService(executeKw: ExecuteKw) {
  return {
    async getLowStockProducts(threshold: number = 10, limit: number = 50, offset: number = 0): Promise<OdooProduct[]> {
      const raw = await executeKw('product.product', 'search_read', [
        [['qty_available', '<=', threshold], ['qty_available', '>', 0]],
      ], { fields: PRODUCT_FIELDS, limit, offset });
      return (raw || []).map(cleanOdooProduct);
    },

    async getExpiringProducts(options: {
      days?: number;
      limit?: number;
      offset?: number;
    } = {}): Promise<ExpiringLot[]> {
      const days = options.days ?? 30;
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().replace('T', ' ').slice(0, 19);
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const raw = await executeKw('stock.lot', 'search_read', [
        [
          ['expiration_date', '!=', false],
          ['expiration_date', '>=', nowStr],
          ['expiration_date', '<=', futureDateStr],
          ['product_qty', '>', 0],
        ],
      ], {
        fields: LOT_EXPIRY_FIELDS,
        limit, offset,
        order: 'expiration_date asc',
      });

      return (raw || []).map((lot: any) => ({
        lot_id: lot.id,
        lot_name: lot.name,
        product_id: lot.product_id?.[0] ?? 0,
        product_name: lot.product_id?.[1] ?? '',
        expiration_date: typeof lot.expiration_date === 'string' ? lot.expiration_date : null,
        use_date: typeof lot.use_date === 'string' ? lot.use_date : null,
        removal_date: typeof lot.removal_date === 'string' ? lot.removal_date : null,
        alert_date: typeof lot.alert_date === 'string' ? lot.alert_date : null,
        product_qty: lot.product_qty ?? 0,
      }));
    },
  };
}
