import React, { useState } from 'react';
import { Settings, Supplier, SupplyOrder, Transaction } from '../types';
import { UserPlus, Truck, Save, Plus, Package, Calendar, DollarSign, User, Trash2, Edit2, Eye, X } from 'lucide-react';
import { SupplyOrderItem } from '../types';

interface SuppliersPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setWallet: React.Dispatch<React.SetStateAction<any>>;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ settings, setSettings, setWallet }) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('orders');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  
  // New Supplier State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ name: '', phone: '', address: '', notes: '' });
  
  // New Order State
  const [editingOrder, setEditingOrder] = useState<SupplyOrder | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<SupplyOrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  
  const handleAddSupplier = () => {
      if(!newSupplier.name) return;
      if (editingSupplier) {
          setSettings(prev => ({
              ...prev,
              suppliers: prev.suppliers.map(s => s.id === editingSupplier.id ? { ...editingSupplier, ...newSupplier } as Supplier : s)
          }));
          setEditingSupplier(null);
      } else {
        const supplier: Supplier = {
            id: Date.now().toString(),
            name: newSupplier.name!,
            phone: newSupplier.phone || '',
            address: newSupplier.address || '',
            notes: newSupplier.notes || ''
        };
        setSettings(prev => ({...prev, suppliers: [...(prev.suppliers || []), supplier]}));
      }
      setShowSupplierModal(false);
      setNewSupplier({ name: '', phone: '', address: '', notes: '' });
  };

  const startEditSupplier = (supplier: Supplier) => {
      setEditingSupplier(supplier);
      setNewSupplier(supplier);
      setShowSupplierModal(true);
  };

  const handleDeleteSupplier = (id: string) => {
      if (!confirm('هل أنت متأكد من حذف هذا المورد؟')) return;
      setSettings(prev => ({
          ...prev,
          suppliers: prev.suppliers.filter(s => s.id !== id)
      }));
  };

  const handleAddOrder = () => {
      if(!selectedSupplierId || orderItems.length === 0) return;
      
      const totalCost = orderItems.reduce((sum, item) => {
          let itemTotal = item.cost * item.quantity;
          if (item.discountValue) {
              if (item.discountType === 'percentage') {
                  itemTotal -= (itemTotal * (item.discountValue / 100));
              } else {
                  itemTotal -= (item.discountValue * item.quantity);
              }
          }
          return sum + itemTotal;
      }, 0);

      const supplier = settings.suppliers.find(s => s.id === selectedSupplierId);

      setSettings(prev => {
          let updatedProducts = [...prev.products];
          let updatedOrders = [...(prev.supplyOrders || [])];
          let updatedSuppliers = [...(prev.suppliers || [])];
          
          // 1. Revert Old Order Impact (if editing)
          if (editingOrder) {
              const oldSuppIdx = updatedSuppliers.findIndex(s => s.id === editingOrder.supplierId);
              if (oldSuppIdx > -1 && editingOrder.paymentMethod === 'credit') {
                  updatedSuppliers[oldSuppIdx] = {
                      ...updatedSuppliers[oldSuppIdx],
                      balance: (updatedSuppliers[oldSuppIdx].balance || 0) - editingOrder.totalCost
                  };
              }

              editingOrder.items.forEach(oldItem => {
                  const product = updatedProducts.find(p => p.id === oldItem.productId);
                  if (product) {
                      const totalQty = oldItem.quantity + (oldItem.bonusQuantity || 0);
                      product.stockQuantity = (product.stockQuantity || 0) - totalQty;
                  }
              });
          }

          // 2. Apply New Impact
          orderItems.forEach(newItem => {
              const productIndex = updatedProducts.findIndex(p => p.id === newItem.productId);
              if (productIndex > -1) {
                  const totalQty = newItem.quantity + (newItem.bonusQuantity || 0);
                  const newQty = (updatedProducts[productIndex].stockQuantity || 0) + totalQty;
                  updatedProducts[productIndex] = {
                      ...updatedProducts[productIndex],
                      stockQuantity: newQty,
                      inStock: newQty > 0,
                      costPrice: newItem.cost // Update cost to newest purchase price
                  };
              }
          });

          // 3. Update Supplier Balance if Credit
          const supplierIdx = updatedSuppliers.findIndex(s => s.id === selectedSupplierId);
          if (supplierIdx > -1 && paymentMethod === 'credit') {
              updatedSuppliers[supplierIdx] = {
                  ...updatedSuppliers[supplierIdx],
                  balance: (updatedSuppliers[supplierIdx].balance || 0) + totalCost
              };
          }

          if (editingOrder) {
              updatedOrders = updatedOrders.map(o => o.id === editingOrder.id ? {
                  ...o,
                  supplierId: selectedSupplierId,
                  referenceNumber: orderReference,
                  notes: orderNotes,
                  items: orderItems,
                  totalCost,
                  paymentMethod
              } : o);
          } else {
              const newOrder: SupplyOrder = {
                  id: Date.now().toString(),
                  supplierId: selectedSupplierId,
                  date: new Date().toISOString(),
                  referenceNumber: orderReference || `supply_${Date.now()}`,
                  notes: orderNotes,
                  items: orderItems,
                  totalCost,
                  status: 'completed',
                  paymentMethod
              };
              updatedOrders.push(newOrder);
          }

          return {
              ...prev,
              products: updatedProducts,
              supplyOrders: updatedOrders,
              suppliers: updatedSuppliers
          };
      });

      // Update Wallet ONLY IF CASH
      if (paymentMethod === 'cash') {
          setWallet((prev: any) => {
              const transId = `supply_${editingOrder ? editingOrder.id : Date.now()}`;
              const newTransaction: Transaction = {
                  id: transId,
                  type: 'سحب',
                  amount: totalCost,
                  date: new Date().toISOString(),
                  note: `شراء بضاعة (كاش) من المورد ${supplier?.name} (المرجع: ${orderReference || transId})`,
                  category: 'inventory_purchase'
              };

              // Filter out existing transaction if editing
              const filteredTransactions = prev.transactions.filter((t: any) => t.id !== (editingOrder ? `supply_${editingOrder.id}` : transId));
              return { ...prev, transactions: [newTransaction, ...filteredTransactions] };
          });
      } else if (editingOrder && editingOrder.paymentMethod === 'cash' && paymentMethod === 'credit') {
          // If changed from cash to credit, remove the transaction
          setWallet((prev: any) => ({
              ...prev,
              transactions: prev.transactions.filter((t: any) => t.id !== `supply_${editingOrder.id}`)
          }));
      }

      setShowOrderModal(false);
      setEditingOrder(null);
      setOrderItems([]);
      setSelectedSupplierId('');
      setOrderReference('');
      setOrderNotes('');
  };

  const startEditOrder = (order: SupplyOrder) => {
      setEditingOrder(order);
      setSelectedSupplierId(order.supplierId);
      setOrderReference(order.referenceNumber || '');
      setOrderNotes(order.notes || '');
      setOrderItems(order.items);
      setPaymentMethod(order.paymentMethod || 'cash');
      setShowOrderModal(true);
  };

  const handleDeleteOrder = (order: SupplyOrder) => {
      if (!confirm('هل أنت متأكد من حذف أمر التوريد هذا؟ سيتم استرجاع المخزون وتعديل الحسابات.')) return;
      
      setSettings(prev => {
          let updatedSuppliers = [...prev.suppliers];
          if (order.paymentMethod === 'credit') {
              const suppIdx = updatedSuppliers.findIndex(s => s.id === order.supplierId);
              if (suppIdx > -1) {
                  updatedSuppliers[suppIdx] = {
                      ...updatedSuppliers[suppIdx],
                      balance: (updatedSuppliers[suppIdx].balance || 0) - order.totalCost
                  };
              }
          }

          return {
            ...prev,
            suppliers: updatedSuppliers,
            products: prev.products.map(p => {
                const item = order.items.find(i => i.productId === p.id);
                if (item) {
                    const totalQty = item.quantity + (item.bonusQuantity || 0);
                    const newQty = (p.stockQuantity || 0) - totalQty;
                    return { ...p, stockQuantity: newQty, inStock: newQty > 0 };
                }
                return p;
            }),
            supplyOrders: prev.supplyOrders.filter(o => o.id !== order.id)
          };
      });

      // Remove from Wallet if was cash
      if (order.paymentMethod === 'cash') {
          setWallet((prev: any) => ({
              ...prev,
              transactions: prev.transactions.filter((t: any) => t.id !== `supply_${order.id}`)
          }));
      }
  };

const ProductSelect = ({ value, onChange, products }: { value: string, onChange: (val: string) => void, products: any[] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);
    
    const selectedProduct = products.find(p => p.id === value);
    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button 
                type="button" 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-right hover:bg-slate-50 dark:hover:bg-slate-700 transition-all outline-none"
            >
                <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                    {selectedProduct?.thumbnail ? (
                        <img src={selectedProduct.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Package size={16} />
                        </div>
                    )}
                </div>
                <span className="flex-1 text-slate-800 dark:text-slate-200 truncate">{selectedProduct?.name || 'اختر منتجاً'}</span>
                <Plus size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-45' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <input 
                            autoFocus
                            type="text"
                            placeholder="ابحث..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filtered.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => { onChange(p.id); setIsOpen(false); }} 
                                className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                            >
                                <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                                    {p.thumbnail ? (
                                        <img src={p.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : <Package size={18} className="m-auto text-slate-300" />}
                                </div>
                                <div className="flex-1 text-right">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{p.name}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">تكلفة: {p.costPrice} ج.م</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

  const handleRecordPayment = () => {
    if (!selectedSupplierForPayment || paymentAmount <= 0) return;

    setSettings(prev => ({
        ...prev,
        suppliers: prev.suppliers.map(s => s.id === selectedSupplierForPayment.id ? {
            ...s,
            balance: (s.balance || 0) - paymentAmount
        } : s)
    }));

    // Record in Wallet as "Supply Payment"
    setWallet((prev: any) => ({
        ...prev,
        transactions: [
            {
                id: `pay_${Date.now()}`,
                type: 'سحب',
                amount: paymentAmount,
                date: new Date().toISOString(),
                note: `دفعة مديونية للمورد: ${selectedSupplierForPayment.name} ${paymentNote ? `(${paymentNote})` : ''}`,
                category: 'supplier_payment'
            },
            ...prev.transactions
        ]
    }));

    setShowPaymentModal(false);
    setPaymentAmount(0);
    setPaymentNote('');
    setSelectedSupplierForPayment(null);
  };

  const addItemToOrder = () => {
      if (settings.products.length > 0) {
          const firstProduct = settings.products[0];
          setOrderItems([...orderItems, { 
              productId: firstProduct.id, 
              name: firstProduct.name,
              quantity: 1, 
              bonusQuantity: 0,
              cost: firstProduct.costPrice,
              discountValue: 0,
              discountType: 'amount'
          }]);
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4">
        <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl"><Truck size={28} /></div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">إدارة الموردين والمخزون</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">سجل الموردين وقم بإنشاء أوامر توريد لزيادة مخزونك.</p>
            </div>
        </div>

        <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
            <button onClick={() => setActiveTab('orders')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>أوامر التوريد</button>
            <button onClick={() => setActiveTab('suppliers')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'suppliers' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>قائمة الموردين</button>
        </div>

        {activeTab === 'orders' && (
            <div className="space-y-4">
                <button onClick={() => {
                    setEditingOrder(null);
                    setSelectedSupplierId('');
                    setOrderReference('');
                    setOrderNotes('');
                    setOrderItems([]);
                    setShowOrderModal(true);
                }} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all font-bold">
                    <Plus size={20}/> تسجيل فاتورة شراء جديدة
                </button>

                <div className="grid gap-4">
                    {(settings.supplyOrders || []).map(order => {
                        const supplier = settings.suppliers.find(s => s.id === order.supplierId);
                        return (
                            <div key={order.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <User size={16}/> {supplier?.name || 'مورد غير معروف'}
                                        {order.referenceNumber && <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">Ref: {order.referenceNumber}</span>}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1">
                                        <Calendar size={12} className="inline ml-1"/> {new Date(order.date).toLocaleDateString('ar-EG')}
                                        <span className={`mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${order.paymentMethod === 'credit' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {order.paymentMethod === 'credit' ? 'آجل' : 'كاش'}
                                        </span>
                                        {order.notes && <span className="mr-3 opacity-60">| {order.notes}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex -space-x-3 space-x-reverse overflow-hidden">
                                        {order.items.slice(0, 3).map((item, i) => {
                                            const product = settings.products.find(p => p.id === item.productId);
                                            return (
                                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-sm">
                                                    {product?.thumbnail ? (
                                                        <img src={product.thumbnail} className="w-full h-full object-cover" />
                                                    ) : <Package size={12} className="m-auto mt-1" />}
                                                </div>
                                            );
                                        })}
                                        {order.items.length > 3 && (
                                            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                +{order.items.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-black text-lg text-emerald-600">{order.totalCost.toLocaleString()} ج.م</div>
                                        <div className="text-xs text-slate-500">{order.items.length} أصناف {order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0) > 0 && `(+ ${order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0)} بونص)`}</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => startEditOrder(order)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteOrder(order)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {activeTab === 'suppliers' && (
            <div className="space-y-4">
                <button onClick={() => { setEditingSupplier(null); setNewSupplier({name:'', phone:'', address:'', notes:''}); setShowSupplierModal(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"><UserPlus size={20}/> إضافة مورد</button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(settings.suppliers || []).map(supplier => (
                        <div key={supplier.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                    {supplier.name}
                                    {(supplier.balance || 0) > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">مديونية: {supplier.balance?.toLocaleString()} ج.م</span>}
                                </h3>
                                <p className="text-slate-500 text-sm">{supplier.phone}</p>
                                {supplier.address && <p className="text-slate-400 text-xs mt-2">{supplier.address}</p>}
                                {supplier.notes && <p className="text-slate-400 text-[10px] mt-1 bg-slate-50 dark:bg-slate-800 p-1 rounded italic">{supplier.notes}</p>}
                            </div>
                            <div className="flex gap-1">
                                {(supplier.balance || 0) > 0 && (
                                    <button onClick={() => { setSelectedSupplierForPayment(supplier); setPaymentAmount(supplier.balance || 0); setShowPaymentModal(true); }} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all" title="تسجيل دفعة">
                                        <DollarSign size={18}/>
                                    </button>
                                )}
                                <button onClick={() => startEditSupplier(supplier)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="تعديل"><Edit2 size={18}/></button>
                                <button onClick={() => handleDeleteSupplier(supplier.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="حذف"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Supplier Modal */}
        {showSupplierModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-4 dark:text-white">{editingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="اسم المورد" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.name || ''} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
                        <input type="text" placeholder="رقم الهاتف" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.phone || ''} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                        <input type="text" placeholder="العنوان" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.address || ''} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} />
                        <textarea placeholder="ملاحظات" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg h-24" value={newSupplier.notes || ''} onChange={e => setNewSupplier({...newSupplier, notes: e.target.value})} />
                        <button onClick={handleAddSupplier} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold mt-2">حفظ</button>
                        <button onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); setNewSupplier({name:'', phone:'', address:'', notes:''}); }} className="w-full py-3 text-slate-500 font-bold">إلغاء</button>
                    </div>
                </div>
            </div>
        )}

        {/* Order Modal */}
        {showOrderModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black dark:text-white">{editingOrder ? 'تعديل أمر توريد' : 'تسجيل فاتورة شراء (توريد)'}</h3>
                        <button onClick={() => setShowOrderModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">المورد</label>
                            <select value={selectedSupplierId || ''} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white">
                                <option value="">اختر المورد...</option>
                                {(settings.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name} {(s.balance || 0) > 0 ? `(مدين: ${s.balance})` : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">طريقة الدفع</label>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button onClick={() => setPaymentMethod('cash')} className={`flex-1 py-2 text-center rounded-lg font-bold transition-all ${paymentMethod === 'cash' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>كاش</button>
                                <button onClick={() => setPaymentMethod('credit')} className={`flex-1 py-2 text-center rounded-lg font-bold transition-all ${paymentMethod === 'credit' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-slate-500'}`}>آجل (مديونية)</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">رقم المرجع (Ref)</label>
                            <input type="text" placeholder="مثال: Inv-1234" value={orderReference || ''} onChange={e => setOrderReference(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-6">
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">ملاحظات</label>
                            <input type="text" placeholder="ملاحظات إضافية..." value={orderNotes || ''} onChange={e => setOrderNotes(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" />
                        </div>
                    </div>
                    
                    <div className="border-t dark:border-slate-800 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-lg font-bold dark:text-white flex items-center gap-2"><Package size={20} className="text-indigo-500"/> الأصناف والمخزون</h4>
                            <button onClick={addItemToOrder} className="flex items-center gap-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all">+ إضافة صنف</button>
                        </div>

                        <div className="space-y-4">
                            {orderItems.map((item, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-4">
                                            <label className="text-xs text-slate-500 mb-1 block">المنتج</label>
                                            <ProductSelect 
                                                 value={item.productId || ''} 
                                                 onChange={val => {
                                                    const newItems = [...orderItems];
                                                    const product = settings.products.find(p => p.id === val);
                                                    newItems[idx].productId = val;
                                                    newItems[idx].name = product?.name;
                                                    newItems[idx].cost = product?.costPrice || 0;
                                                    setOrderItems(newItems);
                                                 }} 
                                                 products={settings.products}
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs text-slate-500 mb-1 block">الكمية</label>
                                            <input type="number" min="1" value={item.quantity || 1} onChange={e => {
                                                const newItems = [...orderItems];
                                                newItems[idx].quantity = Number(e.target.value);
                                                setOrderItems(newItems);
                                            }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white text-center outline-none" />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs text-slate-500 mb-1 block">بونص</label>
                                            <input type="number" min="0" value={item.bonusQuantity || 0} onChange={e => {
                                                const newItems = [...orderItems];
                                                newItems[idx].bonusQuantity = Number(e.target.value);
                                                setOrderItems(newItems);
                                            }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-emerald-400 font-bold text-center outline-none" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-slate-500 mb-1 block">التكلفة (للقطعة)</label>
                                            <input type="number" min="0" value={item.cost || 0} onChange={e => {
                                                const newItems = [...orderItems];
                                                newItems[idx].cost = Number(e.target.value);
                                                setOrderItems(newItems);
                                            }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none" />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-xs text-slate-500 mb-1 block">الخصم (على الصنف)</label>
                                            <div className="flex gap-1">
                                                <input type="number" min="0" value={item.discountValue || 0} onChange={e => {
                                                    const newItems = [...orderItems];
                                                    newItems[idx].discountValue = Number(e.target.value);
                                                    setOrderItems(newItems);
                                                }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none" />
                                                <select value={item.discountType || 'amount'} onChange={e => {
                                                    const newItems = [...orderItems];
                                                    newItems[idx].discountType = e.target.value as 'amount' | 'percentage';
                                                    setOrderItems(newItems);
                                                }} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white outline-none">
                                                    <option value="amount">ج.م</option>
                                                    <option value="percentage">%</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="md:col-span-1">
                                            <button onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))} className="w-full p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all flex justify-center"><Trash2 size={18}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 bg-slate-900 dark:bg-black p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-center md:text-right">
                            <span className="text-slate-400 text-sm block mb-1">إجمالي الفاتورة الصافي</span>
                            <div className="text-3xl font-black text-emerald-400">
                                {orderItems.reduce((sum, item) => {
                                    let itemTotal = item.cost * item.quantity;
                                    if (item.discountValue) {
                                        if (item.discountType === 'percentage') {
                                            itemTotal -= (itemTotal * (item.discountValue / 100));
                                        } else {
                                            itemTotal -= (item.discountValue * item.quantity);
                                        }
                                    }
                                    return sum + itemTotal;
                                }, 0).toLocaleString()} ج.م
                            </div>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                           <button onClick={() => setShowOrderModal(false)} className="flex-1 md:flex-none px-8 py-3 text-slate-400 font-bold hover:text-white transition-all">إلغاء</button>
                           <button onClick={handleAddOrder} className="flex-1 md:flex-none px-12 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                               <Save size={20}/> {editingOrder ? 'تحديث الفاتورة' : 'تأكيد وحفظ الفاتورة'}
                           </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedSupplierForPayment && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold dark:text-white">تسجيل دفعة للمورد</h3>
                        <button onClick={() => setShowPaymentModal(false)} className="text-slate-400"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg mb-4">
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 block">مديونية المورد الحالية</span>
                            <span className="text-lg font-black dark:text-white">{selectedSupplierForPayment.balance?.toLocaleString()} ج.م</span>
                        </div>
                        
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">المبلغ المدفوع</label>
                            <input 
                                type="number" 
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-lg font-bold"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(Number(e.target.value))}
                            />
                        </div>
                        
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">ملاحظات (اختياري)</label>
                            <input 
                                type="text" 
                                placeholder="رقم التحويل أو الوثيقة..."
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                value={paymentNote}
                                onChange={e => setPaymentNote(e.target.value)}
                            />
                        </div>

                        <button onClick={handleRecordPayment} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                            <Save size={20}/> تأكيد الدفع وخصم المديونية
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SuppliersPage;