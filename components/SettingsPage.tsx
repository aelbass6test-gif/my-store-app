
import React, { useState } from 'react';
import { Settings, PlatformIntegration, Store } from '../types';
import { Link2, CheckCircle2, Database, RefreshCw, AlertTriangle, Check, Trash2, XCircle, Lock, ShoppingCart, Package, Users, Wallet, Activity, Tag } from 'lucide-react';
import { clearStoreData } from '../services/databaseService';

interface SettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onManualSave?: () => Promise<{ success: boolean, error?: string } | void>;
  activeStore?: Store;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, setSettings, onManualSave, activeStore }) => {
  
  const handleIntegrationSave = (integration: PlatformIntegration) => {
    setSettings(prev => ({ ...prev, integration }));
  };
  
  const togglePlatformIntegration = () => {
    setSettings(prevSettings => {
      const isEnabling = !prevSettings.enablePlatformIntegration;
      if (isEnabling) {
        return { ...prevSettings, enablePlatformIntegration: true };
      } else {
        return { 
          ...prevSettings, 
          enablePlatformIntegration: false,
          integration: { platform: 'none', apiKey: '' }
        };
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-right pb-12 px-4">
      {onManualSave && (
          <DatabaseManagementCard onSync={onManualSave} />
      )}
      <PlatformIntegrationCard 
        integration={settings.integration} 
        onSave={handleIntegrationSave} 
        isEnabled={settings.enablePlatformIntegration}
        onToggle={togglePlatformIntegration}
      />
      <DangerZone activeStore={activeStore} />
    </div>
  );
};

const DatabaseManagementCard: React.FC<{ onSync: () => Promise<{ success: boolean, error?: string } | void> }> = ({ onSync }) => {
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSyncClick = async () => {
        setStatus('syncing');
        try {
            const result = await onSync();
            if (result && result.success === false) {
                setStatus('error');
                setErrorMessage(result.error || 'حدث خطأ غير معروف');
            } else {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (e: any) {
            setStatus('error');
            setErrorMessage(e.message || 'فشل الاتصال بقاعدة البيانات');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"><Database size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">قواعد البيانات</h2>
                    <p className="text-xs text-slate-500">إدارة تخزين البيانات وتحديث الجداول.</p>
                </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 gap-4">
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">تحديث هيكل البيانات (Migration)</h3>
                    <p className="text-sm text-slate-500 mt-1">نقل البيانات من النظام القديم (JSON) إلى الجداول العلائقية الجديدة (SQL).</p>
                </div>
                <button 
                    onClick={handleSyncClick} 
                    disabled={status === 'syncing' || status === 'success'}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed ${
                        status === 'success' ? 'bg-green-500 text-white' : 
                        status === 'error' ? 'bg-red-500 text-white' : 
                        'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                >
                    {status === 'syncing' && <RefreshCw size={18} className="animate-spin" />}
                    {status === 'success' && <Check size={18} />}
                    {status === 'error' && <AlertTriangle size={18} />}
                    
                    {status === 'syncing' ? 'جاري النقل...' : 
                     status === 'success' ? 'تم النقل بنجاح' : 
                     status === 'error' ? 'فشل النقل' : 'مزامنة الآن'}
                </button>
            </div>
            {status === 'error' && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-bold flex items-center gap-2">
                    <AlertTriangle size={16}/>
                    حدث خطأ: {errorMessage}
                </div>
            )}
             {status === 'success' && (
                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 size={16}/>
                    تم تحديث قاعدة البيانات بنجاح!
                </div>
            )}
        </div>
    );
};

interface PlatformIntegrationCardProps {
  integration: PlatformIntegration;
  onSave: (integration: PlatformIntegration) => void;
  isEnabled: boolean;
  onToggle: () => void;
}

const PlatformIntegrationCard: React.FC<PlatformIntegrationCardProps> = ({ integration, onSave, isEnabled, onToggle }) => {
  const WUILT_API_KEY = 'sb_publishable_JHQQcYIfxthKXwLR_46OKQ_H574o9FD';

  const handlePlatformChange = (platform: 'wuilt' | 'none') => {
    let newIntegration: PlatformIntegration;
    if (platform === 'wuilt') {
        newIntegration = {
            platform: 'wuilt',
            apiKey: WUILT_API_KEY
        };
    } else {
        newIntegration = {
            platform: 'none',
            apiKey: ''
        };
    }
    onSave(newIntegration);
  };


  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Link2 size={24}/></div>
          <div>
            <h2 className="text-xl font-black dark:text-white">ربط المنصات</h2>
            <p className="text-xs text-slate-500">مزامنة المنتجات والطلبات من منصات التجارة الإلكترونية.</p>
          </div>
        </div>
        <ToggleButton active={isEnabled} onToggle={onToggle} variant="blue" />
      </div>

      <div className={`space-y-6 transition-all duration-300 ${!isEnabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">اختر المنصة</label>
            <select 
              value={integration.platform} 
              onChange={(e) => { e.stopPropagation(); handlePlatformChange(e.target.value as 'wuilt' | 'none'); }}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="none">بدون ربط</option>
              <option value="wuilt">Wuilt</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">مفتاح الربط (API Key)</label>
            <input 
              type="text" 
              readOnly
              placeholder="يتم ملؤه تلقائياً عند اختيار المنصة" 
              value={integration.apiKey}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
             {integration.platform === 'wuilt' && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} /> تم الاتصال بلوحة تحكم Wuilt بنجاح.
                </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DangerZone: React.FC<{ activeStore?: Store }> = ({ activeStore }) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    
    const isConfirmationMatch = confirmationText === activeStore?.name;

    const availableTargets = [
        { id: 'orders', label: 'الطلبات والسلات', icon: <ShoppingCart size={16}/> },
        { id: 'products', label: 'المنتجات والمخزون', icon: <Package size={16}/> },
        { id: 'customers', label: 'قاعدة العملاء', icon: <Users size={16}/> },
        { id: 'wallet', label: 'المعاملات المالية', icon: <Wallet size={16}/> },
        { id: 'activity', label: 'سجل النشاط', icon: <Activity size={16}/> },
        { id: 'settings', label: 'كوبونات وإعدادات فرعية', icon: <Tag size={16}/> },
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
        const storeId = localStorage.getItem('lastActiveStoreId');
        
        if (storeId) {
            const result = await clearStoreData(storeId, selectedTargets);
            if (result.success) {
                alert('تم حذف البيانات المحددة بنجاح. سيتم إعادة تحميل الصفحة.');
                window.location.reload();
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
                    <h2 className="text-xl font-black">منطقة الخطر</h2>
                    <p className="text-xs text-red-500 dark:text-red-400">إجراءات حساسة لا يمكن التراجع عنها.</p>
                </div>
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
                            <p className="text-slate-500 text-xs mb-3 font-bold">للتأكيد، يرجى كتابة اسم متجرك: <span className="font-black text-red-500">{activeStore?.name}</span></p>
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

interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

export default SettingsPage;
