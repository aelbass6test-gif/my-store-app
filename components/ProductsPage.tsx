import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package, Plus, Trash2, Edit3, Save, XCircle, Search, AlertCircle, Barcode, DollarSign, Scale, Wallet, RefreshCw, ServerOff, Image as ImageIcon, CheckCircle, Clock, Download, Layers, Grid3x3, Wand2, FileText, Copy, ChevronsUpDown, Percent, Upload, FileUp, ListChecks, FileWarning, HandCoins, Info, X, LayoutList, Settings as SettingsIcon, ChevronDown, ChevronLeft } from 'lucide-react';
import { Settings, Product, ProductVariant } from '../types';
import { motion, Variants } from 'framer-motion';
import { generateProductDescription, generateSocialMediaPost } from '../services/geminiService';
import { apiCall } from '../services/apiService';
import { browserSyncPlatform, fetchWuiltProducts } from '../services/platformService';
import { supabase } from '../services/supabaseClient';
import { databaseService } from '../services/databaseService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

import { BackgroundTask } from '../types';

interface ProductsPageProps {
  settings: Settings;
  setSettings: (updater: React.SetStateAction<Settings>) => void;
  activeStoreId: string | null;
  onRefresh?: () => void;
  forceSync?: () => Promise<void>;
  addTask?: (task: BackgroundTask) => void;
  updateTask?: (taskId: string, updates: Partial<BackgroundTask>) => void;
  logActivity?: (action: string, details: string, type?: any) => void;
}

const ProductsPage: React.FC<ProductsPageProps> = React.memo(({ settings, setSettings, activeStoreId, onRefresh, forceSync, addTask, updateTask, logActivity }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ sku: '', name: '', price: 0, weight: 1, costPrice: 0, stockQuantity: 10, collectionId: '', description: '', images: [], thumbnail: '', hasVariants: false, options: [], variants: [], profitMode: 'manual', profitPercentage: 0, basePrice: 0, commissionPercentage: 0 });
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string | null }>({ type: 'idle', message: null });
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    const saved = localStorage.getItem('lastProductSync');
    return saved ? new Date(saved) : null;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [generatedPost, setGeneratedPost] = useState('');
  
  // States for selective sync / Sync Center
  const [showSyncCenter, setShowSyncCenter] = useState(false);
  const [selectableProducts, setSelectableProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isFetchingSelectable, setIsFetchingSelectable] = useState(false);

  // States for the import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ products: Product[], errors: string[] } | null>(null);
  const [isParsingCsv, setIsParsingCsv] = useState(false);

  const isPlatformConnected = settings.integration?.platform !== 'none' || 
    Object.values(settings.platformConfigs || {}).some(config => config.isActive);

  const filteredProducts = settings.products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = editingProduct || newProduct;

    if (!productData.name || (!productData.hasVariants && !productData.price)) {
        alert("يرجى إدخال اسم المنتج وسعره على الأقل.");
        return;
    }

    let finalStock = productData.stockQuantity === undefined ? null : productData.stockQuantity;
    if (productData.hasVariants && productData.variants) {
        finalStock = productData.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
    }
    
    const productToSave: Product = {
        id: productData.id || `prod-${Date.now()}`,
        sku: productData.sku || `SKU-${Date.now()}`,
        name: productData.name!,
        shortDescription: productData.shortDescription || '',
        price: productData.price || 0,
        discountPrice: productData.discountPrice || undefined,
        weight: productData.weight || 1,
        length: productData.length || undefined,
        width: productData.width || undefined,
        height: productData.height || undefined,
        costPrice: productData.costPrice || 0,
        stockQuantity: finalStock,
        inStock: finalStock === null || finalStock > 0,
        collectionId: productData.collectionId || undefined,
        description: productData.description || '',
        images: productData.images || [],
        thumbnail: productData.thumbnail || '',
        isActive: productData.isActive !== false,
        seoTitle: productData.seoTitle || '',
        seoDescription: productData.seoDescription || '',
        slug: productData.slug || '',
        hasVariants: productData.hasVariants || false,
        options: productData.hasVariants ? (productData.options || []) : [],
        variants: productData.hasVariants ? (productData.variants || []) : [],
        
        profitMode: productData.profitMode || 'manual',
        profitPercentage: productData.profitPercentage || 0,
        basePrice: productData.basePrice || 0,
        commissionPercentage: productData.commissionPercentage || 0,
        useProfitPercentage: productData.profitMode === 'margin',
    };
    
    if (editingProduct) {
        setSettings(prev => ({ ...prev, products: prev.products.map(p => p.id === editingProduct.id ? productToSave : p) }));
        setEditingProduct(null);
    } else {
        setSettings(prev => ({ ...prev, products: [...prev.products, productToSave] }));
        setIsAdding(false);
    }

    if (activeStoreId) {
        try {
            const { id, name, sku, price, stockQuantity, ...details } = productToSave;
            await databaseService.upsertProduct({
                id, store_id: activeStoreId, name, sku, price, stock_quantity: stockQuantity, details
            });
        } catch (error) {
            console.error("Failed to direct-sync product:", error);
        }
    }
  };

  const confirmDelete = async () => {
    if (productToDelete) {
        try {
            await databaseService.deleteProduct(productToDelete.id);
            setSettings(prev => ({
                ...prev,
                products: prev.products.filter(p => p.id !== productToDelete.id)
            }));
            setProductToDelete(null);
        } catch (error) {
            console.error("Failed to delete product:", error);
            alert("حدث خطأ أثناء حذف المنتج.");
        }
    }
  };

  const handleGenerateDescription = async (isEdit: boolean) => {
      const targetProduct = isEdit ? editingProduct : newProduct;
      if (!targetProduct?.name || !targetProduct?.price) {
          alert("يرجى إدخال اسم المنتج وسعره أولاً.");
          return;
      }
      setIsGenerating(true);
      const desc = await generateProductDescription(targetProduct.name, targetProduct.price);
      if (isEdit) {
          setEditingProduct(p => p ? { ...p, description: desc } : null);
      } else {
          setNewProduct(p => ({ ...p, description: desc }));
      }
      setIsGenerating(false);
  };
  
  const handleGeneratePost = async (product: Product) => {
    if (!product.name || !product.price) return;
    setIsGenerating(true);
    const post = await generateSocialMediaPost(product.name, product.description || '', product.price);
    setGeneratedPost(post);
    setShowPostModal(true);
    setIsGenerating(false);
  };

  const handleFetchSelectableProducts = async (platform: string = 'wuilt') => {
    const config = settings.platformConfigs?.[platform] || (settings.integration?.platform === platform ? { ...settings.integration, isActive: true } : null);

    if (!config || !config.apiKey || config.isActive === false) {
      alert(`يرجى ضبط وتفعيل إعدادات الربط مع ${platform} أولاً من صفحة التطبيقات.`);
      return;
    }

    setIsFetchingSelectable(true);
    setSelectableProducts([]);
    try {
      if (!activeStoreId) throw new Error('المتجر النشط غير محدد');
      
      const response = await apiCall(`/api/sync/platform/${platform}/${activeStoreId}/preview?type=products`);
      if (response.ok) {
          const result = await response.json();
          setSelectableProducts(result.items || []);
          return;
      }

      const { data: dbConfig } = await supabase.from('platform_configs').select('apiKey, shopId').eq('store_id', activeStoreId).eq('platform_id', platform).single();
      if (dbConfig?.apiKey) {
          const products = await fetchWuiltProducts(dbConfig.apiKey, dbConfig.shopId);
          setSelectableProducts(products);
          return;
      }
      throw new Error(`تعذر جلب البيانات (Status: ${response.status})`);
    } catch (error: any) {
        console.error(`[ProductsPage] preview error:`, error.message);
        alert(`خطأ في جلب المنتجات: ${error.message}`);
    } finally {
      setIsFetchingSelectable(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedProductIds.size === 0) {
      alert('يرجى اختيار منتج واحد على الأقل.');
      return;
    }

    const selectedIds = Array.from(selectedProductIds);
    let platform: string | null = settings.integration?.platform !== 'none' ? settings.integration!.platform : null;
    
    if (!platform && settings.platformConfigs) {
       const activePlatform = Object.entries(settings.platformConfigs).find(([_, config]) => config.isActive);
       if (activePlatform) {
           platform = activePlatform[0];
       }
    }
    
    if (!platform) platform = 'wuilt'; // default to wuilt if something goes wrong
    
    // Create Background Task
    const taskId = `sync-${Date.now()}`;
    if (addTask) {
        addTask({
            id: taskId,
            name: `مزامنة منتجات ${platform}`,
            description: `جاري استيراد ${selectedIds.length} منتج من منصة ${platform}`,
            status: 'pending',
            progress: 0,
            type: 'sync_products',
            startTime: new Date().toISOString()
        });
    }

    setIsSyncing(true);
    setShowSyncCenter(false);
    if (logActivity) logActivity('بدء مزامنة', `تم بدء مزامنة ${selectedIds.length} منتج من منصة ${platform}`, 'sync');

    try {
      if (!activeStoreId) throw new Error('المتجر النشط غير محدد');
      
      if (updateTask) updateTask(taskId, { status: 'running', progress: 10 });
      
      const response = await apiCall(`/api/sync/platform/${platform}/${activeStoreId}?type=products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedIds })
      });

      if (response.ok) {
          const result = await response.json();
          if (updateTask) updateTask(taskId, { status: 'completed', progress: 100, endTime: new Date().toISOString() });
          if (onRefresh) onRefresh();
          if (logActivity) logActivity('اكتمال مزامنة', `اكتملت مزامنة ${result.processed || result.count} منتج بنجاح`, 'sync');
          setSyncStatus({ type: 'success', message: `تم استيراد ${result.processed || result.count} منتج بنجاح!` });
          return;
      }

      if (updateTask) updateTask(taskId, { progress: 50 });
      const result = await browserSyncPlatform(platform, activeStoreId, 'products', selectedIds);
      if (updateTask) updateTask(taskId, { status: 'completed', progress: 100, endTime: new Date().toISOString() });
      if (onRefresh) onRefresh();
      if (logActivity) logActivity('اكتمال مزامنة', `اكتملت المزامنة المحلية لـ ${result.count} منتج`, 'sync');
      setSyncStatus({ type: 'success', message: `تم استيراد ${result.count} منتج (محلياً) بنجاح!` });

    } catch (error: any) {
        if (updateTask) updateTask(taskId, { status: 'failed', error: error.message });
        if (logActivity) logActivity('فشل المزامنة', `حدث خطأ أثناء مزامنة المنتجات: ${error.message}`, 'sync');
        setSyncStatus({ type: 'error', message: error.message });
    } finally {
      setIsSyncing(false);
      setSelectedProductIds(new Set());
      setTimeout(() => setSyncStatus(s => s.type === 'success' ? { ...s, type: 'idle' } : s), 5000);
    }
  };

  const handleExportCSV = () => {
    const headers = ['name', 'sku', 'price', 'costPrice', 'stockQuantity', 'weight', 'description', 'image_url'];
    const rows = filteredProducts.map(p => [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.price,
        p.costPrice,
        p.stockQuantity,
        p.weight,
        `"${(p.description || '').replace(/"/g, '""').replace(/\n/g, '\\n')}"`,
        `"${(p.images && p.images.length > 0 ? p.images.join('\n') : p.thumbnail || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseCsv = (file: File) => {
    setIsParsingCsv(true);
    setImportPreview(null);
    const reader = new FileReader();

    reader.onload = (event) => {
        const errors: string[] = [];
        const importedProducts: Product[] = [];
        try {
            const text = event.target?.result as string;
            const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
            if (rows.length < 2) {
                setImportPreview({ products: [], errors: ['الملف فارغ أو لا يحتوي على بيانات.'] });
                setIsParsingCsv(false);
                return;
            }

            const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, '').replace(/_/g, ''));
            const headerMap: { [key: string]: number } = {};
            const fieldMap: { [csvHeader: string]: string } = {
                'productname': 'name', 'name': 'name',
                'price': 'price',
                'description': 'description',
                'imageurl': 'image_url', 'images': 'image_url'
            };

            headers.forEach((h, index) => {
                if (fieldMap[h]) headerMap[fieldMap[h]] = index;
            });

            if (headerMap.name === undefined || headerMap.price === undefined) {
                 errors.push(`الأعمدة المطلوبة (name, price) غير موجودة.`);
            } else {
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const cells = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                    const cleanCell = (val: string | undefined) => val ? val.replace(/^"|"$/g, '').trim() : '';
                    
                    const name = cleanCell(cells[headerMap.name!]);
                    const priceStr = cleanCell(cells[headerMap.price!]);

                    if (!name) { errors.push(`الصف ${i + 1}: اسم المنتج مفقود.`); continue; }
                    if (!priceStr) { errors.push(`الصف ${i + 1}: سعر المنتج مفقود.`); continue; }

                    const price = parseFloat(priceStr);
                    if (isNaN(price)) { errors.push(`الصف ${i + 1}: السعر غير صالح.`); continue; }

                    let thumbnail = '';
                    let images: string[] = [];
                    const imageUrlIndex = headerMap['image_url'];
                    if (imageUrlIndex !== undefined && cells[imageUrlIndex]) {
                        const urls = cleanCell(cells[imageUrlIndex]).split(/\s+/).map(u => u.trim()).filter(Boolean);
                        if (urls.length > 0) {
                            thumbnail = urls[0];
                            images = urls;
                        }
                    }

                    importedProducts.push({
                        id: `imported-${Date.now()}-${i}`,
                        name,
                        price,
                        description: headerMap.description !== undefined ? cleanCell(cells[headerMap.description]) : '',
                        thumbnail,
                        images,
                        sku: `SKU-IMP-${Date.now()}-${i}`,
                        costPrice: 0,
                        stockQuantity: 100, 
                        weight: 1, 
                        hasVariants: false, options: [], variants: [], inStock: true,
                    });
                }
            }
        } catch (err) {
            errors.push('حدث خطأ غير متوقع أثناء تحليل الملف.');
        } finally {
            setImportPreview({ products: importedProducts, errors });
            setIsParsingCsv(false);
        }
    };
    reader.readAsText(file, 'UTF-8');
  };
  
  const handleConfirmImport = () => {
    if (!importPreview || importPreview.products.length === 0) return;
    setSettings(prev => ({ ...prev, products: [...prev.products, ...importPreview.products] }));
    setIsImportModalOpen(false);
    setImportPreview(null);
    setSyncStatus({ type: 'success', message: `تم استيراد ${importPreview.products.length} منتج بنجاح!` });
    setTimeout(() => setSyncStatus(s => s.type === 'success' ? { ...s, type: 'idle' } : s), 5000);
  };
  
  const handleDownloadTemplate = () => {
    const headers = ['name', 'price', 'description', 'image_url'];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "product_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAddModal = () => {
    setNewProduct({ sku: '', name: '', price: 0, weight: 1, costPrice: 0, stockQuantity: 10, collectionId: '', description: '', images: [], thumbnail: '', hasVariants: false, options: [], variants: [], profitMode: 'manual', profitPercentage: 0, basePrice: 0, commissionPercentage: 0 });
    setIsAdding(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct({
        ...product,
        collectionId: product.collectionId ?? '',
        description: product.description ?? '',
        thumbnail: product.thumbnail ?? '',
        images: product.images ?? [],
        profitMode: product.profitMode || (product.useProfitPercentage ? 'margin' : 'manual'),
        profitPercentage: product.profitPercentage ?? 0,
        basePrice: product.basePrice ?? 0,
        commissionPercentage: product.commissionPercentage ?? 0
    });
  };

  return (
    <motion.div className="space-y-6 text-right pb-12" variants={containerVariants} initial="hidden" animate="visible" >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Package size={24} />
          </div>
          <h2 className="text-xl font-bold dark:text-white">قائمة المنتجات</h2>
        </div>
        <div className="flex flex-wrap gap-2">
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                <FileUp size={16} /> استيراد
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                <Download size={16} /> تصدير
            </button>
            <button
                onClick={() => setShowSyncCenter(true)}
                disabled={isSyncing || !isPlatformConnected}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all font-bold shadow-lg dark:shadow-none active:scale-95 disabled:bg-slate-400 ${
                  isPlatformConnected 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                }`}
            >
                <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'جاري المزامنة...' : isPlatformConnected ? `مزامنة المنتجات` : 'لم يتم ربط تطبيق لمزامنة منتجاته'}
            </button>
            <button 
                onClick={openAddModal}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95"
            >
                <Plus size={20} /> إضافة منتج جديد
            </button>
        </div>
      </motion.div>

      {syncStatus.type !== 'idle' && (
        <motion.div variants={itemVariants} className={`p-4 rounded-lg flex items-center gap-3 ${syncStatus.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
          {syncStatus.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{syncStatus.message}</span>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors relative">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="بحث بالاسم أو SKU..."
              className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-semibold border-b border-slate-100 dark:border-slate-700">
                <th className="px-6 py-4"></th>
                <th className="px-6 py-4">المنتج</th>
                <th className="px-6 py-4">القسم</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">المخزون</th>
                <th className="px-6 py-4">سعر البيع</th>
                <th className="px-6 py-4 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={40} className="text-slate-200 dark:text-slate-700" />
                      <p>لا توجد منتجات مطابقة.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const collection = settings.collections.find(c => c.id === product.collectionId);
                  return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-2">
                      {product.thumbnail ? (
                        <img src={product.thumbnail} alt={product.name} className="w-12 h-12 rounded-lg object-cover border-2 border-slate-100 dark:border-slate-700" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600"><ImageIcon size={20} /></div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{product.name}</div>
                        {product.id.startsWith('wuilt-') && (
                          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md font-bold">
                            <CheckCircle size={8} /> متزامن
                          </span>
                        )}
                      </div>
                      {product.hasVariants && <div className="text-[10px] text-slate-400">{product.variants.length} متغيرات</div>}
                    </td>
                    <td className="px-6 py-4">
                      {collection ? <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg">{collection.name}</span> : <span className="text-xs text-slate-400">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-fit"><Barcode size={12}/>{product.sku}</div>
                    </td>
                    <td className="px-6 py-4">
                      {product.stockQuantity === null || product.stockQuantity === undefined ? (
                         <span className="text-xs font-bold text-emerald-600">متاح دائماً</span>
                      ) : (
                         <span className={`font-bold ${product.stockQuantity > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-red-500'}`}>{product.stockQuantity}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{product.price.toLocaleString()} ج.م</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleGeneratePost(product)} disabled={isGenerating} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"><Wand2 size={18} /></button>
                        <button onClick={() => openEditModal(product)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit3 size={18} /></button>
                        <button onClick={() => setProductToDelete(product)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {(isAdding || editingProduct) && (
        <ProductFormModal isOpen={isAdding || !!editingProduct} onClose={() => { setIsAdding(false); setEditingProduct(null); }} onSave={handleSaveProduct} productData={editingProduct || newProduct} setProductData={editingProduct ? setEditingProduct : setNewProduct} settings={settings} isEditing={!!editingProduct} onGenerateDescription={handleGenerateDescription} isGenerating={isGenerating} />
      )}
      
      {isImportModalOpen && (
        <ProductImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onFileParse={handleParseCsv} isParsing={isParsingCsv} previewData={importPreview} onConfirmImport={handleConfirmImport} onDownloadTemplate={handleDownloadTemplate} />
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 text-center shadow-xl">
                <AlertCircle size={48} className="text-red-500 mx-auto mb-4"/>
                <h3 className="text-xl font-bold">حذف المنتج؟</h3>
                <p className="text-slate-500 mt-2">هل أنت متأكد من حذف "{productToDelete.name}"؟</p>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setProductToDelete(null)} className="flex-1 py-2 bg-slate-100 rounded-lg font-bold">إلغاء</button>
                    <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">حذف</button>
                </div>
            </div>
        </div>
      )}

      {showPostModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-xl relative">
                 <button onClick={() => setShowPostModal(false)} className="absolute top-4 right-4 text-slate-400"><XCircle/></button>
                 <h3 className="font-bold text-lg mb-4">منشور تسويقي مقترح</h3>
                 <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg whitespace-pre-wrap text-sm">{generatedPost}</div>
                 <button onClick={() => { navigator.clipboard.writeText(generatedPost); alert('تم النسخ!'); }} className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 py-2 rounded-lg font-bold"><Copy size={16}/> نسخ المنشور</button>
            </div>
        </div>
      )}

      {showSyncCenter && (
        <SyncCenterModal 
            isOpen={showSyncCenter}
            onClose={() => setShowSyncCenter(false)}
            settings={settings}
            onFetchProducts={handleFetchSelectableProducts}
            selectableProducts={selectableProducts}
            selectedIds={selectedProductIds}
            setSelectedIds={setSelectedProductIds}
            onConfirm={handleImportSelected}
            isFetching={isFetchingSelectable}
            isSyncing={isSyncing}
        />
      )}
    </motion.div>
  );
});

// --- Helper Components ---

interface ProductImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFileParse: (file: File) => void;
    isParsing: boolean;
    previewData: { products: Product[], errors: string[] } | null;
    onConfirmImport: () => void;
    onDownloadTemplate: () => void;
}

const ProductImportModal: React.FC<ProductImportModalProps> = ({ isOpen, onClose, onFileParse, isParsing, previewData, onConfirmImport, onDownloadTemplate }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold">استيراد المنتجات</h3>
              <button onClick={onClose}><XCircle size={24} className="text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 text-right" dir="rtl">
                {isParsing ? <div className="text-center py-12"><RefreshCw size={32} className="animate-spin mx-auto mb-2"/><p>جاري التحليل...</p></div> : 
                 !previewData ? (
                    <div className="space-y-6">
                        <button onClick={onDownloadTemplate} className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-lg font-bold flex items-center justify-center gap-2"><Download size={16}/> تحميل القالب</button>
                        <div onClick={() => fileInputRef.current?.click()} className="p-8 border-2 border-dashed border-slate-300 rounded-xl text-center cursor-pointer hover:border-indigo-500 transition-colors">
                            <FileUp size={32} className="mx-auto mb-2 text-slate-400"/>
                            <p className="font-bold">انقر هنا لاختيار ملف CSV</p>
                            <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && onFileParse(e.target.files[0])} accept=".csv" className="hidden" />
                        </div>
                    </div>
                 ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg font-bold">تم العثور على {previewData.products.length} منتج.</div>
                        {previewData.errors.length > 0 && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs space-y-1">{previewData.errors.map((e,i)=><div key={i}>{e}</div>)}</div>}
                    </div>
                 )
                }
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
                <button onClick={onClose} className="px-6 py-2 bg-white border rounded-lg font-bold">إغلاق</button>
                {previewData && previewData.products.length > 0 && <button onClick={onConfirmImport} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">استيراد المنتجات</button>}
            </div>
          </div>
        </div>,
        document.body
    );
};

const ProductFormModal: React.FC<any> = ({ isOpen, onClose, onSave, productData, setProductData, settings, isEditing, onGenerateDescription, isGenerating }) => {
    const [isSaving, setIsSaving] = useState(false);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const updateField = (field: string, value: any) => setProductData((prev: any) => ({ ...prev, [field]: value }));

    const handleFilesUpload = async (e: any) => {
        const files = e.type === 'drop' ? e.dataTransfer.files : e.target.files;
        if (!files || files.length === 0) return;
        
        const newImages: string[] = [];
        for (let i = 0; i < files.length; i++) {
           const file = files[i];
           const reader = new FileReader();
           const result = await new Promise((resolve) => {
               reader.onload = () => resolve(reader.result as string);
               reader.readAsDataURL(file);
           });
           newImages.push(result as string);
        }
        
        setProductData((prev: any) => {
            const currentImages = prev.images || [];
            // If they only had a thumbnail before, include it in images
            if (prev.thumbnail && currentImages.length === 0 && !currentImages.includes(prev.thumbnail)) {
                currentImages.push(prev.thumbnail);
            }
            let updatedImages = [...currentImages, ...newImages];
            return {
                ...prev,
                images: updatedImages,
                thumbnail: prev.thumbnail ? prev.thumbnail : updatedImages[0]
            };
        });
    };

    const removeImage = (index: number) => {
         setProductData((prev: any) => {
              const newImages = [...(prev.images || [])];
              const removedImage = newImages[index];
              newImages.splice(index, 1);
              let newThumbnail = prev.thumbnail;
              
              if (prev.thumbnail === removedImage || (!newImages.includes(prev.thumbnail) && newImages.length > 0)) {
                  newThumbnail = newImages.length > 0 ? newImages[0] : '';
              } else if (newImages.length === 0) {
                  newThumbnail = '';
              }
              
              return { ...prev, images: newImages, thumbnail: newThumbnail };
         });
    };

    const setAsPrimaryImage = (index: number) => {
        setProductData((prev: any) => {
            if (!prev.images || prev.images.length === 0) return prev;
            return { ...prev, thumbnail: prev.images[index] };
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent, target: string) => {
        e.preventDefault();
        e.stopPropagation();
        handleFileUpload(e, target);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[120] flex justify-center bg-slate-100 dark:bg-slate-900/90 backdrop-blur-sm overflow-hidden" dir="rtl">
          <div className="bg-slate-50 dark:bg-slate-900 w-full h-full flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                 <button onClick={onClose} className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"><X size={20} className="text-slate-600 dark:text-slate-300" /></button>
                 <div className="flex flex-col justify-center gap-1 leading-none py-1">
                    <div className="text-[12px] text-slate-500 font-bold flex items-center gap-1.5 leading-none">
                       <span>المنتجات</span>
                       <ChevronLeft size={12} className="text-slate-400" />
                    </div>
                    <h3 className="text-[22px] font-black text-slate-900 dark:text-slate-100 leading-none">{isEditing ? 'تعديل المنتج' : 'إضافة منتج'}</h3>
                 </div>
              </div>
              <div className="flex gap-3">
                 <button type="button" onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
                 <button type="button" onClick={async (e) => { setIsSaving(true); try { await onSave(e); } finally { setIsSaving(false); } }} disabled={isSaving} className="px-8 py-2.5 bg-[#1E293B] dark:bg-indigo-600 text-white rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors shadow-sm">{isSaving ? 'جاري الحفظ...' : 'حفظ'}</button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto w-full">
              <div className="max-w-6xl mx-auto p-6 lg:p-8">
                 <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    
                    {/* Right Main Column (2/3) */}
                    <div className="flex-1 space-y-6">
                       
                       {/* Top Type selector */}
                       <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg overflow-hidden flex shadow-sm border border-slate-200 dark:border-slate-700">
                           <div className="flex-1 px-4 py-3 bg-[#1e293b] text-white text-sm font-bold border-l border-slate-700 w-48 shrink-0 flex items-center">نوع المنتج</div>
                           <div className="flex-1">
                               <select className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-3 outline-none text-sm font-medium border-none cursor-pointer">
                                  <option>منتج عادي</option>
                               </select>
                           </div>
                       </div>

                       {/* Product Info */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">معلومات المنتج</div>
                          <div className="p-6 space-y-5">
                              <div>
                                 <label className="block text-xs font-bold text-slate-500 mb-2">الاسم</label>
                                 <input type="text" placeholder="اسم المنتج" value={productData.name || ''} onChange={(e)=>updateField('name', e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-4 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
                              </div>
                              <div>
                                 <div className="flex justify-between mb-2">
                                     <label className="block text-xs font-bold text-slate-500">وصف قصير</label>
                                     <span className="text-[10px] text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold"><Wand2 size={10}/> جديد. نقترحها لتحسين ظهور متجرك</span>
                                 </div>
                                 <input type="text" placeholder="الوصف القصير للمنتج" value={productData.shortDescription || ''} onChange={(e)=>updateField('shortDescription', e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-4 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
                                 <div className="text-[10px] text-emerald-600 mt-1 font-medium">{productData.shortDescription?.length || 0}/200 كحد أقصى (نوصي به)</div>
                              </div>
                              <div>
                                 <label className="block text-xs font-bold text-slate-500 mb-2">وصف المنتج</label>
                                 <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden bg-white dark:bg-slate-900">
                                     <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center gap-2 text-slate-500 overflow-x-auto">
                                         <span className="text-xs py-1 px-2 cursor-pointer font-medium hover:text-slate-800">File</span>
                                         <span className="text-xs py-1 px-2 cursor-pointer font-medium hover:text-slate-800">Edit</span>
                                         <span className="text-xs py-1 px-2 cursor-pointer font-medium hover:text-slate-800">View</span>
                                         <span className="text-xs py-1 px-2 cursor-pointer font-medium hover:text-slate-800">Insert</span>
                                         <span className="text-xs py-1 px-2 cursor-pointer font-medium hover:text-slate-800">Format</span>
                                         <span className="text-xs py-1 px-2 cursor-pointer font-medium hover:text-slate-800">Tools</span>
                                         <span className="text-xs py-1 px-2 cursor-pointer font-medium hover:text-slate-800">Table</span>
                                         {onGenerateDescription && (
                                           <span className="text-xs font-bold text-indigo-600 px-2 py-1 mr-auto cursor-pointer flex items-center gap-1 bg-indigo-50 rounded" onClick={()=>onGenerateDescription(isEditing)}>
                                              <Wand2 size={12}/> ذكاء اصطناعي
                                           </span>
                                         )}
                                     </div>
                                     <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-2 py-2 flex items-center gap-2 text-slate-500">
                                         <button type="button" className="p-1.5 hover:bg-slate-100 rounded text-slate-700 font-bold px-2">B</button>
                                         <button type="button" className="p-1.5 hover:bg-slate-100 rounded text-slate-700 italic px-2">I</button>
                                         <button type="button" className="p-1.5 hover:bg-slate-100 rounded text-slate-700 underline px-2">U</button>
                                         <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                         <button type="button" className="p-1.5 hover:bg-slate-100 rounded text-slate-700 px-2"><LayoutList size={14}/></button>
                                     </div>
                                     <textarea rows={8} className="w-full p-4 outline-none text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 resize-y" placeholder="اكتب وصف المنتج هنا..." value={productData.description || ''} onChange={(e)=>updateField('description', e.target.value)}></textarea>
                                 </div>
                              </div>
                          </div>
                       </div>

                       {/* Images */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100 flex justify-between items-center">
                             <span>صور المنتج</span>
                          </div>
                          <div className="p-6">
                              <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 no-scrollbar">
                                  {/* Upload Button */}
                                  <div 
                                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg shrink-0 w-40 h-40 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-slate-50 dark:bg-slate-900 relative overflow-hidden" 
                                    onClick={()=>galleryInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDrop={handleFilesUpload}
                                  >
                                       <div className="w-12 h-12 bg-white border border-teal-100 shadow-sm text-teal-600 rounded-xl flex items-center justify-center mb-3">
                                           <Upload size={20} className="text-teal-500" />
                                       </div>
                                       <div className="text-sm font-bold text-slate-700 dark:text-slate-300 rtl:tracking-tight">أضف صورًا</div>
                                       <input type="file" multiple ref={galleryInputRef} className="hidden" onChange={handleFilesUpload} accept="image/*" />
                                  </div>

                                  {/* Existing Images */}
                                  {(() => {
                                      // Render images, fallback to thumbnail if images array empty but thumbnail exists
                                      const imagesToRender = (productData.images && productData.images.length > 0) 
                                          ? productData.images 
                                          : (productData.thumbnail ? [productData.thumbnail] : []);

                                      return imagesToRender.map((img: string, idx: number) => (
                                          <div key={idx} className="relative shrink-0 w-40 h-40 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden group bg-slate-100 dark:bg-slate-800">
                                              <img src={img} alt={`Product ${idx+1}`} className="w-full h-full object-cover" />
                                              
                                              {/* Hover Overlay */}
                                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex flex-col items-center justify-center gap-2">
                                                  <button onClick={(e) => { e.stopPropagation(); removeImage(idx); }} className="p-2 bg-white hover:bg-red-500 hover:text-white rounded-lg text-slate-800 transition-colors shadow-sm">
                                                      <Trash2 size={16} />
                                                  </button>
                                                  {img !== productData.thumbnail && (
                                                      <button onClick={(e) => { e.stopPropagation(); setAsPrimaryImage(idx); }} className="px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                                          تعيين كأساسية
                                                      </button>
                                                  )}
                                              </div>

                                              {/* Checkbox (Primary Indicator) */}
                                              <div className="absolute top-2 right-2">
                                                  <button onClick={(e) => { e.stopPropagation(); setAsPrimaryImage(idx); }} className={`w-5 h-5 rounded flex items-center justify-center border shadow-sm transition-colors ${img === productData.thumbnail ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                                                      <CheckCircle size={14} className={img === productData.thumbnail ? 'opacity-100' : 'opacity-0'} />
                                                  </button>
                                              </div>
                                          </div>
                                      ));
                                  })()}
                              </div>
                          </div>
                       </div>

                       {/* Product Details (Dims) */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">تفاصيل المنتج</div>
                          <div className="p-6 space-y-5">
                              <div>
                                 <label className="block text-xs font-bold text-slate-500 mb-3">الأبعاد</label>
                                 <div className="grid grid-cols-3 gap-4">
                                     <div>
                                         <div className="text-[10px] text-slate-400 mb-1 text-center font-bold">الطول (بالسنتيمتر)</div>
                                         <input type="number" step="0.1" value={productData.length || ''} onChange={(e)=>updateField('length', parseFloat(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 text-center" dir="ltr" />
                                     </div>
                                     <div>
                                         <div className="text-[10px] text-slate-400 mb-1 text-center font-bold">العرض (بالسنتيمتر)</div>
                                         <input type="number" step="0.1" value={productData.width || ''} onChange={(e)=>updateField('width', parseFloat(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 text-center" dir="ltr" />
                                     </div>
                                     <div>
                                         <div className="text-[10px] text-slate-400 mb-1 text-center font-bold">الارتفاع (cm)</div>
                                         <input type="number" step="0.1" value={productData.height || ''} onChange={(e)=>updateField('height', parseFloat(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 text-center" dir="ltr" />
                                     </div>
                                 </div>
                              </div>
                          </div>
                       </div>

                       {/* Pricing and Profit */}
                       <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-6">
                           <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                               <h3 className="font-bold text-slate-800 dark:text-slate-100">التسعير والربح</h3>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div>
                                   <label className="flex text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                       <div className="flex items-center gap-1.5"><Scale size={16}/> <span>الوزن (كجم)</span></div>
                                   </label>
                                   <input type="number" step="0.01" value={productData.weight || ''} onChange={(e) => updateField('weight', parseFloat(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 transition-colors text-slate-800 dark:text-slate-200 text-left" dir="ltr" />
                               </div>
                               <div>
                                   <label className="flex text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                       <div className="flex items-center gap-1.5"><DollarSign size={16}/> <span>سعر البيع (ج.م)</span></div>
                                   </label>
                                   <input type="number" value={productData.price ?? ''} onChange={(e) => updateField('price', parseFloat(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 transition-colors text-slate-800 dark:text-slate-200 text-left" dir="ltr" />
                               </div>
                           </div>

                           <div>
                               <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">طريقة حساب التكلفة</label>
                               <div className="flex p-1 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                   <button type="button" onClick={() => setProductData((prev: any) => ({ ...prev, profitMode: 'commission', profitPercentage: 0, costPrice: prev.basePrice ? prev.basePrice - (prev.basePrice * (prev.commissionPercentage || 0) / 100) : prev.costPrice }))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${productData.profitMode === 'commission' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                       <HandCoins size={16} /> عمولة
                                   </button>
                                   <button type="button" onClick={() => setProductData((prev: any) => ({ ...prev, profitMode: 'margin', commissionPercentage: 0, basePrice: 0, costPrice: prev.price ? prev.price * (1 - (prev.profitPercentage || 0) / 100) : prev.costPrice }))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${productData.profitMode === 'margin' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                       <Percent size={16} /> % هامش ربح
                                   </button>
                                   <button type="button" onClick={() => setProductData((prev: any) => ({ ...prev, profitMode: 'manual', profitPercentage: 0, commissionPercentage: 0, basePrice: 0 }))} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${productData.profitMode === 'manual' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                       <Wallet size={16} /> يدوي
                                   </button>
                               </div>
                           </div>

                           {productData.profitMode === 'margin' && (
                               <div className="grid grid-cols-1 mt-4">
                                   <div>
                                       <label className="flex text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                           <div className="flex items-center gap-1.5"><Percent size={16}/> <span>نسبة هامش الربح %</span></div>
                                       </label>
                                       <input type="number" value={productData.profitPercentage ?? ''} onChange={(e) => {
                                           const pct = parseFloat(e.target.value) || 0;
                                           updateField('profitPercentage', pct);
                                           if (productData.price) {
                                               updateField('costPrice', productData.price * (1 - pct / 100));
                                           }
                                       }} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 transition-colors text-left" dir="ltr" />
                                   </div>
                               </div>
                           )}

                           {productData.profitMode === 'commission' && (
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                   <div>
                                       <label className="flex text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                           <div className="flex items-center gap-1.5"><Percent size={16}/> <span>نسبة العمولة %</span></div>
                                       </label>
                                       <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:border-indigo-500 transition-colors">
                                            <input type="number" value={productData.commissionPercentage ?? ''} onChange={(e) => {
                                                const pct = parseFloat(e.target.value) || 0;
                                                updateField('commissionPercentage', pct);
                                                if (productData.basePrice) {
                                                    updateField('costPrice', productData.basePrice - (productData.basePrice * pct / 100));
                                                }
                                            }} className="flex-1 px-4 py-3 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-left" dir="ltr" />
                                       </div>
                                   </div>
                                   <div>
                                       <label className="flex text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                           <div className="flex items-center gap-1.5"><DollarSign size={16}/> <span>السعر الأساسي</span></div>
                                       </label>
                                       <input type="number" value={productData.basePrice ?? ''} onChange={(e) => {
                                            const base = parseFloat(e.target.value) || 0;
                                            updateField('basePrice', base);
                                            if (productData.commissionPercentage) {
                                                updateField('costPrice', base - (base * productData.commissionPercentage / 100));
                                            }
                                       }} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 transition-colors text-left" dir="ltr" />
                                   </div>
                               </div>
                           )}

                           <div className="mt-4">
                               <label className="flex text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                   <div className="flex items-center gap-1.5"><Wallet size={16}/> <span>التكلفة (ج.م)</span></div>
                               </label>
                               <input type="number" value={productData.costPrice ?? ''} onChange={(e)=>updateField('costPrice', parseFloat(e.target.value))} readOnly={productData.profitMode !== 'manual'} className={`w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-left ${productData.profitMode !== 'manual' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-slate-50 dark:bg-slate-900 text-slate-800'}`} dir="ltr" />
                           </div>
                       </div>

                       {/* Inventory */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">المخزون</div>
                          <div className="p-6 space-y-5">
                              <div>
                                 <label className="block text-xs font-bold text-slate-500 mb-2">SKU (رمز المنتج في المخزون)</label>
                                 <input type="text" placeholder="وحدة حفظ المخزون - SKU" value={productData.sku || ''} onChange={(e)=>updateField('sku', e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-4 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
                              </div>
                              <div>
                                 <label className="flex items-center gap-1 text-xs font-bold text-slate-500 mb-2"><Info size={12}/> الكمية</label>
                                 <input type="text" placeholder="متوفر" value={productData.stockQuantity !== null ? productData.stockQuantity : ''} onChange={(e)=>updateField('stockQuantity', e.target.value === '' ? null : parseInt(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-4 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-left" dir="ltr"/>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 mt-4 border-t border-slate-100 pt-4">
                                  <input type="checkbox" className="mt-1 flex-shrink-0 cursor-pointer" id="limitCart"/>
                                  <label htmlFor="limitCart" className="cursor-pointer font-medium text-slate-500 flex flex-col">
                                      <span>ضع حد معين لكمية طلب هذا المنتج عند إضافته للسلة</span>
                                      <span className="text-xs text-slate-400 mt-0.5">ضع حد أدنى وأقصى للكمية التي يمكن لعملائك إضافتها للسلة من هذا المنتج</span>
                                  </label>
                              </div>
                          </div>
                       </div>

                       {/* Options */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">المتغيرات</div>
                          <div className="p-6 flex items-center justify-between">
                              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">هذا المنتج يحتوي على خيارات متعددة، كالمقاسات أو الألوان المختلفة</span>
                              <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in ml-2">
                                  <input type="checkbox" checked={productData.hasVariants || false} onChange={(e)=>updateField('hasVariants', e.target.checked)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-slate-200 transition-transform duration-200" style={{ right: productData.hasVariants ? '0' : 'auto', left: productData.hasVariants ? 'auto' : '0', transform: productData.hasVariants ? 'translateX(-100%)' : 'translateX(0)', borderColor: productData.hasVariants ? '#14b8a6' : '#e2e8f0', backgroundColor: productData.hasVariants ? '#14b8a6' : '#fff' }}/>
                                  <label className="toggle-label block overflow-hidden h-5 rounded-full bg-slate-200 cursor-pointer transition-colors duration-200" style={{ backgroundColor: productData.hasVariants ? '#ccfbf1' : '#e2e8f0' }}></label>
                              </div>
                          </div>
                          {productData.hasVariants && <div className="p-6 border-t border-slate-100 dark:border-slate-800"><VariantManager productData={productData} setProductData={setProductData} settings={settings} /></div>}
                       </div>

                       {/* Characteristics */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                             <div className="font-bold text-slate-800 dark:text-slate-100">خصائص المنتجات</div>
                             <div className="font-bold text-slate-800 dark:text-slate-100 text-teal-600 flex items-center gap-1.5 cursor-pointer text-sm"><SettingsIcon size={14} className="text-teal-600"/> إدارة خصائص المنتج</div>
                          </div>
                          <div className="p-6">
                              <p className="text-xs font-medium text-slate-500 mb-4 leading-relaxed">أضف خصائص لهذا المنتج لأنها تساعد العملاء على العثور عليه ضمن التصفية والفرز، تظهر ضمن "المواصفات" في صفحة المنتج</p>
                              <button type="button" className="text-teal-600 font-bold text-sm hover:underline flex items-center gap-1">+ أضف خاصية</button>
                          </div>
                       </div>

                       {/* Taxes */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">ضرائب</div>
                          <div className="p-6 space-y-5">
                              <div className="flex items-center gap-4 text-sm text-slate-700 dark:text-slate-300 w-full justify-between">
                                  <div className="flex-1">
                                      <div className="font-medium">إضافة ضريبة على هذا المنتج</div>
                                      <div className="text-xs text-slate-400 mt-1">الضريبة العامة .%</div>
                                  </div>
                                  <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in flex-shrink-0">
                                      <input type="checkbox" defaultChecked className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-teal-600 border-4 appearance-none cursor-pointer border-teal-600 transition-transform duration-200" style={{ right: '0', transform: 'translateX(-100%)', backgroundColor: '#fff' }}/>
                                      <label className="toggle-label block overflow-hidden h-5 rounded-full bg-teal-600 cursor-pointer"></label>
                                  </div>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-500 border-t border-slate-100 pt-5">
                                  <input type="radio" id="specialTax" className="w-4 h-4 text-teal-600 accent-teal-600" />
                                  <label htmlFor="specialTax">أضف ضريبة خاصة على هذا المنتج</label>
                              </div>
                          </div>
                       </div>

                       {/* SEO */}
                       <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">التهيئة لمحركات البحث (SEO)</div>
                          <div className="p-6 space-y-5">
                              <div>
                                 <label className="block text-xs font-bold text-slate-500 mb-2">رابط URL للمنتج</label>
                                 <div className="flex border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden bg-slate-50 dark:bg-slate-800">
                                     <div className="px-4 py-2.5 text-slate-500 text-sm font-bold flex items-center shrink-0 border-r border-slate-200 dark:border-slate-700 order-last" dir="ltr">../product/</div>
                                     <input type="text" value={productData.slug || ''} onChange={(e)=>updateField('slug', e.target.value)} className="flex-1 px-4 py-2.5 outline-none bg-white dark:bg-slate-900 text-left" dir="ltr" />
                                 </div>
                                 <div className="text-[10px] text-slate-400 mt-1.5ext-left font-medium" dir="ltr">https://store.com/ar/product/all/{productData.slug || 'slug'}</div>
                              </div>
                              <div>
                                 <div className="flex justify-between items-center mb-2">
                                     <label className="block text-xs font-bold text-slate-500">الاسم</label>
                                     <span className="text-[10px] text-slate-400 font-bold">60 أقصى عدد للحروف هو</span>
                                 </div>
                                 <input type="text" value={productData.seoTitle || ''} onChange={(e)=>updateField('seoTitle', e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-4 py-2.5 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
                              </div>
                               <div>
                                 <div className="flex justify-between items-center mb-2">
                                     <label className="block text-xs font-bold text-slate-500">الوصف</label>
                                     <span className="text-[10px] text-slate-400 font-bold">160 أقصى عدد للحروف هو</span>
                                 </div>
                                 <textarea rows={4} value={productData.seoDescription || ''} onChange={(e)=>updateField('seoDescription', e.target.value)} placeholder="الوصف التعريفي للصفحة يوضح محتوى الصفحة ويساعدها على الظهور فى نتائج البحث" className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-4 py-3 outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none"></textarea>
                              </div>
                          </div>
                       </div>

                       <div className="h-6"></div> {/* Spacer */}

                    </div>

                    {/* Left Sidebar (1/3) */}
                    <div className="w-full lg:w-[320px] space-y-6 shrink-0 order-first lg:order-last">
                        
                        {/* Status */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
                            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 text-right">الحالة</label>
                            <div className="relative mb-5">
                                <select value={productData.isActive !== false ? 'active' : 'inactive'} onChange={(e)=>updateField('isActive', e.target.value === 'active')} className="w-full bg-white dark:bg-slate-900 border border-emerald-400 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-lg outline-none appearance-none shadow-[0_0_0_2px_rgba(52,211,153,0.1)] font-medium text-sm transition-shadow">
                                    <option value="active">نشط</option>
                                    <option value="inactive">غير نشط</option>
                                </select>
                                <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            
                            <input type="text" placeholder="ابحث أو أنشئ مجموعة" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-md outline-none focus:border-indigo-500 text-sm" />
                        </div>
                    </div>

                 </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
    );
};

const VariantManager = ({ productData, setProductData, settings }: any) => {
    const handleOptionToggle = (optionName: string, isChecked: boolean) => {
        const currentOptions = productData.options || [];
        const newOptions = isChecked ? [...currentOptions, optionName] : currentOptions.filter((o: string) => o !== optionName);
        setProductData((prev: Product) => ({ ...prev, options: newOptions }));
    };

    const generateVariants = () => {
        const selectedGlobalOptions = (settings.globalOptions || []).filter((go: any) => (productData.options || []).includes(go.name));
        if (selectedGlobalOptions.length === 0) return;

        const valueArrays = selectedGlobalOptions.map((go: any) => go.values);
        
        const cartesian = (...a: any[]) => a.reduce((a, b) => a.flatMap((d: any) => b.map((e: any) => [d, e].flat())));
        
        const combinations = cartesian(...valueArrays);
        
        const newVariants: ProductVariant[] = combinations.map((combo: string | string[], index: number) => {
            const comboArray = Array.isArray(combo) ? combo : [combo];
            const options: { [key: string]: string } = {};
            selectedGlobalOptions.forEach((opt: any, i: number) => {
                options[opt.name] = comboArray[i];
            });

            const existingVariant = (productData.variants || []).find((v: any) => {
                return JSON.stringify(v.options) === JSON.stringify(options);
            });

            return {
                id: existingVariant?.id || `${Date.now()}-${index}`,
                options: options,
                sku: existingVariant?.sku || `${productData.sku || 'SKU'}-${comboArray.join('-')}`,
                price: existingVariant?.price || productData.price || 0,
                stockQuantity: existingVariant?.stockQuantity ?? 0,
            };
        });

        setProductData((prev: Product) => ({ ...prev, variants: newVariants }));
    };

    const updateVariant = (variantId: string, field: keyof ProductVariant, value: string | number) => {
        const updatedVariants = productData.variants.map((v: ProductVariant) => (v.id === variantId ? { ...v, [field]: value } : v));
        setProductData((prev: Product) => ({ ...prev, variants: updatedVariants }));
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs font-bold text-slate-500 mb-3 block">الخيارات المتاحة (يجب إعدادها في الإعدادات مسبقاً)</label>
                <div className="flex flex-wrap gap-2">
                    {(settings.globalOptions || []).map((opt: any) => (
                        <label key={opt.id} className="flex items-center gap-2 p-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-teal-500 transition-colors">
                            <input type="checkbox" checked={(productData.options || []).includes(opt.name)} onChange={e => handleOptionToggle(opt.name, e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500 accent-teal-600"/>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.name}</span>
                        </label>
                    ))}
                    {(settings.globalOptions || []).length === 0 && (
                        <div className="text-xs text-slate-400">لا توجد خيارات متاحة. يرجى إضافتها من قائمة الإعدادات &gt; الخيارات العامة.</div>
                    )}
                </div>
            </div>
            
            <button type="button" onClick={generateVariants} disabled={(productData.options || []).length === 0} className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
                <ChevronsUpDown size={16}/> توليد المتغيرات تلقائياً
            </button>
            
            {(productData.variants || []).length > 0 && (
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 block border-b border-slate-100 dark:border-slate-700 pb-2">بيانات المتغيرات</label>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                        {productData.variants.map((variant: ProductVariant) => (
                            <div key={variant.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div className="col-span-3 text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={Object.values(variant.options).join(' / ')}>
                                    {Object.values(variant.options).join(' / ')}
                                </div>
                                <div className="col-span-3 flex items-center border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded overflow-hidden">
                                    <span className="text-[9px] font-bold text-slate-400 px-2 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-600 h-full flex items-center">SKU</span>
                                    <input type="text" value={variant.sku} onChange={e => updateVariant(variant.id, 'sku', e.target.value)} className="w-full text-xs p-1.5 outline-none bg-transparent" dir="ltr" />
                                </div>
                                <div className="col-span-3 flex items-center border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded overflow-hidden">
                                    <span className="text-[9px] font-bold text-slate-400 px-2 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-600 h-full flex items-center">السعر</span>
                                    <input type="number" value={variant.price} onChange={e => updateVariant(variant.id, 'price', Number(e.target.value))} className="w-full text-xs p-1.5 outline-none bg-transparent" dir="ltr" />
                                </div>
                                <div className="col-span-3 flex items-center border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded overflow-hidden">
                                    <span className="text-[9px] font-bold text-slate-400 px-2 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-600 h-full flex items-center">كمية</span>
                                    <input type="number" value={variant.stockQuantity ?? ''} onChange={e => updateVariant(variant.id, 'stockQuantity', e.target.value === '' ? 0 : Number(e.target.value))} className="w-full text-xs p-1.5 outline-none bg-transparent" dir="ltr" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SyncCenterModal: React.FC<any> = ({ isOpen, onClose, settings, onFetchProducts, selectableProducts, selectedIds, setSelectedIds, onConfirm, isFetching, isSyncing }) => {
    const [step, setStep] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const platforms = useMemo(() => {
        const list = [];
        const wuiltConfig = settings.platformConfigs?.['wuilt'] || (settings.integration?.platform === 'wuilt' ? { ...settings.integration, isActive: true } : null);
        if (wuiltConfig?.isActive) list.push({ id: 'wuilt', name: 'Wuilt (ويلت)', icon: 'https://wuilt.com/favicon.ico' });
        return list;
    }, [settings]);
    const filtered = selectableProducts.filter((p:any)=>p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="p-6 border-b flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2"><RefreshCw size={20} className={isSyncing||isFetching ? 'animate-spin':''} /> مركز المزامنة</h3>
                    <button onClick={onClose}><XCircle size={24} className="text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 text-right" dir="rtl">
                    {step === 1 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {platforms.map((p:any)=>(
                                <button key={p.id} onClick={()=>{onFetchProducts(p.id); setStep(2);}} className="p-4 border rounded-2xl hover:border-emerald-500 flex items-center gap-4">
                                    <img src={p.icon} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                                    <div className="text-right"><p className="font-bold">{p.name}</p><p className="text-[10px] text-slate-500">استيراد المنتجات والأسعار</p></div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <input value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} placeholder="بحث في المنتجات المكتشفة..." className="w-full p-2 bg-slate-100 rounded-lg text-sm outline-none" />
                            <div className="h-64 border rounded-xl overflow-y-auto p-2 space-y-2">
                                {isFetching ? <div className="text-center py-12"><RefreshCw className="animate-spin mx-auto"/></div> : 
                                 filtered.map((p:any)=>(
                                    <div key={p.id} onClick={()=>{const n=new Set(selectedIds); n.has(p.id)?n.delete(p.id):n.add(p.id); setSelectedIds(n);}} className={`p-3 border rounded-xl flex items-center gap-3 cursor-pointer ${selectedIds.has(p.id)?'border-emerald-500 bg-emerald-50':''}`}>
                                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedIds.has(p.id)?'bg-emerald-600 border-emerald-600 text-white':''}`}>{selectedIds.has(p.id)&&<CheckCircle size={12}/>}</div>
                                        {p.thumbnail && <img src={p.thumbnail} className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />}
                                        <div className="flex-1 font-bold text-xs">{p.name}</div>
                                        <div className="text-emerald-600 font-bold text-xs">{p.price} ج.م</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 bg-white border rounded-lg font-bold">إلغاء</button>
                    {step === 2 && <button onClick={onConfirm} disabled={!selectedIds.size||isSyncing} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold disabled:bg-slate-400">{isSyncing ? 'جاري الاستيراد...' : `مزامنة المختار (${selectedIds.size})`}</button>}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProductsPage;
