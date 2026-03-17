import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Order, User, ConfirmationLog, OrderStatus, Settings, OrderItem, Product, Store } from '../types';
import { PhoneForwarded, Check, CheckCircle, X, User as UserIcon, MapPin, Package, CalendarDays, Phone, PhoneCall, MessageSquare, Edit3, Save, Plus, Clock, ChevronsUpDown, ArrowRight, Truck, Tag, XCircle, Eye, Search, RefreshCw, History as HistoryIcon, TrendingUp, AlertTriangle, Bell, Send, FileText } from 'lucide-react';

const CONFIRMATION_ACTIONS = [
    'تم التأكيد',
    'العميل لم يرد',
    'رقم خاطئ',
    'تم الإلغاء',
    'مؤجل',
    'يحتاج متابعة'
];

const CANCELLATION_REASONS = [
    'سعر المنتج مرتفع',
    'مصاريف الشحن مرتفعة',
    'العميل طلب بالخطأ',
    'غير جدي / لا يرد',
    'وقت التوصيل طويل',
    'وجد بديل أرخص',
    'تغيير الرأي',
    'أخرى'
];

const WHATSAPP_TEMPLATES = [
    { id: 'no_answer', label: 'لم يرد', text: 'أهلاً [اسم العميل] 👋، حاولنا الاتصال بك من [اسم المتجر] لتأكيد طلبك [اسم المنتج]. يرجى تأكيد الطلب لنتمكن من شحنه لك.' },
    { id: 'location', label: 'طلب الموقع', text: 'أهلاً [اسم العميل] 👋، من فضلك أرسل لنا الموقع (Location) لتسهيل عملية توصيل طلبك [اسم المنتج] من [اسم المتجر].' },
    { id: 'offer', label: 'عرض خاص', text: 'أهلاً [اسم العميل] 👋، لدينا عرض خاص لك اليوم على [اسم المنتج] من [اسم المتجر]. لا تفوت الفرصة!' },
    { id: 'confirm', label: 'تأكيد الطلب', text: 'أهلاً [اسم العميل] 👋، نود تأكيد طلبك [اسم المنتج] من [اسم المتجر]. هل البيانات صحيحة؟' },
];

const REMINDER_OPTIONS = [
    { value: 1, label: 'بعد ساعة' },
    { value: 3, label: 'بعد 3 ساعات' },
    { value: 24, label: 'غداً' },
    { value: 48, label: 'بعد يومين' },
];

const QUICK_NOTES = [
    'العميل طلب المعاينة قبل الاستلام',
    'التسليم بعد الساعة 4 عصراً',
    'تغيير المقاس لـ XL',
    'تغيير المقاس لـ L',
    'تغيير المقاس لـ M',
    'العميل مسافر وسيستلم الأسبوع القادم',
    'يرجى الاتصال قبل الوصول بنصف ساعة',
];

const CALL_STATUS_ACTIONS = [
    { label: 'لم يرد', action: 'العميل لم يرد', color: 'bg-amber-100 text-amber-700' },
    { label: 'مشغول', action: 'الخط مشغول', color: 'bg-orange-100 text-orange-700' },
    { label: 'مغلق', action: 'الهاتف مغلق', color: 'bg-red-100 text-red-700' },
    { label: 'سيعاود الاتصال', action: 'سيعاود الاتصال لاحقاً', color: 'bg-blue-100 text-blue-700' },
];

const SENTIMENT_OPTIONS = [
    { value: 'إيجابي', label: 'إيجابي', color: 'bg-green-100 text-green-700' },
    { value: 'محايد', label: 'محايد', color: 'bg-slate-100 text-slate-700' },
    { value: 'سلبي', label: 'سلبي', color: 'bg-orange-100 text-orange-700' },
    { value: 'غاضب', label: 'غاضب', color: 'bg-red-100 text-red-700' },
    { value: 'مستعجل', label: 'مستعجل', color: 'bg-purple-100 text-purple-700' },
];

const SCRIPTS = [
    { title: 'الاعتراض على السعر', text: 'أفهمك تماماً، لكن جودة المنتج تستحق، ونحن نقدم ضمان استبدال مجاني في حال وجود أي عيب.' },
    { title: 'الاعتراض على الشحن', text: 'مصاريف الشحن تشمل التوصيل لباب البيت والمعاينة قبل الاستلام لضمان حقك.' },
    { title: 'التردد في الطلب', text: 'المنتج عليه طلب كبير والكمية محدودة، إذا أكدت الآن سأحجز لك قطعة فوراً.' },
    { title: 'طلب المعاينة', text: 'بالتأكيد، يمكنك فتح الطرد ومعاينة المنتج مع المندوب قبل دفع أي مليم.' },
];

interface ConfirmationQueuePageProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: User | null;
  settings: Settings;
  activeStore?: Store;
}

interface DetailSectionProps {
    title: string;
    children?: React.ReactNode;
}

const DetailSection = ({ title, children }: DetailSectionProps) => (
    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-slate-600 dark:text-slate-400 mb-3 text-sm">{title}</h4>
        <div className="space-y-3">{children}</div>
    </div>
);

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="space-y-1">
        <label className="text-xs text-slate-500 flex items-center gap-1">{icon} {label}</label>
        <p className="font-bold text-sm text-slate-800 dark:text-white">{value}</p>
    </div>
);

const timeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return "الآن";
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `منذ ${days} يوم`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `منذ ${months} شهر`;
    
    return `منذ ${Math.floor(months / 12)} سنة`;
};

const formatOrderTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const CustomerHistory = ({ allOrders, customerPhone, currentOrderId }: { allOrders: Order[], customerPhone: string, currentOrderId: string }) => {
    const history = useMemo(() => {
        const customerOrders = allOrders.filter(o => o.customerPhone === customerPhone);
        const duplicates = customerOrders.filter(o => o.id !== currentOrderId && o.status === 'في_انتظار_المكالمة');
        
        const totalOrders = customerOrders.length;
        const successfulOrders = customerOrders.filter(o => ['تم_توصيلها', 'تم_التحصيل'].includes(o.status)).length;
        const returnedOrders = customerOrders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام'].includes(o.status)).length;
        const totalSpent = customerOrders.filter(o => ['تم_توصيلها', 'تم_التحصيل'].includes(o.status)).reduce((sum, o) => sum + (o.totalAmountOverride ?? (o.productPrice + o.shippingFee - (o.discount || 0))), 0);
        const successRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;
        
        let classification = { text: 'عميل جديد', color: 'blue', icon: <UserIcon size={14}/> };
        if (totalOrders > 1) {
            if (successRate > 80 && totalSpent > 3000) {
                classification = { text: 'عميل مميز', color: 'amber', icon: <TrendingUp size={14}/> };
            } else if (returnedOrders > 1 && successRate < 50) {
                classification = { text: 'عميل مخاطرة', color: 'red', icon: <AlertTriangle size={14}/> };
            } else {
                classification = { text: 'عميل معتاد', color: 'green', icon: <UserIcon size={14}/> };
            }
        }
        
        return { totalOrders, successfulOrders, totalSpent, successRate, classification, duplicates };
    }, [allOrders, customerPhone, currentOrderId]);

    const colors = {
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };

    return (
        <div className="space-y-4">
            {history.duplicates.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400"
                >
                    <AlertTriangle size={24} className="flex-shrink-0" />
                    <div>
                        <p className="font-bold text-sm">تنبيه: طلب مكرر!</p>
                        <p className="text-xs opacity-80">هذا العميل لديه {history.duplicates.length} طلبات أخرى بانتظار التأكيد.</p>
                    </div>
                </motion.div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                 <div className="flex justify-between items-center mb-3">
                     <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm flex items-center gap-2"><HistoryIcon size={16}/> تاريخ العميل</h4>
                     <span className={`px-2 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${colors[history.classification.color as keyof typeof colors]}`}>
                         {history.classification.icon} {history.classification.text}
                     </span>
                 </div>
                 <div className="grid grid-cols-3 gap-2 text-center">
                     <div className="bg-white dark:bg-slate-700/50 p-2 rounded">
                         <p className="text-xs text-slate-500">إجمالي الطلبات</p>
                         <p className="font-black text-lg text-slate-800 dark:text-white">{history.totalOrders}</p>
                     </div>
                     <div className="bg-white dark:bg-slate-700/50 p-2 rounded">
                         <p className="text-xs text-slate-500">نسبة النجاح</p>
                         <p className={`font-black text-lg ${history.successRate > 75 ? 'text-emerald-500' : 'text-amber-500'}`}>{history.successRate.toFixed(0)}%</p>
                     </div>
                     <div className="bg-white dark:bg-slate-700/50 p-2 rounded">
                         <p className="text-xs text-slate-500">إجمالي ما أنفقه</p>
                         <p className="font-black text-lg text-slate-800 dark:text-white">{history.totalSpent.toLocaleString()}</p>
                     </div>
                 </div>
            </div>
        </div>
    );
};

const EmployeePerformance = ({ orders, currentUser }: { orders: Order[], currentUser: User | null }) => {
    const stats = useMemo(() => {
        if (!currentUser) return { confirmed: 0, canceled: 0, total: 0 };
        const today = new Date().toISOString().split('T')[0];
        const myLogs = orders.flatMap(o => o.confirmationLogs || [])
            .filter(log => log.userId === currentUser.phone && log.timestamp.startsWith(today));
        
        const confirmed = myLogs.filter(l => l.action === 'تم التأكيد').length;
        const canceled = myLogs.filter(l => l.action === 'تم الإلغاء').length;
        return { confirmed, canceled, total: confirmed + canceled };
    }, [orders, currentUser]);

    return (
        <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg mb-6 flex justify-between items-center">
            <div>
                <h4 className="text-xs font-bold opacity-80">إنجازك اليوم</h4>
                <div className="flex gap-4 mt-1">
                    <div className="flex items-center gap-1">
                        <CheckCircle size={14} className="text-emerald-300" />
                        <span className="font-black">{stats.confirmed} مؤكد</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <XCircle size={14} className="text-red-300" />
                        <span className="font-black">{stats.canceled} ملغي</span>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <p className="text-2xl font-black">{stats.total}</p>
                <p className="text-[10px] opacity-70 uppercase tracking-wider">إجمالي العمليات</p>
            </div>
        </div>
    );
};

const ConfirmationQueuePage: React.FC<ConfirmationQueuePageProps> = ({ orders, setOrders, currentUser, settings, activeStore }) => {
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [actionNotes, setActionNotes] = useState('');
    const [selectedAction, setSelectedAction] = useState(CONFIRMATION_ACTIONS[0]);
    const [cancellationReason, setCancellationReason] = useState('');
    const [reminderTime, setReminderTime] = useState<number | ''>('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [editedAddress, setEditedAddress] = useState('');
    const [editedGovernorate, setEditedGovernorate] = useState('');
    const [editedCity, setEditedCity] = useState('');
    const [isEditingPhone2, setIsEditingPhone2] = useState(false);
    const [editedPhone2, setEditedPhone2] = useState('');
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [editedNotes, setEditedNotes] = useState('');
    const [isEditingShippingCompany, setIsEditingShippingCompany] = useState(false);
    const [editedShippingCompany, setEditedShippingCompany] = useState('');
    const [isEditingDiscount, setIsEditingDiscount] = useState(false);
    const [editedDiscount, setEditedDiscount] = useState<number | ''>('');
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const [callStartTime, setCallStartTime] = useState<number | null>(null);
    const [callDuration, setCallDuration] = useState<number>(0);
    const [autoDialer, setAutoDialer] = useState(false);
    const [sentiment, setSentiment] = useState<'إيجابي' | 'محايد' | 'سلبي' | 'غاضب' | 'مستعجل'>('محايد');
    const [isScriptsOpen, setIsScriptsOpen] = useState(false);
    const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
    const [addressVerified, setAddressVerified] = useState<boolean | null>(null);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (callStartTime) {
            interval = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [callStartTime]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const upsellProducts = useMemo(() => {
        if (!activeOrder || !settings.products) return [];
        const currentProductIds = activeOrder.items.map(item => item.productId);
        return settings.products.filter(p => !currentProductIds.includes(p.id)).slice(0, 3);
    }, [activeOrder, settings.products]);
    const [whatsappMenuOpen, setWhatsappMenuOpen] = useState(false);

    const pendingOrders = useMemo(() =>
        orders
            .filter(o => o.status === 'في_انتظار_المكالمة')
            .filter(o => 
                searchTerm === '' ||
                o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.customerPhone.includes(searchTerm) ||
                o.productName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        [orders, searchTerm]
    );

    useEffect(() => {
        if (activeOrder) {
            const isStillPending = pendingOrders.some(o => o.id === activeOrder.id);
            if (!isStillPending) {
                setActiveOrder(pendingOrders[0] || null);
            } else {
                const freshActiveOrderData = pendingOrders.find(o => o.id === activeOrder.id);
                if (freshActiveOrderData && JSON.stringify(freshActiveOrderData) !== JSON.stringify(activeOrder)) {
                    setActiveOrder(freshActiveOrderData);
                }
            }
        }
    }, [orders, pendingOrders, activeOrder]);
    
    useEffect(() => {
        if (activeOrder) {
            setActionNotes('');
            setSelectedAction(CONFIRMATION_ACTIONS[0]);
            setCancellationReason('');
            setReminderTime('');
            setIsEditingName(false);
            setEditedName(activeOrder.customerName);
            setIsEditingAddress(false);
            setEditedAddress(activeOrder.customerAddress);
            setEditedGovernorate(activeOrder.shippingArea || '');
            setEditedCity(activeOrder.city || '');
            setIsEditingPhone2(false);
            setEditedPhone2(activeOrder.customerPhone2 || '');
            setIsEditingNotes(false);
            setEditedNotes(activeOrder.notes || '');
            setIsEditingShippingCompany(false);
            setEditedShippingCompany(activeOrder.shippingCompany || '');
            setIsEditingDiscount(false);
            setEditedDiscount(activeOrder.discount || 0);
            setCallStartTime(Date.now());
            setCallDuration(0);
        } else {
            setCallStartTime(null);
            setCallDuration(0);
        }
    }, [activeOrder]);

    const getWhatsAppLink = (order: Order, templateId?: string) => {
        let normalizedPhone = order.customerPhone.replace(/\D/g, '');
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '20' + normalizedPhone.substring(1);
        } else if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '20' + normalizedPhone;
        }
        
        const customerName = order.customerName.split(' ')[0];
        const employeeName = currentUser?.fullName || 'مندوب المبيعات';
        const storeName = activeStore?.name || 'متجرنا';
        const productName = order.productName;
    
        let message = '';
        if (templateId) {
            const template = WHATSAPP_TEMPLATES.find(t => t.id === templateId);
            if (template) {
                message = template.text
                    .replace('[اسم العميل]', customerName)
                    .replace('[اسم المتجر]', storeName)
                    .replace('[اسم المنتج]', productName);
            }
        } else {
             message = `أهلاً بك يا ${customerName} 👋، انا ${employeeName} نتصل بك من ${storeName} لتأكيد ${productName}. للتاكيد ارسل كلمة تاكيد او الغاء لالغاء الشحنه`;
        }

        return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
    };

    const handleSelectOrder = (order: Order) => {
        const orderToActivate = { ...order };
        if (!orderToActivate.items || orderToActivate.items.length === 0) {
            orderToActivate.items = [{
                productId: settings.products.find(p => p.name === order.productName)?.id || 'legacy-product-id',
                name: order.productName,
                quantity: 1,
                price: order.productPrice,
                cost: order.productCost,
                weight: order.weight,
            }];
        }
        setActiveOrder(orderToActivate);
    };
    
    const handleActionSubmit = (action: string) => {
        if (!activeOrder || !currentUser) return;
        
        if ((action === 'تم الإلغاء' || action === 'مؤجل') && !cancellationReason && !actionNotes) {
             alert('يرجى اختيار سبب الإلغاء/التأجيل أو كتابة ملاحظة.');
             return;
        }

        const activeOrderId = activeOrder.id;
        const notes = [
            actionNotes,
            cancellationReason ? `السبب: ${cancellationReason}` : '',
            reminderTime ? `تذكير بعد: ${REMINDER_OPTIONS.find(r => r.value === reminderTime)?.label}` : '',
            `مدة فتح الطلب: ${formatDuration(callDuration)}`
        ].filter(Boolean).join(' | ');

        const newLog: ConfirmationLog = { 
            userId: currentUser.phone, 
            userName: currentUser.fullName, 
            timestamp: new Date().toISOString(), 
            action: action, 
            notes: notes 
        };

        let newStatus: OrderStatus | null = null;
        if (action === 'تم التأكيد') newStatus = 'جاري_المراجعة';
        else if (action === 'تم الإلغاء') newStatus = 'ملغي';
        
        // Calculate reminder date if set
        let reminderDateStr = undefined;
        if (reminderTime) {
            const date = new Date();
            date.setHours(date.getHours() + Number(reminderTime));
            reminderDateStr = date.toISOString();
        }

        setOrders(currentOrders => currentOrders.map(order => 
            order.id === activeOrderId 
            ? { 
                ...order, 
                status: newStatus || order.status, 
                sentiment: sentiment,
                callAttempts: (order.callAttempts || 0) + 1,
                confirmationLogs: [...(order.confirmationLogs || []), newLog],
                cancellationReason: cancellationReason || order.cancellationReason,
                followUpReminder: reminderDateStr || order.followUpReminder
              } 
            : order
        ));

        // Reset state for next order
        setActionNotes('');
        setSelectedAction(CONFIRMATION_ACTIONS[0]);
        setCancellationReason('');
        setReminderTime('');
        setCallStartTime(null);
        setCallDuration(0);
        setSentiment('محايد');
        setAddressVerified(null);

        // Auto-dialer logic
        if (autoDialer) {
            const nextOrder = pendingOrders.find(o => o.id !== activeOrderId);
            if (nextOrder) {
                setActiveOrder(nextOrder);
            } else {
                setActiveOrder(null);
            }
        } else {
            setActiveOrder(null);
        }
    };

    const updateActiveOrderField = (field: keyof Order, value: any) => {
        if (!activeOrder) return;
        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, [field]: value } : o)
        );
    };

    const handleSaveName = () => {
        updateActiveOrderField('customerName', editedName);
        setIsEditingName(false);
    };
    const handleSaveAddress = () => {
        if (!activeOrder) return;
        
        let newShippingFee = activeOrder.shippingFee;
        if (editedGovernorate && (editedGovernorate !== activeOrder.shippingArea || editedCity !== activeOrder.city)) {
             const shippingOptions = settings.shippingOptions[activeOrder.shippingCompany] || [];
             const selectedOption = shippingOptions.find(opt => opt.label === editedGovernorate);
             if (selectedOption) {
                 const cityOption = selectedOption.cities?.find(c => c.name === editedCity);
                 newShippingFee = cityOption && cityOption.shippingPrice > 0 ? cityOption.shippingPrice : selectedOption.price;
             }
        }

        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, customerAddress: editedAddress, shippingArea: editedGovernorate, city: editedCity, shippingFee: newShippingFee } : o)
        );
        setIsEditingAddress(false);
    };

    const handleSavePhone2 = () => {
        updateActiveOrderField('customerPhone2', editedPhone2);
        setIsEditingPhone2(false);
    };

    const handleSaveNotes = () => {
        updateActiveOrderField('notes', editedNotes);
        setIsEditingNotes(false);
    };

    const handleSaveShippingCompany = () => {
        if (!activeOrder) return;
        
        let newShippingFee = activeOrder.shippingFee;
        const shippingOptions = settings.shippingOptions[editedShippingCompany] || [];
        const selectedOption = shippingOptions.find(opt => opt.label === activeOrder.shippingArea);
        if (selectedOption) {
            const cityOption = selectedOption.cities?.find(c => c.name === activeOrder.city);
            newShippingFee = cityOption && cityOption.shippingPrice > 0 ? cityOption.shippingPrice : selectedOption.price;
        }

        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, shippingCompany: editedShippingCompany, shippingFee: newShippingFee } : o)
        );
        setIsEditingShippingCompany(false);
    };

    const handleSaveDiscount = () => {
        if (!activeOrder) return;
        const discountValue = typeof editedDiscount === 'number' ? editedDiscount : 0;
        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, discount: discountValue } : o)
        );
        setIsEditingDiscount(false);
    };

    const handleSaveProducts = (newItems: OrderItem[]) => {
        if (!activeOrder) return;

        const totalProductPrice = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const totalProductCost = newItems.reduce((sum, item) => sum + item.cost * item.quantity, 0);
        const totalWeight = newItems.reduce((sum, item) => sum + item.weight * item.quantity, 0);
        const productNames = newItems.map(item => item.name).join(', ');

        const updatedOrder: Order = {
            ...activeOrder,
            items: newItems,
            productName: productNames,
            productPrice: totalProductPrice,
            productCost: totalProductCost,
            weight: totalWeight,
        };

        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? updatedOrder : o)
        );
        setIsProductModalOpen(false);
    };
    
    const { productsTotal, totalAmount, inspectionFeeValue } = useMemo(() => {
        if (!activeOrder) return { productsTotal: 0, totalAmount: 0, inspectionFeeValue: 0 };
        const productsTotal = activeOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Calculate shipping fee based on city if available
        let shippingFee = activeOrder.shippingFee;
        const shippingOptions = settings.shippingOptions[activeOrder.shippingCompany] || [];
        const selectedOption = shippingOptions.find(opt => opt.label === activeOrder.shippingArea);
        if (selectedOption) {
            const cityOption = selectedOption.cities?.find(c => c.name === activeOrder.city);
            if (cityOption && cityOption.shippingPrice > 0) {
                shippingFee = cityOption.shippingPrice;
            }
        }

        const compFees = settings.companySpecificFees?.[activeOrder.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const inspectionFee = activeOrder.includeInspectionFee ? (useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        const totalAmount = productsTotal + shippingFee - (activeOrder.discount || 0) + inspectionFee;
        return { productsTotal, totalAmount, inspectionFeeValue: inspectionFee };
    }, [activeOrder, settings]);
    
    const handleRefresh = () => {
        setIsRefreshing(true);
        // Data is live, this is for UX feedback
        setTimeout(() => setIsRefreshing(false), 750);
    };

    const activeShippingOptions = useMemo(() => {
        if (!activeOrder) return [];
        return settings.shippingOptions[activeOrder.shippingCompany] || [];
    }, [activeOrder, settings.shippingOptions]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-4 mb-6 flex-shrink-0">
                <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-xl"><PhoneForwarded size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">قائمة تأكيد الطلبات</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">تواصل مع العملاء لتأكيد طلباتهم الجديدة.</p>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden min-h-[600px]">
                <div className={`w-full md:w-1/3 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full transition-all duration-300 ${activeOrder ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="font-bold text-slate-800 dark:text-white whitespace-nowrap">طلبات جديدة ({pendingOrders.length})</h2>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1">
                                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="بحث..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg border-transparent focus:ring-2 focus:ring-cyan-500 outline-none pr-10 pl-3 py-2 text-sm"
                                />
                            </div>
                            <button 
                                onClick={handleRefresh} 
                                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="تحديث القائمة"
                            >
                                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                            </button>
                            <button 
                                onClick={() => setAutoDialer(!autoDialer)} 
                                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${autoDialer ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                title="وضع الاتصال التلقائي"
                            >
                                <PhoneCall size={18} />
                                <span className="hidden sm:inline">تلقائي</span>
                            </button>
                            <button 
                                onClick={() => setIsScriptsOpen(true)} 
                                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                title="سكريبتات الرد"
                            >
                                <FileText size={18} />
                                <span className="hidden sm:inline">سكريبت</span>
                            </button>
                        </div>
                    </div>
                    {pendingOrders.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                            <Check size={48} className="mb-4 opacity-50"/>
                            <p className="font-bold">{searchTerm ? `لا توجد نتائج بحث لـ "${searchTerm}"` : "لا توجد طلبات في انتظار التأكيد."}</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-4">
                                <EmployeePerformance orders={orders} currentUser={currentUser} />
                            </div>
                            {pendingOrders.map(order => {
                                const orderAgeHours = (new Date().getTime() - new Date(order.date).getTime()) / (1000 * 60 * 60);
                                const isHighPriority = orderAgeHours > 2;
                                
                                return (
                                    <button 
                                        key={order.id} 
                                        onClick={() => handleSelectOrder(order)} 
                                        className={`w-full text-right p-4 flex items-start gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 relative ${activeOrder?.id === order.id ? 'bg-cyan-50 dark:bg-cyan-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                    >
                                        {isHighPriority && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" title="طلب قديم - أولوية عالية" />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">{order.customerName}</h4>
                                                <div className="text-left">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase">{formatOrderTime(order.date)}</div>
                                                    <div className={`text-[10px] font-bold ${isHighPriority ? 'text-red-500' : 'text-slate-500'}`}>{timeSince(order.date)}</div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">{order.productName}</p>
                                            <div className="flex justify-between items-center mt-2">
                                                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{(order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0))).toLocaleString()} ج.م</p>
                                                {order.callAttempts && order.callAttempts > 0 && (
                                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                                        {order.callAttempts} محاولات
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className={`w-full md:w-2/3 flex flex-col h-full transition-all duration-300 ${activeOrder ? 'flex' : 'hidden md:flex'}`}>
                    {activeOrder ? (
                        <>
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
                                <button onClick={() => setActiveOrder(null)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowRight size={20}/></button>
                                <div className="flex-1 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-800 dark:text-white">تفاصيل الطلب #{activeOrder.orderNumber}</h3>
                                    <div className="flex items-center gap-2 text-sm font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                        <PhoneCall size={14} className={callDuration > 0 ? "animate-pulse text-emerald-500" : ""} />
                                        {formatDuration(callDuration)}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-6 space-y-6 overflow-y-auto md:pb-6 pb-28">
                                <CustomerHistory allOrders={orders} customerPhone={activeOrder.customerPhone} currentOrderId={activeOrder.id} />
                                
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 p-4 rounded-xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 text-sm flex items-center gap-2"><PhoneCall size={16}/> تتبع محاولات الاتصال</h4>
                                        <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                                            المحاولة رقم {activeOrder.callAttempts || 0}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {CALL_STATUS_ACTIONS.map(status => (
                                            <button
                                                key={status.label}
                                                onClick={() => {
                                                    handleActionSubmit(status.action);
                                                }}
                                                className={`p-2 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 ${status.color}`}
                                            >
                                                {status.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <DetailSection title="بيانات العميل">
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1"><UserIcon size={14}/> الاسم</label>
                                            {isEditingName ? (<div className="flex gap-2"><input type="text" value={editedName} onChange={e => setEditedName(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold"/><button onClick={handleSaveName} className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Save size={16}/></button></div>) 
                                            : (<div className="flex items-start justify-between"><p className="font-bold text-sm text-slate-800 dark:text-white pr-4">{activeOrder.customerName}</p><button onClick={() => { setIsEditingName(true); setEditedName(activeOrder.customerName); }} className="p-1 text-slate-400 hover:text-blue-500"><Edit3 size={14}/></button></div>)}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1"><Phone size={14}/> الهاتف</label>
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-sm text-slate-800 dark:text-white font-mono tracking-wider">{activeOrder.customerPhone}</p>
                                                <div className="flex items-center gap-2 relative">
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setWhatsappMenuOpen(!whatsappMenuOpen)}
                                                            className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full hover:bg-emerald-200 transition-colors" 
                                                            title="مراسلة عبر واتساب"
                                                        >
                                                            <MessageSquare size={16}/>
                                                        </button>
                                                        {whatsappMenuOpen && (
                                                            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-10 overflow-hidden">
                                                                <div className="p-2 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500">اختر رسالة</div>
                                                                {WHATSAPP_TEMPLATES.map(template => (
                                                                    <a 
                                                                        key={template.id}
                                                                        href={getWhatsAppLink(activeOrder, template.id)}
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-right"
                                                                        onClick={() => setWhatsappMenuOpen(false)}
                                                                    >
                                                                        {template.label}
                                                                    </a>
                                                                ))}
                                                                <a 
                                                                    href={getWhatsAppLink(activeOrder)}
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-right font-bold border-t border-slate-100 dark:border-slate-700"
                                                                    onClick={() => setWhatsappMenuOpen(false)}
                                                                >
                                                                    رسالة افتراضية
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {whatsappMenuOpen && <div className="fixed inset-0 z-0" onClick={() => setWhatsappMenuOpen(false)}></div>}
                                                    
                                                    <a 
                                                        href={`tel:${activeOrder.customerPhone}`} 
                                                        onClick={() => setCallStartTime(Date.now())}
                                                        className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 transition-colors" 
                                                        title="اتصال"
                                                    >
                                                        <PhoneCall size={16}/>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1"><Phone size={14}/> هاتف إضافي</label>
                                            {isEditingPhone2 ? (
                                                <div className="flex gap-2">
                                                    <input type="tel" value={editedPhone2} onChange={e => setEditedPhone2(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold" placeholder="أضف رقم هاتف آخر..."/>
                                                    <button onClick={handleSavePhone2} className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Save size={16}/></button>
                                                    <button type="button" onClick={() => setIsEditingPhone2(false)} className="p-2 bg-slate-100 text-slate-600 rounded-md"><X size={16}/></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    {activeOrder.customerPhone2 ? (
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white font-mono tracking-wider">{activeOrder.customerPhone2}</p>
                                                    ) : (
                                                        <p className="text-sm text-slate-400 italic">لا يوجد</p>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        {activeOrder.customerPhone2 && (
                                                            <>
                                                                <a href={`https://wa.me/2${activeOrder.customerPhone2.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full hover:bg-emerald-200 transition-colors" title="مراسلة عبر واتساب">
                                                                    <MessageSquare size={16}/>
                                                                </a>
                                                                <a 
                                                                    href={`tel:${activeOrder.customerPhone2}`} 
                                                                    onClick={() => setCallStartTime(Date.now())}
                                                                    className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 transition-colors" 
                                                                    title="اتصال"
                                                                >
                                                                    <PhoneCall size={16}/>
                                                                </a>
                                                            </>
                                                        )}
                                                        <button onClick={() => { setIsEditingPhone2(true); setEditedPhone2(activeOrder.customerPhone2 || ''); }} className="p-2 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 transition-colors" title={activeOrder.customerPhone2 ? 'تعديل' : 'إضافة رقم'}>
                                                            {activeOrder.customerPhone2 ? <Edit3 size={14}/> : <Plus size={14}/>}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={14}/> العنوان</label>
                                            {isEditingAddress ? (
                                                <div className="space-y-2">
                                                    <select 
                                                        value={editedGovernorate} 
                                                        onChange={e => {
                                                            setEditedGovernorate(e.target.value);
                                                            setEditedCity('');
                                                        }}
                                                        className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold"
                                                    >
                                                        <option value="">اختر المحافظة...</option>
                                                        {activeShippingOptions.map(opt => (
                                                            <option key={opt.id} value={opt.label}>{opt.label} ({opt.price} ج.م)</option>
                                                        ))}
                                                    </select>
                                                    {editedGovernorate && activeShippingOptions.find(opt => opt.label === editedGovernorate)?.cities && activeShippingOptions.find(opt => opt.label === editedGovernorate)!.cities!.length > 0 && (
                                                        <select
                                                            value={editedCity}
                                                            onChange={e => setEditedCity(e.target.value)}
                                                            className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold"
                                                        >
                                                            <option value="">اختر المدينة...</option>
                                                            {activeShippingOptions.find(opt => opt.label === editedGovernorate)?.cities?.map(city => (
                                                                <option key={city.id} value={city.name}>{city.name} {city.shippingPrice > 0 ? `(${city.shippingPrice} ج.م)` : ''}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={editedAddress} 
                                                            onChange={e => setEditedAddress(e.target.value)} 
                                                            className={`w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold ${editedAddress.length > 0 && editedAddress.length < 10 ? 'border-red-500 border' : ''}`}
                                                            placeholder="العنوان بالتفصيل..."
                                                         />
                                                        <button onClick={handleSaveAddress} className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Save size={16}/></button>
                                                    </div>
                                                </div>
                                            ) : (
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-bold text-sm text-slate-800 dark:text-white pr-4">{activeOrder.customerAddress}</p>
                                                            <p className="text-xs text-slate-500 mt-1">{activeOrder.shippingArea} {activeOrder.city ? `- ${activeOrder.city}` : ''}</p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <button 
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(`${activeOrder.customerAddress}, ${activeOrder.city || ''}, ${activeOrder.shippingArea}`);
                                                                        alert('تم نسخ العنوان');
                                                                    }}
                                                                    className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                                                                >
                                                                    <Save size={12}/> نسخ العنوان
                                                                </button>
                                                                <a 
                                                                    href={`https://www.google.com/maps/search/${encodeURIComponent(`${activeOrder.customerAddress} ${activeOrder.city || ''} ${activeOrder.shippingArea}`)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1"
                                                                >
                                                                    <MapPin size={12}/> خرائط جوجل
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button 
                                                                onClick={async () => {
                                                                    setIsVerifyingAddress(true);
                                                                    // Simulated verification
                                                                    await new Promise(r => setTimeout(r, 1500));
                                                                    setAddressVerified(activeOrder.customerAddress.length > 15);
                                                                    setIsVerifyingAddress(false);
                                                                }} 
                                                                disabled={isVerifyingAddress}
                                                                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold ${addressVerified === true ? 'bg-green-100 text-green-700' : addressVerified === false ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                                title="التحقق من العنوان"
                                                            >
                                                                {isVerifyingAddress ? <RefreshCw size={12} className="animate-spin"/> : addressVerified === true ? <CheckCircle size={12}/> : addressVerified === false ? <AlertTriangle size={12}/> : <MapPin size={12}/>}
                                                                {addressVerified === true ? 'موثق' : addressVerified === false ? 'غير دقيق' : 'تحقق'}
                                                            </button>
                                                            <button onClick={() => { setIsEditingAddress(true); setEditedAddress(activeOrder.customerAddress); setEditedGovernorate(activeOrder.shippingArea); setEditedCity(activeOrder.city || ''); }} className="p-1 text-slate-400 hover:text-blue-500"><Edit3 size={14}/></button>
                                                        </div>
                                                    </div>
                                            )}
                                        </div>
                                    </DetailSection>
                                    <DetailSection title="تفاصيل الطلب">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs text-slate-500 flex items-center gap-1"><Package size={14}/> المنتجات</label>
                                                <button onClick={() => setIsProductModalOpen(true)} className="text-xs font-bold text-blue-600 hover:underline">تعديل</button>
                                            </div>
                                            <div className="space-y-2">
                                                {activeOrder.items.map(item => {
                                                    const product = settings.products.find(p => p.id === item.productId);
                                                    const isLowStock = product && product.stockQuantity < 5;
                                                    return (
                                                        <div key={item.productId + (item.variantId || '')} className="flex justify-between items-center bg-slate-100 dark:bg-slate-700/50 p-2 rounded-lg">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{item.name}</p>
                                                                    {isLowStock && (
                                                                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                                            <AlertTriangle size={10}/> مخزون منخفض ({product.stockQuantity})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500">{item.variantDescription || ''}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{item.quantity} x {item.price.toLocaleString()} ج.م</p>
                                                                <p className="font-black text-xs text-indigo-600 dark:text-indigo-400">{(item.quantity * item.price).toLocaleString()} ج.م</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <DetailItem icon={<CalendarDays size={14}/>} label="تاريخ الطلب" value={new Date(activeOrder.date).toLocaleString('ar-EG')} />
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1"><Truck size={14}/> شركة الشحن</label>
                                            {isEditingShippingCompany ? (
                                                <div className="flex gap-2">
                                                    <select value={editedShippingCompany} onChange={e => setEditedShippingCompany(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold">
                                                        {Object.keys(settings.shippingOptions).filter(c => settings.activeCompanies[c]).map(company => (
                                                            <option key={company} value={company}>{company}</option>
                                                        ))}
                                                    </select>
                                                    <button onClick={handleSaveShippingCompany} className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Save size={16}/></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-start justify-between">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{activeOrder.shippingCompany}</p>
                                                    <button onClick={() => { setIsEditingShippingCompany(true); setEditedShippingCompany(activeOrder.shippingCompany); }} className="p-1 text-slate-400 hover:text-blue-500"><Edit3 size={14}/></button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1"><Edit3 size={14}/> ملاحظات الطلب</label>
                                            {isEditingNotes ? (
                                                <div className="flex gap-2">
                                                    <textarea value={editedNotes} onChange={e => setEditedNotes(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold" rows={2}></textarea>
                                                    <button onClick={handleSaveNotes} className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Save size={16}/></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-start justify-between">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{activeOrder.notes || <span className="text-slate-400 italic">لا يوجد ملاحظات</span>}</p>
                                                    <button onClick={() => { setIsEditingNotes(true); setEditedNotes(activeOrder.notes || ''); }} className="p-1 text-slate-400 hover:text-blue-500"><Edit3 size={14}/></button>
                                                </div>
                                            )}
                                        </div>
                                    </DetailSection>
                                </div>
                                <DetailSection title="الملخص المالي">
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 dark:text-slate-400">إجمالي المنتجات</span>
                                            <span className="font-bold text-slate-800 dark:text-white">{productsTotal.toLocaleString()} ج.م</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 dark:text-slate-400">مصاريف الشحن</span>
                                            <span className="font-bold text-slate-800 dark:text-white">{activeOrder.shippingFee.toLocaleString()} ج.م</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 dark:text-slate-400">رسوم المعاينة</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-800 dark:text-white">{inspectionFeeValue.toLocaleString()} ج.م</span>
                                                <button
                                                    onClick={() => updateActiveOrderField('includeInspectionFee', !activeOrder.includeInspectionFee)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${activeOrder.includeInspectionFee ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'}`}
                                                >
                                                    {activeOrder.includeInspectionFee ? 'إلغاء' : 'تفعيل'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1">الخصم</label>
                                            {isEditingDiscount ? (
                                                <div className="flex gap-2">
                                                    <input type="number" value={editedDiscount} onChange={e => setEditedDiscount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold" min="0"/>
                                                    <button onClick={handleSaveDiscount} className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Save size={16}/></button>
                                                    <button type="button" onClick={() => setIsEditingDiscount(false)} className="p-2 bg-slate-100 text-slate-600 rounded-md"><X size={16}/></button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center text-red-500">
                                                    <span className="font-bold">-{activeOrder.discount ? activeOrder.discount.toLocaleString() : 0} ج.م</span>
                                                    <button onClick={() => { setIsEditingDiscount(true); setEditedDiscount(activeOrder.discount || 0); }} className="p-1 text-slate-400 hover:text-blue-500"><Edit3 size={14}/></button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-700 my-2 !mt-4 !mb-3"></div>
                                        <div className="flex justify-between items-center font-black text-lg">
                                            <span className="text-slate-800 dark:text-white">الإجمالي المطلوب:</span>
                                            <span className="text-indigo-600 dark:text-indigo-400">{totalAmount.toLocaleString()} ج.م</span>
                                        </div>
                                    </div>
                                </DetailSection>

                                {upsellProducts.length > 0 && (
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-4">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-2">
                                            <Package size={16} /> اقتراحات للبيع المتقاطع (Upselling)
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {upsellProducts.map(product => (
                                                <div key={product.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-3">
                                                    {product.thumbnail ? (
                                                        <img src={product.thumbnail} alt={product.name} className="w-12 h-12 rounded-md object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                                            <Package size={20} />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{product.name}</p>
                                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-black">{product.price.toLocaleString()} ج.م</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm">انطباع العميل</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {SENTIMENT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setSentiment(opt.value as any)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sentiment === opt.value ? opt.color + ' ring-2 ring-offset-2 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm">تسجيل إجراء ومتابعة</h4>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <select value={selectedAction} onChange={e => setSelectedAction(e.target.value)} className="w-full p-3 pr-4 pl-8 appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                                                {CONFIRMATION_ACTIONS.map(action => <option key={action} value={action}>{action}</option>)}
                                            </select>
                                            <ChevronsUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const text = `أهلاً ${activeOrder.customerName} 👋، نود تأكيد طلبك من ${activeStore?.name || 'متجرنا'}.\n\nالمنتجات: ${activeOrder.items.map(i => i.name).join(', ')}\nالإجمالي: ${totalAmount} ج.م\nالعنوان: ${activeOrder.customerAddress}\n\nهل البيانات صحيحة؟`;
                                                window.open(`https://wa.me/2${activeOrder.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                            }}
                                            className="p-3 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg font-bold hover:bg-emerald-200 transition-colors"
                                            title="إرسال ملخص الطلب"
                                        >
                                            <Send size={18}/>
                                        </button>
                                    </div>

                                    {(selectedAction === 'تم الإلغاء' || selectedAction === 'مؤجل') && (
                                        <div className="relative animate-in fade-in slide-in-from-top-2">
                                            <select 
                                                value={cancellationReason} 
                                                onChange={e => setCancellationReason(e.target.value)} 
                                                className="w-full p-3 pr-4 pl-8 appearance-none bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-red-500 text-red-700 dark:text-red-400"
                                            >
                                                <option value="">{selectedAction === 'تم الإلغاء' ? 'اختر سبب الإلغاء (إجباري)' : 'اختر سبب التأجيل (إجباري)'}</option>
                                                {CANCELLATION_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                                            </select>
                                            <AlertTriangle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400"/>
                                        </div>
                                    )}

                                    {(selectedAction === 'العميل لم يرد' || selectedAction === 'مؤجل') && (
                                        <div className="relative animate-in fade-in slide-in-from-top-2">
                                            <select 
                                                value={reminderTime} 
                                                onChange={e => setReminderTime(Number(e.target.value))} 
                                                className="w-full p-3 pr-4 pl-8 appearance-none bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-blue-700 dark:text-blue-400"
                                            >
                                                <option value="">تذكير بالمتابعة (اختياري)</option>
                                                {REMINDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                            <Bell size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400"/>
                                        </div>
                                    )}

                                    <textarea placeholder="إضافة ملاحظات (اختياري)..." rows={2} value={actionNotes} onChange={e => setActionNotes(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {QUICK_NOTES.map(note => (
                                            <button
                                                key={note}
                                                onClick={() => setActionNotes(prev => prev ? `${prev} | ${note}` : note)}
                                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-400 rounded-full hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                                            >
                                                + {note}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => handleActionSubmit(selectedAction)} className="w-full p-3 bg-indigo-600/10 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg font-bold hover:bg-indigo-600/20 flex items-center justify-center gap-2 transition-colors">
                                        <Save size={18}/> حفظ الإجراء
                                    </button>
                                </div>
                                
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 mb-3 text-sm flex items-center gap-2"><HistoryIcon size={16}/> سجل المكالمات</h4>
                                    <div className="space-y-3">
                                        {activeOrder.confirmationLogs && activeOrder.confirmationLogs.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                                                {activeOrder.confirmationLogs.slice().reverse().map((log, index) => (
                                                    <div key={log.timestamp + index} className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-xs">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-800 dark:text-white">{log.action}</span>
                                                            <span className="text-slate-500 font-mono">{timeSince(log.timestamp)}</span>
                                                        </div>
                                                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                                                            بواسطة: <span className="font-bold">{log.userName}</span>
                                                        </p>
                                                        {log.notes && (
                                                            <blockquote className="mt-2 p-2 bg-white dark:bg-slate-700 rounded border-r-4 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 italic">
                                                               {log.notes}
                                                            </blockquote>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-center text-slate-400 py-4">لا توجد سجلات سابقة.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

                                <div>
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm mb-3">اتخاذ قرار نهائي</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => handleActionSubmit('تم الإلغاء')} className="w-full p-3 bg-red-600/10 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg font-bold hover:bg-red-600/20 flex items-center justify-center gap-2 transition-colors">
                                            <X size={18}/> إلغاء الطلب
                                        </button>
                                        <button onClick={() => handleActionSubmit('تم التأكيد')} className="w-full p-3 bg-emerald-600/10 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg font-bold hover:bg-emerald-600/20 flex items-center justify-center gap-2 transition-colors">
                                            <Check size={18}/> تأكيد الطلب
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 hidden md:flex items-center justify-center text-center text-slate-400 p-8"><div><PhoneForwarded size={64} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" /><h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">ابدأ بتأكيد الطلبات</h3><p className="text-sm mt-2">اختر طلباً من القائمة على اليمين لعرض تفاصيله.</p></div></div>
                    )}
                </div>
            </div>
            {isProductModalOpen && activeOrder && <ProductEditModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProducts} currentItems={activeOrder.items} allProducts={settings.products} />}
            {isLogModalOpen && activeOrder && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setIsLogModalOpen(false)}>
                    <motion.div 
                        initial={{ y: "100%" }} 
                        animate={{ y: "0%" }} 
                        exit={{ y: "100%" }} 
                        transition={{ type: "spring", stiffness: 300, damping: 30 }} 
                        className="w-full bg-white dark:bg-slate-900 rounded-t-2xl p-5 shadow-lg border-t border-slate-200 dark:border-slate-800" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4"></div>
                        <h3 className="font-bold text-lg mb-4 text-center text-slate-800 dark:text-white">تسجيل إجراء للمكالمة</h3>
                        <div className="space-y-3">
                            <div className="relative">
                                <select 
                                    value={selectedAction} 
                                    onChange={e => setSelectedAction(e.target.value)} 
                                    className="w-full p-3 pr-4 pl-8 appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {CONFIRMATION_ACTIONS.map(action => <option key={action} value={action}>{action}</option>)}
                                </select>
                                <ChevronsUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            </div>
                            <textarea 
                                placeholder="إضافة ملاحظات (اختياري)..." 
                                rows={3} 
                                value={actionNotes} 
                                onChange={e => setActionNotes(e.target.value)} 
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            ></textarea>
                            <button 
                                onClick={() => { handleActionSubmit(selectedAction); setIsLogModalOpen(false); }} 
                                className="w-full p-4 bg-indigo-600 text-white rounded-lg font-black hover:bg-indigo-700"
                            >
                                حفظ الإجراء
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {isScriptsOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-600 text-white">
                            <h3 className="font-bold flex items-center gap-2"><FileText size={20}/> سكريبتات الرد المقترحة</h3>
                            <button onClick={() => setIsScriptsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                            {SCRIPTS.map((script, i) => (
                                <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                    <h4 className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{script.title}</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{script.text}</p>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(script.text);
                                            alert('تم نسخ النص بنجاح');
                                        }}
                                        className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                                    >
                                        <Save size={12}/> نسخ النص
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                            <button onClick={() => setIsScriptsOpen(false)} className="w-full p-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold">إغلاق</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

interface ProductEditModalProps {
    isOpen: boolean; onClose: () => void; onSave: (items: OrderItem[]) => void;
    currentItems: OrderItem[]; allProducts: Product[];
}
const ProductEditModal: React.FC<ProductEditModalProps> = ({ isOpen, onClose, onSave, currentItems, allProducts }) => {
    const [editedItems, setEditedItems] = useState<OrderItem[]>(currentItems);
    
    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        let newItems = [...editedItems];
        if (field === 'productId') {
            const product = allProducts.find(p => p.id === value);
            if(product) {
                newItems[index] = { 
                    ...newItems[index], 
                    productId: value, 
                    name: product.name, 
                    price: product.price, 
                    cost: product.costPrice, 
                    weight: product.weight, 
                    thumbnail: product.thumbnail,
                    variantId: undefined,
                    variantDescription: undefined
                };
            }
        } else if (field === 'variantId') {
            const product = allProducts.find(p => p.id === newItems[index].productId);
            const variant = product?.variants?.find(v => v.id === value);
            if (variant) {
                newItems[index] = {
                    ...newItems[index],
                    variantId: value,
                    variantDescription: Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join(', '),
                    price: variant.price,
                    cost: variant.costPrice,
                    weight: variant.weight
                };
            } else {
                newItems[index] = {
                    ...newItems[index],
                    variantId: undefined,
                    variantDescription: undefined,
                    price: product?.price || 0,
                    cost: product?.costPrice || 0,
                    weight: product?.weight || 0
                };
            }
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        setEditedItems(newItems);
    };

    const addItem = () => {
        if (allProducts.length === 0) return;
        const firstProduct = allProducts[0];
        setEditedItems([...editedItems, { productId: firstProduct.id, name: firstProduct.name, quantity: 1, price: firstProduct.price, cost: firstProduct.costPrice, weight: firstProduct.weight, thumbnail: firstProduct.thumbnail }]);
    };
    const removeItem = (index: number) => setEditedItems(editedItems.filter((_, i) => i !== index));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-black dark:text-white flex items-center gap-3"><Package className="text-indigo-500"/> تعديل منتجات الطلب</h3>
                    <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {editedItems.map((item, index) => {
                        const product = allProducts.find(p => p.id === item.productId);
                        const hasVariants = product?.variants && product.variants.length > 0;
                        const selectedVariant = hasVariants ? product.variants?.find(v => v.id === item.variantId) : null;
                        const stock = hasVariants ? (selectedVariant?.stock || 0) : (product?.stock || 0);
                        
                        return (
                            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 border rounded-lg space-y-2 relative">
                                <button onClick={() => removeItem(index)} className="absolute top-2 left-2 text-slate-400 hover:text-red-500"><XCircle size={16}/></button>
                                <select value={item.productId} onChange={e => updateItem(index, 'productId', e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 rounded text-sm font-bold">{allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                
                                {hasVariants && (
                                    <select value={item.variantId || ''} onChange={e => updateItem(index, 'variantId', e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 rounded text-sm">
                                        <option value="">بدون متغيرات</option>
                                        {product.variants?.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(', ')}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                <div className="flex gap-2 items-center">
                                    <input type="number" placeholder="الكمية" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} className="w-1/3 p-2 bg-white dark:bg-slate-800 rounded font-bold" min="1" />
                                    <input type="number" placeholder="السعر" value={item.price} onChange={e => updateItem(index, 'price', Number(e.target.value))} className="w-1/3 p-2 bg-white dark:bg-slate-800 rounded font-bold" min="0" />
                                    <div className="w-1/3 text-center text-xs font-bold text-slate-500">
                                        المخزون: <span className={stock < item.quantity ? 'text-red-500' : 'text-emerald-500'}>{stock}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <button onClick={addItem} className="w-full mt-3 p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-bold rounded-lg text-sm">+ إضافة منتج آخر</button>
                </div>
                <div className="p-6 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-3">
                    <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold border border-slate-200 dark:border-slate-600">إلغاء</button>
                    <button onClick={() => onSave(editedItems)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2"><Save size={16}/> حفظ التغييرات</button>
                </div>
            </div>
        </div>
    );
};


export default ConfirmationQueuePage;
