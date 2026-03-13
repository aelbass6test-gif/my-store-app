import { Order, Settings } from '../types';

export function generateShippingLabelHTML(order: Order, settings: Settings): string {
  return `<html><body><h1>Shipping Label ${order.orderNumber}</h1></body></html>`;
}
