import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, Edit3, ChevronDown, Package, MapPin, Coins, FileSearch, AlertCircle, ShieldCheck, ShieldAlert, Banknote, ShoppingBag, Save, XCircle, Info, User, Building, Download, Filter, Truck, CheckCircle, RefreshCcw, Briefcase, ChevronLeft, ChevronRight, MoreVertical, Percent, Lock, Unlock, Receipt, AlertTriangle, MessageCircle, Printer, Wand2, FileText, Phone, Archive, ArrowRightLeft, Image as ImageIcon, FileDown } from 'lucide-react';
import { Order, Settings, OrderStatus, Wallet, Transaction, PaymentStatus, PreparationStatus, OrderItem, Product, CustomerProfile, Store } from '../types';
import { ORDER_STATUSES } from '../constants';
import { motion, Variants } from 'framer-motion';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';
import { generateShippingLabelHTML } from '../utils/shippingLabelGenerator';
import { generateShippingNote } from '../services/geminiService';
import { calculateCodFee } from '../utils/financials';
import { generateOrdersReportHTML } from '../utils/reportGenerator';

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
  settings: Settings;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  addLoyaltyPointsForOrder: (order: Order) => void;
  activeStore?: Store;
}

interface NewOrderState extends Partial<Omit<Order, 'id'>> {
  items: OrderItem[];
  customerPhone2?: string;
  country?: string;
  buildingDetails?: string;
  creditAmount?: number;
}

const WaybillModal: React.FC<{ order: Order; onClose: () => void; onSave: (waybill: string) => void; }> = ({ order, onClose, onSave }) => {
    const [waybill, setWaybill] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!waybill.trim()) return;
        onSave(waybill);
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-8 text-right animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-6">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><FileSearch size={24}/></div>
                    <h3 className="text-xl font-black dark:text-white">إدخال رقم بوليصة الشحن</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    لتغيير حالة الطلب إلى "تم الارسال"، يجب إدخال رقم بوليصة الشحن أولاً.
                </p>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        value={waybill}
                        onChange={e => setWaybill(e.target.value)}
                        className="w-full p-4 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="رقم البوليصة"
                        autoFocus
                    />
                    <div className="flex gap-3 mt-6">
                        <button type="submit" disabled={!waybill.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:bg-slate-400">حفظ وتغيير الحالة</button>
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const OrdersList: React.FC<OrdersListProps> = ({ orders, setOrders, settings, setWallet, addLoyaltyPointsForOrder, activeStore }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState<Order | null>(null);
  
  const [activeTab, setActiveTab] = useState('الجميع');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<Omit<Order, 'id'> | null>(null);
  const [orderForWaybill, setOrderForWaybill] = useState<{ orderId: string, newStatus: OrderStatus } | null>(null);
  
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
    orderNumber: '', date: new Date().toISOString().split('T')[0], shippingCompany: activeCompanies[0] || 'ارامكس', shippingArea: '', customerName: '', customerPhone: '',
    customerPhone2: '', country: 'مصر', buildingDetails: '',
    items: [], shippingFee: 0, status: 'في_انتظار_المكالمة', includeInspectionFee: true, isInsured: true,
    paymentStatus: 'بانتظار الدفع', preparationStatus: 'بانتظار التجهيز', discount: 0, notes: '',
    orderType: 'standard', originalOrderId: undefined,
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
    const selectedOpt = options.find(o => o.label === orderData.shippingArea) || options[0];
    if (selectedOpt) {
      const totalWeight = orderData.items?.reduce((sum, item) => sum + item.weight * item.quantity, 0) || 0;
      const baseFee = selectedOpt.price;
      const extraWeight = Math.max(0, totalWeight - selectedOpt.baseWeight);
      const totalFee = baseFee + (extraWeight * selectedOpt.extraKgPrice);
      
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
    if (activeTab === 'الأرشيف') {
        baseFilter = orders.filter(o => o.status === 'مؤرشف');
    } else {
        baseFilter = orders.filter(o => o.status !== 'مؤرشف' && o.status !== 'في_انتظار_المكالمة');
    }

    const searched = baseFilter.filter((o: Order) => 
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (o.orderNumber && o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.waybillNumber && o.waybillNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );
      
    let tabFiltered = searched;
    if (activeTab === 'بانتظار التجهيز') {
        tabFiltered = searched.filter(o => o.preparationStatus === 'بانتظار التجهيز' && o.status === 'جاري_المراجعة');
    } else if (activeTab === 'تم التوصيل') {
        tabFiltered = searched.filter(o => o.status === 'تم_توصيلها' || o.status === 'تم_التحصيل');
    } else if (activeTab === 'مرتجع') {
        tabFiltered = searched.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام'].includes(o.status));
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

    const totalProductPrice = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalProductCost = orderData.items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const totalWeight = orderData.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
    const productNames = orderData.items.map(item => item.name).join(', ');

    const orderToAdd: Omit<Order, 'id'> & { totalAmountOverride?: number } = {
      ...(orderData as Omit<Order, 'id'>),
      customerAddress: fullAddress,
      notes: finalNotes,
      orderNumber: orderData.orderNumber || `ORD-${Date.now()}`,
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
    updateOrderField(order.id, 'paymentStatus', newPaymentStatus);
    const updatedOrder = {...order, paymentStatus: newPaymentStatus};
    
    if (newPaymentStatus === 'مدفوع' && order.status === 'تم_توصيلها') {
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const inspectionFee = useCustom ? (compFees?.inspectionFee ?? settings.inspectionFee) : settings.inspectionFee;
        const customerPaidInspection = order.includeInspectionFee ? window.confirm(`الأوردر رقم ${order.orderNumber}\nهل قام العميل بدفع رسوم المعاينة (الـ ${inspectionFee} ج)؟`) : false;
        handleCollectAction(updatedOrder, customerPaidInspection);
    }
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
            return { ...o, status: newStatus as OrderStatus };
        }
        return o;
    }));

    setSelectedOrders([]);
    if(selectElement) selectElement.value = 'default';
  };

  const handleExportCSV = () => {
    const headers = ['رقم الطلب', 'رقم البوليصة', 'العميل', 'الهاتف', 'المحافظة', 'المنتجات', 'الإجمالي', 'الحالة', 'التاريخ'];
    const rows = filteredOrders.map(o => [ o.orderNumber, o.waybillNumber || '-', o.customerName, o.customerPhone, o.shippingArea, o.items.map(i => `${i.name} (x${i.quantity})`).join(' | '), o.totalAmountOverride ?? (o.productPrice + o.shippingFee - (o.discount || 0)), o.status, new Date(o.date).toLocaleDateString('ar-EG') ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const storeName = activeStore?.name || 'متجري';
    const html = generateOrdersReportHTML(filteredOrders, settings, storeName);
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        alert("يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.");
    }
  };

  const getWhatsAppLink = (order: Order) => {
      let msg = '';
      const name = order.customerName.split(' ')[0];
      switch(order.status) {
          case 'جاري_المراجعة': msg = `أهلاً بك يا ${name} 👋، بنأكد مع حضرتك طلبك (${order.productName}) من متجرنا. العنوان: ${order.customerAddress}. هل البيانات صحيحة؟`; break;
          case 'قيد_التنفيذ': msg = `يا ${name}، طلبك قيد التجهيز حالياً وهيسلم لشركة الشحن قريباً.`; break;
          case 'تم_الارسال': msg = `مرحباً ${name}، تم شحن طلبك ورقم البوليصة هو ${order.waybillNumber || order.orderNumber}.`; break;
          case 'فشل_التوصيل': msg = `يا ${name}، المندوب حاول يوصلك النهاردة وماعرفش. ياريت ترد عليه أو تأكد معانا ميعاد تاني.`; break;
          default: msg = `أهلاً ${name}، بخصوص طلبك رقم ${order.orderNumber}...`;
      }
      let phone = order.customerPhone.replace(/\D/g, '');
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
      failed: nonArchivedOrders.filter(o => ['مرتجع', 'فشل_التوصيل', 'ملغي', 'مرتجع_بعد_الاستلام'].includes(o.status)).length,
    };
  }, [orders]);

  const orderForModal = useMemo(() => {
    if (!orderForWaybill) return null;
    return orders.find(o => o.id === orderForWaybill.orderId);
  }, [orderForWaybill, orders]);

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-black text-slate-800 dark:text-white">الطلبات</h1>
        <div className="flex flex-wrap items-center gap-2">
           <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
             <Download size={16} /> تصدير Excel
           </button>
           <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 transition-all">
             <FileDown size={16} /> تصدير PDF
           </button>
           <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-sm">
             <Plus size={18}/> أنشئ طلب
           </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
         <h3 className="text-sm font-bold text-slate-500 mb-3">نظرة سريعة على شحناتك</h3>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickStat icon={<Briefcase/>} label="بانتظار البوليصة" value={quickStats.awaitingWaybill} color="purple"/>
            <QuickStat icon={<Truck/>} label="في الطريق" value={quickStats.onTheWay} color="sky"/>
            <QuickStat icon={<CheckCircle/>} label="تم توصيلها" value={quickStats.delivered} color="emerald"/>
            <QuickStat icon={<RefreshCcw/>} label="لم تنجح" value={quickStats.failed} color="red"/>
         </div>
      </motion.div>
      
      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {selectedOrders.length > 0 ? (
          <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-3">
              <span className="font-bold text-blue-800 dark:text-blue-300">تم تحديد {selectedOrders.length} طلبات</span>
              <button onClick={() => setSelectedOrders([])} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold flex items-center gap-1">
                <XCircle size={14}/> إلغاء التحديد
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <select id="bulk-status-select" defaultValue="default" onChange={(e) => handleBulkStatusChange(e.target.value)} className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg py-2 pl-4 pr-8 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                  <option value="default" disabled>تغيير الحالة...</option>
                  {ORDER_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
              <button onClick={() => setShowBulkDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors">
                <Trash2 size={16}/> حذف
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex w-full items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              <TabButton label="الجميع" activeTab={activeTab} setActiveTab={setActiveTab} count={orders.filter(o => o.status !== 'مؤرشف').length} />
              <TabButton label="بانتظار التجهيز" activeTab={activeTab} setActiveTab={setActiveTab} count={orders.filter(o => o.preparationStatus === 'بانتظار التجهيز').length}/>
              <TabButton label="تم التوصيل" activeTab={activeTab} setActiveTab={setActiveTab} count={quickStats.delivered}/>
              <TabButton label="مرتجع" activeTab={activeTab} setActiveTab={setActiveTab} count={quickStats.failed}/>
              <TabButton label="الأرشيف" activeTab={activeTab} setActiveTab={setActiveTab} count={orders.filter(o => o.status === 'مؤرشف').length}/>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="بحث..." className="w-full pr-10 pl-4 py-2 bg-white dark:bg-slate-800 rounded-lg outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  <Filter size={16} /> البحث والتصنيف
              </button>
            </div>
          </div>
        )}

        {/* Table for Desktop */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-black">
              <tr>
                <th className="p-4 w-12 text-center"><input type="checkbox" className="rounded border-slate-300 dark:bg-slate-900 dark:border-slate-700" onChange={handleSelectAll} checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}/></th>
                <th className="p-4">العميل</th>
                <th className="p-4">المنتج</th>
                <th className="p-4">الشحن</th>
                <th className="p-4">حالة الطلب</th>
                <th className="p-4">حالة التجهيز</th>
                <th className="p-4">الدفع</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedOrders.map(order => (
                <OrderRow key={order.id} order={order} onStatusChange={updateOrderStatus} onPaymentChange={handlePaymentStatusChange} onPreparationChange={(id, val) => updateOrderField(id, 'preparationStatus', val)} onEdit={() => { setEditingOrder({ ...order }); setShowAddModal(true); }} onDelete={() => setOrderToDelete(order)} onPrintInvoice={() => handlePrintInvoice(order)} onPrintShippingLabel={() => handlePrintShippingLabel(order)} isSelected={selectedOrders.includes(order.id)} onSelectRow={() => handleSelectRow(order.id)} settings={settings} whatsappLink={getWhatsAppLink(order)} onReturn={handlePostCollectionReturn} onExchange={handleStartExchange} />
            ))}
            </tbody>
          </table>
        </div>
        
        {/* Cards for Mobile */}
        <div className="md:hidden">
            {paginatedOrders.length > 0 ? (
                <div className="p-4 space-y-4">
                    {paginatedOrders.map(order => (
                         <OrderCard key={order.id} order={order} onStatusChange={updateOrderStatus} onPaymentChange={handlePaymentStatusChange} onPreparationChange={(id, val) => updateOrderField(id, 'preparationStatus', val)} onEdit={() => { setEditingOrder({ ...order }); setShowAddModal(true); }} onDelete={() => setOrderToDelete(order)} onPrintInvoice={() => handlePrintInvoice(order)} onPrintShippingLabel={() => handlePrintShippingLabel(order)} isSelected={selectedOrders.includes(order.id)} onSelectRow={() => handleSelectRow(order.id)} settings={settings} whatsappLink={getWhatsAppLink(order)} onReturn={handlePostCollectionReturn} onExchange={handleStartExchange} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400">لا توجد طلبات.</div>
            )}
        </div>

        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div className="font-bold">عرض {paginatedOrders.length} من {filteredOrders.length} طلبات</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronRight/></button>
            <span>صفحة {currentPage} من {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft/></button>
          </div>
        </div>
      </motion.div>

      {(showAddModal || editingOrder) && (
        <OrderModal isOpen={showAddModal || !!editingOrder} onClose={() => {setShowAddModal(false); setEditingOrder(null)}} onSubmit={handleAddOrder} orderData={editingOrder || newOrder} setOrderData={editingOrder ? setEditingOrder as React.Dispatch<React.SetStateAction<any>> : setNewOrder} settings={settings} isEditing={!!editingOrder} customers={uniqueCustomers} orders={orders} />
      )}
      
      {orderToConfirm && ( <OrderPreConfirmationModal order={orderToConfirm} settings={settings} onConfirm={handleConfirmAddOrder} onCancel={() => setOrderToConfirm(null)} /> )}
      {showSummaryModal && ( <OrderConfirmationSummary order={showSummaryModal} settings={settings} onClose={() => setShowSummaryModal(null)} /> )}
      {orderToDelete && ( <ConfirmationModal title="حذف الطلب؟" description={`هل أنت متأكد من حذف طلب العميل "${orderToDelete.customerName}"؟`} onConfirm={handleDeleteOrder} onCancel={() => setOrderToDelete(null)} /> )}
      {showBulkDeleteConfirm && ( <ConfirmationModal title="حذف الطلبات المحددة؟" description={`هل أنت متأكد من حذف ${selectedOrders.length} طلبات؟ هذا الإجراء لا يمكن التراجع عنه.`} onConfirm={handleBulkDelete} onCancel={() => setShowBulkDeleteConfirm(false)} /> )}
      {orderForWaybill && orderForModal && ( <WaybillModal order={orderForModal} onClose={() => setOrderForWaybill(null)} onSave={handleSaveWaybill} /> )}
    </motion.div>
  );
};

interface OrderRowProps { order: Order; onStatusChange: (id: string, newStatus: OrderStatus) => void; onPaymentChange: (order: Order, newPaymentStatus: PaymentStatus) => void; onPreparationChange: (id: string, newStatus: PreparationStatus) => void; onEdit: () => void; onDelete: () => void; onPrintInvoice: () => void; onPrintShippingLabel: () => void; isSelected: boolean; onSelectRow: () => void; settings: Settings; whatsappLink: string; onReturn: (order: Order) => void; onExchange: (order: Order) => void; }
const OrderRow: React.FC<OrderRowProps> = ({ order, onStatusChange, onPaymentChange, onPreparationChange, onEdit, onDelete, onPrintInvoice, onPrintShippingLabel, isSelected, onSelectRow, whatsappLink, onReturn, onExchange }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => { const handleClickOutside = (e: MouseEvent) => { if(menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);
    const statusColors: Record<OrderStatus, string> = { في_انتظار_المكالمة: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800', جاري_المراجعة: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 border-purple-200 dark:border-purple-800', قيد_التنفيذ: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', تم_الارسال: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 border-sky-200 dark:border-sky-800', قيد_الشحن: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border-blue-200 dark:border-blue-800', تم_توصيلها: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400 border-teal-200 dark:border-teal-800', تم_التحصيل: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', مرتجع: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800', مرتجع_بعد_الاستلام: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border-orange-200 dark:border-orange-800', تم_الاستبدال: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600', مرتجع_جزئي: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border-orange-200 dark:border-orange-800', فشل_التوصيل: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800', ملغي: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700', مؤرشف: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    const paymentStatusColors: Record<PaymentStatus, string> = { 'بانتظار الدفع': 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800', 'مدفوع': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', 'مدفوع جزئياً': 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 border-sky-200 dark:border-sky-800', 'مرتجع': 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800' };
    return (
        <tr className={`transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
            <td className="p-4 text-center"><input type="checkbox" className="rounded border-slate-300 dark:bg-slate-900 dark:border-slate-700" checked={isSelected} onChange={onSelectRow} /></td>
            <td className="p-4">
                <div className="flex items-center gap-2">
                    <div className="font-bold text-slate-800 dark:text-white">{order.customerName}</div>
                    {order.orderType === 'exchange' && <span title={`طلب استبدال للطلب ${order.originalOrderId}`}><ArrowRightLeft size={12} className="text-blue-500" /></span>}
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-full" title="مراسلة واتساب"><MessageCircle size={14} /></a>
                </div>
                <div className="text-xs text-slate-500 font-mono" title="رقم الطلب">{order.orderNumber || '---'}</div>
                {order.waybillNumber && (
                    <div className="text-xs text-sky-600 dark:text-sky-400 font-mono mt-1" title="رقم البوليصة">
                        بوليصة: {order.waybillNumber}
                    </div>
                )}
            </td>
            <td className="p-4"><div className="font-bold text-slate-800 dark:text-white truncate max-w-xs">{order.productName}</div><div className="text-xs text-slate-500 font-bold">{(order.totalAmountOverride ?? order.productPrice).toLocaleString()} ج.م</div></td>
            <td className="p-4"><div className="font-bold text-slate-800 dark:text-white">{order.shippingCompany}</div><div className="text-xs text-slate-500">{order.shippingArea} ({order.shippingFee} ج.م)</div></td>
            <td className="p-4"><div className="relative group"><select value={order.status} onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)} className={`appearance-none w-36 text-right cursor-pointer text-xs font-black px-3 py-2 rounded-lg border transition-all ${statusColors[order.status]}`}>{ORDER_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select><ChevronDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-current opacity-50 pointer-events-none"/></div></td>
            <td className="p-4"><select value={order.preparationStatus} onChange={(e) => onPreparationChange(order.id, e.target.value as PreparationStatus)} className={`appearance-none w-36 text-right cursor-pointer text-xs font-black px-3 py-2 rounded-lg border ${order.preparationStatus === 'جاهز' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{PREPARATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
            <td className="p-4"><div className="relative group"><select value={order.paymentStatus} onChange={(e) => onPaymentChange(order, e.target.value as PaymentStatus)} className={`appearance-none w-36 text-right cursor-pointer text-xs font-black px-3 py-2 rounded-lg border transition-all ${paymentStatusColors[order.paymentStatus]}`} disabled={order.paymentStatus === 'مدفوع' || order.status !== 'تم_توصيلها'}>{PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select><ChevronDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-current opacity-50 pointer-events-none"/></div></td>
            <td className="p-4"><div className="flex items-center gap-1"><button onClick={onPrintShippingLabel} className="p-2 text-slate-400 hover:text-gray-600 dark:hover:text-gray-400 rounded-lg transition-colors" title="طباعة بوليصة الشحن"><FileText size={16}/></button><button onClick={onPrintInvoice} className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg transition-colors" title="طباعة الفاتورة"><Printer size={16}/></button><button onClick={onEdit} className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"><Edit3 size={16}/></button><button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"><Trash2 size={16}/></button>
            {['تم_توصيلها', 'تم_التحصيل'].includes(order.status) && (
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setMenuOpen(p => !p)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg"><MoreVertical size={16}/></button>
                    {menuOpen && (
                        <div className="absolute left-0 top-full z-20 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border dark:border-slate-700 p-1">
                            <button onClick={() => { onReturn(order); setMenuOpen(false); }} className="w-full text-right flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><RefreshCcw size={14}/> إرجاع بعد الاستلام</button>
                            <button onClick={() => { onExchange(order); setMenuOpen(false); }} className="w-full text-right flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ArrowRightLeft size={14}/> إنشاء طلب استبدال</button>
                        </div>
                    )}
                </div>
            )}
            </div></td>
        </tr>
    );
};
interface OrderCardProps extends OrderRowProps {}
const OrderCard: React.FC<OrderCardProps> = ({ order, onStatusChange, onPaymentChange, onPreparationChange, onEdit, onDelete, onPrintInvoice, onPrintShippingLabel, isSelected, onSelectRow, whatsappLink, onReturn, onExchange }) => {
    const statusColors: Record<OrderStatus, string> = { في_انتظار_المكالمة: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800', جاري_المراجعة: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 border-purple-200 dark:border-purple-800', قيد_التنفيذ: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', تم_الارسال: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 border-sky-200 dark:border-sky-800', قيد_الشحن: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border-blue-200 dark:border-blue-800', تم_توصيلها: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400 border-teal-200 dark:border-teal-800', تم_التحصيل: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', مرتجع: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800', مرتجع_بعد_الاستلام: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border-orange-200 dark:border-orange-800', تم_الاستبدال: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600', مرتجع_جزئي: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border-orange-200 dark:border-orange-800', فشل_التوصيل: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800', ملغي: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700', مؤرشف: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    const paymentStatusColors: Record<PaymentStatus, string> = { 'بانتظار الدفع': 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800', 'مدفوع': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', 'مدفوع جزئياً': 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 border-sky-200 dark:border-sky-800', 'مرتجع': 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800' };

    return (
        <div className={`p-4 space-y-4 rounded-xl border ${isSelected ? 'bg-blue-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700' : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-slate-300 dark:bg-slate-900 dark:border-slate-700" checked={isSelected} onChange={onSelectRow} />
                        <span className="font-bold text-slate-800 dark:text-white">{order.customerName}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1">{order.orderNumber}</div>
                </div>
                 <div className="flex items-center gap-1">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-full" title="مراسلة واتساب"><MessageCircle size={16} /></a>
                    <button onClick={onPrintShippingLabel} className="p-2 text-slate-400 hover:text-gray-600 dark:hover:text-gray-400 rounded-lg transition-colors" title="طباعة بوليصة الشحن"><FileText size={16}/></button>
                    <button onClick={onEdit} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"><Edit3 size={16}/></button>
                    <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
            </div>

            <div className="space-y-2 text-sm">
                <p className="font-bold text-slate-700 dark:text-slate-300 truncate">{order.productName}</p>
                <p className="font-bold text-indigo-600">{(order.totalAmountOverride ?? order.productPrice).toLocaleString()} ج.م</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="relative group">
                    <select value={order.status} onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)} className={`appearance-none w-full text-right cursor-pointer text-xs font-black px-3 py-2 rounded-lg border transition-all ${statusColors[order.status]}`}>{ORDER_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
                    <ChevronDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-current opacity-50 pointer-events-none"/>
                </div>
                 <div className="relative group">
                    <select value={order.paymentStatus} onChange={(e) => onPaymentChange(order, e.target.value as PaymentStatus)} className={`appearance-none w-full text-right cursor-pointer text-xs font-black px-3 py-2 rounded-lg border transition-all ${paymentStatusColors[order.paymentStatus]}`} disabled={order.paymentStatus === 'مدفوع' || order.status !== 'تم_توصيلها'}>{PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    <ChevronDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-current opacity-50 pointer-events-none"/>
                </div>
            </div>
            
             {['تم_توصيلها', 'تم_التحصيل'].includes(order.status) && (
                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                     <button onClick={() => onReturn(order)} className="flex-1 text-center flex items-center justify-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-md"><RefreshCcw size={14}/> إرجاع</button>
                     <button onClick={() => onExchange(order)} className="flex-1 text-center flex items-center justify-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-md"><ArrowRightLeft size={14}/> استبدال</button>
                </div>
             )}
        </div>
    );
};
interface QuickStatProps { icon: React.ReactNode; label: string; value: number; color: string; }
const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, color }) => { const colors: Record<string, string> = { purple: "text-purple-600 bg-purple-100 dark:bg-purple-900/50", sky: "text-sky-600 bg-sky-100 dark:bg-sky-900/50", emerald: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50", red: "text-red-600 bg-red-100 dark:bg-red-900/50", }; return ( <div className="bg-white dark:bg-slate-800/50 p-3 rounded-lg flex items-center gap-3"> <div className={`p-2 rounded-md ${colors[color]}`}>{icon}</div> <div> <div className="text-xs font-bold text-slate-500">{label}</div> <div className="text-lg font-black text-slate-800 dark:text-white">{value}</div> </div> </div> ); };
interface TabButtonProps { label: string; activeTab: string; setActiveTab: (label: string) => void; count: number; }
const TabButton: React.FC<TabButtonProps> = ({ label, activeTab, setActiveTab, count }) => {
    const isActive = activeTab === label;
    return (
        <button
            onClick={() => setActiveTab(label)}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
                isActive
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
        >
            <span>{label}</span>
            <span
                className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${
                    isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200'
                }`}
            >
                {count}
            </span>
        </button>
    );
};
interface OrderModalProps { isOpen: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void; orderData: NewOrderState | Order; setOrderData: React.Dispatch<React.SetStateAction<any>>; settings: Settings; isEditing: boolean; customers: Pick<CustomerProfile, 'name' | 'phone' | 'address'>[]; orders: Order[]; }

const NewOrderScreen: React.FC<OrderModalProps> = ({ isOpen, onClose, onSubmit, orderData, setOrderData, settings, isEditing, customers, orders }) => {
    
    const isExchange = (orderData as NewOrderState).orderType === 'exchange';
    let creditAmount = (orderData as NewOrderState).creditAmount || 0;

    // Customer Search State
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
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
            c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
            c.phone.includes(customerSearch)
        );
    }, [customerSearch, customers]);
    
    if (isEditing && isExchange && !creditAmount && orderData.originalOrderId) {
        const originalOrder = orders.find(o => o.id === orderData.originalOrderId);
        if (originalOrder) {
            creditAmount = originalOrder.totalAmountOverride ?? (originalOrder.productPrice + originalOrder.shippingFee - (originalOrder.discount || 0));
        }
    }

    const subtotal = useMemo(() => (orderData.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0), [orderData.items]);
    
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
            
            const existingItemIndex = newItems.findIndex((item, i) => item.productId === value && i !== index);
    
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
                 newItems[index] = { ...newItems[index], productId: value, name: product.name, price: product.price, cost: product.costPrice, weight: product.weight, thumbnail: product.thumbnail };
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
    const activeCompanies = Object.keys(settings.shippingOptions).filter(company => settings.activeCompanies[company] !== false);
    const shippingOptions = settings.shippingOptions[orderData.shippingCompany!] || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <form onSubmit={onSubmit} className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[95vh] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-black dark:text-white flex items-center gap-3"><ShoppingBag className="text-indigo-500"/>{isEditing ? `تعديل الطلب ${orderData.orderNumber}` : 'إنشاء طلب جديد'}</h3>
                    <button type="button" onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold mb-4 flex items-center gap-2"><User size={18}/> بيانات العميل</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative" ref={customerSearchRef}>
                                    <input type="text" placeholder="اسم العميل أو رقم الهاتف" required value={customerSearch || orderData.customerName || ''} onChange={e => { setCustomerSearch(e.target.value); handleFieldChange('customerName', e.target.value); }} onFocus={() => setIsCustomerListOpen(true)} className="p-3 bg-white dark:bg-slate-800 border rounded-lg w-full" />
                                    {isCustomerListOpen && filteredCustomers.length > 0 && (
                                        <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                            {filteredCustomers.map(c => (
                                                <div key={c.phone} onClick={() => handleCustomerSelect(c)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                                    <p className="font-bold text-sm">{c.name}</p>
                                                    <p className="text-xs text-slate-500">{c.phone}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input type="tel" placeholder="رقم الهاتف" required value={orderData.customerPhone || ''} onChange={e => handleFieldChange('customerPhone', e.target.value)} className="p-3 bg-white dark:bg-slate-800 border rounded-lg" />
                                <input type="tel" placeholder="رقم هاتف إضافي (اختياري)" value={(orderData as NewOrderState).customerPhone2 || ''} onChange={e => handleFieldChange('customerPhone2', e.target.value)} className="p-3 bg-white dark:bg-slate-800 border rounded-lg" />
                                <input type="text" placeholder="الدولة" value={(orderData as NewOrderState).country || 'مصر'} onChange={e => handleFieldChange('country', e.target.value)} className="p-3 bg-white dark:bg-slate-800 border rounded-lg" />
                            </div>
                            <textarea placeholder="العنوان بالتفصيل" required value={orderData.customerAddress || ''} onChange={e => handleFieldChange('customerAddress', e.target.value)} className="mt-4 w-full p-3 bg-white dark:bg-slate-800 border rounded-lg h-20" />
                            <input type="text" placeholder="تفاصيل العنوان (رقم المبنى، الشقة...)" value={(orderData as NewOrderState).buildingDetails || ''} onChange={e => handleFieldChange('buildingDetails', e.target.value)} className="mt-4 w-full p-3 bg-white dark:bg-slate-800 border rounded-lg" />
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                           <h4 className="font-bold mb-4 flex items-center gap-2"><Building size={18}/> بيانات الشحن والطلب</h4>
                           <div className="grid grid-cols-2 gap-4">
                                <select required value={orderData.shippingCompany} onChange={e => handleFieldChange('shippingCompany', e.target.value)} className="p-3 bg-white dark:bg-slate-800 border rounded-lg">{activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <select required value={orderData.shippingArea} onChange={e => handleFieldChange('shippingArea', e.target.value)} className="p-3 bg-white dark:bg-slate-800 border rounded-lg">{shippingOptions.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}</select>
                           </div>
                           <div className="mt-4">
                               <label htmlFor="orderNumberInput" className="text-sm font-bold text-slate-700 dark:text-slate-400 mb-2 block">رقم الطلب (اختياري)</label>
                               <input id="orderNumberInput" type="text" placeholder="سيتم إنشاؤه تلقائياً إذا ترك فارغاً" value={orderData.orderNumber || ''} onChange={e => handleFieldChange('orderNumber', e.target.value)} className="p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-full font-mono" />
                           </div>
                        </div>
                         <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                             <h4 className="font-bold mb-4">ملاحظات إضافية</h4>
                             <textarea placeholder="أي ملاحظات للمندوب أو الطلب..." value={orderData.notes || ''} onChange={e => handleFieldChange('notes', e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border rounded-lg h-24" />
                         </div>
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                             <h4 className="font-bold mb-4 flex items-center gap-2"><Package size={18}/> المنتجات</h4>
                             <div className="space-y-3 max-h-48 overflow-y-auto">
                                {(orderData.items || []).map((item, index) => (
                                    <div key={index} className="p-3 bg-white dark:bg-slate-800 border rounded-lg space-y-2 relative">
                                        <button type="button" onClick={() => removeItem(index)} className="absolute top-2 left-2 text-slate-400 hover:text-red-500"><XCircle size={16}/></button>
                                        <select value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm">{settings.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                        <div className="flex gap-2">
                                            <input type="number" placeholder="الكمية" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-1/2 p-2 bg-slate-50 dark:bg-slate-700 rounded" />
                                            <input type="number" placeholder="السعر" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className="w-1/2 p-2 bg-slate-50 dark:bg-slate-700 rounded" />
                                        </div>
                                    </div>
                                ))}
                             </div>
                             <button type="button" onClick={addItem} className="w-full mt-3 p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-bold rounded-lg text-sm">+ إضافة منتج</button>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <h4 className="font-bold mb-2">الملخص المالي</h4>
                            <div className="flex justify-between text-sm"><span>إجمالي المنتجات</span><span className="font-bold">{subtotal.toLocaleString()} ج.م</span></div>
                            <div className="flex justify-between text-sm"><span>مصاريف الشحن</span><span className="font-bold">{(orderData.shippingFee || 0).toLocaleString()} ج.م</span></div>
                            {inspectionFee > 0 && (
                                <div className="flex justify-between text-sm"><span>رسوم المعاينة</span><span className="font-bold">{inspectionFee.toLocaleString()} ج.م</span></div>
                            )}
                            <div className="p-3 bg-white dark:bg-slate-800 border rounded-xl"><label className="text-xs text-slate-400">خصم</label><input type="number" value={orderData.discount || 0} onChange={e => handleFieldChange('discount', Number(e.target.value))} className="w-full font-bold bg-transparent outline-none" /></div>
                            <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200"><span>المجموع</span><span>{totalBeforeCredit.toLocaleString()} ج.م</span></div>
                            {isExchange && (
                                <div className="flex justify-between font-bold text-orange-500">
                                    <span>رصيد سابق</span>
                                    <span>-{creditAmount.toLocaleString()} ج.م</span>
                                </div>
                            )}
                            <div className="border-t-2 border-slate-300 dark:border-slate-600 my-2"></div>
                            <div className="flex justify-between font-black text-lg text-indigo-600">
                                <span>{finalAmount >= 0 ? 'المطلوب' : 'المستحق'}</span>
                                <span>{Math.abs(finalAmount).toLocaleString()} ج.م</span>
                            </div>
                        </div>
                         <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                             <h4 className="font-bold mb-2">إعدادات إضافية</h4>
                             <label className="flex items-center gap-2"><input type="checkbox" checked={orderData.includeInspectionFee} onChange={e => handleFieldChange('includeInspectionFee', e.target.checked)} /> تفعيل رسوم المعاينة</label>
                             <label className="flex items-center gap-2"><input type="checkbox" checked={orderData.isInsured} onChange={e => handleFieldChange('isInsured', e.target.checked)} /> تفعيل التأمين على الشحنة</label>
                         </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        {isExchange && <div className="text-xs text-slate-500">الطلب الجديد: {totalBeforeCredit.toLocaleString()} ج.م - رصيد سابق: {creditAmount.toLocaleString()} ج.م</div>}
                        <span className="text-sm text-slate-500">{finalAmount >= 0 ? 'الإجمالي المطلوب من العميل' : 'المبلغ المستحق للعميل'}</span>
                        <p className={`text-2xl font-black ${finalAmount >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>{Math.abs(finalAmount).toLocaleString()} ج.م</p>
                    </div>
                    <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2"><Save size={18}/>{isEditing ? 'تحديث الطلب' : 'حفظ الطلب'}</button>
                </div>
            </form>
        </div>
    );
};
const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onSubmit, orderData, setOrderData, settings, isEditing, customers, orders }) => {
    if (!isOpen) return null;
    return <NewOrderScreen isOpen={isOpen} onClose={onClose} onSubmit={onSubmit} orderData={orderData} setOrderData={setOrderData} settings={settings} isEditing={isEditing} customers={customers} orders={orders} />
};
interface OrderConfirmationSummaryProps { order: Order; settings: Settings; onClose: () => void; }
const OrderConfirmationSummary: React.FC<OrderConfirmationSummaryProps> = ({ order, settings, onClose }) => { const compFees = settings.companySpecificFees[order.shippingCompany]; const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0; const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0; const insuranceFee = ((order.productPrice + order.shippingFee) * insuranceRate) / 100; const total = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - order.discount + inspectionFee); return ( <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"> <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800"> <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-lg"><CheckCircle size={40} /></div> <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">تم إنشاء الطلب بنجاح!</h2> <p className="text-slate-500 dark:text-slate-400 mb-6">ملخص الطلب المالي للعميل <span className="font-bold text-slate-700 dark:text-slate-200">{order.customerName}</span></p> <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700"> <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">إجمالي المنتجات:</span> <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span> </div> <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">مصاريف الشحن:</span> <span className="font-black text-slate-700 dark:text-slate-200">{order.shippingFee.toLocaleString()} ج.م</span> </div> {inspectionFee > 0 && <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">رسوم المعاينة:</span> <span className="font-black text-slate-700 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span> </div>} {insuranceFee > 0 && <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">رسوم التأمين ({insuranceRate}%):</span> <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toFixed(2)} ج.م</span> </div>} {order.discount > 0 && <div className="flex justify-between items-center text-sm text-red-500"> <span className="font-bold">الخصم:</span> <span className="font-black">-{order.discount.toLocaleString()} ج.م</span> </div>} <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div> <div className="flex justify-between items-center text-xl"> <span className="font-black text-indigo-600 dark:text-indigo-400">الإجمالي المطلوب تحصيله:</span> <span className="font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} ج.م</span> </div> </div> <button onClick={onClose} className="mt-8 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">إغلاق</button> </div> </div> ); };
const ConfirmationModal: React.FC<{ title: string; description: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, description, onConfirm, onCancel }) => ( <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"> <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800"> <div className="w-16 h-16 bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4"> <AlertCircle size={32} /> </div> <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h3> <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{description}</p> <div className="flex flex-col gap-2"> <button onClick={onConfirm} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 dark:shadow-none"> تأكيد الحذف </button> <button onClick={onCancel} className="w-full py-3 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"> تراجع </button> </div> </div> </div> );
interface OrderPreConfirmationModalProps { order: Omit<Order, 'id'>; settings: Settings; onConfirm: () => void; onCancel: () => void; }
const OrderPreConfirmationModal: React.FC<OrderPreConfirmationModalProps> = ({ order, settings, onConfirm, onCancel }) => { const compFees = settings.companySpecificFees[order.shippingCompany]; const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0; const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0; const insuranceFee = ((order.productPrice + order.shippingFee) * insuranceRate) / 100; const total = (order as any).totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0) + inspectionFee); return ( <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"> <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800"> <div className="w-20 h-20 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-lg"><AlertTriangle size={40} /></div> <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">هل أنت متأكد من تفاصيل الطلب؟</h2> <p className="text-slate-500 dark:text-slate-400 mb-6">يرجى مراجعة الملخص المالي قبل تأكيد الطلب.</p> <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700"> <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">إجمالي المنتجات:</span> <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span> </div> <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">مصاريف الشحن:</span> <span className="font-black text-slate-700 dark:text-slate-200">{order.shippingFee.toLocaleString()} ج.م</span> </div> {inspectionFee > 0 && <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">رسوم المعاينة:</span> <span className="font-black text-slate-700 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span> </div>} {insuranceFee > 0 && <div className="flex justify-between items-center text-sm"> <span className="font-bold text-slate-500">رسوم التأمين ({insuranceRate}%):</span> <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toFixed(2)} ج.م</span> </div>} {order.discount > 0 && <div className="flex justify-between items-center text-sm text-red-500"> <span className="font-bold">الخصم:</span> <span className="font-black">-{order.discount.toLocaleString()} ج.م</span> </div>} <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div> <div className="flex justify-between items-center text-xl"> <span className="font-black text-indigo-600 dark:text-indigo-400">الإجمالي المطلوب تحصيله:</span> <span className="font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} ج.م</span> </div> </div> <div className="mt-8 flex gap-3"><button onClick={onConfirm} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all">تأكيد وإضافة</button><button onClick={onCancel} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">رفض وتعديل</button></div> </div> </div> ); };

export default OrdersList;