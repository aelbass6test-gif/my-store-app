import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ShippingOption, CompanyFees, CityOption } from '../../types';
import { Save, Info, Truck, Plus, Trash2, Wallet, Scale, AlertCircle, XCircle, Package, RefreshCcw, Percent, Coins, Building2, MapPin, Repeat, Settings as SettingsIcon, ShieldCheck, Banknote, ChevronDown, ChevronUp, Eye, ArrowRight, Link2, Plug, CheckCircle2, Wrench, ArrowLeft, Map, Link as LinkIcon, Download, ListChecks, CheckSquare, Square, Search, Lock, Unlock, Unlink, X } from 'lucide-react';
import SaveBar from '../../components/SaveBar';
import { motion } from 'framer-motion';
import { generateEgyptShippingOptions, EGYPT_GOVERNORATES } from '../../constants';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  }
};


// Helper Components (modals, toggles, etc.)
interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

interface DeleteConfirmModalProps { title: string; desc: string; onConfirm: () => void; onCancel: () => void; }
const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ title, desc, onConfirm, onCancel }) => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm"> <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-300 dark:border-slate-800"> <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-900"><AlertCircle size={40} /></div> <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tight">{title}</h3> <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed font-bold">{desc}</p> <div className="flex flex-col gap-3"> <button onClick={onConfirm} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all active:scale-95">تأكيد الحذف</button> <button onClick={onCancel} className="w-full py-4 text-slate-500 dark:text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">تراجع</button> </div> </div> </div> );

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, action, children }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
      <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800 dark:text-white">{icon}{title}</h2>
      {action}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const ShippingPage: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // Sync with external changes, but only if not dirty
    if (!isDirty) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    setIsDirty(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  const handleSave = () => {
    setSettings(localSettings);
  };

  const handleDiscard = () => {
    setLocalSettings(settings);
  };

  const [view, setView] = useState<'main' | string>('main');
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

  const handleBack = () => {
    if (isDirty) {
      if (window.confirm('لديك تغييرات غير محفوظة. هل تريد تجاهلها والعودة؟')) {
        handleDiscard();
        setView('main');
      }
    } else {
      setView('main');
    }
  };

  const addNewCompany = () => {
    if (!newCompanyName.trim()) return;
    const name = newCompanyName.trim();
    if (localSettings.shippingOptions[name]) { alert("هذه الشركة موجودة بالفعل!"); return; }
    setLocalSettings((prev: Settings) => ({
      ...prev,
      shippingOptions: { ...prev.shippingOptions, [name]: [] },
      activeCompanies: { ...prev.activeCompanies, [name]: true },
      exchangeSupported: { ...(prev.exchangeSupported || {}), [name]: true },
      companySpecificFees: { ...prev.companySpecificFees, [name]: { insuranceFeePercent: prev.insuranceFeePercent, inspectionFee: prev.inspectionFee, returnShippingFee: prev.returnShippingFee, useCustomFees: false, defaultInspectionActive: true, enableCodFees: true, codThreshold: prev.codThreshold, codFeeRate: prev.codFeeRate, codTaxRate: prev.codTaxRate, enableReturnAfter: true, enableReturnWithout: true, enableExchange: true, enableFixedReturn: true, postCollectionReturnRefundsProductPrice: true } }
    }));
    setNewCompanyName('');
    setShowAddCompany(false);
  };

  const deleteFullCompany = () => {
    if (!companyToDelete) return;
    setLocalSettings((prev: Settings) => {
      const newOpts = { ...prev.shippingOptions }; const newActive = { ...prev.activeCompanies }; const newExchange = { ...(prev.exchangeSupported || {}) }; const newFees = { ...prev.companySpecificFees };
      delete newOpts[companyToDelete]; delete newActive[companyToDelete]; delete newExchange[companyToDelete]; delete newFees[companyToDelete];
      return { ...prev, shippingOptions: newOpts, activeCompanies: newActive, exchangeSupported: newExchange, companySpecificFees: newFees };
    });
    setCompanyToDelete(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-right pb-20 px-4">
        <div className="relative min-h-[600px] w-full overflow-x-hidden">
            <div className={`transition-all duration-500 ease-in-out ${view !== 'main' ? 'absolute opacity-0 -translate-x-full' : 'translate-x-0'}`}>
                <ShippingDashboard 
                    settings={localSettings} 
                    setSettings={setLocalSettings} 
                    onManageCompany={(company: string) => setView(company)} 
                    onAddCompany={() => setShowAddCompany(true)} 
                    onDeleteCompany={(company: string) => setCompanyToDelete(company)} 
                />
            </div>
            <div className={`transition-all duration-500 ease-in-out absolute w-full top-0 ${view === 'main' ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0'}`}>
                {view !== 'main' && (
                    <CompanyManager 
                        companyName={view} 
                        settings={localSettings} 
                        setSettings={setLocalSettings} 
                        onBack={handleBack} 
                    />
                )}
            </div>
        </div>

      {showAddCompany && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-200 border border-slate-300 dark:border-slate-800">
              <div className="flex items-center gap-4 text-indigo-600 dark:text-indigo-400 mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
                 <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl"><Building2 size={28} /></div>
                 <h3 className="text-2xl font-black dark:text-white">إضافة شركة شحن جديدة</h3>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 dark:text-slate-400 uppercase">اسم الشركة</label>
                    <input type="text" autoFocus placeholder="مثلاً: بوسطة، فيديكس..." className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-slate-700 transition-all text-lg font-black dark:text-white" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addNewCompany()}/>
                 </div>
                 <div className="flex flex-col gap-3 pt-4">
                    <button onClick={addNewCompany} disabled={!newCompanyName.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95"><Save size={20} /> حفظ الشركة</button>
                    <button onClick={() => { setShowAddCompany(false); setNewCompanyName(''); }} className="w-full py-4 text-slate-500 dark:text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">إلغاء</button>
                 </div>
              </div>
           </div>
        </div>
      )}
      {companyToDelete && <DeleteConfirmModal title={`حذف شركة ${companyToDelete}؟`} desc="سيتم مسح كافة المناطق والبيانات المالية المرتبطة بهذه الشركة نهائياً." onConfirm={deleteFullCompany} onCancel={() => setCompanyToDelete(null)} />}
      <SaveBar isVisible={isDirty} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  );
};

const ShippingDashboard: React.FC<any> = ({ settings, setSettings, onManageCompany, onAddCompany, onDeleteCompany }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value, type } = e.target; setSettings((prev: Settings) => ({ ...prev, [name]: type === 'number' ? Number(value) : value })); };
    const toggleSetting = (key: keyof Settings) => { setSettings((prev: Settings) => ({ ...prev, [key]: !prev[key] })); };
    const toggleCompanyActive = (company: string) => { setSettings((prev: Settings) => ({ ...prev, activeCompanies: { ...prev.activeCompanies, [company]: !prev.activeCompanies[company] } })); };

    return (
        <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
             <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><Truck size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">إعدادات الشحن</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">إدارة شركات الشحن، مناطق التوصيل، والسياسات المالية.</p>
                </div>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <SectionCard title="شركات الشحن" icon={<Building2 size={22} className="text-indigo-600 dark:text-indigo-400" />} action={<button onClick={onAddCompany} className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"><Plus size={16} /> إضافة شركة</button>}>
                  <div className="space-y-3">
                      {Object.keys(settings.shippingOptions).length > 0 ? Object.keys(settings.shippingOptions).map((company) => (
                          <div key={company} className="flex items-center justify-between p-3 pr-5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${settings.activeCompanies[company] ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}><Truck size={20}/></div>
                                  <span className="font-bold text-slate-800 dark:text-white">{company}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <ToggleButton active={settings.activeCompanies[company]} onToggle={() => toggleCompanyActive(company)} />
                                  <button onClick={() => onManageCompany(company)} className="px-4 py-2 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">إدارة</button>
                                  <button onClick={() => onDeleteCompany(company)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          </div>
                      )) : <p className="text-center text-sm text-slate-400 py-4">لم تقم بإضافة أي شركات شحن بعد.</p>}
                  </div>
              </SectionCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SectionCard title="الإعدادات المالية العامة" icon={<Coins size={22} className="text-emerald-600 dark:text-emerald-400" />} action={<ToggleButton active={settings.enableGlobalFinancials} onToggle={() => toggleSetting('enableGlobalFinancials')} variant="emerald" />}>
                  <div className={`space-y-6 transition-all duration-300 ${!settings.enableGlobalFinancials && 'opacity-40 pointer-events-none grayscale'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <FinancialCard label="نسبة التأمين (%)" name="insuranceFeePercent" value={settings.insuranceFeePercent} isActive={settings.enableInsurance} onToggle={() => toggleSetting('enableInsurance')} onChange={handleChange} icon={<ShieldCheck size={16} className="text-blue-500" />} desc="تُخصم من إجمالي الأوردر عند التحصيل." />
                          <FinancialCard label="رسوم المعاينة (ج.م)" name="inspectionFee" value={settings.inspectionFee} isActive={settings.enableInspection} onToggle={() => toggleSetting('enableInspection')} onChange={handleChange} icon={<Eye size={16} className="text-emerald-500" />} desc="رسوم مقابل فحص المنتج عند الاستلام." />
                          <FinancialCard label="شحن المرتجع (ج.م)" name="returnShippingFee" value={settings.returnShippingFee} isActive={settings.enableReturnShipping} onToggle={() => toggleSetting('enableReturnShipping')} onChange={handleChange} icon={<RefreshCcw size={16} className="text-red-500" />} desc="مبلغ إضافي يُحسب كخسارة في المرتجع." />
                          <FinancialCard label="السعر الافتراضي (ج.م)" name="defaultProductPrice" value={settings.defaultProductPrice} isActive={settings.enableDefaultPrice} onToggle={() => toggleSetting('enableDefaultPrice')} onChange={handleChange} icon={<Package size={16} className="text-indigo-500" />} desc="السعر التلقائي عند تسجيل أوردر جديد." />
                      </div>
                  </div>
              </SectionCard>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <SectionCard title="الربط الإلكتروني (API)" icon={<Plug size={22} className="text-slate-600 dark:text-slate-400" />}>
                  <div className="text-center py-10 text-slate-400">
                      <Wrench size={48} className="mx-auto mb-4 opacity-50"/>
                      <p className="font-bold">قريباً... تحت الإنشاء</p>
                      <p className="text-sm mt-1">نحن نعمل على ربط النظام مع شركات الشحن لتسهيل إنشاء البوالص.</p>
                  </div>
              </SectionCard>
            </motion.div>
        </motion.div>
    );
};

const CompanyManager: React.FC<any> = ({ companyName, settings, setSettings, onBack }) => {
    const [activeTab, setActiveTab] = useState<'zones' | 'financials'>('zones');
    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"><ArrowRight size={20}/></button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white">إدارة شركة: {companyName}</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">تعديل مناطق الشحن والسياسات المالية الخاصة بالشركة.</p>
                    </div>
                 </div>
             </div>
             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl flex items-center gap-2">
                <button onClick={() => setActiveTab('zones')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'zones' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}><MapPin size={16}/> مناطق الشحن</button>
                <button onClick={() => setActiveTab('financials')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'financials' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}><Wallet size={16}/> الإعدادات المالية</button>
             </div>
             <div className="transition-opacity duration-300 animate-in fade-in">
                {activeTab === 'zones' && <ZonesEditor companyName={companyName} settings={settings} setSettings={setSettings} />}
                {activeTab === 'financials' && <CompanyFinancialsEditor companyName={companyName} settings={settings} setSettings={setSettings} />}
             </div>
        </div>
    );
};

// ... (Rest of components remain the same, just receiving `setSettings` which is actually `setLocalSettings`)
const ZonesEditor: React.FC<any> = ({ companyName, settings, setSettings }) => {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [managingZoneId, setManagingZoneId] = useState<string | null>(null);
  
  const [newCityName, setNewCityName] = useState('');
  const [newCityPrice, setNewCityPrice] = useState('');
  const [newCityExtraKg, setNewCityExtraKg] = useState('');
  const [newCityReturnAfter, setNewCityReturnAfter] = useState('');
  const [newCityReturnWithout, setNewCityReturnWithout] = useState('');
  const [newCityExchange, setNewCityExchange] = useState('');
  const [newCityUseParent, setNewCityUseParent] = useState(true);

  // Determine active columns based on company settings
  const companyFees = settings.companySpecificFees[companyName];
  const showExchange = companyFees?.useCustomFees ? companyFees.enableExchange : settings.enableExchangePrice;
  const showReturnAfter = companyFees?.useCustomFees ? companyFees.enableReturnAfter : settings.enableReturnAfterPrice;
  const showReturnWithout = companyFees?.useCustomFees ? companyFees.enableReturnWithout : settings.enableReturnWithoutPrice;

  // Determine grid template based on active columns
  // Structure: Name(2fr) Link(40px) | Prices (1fr each) | Delete(40px)
  const activePriceColumns = 2 + (showReturnAfter ? 1 : 0) + (showReturnWithout ? 1 : 0) + (showExchange ? 1 : 0);
  // Grid Template: 
  // - Name: minmax(140px, 1.5fr)
  // - Link: 40px
  // - Prices: repeat(N, minmax(70px, 1fr))
  // - Delete: 40px
  
  const gridTemplate = `minmax(140px, 1.5fr) 40px repeat(${activePriceColumns}, minmax(70px, 1fr)) 40px`;


  // When expanding a zone, we want to auto-fill the inputs with parent values if "Link" is checked
  useEffect(() => {
      if (expandedZoneId && newCityUseParent) {
          const zone = settings.shippingOptions[companyName]?.find((z: any) => z.id === expandedZoneId);
          if (zone) {
              setNewCityPrice(zone.price);
              setNewCityExtraKg(zone.extraKgPrice);
              setNewCityReturnAfter(zone.returnAfterPrice);
              setNewCityReturnWithout(zone.returnWithoutPrice);
              setNewCityExchange(zone.exchangePrice);
          }
      }
  }, [expandedZoneId, newCityUseParent, settings.shippingOptions, companyName]);

  const addShippingOption = () => {
    const newOption: ShippingOption = { id: Date.now().toString(), label: 'منطقة جديدة', details: 'تفاصيل المنطقة...', price: 50, baseWeight: 5, extraKgPrice: 10, returnAfterPrice: 50, returnWithoutPrice: 50, exchangePrice: 70, cities: [] };
    setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: [...(prev.shippingOptions[companyName] || []), newOption] } }));
  };
  const updateShippingOption = (id: string, field: keyof ShippingOption, value: string | number) => {
    setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: (prev.shippingOptions[companyName] || []).map(opt => opt.id === id ? { ...opt, [field]: value } : opt) } }));
  };
  const removeShippingOption = () => {
    if (!confirmDelete) return;
    setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: (prev.shippingOptions[companyName] || []).filter(opt => opt.id !== confirmDelete) } }));
    setConfirmDelete(null);
  };

  const addCity = (zoneId: string) => {
      if (!newCityName || (!newCityUseParent && !newCityPrice)) return;
      const zone = settings.shippingOptions[companyName]?.find((z: any) => z.id === zoneId);
      
      const newCity: CityOption = {
          id: Date.now().toString(),
          name: newCityName,
          shippingPrice: newCityUseParent ? (zone?.price || 0) : Number(newCityPrice),
          extraKgPrice: newCityUseParent ? (zone?.extraKgPrice || 0) : Number(newCityExtraKg) || 0,
          returnAfterPrice: newCityUseParent ? (zone?.returnAfterPrice || 0) : Number(newCityReturnAfter) || 0,
          returnWithoutPrice: newCityUseParent ? (zone?.returnWithoutPrice || 0) : Number(newCityReturnWithout) || 0,
          exchangePrice: newCityUseParent ? (zone?.exchangePrice || 0) : Number(newCityExchange) || 0,
          useParentFees: newCityUseParent,
          active: true
      };
      
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === zoneId) {
                      return { ...opt, cities: [...(opt.cities || []), newCity] };
                  }
                  return opt;
              })
          }
      }));
      setNewCityName('');
      // Keep price fields populated if linked, otherwise reset or keep as is? Reset for UX.
      if (!newCityUseParent) {
          setNewCityPrice('');
          setNewCityExtraKg('');
          setNewCityReturnAfter('');
          setNewCityReturnWithout('');
          setNewCityExchange('');
      }
  };

  // Changed from removeCity to toggleCityStatus
  const toggleCityStatus = (zoneId: string, cityId: string) => {
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === zoneId) {
                      return { 
                          ...opt, 
                          cities: (opt.cities || []).map(c => {
                              if (c.id === cityId) {
                                  // Toggle active status (default to true if undefined)
                                  const isActive = c.active !== false;
                                  return { ...c, active: !isActive };
                              }
                              return c;
                          })
                      };
                  }
                  return opt;
              })
          }
      }));
  };

  const toggleZoneStatus = (id: string) => {
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === id) {
                      const isActive = opt.active !== false;
                      // If we are deactivating, collapse it if it's currently expanded
                      if (isActive && expandedZoneId === id) {
                          setExpandedZoneId(null);
                      }
                      return { ...opt, active: !isActive };
                  }
                  return opt;
              })
          }
      }));
  };

  const toggleCityLink = (zoneId: string, cityId: string, currentCity: CityOption, zone: ShippingOption) => {
        const newValue = !currentCity.useParentFees;
        let updates: any = { useParentFees: newValue };

        // If switching to Custom (False), copy parent values to the city so the inputs aren't empty/zero
        if (!newValue) {
            updates = {
                ...updates,
                shippingPrice: zone.price,
                extraKgPrice: zone.extraKgPrice,
                returnAfterPrice: zone.returnAfterPrice,
                returnWithoutPrice: zone.returnWithoutPrice,
                exchangePrice: zone.exchangePrice
            };
        }

        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => c.id === cityId ? { ...c, ...updates } : c)
                        };
                    }
                    return opt;
                })
            }
        }));
    };

    const updateCityField = (zoneId: string, cityId: string, field: keyof CityOption, value: any) => {
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => c.id === cityId ? { ...c, [field]: value } : c)
                        };
                    }
                    return opt;
                })
            }
        }));
    };

    // New: Helper to reset all cities in a zone to linked status
    const resetAllToLinked = (e: React.MouseEvent, zoneId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if(!window.confirm("هل أنت متأكد من ربط جميع المدن بسعر المنطقة؟ سيتم إلغاء أي أسعار مخصصة.")) return;
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => ({ ...c, useParentFees: true }))
                        };
                    }
                    return opt;
                })
            }
        }));
    };
    
    // New: Helper to unlink all
    const unlinkAll = (e: React.MouseEvent, zoneId: string, zone: ShippingOption) => {
        e.preventDefault();
        e.stopPropagation();
        if(!window.confirm("هل أنت متأكد من فك ربط جميع المدن؟ ستحتفظ المدن بالأسعار الحالية كأسعار مخصصة.")) return;
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => ({ 
                                ...c, 
                                useParentFees: false,
                                shippingPrice: zone.price,
                                extraKgPrice: zone.extraKgPrice,
                                returnAfterPrice: zone.returnAfterPrice,
                                returnWithoutPrice: zone.returnWithoutPrice,
                                exchangePrice: zone.exchangePrice
                            }))
                        };
                    }
                    return opt;
                })
            }
        }));
    };

  const toggleExpand = (id: string) => {
      if (expandedZoneId === id) {
          setExpandedZoneId(null);
      } else {
          setExpandedZoneId(id);
          // Reset linked state to true when opening a new zone for convenience
          setNewCityUseParent(true);
      }
  };

  const loadEgyptData = () => {
    if (confirm('سيتم إضافة جميع محافظات ومدن مصر إلى هذه الشركة. هل تريد المتابعة؟')) {
        const egyptZones = generateEgyptShippingOptions();
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...(prev.shippingOptions || {}),
                [companyName]: egyptZones
            }
        }));
        alert('تم استيراد محافظات مصر بنجاح!');
    }
  }

  const handleUpdateZoneCities = (newCities: CityOption[]) => {
      if (!managingZoneId) return;
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === managingZoneId) {
                      return { ...opt, cities: newCities };
                  }
                  return opt;
              })
          }
      }));
      setManagingZoneId(null);
  };

  const managingZone = settings.shippingOptions[companyName]?.find(z => z.id === managingZoneId);

  return (
    <SectionCard title="جدول تسعير المناطق" icon={<MapPin size={22} />} action={<div className="flex gap-2"><button onClick={loadEgyptData} className="flex items-center gap-2 text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"><Download size={16} /> استيراد محافظات مصر</button><button onClick={addShippingOption} className="flex items-center gap-2 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm"><Plus size={16} /> إضافة منطقة</button></div>}>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase">
            <tr>
              <th className="p-3 text-right">المنطقة / المحافظة</th>
              <th className="p-3 text-center">الشحن</th>
              <th className="p-3 text-center">زيادة كجم</th>
              {showReturnAfter && <th className="p-3 text-center">إرجاع بعد</th>}
              {showReturnWithout && <th className="p-3 text-center">إرجاع بدون</th>}
              {showExchange && <th className="p-3 text-center">استبدال</th>}
              <th className="p-3 text-center">المدن</th>
              <th className="p-3 text-center">إلغاء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {(settings.shippingOptions[companyName] || []).map((opt: ShippingOption) => {
              const isActive = opt.active !== false;
              return (
              <React.Fragment key={opt.id}>
                  <tr className={`transition-all ${!isActive ? 'opacity-50 grayscale bg-slate-100 dark:bg-slate-800/50' : ''}`}>
                    <td className="p-2 w-48"><input type="text" disabled={!isActive} className="w-full bg-slate-50 dark:bg-slate-800 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-900 dark:text-white disabled:bg-transparent" value={opt.label} onChange={(e) => updateShippingOption(opt.id, 'label', e.target.value)} /></td>
                    <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-900 dark:text-white disabled:bg-transparent" value={opt.price} onChange={(e) => updateShippingOption(opt.id, 'price', Number(e.target.value))} /></td>
                    <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-900 dark:text-white disabled:bg-transparent" value={opt.extraKgPrice} onChange={(e) => updateShippingOption(opt.id, 'extraKgPrice', Number(e.target.value))} /></td>
                    {showReturnAfter && <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-900 dark:text-white disabled:bg-transparent" value={opt.returnAfterPrice} onChange={(e) => updateShippingOption(opt.id, 'returnAfterPrice', Number(e.target.value))} /></td>}
                    {showReturnWithout && <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-900 dark:text-white disabled:bg-transparent" value={opt.returnWithoutPrice} onChange={(e) => updateShippingOption(opt.id, 'returnWithoutPrice', Number(e.target.value))} /></td>}
                    {showExchange && <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-900 dark:text-white disabled:bg-transparent" value={opt.exchangePrice} onChange={(e) => updateShippingOption(opt.id, 'exchangePrice', Number(e.target.value))} /></td>}
                    <td className="p-2 text-center">
                        <button disabled={!isActive} onClick={() => toggleExpand(opt.id)} className={`p-2 rounded-lg transition-colors ${expandedZoneId === opt.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'} disabled:opacity-50`}>
                            <Map size={16} />
                        </button>
                    </td>
                    <td className="p-2 text-center">
                        <button onClick={() => toggleZoneStatus(opt.id)} className={`p-2 rounded-lg transition-colors ${isActive ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`} title={isActive ? "إلغاء تفعيل المنطقة" : "إعادة تفعيل المنطقة"}>
                            {isActive ? <XCircle size={16} /> : <RefreshCcw size={16} />}
                        </button>
                    </td>
                  </tr>
                  
                  {expandedZoneId === opt.id && (
                      <tr>
                          <td colSpan={10} className="p-0">
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-y border-indigo-100 dark:border-slate-700">
                                  <div className="max-w-5xl mx-auto">
                                      <div className="flex justify-between items-center mb-3">
                                          <div className="flex items-center gap-2">
                                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                  <Map size={14} className="text-indigo-500"/>
                                                  المدن التابعة لـ {opt.label}
                                              </h4>
                                              {/* Bulk Actions for Linking */}
                                              <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 ml-4">
                                                  <button type="button" onClick={(e) => resetAllToLinked(e, opt.id)} className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 rounded" title="ربط جميع المدن بسعر المنطقة">
                                                      <LinkIcon size={12} className="inline mr-1"/> ربط الكل
                                                  </button>
                                                  <div className="w-px bg-slate-200 dark:border-slate-700 mx-0.5"></div>
                                                  <button type="button" onClick={(e) => unlinkAll(e, opt.id, opt)} className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-orange-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 rounded" title="فك ربط جميع المدن لتعديل الأسعار">
                                                      <Unlink size={12} className="inline mr-1"/> فك الكل
                                                  </button>
                                              </div>
                                          </div>
                                          <button onClick={() => setManagingZoneId(opt.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg transition-colors">
                                              <ListChecks size={14}/> تحديد المدن المتاحة
                                          </button>
                                      </div>
                                      
                                      {/* New Header Row for City List */}
                                      <div className="grid gap-2 mb-2 p-2 bg-slate-200 dark:bg-slate-700/50 rounded-t-lg border-b border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 text-center items-center" style={{ gridTemplateColumns: gridTemplate }}>
                                          <div className="text-right pr-2">المدينة</div>
                                          <div>ربط</div>
                                          <div>شحن</div>
                                          <div>ك.ز</div>
                                          {showReturnAfter && <div>إرجاع(م)</div>}
                                          {showReturnWithout && <div>إرجاع(ب)</div>}
                                          {showExchange && <div>استبدال</div>}
                                          <div>حذف</div>
                                      </div>
                                      
                                      <div className="space-y-1">
                                          {(opt.cities || []).map((city: CityOption) => (
                                              <div key={city.id} className={`grid gap-2 p-2 rounded-lg border items-center text-center ${city.active !== false ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'}`} style={{ gridTemplateColumns: gridTemplate }}>
                                                  <div className="text-right font-bold text-xs text-slate-700 dark:text-slate-300 pr-2">{city.name}</div>
                                                  <button onClick={() => toggleCityLink(opt.id, city.id, city, opt)} className={`p-1.5 rounded-md ${city.useParentFees ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title={city.useParentFees ? "مرتبط بسعر المنطقة" : "سعر مخصص"}>
                                                      {city.useParentFees ? <LinkIcon size={14}/> : <Unlink size={14}/>}
                                                  </button>
                                                  <input type="number" disabled={city.useParentFees || city.active === false} className="w-full text-center bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:bg-transparent" value={city.shippingPrice} onChange={(e) => updateCityField(opt.id, city.id, 'shippingPrice', Number(e.target.value))} />
                                                  <input type="number" disabled={city.useParentFees || city.active === false} className="w-full text-center bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:bg-transparent" value={city.extraKgPrice} onChange={(e) => updateCityField(opt.id, city.id, 'extraKgPrice', Number(e.target.value))} />
                                                  {showReturnAfter && <input type="number" disabled={city.useParentFees || city.active === false} className="w-full text-center bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:bg-transparent" value={city.returnAfterPrice} onChange={(e) => updateCityField(opt.id, city.id, 'returnAfterPrice', Number(e.target.value))} />}
                                                  {showReturnWithout && <input type="number" disabled={city.useParentFees || city.active === false} className="w-full text-center bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:bg-transparent" value={city.returnWithoutPrice} onChange={(e) => updateCityField(opt.id, city.id, 'returnWithoutPrice', Number(e.target.value))} />}
                                                  {showExchange && <input type="number" disabled={city.useParentFees || city.active === false} className="w-full text-center bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:bg-transparent" value={city.exchangePrice} onChange={(e) => updateCityField(opt.id, city.id, 'exchangePrice', Number(e.target.value))} />}
                                                  <button onClick={() => toggleCityStatus(opt.id, city.id)} className={`p-1.5 rounded-md ${city.active !== false ? 'text-slate-400 hover:text-red-500' : 'text-emerald-500'}`}>
                                                      {city.active !== false ? <Trash2 size={14}/> : <RefreshCcw size={14}/>}
                                                  </button>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </td>
                      </tr>
                  )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <CityManagerModal isOpen={!!managingZoneId} onClose={() => setManagingZoneId(null)} zone={managingZone} onSave={handleUpdateZoneCities} />
    </SectionCard>
  );
};

const FinancialCard: React.FC<{ label: string; name: string; value: number; isActive: boolean; onToggle: () => void; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; icon: React.ReactNode; desc: string; }> = ({ label, name, value, isActive, onToggle, onChange, icon, desc }) => (
    <div className={`p-4 rounded-xl border transition-all ${isActive ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'}`}>
        <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-sm">
                {icon} {label}
            </div>
            <ToggleButton active={isActive} onToggle={onToggle} variant="emerald" />
        </div>
        <input type="number" name={name} value={value} onChange={onChange} disabled={!isActive} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-lg text-slate-800 dark:text-white disabled:bg-transparent" />
        <p className="text-[10px] text-slate-400 mt-2">{desc}</p>
    </div>
);

const CompanyFinancialsEditor: React.FC<any> = ({ companyName, settings, setSettings }) => {
    const fees = settings.companySpecificFees[companyName] || {};
    const updateFee = (field: keyof CompanyFees, value: any) => {
        setSettings((prev: Settings) => ({ ...prev, companySpecificFees: { ...prev.companySpecificFees, [companyName]: { ...prev.companySpecificFees[companyName], [field]: value } } }));
    };
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <PolicyToggle label="استخدام رسوم خاصة لهذه الشركة" active={fees.useCustomFees} onToggle={() => updateFee('useCustomFees', !fees.useCustomFees)} />
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all ${!fees.useCustomFees && 'opacity-40 pointer-events-none grayscale'}`}>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-400">نسبة التأمين (%)</label>
                    <input type="number" value={fees.insuranceFeePercent} onChange={e => updateFee('insuranceFeePercent', Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-400">رسوم المعاينة (ج.م)</label>
                    <input type="number" value={fees.inspectionFee} onChange={e => updateFee('inspectionFee', Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold" />
                </div>
            </div>
        </div>
    );
};

const CityManagerModal: React.FC<{ isOpen: boolean; onClose: () => void; zone: any; onSave: (cities: any[]) => void; }> = ({ isOpen, onClose, zone, onSave }) => {
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    
    useEffect(() => {
        if (isOpen && zone) {
            setSelectedCities((zone.cities || []).map((c: any) => c.name));
        }
    }, [isOpen, zone]);

    if (!isOpen) return null;

    const govData = EGYPT_GOVERNORATES.find(g => g.name === zone?.label);
    const availableCities = govData ? govData.cities : [];

    const toggleCity = (cityName: string) => {
        setSelectedCities(prev => 
            prev.includes(cityName) 
                ? prev.filter(c => c !== cityName) 
                : [...prev, cityName]
        );
    };

    const handleSave = () => {
        const newCities = selectedCities.map(cityName => {
            const existing = (zone.cities || []).find((c: any) => c.name === cityName);
            if (existing) return existing;
            return {
                id: Math.random().toString(36).substr(2, 9),
                name: cityName,
                shippingPrice: zone.price,
                extraKgPrice: zone.extraKgPrice,
                returnAfterPrice: zone.returnAfterPrice,
                returnWithoutPrice: zone.returnWithoutPrice,
                exchangePrice: zone.exchangePrice,
                useParentFees: true,
                active: true
            };
        });
        onSave(newCities);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-right">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black dark:text-white">إدارة مدن {zone?.label}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
                </div>
                
                <div className="space-y-4">
                    <p className="text-sm text-slate-500 font-bold">اختر المدن التي تخدمها هذه الشركة في محافظة {zone?.label}:</p>
                    
                    <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        {availableCities.length > 0 ? availableCities.map(city => (
                            <button 
                                key={city}
                                onClick={() => toggleCity(city)}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${selectedCities.includes(city) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                            >
                                <span className="text-sm font-bold">{city}</span>
                                {selectedCities.includes(city) ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />}
                            </button>
                        )) : (
                            <div className="col-span-2 py-8 text-center text-slate-400 italic">لا توجد بيانات مدن لهذه المحافظة</div>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95">حفظ التغييرات</button>
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">إلغاء</button>
                </div>
            </div>
        </div>
    );
};

const PolicyToggle: React.FC<{ label: string; active: boolean; onToggle: () => void; }> = ({ label, active, onToggle }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <span className="font-bold text-slate-700 dark:text-slate-300">{label}</span>
        <ToggleButton active={active} onToggle={onToggle} variant="indigo" />
    </div>
);

export default ShippingPage;
