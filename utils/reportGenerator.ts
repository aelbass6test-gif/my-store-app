import { Order, Settings, OrderItem, Wallet, Transaction } from '../types';
import { calculateOrderProfitLoss } from './financials';

export const generateInvoiceHTML = (order: Order, settings: Settings, storeName: string) => {
  const totalAmount = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - order.discount);
  
  const itemsHtml = order.items.map((item: OrderItem) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px; text-align: right;">${item.name}</td>
      <td style="padding: 10px; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; text-align: center;">${item.price.toLocaleString()}</td>
      <td style="padding: 10px; text-align: center; font-weight: bold;">${(item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة رقم ${order.orderNumber}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Cairo', sans-serif; margin: 0; padding: 20px; color: #333; }
        .invoice-container { max-width: 800px; margin: auto; border: 1px solid #ddd; padding: 30px; border-radius: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { max-height: 60px; }
        .store-info h1 { margin: 0; font-size: 24px; color: ${settings.customization.primaryColor}; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .detail-group h3 { margin: 0 0 10px 0; font-size: 16px; color: #666; }
        .detail-group p { margin: 5px 0; font-weight: bold; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f1f1; padding: 12px; text-align: center; font-weight: bold; font-size: 14px; }
        .totals { width: 250px; margin-right: auto; margin-left: 0; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .grand-total { font-size: 20px; font-weight: bold; color: ${settings.customization.primaryColor}; border-top: 2px solid #ddd; border-bottom: none; padding-top: 15px; }
        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
        @media print {
          body { padding: 0; }
          .invoice-container { border: none; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="store-info">
            ${settings.customization.logoUrl ? `<img src="${settings.customization.logoUrl}" class="logo" alt="Logo">` : `<h1>${storeName}</h1>`}
            <p style="margin:5px 0 0; font-size:12px; color:#777;">${settings.customization.footerText}</p>
          </div>
          <div style="text-align: left;">
            <h2 style="margin: 0; color: #333;">فاتورة مبيعات</h2>
            <p style="margin: 5px 0; font-family: monospace;">#${order.orderNumber}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #777;">${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>

        <div class="invoice-details">
          <div class="detail-group">
            <h3>بيانات العميل</h3>
            <p>الاسم: ${order.customerName}</p>
            <p>الهاتف: ${order.customerPhone}</p>
            <p>العنوان: ${order.customerAddress}</p>
          </div>
          <div class="detail-group" style="text-align: left;">
            <h3>تفاصيل الشحن</h3>
            <p>شركة الشحن: ${order.shippingCompany}</p>
            <p>المنطقة: ${order.shippingArea}</p>
            <p>الحالة: ${order.status.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: right;">المنتج</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>المجموع الفرعي:</span>
            <span>${order.productPrice.toLocaleString()} ج.م</span>
          </div>
          <div class="total-row">
            <span>مصاريف الشحن:</span>
            <span>${order.shippingFee.toLocaleString()} ج.م</span>
          </div>
          ${order.discount > 0 ? `
          <div class="total-row" style="color: red;">
            <span>خصم:</span>
            <span>-${order.discount.toLocaleString()} ج.م</span>
          </div>` : ''}
          ${order.includeInspectionFee ? `
          <div class="total-row">
            <span>رسوم معاينة (إن وجدت):</span>
            <span>${settings.inspectionFee.toLocaleString()} ج.م</span>
          </div>` : ''}
          <div class="total-row grand-total">
            <span>الإجمالي المستحق:</span>
            <span>${totalAmount.toLocaleString()} ج.م</span>
          </div>
        </div>

        ${order.notes ? `
        <div style="margin-top: 20px; padding: 15px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px;">
          <strong>ملاحظات:</strong> ${order.notes}
        </div>` : ''}

        <div class="footer">
          <p>شكراً لتعاملكم معنا! | تطبق الشروط والأحكام</p>
          <p style="font-weight: bold; margin-top: 5px;">حق المعاينة مكفول بالكامل قبل الاستلام</p>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
};

export const generateOrdersReportHTML = (orders: Order[], settings: Settings, storeName: string): string => {
  
  const tableRows = orders.map(order => {
    const amountToCollect = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0));
    const { net } = calculateOrderProfitLoss(order, settings);
    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

    const getStatusColor = (status: string, type: 'status' | 'payment') => {
        const paymentIsPaid = ['مدفوع'].includes(status);
        const statusIsCollected = ['تم_التحصيل'].includes(status);
        if ((type === 'payment' && paymentIsPaid) || (type === 'status' && statusIsCollected)) return 'background-color: #dcfce7; color: #166534;'; // green
        
        const isFailure = ['مرتجع', 'فشل_التوصيل', 'ملغي'].includes(status);
        if (isFailure) return 'background-color: #fee2e2; color: #991b1b;'; // red

        const inProgress = ['تم_توصيلها', 'قيد_الشحن', 'تم_الارسال'].includes(status);
        if (inProgress) return 'background-color: #dbeafe; color: #1e40af;'; // blue
        
        return 'background-color: #f1f5f9; color: #475569;'; // slate
    }

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px;">${order.customerName}</td>
        <td style="padding: 8px;">${order.productName}</td>
        <td style="padding: 8px;">${order.productPrice.toLocaleString()}</td>
        <td style="padding: 8px; text-align: center;">${totalQuantity}</td>
        <td style="padding: 8px;">${order.shippingFee.toLocaleString()}</td>
        <td style="padding: 8px;">${amountToCollect.toLocaleString()}</td>
        <td style="padding: 8px; font-weight: bold;">${amountToCollect.toLocaleString()}</td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; white-space: nowrap; ${getStatusColor(order.status, 'status')}">${order.status.replace(/_/g, ' ')}</span></td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; white-space: nowrap; ${getStatusColor(order.paymentStatus, 'payment')}">${order.paymentStatus}</span></td>
        <td style="padding: 8px; font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الطلبات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 landscape; margin: 1cm; }
        body { font-family: 'Cairo', sans-serif; font-size: 9px; -webkit-print-color-adjust: exact; color-adjust: exact; }
        .report-container { width: 100%; }
        h1 { text-align: center; margin-bottom: 5px; color: #111827; font-size: 20px; }
        p { text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #1f2937 !important; color: white !important; font-size: 10px; }
        tbody tr:nth-child(even) { background-color: #f9fafb !important; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <h1>تقرير الطلبات لمتجر "${storeName}"</h1>
        <p>تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>
        <table>
          <thead>
            <tr>
              <th>اسم العميل</th>
              <th>المنتج</th>
              <th>سعر المنتج</th>
              <th>كمية</th>
              <th>مصاريف الشحن</th>
              <th>مبلغ التحصيل</th>
              <th>إجمالي المبلغ</th>
              <th>حالة الشحنة</th>
              <th>حالة الدفع</th>
              <th>صافي الربح/الخسارة (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
};

export const generateCollectionsReportHTML = (orders: Order[], settings: Settings, storeName:string): string => {
    let totalGross = 0;
    let totalNetProfit = 0;

    orders.forEach(o => {
      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
      const totalAmount = o.productPrice + o.shippingFee;

      totalGross += totalAmount + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);

      const { net } = calculateOrderProfitLoss(o, settings);
      totalNetProfit += net;
    });

    const tableRows = orders.map(order => {
        const { net } = calculateOrderProfitLoss(order, settings);
        const totalAmount = order.productPrice + order.shippingFee;
        
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px;">${order.orderNumber}</td>
                <td style="padding: 8px;">${order.customerName}</td>
                <td style="padding: 8px; font-family: monospace;">${new Date(order.date).toLocaleDateString('ar-EG')}</td>
                <td style="padding: 8px;">${totalAmount.toLocaleString()}</td>
                <td style="padding: 8px;">${order.productCost.toLocaleString()}</td>
                <td style="padding: 8px; font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير التحصيلات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 1cm; }
        body { font-family: 'Cairo', sans-serif; font-size: 10px; color: #333; }
        .report-container { width: 100%; }
        h1 { text-align: center; margin-bottom: 5px; color: #111827; font-size: 22px; }
        p.subtitle { text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
        .stat-box { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
        .stat-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
        .stat-box p { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #f3f4f6; font-weight: bold; font-size: 11px; }
        tbody tr:nth-child(even) { background-color: #f9fafb; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <h1>تقرير التحصيلات المفصّل</h1>
        <p class="subtitle">متجر "${storeName}" - تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>

        <div class="summary-grid">
            <div class="stat-box">
                <h3>إجمالي المحصل</h3>
                <p style="color: #059669;">${totalGross.toLocaleString()} ج.م</p>
            </div>
            <div class="stat-box">
                <h3>صافي الأرباح</h3>
                <p style="color: #2563eb;">${totalNetProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م</p>
            </div>
            <div class="stat-box">
                <h3>عدد الطلبات</h3>
                <p>${orders.length}</p>
            </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>العميل</th>
              <th>التاريخ</th>
              <th>المبلغ المحصل</th>
              <th>التكلفة</th>
              <th>صافي الربح/الخسارة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
    `;
};

export const generateLossesReportHTML = (orders: Order[], settings: Settings, storeName: string): string => {
    let totalLoss = 0;

    const tableRows = orders.map(order => {
        const { loss } = calculateOrderProfitLoss(order, settings);
        totalLoss += loss;
        
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px;">${order.orderNumber}</td>
                <td style="padding: 8px;">${order.customerName}</td>
                <td style="padding: 8px; font-family: monospace;">${new Date(order.date).toLocaleDateString('ar-EG')}</td>
                <td style="padding: 8px;">${order.status.replace(/_/g, ' ')}</td>
                <td style="padding: 8px; font-weight: bold; color: #b91c1c;">-${loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الخسائر - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 1cm; }
        body { font-family: 'Cairo', sans-serif; font-size: 10px; color: #333; }
        .report-container { width: 100%; }
        h1 { text-align: center; margin-bottom: 5px; color: #111827; font-size: 22px; }
        p.subtitle { text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
        .stat-box { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
        .stat-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
        .stat-box p { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #f3f4f6; font-weight: bold; font-size: 11px; }
        tbody tr:nth-child(even) { background-color: #f9fafb; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <h1>تقرير الخسائر المفصّل</h1>
        <p class="subtitle">متجر "${storeName}" - تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>

        <div class="summary-grid">
            <div class="stat-box">
                <h3>إجمالي الخسائر</h3>
                <p style="color: #dc2626;">-${totalLoss.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م</p>
            </div>
            <div class="stat-box">
                <h3>عدد الطلبات الفاشلة</h3>
                <p>${orders.length}</p>
            </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>العميل</th>
              <th>التاريخ</th>
              <th>الحالة</th>
              <th>قيمة الخسارة (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
    `;
};

export const generateComprehensiveFinancialReportHTML = (orders: Order[], settings: Settings, wallet: Wallet, storeName: string): string => {
    const collectedOrders = orders.filter(o => o.status === 'تم_التحصيل');
    const failedOrders = orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status));
    const adminExpenses = wallet.transactions.filter(t => t.category?.startsWith('expense_'));

    let totalProductRevenue = 0;
    let totalCogs = 0;
    let totalProfit = 0;
    const collectedRows = collectedOrders.map(order => {
        const { profit } = calculateOrderProfitLoss(order, settings);
        totalProductRevenue += order.productPrice;
        totalCogs += order.productCost;
        totalProfit += profit;
        return `<tr><td>${order.orderNumber}</td><td>${order.customerName}</td><td>${order.productPrice.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td>${order.productCost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td><td style="color: #15803d;">${profit.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
    }).join('');

    let totalLoss = 0;
    const failedRows = failedOrders.map(order => {
        const { loss } = calculateOrderProfitLoss(order, settings);
        totalLoss += loss;
        return `<tr><td>${order.orderNumber}</td><td>${order.customerName}</td><td>${order.status.replace(/_/g, ' ')}</td><td style="color: #b91c1c;">-${loss.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
    }).join('');

    let totalExpenses = 0;
    const expenseRows = adminExpenses.map(t => {
        totalExpenses += t.amount;
        return `<tr><td>${new Date(t.date).toLocaleDateString('ar-EG')}</td><td>${t.note}</td><td style="color: #b91c1c;">-${t.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
    }).join('');

    const finalNet = totalProfit - totalLoss - totalExpenses;

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>التقرير المالي الشامل - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 1cm; }
        body { font-family: 'Cairo', sans-serif; font-size: 10px; color: #333; -webkit-print-color-adjust: exact; color-adjust: exact; }
        .report-container { width: 100%; }
        h1, h2 { text-align: center; color: #111827; margin-bottom: 5px; }
        h1 { font-size: 24px; }
        h2 { font-size: 18px; margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 5px; }
        p.subtitle { text-align: center; margin-top: 0; margin-bottom: 25px; font-size: 12px; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
        .stat-box { background-color: #f9fafb !important; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
        .stat-box p { margin: 0; font-size: 18px; font-weight: 700; }
        .final-net-banner { background-color: #4338ca !important; color: white !important; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 25px; }
        .final-net-banner h3 { margin: 0; font-size: 14px; opacity: 0.8; }
        .final-net-banner p { margin: 5px 0 0; font-size: 28px; font-weight: 900; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #f3f4f6 !important; font-weight: bold; font-size: 11px; }
        tbody tr:nth-child(even) { background-color: #f9fafb !important; }
        .income-statement td:first-child { font-weight: bold; }
        .income-statement .bold { font-weight: 700; background-color: #f3f4f6 !important; }
        .income-statement .final-net-row { background-color: #4338ca !important; color: white !important; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <h1>التقرير المالي الشامل</h1>
        <p class="subtitle">متجر "${storeName}" - تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>

        <div class="summary-grid">
            <div class="stat-box"><h3 style="color: #059669;">إجمالي الأرباح</h3><p style="color: #059669;">${totalProfit.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p></div>
            <div class="stat-box"><h3 style="color: #dc2626;">إجمالي الخسائر</h3><p style="color: #dc2626;">-${totalLoss.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p></div>
            <div class="stat-box"><h3 style="color: #0284c7;">إجمالي تكلفة البضاعة</h3><p style="color: #0284c7;">${totalCogs.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p></div>
            <div class="stat-box"><h3 style="color: #d97706;">المصروفات الإدارية</h3><p style="color: #d97706;">-${totalExpenses.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p></div>
        </div>
        
        <div class="final-net-banner">
            <h3>صافي الربح النهائي</h3>
            <p>${finalNet.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</p>
        </div>

        <h2>بيان الدخل المبسط</h2>
        <table class="income-statement">
            <tr><td>إجمالي أرباح الطلبات الناجحة</td><td style="color: #15803d;">+${totalProfit.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</td></tr>
            <tr><td>(-) إجمالي خسائر الطلبات الفاشلة</td><td style="color: #b91c1c;">-${totalLoss.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</td></tr>
            <tr><td>(-) إجمالي المصروفات الإدارية</td><td style="color: #b91c1c;">-${totalExpenses.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</td></tr>
            <tr class="final-net-row bold"><td>(=) صافي الربح النهائي</td><td>${finalNet.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</td></tr>
        </table>
        
        <h2>تفاصيل الأرباح (الطلبات الناجحة)</h2>
        <table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>سعر البيع</th><th>التكلفة</th><th>صافي الربح</th></tr></thead><tbody>${collectedRows || '<tr><td colspan="5" style="text-align:center;">لا توجد طلبات ناجحة.</td></tr>'}</tbody></table>
        
        <h2>تفاصيل الخسائر (الطلبات الفاشلة)</h2>
        <table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>الحالة</th><th>قيمة الخسارة</th></tr></thead><tbody>${failedRows || '<tr><td colspan="4" style="text-align:center;">لا توجد طلبات فاشلة.</td></tr>'}</tbody></table>

        <h2>تفاصيل المصروفات الإدارية</h2>
        <table><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>${expenseRows || '<tr><td colspan="3" style="text-align:center;">لا توجد مصروفات إدارية.</td></tr>'}</tbody></table>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
    `;
};