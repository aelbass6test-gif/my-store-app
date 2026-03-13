import { Order, Settings } from '../types';

export function generateOrdersReportHTML(orders: Order[], settings: Settings, storeName: string): string {
  return `<html><body><h1>Orders Report - ${storeName}</h1></body></html>`;
}

export function generateLossesReportHTML(orders: Order[], settings: Settings, storeName: string): string {
  return `<html><body><h1>Losses Report - ${storeName}</h1></body></html>`;
}

export function generateComprehensiveFinancialReportHTML(orders: Order[], settings: Settings, wallet: any, storeName: string): string {
  return `<html><body><h1>Financial Report - ${storeName}</h1></body></html>`;
}

export function generateCollectionsReportHTML(orders: Order[], settings: Settings, storeName: string): string {
  return `<html><body><h1>Collections Report - ${storeName}</h1></body></html>`;
}
