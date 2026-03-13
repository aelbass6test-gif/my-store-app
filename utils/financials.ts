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
    return Math.round((fee * (1 + tax)) * 100) / 100;
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
  const insuranceFee = isInsured ? ((order.productPrice + order.shippingFee) * insuranceRate) / 100 : 0;

  if (order.status === 'تم_التحصيل') {
    const codFee = calculateCodFee(order, settings);
    const inspectionAdjustment = order.inspectionFeePaidByCustomer ? 0 : inspectionCost;
    profit = (order.productPrice - order.productCost - insuranceFee - inspectionAdjustment - codFee);
  } else if (order.status === 'مرتجع' || order.status === 'فشل_التوصيل') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    const inspectionFeeCollected = order.inspectionFeePaidByCustomer ? inspectionCost : 0;
    loss = (insuranceFee + order.shippingFee + inspectionCost + returnFeeAmount - inspectionFeeCollected);
  } else if (order.status === 'مرتجع_جزئي') {
    loss = (insuranceFee + inspectionCost);
  } else if (order.status === 'مرتجع_بعد_الاستلام') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    const inspectionFeeCollected = order.inspectionFeePaidByCustomer ? inspectionCost : 0;
    const codFee = calculateCodFee(order, settings);
    
    loss = (insuranceFee + order.shippingFee + inspectionCost + returnFeeAmount + codFee - inspectionFeeCollected);
  }
  
  return { profit, loss, net: profit - loss };
}