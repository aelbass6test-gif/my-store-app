import React, { useState, useMemo, useEffect } from 'react';
import { User, Store, StoreData, Employee, Permission, PERMISSIONS, Transaction, WithdrawRequest, Settings } from '../types';
import { Users, Store as StoreIcon, Activity, Search, ShieldAlert, LogIn, Ban, CheckCircle, Lock, Unlock, LayoutDashboard, TrendingUp, MessageSquare, Send, UserPlus, Clock, UserCog, XCircle, KeyRound, Check, X, Settings as SettingsIcon, ShoppingCart, Package, Wallet, Tag, AlertTriangle, Trash2, ShoppingBasket, Grid } from 'lucide-react';
import * as db from '../services/databaseService';
import { clearStoreData } from '../services/databaseService';

const FinancialRequestsTab: React.FC<{
    allStoresData: Record<string, StoreData>;
    setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
    users: User[];
}> = ({ allStoresData, setAllStoresData, users }) => {
    
    // Sort logic to get pending deposits and withdrawals
    const requests = useMemo(() => {
        let reqs: any[] = [];
        Object.entries(allStoresData).forEach(([storeId, storeData]) => {
            const owner = users.find(u => u.stores?.some(s => s.id === storeId));
            const storeInfo = owner?.stores?.find(s => s.id === storeId);
            
            storeData.wallet?.transactions?.forEach(t => {
                if (t.status === 'pending') {
                    // if it's a withdrawal, find the withdraw request to get bank details
                    let details = t.note || 'لا توجد تفاصيل';
                    if (t.type === 'سحب') {
                        const reqId = t.id.replace('W-', '');
                        const wReq = storeData.wallet?.withdrawRequests?.find(r => r?.id === reqId);
                        if (wReq) details = wReq.details || details;
                    }
                    reqs.push({
                        ...t,
                        storeId,
                        storeName: storeInfo?.name || 'غير معروف',
                        ownerName: owner?.fullName || 'غير معروف',
                        details
                    });
                }
            });
        });
        return reqs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allStoresData, users]);

    const handleAction = async (transaction: any, action: 'approve' | 'reject') => {
        const storeId = transaction.storeId;
        
        // Prepare updated store data
        let storeData = { ...allStoresData[storeId] };
        if (!storeData || !storeData.wallet) return;

        // update transaction
        const updatedTransactions = storeData.wallet.transactions.map(t => {
             if (t.id === transaction.id) {
                 return { ...t, status: action === 'approve' ? 'completed' : 'cancelled' };
             }
             return t;
        });

        // if withdrawal, update withdraw request too
        let updatedWithdrawRequests = storeData.wallet.withdrawRequests || [];
        if (transaction.type === 'سحب') {
             const reqId = transaction.id.replace('W-', '');
             updatedWithdrawRequests = updatedWithdrawRequests.map(r => {
                 if (r.id === reqId) {
                     return { ...r, status: action === 'approve' ? 'accepted' : 'rejected' };
                 }
                 return r;
             });
        }

        let newBalance = storeData.wallet.balance || 0;
        if (transaction.type === 'إيداع') {
             if (action === 'approve') newBalance += transaction.amount;
        } else if (transaction.type === 'سحب') {
             if (action === 'reject') newBalance += transaction.amount;
        }

        const newStoreData = {
            ...storeData,
            wallet: {
                ...storeData.wallet,
                transactions: updatedTransactions as Transaction[],
                withdrawRequests: updatedWithdrawRequests as WithdrawRequest[],
                balance: newBalance
            }
        };

        setAllStoresData(prev => ({
            ...prev,
            [storeId]: newStoreData
        }));

        try {
            await db.saveStoreData({ id: storeId, name: storeData.settings?.storeName || 'المتجر' }, newStoreData);
        } catch (e) {
            alert('حدث خطأ أثناء الحفظ.');
        }
    };

    if (requests.length === 0) {
        return <div className="text-center py-10 text-slate-500 font-bold">لا توجد طلبات مالية معلقة.</div>;
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300 relative overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                        <th className="p-4 rounded-r-xl">النوع</th>
                        <th className="p-4">المتجر / المالك</th>
                        <th className="p-4">المبلغ</th>
                        <th className="p-4">التفاصيل</th>
                        <th className="p-4">التاريخ</th>
                        <th className="p-4 rounded-l-xl">إجراء</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {requests.map((req, idx) => (
                        <tr key={`${req.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${req.type === 'إيداع' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {req.type}
                                </span>
                            </td>
                            <td className="p-4">
                                <p className="font-bold">{req.storeName}</p>
                                <p className="text-xs text-slate-500">{req.ownerName}</p>
                            </td>
                            <td className="p-4 font-black">
                                {req.amount.toLocaleString()} ج.م
                            </td>
                            <td className="p-4 max-w-xs truncate" title={req.details}>
                                {req.details}
                            </td>
                            <td className="p-4 text-xs text-slate-500">
                                {new Date(req.date).toLocaleString('ar-EG')}
                            </td>
                            <td className="p-4 flex gap-2">
                                <button onClick={() => handleAction(req, 'approve')} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors tooltip" title="موافقة">
                                    <Check size={16}/>
                                </button>
                                <button onClick={() => handleAction(req, 'reject')} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors tooltip" title="رفض">
                                    <X size={16}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface AdminPageProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  allStoresData: Record<string, StoreData>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  onImpersonate: (user: User) => void;
  currentUser: User;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const PERMISSION_GROUPS: { title: string; permissions: { key: Permission, label: string }[] }[] = [
  { title: 'الأوردرات والتحكم', permissions: [ { key: 'ORDERS_VIEW', label: 'عرض الأوردرات فقط' }, { key: 'ORDERS_MANAGE', label: 'إدارة كاملة للأوردرات (إضافة، تعديل، حذف)' } ] },
  { title: 'المنتجات والمخزون', permissions: [ { key: 'PRODUCTS_VIEW', label: 'عرض المنتجات فقط' }, { key: 'PRODUCTS_MANAGE', label: 'إدارة كاملة للمنتجات' } ] },
  { title: 'البيانات المالية', permissions: [ { key: 'DASHBOARD_VIEW', label: 'عرض لوحة التحكم والإحصائيات' }, { key: 'WALLET_VIEW', label: 'عرض المحفظة والعمليات' }, { key: 'WALLET_MANAGE', label: 'إجراء عمليات يدوية بالمحفظة' } ] },
  { title: 'إعدادات المتجر', permissions: [ { key: 'SETTINGS_VIEW', label: 'عرض الإعدادات فقط' }, { key: 'SETTINGS_MANAGE', label: 'تعديل كافة إعدادات المتجر' } ] },
];

const UserPermissionsModal: React.FC<{
    user: User;
    onClose: () => void;
    allStoresData: Record<string, StoreData>;
    setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
    // FIX: Add 'users' to the props interface to match the props passed to the component.
    users: User[];
}> = ({ user, onClose, allStoresData, setAllStoresData, users }) => {

    const [editingEmployee, setEditingEmployee] = useState<{ store: Store, employee: Employee } | null>(null);

    const handlePermissionChange = (permission: Permission, isChecked: boolean) => {
        if (!editingEmployee) return;

        const { store, employee } = editingEmployee;
        const newPermissions = isChecked
            ? [...employee.permissions, permission]
            : employee.permissions.filter(p => p !== permission);
        
        const updatedEmployee = { ...employee, permissions: newPermissions };
        setEditingEmployee({ store, employee: updatedEmployee });

        setAllStoresData(prevData => {
            const storeData = prevData[store.id];
            if (!storeData) return prevData;
            
            return {
                ...prevData,
                [store.id]: {
                    ...storeData,
                    settings: {
                        ...storeData.settings,
                        employees: storeData.settings.employees.map(e => e.id === employee.id ? updatedEmployee : e)
                    }
                }
            };
        });
    };
    
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] text-right border border-slate-300 dark:border-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-black dark:text-white flex items-center gap-3">
                        <UserCog className="text-purple-600" /> إدارة صلاحيات {user.fullName}
                    </h3>
                    <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Stores & Employees Column */}
                    <div className="space-y-4">
                        <h4 className="font-bold">متاجر المستخدم</h4>
                        {(user.stores || []).length > 0 ? (user.stores || []).map(store => (
                            <div key={store.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                                <h5 className="font-bold text-lg text-slate-800 dark:text-white">{store.name}</h5>
                                <div className="mt-2 space-y-2">
                                    {(allStoresData[store.id]?.settings.employees || []).map(employee => (
                                        <button 
                                            key={employee.id}
                                            onClick={() => setEditingEmployee({ store, employee })}
                                            className={`w-full text-right p-3 rounded-lg flex items-center gap-3 transition-colors ${editingEmployee?.employee.id === employee.id ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">{employee.name.substring(0,2)}</div>
                                            <div>
                                                <p className="font-bold text-sm">{employee.name}</p>
                                                <p className="text-xs text-slate-500">{employee.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )) : <p className="text-slate-500">هذا المستخدم لا يملك أي متاجر.</p>}
                    </div>

                    {/* Permissions Column */}
                    <div className={`p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-all ${!editingEmployee ? 'opacity-50' : ''}`}>
                       {editingEmployee ? (
                           <div>
                               <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-4">صلاحيات {editingEmployee.employee.name}</h4>
                               <div className="grid grid-cols-1 gap-6">
                                  {PERMISSION_GROUPS.map(group => (
                                      <div key={group.title}>
                                          <h5 className="font-bold text-purple-800 dark:text-purple-400 mb-2">{group.title}</h5>
                                          <div className="space-y-2">
                                              {group.permissions.map(perm => (
                                                  <label key={perm.key} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 cursor-pointer">
                                                      <input type="checkbox" checked={editingEmployee.employee.permissions.includes(perm.key)} onChange={e => handlePermissionChange(perm.key, e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500"/>
                                                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{perm.label}</span>
                                                  </label>
                                              ))}
                                          </div>
                                      </div>
                                  ))}
                               </div>
                           </div>
                       ) : (
                           <div className="h-full flex flex-col items-center justify-center text-slate-400">
                               <UserCog size={40} className="mb-2"/>
                               <p className="font-bold">اختر موظفاً لعرض وتعديل صلاحياته.</p>
                           </div>
                       )}
                    </div>
                </div>
                 <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-8 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-black">إغلاق</button>
                </div>
            </div>
        </div>
    );
};


const AdminPage: React.FC<AdminPageProps> = ({ users, setUsers, allStoresData, setAllStoresData, onImpersonate, currentUser, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'stores' | 'financial' | 'fee_settings' | 'danger_zone'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [managingUser, setManagingUser] = useState<User | null>(null);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let successfulOrders = 0;
    
    Object.values(allStoresData).forEach((storeData: any) => {
        totalOrders += storeData.orders.length;
        storeData.orders.forEach((order: any) => {
            if (order.status === 'تم_التحصيل') {
                totalRevenue += (order.productPrice + order.shippingFee) - (order.discount || 0);
                successfulOrders++;
            }
        });
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const newUsersThisMonth = users.filter(u => u.joinDate && new Date(u.joinDate) >= firstDayOfMonth).length;
    const newStoresThisMonth = users.reduce((acc, user) => {
        return acc + (user.stores?.filter(s => new Date(s.creationDate) >= firstDayOfMonth).length || 0);
    }, 0);

    return { 
        totalUsers: users.length, 
        totalStores: users.reduce((acc, user) => acc + (user.stores?.length || 0), 0), 
        activeUsers: users.filter(u => !u.isBanned).length,
        totalRevenue,
        averageOrderValue: successfulOrders > 0 ? totalRevenue / successfulOrders : 0,
        newUsersThisMonth,
        newStoresThisMonth
    };
  }, [users, allStoresData]);

  const activityFeed = useMemo(() => {
      const activities: { type: string; data: any; date: Date }[] = [];
      users.forEach(user => {
          if (user.joinDate) {
              activities.push({ type: 'new_user', data: user, date: new Date(user.joinDate) });
          }
          user.stores?.forEach(store => {
              activities.push({ type: 'new_store', data: { store, owner: user }, date: new Date(store.creationDate) });
          });
      });
      return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [users]);


  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      !user.isAdmin && 
      (user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm))
    );
  }, [users, searchTerm]);

  const allStoresList = useMemo(() => {
    let stores: { store: Store, owner: User, totalOrders: number, totalRevenue: number }[] = [];
    users.forEach(user => {
        if(user.stores) {
            user.stores.forEach(store => {
                const storeData = allStoresData[store.id];
                const totalOrders = storeData?.orders?.length || 0;
                const totalRevenue = storeData?.orders?.filter((o: any) => o.status === 'تم_التحصيل').reduce((sum: number, o: any) => sum + (o.productPrice + o.shippingFee - (o.discount || 0)), 0) || 0;
                stores.push({ store, owner: user, totalOrders, totalRevenue });
            });
        }
    });
    return stores.filter(s => s.store.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [users, searchTerm, allStoresData]);

  const toggleUserBan = (phone: string) => {
    if(!window.confirm("هل أنت متأكد من تغيير حالة حظر هذا المستخدم؟")) return;
    setUsers(prev => prev.map(u => u.phone === phone ? { ...u, isBanned: !u.isBanned } : u));
  };

  const handleSendAnnouncement = () => {
    if(!announcement.trim()) return;
    alert(`تم إرسال الإعلان التالي لجميع المستخدمين:\n\n"${announcement}"`);
    setAnnouncement('');
  };
  
  const timeSince = (date: Date) => {
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      let interval = seconds / 31536000;
      if (interval > 1) return `منذ ${Math.floor(interval)} سنة`;
      interval = seconds / 2592000;
      if (interval > 1) return `منذ ${Math.floor(interval)} شهر`;
      interval = seconds / 86400;
      if (interval > 1) return `منذ ${Math.floor(interval)} يوم`;
      interval = seconds / 3600;
      if (interval > 1) return `منذ ${Math.floor(interval)} ساعة`;
      interval = seconds / 60;
      if (interval > 1) return `منذ ${Math.floor(interval)} دقيقة`;
      return "الآن";
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6 font-cairo text-right" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <ShieldAlert className="text-red-600" size={32} />
                لوحة التحكم المركزية
            </h1>
            <p className="text-slate-500 mt-1 font-bold">مرحباً بك، المدير العام {currentUser.fullName}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <TabButton label="نظرة عامة" icon={<LayoutDashboard size={20}/>} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <TabButton label="إدارة المستخدمين" icon={<Users size={20}/>} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <TabButton label="إدارة المتاجر" icon={<StoreIcon size={20}/>} active={activeTab === 'stores'} onClick={() => setActiveTab('stores')} />
        <TabButton label="الطلبات المالية" icon={<TrendingUp size={20}/>} active={activeTab === 'financial'} onClick={() => setActiveTab('financial')} />
        <TabButton label="إعدادات الرسوم" icon={<SettingsIcon size={20}/>} active={activeTab === 'fee_settings'} onClick={() => setActiveTab('fee_settings')} />
        <TabButton label="منطقة الخطر" icon={<ShieldAlert size={20}/>} active={activeTab === 'danger_zone'} onClick={() => setActiveTab('danger_zone')} />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[500px] p-6">
        {activeTab === 'danger_zone' && (
          <DangerZone stores={users.flatMap(u => u.stores || [])} />
        )}
        {activeTab === 'financial' && (
            <FinancialRequestsTab 
                allStoresData={allStoresData} 
                setAllStoresData={setAllStoresData}
                users={users}
            />
        )}
        
        {activeTab === 'fee_settings' && (
          <div className="space-y-6 animate-in fade-in duration-300 p-6">
            <h2 className="text-xl font-black mb-6">إعدادات رسوم السحب (عام)</h2>
            <div className="space-y-6">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">رسوم عمليات السحب</p>
                
                <div className="space-y-4">
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex justify-between items-center flex-row-reverse">
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">السحب العادي</p>
                            <div className="flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                <button 
                                    onClick={() => setSettings(prev => ({ ...prev, withdrawalFeeType: 'flat' }))}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.withdrawalFeeType === 'flat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >مبلغ</button>
                                <button 
                                    onClick={() => setSettings(prev => ({ ...prev, withdrawalFeeType: 'percent' }))}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.withdrawalFeeType === 'percent' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >نسبة %</button>
                            </div>
                        </div>
                        <div className="text-right">
                            <input 
                                type="number"
                                value={settings.withdrawalFeeType === 'percent' ? (settings.withdrawalFeePercent || 0) : (settings.withdrawalFlatFee || 0)}
                                onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (settings.withdrawalFeeType === 'percent') setSettings(prev => ({ ...prev, withdrawalFeePercent: val }));
                                    else setSettings(prev => ({ ...prev, withdrawalFlatFee: val }));
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-right text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                                placeholder={settings.withdrawalFeeType === 'percent' ? "أدخل النسبة المئوية" : "أدخل المبلغ الثابت"}
                            />
                        </div>
                    </div>

                    <div className="p-5 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-3xl border border-indigo-100/50 dark:border-indigo-500/10 space-y-4">
                        <div className="flex justify-between items-center flex-row-reverse">
                            <div className="flex items-center gap-2 flex-row-reverse">
                                <p className="text-xs font-black text-indigo-900 dark:text-indigo-300">السحب الفوري (Express)</p>
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"/>
                            </div>
                            <div className="flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                <button 
                                    onClick={() => setSettings(prev => ({ ...prev, sameDayWithdrawalFeeType: 'flat' }))}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.sameDayWithdrawalFeeType === 'flat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >مبلغ</button>
                                <button 
                                    onClick={() => setSettings(prev => ({ ...prev, sameDayWithdrawalFeeType: 'percent' }))}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.sameDayWithdrawalFeeType === 'percent' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >نسبة %</button>
                            </div>
                        </div>
                        <div className="text-right">
                            <input 
                                type="number"
                                value={settings.sameDayWithdrawalFeeType === 'flat' ? (settings.sameDayWithdrawalFlatFee || 0) : (settings.sameDayWithdrawalFeePercent || 0)}
                                onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (settings.sameDayWithdrawalFeeType === 'flat') setSettings(prev => ({ ...prev, sameDayWithdrawalFlatFee: val }));
                                    else setSettings(prev => ({ ...prev, sameDayWithdrawalFeePercent: val }));
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-right text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                                placeholder={settings.sameDayWithdrawalFeeType === 'percent' ? "أدخل النسبة المئوية" : "أدخل المبلغ الثابت"}
                            />
                        </div>
                        <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl">
                            <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed text-right">
                                ملاحظة: للسحب الفوري بالنسبة، يطبق حد أدنى ٢٥ ج.م للمبالغ أقل من ٢٥٠٠ ج.م.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}
        
        {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <StatCard title="إجمالي الإيرادات" value={`${stats.totalRevenue.toLocaleString('ar-EG')} ج.م`} icon={<TrendingUp className="text-emerald-500"/>} />
                       <StatCard title="متوسط قيمة الطلب" value={`${stats.averageOrderValue.toFixed(0)} ج.م`} icon={<Activity className="text-purple-500"/>} />
                       <StatCard title="مستخدمون جدد هذا الشهر" value={stats.newUsersThisMonth} icon={<Users className="text-blue-500"/>} />
                       <StatCard title="متاجر جديدة هذا الشهر" value={stats.newStoresThisMonth} icon={<StoreIcon className="text-pink-500"/>} />
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-lg mb-4 text-slate-700 dark:text-slate-200">الإجراءات السريعة</h3>
                        <div className="space-y-3">
                           <label className="text-sm font-bold flex items-center gap-2"><MessageSquare size={16}/> إعلان عام للمنصة</label>
                           <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} placeholder="اكتب رسالتك لجميع المستخدمين هنا..." className="w-full h-20 p-3 bg-white dark:bg-slate-800 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"></textarea>
                           <button onClick={handleSendAnnouncement} className="w-full py-2 bg-red-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"><Send size={16}/> إرسال الإعلان</button>
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-lg mb-4 text-slate-700 dark:text-slate-200">آخر الأنشطة</h3>
                    <div className="space-y-4">
                       {activityFeed.map((act, i) => (
                           <div key={i} className="flex items-start gap-3">
                               <div className="p-2 bg-white dark:bg-slate-700 rounded-full mt-1 border dark:border-slate-600">
                                   {act.type === 'new_user' ? <UserPlus size={16} className="text-blue-500"/> : <StoreIcon size={16} className="text-emerald-500"/>}
                               </div>
                               <div>
                                   <p className="text-sm text-slate-800 dark:text-slate-200">
                                       {act.type === 'new_user' ? <>انضمام مستخدم جديد: <span className="font-bold">{act.data.fullName}</span></> : <>متجر جديد <span className="font-bold">{act.data.store.name}</span> بواسطة <span className="font-bold">{act.data.owner.fullName}</span></>}
                                   </p>
                                   <p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {timeSince(act.date)}</p>
                               </div>
                           </div>
                       ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="بحث عن مستخدم..." className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                <div className="overflow-x-auto"><table className="w-full text-right"><thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs uppercase"><tr><th className="p-4 rounded-tr-xl">المستخدم</th><th className="p-4">إجمالي الإيرادات (LTV)</th><th className="p-4 text-center">المتاجر</th><th className="p-4 text-center">الحالة</th><th className="p-4 rounded-tl-xl text-left">إجراءات</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredUsers.map(user => {
                    const ltv = user.stores?.reduce((total, store) => {
                        const storeData = allStoresData[store.id];
                        if (!storeData) return total;
                        return total + (storeData.orders?.filter((o: any) => o.status === 'تم_التحصيل').reduce((sum: number, o: any) => sum + (o.productPrice + o.shippingFee - (o.discount || 0)), 0) || 0);
                    }, 0) || 0;
                    return (
                    <tr key={user.phone} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4"><div className="font-bold text-slate-800 dark:text-white">{user.fullName}</div><div className="text-xs text-slate-400">{user.email}</div></td>
                        <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">{ltv.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-4 text-center font-black text-lg text-slate-700 dark:text-slate-200">{user.stores?.length || 0}</td>
                        <td className="p-4 text-center">{user.isBanned ? (<span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold"><Ban size={12}/> محظور</span>) : (<span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold"><CheckCircle size={12}/> نشط</span>)}</td>
                        <td className="p-4"><div className="flex justify-end gap-2"><button onClick={() => setManagingUser(user)} title="إدارة الصلاحيات" className="p-2 rounded-lg text-white bg-purple-500 hover:bg-purple-600"><UserCog size={16} /></button><button onClick={() => onImpersonate(user)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"><LogIn size={14} /> دخول كـ</button><button onClick={() => toggleUserBan(user.phone)} className={`p-2 rounded-lg text-white ${user.isBanned ? 'bg-emerald-500' : 'bg-red-500'}`}>{user.isBanned ? <Unlock size={16} /> : <Lock size={16} />}</button></div></td>
                    </tr>
                )})}</tbody></table></div>
            </div>
        )}

        {activeTab === 'stores' && (
             <div className="space-y-6 animate-in fade-in duration-300">
                <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="بحث عن متجر..." className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{allStoresList.map(({ store, owner, totalOrders, totalRevenue }) => (
                    <div key={store.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all bg-slate-50 dark:bg-slate-800/20 space-y-3">
                        <div className="flex justify-between items-start"><h4 className="font-black text-lg text-slate-800 dark:text-white">{store.name}</h4><button onClick={() => onImpersonate(owner)} className="text-blue-600 hover:underline text-xs font-bold">إدارة</button></div>
                        <p className="text-sm text-slate-500 font-mono dir-ltr text-right truncate">{store.url}</p>
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                           <div className="text-xs"><span className="block text-slate-400 font-bold mb-1">إجمالي الطلبات</span><span className="font-black text-slate-700 dark:text-slate-300 text-base">{totalOrders}</span></div>
                           <div className="text-xs"><span className="block text-slate-400 font-bold mb-1">إجمالي الإيرادات</span><span className="font-black text-emerald-600 dark:text-emerald-400 text-base">{totalRevenue.toLocaleString('ar-EG')} ج.م</span></div>
                        </div>
                    </div>))}
                </div>
             </div>
        )}
      </div>

      {managingUser && (
        <UserPermissionsModal
            user={managingUser}
            onClose={() => setManagingUser(null)}
            allStoresData={allStoresData}
            setAllStoresData={setAllStoresData}
            users={users}
        />
      )}
    </div>
  );
};


const DangerZone = ({ stores }: { stores: Store[] }) => {
    const [selectedStore, setSelectedStore] = useState<Store | undefined>(stores.length > 0 ? stores[0] : undefined);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    
    if (!selectedStore) {
        return <div className="text-center p-8 bg-slate-50 rounded-2xl">لا توجد متاجر متاحة.</div>;
    }

    const isConfirmationMatch = confirmationText === selectedStore.name;

    const availableTargets = [
        { id: 'orders', label: 'الطلبات والسلات', icon: <ShoppingCart size={16}/> },
        { id: 'products', label: 'المنتجات والمخزون', icon: <Package size={16}/> },
        { id: 'customers', label: 'قاعدة العملاء', icon: <Users size={16}/> },
        { id: 'wallet', label: 'المعاملات المالية', icon: <Wallet size={16}/> },
        { id: 'activity', label: 'سجل النشاط', icon: <Activity size={16}/> },
        { id: 'coupons', label: 'الكوبونات', icon: <Tag size={16}/> },
        { id: 'reviews', label: 'التقييمات', icon: <MessageSquare size={16}/> },
        { id: 'abandoned_carts', label: 'السلات المتروكة', icon: <ShoppingBasket size={16}/> },
        { id: 'shipping', label: 'إعدادات الشحن', icon: <Package size={16}/> },
        { id: 'pages', label: 'الصفحات المخصصة', icon: <LayoutDashboard size={16}/> },
        { id: 'suppliers', label: 'الموردين', icon: <UserPlus size={16}/> },
        { id: 'supply_orders', label: 'طلبات التوريد', icon: <TrendingUp size={16}/> },
        { id: 'global_options', label: 'خيارات عامة', icon: <SettingsIcon size={16}/> },
        { id: 'payment_methods', label: 'طرق الدفع', icon: <Wallet size={16}/> },
        { id: 'collections', label: 'التصنيفات', icon: <Grid size={16}/> },
        { id: 'employees', label: 'الموظفين', icon: <UserCog size={16}/> },
        { id: 'partner_withdrawals', label: 'سحوبات الشركاء والمحفظة', icon: <Wallet size={16}/> },
    ];

    const toggleTarget = (id: string) => {
        setSelectedTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedTargets.length === availableTargets.length) {
            setSelectedTargets([]);
        } else {
            setSelectedTargets(availableTargets.map(t => t.id));
        }
    };

    const handleClearData = async () => {
        if (!isConfirmationMatch) {
            setError('اسم المتجر غير متطابق.');
            return;
        }
        
        if (selectedTargets.length === 0) {
            setError('يجب اختيار عنصر واحد على الأقل للحذف.');
            return;
        }

        setIsDeleting(true);
        const storeId = selectedStore.id; // Corrected to use selectedStore.id
        
        if (storeId) {
            const result = await clearStoreData(storeId, selectedTargets);
            if (result.success) {
                alert('تم حذف البيانات المحددة بنجاح.');
                setShowConfirm(false);
                setIsDeleting(false);
            } else {
                setError(result.error || 'حدث خطأ أثناء المسح');
                setIsDeleting(false);
            }
        }
    };

    return (
        <div className="bg-red-50 dark:bg-red-950/20 p-8 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm mt-8">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><AlertTriangle size={24}/></div>
                <div>
                    <h2 className="text-xl font-black">منطقة الخطر (إدارة الادمن)</h2>
                    <p className="text-xs text-red-500 dark:text-red-400">إجراءات حساسة لا يمكن التراجع عنها.</p>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اختر المتجر:</label>
                <select 
                    className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 outline-none"
                    value={selectedStore.id}
                    onChange={(e) => setSelectedStore(stores.find(s => s.id === e.target.value) || stores[0])}
                >
                    {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-slate-600 dark:text-slate-300 text-sm">
                    <p className="font-bold">تفريغ قاعدة البيانات (تصفير المتجر)</p>
                    <p className="mt-1">يمكنك اختيار حذف الطلبات، المنتجات، أو العملاء بشكل منفصل أو تصفير المتجر بالكامل.</p>
                </div>
                <button 
                    onClick={() => { setShowConfirm(true); setConfirmationText(''); setError(''); setSelectedTargets([]); }} 
                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-red-700 active:scale-95 transition-all whitespace-nowrap"
                >
                    <Trash2 size={18}/> تصفير البيانات
                </button>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 text-center border border-slate-300 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Trash2 size={20} className="text-red-600"/>
                                اختر ما تريد حذفه
                            </h3>
                            <button onClick={() => setShowConfirm(false)}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                        </div>

                        <div className="mb-6 space-y-3">
                            <button onClick={toggleAll} className="text-xs font-bold text-blue-600 hover:underline mb-2 block w-full text-right">
                                {selectedTargets.length === availableTargets.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                            </button>
                            <div className="grid grid-cols-2 gap-3 text-right">
                                {availableTargets.map(target => (
                                    <div 
                                        key={target.id}
                                        onClick={() => toggleTarget(target.id)}
                                        className={`cursor-pointer p-3 rounded-xl border flex items-center gap-2 transition-all ${selectedTargets.includes(target.id) ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedTargets.includes(target.id) ? 'bg-red-500 border-red-500 text-white' : 'border-slate-400'}`}>
                                            {selectedTargets.includes(target.id) && <Check size={12}/>}
                                        </div>
                                        <div className="text-xs font-bold flex items-center gap-1.5">
                                            {target.icon} {target.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                            <p className="text-slate-500 text-xs mb-3 font-bold">للتأكيد، يرجى كتابة اسم متجرك: <span className="font-black text-red-500">{selectedStore?.name}</span></p>
                            <input 
                                type="text" 
                                className="w-full text-center text-lg font-bold p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="اكتب اسم المتجر هنا"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        {error && <p className="text-red-500 text-xs font-bold mb-4 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}

                        <div className="flex gap-2">
                            <button 
                                onClick={handleClearData} 
                                disabled={isDeleting || !isConfirmationMatch}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? 'جاري المسح...' : `أنا متأكد، احذف (${selectedTargets.length})`}
                            </button>
                            <button 
                                onClick={() => { setShowConfirm(false); setConfirmationText(''); setError(''); }} 
                                className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TabButton = ({ label, icon, active, onClick }: { label: string, icon: any, active: boolean, onClick: () => void }) => (<button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${active ? 'bg-slate-800 text-white shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{icon}<span>{label}</span></button>);
const StatCard = ({ title, value, icon }: { title: string, value: any, icon: any }) => (<div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"><div className="text-right"> <p className="text-slate-500 font-bold mb-1">{title}</p><p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p></div><div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full">{icon}</div></div>);

interface EmployeeModalProps { isOpen: boolean; onClose: () => void; onSave: (employee: Employee) => void; employee: Employee | null; }
const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, onSave, employee }) => {
  const [formData, setFormData] = useState({ name: '', email: '', permissions: [] as Permission[] });
  
  useEffect(() => {
    if (employee) { setFormData({ name: employee.name, email: employee.email, permissions: employee.permissions }); } 
    else { setFormData({ name: '', email: '', permissions: [] }); }
  }, [employee, isOpen]);

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    setFormData(prev => ({ ...prev, permissions: checked ? [...prev.permissions, permission] : prev.permissions.filter(p => p !== permission) }));
  };
  
  const handleSelectAll = (checked: boolean) => {
    // FIX: Cast Object.keys to Permission[] to match the expected type.
    setFormData(prev => ({ ...prev, permissions: checked ? Object.keys(PERMISSIONS) as Permission[] : [] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...(employee as Employee), ...formData });
  };
  
  if (!isOpen) return null;

  const allPermissionsSelected = formData.permissions.length === Object.keys(PERMISSIONS).length;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] text-right border border-slate-300 dark:border-slate-800">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-black dark:text-white flex items-center gap-3"><UserCog className="text-purple-600" /> تعديل صلاحيات المستخدم</h3>
          <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-400">اسم المستخدم</label><input type="text" readOnly value={formData.name} className="mt-2 w-full px-4 py-3 bg-slate-100" /></div>
          </div>
        </form>
      </div>
    </div>
  );
};
export default AdminPage;