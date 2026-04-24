import React, { useState, useEffect } from 'react';
import { AlertCircle, Globe, CheckCircle2, ChevronRight, Link2, FileText, Plus, Edit2, Trash2, Copy } from "lucide-react";
import { supabase } from '../../services/supabaseClient';

interface DomainSettingsPageProps {
  activeStoreId: string;
  storeData: any;
  onUpdateStoreData: (data: any) => void;
}

export const DomainSettingsPage: React.FC<DomainSettingsPageProps> = ({ activeStoreId, storeData, onUpdateStoreData }) => {
  const [domain, setDomain] = useState(storeData?.customDomain || '');
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{available: boolean, price: string, domain: string, suggestions: {domain: string}[]} | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const searchDomain = async () => {
    setIsSearching(true);
    try {
        const response = await fetch(`/api/search-domain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: searchQuery })
        });
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON response (Status: ${response.status}): ${responseText.substring(0, 200)}`);
        }
        setSearchResult(data);
    } catch (e) {
        console.error('Search error:', e);
    } finally {
        setIsSearching(false);
    }
  };

  const buyDomain = async (domain: string) => {
    setIsPurchasing(true);
    try {
        const response = await fetch(`/api/buy-domain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, paymentMethodId: 'PM-123' })
        });
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 50)}...`);
        }
        if (data.success) {
            alert(data.message);
        } else {
            alert('حدث خطأ أثناء الشراء: ' + data.error);
        }
    } catch (e) {
        console.error('Purchase error:', e);
        alert('حدث خطأ في الاتصال');
    } finally {
        setIsPurchasing(false);
    }
  };
  const [newDomain, setNewDomain] = useState(domain);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  };
  const [isAddRedirectModalOpen, setIsAddRedirectModalOpen] = useState(false);
  const [newRedirect, setNewRedirect] = useState({ old_path: '', new_path: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [redirects, setRedirects] = useState<any[]>([]); // Added redirects state

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('تم نسخ القيمة إلى الحافظة');
  };

  // Fetch redirects
  useEffect(() => {
      const fetchRedirects = async () => {
          const { data, error } = await supabase
              .from('url_redirects')
              .select('*')
              .eq('store_id', activeStoreId);
          
          if (error) console.error('Error fetching redirects:', error);
          else setRedirects(data || []);
      };
      
      fetchRedirects();
  }, [activeStoreId]);
  
  // Robots Editor State
  const [isRobotsModalOpen, setIsRobotsModalOpen] = useState(false);
  const [robotsContent, setRobotsContent] = useState(storeData?.robots_txt_content || 'User-agent: *\nDisallow:');
  const [isSavingRobots, setIsSavingRobots] = useState(false);

  const handleAddRedirect = async () => {
    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('url_redirects')
        .insert([{ 
            store_id: activeStoreId, 
            old_path: newRedirect.old_path, 
            new_path: newRedirect.new_path 
        }])
        .select();

      if (error) throw error;
      setRedirects([...redirects, ...data]);
      setNewRedirect({ old_path: '', new_path: '' });
      setIsAddRedirectModalOpen(false);
    } catch (error) {
      console.error('Error adding redirect:', error);
      showNotification('error', 'حدث خطأ أثناء إضافة الرابط.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveRobots = async () => {
    setIsSavingRobots(true);
    try {
      const { error } = await supabase
        .from('stores_data')
        .update({ robots_txt_content: robotsContent })
        .eq('id', activeStoreId);

      if (error) throw error;
      onUpdateStoreData({ ...storeData, robots_txt_content: robotsContent });
      setIsRobotsModalOpen(false);
    } catch (error) {
      console.error('Error saving robots.txt:', error);
      showNotification('error', 'حدث خطأ أثناء حفظ الملف.');
    } finally {
      setIsSavingRobots(false);
    }
  };

  const handleDeleteRedirect = async (id: number) => {
    try {
      const { error } = await supabase
        .from('url_redirects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRedirects(redirects.filter(r => r.id !== id));
      showNotification('success', 'تم حذف الرابط بنجاح.');
    } catch (error) {
      console.error('Error deleting redirect:', error);
      showNotification('error', 'حدث خطأ أثناء حذف الرابط.');
    }
  };

  const handleSaveDomain = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('stores_data')
        .update({ customDomain: newDomain })
        .eq('id', activeStoreId);

      if (error) throw error;

      onUpdateStoreData({ ...storeData, customDomain: newDomain });
      setDomain(newDomain);
      setIsVerifying(true); // Switch to verification view after saving
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving domain:', error);
      showNotification('error', 'حدث خطأ أثناء حفظ النطاق.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded text-white ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {notification.text}
        </div>
      )}

      <h1 className="text-2xl font-bold">النطاق</h1>
      
      {/* Verification Banner */}
      {!isVerifying && domain && (
        <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg text-amber-800 flex items-center gap-3">
            <AlertCircle className="w-5 h-5"/>
            <span>نطاقك {domain} يحتاج إلى التحقق. <button onClick={() => setIsVerifying(true)} className="underline font-bold">تحقق الآن</button></span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => setIsBuyModalOpen(true)} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-md transition">
          <span className="flex items-center gap-3 font-medium"><Globe className="w-5 h-5 text-blue-600"/> شراء اسم نطاق جديد</span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <button className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-md transition">
          <span className="flex items-center gap-3 font-medium"><Link2 className="w-5 h-5 text-blue-600"/> ربط اسم نطاق موجود بالفعل</span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Current Domain Card */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">تم الربط</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">{domain}</code>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="text-blue-600 flex items-center gap-1 text-sm"><Edit2 className="w-4 h-4"/> تعديل</button>
        </div>
      </div>
      
      {/* Buy Domain Modal */}
      {isBuyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-6">اشترِ اسم نطاق جديد</h2>
            <div className="flex gap-2 mb-6">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="example.com" className="flex-1 border rounded p-2" />
              <button onClick={searchDomain} className="bg-emerald-600 text-white px-6 py-2 rounded">
                 {isSearching ? 'جاري البحث...' : 'ابحث'}
              </button>
            </div>
            
            {searchResult && (
                <div className={`p-4 mb-4 rounded ${searchResult.available ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    <p className="font-bold">
                        {searchResult.available ? `النطاق متاح بسعر $${searchResult.price}` : 'النطاق غير متاح!'}
                    </p>
                    {searchResult.available && <button onClick={() => buyDomain(searchResult.domain)} disabled={isPurchasing} className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded">{isPurchasing ? 'جاري الشراء...' : 'شراء الآن'}</button>}
                    
                    {searchResult.suggestions && searchResult.suggestions.length > 0 && (
                        <div className="mt-4">
                            <p className="font-semibold mb-2">اقتراحات بديلة:</p>
                            <div className="grid gap-2">
                                {searchResult.suggestions.map((s: any) => (
                                    <div key={s.domain} className="flex justify-between items-center bg-white p-2 border rounded">
                                        <span>{s.domain}</span>
                                        <button onClick={() => buyDomain(s.domain)} disabled={isPurchasing} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm">{isPurchasing ? '...' : 'شراء'}</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsBuyModalOpen(false)} className="px-4 py-2 border rounded">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Domain Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-xl font-bold mb-4">تعديل النطاق</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم النطاق</label>
                <input 
                  type="text" 
                  value={newDomain} 
                  onChange={(e) => setNewDomain(e.target.value)} 
                  placeholder="example.com"
                  className="w-full border rounded p-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-50">إلغاء</button>
                <button 
                  onClick={handleSaveDomain} 
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Panel */}
      {isVerifying && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">لم يتم التحقق</span>
            <div className="flex gap-2">
              <button onClick={() => setIsVerifying(false)} className="px-4 py-2 border rounded hover:bg-gray-50">إلغاء</button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">تحقق</button>
            </div>
          </div>
          
          <h3 className="font-bold mb-4">الإرشادات</h3>
          <ol className="list-decimal list-inside space-y-4 mb-6 text-sm text-gray-700">
            <li>اذهب إلى لوحة التحكم في الموقع الذي يستضيف الدومين الخاص بك</li>
            <li>انتقل إلى إعدادات إدارة ملفات DNS الخاصة بالدومين</li>
            <li>أضف سجل (A record) جديد، ثم أضف القيم الجديدة من الجدول أدناه</li>
          </ol>

          {/* DNS Table */}
          <div className="border rounded-md overflow-hidden mb-6">
              <div className="grid grid-cols-4 bg-gray-50 p-3 text-sm font-semibold border-b">
                  <span>النوع</span><span>القيمة</span><span>Target</span><span className="text-center">TTL</span>
              </div>
              <div className="grid grid-cols-4 p-3 border-b text-sm">
                  <span>A</span><span>@</span><span>3.74.190.245</span><span className="text-center flex justify-center gap-1">38400 <button onClick={() => copyToClipboard('3.74.190.245')}><Copy/></button></span>
              </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-md border border-amber-200 flex items-start gap-3 mt-6">
            <AlertCircle className="text-amber-600 w-5 h-5" />
            <p className="text-sm text-amber-800">يحتاج الدومين 24 ساعة لربطه وليظهر موقعك أونلاين على مستوى العالم</p>
          </div>
        </div>
      )}
      
      {/* Robots Editor Modal */}
      {isRobotsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold mb-4">تعديل ملف Robots.txt</h2>
            <textarea 
              value={robotsContent} 
              onChange={(e) => setRobotsContent(e.target.value)}
              className="w-full border rounded p-2 mb-4 h-64 font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsRobotsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-50">إلغاء</button>
              <button 
                onClick={handleSaveRobots} 
                disabled={isSavingRobots}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingRobots ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Redirects Section */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Link2 className="w-5 h-5"/> إعادة التوجيه 301</h2>
            <button onClick={() => setIsAddRedirectModalOpen(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md flex items-center gap-1 hover:bg-blue-700">
                <Plus className="w-4 h-4"/> رابط إعادة توجيه جديد
            </button>
        </div>
        <p className="text-gray-500 text-sm">استخدمها لتوجيه عملائك ومحركات البحث إلى روابط جديدة بدل الروابط القديمة لمنتجاتك</p>
        <div className="p-8 border-2 border-dashed rounded-lg text-center text-gray-400">
            {redirects.length === 0 ? (
                "لم تضف أي روابط لإعادة التوجيه"
            ) : (
                <div className="space-y-2 text-right">
                    {redirects.map(r => (
                        <div key={r.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-gray-800">
                            <span>{r.old_path} <ChevronRight className="inline w-4 h-4"/> {r.new_path}</span>
                            <button onClick={() => handleDeleteRedirect(r.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Robots.txt Section */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5"/> محرر ملفات Robots.txt</h2>
        <p className="text-gray-500 text-sm">يمكنك تعديل ملف robots.txt لإعطاء إشارات لمحركات البحث للزحف إلى صفحات متجرك التي يجب أو لا يجب فهرستها</p>
        <button onClick={() => setIsRobotsModalOpen(true)} className="text-sm border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50">ابدأ في تعديل ملفات robots.txt</button>
      </div>
    </div>
  );
};
