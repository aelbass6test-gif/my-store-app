import React, { useState } from 'react';
import { Settings, Collection } from '../types';
import { Grid3x3, Plus, Trash2, Edit3, Image as ImageIcon, X } from 'lucide-react';

interface CollectionsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const CollectionsPage: React.FC<CollectionsPageProps> = ({ settings, setSettings }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [formData, setFormData] = useState<Partial<Collection>>({ name: '', description: '', image: '' });

  const handleModalSave = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name) return;

      const newCollection: Collection = {
          id: editingCollection ? editingCollection.id : Date.now().toString(),
          name: formData.name,
          description: formData.description,
          image: formData.image
      };

      if (editingCollection) {
          setSettings(prev => ({
              ...prev,
              collections: prev.collections.map(c => c.id === editingCollection.id ? newCollection : c)
          }));
      } else {
          setSettings(prev => ({
              ...prev,
              collections: [...prev.collections, newCollection]
          }));
      }
      
      handleClose();
  };

  const handleEdit = (collection: Collection) => {
      setEditingCollection(collection);
      setFormData(collection);
      setShowModal(true);
  };

  const handleDelete = (id: string) => {
      if(!window.confirm("هل أنت متأكد من حذف هذا القسم؟ لن يتم حذف المنتجات، ولكن سيتم فك ربطها.")) return;
      
      setSettings(prev => ({
          ...prev,
          collections: prev.collections.filter(c => c.id !== id),
          // Unlink products
          products: prev.products.map(p => p.collectionId === id ? { ...p, collectionId: undefined } : p)
      }));
  };

  const handleClose = () => {
      setShowModal(false);
      setEditingCollection(null);
      setFormData({ name: '', description: '', image: '' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl"><Grid3x3 size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">مجموعات المنتجات</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">نظم منتجاتك في أقسام (مثل: رجالي، إلكترونيات) لتسهيل التصفح.</p>
                </div>
            </div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"><Plus size={20}/> إضافة مجموعة</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(settings.collections || []).map(collection => (
                <div key={collection.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
                    <div className="h-32 bg-slate-100 dark:bg-slate-800 relative">
                        {collection.image ? (
                            <img src={collection.image} alt={collection.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><ImageIcon size={32}/></div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(collection)} className="p-2 bg-white/90 dark:bg-slate-900/90 text-blue-600 rounded-lg hover:text-blue-700"><Edit3 size={16}/></button>
                            <button onClick={() => handleDelete(collection.id)} className="p-2 bg-white/90 dark:bg-slate-900/90 text-red-500 rounded-lg hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <div className="p-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{collection.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{collection.description || 'لا يوجد وصف'}</p>
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-bold">
                            {settings.products.filter(p => p.collectionId === collection.id).length} منتجات
                        </div>
                    </div>
                </div>
            ))}
            {settings.collections.length === 0 && (
                <div className="md:col-span-3 text-center py-12 text-slate-400">لا توجد مجموعات مضافة.</div>
            )}
        </div>

        {showModal && (
            <div className="fixed inset-0 z-[120] flex flex-col bg-slate-50 dark:bg-slate-900 overflow-y-auto" dir="rtl">
                <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10 flex justify-between items-center px-8">
                    <div className="flex items-center gap-3">
                        <button onClick={handleClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
                            <span className="text-sm font-bold flex items-center gap-1">المجموعات &gt;</span>
                        </button>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white">
                            {editingCollection ? 'تعديل مجموعة' : 'إنشاء مجموعة'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleClose} className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">إلغاء</button>
                        <button onClick={handleModalSave} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700">حفظ</button>
                    </div>
                </div>

                <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Right Column: Details & SEO */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Details */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="font-bold text-lg mb-4 dark:text-white">معلومات</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">الاسم</label>
                                        <input 
                                            type="text" 
                                            value={formData.name} 
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                            placeholder="عنوان المجموعة مطلوب"
                                        />
                                        {!formData.name && <p className="text-xs text-red-500 mt-1">عنوان المجموعة مطلوب</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">الوصف</label>
                                        <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden flex flex-col">
                                            {/* Fake Editor Toolbar */}
                                            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-600 p-2 flex gap-2 items-center text-slate-600 dark:text-slate-400">
                                                <button type="button" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><strong className="text-serif">B</strong></button>
                                                <button type="button" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><em className="text-serif">I</em></button>
                                                <button type="button" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><u className="text-serif">U</u></button>
                                            </div>
                                            <textarea 
                                                value={formData.description} 
                                                onChange={e => setFormData({...formData, description: e.target.value})}
                                                className="w-full p-4 h-48 outline-none bg-white dark:bg-slate-800 resize-none"
                                                placeholder="أدخل الوصف هنا..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEO Form */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="font-bold text-lg mb-4 dark:text-white">التهيئة لمحركات البحث (SEO)</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">رابط URL لمجموعة المنتجات</label>
                                        <div className="flex border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden direction-ltr">
                                            <span className="bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-500 border-r border-slate-300 dark:border-slate-600 truncate max-w-[150px] sm:max-w-xs">/https://yourstore.com/collection</span>
                                            <input 
                                                type="text" 
                                                value={formData.slug || ''} 
                                                onChange={e => setFormData({...formData, slug: e.target.value})}
                                                className="flex-1 p-2.5 outline-none bg-white dark:bg-slate-800 min-w-0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">الاسم</label>
                                            <span className="text-xs text-slate-400">أقصى حد 60 حرفاً</span>
                                        </div>
                                        <input 
                                            type="text" 
                                            value={formData.seoTitle || ''} 
                                            onChange={e => setFormData({...formData, seoTitle: e.target.value})}
                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">الوصف</label>
                                            <span className="text-xs text-slate-400">الحد الأقصى 160 حرف</span>
                                        </div>
                                        <textarea 
                                            value={formData.seoDescription || ''} 
                                            onChange={e => setFormData({...formData, seoDescription: e.target.value})}
                                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none h-24 resize-none"
                                            placeholder="يساعد وصف الميتا للمتجر في إعطاء العميل فكرة عن مشروعك، كما يساعدك في تصدر نتائج البحث..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Left Column: Image */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="font-bold text-lg mb-4 dark:text-white">صورة</h3>
                                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                                    {formData.image ? (
                                        <div className="relative group w-full h-48">
                                            <img src={formData.image} className="w-full h-full object-contain" alt="Preview"/>
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({...formData, image: ''})}
                                                className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"
                                            >
                                                <X size={32}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <ImageIcon size={40} className="text-teal-600 mb-3" />
                                            <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-sm mb-3">أضف صورة</button>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                الصيغة المدعومة: jpg, png, webp, and gif<br/>
                                                أو اسحب الصورة إلى هنا
                                            </p>
                                        </>
                                    )}
                                </div>
                                <div className="mt-4">
                                     <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">أو أدخل رابط الصورة</label>
                                     <input type="text" placeholder="https://..." className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg dir-ltr text-right" value={formData.image || ''} onChange={e => setFormData({...formData, image: e.target.value})} />
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CollectionsPage;
