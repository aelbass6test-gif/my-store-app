import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Package, CheckCircle2, Wallet as WalletIcon, Truck, RefreshCcw, FileSearch, Check, PlayCircle, X, AlertTriangle, ArrowRight, Lightbulb, Loader, BrainCircuit, PhoneForwarded, PieChart as ChartIcon } from 'lucide-react';
import { Order, Settings, Wallet, User, CustomerProfile, Store } from '../types';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { generateDashboardSuggestions } from '../services/geminiService';
import { calculateOrderProfitLoss } from '../utils/financials';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

const StatusDistribution = ({ data }: { data: { name: string, value: number, color: string }[] }) => {
    const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

    if (total === 0) {
        return <div className="h-full flex items-center justify-center text-slate-400">لا توجد بيانات لعرضها.</div>;
    }

    return (
        <div className="h-full flex flex-col justify-center gap-6 py-4">
            {data.map(item => {
                const percentage = total > 0 ? (item.value / total) * 100 : 0;
                return (
                    <div key={item.name}>
                        <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{item.name}</span>
</div>
<span className="text-xs font-black text-slate-600 dark:text-slate-300">{item.value} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full rounded-full" 
                                style={{ width: `${percentage}%`, backgroundColor: item.color, transition: 'width 0.5s ease-in-out' }}
                            ></div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

const SmartSuggestions = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const [suggestions, setSuggestions] = useState('اضغط على زر التحديث للحصول على اقتراحات ذكية.');
    const [isLoading, setIsLoading] = useState(false);

    const customers = useMemo(() => {
        const customerMap = new Map<string, Pick<CustomerProfile, 'name' | 'successfulOrders' | 'totalSpent'>>();
        orders.forEach(order => {
            const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
            if (!cleanPhone) return;
            if (!customerMap.has(cleanPhone)) {
                customerMap.set(cleanPhone, { name: order.customerName, successfulOrders: 0, totalSpent: 0 });
            }
            const customer = customerMap.get(cleanPhone)!;
            if (order.status === 'تم_التحصيل') {
                customer.successfulOrders += 1;
                customer.totalSpent += (order.productPrice + order.shippingFee) - (order.discount || 0);
            }
        });
        return Array.from(customerMap.values());
    }, [orders]);

    const fetchSuggestions = async () => {
        setIsLoading(true);
        setSuggestions('');
        const result = await generateDashboardSuggestions(orders, settings.products, customers);
        setSuggestions(result);
        setIsLoading(false);
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2"><Lightbulb className="text-amber-500"/> اقتراحات ذكية</h3>
                <button onClick={fetchSuggestions} disabled={isLoading} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-wait" title="تحديث الاقتراحات">
                    <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>
            {isLoading ? (
                <div className="flex items-center justify-center h-24 text-slate-400 gap-2">
                    <BrainCircuit size={20} className="animate-pulse" />
                    <span>المساعد الذكي يحلل بياناتك...</span>
                </div>
            ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-2 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {suggestions.split('\n').map((line, i) => <p key={i} className="my-1">{line}</p>)}
                </div>
            )}
        </div>
    );
};


const Dashboard = ({ orders, settings, wallet, currentUser, activeStore }: { orders: Order[], settings: Settings, wallet: Wallet, currentUser: User | null, activeStore: Store | undefined }) => {
  const [showVideoBanner, setShowVideoBanner] = useState(true);

  const stats = useMemo(() => {
    let totalProfit = 0;
    let totalLoss = 0;
    let counts: Record<string, number> = {
      'في_انتظار_المكالمة': 0,
      'جاري_المراجعة': 0, 'قيد_التنفيذ': 0, 'تم_الارسال': 0, 'قيد_الشحن': 0,
      'تم_توصيلها': 0, 'تم_التحصيل': 0, 'مرتجع': 0, 'مرتجع_جزئي': 0,
      'فشل_التوصيل': 0, 'ملغي': 0
    };

    orders.forEach((o: Order) => {
      if (counts[o.status] !== undefined) counts[o.status]++;
      
      const { profit, loss } = calculateOrderProfitLoss(o, settings);
      totalProfit += profit;
      totalLoss += loss;
    });

    return { net: totalProfit - totalLoss, counts, total: orders.length };
  }, [orders, settings]);

  const chartData = [
    { name: 'بانتظار مكالمة', value: stats.counts['في_انتظار_المكالمة'], color: '#06b6d4' },
    { name: 'مراجعة', value: stats.counts['جاري_المراجعة'], color: '#a855f7' },
    { name: 'تحصيل', value: stats.counts['تم_التحصيل'], color: '#22c55e' },
    { name: 'مرتجع', value: stats.counts['مرتجع'] + stats.counts['فشل_التوصيل'], color: '#ef4444' },
    { name: 'في الطريق', value: stats.counts['قيد_الشحن'] + stats.counts['تم_الارسال'], color: '#0ea5e9' }
  ];

  const lowStockProducts = settings.products.filter(p => p.stockQuantity < 5);

  return (
    <motion.div 
      className="space-y-8 pb-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">
            أهلاً بك، {currentUser?.fullName.split(' ')[0]} 👋
          </h1>
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              متجرك نشط الآن
            </span>
            <span className="text-sm">آخر تحديث: منذ دقيقتين</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link to="/store-preview" className="glass-card px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-white/10 transition-all flex items-center gap-2">
            <PlayCircle size={18} className="text-primary" />
            معاينة المتجر
          </Link>
          <button className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            إضافة منتج جديد
          </button>
        </div>
      </motion.div>

      {/* AI Smart Assistant Banner */}
      <motion.div variants={itemVariants}>
        <SmartSuggestions orders={orders} settings={settings} />
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Stats - Large Card */}
        <motion.div variants={itemVariants} className="md:col-span-8 glass-card p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">الأداء المالي</h3>
              <select className="bg-transparent border-none text-sm font-bold text-slate-500 focus:ring-0 cursor-pointer">
                <option>آخر 7 أيام</option>
                <option>آخر 30 يوم</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">صافي الأرباح</p>
                <h4 className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">
                  {stats.net.toLocaleString()} <span className="text-lg font-bold text-slate-400">ج.م</span>
                </h4>
                <div className="flex items-center gap-1.5 text-emerald-500 text-sm font-bold">
                  <TrendingUp size={16} />
                  <span>+12.5%</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">رصيد المحفظة</p>
                <h4 className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">
                  {wallet.transactions.reduce((sum, t) => t.type === 'إيداع' ? sum + t.amount : sum - t.amount, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-lg font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-xs text-slate-400 font-medium">متاح للسحب الفوري</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">إجمالي الطلبات</p>
                <h4 className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">
                  {stats.total}
                </h4>
                <p className="text-xs text-slate-400 font-medium">معدل تحويل 4.2%</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions / Status - Vertical Bento */}
        <motion.div variants={itemVariants} className="md:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-3xl h-full flex flex-col justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6">حالات الطلبات</h3>
            <div className="space-y-4">
              <StatusItem label="بانتظار تأكيد" value={stats.counts['في_انتظار_المكالمة']} color="bg-cyan-500" />
              <StatusItem label="قيد المراجعة" value={stats.counts['جاري_المراجعة']} color="bg-purple-500" />
              <StatusItem label="تم التحصيل" value={stats.counts['تم_التحصيل']} color="bg-emerald-500" />
              <StatusItem label="مرتجعات" value={stats.counts['مرتجع']} color="bg-rose-500" />
            </div>
            <Link to="/orders" className="mt-8 text-center text-sm font-bold text-primary hover:underline">
              إدارة كافة الطلبات
            </Link>
          </div>
        </motion.div>

        {/* Analytics Chart - Bento Card */}
        <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">توزيع المبيعات</h3>
            <ChartIcon size={20} className="text-slate-400" />
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} className="outline-none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    backdropFilter: 'blur(10px)',
                    border: 'none',
                    borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Inventory & Alerts - Bento Card */}
        <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">تنبيهات المخزون</h3>
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          
          {lowStockProducts.length > 0 ? (
            <div className="space-y-4">
              {lowStockProducts.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                      <Package size={20} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500">SKU: {p.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-rose-500">{p.stockQuantity} قطع</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">مخزون منخفض</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <CheckCircle2 size={48} className="text-emerald-500/20 mb-4" />
              <p className="font-bold">المخزون سليم تماماً</p>
            </div>
          )}
        </motion.div>

      </div>

      {/* Footer Branding */}
      <motion.div variants={itemVariants} className="pt-12 border-t border-slate-200 dark:border-slate-800/50">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">
            <div className="w-8 h-[1px] bg-current opacity-20" />
            OneToolz Dashboard v2.0
            <div className="w-8 h-[1px] bg-current opacity-20" />
          </div>
          <p className="text-[10px] text-slate-400 text-center max-w-xs leading-relaxed">
            تم التصميم والبرمجة بواسطة عبدالرحمن سعيد. جميع الحقوق محفوظة © 2026
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

const StatusItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex items-center justify-between group cursor-default">
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.1)]`} />
      <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{label}</span>
    </div>
    <span className="text-sm font-black text-slate-800 dark:text-white tabular-nums">{value}</span>
  </div>
);


interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const StatCard = ({ title, value, icon }: StatCardProps) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        {icon}
    </div>
    <div>
      <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">{title}</div>
      <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  </div>
);

interface SmallStatProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

const SmallStat = ({ title, value, icon, colorClass }: SmallStatProps) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
      <div className={`flex items-center justify-center gap-2 font-bold text-slate-500 dark:text-slate-400 mb-1 ${colorClass}`}>
          {icon}
          <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-white">{value}</div>
  </div>
);

export default Dashboard;
