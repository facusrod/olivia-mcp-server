import type { SalesRankingItem, PosOrder, EcomOrder } from '../schemas.js';
import type { ExecuteKw } from './base.js';

export function createSalesService(executeKw: ExecuteKw) {
  return {
    async getSalesRanking(days: number = 30, limit: number = 10, source: 'all' | 'pos' | 'ecommerce' = 'all'): Promise<SalesRankingItem[]> {
      const date = new Date();
      date.setDate(date.getDate() - days);
      const dateStr = date.toISOString().split('T')[0];

      const productSales: Record<number, SalesRankingItem> = {};

      if (source === 'all' || source === 'pos') {
        const posLines = await executeKw('pos.order.line', 'search_read', [
          [['order_id.date_order', '>=', dateStr], ['order_id.state', 'in', ['paid', 'done', 'invoiced']]],
        ], { fields: ['product_id', 'qty', 'price_subtotal_incl'] });

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
          const ecomLines = await executeKw('sale.order.line', 'search_read', [
            [
              ['order_id.date_order', '>=', dateStr],
              ['order_id.state', 'in', ['sale', 'done']],
              ['order_id.website_id', '!=', false],
            ],
          ], { fields: ['product_id', 'product_uom_qty', 'price_subtotal'] });

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
    },

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
      let posOrders: PosOrder[] = [];
      let ecomOrders: EcomOrder[] = [];

      if (source === 'all' || source === 'pos') {
        const filters: any[] = [['state', 'in', ['paid', 'done', 'invoiced']]];
        if (options.dateFrom) filters.push(['date_order', '>=', options.dateFrom]);
        if (options.dateTo) filters.push(['date_order', '<=', options.dateTo]);

        posOrders = (await executeKw('pos.order', 'search_read', [filters], {
          fields: ['id', 'name', 'date_order', 'amount_total', 'amount_tax', 'partner_id', 'pos_reference'],
          limit, offset, order: 'date_order desc',
        })) || [];
      }

      if (source === 'all' || source === 'ecommerce') {
        try {
          const filters: any[] = [['website_id', '!=', false], ['state', 'in', ['sale', 'done']]];
          if (options.dateFrom) filters.push(['date_order', '>=', options.dateFrom]);
          if (options.dateTo) filters.push(['date_order', '<=', options.dateTo]);

          ecomOrders = (await executeKw('sale.order', 'search_read', [filters], {
            fields: ['id', 'name', 'date_order', 'amount_total', 'partner_id', 'state'],
            limit, offset, order: 'date_order desc',
          })) || [];
        } catch {
          // eCommerce module might not be installed
        }
      }

      return { pos_orders: posOrders, ecom_orders: ecomOrders };
    },
  };
}
