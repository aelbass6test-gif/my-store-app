import { Order, Settings, OrderItem, Wallet, Transaction } from '../types';
import { calculateOrderProfitLoss, calculateCodFee } from './financials';

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
        <td style="padding: 8px; font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString()}</td>
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
                <td style="padding: 8px; font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString()}</td>
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
                <p style="color: #2563eb;">${totalNetProfit.toLocaleString()} ج.م</p>
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
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
        
        const isInsured = order.isInsured ?? true;
        const insuranceFee = isInsured ? ((order.productPrice + order.shippingFee) * insuranceRate) / 100 : 0;
        
        const codFee = calculateCodFee(order, settings);
        const { loss } = calculateOrderProfitLoss(order, settings);
        totalLoss += loss;

        const products = order.items.map(i => i.name).join(' + ') || order.productName;
        const quantities = order.items.map(i => i.quantity).join(' + ') || '1';
        const prices = order.items.map(i => i.price.toLocaleString()).join(' + ') || order.productPrice.toLocaleString();
        
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px;">${order.customerName}</td>
                <td style="padding: 8px;">${products}</td>
                <td style="padding: 8px; text-align: center;">${quantities}</td>
                <td style="padding: 8px;">${prices}</td>
                <td style="padding: 8px;">${order.shippingFee.toLocaleString()}</td>
                <td style="padding: 8px;">${(insuranceFee + inspectionCost).toLocaleString()}</td>
                <td style="padding: 8px;">${order.productCost.toLocaleString()}</td>
                <td style="padding: 8px;">${order.status.replace(/_/g, ' ')}</td>
                <td style="padding: 8px;">${order.paymentStatus}</td>
                <td style="padding: 8px; font-weight: bold; color: #b91c1c;">
                    -${loss.toLocaleString()}
                    ${codFee > 0 ? `<br/><small style="color: #6b7280; font-weight: normal;">(تحصيل: ${codFee.toLocaleString()})</small>` : ''}
                </td>
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
        @page { size: A4 landscape; margin: 1cm; }
        body { font-family: 'Cairo', sans-serif; font-size: 9px; color: #333; }
        .report-container { width: 100%; }
        h1 { text-align: center; margin-bottom: 5px; color: #111827; font-size: 22px; }
        p.subtitle { text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
        .stat-box { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
        .stat-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
        .stat-box p { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #f3f4f6; font-weight: bold; font-size: 10px; }
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
                <p style="color: #dc2626;">-${totalLoss.toLocaleString()} ج.م</p>
            </div>
            <div class="stat-box">
                <h3>عدد الطلبات الفاشلة</h3>
                <p>${orders.length}</p>
            </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>اسم العميل</th>
              <th>المنتج أو المنتجات</th>
              <th>الكمية</th>
              <th>سعر المنتج</th>
              <th>مصاريف الشحن</th>
              <th>التأمين والمعاينة</th>
              <th>إجمالي التكلفة</th>
              <th>حالة الشحنة</th>
              <th>حالة الدفع</th>
              <th>الخسارة / مصاريف التحصيل</th>
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
    const notCollectedOrders = orders.filter(o => o.status === 'تم_توصيلها' && !o.collectionProcessed);
    const inShippingOrders = orders.filter(o => o.status === 'قيد_الشحن');
    const adminExpenses = wallet.transactions.filter(t => t.category?.startsWith('expense_'));

    let totalProductRevenue = 0;
    let totalExtraMarkup = 0;
    let totalShippingRevenue = 0;
    let totalCogs = 0;
    let totalInsuranceFees = 0;
    let totalInspectionFees = 0;
    let totalCodFees = 0;
    let totalProfit = 0;
    let totalPercentageProfit = 0;
    let totalCommissionProfit = 0;

    const collectedRows = collectedOrders.map(order => {
        const { profit } = calculateOrderProfitLoss(order, settings);
        const codFee = calculateCodFee(order, settings);
        
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
        const isInsured = order.isInsured ?? true;
        const insuranceFee = isInsured ? ((order.productPrice + order.shippingFee) * insuranceRate) / 100 : 0;
        const inspectionAdjustment = order.inspectionFeePaidByCustomer ? 0 : inspectionCost;

        let orderBaseRevenue = 0;
        let orderExtraMarkup = 0;

        order.items.forEach(item => {
            const product = settings.products.find(p => p.id === item.productId);
            if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                const basePrice = product.basePrice;
                orderBaseRevenue += basePrice * item.quantity;
                orderExtraMarkup += (item.price - basePrice) * item.quantity;
            } else {
                orderBaseRevenue += item.price * item.quantity;
            }
        });

        const isMultiProfitOrder = orderExtraMarkup > 0;
        const rowStyle = isMultiProfitOrder ? 'background-color: #f0f9ff !important; border-right: 4px solid #0ea5e9;' : '';

        totalProductRevenue += orderBaseRevenue;
        totalExtraMarkup += orderExtraMarkup;
        totalShippingRevenue += order.shippingFee;
        totalCogs += order.productCost;
        totalInsuranceFees += insuranceFee;
        totalInspectionFees += inspectionAdjustment;
        totalCodFees += codFee;
        totalProfit += profit;

        // Calculate item-level profits based on profitMode
        order.items.forEach(item => {
            const product = settings.products.find(p => p.id === item.productId);
            const itemProfit = (item.price - item.cost) * item.quantity;
            if (product?.profitMode === 'commission') {
                totalCommissionProfit += itemProfit;
            } else {
                totalPercentageProfit += itemProfit;
            }
        });

        const productDetails = order.items.map(item => {
            const product = settings.products.find(p => p.id === item.productId);
            const isMulti = product?.profitMode === 'commission' && product.basePrice !== undefined && item.price > product.basePrice;
            return `
                ${item.name} (${item.quantity})
                ${isMulti ? '<br/><span style="font-size: 8px; background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 4px; display: inline-block; margin-top: 2px;">ربح مركب (أساسي + زيادة)</span>' : ''}
            `;
        }).join('<br>');

        return `
            <tr style="${rowStyle}">
                <td>${order.orderNumber}</td>
                <td>${order.customerName}</td>
                <td style="font-size: 0.85em; text-align: right;">${productDetails}</td>
                <td>${order.productPrice.toLocaleString()}</td>
                <td>${order.shippingFee.toLocaleString()}</td>
                <td>${order.productCost.toLocaleString()}</td>
                <td>${insuranceFee.toLocaleString()}</td>
                <td>${inspectionAdjustment.toLocaleString()}</td>
                <td>${codFee.toLocaleString()}</td>
                <td style="color: #15803d; font-weight: bold;">${profit.toLocaleString()}</td>
            </tr>`;
    }).join('');

    let totalFailedShipping = 0;
    let totalFailedInsurance = 0;
    let totalFailedInspection = 0;
    let totalReturnFees = 0;
    let totalLoss = 0;

    const failedRows = failedOrders.map(order => {
        const { loss } = calculateOrderProfitLoss(order, settings);
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
        const isInsured = order.isInsured ?? true;
        const insuranceFee = isInsured ? ((order.productPrice + order.shippingFee) * insuranceRate) / 100 : 0;
        
        const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
        const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
        const inspectionFeeCollected = order.inspectionFeePaidByCustomer ? inspectionCost : 0;

        totalFailedShipping += order.shippingFee;
        totalFailedInsurance += insuranceFee;
        totalFailedInspection += (inspectionCost - inspectionFeeCollected);
        totalReturnFees += returnFeeAmount;
        totalLoss += loss;

        const productDetails = order.items.map(item => `${item.name} (${item.quantity})`).join('<br>');

        return `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${order.customerName}</td>
                <td style="font-size: 0.85em; text-align: right;">${productDetails}</td>
                <td>${order.status.replace(/_/g, ' ')}</td>
                <td>${order.shippingFee.toLocaleString()}</td>
                <td>${insuranceFee.toLocaleString()}</td>
                <td>${(inspectionCost - inspectionFeeCollected).toLocaleString()}</td>
                <td>${returnFeeAmount.toLocaleString()}</td>
                <td style="color: #b91c1c; font-weight: bold;">-${loss.toLocaleString()}</td>
            </tr>`;
    }).join('');

    let totalExpenses = 0;
    const expenseRows = adminExpenses.map(t => {
        totalExpenses += t.amount;
        return `<tr><td>${new Date(t.date).toLocaleDateString('ar-EG')}</td><td>${t.note}</td><td style="color: #b91c1c;">-${t.amount.toLocaleString()}</td></tr>`;
    }).join('');

    const finalNet = totalProfit - totalLoss - totalExpenses;

    // --- NEW CALCULATIONS ---
    const successRate = orders.length > 0 ? (collectedOrders.length / orders.length) * 100 : 0;
    const grossProfit = totalPercentageProfit + totalCommissionProfit;
    const lossRatio = grossProfit > 0 ? (totalLoss / grossProfit) * 100 : 0;
    const avgProfitPerOrder = orders.length > 0 ? finalNet / orders.length : 0;

    // Carrier Performance
    const carrierStats: Record<string, { count: number, success: number, shipping: number, profit: number }> = {};
    orders.forEach(o => {
        const name = o.shippingCompany || 'غير محدد';
        if (!carrierStats[name]) carrierStats[name] = { count: 0, success: 0, shipping: 0, profit: 0 };
        carrierStats[name].count++;
        if (o.status === 'تم_التحصيل') carrierStats[name].success++;
        carrierStats[name].shipping += o.shippingFee;
        const { net } = calculateOrderProfitLoss(o, settings);
        carrierStats[name].profit += net;
    });

    const carrierRows = Object.entries(carrierStats).map(([name, stats]) => {
        const rate = stats.count > 0 ? (stats.success / stats.count) * 100 : 0;
        return `<tr>
            <td>${name}</td>
            <td>${stats.count}</td>
            <td>${rate.toFixed(1)}%</td>
            <td>${stats.shipping.toLocaleString()}</td>
            <td style="font-weight: bold; color: ${stats.profit >= 0 ? '#15803d' : '#b91c1c'};">${stats.profit.toLocaleString()}</td>
        </tr>`;
    }).join('');

    // Product Profitability
    const productStats: Record<string, { revenue: number, extra: number, cost: number, sold: number, returns: number }> = {};
    orders.forEach(o => {
        o.items.forEach(item => {
            if (!productStats[item.name]) productStats[item.name] = { revenue: 0, extra: 0, cost: 0, sold: 0, returns: 0 };
            if (o.status === 'تم_التحصيل') {
                const product = settings.products.find(p => p.id === item.productId);
                if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                    productStats[item.name].revenue += product.basePrice * item.quantity;
                    productStats[item.name].extra += (item.price - product.basePrice) * item.quantity;
                } else {
                    productStats[item.name].revenue += item.price * item.quantity;
                }
                productStats[item.name].cost += item.cost * item.quantity;
                productStats[item.name].sold += item.quantity;
            } else if (['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام'].includes(o.status)) {
                productStats[item.name].returns += item.quantity;
            }
        });
    });

    const productRows = Object.entries(productStats).map(([name, stats]) => {
        const totalProfit = (stats.revenue - stats.cost) + stats.extra;
        const returnRate = (stats.sold + stats.returns) > 0 ? (stats.returns / (stats.sold + stats.returns)) * 100 : 0;
        const isMultiProfit = stats.extra > 0;
        const rowStyle = isMultiProfit ? 'background-color: #f0f9ff !important; border-right: 4px solid #0ea5e9;' : '';
        
        return `<tr style="${rowStyle}">
            <td>
                ${name}
                ${isMultiProfit ? '<br/><span style="font-size: 8px; background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 4px; display: inline-block; margin-top: 2px;">ربح مركب (أساسي + زيادة)</span>' : ''}
            </td>
            <td>${stats.sold}</td>
            <td>${stats.returns} (${returnRate.toFixed(1)}%)</td>
            <td>${stats.revenue.toLocaleString()}</td>
            <td>${stats.extra.toLocaleString()}</td>
            <td style="font-weight: bold; color: #15803d;">${totalProfit.toLocaleString()}</td>
        </tr>`;
    }).sort((a, b) => b.includes('color: #15803d;') ? 1 : -1).join('');

    // Break-even
    const avgOrderProfit = collectedOrders.length > 0 ? totalProfit / collectedOrders.length : 0;
    const breakEvenOrders = avgOrderProfit > 0 ? Math.ceil(totalExpenses / avgOrderProfit) : 0;

    // Expense Breakdown
    const expenseCats: Record<string, number> = {};
    adminExpenses.forEach(t => {
        const cat = t.category?.replace('expense_', '') || 'other';
        expenseCats[cat] = (expenseCats[cat] || 0) + t.amount;
    });
    const expenseCatRows = Object.entries(expenseCats).map(([cat, amount]) => {
        const percent = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
        const catName = cat === 'ads' ? 'إعلانات' : cat === 'salary' ? 'رواتب' : cat === 'rent' ? 'إيجار' : 'أخرى';
        return `<tr><td>${catName}</td><td>${amount.toLocaleString()} ج.م</td><td>${percent.toFixed(1)}%</td></tr>`;
    }).join('');

    // Wallet Sync
    const pendingCollection = orders.filter(o => o.status === 'تم_توصيلها' && !o.collectionProcessed).reduce((sum, o) => sum + (o.productPrice + o.shippingFee), 0);
    const inventoryValue = (settings.products || []).reduce((sum, p) => sum + ((p.costPrice || 0) * (p.stockQuantity || 0)), 0);

    // Geographic Analysis
    const geoStats: Record<string, { count: number, success: number, revenue: number, loss: number }> = {};
    orders.forEach(o => {
        const area = o.governorate || o.shippingArea || 'غير محدد';
        if (!geoStats[area]) geoStats[area] = { count: 0, success: 0, revenue: 0, loss: 0 };
        geoStats[area].count++;
        const { loss } = calculateOrderProfitLoss(o, settings);
        if (o.status === 'تم_التحصيل') {
            geoStats[area].success++;
            geoStats[area].revenue += (o.productPrice + o.shippingFee);
        }
        geoStats[area].loss += loss;
    });

    const geoRows = Object.entries(geoStats).map(([name, s]) => {
        const rate = (s.success / s.count) * 100;
        const net = s.revenue - s.loss;
        return `<tr>
            <td>${name}</td>
            <td>${s.count}</td>
            <td>${rate.toFixed(1)}%</td>
            <td>${s.revenue.toLocaleString()}</td>
            <td style="font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString()}</td>
        </tr>`;
    }).sort((a, b) => {
        const netA = geoStats[a].revenue - geoStats[a].loss;
        const netB = geoStats[b].revenue - geoStats[b].loss;
        return netB - netA;
    }).join('');

    // Top Insights
    const topProducts = Object.entries(productStats)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 3)
        .map(([name, stats]) => `<li>${name} (${stats.sold} قطعة)</li>`)
        .join('');

    const topAreas = Object.entries(geoStats)
        .sort((a, b) => (b[1].revenue - b[1].loss) - (a[1].revenue - a[1].loss))
        .slice(0, 3)
        .map(([name, s]) => `<li>${name} (${((s.success/s.count)*100).toFixed(0)}% نجاح)</li>`)
        .join('');

    // Smart Recommendations
    const recommendations = [];
    if (successRate < 70) recommendations.push(`⚠️ نسبة النجاح منخفضة (${successRate.toFixed(1)}%). ننصح بمراجعة جودة تأكيد الأوردرات أو تغيير شركة الشحن في المناطق الضعيفة.`);
    if (lossRatio > 15) recommendations.push(`📉 المرتجعات تستهلك نسبة كبيرة من أرباحك (${lossRatio.toFixed(1)}%). حاول تحسين وصف المنتجات لتقليل المرتجعات.`);
    if (totalExpenses > (totalPercentageProfit + totalCommissionProfit) * 0.5) recommendations.push(`💸 المصروفات الإدارية مرتفعة جداً مقارنة بالأرباح. حاول ترشيد الإنفاق على الإعلانات أو الرواتب.`);
    if (avgProfitPerOrder < 50) recommendations.push(`💡 متوسط الربح للطلب ضعيف. قد تحتاج لرفع أسعار المنتجات أو تقليل تكاليف الشحن.`);

    const recommendationHtml = recommendations.length > 0 ? `
        <div class="recommendation-box">
            <h4>توصيات ذكية لتحسين الأداء (Smart Insights)</h4>
            <ul style="margin: 0; padding-right: 20px; font-size: 11px; color: #9a3412; line-height: 1.6;">
                ${recommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
        </div>
    ` : '';

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
        h2 { font-size: 18px; margin-top: 15px; border-bottom: 2px solid #eee; padding-bottom: 5px; }
        p.subtitle { text-align: center; margin-top: 0; margin-bottom: 25px; font-size: 12px; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; break-inside: avoid; }
        .stat-box { background-color: #f9fafb !important; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; text-align: center; break-inside: avoid; }
        .stat-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
        .stat-box p { margin: 0; font-size: 18px; font-weight: 700; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; break-inside: avoid; }
        .kpi-box { border: 2px solid #e5e7eb; padding: 12px; border-radius: 10px; text-align: center; position: relative; overflow: hidden; break-inside: avoid; }
        .kpi-box .progress-bg { position: absolute; bottom: 0; left: 0; height: 4px; background: #e5e7eb; width: 100%; }
        .kpi-box .progress-fill { position: absolute; bottom: 0; left: 0; height: 4px; transition: width 0.3s; }
        .final-net-banner { background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%) !important; color: white !important; padding: 15px; border-radius: 12px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); break-inside: avoid; page-break-inside: avoid; }
        .recommendation-box { background-color: #fff7ed !important; border: 1px solid #ffedd5; padding: 15px; border-radius: 10px; margin-bottom: 25px; }
        .recommendation-box h4 { margin: 0 0 10px 0; color: #9a3412; display: flex; align-items: center; gap: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; break-inside: auto; }
        tr { break-inside: avoid; break-after: auto; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #f3f4f6 !important; font-weight: bold; font-size: 11px; }
        tbody tr:nth-child(even) { background-color: #f9fafb !important; }
        .income-statement td:first-child { font-weight: bold; padding-right: 15px; }
        .income-statement .indent { padding-right: 30px; font-weight: normal; color: #4b5563; }
        .income-statement .bold { font-weight: 900; background-color: #f3f4f6 !important; font-size: 12px; }
        .income-statement .final-net-row { background-color: #1e3a8a !important; color: white !important; font-size: 16px; }
        .section-header { display: flex; align-items: center; gap: 10px; margin-top: 20px; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
        .section-header h2 { margin: 0; border: none; font-size: 18px; color: #1e3a8a; }
        .page-break-avoid { break-inside: avoid; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <h1>التقرير المالي الشامل (Comprehensive Financial Report)</h1>
        <p class="subtitle">متجر "${storeName}" - تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>

        <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px; break-inside: avoid;">
            <h2 style="margin-top: 0; text-align: right; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">ملخص الأداء العام (Executive Summary)</h2>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px; break-inside: avoid;">
                <div style="text-align: center; border-left: 1px solid #cbd5e1;">
                    <span style="color: #64748b; font-size: 11px;">إجمالي المبيعات</span>
                    <p style="font-size: 18px; font-weight: 900; margin: 5px 0;">${(totalProductRevenue + totalExtraMarkup + totalShippingRevenue).toLocaleString()} ج.م</p>
                    <small style="color: #94a3b8; font-size: 8px; display: block;">(ثمن المنتجات + الزيادة + تحصيل الشحن)</small>
                </div>
                <div style="text-align: center; border-left: 1px solid #cbd5e1;">
                    <span style="color: #64748b; font-size: 11px;">صافي الربح النهائي</span>
                    <p style="font-size: 18px; font-weight: 900; margin: 5px 0; color: #1e40af;">${finalNet.toLocaleString()} ج.م</p>
                    <small style="color: #94a3b8; font-size: 8px; display: block;">(الأرباح - الخسائر - المصاريف)</small>
                </div>
                <div style="text-align: center;">
                    <span style="color: #64748b; font-size: 11px;">نسبة النجاح الإجمالية</span>
                    <p style="font-size: 18px; font-weight: 900; margin: 5px 0; color: ${successRate >= 70 ? '#15803d' : '#b91c1c'};">${successRate.toFixed(1)}%</p>
                    <small style="color: #94a3b8; font-size: 8px; display: block;">(الناجح ÷ إجمالي الطلبات)</small>
                </div>
            </div>
        </div>

        <div class="summary-grid" style="grid-template-columns: repeat(5, 1fr); margin-top: 20px;">
            <div class="stat-box">
                <h3 style="color: #1e40af;">إجمالي مبيعات المنتجات</h3>
                <p>${(totalProductRevenue + totalExtraMarkup).toLocaleString()} ج.م</p>
                <small style="font-size: 8px; color: #94a3b8;">إجمالي ثمن البيع (الأساسي + الزيادة)</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #15803d;">عدد الطلبات الناجحة</h3>
                <p>${collectedOrders.length}</p>
                <small style="font-size: 8px; color: #94a3b8;">الطلبات التي تم تحصيلها بنجاح</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #b91c1c;">عدد الطلبات الفاشلة</h3>
                <p>${failedOrders.length}</p>
                <small style="font-size: 8px; color: #94a3b8;">المرتجعات وفشل التوصيل</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #d97706;">عدد لم يتم تحصيله</h3>
                <p>${notCollectedOrders.length}</p>
                <small style="font-size: 8px; color: #94a3b8;">تم توصيلها ولم يتم تحصيلها</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #6366f1;">عدد في الشحن</h3>
                <p>${inShippingOrders.length}</p>
                <small style="font-size: 8px; color: #94a3b8;">أوردرات لسه مع شركة الشحن</small>
            </div>
        </div>

        <div class="summary-grid" style="grid-template-columns: repeat(6, 1fr); margin-top: 20px;">
            <div class="stat-box">
                <h3 style="color: #3b82f6;">مبيعات المنتجات (بالأساسي)</h3>
                <p>${totalProductRevenue.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">أصل ثمن البيع قبل الزيادة</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #8b5cf6;">الربح الإضافي (الزيادة)</h3>
                <p>${totalExtraMarkup.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">الفرق بين سعر البيع والأساسي</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #0284c7;">تحصيل الشحن</h3>
                <p>${totalShippingRevenue.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">المبالغ التي دفعها الزبائن للشحن</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #6366f1;">إجمالي التأمين (ناجح)</h3>
                <p>${totalInsuranceFees.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">رسوم التأمين للطلبات الناجحة</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #6366f1;">إجمالي المعاينة (ناجح)</h3>
                <p>${totalInspectionFees.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">رسوم المعاينة للطلبات الناجحة</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #6366f1;">إجمالي رسوم COD (ناجح)</h3>
                <p>${totalCodFees.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                <small style="font-size: 8px; color: #94a3b8;">رسوم تحصيل الأموال للطلبات الناجحة</small>
            </div>
        </div>

        <div class="summary-grid">
            <div class="stat-box">
                <h3 style="color: #059669;">إجمالي الربح (قبل الخصومات)</h3>
                <p style="color: #059669;">${(totalPercentageProfit + totalCommissionProfit).toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">ربح المنتجات (البيع - التكلفة)</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #dc2626;">إجمالي الخسائر</h3>
                <p style="color: #dc2626;">-${totalLoss.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">تكاليف الشحن والتأمين للمرتجعات</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #0284c7;">مستحقات الموردين (ثمن البضاعة)</h3>
                <p style="color: #0284c7;">${totalCogs.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">المبالغ التي تخص الموردين (أصل ثمن البضاعة)</small>
            </div>
            <div class="stat-box">
                <h3 style="color: #d97706;">المصروفات الإدارية</h3>
                <p style="color: #d97706;">-${totalExpenses.toLocaleString()}</p>
                <small style="font-size: 8px; color: #94a3b8;">إعلانات، رواتب، إيجار، إلخ</small>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-box" style="border-color: ${successRate >= 70 ? '#10b981' : '#ef4444'};">
                <h4>نسبة نجاح التوصيل</h4>
                <p style="color: ${successRate >= 70 ? '#059669' : '#dc2626'};">${successRate.toFixed(1)}%</p>
                <small style="font-size: 8px; color: #64748b;">تقيس مدى كفاءة الشحن وتأكيد الأوردرات</small>
                <div class="progress-bg"></div>
                <div class="progress-fill" style="width: ${successRate}%; background: ${successRate >= 70 ? '#10b981' : '#ef4444'};"></div>
            </div>
            <div class="kpi-box">
                <h4>نسبة الخسارة إلى الربح</h4>
                <p style="color: #dc2626;">${lossRatio.toFixed(1)}%</p>
                <small style="font-size: 8px; color: #64748b;">توضح كم يستهلك المرتجع من أرباحك الصافية</small>
                <div class="progress-bg"></div>
                <div class="progress-fill" style="width: ${Math.min(lossRatio * 2, 100)}%; background: #ef4444;"></div>
            </div>
            <div class="kpi-box">
                <h4>متوسط الربح للطلب</h4>
                <p style="color: #2563eb;">${avgProfitPerOrder.toLocaleString()} ج.م</p>
                <small style="font-size: 8px; color: #64748b;">الربح الفعلي الصافي لكل أوردر بعد كل التكاليف</small>
            </div>
        </div>

        ${recommendationHtml}
        
        <div class="final-net-banner">
            <h3>صافي الربح النهائي</h3>
            <p>${finalNet.toLocaleString()} ج.م</p>
            <div style="margin-top: 10px; font-size: 11px; opacity: 0.9;">
                نقطة التعادل: تحتاج إلى <strong>${breakEvenOrders}</strong> أوردر ناجح إضافي لتغطية المصروفات الإدارية.
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; break-inside: avoid;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px;">
                <h3 style="margin: 0 0 10px 0; color: #1e3a8a; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">أفضل 3 منتجات مبيعاً</h3>
                <ul style="margin: 0; padding-right: 20px; font-size: 11px; color: #475569;">
                    ${topProducts || '<li>لا توجد بيانات</li>'}
                </ul>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px;">
                <h3 style="margin: 0 0 10px 0; color: #1e3a8a; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">أفضل 3 مناطق ربحية</h3>
                <ul style="margin: 0; padding-right: 20px; font-size: 11px; color: #475569;">
                    ${topAreas || '<li>لا توجد بيانات</li>'}
                </ul>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; break-inside: avoid;">
            <div style="background: #f0fdf4; padding: 15px; border-radius: 10px; border: 1px solid #bbf7d0; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h4 style="margin: 0; color: #166534; font-size: 12px; font-weight: bold;">النقدية المحققة (Cash Generated)</h4>
                <p style="margin: 5px 0; font-size: 22px; font-weight: 900; color: #15803d;">${(totalCogs + finalNet).toLocaleString()} ج.م</p>
                <div style="height: 2px; background: #bbf7d0; margin: 10px 0;"></div>
                <small style="font-size: 10px; color: #166534;">تكلفة البضاعة المباعة + صافي الربح النهائي</small>
            </div>
            <div style="background: #eff6ff; padding: 15px; border-radius: 10px; border: 1px solid #bfdbfe; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h4 style="margin: 0; color: #1e40af; font-size: 12px; font-weight: bold;">مستحقات عند الشحن</h4>
                <p style="margin: 5px 0; font-size: 22px; font-weight: 900; color: #1d4ed8;">${pendingCollection.toLocaleString()} ج.م</p>
                <div style="height: 2px; background: #bfdbfe; margin: 10px 0;"></div>
                <small style="font-size: 10px; color: #1e40af;">أوردرات تم توصيلها ولم تُحصل بعد</small>
            </div>
        </div>

        <div class="section-header">
            <div style="width: 4px; height: 24px; background: #1e3a8a;"></div>
            <h2 class="page-break-avoid">تحليل المناطق (Geographic Analysis)</h2>
        </div>
        <table>
            <thead>
                <tr>
                    <th>المنطقة / المحافظة</th>
                    <th>عدد الطلبات</th>
                    <th>نسبة النجاح</th>
                    <th>الإيرادات</th>
                    <th>صافي الربح</th>
                </tr>
            </thead>
            <tbody>
                ${geoRows}
            </tbody>
        </table>

        <div class="section-header">
            <div style="width: 4px; height: 24px; background: #1e3a8a;"></div>
            <h2 class="page-break-avoid">أداء شركات الشحن</h2>
        </div>
        <table>
            <thead>
                <tr>
                    <th>الشركة</th>
                    <th>عدد الطلبات</th>
                    <th>نسبة النجاح</th>
                    <th>مصاريف الشحن</th>
                    <th>صافي الربح</th>
                </tr>
            </thead>
            <tbody>
                ${carrierRows}
            </tbody>
        </table>

        <div class="section-header">
            <div style="width: 4px; height: 24px; background: #1e3a8a;"></div>
            <h2 class="page-break-avoid">تحليل ربحية المنتجات</h2>
        </div>
        <table>
            <thead>
                <tr>
                    <th>المنتج</th>
                    <th>الكمية المباعة</th>
                    <th>المرتجعات</th>
                    <th>المبيعات (بالأساسي)</th>
                    <th>الربح الإضافي (الزيادة)</th>
                    <th>صافي الربح المتوقع</th>
                </tr>
            </thead>
            <tbody>
                ${productRows}
            </tbody>
        </table>

        <div class="section-header">
            <div style="width: 4px; height: 24px; background: #1e3a8a;"></div>
            <h2 class="page-break-avoid">القائمة المالية الموحدة (Unified Financial Statement)</h2>
        </div>
        <table class="income-statement" style="border: 2px solid #1e3a8a;">
            <tr class="bold" style="background-color: #1e3a8a !important; color: white !important;"><td colspan="2">1. التدفقات النقدية الداخلة (Total Inflow)</td></tr>
            <tr><td class="indent">إجمالي مبيعات المنتجات (بالسعر الأساسي)</td><td style="color: #15803d;">+${totalProductRevenue.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">(+) الزيادة في السعر (ربح إضافي)</td><td style="color: #15803d;">+${totalExtraMarkup.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">إجمالي تحصيل الشحن من العملاء</td><td style="color: #15803d;">+${totalShippingRevenue.toLocaleString()} ج.م</td></tr>
            <tr class="bold" style="background-color: #f8fafc !important;"><td>(=) إجمالي التحصيل من العملاء</td><td>${(totalProductRevenue + totalExtraMarkup + totalShippingRevenue).toLocaleString()} ج.م</td></tr>
            
            <tr class="bold" style="background-color: #f3f4f6 !important;"><td colspan="2">2. توزيع التحصيلات (Deductions & Dues)</td></tr>
            <tr><td class="indent">(-) إجمالي مستحقات الموردين (ثمن البضاعة)</td><td style="color: #b91c1c;">-${totalCogs.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">(-) إجمالي مصاريف شحن الذهاب (لشركات الشحن)</td><td style="color: #b91c1c;">-${totalShippingRevenue.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">(-) إجمالي رسوم التأمين والمعاينة والتحصيل</td><td style="color: #b91c1c;">-${(totalInsuranceFees + totalInspectionFees + totalCodFees).toLocaleString(undefined, {maximumFractionDigits: 2})} ج.م</td></tr>
            
            <tr class="bold" style="background-color: #eff6ff !important;"><td colspan="2">3. تحليل أرباحك التشغيلية (Your Gross Earnings)</td></tr>
            <tr><td class="indent">(+) ربح العمولة (Commission Profit)</td><td style="color: #15803d;">+${(totalCommissionProfit - totalExtraMarkup).toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">(+) ربح الزيادة في السعر (Extra Markup)</td><td style="color: #15803d;">+${totalExtraMarkup.toLocaleString()} ج.م</td></tr>
            <tr class="bold" style="background-color: #dbeafe !important;"><td>(=) إجمالي أرباحك قبل الخصومات</td><td style="color: #1e40af;">${(totalCommissionProfit + totalPercentageProfit).toLocaleString()} ج.م</td></tr>
            
            <tr class="bold" style="background-color: #fff1f2 !important;"><td colspan="2">4. الخصومات والأعباء (Losses & Expenses)</td></tr>
            <tr><td class="indent">(-) إجمالي رسوم التأمين والمعاينة والتحصيل (للطلبات الناجحة)</td><td style="color: #b91c1c;">-${(totalInsuranceFees + totalInspectionFees + totalCodFees).toLocaleString(undefined, {maximumFractionDigits: 2})} ج.م</td></tr>
            <tr><td class="indent">(-) إجمالي خسائر المرتجعات والفشل</td><td style="color: #b91c1c;">-${totalLoss.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">(-) إجمالي المصروفات الإدارية (إعلانات، رواتب...)</td><td style="color: #b91c1c;">-${totalExpenses.toLocaleString()} ج.م</td></tr>
            
            <tr class="final-net-row bold" style="font-size: 18px;">
                <td>(=) صافي الربح النهائي (Net Profit)</td>
                <td>${finalNet.toLocaleString()} ج.م</td>
            </tr>
        </table>
        
        <h2 class="page-break-avoid">تفاصيل الأرباح (الطلبات الناجحة)</h2>
        <table>
            <thead>
                <tr>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>المنتجات (العدد)</th>
                    <th>سعر البيع</th>
                    <th>الشحن</th>
                    <th>التكلفة</th>
                    <th>تأمين</th>
                    <th>معاينة</th>
                    <th>COD</th>
                    <th>صافي الربح</th>
                </tr>
            </thead>
            <tbody>
                ${collectedRows || '<tr><td colspan="10" style="text-align:center;">لا توجد طلبات ناجحة.</td></tr>'}
            </tbody>
        </table>
        
        <h2 class="page-break-avoid">تفاصيل الخسائر (الطلبات الفاشلة)</h2>
        <table>
            <thead>
                <tr>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>المنتجات (العدد)</th>
                    <th>الحالة</th>
                    <th>شحن ذهاب</th>
                    <th>تأمين</th>
                    <th>معاينة</th>
                    <th>شحن مرتجع</th>
                    <th>صافي الخسارة</th>
                </tr>
            </thead>
            <tbody>
                ${failedRows || '<tr><td colspan="9" style="text-align:center;">لا توجد طلبات فاشلة.</td></tr>'}
            </tbody>
        </table>

        <h2 class="page-break-avoid">تفاصيل المصروفات الإدارية</h2>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; break-inside: avoid;">
            <table><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>${expenseRows || '<tr><td colspan="3" style="text-align:center;">لا توجد مصروفات إدارية.</td></tr>'}</tbody></table>
            <table><thead><tr><th>التصنيف</th><th>المبلغ</th><th>النسبة</th></tr></thead><tbody>${expenseCatRows || '<tr><td colspan="3" style="text-align:center;">-</td></tr>'}</tbody></table>
        </div>

      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
    `;
};
