import React, { useState } from 'react';
import { Settings, WebhookIntegration } from '../types';
import { Code, Webhook, Key, Trash, Plus, Save, Server, Shield, ShoppingCart, Copy, CheckCircle2 } from 'lucide-react';

interface DeveloperSettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStoreId?: string | null;
  hostUrl?: string;
}

const DeveloperSettingsPage: React.FC<DeveloperSettingsPageProps> = ({ settings, setSettings, activeStoreId, hostUrl }) => {
  const [integrations, setIntegrations] = useState<WebhookIntegration[]>(settings.webhookIntegrations || []);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedLink(text);
      setTimeout(() => setCopiedLink(null), 2000);
  };


  const addIntegration = () => {
    setIntegrations([...integrations, {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      storeUrl: '',
      webhookUrl: '',
      secretKey: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      isActive: true
    }]);
  };

  const removeIntegration = (id: string) => {
    setIntegrations(integrations.filter(i => i.id !== id));
  };

  const updateIntegration = (id: string, field: keyof WebhookIntegration, value: any) => {
    setIntegrations(integrations.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const saveSettings = () => {
    setSettings(prev => ({ ...prev, webhookIntegrations: integrations }));
    alert("تم حفظ الإعدادات بنجاح");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4">
      <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2 ml-2">أدوات المطورين </h1>
            <p className="text-slate-500 dark:text-slate-400">إدارة التكاملات وربط المتاجر الأخرى عبر Webhooks.</p>
          </div>
          <button 
            onClick={saveSettings}
            className="btn btn-primary shadow-lg shadow-primary/30 flex items-center gap-2"
          >
            <Save size={18} />
             حفظ
          </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
               <Webhook size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">إعدادات الـ Webhook</h2>
              <p className="text-sm text-slate-500">إرسال واستقبال الطلبات من وإلى المتاجر الأخرى.</p>
            </div>
          </div>
          <button 
            onClick={addIntegration}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
           >
             <Plus size={16} /> اضافة رابط جديد
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {integrations.length === 0 ? (
            <div className="text-center py-10">
               <Webhook className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
               <h3 className="text-sm font-medium text-slate-900 dark:text-white">لا توجد روابط Webhooks مضافة</h3>
               <p className="mt-1 text-sm text-slate-500">قم بإضافة رابط جديد للربط مع متجر آخر.</p>
            </div>
          ) : (
             integrations.map((integration, index) => (
                <div key={integration.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative bg-slate-50/50 dark:bg-slate-800/20">
                   <div className="absolute top-4 left-4 flex gap-2">
                     <span className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={integration.isActive} onChange={(e) => updateIntegration(integration.id, 'isActive', e.target.checked)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                        </label>
                     </span>
                     <button onClick={() => removeIntegration(integration.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-lg transition-colors">
                        <Trash size={16} />
                     </button>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Server size={14} /> رابط المتجر الآخر (إختياري للاستدلال)</label>
                         <input 
                           type="text" 
                           placeholder="https://other-store.com"
                           className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white"
                           value={integration.storeUrl}
                           onChange={(e) => updateIntegration(integration.id, 'storeUrl', e.target.value)}
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Webhook size={14} /> رابط الـ Webhook (لاستقبال الطلب)</label>
                         <input 
                           type="text" 
                           placeholder="https://.../api/webhook/orders"
                           className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white"
                           value={integration.webhookUrl}
                           onChange={(e) => updateIntegration(integration.id, 'webhookUrl', e.target.value)}
                         />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                         <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Shield size={14} /> رمز الأمان (Secret Key)</label>
                         <div className="relative">
                           <input 
                             type="text" 
                             readOnly
                             className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono outline-none"
                             value={integration.secretKey}
                           />
                         </div>
                      </div>
                   </div>
                   <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      إذا كان المتجر الآخر سيقوم بإنشاء طلبات في متجرك، قدم له <strong>رابط متجرك</strong>، ويجب عليه أن يرسل طلب من نوع <code>POST</code> إلى:
                      <br/> 
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-slate-100 dark:bg-black text-primary px-1.5 py-0.5 rounded font-mono inline-block w-full overflow-x-auto whitespace-nowrap" dir="ltr">
                          https://keqmlcqymkohxzcouxfi.supabase.co/functions/v1/webhook?storeId={activeStoreId || 'YOUR_STORE_ID'}
                        </code>
                        <button onClick={() => handleCopy(`https://keqmlcqymkohxzcouxfi.supabase.co/functions/v1/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}`)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                           {copiedLink === `https://keqmlcqymkohxzcouxfi.supabase.co/functions/v1/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}` ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                      </div>
                   </div>
                </div>
             ))
          )}
        </div>
      </div>

      {/* E-commerce Platforms Integrations */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
               <ShoppingCart size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">تكامل منصات التجارة الإلكترونية</h2>
              <p className="text-sm text-slate-500">استخدم هذه الروابط لربط متجرك بمنصات مثل ويلت (Wuilt) وغيرها.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative bg-slate-50/50 dark:bg-slate-800/20">
             <h3 className="font-bold text-slate-800 dark:text-white text-md mb-2 flex items-center gap-2">
               منصة ويلت (Wuilt)
             </h3>
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed max-w-2xl">
               قم بنسخ الرابط التالي وإضافته في إعدادات متجرك على ويلت (قسم Webhooks) لاختيار الأحداث مثل (Order Created) لكي تنزل الطلبات تلقائياً هنا.
             </p>

             <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Webhook size={14} /> رابط Webhook Edge Function المشفر</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    readOnly
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono outline-none"
                    value={`https://keqmlcqymkohxzcouxfi.supabase.co/functions/v1/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}&platform=wuilt`}
                  />
                  <button 
                    onClick={() => handleCopy(`https://keqmlcqymkohxzcouxfi.supabase.co/functions/v1/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}&platform=wuilt`)} 
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    title="نسخ الرابط"
                  >
                     {copiedLink === `https://keqmlcqymkohxzcouxfi.supabase.co/functions/v1/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}&platform=wuilt` ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                </div>
             </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative bg-slate-50/50 dark:bg-slate-800/20 opacity-70">
             <h3 className="font-bold text-slate-800 dark:text-white text-md mb-2 flex items-center gap-2">
               منصات أخرى قريباً (Salla, Zid, Shopify)
             </h3>
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed max-w-2xl">
               سيتم إضافة تكاملات مخصصة لهذه المنصات في المستقبل القريب. تستخدم Edge Functions لضمان أعلى سرعة في المزامنة وأمان لبياناتك.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperSettingsPage;
