import React, { useMemo, useState } from 'react';
import { Order, Settings, Wallet, Store } from '../types';
import { FileText, TrendingUp, Package, Truck, DollarSign, ArrowUp, ArrowDown, PieChart as PieChartIcon, Printer, AlertTriangle, MapPin, Calendar, Wallet as WalletIcon, Download, Loader2 } from 'lucide-react';
import { calculateOrderProfitLoss, calculateCodFee } from '../utils/financials';
import { generateLossesReportHTML, generateComprehensiveFinancialReportHTML } from '../utils/reportGenerator';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend } from 'recharts';

interface ReportsPageProps {
  orders: Order[];
  settings: Settings;
  wallet: Wallet;
  activeStore?: Store;
}

const ReportCard: React.FC<{ title: string; value: string; icon: React.ReactNode; subValue?: string; color: 'emerald' | 'red' | 'amber' | 'blue'; tooltip?: string }> = ({ title, value, icon, subValue, color, tooltip }) => {
    const colorClasses = {
        emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', border: 'border-emerald-200 dark:border-emerald-800' },
        red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600', border: 'border-red-200 dark:border-red-800' },
        amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', border: 'border-amber-200 dark:border-amber-800' },
        blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600', border: 'border-blue-200 dark:border-blue-800' },
    };
    const currentColors = colorClasses[color];

    return (
        <div className={`p-6 rounded-2xl border ${currentColors.border} bg-white dark:bg-slate-900 shadow-sm relative group`} title={tooltip}>
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        {title}
                        {tooltip && <span className="text-slate-300 cursor-help">ⓘ</span>}
                    </h3>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p>
                    {subValue && <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{subValue}</p>}
                </div>
                <div className={`p-3 rounded-xl ${currentColors.bg} ${currentColors.text}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

const SalesSummaryReport: React.FC<Omit<ReportsPageProps, 'activeStore'>> = ({ orders, settings, wallet }) => {
    const reportData = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const currentMonthOrders = orders.filter(o => {
            const d = new Date(o.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthOrders = orders.filter(o => {
            const d = new Date(o.date);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });

        const getRevenue = (os: Order[]) => os.filter(o => o.status === 'تم_التحصيل').reduce((sum, o) => sum + (o.productPrice + o.shippingFee - (o.discount || 0)), 0);
        
        const currentRevenue = getRevenue(currentMonthOrders);
        const prevRevenue = getRevenue(prevMonthOrders);
        const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const collectedOrders = orders.filter(o => o.status === 'تم_التحصيل');
        const totalProductRevenue = collectedOrders.reduce((sum, o) => sum + o.productPrice, 0);
        const totalRevenue = collectedOrders.reduce((sum, o) => sum + (o.productPrice + o.shippingFee - (o.discount || 0)), 0);
        const totalOrders = orders.length;
        const avgOrderValue = collectedOrders.length > 0 ? totalRevenue / collectedOrders.length : 0;
        
        let totalProfit = 0;
        let totalLoss = 0;
        orders.forEach(order => {
            const { net } = calculateOrderProfitLoss(order, settings);
            if (net > 0) totalProfit += net;
            else totalLoss += Math.abs(net);
        });

        const totalExpenses = wallet.transactions.filter(t => t.category?.startsWith('expense_')).reduce((sum, t) => sum + t.amount, 0);
        
        // Daily Sales for Chart
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const salesTrend = last7Days.map(date => {
            const dayOrders = orders.filter(o => o.date.startsWith(date) && o.status === 'تم_التحصيل');
            return {
                date: date.split('-').slice(1).join('/'),
                revenue: dayOrders.reduce((sum, o) => sum + (o.productPrice + o.shippingFee), 0)
            };
        });

        const productPerformance = settings.products.map(product => {
            const soldItems = orders.flatMap(o => o.items).filter(i => i.productId === product.id && (orders.find(ord => ord.items.includes(i))?.status === 'تم_التحصيل' || orders.find(ord => ord.items.includes(i))?.status === 'تم_توصيلها'));
            const quantitySold = soldItems.reduce((sum, i) => sum + i.quantity, 0);
            return { name: product.name, quantitySold };
        }).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);

        const shippingPerformance: { name: string; count: number; successRate: number }[] = [];
        const companies = Object.keys(settings.shippingOptions);
        companies.forEach(company => {
            const companyOrders = orders.filter(o => o.shippingCompany === company);
            if (companyOrders.length > 0) {
                const successful = companyOrders.filter(o => o.status === 'تم_التحصيل' || o.status === 'تم_توصيلها').length;
                shippingPerformance.push({ name: company, count: companyOrders.length, successRate: (successful / companyOrders.length) * 100 });
            }
        });

        return { 
            totalRevenue, totalProductRevenue, totalOrders, avgOrderValue, 
            totalProfit, totalLoss, totalExpenses, 
            netFinancial: totalProfit - totalLoss - totalExpenses, 
            productPerformance, shippingPerformance,
            salesTrend, revenueGrowth, currentRevenue
        };
    }, [orders, settings, wallet]);

    const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

    return (
         <div className="space-y-6">
            <div className="flex justify-between items-end">
                <h2 className="text-xl font-bold text-slate-700 dark:text-white">الملخص المالي</h2>
                <div className="text-left">
                    <p className="text-xs font-bold text-slate-400 uppercase">نمو مبيعات الشهر الحالي</p>
                    <p className={`text-lg font-black flex items-center gap-1 ${reportData.revenueGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {reportData.revenueGrowth >= 0 ? <ArrowUp size={16}/> : <ArrowDown size={16}/>}
                        {Math.abs(reportData.revenueGrowth).toFixed(1)}%
                    </p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <ReportCard title="إجمالي الأرباح" value={`${reportData.totalProfit.toLocaleString('ar-EG')} ج.م`} icon={<ArrowUp size={24}/>} color='emerald' tooltip="مجموع الأرباح الصافية من جميع الطلبات الناجحة (بعد خصم تكلفة المنتجات ومصاريف الشحن والرسوم)." />
                <ReportCard title="إجمالي الخسائر" value={`${reportData.totalLoss.toLocaleString('ar-EG')} ج.م`} icon={<ArrowDown size={24}/>} color='red' tooltip="مجموع مصاريف الشحن المهدرة للطلبات المرتجعة والفاشلة." />
                <ReportCard title="مبيعات المنتجات" value={`${reportData.totalProductRevenue.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color='blue' tooltip="إجمالي قيمة المنتجات المباعة في الطلبات الناجحة (بالسعر الأساسي)." />
                <ReportCard title="إجمالي المصروفات" value={`${reportData.totalExpenses.toLocaleString('ar-EG')} ج.م`} icon={<DollarSign size={24}/>} color='amber' tooltip="مجموع المصروفات الإدارية المسجلة (إعلانات، رواتب، إلخ)." />
                <ReportCard title="صافي المركز المالي" value={`${reportData.netFinancial.toLocaleString('ar-EG')} ج.م`} icon={<PieChartIcon size={24}/>} color='blue' tooltip="الربح النهائي بعد خصم الخسائر والمصروفات من إجمالي الأرباح (إجمالي الأرباح - إجمالي الخسائر - إجمالي المصروفات)." />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><TrendingUp/> منحنى المبيعات (آخر 7 أيام)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={reportData.salesTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', direction: 'rtl' }} />
                                <Line type="monotone" dataKey="revenue" name="الإيرادات" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Package/> المنتجات الأكثر مبيعاً</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.productPerformance} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} reversed />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', direction: 'rtl' }} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
                                <Bar dataKey="quantitySold" name="الكمية المباعة" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={15}>
                                     {reportData.productPerformance.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Truck/> أداء شركات الشحن</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reportData.shippingPerformance.map(company => (
                         <div key={company.name} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h4 className="font-bold text-slate-700 dark:text-white">{company.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي الطلبات: {company.count}</p>
                            <div className="mt-3">
                                <div className="flex justify-between items-center text-xs font-bold mb-1">
                                    <span className="text-emerald-600 dark:text-emerald-400">نسبة النجاح</span>
                                    <span>{company.successRate.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${company.successRate}%` }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LossesReport: React.FC<Omit<ReportsPageProps, 'wallet'>> = ({ orders, settings, activeStore }) => {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [isContinuous, setIsContinuous] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const failedOrders = useMemo(() => {
        return orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status))
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders]);

    const stats = useMemo(() => {
        let totalLoss = 0;
        failedOrders.forEach(order => {
            const { loss } = calculateOrderProfitLoss(order, settings);
            totalLoss += loss;
        });
        return { totalLoss, count: failedOrders.length };
    }, [failedOrders, settings]);

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const storeName = activeStore?.name || 'متجري';
            const html = generateLossesReportHTML(failedOrders, settings, storeName, orientation, isContinuous);
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
            }
        } catch (error) {
            console.error('PDF Export Error:', error);
            handlePrint();
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        const storeName = activeStore?.name || 'متجري';
        const html = generateLossesReportHTML(failedOrders, settings, storeName, orientation);
        const win = window.open('', '_blank');
        if(win) {
            win.document.write(html);
            win.document.close();
        } else {
            alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.');
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-700 dark:text-white">تفاصيل الخسائر من الطلبات المرتجعة والفاشلة</h2>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setIsContinuous(false)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            صفحات
                        </button>
                        <button 
                            onClick={() => setIsContinuous(true)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            متصل
                        </button>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setOrientation('portrait')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            طولي
                        </button>
                        <button 
                            onClick={() => setOrientation('landscape')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            عرضي
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExportPDF} 
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}
                            تصدير PDF
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            <Printer size={16}/> طباعة
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="text-sm text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-r-4 border-red-500">
                <strong>شرح توضيحي:</strong> يعرض هذا القسم تفاصيل الطلبات التي لم تنجح (مرتجع، فشل توصيل). يوضح تكلفة الشحن المهدرة وأي رسوم أخرى تحملتها، مع توضيح المنتجات والكميات المرتجعة في كل طلب لتسهيل مراجعة المخزون.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportCard title="إجمالي الخسائر المقدرة" value={`${stats.totalLoss.toLocaleString('ar-EG')} ج.م`} icon={<ArrowDown size={24}/>} color="red" tooltip="إجمالي المبالغ المهدرة على مصاريف الشحن للطلبات التي لم يتم تسليمها." />
                <ReportCard title="عدد الطلبات الفاشلة/المرتجعة" value={stats.count.toString()} icon={<AlertTriangle size={24}/>} color="amber" tooltip="إجمالي عدد الطلبات التي حالتها مرتجع أو فشل توصيل." />
            </div>
             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">سجل الطلبات</h3>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                           <tr>
                                <th className="px-4 py-3" title="اسم العميل ورقم هاتفه.">العميل</th>
                                <th className="px-4 py-3" title="المنتجات التي تم طلبها.">المنتجات</th>
                                <th className="px-4 py-3 text-center" title="إجمالي عدد القطع في الطلب.">الكمية</th>
                                <th className="px-4 py-3" title="سعر بيع المنتجات للعميل.">السعر</th>
                                <th className="px-4 py-3" title="تكلفة الشحن المدفوعة لشركة الشحن.">الشحن</th>
                                <th className="px-4 py-3" title="رسوم التأمين والمعاينة إن وجدت.">تأمين/معاينة</th>
                                <th className="px-4 py-3" title="تكلفة البضاعة الأصلية (سعر الجملة).">التكلفة</th>
                                <th className="px-4 py-3" title="حالة الطلب الحالية.">الحالة</th>
                                <th className="px-4 py-3" title="حالة تحصيل الأموال من شركة الشحن.">الدفع</th>
                                <th className="px-4 py-3 text-center" title="قيمة الخسارة الناتجة عن هذا الطلب (عادة مصاريف الشحن المهدرة).">الخسارة/التحصيل</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {failedOrders.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-12 text-slate-400">لا توجد طلبات فاشلة أو مرتجعة.</td></tr>
                            ) : (
                                failedOrders.map(order => {
                                    const { loss } = calculateOrderProfitLoss(order, settings);
                                    const codFee = calculateCodFee(order, settings);
                                    
                                    const compFees = settings.companySpecificFees?.[order.shippingCompany];
                                    const useCustom = compFees?.useCustomFees ?? false;
                                    const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
                                    const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
                                    const isInsured = order.isInsured ?? true;
                                    const insuranceFee = isInsured ? ((order.productPrice + order.shippingFee) * insuranceRate) / 100 : 0;

                                    const productsList = order.items.map(i => `${i.name} (الكمية: ${i.quantity})`).join(' + ') || order.productName;

                                    return (
                                        <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs">
                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{order.customerName}</td>
                                            <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={productsList}>{productsList}</td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                                            <td className="px-4 py-3 font-mono">{order.productPrice.toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono">{order.shippingFee.toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono">{(insuranceFee + inspectionCost).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono">{order.productCost.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full whitespace-nowrap">
                                                    {order.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] text-slate-500">{order.paymentStatus}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="font-black text-red-600">-{loss.toLocaleString()}</div>
                                                {codFee > 0 && <div className="text-[9px] text-slate-400">تحصيل: {codFee}</div>}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};

const ComprehensiveReport: React.FC<ReportsPageProps> = ({ orders, settings, wallet, activeStore }) => {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [isContinuous, setIsContinuous] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const stats = useMemo(() => {
        const collectedOrders = orders.filter(o => o.status === 'تم_التحصيل');
        const failedOrders = orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status));

        let totalRevenue = 0;
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

        collectedOrders.forEach(order => {
            const { profit } = calculateOrderProfitLoss(order, settings);
            const codFee = calculateCodFee(order, settings);
            
            const compFees = settings.companySpecificFees?.[order.shippingCompany];
            const useCustom = compFees?.useCustomFees ?? false;
            const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
            const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
            const isInsured = order.isInsured ?? true;
            const insuranceFee = isInsured ? ((order.productPrice + order.shippingFee) * insuranceRate) / 100 : 0;
            const inspectionAdjustment = order.inspectionFeePaidByCustomer ? 0 : inspectionCost;

            totalRevenue += order.productPrice + order.shippingFee;
            totalShippingRevenue += order.shippingFee;
            totalCogs += order.productCost;
            totalInsuranceFees += insuranceFee;
            totalInspectionFees += inspectionAdjustment;
            totalCodFees += codFee;
            totalProfit += profit;

            // Calculate item-level profits and separate base revenue from markup
            order.items.forEach(item => {
                const product = settings.products.find(p => p.id === item.productId);
                const itemProfit = (item.price - item.cost) * item.quantity;
                
                if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                    const basePriceRevenue = product.basePrice * item.quantity;
                    const extraMarkup = (item.price - product.basePrice) * item.quantity;
                    totalProductRevenue += basePriceRevenue;
                    totalExtraMarkup += extraMarkup;
                    totalCommissionProfit += itemProfit;
                } else {
                    totalProductRevenue += item.price * item.quantity;
                    if (product?.profitMode === 'commission') {
                        totalCommissionProfit += itemProfit;
                    } else {
                        totalPercentageProfit += itemProfit;
                    }
                }
            });
        });

        let totalLoss = 0;
        let totalFailedShipping = 0;
        let totalFailedInsurance = 0;
        let totalFailedInspection = 0;
        let totalReturnFees = 0;

        failedOrders.forEach(order => {
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
        });

        const totalExpenses = wallet.transactions.filter(t => t.category?.startsWith('expense_')).reduce((sum, t) => sum + t.amount, 0);
        
        const finalNet = totalProfit - totalLoss - totalExpenses;

        // --- NEW CALCULATIONS ---
        const successRate = orders.length > 0 ? (collectedOrders.length / orders.length) * 100 : 0;
        const grossProfit = totalPercentageProfit + totalCommissionProfit;
        const lossRatio = grossProfit > 0 ? (totalLoss / grossProfit) * 100 : 0;
        const avgProfitPerOrder = orders.length > 0 ? finalNet / orders.length : 0;

        // Geographic Analysis
        const geoStats: Record<string, { count: number, success: number, revenue: number, loss: number }> = {};
        orders.forEach(o => {
            const area = o.governorate || o.shippingArea || 'غير محدد';
            if (!geoStats[area]) geoStats[area] = { count: 0, success: 0, revenue: 0, loss: 0 };
            geoStats[area].count++;
            const { net, loss } = calculateOrderProfitLoss(o, settings);
            if (o.status === 'تم_التحصيل') {
                geoStats[area].success++;
                geoStats[area].revenue += (o.productPrice + o.shippingFee);
            }
            geoStats[area].loss += loss;
        });

        const geoData = Object.entries(geoStats).map(([name, s]) => ({
            name,
            successRate: (s.success / s.count) * 100,
            revenue: s.revenue,
            loss: s.loss,
            net: s.revenue - s.loss
        })).sort((a, b) => b.revenue - a.revenue);

        // Expense Categories for Pie Chart
        const expenseCategories = [
            { name: 'إعلانات', value: wallet.transactions.filter(t => t.category === 'expense_ads').reduce((sum, t) => sum + t.amount, 0), color: '#4f46e5' },
            { name: 'رواتب', value: wallet.transactions.filter(t => t.category === 'expense_salary').reduce((sum, t) => sum + t.amount, 0), color: '#06b6d4' },
            { name: 'إيجار', value: wallet.transactions.filter(t => t.category === 'expense_rent').reduce((sum, t) => sum + t.amount, 0), color: '#8b5cf6' },
            { name: 'أخرى', value: wallet.transactions.filter(t => t.category === 'expense_other').reduce((sum, t) => sum + t.amount, 0), color: '#ec4899' },
        ].filter(c => c.value > 0);

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

        // Wallet Sync
        const pendingCollection = orders.filter(o => o.status === 'تم_توصيلها' && !o.collectionProcessed).reduce((sum, o) => sum + (o.productPrice + o.shippingFee), 0);
        
        // Inventory Value
        const inventoryValue = settings.products.reduce((sum, p) => sum + (p.costPrice * (p.stockQuantity || 0)), 0);

        return { 
            totalRevenue, totalProductRevenue, totalExtraMarkup, totalShippingRevenue, totalCogs, 
            totalInsuranceFees, totalInspectionFees, totalCodFees, totalProfit, 
            totalLoss, totalFailedShipping, totalFailedInsurance, totalFailedInspection, 
            totalReturnFees, totalExpenses, finalNet, totalPercentageProfit, totalCommissionProfit,
            successRate, lossRatio, avgProfitPerOrder, carrierStats, productStats, pendingCollection,
            collectedOrdersCount: collectedOrders.length, geoData, expenseCategories, inventoryValue
        };
    }, [orders, settings, wallet]);

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const storeName = activeStore?.name || 'متجري';
            const html = generateComprehensiveFinancialReportHTML(orders, settings, wallet, storeName, orientation, isContinuous);
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
            }
        } catch (error) {
            console.error('PDF Export Error:', error);
            handlePrint();
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        const storeName = activeStore?.name || 'متجري';
        const html = generateComprehensiveFinancialReportHTML(orders, settings, wallet, storeName, orientation);
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-700 dark:text-white">ملخص الأداء المالي الشامل</h2>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setIsContinuous(false)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            صفحات
                        </button>
                        <button 
                            onClick={() => setIsContinuous(true)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            متصل
                        </button>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setOrientation('portrait')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            طولي
                        </button>
                        <button 
                            onClick={() => setOrientation('landscape')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            عرضي
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExportPDF} 
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>}
                            تصدير PDF
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            <Printer size={16}/> طباعة
                        </button>
                    </div>
                </div>
            </div>

            {/* Stage 1: Revenues */}
            <div className="bg-blue-50/30 dark:bg-blue-900/5 p-6 rounded-3xl border border-blue-100 dark:border-blue-800/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">1</div>
                    <div>
                        <h3 className="text-lg font-black text-blue-900 dark:text-blue-100">المرحلة الأولى: الإيرادات والتدفقات (ماذا دخل إلينا؟)</h3>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70">كل المبالغ التي تم تحصيلها من العملاء قبل أي خصومات.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ReportCard title="إجمالي مبيعات المنتجات" value={`${(stats.totalProductRevenue + stats.totalExtraMarkup).toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="ثمن البيع (الأساسي + الزيادة)" tooltip="إجمالي المبالغ التي تم بيع المنتجات بها للعملاء (السعر الأساسي للمنتج + أي زيادة أضفتها على السعر)." />
                    <ReportCard title="مبيعات المنتجات (بالأساسي)" value={`${stats.totalProductRevenue.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="أصل ثمن البيع قبل الزيادة" tooltip="إجمالي السعر الأساسي للمنتجات المباعة، بدون حساب أي زيادة إضافية قمت بوضعها." />
                    <ReportCard title="الربح الإضافي (الزيادة)" value={`${stats.totalExtraMarkup.toLocaleString('ar-EG')} ج.م`} icon={<TrendingUp size={24}/>} color="emerald" subValue="الفرق بين سعر البيع والأساسي" tooltip="إجمالي الأرباح الناتجة عن بيع المنتجات بسعر أعلى من سعرها الأساسي الموصى به." />
                    <ReportCard title="تحصيل الشحن" value={`${stats.totalShippingRevenue.toLocaleString('ar-EG')} ج.م`} icon={<Truck size={24}/>} color="blue" subValue="المبالغ المدفوعة للشحن" tooltip="إجمالي رسوم الشحن التي دفعها العملاء عند استلام الطلبات." />
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 2: Direct Costs */}
            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center font-black shadow-lg">2</div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">المرحلة الثانية: التكاليف المباشرة (ماذا خرج فوراً؟)</h3>
                        <p className="text-xs text-slate-500">تكلفة البضاعة ومصاريف الشحن الأساسية للطلبات الناجحة.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ReportCard title="إجمالي تكلفة البضاعة" value={`${stats.totalCogs.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="للطلبات التي تم تحصيلها" tooltip="إجمالي التكلفة الأصلية للمنتجات (سعر الجملة) للطلبات التي تم تسليمها بنجاح." />
                    <ReportCard title="مصاريف شحن الذهاب" value={`${stats.totalShippingRevenue.toLocaleString('ar-EG')} ج.م`} icon={<Truck size={24}/>} color="red" subValue="المدفوعة لشركات الشحن" tooltip="إجمالي مصاريف الشحن التي تم دفعها لشركات الشحن مقابل توصيل الطلبات الناجحة." />
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 3: Fees */}
            <div className="bg-amber-50/30 dark:bg-amber-900/5 p-6 rounded-3xl border border-amber-100 dark:border-amber-800/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">3</div>
                    <div>
                        <h3 className="text-lg font-black text-amber-900 dark:text-amber-100">المرحلة الثالثة: الرسوم والأعباء (ماذا استنزف الربح؟)</h3>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70">رسوم الخدمات المخصومة من كل طلب ناجح.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ReportCard title="إجمالي التأمين (ناجح)" value={`${stats.totalInsuranceFees.toLocaleString('ar-EG')} ج.م`} icon={<FileText size={24}/>} color="blue" subValue="رسوم التأمين للطلبات المحصلة" tooltip="إجمالي رسوم التأمين التي تم خصمها على الطلبات التي تم تسليمها بنجاح." />
                    <ReportCard title="إجمالي المعاينة (ناجح)" value={`${stats.totalInspectionFees.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="رسوم المعاينة للطلبات المحصلة" tooltip="إجمالي رسوم المعاينة التي تم خصمها على الطلبات التي تم تسليمها بنجاح." />
                    <ReportCard title="إجمالي الـ COD (ناجح)" value={`${stats.totalCodFees.toLocaleString('ar-EG')} ج.م`} icon={<DollarSign size={24}/>} color="blue" subValue="رسوم التحصيل للطلبات المحصلة" tooltip="إجمالي رسوم الدفع عند الاستلام (COD) التي تم خصمها على الطلبات التي تم تسليمها بنجاح." />
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 4: Losses & Expenses */}
            <div className="bg-red-50/30 dark:bg-red-900/5 p-6 rounded-3xl border border-red-100 dark:border-red-800/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">4</div>
                    <div>
                        <h3 className="text-lg font-black text-red-900 dark:text-red-100">المرحلة الرابعة: الخسائر والمصروفات العامة (التحديات الإدارية)</h3>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70">تكلفة المرتجعات والمصروفات الإدارية الثابتة.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <ReportCard title="إجمالي خسائر المرتجعات" value={`${stats.totalLoss.toLocaleString('ar-EG')} ج.م`} icon={<ArrowDown size={24}/>} color="red" subValue="شحن مهدر (فشل/مرتجع)" tooltip="إجمالي الخسائر الناتجة عن مصاريف الشحن المهدرة للطلبات التي لم يتم تسليمها." />
                    <ReportCard title="إجمالي المصروفات الإدارية" value={`${stats.totalExpenses.toLocaleString('ar-EG')} ج.م`} icon={<DollarSign size={24}/>} color="amber" subValue="إعلانات، مرتبات، إلخ." tooltip="إجمالي المصروفات الإدارية المسجلة في المحفظة (مثل الإعلانات، الرواتب، الإيجار)." />
                </div>

                {/* Final Net Banner */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl text-white text-center shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <h3 className="text-lg font-bold opacity-80 relative z-10">صافي الربح النهائي</h3>
                    <p className="text-6xl font-black tracking-tighter mt-2 relative z-10">{stats.finalNet.toLocaleString('ar-EG')} ج.م</p>
                    <p className="text-xs opacity-70 mt-2 relative z-10">(إجمالي الأرباح - إجمالي الخسائر - إجمالي المصروفات والرسوم)</p>
                    <div className="mt-6 pt-6 border-t border-white/20 text-sm relative z-10">
                        نقطة التعادل: تحتاج إلى <span className="font-black underline text-yellow-300">{Math.ceil(stats.totalExpenses / (stats.totalProfit / stats.collectedOrdersCount || 1))}</span> أوردر ناجح إضافي لتغطية المصروفات الإدارية.
                    </div>
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 5: Analysis */}
            <div className="bg-emerald-50/30 dark:bg-emerald-900/5 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800/50">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">5</div>
                    <div>
                        <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-100">المرحلة الخامسة: تحليل الأداء والنمو (كيف نتحسن؟)</h3>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">مؤشرات الأداء وتحليل البيانات لاتخاذ قرارات أفضل.</p>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className={`p-6 rounded-2xl border-2 text-center relative group ${stats.successRate >= 70 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'}`} title="نسبة الطلبات التي تم تسليمها بنجاح من إجمالي الطلبات.">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center justify-center gap-1">نسبة نجاح التوصيل <span className="text-slate-300 cursor-help">ⓘ</span></h4>
                        <p className={`text-3xl font-black ${stats.successRate >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.successRate.toFixed(1)}%</p>
                        <p className="text-[10px] mt-1 text-slate-400">{stats.successRate < 70 ? 'تحتاج لتحسين الشحن/التأكيد' : 'أداء ممتاز'}</p>
                    </div>
                    <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center relative group" title="نسبة الخسائر (المرتجعات) مقارنة بإجمالي الأرباح التشغيلية. كلما قلت النسبة كان أفضل.">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center justify-center gap-1">نسبة الخسارة إلى الربح <span className="text-slate-300 cursor-help">ⓘ</span></h4>
                        <p className="text-3xl font-black text-red-600">{stats.lossRatio.toFixed(1)}%</p>
                        <p className="text-[10px] mt-1 text-slate-400">المرتجعات تلتهم هذه النسبة من أرباحك</p>
                    </div>
                    <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center relative group" title="متوسط الربح الصافي الذي تحققه من كل طلب (بما في ذلك الطلبات الفاشلة).">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center justify-center gap-1">متوسط الربح للطلب <span className="text-slate-300 cursor-help">ⓘ</span></h4>
                        <p className="text-3xl font-black text-blue-600">{stats.avgProfitPerOrder.toLocaleString()} ج.م</p>
                        <p className="text-[10px] mt-1 text-slate-400">صافي الربح الفعلي لكل طلب</p>
                    </div>
                </div>

                {/* Wallet & Inventory */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                        <h4 className="font-bold text-emerald-800 dark:text-emerald-400 mb-1 flex items-center gap-2"><WalletIcon size={18}/> النقدية المحققة</h4>
                        <p className="text-2xl font-black text-emerald-600">{(stats.totalCogs + stats.finalNet).toLocaleString()} ج.م</p>
                        <p className="text-[10px] text-emerald-500 mt-1">تكلفة البضاعة المباعة + صافي الربح النهائي</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <h4 className="font-bold text-blue-800 dark:text-blue-400 mb-1 flex items-center gap-2"><Truck size={18}/> مستحقات الشحن</h4>
                        <p className="text-2xl font-black text-blue-600">{stats.pendingCollection.toLocaleString()} ج.م</p>
                        <p className="text-[10px] text-blue-400 mt-1">مبالغ تم توصيلها ولم تُحصل بعد</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-200 dark:border-amber-800">
                        <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-2"><Package size={18}/> قيمة المخزون</h4>
                        <p className="text-2xl font-black text-amber-600">{stats.inventoryValue.toLocaleString()} ج.م</p>
                        <p className="text-[10px] text-amber-500 mt-1">قيمة البضاعة المتاحة في المخزن</p>
                    </div>
                </div>
            </div>

            {/* 6. Unified Financial Statement */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <FileText className="text-blue-500"/> القائمة المالية الموحدة (Unified Financial Statement)
                </h3>
                
                <div className="text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6 border-r-4 border-blue-500">
                    <strong>شرح توضيحي:</strong> هذه القائمة توضح حركة الأموال بالتفصيل. تبدأ بـ <b>الإيرادات</b> (كل ما تم تحصيله)، ثم نخصم منها <b>تكلفة المبيعات</b> (ثمن البضاعة ومصاريف الشحن) لنصل إلى <b>الربح التشغيلي</b> (أرباحك الصافية من الطلبات الناجحة). أخيراً نخصم <b>الخسائر والمصروفات والرسوم</b> لنصل إلى <b>صافي الربح النهائي</b>.
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <tbody>
                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="إجمالي الأموال التي دخلت إلى النظام من الطلبات الناجحة.">1. الإيرادات (Revenues)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي قيمة المنتجات المباعة بالسعر الأساسي.">إجمالي مبيعات المنتجات (بالسعر الأساسي)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold">+{stats.totalProductRevenue.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي الأرباح الناتجة عن بيع المنتجات بسعر أعلى من سعرها الأساسي.">(+) الزيادة في السعر (ربح إضافي)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold">+{stats.totalExtraMarkup.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي رسوم الشحن التي دفعها العملاء.">إجمالي تحصيل الشحن من العملاء</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold">+{stats.totalShippingRevenue.toLocaleString()} ج.م</td>
                            </tr>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" title="مجموع الإيرادات بالكامل.">(=) إجمالي الإيرادات (Total Revenue)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700">{(stats.totalProductRevenue + stats.totalExtraMarkup + stats.totalShippingRevenue).toLocaleString()} ج.م</td>
                            </tr>

                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="التكاليف المباشرة المرتبطة بالطلبات الناجحة.">2. تكلفة المبيعات (Cost of Goods Sold)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي التكلفة الأصلية للمنتجات (سعر الجملة).">(-) إجمالي مستحقات الموردين (ثمن البضاعة)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalCogs.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="مصاريف الشحن المدفوعة لشركات الشحن للطلبات الناجحة.">(-) إجمالي مصاريف شحن الذهاب (لشركات الشحن)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalShippingRevenue.toLocaleString()} ج.م</td>
                            </tr>

                            <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="الربح المتبقي بعد خصم تكلفة المبيعات من الإيرادات.">3. إجمالي الربح التشغيلي (Gross Profit)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8 text-sm text-slate-500" title="الربح الأساسي من نظام العمولة.">تفصيل الربح: ربح العمولة</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold text-sm">+{(stats.totalCommissionProfit - stats.totalExtraMarkup).toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8 text-sm text-slate-500" title="الربح الإضافي من بيع المنتجات بسعر أعلى من الأساسي.">تفصيل الربح: ربح الزيادة في السعر</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold text-sm">+{stats.totalExtraMarkup.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8 text-sm text-slate-500" title="الربح من نظام المبيعات (النسبة المئوية).">تفصيل الربح: ربح المبيعات</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold text-sm">+{stats.totalPercentageProfit.toLocaleString()} ج.م</td>
                            </tr>
                            <tr className="bg-blue-100 dark:bg-blue-900/40 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" title="مجموع الأرباح التشغيلية.">(=) إجمالي الربح التشغيلي</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-300">{(stats.totalCommissionProfit + stats.totalPercentageProfit).toLocaleString()} ج.م</td>
                            </tr>

                            <tr className="bg-red-50 dark:bg-red-900/20 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="الخسائر والمصروفات الإدارية.">4. الخسائر والمصروفات (Losses & Expenses)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="مجموع رسوم التأمين والمعاينة والدفع عند الاستلام المخصومة من الطلبات الناجحة.">(-) إجمالي رسوم التأمين والمعاينة والتحصيل (للطلبات الناجحة)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${(stats.totalInsuranceFees + stats.totalInspectionFees + stats.totalCodFees).toLocaleString(undefined, {maximumFractionDigits: 2})} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي مصاريف الشحن المهدرة على الطلبات الفاشلة والمرتجعة.">(-) إجمالي خسائر المرتجعات والفشل</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalLoss.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي المصروفات الإدارية المسجلة في المحفظة.">(-) إجمالي المصروفات الإدارية (إعلانات، رواتب...)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalExpenses.toLocaleString()} ج.م</td>
                            </tr>

                            <tr className="bg-indigo-600 text-white font-black text-lg">
                                <td className="p-4 border border-indigo-700" title="الربح النهائي بعد خصم جميع التكاليف والخسائر والمصروفات.">(=) صافي الربح النهائي (Net Profit)</td>
                                <td className="p-4 border border-indigo-700">{stats.finalNet.toLocaleString()} ج.م</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 7. Charts & Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2"><MapPin className="text-blue-500"/> تحليل المناطق (الأكثر ربحية)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.geoData.slice(0, 8)} margin={{ top: 20 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', direction: 'rtl' }} />
                                <Bar dataKey="revenue" name="الإيرادات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="net" name="صافي الربح" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-xs text-right">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-2" title="اسم المحافظة أو المنطقة.">المنطقة</th>
                                    <th className="pb-2" title="نسبة الطلبات الناجحة في هذه المنطقة.">النجاح</th>
                                    <th className="pb-2" title="إجمالي الإيرادات المحصلة من هذه المنطقة.">الإيرادات</th>
                                    <th className="pb-2" title="صافي الربح بعد خصم الخسائر في هذه المنطقة.">الصافي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.geoData.slice(0, 5).map(g => (
                                    <tr key={g.name} className="border-b border-slate-50 dark:border-slate-800/50">
                                        <td className="py-2 font-bold">{g.name}</td>
                                        <td className="py-2">{g.successRate.toFixed(1)}%</td>
                                        <td className="py-2">{g.revenue.toLocaleString()}</td>
                                        <td className={`py-2 font-bold ${g.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{g.net.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2"><DollarSign className="text-amber-500"/> توزيع المصروفات الإدارية</h3>
                    <div className="h-64 flex items-center justify-center">
                        {stats.expenseCategories.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.expenseCategories} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {stats.expenseCategories.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-slate-400 text-sm">لا توجد مصروفات مسجلة حالياً</div>
                        )}
                    </div>
                    <div className="mt-4 space-y-2">
                        {stats.expenseCategories.map(cat => (
                            <div key={cat.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                    <span className="text-slate-600 dark:text-slate-400">{cat.name}</span>
                                </div>
                                <span className="font-bold">{cat.value.toLocaleString()} ج.م</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">أداء شركات الشحن</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-2" title="اسم شركة الشحن.">الشركة</th>
                                    <th className="pb-2" title="إجمالي عدد الطلبات المسندة للشركة.">الطلبات</th>
                                    <th className="pb-2" title="نسبة الطلبات التي تم تسليمها بنجاح.">النجاح</th>
                                    <th className="pb-2" title="صافي الربح المحقق من الطلبات المشحونة عبر هذه الشركة.">الربح</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(stats.carrierStats).map(([name, s]) => (
                                    <tr key={name} className="border-b border-slate-50 dark:border-slate-800/50">
                                        <td className="py-3 font-bold">{name}</td>
                                        <td className="py-3">{s.count}</td>
                                        <td className="py-3">{(s.success / s.count * 100).toFixed(1)}%</td>
                                        <td className={`py-3 font-bold ${s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{s.profit.toLocaleString()} ج.م</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">تحليل ربحية المنتجات</h3>
                    <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg mb-4 border-r-2 border-slate-300">
                        يوضح هذا الجدول أداء كل منتج على حدة. الكمية المباعة (للطلبات الناجحة)، الكمية المرتجعة (للطلبات الفاشلة والمرتجعة)، وإجمالي الربح الصافي من هذا المنتج.
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-2" title="اسم المنتج.">المنتج</th>
                                    <th className="pb-2" title="إجمالي الكمية المباعة (في الطلبات الناجحة).">المباع</th>
                                    <th className="pb-2" title="إجمالي الكمية المرتجعة (في الطلبات الفاشلة).">المرتجع</th>
                                    <th className="pb-2" title="صافي الربح المحقق من هذا المنتج.">الربح</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(stats.productStats).map(([name, s]) => {
                                    const isMultiProfit = s.extra > 0;
                                    return (
                                        <tr key={name} className={`border-b border-slate-50 dark:border-slate-800/50 ${isMultiProfit ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                            <td className="py-3 font-bold">
                                                {name}
                                                {isMultiProfit && <span className="block text-[8px] text-blue-500 font-normal">ربح مركب (أساسي + زيادة)</span>}
                                            </td>
                                            <td className="py-3">{s.sold}</td>
                                            <td className="py-3">{s.returns}</td>
                                            <td className="py-3 font-bold text-emerald-600">{(s.revenue - s.cost + s.extra).toLocaleString()} ج.م</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 8. Detailed Orders (Successful) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="text-emerald-500"/> تفاصيل الأرباح (الطلبات الناجحة)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="رقم الطلب التعريفي.">رقم الطلب</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="اسم العميل.">العميل</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="المنتجات التي تم بيعها في هذا الطلب.">المنتجات</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="سعر البيع الإجمالي للطلب.">سعر البيع</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="صافي الربح المحقق من هذا الطلب بعد خصم التكاليف.">صافي الربح</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.filter(o => o.status === 'تم_التحصيل').length > 0 ? (
                                orders.filter(o => o.status === 'تم_التحصيل').map(order => {
                                    const { profit } = calculateOrderProfitLoss(order, settings);
                                    let orderExtraMarkup = 0;
                                    order.items.forEach(item => {
                                        const product = settings.products.find(p => p.id === item.productId);
                                        if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                                            orderExtraMarkup += Math.max(0, (item.price - product.basePrice) * item.quantity);
                                        }
                                    });
                                    const isMultiProfit = orderExtraMarkup > 0;
                                    return (
                                        <tr key={order.id} className={`border-b border-slate-50 dark:border-slate-800/50 ${isMultiProfit ? 'bg-blue-50/50 dark:bg-blue-900/10 border-r-4 border-r-blue-500' : ''}`}>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold">{order.orderNumber}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">{order.customerName}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                                                {order.items.map((item, idx) => {
                                                    const p = settings.products.find(prod => prod.id === item.productId);
                                                    const isItemMulti = p?.profitMode === 'commission' && p.basePrice !== undefined && item.price > p.basePrice;
                                                    return (
                                                        <div key={`${order.id}-${item.productId}-${idx}`} className="mb-1">
                                                            {item.name} ({item.quantity})
                                                            {isItemMulti && <span className="block text-[8px] text-blue-500 font-normal">ربح مركب (أساسي + زيادة)</span>}
                                                        </div>
                                                    );
                                                })}
                                            </td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">{order.productPrice.toLocaleString()} ج.م</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold text-emerald-600">{profit.toLocaleString()} ج.م</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد طلبات ناجحة حالياً</td>
                                </tr>
                            )}
                        </tbody>
                        {orders.filter(o => o.status === 'تم_التحصيل').length > 0 && (
                            <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-black text-slate-900 dark:text-white">
                                <tr>
                                    <td colSpan={3} className="p-2 border border-slate-100 dark:border-slate-800 text-left">الإجمالي:</td>
                                    <td className="p-2 border border-slate-100 dark:border-slate-800">{(stats.totalProductRevenue + stats.totalExtraMarkup).toLocaleString()} ج.م</td>
                                    <td className="p-2 border border-slate-100 dark:border-slate-800 text-emerald-600">{stats.totalProfit.toLocaleString()} ج.م</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* 9. Detailed Orders (Failed) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-red-500"/> تفاصيل الخسائر (الطلبات الفاشلة)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                <th className="p-2 border border-slate-100 dark:border-slate-800">رقم الطلب</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">العميل</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">المنتجات</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">الحالة</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">الخسارة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status)).length > 0 ? (
                                orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status)).map(order => {
                                    const { loss } = calculateOrderProfitLoss(order, settings);
                                    return (
                                        <tr key={order.id} className="border-b border-slate-50 dark:border-slate-800/50">
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold">{order.orderNumber}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">{order.customerName}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                                                {order.items.map((item, idx) => (
                                                    <div key={`${order.id}-${item.productId}-${idx}`} className="mb-1">
                                                        {item.name} ({item.quantity})
                                                    </div>
                                                ))}
                                            </td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full text-[10px]">
                                                    {order.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold text-red-600">-{loss.toLocaleString()} ج.م</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد طلبات فاشلة حالياً</td>
                                </tr>
                            )}
                        </tbody>
                        {orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status)).length > 0 && (
                            <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-black text-slate-900 dark:text-white">
                                <tr>
                                    <td colSpan={4} className="p-2 border border-slate-100 dark:border-slate-800 text-left">الإجمالي:</td>
                                    <td className="p-2 border border-slate-100 dark:border-slate-800 text-red-600">-{stats.totalLoss.toLocaleString()} ج.م</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

const ReportsPage: React.FC<ReportsPageProps> = ({ orders, settings, wallet, activeStore }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'losses' | 'comprehensive'>('summary');

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><FileText size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">مركز التقارير</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">ملخص شامل لأداء متجرك.</p>
                </div>
            </div>

            <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
                <button onClick={() => setActiveTab('summary')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>ملخص المبيعات</button>
                <button onClick={() => setActiveTab('losses')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'losses' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>تقرير الخسائر</button>
                <button onClick={() => setActiveTab('comprehensive')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'comprehensive' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>التقرير الشامل</button>
            </div>
            
            <div className="animate-in fade-in-5 duration-300">
                {activeTab === 'summary' && <SalesSummaryReport orders={orders} settings={settings} wallet={wallet} />}
                {activeTab === 'losses' && <LossesReport orders={orders} settings={settings} activeStore={activeStore} />}
                {activeTab === 'comprehensive' && <ComprehensiveReport orders={orders} settings={settings} wallet={wallet} activeStore={activeStore} />}
            </div>
        </div>
    );
};

export default ReportsPage;
