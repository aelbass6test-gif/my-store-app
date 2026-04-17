import React, { useState } from 'react';
import { Settings, Supplier, SupplyOrder, Transaction } from '../types';
import { UserPlus, Truck, Save, Plus, Package, Calendar, DollarSign, User } from 'lucide-react';

interface SuppliersPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setWallet: React.Dispatch<React.SetStateAction<any>>;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ settings, setSettings, setWallet }) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('orders');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  
  // New Supplier State
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ name: '', phone: '' });
  
  // New Order State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string, quantity: number, cost: number }[]>([]);

  const handleAddSupplier = () => {
      if(!newSupplier.name) return;
      const supplier: Supplier = {
          id: Date.now().toString(),
          name: newSupplier.name!,
          phone: newSupplier.phone || '',
          address: newSupplier.address || '',
          notes: newSupplier.notes || ''
      };
      setSettings(prev => ({...prev, suppliers: [...(prev.suppliers || []), supplier]}));
      setShowSupplierModal(false);
      setNewSupplier({ name: '', phone: '' });
  };

  const handleAddOrder = () => {
      if(!selectedSupplierId || orderItems.length === 0) return;
      
      const totalCost = orderItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
      const supplier = settings.suppliers.find(s => s.id === selectedSupplierId);

      const order: SupplyOrder = {
          id: Date.now().toString(),
          supplierId: selectedSupplierId,
          date: new Date().toISOString(),
          items: orderItems,
          totalCost,
          status: 'completed'
      };

      // 1. Update Inventory
      const updatedProducts = settings.products.map(p => {
          const item = orderItems.find(i => i.productId === p.id);
          if (item) {
              return { ...p, stockQuantity: p.stockQuantity + item.quantity, costPrice: item.cost }; // Update cost to latest purchase price
          }
          return p;
      });

      // 2. Deduct from Wallet
      const transaction: Transaction = {
          id: `supply_${order.id}`,
          type: 'سحب',
          amount: totalCost,
          date: new Date().toISOString(),
          note: `شراء بضاعة من المورد ${supplier?.name} (فاتورة #${order.id})`,
          category: 'inventory_purchase'
      };

      setSettings(prev => ({
          ...prev,
          products: updatedProducts,
          supplyOrders: [...(prev.supplyOrders || []), order]
      }));
      setWallet((prev: any) => ({ ...prev, transactions: [transaction, ...prev.transactions] }));

      setShowOrderModal(false);
      setOrderItems([]);
      setSelectedSupplierId('');
  };

  const addItemToOrder = () => {
      if (settings.products.length > 0) {
          setOrderItems([...orderItems, { productId: settings.products[0].id, quantity: 1, cost: settings.products[0].costPrice }]);
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
                <button onClick={() => setShowOrderModal(true)} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all font-bold">
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
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1"><Calendar size={12} className="inline ml-1"/> {new Date(order.date).toLocaleDateString('ar-EG')}</p>
                                </div>
                                <div className="text-left">
                                    <div className="font-black text-lg text-emerald-600">{order.totalCost.toLocaleString()} ج.م</div>
                                    <div className="text-xs text-slate-500">{order.items.length} أصناف</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {activeTab === 'suppliers' && (
            <div className="space-y-4">
                <button onClick={() => setShowSupplierModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"><UserPlus size={20}/> إضافة مورد</button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(settings.suppliers || []).map(supplier => (
                        <div key={supplier.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-lg dark:text-white">{supplier.name}</h3>
                            <p className="text-slate-500 text-sm">{supplier.phone}</p>
                            {supplier.address && <p className="text-slate-400 text-xs mt-2">{supplier.address}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Supplier Modal */}
        {showSupplierModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-4 dark:text-white">إضافة مورد جديد</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="اسم المورد" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
                        <input type="text" placeholder="رقم الهاتف" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                        <input type="text" placeholder="العنوان" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.address} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} />
                        <button onClick={handleAddSupplier} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold mt-2">حفظ</button>
                        <button onClick={() => setShowSupplierModal(false)} className="w-full py-3 text-slate-500 font-bold">إلغاء</button>
                    </div>
                </div>
            </div>
        )}

        {/* Order Modal */}
        {showOrderModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <h3 className="text-xl font-bold mb-4 dark:text-white">تسجيل فاتورة شراء (توريد)</h3>
                    <div className="space-y-4">
                        <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <option value="">اختر المورد...</option>
                            {(settings.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        
                        <div className="border-t dark:border-slate-800 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold dark:text-white">الأصناف</h4>
                                <button onClick={addItemToOrder} className="text-sm bg-blue-100 text-blue-600 px-3 py-1 rounded-lg font-bold">+ صنف</button>
                            </div>
                            {orderItems.map((item, idx) => (
                                <div key={idx} className="flex gap-2 mb-2">
                                    <select value={item.productId} onChange={e => {
                                        const newItems = [...orderItems];
                                        newItems[idx].productId = e.target.value;
                                        setOrderItems(newItems);
                                    }} className="flex-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">
                                        {settings.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <input type="number" placeholder="الكمية" value={item.quantity} onChange={e => {
                                        const newItems = [...orderItems];
                                        newItems[idx].quantity = Number(e.target.value);
                                        setOrderItems(newItems);
                                    }} className="w-20 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm" />
                                    <input type="number" placeholder="سعر الشراء (للقطعة)" value={item.cost} onChange={e => {
                                        const newItems = [...orderItems];
                                        newItems[idx].cost = Number(e.target.value);
                                        setOrderItems(newItems);
                                    }} className="w-24 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm" />
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-emerald-700 dark:text-emerald-400 font-bold">
                            <span>الإجمالي سيخصم من المحفظة:</span>
                            <span>{orderItems.reduce((sum, i) => sum + (i.cost * i.quantity), 0).toLocaleString()} ج.م</span>
                        </div>

                        <button onClick={handleAddOrder} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold mt-2">تأكيد الفاتورة وإضافة المخزون</button>
                        <button onClick={() => setShowOrderModal(false)} className="w-full py-3 text-slate-500 font-bold">إلغاء</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SuppliersPage;