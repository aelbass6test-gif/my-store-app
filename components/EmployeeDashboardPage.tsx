import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Order, User, Settings, OrderStatus } from '../types';
import { PhoneForwarded, CheckCircle, ArrowLeft, XCircle, Package, User as UserIcon, AlertCircle, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { ORDER_STATUS_METADATA } from '../constants';

interface EmployeeDashboardPageProps {
  orders: Order[];
  setOrders: (updater: (prev: Order[]) => Order[]) => void;
  currentUser: User | null;
  settings: Settings;
}

const StatCard = ({ title, value, icon, colorClass }: { title: string, value: number, icon: React.ReactNode, colorClass: string }) => (
    <div className={`bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4`}>
        <div className={`p-4 rounded-2xl ${colorClass}`}>
            {icon}
        </div>
        <div>
            <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">{title}</div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{value}</div>
        </div>
    </div>
);

const EmployeeDashboardPage: React.FC<EmployeeDashboardPageProps> = ({ orders, setOrders, currentUser, settings }) => {
    const [notification, setNotification] = useState<string | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const assignedOrders = useMemo(() => {
        return orders.filter(o => o.assignedTo === currentUser?.phone);
    }, [orders, currentUser]);

    const stats = useMemo(() => {
        const dashboardSettings = settings.employeeDashboardSettings;
        const pendingStatuses = ['في_انتظار_المكالمة', 'مؤجل'];
        const confirmedStatuses = dashboardSettings?.showOrderStatuses || ['قيد_التنفيذ', 'تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التحصيل'];
        const canceledStatuses = ['ملغي', 'مرتجع'];

        const pending = assignedOrders.filter(o => pendingStatuses.includes(o.status)).length;
        const confirmed = assignedOrders.filter(o => 
            o.confirmationLogs?.some(log => log.userId === currentUser?.phone && log.action === 'تم التأكيد')
        ).length;
        const canceled = assignedOrders.filter(o => canceledStatuses.includes(o.status)).length;
        
        return { pending, confirmed, canceled };
    }, [assignedOrders, settings, currentUser]);

    const handleStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        // Protection for synced orders
        if (order.source === 'synced' || order.platform === 'wuilt') {
            setNotification("⚠️ لا يمكن تعديل الطلبات المتزامنة يدوياً.");
            return;
        }

        const now = new Date().toISOString();
        const actionMap: Record<string, string> = {
            'قيد_التنفيذ': 'تم التأكيد',
            'ملغي': 'تم الإلغاء',
            'جاري_المراجعة': 'المراجعة'
        };

        const confirmationAction = actionMap[newStatus];

        setOrders(prev => prev.map(o => o.id === orderId ? { 
            ...o, 
            status: newStatus,
            auditLogs: [...(o.auditLogs || []), {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: now,
                userId: currentUser?.phone || 'unknown',
                userName: currentUser?.fullName || 'Employee',
                action: 'status_change',
                field: 'status',
                oldValue: o.status,
                newValue: newStatus
            }],
            ...(confirmationAction ? {
                confirmationLogs: [...(o.confirmationLogs || []), {
                    userId: currentUser?.phone || '',
                    userName: currentUser?.fullName || '',
                    timestamp: now,
                    action: confirmationAction,
                    notes: `تحديث الحالة من لوحة الموظف إلى ${newStatus.replace(/_/g, ' ')}`,
                    duration: 0
                }]
            } : {})
        } : o));
        
        setNotification(`تم تحديث حالة الطلب إلى ${newStatus.replace(/_/g, ' ')} ✅`);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-slate-50/50 dark:bg-slate-900/50 relative">
            {/* Real-time Notification */}
            {notification && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm border border-white/10 dark:border-slate-200"
                >
                    <Bell size={18} className="text-cyan-400 dark:text-cyan-600 animate-pulse" />
                    {notification}
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
                <div>
                    <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                        أهلاً بعودتك، {currentUser?.fullName.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
                        لديك <span className="text-indigo-600 font-black">{stats.pending}</span> طلبات بانتظار التأكيد اليوم.
                    </p>
                </div>
            </motion.div>

            <motion.div 
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                <StatCard title="بانتظار التأكيد" value={stats.pending} icon={<PhoneForwarded size={24}/>} colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" />
                <StatCard title="تم تأكيدها" value={stats.confirmed} icon={<CheckCircle size={24}/>} colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
                <StatCard title="طلبات ملغاة" value={stats.canceled} icon={<XCircle size={24}/>} colorClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" />
            </motion.div>

            {settings.employeeDashboardSettings?.showAssignedOrders && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700"
                >
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <Package className="text-indigo-600" />
                            الطلبات المعينة لك
                        </h2>
                        <span className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full text-sm font-bold">
                            {assignedOrders.length} طلب
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {assignedOrders.length > 0 ? assignedOrders.map(order => {
                            const isReadOnly = order.source === 'synced' || order.platform === 'wuilt';
                            const meta = ORDER_STATUS_METADATA[order.status];

                            return (
                                <div key={order.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[24px] border border-transparent hover:border-indigo-500/20 hover:bg-white dark:hover:bg-slate-900 transition-all duration-300">
                                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                        <div className={`w-12 h-12 rounded-2xl ${meta?.color || 'bg-slate-200'} flex items-center justify-center text-white shadow-lg shadow-indigo-500/10`}>
                                            <Package size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-lg">{order.orderNumber}</p>
                                                {isReadOnly && (
                                                    <span className="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                        متزامن
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-500 text-sm font-medium">
                                                <UserIcon size={14} />
                                                <span>{order.customerName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                        {isReadOnly ? (
                                            <div className={`px-4 py-2 rounded-xl text-sm font-black border-2 border-transparent ${meta?.color || 'bg-slate-100'} text-white`}>
                                                {meta?.label || order.status.replace(/_/g, ' ')}
                                            </div>
                                        ) : (
                                            <select 
                                                value={order.status} 
                                                onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
                                                className="w-full sm:w-auto bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none transition-all shadow-sm cursor-pointer"
                                            >
                                                {Object.entries(ORDER_STATUS_METADATA).map(([status, data]) => (
                                                    <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        )}
                                        <Link 
                                            to="/employee/confirmation-queue" 
                                            state={{ orderId: order.id }}
                                            className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                                        >
                                            <ArrowLeft size={18} />
                                        </Link>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-bold">لا توجد طلبات معينة لك حالياً</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
            
            {settings.employeeDashboardSettings?.showFollowUpReminders && assignedOrders.some(o => o.followUpReminder) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-xl border border-slate-100 dark:border-slate-700"
                >
                    <h2 className="text-2xl font-black mb-6">تذكيرات المتابعة</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignedOrders.filter(o => o.followUpReminder).map(order => (
                            <div key={order.id} className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 flex justify-between items-start">
                                <div>
                                    <p className="font-black text-amber-800 dark:text-amber-200 text-lg">{order.orderNumber}</p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 font-medium">{order.followUpReminder && new Date(order.followUpReminder).toLocaleString('ar-EG')}</p>
                                </div>
                                <div className="p-2 bg-amber-200/50 dark:bg-amber-800/50 rounded-lg">
                                    <AlertCircle size={20} className="text-amber-600" />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
            >
                <Link to="/employee/confirmation-queue" className="relative overflow-hidden block bg-indigo-600 text-white p-10 rounded-[40px] shadow-2xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">اذهب إلى قائمة تأكيد الطلبات</h2>
                            <p className="opacity-80 mt-2 text-lg">ابدأ في التواصل مع العملاء لتأكيد وتجهيز طلباتهم الجديدة.</p>
                        </div>
                        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center transform transition-all group-hover:-translate-x-4">
                            <ArrowLeft size={36} />
                        </div>
                    </div>
                </Link>
            </motion.div>
        </div>
    );
};

export default EmployeeDashboardPage;

