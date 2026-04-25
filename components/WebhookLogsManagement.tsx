import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

import { apiCall, SUPABASE_PROJECT_URL } from '../services/apiService';

export const WebhookLogsPage: React.FC<{ activeStoreId?: string }> = ({ activeStoreId }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'settings'>('logs');
    const storeId = activeStoreId || "store-default"; // Fallback
    
    return (
        <div className="p-6">
            <h2 className="text-2xl font-black mb-6">إدارة الـ Webhooks</h2>
            
            <div className="flex gap-4 mb-6">
                <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>السجلات</button>
                <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>الإعدادات</button>
            </div>

            {activeTab === 'logs' ? <LogsList storeId={storeId} /> : <SettingsForm storeId={storeId} />}
        </div>
    );
};

const LogsList = ({ storeId }: { storeId: string }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    
    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('webhook_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (storeId && storeId !== "store-default") {
                query = query.eq('store_id', storeId);
            }

            const { data, error: supabaseError } = await query;
            
            if (supabaseError) {
                console.error("Supabase Logs Fetch Error:", supabaseError);
                setError(supabaseError.message);
            } else {
                setLogs(data || []);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [storeId]);

    const handleRetry = async (log: any) => {
        setLoading(true);
        try {
            // Using apiCall to route correctly to Edge Functions in production
            const response = await apiCall(`/api/webhook/wuilt?storeId=${log.store_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(log.payload)
            });
            if (response.ok) {
                alert('تمت إعادة المعالجة بنجاح!');
                fetchLogs();
            } else {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'فشل في إعادة المعالجة');
            }
        } catch (e: any) {
            alert(`خطأ: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading && logs.length === 0) return <div className="p-10 text-center text-slate-500">جاري تحميل السجلات...</div>;
    if (error) return <div className="p-10 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">حدث خطأ: {error}</div>;

    return (
        <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <span className="font-bold text-slate-700">آخر العمليات ({logs.length})</span>
                    <button onClick={fetchLogs} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
                {logs.length === 0 ? (
                    <div className="p-10 text-center space-y-4">
                        <div className="text-slate-400">لا توجد سجلات حالياً لهذا المتجر.</div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-700 text-right space-y-2">
                            <p className="font-bold underline">تأكد من الآتي:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>تم إنشاء جدول <code className="bg-white px-1">webhook_logs</code> في Supabase.</li>
                                <li>رابط الـ Webhook في منصة wuilt يشير إلى رابط التطبيق الخاص بك (أو رابط Supabase Edge Function المباشر).</li>
                                <li>تم تنفيذ عمليات (مثل إنشاء طلب جديد) لتوليد سجلات.</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 text-slate-500">
                                    <th className="p-4">المنصة</th>
                                    <th className="p-4">الحالة</th>
                                    <th className="p-4">التوقيت</th>
                                    <th className="p-4 text-left">التفاصيل</th>
                                    <th className="p-4">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800">{log.platform}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold inline-block w-fit ${
                                                    log.status === 'processed' ? 'bg-green-100 text-green-700' : 
                                                    log.status === 'error' ? 'bg-red-100 text-red-700' : 
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {log.status === 'processed' ? 'تمت بنجاح' : log.status === 'error' ? 'خطأ' : 'مستلم'}
                                                </span>
                                                {log.error_details && <span className="text-[10px] text-red-400 truncate max-w-[150px]">{log.error_details}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 text-xs whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString('ar-EG')}
                                        </td>
                                        <td className="p-4 text-left">
                                            <button 
                                                onClick={() => setSelectedLog(log)}
                                                className="text-indigo-600 hover:underline text-xs font-bold"
                                            >
                                                عرض البيانات (JSON)
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {log.status === 'error' && (
                                                    <button 
                                                        disabled={loading} 
                                                        onClick={() => handleRetry(log)} 
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                                        title="إعادة المحاولة"
                                                    >
                                                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal for JSON payload */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">بيانات الـ Webhook (#{selectedLog.id})</h3>
                            <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-slate-900 text-green-400 font-mono text-xs leading-relaxed ltr" dir="ltr">
                            <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                            {selectedLog.error_details && (
                                <div className="mt-4 p-3 bg-red-900/30 border border-red-900/50 text-red-400 rounded">
                                    <p className="font-bold mb-1">تفاصيل الخطأ:</p>
                                    <p>{selectedLog.error_details}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t flex justify-end gap-3 bg-slate-50">
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const SettingsForm = ({ storeId }: { storeId: string }) => {
    const [platform, setPlatform] = useState('wuilt');
    const [secret, setSecret] = useState('');
    const [waUrl, setWaUrl] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');

    useEffect(() => {
        // Construct visual webhook URL for the user - Direct to Supabase in Production
        const isDev = window.location.hostname.includes('ais-dev') || window.location.hostname.includes('localhost');
        if (isDev) {
            const baseUrl = window.location.origin.replace('ais-dev', 'ais-pre'); 
            setWebhookUrl(`${baseUrl}/api/webhook/wuilt?storeId=${storeId}`);
        } else {
            // In production, give them the direct Supabase Edge Function URL
            setWebhookUrl(`${SUPABASE_PROJECT_URL}/functions/v1/wuilt-webhook?storeId=${storeId}`);
        }
        
        const fetchSettings = async () => {
            const { data } = await supabase.from('webhook_settings').select('*').eq('store_id', storeId).eq('platform', 'wuilt').single();
            if (data) {
                setSecret(data.secret_key || '');
                setWaUrl(data.whatsapp_api_url || '');
            }
        };
        fetchSettings();
    }, [storeId]);

    const saveSettings = async () => {
        const { error } = await supabase.from('webhook_settings').upsert({ 
            store_id: storeId, 
            platform, 
            secret_key: secret, 
            whatsapp_api_url: waUrl 
        }, { onConflict: 'store_id,platform' });
        
        if (error) {
            console.error(error);
            alert('فشل الحفظ: ' + error.message);
        } else {
            alert('تم حفظ إعدادات هذا المتجر بنجاح!');
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('تم النسخ إلى الحافظة');
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg text-slate-800">رابط الـ Webhook الخاص بك</h3>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-mono">POST</span>
                </div>
                <p className="text-xs text-slate-500">قم بنسخ هذا الرابط ووضعه في إعدادات Wuilt (Webhooks):</p>
                <div className="flex gap-2">
                    <input 
                        readOnly 
                        value={webhookUrl} 
                        className="flex-1 p-2 bg-slate-50 border rounded text-xs font-mono text-slate-600 outline-none" 
                    />
                    <button 
                        onClick={() => copyToClipboard(webhookUrl)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                        نسخ
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 border-b pb-2">إعدادات الأمان والتنبيهات (لحساب: {storeId})</h3>
                
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">المنصة</label>
                    <input className="w-full p-2 border rounded bg-slate-50" readOnly value={platform} />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">السر السري (Secret Key)</label>
                    <input 
                        className="w-full p-2 border rounded" 
                        placeholder="اختياري - للتحقق من التوقيع" 
                        value={secret} 
                        onChange={(e) => setSecret(e.target.value)} 
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">رابط تنبيهات الواتساب (API URL)</label>
                    <input 
                        className="w-full p-2 border rounded" 
                        placeholder="https://api.whatsapp.com/send?phone=xxx..." 
                        value={waUrl} 
                        onChange={(e) => setWaUrl(e.target.value)} 
                    />
                </div>

                <button 
                    onClick={saveSettings} 
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
                >
                    حفظ الإعدادات
                </button>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3 text-amber-800">
                <AlertCircle className="shrink-0" size={20} />
                <div className="text-xs leading-relaxed">
                    <p className="font-bold mb-1">تعليمات هامة:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>تأكد من اختيار حدث <b>Order Placed</b> في منصة Wuilt.</li>
                        <li>يتم تحويل حالة الطلب تلقائياً إلى <b>"في انتظار المكالمة"</b> بمجرد وصوله.</li>
                        <li>إذا لم تظهر السجلات، جرب إرسال "طلب تجريبي" من منصة Wuilt.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default WebhookLogsPage;
