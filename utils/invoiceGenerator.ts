import { Order, Settings } from '../types';

export function generateInvoiceHTML(order: Order, settings: Settings, storeName: string): string {
  return `<html><body><h1>Invoice ${order.orderNumber}</h1><p>Store: ${storeName}</p></body></html>`;
}
