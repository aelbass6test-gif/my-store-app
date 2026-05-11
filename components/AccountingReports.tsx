import React, { useState, useMemo } from 'react';
import { Order, Settings, Wallet, Store, OrderStatus } from '../types';
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
    
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-0 overflow-hidden animate-in fade-in-5 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
                        <BarChart size={24} />
                    </div>
                    <span>الحسابات الختامية والتقارير المالية</span>
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Printer size={16} /> طباعة
                    </button>
                </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800 flex gap-2">
                <TabButton active={subTab === 'income'} onClick={() => setSubTab('income')} icon={<TrendingUp size={16} />} title="قائمة الدخل" />
                <TabButton active={subTab === 'balance_sheet'} onClick={() => setSubTab('balance_sheet')} icon={<DollarSign size={16} />} title="الميزانية العمومية" />
                <TabButton active={subTab === 'cash_flow'} onClick={() => setSubTab('cash_flow')} icon={<ArrowUp size={16} />} title="التدفقات النقدية" />
                <TabButton active={subTab === 'product_profitability'} onClick={() => setSubTab('product_profitability')} icon={<Package size={16} />} title="أرباح المنتجات" />
                <TabButton active={subTab === 'suppliers'} onClick={() => setSubTab('suppliers')} icon={<Users size={16} />} title="حساب الموردين" />
                <TabButton active={subTab === 'receivables'} onClick={() => setSubTab('receivables')} icon={<Truck size={16} />} title="ذمم الشحن" />
                <TabButton active={subTab === 'partner_equity'} onClick={() => setSubTab('partner_equity')} icon={<PieChart size={16} />} title="حقوق الشركاء" />
                <TabButton active={subTab === 'wallet'} onClick={() => setSubTab('wallet')} icon={<WalletIcon size={16} />} title="حركة الصندوق" />
            </div>

            <div className="p-6 min-h-[500px]">
                {subTab === 'income' && <IncomeStatement orders={orders} settings={settings} wallet={wallet} />}
                {subTab === 'balance_sheet' && <BalanceSheet orders={orders} settings={settings} wallet={wallet} />}
                {subTab === 'cash_flow' && <CashFlowStatement wallet={wallet} />}
                {subTab === 'suppliers' && <SupplierLedger settings={settings} />}
                {subTab === 'receivables' && <ReceivablesAging orders={orders} />}
                {subTab === 'wallet' && <WalletLedger wallet={wallet} />}
                {subTab === 'product_profitability' && <ProductProfitability orders={orders} settings={settings} />}
                {subTab === 'partner_equity' && <PartnerEquity settings={settings} wallet={wallet} />}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-sm border-2 ${active ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200 dark:shadow-none translate-y-[-1px]' : 'bg-white dark:bg-slate-800 text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
    >
        {icon} {title}
    </button>
);

// 1. Income Statement
const IncomeStatement = ({ orders, settings, wallet }: Omit<Props, 'activeStore'>) => {
    const stats = useMemo(() => {
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
        let productRevenue = 0;
        let shippingRevenue = 0;
        let cogs = 0;
        let insuranceFees = 0;
        let inspectionFees = 0;

        completedOrders.forEach(o => {
            o.items.forEach(item => {
                productRevenue += item.price * item.quantity;
                const cost = getLatestProductCost(item.productId, settings);
                cogs += cost * item.quantity;
            });
            shippingRevenue += (o.shippingFee || 0);

            insuranceFees += (o.insuranceFee || 0);
            inspectionFees += (o.inspectionFee || 0);
        });

        // Expenses from wallet
        const expenseTxs = wallet.transactions.filter(t => t.type === 'سحب' && t.category && t.category.startsWith('expense_'));
        const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

        // Losses from returns
        const returnTxs = wallet.transactions.filter(t => t.category === 'return' && t.type === 'سحب');
        const totalReturnFees = returnTxs.reduce((sum, t) => sum + t.amount, 0);

        const totalRevenue = productRevenue + shippingRevenue;
        const grossProfit = totalRevenue - cogs;
        const netProfit = grossProfit - totalExpenses - totalReturnFees - insuranceFees - inspectionFees;

        return { 
            productRevenue, shippingRevenue, totalRevenue, 
            cogs, grossProfit, totalExpenses, totalReturnFees, 
            insuranceFees, inspectionFees, netProfit,
            margin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
        };
    }, [orders, settings, wallet]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard title="إجمالي الإيرادات" value={stats.totalRevenue} color="indigo" icon={<TrendingUp size={20} />} />
                <SummaryCard title="إجمالي الربح" value={stats.grossProfit} color="emerald" icon={<DollarSign size={20} />} />
                <SummaryCard title="صافي الدخل" value={stats.netProfit} color="purple" icon={<BarChart size={20} />} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">قائمة الدخل للفترة الحالية</h3>
                    <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold rounded-full">استحقاق تقديري</div>
                </div>
                
                <div className="space-y-4">
                    <ReportRow label="إيرادات المنتجات" value={stats.productRevenue} />
                    <ReportRow label="إيرادات خدمات الشحن" value={stats.shippingRevenue} />
                    <ReportRow label="إجمالي الإيرادات" value={stats.totalRevenue} isBold />
                    
                    <div className="pt-4 space-y-3">
                        <ReportRow label="تكلفة البضاعة المباعة (COGS)" value={-stats.cogs} color="red" />
                        <ReportRow label="إجمالي الربح (الربح الإجمالي)" value={stats.grossProfit} isBold highlight />
                    </div>

                    <div className="pt-4 space-y-3">
                        <ReportRow label="المصروفات التشغيلية" value={-stats.totalExpenses} color="red" />
                        <ReportRow label="رسوم المرتجعات والخسائر" value={-stats.totalReturnFees} color="red" />
                        <ReportRow label="مصاريف التأمين والمعاينة" value={-(stats.insuranceFees + stats.inspectionFees)} color="red" />
                    </div>

                    <div className="pt-6 border-t">
                        <ReportRow label="صافي الربح / (الخسارة)" value={stats.netProfit} isBold isLarge highlight color={stats.netProfit >= 0 ? 'emerald' : 'red'} />
                        <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                            <span>نسبة هامش الربح الإجمالي</span>
                            <span className="font-bold">{stats.margin.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, value, color, icon }: { title: string; value: number; color: 'indigo' | 'emerald' | 'purple' | 'red'; icon: React.ReactNode }) => {
    const bgColors = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800 text-indigo-600',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800 text-emerald-600',
        purple: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800 text-purple-600',
        red: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800 text-red-600'
    };
    
    return (
        <div className={`p-5 rounded-2xl border-2 ${bgColors[color]} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold opacity-80">{title}</span>
                {icon}
            </div>
            <p className="text-2xl font-black">{Math.abs(value).toLocaleString('ar-EG')} <span className="text-xs">ج.م</span></p>
        </div>
    );
};

const ReportRow = ({ label, value, isBold, isLarge, highlight, color = 'slate' }: { label: string; value: number; isBold?: boolean; isLarge?: boolean; highlight?: boolean; color?: 'slate' | 'red' | 'emerald' | 'indigo' }) => {
    const textColors = {
        slate: 'text-slate-700 dark:text-slate-300',
        red: 'text-red-600 dark:text-red-400 font-bold',
        emerald: 'text-emerald-600 dark:text-emerald-400 font-bold',
        indigo: 'text-indigo-600 dark:text-indigo-400 font-bold'
    };
    
    return (
        <div className={`flex justify-between items-center py-2 px-3 rounded-xl transition-colors ${highlight ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}>
            <span className={`${isBold ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500'} ${isLarge ? 'text-lg' : 'text-sm'}`}>{label}</span>
            <span className={`${textColors[color]} ${isBold ? 'font-black' : 'font-mono'} ${isLarge ? 'text-xl' : 'text-md'}`}>
                {value < 0 ? '(' : ''}{Math.abs(value).toLocaleString('ar-EG')}{value < 0 ? ')' : ''} ج.م
            </span>
        </div>
    );
};

// 2. Balance Sheet
const BalanceSheet = ({ orders, settings, wallet }: Omit<Props, 'activeStore'>) => {
    const stats = useMemo(() => {
        // Assets
        const cashBalance = wallet.balance;
        
        let inventoryValue = 0;
        const products = settings?.products || [];
        products.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    inventoryValue += (v.stockQuantity || 0) * Math.max(v.costPrice ?? 0, p.costPrice || 0);
                });
            } else {
                inventoryValue += (p.stockQuantity || 0) * (p.costPrice || 0);
            }
        });

        // Receivables (Pending Collection) - specifically orders delivered but not yet remitted
        let receivablesPending = orders
            .filter(o => o.status === 'تم_توصيلها')
            .reduce((sum, o) => sum + (o.productPrice + (o.shippingFee || 0) - (o.discount || 0)), 0);

        const totalAssets = cashBalance + inventoryValue + receivablesPending;

        // Liabilities
        const suppliers = settings?.suppliers || [];
        const accountPayables = suppliers.reduce((sum, s) => sum + Math.max(0, s.balance || 0), 0);

        // Equity
        const totalEquity = totalAssets - accountPayables;

        return { cashBalance, inventoryValue, receivablesPending, totalAssets, accountPayables, totalEquity };
    }, [orders, settings, wallet]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SummaryCard title="إجمالي الأصول" value={stats.totalAssets} color="emerald" icon={<Package size={20} />} />
                <SummaryCard title="إجمالي الخصوم وحقوق الملكية" value={stats.accountPayables + stats.totalEquity} color="indigo" icon={<Users size={20} />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 border-b border-emerald-100 dark:border-emerald-800/50">
                        <h4 className="font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                             الأصول المتداولة (Assets)
                        </h4>
                    </div>
                    <div className="p-6 space-y-4">
                        <ReportRow label="السيولة النقدية (المحفظة)" value={stats.cashBalance} />
                        <ReportRow label="بضاعة في المخزن (Inventory)" value={stats.inventoryValue} />
                        <ReportRow label="ذمم مدينة (معلقة لدى شركات الشحن)" value={stats.receivablesPending} />
                        <div className="pt-4 border-t">
                            <ReportRow label="إجمالي الأصول" value={stats.totalAssets} isBold isLarge color="emerald" />
                        </div>
                    </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 border-b border-amber-100 dark:border-amber-800/50">
                        <h4 className="font-black text-amber-800 dark:text-amber-400 flex items-center gap-2">
                            الخصوم وحقوق الملكية (Liabilities & Equity)
                        </h4>
                    </div>
                    <div className="p-6 space-y-4">
                        <ReportRow label="دائنون (حسابات الموردين)" value={-stats.accountPayables} color="red" />
                        <div className="pt-2">
                            <ReportRow label="صافي حقوق الملكية" value={stats.totalEquity} />
                            <p className="text-[10px] text-slate-400 px-3 mt-1">تتضمن رأس المال والأرباح المحتجزة</p>
                        </div>
                        <div className="pt-4 border-t">
                            <ReportRow label="إجمالي الخصوم وحقوق الملكية" value={stats.accountPayables + stats.totalEquity} isBold isLarge color="indigo" />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                    <FileText size={14} /> المعادلة المحاسبية: الأصول ({stats.totalAssets.toLocaleString('ar-EG')}) = الخصوم ({stats.accountPayables.toLocaleString('ar-EG')}) + حقوق الملكية ({stats.totalEquity.toLocaleString('ar-EG')})
                </span>
            </div>
        </div>
    );
};

// 3. Cash Flow
const CashFlowStatement = ({ wallet }: { wallet: Wallet }) => {
    const stats = useMemo(() => {
        let operatingIn = 0;
        let operatingOut = 0;
        let financingIn = 0; 
        let financingOut = 0;
        
        wallet.transactions.forEach(t => {
            if (t.type === 'إيداع') {
                if (t.category === 'collection') {
                    operatingIn += t.amount;
                } else if (t.category === 'manual_deposit' || t.category === 'capital_addition') {
                    financingIn += t.amount;
                } else {
                    operatingIn += t.amount;
                }
            } else if (t.type === 'سحب') {
                if (t.category === 'manual_withdrawal' || t.category === 'profit_withdrawal') {
                    financingOut += t.amount;
                } else if (t.category === 'inventory_purchase') {
                    operatingOut += t.amount;
                } else {
                    operatingOut += t.amount;
                }
            }
        });
        
        const netCashFlow = (operatingIn + financingIn) - (operatingOut + financingOut);
        return { operatingIn, operatingOut, financingIn, financingOut, netCashFlow };
    }, [wallet]);

    return (
         <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SummaryCard title="صافي التدفق النقدي" value={stats.netCashFlow} color={stats.netCashFlow >= 0 ? 'emerald' : 'red'} icon={<WalletIcon size={20} />} />
                <SummaryCard title="إجمالي المتحصلات" value={stats.operatingIn + stats.financingIn} color="indigo" icon={<ArrowDown size={20} />} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between border-b pb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">تقرير التدفقات النقدية (Cash Flow)</h3>
                    <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-full">الأساس النقدي</div>
                </div>

                <div className="space-y-6">
                    <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500"></div> الأنشطة التشغيلية
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
                            <ReportRow label="متحصلات من عملاء (تحصيل شحن)" value={stats.operatingIn} color="emerald" />
                            <ReportRow label="مدفوعات مشتريات ومصروفات" value={-stats.operatingOut} color="red" />
                            <div className="pt-2 border-t mt-1">
                                <ReportRow label="صافي التدفق من التشغيل" value={stats.operatingIn - stats.operatingOut} isBold />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500"></div> الأنشطة التمويلية والرأسمالية
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
                            <ReportRow label="زيادات رأس المال / إيداعات الشركاء" value={stats.financingIn} color="emerald" />
                            <ReportRow label="مسحوبات الشركاء / الأرباح" value={-stats.financingOut} color="red" />
                            <div className="pt-2 border-t mt-1">
                                <ReportRow label="صافي التدفق من التمويل" value={stats.financingIn - stats.financingOut} isBold />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <ReportRow label="صافي الزيادة / (النقص) في النقدية" value={stats.netCashFlow} isBold isLarge highlight color={stats.netCashFlow >= 0 ? 'emerald' : 'red'} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// 4. Supplier Ledger
const SupplierLedger = ({ settings }: Omit<Props, 'orders' | 'wallet' | 'activeStore'>) => {
    const suppliers = settings?.suppliers || [];
    
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white px-2">كشف حساب الموردين والمديونيات</h3>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-bold">المورد</th>
                            <th className="px-6 py-4 font-bold">رقم الهاتف</th>
                            <th className="px-6 py-4 font-bold text-center">المديونية الحالية</th>
                            <th className="px-6 py-4 font-bold">ملاحظات العنوان</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {suppliers.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-black text-slate-800 dark:text-slate-200">{s.name}</div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{s.phone}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex px-3 py-1 rounded-full font-black text-xs ${(s.balance || 0) > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                        {(s.balance || 0).toLocaleString('ar-EG')} ج.م
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-[200px]">{s.address || s.notes || '-'}</td>
                            </tr>
                        ))}
                        {suppliers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center py-20 text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users size={40} className="opacity-20" />
                                        <p>لا يوجد موردين مسجلين</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 5. Receivables Aging
const ReceivablesAging = ({ orders }: { orders: Order[] }) => {
    const stats = useMemo(() => {
        const deliveredOrders = orders.filter(o => o.status === 'تم_توصيلها');
        const now = new Date().getTime();
        
        let aging0to7 = 0;
        let aging8to14 = 0;
        let agingOver14 = 0;

        let byCompany: Record<string, number> = {};

        deliveredOrders.forEach(o => {
            const ageDays = (now - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24);
            const amt = (o.productPrice + (o.shippingFee || 0) - (o.discount || 0));
            if (ageDays <= 7) aging0to7 += amt;
            else if (ageDays <= 14) aging8to14 += amt;
            else agingOver14 += amt;

            const comp = o.shippingCompany || 'أخرى';
            byCompany[comp] = (byCompany[comp] || 0) + amt;
        });

        return { aging0to7, aging8to14, agingOver14, byCompany, total: aging0to7 + aging8to14 + agingOver14 };
    }, [orders]);

    return (
        <div className="space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SummaryCard title="إجمالي المستحقات المعلقة" value={stats.total} color="indigo" icon={<Truck size={20} />} />
                <SummaryCard title="مبالغ متأخرة جداً" value={stats.agingOver14} color="red" icon={<FileText size={20} />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                    <h4 className="font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
                        <TrendingUp size={18} className="text-purple-500" /> أعمار المديونية لدى شركات الشحن
                    </h4>
                    <div className="space-y-4">
                        <AgingProgressBar label="حديث (1 - 7 أيام)" value={stats.aging0to7} total={stats.total} color="emerald" />
                        <AgingProgressBar label="متأخر (8 - 14 يوم)" value={stats.aging8to14} total={stats.total} color="amber" />
                        <AgingProgressBar label="متأخر جداً (+14 يوم)" value={stats.agingOver14} total={stats.total} color="red" />
                        
                        <div className="pt-4 border-t mt-4 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl">
                            <span className="font-black text-slate-700 dark:text-slate-300">الإجمالي المعلق</span>
                            <span className="text-xl font-black text-purple-600">{stats.total.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                    <h4 className="font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
                        <Users size={18} className="text-indigo-500" /> التوزيع حسب شركة الشحن
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(stats.byCompany).sort((a,b) => b[1] - a[1]).map(([comp, amt]) => (
                             <div key={comp} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <span className="font-bold text-slate-600 dark:text-slate-400">{comp}</span>
                                <span className="font-black text-slate-800 dark:text-slate-200">{amt.toLocaleString('ar-EG')} ج.م</span>
                             </div>
                        ))}
                        {Object.keys(stats.byCompany).length === 0 && (
                            <div className="text-center py-10 opacity-30">
                                <Truck size={40} className="mx-auto mb-2" />
                                <p>لا توجد مبالغ معلقة حالياً</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const AgingProgressBar = ({ label, value, total, color }: { label: string; value: number; total: number; color: 'emerald' | 'amber' | 'red' }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const colors = {
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500'
    };
    const textColors = {
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
        red: 'text-red-600'
    };
    
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">{label}</span>
                <span className={textColors[color]}>{value.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-1000 ${colors[color]}`} 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

// 6. Wallet Ledger
const WalletLedger = ({ wallet }: { wallet: Wallet }) => {
    const transactionsWithRunningBalance = useMemo(() => {
        const txs = [...wallet.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let current = 0;
        return txs.map(tx => {
            if (tx.type === 'إيداع') current += tx.amount;
            else current -= tx.amount;
            return { ...tx, runningBalance: current };
        }).reverse(); // Display latest first
    }, [wallet.transactions]);

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">حركة الصندوق والقيود اليومية التفصيلية</h3>
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 px-6 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                    <WalletIcon size={20} className="text-emerald-500" />
                    <div>
                        <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-wider">الرصيد الحالي</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none">{wallet.balance.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-4 py-4 font-bold text-center">التاريخ</th>
                            <th className="px-4 py-4 font-bold">النوع</th>
                            <th className="px-4 py-4 font-bold">التصنيف</th>
                            <th className="px-4 py-4 font-bold">المبلغ</th>
                            <th className="px-4 py-4 font-bold">الرصيد التراكمي</th>
                            <th className="px-4 py-4 font-bold">البيان / الملاحظات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {transactionsWithRunningBalance.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-4 text-center">
                                    <div className="text-[10px] font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('ar-EG')}</div>
                                    <div className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${tx.type === 'إيداع' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {tx.type}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 uppercase">{tx.category || 'عام'}</span>
                                </td>
                                <td className="px-4 py-4 font-black text-slate-800 dark:text-slate-200">
                                    {tx.type === 'إيداع' ? '+' : '-'}{tx.amount.toLocaleString('ar-EG')}
                                </td>
                                <td className="px-4 py-4 font-mono text-xs font-bold text-slate-400">
                                    {tx.runningBalance.toLocaleString('ar-EG')} ج.م
                                </td>
                                <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-[250px] whitespace-normal leading-relaxed">{tx.note || '-'}</td>
                            </tr>
                        ))}
                        {transactionsWithRunningBalance.length === 0 && (
                             <tr>
                                <td colSpan={6} className="text-center py-20 text-slate-400 opacity-20">
                                     <WalletIcon size={48} className="mx-auto mb-2" />
                                     <p>لا توجد حركات مسجلة</p>
                                </td>
                             </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 7. Product Profitability
const ProductProfitability = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const stats = useMemo(() => {
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
        
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
                     const p = (settings?.products || []).find(x => x.id === item.productId);
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
    }, [orders, settings]);

    return (
        <div className="space-y-6">
             <div className="px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">تحليل ربحية المنتجات</h3>
                <p className="text-sm text-slate-500 mt-1">ترتيب المنتجات حسب صافي الربح التقديري (بعد خصم تكلفة البضاعة)</p>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-bold">المنتج</th>
                            <th className="px-4 py-4 font-bold text-center">الكمية</th>
                            <th className="px-4 py-4 font-bold">المبيعات</th>
                            <th className="px-4 py-4 font-bold">التكلفة</th>
                            <th className="px-4 py-4 font-bold">الربح التقديري</th>
                            <th className="px-6 py-4 font-bold text-center">الهامش</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats.products.map((p, idx) => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">{idx + 1}</div>
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-center font-black text-blue-600">{p.quantitySold}</td>
                                <td className="px-4 py-4 font-mono text-xs">{p.revenue.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-4 font-mono text-xs text-slate-400">{p.cogs.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-4">
                                    <span className={`font-black ${p.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {p.profit > 0 ? '+' : ''}{p.profit.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                     <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black ${p.margin >= 30 ? 'bg-emerald-100 text-emerald-700' : p.margin > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        {p.margin.toFixed(1)}%
                                     </div>
                                </td>
                            </tr>
                        ))}
                        {stats.products.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-20 text-slate-400 opacity-20">
                                     <Package size={48} className="mx-auto mb-2" />
                                     <p>لا توجد بيانات مبيعات مكتملة</p>
                                </td>
                            </tr>
                        )}
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
            capital: number;
            drawings: number;
            repayments: number;
            currentBalance: number;
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
        <div className="space-y-6">
             <div className="px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">مراكز حقوق الشركاء والمسحوبات</h3>
                <p className="text-sm text-slate-500 mt-1">متابعة إيداعات الشركاء الرأسمالية والمسحوبات الشخصية لكل شريك</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.partners.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-bl-[100%] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-black text-xl">
                                    {p.name.charAt(0)}
                                </div>
                                <h4 className="font-black text-slate-800 dark:text-white text-lg">{p.name}</h4>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">رأس المال المضاف (+)</span>
                                    <span className="font-bold text-emerald-600">{p.capital.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">المسحوبات الشخصية (-)</span>
                                    <span className="font-bold text-red-600">{p.drawings.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">السدادات للمديونية (-)</span>
                                    <span className="font-bold text-amber-600">{p.repayments.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">الرصيد الجاري المستحق له</p>
                                <p className={`text-2xl font-black ${p.currentBalance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                                    {p.currentBalance.toLocaleString('ar-EG')} <span className="text-sm">ج.م</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                
                {stats.partners.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-30">
                        <Users size={60} className="mx-auto mb-4" />
                        <p className="text-lg">لا يوجد شركاء مسجلين</p>
                    </div>
                )}
             </div>
        </div>
    );
};
