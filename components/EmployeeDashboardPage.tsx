import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Order, User } from '../types';
import { PhoneForwarded, CheckCircle, ArrowLeft, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmployeeDashboardPageProps {
  orders: Order[];
  currentUser: User | null;
}

const StatCard = ({ title, value, icon, colorClass }: { title: string, value: number, icon: React.ReactNode, colorClass: string }) => (
    <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4`}>
        <div className={`p-3 rounded-lg ${colorClass}`}>
            {icon}
        </div>
        <div>
            <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">{title}</div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{value}</div>
        </div>
    </div>
);


const EmployeeDashboardPage: React.FC<EmployeeDashboardPageProps> = ({ orders, currentUser }) => {
    
    const stats = useMemo(() => {
        const pending = orders.filter(o => o.status === 'في_انتظار_المكالمة').length;
        const confirmed = orders.filter(o => o.status === 'قيد_التنفيذ' || o.status === 'جاري_المراجعة').length;
        const canceled = orders.filter(o => o.status === 'ملغي').length;
        return { pending, confirmed, canceled };
    }, [orders]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">
                    أهلاً بعودتك، {currentUser?.fullName.split(' ')[0]}!
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    هنا ملخص سريع لمهامك اليوم.
                </p>
            </motion.div>

            <motion.div 
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                <StatCard title="طلبات بانتظار التأكيد" value={stats.pending} icon={<PhoneForwarded size={24}/>} colorClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" />
                <StatCard title="طلبات مؤكدة" value={stats.confirmed} icon={<CheckCircle size={24}/>} colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
                <StatCard title="طلبات ملغاة" value={stats.canceled} icon={<XCircle size={24}/>} colorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
            >
                <Link to="/employee/confirmation-queue" className="block bg-indigo-600 text-white p-8 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all group">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-black">اذهب إلى قائمة تأكيد الطلبات</h2>
                            <p className="opacity-80 mt-1">ابدأ في التواصل مع العملاء لتأكيد طلباتهم الجديدة.</p>
                        </div>
                        <ArrowLeft size={32} className="transform transition-transform group-hover:-translate-x-2" />
                    </div>
                </Link>
            </motion.div>
        </div>
    );
};

export default EmployeeDashboardPage;