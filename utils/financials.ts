import { Order, Settings } from '../types';

export const calculateCodFee = (order: Order, settings: Settings): number => {
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const enabled = useCustom ? (compFees?.enableCodFees ?? true) : settings.enableGlobalCod;
    if (!enabled) return 0;

    const threshold = useCustom ? (compFees?.codThreshold ?? settings.codThreshold) : settings.codThreshold;
    const rate = useCustom ? (compFees?.codFeeRate ?? settings.codFeeRate) : settings.codFeeRate;
    const tax = useCustom ? (compFees?.codTaxRate ?? settings.codTaxRate) : settings.codTaxRate;

    const totalAmount = order.productPrice + order.shippingFee;
    
    if (totalAmount <= threshold) return 0;
    const taxableAmount = totalAmount - threshold;
    const fee = taxableAmount * rate;
    return fee * (1 + tax);
};

export const getLatestProductCost = (productId: string, settings: Settings): number => {
    const latestItem = settings.supplyOrders
        .filter(so => so.status === 'completed')
        .flatMap(so => so.items.map(item => ({ ...item, date: so.date })))
        .filter(item => item.productId === productId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    if (latestItem) {
        let cost = latestItem.cost;
        if (latestItem.discountValue) {
            if (latestItem.discountType === 'percentage') {
                cost = cost * (1 - latestItem.discountValue / 100);
            } else {
                cost = cost - latestItem.discountValue;
            }
        }
        return cost;
    }
    
    return settings.products.find(p => p.id === productId)?.costPrice || 0;
};

export const calculateOrderProfitLoss = (order: Order, settings: Settings): { profit: number; loss: number; net: number } => {
  let profit = 0;
  let loss = 0;

  if (['ملغي', 'جاري_المراجعة', 'قيد_التنفيذ', 'في_انتظار_المكالمة'].includes(order.status)) {
    return { profit: 0, loss: 0, net: 0 };
  }

  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
  
  const isInsured = order.isInsured ?? true;
  // Use order.insuranceFee if available (synced from platform), otherwise calculate
  const insuranceFee = order.insuranceFee ?? (isInsured ? ((order.productPrice + order.shippingFee) * insuranceRate) / 100 : 0);
  const effectiveInspectionCost = order.inspectionFee ?? inspectionCost;

  if (order.status === 'تم_التحصيل' || order.status === 'مدفوعة') {
    const codFee = order.status === 'مدفوعة' ? 0 : calculateCodFee(order, settings);
    const inspectionAdjustment = order.inspectionFeePaidByCustomer ? 0 : effectiveInspectionCost;
    const totalItemsRevenue = (order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItemsCost = (order.items || []).reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    profit = (totalItemsRevenue - totalItemsCost - insuranceFee - inspectionAdjustment - codFee);
  } else if (order.status === 'مرتجع' || order.status === 'فشل_التوصيل' || order.status === 'تمت_الاعادة_لشركة_الشحن') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    const inspectionFeeCollected = order.inspectionFeePaidByCustomer ? effectiveInspectionCost : 0;
    loss = (insuranceFee + order.shippingFee + effectiveInspectionCost + returnFeeAmount - inspectionFeeCollected);
  } else if (order.status === 'مرتجع_جزئي') {
    loss = (insuranceFee + effectiveInspectionCost);
  } else if (order.status === 'مرتجع_بعد_الاستلام') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    const inspectionFeeCollected = order.inspectionFeePaidByCustomer ? effectiveInspectionCost : 0;
    const codFee = calculateCodFee(order, settings);
    
    loss = (insuranceFee + order.shippingFee + effectiveInspectionCost + returnFeeAmount + codFee - inspectionFeeCollected);
  }
  
  return { profit, loss, net: profit - loss };
}
