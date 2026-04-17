import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, Edit3, ChevronDown, Package, MapPin, Coins, FileSearch, AlertCircle, ShieldCheck, ShieldAlert, Banknote, ShoppingBag, Save, XCircle, Info, User as UserIcon, Building, Download, Filter, Truck, CheckCircle, RefreshCcw, Briefcase, ChevronLeft, ChevronRight, MoreVertical, Percent, Lock, Unlock, Receipt, AlertTriangle, MessageCircle, Printer, Wand2, FileText, Phone, Archive, ArrowRightLeft, Image as ImageIcon, FileDown, LayoutList, LayoutGrid, Settings as SettingsIcon, X, PhoneForwarded, Users } from 'lucide-react';
import { Order, Settings, OrderStatus, Wallet, Transaction, PaymentStatus, PreparationStatus, OrderItem, Product, CustomerProfile, Store, Employee, User, AuditLog } from '../types';
import { ORDER_STATUSES, EGYPT_GOVERNORATES, ORDER_STATUS_METADATA } from '../constants';
import { motion, Variants } from 'framer-motion';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';
import { generateShippingLabelHTML } from '../utils/shippingLabelGenerator';
import { generateShippingNote } from '../services/geminiService';
import { calculateCodFee } from '../utils/financials';
import { generateOrdersReportHTML } from '../utils/reportGenerator';
import { triggerWebhooks } from '../utils/webhook';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

const PREPARATION_STATUSES: PreparationStatus[] = ['بانتظار التجهيز', 'جاهز'];
const PAYMENT_STATUSES: PaymentStatus[] = ['بانتظار الدفع', 'مدفوع', 'مدفوع جزئياً', 'مرتجع'];

interface OrdersListProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  settings: Settings;
  currentUser: User | null;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  addLoyaltyPointsForOrder: (order: Order) => void;
  activeStore?: Store;
  customers: CustomerProfile[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
}

interface NewOrderState extends Partial<Omit<Order, 'id'>> {
  items: OrderItem[];
  customerPhone2?: string;
  country?: string;
  buildingDetails?: string;
  creditAmount?: number;
  totalAmountOverrideReason?: string;
}

const EditTotalModal: React.FC<{ 
    currentTotal: number; 
    onClose: () => void; 
    onApply: (amount: number, reason: string) => void; 
}> = ({ currentTotal, onClose, onApply }) => {
    const [amount, setAmount] = useState(currentTotal);
    const [reason, setReason] = useState('');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
                <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">تعديل إجمالي الطلب</h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        عميلك سيدفع هذا المبلغ لمندوب الشحن عند استلام الطلب
                    </p>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">إجمالي الطلب</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl text-2xl font-black text-slate-800 dark:text-white outline-none focus:border-emerald-500 transition-all text-left pr-16"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">ج.م</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">Reason</label>
                            <textarea 
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="أدخل سببًا..."
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => onApply(amount, reason)}
                            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                        >
                            تطبيق
                        </button>
                        <button 
                            onClick={onClose}
                            className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            إلغاء
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const WaybillModal: React.FC<{ order: Order; onClose: () => void; onSave: (waybill: string) => void; }> = ({ order, onClose, onSave }) => {
    const [waybill, setWaybill] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!waybill.trim()) return;
        onSave(waybill);
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-6">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20">
                        <FileSearch size={24}/>
                    </div>
                    <h3 className="text-xl font-black dark:text-white">إدخال رقم بوليصة الشحن</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    لتغيير حالة الطلب إلى "تم الارسال"، يجب إدخال رقم بوليصة الشحن أولاً.
                </p>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        value={waybill}
                        onChange={e => setWaybill(e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-center text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                        placeholder="رقم البوليصة"
                        autoFocus
                    />
                    <div className="flex gap-3 mt-8">
                        <button type="submit" disabled={!waybill.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 shadow-sm hover:shadow">
                            حفظ وتغيير الحالة
                        </button>
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const OrdersList: React.FC<OrdersListProps & { onRefresh?: () => void }> = ({ orders, setOrders, products, settings, currentUser, setWallet, addLoyaltyPointsForOrder, activeStore, customers, setCustomers, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState<Order | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (onRefresh && document.visibilityState === 'visible') {
        onRefresh();
      }
    }, 10000); // UI poll every 10 seconds for smoothness
    return () => clearInterval(interval);
  }, [onRefresh]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };
  
  const [activeTab, setActiveTab] = useState('الجميع');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<Omit<Order, 'id'> | null>(null);
  const [orderForWaybill, setOrderForWaybill] = useState<{ orderId: string, newStatus: OrderStatus } | null>(null);
  
  // Advanced Filters
  const [filterGov, setFilterGov] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState<Order | null>(null);
  const [showAssignment, setShowAssignment] = useState<Order | null>(null);
  const [reportPreviewHtml, setReportPreviewHtml] = useState<string | null>(null);
  
  const addAuditLog = (orderId: string, action: string, details: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const newLog: AuditLog = {
          id: Math.random().toString(36).substr(2, 9),
          action,
          details,
          timestamp: new Date().toISOString(),
          userEmail: currentUser?.email || 'System'
        };
        return {
          ...o,
          auditLogs: [...(o.auditLogs || []), newLog]
        };
      }
      return o;
    }));
  };
  
  const activeCompanies = useMemo(() => 
    Object.keys(settings.shippingOptions).filter(company => settings.activeCompanies[company] !== false),
    [settings.shippingOptions, settings.activeCompanies]
  );
  
  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map<string, Pick<CustomerProfile, 'name' | 'phone' | 'address'>>();
    orders.forEach(order => {
      const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
      if (cleanPhone && !customerMap.has(cleanPhone)) {
        customerMap.set(cleanPhone, {
          name: order.customerName,
          phone: order.customerPhone,
          address: order.customerAddress,
        });
      }
    });
    return Array.from(customerMap.values());
  }, [orders]);


  const getInitialNewOrder = (): NewOrderState => ({
    orderNumber: '', date: new Date().toISOString(), shippingCompany: activeCompanies[0] || 'ارامكس', shippingArea: '', customerName: '', customerPhone: '',
    customerPhone2: '', country: 'مصر', buildingDetails: '',
    items: [], shippingFee: 0, status: 'في_انتظار_المكالمة', includeInspectionFee: true, isInsured: true,
    paymentStatus: 'بانتظار الدفع', preparationStatus: 'بانتظار التجهيز', discount: 0, notes: '',
    orderType: 'standard', originalOrderId: undefined,
    totalAmountOverrideReason: '',
  });

  const [newOrder, setNewOrder] = useState<NewOrderState>(getInitialNewOrder());

  useEffect(() => {
    if (!showAddModal && !editingOrder) {
        setNewOrder(getInitialNewOrder());
    }
  }, [showAddModal, editingOrder, settings, activeCompanies]);

  useEffect(() => {
    const orderData = editingOrder || newOrder;
    const options = settings.shippingOptions[orderData.shippingCompany!] || [];
    const effectiveOptions = options.length > 0 ? options : EGYPT_GOVERNORATES.map((gov, index) => ({
        id: `gov_fallback_${index}`,
        label: gov.name,
        price: 0,
        baseWeight: 1,
        extraKgPrice: 0,
        cities: gov.cities.map((city, cIndex) => ({ id: `city_fallback_${index}_${cIndex}`, name: city, shippingPrice: 0 }))
    })) as any[];

    const selectedOpt = effectiveOptions.find(o => o.label === (orderData.governorate || orderData.shippingArea)) || effectiveOptions[0];
    if (selectedOpt) {
      // Check for city-specific price
      let baseFee = selectedOpt.price || 0;
      let extraKgPrice = selectedOpt.extraKgPrice || 0;
      if (orderData.city) {
          const cityOpt = selectedOpt.cities?.find((c: any) => c.name === orderData.city);
          if (cityOpt) {
              if (cityOpt.useParentFees) {
                  baseFee = selectedOpt.price || 0;
                  extraKgPrice = selectedOpt.extraKgPrice || 0;
              } else if (cityOpt.shippingPrice !== undefined && cityOpt.shippingPrice !== null) {
                  baseFee = cityOpt.shippingPrice;
                  extraKgPrice = cityOpt.extraKgPrice || 0;
              }
          }
      }

      const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
      const baseWeight = compFees?.useCustomFees && compFees.baseWeight !== undefined 
          ? compFees.baseWeight 
          : (settings.baseWeight !== undefined ? settings.baseWeight : 5);
          
      const totalWeight = orderData.items?.reduce((sum, item) => {
          const itemWeight = parseFloat(item.weight?.toString() || '0');
          const itemQuantity = parseInt(item.quantity?.toString() || '1');
          return sum + (itemWeight * itemQuantity);
      }, 0) || 0;

      const extraWeight = Math.max(0, totalWeight - baseWeight);
      const totalFee = baseFee + (Math.ceil(extraWeight) * extraKgPrice);
      
      if (orderData.shippingFee !== totalFee || orderData.shippingArea !== selectedOpt.label) {
        if (editingOrder) {
          setEditingOrder(prev => (prev ? { ...prev, shippingFee: totalFee, shippingArea: selectedOpt.label } : prev));
        } else {
          setNewOrder(prev => ({ ...prev, shippingFee: totalFee, shippingArea: selectedOpt.label }));
        }
      }
    }
  }, [editingOrder, newOrder, settings.shippingOptions]);

  const filteredOrders = useMemo(() => {
    let baseFilter;
    if (activeTab === 'مؤرشف') {
        baseFilter = orders.filter(o => o.status === 'مؤرشف');
    } else {
        baseFilter = orders.filter(o => o.status !== 'مؤرشف');
    }

    const searched = baseFilter.filter((o: Order) => {
      const matchesSearch = (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.waybillNumber && o.waybillNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesGov = !filterGov || (o.governorate || o.shippingArea) === filterGov;
      const matchesCompany = !filterCompany || o.shippingCompany === filterCompany;
      const matchesEmployee = !filterEmployee || o.assignedTo === filterEmployee;
      
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
          const orderDate = new Date(o.date).getTime();
          if (dateRange.start) {
              matchesDate = matchesDate && orderDate >= new Date(dateRange.start).getTime();
          }
          if (dateRange.end) {
              const endDate = new Date(dateRange.end);
              endDate.setHours(23, 59, 59, 999);
              matchesDate = matchesDate && orderDate <= endDate.getTime();
          }
      }

      return matchesSearch && matchesGov && matchesCompany && matchesEmployee && matchesDate;
    });
      
    let tabFiltered = searched;
    if (activeTab !== 'الجميع') {
        tabFiltered = searched.filter(o => o.status === activeTab);
    }

    return tabFiltered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, searchTerm, activeTab]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const orderData: NewOrderState = editingOrder || newOrder;
    
    if (!orderData.items || orderData.items.length === 0) {
      alert("يجب إضافة منتج واحد على الأقل.");
      return;
    }
    
    const fullAddress = `${orderData.customerAddress}, ${orderData.buildingDetails || ''}`.trim();
    const finalNotes = orderData.notes || '';

    const totalProductPrice = orderData.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const totalProductCost = orderData.items.reduce((sum, item) => sum + (item.cost || 0) * (item.quantity || 1), 0);
    const totalWeight = orderData.items.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);
    const productNames = orderData.items.map(item => item.name).join(', ');

    const orderToAdd: Omit<Order, 'id'> & { totalAmountOverride?: number } = {
      ...(orderData as Omit<Order, 'id'>),
      customerAddress: fullAddress,
      notes: finalNotes,
      orderNumber: orderData.orderNumber || `${activeStore?.id ? activeStore.id + '-' : ''}${Date.now()}`,
      productPrice: totalProductPrice,
      productCost: totalProductCost,
      weight: totalWeight,
      productName: productNames,
    };
    
    const creditAmount = orderData.creditAmount || 0;
    if (orderData.orderType === 'exchange' && creditAmount > 0) {
        const newTotal = (orderToAdd.productPrice + orderToAdd.shippingFee) - (orderToAdd.discount || 0);
        const finalAmount = newTotal - creditAmount;
        
        orderToAdd.totalAmountOverride = finalAmount;
        
        if (finalAmount <= 0) {
            orderToAdd.paymentStatus = 'مدفوع';
        } else {
            orderToAdd.paymentStatus = 'بانتظار الدفع';
        }
        
        orderToAdd.notes = `طلب استبدال للطلب #${orderData.originalOrderId}. تم تطبيق رصيد بقيمة ${creditAmount.toLocaleString()} ج.م.\n${orderToAdd.notes || ''}`.trim();
    }
    
    if (editingOrder) {
      setOrders(prevOrders => prevOrders.map(o => o.id === editingOrder.id ? { ...editingOrder, ...orderToAdd } as Order : o));
      setShowAddModal(false);
      setEditingOrder(null);
    } else {
      setOrderToConfirm(orderToAdd);
    }

    // Save/Update Customer Data
    const cleanPhone = (orderData.customerPhone || '').replace(/\s/g, '').replace('+2', '');
    if (cleanPhone) {
        setCustomers(prev => {
            const existing = prev.find(c => c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
            if (existing) {
                return prev.map(c => c.id === existing.id ? { 
                    ...c, 
                    name: orderData.customerName || c.name,
                    address: orderData.customerAddress || c.address,
                    lastOrderDate: new Date().toISOString()
                } : c);
            } else {
                const newCustomer: CustomerProfile = {
                    id: `cust-${Date.now()}`,
                    name: orderData.customerName || '',
                    phone: orderData.customerPhone || '',
                    address: orderData.customerAddress || '',
                    totalOrders: 1,
                    successfulOrders: 0,
                    returnedOrders: 0,
                    totalSpent: 0,
                    lastOrderDate: new Date().toISOString(),
                    firstOrderDate: new Date().toISOString(),
                    averageOrderValue: 0,
                    loyaltyPoints: 0
                };
                return [newCustomer, ...prev];
            }
        });
    }
  };
  
  const handleConfirmAddOrder = () => {
    if (!orderToConfirm) return;
    const orderWithId: Order = { ...orderToConfirm, id: `order-${Date.now()}` } as Order;
    
    if (orderWithId.orderType === 'exchange' && orderWithId.originalOrderId) {
        setOrders(prevOrders => {
            const originalOrderUpdated = prevOrders.map(o => 
                o.id === orderWithId.originalOrderId ? { ...o, status: 'تم_الاستبدال' as OrderStatus } : o
            );
            return [orderWithId, ...originalOrderUpdated];
        });
    } else {
        setOrders(prevOrders => [orderWithId, ...prevOrders]);
    }

    triggerWebhooks(orderWithId, settings);

    setShowAddModal(false);
    setOrderToConfirm(null);
    setShowSummaryModal(orderWithId);
  };
  
  const handleDeleteOrder = () => {
    if (!orderToDelete) {
        console.error("handleDeleteOrder called with no order to delete.");
        return;
    }
    
    const orderIdToDelete = orderToDelete.id;
    const orderNumberToDelete = orderToDelete.orderNumber;
    
    // 1. Remove Order from the main orders list
    setOrders(prevOrders => prevOrders.filter(o => o.id !== orderIdToDelete));
    
    // 2. Remove associated transactions from Wallet
    setWallet(prevWallet => {
        // Ensure transactions is an array to prevent errors
        const currentTransactions = prevWallet.transactions || [];

        const updatedTransactions = currentTransactions.filter(t => {
            const note = t.note || '';
            const id = t.id || '';

            // Check if transaction is related by order number in note
            const relatedByNote = orderNumberToDelete ? note.includes(`#${orderNumberToDelete}`) : false;

            // Check if transaction is related by a conventional ID
            const relatedById = id.endsWith(`_${orderIdToDelete}`);

            // If it's related, we want to remove it, so we return false from filter
            return !(relatedByNote || relatedById);
        });

        // If nothing changed, return original wallet to avoid re-render
        if (updatedTransactions.length === currentTransactions.length) {
            return prevWallet;
        }

        return {
            ...prevWallet,
            transactions: updatedTransactions
        };
    });

    // 3. Close the confirmation modal
    setOrderToDelete(null);
  };

  const updateOrderField = (id: string, field: keyof Order, value: any) => {
    setOrders(prevOrders => prevOrders.map(o => o.id === id ? { ...o, [field]: value } : o));
  };
  
  const processFinancialsForStatusChange = (orderToUpdate: Order, newStatus: OrderStatus): Order => {
    let updatedOrderData = { ...orderToUpdate, status: newStatus };
    const newTransactions: Transaction[] = [];
    const compFees = settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    
    if ((newStatus === 'تم_الارسال' || newStatus === 'قيد_الشحن') && !updatedOrderData.shippingAndInsuranceDeducted) {
        newTransactions.push({ id: `ship_${orderToUpdate.id}`, type: 'سحب', amount: orderToUpdate.shippingFee, date: new Date().toISOString(), note: `خصم مصاريف شحن أوردر #${orderToUpdate.orderNumber}`, category: 'shipping' });
        
        const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        if (orderToUpdate.isInsured && insuranceRate > 0) {
            const insuranceFee = ((orderToUpdate.productPrice + orderToUpdate.shippingFee) * insuranceRate) / 100;
            newTransactions.push({ id: `insure_${orderToUpdate.id}`, type: 'سحب', amount: insuranceFee, date: new Date().toISOString(), note: `خصم رسوم تأمين أوردر #${orderToUpdate.orderNumber}`, category: 'insurance' });
        }

        if (orderToUpdate.includeInspectionFee && !updatedOrderData.inspectionFeeDeducted) {
            const feeAmount = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
            if (feeAmount > 0) {
                newTransactions.push({ id: `insp_${orderToUpdate.id}`, type: 'سحب', amount: feeAmount, date: new Date().toISOString(), note: `خصم رسوم معاينة أوردر #${orderToUpdate.orderNumber}`, category: 'inspection' });
                updatedOrderData.inspectionFeeDeducted = true;
            }
        }
        updatedOrderData.shippingAndInsuranceDeducted = true;
    }
    
    if ((newStatus === 'مرتجع' || newStatus === 'فشل_التوصيل') && !updatedOrderData.returnFeeDeducted) {
        const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
        if (applyReturnFee) {
            const returnFeeAmount = useCustom ? compFees!.returnShippingFee : settings.returnShippingFee;
            if (returnFeeAmount > 0) {
                newTransactions.push({ id: `return_${orderToUpdate.id}`, type: 'سحب', amount: returnFeeAmount, date: new Date().toISOString(), note: `خصم مصاريف مرتجع أوردر #${orderToUpdate.orderNumber}`, category: 'return' });
                updatedOrderData.returnFeeDeducted = true;
            }
        }
    }
    
    if (newTransactions.length > 0) {
        setWallet(prev => ({ ...prev, transactions: [...newTransactions, ...prev.transactions] }));
    }
    return updatedOrderData;
  };

  const updateOrderStatus = (id: string, newStatus: OrderStatus) => {
    const orderToUpdate = orders.find((o) => o.id === id);
    if (!orderToUpdate) return;

    if (newStatus === 'تم_الارسال' && !orderToUpdate.waybillNumber) {
        setOrderForWaybill({orderId: id, newStatus: newStatus});
        return;
    }
    
    const updatedOrderData = processFinancialsForStatusChange(orderToUpdate, newStatus);
    setOrders(prevOrders => prevOrders.map(o => o.id === id ? updatedOrderData : o));
    addAuditLog(id, 'تغيير الحالة', `تغيير حالة الطلب من ${orderToUpdate.status} إلى ${newStatus}`);
  };

  const handleSaveWaybill = (waybill: string) => {
    if (!orderForWaybill || !waybill.trim()) return;
    const { orderId, newStatus } = orderForWaybill;
    
    const orderToUpdate = orders.find((o) => o.id === orderId);
    if (!orderToUpdate) return;
    
    const orderWithWaybill = { ...orderToUpdate, waybillNumber: waybill };
    
    const updatedOrderData = processFinancialsForStatusChange(orderWithWaybill, newStatus);
    
    setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? updatedOrderData : o));

    setOrderForWaybill(null);
    addAuditLog(orderId, 'إضافة بوليصة', `تم إضافة بوليصة رقم ${waybill} وتغيير الحالة إلى ${newStatus}`);
  };


  const handleCollectAction = (order: Order, customerPaidInspection: boolean) => {
    if (order.status !== 'تم_توصيلها' || order.collectionProcessed) return;

    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const inspectionFee = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);

    const newTransactions: Transaction[] = [];
    const baseAmountToCollect = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - order.discount);
    const totalCollected = baseAmountToCollect + (customerPaidInspection ? inspectionFee : 0);
    
    newTransactions.push({ id: `collect_${order.id}`, type: 'إيداع', amount: totalCollected, date: new Date().toISOString(), note: `إيداع مبلغ تحصيل أوردر #${order.orderNumber}`, category: 'collection' });

    const codFee = calculateCodFee(order, settings);
    if (codFee > 0) {
        newTransactions.push({ id: `cod_${order.id}`, type: 'سحب', amount: codFee, date: new Date().toISOString(), note: `خصم رسوم COD أوردر #${order.orderNumber}`, category: 'cod' });
    }
    
    const updatedOrderData = { ...order, status: 'تم_التحصيل' as OrderStatus, paymentStatus: 'مدفوع' as PaymentStatus, inspectionFeePaidByCustomer: customerPaidInspection, collectionProcessed: true };
    
    setWallet(prev => ({ ...prev, transactions: [...newTransactions, ...prev.transactions] }));
    setOrders(prevOrders => prevOrders.map(o => (o.id === order.id ? updatedOrderData : o)));
    addLoyaltyPointsForOrder(updatedOrderData);
  };
  
  const handlePaymentStatusChange = (order: Order, newPaymentStatus: PaymentStatus) => {
    const updatedOrder = {...order, paymentStatus: newPaymentStatus};
    
    if (newPaymentStatus === 'مدفوع' && order.status === 'تم_توصيلها') {
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const inspectionFee = useCustom ? (compFees?.inspectionFee ?? settings.inspectionFee) : settings.inspectionFee;
        const customerPaidInspection = order.includeInspectionFee ? window.confirm(`الأوردر رقم ${order.orderNumber}\nهل قام العميل بدفع رسوم المعاينة (الـ ${inspectionFee} ج)؟`) : false;
        handleCollectAction(updatedOrder, customerPaidInspection);
    } else {
        updateOrderField(order.id, 'paymentStatus', newPaymentStatus);
    }
    addAuditLog(order.id, 'تغيير حالة الدفع', `تغيير حالة الدفع إلى ${newPaymentStatus}`);
  };

    const handlePostCollectionReturn = (order: Order) => {
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;

        const shouldRefundProduct = useCustom ? (compFees.postCollectionReturnRefundsProductPrice ?? true) : true;
        const returnShippingFee = useCustom && compFees.enableFixedReturn ? compFees.returnShippingFee : (settings.enableReturnShipping ? settings.returnShippingFee : 0);
        const inspectionFee = useCustom ? compFees.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
            
        let confirmationMessage = `هل أنت متأكد من إرجاع الطلب #${order.orderNumber}؟\n`;
        const transactions: Transaction[] = [];

        if (shouldRefundProduct) {
            const returnAmount = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0));

            let inspectionFeeMessage = "";
            if (order.inspectionFeePaidByCustomer) {
                inspectionFeeMessage = `\nلن يتم إرجاع رسوم المعاينة (${inspectionFee} ج.م) لأنها غير قابلة للاسترداد.`;
            }
            
            confirmationMessage += `سيتم إرجاع مبلغ (${returnAmount.toLocaleString()} ج.م) للعميل وخصمه من المحفظة.${inspectionFeeMessage}`;
            transactions.push({ id: `post_return_refund_${order.id}`, type: 'سحب', amount: returnAmount, date: new Date().toISOString(), note: `إرجاع مبلغ للعميل بعد استلام الطلب #${order.orderNumber}`, category: 'return' });
        } else {
            confirmationMessage += `لن يتم خصم قيمة المنتج من المحفظة حسب سياسة الشركة.`;
        }

        if (returnShippingFee > 0) {
            confirmationMessage += `\nسيتم خصم مصاريف شحن المرتجع (${returnShippingFee} ج.م).`;
            transactions.push({ id: `post_return_fee_${order.id}`, type: 'سحب', amount: returnShippingFee, date: new Date().toISOString(), note: `مصاريف شحن مرتجع بعد الاستلام للطلب #${order.orderNumber}`, category: 'return' });
        }

        if (!window.confirm(confirmationMessage)) return;

        if (transactions.length > 0) {
            setWallet(prev => ({ ...prev, transactions: [...transactions, ...prev.transactions] }));
        }
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'مرتجع_بعد_الاستلام' } : o));
    };

    const handleStartExchange = (originalOrder: Order) => {
        const creditAmount = originalOrder.totalAmountOverride ?? (originalOrder.productPrice + originalOrder.shippingFee - (originalOrder.discount || 0));
        setNewOrder({
            ...getInitialNewOrder(),
            customerName: originalOrder.customerName,
            customerPhone: originalOrder.customerPhone,
            customerAddress: originalOrder.customerAddress,
            shippingCompany: originalOrder.shippingCompany,
            shippingArea: originalOrder.shippingArea,
            orderType: 'exchange',
            originalOrderId: originalOrder.id,
            creditAmount: creditAmount,
        });
        setShowAddModal(true);
    };

  const handlePrintInvoice = (order: Order) => {
    const html = generateInvoiceHTML(order, settings, activeStore?.name || 'متجري');
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        alert("يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة.");
    }
  };

  const handlePrintShippingLabel = (order: Order) => {
    if (!activeStore) {
        alert("لا يمكن طباعة البوليصة: اسم المتجر غير معروف.");
        return;
    }
    const html = generateShippingLabelHTML(order, activeStore.name);
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        alert("يرجى السماح بالنوافذ المنبثقة لطباعة البوليصة.");
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedOrders(paginatedOrders.map(o => o.id));
      } else {
          setSelectedOrders([]);
      }
  };

  const handleSelectRow = (id: string) => {
      setSelectedOrders(prev => prev.includes(id) ? prev.filter(oId => oId !== id) : [...prev, id]);
  };
  
  const handleBulkDelete = () => {
    setOrders(prevOrders => prevOrders.filter(o => !selectedOrders.includes(o.id)));
    setSelectedOrders([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleBulkStatusChange = (newStatus: string) => {
    const selectElement = document.getElementById('bulk-status-select') as HTMLSelectElement;
    if (!newStatus || newStatus === "default") {
        if(selectElement) selectElement.value = 'default';
        return;
    }
    
    if (!window.confirm(`هل أنت متأكد من تغيير حالة ${selectedOrders.length} طلبات إلى "${newStatus.replace(/_/g, ' ')}"?`)) {
      if(selectElement) selectElement.value = 'default';
      return;
    }
    
    setOrders(prevOrders => prevOrders.map(o => {
        if (selectedOrders.includes(o.id)) {
            const updated = processFinancialsForStatusChange(o, newStatus as OrderStatus);
            return { ...updated, status: newStatus as OrderStatus };
        }
        return o;
    }));

    setSelectedOrders([]);
    if(selectElement) selectElement.value = 'default';
  };

  const handleBulkPrintLabels = () => {
    const selected = orders.filter(o => selectedOrders.includes(o.id));
    if (selected.length === 0) return;
    
    const html = selected.map(o => generateShippingLabelHTML(o, activeStore?.name || 'متجري')).join('<div style="page-break-after: always;"></div>');
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(`<html><head><title>طباعة بوالص</title></head><body>${html}</body></html>`);
        win.document.close();
    }
  };

  const handleExportCSV = () => {
    const headers = ['رقم الطلب', 'رقم البوليصة', 'العميل', 'الهاتف', 'المحافظة', 'المدينة', 'المنتجات', 'الإجمالي', 'الحالة', 'التاريخ'];
    const rows = filteredOrders.map(o => [ 
        o.orderNumber, 
        o.waybillNumber || '-', 
        o.customerName, 
        o.customerPhone, 
        o.governorate || o.shippingArea, 
        o.city || '-',
        o.items.map(i => `${i.name} (x${i.quantity})`).join(' | '), 
        o.totalAmountOverride ?? (o.productPrice + o.shippingFee - (o.discount || 0)), 
        o.status, 
        new Date(o.date).toLocaleDateString('ar-EG') 
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportOrders = () => {
    const html = generateOrdersReportHTML(filteredOrders, settings, activeStore?.name || 'متجري');
    setReportPreviewHtml(html);
  };

  const handleExportPDF = () => {
    const storeName = activeStore?.name || 'متجري';
    const html = generateOrdersReportHTML(filteredOrders, settings, storeName);
    setReportPreviewHtml(html);
  };

  const handleAutoAssign = () => {
    const activeEmployees = settings.employees?.filter(e => e.status === 'active') || [];
    if (activeEmployees.length === 0) {
      alert("لا يوجد موظفين نشطين متاحين للتوزيع.");
      return;
    }
    const unassignedOrders = orders.filter(o => !o.assignedTo && o.status === 'في_انتظار_المكالمة');
    if (unassignedOrders.length === 0) {
      alert("لا توجد طلبات غير معينة في حالة انتظار المكالمة.");
      return;
    }
    
    if (window.confirm(`سيتم توزيع ${unassignedOrders.length} طلب على ${activeEmployees.length} موظف. هل أنت متأكد؟`)) {
      let empIndex = 0;
      
      setOrders(prev => prev.map(o => {
        if (!o.assignedTo && o.status === 'في_انتظار_المكالمة') {
          const emp = activeEmployees[empIndex];
          empIndex = (empIndex + 1) % activeEmployees.length;
          return {
            ...o,
            assignedTo: emp.phone || emp.id,
            assignedToName: emp.name
          };
        }
        return o;
      }));
      alert("تم التوزيع بنجاح.");
    }
  };

  const getWhatsAppLink = (order: Order) => {
      let msg = '';
      const name = (order.customerName || '').split(' ')[0];
      switch(order.status) {
          case 'جاري_المراجعة': msg = `أهلاً بك يا ${name} 👋، بنأكد مع حضرتك طلبك (${order.productName}) من متجرنا. العنوان: ${order.customerAddress}. هل البيانات صحيحة؟`; break;
          case 'قيد_التنفيذ': msg = `يا ${name}، طلبك قيد التجهيز حالياً وهيسلم لشركة الشحن قريباً.`; break;
          case 'تم_الارسال': msg = `مرحباً ${name}، تم شحن طلبك ورقم البوليصة هو ${order.waybillNumber || order.orderNumber}.`; break;
          case 'فشل_التوصيل': msg = `يا ${name}، المندوب حاول يوصلك النهاردة وماعرفش. ياريت ترد عليه أو تأكد معانا ميعاد تاني.`; break;
          default: msg = `أهلاً ${name}، بخصوص طلبك رقم ${order.orderNumber}...`;
      }
      let phone = (order.customerPhone || '').replace(/\D/g, '');
      if (phone.startsWith('0')) {
          phone = '20' + phone.substring(1);
      } else if (phone.length === 10 && !phone.startsWith('0')) {
          phone = '20' + phone;
      }
      return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const quickStats = useMemo(() => {
    const nonArchivedOrders = orders.filter(o => o.status !== 'مؤرشف');
    return {
      awaitingWaybill: nonArchivedOrders.filter(o => o.status === 'جاري_المراجعة').length,
      onTheWay: nonArchivedOrders.filter(o => (o.status === 'قيد_الشحن' || o.status === 'تم_الارسال')).length,
      delivered: nonArchivedOrders.filter(o => (o.status === 'تم_توصيلها' || o.status === 'تم_التحصيل')).length,
      failed: nonArchivedOrders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام'].includes(o.status)).length,
      canceled: nonArchivedOrders.filter(o => o.status === 'ملغي').length,
    };
  }, [orders]);

  const orderForModal = useMemo(() => {
    if (!orderForWaybill) return null;
    return orders.find(o => o.id === orderForWaybill.orderId);
  }, [orderForWaybill, orders]);

  return (
    <motion.div 
      className="space-y-8 pb-20"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-1">إدارة الطلبات</h1>
              <button 
                onClick={handleManualRefresh}
                className={`p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-primary transition-all ${isRefreshing ? 'animate-spin text-primary border-primary/30' : ''}`}
                title="تحديث البيانات"
              >
                <RefreshCcw size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs md:text-sm text-slate-500 font-medium">{filteredOrders.length} طلب</p>
              <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[10px] font-bold">المتجر: {activeStore?.id}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="lg:hidden bg-primary text-white p-3 rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center"
          >
            <Plus size={24} />
          </button>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="عرض القائمة"
            >
              <LayoutList size={18} />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="عرض كانبان"
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <button 
            onClick={handleAutoAssign}
            className="glass-card px-3 py-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-white/50 transition-all flex items-center gap-2 font-bold border border-indigo-100 dark:border-indigo-900/30 text-xs shrink-0"
          >
            توزيع <Users size={16} />
          </button>

          <button 
            onClick={handleExportPDF}
            className="glass-card px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-white/50 transition-all flex items-center gap-2 font-bold border border-red-100 dark:border-red-900/30 text-xs shrink-0"
          >
            PDF <FileText size={16} />
          </button>

          <button 
            onClick={() => setShowAddModal(true)}
            className="hidden lg:flex bg-primary text-white px-5 py-2.5 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all items-center gap-2 text-sm shrink-0"
          >
            <Plus size={18} />
            إنشاء طلب
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {[
          { label: 'في انتظار المراجعة', count: quickStats.awaitingWaybill, icon: FileSearch, color: 'bg-amber-500' },
          { label: 'قيد الشحن', count: quickStats.onTheWay, icon: Truck, color: 'bg-indigo-500' },
          { label: 'تم التوصيل', count: quickStats.delivered, icon: CheckCircle, color: 'bg-emerald-500' },
          { label: 'مرتجع / فشل', count: quickStats.failed, icon: XCircle, color: 'bg-rose-500' },
          { label: 'ملغي', count: quickStats.canceled, icon: Trash2, color: 'bg-slate-500' },
        ].map((stat, idx) => (
          <div key={idx} className="glass-card p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${stat.color} flex items-center justify-center text-white shadow-lg shrink-0`}>
              <stat.icon className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase leading-none mb-1">{stat.label}</p>
              <p className="text-sm md:text-lg font-black text-slate-800 dark:text-white leading-none">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-30 py-2 -mx-4 px-4 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex flex-col gap-3 max-w-full">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl overflow-x-auto no-scrollbar">
            {['الجميع', 'في_انتظار_المكالمة', 'جاري_المراجعة', 'قيد_التنفيذ', 'تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التحصيل', 'مرتجع', 'مرتجع_جزئي', 'فشل_التوصيل', 'ملغي', 'مؤرشف', 'مرتجع_بعد_الاستلام', 'تم_الاستبدال'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                  activeTab === tab 
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-80">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="ابحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              />
            </div>
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2.5 rounded-xl border transition-all ${
                showAdvancedFilters 
                  ? 'bg-primary/10 border-primary text-primary' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
              }`}
            >
              <Filter size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="glass-card p-6 rounded-3xl overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">المحافظة</label>
              <select 
                value={filterGov}
                onChange={(e) => setFilterGov(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">كل المحافظات</option>
                {EGYPT_GOVERNORATES.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">شركة الشحن</label>
              <select 
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">كل الشركات</option>
                {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">تاريخ البداية</label>
              <input 
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">تاريخ النهاية</label>
              <input 
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Bulk Actions Bar */}
      {selectedOrders.length > 0 && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-8"
        >
          <span className="text-sm font-bold whitespace-nowrap">تم تحديد {selectedOrders.length} طلب</span>
          <div className="h-6 w-[1px] bg-white/20" />
          <div className="flex items-center gap-4">
            <select 
              id="bulk-status-select"
              onChange={(e) => handleBulkStatusChange(e.target.value)}
              className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
            >
              <option value="default">تغيير الحالة لـ...</option>
              {ORDER_STATUSES.map(s => <option key={s} value={s} className="text-slate-900">{ORDER_STATUS_METADATA[s]?.label || s}</option>)}
            </select>
            <button onClick={handleBulkPrintLabels} className="hover:text-primary transition-colors"><Printer size={20}/></button>
            <button onClick={() => setShowBulkDeleteConfirm(true)} className="hover:text-rose-500 transition-colors"><Trash2 size={20}/></button>
          </div>
          <button onClick={() => setSelectedOrders([])} className="p-1 hover:bg-white/10 rounded-full"><X size={18}/></button>
        </motion.div>
      )}

      {/* Orders View */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Table for Desktop */}
          <div className="overflow-x-auto hidden lg:block glass-card rounded-[32px] border-none">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-widest font-black border-b border-slate-200/50 dark:border-slate-700/50">
                <tr>
                  <th className="p-6 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-lg border-slate-300 dark:bg-slate-900 dark:border-slate-700 text-primary focus:ring-primary/20" 
                      onChange={handleSelectAll} 
                      checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}
                    />
                  </th>
                  <th className="p-6">الطلب والعميل</th>
                  <th className="p-6">المنتجات</th>
                  <th className="p-6">الشحن</th>
                  <th className="p-6">الحالة</th>
                  <th className="p-6">الدفع</th>
                  <th className="p-6 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {paginatedOrders.map(order => (
                  <OrderRow 
                    key={order.id} 
                    order={order} 
                    isSelected={selectedOrders.includes(order.id)}
                    onSelect={() => handleSelectRow(order.id)}
                    onStatusChange={(status) => updateOrderStatus(order.id, status)}
                    onPaymentChange={(status) => handlePaymentStatusChange(order, status)}
                    onEdit={() => { setEditingOrder(order); setShowAddModal(true); }}
                    onDelete={() => setOrderToDelete(order)}
                    onPrintInvoice={() => handlePrintInvoice(order)}
                    onPrintLabel={() => handlePrintShippingLabel(order)}
                    onCollect={(inspectionPaid) => handleCollectAction(order, inspectionPaid)}
                    onStartExchange={() => handleStartExchange(order)}
                    onPostReturn={() => handlePostCollectionReturn(order)}
                    onShowSummary={() => setShowSummaryModal(order)}
                    onShowAudit={() => setShowAuditLog(order)}
                    onShowAssignment={() => setShowAssignment(order)}
                    whatsappLink={getWhatsAppLink(order)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Cards for Mobile/Tablet */}
          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                isSelected={selectedOrders.includes(order.id)}
                onSelect={() => handleSelectRow(order.id)}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
                onPaymentChange={(status) => handlePaymentStatusChange(order, status)}
                onEdit={() => { setEditingOrder(order); setShowAddModal(true); }}
                onDelete={() => setOrderToDelete(order)}
                onPrintInvoice={() => handlePrintInvoice(order)}
                onPrintLabel={() => handlePrintShippingLabel(order)}
                onCollect={(inspectionPaid) => handleCollectAction(order, inspectionPaid)}
                onStartExchange={() => handleStartExchange(order)}
                onPostReturn={() => handlePostCollectionReturn(order)}
                onShowSummary={() => setShowSummaryModal(order)}
                onShowAudit={() => setShowAuditLog(order)}
                onShowAssignment={() => setShowAssignment(order)}
                whatsappLink={getWhatsAppLink(order)}
              />
            ))}
          </div>
        </div>
      ) : (
        <KanbanView 
          orders={filteredOrders} 
          onStatusChange={updateOrderStatus}
          onEdit={(order) => { setEditingOrder(order); setShowAddModal(true); }}
          settings={settings}
        />
      )}

      {/* Empty State */}
      {filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
            <Package size={48} className="opacity-20" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد طلبات</h3>
          <p className="text-sm">جرب تغيير فلاتر البحث أو إضافة طلب جديد</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div className="font-bold">عرض {paginatedOrders.length} من {filteredOrders.length} طلبات</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronRight/></button>
            <span>صفحة {currentPage} من {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft/></button>
          </div>
        </div>
      )}

      {/* Report Preview Modal */}
      {reportPreviewHtml && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">معاينة التقرير</h3>
                            <p className="text-xs font-bold text-slate-500">راجع البيانات قبل الطباعة أو التحميل</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                const win = window.open('', '_blank');
                                if (win) {
                                    win.document.write(reportPreviewHtml);
                                    win.document.close();
                                }
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Printer size={18} />
                            <span>طباعة / تحميل</span>
                        </button>
                        <button onClick={() => setReportPreviewHtml(null)} className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 overflow-hidden">
                    <iframe 
                        srcDoc={reportPreviewHtml} 
                        className="w-full h-full border-none rounded-xl shadow-inner bg-white"
                        title="Report Preview"
                    />
                </div>
            </div>
        </div>
      )}

      {/* Modals */}
      {(showAddModal || editingOrder) && (
        <OrderModal 
          isOpen={showAddModal || !!editingOrder} 
          onClose={() => {setShowAddModal(false); setEditingOrder(null)}} 
          onSubmit={handleAddOrder} 
          orderData={editingOrder || newOrder} 
          setOrderData={editingOrder ? setEditingOrder as React.Dispatch<React.SetStateAction<any>> : setNewOrder} 
          settings={settings} 
          isEditing={!!editingOrder} 
          customers={uniqueCustomers} 
          orders={orders} 
        />
      )}
      
      {orderToConfirm && ( <OrderPreConfirmationModal order={orderToConfirm} settings={settings} onConfirm={handleConfirmAddOrder} onCancel={() => setOrderToConfirm(null)} /> )}
      {showSummaryModal && ( <OrderConfirmationSummary order={showSummaryModal} settings={settings} onClose={() => setShowSummaryModal(null)} /> )}
      {orderToDelete && ( <ConfirmationModal title="حذف الطلب؟" description={`هل أنت متأكد من حذف طلب العميل "${orderToDelete.customerName}"؟`} onConfirm={handleDeleteOrder} onCancel={() => setOrderToDelete(null)} /> )}
      {showBulkDeleteConfirm && ( <ConfirmationModal title="حذف الطلبات المحددة؟" description={`هل أنت متأكد من حذف ${selectedOrders.length} طلبات؟ هذا الإجراء لا يمكن التراجع عنه.`} onConfirm={handleBulkDelete} onCancel={() => setShowBulkDeleteConfirm(false)} /> )}
      {orderForWaybill && orderForModal && ( <WaybillModal order={orderForModal} onClose={() => setOrderForWaybill(null)} onSave={handleSaveWaybill} /> )}
      
      {showAuditLog && (
        <AuditLogModal 
          order={showAuditLog} 
          onClose={() => setShowAuditLog(null)} 
        />
      )}

      {showAssignment && (
        <AssignmentModal 
          order={showAssignment} 
          employees={settings.employees || []}
          onClose={() => setShowAssignment(null)} 
          onAssign={(empId, empName) => {
            updateOrderField(showAssignment.id, 'assignedTo', empId);
            updateOrderField(showAssignment.id, 'assignedToName', empName);
            setShowAssignment(null);
          }}
        />
      )}
    </motion.div>
  );
};

const OrderCard = ({ 
  order, 
  isSelected, 
  onSelect, 
  onStatusChange, 
  onPaymentChange,
  onEdit, 
  onDelete, 
  onPrintInvoice, 
  onPrintLabel,
  onCollect,
  onStartExchange,
  onPostReturn,
  onShowSummary,
  onShowAudit,
  onShowAssignment,
  whatsappLink
}: { 
  order: Order, 
  isSelected: boolean, 
  onSelect: () => void,
  onStatusChange: (status: OrderStatus) => void,
  onPaymentChange: (status: PaymentStatus) => void,
  onEdit: () => void,
  onDelete: () => void,
  onPrintInvoice: () => void,
  onPrintLabel: () => void,
  onCollect: (inspectionPaid: boolean) => void,
  onStartExchange: () => void,
  onPostReturn: () => void,
  onShowSummary: () => void,
  onShowAudit: () => void,
  onShowAssignment: () => void,
  whatsappLink: string,
  key?: any
}) => {
  const statusInfo = ORDER_STATUS_METADATA[order.status] || { label: order.status, color: 'bg-slate-500', icon: 'Package' };
  const StatusIcon = {
    PhoneForwarded, FileSearch, Package, Truck, CheckCircle, Coins, RefreshCcw, XCircle, Archive
  }[statusInfo.icon as string] || Package;
  const totalAmount = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0));

  return (
    <motion.div 
      variants={itemVariants}
      className={`glass-card p-4 md:p-6 rounded-2xl md:rounded-[32px] border-2 transition-all relative group ${
        isSelected ? 'border-primary ring-4 ring-primary/10' : 'border-transparent'
      }`}
    >
      {/* Selection Checkbox */}
      <button 
        onClick={onSelect}
        className={`absolute top-4 right-4 md:top-6 md:right-6 w-5 h-5 md:w-6 md:h-6 rounded-lg border-2 transition-all flex items-center justify-center z-10 ${
          isSelected ? 'bg-primary border-primary' : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
        }`}
      >
        {isSelected && <CheckCircle size={12} className="text-white" />}
      </button>

      {/* Card Header */}
      <div className="flex items-start justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3 md:gap-4">
          <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl ${statusInfo.color} flex items-center justify-center text-white shadow-lg`}>
            <StatusIcon className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5 md:mb-1.5">
              <span className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">#{order.orderNumber}</span>
              {order.orderType === 'exchange' && (
                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] md:text-[11px] font-black px-2 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-wider">استبدال</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400">
              <span>{new Date(order.date).toLocaleDateString('ar-EG')}</span>
              <span className="text-slate-300">•</span>
              <span>{order.shippingCompany}</span>
            </div>
          </div>
        </div>
        <div className={`px-3 py-1 md:px-5 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest ${statusInfo.color} text-white shadow-md`}>
          {statusInfo.label}
        </div>
      </div>

      {/* Customer Info */}
      <div className="space-y-3 md:space-y-5 mb-6 md:mb-8">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shadow-sm">
            <UserIcon className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <span className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100">{order.customerName}</span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shadow-sm">
            <MapPin className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 truncate">{order.governorate || order.shippingArea} - {order.city || 'غير محدد'}</span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shadow-sm">
            <Phone className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <span className="text-sm md:text-base font-mono font-black text-slate-700 dark:text-slate-200">{order.customerPhone}</span>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:scale-110 transition-transform bg-emerald-50 dark:bg-emerald-900/20 p-1.5 md:p-2 rounded-lg">
            <MessageCircle className="w-4.5 h-4.5 md:w-5 md:h-5" />
          </a>
        </div>
      </div>

      {/* Items Summary */}
      <div className="p-4 md:p-5 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <span className="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">المنتجات</span>
          <span className="text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{order.items.length} قطع</span>
        </div>
        <div className="space-y-2 md:space-y-3">
          {order.items.slice(0, 2).map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs md:text-sm">
              <span className="text-slate-800 dark:text-slate-100 font-bold truncate max-w-[140px] md:max-w-[180px]">{item.name}</span>
              <span className="text-slate-600 dark:text-slate-400 font-black">x{item.quantity}</span>
            </div>
          ))}
          {order.items.length > 2 && (
            <p className="text-[10px] md:text-xs font-bold text-primary mt-1 md:mt-2">+{order.items.length - 2} منتجات أخرى</p>
          )}
        </div>
      </div>

      {/* Financials & Status */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl md:rounded-2xl p-4 md:p-5 mb-4 md:mb-6">
        <div className="flex justify-between items-center mb-4 md:mb-5">
          <div className="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">إجمالي المبلغ</div>
          <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {totalAmount.toLocaleString()} <span className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">ج.م</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="relative">
            <select 
              value={order.status}
              onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
              className={`w-full appearance-none pr-3 pl-8 md:pr-4 md:pl-10 py-2 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black text-white border-none cursor-pointer focus:ring-2 focus:ring-offset-2 transition-all shadow-md ${statusInfo.color}`}
            >
              {ORDER_STATUSES.map(s => (
                <option key={s} value={s} className="text-slate-900 bg-white">{ORDER_STATUS_METADATA[s]?.label || s}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 md:w-3.5 md:h-3.5 absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
          </div>
          <div className="relative">
            <select 
              value={order.paymentStatus}
              onChange={(e) => onPaymentChange(e.target.value as PaymentStatus)}
              className={`w-full appearance-none pr-4 pl-10 py-3 rounded-xl text-xs font-black border-none cursor-pointer focus:ring-2 focus:ring-offset-2 transition-all shadow-md ${
                order.paymentStatus === 'مدفوع' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {PAYMENT_STATUSES.map(s => (
                <option key={s} value={s} className="text-slate-900 bg-white">{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={onShowSummary} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all" title="التفاصيل">
            <Info size={18} />
          </button>
          <button onClick={onEdit} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all" title="تعديل">
            <Edit3 size={18} />
          </button>
          <button onClick={onPrintInvoice} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all" title="فاتورة">
            <Printer size={18} />
          </button>
        </div>
        
        <div className="relative group/more">
          <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
            <MoreVertical size={18} />
          </button>
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 hidden group-hover/more:block z-20">
            <button onClick={onPrintLabel} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
              <LayoutList size={16} /> بوليصة الشحن
            </button>
            <button onClick={onShowAudit} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
              <FileSearch size={16} /> سجل التدقيق
            </button>
            <button onClick={onShowAssignment} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
              <UserIcon size={16} /> تعيين موظف
            </button>
            {order.status === 'تم_توصيلها' && !order.collectionProcessed && (
              <button onClick={() => onCollect(false)} className="w-full text-right p-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl flex items-center gap-3">
                <Coins size={16} /> تحصيل المبلغ
              </button>
            )}
            {['تم_توصيلها', 'تم_التحصيل'].includes(order.status) && (
              <>
                <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
                <button onClick={onPostReturn} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                  <RefreshCcw size={16} /> إرجاع بعد الاستلام
                </button>
                <button onClick={onStartExchange} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                  <ArrowRightLeft size={16} /> إنشاء طلب استبدال
                </button>
              </>
            )}
            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
            <button onClick={onDelete} className="w-full text-right p-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl flex items-center gap-3">
              <Trash2 size={16} /> حذف الطلب
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const OrderRow = ({ 
  order, 
  isSelected, 
  onSelect, 
  onStatusChange, 
  onPaymentChange,
  onEdit, 
  onDelete, 
  onPrintInvoice, 
  onPrintLabel,
  onCollect,
  onStartExchange,
  onPostReturn,
  onShowSummary,
  onShowAudit,
  onShowAssignment,
  whatsappLink
}: { 
  order: Order, 
  isSelected: boolean, 
  onSelect: () => void,
  onStatusChange: (status: OrderStatus) => void,
  onPaymentChange: (status: PaymentStatus) => void,
  onEdit: () => void,
  onDelete: () => void,
  onPrintInvoice: () => void,
  onPrintLabel: () => void,
  onCollect: (inspectionPaid: boolean) => void,
  onStartExchange: () => void,
  onPostReturn: () => void,
  onShowSummary: () => void,
  onShowAudit: () => void,
  onShowAssignment: () => void,
  whatsappLink: string,
  key?: any
}) => {
  const statusInfo = ORDER_STATUS_METADATA[order.status] || { label: order.status, color: 'bg-slate-500', icon: 'Package' };
  const StatusIcon = {
    PhoneForwarded, FileSearch, Package, Truck, CheckCircle, Coins, RefreshCcw, XCircle, Archive
  }[statusInfo.icon as string] || Package;
  const totalAmount = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0));

  return (
    <tr className={`group transition-all ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}`}>
      <td className="p-6 text-center">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={onSelect}
          className="w-5 h-5 rounded-lg border-slate-300 dark:bg-slate-900 dark:border-slate-700 text-primary focus:ring-primary/20 transition-all"
        />
      </td>
      <td className="p-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${statusInfo.color} flex items-center justify-center text-white shadow-md`}>
            <StatusIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black text-slate-900 dark:text-white">#{order.orderNumber}</span>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:scale-110 transition-transform">
                <MessageCircle size={16} />
              </a>
            </div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{order.customerName}</div>
          </div>
        </div>
      </td>
      <td className="p-6">
        <div className="max-w-[250px]">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{order.productName}</div>
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider">{order.items.length} قطع</div>
        </div>
      </td>
      <td className="p-6">
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{order.shippingCompany}</div>
        <div className="text-xs font-black text-slate-500 uppercase tracking-wider">{order.governorate || order.shippingArea}</div>
      </td>
      <td className="p-6">
        <div className="relative inline-block">
          <select 
            value={order.status}
            onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
            className={`appearance-none pr-10 pl-4 py-2 rounded-full text-xs font-black text-white border-none cursor-pointer focus:ring-2 focus:ring-offset-2 transition-all shadow-sm ${statusInfo.color}`}
          >
            {ORDER_STATUSES.map(s => (
              <option key={s} value={s} className="text-slate-900 bg-white">{ORDER_STATUS_METADATA[s]?.label || s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
        </div>
      </td>
      <td className="p-6">
        <div className="text-base font-black text-slate-900 dark:text-white tabular-nums mb-1">
          {totalAmount.toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
        </div>
        <div className="relative inline-block">
          <select 
            value={order.paymentStatus}
            onChange={(e) => onPaymentChange(e.target.value as PaymentStatus)}
            className={`appearance-none pr-10 pl-4 py-2 rounded-full text-xs font-black border-none cursor-pointer focus:ring-2 focus:ring-offset-2 transition-all shadow-sm ${
              order.paymentStatus === 'مدفوع' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {PAYMENT_STATUSES.map(s => (
              <option key={s} value={s} className="text-slate-900 bg-white">{s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
        </div>
      </td>
      <td className="p-6">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onShowSummary} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="التفاصيل">
            <Info size={18} />
          </button>
          <button onClick={onEdit} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="تعديل">
            <Edit3 size={18} />
          </button>
          <div className="relative group/more">
            <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
              <MoreVertical size={18} />
            </button>
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 hidden group-hover/more:block z-20">
              <button onClick={onPrintInvoice} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                <Printer size={16} /> فاتورة
              </button>
              <button onClick={onPrintLabel} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                <LayoutList size={16} /> بوليصة
              </button>
              <button onClick={onShowAudit} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                <FileSearch size={16} /> سجل التدقيق
              </button>
              <button onClick={onShowAssignment} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                <UserIcon size={16} /> تعيين موظف
              </button>
              {order.status === 'تم_توصيلها' && !order.collectionProcessed && (
                <button onClick={() => onCollect(false)} className="w-full text-right p-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl flex items-center gap-3">
                  <Coins size={16} /> تحصيل المبلغ
                </button>
              )}
              {['تم_توصيلها', 'تم_التحصيل'].includes(order.status) && (
                <>
                  <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
                  <button onClick={onPostReturn} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                    <RefreshCcw size={16} /> إرجاع بعد الاستلام
                  </button>
                  <button onClick={onStartExchange} className="w-full text-right p-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-3">
                    <ArrowRightLeft size={16} /> إنشاء طلب استبدال
                  </button>
                </>
              )}
              <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
              <button onClick={onDelete} className="w-full text-right p-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl flex items-center gap-3">
                <Trash2 size={16} /> حذف
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};
const KanbanView: React.FC<{ orders: Order[]; onStatusChange: (id: string, newStatus: OrderStatus) => void; onEdit: (order: Order) => void; settings: Settings; }> = ({ orders, onStatusChange, onEdit, settings }) => {
  const columns: OrderStatus[] = ['في_انتظار_المكالمة', 'جاري_المراجعة', 'قيد_التنفيذ', 'تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'مرتجع', 'ملغي'];
  
  const statusColors: Record<OrderStatus, string> = { 
    في_انتظار_المكالمة: 'border-cyan-500 bg-cyan-500/5', 
    جاري_المراجعة: 'border-purple-500 bg-purple-500/5', 
    قيد_التنفيذ: 'border-yellow-500 bg-yellow-500/5', 
    تم_الارسال: 'border-sky-500 bg-sky-500/5', 
    قيد_الشحن: 'border-blue-500 bg-blue-500/5', 
    تم_توصيلها: 'border-teal-500 bg-teal-500/5', 
    تم_التحصيل: 'border-emerald-500 bg-emerald-500/5', 
    مرتجع: 'border-red-500 bg-red-500/5', 
    مرتجع_بعد_الاستلام: 'border-orange-500 bg-orange-500/5', 
    تم_الاستبدال: 'border-slate-500 bg-slate-500/5', 
    مرتجع_جزئي: 'border-orange-500 bg-orange-500/5', 
    فشل_التوصيل: 'border-red-500 bg-red-500/5', 
    ملغي: 'border-slate-500 bg-slate-500/5', 
    مؤرشف: 'border-slate-500 bg-slate-500/5' 
  };

  return (
    <div className="flex gap-4 p-4 overflow-x-auto min-h-[600px] no-scrollbar">
      {columns.map(status => {
        const columnOrders = orders.filter(o => o.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-80 flex flex-col gap-3">
            <div className={`p-3 rounded-xl border-t-4 shadow-sm ${statusColors[status]} flex justify-between items-center`}>
              <h3 className="font-black text-slate-800 dark:text-white text-sm">{status.replace(/_/g, ' ')}</h3>
              <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg text-xs font-bold shadow-sm">{columnOrders.length}</span>
            </div>
            <div className="flex-1 space-y-3">
              {columnOrders.map(order => (
                <motion.div 
                  key={order.id}
                  layoutId={order.id}
                  className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => onEdit(order)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">#{order.orderNumber || order.id.slice(0, 6)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600"><Edit3 size={14}/></button>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-1">{order.customerName}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 line-clamp-1">{order.productName}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{(order.totalAmountOverride ?? order.productPrice).toLocaleString()} ج.م</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300">{order.governorate || order.shippingArea}</span>
                  </div>
                </motion.div>
              ))}
              {columnOrders.length === 0 && (
                <div className="h-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-bold">
                  لا توجد طلبات
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AuditLogModal: React.FC<{ order: Order; onClose: () => void; }> = ({ order, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">سجل التدقيق (Audit Log)</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
            {order.auditLogs && order.auditLogs.length > 0 ? (
              order.auditLogs.map((log, idx) => (
                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString('ar-EG')}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{log.details}</p>
                  <div className="text-[10px] text-slate-500 font-bold">بواسطة: {log.userEmail}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400">لا يوجد سجل تدقيق لهذا الطلب.</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AssignmentModal: React.FC<{ 
  order: Order; 
  employees: Employee[];
  onClose: () => void; 
  onAssign: (id: string, name: string) => void; 
}> = ({ order, employees, onClose, onAssign }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">تعيين موظف للطلب</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          
          <div className="space-y-3">
            {employees.length > 0 ? (
              employees.map(emp => (
                <button 
                  key={emp.id}
                  onClick={() => onAssign(emp.id, emp.name)}
                  className={`w-full p-4 rounded-2xl border-2 text-right transition-all flex justify-between items-center ${order.assignedTo === emp.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'}`}
                >
                  <span className="font-bold text-slate-800 dark:text-white">{emp.name}</span>
                  {order.assignedTo === emp.id && <CheckCircle size={18} className="text-indigo-500" />}
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Users size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-bold">لا يوجد موظفين مضافين حالياً.</p>
                <p className="text-xs mt-1">يمكنك إضافة موظفين من صفحة الإعدادات.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const LowStockAlert: React.FC<{ products: Product[] }> = ({ products }) => {
  if (!products) return null;
  const lowStockProducts = products.filter(p => p.stockQuantity !== null && p.stockQuantity !== undefined && p.stockQuantity <= (p.stockThreshold || 5));
  
  if (lowStockProducts.length === 0) return null;

  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl mb-6 flex items-start gap-3"
    >
      <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
      <div>
        <h4 className="font-bold text-red-800 dark:text-red-300 text-sm mb-1">تنبيه: مخزون منخفض</h4>
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">المنتجات التالية وصلت للحد الأدنى للمخزون:</p>
        <div className="flex flex-wrap gap-2">
          {lowStockProducts.map(p => (
            <span key={p.id} className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold border border-red-100 dark:border-red-900/50 shadow-sm">
              {p.name} ({p.stockQuantity} قطعة)
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
interface QuickStatProps { icon: React.ReactNode; label: string; value: number; color: string; }
const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, color }) => {
  const colors: Record<string, string> = {
    purple: "text-purple-600 bg-purple-50/80 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20",
    sky: "text-sky-600 bg-sky-50/80 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20",
    emerald: "text-emerald-600 bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20",
    red: "text-red-600 bg-red-50/80 dark:bg-red-500/10 border-red-100 dark:border-red-500/20",
  };
  return (
    <div className={`p-5 rounded-2xl border flex flex-col gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div className="p-2.5 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm backdrop-blur-sm">{icon}</div>
        <div className="text-3xl font-black tracking-tight">{value}</div>
      </div>
      <div className="text-sm font-bold opacity-80">{label}</div>
    </div>
  );
};
interface TabButtonProps { label: string; activeTab: string; setActiveTab: (label: string) => void; count: number; }
const TabButton: React.FC<TabButtonProps> = ({ label, activeTab, setActiveTab, count }) => {
    const isActive = activeTab === label;
    return (
        <button
            onClick={() => setActiveTab(label)}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${
                isActive
                ? 'bg-indigo-600 text-white border-transparent shadow-md hover:bg-indigo-700'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
            <span>{label}</span>
            <span
                className={`px-2 py-0.5 rounded-lg text-xs font-black transition-colors ${
                    isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                }`}
            >
                {count}
            </span>
        </button>
    );
};
interface OrderModalProps { isOpen: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; orderData: NewOrderState | Order; setOrderData: React.Dispatch<React.SetStateAction<any>>; settings: Settings; isEditing: boolean; customers: any[]; orders: Order[]; }

const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onSubmit, orderData, setOrderData, settings, isEditing, customers, orders }) => {
    if (!isOpen) return null;
    
    const isExchange = (orderData as NewOrderState).orderType === 'exchange';
    let creditAmount = (orderData as NewOrderState).creditAmount || 0;

    // Customer Search State
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
    const [showEditTotalModal, setShowEditTotalModal] = useState(false);
    const customerSearchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
                setIsCustomerListOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return [];
        return customers.filter(c => 
            (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || 
            (c.phone || '').includes(customerSearch)
        );
    }, [customerSearch, customers]);
    
    if (isEditing && isExchange && !creditAmount && orderData.originalOrderId) {
        const originalOrder = orders.find(o => o.id === orderData.originalOrderId);
        if (originalOrder) {
            creditAmount = originalOrder.totalAmountOverride ?? (originalOrder.productPrice + originalOrder.shippingFee - (originalOrder.discount || 0));
        }
    }

    const subtotal = useMemo(() => (orderData.items || []).reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0), [orderData.items]);
    
    const inspectionFee = useMemo(() => {
        if (!orderData.includeInspectionFee) return 0;
        const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
        const useCustom = compFees?.useCustomFees ?? false;
        return useCustom ? (compFees?.inspectionFee || 0) : (settings.enableInspection ? settings.inspectionFee : 0);
    }, [orderData.includeInspectionFee, orderData.shippingCompany, settings]);

    const totalBeforeCredit = useMemo(() => subtotal + (orderData.shippingFee || 0) - (orderData.discount || 0) + inspectionFee, [subtotal, orderData.shippingFee, orderData.discount, inspectionFee]);
    const finalAmount = totalBeforeCredit - creditAmount;

    const handleFieldChange = (field: keyof NewOrderState, value: any) => setOrderData((prev: any) => ({ ...prev, [field]: value }));
    const handleCustomerSelect = (customer: Pick<CustomerProfile, 'name'|'phone'|'address'>) => {
        setOrderData((prev: any) => ({ ...prev, customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address }));
        setCustomerSearch('');
        setIsCustomerListOpen(false);
    };

    const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
        let newItems = [...(orderData.items || [])];
    
        if (field === 'productId') {
            const product = settings.products.find(p => p.id === value);
            if (!product) {
                handleFieldChange('items', newItems);
                return;
            }
            
            const existingItemIndex = newItems.findIndex((item, i) => item.productId === value && !item.variantId && i !== index);
    
            if (existingItemIndex !== -1) {
                // Product exists, merge them
                const existingItem = newItems[existingItemIndex];
                const currentItem = newItems[index];
    
                newItems[existingItemIndex] = {
                    ...existingItem,
                    quantity: existingItem.quantity + currentItem.quantity
                };
                
                newItems = newItems.filter((_, i) => i !== index);
            } else {
                 newItems[index] = { ...newItems[index], productId: value, name: product.name, price: product.price, cost: product.costPrice, weight: product.weight, thumbnail: product.thumbnail, variantId: undefined, variantDescription: undefined };
            }
        } else if (field === 'variantId') {
            const product = settings.products.find(p => p.id === newItems[index].productId);
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
            const updatedItem = { ...newItems[index], [field]: value };
            newItems[index] = updatedItem;
        }
    
        handleFieldChange('items', newItems);
    };

    const addItem = () => {
        const firstProduct = settings.products[0];
        if (!firstProduct) return;
        handleFieldChange('items', [...(orderData.items || []), { productId: firstProduct.id, name: firstProduct.name, quantity: 1, price: firstProduct.price, cost: firstProduct.costPrice, weight: firstProduct.weight, thumbnail: firstProduct.thumbnail }]);
    };

    const removeItem = (index: number) => handleFieldChange('items', (orderData.items || []).filter((_, i) => i !== index));
    const activeCompanies = Object.keys(settings.shippingOptions || {}).filter(company => settings.activeCompanies?.[company] !== false);
    const shippingOptions = useMemo(() => {
        const options = settings.shippingOptions?.[orderData.shippingCompany!] || [];
        if (options.length > 0) return options;
        return EGYPT_GOVERNORATES.map((gov, index) => ({
            id: `gov_fallback_${index}`,
            label: gov.name,
            cities: gov.cities.map((city, cIndex) => ({ id: `city_fallback_${index}_${cIndex}`, name: city }))
        })) as any[];
    }, [settings.shippingOptions, orderData.shippingCompany]);

    useEffect(() => {
        const selectedOption = shippingOptions.find(opt => opt.label === (orderData.governorate || orderData.shippingArea));
            if (selectedOption) {
                let fee = selectedOption.price || 0;
                let extraKgPrice = selectedOption.extraKgPrice || 0;
                if (orderData.city) {
                    const cityOpt = selectedOption.cities?.find(c => c.name === orderData.city);
                    if (cityOpt) {
                        if (cityOpt.useParentFees) {
                            fee = selectedOption.price || 0;
                            extraKgPrice = selectedOption.extraKgPrice || 0;
                        } else if (cityOpt.shippingPrice !== undefined && cityOpt.shippingPrice !== null) {
                            fee = cityOpt.shippingPrice;
                            extraKgPrice = cityOpt.extraKgPrice || 0;
                        }
                    }
                }
                
                const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
                const baseWeight = compFees?.useCustomFees && compFees.baseWeight !== undefined 
                    ? compFees.baseWeight 
                    : (settings.baseWeight !== undefined ? settings.baseWeight : 5);
                
                const totalWeight = orderData.items?.reduce((sum: number, item: any) => {
                    const itemWeight = parseFloat(item.weight?.toString() || '0');
                    const itemQuantity = parseInt(item.quantity?.toString() || '1');
                    return sum + (itemWeight * itemQuantity);
                }, 0) || 0;
                const extraWeight = Math.max(0, totalWeight - baseWeight);
                const totalFee = fee + (Math.ceil(extraWeight) * extraKgPrice);

                if (totalFee !== orderData.shippingFee) {
                    handleFieldChange('shippingFee', totalFee);
                }
            }
    }, [orderData.governorate, orderData.shippingArea, orderData.city, shippingOptions, orderData.items]);

    const totalWeight = useMemo(() => (orderData.items || []).reduce((sum, item) => {
        const itemWeight = parseFloat(item.weight?.toString() || '0');
        const itemQuantity = parseInt(item.quantity?.toString() || '1');
        return sum + (itemWeight * itemQuantity);
    }, 0), [orderData.items]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <form onSubmit={onSubmit} className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[95vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-3xl">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <ShoppingBag size={20}/>
                        </div>
                        {isEditing ? `تعديل الطلب ${orderData.orderNumber}` : 'إنشاء طلب جديد'}
                    </h3>
                    <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                        <XCircle size={24}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 custom-scrollbar">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
                                <UserIcon size={18} className="text-blue-500"/> بيانات العميل
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative" ref={customerSearchRef}>
                                    <input type="text" placeholder="اسم العميل أو رقم الهاتف" required value={customerSearch || orderData.customerName || ''} onChange={e => { setCustomerSearch(e.target.value); handleFieldChange('customerName', e.target.value); }} onFocus={() => setIsCustomerListOpen(true)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                                    {isCustomerListOpen && filteredCustomers.length > 0 && (
                                        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                                            {filteredCustomers.map(c => (
                                                <div key={c.phone} onClick={() => handleCustomerSelect(c)} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors">
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{c.name}</p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{c.phone}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input type="tel" placeholder="رقم الهاتف" required value={orderData.customerPhone || ''} onChange={e => handleFieldChange('customerPhone', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                                <input type="tel" placeholder="رقم هاتف إضافي (اختياري)" value={(orderData as NewOrderState).customerPhone2 || ''} onChange={e => handleFieldChange('customerPhone2', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                                <input type="text" placeholder="الدولة" value={(orderData as NewOrderState).country || 'مصر'} onChange={e => handleFieldChange('country', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                            </div>
                            <textarea placeholder="العنوان بالتفصيل" required value={orderData.customerAddress || ''} onChange={e => handleFieldChange('customerAddress', e.target.value)} className="mt-4 w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-24 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none dark:text-white" />
                            <input type="text" placeholder="تفاصيل العنوان (رقم المبنى، الشقة...)" value={(orderData as NewOrderState).buildingDetails || ''} onChange={e => handleFieldChange('buildingDetails', e.target.value)} className="mt-4 w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                        </div>
                        
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                           <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
                               <Building size={18} className="text-emerald-500"/> بيانات الشحن والطلب
                           </h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <select required value={orderData.shippingCompany} onChange={e => handleFieldChange('shippingCompany', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white">
                                    {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                    <select 
                                        required 
                                        value={orderData.governorate || orderData.shippingArea || ''} 
                                        onChange={e => {
                                            const gov = e.target.value;
                                            setOrderData((prev: any) => ({ ...prev, governorate: gov, shippingArea: gov, city: '' }));
                                        }} 
                                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white"
                                    >
                                        <option value="" disabled>المحافظة</option>
                                        {shippingOptions.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}
                                    </select>
                                    <select 
                                        required 
                                        value={orderData.city || ''} 
                                        onChange={e => handleFieldChange('city', e.target.value)} 
                                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white"
                                        disabled={!(orderData.governorate || orderData.shippingArea)}
                                    >
                                        <option value="" disabled>المدينة</option>
                                        {(shippingOptions.find(o => o.label === (orderData.governorate || orderData.shippingArea))?.cities || []).map(city => (
                                            <option key={city.id} value={city.name}>{city.name}</option>
                                        ))}
                                    </select>
                                </div>
                           </div>
                           <div className="mt-5">
                               <label htmlFor="orderNumberInput" className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">رقم الطلب (اختياري)</label>
                               <input id="orderNumberInput" type="text" placeholder="سيتم إنشاؤه تلقائياً إذا ترك فارغاً" value={orderData.orderNumber || ''} onChange={e => handleFieldChange('orderNumber', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white" />
                           </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">ملاحظات إضافية</h4>
                            <textarea placeholder="أي ملاحظات للمندوب أو الطلب..." value={orderData.notes || ''} onChange={e => handleFieldChange('notes', e.target.value)} className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-24 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all resize-none dark:text-white" />
                        </div>
                    </div>
                    
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                             <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
                                 <Package size={18} className="text-amber-500"/> المنتجات
                             </h4>
                             <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {(orderData.items || []).map((item, index) => {
                                    const product = settings.products.find(p => p.id === item.productId);
                                    const hasVariants = product?.variants && product.variants.length > 0;
                                    const selectedVariant = hasVariants ? product.variants?.find(v => v.id === item.variantId) : null;
                                    const stock = hasVariants ? (selectedVariant?.stock || 0) : (product?.stock || 0);

                                    return (
                                        <div key={index} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 relative group">
                                            <button type="button" onClick={() => removeItem(index)} className="absolute top-3 left-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded-full z-10">
                                                <XCircle size={20}/>
                                            </button>
                                            <select value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white">
                                                {settings.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            
                                            {hasVariants && (
                                                <select value={item.variantId || ''} onChange={e => handleItemChange(index, 'variantId', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white">
                                                    <option value="">بدون متغيرات</option>
                                                    {product.variants?.map(v => (
                                                        <option key={v.id} value={v.id}>
                                                            {Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(', ')}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}

                                            <div className="flex gap-3 items-center">
                                                <div className="flex-1">
                                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">الكمية</label>
                                                    <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">السعر</label>
                                                    <input type="number" min="0" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white" />
                                                </div>
                                                <div className="flex-1 text-center text-xs font-bold text-slate-500 pt-5">
                                                    المخزون: <span className={stock < item.quantity ? 'text-red-500' : 'text-emerald-500'}>{stock}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                             <button type="button" onClick={addItem} className="w-full mt-4 p-3 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-bold rounded-xl text-sm border border-amber-100 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2">
                                 <Plus size={16} /> إضافة منتج
                             </button>
                        </div>
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <FileText size={18} className="text-indigo-500"/> الملخص المالي
                            </h4>
                            
                            <div className="space-y-3 text-slate-600 dark:text-slate-400">
                                <div className="flex justify-between text-sm items-center">
                                    <span>إجمالي المنتجات</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{subtotal.toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <div className="flex items-center gap-1">
                                        <span>مصاريف الشحن</span>
                                        <span className="text-[10px] text-slate-400 font-medium">(الوزن: {totalWeight.toFixed(2)} كجم)</span>
                                    </div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{(orderData.shippingFee || 0).toLocaleString()} ج.م</span>
                                </div>
                                {inspectionFee > 0 && (
                                    <div className="flex justify-between text-sm items-center">
                                        <span>رسوم المعاينة</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span>
                                    </div>
                                )}
                                
                                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all">
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">خصم إضافي</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" value={orderData.discount || 0} onChange={e => handleFieldChange('discount', Number(e.target.value))} className="w-full font-bold bg-transparent outline-none text-red-500 dark:text-red-400" />
                                        <span className="text-sm text-slate-400">ج.م</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>
                            
                            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200 text-lg">
                                <span>المجموع</span>
                                <span>{totalBeforeCredit.toLocaleString()} ج.م</span>
                            </div>
                            
                            {isExchange && (
                                <div className="flex justify-between font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 p-3 rounded-xl border border-orange-100 dark:border-orange-500/20 mt-2">
                                    <span>رصيد سابق (للاستبدال)</span>
                                    <span>-{creditAmount.toLocaleString()} ج.م</span>
                                </div>
                            )}
                            
                            <div className="border-t-2 border-slate-200 dark:border-slate-700 my-4"></div>
                            
                            <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                                <span className="font-black text-indigo-700 dark:text-indigo-400 text-lg">{finalAmount >= 0 ? 'المطلوب تحصيله' : 'المستحق للعميل'}</span>
                                <div className="flex flex-col items-end">
                                    <span className="font-black text-indigo-700 dark:text-indigo-400 text-2xl">{Math.abs(orderData.totalAmountOverride ?? finalAmount).toLocaleString()} ج.م</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowEditTotalModal(true)}
                                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 underline mt-1"
                                    >
                                        تعديل الإجمالي يدوياً
                                    </button>
                                </div>
                            </div>

                            {showEditTotalModal && (
                                <EditTotalModal 
                                    currentTotal={orderData.totalAmountOverride ?? finalAmount}
                                    onClose={() => setShowEditTotalModal(false)}
                                    onApply={(amount, reason) => {
                                        handleFieldChange('totalAmountOverride', amount);
                                        handleFieldChange('totalAmountOverrideReason', reason);
                                        setShowEditTotalModal(false);
                                    }}
                                />
                            )}
                        </div>
                         <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                             <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                 <SettingsIcon size={18} className="text-slate-500"/> إعدادات إضافية
                             </h4>
                             <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                 <input type="checkbox" checked={orderData.includeInspectionFee} onChange={e => handleFieldChange('includeInspectionFee', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700" /> 
                                 <span className="font-medium text-slate-700 dark:text-slate-300">تفعيل رسوم المعاينة</span>
                             </label>
                             <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                 <input type="checkbox" checked={orderData.isInsured} onChange={e => handleFieldChange('isInsured', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700" /> 
                                 <span className="font-medium text-slate-700 dark:text-slate-300">تفعيل التأمين على الشحنة</span>
                             </label>
                         </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-b-3xl">
                    <div>
                        {isExchange && <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">الطلب الجديد: {totalBeforeCredit.toLocaleString()} ج.م - رصيد سابق: {creditAmount.toLocaleString()} ج.م</div>}
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{finalAmount >= 0 ? 'الإجمالي المطلوب من العميل' : 'المبلغ المستحق للعميل'}</span>
                        <p className={`text-3xl font-black ${finalAmount >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-500'}`}>{Math.abs(orderData.totalAmountOverride ?? finalAmount).toLocaleString()} ج.م</p>
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                            إلغاء
                        </button>
                        <button type="submit" className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2">
                            <Save size={20}/>{isEditing ? 'تحديث الطلب' : 'حفظ الطلب'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
interface OrderConfirmationSummaryProps { order: Order; settings: Settings; onClose: () => void; }
const OrderConfirmationSummary: React.FC<OrderConfirmationSummaryProps> = ({ order, settings, onClose }) => {
    const compFees = settings.companySpecificFees[order.shippingCompany];
    const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0;
    const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0;
    const insuranceFee = ((order.productPrice + order.shippingFee) * insuranceRate) / 100;
    const total = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - order.discount + inspectionFee);
    
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
                    <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">تم إنشاء الطلب بنجاح!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">ملخص الطلب المالي للعميل <span className="font-bold text-slate-700 dark:text-slate-200">{order.customerName}</span></p>
                <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">مصاريف الشحن:</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">(الوزن: {order.weight.toFixed(2)} كجم)</span>
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.shippingFee.toLocaleString()} ج.م</span>
                    </div>
                    {inspectionFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم المعاينة:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {insuranceFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم التأمين ({insuranceRate}%):</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toFixed(2)} ج.م</span>
                        </div>
                    )}
                    {order.discount > 0 && (
                        <div className="flex justify-between items-center text-sm text-red-500">
                            <span className="font-bold">الخصم:</span>
                            <span className="font-black">-{order.discount.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                    <div className="flex justify-between items-center text-xl">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">الإجمالي المطلوب تحصيله:</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} ج.م</span>
                    </div>
                    {order.totalAmountOverride !== undefined && order.totalAmountOverrideReason && (
                        <div className="mt-3 text-right">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider mb-1">سبب تعديل الإجمالي</span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 italic">
                                "{order.totalAmountOverrideReason}"
                            </p>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="mt-8 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm hover:shadow">
                    إغلاق
                </button>
            </div>
        </div>
    );
};
const ConfirmationModal: React.FC<{ title: string; description: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, description, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{description}</p>
            <div className="flex flex-col gap-2">
                <button onClick={onConfirm} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-sm hover:shadow">
                    تأكيد الحذف
                </button>
                <button onClick={onCancel} className="w-full py-3 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all">
                    تراجع
                </button>
            </div>
        </div>
    </div>
);
interface OrderPreConfirmationModalProps { order: Omit<Order, 'id'>; settings: Settings; onConfirm: () => void; onCancel: () => void; }
const OrderPreConfirmationModal: React.FC<OrderPreConfirmationModalProps> = ({ order, settings, onConfirm, onCancel }) => {
    const compFees = settings.companySpecificFees[order.shippingCompany];
    const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0;
    const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0;
    const insuranceFee = ((order.productPrice + order.shippingFee) * insuranceRate) / 100;
    const total = (order as any).totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0) + inspectionFee);
    
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
                    <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">هل أنت متأكد من تفاصيل الطلب؟</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">يرجى مراجعة الملخص المالي قبل تأكيد الطلب.</p>
                <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">مصاريف الشحن:</span>
                            <span className="text-[10px] text-slate-400 font-medium">(الوزن: {order.weight.toFixed(2)} كجم)</span>
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.shippingFee.toLocaleString()} ج.م</span>
                    </div>
                    {inspectionFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم المعاينة:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {insuranceFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم التأمين ({insuranceRate}%):</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toFixed(2)} ج.م</span>
                        </div>
                    )}
                    {order.discount > 0 && (
                        <div className="flex justify-between items-center text-sm text-red-500">
                            <span className="font-bold">الخصم:</span>
                            <span className="font-black">-{order.discount.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                    <div className="flex justify-between items-center text-xl">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">الإجمالي المطلوب تحصيله:</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} ج.م</span>
                    </div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button onClick={onConfirm} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm hover:shadow">
                        تأكيد وإضافة
                    </button>
                    <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        رفض وتعديل
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrdersList;
