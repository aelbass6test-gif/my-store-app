import React, { useState, useMemo } from 'react';
import { Order, Settings, Wallet, Store } from '../types';
import { getLatestProductCost } from '../utils/financials';
import { 
  BarChart, Wallet as WalletIcon, TrendingUp, Users, Truck, FileText, 
  ArrowDown, ArrowUp, DollarSign, Package, Download, Eye, X, Loader2, Printer, 
  PieChart // Added PieChart
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Props {
  orders: Order[];
  settings: Settings;
  wallet: Wallet;
  activeStore?: Store;
}

export const AccountingReports: React.FC<Props> = ({ orders, settings, wallet, activeStore }) => {
    const [subTab, setSubTab] = useState<'income' | 'balance_sheet' | 'cash_flow' | 'suppliers' | 'receivables' | 'wallet' | 'product_profitability' | 'partner_equity'>('income');
    const [isExporting, setIsExporting] = useState(false);
    
    // ... we'll compute everything here ...
    
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 animate-in fade-in-5 duration-300">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                <BarChart className="text-purple-500" /> الحسابات الختامية والتقارير المالية الأساسية
            </h2>
            
            <div className="flex gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar mb-6">
                <TabButton active={subTab === 'income'} onClick={() => setSubTab('income')} icon={<TrendingUp size={16} />} title="قائمة الدخل" />
                <TabButton active={subTab === 'balance_sheet'} onClick={() => setSubTab('balance_sheet')} icon={<DollarSign size={16} />} title="الميزانية العمومية" />
                <TabButton active={subTab === 'cash_flow'} onClick={() => setSubTab('cash_flow')} icon={<ArrowUp size={16} />} title="التدفقات النقدية" />
                <TabButton active={subTab === 'suppliers'} onClick={() => setSubTab('suppliers')} icon={<Users size={16} />} title="حساب الموردين" />
                <TabButton active={subTab === 'receivables'} onClick={() => setSubTab('receivables')} icon={<Truck size={16} />} title="ذمم شركات الشحن" />
                <TabButton active={subTab === 'wallet'} onClick={() => setSubTab('wallet')} icon={<WalletIcon size={16} />} title="حركة الصندوق" />
                <TabButton active={subTab === 'product_profitability'} onClick={() => setSubTab('product_profitability')} icon={<Package size={16} />} title="أرباح المنتجات" />
                <TabButton active={subTab === 'partner_equity'} onClick={() => setSubTab('partner_equity')} icon={<PieChart size={16} />} title="حقوق الشركاء" />
            </div>

            <div className="min-h-[400px]">
                {subTab === 'income' && <IncomeStatement orders={orders} settings={settings} wallet={wallet} activeStore={activeStore} />}
                {subTab === 'balance_sheet' && <BalanceSheet orders={orders} settings={settings} wallet={wallet} activeStore={activeStore} />}
                {subTab === 'cash_flow' && <CashFlowStatement wallet={wallet} />}
                {subTab === 'suppliers' && <SupplierLedger settings={settings} activeStore={activeStore} />}
                {subTab === 'receivables' && <ReceivablesAging orders={orders} settings={settings} />}
                {subTab === 'wallet' && <WalletLedger wallet={wallet} />}
                {subTab === 'product_profitability' && <ProductProfitability orders={orders} settings={settings} activeStore={activeStore} />}
                {subTab === 'partner_equity' && <PartnerEquity settings={settings} wallet={wallet} />}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap text-sm ${active ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-300'}`}
    >
        {icon} {title}
    </button>
);

// 1. Income Statement
const IncomeStatement = ({ orders, settings, wallet, activeStore }: Props) => {
    // Basic income statement
    // Sales, COGS, Gross Profit, Expenses, Net Income
    const stats = useMemo(() => {
        const completedOrders = orders.filter(o => o.status === 'تم_التيصيل' || o.status === 'تم_توصيلها' || o.status === 'مدفوعة' || o.status === 'مكتمل');
        let totalSales = 0;
        let cogs = 0;
        completedOrders.forEach(o => {
            o.items.forEach(item => {
                totalSales += item.price * item.quantity;
                const cost = getLatestProductCost(item.productId, settings);
                cogs += cost * item.quantity;
            });
            // add shipping revenue? or is it separate?
            const shippingRevenue = typeof o.shippingCost === 'number' ? o.shippingCost : 0;
            totalSales += shippingRevenue;
            
            // if we have actual delivery cost charged by company, it's an expense
        });

        const grossProfit = totalSales - cogs;

        // Extract expenses
        const expenseTxs = wallet.transactions.filter(t => t.type === 'سحب' && t.category && t.category.startsWith('expense_'));
        const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

        // Failed shipping losses
        const returnedOrders = orders.filter(o => o.status === 'مسترجع' || o.status === 'مرتجع' || o.status === 'فشل_التسليم');
        // Let's assume some loss from them, or we can just calculate shipping fees charged
        let shippingLosses = 0;
        returnedOrders.forEach(o => {
           // We might need to look at wallet txs for return fees
           // but for simplicity, sum transactions with type 'سحب' and category 'return' or 'shipping' that are related to losses
        });
        const returnTxs = wallet.transactions.filter(t => t.category === 'return' && t.type === 'سحب');
        const totalReturnFees = returnTxs.reduce((sum, t) => sum + t.amount, 0);

        const netProfit = grossProfit - totalExpenses - totalReturnFees;

        return { totalSales, cogs, grossProfit, totalExpenses, totalReturnFees, netProfit };
    }, [orders, settings, wallet, activeStore]);

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">1. قائمة الدخل (الأرباح والخسائر)</h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl mx-auto">
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">إجمالي الإيرادات (المبيعات)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.totalSales.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">تكلفة البضاعة المباعة (COGS)</span>
                    <span className="font-bold text-red-600 dark:text-red-400">({stats.cogs.toLocaleString('ar-EG')} ج.م)</span>
                </div>
                <div className="flex justify-between py-3 mb-2 bg-slate-100 dark:bg-slate-800 rounded px-2">
                    <span className="font-black text-slate-800 dark:text-slate-200">إجمالي الربح (Gross Profit)</span>
                    <span className="font-black text-blue-600 dark:text-blue-400">{stats.grossProfit.toLocaleString('ar-EG')} ج.م</span>
                </div>
                
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">المصروفات التشغيلية والتسويقية</span>
                    <span className="font-bold text-red-600 dark:text-red-400">({stats.totalExpenses.toLocaleString('ar-EG')} ج.م)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">خسائر المرتجعات والشحن غير الناجح</span>
                    <span className="font-bold text-red-600 dark:text-red-400">({stats.totalReturnFees.toLocaleString('ar-EG')} ج.م)</span>
                </div>
                <div className="flex justify-between py-4 mt-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg px-4 border border-purple-200 dark:border-purple-800">
                    <span className="font-black text-purple-800 dark:text-purple-300 text-lg">صافي الربح / الخسارة (Net Income)</span>
                    <span className={`font-black text-lg ${stats.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {stats.netProfit >= 0 ? '' : '-'}{Math.abs(stats.netProfit).toLocaleString('ar-EG')} ج.م
                    </span>
                </div>
            </div>
            
        </div>
    );
};

// 2. Balance Sheet
const BalanceSheet = ({ orders, settings, wallet, activeStore }: Props) => {
    const stats = useMemo(() => {
        // Assets
        const cashBalance = wallet.balance;
        
        let inventoryValue = 0;
        const products = settings?.products || activeStore?.products || [];
        products.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    inventoryValue += (v.stockQuantity || 0) * Math.max(v.costPrice ?? 0, p.costPrice || 0); // basic fallback, better to use method
                });
            } else {
                inventoryValue += (p.stockQuantity || 0) * (p.costPrice || 0);
            }
        });

        // Receivables (Pending Collection)
        let receivablesPending = 0;
        orders.forEach(o => {
            if (o.status === 'تم_توصيلها') {
                receivablesPending += o.total; // simplified, assumes COD
            }
        });

        const totalAssets = cashBalance + inventoryValue + receivablesPending;

        // Liabilities
        let accountPayables = 0;
        const suppliers = settings?.suppliers || activeStore?.suppliers || [];
        suppliers.forEach(s => {
            accountPayables += Math.max(0, s.balance || 0);
        });

        // Equity
        const totalEquity = totalAssets - accountPayables;

        return { cashBalance, inventoryValue, receivablesPending, totalAssets, accountPayables, totalEquity };
    }, [orders, settings, wallet, activeStore]);

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">2. الميزانية العمومية والمركز المالي (Balance Sheet)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets */}
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-6 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <h4 className="font-black text-emerald-800 dark:text-emerald-400 mb-4 border-b border-emerald-200 dark:border-emerald-800 pb-2">الأصول (Assets)</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">السيولة النقدية (المحفظة)</span>
                            <span className="font-bold">{stats.cashBalance.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">بضاعة في المخزن (Inventory)</span>
                            <span className="font-bold">{stats.inventoryValue.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">ذمم مدينة (معلقة لدى شركات الشحن)</span>
                            <span className="font-bold">{stats.receivablesPending.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-emerald-200 dark:border-emerald-800 mt-2 font-black text-emerald-700 dark:text-emerald-300 text-lg">
                            <span>إجمالي الأصول</span>
                            <span>{stats.totalAssets.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                    </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="bg-amber-50/50 dark:bg-amber-900/10 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
                    <h4 className="font-black text-amber-800 dark:text-amber-400 mb-4 border-b border-amber-200 dark:border-amber-800 pb-2">الخصوم وحقوق الملكية (Liabilities & Equity)</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">دائنون (موردين ومديونيات)</span>
                            <span className="font-bold text-red-600">{stats.accountPayables.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">صافي حقوق الملكية والأرباح المحتجزة</span>
                            <span className="font-bold text-blue-600">{stats.totalEquity.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between pt-[calc(1.5rem+6px)] border-t border-amber-200 dark:border-amber-800 mt-2 font-black text-amber-700 dark:text-amber-300 text-lg">
                            <span>إجمالي الخصوم وحقوق الملكية</span>
                            <span>{(stats.accountPayables + stats.totalEquity).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-sm text-slate-500 mt-2 text-center bg-slate-100 p-2 rounded">
                معادلة الميزانية: الأصول = الخصوم + حقوق الملكية
            </p>
        </div>
    );
};

// 3. Cash Flow
const CashFlowStatement = ({ wallet }: { wallet: Wallet }) => {
    const stats = useMemo(() => {
        let operatingIn = 0;
        let operatingOut = 0;
        let investingOut = 0; // equipment etc if any
        let financingIn = 0; // capital deposits
        let financingOut = 0; // partner withdraw
        
        wallet.transactions.forEach(t => {
            if (t.type === 'إيداع') {
                if (t.category === 'collection' || t.category === 'manual_deposit') {
                    operatingIn += t.amount;
                }
            } else if (t.type === 'سحب') {
                if (t.category === 'manual_withdrawal') {
                    financingOut += t.amount;
                } else if (t.category === 'inventory_purchase') {
                    operatingOut += t.amount;
                } else {
                    operatingOut += t.amount; // generic expenses
                }
            }
        });
        
        return { operatingIn, operatingOut, financingIn, financingOut, netCashFlow: (operatingIn + financingIn) - (operatingOut + financingOut) }
    }, [wallet]);

    return (
         <div className="space-y-4">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">3. تقرير التدفقات النقدية (Cash Flow)</h3>
             <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl mx-auto">
                <div className="space-y-4">
                    <div>
                        <h4 className="font-bold text-slate-700 mb-2">التدفقات من الأنشطة التشغيلية:</h4>
                        <div className="flex justify-between py-1 text-sm"><span className="text-emerald-600">متحصلات ومبيعات نقدية (+)</span><span className="font-mono">{stats.operatingIn.toLocaleString('ar-EG')}</span></div>
                        <div className="flex justify-between py-1 text-sm"><span className="text-red-600">مدفوعات ومصروفات تشغيل ومشتريات (-)</span><span className="font-mono">({stats.operatingOut.toLocaleString('ar-EG')})</span></div>
                    </div>
                    <div className="border-t pt-4 border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-2">التدفقات من الأنشطة التمويلية:</h4>
                        <div className="flex justify-between py-1 text-sm"><span className="text-red-600">مسحوبات الأرباح والشركاء (-)</span><span className="font-mono">({stats.financingOut.toLocaleString('ar-EG')})</span></div>
                    </div>
                    <div className="flex justify-between py-4 mt-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg px-4 border border-blue-200 dark:border-blue-800">
                        <span className="font-black text-blue-800 dark:text-blue-300 text-lg">صافي التدفق النقدي للفترة</span>
                        <span className={`font-black text-lg ${stats.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {stats.netCashFlow >= 0 ? '' : '-'}{Math.abs(stats.netCashFlow).toLocaleString('ar-EG')} ج.م
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 text-center">يقيس التقرير حركة "الكاش" الفعلي بغض النظر عن الأرباح الدفترية.</p>
                </div>
            </div>
        </div>
    );
};

// 4. Supplier Ledger
const SupplierLedger = ({ settings, activeStore }: Omit<Props, 'orders' | 'wallet'>) => {
    const suppliers = settings?.suppliers || activeStore?.suppliers || [];
    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">4. كشف حساب الموردين والمديونيات (Supplier Ledger)</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 w-full">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500">
                        <tr>
                            <th className="px-4 py-3 font-semibold">المورد</th>
                            <th className="px-4 py-3 font-semibold">رقم الهاتف</th>
                            <th className="px-4 py-3 font-semibold">العنوان/ملاحظات</th>
                            <th className="px-4 py-3 font-semibold">المديونية الحالية (الرصيد الدائن)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {suppliers.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold">{s.name}</td>
                                <td className="px-4 py-3 font-mono">{s.phone}</td>
                                <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{s.address || s.notes || '-'}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded font-bold ${(s.balance || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {(s.balance || 0).toLocaleString('ar-EG')} ج.م
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {suppliers.length === 0 && <tr><td colSpan={4} className="text-center p-6 text-slate-500">لا يوجد موردين</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 5. Receivables Aging
const ReceivablesAging = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const stats = useMemo(() => {
        const deliveredOrders = orders.filter(o => o.status === 'تم_توصيلها');
        const now = new Date().getTime();
        
        let aging0to7 = 0;
        let aging8to14 = 0;
        let agingOver14 = 0;

        let byCompany: Record<string, number> = {};

        deliveredOrders.forEach(o => {
            const ageDays = (now - new Date(o.shippingDate || o.date).getTime()) / (1000 * 60 * 60 * 24);
            const amt = o.total; // assuming wait total
            if (ageDays <= 7) aging0to7 += amt;
            else if (ageDays <= 14) aging8to14 += amt;
            else agingOver14 += amt;

            const comp = o.shippingCompany || 'أخرى';
            byCompany[comp] = (byCompany[comp] || 0) + amt;
        });

        return { aging0to7, aging8to14, agingOver14, byCompany, total: aging0to7 + aging8to14 + agingOver14 };
    }, [orders]);

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">5. تقرير المبالغ المعلقة والذمم لدى شركات الشحن (Receivables Aging)</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 border rounded-xl shadow-sm">
                    <h4 className="font-bold mb-4 border-b pb-2 text-slate-700">توزيع أعمار المديونية (Aging)</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-emerald-600 font-bold">حديث (1 - 7 أيام)</span><span className="font-mono">{stats.aging0to7.toLocaleString('ar-EG')} ج.م</span></div>
                        <div className="flex justify-between text-sm"><span className="text-amber-600 font-bold">متأخر القليل (8 - 14 يوم)</span><span className="font-mono">{stats.aging8to14.toLocaleString('ar-EG')} ج.م</span></div>
                        <div className="flex justify-between text-sm"><span className="text-red-600 font-bold">متأخر جداً (أكثر من 14 يوم)</span><span className="font-mono">{stats.agingOver14.toLocaleString('ar-EG')} ج.م</span></div>
                        <div className="flex justify-between text-lg font-black pt-2 border-t mt-2"><span>الإجمالي المعلق</span><span>{stats.total.toLocaleString('ar-EG')} ج.م</span></div>
                    </div>
                </div>
                <div className="bg-white p-6 border rounded-xl shadow-sm">
                    <h4 className="font-bold mb-4 border-b pb-2 text-slate-700">المبالغ حسب كل شركة (Receivables by Carrier)</h4>
                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2">
                        {Object.entries(stats.byCompany).map(([comp, amt]) => (
                             <div key={comp} className="flex justify-between text-sm">
                                <span className="font-bold text-slate-600">{comp}</span>
                                <span className="font-mono">{amt.toLocaleString('ar-EG')} ج.م</span>
                             </div>
                        ))}
                        {Object.keys(stats.byCompany).length === 0 && <span className="text-slate-500 text-sm">لا توجد مبالغ معلقة.</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// 6. Wallet Ledger
const WalletLedger = ({ wallet }: { wallet: Wallet }) => {
    return (
        <div className="space-y-4">
             <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>6. حركة الصندوق والقيود اليومية (Wallet Ledger)</span>
                <span className="text-emerald-600 text-xl">الرصيد: {wallet.balance.toLocaleString('ar-EG')} ج.م</span>
             </h3>
             <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 w-full mb-4">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500">
                        <tr>
                            <th className="px-4 py-3 font-semibold">م</th>
                            <th className="px-4 py-3 font-semibold">التاريخ</th>
                            <th className="px-4 py-3 font-semibold">النوع</th>
                            <th className="px-4 py-3 font-semibold">التصنيف</th>
                            <th className="px-4 py-3 font-semibold">المبلغ</th>
                            <th className="px-4 py-3 font-semibold">البيان / الملاحظات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:bg-slate-900">
                        {wallet.transactions.slice().reverse().map((tx, idx) => (
                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{wallet.transactions.length - idx}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-600">{new Date(tx.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'إيداع' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {tx.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{tx.category || '-'}</td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-800">{tx.amount.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={tx.note}>{tx.note || '-'}</td>
                            </tr>
                        ))}
                        {wallet.transactions.length === 0 && <tr><td colSpan={6} className="text-center p-6 text-slate-500">لا توجد حركات في الصندوق</td></tr>}
                    </tbody>
                </table>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-100 dark:border-blue-900 rounded-lg mt-4">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1">تلميح مالي:</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                    يمكنك تصدير هذه البيانات من شاشة المحفظة لإرسالها لمحاسبك للإقرارات الضريبية الدقيقة.
                </p>
            </div>
        </div>
    );
};

// 7. Product Profitability
const ProductProfitability = ({ orders, settings, activeStore }: { orders: Order[], settings: Settings, activeStore?: Store }) => {
    const stats = useMemo(() => {
        const completedOrders = orders.filter(o => o.status === 'تم_التيصيل' || o.status === 'تم_توصيلها' || o.status === 'مدفوعة' || o.status === 'مكتمل');
        
        let productStats: Record<string, {
            id: string;
            name: string;
            revenue: number;
            cogs: number;
            quantitySold: number;
        }> = {};

        completedOrders.forEach(o => {
            o.items.forEach(item => {
                const cost = getLatestProductCost(item.productId, settings);
                if (!productStats[item.productId]) {
                     const p = (settings?.products || activeStore?.products || []).find(x => x.id === item.productId);
                     productStats[item.productId] = {
                         id: item.productId,
                         name: p ? p.name : 'منتج غير معروف',
                         revenue: 0,
                         cogs: 0,
                         quantitySold: 0
                     };
                }
                productStats[item.productId].revenue += item.price * item.quantity;
                productStats[item.productId].cogs += cost * item.quantity;
                productStats[item.productId].quantitySold += item.quantity;
            });
        });

        const sortedProducts = Object.values(productStats).map(p => ({
            ...p,
            profit: p.revenue - p.cogs,
            margin: p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0
        })).sort((a, b) => b.profit - a.profit);

        return { products: sortedProducts };
    }, [orders, settings, activeStore]);

    return (
        <div className="space-y-4">
             <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">7. تحليل الأرباح التفصيلي حسب المنتج (Product Profitability)</h3>
             <p className="text-sm text-slate-500 mb-4 cursor-default">يساعدك هذا التقرير على معرفة "الأبقار الحلوب" (المنتجات الأعلى ربحية) للتركيز عليها في الحملات الإعلانية.</p>
             <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 w-full mb-4">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-4 py-3 font-semibold">المنتج</th>
                            <th className="px-4 py-3 font-semibold text-center">الكمية المباعة</th>
                            <th className="px-4 py-3 font-semibold">إجمالي المبيعات</th>
                            <th className="px-4 py-3 font-semibold">إجمالي التكلفة</th>
                            <th className="px-4 py-3 font-semibold">صافي الربح التقديري</th>
                            <th className="px-4 py-3 font-semibold">هامش الربح (%)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                        {stats.products.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{p.name}</td>
                                <td className="px-4 py-3 font-mono text-center text-slate-600 dark:text-slate-400">{p.quantitySold}</td>
                                <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{p.revenue.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{p.cogs.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded font-bold ${p.profit > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : p.profit < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                        {p.profit > 0 ? '+' : ''}{p.profit.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                     <span className={`font-bold ${p.margin >= 30 ? 'text-emerald-600 dark:text-emerald-400' : p.margin > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {p.margin.toFixed(1)}%
                                     </span>
                                </td>
                            </tr>
                        ))}
                        {stats.products.length === 0 && <tr><td colSpan={6} className="text-center p-6 text-slate-500">لا توجد مبيعات مكتملة بعد.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 8. Partner Equity & Drawings
const PartnerEquity = ({ settings, wallet }: { settings: Settings, wallet: Wallet }) => {
    const stats = useMemo(() => {
        const partners = settings?.partners || [];
        const partnerTransactions = settings?.partnerTransactions || [];

        let perPartner: Record<string, {
            id: string;
            name: string;
            capital: number; // loans + capital_addition
            drawings: number; // profit_withdrawal
            repayments: number; // repayment
            currentBalance: number; // partner.balance (might differ based on specific logic, we display what's recorded)
        }> = {};

        partners.forEach(p => {
             perPartner[p.id] = {
                 id: p.id,
                 name: p.name,
                 capital: 0,
                 drawings: 0,
                 repayments: 0,
                 currentBalance: p.balance
             };
        });

        partnerTransactions.forEach(t => {
            if (perPartner[t.partnerId]) {
                if (t.type === 'capital_addition' || t.type === 'loan') {
                    perPartner[t.partnerId].capital += t.amount;
                } else if (t.type === 'profit_withdrawal') {
                    perPartner[t.partnerId].drawings += t.amount;
                } else if (t.type === 'repayment') {
                    perPartner[t.partnerId].repayments += t.amount;
                }
            }
        });

        return { partners: Object.values(perPartner) };
    }, [settings, wallet]);

    return (
        <div className="space-y-4">
             <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-200">8. تفاصيل أرصدة ومسحوبات الشركاء (Partner Equity)</h3>
             <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 w-full mb-4">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-4 py-3 font-semibold">الشريك</th>
                            <th className="px-4 py-3 font-semibold">رأس المال والإيداعات المضافة</th>
                            <th className="px-4 py-3 font-semibold">المسحوبات الشخصية (للأرباح)</th>
                            <th className="px-4 py-3 font-semibold">السدادات للمديونية</th>
                            <th className="px-4 py-3 font-semibold text-lg">الرصيد المتبقي له</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                        {stats.partners.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{p.name}</td>
                                <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">+{p.capital.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-3 font-mono text-red-600 dark:text-red-400">-{p.drawings.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400">-{p.repayments.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-3 py-1.5 rounded-lg font-black text-lg ${p.currentBalance > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : p.currentBalance < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                        {p.currentBalance.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {stats.partners.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-slate-500">لا يوجد شركاء مسجلين. للتسجيل، توجه إلى "المحفظة".</td></tr>}
                    </tbody>
                </table>
            </div>
            <p className="text-sm text-slate-500 text-center">يمثل هذا التقرير كشف حساب لكل شريك (رأس المال المضاف والمسحوبات).</p>
        </div>
    );
};
