import { Order, Settings, Store } from '../types';
import { calculateOrderProfitLoss } from './financials';

const getStoreHeader = (activeStore?: Store) => {
  return `
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
      <h1 style="margin: 0; color: #1e293b; font-size: 24px;">${activeStore?.name || 'مدير الأوردرات الذكي'}</h1>
      <p style="margin: 5px 0; color: #64748b; font-size: 14px;">تقرير مفصل للطلبات</p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>
    </div>
  `;
};

export const generateOrdersReportHTML = (orders: Order[], settings: Settings, activeStore?: Store): string => {
  const rows = orders.map(order => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">#${order.orderNumber}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${order.customerName}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${order.shippingCompany}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${order.status}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: left;">${(order.productPrice + order.shippingFee - (order.discount || 0)).toLocaleString()} ج.م</td>
    </tr>
  `).join('');

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; padding: 40px; color: #334155;">
      ${getStoreHeader(activeStore)}
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f8fafc; text-align: right;">
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">رقم الطلب</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">العميل</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">شركة الشحن</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">الحالة</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
};

export const generateLossesReportHTML = (orders: Order[], settings: Settings, activeStore?: Store): string => {
  const failedOrders = orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام'].includes(o.status));
  let totalLoss = 0;
  
  const rows = failedOrders.map(order => {
    const { loss } = calculateOrderProfitLoss(order, settings);
    totalLoss += loss;
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">#${order.orderNumber}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${order.status}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #ef4444; text-align: left;">${loss.toLocaleString()} ج.م</td>
      </tr>
    `;
  }).join('');

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; padding: 40px; color: #334155;">
      ${getStoreHeader(activeStore)}
      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 12px; margin-bottom: 30px; text-align: center;">
        <h2 style="margin: 0; color: #991b1b;">إجمالي الخسائر</h2>
        <p style="font-size: 32px; font-weight: 900; margin: 10px 0; color: #ef4444;">${totalLoss.toLocaleString()} ج.م</p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8fafc; text-align: right;">
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">رقم الطلب</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">سبب الخسارة (الحالة)</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left;">قيمة الخسارة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
};

export const generateComprehensiveFinancialReportHTML = (orders: Order[], settings: Settings, activeStore?: Store): string => {
  let totals = { revenue: 0, profit: 0, loss: 0, net: 0 };
  
  orders.forEach(o => {
    const { profit, loss, net } = calculateOrderProfitLoss(o, settings);
    if (o.status === 'تم_التحصيل') {
      totals.revenue += (o.productPrice + o.shippingFee - (o.discount || 0));
    }
    totals.profit += profit;
    totals.loss += loss;
    totals.net += net;
  });

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; padding: 40px; color: #334155;">
      ${getStoreHeader(activeStore)}
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
        <div style="padding: 20px; background: #f0fdf4; border-radius: 16px; border: 1px solid #dcfce7; text-align: center;">
          <p style="margin: 0; color: #166534; font-size: 14px;">إجمالي الإيرادات</p>
          <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: 900; color: #15803d;">${totals.revenue.toLocaleString()} ج.م</p>
        </div>
        <div style="padding: 20px; background: #fef2f2; border-radius: 16px; border: 1px solid #fee2e2; text-align: center;">
          <p style="margin: 0; color: #991b1b; font-size: 14px;">إجمالي الخسائر</p>
          <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: 900; color: #ef4444;">${totals.loss.toLocaleString()} ج.م</p>
        </div>
        <div style="padding: 20px; background: #f0f9ff; border-radius: 16px; border: 1px solid #e0f2fe; text-align: center; grid-column: span 2;">
          <p style="margin: 0; color: #075985; font-size: 14px;">صافي الأرباح</p>
          <p style="margin: 10px 0 0 0; font-size: 36px; font-weight: 900; color: #0284c7;">${totals.net.toLocaleString()} ج.م</p>
        </div>
      </div>
    </div>
  `;
};

export const generateCollectionsReportHTML = (orders: Order[], settings: Settings, activeStore?: Store): string => {
  const collected = orders.filter(o => o.status === 'تم_التحصيل');
  
  const rows = collected.map(o => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">#${o.orderNumber}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${o.customerName}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${o.shippingCompany}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: left;">${(o.productPrice + o.shippingFee - (o.discount || 0)).toLocaleString()} ج.م</td>
    </tr>
  `).join('');

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; padding: 40px; color: #334155;">
      ${getStoreHeader(activeStore)}
      <h2 style="color: #1e293b; margin-bottom: 20px;">تقرير التحصيلات النقدي</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8fafc; text-align: right;">
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">رقم الطلب</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">العميل</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0;">شركة الشحن</th>
            <th style="padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left;">المبلغ المحصل</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
};
