import React from 'react';
import { X, Upload, PlusSquare } from 'lucide-react';

const IosInstallPrompt = ({ onClose }: { onClose: () => void }) => {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl p-6 text-center animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 left-3 p-1 text-slate-400 hover:text-red-500"><X size={20}/></button>
        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">لتثبيت التطبيق على جهازك</h3>
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 text-right">
            <div className="flex items-center gap-4">
                <span className="font-black text-3xl text-slate-300 dark:text-slate-600">1</span>
                <p>اضغط على زر المشاركة <Upload className="inline-block mx-1 text-blue-500" size={20}/> في شريط المتصفح.</p>
            </div>
             <div className="flex items-center gap-4">
                <span className="font-black text-3xl text-slate-300 dark:text-slate-600">2</span>
                <p>مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية" <PlusSquare className="inline-block mx-1 text-blue-500" size={20}/>.</p>
            </div>
             <div className="flex items-center gap-4">
                <span className="font-black text-3xl text-slate-300 dark:text-slate-600">3</span>
                <p>اضغط على "إضافة" في الزاوية العلوية.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default IosInstallPrompt;