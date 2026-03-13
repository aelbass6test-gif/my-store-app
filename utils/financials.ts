import { Order, Settings } from '../types';

export interface ProfitLoss {
  net: number;
  profit: number;
  loss: number;
}

export function calculateOrderProfitLoss(order: Order, settings: Settings): ProfitLoss {
  const net = (order.productPrice || 0) - (order.productCost || 0) - (order.shippingFee || 0);
  return {
    net,
    profit: net > 0 ? net : 0,
    loss: net < 0 ? Math.abs(net) : 0
  };
}

export function calculateCodFee(order: Order, settings: Settings): number {
  return 0;
}
