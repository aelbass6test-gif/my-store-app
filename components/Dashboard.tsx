import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Package, CheckCircle2, Wallet as WalletIcon, Truck, RefreshCcw, FileSearch, Check, PlayCircle, X, AlertTriangle, ArrowRight, Lightbulb, Loader, BrainCircuit, PhoneForwarded, PieChart as ChartIcon } from 'lucide-react';
import { Order, Settings, Wallet, User, CustomerProfile } from '../types';
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
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.value} ({percentage.toFixed(1)}%)</span>
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
                <h3 className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2"><Lightbulb className="text-amber-500"/> اقتراحات ذكية</h3>
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


const Dashboard = ({ orders, settings, wallet, currentUser }: { orders: Order[], settings: Settings, wallet: Wallet, currentUser: User | null }) => {
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
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">مرحباً {currentUser?.fullName.split(' ')[0]}!</h1>
        <p className="text-slate-500">إليك نشاط متجرك في آخر 7 أيام.</p>
      </motion.div>

      {showVideoBanner && (
        <motion.div variants={itemVariants} className="bg-gradient-to-r from-rose-100 to-teal-100 dark:from-rose-950 dark:to-teal-950 p-6 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <button className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white shadow-lg">
                        <PlayCircle size={32} />
                    </button>
                    <span className="absolute -top-1 -right-1 flex h-6 w-6">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-6 w-6 bg-pink-500 items-center justify-center text-white text-[10px] font-bold">ابدأ</span>
                    </span>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">فيديو ترحيبي، وجولة سريعة لتأسيس متجرك</h3>
                    <a href="#" className="text-sm font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                        شاهد الفيديو <PlayCircle size={14} />
                    </a>
                </div>
            </div>
            <button onClick={() => setShowVideoBanner(false)} className="self-start text-slate-400 hover:text-slate-600">
                <X size={18} />
            </button>
        </motion.div>
      )}
      
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="صافي أرباح الأوردرات" value={`${stats.net.toLocaleString()} ج.م`} icon={<TrendingUp className="text-emerald-500"/>} />
        <StatCard title="كاش المحفظة الحي" value={`${wallet.balance.toLocaleString()} ج.م`} icon={<WalletIcon className="text-amber-500"/>} />
        <StatCard title="إجمالي الأوردرات" value={stats.total} icon={<Package className="text-blue-500"/>} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SmallStat title="بانتظار مكالمة" value={stats.counts['في_انتظار_المكالمة']} icon={<PhoneForwarded size={18}/>} colorClass="text-cyan-500" />
        <SmallStat title="مراجعة" value={stats.counts['جاري_المراجعة']} icon={<FileSearch size={18}/>} colorClass="text-purple-500" />
        <SmallStat title="تحصيل" value={stats.counts['تم_التحصيل']} icon={<CheckCircle2 size={18}/>} colorClass="text-green-500" />
        <SmallStat title="شحن" value={stats.counts['قيد_الشحن']} icon={<Truck size={18}/>} colorClass="text-sky-500" />
        <SmallStat title="مرتجع" value={stats.counts['مرتجع']} icon={<RefreshCcw size={18}/>} colorClass="text-red-500" />
      </motion.div>

       <motion.div variants={itemVariants}>
        <SmartSuggestions orders={orders} settings={settings} />
       </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[400px] flex flex-col">
          <h3 className="font-bold mb-4 text-slate-600 dark:text-slate-400">تحليل الحالات</h3>
          <div className="flex-1 w-full min-h-0 flex flex-col md:flex-row items-center justify-center gap-4">
              {stats.total > 0 ? (
                  <>
                    <div className="w-full md:w-3/5 h-64 md:h-full relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    innerRadius={70}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(5px)', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="w-full md:w-2/5 space-y-4">
                        {chartData.map(entry => (
                            <div key={entry.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                    <span className="font-bold text-slate-600 dark:text-slate-400">{entry.name}</span>
                                </div>
                                <span className="font-black text-slate-800 dark:text-white">{entry.value}</span>
                            </div>
                        ))}
                    </div>
                  </>
              ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 opacity-60">
                      <ChartIcon size={48} className="mb-2"/>
                      <p className="text-sm font-bold">لا توجد بيانات للعرض</p>
                  </div>
              )}
          </div>
        </div>
        
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1">
                <h3 className="font-bold mb-4 text-slate-600 dark:text-slate-400">توزيع النسب</h3>
                <div className="flex-1">
                    <StatusDistribution data={chartData} />
                </div>
            </div>
            {lowStockProducts.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-red-600 flex items-center gap-2"><AlertTriangle size={18}/> تنبيهات المخزون</h3>
                        <Link to="/products" className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1">عرض الكل <ArrowRight size={12}/></Link>
                    </div>
                    <div className="space-y-2">
                        {lowStockProducts.slice(0, 3).map(p => (
                            <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <span className="text-slate-700 dark:text-slate-300 font-medium">{p.name}</span>
                                <span className="font-black text-red-600">{p.stockQuantity} قطع</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8">
          تم تأسيس وبرمجة المنصة بالكامل بواسطة <span className="font-bold text-slate-600 dark:text-slate-300">عبدالرحمن سعيد</span>.
          <br />
          سيتم الإطلاق الرسمي قريباً عند اكتمال كافة الميزات.
        </p>
      </motion.div>
    </motion.div>
  );
};

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
