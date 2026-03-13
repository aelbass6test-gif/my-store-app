import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ShippingOption, CompanyFees, CityOption } from '../types';
import { Save, Info, Truck, Plus, Trash2, Wallet, Scale, AlertCircle, XCircle, Package, RefreshCcw, Percent, Coins, Building2, MapPin, Repeat, Settings as SettingsIcon, ShieldCheck, Banknote, ChevronDown, ChevronUp, Eye, ArrowRight, Link2, Plug, CheckCircle2, Wrench, ArrowLeft, Map, Link as LinkIcon, Download, ListChecks, CheckSquare, Square, Search, Lock, Unlock, Unlink, X } from 'lucide-react';
import SaveBar from './SaveBar';
import { motion } from 'framer-motion';
import { generateEgyptShippingOptions, EGYPT_GOVERNORATES } from '../constants';

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

// Helper Components
interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

interface DeleteConfirmModalProps { title: string; desc: string; onConfirm: () => void; onCancel: () => void; }
const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ title, desc, onConfirm, onCancel }) => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm"> <div className="bg-white dark:bg-slate-900 w-full max-sm rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-300 dark:border-slate-800"> <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-900"><AlertCircle size={40} /></div> <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tight">{title}</h3> <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed font-bold">{desc}</p> <div className="flex flex-col gap-3"> <button onClick={onConfirm} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all active:scale-95">تأكيد الحذف</button> <button onClick={onCancel} className="w-full py-4 text-slate-500 dark:text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">تراجع</button> </div> </div> </div> );

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, action, children }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
      <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800 dark:text-white">{icon}{title}</h2>
      {action}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const PolicyToggle: React.FC<{ label: string; description?: string; active: boolean; onToggle: () => void; }> = ({ label, description, active, onToggle }) => (
    <div className="flex items-start justify-between p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
        <div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>}
        </div>
        <div className="flex-shrink-0 pt-0.5">
           <ToggleButton active={active} onToggle={onToggle} />
        </div>
    </div>
);

const CityManagerModal: React.FC<{ isOpen: boolean; onClose: () => void; zone: ShippingOption; onSave: (cities: CityOption[]) => void }> = ({ isOpen, onClose, zone, onSave }) => {
    const [targetGovName, setTargetGovName] = useState('');
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [citySearchTerm, setCitySearchTerm] = useState('');
    
    const displayedCities = useMemo(() => {
        const govCities = EGYPT_GOVERNORATES.find(g => g.name === targetGovName)?.cities || [];
        if (!citySearchTerm) return govCities;
        return govCities.filter(c => c.toLowerCase().includes(citySearchTerm.toLowerCase()));
    }, [targetGovName, citySearchTerm]);
    
    useEffect(() => {
        if (isOpen) {
            const currentNames = (zone.cities || []).map(c => c.name);
            setSelectedCities(currentNames);
            const exactMatch = EGYPT_GOVERNORATES.find(g => g.name === zone.label);
            if (exactMatch) { setTargetGovName(exactMatch.name); } 
            else if (currentNames.length > 0) {
                const reverseMatch = EGYPT_GOVERNORATES.find(g => g.cities.includes(currentNames[0]));
                setTargetGovName(reverseMatch ? reverseMatch.name : EGYPT_GOVERNORATES[0]?.name || '');
            } else { setTargetGovName(EGYPT_GOVERNORATES[0]?.name || ''); }
        }
    }, [isOpen, zone]);

    if (!isOpen) return null;

    const toggleCity = (cityName: string) => {
        setSelectedCities(prev => prev.includes(cityName) ? prev.filter(c => c !== cityName) : [...prev, cityName]);
    };

    const toggleAll = () => {
        if (displayedCities.every(c => selectedCities.includes(c))) {
            setSelectedCities(prev => prev.filter(c => !displayedCities.includes(c)));
        } else {
            const newSelection = new Set([...selectedCities, ...displayedCities]);
            setSelectedCities(Array.from(newSelection));
        }
    };

    const handleSave = () => {
        const newCities: CityOption[] = selectedCities.map(name => {
            const existingCity = (zone.cities || []).find(c => c.name === name);
            if (existingCity) return existingCity;
            return {
                id: `city_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                name: name,
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
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl p-6 text-right flex flex-col max-h-[85vh] border border-slate-300 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <MapPin className="text-indigo-600"/> تحديد مدن {zone.label}
                    </h3>
                    <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>
                <div className="space-y-4 mb-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">اختر المحافظة:</label>
                        <select value={targetGovName} onChange={(e) => setTargetGovName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl font-bold">
                            <option value="">-- اختر المحافظة --</option>
                            {EGYPT_GOVERNORATES.map(g => ( <option key={g.name} value={g.name}>{g.name}</option> ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input type="text" placeholder="بحث عن مدينة..." value={citySearchTerm} onChange={(e) => setCitySearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100">
                    {displayedCities.length === 0 ? ( <div className="flex flex-col items-center justify-center h-48 text-slate-400"> <Map className="mb-2 opacity-50" size={32}/> <p className="font-bold">لا توجد مدن للعرض.</p> </div> ) : (
                        <>
                            <button onClick={toggleAll} className="mb-4 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"> <CheckSquare size={14}/> {displayedCities.every(c => selectedCities.includes(c)) ? 'إلغاء تحديد المعروض' : 'تحديد المعروض'} </button>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {displayedCities.map(city => {
                                    const isSelected = selectedCities.includes(city);
                                    return ( <div key={city} onClick={() => toggleCity(city)} className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30' : 'bg-white dark:bg-slate-800 border-slate-200'}`}> {isSelected ? <CheckSquare size={18} className="text-indigo-600"/> : <Square size={18} className="text-slate-300"/>} <span className="text-xs font-bold truncate">{city}</span> </div> )
                                })}
                            </div>
                        </>
                    )}
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 mt-2">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-600">إلغاء</button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white shadow-lg active:scale-95"> حفظ ({selectedCities.length}) مدينة </button>
                </div>
            </div>
        </div>
    );
};

const ShippingPage: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => { if (!isDirty) { setLocalSettings(settings); } }, [settings]);
  useEffect(() => { setIsDirty(JSON.stringify(localSettings) !== JSON.stringify(settings)); }, [localSettings, settings]);

  const handleSave = () => { setSettings(localSettings); };
  const handleDiscard = () => { setLocalSettings(settings); };

  const [view, setView] = useState<'main' | string>('main');
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

  const handleBack = () => {
    if (isDirty) { if (window.confirm('لديك تغييرات غير محفوظة. هل تريد تجاهلها والعودة؟')) { handleDiscard(); setView('main'); } } 
    else { setView('main'); }
  };

  const addNewCompany = () => {
    if (!newCompanyName.trim()) return;
    const name = newCompanyName.trim();
    if (localSettings.shippingOptions[name]) { alert("هذه الشركة موجودة بالفعل!"); return; }
    setLocalSettings((prev: Settings) => ({
      ...prev,
      shippingOptions: { ...prev.shippingOptions, [name]: [] },
      activeCompanies: { ...prev.activeCompanies, [name]: true },
      companySpecificFees: { 
          ...prev.companySpecificFees, 
          [name]: { 
              insuranceFeePercent: prev.insuranceFeePercent, 
              inspectionFee: prev.inspectionFee, 
              returnShippingFee: prev.returnShippingFee, 
              baseWeight: 1, // تم إضافة الوزن الافتراضي هنا
              useCustomFees: false, 
              enableCodFees: true, 
              codThreshold: prev.codThreshold, 
              codFeeRate: prev.codFeeRate, 
              codTaxRate: prev.codTaxRate, 
              enableReturnAfter: true, 
              enableReturnWithout: true, 
              enableExchange: true, 
              enableFixedReturn: true 
          } 
      }
    }));
    setNewCompanyName('');
    setShowAddCompany(false);
  };

  const deleteFullCompany = () => {
    if (!companyToDelete) return;
    setLocalSettings((prev: Settings) => {
      const newOpts = { ...prev.shippingOptions }; const newActive = { ...prev.activeCompanies }; const newFees = { ...prev.companySpecificFees };
      delete newOpts[companyToDelete]; delete newActive[companyToDelete]; delete newFees[companyToDelete];
      return { ...prev, shippingOptions: newOpts, activeCompanies: newActive, companySpecificFees: newFees };
    });
    setCompanyToDelete(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-right pb-20 px-4">
        <div className="relative min-h-[600px] w-full overflow-x-hidden">
            <div className={`transition-all duration-500 ease-in-out ${view !== 'main' ? 'absolute opacity-0 -translate-x-full' : 'translate-x-0'}`}>
                <ShippingDashboard settings={localSettings} setSettings={setLocalSettings} onManageCompany={(company: string) => setView(company)} onAddCompany={() => setShowAddCompany(true)} onDeleteCompany={(company: string) => setCompanyToDelete(company)} />
            </div>
            <div className={`transition-all duration-500 ease-in-out absolute w-full top-0 ${view === 'main' ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0'}`}>
                {view !== 'main' && ( <CompanyManager companyName={view} settings={localSettings} setSettings={setLocalSettings} onBack={handleBack} /> )}
            </div>
        </div>
      {showAddCompany && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-200 border border-slate-300 dark:border-slate-800">
              <div className="flex items-center gap-4 text-indigo-600 mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
                 <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl"><Building2 size={28} /></div>
                 <h3 className="text-2xl font-black dark:text-white">إضافة شركة شحن جديدة</h3>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 dark:text-slate-400 uppercase">اسم الشركة</label>
                    <input type="text" autoFocus placeholder="مثلاً: بوسطة، فيديكس..." className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 rounded-2xl outline-none text-lg font-black dark:text-white" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addNewCompany()}/>
                 </div>
                 <div className="flex flex-col gap-3 pt-4">
                    <button onClick={addNewCompany} disabled={!newCompanyName.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 disabled:bg-slate-300 active:scale-95 flex items-center justify-center gap-2"><Save size={20} /> حفظ الشركة</button>
                    <button onClick={() => { setShowAddCompany(false); setNewCompanyName(''); }} className="w-full py-4 text-slate-500 font-black hover:bg-slate-100 rounded-2xl transition-all">إلغاء</button>
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
        <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
             <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl"><Truck size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">إعدادات الشحن</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">إدارة شركات الشحن، مناطق التوصيل، والسياسات المالية.</p>
                </div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <SectionCard title="شركات الشحن" icon={<Building2 size={22} className="text-indigo-600" />} action={<button onClick={onAddCompany} className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 active:scale-95 transition-all"><Plus size={16} /> إضافة شركة</button>}>
                  <div className="space-y-3">
                      {Object.keys(settings.shippingOptions).length > 0 ? Object.keys(settings.shippingOptions).map((company) => (
                          <div key={company} className="flex items-center justify-between p-3 pr-5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${settings.activeCompanies[company] ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}><Truck size={20}/></div>
                                  <span className="font-bold text-slate-800 dark:text-white">{company}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <ToggleButton active={settings.activeCompanies[company]} onToggle={() => toggleCompanyActive(company)} />
                                  <button onClick={() => onManageCompany(company)} className="px-4 py-2 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 rounded-md hover:bg-slate-100">إدارة</button>
                                  <button onClick={() => onDeleteCompany(company)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          </div>
                      )) : <p className="text-center text-sm text-slate-400 py-4">لم تقم بإضافة أي شركات شحن بعد.</p>}
                  </div>
              </SectionCard>
            </motion.div>
            <motion.div variants={itemVariants}>
              <SectionCard title="الإعدادات المالية العامة" icon={<Coins size={22} className="text-emerald-600" />} action={<ToggleButton active={settings.enableGlobalFinancials} onToggle={() => toggleSetting('enableGlobalFinancials')} variant="emerald" />}>
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
        </motion.div>
    );
};

const CompanyManager: React.FC<any> = ({ companyName, settings, setSettings, onBack }) => {
    const [activeTab, setActiveTab] = useState<'zones' | 'financials'>('zones');
    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"><ArrowRight size={20}/></button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white">إدارة شركة: {companyName}</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">تعديل مناطق الشحن والسياسات المالية الخاصة بالشركة.</p>
                    </div>
                 </div>
             </div>
             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl flex items-center gap-2">
                <button onClick={() => setActiveTab('zones')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'zones' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}><MapPin size={16}/> مناطق الشحن</button>
                <button onClick={() => setActiveTab('financials')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'financials' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-500 hover:bg-slate-200'}`}><Wallet size={16}/> الإعدادات المالية</button>
             </div>
             <div className="transition-opacity duration-300 animate-in fade-in">
                {activeTab === 'zones' && <ZonesEditor companyName={companyName} settings={settings} setSettings={setSettings} />}
                {activeTab === 'financials' && <CompanyFinancialsEditor companyName={companyName} settings={settings} setSettings={setSettings} />}
             </div>
        </div>
    );
};

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

  const companyFees = settings.companySpecificFees[companyName];
  const showExchange = companyFees?.useCustomFees ? companyFees.enableExchange : settings.enableExchangePrice;
  const showReturnAfter = companyFees?.useCustomFees ? companyFees.enableReturnAfter : settings.enableReturnAfterPrice;
  const showReturnWithout = companyFees?.useCustomFees ? companyFees.enableReturnWithout : settings.enableReturnWithoutPrice;

  const activePriceColumns = 2 + (showReturnAfter ? 1 : 0) + (showReturnWithout ? 1 : 0) + (showExchange ? 1 : 0);
  const gridTemplate = `minmax(140px, 1.5fr) 40px repeat(${activePriceColumns}, minmax(70px, 1fr)) 40px`;

  const updateShippingOption = (id: string, field: keyof ShippingOption, value: string | number) => {
    setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: (prev.shippingOptions[companyName] || []).map(opt => opt.id === id ? { ...opt, [field]: value } : opt) } }));
  };

  const toggleZoneStatus = (id: string) => {
      setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
          if (opt.id === id) { const isActive = opt.active !== false; if (isActive && expandedZoneId === id) { setExpandedZoneId(null); } return { ...opt, active: !isActive }; }
          return opt;
      }) } }));
  };

  const loadEgyptData = () => {
    if (confirm('سيتم إضافة جميع محافظات ومدن مصر إلى هذه الشركة. هل تريد المتابعة؟')) {
        const egyptZones = generateEgyptShippingOptions();
        setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...(prev.shippingOptions || {}), [companyName]: egyptZones } }));
        alert('تم استيراد محافظات مصر بنجاح!');
    }
  }

  const handleUpdateZoneCities = (newCities: CityOption[]) => {
      if (!managingZoneId) return;
      setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: (prev.shippingOptions[companyName] || []).map(opt => opt.id === managingZoneId ? { ...opt, cities: newCities } : opt) } }));
      setManagingZoneId(null);
  };

  const managingZone = settings.shippingOptions[companyName]?.find(z => z.id === managingZoneId);

  return (
    <SectionCard title="جدول تسعير المناطق" icon={<MapPin size={22} />} action={<div className="flex gap-2"><button onClick={loadEgyptData} className="flex items-center gap-2 text-xs bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all"><Download size={16} /> استيراد محافظات مصر</button></div>}>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs uppercase">
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
                  <tr className={`transition-all ${!isActive ? 'opacity-50 grayscale bg-slate-100' : ''}`}>
                    <td className="p-2 w-48"><input type="text" disabled={!isActive} className="w-full bg-slate-50 dark:bg-slate-800 px-2 py-2 border border-slate-200 rounded-md font-bold text-slate-900 dark:text-white" value={opt.label} onChange={(e) => updateShippingOption(opt.id, 'label', e.target.value)} /></td>
                    <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 rounded-md font-bold" value={opt.price} onChange={(e) => updateShippingOption(opt.id, 'price', Number(e.target.value))} /></td>
                    <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 rounded-md font-bold" value={opt.extraKgPrice} onChange={(e) => updateShippingOption(opt.id, 'extraKgPrice', Number(e.target.value))} /></td>
                    {showReturnAfter && <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 rounded-md font-bold" value={opt.returnAfterPrice} onChange={(e) => updateShippingOption(opt.id, 'returnAfterPrice', Number(e.target.value))} /></td>}
                    {showReturnWithout && <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 rounded-md font-bold" value={opt.returnWithoutPrice} onChange={(e) => updateShippingOption(opt.id, 'returnWithoutPrice', Number(e.target.value))} /></td>}
                    {showExchange && <td className="p-2"><input type="number" disabled={!isActive} className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-2 border border-slate-200 rounded-md font-bold" value={opt.exchangePrice} onChange={(e) => updateShippingOption(opt.id, 'exchangePrice', Number(e.target.value))} /></td>}
                    <td className="p-2 text-center"> <button disabled={!isActive} onClick={() => setExpandedZoneId(expandedZoneId === opt.id ? null : opt.id)} className={`p-2 rounded-lg ${expandedZoneId === opt.id ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}> <Map size={16} /> </button> </td>
                    <td className="p-2 text-center"> <button onClick={() => toggleZoneStatus(opt.id)} className={`p-2 rounded-lg ${isActive ? 'text-slate-400 hover:text-red-500' : 'text-emerald-500'}`}> {isActive ? <XCircle size={16} /> : <RefreshCcw size={16} />} </button> </td>
                  </tr>
                  {expandedZoneId === opt.id && ( <tr> <td colSpan={10} className="p-4 bg-slate-50 dark:bg-slate-800/50"> <div className="flex justify-between items-center mb-3"> <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Map size={14}/> المدن التابعة لـ {opt.label}</h4> <button onClick={() => setManagingZoneId(opt.id)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"><ListChecks size={14}/> تحديد المدن المتاحة</button> </div> <p className="text-xs text-slate-400 italic text-center py-2">استخدم زر "تحديد المدن" لإضافة أو حذف مدن من هذه المنطقة.</p> </td> </tr> )}
              </React.Fragment>
            )})}
          </tbody>
        </table>
      </div>
      {managingZone && <CityManagerModal isOpen={!!managingZoneId} onClose={() => setManagingZoneId(null)} zone={managingZone} onSave={handleUpdateZoneCities} />}
    </SectionCard>
  );
};

const CompanyFinancialsEditor: React.FC<any> = ({ companyName, settings, setSettings }) => {
    const companyFees = settings.companySpecificFees[companyName] || { useCustomFees: false };
    const handleCompanyFeeChange = (field: keyof CompanyFees, value: any) => { setSettings((prev: Settings) => ({ ...prev, companySpecificFees: { ...prev.companySpecificFees, [companyName]: { ...prev.companySpecificFees[companyName], [field]: value } } })); };
    return (
        <SectionCard title={`الإعدادات المالية لـ ${companyName}`} icon={<Wallet size={22} />}>
            <div className="space-y-6">
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200">
                    <div> <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">تفعيل إعدادات مالية خاصة</span> <p className="text-xs text-emerald-600 font-medium">تجاهل القيم العامة واستخدام قيم مخصصة لهذه الشركة.</p> </div>
                    <ToggleButton active={companyFees.useCustomFees} onToggle={() => handleCompanyFeeChange('useCustomFees', !companyFees.useCustomFees)} variant="emerald" />
                </div>
                <div className={`space-y-6 ${!companyFees.useCustomFees && 'opacity-40 pointer-events-none grayscale'}`}>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> {/* تم التحديث لـ 4 أعمدة لإضافة الوزن */}
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500">التأمين %</label><input type="number" value={companyFees.insuranceFeePercent || 0} onChange={(e) => handleCompanyFeeChange('insuranceFeePercent', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 rounded-xl font-bold" /></div>
                        
                        {/* الخانة الجديدة: الوزن الافتراضي */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-indigo-600">الوزن الافتراضي (كجم)</label>
                            <input type="number" value={companyFees.baseWeight || 1} onChange={(e) => handleCompanyFeeChange('baseWeight', Number(e.target.value))} className="w-full p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 rounded-xl font-bold text-indigo-700" placeholder="مثلاً 5" />
                        </div>

                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500">المعاينة ج.م</label><input type="number" value={companyFees.inspectionFee || 0} onChange={(e) => handleCompanyFeeChange('inspectionFee', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 rounded-xl font-bold" /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500">مرتجع ثابت ج.م</label><input type="number" value={companyFees.returnShippingFee || 0} onChange={(e) => handleCompanyFeeChange('returnShippingFee', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 rounded-xl font-bold" /></div>
                    </div>
                     <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-xl border border-amber-200 space-y-4">
                        <div className="flex justify-between items-center"><span className="text-sm font-bold text-amber-900 dark:text-amber-300">رسوم COD</span><ToggleButton active={companyFees.enableCodFees} onToggle={() => handleCompanyFeeChange('enableCodFees', !companyFees.enableCodFees)} variant="amber" /></div>
                        <div className={`grid grid-cols-3 gap-3 ${!companyFees.enableCodFees && 'opacity-40 grayscale pointer-events-none'}`}>
                            <CodInput label="حد المجاني" value={companyFees.codThreshold || 0} onChange={(val) => handleCompanyFeeChange('codThreshold', val)} />
                            <CodInput label="النسبة %" value={companyFees.codFeeRate || 0} step="0.01" onChange={(val) => handleCompanyFeeChange('codFeeRate', val)} />
                            <CodInput label="الضريبة %" value={companyFees.codTaxRate || 0} step="0.1" onChange={(val) => handleCompanyFeeChange('codTaxRate', val)} />
                        </div>
                    </div>
                     <div className="pt-6 border-t border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-4">سياسات التسعير المتقدمة</h4>
                        <div className="space-y-4">
                            <PolicyToggle label="تفعيل تسعير الاستبدال" description="يضيف عمود 'سعر الاستبدال' في جدول تسعير المناطق." active={companyFees.enableExchange} onToggle={() => handleCompanyFeeChange('enableExchange', !companyFees.enableExchange)} />
                            <PolicyToggle label="تفعيل تسعير الإرجاع بعد المعاينة" description="يضيف عمود 'سعر الإرجاع بعد المعاينة' في جدول تسعير المناطق." active={companyFees.enableReturnAfter} onToggle={() => handleCompanyFeeChange('enableReturnAfter', !companyFees.enableReturnAfter)} />
                            <PolicyToggle label="تفعيل تسعير الإرجاع بدون معاينة" description="يضيف عمود 'سعر الإرجاع بدون معاينة' في جدول تسعير المناطق." active={companyFees.enableReturnWithout} onToggle={() => handleCompanyFeeChange('enableReturnWithout', !companyFees.enableReturnWithout)} />
                            <PolicyToggle label="تطبيق رسوم مرتجع ثابتة" description="يخصم مبلغ 'مرتجع ثابت' كخسارة إضافية عند إرجاع أي طلب." active={companyFees.enableFixedReturn} onToggle={() => handleCompanyFeeChange('enableFixedReturn', !companyFees.enableFixedReturn)} />
                        </div>
                     </div>
                </div>
            </div>
        </SectionCard>
    );
};

const FinancialCard: React.FC<any> = ({ label, name, value, isActive, onToggle, onChange, icon, desc }) => ( <div className={`p-5 rounded-2xl border transition-all ${isActive ? 'bg-white dark:bg-slate-800/30 border-slate-300' : 'bg-slate-100 border-slate-200 opacity-60'}`}> <div className="flex items-center justify-between mb-4"> <label className="text-sm font-black text-slate-800 dark:text-slate-300 flex items-center gap-2">{icon} {label}</label> <ToggleButton active={isActive} onToggle={onToggle} /> </div> <div className="relative"> <input type="number" name={name} disabled={!isActive} className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 rounded-xl outline-none font-black dark:text-white transition-all" value={value} onChange={onChange} /> </div> <p className="text-[10px] text-slate-500 mt-3 leading-relaxed font-bold">{desc}</p> </div> );
const CodInput: React.FC<any> = ({ label, value, onChange, step = "1" }) => ( <div className="space-y-1"> <label className="text-[10px] font-black text-amber-700 uppercase tracking-tight">{label}</label> <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-2 py-2.5 bg-white dark:bg-slate-800 border border-amber-300 rounded-xl text-sm outline-none font-black dark:text-white" /> </div> );

export default ShippingPage;
